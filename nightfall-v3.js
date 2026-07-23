(() => {
  const TIDE_MAX = 100;
  const OVERDRIVE_BASE_DURATION = 8;
  const OVERDRIVE_DAMAGE_MULTIPLIER = 1.55;
  const OVERDRIVE_DAMAGE_TAKEN = 0.78;
  const BOSS_BREAK_DURATION = 3;
  const BOSS_BREAK_DAMAGE_MULTIPLIER = 1.45;
  const HUD_INTERVAL = 0.08;
  const FEED_DURATION = 1.8;

  const finalResetGame = resetGame;
  const finalUpdate = update;
  const finalDamageEnemy = damageEnemy;
  const finalHurtPlayer = hurtPlayer;
  const finalDash = dash;
  const finalNova = nova;
  const finalDrawEffects = drawEffects;
  const finalEndGame = endGame;

  let tide = 0;
  let overdriveRemaining = 0;
  let tideReadyAnnounced = false;
  let combatIdle = 0;
  let hudClock = 0;
  let feedRemaining = 0;
  let burstDepth = 0;
  let shockwaves = [];
  let pendingBossReward = false;
  let rightTab = 'output';
  let leftTab = 'build';
  let mutations = new Set();
  let mutationValues = createMutationValues();
  let runStats = createRunStats();

  document.body.classList.add('nightfall-v3');

  const ribbon = document.createElement('section');
  ribbon.id = 'nightfall-ribbon';
  ribbon.setAttribute('aria-label', '夜幕战斗驾驶舱');
  ribbon.innerHTML = `
    <div class="nightfall-ribbon-side nightfall-ribbon-phase">
      <small>PHASE</small>
      <strong id="nightfall-phase-value">薄暮</strong>
      <span id="nightfall-time-value">00:00</span>
    </div>
    <div id="nightfall-boss-core" class="nightfall-boss-core" hidden>
      <div class="nightfall-boss-heading">
        <span id="nightfall-boss-name">星蚀首领</span>
        <strong id="nightfall-boss-hp-text">0 / 0</strong>
      </div>
      <div class="nightfall-boss-track"><div id="nightfall-boss-hp-bar"></div></div>
      <div class="nightfall-break-row">
        <small id="nightfall-break-label">破韧</small>
        <div class="nightfall-break-track"><div id="nightfall-break-bar"></div></div>
      </div>
    </div>
    <div class="nightfall-ribbon-side nightfall-ribbon-objective">
      <small>OBJECTIVE</small>
      <strong id="nightfall-objective-value">等待夜幕</strong>
      <span id="nightfall-pressure-value">威胁稳定</span>
    </div>`;
  document.querySelector('.stage-center')?.appendChild(ribbon);

  const dock = document.createElement('section');
  dock.id = 'nightfall-ability-dock';
  dock.setAttribute('aria-label', '主动技能与夜潮超载');
  dock.innerHTML = `
    <button type="button" class="nightfall-ability" id="nightfall-dash-button" aria-label="使用冲刺">
      <kbd>SPACE</kbd><span>星跃</span><strong id="nightfall-dash-state">READY</strong>
    </button>
    <button type="button" class="nightfall-ability nightfall-ability-primary" id="nightfall-overdrive-button" aria-label="使用夜潮超载">
      <kbd>E</kbd><span>夜潮超载</span><strong id="nightfall-tide-value">0%</strong>
      <i class="nightfall-tide-track" aria-hidden="true"><b id="nightfall-tide-bar"></b></i>
    </button>
    <button type="button" class="nightfall-ability" id="nightfall-nova-button" aria-label="释放星爆">
      <kbd>Q</kbd><span>星爆</span><strong id="nightfall-nova-state">0%</strong>
    </button>`;
  document.querySelector('.stage-center')?.appendChild(dock);

  const feed = document.createElement('div');
  feed.id = 'nightfall-combat-feed';
  feed.setAttribute('aria-live', 'polite');
  document.querySelector('.stage-center')?.appendChild(feed);

  const mutationStrip = document.createElement('div');
  mutationStrip.id = 'nightfall-mutation-strip';
  mutationStrip.innerHTML = '<span>星蚀遗产：尚未获得</span>';
  document.querySelector('.build-pane')?.appendChild(mutationStrip);

  const phaseValue = ribbon.querySelector('#nightfall-phase-value');
  const timeValue = ribbon.querySelector('#nightfall-time-value');
  const bossCore = ribbon.querySelector('#nightfall-boss-core');
  const bossNameValue = ribbon.querySelector('#nightfall-boss-name');
  const bossHpText = ribbon.querySelector('#nightfall-boss-hp-text');
  const bossHpBar = ribbon.querySelector('#nightfall-boss-hp-bar');
  const breakLabel = ribbon.querySelector('#nightfall-break-label');
  const breakBar = ribbon.querySelector('#nightfall-break-bar');
  const objectiveValue = ribbon.querySelector('#nightfall-objective-value');
  const pressureValue = ribbon.querySelector('#nightfall-pressure-value');
  const tideValue = dock.querySelector('#nightfall-tide-value');
  const tideBar = dock.querySelector('#nightfall-tide-bar');
  const dashState = dock.querySelector('#nightfall-dash-state');
  const novaState = dock.querySelector('#nightfall-nova-state');
  const overdriveButton = dock.querySelector('#nightfall-overdrive-button');

  function createMutationValues() {
    return {
      burstRadius: 1,
      burstDamage: 1,
      overdriveDuration: 0,
      overdriveDamage: 0,
      overdriveKillHeal: 0,
      outsideDamageTaken: 1,
      dashTide: 0,
      criticalTide: 0,
      lowHpTide: 1,
      lowHpDamageTaken: 1,
    };
  }

  function createRunStats() {
    return {
      damage: 0,
      overdrives: 0,
      bursts: 0,
      burstKills: 0,
      bossBreaks: 0,
      maxTide: 0,
      maxBurstTargets: 0,
    };
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
  }

  function announce(message, tone = 'normal') {
    feed.textContent = message;
    feed.dataset.tone = tone;
    feed.classList.remove('visible');
    void feed.offsetWidth;
    feed.classList.add('visible');
    feedRemaining = FEED_DURATION;
  }

  function addTide(amount, reason = 'combat') {
    if (!running || !player || overdriveRemaining > 0) return;
    const hpRatio = player.maxHp ? player.hp / player.maxHp : 1;
    const lowHpBonus = hpRatio < 0.35 ? mutationValues.lowHpTide : 1;
    const gain = Math.max(0, Number(amount) || 0) * lowHpBonus;
    if (!gain) return;
    tide = Math.min(TIDE_MAX, tide + gain);
    runStats.maxTide = Math.max(runStats.maxTide, tide);
    combatIdle = 0;
    if (tide >= TIDE_MAX && !tideReadyAnnounced) {
      tideReadyAnnounced = true;
      announce('夜潮已满 · 按 E 引爆超载', 'ready');
      sound.objective?.();
    }
    if (reason === 'dash') createParticle(player.x, player.y, PALETTE.cyan, 8, 70, 0.28);
  }

  function clearNearbyEnemyProjectiles(radius = 145) {
    if (!player) return;
    projectiles = projectiles.filter((projectile) => {
      if (projectile.kind !== 'enemy') return true;
      return Math.hypot(projectile.x - player.x, projectile.y - player.y) > radius;
    });
  }

  function activateOverdrive() {
    if (!running || paused || !player || tide < TIDE_MAX || overdriveRemaining > 0) return false;
    tide = 0;
    tideReadyAnnounced = false;
    overdriveRemaining = OVERDRIVE_BASE_DURATION + mutationValues.overdriveDuration;
    runStats.overdrives += 1;
    player.invulnerable = Math.max(player.invulnerable, 0.42);
    clearNearbyEnemyProjectiles();
    shockwaves.push({ x: player.x, y: player.y, life: 0.75, maxLife: 0.75, radius: 128, tone: 'overdrive' });
    createParticle(player.x, player.y, PALETTE.cyan, 52, 165, 0.86);
    document.body.classList.add('nightfall-overdrive-active');
    announce('NIGHTFALL OVERDRIVE · 连锁处决启动', 'overdrive');
    sound.nova?.();
    return true;
  }

  function endOverdrive() {
    if (overdriveRemaining > 0) return;
    document.body.classList.remove('nightfall-overdrive-active');
  }

  function triggerBossBreak(enemy) {
    if (!enemy || enemy.type !== 'boss' || enemy.nightfallBreakTime > 0) return;
    enemy.nightfallBreakCharge = 0;
    enemy.nightfallBreakTime = BOSS_BREAK_DURATION;
    enemy.nightfallOriginalSpeed = enemy.nightfallOriginalSpeed || enemy.speed;
    enemy.speed = 0;
    enemy.attackClock = Math.max(enemy.attackClock || 0, BOSS_BREAK_DURATION);
    projectiles = projectiles.filter((projectile) => projectile.kind !== 'enemy');
    runStats.bossBreaks += 1;
    addTide(15, 'break');
    shockwaves.push({ x: enemy.x, y: enemy.y, life: 0.7, maxLife: 0.7, radius: 96, tone: 'break' });
    createParticle(enemy.x, enemy.y, PALETTE.gold, 42, 145, 0.72);
    announce('首领破韧 · 3 秒处决窗口', 'break');
    sound.critical?.();
  }

  function updateBossBreaks(dt) {
    for (const enemy of enemies) {
      if (enemy.type !== 'boss') continue;
      enemy.nightfallBreakCharge = Math.max(0, Number(enemy.nightfallBreakCharge) || 0);
      enemy.nightfallBreakIdle = Math.max(0, (Number(enemy.nightfallBreakIdle) || 0) - dt);
      if (enemy.nightfallBreakTime > 0) {
        enemy.nightfallBreakTime = Math.max(0, enemy.nightfallBreakTime - dt);
        enemy.speed = 0;
        enemy.attackClock = Math.max(enemy.attackClock || 0, enemy.nightfallBreakTime + 0.1);
        if (enemy.nightfallBreakTime <= 0 && enemy.nightfallOriginalSpeed) {
          enemy.speed = enemy.nightfallOriginalSpeed;
          enemy.nightfallOriginalSpeed = 0;
          announce('首领恢复行动', 'warning');
        }
      } else if (enemy.nightfallBreakIdle <= 0 && enemy.nightfallBreakCharge > 0) {
        enemy.nightfallBreakCharge = Math.max(0, enemy.nightfallBreakCharge - 14 * dt);
      }
    }
  }

  function createKillBurst(sourceEnemy) {
    if (!sourceEnemy || overdriveRemaining <= 0 || burstDepth >= 2) return;
    const radius = 54 * mutationValues.burstRadius;
    const baseDamage = (18 + (player?.level || 1) * 2.6 + Math.min(36, (sourceEnemy.maxHp || 0) * 0.025)) * mutationValues.burstDamage;
    const targets = enemies
      .filter((enemy) => enemy !== sourceEnemy && Math.hypot(enemy.x - sourceEnemy.x, enemy.y - sourceEnemy.y) <= radius)
      .sort((a, b) => Math.hypot(a.x - sourceEnemy.x, a.y - sourceEnemy.y) - Math.hypot(b.x - sourceEnemy.x, b.y - sourceEnemy.y))
      .slice(0, 8);
    if (!targets.length) return;

    runStats.bursts += 1;
    runStats.maxBurstTargets = Math.max(runStats.maxBurstTargets, targets.length);
    shockwaves.push({ x: sourceEnemy.x, y: sourceEnemy.y, life: 0.34, maxLife: 0.34, radius, tone: 'burst' });
    createParticle(sourceEnemy.x, sourceEnemy.y, PALETTE.violetLight, 18, 118, 0.48);

    burstDepth += 1;
    try {
      for (const target of targets) {
        if (!enemies.includes(target)) continue;
        const killed = damageEnemy(target, baseDamage);
        if (killed) runStats.burstKills += 1;
      }
    } finally {
      burstDepth -= 1;
    }
  }

  const MUTATION_POOL = [
    {
      id: 'fracture-engine',
      name: '裂变引擎',
      type: '首领遗产',
      rarity: 'legendary',
      icon: '✹',
      description: '超载击杀爆炸范围提高 35%，爆炸伤害提高 40%。',
      apply: () => {
        mutations.add('fracture-engine');
        mutationValues.burstRadius *= 1.35;
        mutationValues.burstDamage *= 1.4;
        onMutationApplied('裂变引擎');
      },
    },
    {
      id: 'singularity-heart',
      name: '奇点心脏',
      type: '首领遗产',
      rarity: 'legendary',
      icon: '●',
      description: '夜潮超载持续时间 +3 秒，超载伤害额外提高 18%。',
      apply: () => {
        mutations.add('singularity-heart');
        mutationValues.overdriveDuration += 3;
        mutationValues.overdriveDamage += 0.18;
        onMutationApplied('奇点心脏');
      },
    },
    {
      id: 'crimson-reactor',
      name: '猩红反应堆',
      type: '首领遗产',
      rarity: 'legendary',
      icon: '◆',
      description: '超载击杀恢复 1.2 生命；非超载期间承伤提高 8%。',
      apply: () => {
        mutations.add('crimson-reactor');
        mutationValues.overdriveKillHeal += 1.2;
        mutationValues.outsideDamageTaken *= 1.08;
        onMutationApplied('猩红反应堆');
      },
    },
    {
      id: 'quicksilver-drive',
      name: '水银星跃',
      type: '首领遗产',
      rarity: 'legendary',
      icon: '»',
      description: '冲刺冷却缩短 18%，每次有效冲刺获得 10 点夜潮。',
      apply: () => {
        mutations.add('quicksilver-drive');
        player.dashCooldownBase *= 0.82;
        mutationValues.dashTide += 10;
        onMutationApplied('水银星跃');
      },
    },
    {
      id: 'critical-mass',
      name: '临界质量',
      type: '首领遗产',
      rarity: 'legendary',
      icon: '✦',
      description: '暴击额外获得 3 点夜潮，并强化暴击冲击反馈。',
      apply: () => {
        mutations.add('critical-mass');
        mutationValues.criticalTide += 3;
        player.crit += 0.04;
        onMutationApplied('临界质量');
      },
    },
    {
      id: 'last-light-protocol',
      name: '残光协议',
      type: '首领遗产',
      rarity: 'legendary',
      icon: '▣',
      description: '生命低于 35% 时夜潮获取 +55%，受到伤害降低 15%。',
      apply: () => {
        mutations.add('last-light-protocol');
        mutationValues.lowHpTide *= 1.55;
        mutationValues.lowHpDamageTaken *= 0.85;
        onMutationApplied('残光协议');
      },
    },
  ];

  function onMutationApplied(name) {
    renderMutationStrip();
    announce(`星蚀遗产接入 · ${name}`, 'mutation');
    sound.synergy?.();
  }

  function renderMutationStrip() {
    if (!mutations.size) {
      mutationStrip.innerHTML = '<span>星蚀遗产：尚未获得</span>';
      return;
    }
    const names = MUTATION_POOL.filter((entry) => mutations.has(entry.id)).map((entry) => entry.name);
    mutationStrip.innerHTML = names.map((name) => `<span class="nightfall-mutation-chip">${name}</span>`).join('');
  }

  function queueBossMutationReward() {
    if (!running || pendingBossReward) return;
    const available = MUTATION_POOL.filter((entry) => !mutations.has(entry.id));
    if (!available.length) return;
    pendingBossReward = true;
    queueMicrotask(() => {
      pendingBossReward = false;
      if (!running) return;
      openUpgrade('选择一项星蚀遗产', available);
      announce('首领遗产可用 · 战斗仍在继续', 'mutation');
    });
  }

  function installPanelTabs() {
    const stageRight = document.querySelector('.stage-right');
    if (stageRight && !stageRight.querySelector('.nightfall-panel-tabs')) {
      const nav = document.createElement('nav');
      nav.className = 'nightfall-panel-tabs';
      nav.setAttribute('aria-label', '右侧信息面板');
      nav.innerHTML = `
        <button type="button" data-nightfall-right-tab="output">输出</button>
        <button type="button" data-nightfall-right-tab="items">道具</button>
        <button type="button" data-nightfall-right-tab="codex">图鉴</button>`;
      stageRight.prepend(nav);
      nav.addEventListener('click', (event) => {
        const button = event.target.closest?.('[data-nightfall-right-tab]');
        if (!button) return;
        rightTab = button.dataset.nightfallRightTab;
        renderPanelTabs();
      });
    }

    const stageLeft = document.querySelector('.stage-left');
    if (stageLeft && !stageLeft.querySelector('.nightfall-left-tabs')) {
      const nav = document.createElement('nav');
      nav.className = 'nightfall-left-tabs';
      nav.setAttribute('aria-label', '构筑信息面板');
      nav.innerHTML = `
        <button type="button" data-nightfall-left-tab="build">构筑</button>
        <button type="button" data-nightfall-left-tab="synergy">星契</button>`;
      const buildPane = stageLeft.querySelector('.build-pane');
      stageLeft.insertBefore(nav, buildPane || null);
      nav.addEventListener('click', (event) => {
        const button = event.target.closest?.('[data-nightfall-left-tab]');
        if (!button) return;
        leftTab = button.dataset.nightfallLeftTab;
        renderPanelTabs();
      });
    }
    renderPanelTabs();
  }

  function renderPanelTabs() {
    const stageRight = document.querySelector('.stage-right');
    if (stageRight) {
      const panels = {
        output: stageRight.querySelector('#telemetry-panel'),
        items: stageRight.querySelector('#acquired-panel'),
        codex: stageRight.querySelector('#loot-codex'),
      };
      Object.entries(panels).forEach(([key, panel]) => panel?.classList.toggle('nightfall-tab-active', key === rightTab));
      stageRight.querySelectorAll('[data-nightfall-right-tab]').forEach((button) => {
        const active = button.dataset.nightfallRightTab === rightTab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    const stageLeft = document.querySelector('.stage-left');
    if (stageLeft) {
      stageLeft.querySelector('.build-pane')?.classList.toggle('nightfall-tab-active', leftTab === 'build');
      stageLeft.querySelector('.synergy-pane')?.classList.toggle('nightfall-tab-active', leftTab === 'synergy');
      stageLeft.querySelectorAll('[data-nightfall-left-tab]').forEach((button) => {
        const active = button.dataset.nightfallLeftTab === leftTab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }
  }

  function enhanceStartScreen() {
    const panel = document.querySelector('#start-screen .start-panel');
    if (!panel || panel.dataset.nightfallEnhanced === 'true') return;
    panel.dataset.nightfallEnhanced = 'true';
    panel.querySelector('h2').textContent = '选择守夜核心';
    const copy = panel.querySelector('.panel-copy');
    if (copy) copy.textContent = '在三轮星蚀中构筑武器、完成风险契约、击破首领韧性，并用夜潮超载制造连锁处决。';

    const heroDetails = {
      astrologer: { role: '爆发核心', stats: ['火力 5', '机动 3', '生存 2'] },
      warden: { role: '破阵核心', stats: ['火力 3', '机动 2', '生存 5'] },
      ranger: { role: '连击核心', stats: ['火力 4', '机动 5', '生存 3'] },
    };
    panel.querySelectorAll('.hero-card').forEach((card) => {
      const info = heroDetails[card.dataset.hero];
      if (!info || card.querySelector('.nightfall-hero-role')) return;
      const role = document.createElement('span');
      role.className = 'nightfall-hero-role';
      role.textContent = info.role;
      card.prepend(role);
      const stats = document.createElement('span');
      stats.className = 'nightfall-hero-stats';
      stats.innerHTML = info.stats.map((entry) => `<i>${entry}</i>`).join('');
      card.appendChild(stats);
    });

    const promise = document.createElement('section');
    promise.className = 'nightfall-run-promise';
    promise.innerHTML = `
      <span><b>01</b> 击败三名星蚀首领</span>
      <span><b>02</b> 完成风险契约获得永久星印</span>
      <span><b>03</b> 蓄满夜潮后按 E 进入超载</span>`;
    panel.querySelector('.difficulty-field')?.before(promise);

    const hints = panel.querySelector('.control-hints');
    if (hints && ![...hints.children].some((node) => node.textContent.includes('夜潮'))) {
      const hint = document.createElement('span');
      hint.textContent = 'E 夜潮超载';
      hints.appendChild(hint);
    }
  }

  function currentBoss() {
    return enemies.find((enemy) => enemy.type === 'boss') || null;
  }

  function renderHud() {
    installPanelTabs();
    enhanceStartScreen();
    if (!player) return;

    phaseValue.textContent = PHASE_NAMES[Math.min(PHASE_NAMES.length - 1, phase)] || '无光';
    timeValue.textContent = formatTime(elapsed);
    objectiveValue.textContent = document.querySelector('#objective-brief')?.textContent || '推进夜幕';
    pressureValue.textContent = `敌群 ${enemies.length} · ${overdriveRemaining > 0 ? '超载中' : tide >= TIDE_MAX ? '超载就绪' : '威胁追踪'}`;

    tideValue.textContent = overdriveRemaining > 0 ? `${overdriveRemaining.toFixed(1)}s` : `${Math.floor(tide)}%`;
    tideBar.style.width = `${overdriveRemaining > 0 ? 100 : Math.max(0, Math.min(100, tide))}%`;
    overdriveButton.classList.toggle('ready', tide >= TIDE_MAX && overdriveRemaining <= 0);
    overdriveButton.classList.toggle('active', overdriveRemaining > 0);
    dashState.textContent = player.dashCooldown <= 0 ? 'READY' : `${player.dashCooldown.toFixed(1)}s`;
    novaState.textContent = player.novaTime > 0 ? 'ACTIVE' : `${Math.floor(player.nova || 0)}%`;

    const boss = currentBoss();
    bossCore.hidden = !boss;
    if (boss) {
      const hpRatio = boss.maxHp ? Math.max(0, boss.hp / boss.maxHp) : 0;
      const breakRatio = boss.nightfallBreakTime > 0 ? 1 : Math.max(0, Math.min(1, (boss.nightfallBreakCharge || 0) / 100));
      bossNameValue.textContent = document.querySelector('#boss-name')?.textContent || '星蚀首领';
      bossHpText.textContent = `${Math.max(0, Math.ceil(boss.hp))} / ${Math.ceil(boss.maxHp)}`;
      bossHpBar.style.width = `${Math.round(hpRatio * 100)}%`;
      breakBar.style.width = `${Math.round(breakRatio * 100)}%`;
      breakLabel.textContent = boss.nightfallBreakTime > 0 ? `破韧 ${boss.nightfallBreakTime.toFixed(1)}s` : '破韧';
      bossCore.classList.toggle('broken', boss.nightfallBreakTime > 0);
    }

    if (feedRemaining > 0) {
      feedRemaining = Math.max(0, feedRemaining - HUD_INTERVAL);
      if (feedRemaining <= 0) feed.classList.remove('visible');
    }
  }

  function updateShockwaves(dt) {
    shockwaves.forEach((wave) => { wave.life -= dt; });
    shockwaves = shockwaves.filter((wave) => wave.life > 0);
  }

  function drawNightfallShockwaves() {
    for (const wave of shockwaves) {
      if (!isVisible(wave.x, wave.y, wave.radius + 10)) continue;
      const progress = 1 - Math.max(0, wave.life / wave.maxLife);
      const radius = Math.max(4, Math.round(wave.radius * progress));
      const x = screenX(wave.x);
      const y = screenY(wave.y);
      ctx.globalAlpha = Math.max(0, wave.life / wave.maxLife) * 0.8;
      ctx.strokeStyle = wave.tone === 'break' ? PALETTE.gold : wave.tone === 'burst' ? PALETTE.violetLight : PALETTE.cyan;
      ctx.lineWidth = wave.tone === 'overdrive' ? 3 : 2;
      ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
      if (wave.tone === 'overdrive') {
        ctx.strokeRect(x - Math.max(2, radius - 6), y - Math.max(2, radius - 6), Math.max(4, (radius - 6) * 2), Math.max(4, (radius - 6) * 2));
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  function finalScore() {
    const mutationScore = mutations.size * 650;
    const executionScore = runStats.overdrives * 520 + runStats.bursts * 45 + runStats.burstKills * 90;
    const bossScore = runStats.bossBreaks * 760;
    return Math.max(0, Math.round(runStats.damage * 0.18 + (player?.kills || 0) * 16 + mutationScore + executionScore + bossScore));
  }

  function scoreRank(score) {
    if (score >= 26000) return 'S';
    if (score >= 18000) return 'A';
    if (score >= 11000) return 'B';
    return 'C';
  }

  function renderRunSummary(container) {
    if (!container || container.querySelector('.nightfall-run-summary')) return;
    const score = finalScore();
    const summary = document.createElement('section');
    summary.className = 'nightfall-run-summary';
    summary.innerHTML = `
      <div><small>夜幕评级</small><strong>${scoreRank(score)}</strong></div>
      <div><small>处决积分</small><strong>${score.toLocaleString()}</strong></div>
      <div><small>超载次数</small><strong>${runStats.overdrives}</strong></div>
      <div><small>首领破韧</small><strong>${runStats.bossBreaks}</strong></div>
      <div><small>连锁击杀</small><strong>${runStats.burstKills}</strong></div>
      <div><small>星蚀遗产</small><strong>${mutations.size}</strong></div>`;
    container.querySelector('button')?.before(summary);
  }

  const resultObserver = new MutationObserver(() => {
    const victory = document.querySelector('#victory-screen.visible .victory-panel');
    const defeat = document.querySelector('#game-over-screen.visible .game-over-panel');
    if (victory) renderRunSummary(victory);
    if (defeat) renderRunSummary(defeat);
  });
  const victoryOverlay = document.querySelector('#victory-screen');
  const defeatOverlay = document.querySelector('#game-over-screen');
  if (victoryOverlay) resultObserver.observe(victoryOverlay, { attributes: true, attributeFilter: ['class'] });
  if (defeatOverlay) resultObserver.observe(defeatOverlay, { attributes: true, attributeFilter: ['class'] });

  resetGame = function resetGameWithNightfallV3() {
    finalResetGame();
    tide = 0;
    overdriveRemaining = 0;
    tideReadyAnnounced = false;
    combatIdle = 0;
    hudClock = 0;
    feedRemaining = 0;
    burstDepth = 0;
    shockwaves = [];
    pendingBossReward = false;
    mutations = new Set();
    mutationValues = createMutationValues();
    runStats = createRunStats();
    rightTab = 'output';
    leftTab = 'build';
    document.body.classList.remove('nightfall-overdrive-active');
    document.querySelectorAll('.nightfall-run-summary').forEach((node) => node.remove());
    renderMutationStrip();
    renderPanelTabs();
    renderHud();
  };

  damageEnemy = function damageEnemyWithNightfallV3(enemy, rawDamage) {
    if (!enemy || !enemies.includes(enemy)) return finalDamageEnemy(enemy, rawDamage);
    const beforeHp = Math.max(0, Number(enemy.hp) || 0);
    const numbersBefore = numbers.length;
    let multiplier = 1;
    if (overdriveRemaining > 0) multiplier *= OVERDRIVE_DAMAGE_MULTIPLIER + mutationValues.overdriveDamage;
    if (enemy.nightfallBreakTime > 0) multiplier *= BOSS_BREAK_DAMAGE_MULTIPLIER;

    const result = finalDamageEnemy(enemy, rawDamage * multiplier);
    const afterHp = Math.max(0, Number(enemy.hp) || 0);
    const dealt = Math.max(0, beforeHp - afterHp);
    if (!dealt) return result;

    runStats.damage += dealt;
    const latestNumber = numbers.length > numbersBefore ? numbers[numbers.length - 1] : null;
    const critical = Boolean(latestNumber?.critical);
    addTide(Math.min(2.2, dealt * 0.0045) + (critical ? mutationValues.criticalTide : 0), critical ? 'critical' : 'damage');

    if (enemy.type === 'boss' && !result) {
      const threshold = Math.max(1, enemy.maxHp * 0.24);
      enemy.nightfallBreakCharge = Math.min(100, (enemy.nightfallBreakCharge || 0) + dealt / threshold * 100);
      enemy.nightfallBreakIdle = 1.5;
      if (enemy.nightfallBreakCharge >= 100) triggerBossBreak(enemy);
    }

    if (result) {
      addTide(enemy.type === 'boss' ? 18 : enemy.elite ? 7 : 2.2, 'kill');
      if (overdriveRemaining > 0) {
        player.hp = Math.min(player.maxHp, player.hp + mutationValues.overdriveKillHeal);
        createKillBurst(enemy);
      }
      if (enemy.type === 'boss' && running) queueBossMutationReward();
    }
    return result;
  };

  hurtPlayer = function hurtPlayerWithNightfallV3(amount) {
    let scaled = amount;
    const hpRatio = player?.maxHp ? player.hp / player.maxHp : 1;
    if (overdriveRemaining > 0) scaled *= OVERDRIVE_DAMAGE_TAKEN;
    else scaled *= mutationValues.outsideDamageTaken;
    if (hpRatio < 0.35) scaled *= mutationValues.lowHpDamageTaken;
    finalHurtPlayer(scaled);
  };

  dash = function dashWithNightfallV3() {
    const before = Number(player?.dashCooldown || 0);
    finalDash();
    if (player && player.dashCooldown > before && mutationValues.dashTide > 0) addTide(mutationValues.dashTide, 'dash');
  };

  nova = function novaWithNightfallV3() {
    const before = Number(player?.nova || 0);
    finalNova();
    if (before >= 100 && player?.nova === 0 && overdriveRemaining > 0) {
      overdriveRemaining += 0.8;
      announce('星爆共振 · 超载延长 0.8 秒', 'overdrive');
    }
  };

  update = function updateWithNightfallV3(dt) {
    finalUpdate(dt);
    if (!player) return;

    combatIdle += dt;
    if (overdriveRemaining > 0) {
      overdriveRemaining = Math.max(0, overdriveRemaining - dt);
      player.dashCooldown = Math.max(0, player.dashCooldown - dt * 0.48);
      if (overdriveRemaining <= 0) {
        endOverdrive();
        announce('夜潮超载结束 · 重新积蓄处决能量', 'normal');
      }
    } else if (combatIdle > 6 && tide > 0 && tide < TIDE_MAX) {
      tide = Math.max(0, tide - dt * 1.25);
      if (tide < TIDE_MAX) tideReadyAnnounced = false;
    }

    updateBossBreaks(dt);
    updateShockwaves(dt);
    hudClock -= dt;
    if (hudClock <= 0) {
      hudClock = HUD_INTERVAL;
      renderHud();
    }
  };

  drawEffects = function drawEffectsWithNightfallV3() {
    finalDrawEffects();
    drawNightfallShockwaves();
  };

  endGame = function endGameWithNightfallV3() {
    finalEndGame();
    queueMicrotask(() => renderRunSummary(document.querySelector('#game-over-screen .game-over-panel')));
  };

  dock.querySelector('#nightfall-dash-button')?.addEventListener('click', () => dash());
  dock.querySelector('#nightfall-nova-button')?.addEventListener('click', () => nova());
  overdriveButton?.addEventListener('click', () => activateOverdrive());

  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.key.toLowerCase() !== 'e') return;
    if (!running || paused) return;
    event.preventDefault();
    activateOverdrive();
  }, true);

  const panelObserver = new MutationObserver((mutationsList) => {
    if (mutationsList.some((mutation) => mutation.addedNodes.length)) installPanelTabs();
  });
  panelObserver.observe(document.body, { childList: true, subtree: true });

  installPanelTabs();
  enhanceStartScreen();
  renderMutationStrip();
  renderHud();
})();