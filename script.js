const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: false });

const TAU = Math.PI * 2;

let userClusters = [];
let backgroundClusters = [];

let lastBackgroundSpawn = 0;

const BACKGROUND_SPAWN_DELAY = 1600;
const MAX_BACKGROUND_CLUSTERS = 8;
const MAX_USER_CLUSTERS = 35;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

canvas.addEventListener("click", (event) => {
  userClusters.push(
    new Cluster(event.clientX, event.clientY, "foreground")
  );

  if (userClusters.length > MAX_USER_CLUSTERS) {
    userClusters.shift();
  }
});

function jitter(seed) {
  return ((Math.sin(seed * 12.9898) * 43758.5453) % 1 - 0.5);
}

function randomBackgroundPosition() {
  const padding = 130;

  return {
    x: padding + Math.random() * Math.max(1, canvas.width - padding * 2),
    y: padding + Math.random() * Math.max(1, canvas.height - padding * 2)
  };
}

function createBackgroundCluster() {
  const position = randomBackgroundPosition();

  backgroundClusters.push(
    new Cluster(position.x, position.y, "background")
  );

  if (backgroundClusters.length > MAX_BACKGROUND_CLUSTERS) {
    backgroundClusters.shift();
  }
}

class Circle {
  constructor(x, y, finalRadius, speed, seed, type) {
    this.x = x;
    this.y = y;
    this.finalRadius = finalRadius;
    this.radius = 0;
    this.progress = 0;
    this.speed = speed;
    this.seed = seed;
    this.type = type;
    this.trail = [];
    this.finished = false;
  }

  update() {
    if (this.finished) return;

    this.progress += this.speed;

    if (this.progress >= 1) {
      this.progress = 1;
      this.finished = true;
      this.trail = [];
    }

    this.radius = this.finalRadius * this.progress;

    if (!this.finished) {
      this.trail.push(this.radius);

      const maxTrail = this.type === "background" ? 3 : 6;

      if (this.trail.length > maxTrail) {
        this.trail.shift();
      }
    }
  }

  drawRing(radius, opacity, lineWidth) {
    const offset = jitter(this.seed + radius) * 1.1;

    ctx.beginPath();

    ctx.arc(
      this.x,
      this.y,
      Math.max(0, radius + offset),
      0,
      TAU
    );

    ctx.strokeStyle = `rgba(235, 235, 240, ${opacity})`;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  drawForeground() {
    if (this.finished) {
      this.drawRing(this.finalRadius, 0.92, 1.4);
      return;
    }

    for (let i = 0; i < this.trail.length; i++) {
      const amount = (i + 1) / this.trail.length;
      this.drawRing(this.trail[i], amount * 0.17, 1);
    }

    this.drawRing(this.radius, 0.92, 1.4);
  }

  drawBackground() {
    if (this.finished) {
      // More visible than before, but still much dimmer than foreground.
      this.drawRing(this.finalRadius, 0.22, 1.1);
      return;
    }

    // One muted trailing ring, keeping the fog effect light.
    if (this.trail.length > 1) {
      this.drawRing(this.trail[0], 0.07, 1);
    }

    this.drawRing(this.radius, 0.25, 1.1);
  }

  draw() {
    if (this.type === "background") {
      this.drawBackground();
    } else {
      this.drawForeground();
    }
  }
}

class Cluster {
  constructor(x, y, type) {
    this.type = type;

    const mainRadius =
      type === "background"
        ? 45 + Math.random() * 65
        : 60 + Math.random() * 40;

    const mainSpeed =
      type === "background"
        ? 0.004 + Math.random() * 0.002
        : 0.008;

    this.main = new Circle(
      x,
      y,
      mainRadius,
      mainSpeed,
      Math.random() * 1000,
      type
    );

    this.children = [];
    this.childrenSpawned = false;
  }

  createChildren() {
    const x = this.main.x;
    const y = this.main.y;
    const mainRadius = this.main.finalRadius;
    const childRadius = mainRadius * (0.24 + Math.random() * 0.08);

    const positions = [
      { x: x, y: y - mainRadius },
      { x: x + mainRadius, y: y },
      { x: x, y: y + mainRadius },
      { x: x - mainRadius, y: y }
    ];

    positions.forEach((position, index) => {
      const speed =
        this.type === "background"
          ? 0.005 + Math.random() * 0.002
          : 0.01 + Math.random() * 0.004;

      this.children.push(
        new Circle(
          position.x,
          position.y,
          childRadius,
          speed,
          Math.random() * 1000 + index,
          this.type
        )
      );
    });
  }

  update() {
    this.main.update();

    if (this.main.progress >= 0.65 && !this.childrenSpawned) {
      this.childrenSpawned = true;
      this.createChildren();
    }

    this.children.forEach((child) => child.update());
  }

  draw() {
    this.main.draw();
    this.children.forEach((child) => child.draw());
  }
}

function drawBackgroundClusters() {
  ctx.save();

  /*
    A low blur keeps the background soft but costs less than a strong blur.
    Opacity above is what makes the background more visible.
  */
  ctx.filter = "blur(2px)";
  ctx.globalAlpha = 0.9;

  backgroundClusters.forEach((cluster) => {
    cluster.draw();
  });

  ctx.restore();
}

function animate(timestamp) {
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (timestamp - lastBackgroundSpawn > BACKGROUND_SPAWN_DELAY) {
    createBackgroundCluster();
    lastBackgroundSpawn = timestamp;
  }

  backgroundClusters.forEach((cluster) => cluster.update());
  userClusters.forEach((cluster) => cluster.update());

  // Visible but foggy background layer.
  drawBackgroundClusters();

  // Clear, bright click-created circles on top.
  userClusters.forEach((cluster) => cluster.draw());

  requestAnimationFrame(animate);
}

animate();