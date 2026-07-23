(() => {
  const DAMAGE_WINDOW_SECONDS = 5;
  const HUD_INTERVAL_SECONDS = 0.2;
  const CORE_UI_INTERVAL_MS = 100;
  const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  const itemCounts = new Map();
  const recentDamage = [];
  const recentlyRecordedItems = new Map();

  let totalDamage = 0;
  let peakDps = 0;
  let hitCount = 0;
  let telemetryClock = 0;
  let lastCoreUiAt = -Infinity;
  let telemetryPanel = null;
  let acquiredPanel = null;
  let acquiredStrip = null;
  let dpsValue = null;
  let totalValue = null;
  let peakValue = null;
  let hitValue = null;
  let itemList = null;

  function formatNumber(value) {
    const number = Math.max(0, Number(value) || 0);
    if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}M`;
    if (number >= 1_000) return `${(number / 1_000).toFixed(number >= 100_000 ? 0 : 1)}K`;
    return String(Math.round(number));
  }

  function resetTelemetryState() {
    totalDamage = 0;
    peakDps = 0;
    hitCount = 0;
    telemetryClock = 0;
    lastCoreUiAt = -Infinity;
    recentDamage.length = 0;
    itemCounts.clear();
    recentlyRecordedItems.clear();
    renderTelemetry(true);
    renderAcquiredItems(true);
  }

  function pruneRecentDamage(now = elapsed || 0) {
    const threshold = now - DAMAGE_WINDOW_SECONDS;
    while (recentDamage.length && recentDamage[0].time < threshold) recentDamage.shift();
  }

  function currentDps() {
    const now = elapsed || 0;
    pruneRecentDamage(now);
    const damage = recentDamage.reduce((sum, event) => sum + event.amount, 0);
    const divisor = Math.min(DAMAGE_WINDOW_SECONDS, Math.max(1, now));
    return damage / divisor;
  }

  function recordDamage(amount) {
    const dealt = Math.max(0, Number(amount) || 0);
    if (!dealt) return;
    totalDamage += dealt;
    hitCount += 1;
    recentDamage.push({ time: elapsed || 0, amount: dealt });
    const dps = currentDps();
    peakDps = Math.max(peakDps, dps);
  }

  function normalizeItemName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim();
  }

  function recordItem(name, category = '获得') {
    const itemName = normalizeItemName(name);
    if (!itemName) return;

    const now = performance.now();
    const dedupeKey = `${category}:${itemName}`;
    const previous = recentlyRecordedItems.get(dedupeKey) || 0;
    if (now - previous < 350) return;
    recentlyRecordedItems.set(dedupeKey, now);

    const current = itemCounts.get(itemName) || { count: 0, category };
    current.count += 1;
    current.category = category;
    current.lastAt = now;
    itemCounts.set(itemName, current);
    renderAcquiredItems();
  }

  function installTelemetryUi() {
    const topMetrics = document.querySelector('.top-metrics');
    if (topMetrics && !document.querySelector('#combat-output-chip')) {
      const chip = document.createElement('article');
      chip.id = 'combat-output-chip';
      chip.className = 'metric-chip combat-output-chip';
      chip.innerHTML = '<span>输出 / DPS</span><strong id="combat-dps-value">0</strong><small id="combat-total-value">总伤害 0</small>';
      topMetrics.appendChild(chip);
    }

    const stageRight = document.querySelector('.stage-right');
    if (stageRight && !document.querySelector('#telemetry-panel')) {
      telemetryPanel = document.createElement('div');
      telemetryPanel.id = 'telemetry-panel';
      telemetryPanel.className = 'pane-block telemetry-pane pixel-terminal';
      telemetryPanel.innerHTML = `
        <div class="pane-title-row">
          <span class="pane-title">输出终端</span>
          <small>最近 ${DAMAGE_WINDOW_SECONDS} 秒</small>
        </div>
        <div class="telemetry-grid">
          <span><small>当前 DPS</small><strong id="telemetry-dps">0</strong></span>
          <span><small>总伤害</small><strong id="telemetry-total">0</strong></span>
          <span><small>峰值 DPS</small><strong id="telemetry-peak">0</strong></span>
          <span><small>有效命中</small><strong id="telemetry-hits">0</strong></span>
        </div>`;
      stageRight.prepend(telemetryPanel);
    } else {
      telemetryPanel = document.querySelector('#telemetry-panel');
    }

    if (stageRight && !document.querySelector('#acquired-panel')) {
      acquiredPanel = document.createElement('div');
      acquiredPanel.id = 'acquired-panel';
      acquiredPanel.className = 'pane-block acquired-pane pixel-terminal';
      acquiredPanel.innerHTML = `
        <div class="pane-title-row">
          <span class="pane-title">本局道具</span>
          <small>获取记录</small>
        </div>
        <div id="acquired-item-list" class="acquired-item-list">
          <span class="empty-item">尚未获取道具</span>
        </div>`;
      const codex = stageRight.querySelector('#loot-codex');
      stageRight.insertBefore(acquiredPanel, codex || null);
    } else {
      acquiredPanel = document.querySelector('#acquired-panel');
    }

    const canvasShell = document.querySelector('.canvas-shell');
    if (canvasShell && !document.querySelector('#acquired-items-strip')) {
      acquiredStrip = document.createElement('div');
      acquiredStrip.id = 'acquired-items-strip';
      acquiredStrip.className = 'acquired-items-strip';
      acquiredStrip.setAttribute('aria-live', 'polite');
      acquiredStrip.innerHTML = '<span class="empty-item">道具记录待机</span>';
      canvasShell.appendChild(acquiredStrip);
    } else {
      acquiredStrip = document.querySelector('#acquired-items-strip');
    }

    dpsValue = document.querySelector('#telemetry-dps');
    totalValue = document.querySelector('#telemetry-total');
    peakValue = document.querySelector('#telemetry-peak');
    hitValue = document.querySelector('#telemetry-hits');
    itemList = document.querySelector('#acquired-item-list');
  }

  function renderTelemetry(force = false) {
    installTelemetryUi();
    if (!player && !force) return;
    const dps = currentDps();
    peakDps = Math.max(peakDps, dps);

    const compactDps = document.querySelector('#combat-dps-value');
    const compactTotal = document.querySelector('#combat-total-value');
    if (compactDps) compactDps.textContent = `${formatNumber(dps)} DPS`;
    if (compactTotal) compactTotal.textContent = `总伤害 ${formatNumber(totalDamage)}`;
    if (dpsValue) dpsValue.textContent = formatNumber(dps);
    if (totalValue) totalValue.textContent = formatNumber(totalDamage);
    if (peakValue) peakValue.textContent = formatNumber(peakDps);
    if (hitValue) hitValue.textContent = formatNumber(hitCount);
  }

  function itemMarkup(name, data) {
    const count = data.count > 1 ? ` ×${data.count}` : '';
    return `<span class="acquired-item" title="${data.category}：${name}"><i aria-hidden="true"></i><strong>${name}${count}</strong><small>${data.category}</small></span>`;
  }

  function renderAcquiredItems(force = false) {
    installTelemetryUi();
    if (!itemList && !acquiredStrip) return;
    const entries = [...itemCounts.entries()].sort((a, b) => (b[1].lastAt || 0) - (a[1].lastAt || 0));
    if (!entries.length) {
      if (itemList) itemList.innerHTML = '<span class="empty-item">尚未获取道具</span>';
      if (acquiredStrip) acquiredStrip.innerHTML = '<span class="empty-item">道具记录待机</span>';
      return;
    }

    if (itemList) itemList.innerHTML = entries.map(([name, data]) => itemMarkup(name, data)).join('');
    if (acquiredStrip) {
      acquiredStrip.innerHTML = entries.slice(0, 5).map(([name, data]) => {
        const count = data.count > 1 ? `×${data.count}` : '';
        return `<span class="acquired-strip-chip"><i aria-hidden="true"></i>${name}<b>${count}</b></span>`;
      }).join('');
    }
  }

  const originalResetGame = resetGame;
  resetGame = function resetGameWithTelemetry() {
    resetTelemetryState();
    originalResetGame();
    renderTelemetry(true);
  };

  const originalDamageEnemy = damageEnemy;
  damageEnemy = function damageEnemyWithTelemetry(enemy, rawDamage) {
    const before = Math.max(0, Number(enemy?.hp) || 0);
    const result = originalDamageEnemy(enemy, rawDamage);
    const after = Math.max(0, Number(enemy?.hp) || 0);
    recordDamage(Math.max(0, before - after));
    return result;
  };

  const originalUpdateUi = updateUi;
  updateUi = function stableUpdateUi(force = false) {
    const now = performance.now();
    if (force || now - lastCoreUiAt >= CORE_UI_INTERVAL_MS) {
      lastCoreUiAt = now;
      originalUpdateUi();
    }
  };

  const originalUpdate = update;
  update = function updateWithTelemetry(dt) {
    originalUpdate(dt);
    telemetryClock -= dt;
    if (telemetryClock <= 0) {
      telemetryClock = HUD_INTERVAL_SECONDS;
      renderTelemetry();
    }
  };

  const originalUpdateEffects = updateEffects;
  updateEffects = function updateStableEffects(dt) {
    originalUpdateEffects(dt);
    const reduced = Boolean(reducedMotionQuery?.matches);
    screenShake = Math.min(screenShake, reduced ? 0 : 3.2);
    flashAlpha = Math.min(flashAlpha, reduced ? 0.025 : 0.085);
  };

  const originalRender = render;
  render = function renderWithStableShake() {
    const rawShake = screenShake;
    const rawFlash = flashAlpha;
    if (reducedMotionQuery?.matches) {
      screenShake = 0;
      flashAlpha = Math.min(rawFlash, 0.025);
    } else {
      screenShake = rawShake >= 6 ? 2 : rawShake >= 2.4 ? 1 : 0;
      flashAlpha = Math.min(rawFlash, 0.085);
    }
    originalRender();
    screenShake = rawShake;
    flashAlpha = rawFlash;
  };

  const originalDrawPlayer = drawPlayer;
  drawPlayer = function drawStablePlayer() {
    if (!player) return originalDrawPlayer();
    const invulnerable = player.invulnerable;
    player.invulnerable = 0;
    originalDrawPlayer();
    player.invulnerable = invulnerable;

    if (invulnerable > 0) {
      const x = screenX(player.x);
      const y = screenY(player.y);
      ctx.fillStyle = PALETTE.cyan;
      ctx.fillRect(x - 11, y - 10, 3, 1);
      ctx.fillRect(x + 8, y - 10, 3, 1);
      ctx.fillRect(x - 11, y + 9, 3, 1);
      ctx.fillRect(x + 8, y + 9, 3, 1);
    }
  };

  const originalDrawEnemy = drawEnemy;
  drawEnemy = function drawStableEnemy(enemy) {
    const hitFlash = enemy.hitFlash;
    enemy.hitFlash = 0;
    originalDrawEnemy(enemy);
    enemy.hitFlash = hitFlash;

    if (hitFlash > 0 && isVisible(enemy.x, enemy.y, 24)) {
      const x = screenX(enemy.x);
      const y = screenY(enemy.y);
      const r = Math.max(5, Math.round(enemy.radius));
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(x - r - 2, y, 2, 1);
      ctx.fillRect(x + r + 1, y, 2, 1);
      ctx.fillRect(x, y - r - 2, 1, 2);
      ctx.fillRect(x, y + r + 1, 1, 2);
    }
  };

  document.addEventListener('click', (event) => {
    const card = event.target.closest?.('#upgrade-options .upgrade-card');
    if (!card) return;
    const name = card.querySelector('h3')?.textContent;
    const category = card.querySelector('.rarity-chip')?.textContent || '强化';
    setTimeout(() => recordItem(name, category), 0);
  }, true);

  const statusMessage = document.querySelector('#status-message');
  if (statusMessage) {
    const observer = new MutationObserver(() => {
      const text = statusMessage.textContent || '';
      const lootMatch = text.match(/^拾取：(.+)$/);
      const relicMatch = text.match(/^精英战利品：(.+)$/);
      const evolutionMatch = text.match(/^武器进化：(.+)$/);
      if (lootMatch) recordItem(lootMatch[1], '战场道具');
      if (relicMatch) recordItem(relicMatch[1], '精英遗物');
      if (evolutionMatch) recordItem(evolutionMatch[1], '武器进化');
    });
    observer.observe(statusMessage, { childList: true, characterData: true, subtree: true });
  }

  reducedMotionQuery?.addEventListener?.('change', () => document.body.classList.toggle('reduced-motion', reducedMotionQuery.matches));
  document.body.classList.toggle('reduced-motion', Boolean(reducedMotionQuery?.matches));

  installTelemetryUi();
  resetTelemetryState();
})();