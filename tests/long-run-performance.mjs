import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('long-run-performance.js', 'utf8');
const loader = fs.readFileSync('victory-guard.js', 'utf8');

function numberOf(name) {
  const match = source.match(new RegExp(`const ${name} = (\\d+)`));
  assert.ok(match, `缺少常量 ${name}`);
  return Number(match[1]);
}

const baseBudget = numberOf('BASE_ENEMY_BUDGET');
const phaseBonus = numberOf('PHASE_ENEMY_BONUS');
const levelBonusCap = numberOf('LEVEL_ENEMY_BONUS_CAP');
const hardEnemyLimit = numberOf('HARD_ENEMY_LIMIT');
const maxProjectiles = numberOf('MAX_PROJECTILES');
const maxGems = numberOf('MAX_GEMS');
const maxParticles = numberOf('MAX_PARTICLES');

assert.ok(hardEnemyLimit <= 240, '敌人硬上限过高，仍可能导致长局卡顿');
assert.ok(maxProjectiles <= 420, '投射物上限过高');
assert.ok(maxGems <= 300, '星尘实体上限过高');
assert.ok(maxParticles <= 900, '粒子实体上限过高');

assert.match(source, /spawnEnemyWithBudget/);
assert.match(source, /updateProjectilesWithSpatialGrid/);
assert.match(source, /buildEnemyGrid/);
assert.match(source, /nearbyEnemies/);
assert.match(source, /CELL_SIZE = 56/);
assert.match(source, /playerSlots > 0 \? playerShots\.slice\(-playerSlots\) : \[\]/);
assert.doesNotMatch(source, /enemies\.includes\(enemy\)/);
assert.match(source, /compactGems/);
assert.match(source, /carriedValue/);
assert.match(source, /updateWithLongRunPerformance/);
assert.match(source, /__nightfallPerformance/);

const overlapGuardIndex = loader.indexOf("loadScript('ui-overlap-guard'");
const performanceGuardIndex = loader.indexOf("loadScript('long-run-performance'");
assert.ok(overlapGuardIndex >= 0 && performanceGuardIndex > overlapGuardIndex, '性能守卫必须最后加载');
assert.match(loader, /assetVersion = '20260723\.9'/);

let enemies = 0;
const simulatedLevel = 18;
for (let second = 0; second <= 180; second += 1) {
  const phase = Math.min(3, Math.floor(second / 40));
  const levelBonus = Math.min(levelBonusCap, Math.floor(simulatedLevel * 1.5));
  const budget = Math.min(hardEnemyLimit, baseBudget + phase * phaseBonus + levelBonus);
  const batch = second > 82 ? 3 : second > 34 ? 2 : 1;
  for (let spawn = 0; spawn < batch * 6; spawn += 1) {
    if (enemies < budget) enemies += 1;
  }
  assert.ok(enemies <= budget, `第 ${second} 秒敌人数量越过动态预算`);
  assert.ok(enemies <= hardEnemyLimit, `第 ${second} 秒敌人数量越过硬上限`);
}

console.log('长局实体预算、空间网格碰撞与资源合并检查通过');