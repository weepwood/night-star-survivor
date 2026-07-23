(() => {
  const CELL_SIZE = 56;
  const BASE_ENEMY_BUDGET = 96;
  const PHASE_ENEMY_BONUS = 28;
  const LEVEL_ENEMY_BONUS_CAP = 24;
  const HARD_ENEMY_LIMIT = 220;
  const ELITE_ALLOWANCE = 8;

  const MAX_PROJECTILES = 360;
  const MAX_ENEMY_PROJECTILES = 120;
  const MAX_GEMS = 260;
  const MAX_PARTICLES = 760;
  const MAX_NUMBERS = 240;
  const MAX_HAZARDS = 28;
  const MAX_BEAMS = 96;
  const MAX_ENEMY_RADIUS = 28;

  const finalSpawnEnemy = spawnEnemy;
  const finalUpdate = update;

  const stats = {
    skippedSpawns: 0,
    compactedGems: 0,
    trimmedProjectiles: 0,
    emergencyEnemyCulls: 0,
  };

  document.documentElement.dataset.performanceGuard = 'active';

  function currentEnemyBudget() {
    const safePhase = Math.max(0, Number(phase) || 0);
    const safeLevel = Math.max(1, Number(player?.level) || 1);
    const safeDifficulty = Math.max(0.7, Number(difficulty) || 1);
    const levelBonus = Math.min(LEVEL_ENEMY_BONUS_CAP, Math.floor(safeLevel * 1.5));
    const difficultyBonus = Math.max(0, Math.round((safeDifficulty - 1) * 22));
    return Math.min(
      HARD_ENEMY_LIMIT,
      BASE_ENEMY_BUDGET + safePhase * PHASE_ENEMY_BONUS + levelBonus + difficultyBonus,
    );
  }

  function removeEmergencyEnemies(targetLength) {
    if (enemies.length <= targetLength) return;
    for (let index = enemies.length - 1; index >= 0 && enemies.length > targetLength; index -= 1) {
      const enemy = enemies[index];
      if (!enemy || enemy.type === 'boss' || enemy.elite) continue;
      enemies.splice(index, 1);
      stats.emergencyEnemyCulls += 1;
    }
  }

  spawnEnemy = function spawnEnemyWithBudget(type = null, elite = false) {
    const boss = type === 'boss';
    const allowance = elite ? ELITE_ALLOWANCE : 0;
    const budget = Math.min(HARD_ENEMY_LIMIT, currentEnemyBudget() + allowance);

    if (!boss && enemies.length >= budget) {
      stats.skippedSpawns += 1;
      return null;
    }

    if (boss && enemies.length >= HARD_ENEMY_LIMIT) {
      removeEmergencyEnemies(HARD_ENEMY_LIMIT - 1);
    }

    return finalSpawnEnemy(type, elite);
  };

  function gridKey(cellX, cellY) {
    return `${cellX}:${cellY}`;
  }

  function buildEnemyGrid() {
    const grid = new Map();
    for (const enemy of enemies) {
      const cellX = Math.floor(enemy.x / CELL_SIZE);
      const cellY = Math.floor(enemy.y / CELL_SIZE);
      const key = gridKey(cellX, cellY);
      const bucket = grid.get(key);
      if (bucket) bucket.push(enemy);
      else grid.set(key, [enemy]);
    }
    return grid;
  }

  function nearbyEnemies(projectile, grid) {
    const reach = Math.max(1, Number(projectile.radius) || 0) + MAX_ENEMY_RADIUS;
    const span = Math.max(1, Math.ceil(reach / CELL_SIZE));
    const centerX = Math.floor(projectile.x / CELL_SIZE);
    const centerY = Math.floor(projectile.y / CELL_SIZE);
    const result = [];

    for (let offsetY = -span; offsetY <= span; offsetY += 1) {
      for (let offsetX = -span; offsetX <= span; offsetX += 1) {
        const bucket = grid.get(gridKey(centerX + offsetX, centerY + offsetY));
        if (bucket) result.push(...bucket);
      }
    }
    return result;
  }

  updateProjectiles = function updateProjectilesWithSpatialGrid(dt) {
    trimProjectiles();
    const enemyGrid = buildEnemyGrid();

    for (let index = projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = projectiles[index];
      projectile.trail?.push({ x: projectile.x, y: projectile.y });
      if (projectile.trail?.length > 6) projectile.trail.shift();
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      let remove = projectile.life <= 0;

      if (projectile.kind === 'enemy') {
        if (Math.hypot(projectile.x - player.x, projectile.y - player.y) < projectile.radius + player.radius) {
          hurtPlayer(projectile.damage);
          remove = true;
        }
      } else {
        const candidates = nearbyEnemies(projectile, enemyGrid);
        for (const enemy of candidates) {
          if (remove) break;
          if (!enemy || enemy.hp <= 0) continue;
          if (Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) >= projectile.radius + enemy.radius) continue;
          damageEnemy(enemy, projectile.damage);
          if (projectile.pierce > 0) projectile.pierce -= 1;
          else remove = true;
        }
      }

      if (
        remove
        || projectile.x < -80
        || projectile.x > WORLD_WIDTH + 80
        || projectile.y < -80
        || projectile.y > WORLD_HEIGHT + 80
      ) {
        projectiles.splice(index, 1);
      }
    }
  };

  function trimProjectiles() {
    if (projectiles.length <= MAX_PROJECTILES) return;
    const enemyShots = [];
    const playerShots = [];
    for (const projectile of projectiles) {
      if (projectile.kind === 'enemy') enemyShots.push(projectile);
      else playerShots.push(projectile);
    }

    const keptEnemyShots = enemyShots.slice(-MAX_ENEMY_PROJECTILES);
    const playerSlots = Math.max(0, MAX_PROJECTILES - keptEnemyShots.length);
    const keptPlayerShots = playerSlots > 0 ? playerShots.slice(-playerSlots) : [];
    stats.trimmedProjectiles += projectiles.length - keptEnemyShots.length - keptPlayerShots.length;
    projectiles = [...keptPlayerShots, ...keptEnemyShots];
  }

  function compactGems() {
    if (gems.length <= MAX_GEMS) return;
    const overflowCount = gems.length - MAX_GEMS;
    const overflow = gems.splice(0, overflowCount);
    const carriedValue = overflow.reduce((sum, gem) => sum + Math.max(0, Number(gem.value) || 0), 0);
    if (gems.length) {
      gems[0].value = Math.max(0, Number(gems[0].value) || 0) + carriedValue;
    } else if (overflow.length) {
      const carrier = overflow[overflow.length - 1];
      carrier.value = carriedValue;
      gems.push(carrier);
    }
    stats.compactedGems += overflowCount;
  }

  function trimOldest(list, maximum) {
    if (!Array.isArray(list) || list.length <= maximum) return;
    list.splice(0, list.length - maximum);
  }

  function enforceEntityBudgets() {
    trimProjectiles();
    compactGems();
    trimOldest(particles, MAX_PARTICLES);
    trimOldest(numbers, MAX_NUMBERS);
    trimOldest(hazards, MAX_HAZARDS);
    trimOldest(beams, MAX_BEAMS);
    if (enemies.length > HARD_ENEMY_LIMIT) removeEmergencyEnemies(HARD_ENEMY_LIMIT);
  }

  update = function updateWithLongRunPerformance(dt) {
    enforceEntityBudgets();
    finalUpdate(dt);
    enforceEntityBudgets();
  };

  globalThis.__nightfallPerformance = Object.freeze({
    stats,
    currentEnemyBudget,
    limits: Object.freeze({
      enemies: HARD_ENEMY_LIMIT,
      projectiles: MAX_PROJECTILES,
      gems: MAX_GEMS,
      particles: MAX_PARTICLES,
    }),
  });
})();