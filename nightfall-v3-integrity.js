(() => {
  const finalDamageEnemy = damageEnemy;
  const finalUpdate = update;
  const originalBossDamage = new WeakMap();

  function synchronizeBrokenBoss(enemy) {
    if (!enemy || enemy.type !== 'boss') return;
    if (enemy.nightfallBreakTime > 0) {
      if (!originalBossDamage.has(enemy)) originalBossDamage.set(enemy, Number(enemy.damage) || 0);
      enemy.damage = 0;
      enemy.nightfallBreakCharge = 0;
      return;
    }
    if (originalBossDamage.has(enemy)) {
      enemy.damage = originalBossDamage.get(enemy);
      originalBossDamage.delete(enemy);
    }
  }

  damageEnemy = function damageEnemyWithNightfallIntegrity(enemy, rawDamage) {
    const result = finalDamageEnemy(enemy, rawDamage);
    synchronizeBrokenBoss(enemy);
    return result;
  };

  update = function updateWithNightfallIntegrity(dt) {
    enemies.forEach(synchronizeBrokenBoss);
    finalUpdate(dt);
    enemies.forEach(synchronizeBrokenBoss);
  };
})();