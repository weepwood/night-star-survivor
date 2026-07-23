(() => {
  const originalResetGame = resetGame;
  const originalUpdate = update;
  const originalShootWeapons = shootWeapons;
  const originalDamageEnemy = damageEnemy;
  const originalDrawBackground = drawBackground;
  const originalDrawEffects = drawEffects;
  const originalDrawEnemy = drawEnemy;
  const originalDrawPlayer = drawPlayer;
  const originalCheckEvolution = checkEvolution;
  const originalGetBuildLabels = getBuildLabels;
  const originalHurtPlayer = hurtPlayer;
  const originalDash = dash;
  const originalRender = render;

  const LOOT_TYPES = {
    tonic: { name: '星露药剂', color: '#71e6a2', icon: '✚' },
    battery: { name: '新星电池', color: '#79e6ff', icon: '◆' },
    gravity: { name: '引力棱镜', color: '#c4a7ff', icon: '◇' },
    bomb: { name: '日蚀炸弹', color: '#ff6b8a', icon: '✦' },
    shield: { name: '星幕护盾', color: '#ffd166', icon: '⬡' },
    chest: { name: '星蚀宝箱', color: '#f6f4ff', icon: '▣' },
  };

  const RICH_ICONS = {
    comet: '☄', prism: '✧', mine: '✣', nebula: '◉', chrono: '⌛', gravityCore: '◈',
    phoenix: '♨', cloak: '◌', area: '◎', projectile: '➤', fortune: '✤', ward: '⬡',
  };

  let lootDrops = [];
  let meteors = [];
  let voidMines = [];
  let shockwaves = [];
  let decals = [];
  let ambientMotes = [];
  let lootClock = 17;
  let richUiClock = 0;
  let wasDashing = false;
  let cloakHitIds = new Set();
  let buffStrip = null;

  function ensurePlayerExtensions() {
    player.weapons.comet ||= { level: 0, timer: 0, evolved: false };
    player.weapons.prism ||= { level: 0, timer: 0, evolved: false };
    player.weapons.mine ||= { level: 0, timer: 0, evolved: false };

    player.relics.nebula ||= 0;
    player.relics.chrono ||= 0;
    player.relics.gravityCore ||= 0;
    player.relics.phoenix ||= 0;
    player.relics.cloak ||= 0;

    player.areaMultiplier ||= 1;
    player.projectileSpeedMultiplier ||= 1;
    player.lootLuck ||= 0;
    player.richShield ||= 0;
    player.richUpgradeCounts ||= {};
  }

  function pushShockwave(x, y, color, maxRadius = 42, life = 0.5, width = 2) {
    shockwaves.push({ x, y, color, maxRadius, life, maxLife: life, width });
  }

  function createAmbientMotes() {
    ambientMotes = Array.from({ length: 36 }, () => ({
      x: Math.floor(Math.random() * VIEW_WIDTH),
      y: Math.floor(Math.random() * VIEW_HEIGHT),
      speed: 3 + Math.random() * 9,
      phase: Math.random() * TAU,
      size: Math.random() < 0.18 ? 2 : 1,
    }));
  }

  function installCodex() {
    if (!document.querySelector('#loot-codex')) {
      const codex = document.createElement('div');
      codex.id = 'loot-codex';
      codex.className = 'pane-block loot-codex';
      codex.innerHTML = `
        <div class="pane-title-row"><span class="pane-title">星蚀道具</span><small>战场掉落</small></div>
        <div class="loot-codex-grid">
          ${Object.entries(LOOT_TYPES).map(([type, item]) => `
            <span class="loot-entry" data-loot="${type}">
              <i class="loot-pixel" style="--loot-color:${item.color}">${item.icon}</i>
              <span><strong>${item.name}</strong><small>${lootDescription(type)}</small></span>
            </span>
          `).join('')}
        </div>`;
      document.querySelector('.stage-right')?.appendChild(codex);
    }

    if (!document.querySelector('#active-buffs')) {
      buffStrip = document.createElement('div');
      buffStrip.id = 'active-buffs';
      buffStrip.className = 'active-buffs';
      buffStrip.setAttribute('aria-live', 'polite');
      document.querySelector('.canvas-shell')?.appendChild(buffStrip);
    } else {
      buffStrip = document.querySelector('#active-buffs');
    }
  }

  function lootDescription(type) {
    return {
      tonic: '恢复生命', battery: '补充星爆', gravity: '吸取全部星尘',
      bomb: '轰击全场', shield: '短暂无敌护幕', chest: '获得稀有强化',
    }[type];
  }

  function resetRichState() {
    lootDrops = [];
    meteors = [];
    voidMines = [];
    shockwaves = [];
    decals = [];
    lootClock = 14 + Math.random() * 5;
    richUiClock = 0;
    wasDashing = false;
    cloakHitIds.clear();
    createAmbientMotes();
  }

  resetGame = function resetGameWithRichContent() {
    originalResetGame();
    ensurePlayerExtensions();
    resetRichState();
    installCodex();
    ui.statusMessage.textContent = '星火已点燃。星蚀道具和新武器已进入战场。';
    updateRichHud(true);
    render();
  };

  function addUpgrade(definition) {
    if (!upgrades.some((upgrade) => upgrade.id === definition.id)) upgrades.push(definition);
  }

  addUpgrade({
    id: 'comet', name: '彗星权杖', type: '武器', rarity: 'rare', icon: RICH_ICONS.comet, max: 5,
    description: '锁定敌群召唤延迟坠落的彗星，造成范围爆炸。',
    apply: () => { ensurePlayerExtensions(); player.weapons.comet.level += 1; },
  });
  addUpgrade({
    id: 'prism', name: '棱镜星轮', type: '武器', rarity: 'rare', icon: RICH_ICONS.prism, max: 5,
    description: '周期性向四周发射棱镜碎片，清理包围你的敌群。',
    apply: () => { ensurePlayerExtensions(); player.weapons.prism.level += 1; },
  });
  addUpgrade({
    id: 'mine', name: '虚空星雷', type: '武器', rarity: 'epic', icon: RICH_ICONS.mine, max: 5,
    description: '在脚下布置星雷，敌人接近后引爆并造成范围伤害。',
    apply: () => { ensurePlayerExtensions(); player.weapons.mine.level += 1; },
  });
  addUpgrade({
    id: 'nebula', name: '星云透镜', type: '遗物', rarity: 'rare', icon: RICH_ICONS.nebula, max: 4,
    description: '伤害提高 9%，暴击提高 4%，可使彗星权杖进化。',
    apply: () => { ensurePlayerExtensions(); player.relics.nebula += 1; player.damageMultiplier *= 1.09; player.crit += 0.04; },
  });
  addUpgrade({
    id: 'chrono', name: '时隙碎片', type: '遗物', rarity: 'rare', icon: RICH_ICONS.chrono, max: 4,
    description: '武器冷却缩短 7%，冲刺恢复更快，可使棱镜星轮进化。',
    apply: () => { ensurePlayerExtensions(); player.relics.chrono += 1; player.cooldownMultiplier *= 0.93; player.dashCooldownBase *= 0.93; },
  });
  addUpgrade({
    id: 'gravityCore', name: '微型黑洞', type: '遗物', rarity: 'epic', icon: RICH_ICONS.gravityCore, max: 3,
    description: '吸取范围和范围伤害提高，可使虚空星雷进化。',
    apply: () => { ensurePlayerExtensions(); player.relics.gravityCore += 1; player.magnet *= 1.22; player.areaMultiplier *= 1.1; },
  });
  addUpgrade({
    id: 'phoenix', name: '凤凰余烬', type: '遗物', rarity: 'legendary', icon: RICH_ICONS.phoenix, max: 2,
    description: '受到致命伤害时消耗一层，恢复 45% 生命并震退敌人。',
    apply: () => { ensurePlayerExtensions(); player.relics.phoenix += 1; },
  });
  addUpgrade({
    id: 'cloak', name: '星迹披风', type: '遗物', rarity: 'epic', icon: RICH_ICONS.cloak, max: 3,
    description: '冲刺时对穿过的敌人造成伤害，并提高 1 点护甲。',
    apply: () => { ensurePlayerExtensions(); player.relics.cloak += 1; player.armor += 1; },
  });
  addUpgrade({
    id: 'area', name: '星域膨胀', type: '强化', rarity: 'uncommon', icon: RICH_ICONS.area, max: 5,
    description: '所有范围攻击的作用半径提高 12%。',
    apply: () => { ensurePlayerExtensions(); player.areaMultiplier *= 1.12; player.richUpgradeCounts.area = (player.richUpgradeCounts.area || 0) + 1; },
  });
  addUpgrade({
    id: 'projectile', name: '光速刻印', type: '强化', rarity: 'uncommon', icon: RICH_ICONS.projectile, max: 5,
    description: '投射物速度提高 14%，星矢与棱镜碎片更快命中。',
    apply: () => { ensurePlayerExtensions(); player.projectileSpeedMultiplier *= 1.14; player.richUpgradeCounts.projectile = (player.richUpgradeCounts.projectile || 0) + 1; },
  });
  addUpgrade({
    id: 'fortune', name: '命运星骰', type: '强化', rarity: 'rare', icon: RICH_ICONS.fortune, max: 4,
    description: '提高战场道具和星蚀宝箱出现概率。',
    apply: () => { ensurePlayerExtensions(); player.lootLuck += 0.08; player.richUpgradeCounts.fortune = (player.richUpgradeCounts.fortune || 0) + 1; },
  });
  addUpgrade({
    id: 'ward', name: '守夜屏障', type: '强化', rarity: 'uncommon', icon: RICH_ICONS.ward, max: 4,
    description: '立即获得 6 秒星幕护盾，并恢复少量生命。',
    apply: () => { ensurePlayerExtensions(); player.richShield = Math.max(player.richShield, 6); player.hp = Math.min(player.maxHp, player.hp + 18); player.richUpgradeCounts.ward = (player.richUpgradeCounts.ward || 0) + 1; },
  });

  function availableUpgradePool(pool) {
    return pool.filter((upgrade) => {
      if (!upgrade.max) return true;
      if (player.weapons[upgrade.id]) return player.weapons[upgrade.id].level < upgrade.max;
      if (player.relics[upgrade.id] !== undefined) return player.relics[upgrade.id] < upgrade.max;
      if (player.richUpgradeCounts?.[upgrade.id] !== undefined) return player.richUpgradeCounts[upgrade.id] < upgrade.max;
      return true;
    });
  }

  function rarityLabel(rarity) {
    return { common: '普通', uncommon: '优秀', rare: '稀有', epic: '史诗', legendary: '传说' }[rarity] || '星尘';
  }

  openUpgrade = function openRichUpgrade(title = '选择一项星尘强化', pool = upgrades) {
    choosing = true;
    ui.upgradeTitle.textContent = title;
    ui.upgradeOptions.innerHTML = '';
    const candidates = availableUpgradePool([...pool]);
    const source = candidates.length >= 3 ? candidates : [...pool];
    const options = source.sort(() => Math.random() - 0.5).slice(0, 3);

    for (const upgrade of options) {
      const button = document.createElement('button');
      const rarity = upgrade.rarity || (upgrade.type === '遗物' ? 'rare' : upgrade.type === '武器' ? 'uncommon' : 'common');
      button.type = 'button';
      button.className = 'upgrade-card rich-upgrade-card';
      button.dataset.rarity = rarity;
      button.innerHTML = `
        <span class="upgrade-icon" aria-hidden="true">${upgrade.icon || '✦'}</span>
        <span class="rarity-chip">${rarityLabel(rarity)} · ${upgrade.type}</span>
        <h3>${upgrade.name}</h3>
        <p>${upgrade.description}</p>`;
      button.addEventListener('click', () => {
        upgrade.apply();
        checkEvolution();
        choosing = false;
        hideOverlay(ui.upgradeScreen);
        ui.statusMessage.textContent = `获得：${upgrade.name}`;
        pushShockwave(player.x, player.y, rarity === 'legendary' ? PALETTE.gold : PALETTE.cyan, 54, 0.55, 2);
        createParticle(player.x, player.y, rarity === 'legendary' ? PALETTE.gold : PALETTE.violetLight, 18, 95, 0.55);
        updateUi();
        updateRichHud(true);
      });
      ui.upgradeOptions.appendChild(button);
    }

    showOverlay(ui.upgradeScreen);
    sound.level();
  };

  checkEvolution = function checkRichEvolution() {
    ensurePlayerExtensions();
    const previous = {
      comet: player.weapons.comet.evolved,
      prism: player.weapons.prism.evolved,
      mine: player.weapons.mine.evolved,
    };
    originalCheckEvolution();
    if (player.weapons.comet.level >= 4 && player.relics.nebula) player.weapons.comet.evolved = true;
    if (player.weapons.prism.level >= 4 && player.relics.chrono) player.weapons.prism.evolved = true;
    if (player.weapons.mine.level >= 4 && player.relics.gravityCore) player.weapons.mine.evolved = true;

    const evolved = [
      ['comet', '星陨天灾'], ['prism', '无尽棱镜'], ['mine', '黑洞雷场'],
    ].find(([id]) => !previous[id] && player.weapons[id].evolved);
    if (evolved) {
      ui.statusMessage.textContent = `武器进化：${evolved[1]}`;
      pushShockwave(player.x, player.y, PALETTE.gold, 92, 0.9, 3);
      createParticle(player.x, player.y, PALETTE.gold, 42, 155, 0.85);
      screenShake = Math.max(screenShake, 9);
    }
  };

  getBuildLabels = function getRichBuildLabels() {
    const labels = originalGetBuildLabels();
    ensurePlayerExtensions();
    if (player.weapons.comet.level) labels.push([player.weapons.comet.evolved ? '星陨天灾' : '彗星权杖', player.weapons.comet.level, player.weapons.comet.evolved]);
    if (player.weapons.prism.level) labels.push([player.weapons.prism.evolved ? '无尽棱镜' : '棱镜星轮', player.weapons.prism.level, player.weapons.prism.evolved]);
    if (player.weapons.mine.level) labels.push([player.weapons.mine.evolved ? '黑洞雷场' : '虚空星雷', player.weapons.mine.level, player.weapons.mine.evolved]);
    return labels;
  };

  shootWeapons = function shootRichWeapons(dt) {
    originalShootWeapons(dt);
    ensurePlayerExtensions();
    updateCometWeapon(dt);
    updatePrismWeapon(dt);
    updateMineWeapon(dt);
  };

  function updateCometWeapon(dt) {
    const weapon = player.weapons.comet;
    if (!weapon.level) return;
    weapon.timer -= dt;
    if (weapon.timer > 0 || !enemies.length) return;
    const target = enemies[Math.floor(Math.random() * enemies.length)];
    const area = (24 + weapon.level * 6) * player.areaMultiplier;
    meteors.push({
      x: target.x,
      y: target.y,
      timer: weapon.evolved ? 0.48 : 0.72,
      maxTimer: weapon.evolved ? 0.48 : 0.72,
      radius: area,
      damage: (28 + weapon.level * 19) * player.damageMultiplier,
      evolved: weapon.evolved,
    });
    weapon.timer = Math.max(1.05, (3.3 - weapon.level * 0.34) * player.cooldownMultiplier);
  }

  function updatePrismWeapon(dt) {
    const weapon = player.weapons.prism;
    if (!weapon.level) return;
    weapon.timer -= dt;
    if (weapon.timer > 0) return;
    const count = Math.min(14, 5 + weapon.level * 2 + (weapon.evolved ? 3 : 0));
    const speed = (175 + weapon.level * 16) * player.projectileSpeedMultiplier;
    for (let i = 0; i < count; i += 1) {
      const angle = i * TAU / count + elapsed * 0.35;
      projectiles.push({
        kind: 'player', x: player.x, y: player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: weapon.evolved ? 3 : 2,
        damage: (7 + weapon.level * 5) * player.damageMultiplier,
        pierce: weapon.evolved ? 2 : Math.floor(weapon.level / 3),
        life: weapon.evolved ? 1.55 : 1.05,
        color: weapon.evolved ? PALETTE.gold : PALETTE.cyan,
        trail: [],
      });
    }
    createParticle(player.x, player.y, weapon.evolved ? PALETTE.gold : PALETTE.cyan, 12, 75, 0.35);
    weapon.timer = Math.max(0.75, (2.85 - weapon.level * 0.25) * player.cooldownMultiplier);
  }

  function updateMineWeapon(dt) {
    const weapon = player.weapons.mine;
    if (!weapon.level) return;
    weapon.timer -= dt;
    if (weapon.timer > 0) return;
    voidMines.push({
      x: player.x,
      y: player.y,
      radius: (18 + weapon.level * 3) * player.areaMultiplier,
      damage: (24 + weapon.level * 15) * player.damageMultiplier,
      life: weapon.evolved ? 22 : 16,
      pulse: Math.random() * TAU,
      evolved: weapon.evolved,
    });
    const maxMines = weapon.evolved ? 9 : 4 + weapon.level;
    while (voidMines.length > maxMines) voidMines.shift();
    weapon.timer = Math.max(1.15, (3.6 - weapon.level * 0.38) * player.cooldownMultiplier);
  }

  function detonateMine(index) {
    const mine = voidMines[index];
    const blastRadius = mine.evolved ? mine.radius * 1.45 : mine.radius;
    for (const enemy of [...enemies]) {
      if (Math.hypot(enemy.x - mine.x, enemy.y - mine.y) <= blastRadius + enemy.radius) {
        damageEnemy(enemy, mine.damage);
        if (mine.evolved) enemy.speed = Math.max(8, enemy.speed * 0.72);
      }
    }
    pushShockwave(mine.x, mine.y, mine.evolved ? PALETTE.violetLight : PALETTE.red, blastRadius + 12, 0.48, 2);
    createParticle(mine.x, mine.y, mine.evolved ? PALETTE.violetLight : PALETTE.red, mine.evolved ? 28 : 18, 120, 0.58);
    decals.push({ x: mine.x, y: mine.y, radius: Math.max(7, Math.round(blastRadius * 0.35)), life: 14, maxLife: 14, kind: 'void' });
    screenShake = Math.max(screenShake, mine.evolved ? 7 : 4);
    voidMines.splice(index, 1);
  }

  function updateMeteors(dt) {
    for (let i = meteors.length - 1; i >= 0; i -= 1) {
      const meteor = meteors[i];
      meteor.timer -= dt;
      if (meteor.timer > 0) continue;
      for (const enemy of [...enemies]) {
        if (Math.hypot(enemy.x - meteor.x, enemy.y - meteor.y) <= meteor.radius + enemy.radius) {
          damageEnemy(enemy, meteor.damage);
        }
      }
      pushShockwave(meteor.x, meteor.y, meteor.evolved ? PALETTE.gold : PALETTE.red, meteor.radius + 18, 0.62, meteor.evolved ? 3 : 2);
      createParticle(meteor.x, meteor.y, meteor.evolved ? PALETTE.gold : PALETTE.red, meteor.evolved ? 42 : 26, 155, 0.75);
      decals.push({ x: meteor.x, y: meteor.y, radius: Math.max(8, Math.round(meteor.radius * 0.38)), life: 18, maxLife: 18, kind: 'crater' });
      screenShake = Math.max(screenShake, meteor.evolved ? 10 : 6);
      meteors.splice(i, 1);
    }
  }

  function updateMines(dt) {
    for (let i = voidMines.length - 1; i >= 0; i -= 1) {
      const mine = voidMines[i];
      mine.life -= dt;
      mine.pulse += dt * 5;
      if (mine.life <= 0) {
        voidMines.splice(i, 1);
        continue;
      }
      const trigger = enemies.some((enemy) => Math.hypot(enemy.x - mine.x, enemy.y - mine.y) <= mine.radius + enemy.radius);
      if (trigger) detonateMine(i);
    }
  }

  function spawnLoot(x = null, y = null, forceChest = false) {
    const types = forceChest
      ? ['chest']
      : ['tonic', 'battery', 'gravity', 'bomb', 'shield', ...(Math.random() < 0.11 + player.lootLuck ? ['chest'] : [])];
    const type = types[Math.floor(Math.random() * types.length)];
    lootDrops.push({
      x: x ?? 36 + Math.random() * (VIEW_WIDTH - 72),
      y: y ?? 36 + Math.random() * (VIEW_HEIGHT - 72),
      type,
      radius: type === 'chest' ? 8 : 6,
      phase: Math.random() * TAU,
      life: type === 'chest' ? 34 : 24,
    });
  }

  function applyLoot(drop) {
    const item = LOOT_TYPES[drop.type];
    if (drop.type === 'tonic') player.hp = Math.min(player.maxHp, player.hp + Math.max(34, player.maxHp * 0.36));
    if (drop.type === 'battery') player.nova = Math.min(100, player.nova + 60);
    if (drop.type === 'gravity') {
      gems.forEach((gem, index) => {
        gem.x = player.x + (index % 5) - 2;
        gem.y = player.y + (Math.floor(index / 5) % 5) - 2;
      });
    }
    if (drop.type === 'bomb') {
      for (const enemy of [...enemies]) damageEnemy(enemy, (38 + phase * 12) * player.damageMultiplier);
      screenShake = Math.max(screenShake, 8);
    }
    if (drop.type === 'shield') player.richShield = Math.max(player.richShield, 8);
    if (drop.type === 'chest') {
      const rarePool = upgrades.filter((upgrade) => upgrade.type === '遗物' || upgrade.type === '武器' || upgrade.rarity === 'epic' || upgrade.rarity === 'legendary');
      openUpgrade('开启星蚀宝箱', rarePool);
    }

    pushShockwave(drop.x, drop.y, item.color, drop.type === 'chest' ? 62 : 34, 0.48, 2);
    createParticle(drop.x, drop.y, item.color, drop.type === 'chest' ? 28 : 14, 95, 0.5);
    ui.statusMessage.textContent = `拾取：${item.name}`;
    sound.pickup();
  }

  function updateLoot(dt) {
    lootClock -= dt;
    if (lootClock <= 0 && running && !choosing) {
      spawnLoot();
      lootClock = Math.max(10, 22 - player.lootLuck * 35) + Math.random() * 6;
    }

    for (let i = lootDrops.length - 1; i >= 0; i -= 1) {
      const drop = lootDrops[i];
      drop.life -= dt;
      drop.phase += dt * 4;
      if (drop.life <= 0) {
        lootDrops.splice(i, 1);
        continue;
      }
      if (!choosing && Math.hypot(drop.x - player.x, drop.y - player.y) <= drop.radius + player.radius + 4) {
        applyLoot(drop);
        lootDrops.splice(i, 1);
      }
    }
  }

  function updateShockwaves(dt) {
    for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
      shockwaves[i].life -= dt;
      if (shockwaves[i].life <= 0) shockwaves.splice(i, 1);
    }
    for (let i = decals.length - 1; i >= 0; i -= 1) {
      decals[i].life -= dt;
      if (decals[i].life <= 0) decals.splice(i, 1);
    }
  }

  function updateCloakDamage() {
    if (!player.relics.cloak) return;
    if (player.dashTime > 0) {
      if (!wasDashing) cloakHitIds.clear();
      for (const enemy of [...enemies]) {
        if (cloakHitIds.has(enemy.id)) continue;
        if (Math.hypot(enemy.x - player.x, enemy.y - player.y) <= enemy.radius + 20) {
          cloakHitIds.add(enemy.id);
          damageEnemy(enemy, (18 + player.relics.cloak * 12) * player.damageMultiplier);
          createParticle(enemy.x, enemy.y, PALETTE.cyan, 7, 80, 0.35);
        }
      }
      wasDashing = true;
    } else {
      wasDashing = false;
      cloakHitIds.clear();
    }
  }

  update = function updateRichContent(dt) {
    originalUpdate(dt);
    ensurePlayerExtensions();
    player.richShield = Math.max(0, player.richShield - dt);
    updateMeteors(dt);
    updateMines(dt);
    updateLoot(dt);
    updateShockwaves(dt);
    updateCloakDamage();
    richUiClock -= dt;
    if (richUiClock <= 0) {
      updateRichHud();
      richUiClock = 0.22;
    }
  };

  damageEnemy = function damageEnemyWithLoot(enemy, rawDamage) {
    const snapshot = { x: enemy.x, y: enemy.y, elite: enemy.elite, type: enemy.type };
    const killed = originalDamageEnemy(enemy, rawDamage);
    if (killed) {
      decals.push({ x: snapshot.x, y: snapshot.y, radius: snapshot.elite ? 8 : 4, life: snapshot.elite ? 16 : 9, maxLife: snapshot.elite ? 16 : 9, kind: 'stain' });
      const chance = snapshot.type === 'boss' ? 1 : snapshot.elite ? 0.55 : 0.035 + player.lootLuck;
      if (Math.random() < chance) spawnLoot(snapshot.x, snapshot.y, snapshot.type === 'boss');
      if (snapshot.elite || snapshot.type === 'boss') pushShockwave(snapshot.x, snapshot.y, snapshot.type === 'boss' ? PALETTE.red : PALETTE.gold, snapshot.type === 'boss' ? 82 : 38, 0.55, 2);
    }
    return killed;
  };

  hurtPlayer = function hurtPlayerWithShield(amount) {
    ensurePlayerExtensions();
    const reduced = player.richShield > 0 ? amount * 0.42 : amount;
    originalHurtPlayer(reduced);
    if (player.hp <= 0 && player.relics.phoenix > 0) {
      player.relics.phoenix -= 1;
      player.hp = Math.max(1, player.maxHp * 0.45);
      player.invulnerable = 2.2;
      player.richShield = 4;
      for (const enemy of [...enemies]) {
        if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 130) damageEnemy(enemy, 65 * player.damageMultiplier);
      }
      pushShockwave(player.x, player.y, PALETTE.gold, 118, 1, 3);
      createParticle(player.x, player.y, PALETTE.gold, 58, 175, 0.95);
      ui.statusMessage.textContent = '凤凰余烬触发：守夜者重新点燃！';
      screenShake = Math.max(screenShake, 11);
    }
  };

  dash = function dashWithTrail() {
    const before = player?.dashCooldown;
    originalDash();
    if (player && before !== player.dashCooldown && player.relics?.cloak) {
      pushShockwave(player.x, player.y, PALETTE.cyan, 24, 0.28, 1);
    }
  };

  function drawArenaRunes() {
    const color = [PALETTE.violet, PALETTE.redDark, PALETTE.cyanDark, PALETTE.red][phase] || PALETTE.violet;
    ctx.save();
    ctx.globalAlpha = 0.24 + phase * 0.04;
    ctx.fillStyle = color;
    const corners = [[18, 18], [VIEW_WIDTH - 18, 18], [18, VIEW_HEIGHT - 18], [VIEW_WIDTH - 18, VIEW_HEIGHT - 18]];
    for (const [x, y] of corners) {
      ctx.fillRect(x - 7, y, 15, 1);
      ctx.fillRect(x, y - 7, 1, 15);
      ctx.fillRect(x - 3, y - 3, 7, 7);
    }
    for (let x = 80; x < VIEW_WIDTH; x += 120) {
      const offset = (Math.floor(elapsed * 5) + x) % 18;
      ctx.fillRect(x, 10 + offset, 1, 5);
      ctx.fillRect(x, VIEW_HEIGHT - 16 - offset, 1, 5);
    }
    ctx.restore();
  }

  function drawAmbientMotes() {
    ctx.save();
    for (const mote of ambientMotes) {
      const driftX = (mote.x + elapsed * mote.speed) % VIEW_WIDTH;
      const waveY = Math.round(mote.y + Math.sin(elapsed * 0.6 + mote.phase) * 4);
      ctx.globalAlpha = 0.12 + phase * 0.035;
      ctx.fillStyle = phase >= 2 ? PALETTE.red : PALETTE.cyan;
      ctx.fillRect(Math.round(driftX), waveY, mote.size, mote.size);
    }
    ctx.restore();
  }

  drawBackground = function drawRichBackground() {
    originalDrawBackground();
    drawArenaRunes();
    drawAmbientMotes();
  };

  function drawDecals() {
    ctx.save();
    for (const decal of decals) {
      const alpha = Math.max(0, decal.life / decal.maxLife);
      const x = screenX(decal.x);
      const y = screenY(decal.y);
      ctx.globalAlpha = alpha * 0.42;
      ctx.fillStyle = decal.kind === 'crater' ? '#1b1025' : decal.kind === 'void' ? '#25143f' : PALETTE.redDark;
      ctx.fillRect(x - decal.radius, y - Math.max(1, Math.floor(decal.radius / 3)), decal.radius * 2 + 1, Math.max(2, Math.floor(decal.radius * 0.65)));
      ctx.fillStyle = PALETTE.shadow;
      ctx.fillRect(x - Math.floor(decal.radius * 0.55), y, Math.max(2, Math.floor(decal.radius * 1.1)), 2);
    }
    ctx.restore();
  }

  function drawLootDrops() {
    for (const drop of lootDrops) {
      const item = LOOT_TYPES[drop.type];
      const x = screenX(drop.x);
      const bob = Math.round(Math.sin(drop.phase) * 2);
      const y = screenY(drop.y) + bob;
      const pulse = 8 + (Math.floor(drop.phase * 2) % 3);
      drawPixelRing(x, y, pulse, item.color, 4, 1);
      ctx.fillStyle = PALETTE.shadow;
      ctx.fillRect(x - drop.radius, y - drop.radius, drop.radius * 2 + 1, drop.radius * 2 + 1);
      ctx.fillStyle = item.color;
      ctx.fillRect(x - drop.radius + 2, y - drop.radius + 2, drop.radius * 2 - 3, drop.radius * 2 - 3);
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(x - 1, y - drop.radius + 1, 3, drop.radius * 2 - 1);
      ctx.fillRect(x - drop.radius + 1, y - 1, drop.radius * 2 - 1, 3);
      if (drop.type === 'chest') {
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(x - 5, y - 1, 11, 3);
        ctx.fillRect(x - 1, y - 5, 3, 11);
      }
    }
  }

  function drawMeteors() {
    for (const meteor of meteors) {
      const x = screenX(meteor.x);
      const y = screenY(meteor.y);
      const progress = 1 - meteor.timer / meteor.maxTimer;
      const height = Math.max(6, Math.round((1 - progress) * 46));
      drawPixelRing(x, y, Math.round(meteor.radius), meteor.evolved ? PALETTE.gold : PALETTE.red, 4, 1);
      ctx.fillStyle = meteor.evolved ? PALETTE.gold : PALETTE.red;
      ctx.fillRect(x - 2, y - height - 7, 5, 7);
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(x, y - height - 10, 1, 4);
      drawPixelLine(x, y - height - 8, x, y - 3, meteor.evolved ? PALETTE.gold : PALETTE.redDark, 1);
    }
  }

  function drawMines() {
    for (const mine of voidMines) {
      const x = screenX(mine.x);
      const y = screenY(mine.y);
      const pulse = 7 + (Math.floor(mine.pulse) % 3);
      drawPixelRing(x, y, pulse, mine.evolved ? PALETTE.violetLight : PALETTE.redDark, 3, 1);
      ctx.fillStyle = PALETTE.shadow;
      ctx.fillRect(x - 4, y - 4, 9, 9);
      ctx.fillStyle = mine.evolved ? PALETTE.violetLight : PALETTE.red;
      ctx.fillRect(x - 1, y - 5, 3, 11);
      ctx.fillRect(x - 5, y - 1, 11, 3);
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function drawShockwaves() {
    ctx.save();
    for (const wave of shockwaves) {
      const progress = 1 - wave.life / wave.maxLife;
      ctx.globalAlpha = Math.max(0, wave.life / wave.maxLife);
      drawPixelRing(screenX(wave.x), screenY(wave.y), Math.max(2, Math.round(wave.maxRadius * progress)), wave.color, 3, wave.width);
    }
    ctx.restore();
  }

  drawEffects = function drawRichEffects() {
    drawDecals();
    originalDrawEffects();
    drawMines();
    drawMeteors();
    drawLootDrops();
    drawShockwaves();
  };

  drawEnemy = function drawRichEnemy(enemy) {
    originalDrawEnemy(enemy);
    if (!enemy.elite && enemy.type !== 'boss') return;
    const x = screenX(enemy.x);
    const y = screenY(enemy.y);
    const color = enemy.type === 'boss' ? PALETTE.red : PALETTE.gold;
    const phaseOffset = Math.floor(enemy.pulse * 2) % 4;
    ctx.fillStyle = color;
    ctx.fillRect(x - enemy.radius - 7 - phaseOffset, y, 4, 1);
    ctx.fillRect(x + enemy.radius + 4 + phaseOffset, y, 4, 1);
    ctx.fillRect(x, y - enemy.radius - 7 - phaseOffset, 1, 4);
    ctx.fillRect(x, y + enemy.radius + 4 + phaseOffset, 1, 4);
  };

  drawPlayer = function drawRichPlayer() {
    originalDrawPlayer();
    if (!player) return;
    const x = screenX(player.x);
    const y = screenY(player.y);
    if (player.richShield > 0) {
      const radius = 18 + (Math.floor(elapsed * 8) % 3);
      drawPixelRing(x, y, radius, PALETTE.gold, 3, 1);
      ctx.fillStyle = PALETTE.cyan;
      ctx.fillRect(x - radius, y, 3, 1);
      ctx.fillRect(x + radius - 2, y, 3, 1);
    }
    if (player.relics?.phoenix > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(x - 10, y - 14, 2, 3);
      ctx.fillRect(x + 9, y - 11, 2, 3);
    }
  };

  render = function renderRichContent() {
    originalRender();
    if (!player) return;
    ctx.save();
    ctx.globalAlpha = 0.16 + phase * 0.025;
    ctx.fillStyle = phase >= 2 ? PALETTE.red : PALETTE.violetLight;
    const pulse = Math.floor(elapsed * 6) % 8;
    ctx.fillRect(3 + pulse, 3, 24, 1);
    ctx.fillRect(VIEW_WIDTH - 27 - pulse, VIEW_HEIGHT - 4, 24, 1);
    ctx.restore();
  };

  function updateRichHud(force = false) {
    if (!player) return;
    installCodex();
    const buffs = [];
    if (player.richShield > 0) buffs.push(`星幕 ${player.richShield.toFixed(1)}s`);
    if (player.relics.phoenix > 0) buffs.push(`凤凰余烬 ×${player.relics.phoenix}`);
    if (player.weapons.comet?.evolved) buffs.push('星陨天灾');
    if (player.weapons.prism?.evolved) buffs.push('无尽棱镜');
    if (player.weapons.mine?.evolved) buffs.push('黑洞雷场');
    if (buffStrip && (force || buffStrip.dataset.state !== buffs.join('|'))) {
      buffStrip.dataset.state = buffs.join('|');
      buffStrip.innerHTML = buffs.length
        ? buffs.map((buff) => `<span>${buff}</span>`).join('')
        : '<span class="muted-buff">等待星蚀增益</span>';
    }
  }

  installCodex();
  resetGame();
})();
