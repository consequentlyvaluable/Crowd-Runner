const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const config = {
  soldierCount: 10,
  soldierSpacing: 26,
  soldierRadius: 10,
  enemyRadius: 14,
  bulletRadius: 4,
  soldierSpeed: 220,
  bulletSpeed: 460,
  enemyBaseSpeed: 90,
  fireDelay: 0.18,
  spawnDelay: 1.05,
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
  if (state.time - state.lastShot < config.fireDelay) return;
  if (!state.enemies.length || !state.soldiers.length) return;

  // Aim for the closest enemy to the squad center
  const target = state.enemies.reduce((nearest, enemy) => {
    const dist = Math.hypot(enemy.x - state.center.x, enemy.y - state.center.y);
    return dist < nearest.dist ? { enemy, dist } : nearest;
  }, { enemy: state.enemies[0], dist: Infinity }).enemy;

  const shooter = state.soldiers[Math.floor(Math.random() * state.soldiers.length)];
  const dx = target.x - shooter.x;
  const dy = target.y - shooter.y;
  const len = Math.hypot(dx, dy) || 1;
  const vx = (dx / len) * config.bulletSpeed;
  const vy = (dy / len) * config.bulletSpeed;

  state.bullets.push({ x: shooter.x, y: shooter.y, vx, vy });
  state.lastShot = state.time;
}

function spawnEnemy() {
  const speed = config.enemyBaseSpeed + Math.min(140, state.wave * 12);
  const x = 40 + Math.random() * (canvas.width - 80);
  state.enemies.push({ x, y: -20, vx: 0, vy: speed, hp: 1 + Math.floor(state.wave / 4) });
}

function updateBullets(dt) {
  state.bullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  });
  state.bullets = state.bullets.filter(
    (b) => b.y > -40 && b.y < canvas.height + 40 && b.x > -40 && b.x < canvas.width + 40,
  );
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
  ctx.fillStyle = "#080a10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer abyss
  const abyssGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  abyssGrad.addColorStop(0, "#070912");
  abyssGrad.addColorStop(1, "#0a0d14");
  ctx.fillStyle = abyssGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Main lane
  const laneWidth = 520;
  const laneX = (canvas.width - laneWidth) / 2;
  const laneGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  laneGrad.addColorStop(0, "#3d0f1a");
  laneGrad.addColorStop(1, "#801f2e");
  ctx.fillStyle = laneGrad;
  ctx.fillRect(laneX, 40, laneWidth, canvas.height - 80);

  // Checker tiles
  for (let y = 40; y < canvas.height - 40; y += 42) {
    for (let x = laneX; x < laneX + laneWidth; x += 42) {
      ctx.fillStyle = (x / 42 + y / 42) % 2 === 0 ? "#912333" : "#7a1d2a";
      ctx.fillRect(x + 2, y + 2, 38, 38);
    }
  }

  // Railings
  ctx.fillStyle = "#1d1f29";
  ctx.fillRect(laneX - 20, 40, 20, canvas.height - 80);
  ctx.fillRect(laneX + laneWidth, 40, 20, canvas.height - 80);
  ctx.fillStyle = "#2b303c";
  for (let y = 40; y < canvas.height - 60; y += 26) {
    ctx.fillRect(laneX - 22, y, 24, 8);
    ctx.fillRect(laneX + laneWidth - 2, y, 24, 8);
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
  state.soldiers.forEach((soldier) => {
    ctx.save();
    ctx.translate(soldier.x, soldier.y);
    ctx.fillStyle = "#31d87a";
    ctx.strokeStyle = "#1f8f52";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, config.soldierRadius + 2, Math.PI * 0.05, Math.PI * 1.95);
    ctx.fill();
    ctx.stroke();

    // Helmet
    ctx.fillStyle = "#26b864";
    ctx.beginPath();
    ctx.arc(0, -2, config.soldierRadius - 2, Math.PI, 0);
    ctx.fill();

    // Visor streak
    ctx.strokeStyle = "#d5ffe8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -2, config.soldierRadius - 4, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();
  });
}

function drawEnemies() {
  state.enemies.forEach((enemy) => {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "#3aa7ff";
    ctx.strokeStyle = "#1f6fa8";
    ctx.lineWidth = 3;
    ctx.arc(enemy.x, enemy.y, config.enemyRadius + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Backpack / armor
    ctx.fillStyle = "#2d84cc";
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y + 4, config.enemyRadius - 5, 0, Math.PI * 2);
    ctx.fill();

    // Patch
    ctx.beginPath();
    ctx.strokeStyle = "#b8dcff";
    ctx.lineWidth = 4;
    ctx.arc(enemy.x, enemy.y, config.enemyRadius - 4, -Math.PI * 0.2, Math.PI * 0.1);
    ctx.stroke();

    // Face visor
    ctx.strokeStyle = "#e8f4ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y - 2, config.enemyRadius - 6, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();
  });
}

function drawBullets() {
  ctx.fillStyle = "#f5f8ff";
  state.bullets.forEach((b) => {
    ctx.beginPath();
    ctx.shadowColor = "#d9e7ff";
    ctx.shadowBlur = 8;
    ctx.arc(b.x, b.y, config.bulletRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
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
