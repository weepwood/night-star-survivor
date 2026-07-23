(() => {
  const CONTRACT_TRIGGER_TIMES = [25, 65, 105];
  const CHOICE_SECONDS = 7;
  const RESULT_SECONDS = 2.4;
  const CHAIN_WINDOW_SECONDS = 2.4;
  const HUD_INTERVAL_SECONDS = 0.1;

  const finalResetGame = resetGame;
  const finalUpdate = update;
  const finalDamageEnemy = damageEnemy;
  const finalHurtPlayer = hurtPlayer;
  const finalGainXp = gainXp;
  const finalDash = dash;
  const finalSpawnEnemy = spawnEnemy;

  let triggerIndex = 0;
  let pendingChoice = false;
  let encounterState = 'idle';
  let choiceOptions = [];
  let choiceRemaining = 0;
  let activeContract = null;
  let contractRemaining = 0;
  let contractElapsed = 0;
  let contractProgress = 0;
  let contractFailedReason = '';
  let resultRemaining = 0;
  let failureThreatRemaining = 0;
  let starChain = 0;
  let starChainRemaining = 0;
  let permanentDamageMultiplier = 1;
  let permanentDamageTakenMultiplier = 1;
  let imprints = [];
  let resonances = new Set();
  let lastPlayerX = 0;
  let lastPlayerY = 0;
  let hudClock = 0;

  const TAG_INFO = {
    assault: { label: '猎杀', bonus: '伤害 +12%' },
    survival: { label: '守望', bonus: '承伤 -12%' },
    growth: { label: '采集', bonus: '磁吸 +25%，恢复 +0.35' },
    mobility: { label: '跃迁', bonus: '移速 +10%，冲刺恢复 +10%' },
    burst: { label: '爆发', bonus: '暴击 +7%' },
  };

  const CONTRACT_POOL = [
    {
      id: 'swarm-hunt',
      name: '星群猎杀',
      tag: 'assault',
      duration: 18,
      metric: 'kills',
      target: 18,
      objective: '18 秒内击败 18 名敌人。',
      risk: '敌人速度 +16%。',
      riskStats: { enemySpeed: 1.16 },
      reward: '永久伤害 +8%。',
      applyReward: () => { permanentDamageMultiplier *= 1.08; },
    },
    {
      id: 'overload-output',
      name: '过载输出',
      tag: 'burst',
      duration: 16,
      metric: 'damage',
      target: 900,
      objective: '16 秒内造成 900 点实际伤害。',
      risk: '受到伤害 +25%。',
      riskStats: { damageTaken: 1.25 },
      reward: '暴击率 +5%。',
      applyReward: () => { player.crit += 0.05; },
    },
    {
      id: 'silent-route',
      name: '无伤航路',
      tag: 'survival',
      duration: 14,
      metric: 'nohit',
      target: 14,
      objective: '14 秒内不受到任何伤害。',
      risk: '敌人生命 +18%。',
      riskStats: { enemyHp: 1.18 },
      reward: '护甲 +2，并恢复 20 点生命。',
      applyReward: () => {
        player.armor += 2;
        player.hp = Math.min(player.maxHp, player.hp + 20);
      },
    },
    {
      id: 'gravity-harvest',
      name: '引力采集',
      tag: 'growth',
      duration: 18,
      metric: 'xp',
      target: 55,
      objective: '18 秒内收集 55 点星尘经验。',
      risk: '敌人生命 +12%，速度 +8%。',
      riskStats: { enemyHp: 1.12, enemySpeed: 1.08 },
      reward: '磁吸范围 +18%，星爆能量 +30。',
      applyReward: () => {
        player.magnet *= 1.18;
        player.nova = Math.min(100, player.nova + 30);
      },
    },
    {
      id: 'elite-bounty',
      name: '星蚀悬赏',
      tag: 'assault',
      duration: 22,
      metric: 'elite',
      target: 1,
      objective: '22 秒内击败立即降临的精英敌人。',
      risk: '受到伤害 +18%，精英速度 +12%。',
      riskStats: { damageTaken: 1.18, enemySpeed: 1.12 },
      reward: '最大生命 +14，并恢复至至少 65%。',
      onStart: () => spawnEnemy(null, true),
      applyReward: () => {
        player.maxHp += 14;
        player.hp = Math.max(player.hp, player.maxHp * 0.65);
      },
    },
    {
      id: 'warp-drill',
      name: '星跃操练',
      tag: 'mobility',
      duration: 20,
      metric: 'dashes',
      target: 5,
      objective: '20 秒内完成 5 次有效冲刺。',
      risk: '敌人速度 +14%。',
      riskStats: { enemySpeed: 1.14 },
      reward: '移动速度 +8%，冲刺冷却 -8%。',
      applyReward: () => {
        player.speed *= 1.08;
        player.dashCooldownBase *= 0.92;
      },
    },
    {
      id: 'moving-constellation',
      name: '移动星座',
      tag: 'mobility',
      duration: 18,
      metric: 'distance',
      target: 850,
      objective: '18 秒内移动累计 850 距离。',
      risk: '受到伤害 +15%。',
      riskStats: { damageTaken: 1.15 },
      reward: '移动速度 +6%，星爆能量 +20。',
      applyReward: () => {
        player.speed *= 1.06;
        player.nova = Math.min(100, player.nova + 20);
      },
    },
    {
      id: 'last-light',
      name: '残光守望',
      tag: 'survival',
      duration: 16,
      metric: 'survive',
      target: 16,
      objective: '在高威胁星潮中坚持 16 秒。',
      risk: '新生成敌人生命 +10%、速度 +12%。',
      riskStats: { enemyHp: 1.10, enemySpeed: 1.12 },
      reward: '生命恢复 +0.55。',
      applyReward: () => { player.regen += 0.55; },
    },
    {
      id: 'nova-pressure',
      name: '新星压力',
      tag: 'growth',
      duration: 18,
      metric: 'nova',
      target: 35,
      objective: '18 秒内额外获得 35 点星爆能量。',
      risk: '敌人生命 +15%。',
      riskStats: { enemyHp: 1.15 },
      reward: '最大生命 +8，磁吸范围 +12%。',
      applyReward: () => {
        player.maxHp += 8;
        player.hp += 8;
        player.magnet *= 1.12;
      },
    },
  ];

  const terminal = document.createElement('section');
  terminal.id = 'cosmic-contract-terminal';
  terminal.className = 'cosmic-contract-terminal pixel-terminal';
  terminal.setAttribute('aria-live', 'polite');
  terminal.innerHTML = `
    <div class="contract-title-row">
      <span>星象契约</span>
      <small id="contract-state-label">待机</small>
    </div>
    <div class="contract-summary">
      <strong id="contract-title">下一次星象尚未降临</strong>
      <small id="contract-detail">风险任务会在 25、65、105 秒出现。</small>
    </div>
    <div id="contract-options" class="contract-options"></div>
    <div id="contract-progress-wrap" class="contract-progress-wrap">
      <div class="contract-progress-meta">
        <span id="contract-progress-text">0 / 0</span>
        <span id="contract-timer-text">0.0s</span>
      </div>
      <div class="contract-progress"><div id="contract-progress-bar"></div></div>
    </div>
    <div class="contract-chain-row">
      <span>星链倍率 <strong id="contract-chain-value">×1.00</strong></span>
      <span id="contract-chain-count">0 连锁</span>
    </div>
    <div id="contract-imprints" class="contract-imprints"><span class="contract-empty">尚未获得星印</span></div>`;
  document.querySelector('.stage-center')?.appendChild(terminal);

  const stateLabel = terminal.querySelector('#contract-state-label');
  const titleValue = terminal.querySelector('#contract-title');
  const detailValue = terminal.querySelector('#contract-detail');
  const optionsWrap = terminal.querySelector('#contract-options');
  const progressWrap = terminal.querySelector('#contract-progress-wrap');
  const progressText = terminal.querySelector('#contract-progress-text');
  const timerText = terminal.querySelector('#contract-timer-text');
  const progressBar = terminal.querySelector('#contract-progress-bar');
  const chainValue = terminal.querySelector('#contract-chain-value');
  const chainCount = terminal.querySelector('#contract-chain-count');
  const imprintsWrap = terminal.querySelector('#contract-imprints');
  const briefValue = null;

  function shuffle(list) {
    return [...list]
      .map((value) => ({ value, roll: Math.random() }))
      .sort((a, b) => a.roll - b.roll)
      .map((entry) => entry.value);
  }

  function currentRisk() {
    const risk = encounterState === 'active' ? (activeContract?.riskStats || {}) : {};
    return {
      damageTaken: (risk.damageTaken || 1) * (failureThreatRemaining > 0 ? 1.1 : 1),
      enemySpeed: (risk.enemySpeed || 1) * (failureThreatRemaining > 0 ? 1.12 : 1),
      enemyHp: risk.enemyHp || 1,
    };
  }

  function chainMultiplier() {
    if (starChain >= 50) return 1.35;
    if (starChain >= 25) return 1.22;
    if (starChain >= 10) return 1.10;
    return 1;
  }

  function chainLabel() {
    return `×${chainMultiplier().toFixed(2)}`;
  }

  function metricValue(contract = activeContract) {
    if (!contract) return 0;
    if (contract.metric === 'nohit' || contract.metric === 'survive') return contractElapsed;
    if (contract.metric === 'nova') return contractProgress;
    return contractProgress;
  }

  function metricDisplay(contract = activeContract) {
    if (!contract) return '0 / 0';
    const value = metricValue(contract);
    if (contract.metric === 'damage' || contract.metric === 'distance' || contract.metric === 'xp') {
      return `${Math.floor(value)} / ${contract.target}`;
    }
    if (contract.metric === 'nohit' || contract.metric === 'survive') {
      return `${value.toFixed(1)} / ${contract.target}s`;
    }
    return `${Math.floor(value)} / ${contract.target}`;
  }

  function renderImprints() {
    if (!imprints.length) {
      imprintsWrap.innerHTML = '<span class="contract-empty">尚未获得星印</span>';
      return;
    }
    const counts = imprints.reduce((map, tag) => map.set(tag, (map.get(tag) || 0) + 1), new Map());
    imprintsWrap.innerHTML = [...counts.entries()].map(([tag, count]) => {
      const active = resonances.has(tag);
      return `<span class="contract-imprint ${active ? 'resonant' : ''}" data-tag="${tag}"><b>${TAG_INFO[tag].label}</b><small>×${count}${active ? ' 共鸣' : ''}</small></span>`;
    }).join('');
  }

  function renderOptions() {
    optionsWrap.innerHTML = choiceOptions.map((contract, index) => `
      <button type="button" class="contract-option" data-contract-index="${index}">
        <span class="contract-key">${index + 4}</span>
        <span class="contract-tag">${TAG_INFO[contract.tag].label}</span>
        <strong>${contract.name}</strong>
        <small>${contract.objective}</small>
        <em>风险：${contract.risk}</em>
        <b>奖励：${contract.reward}</b>
      </button>`).join('');
  }

  function updateBrief() {
    if (!briefValue) return;
    if (encounterState === 'selecting') briefValue.textContent = `${Math.max(0, Math.ceil(choiceRemaining))}s 选择`;
    else if (encounterState === 'active') briefValue.textContent = `${Math.max(0, Math.ceil(contractRemaining))}s ${activeContract?.name || ''}`;
    else if (encounterState === 'result') briefValue.textContent = contractFailedReason ? '契约失败' : '星印获得';
    else if (triggerIndex < CONTRACT_TRIGGER_TIMES.length) briefValue.textContent = `${Math.max(0, Math.ceil(CONTRACT_TRIGGER_TIMES[triggerIndex] - (elapsed || 0)))}s`;
    else briefValue.textContent = '本局完成';
  }

  function renderTerminal() {
    const yielding = Boolean(choosing && encounterState === 'selecting');
    terminal.classList.toggle('visible', encounterState !== 'idle' || triggerIndex < CONTRACT_TRIGGER_TIMES.length);
    terminal.classList.toggle('selecting', encounterState === 'selecting');
    terminal.classList.toggle('active', encounterState === 'active');
    terminal.classList.toggle('result', encounterState === 'result');
    terminal.classList.toggle('yielding', yielding);

    if (encounterState === 'selecting') {
      stateLabel.textContent = yielding ? '等待构筑' : '选择中 · 4/5/6';
      titleValue.textContent = '选择一项星象契约';
      detailValue.textContent = yielding ? '升级构筑优先，完成后继续契约倒计时。' : '战斗不会暂停，超时将自动选择第一项。';
      progressWrap.hidden = true;
      renderOptions();
    } else if (encounterState === 'active' && activeContract) {
      stateLabel.textContent = `${TAG_INFO[activeContract.tag].label} · ACTIVE`;
      titleValue.textContent = activeContract.name;
      detailValue.textContent = `${activeContract.objective} 风险：${activeContract.risk}`;
      optionsWrap.innerHTML = '';
      progressWrap.hidden = false;
      progressText.textContent = metricDisplay();
      timerText.textContent = `${Math.max(0, contractRemaining).toFixed(1)}s`;
      const progress = Math.max(0, Math.min(1, metricValue() / Math.max(1, activeContract.target)));
      progressBar.style.width = `${Math.round(progress * 100)}%`;
    } else if (encounterState === 'result') {
      stateLabel.textContent = contractFailedReason ? 'FAILED' : 'COMPLETE';
      titleValue.textContent = contractFailedReason ? `${activeContract?.name || '契约'}失败` : `获得${TAG_INFO[activeContract?.tag]?.label || ''}星印`;
      detailValue.textContent = contractFailedReason
        ? `${contractFailedReason}。星潮威胁提高 10 秒。`
        : `${activeContract?.reward || ''} 同类星印达到 2 枚会触发额外共鸣。`;
      optionsWrap.innerHTML = '';
      progressWrap.hidden = true;
    } else {
      stateLabel.textContent = 'STANDBY';
      titleValue.textContent = triggerIndex < CONTRACT_TRIGGER_TIMES.length ? '下一次星象正在聚合' : '本局星象契约已结束';
      detailValue.textContent = triggerIndex < CONTRACT_TRIGGER_TIMES.length
        ? `将在 ${Math.max(0, Math.ceil(CONTRACT_TRIGGER_TIMES[triggerIndex] - (elapsed || 0)))} 秒后提供风险任务。`
        : '本局三次契约均已处理。';
      optionsWrap.innerHTML = '';
      progressWrap.hidden = true;
    }

    chainValue.textContent = chainLabel();
    chainCount.textContent = `${starChain} 连锁`;
    renderImprints();
    updateBrief();
  }

  function openChoice() {
    if (!running || triggerIndex >= CONTRACT_TRIGGER_TIMES.length || encounterState !== 'idle') return;
    pendingChoice = false;
    encounterState = 'selecting';
    choiceRemaining = CHOICE_SECONDS;
    choiceOptions = shuffle(CONTRACT_POOL).slice(0, 3);
    contractFailedReason = '';
    sound.objective?.();
    ui.statusMessage.textContent = '星象契约降临：按 4 / 5 / 6 选择风险任务。';
    renderTerminal();
  }

  function chooseContract(index) {
    if (encounterState !== 'selecting') return;
    const contract = choiceOptions[index] || choiceOptions[0];
    if (!contract) return;
    triggerIndex += 1;
    activeContract = contract;
    encounterState = 'active';
    contractRemaining = contract.duration;
    contractElapsed = 0;
    contractProgress = 0;
    contractFailedReason = '';
    lastPlayerX = Number(player?.x || 0);
    lastPlayerY = Number(player?.y || 0);
    contract.onStart?.();
    sound.synergy?.();
    ui.statusMessage.textContent = `接受契约：${contract.name}`;
    renderTerminal();
  }

  function applyResonance(tag) {
    if (resonances.has(tag)) return;
    const count = imprints.filter((entry) => entry === tag).length;
    if (count < 2) return;
    resonances.add(tag);
    if (tag === 'assault') permanentDamageMultiplier *= 1.12;
    else if (tag === 'survival') permanentDamageTakenMultiplier *= 0.88;
    else if (tag === 'growth') {
      player.magnet *= 1.25;
      player.regen += 0.35;
    } else if (tag === 'mobility') {
      player.speed *= 1.10;
      player.dashCooldownBase *= 0.90;
    } else if (tag === 'burst') player.crit += 0.07;
    sound.synergy?.();
    createParticle(player.x, player.y, PALETTE.gold, 30, 120, 0.75);
    ui.statusMessage.textContent = `星印共鸣：${TAG_INFO[tag].label} · ${TAG_INFO[tag].bonus}`;
  }

  function completeContract() {
    if (encounterState !== 'active' || !activeContract) return;
    activeContract.applyReward?.();
    imprints.push(activeContract.tag);
    applyResonance(activeContract.tag);
    encounterState = 'result';
    resultRemaining = RESULT_SECONDS;
    contractFailedReason = '';
    sound.objective?.();
    createParticle(player.x, player.y, PALETTE.cyan, 26, 100, 0.65);
    ui.statusMessage.textContent = `契约完成：${activeContract.name}，获得${TAG_INFO[activeContract.tag].label}星印。`;
    renderTerminal();
  }

  function failContract(reason = '未在时限内完成目标') {
    if (encounterState !== 'active' || !activeContract) return;
    encounterState = 'result';
    resultRemaining = RESULT_SECONDS;
    failureThreatRemaining = 10;
    contractFailedReason = reason;
    player.nova = Math.max(0, player.nova - 15);
    sound.playerHit?.();
    ui.statusMessage.textContent = `契约失败：${activeContract.name}。星潮威胁暂时提高。`;
    renderTerminal();
  }

  function maybeCompleteContract() {
    if (encounterState !== 'active' || !activeContract) return;
    if (metricValue() >= activeContract.target) completeContract();
  }

  function registerKill(enemy) {
    starChain = starChainRemaining > 0 ? starChain + 1 : 1;
    starChainRemaining = CHAIN_WINDOW_SECONDS;
    if (activeContract?.metric === 'kills') contractProgress += 1;
    if (activeContract?.metric === 'elite' && (enemy?.elite || enemy?.type === 'boss')) contractProgress += 1;
    if (activeContract?.metric === 'nova') contractProgress += enemy?.elite ? 9 : 2;
    if ([10, 25, 50].includes(starChain)) {
      sound.objective?.();
      createParticle(player.x, player.y, starChain >= 50 ? PALETTE.gold : PALETTE.cyan, 18 + Math.floor(starChain / 2), 90, 0.5);
      ui.statusMessage.textContent = `星链 ${starChain}：伤害倍率提升至 ${chainLabel()}。`;
    }
    maybeCompleteContract();
  }

  resetGame = function resetGameWithCosmicContracts() {
    finalResetGame();
    triggerIndex = 0;
    pendingChoice = false;
    encounterState = 'idle';
    choiceOptions = [];
    choiceRemaining = 0;
    activeContract = null;
    contractRemaining = 0;
    contractElapsed = 0;
    contractProgress = 0;
    contractFailedReason = '';
    resultRemaining = 0;
    failureThreatRemaining = 0;
    starChain = 0;
    starChainRemaining = 0;
    permanentDamageMultiplier = 1;
    permanentDamageTakenMultiplier = 1;
    imprints = [];
    resonances = new Set();
    lastPlayerX = Number(player?.x || 0);
    lastPlayerY = Number(player?.y || 0);
    hudClock = 0;
    renderTerminal();
  };

  damageEnemy = function damageEnemyWithCosmicContracts(enemy, rawDamage) {
    if (!enemy || !enemies.includes(enemy)) return finalDamageEnemy(enemy, rawDamage);
    const before = Math.max(0, Number(enemy.hp) || 0);
    const result = finalDamageEnemy(enemy, rawDamage * permanentDamageMultiplier * chainMultiplier());
    const after = Math.max(0, Number(enemy.hp) || 0);
    const dealt = Math.max(0, before - after);
    if (encounterState === 'active' && activeContract?.metric === 'damage') contractProgress += dealt;
    if (result) registerKill(enemy);
    maybeCompleteContract();
    return result;
  };

  hurtPlayer = function hurtPlayerWithCosmicContracts(amount) {
    const before = Number(player?.hp || 0);
    finalHurtPlayer(amount * permanentDamageTakenMultiplier * currentRisk().damageTaken);
    if (encounterState === 'active' && activeContract?.metric === 'nohit' && player && player.hp < before) {
      failContract('无伤航路中受到伤害');
    }
  };

  gainXp = function gainXpWithCosmicContracts(value) {
    if (encounterState === 'active' && activeContract?.metric === 'xp') contractProgress += Math.max(0, Number(value) || 0);
    finalGainXp(value);
    maybeCompleteContract();
  };

  dash = function dashWithCosmicContracts() {
    const beforeCooldown = Number(player?.dashCooldown || 0);
    finalDash();
    if (encounterState === 'active' && activeContract?.metric === 'dashes' && player?.dashCooldown > beforeCooldown) {
      contractProgress += 1;
      maybeCompleteContract();
    }
  };

  spawnEnemy = function spawnEnemyWithCosmicContracts(type = null, elite = false) {
    const beforeLength = enemies.length;
    const result = finalSpawnEnemy(type, elite);
    const risk = currentRisk();
    enemies.slice(beforeLength).forEach((enemy) => {
      enemy.speed *= risk.enemySpeed;
      enemy.hp *= risk.enemyHp;
      enemy.maxHp *= risk.enemyHp;
    });
    return result;
  };

  update = function updateWithCosmicContracts(dt) {
    finalUpdate(dt);
    if (!player) return;

    starChainRemaining = Math.max(0, starChainRemaining - dt);
    if (starChainRemaining <= 0) starChain = 0;
    failureThreatRemaining = Math.max(0, failureThreatRemaining - dt);

    if (encounterState === 'idle' && triggerIndex < CONTRACT_TRIGGER_TIMES.length && elapsed >= CONTRACT_TRIGGER_TIMES[triggerIndex]) {
      if (choosing) pendingChoice = true;
      else openChoice();
    }
    if (pendingChoice && encounterState === 'idle' && !choosing) openChoice();

    if (encounterState === 'selecting') {
      if (!choosing) choiceRemaining = Math.max(0, choiceRemaining - dt);
      if (choiceRemaining <= 0) chooseContract(0);
    } else if (encounterState === 'active' && activeContract) {
      contractRemaining = Math.max(0, contractRemaining - dt);
      contractElapsed += dt;
      if (activeContract.metric === 'distance') {
        const dx = Number(player.x || 0) - lastPlayerX;
        const dy = Number(player.y || 0) - lastPlayerY;
        contractProgress += Math.hypot(dx, dy);
      }
      lastPlayerX = Number(player.x || 0);
      lastPlayerY = Number(player.y || 0);
      if (contractRemaining <= 0) {
        if (metricValue() >= activeContract.target) completeContract();
        else failContract();
      } else maybeCompleteContract();
    } else if (encounterState === 'result') {
      resultRemaining = Math.max(0, resultRemaining - dt);
      if (resultRemaining <= 0) {
        encounterState = 'idle';
        activeContract = null;
        contractFailedReason = '';
      }
    }

    hudClock -= dt;
    if (hudClock <= 0) {
      hudClock = HUD_INTERVAL_SECONDS;
      renderTerminal();
    }
  };

  terminal.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-contract-index]');
    if (!button) return;
    chooseContract(Number(button.dataset.contractIndex));
  });

  window.addEventListener('keydown', (event) => {
    if (encounterState !== 'selecting' || choosing || paused) return;
    if (!['4', '5', '6'].includes(event.key)) return;
    event.preventDefault();
    chooseContract(Number(event.key) - 4);
  }, true);

  renderTerminal();
})();
