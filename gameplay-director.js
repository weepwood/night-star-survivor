(() => {
  const BOSS_NAMES = ['血月监视者', '星蚀巨像', '无光祭司'];
  const BOSS_TIMES = [40, 80, 120];
  const HUD_INTERVAL = 0.2;
  const COMBO_WINDOW = 2.6;

  const SYNERGY_POOL = [
    {
      id: 'starstorm',
      name: '星雷穿刺',
      requirement: '星矢阵列 Lv.2 + 星雷链',
      description: '总伤害 +14%，击杀额外获得星爆能量。',
      active: () => weaponLevel('bolt') >= 2 && weaponLevel('chain') >= 1,
      bonus: { damage: 1.14, novaPerKill: 1.5 },
    },
    {
      id: 'frostmoon',
      name: '冻月回响',
      requirement: '月轮刃 Lv.2 + 寒星领域',
      description: '总伤害 +10%，命中击退效果增强。',
      active: () => weaponLevel('orbit') >= 2 && weaponLevel('aura') >= 1,
      bonus: { damage: 1.10, knockback: 1.45 },
    },
    {
      id: 'gravity-cataclysm',
      name: '引力天灾',
      requirement: '彗星权杖 + 虚空星雷',
      description: '总伤害 +16%，精英击杀额外恢复生命。',
      active: () => weaponLevel('comet') >= 1 && weaponLevel('mine') >= 1,
      bonus: { damage: 1.16, eliteHeal: 4 },
    },
    {
      id: 'prism-tempest',
      name: '棱镜风暴',
      requirement: '棱镜星轮 + 风暴刻印',
      description: '总伤害 +13%，暴击产生更强冲击反馈。',
      active: () => weaponLevel('prism') >= 1 && relicCount('storm') >= 1,
      bonus: { damage: 1.13, criticalForce: 1.45 },
    },
    {
      id: 'phoenix-dawn',
      name: '凤凰黎明',
      requirement: '凤凰余烬 + 生命恢复 0.65+',
      description: '承受伤害 -12%，击杀恢复少量生命。',
      active: () => relicCount('phoenix') >= 1 && Number(player?.regen || 0) >= 0.65,
      bonus: { damageTaken: 0.88, killHeal: 0.75 },
    },
    {
      id: 'chrono-hunt',
      name: '时隙猎杀',
      requirement: '时隙碎片 + 星迹披风',
      description: '总伤害 +8%，击杀缩短冲刺冷却。',
      active: () => relicCount('chrono') >= 1 && relicCount('cloak') >= 1,
      bonus: { damage: 1.08, dashRecharge: 0.14 },
    },
    {
      id: 'scarlet-orbit',
      name: '猩红月环',
      requirement: '月轮刃 + 猩红月石',
      description: '总伤害 +9%，精英与首领击杀恢复生命。',
      active: () => weaponLevel('orbit') >= 1 && relicCount('blood') >= 1,
      bonus: { damage: 1.09, eliteHeal: 6 },
    },
    {
      id: 'nebula-focus',
      name: '星云聚焦',
      requirement: '彗星权杖 + 聚焦星核',
      description: '总伤害 +12%，连击保持时间延长。',
      active: () => weaponLevel('comet') >= 1 && relicCount('focus') >= 1,
      bonus: { damage: 1.12, comboWindow: 1.2 },
    },
  ];

  const originalResetGame = resetGame;
  const originalUpdate = update;
  const originalDamageEnemy = damageEnemy;
  const originalHurtPlayer = hurtPlayer;
  const originalSpawnBoss = spawnBoss;
  const originalEndGame = endGame;
  const originalDrawPlayer = drawPlayer;
  const originalDrawEffects = drawEffects;
  const originalUpdateEffects = updateEffects;

  let selectedSynergies = [];
  let activeSynergies = new Set();
  let impactBursts = [];
  let bossesDefeated = 0;
  let comboKills = 0;
  let comboTimer = 0;
  let playerHitPulse = 0;
  let directorHudClock = 0;
  let victoryCompleted = false;

  const objectiveBrief = document.querySelector('#objective-brief');
  const objectiveTitle = document.querySelector('#objective-title');
  const objectiveDetail = document.querySelector('#objective-detail');
  const objectiveProgress = document.querySelector('#objective-progress-bar');
  const objectiveStages = [...document.querySelectorAll('[data-objective-stage]')];
  const synergyList = document.querySelector('#synergy-list');
  const comboValue = document.querySelector('#status-combo-value');
  const armorValue = document.querySelector('#status-armor-value');
  const dashValue = document.querySelector('#status-dash-value');
  const novaValue = document.querySelector('#status-nova-value');
  const playerCore = document.querySelector('#player-pixel-core');
  const victoryScreen = document.querySelector('#victory-screen');
  const victoryStats = document.querySelector('#victory-stats');
  const victorySynergies = document.querySelector('#victory-synergies');

  function weaponLevel(id) {
    return Number(player?.weapons?.[id]?.level || 0);
  }

  function relicCount(id) {
    return Number(player?.relics?.[id] || 0);
  }

  function shuffle(list) {
    return [...list]
      .map((value) => ({ value, roll: Math.random() }))
      .sort((a, b) => a.roll - b.roll)
      .map((entry) => entry.value);
  }

  function activeBonus() {
    const result = {
      damage: 1,
      damageTaken: 1,
      knockback: 1,
      criticalForce: 1,
      killHeal: 0,
      eliteHeal: 0,
      novaPerKill: 0,
      dashRecharge: 0,
      comboWindow: 0,
    };
    for (const synergy of selectedSynergies) {
      if (!activeSynergies.has(synergy.id)) continue;
      const bonus = synergy.bonus || {};
      result.damage *= bonus.damage || 1;
      result.damageTaken *= bonus.damageTaken || 1;
      result.knockback *= bonus.knockback || 1;
      result.criticalForce *= bonus.criticalForce || 1;
      result.killHeal += bonus.killHeal || 0;
      result.eliteHeal += bonus.eliteHeal || 0;
      result.novaPerKill += bonus.novaPerKill || 0;
      result.dashRecharge += bonus.dashRecharge || 0;
      result.comboWindow += bonus.comboWindow || 0;
    }
    return result;
  }

  function installAudioUpgrade() {
    if (!sound || sound.directorAudioInstalled) return;
    sound.directorAudioInstalled = true;
    sound.lastFxAt = new Map();

    function ensureBus() {
      sound.init();
      const audio = sound.context;
      if (!audio) return null;
      if (audio.state === 'suspended') audio.resume?.();
      if (sound.directorBus) return sound.directorBus;
      const compressor = audio.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 16;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.16;
      const master = audio.createGain();
      master.gain.value = 0.55;
      compressor.connect(master).connect(audio.destination);
      sound.directorBus = compressor;
      sound.directorMaster = master;
      return compressor;
    }

    function voice(frequency, duration, type = 'square', volume = 0.02, slide = 0, delay = 0) {
      if (!sound.enabled) return;
      const bus = ensureBus();
      const audio = sound.context;
      if (!bus || !audio) return;
      const start = audio.currentTime + Math.max(0, delay);
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(35, frequency), start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency + slide), start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.008, duration * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(bus);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }

    function noise(duration = 0.04, volume = 0.014, delay = 0) {
      if (!sound.enabled) return;
      const bus = ensureBus();
      const audio = sound.context;
      if (!bus || !audio) return;
      const frameCount = Math.max(1, Math.floor(audio.sampleRate * duration));
      const buffer = audio.createBuffer(1, frameCount, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
      const source = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();
      filter.type = 'bandpass';
      filter.frequency.value = 780;
      filter.Q.value = 0.8;
      gain.gain.value = volume;
      source.buffer = buffer;
      source.connect(filter).connect(gain).connect(bus);
      source.start(audio.currentTime + delay);
    }

    function allow(key, intervalMs) {
      const now = performance.now();
      const previous = sound.lastFxAt.get(key) || -Infinity;
      if (now - previous < intervalMs) return false;
      sound.lastFxAt.set(key, now);
      return true;
    }

    sound.tone = (frequency, duration, type = 'square', volume = 0.025, slide = 0) => {
      voice(frequency, duration, type, volume, slide);
    };
    sound.shoot = () => {
      if (!allow('shoot', 38)) return;
      voice(330 + Math.random() * 45, 0.045, 'square', 0.011, 105);
      voice(170, 0.028, 'triangle', 0.006, 40, 0.006);
    };
    sound.hit = () => {
      if (!allow('hit', 24)) return;
      voice(118 + Math.random() * 24, 0.035, 'square', 0.011, -42);
      noise(0.028, 0.008);
    };
    sound.pickup = () => {
      if (!allow('pickup', 55)) return;
      voice(620, 0.055, 'square', 0.012, 110);
      voice(880, 0.07, 'triangle', 0.009, 100, 0.04);
    };
    sound.level = () => {
      voice(392, 0.11, 'square', 0.018, 90);
      voice(523, 0.13, 'square', 0.016, 120, 0.07);
      voice(659, 0.18, 'triangle', 0.017, 170, 0.14);
    };
    sound.dash = () => {
      voice(135, 0.09, 'sawtooth', 0.016, 260);
      noise(0.07, 0.009);
    };
    sound.nova = () => {
      voice(72, 0.32, 'sawtooth', 0.03, 310);
      voice(144, 0.24, 'square', 0.018, 420, 0.05);
      noise(0.18, 0.014, 0.03);
    };
    sound.boss = () => {
      voice(55, 0.48, 'sawtooth', 0.026, -8);
      voice(82, 0.42, 'square', 0.018, -12, 0.16);
      voice(44, 0.55, 'triangle', 0.02, 0, 0.34);
    };
    sound.critical = () => {
      if (!allow('critical', 45)) return;
      voice(220, 0.055, 'square', 0.018, 250);
      voice(740, 0.07, 'triangle', 0.012, -120, 0.018);
      noise(0.04, 0.013);
    };
    sound.kill = (elite = false) => {
      if (!allow(elite ? 'elite-kill' : 'kill', elite ? 90 : 42)) return;
      voice(elite ? 185 : 145, elite ? 0.14 : 0.07, 'square', elite ? 0.022 : 0.012, elite ? 220 : 80);
      if (elite) voice(370, 0.18, 'triangle', 0.014, 260, 0.05);
    };
    sound.playerHit = () => {
      if (!allow('player-hit', 100)) return;
      voice(92, 0.12, 'sawtooth', 0.025, -34);
      noise(0.08, 0.016);
    };
    sound.objective = () => {
      voice(330, 0.09, 'square', 0.015, 90);
      voice(495, 0.12, 'triangle', 0.014, 160, 0.08);
    };
    sound.synergy = () => {
      voice(280, 0.08, 'square', 0.014, 120);
      voice(420, 0.11, 'square', 0.014, 160, 0.06);
      voice(680, 0.18, 'triangle', 0.014, 90, 0.13);
    };
    sound.victory = () => {
      [262, 330, 392, 523, 659].forEach((note, index) => voice(note, 0.22, index < 3 ? 'square' : 'triangle', 0.018, 80, index * 0.11));
    };
    sound.defeat = () => {
      voice(180, 0.22, 'sawtooth', 0.02, -70);
      voice(110, 0.34, 'triangle', 0.018, -35, 0.12);
    };
  }

  function renderSynergies() {
    if (!synergyList) return;
    synergyList.innerHTML = selectedSynergies.map((synergy) => {
      const active = activeSynergies.has(synergy.id);
      return `
        <article class="synergy-chip ${active ? 'active' : ''}" data-synergy="${synergy.id}">
          <span class="synergy-state">${active ? 'ONLINE' : 'LOCKED'}</span>
          <strong>${synergy.name}</strong>
          <small>${synergy.requirement}</small>
          <em>${synergy.description}</em>
        </article>`;
    }).join('');
  }

  function refreshSynergies(announce = true) {
    let changed = false;
    for (const synergy of selectedSynergies) {
      if (activeSynergies.has(synergy.id) || !synergy.active()) continue;
      activeSynergies.add(synergy.id);
      changed = true;
      if (announce) {
        ui.statusMessage.textContent = `星契激活：${synergy.name}`;
        sound.synergy?.();
        createParticle(player.x, player.y, PALETTE.gold, 24, 105, 0.65);
      }
    }
    if (changed || !synergyList?.children.length) renderSynergies();
  }

  function missionState() {
    const activeBosses = enemies.filter((enemy) => enemy.type === 'boss');
    if (bossesDefeated >= BOSS_NAMES.length) {
      return { title: '夜幕任务完成', detail: '三名星蚀首领已被击败。', progress: 1, brief: '任务完成' };
    }
    if (activeBosses.length) {
      const boss = activeBosses.reduce((lowest, enemy) => enemy.hp / enemy.maxHp < lowest.hp / lowest.maxHp ? enemy : lowest, activeBosses[0]);
      const index = Math.min(BOSS_NAMES.length - 1, bossesDefeated);
      return {
        title: `击败 ${BOSS_NAMES[index]}`,
        detail: `首领生命 ${Math.max(0, Math.ceil(boss.hp))} / ${Math.ceil(boss.maxHp)}`,
        progress: 1 - Math.max(0, boss.hp / boss.maxHp),
        brief: `首领 ${bossesDefeated + 1}/3`,
      };
    }
    const index = Math.min(BOSS_NAMES.length - 1, bossesDefeated);
    const start = index === 0 ? 0 : BOSS_TIMES[index - 1];
    const target = BOSS_TIMES[index];
    const remaining = Math.max(0, Math.ceil(target - elapsed));
    return {
      title: `准备迎战 ${BOSS_NAMES[index]}`,
      detail: remaining > 0 ? `坚持 ${remaining} 秒，下一轮星蚀即将降临。` : '首领正在穿越星门。',
      progress: Math.max(0, Math.min(1, (elapsed - start) / Math.max(1, target - start))),
      brief: remaining > 0 ? `目标 ${remaining}s` : '首领降临',
    };
  }

  function renderMission() {
    const state = missionState();
    if (objectiveBrief) objectiveBrief.textContent = state.brief;
    if (objectiveTitle) objectiveTitle.textContent = state.title;
    if (objectiveDetail) objectiveDetail.textContent = state.detail;
    if (objectiveProgress) objectiveProgress.style.width = `${Math.round(state.progress * 100)}%`;
    objectiveStages.forEach((row, index) => {
      row.classList.toggle('complete', index < bossesDefeated);
      row.classList.toggle('active', index === bossesDefeated && bossesDefeated < BOSS_NAMES.length);
      const status = row.querySelector('[data-objective-status]');
      if (status) status.textContent = index < bossesDefeated ? '完成' : index === bossesDefeated ? '当前' : '锁定';
    });
  }

  function renderPlayerStatus() {
    if (!player) return;
    if (playerCore) {
      playerCore.dataset.hero = selectedHero;
      playerCore.classList.toggle('hurt', playerHitPulse > 0);
      playerCore.classList.toggle('nova-ready', player.nova >= 100 || player.novaTime > 0);
    }
    if (armorValue) armorValue.textContent = String(Math.max(0, Math.round(player.armor || 0)));
    if (dashValue) dashValue.textContent = player.dashCooldown <= 0 ? 'READY' : `${player.dashCooldown.toFixed(1)}s`;
    if (novaValue) novaValue.textContent = player.novaTime > 0 ? 'ACTIVE' : `${Math.floor(player.nova || 0)}%`;
    if (comboValue) comboValue.textContent = comboKills >= 2 ? `×${comboKills}` : '—';
  }

  function resetDirectorState(announce = false) {
    selectedSynergies = shuffle(SYNERGY_POOL).slice(0, 3);
    activeSynergies = new Set();
    impactBursts = [];
    bossesDefeated = 0;
    comboKills = 0;
    comboTimer = 0;
    playerHitPulse = 0;
    directorHudClock = 0;
    victoryCompleted = false;
    hideOverlay(victoryScreen);
    renderSynergies();
    refreshSynergies(false);
    renderMission();
    renderPlayerStatus();
    if (announce && ui.statusMessage) ui.statusMessage.textContent = '夜幕任务：击败三名星蚀首领，完成本局撤离。';
  }

  function pushImpact(enemy, critical, killed) {
    impactBursts.push({
      x: enemy.x,
      y: enemy.y,
      life: killed ? 0.24 : 0.14,
      maxLife: killed ? 0.24 : 0.14,
      color: critical ? PALETTE.gold : killed ? PALETTE.red : PALETTE.violetLight,
      critical,
      killed,
    });
  }

  function applyKnockback(enemy, critical) {
    if (!enemy || enemy.type === 'boss') return;
    const bonus = activeBonus();
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.hypot(dx, dy) || 1;
    const force = (critical ? 4.2 : 2.2) * bonus.knockback * (critical ? bonus.criticalForce : 1);
    enemy.x += dx / distance * force;
    enemy.y += dy / distance * force;
    if (typeof clampToArena === 'function') clampToArena(enemy);
  }

  function registerKill(enemy) {
    const bonus = activeBonus();
    comboKills = comboTimer > 0 ? comboKills + 1 : 1;
    comboTimer = COMBO_WINDOW + bonus.comboWindow;
    player.hp = Math.min(player.maxHp, player.hp + bonus.killHeal + (enemy.elite ? bonus.eliteHeal : 0));
    player.nova = Math.min(100, player.nova + bonus.novaPerKill);
    player.dashCooldown = Math.max(0, player.dashCooldown - bonus.dashRecharge);
    sound.kill?.(enemy.elite || enemy.type === 'boss');
    if (comboKills > 0 && comboKills % 10 === 0) sound.objective?.();

    if (enemy.type === 'boss') {
      bossesDefeated += 1;
      sound.objective?.();
      ui.statusMessage.textContent = bossesDefeated >= BOSS_NAMES.length
        ? '最终首领已击败：夜幕任务完成。'
        : `阶段目标完成：已击败 ${bossesDefeated} / ${BOSS_NAMES.length} 名首领。`;
      renderMission();
      if (bossesDefeated >= BOSS_NAMES.length) completeVictory();
    }
  }

  function completeVictory() {
    if (victoryCompleted) return;
    victoryCompleted = true;
    running = false;
    choosing = false;
    paused = false;
    hideOverlay(ui.upgradeScreen);
    sound.victory?.();
    const activeNames = selectedSynergies.filter((synergy) => activeSynergies.has(synergy.id)).map((synergy) => synergy.name);
    if (victoryStats) victoryStats.textContent = `用时 ${Math.floor(elapsed)} 秒，达到 ${player.level} 级，击败 ${player.kills} 名敌人并消灭全部三名星蚀首领。`;
    if (victorySynergies) victorySynergies.textContent = activeNames.length ? `本局激活星契：${activeNames.join('、')}` : '本局未激活星契，但仍完成了夜幕任务。';
    showOverlay(victoryScreen);
  }

  resetGame = function resetGameWithDirector() {
    originalResetGame();
    resetDirectorState(true);
  };

  spawnBoss = function spawnBossWithMission() {
    originalSpawnBoss();
    renderMission();
  };

  damageEnemy = function damageEnemyWithDirector(enemy, rawDamage) {
    if (!enemy || !enemies.includes(enemy)) return originalDamageEnemy(enemy, rawDamage);
    const beforeHp = Math.max(0, Number(enemy.hp) || 0);
    const numbersBefore = numbers.length;
    const result = originalDamageEnemy(enemy, rawDamage * activeBonus().damage);
    const dealt = Math.max(0, beforeHp - Math.max(0, Number(enemy.hp) || 0));
    if (!dealt) return result;

    const latestNumber = numbers.length > numbersBefore ? numbers[numbers.length - 1] : null;
    const critical = Boolean(latestNumber?.critical);
    pushImpact(enemy, critical, result);
    if (critical) sound.critical?.();
    if (!result) applyKnockback(enemy, critical);
    if (result) registerKill(enemy);
    return result;
  };

  hurtPlayer = function hurtPlayerWithDirector(amount) {
    const before = Number(player?.hp || 0);
    originalHurtPlayer(amount * activeBonus().damageTaken);
    if (player && player.hp < before) {
      playerHitPulse = 0.18;
      comboKills = 0;
      comboTimer = 0;
      sound.playerHit?.();
      renderPlayerStatus();
    }
  };

  updateEffects = function updateDirectorEffects(dt) {
    originalUpdateEffects(dt);
    impactBursts.forEach((burst) => { burst.life -= dt; });
    impactBursts = impactBursts.filter((burst) => burst.life > 0);
  };

  update = function updateWithDirector(dt) {
    originalUpdate(dt);
    if (!player) return;
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer <= 0) comboKills = 0;
    playerHitPulse = Math.max(0, playerHitPulse - dt);
    directorHudClock -= dt;
    if (directorHudClock <= 0) {
      directorHudClock = HUD_INTERVAL;
      refreshSynergies();
      renderMission();
      renderPlayerStatus();
    }
  };

  drawEffects = function drawEffectsWithImpacts() {
    originalDrawEffects();
    for (const burst of impactBursts) {
      if (!isVisible(burst.x, burst.y, 24)) continue;
      const ratio = Math.max(0, burst.life / burst.maxLife);
      const radius = Math.max(2, Math.round((1 - ratio) * (burst.killed ? 14 : 8)));
      const x = screenX(burst.x);
      const y = screenY(burst.y);
      ctx.globalAlpha = Math.min(1, ratio * 1.4);
      ctx.fillStyle = burst.color;
      ctx.fillRect(x - radius, y, radius * 2 + 1, burst.critical ? 2 : 1);
      ctx.fillRect(x, y - radius, burst.critical ? 2 : 1, radius * 2 + 1);
      if (burst.killed) {
        ctx.fillRect(x - radius + 2, y - radius + 2, 2, 2);
        ctx.fillRect(x + radius - 3, y + radius - 3, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  };

  drawPlayer = function drawPlayerWithStatusPixels() {
    originalDrawPlayer();
    if (!player) return;
    const x = screenX(player.x);
    const y = screenY(player.y);
    const hpRatio = Math.max(0, Math.min(1, player.hp / player.maxHp));
    const segments = 8;
    const filled = Math.ceil(hpRatio * segments);
    for (let index = 0; index < segments; index += 1) {
      ctx.fillStyle = index < filled ? (hpRatio < 0.3 ? PALETTE.red : PALETTE.green) : PALETTE.shadow;
      ctx.fillRect(x - 12 + index * 3, y - 17, 2, 2);
    }
    const armorPips = Math.min(5, Math.max(0, Math.ceil((player.armor || 0) / 2)));
    ctx.fillStyle = PALETTE.violetLight;
    for (let index = 0; index < armorPips; index += 1) ctx.fillRect(x - 12 + index * 3, y + 13, 2, 1);
    if (player.dashCooldown <= 0) {
      ctx.fillStyle = PALETTE.cyan;
      ctx.fillRect(x + 11, y + 10, 2, 2);
      ctx.fillRect(x + 12, y + 9, 1, 4);
    }
    if (player.nova >= 100 || player.novaTime > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(x - 14, y - 1, 2, 2);
      ctx.fillRect(x - 13, y - 2, 1, 4);
    }
  };

  endGame = function endGameWithDirector() {
    if (!victoryCompleted) sound.defeat?.();
    originalEndGame();
  };

  document.querySelector('#victory-restart-button')?.addEventListener('click', () => {
    hideOverlay(victoryScreen);
    startGame();
  });

  installAudioUpgrade();
  resetDirectorState(false);
})();