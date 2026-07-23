(() => {
  const WORLD_TIME_SCALE = 0.35;
  const PLAYER_WEAPON_SCALE = 0.6;
  const EFFECT_TIME_SCALE = 0.5;
  const CHOICE_DURATION = 8;
  const PROTECTION_DURATION = 1.2;
  const PROTECTION_DAMAGE_MULTIPLIER = 0.3;

  const UpgradeState = Object.freeze({
    IDLE: 'idle',
    SELECTING: 'selecting',
    APPLYING: 'applying',
  });

  const EVOLUTION_RULES = [
    { weapon: 'bolt', relic: 'focus', level: 5 },
    { weapon: 'orbit', relic: 'blood', level: 4 },
    { weapon: 'aura', relic: 'frost', level: 4 },
    { weapon: 'chain', relic: 'storm', level: 4 },
    { weapon: 'comet', relic: 'nebula', level: 4 },
    { weapon: 'prism', relic: 'chrono', level: 4 },
    { weapon: 'mine', relic: 'gravityCore', level: 4 },
  ];

  const RARITY_SCORE = {
    common: 0,
    uncommon: 12,
    rare: 24,
    epic: 38,
    legendary: 60,
  };

  const SURVIVAL_UPGRADES = new Set(['health', 'blood', 'frost', 'ward', 'phoenix', 'regen']);
  const DAMAGE_UPGRADES = new Set(['damage', 'cooldown', 'focus', 'storm', 'nebula', 'chrono', 'projectile', 'area']);

  let upgradeState = UpgradeState.IDLE;
  let upgradeQueue = [];
  let currentRequest = null;
  let currentOptions = [];
  let currentButtons = [];
  let recommendedIndex = 0;
  let choiceRemaining = 0;
  let protectionRemaining = 0;
  let metaClock = 0;

  const finalUpdate = update;
  const finalHurtPlayer = hurtPlayer;
  const finalDash = dash;
  const finalNova = nova;
  const finalEndGame = endGame;
  const finalResetGame = resetGame;
  const finalTogglePause = togglePause;

  const upgradeScreen = document.querySelector('#upgrade-screen');
  const upgradePanel = upgradeScreen?.querySelector('.upgrade-panel');
  const queueValue = document.querySelector('#upgrade-queue-value');
  const timerValue = document.querySelector('#upgrade-timer-value');
  const timerBar = document.querySelector('#upgrade-timer-bar');
  const slowValue = document.querySelector('#upgrade-slow-value');
  const protectionValue = document.querySelector('#upgrade-protection-value');

  function rarityOf(upgrade) {
    return upgrade.rarity || (upgrade.type === '遗物' ? 'rare' : upgrade.type === '武器' ? 'uncommon' : 'common');
  }

  function rarityLabel(rarity) {
    return {
      common: '普通',
      uncommon: '优秀',
      rare: '稀有',
      epic: '史诗',
      legendary: '传说',
    }[rarity] || '星尘';
  }

  function currentWeapon(id) {
    return player?.weapons?.[id] || null;
  }

  function currentRelicCount(id) {
    return Number(player?.relics?.[id] || 0);
  }

  function upgradeCount(upgrade) {
    if (!player) return 0;
    if (player.weapons?.[upgrade.id]) return Number(player.weapons[upgrade.id].level || 0);
    if (player.relics?.[upgrade.id] !== undefined) return Number(player.relics[upgrade.id] || 0);
    return Number(player.richUpgradeCounts?.[upgrade.id] || 0);
  }

  function isAvailable(upgrade) {
    if (!upgrade?.max) return true;
    return upgradeCount(upgrade) < upgrade.max;
  }

  function completesEvolution(upgrade) {
    return EVOLUTION_RULES.some((rule) => {
      const weapon = currentWeapon(rule.weapon);
      if (!weapon || weapon.evolved) return false;
      if (upgrade.id === rule.relic) return weapon.level >= rule.level;
      if (upgrade.id === rule.weapon) return currentRelicCount(rule.relic) > 0 && weapon.level === rule.level - 1;
      return false;
    });
  }

  function supportsOwnedBuild(upgrade) {
    if (player?.weapons?.[upgrade.id]) return player.weapons[upgrade.id].level > 0;
    if (player?.relics?.[upgrade.id] !== undefined) return player.relics[upgrade.id] > 0;
    return false;
  }

  function scoreUpgrade(upgrade) {
    let score = RARITY_SCORE[rarityOf(upgrade)] || 0;
    if (completesEvolution(upgrade)) score += 1000;
    if (supportsOwnedBuild(upgrade)) score += 180;
    if (upgrade.type === '武器' && upgradeCount(upgrade) === 0) score += 34;
    if (upgrade.type === '遗物') score += 24;

    const hpRatio = player?.maxHp ? player.hp / player.maxHp : 1;
    if (hpRatio < 0.48 && SURVIVAL_UPGRADES.has(upgrade.id)) score += 240;
    if (hpRatio > 0.72 && DAMAGE_UPGRADES.has(upgrade.id)) score += 48;

    for (const rule of EVOLUTION_RULES) {
      const weapon = currentWeapon(rule.weapon);
      if (!weapon || weapon.evolved) continue;
      if (upgrade.id === rule.relic && weapon.level > 0) score += 110 + weapon.level * 12;
      if (upgrade.id === rule.weapon && currentRelicCount(rule.relic) > 0) score += 120;
    }
    return score;
  }

  function chooseOptions(pool) {
    const available = [...pool].filter(isAvailable);
    const source = available.length ? available : [...pool];
    const shuffled = source
      .map((upgrade) => ({ upgrade, roll: Math.random() }))
      .sort((a, b) => a.roll - b.roll)
      .map((entry) => entry.upgrade);
    return shuffled.slice(0, 3);
  }

  function pendingChoiceCount() {
    return upgradeQueue.length + (upgradeState === UpgradeState.IDLE ? 0 : 1);
  }

  function updateUpgradeMeta() {
    const pending = pendingChoiceCount();
    if (queueValue) queueValue.textContent = String(pending);
    if (timerValue) timerValue.textContent = `${Math.max(0, choiceRemaining).toFixed(1)}s`;
    if (timerBar) timerBar.style.width = `${Math.max(0, Math.min(100, choiceRemaining / CHOICE_DURATION * 100))}%`;
    if (slowValue) slowValue.textContent = `${Math.round(WORLD_TIME_SCALE * 100)}%`;
    if (protectionValue) {
      protectionValue.textContent = protectionRemaining > 0
        ? `减伤 ${Math.round((1 - PROTECTION_DAMAGE_MULTIPLIER) * 100)}% · ${protectionRemaining.toFixed(1)}s`
        : '保护结束';
    }
  }

  function pushEnemiesAway() {
    if (!player) return;
    const radius = 96;
    for (const enemy of enemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance > radius) continue;
      const force = 18 + (radius - distance) * 0.18;
      enemy.x = clamp(enemy.x + dx / distance * force, enemy.radius, WORLD_WIDTH - enemy.radius);
      enemy.y = clamp(enemy.y + dy / distance * force, enemy.radius, WORLD_HEIGHT - enemy.radius);
    }
    createParticle(player.x, player.y, PALETTE.cyan, 18, 85, 0.42);
    screenShake = Math.max(screenShake, 1);
  }

  function renderChoice(request) {
    ui.upgradeTitle.textContent = request.title;
    ui.upgradeOptions.innerHTML = '';
    currentOptions = chooseOptions(request.pool);
    currentButtons = [];
    recommendedIndex = Math.max(0, currentOptions
      .map((upgrade, index) => ({ index, score: scoreUpgrade(upgrade) }))
      .sort((a, b) => b.score - a.score)[0]?.index || 0);

    currentOptions.forEach((upgrade, index) => {
      const rarity = rarityOf(upgrade);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'upgrade-card rich-upgrade-card live-upgrade-card';
      button.dataset.rarity = rarity;
      button.dataset.choiceIndex = String(index);
      if (index === recommendedIndex) button.classList.add('recommended');
      button.innerHTML = `
        <span class="upgrade-key" aria-hidden="true">${index + 1}</span>
        <span class="upgrade-icon" aria-hidden="true">${upgrade.icon || '✦'}</span>
        <span class="rarity-chip">${rarityLabel(rarity)} · ${upgrade.type}</span>
        ${index === recommendedIndex ? '<span class="recommended-chip">推荐</span>' : ''}
        <h3>${upgrade.name}</h3>
        <p>${upgrade.description}</p>`;
      button.addEventListener('click', () => applyChoice(index));
      ui.upgradeOptions.appendChild(button);
      currentButtons.push(button);
    });
  }

  function beginNextChoice() {
    if (!running || player?.hp <= 0) {
      closeUpgradeTerminal(true);
      return;
    }
    currentRequest = upgradeQueue.shift() || null;
    if (!currentRequest) {
      closeUpgradeTerminal();
      return;
    }

    const continuingQueue = document.body.classList.contains('live-upgrade-active');
    upgradeState = UpgradeState.SELECTING;
    choosing = true;
    choiceRemaining = CHOICE_DURATION;
    metaClock = 0;
    if (!continuingQueue) protectionRemaining = PROTECTION_DURATION;
    document.body.classList.add('live-upgrade-active');
    upgradePanel?.setAttribute('aria-live', 'polite');
    renderChoice(currentRequest);
    showOverlay(ui.upgradeScreen);
    if (!continuingQueue) pushEnemiesAway();
    ui.statusMessage.textContent = `星尘选择开启：战场流速 ${Math.round(WORLD_TIME_SCALE * 100)}%。`;
    updateUpgradeMeta();
    sound.level();
  }

  function queueUpgrade(title = '选择一项星尘强化', pool = upgrades) {
    upgradeQueue.push({ title, pool: [...pool] });
    if (upgradeState === UpgradeState.IDLE) beginNextChoice();
    else updateUpgradeMeta();
  }

  function applyChoice(index) {
    if (upgradeState !== UpgradeState.SELECTING) return;
    const upgrade = currentOptions[index];
    if (!upgrade) return;

    upgradeState = UpgradeState.APPLYING;
    currentButtons.forEach((button) => { button.disabled = true; });
    upgrade.apply();
    checkEvolution();
    ui.statusMessage.textContent = `获得：${upgrade.name}`;
    createParticle(player.x, player.y, rarityOf(upgrade) === 'legendary' ? PALETTE.gold : PALETTE.violetLight, 18, 95, 0.55);
    screenShake = Math.max(screenShake, 1);
    updateUi(true);

    currentRequest = null;
    currentOptions = [];
    currentButtons = [];

    if (upgradeQueue.length) {
      beginNextChoice();
    } else {
      hideOverlay(ui.upgradeScreen);
      closeUpgradeTerminal();
    }
  }

  function closeUpgradeTerminal(clearQueue = false) {
    if (clearQueue) upgradeQueue = [];
    upgradeState = UpgradeState.IDLE;
    currentRequest = null;
    currentOptions = [];
    currentButtons = [];
    choiceRemaining = 0;
    protectionRemaining = 0;
    metaClock = 0;
    choosing = false;
    hideOverlay(ui.upgradeScreen);
    document.body.classList.remove('live-upgrade-active');
    updateUpgradeMeta();
  }

  function updateUpgradeState(realDt) {
    if (upgradeState !== UpgradeState.SELECTING) return;
    choiceRemaining = Math.max(0, choiceRemaining - realDt);
    protectionRemaining = Math.max(0, protectionRemaining - realDt);
    metaClock -= realDt;
    if (metaClock <= 0) {
      metaClock = 0.1;
      updateUpgradeMeta();
    }
    if (choiceRemaining <= 0) {
      const target = currentButtons[recommendedIndex] || currentButtons[0];
      target?.click();
    }
  }

  function compensatePlayerTime(realDt, worldDt) {
    if (!player || realDt <= worldDt) return;
    const extraDt = realDt - worldDt;
    const dashActive = player.dashTime > 0;

    player.invulnerable = Math.max(0, player.invulnerable - extraDt);
    player.dashCooldown = Math.max(0, player.dashCooldown - extraDt);
    player.dashTime = Math.max(0, player.dashTime - extraDt);
    player.novaTime = Math.max(0, player.novaTime - extraDt);
    player.hp = Math.min(player.maxHp, player.hp + player.regen * extraDt);

    let moveX = (keys.has('d') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('a') || keys.has('ArrowLeft') ? 1 : 0);
    let moveY = (keys.has('s') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('w') || keys.has('ArrowUp') ? 1 : 0);
    const moveLength = Math.hypot(moveX, moveY) || 1;
    if (moveX || moveY) {
      player.facingX = moveX / moveLength;
      player.facingY = moveY / moveLength;
    }

    const movementSpeed = dashActive ? 410 : player.speed * (player.novaTime ? 1.3 : 1);
    player.x += (dashActive ? player.facingX : moveX / moveLength) * movementSpeed * extraDt;
    player.y += (dashActive ? player.facingY : moveY / moveLength) * movementSpeed * extraDt;
    player.x = clamp(player.x, player.radius, WORLD_WIDTH - player.radius);
    player.y = clamp(player.y, player.radius, WORLD_HEIGHT - player.radius);
    updateCamera();

    if (dashActive) {
      particles.push({
        x: player.x,
        y: player.y,
        vx: 0,
        vy: 0,
        color: PALETTE.violet,
        life: 0.22,
        maxLife: 0.22,
        size: 7,
        ghost: true,
      });
    }

    const weaponExtraDt = Math.max(0, PLAYER_WEAPON_SCALE - WORLD_TIME_SCALE) * realDt;
    if (weaponExtraDt > 0) shootWeapons(weaponExtraDt);

    const effectExtraDt = Math.max(0, EFFECT_TIME_SCALE - WORLD_TIME_SCALE) * realDt;
    if (effectExtraDt > 0) updateEffects(effectExtraDt);
  }

  openUpgrade = function openLiveUpgrade(title = '选择一项星尘强化', pool = upgrades) {
    queueUpgrade(title, pool);
  };

  gainXp = function gainXpWithQueue(value) {
    player.xp += value;
    let gainedLevels = 0;
    while (player.xp >= player.nextXp) {
      player.xp -= player.nextXp;
      player.level += 1;
      player.nextXp = Math.round(player.nextXp * 1.22 + 7);
      gainedLevels += 1;
      upgradeQueue.push({ title: '选择一项星尘强化', pool: [...upgrades] });
    }
    if (gainedLevels && upgradeState === UpgradeState.IDLE) beginNextChoice();
    else if (gainedLevels) updateUpgradeMeta();
  };

  update = function updateWithLiveUpgrade(realDt) {
    if (upgradeState !== UpgradeState.SELECTING) {
      finalUpdate(realDt);
      return;
    }

    const worldDt = realDt * WORLD_TIME_SCALE;
    finalUpdate(worldDt);
    if (!running) return;
    compensatePlayerTime(realDt, worldDt);
  };

  loop = function liveUpgradeLoop(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - lastFrame) / 1000 || 0);
    lastFrame = now;
    if (!paused) {
      update(dt);
      updateUpgradeState(dt);
    }
    render();
    animationFrame = requestAnimationFrame(loop);
  };

  hurtPlayer = function hurtPlayerWithUpgradeProtection(amount) {
    const protectedAmount = upgradeState === UpgradeState.SELECTING && protectionRemaining > 0
      ? amount * PROTECTION_DAMAGE_MULTIPLIER
      : amount;
    finalHurtPlayer(protectedAmount);
  };

  dash = function dashDuringUpgrade() {
    if (upgradeState !== UpgradeState.SELECTING) {
      finalDash();
      return;
    }
    const previousChoosing = choosing;
    choosing = false;
    finalDash();
    choosing = previousChoosing;
  };

  nova = function novaDuringUpgrade() {
    if (upgradeState !== UpgradeState.SELECTING) {
      finalNova();
      return;
    }
    const previousChoosing = choosing;
    choosing = false;
    finalNova();
    choosing = previousChoosing;
  };

  togglePause = function togglePauseDuringUpgrade() {
    if (!running) return;
    if (upgradeState !== UpgradeState.SELECTING) {
      finalTogglePause();
      return;
    }
    paused = !paused;
    ui.pauseButton.textContent = paused ? '继续' : '暂停';
  };

  ui.pauseButton?.addEventListener('click', (event) => {
    if (upgradeState !== UpgradeState.SELECTING) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    togglePause();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (upgradeState !== UpgradeState.SELECTING || paused) return;
    if (!['1', '2', '3'].includes(event.key)) return;
    event.preventDefault();
    currentButtons[Number(event.key) - 1]?.click();
  }, true);

  endGame = function endGameWithLiveUpgradeClose() {
    closeUpgradeTerminal(true);
    finalEndGame();
  };

  resetGame = function resetGameWithLiveUpgradeReset() {
    closeUpgradeTerminal(true);
    finalResetGame();
  };

  upgradeScreen?.classList.add('live-upgrade-screen');
  updateUpgradeMeta();
})();
