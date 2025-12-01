const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const config = {
  soldierCount: 10,
  soldierSpacing: 26,
  soldierRadius: 10,
  enemyRadius: 14,
  bulletRadius: 4,
  soldierSpeed: 220,
  bulletSpeed: 420,
  enemyBaseSpeed: 90,
  fireDelay: 0.22,
  spawnDelay: 1.1,
};

const state = {
  time: 0,
  lastShot: 0,
  lastSpawn: 0,
  score: 0,
  wave: 1,
  health: 3,
  center: { x: canvas.width / 2, y: canvas.height * 0.72 },
  velocity: { x: 0, y: 0 },
  soldiers: [],
  bullets: [],
  enemies: [],
  gameOver: false,
};

const keys = new Set();

function init() {
  state.soldiers = Array.from({ length: config.soldierCount }, (_, i) => ({
    x: state.center.x,
    y: state.center.y,
    angle: (Math.PI * 2 * i) / config.soldierCount,
  }));

  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (e.code === "Space") e.preventDefault();
  });

  window.addEventListener("keyup", (e) => keys.delete(e.code));

  requestAnimationFrame(loop);
}

function update(dt) {
  if (state.gameOver) return;

  const horizontal = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) -
    (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
  const vertical = (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0) -
    (keys.has("ArrowUp") || keys.has("KeyW") ? 1 : 0);

  const magnitude = Math.hypot(horizontal, vertical) || 1;
  state.velocity.x = (horizontal / magnitude) * config.soldierSpeed;
  state.velocity.y = (vertical / magnitude) * config.soldierSpeed;

  state.center.x = clamp(
    state.center.x + state.velocity.x * dt,
    80,
    canvas.width - 80,
  );
  state.center.y = clamp(
    state.center.y + state.velocity.y * dt,
    200,
    canvas.height - 80,
  );

  // Soldier formation
  state.soldiers.forEach((soldier, i) => {
    const target = formationTarget(i, state.soldiers.length);
    const targetX = state.center.x + target.x * config.soldierSpacing;
    const targetY = state.center.y + target.y * config.soldierSpacing;
    soldier.x += (targetX - soldier.x) * 8 * dt;
    soldier.y += (targetY - soldier.y) * 8 * dt;
  });

  handleFiring();
  updateBullets(dt);
  updateEnemies(dt);
  checkCollisions();
}

function formationTarget(index, total) {
  const ring = Math.floor(index / 6);
  const positionInRing = index % 6;
  const radius = 1 + ring * 0.9;
  const angle = ((Math.PI * 2) / 6) * positionInRing + (ring % 2 === 0 ? 0 : Math.PI / 6);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function handleFiring() {
  const wantsFire = keys.has("Space");
  if (!wantsFire) return;
  if (state.time - state.lastShot < config.fireDelay) return;

  const shooter = state.soldiers[Math.floor(Math.random() * state.soldiers.length)];
  state.bullets.push({ x: shooter.x, y: shooter.y - 6, vx: 0, vy: -config.bulletSpeed });
  state.lastShot = state.time;
}

function spawnEnemy() {
  const speed = config.enemyBaseSpeed + Math.min(140, state.wave * 12);
  const x = 40 + Math.random() * (canvas.width - 80);
  state.enemies.push({ x, y: -20, vx: 0, vy: speed, hp: 1 + Math.floor(state.wave / 4) });
}

function updateBullets(dt) {
  state.bullets.forEach((b) => (b.y += b.vy * dt));
  state.bullets = state.bullets.filter((b) => b.y > -40 && b.y < canvas.height + 40);
}

function updateEnemies(dt) {
  if (state.time - state.lastSpawn > Math.max(0.35, config.spawnDelay - state.wave * 0.05)) {
    spawnEnemy();
    state.lastSpawn = state.time;
  }

  state.enemies.forEach((enemy) => {
    enemy.y += enemy.vy * dt;
  });
  state.enemies = state.enemies.filter((e) => e.y < canvas.height + 50);
}

function checkCollisions() {
  // Bullet vs enemy
  state.bullets.forEach((bullet) => {
    state.enemies.forEach((enemy) => {
      if (intersects(bullet, config.bulletRadius, enemy, config.enemyRadius)) {
        enemy.hp -= 1;
        bullet.hit = true;
        if (enemy.hp <= 0) {
          enemy.dead = true;
          state.score += 10;
          if (state.score % 80 === 0) state.wave += 1;
        }
      }
    });
  });

  state.bullets = state.bullets.filter((b) => !b.hit);
  state.enemies = state.enemies.filter((e) => !e.dead);

  // Enemies vs soldiers/center
  state.enemies.forEach((enemy) => {
    state.soldiers.forEach((soldier) => {
      if (intersects(enemy, config.enemyRadius, soldier, config.soldierRadius)) {
        enemy.dead = true;
        soldier.down = true;
        state.health -= 1;
      }
    });
  });

  state.enemies = state.enemies.filter((e) => !e.dead);
  state.soldiers = state.soldiers.filter((s) => !s.down);

  if (state.health <= 0 || state.soldiers.length === 0) {
    state.gameOver = true;
  }
}

function intersects(a, ra, b, rb) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < (ra + rb) * (ra + rb);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackdrop();
  drawHUD();
  drawSoldiers();
  drawEnemies();
  drawBullets();
  if (state.gameOver) drawGameOver();
}

function drawBackdrop() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#0f1624");
  gradient.addColorStop(1, "#0a0d13");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let y = 80; y < canvas.height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(canvas.width - 60, y);
    ctx.stroke();
  }
}

function drawHUD() {
  ctx.fillStyle = "rgba(10,12,19,0.7)";
  ctx.fillRect(12, 12, 220, 76);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.strokeRect(12.5, 12.5, 219, 75);

  ctx.fillStyle = "#e5ecf5";
  ctx.font = "18px Inter, sans-serif";
  ctx.fillText(`Score: ${state.score}`, 24, 36);
  ctx.fillText(`Wave: ${state.wave}`, 24, 60);
  ctx.fillText(`Squad: ${state.soldiers.length}`, 24, 84);

  drawHealth();
}

function drawHealth() {
  const startX = 140;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = i < state.health ? "#2ecc71" : "#3a4559";
    ctx.moveTo(startX + i * 22, 28);
    ctx.lineTo(startX + i * 22 + 14, 28);
    ctx.stroke();
  }
}

function drawSoldiers() {
  ctx.fillStyle = "#0e0";
  state.soldiers.forEach((soldier) => {
    ctx.beginPath();
    ctx.fillStyle = "#2ecc71";
    ctx.strokeStyle = "#1f8f52";
    ctx.lineWidth = 3;
    ctx.arc(soldier.x, soldier.y, config.soldierRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Green patch (armband)
    ctx.beginPath();
    ctx.strokeStyle = "#a0ffb4";
    ctx.lineWidth = 4;
    ctx.arc(soldier.x, soldier.y, config.soldierRadius - 3, Math.PI * 0.15, Math.PI * 0.55);
    ctx.stroke();
  });
}

function drawEnemies() {
  state.enemies.forEach((enemy) => {
    ctx.beginPath();
    ctx.fillStyle = "#3498db";
    ctx.strokeStyle = "#1f6fa8";
    ctx.lineWidth = 3;
    ctx.arc(enemy.x, enemy.y, config.enemyRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Blue patch
    ctx.beginPath();
    ctx.strokeStyle = "#8fc3ff";
    ctx.lineWidth = 4;
    ctx.arc(enemy.x, enemy.y, config.enemyRadius - 4, -Math.PI * 0.2, Math.PI * 0.1);
    ctx.stroke();
  });
}

function drawBullets() {
  ctx.fillStyle = "#e9f0ff";
  state.bullets.forEach((b) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, config.bulletRadius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGameOver() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#e5ecf5";
  ctx.font = "bold 42px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 20);

  ctx.font = "20px Inter, sans-serif";
  ctx.fillText(`Score ${state.score} — Wave ${state.wave}`, canvas.width / 2, canvas.height / 2 + 14);
  ctx.fillText("Refresh the page to restart", canvas.width / 2, canvas.height / 2 + 44);
  ctx.textAlign = "left";
}

let lastTime = 0;
function loop(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
  lastTime = timestamp;
  state.time += dt;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

init();
