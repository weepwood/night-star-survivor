(() => {
  const body = document.body;
  const TOOLTIP_SELECTOR = [
    '.metric-chip',
    '.player-status-grid > span',
    '.bar-row',
    '#status-message',
    '.mission-pane',
    '.objective-stage',
    '.build-chip',
    '.synergy-chip',
    '.telemetry-grid > span',
    '.acquired-item',
    '.loot-entry',
    '.active-buffs > span',
    '.live-upgrade-meta > span',
    '.live-upgrade-card',
    '.contract-summary',
    '.contract-option',
    '.contract-chain-row',
    '.contract-imprint',
  ].join(',');

  let activeTarget = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  body.classList.remove('hud-expanded-mode');
  body.classList.add('hud-compact-mode');
  document.documentElement.dataset.hudDensity = 'compact';

  const tooltip = document.createElement('div');
  tooltip.id = 'hud-detail-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('aria-live', 'polite');
  document.body.appendChild(tooltip);

  const actions = document.querySelector('.frame-actions');
  const densityToggle = document.createElement('button');
  densityToggle.id = 'hud-density-toggle';
  densityToggle.className = 'icon-button';
  densityToggle.type = 'button';
  densityToggle.setAttribute('aria-pressed', 'false');
  densityToggle.setAttribute('aria-label', '切换 HUD 精简与展开模式');
  densityToggle.textContent = 'HUD：精简';
  actions?.prepend(densityToggle);

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function text(node, selector) {
    return cleanText(node.querySelector(selector)?.textContent);
  }

  function joinParts(parts) {
    return parts.map(cleanText).filter(Boolean).join(' · ');
  }

  function describe(target) {
    const storedTitle = cleanText(target.dataset.hudOriginalTitle);
    if (target.matches('.live-upgrade-card')) {
      return joinParts([
        text(target, '.upgrade-key') && `快捷键 ${text(target, '.upgrade-key')}`,
        text(target, 'h3'),
        text(target, '.rarity-chip'),
        text(target, '.recommended-chip'),
        text(target, 'p'),
      ]);
    }
    if (target.matches('.contract-option')) {
      return joinParts([
        text(target, '.contract-key') && `快捷键 ${text(target, '.contract-key')}`,
        text(target, '.contract-tag'),
        text(target, 'strong'),
        text(target, 'small'),
        text(target, 'em'),
        text(target, 'b'),
      ]);
    }
    if (target.matches('.contract-summary')) {
      return joinParts([text(target, 'strong'), text(target, 'small')]);
    }
    if (target.matches('.contract-chain-row')) {
      return joinParts([...target.querySelectorAll('span')].map((node) => node.textContent));
    }
    if (target.matches('.contract-imprint')) {
      return joinParts([
        text(target, 'b'),
        text(target, 'small'),
        target.classList.contains('resonant') ? '已激活同类星印共鸣' : '',
      ]);
    }
    if (target.matches('.synergy-chip')) {
      return joinParts([
        text(target, '.synergy-state'),
        text(target, 'strong'),
        text(target, 'small'),
        text(target, 'em'),
      ]);
    }
    if (target.matches('.loot-entry')) {
      return joinParts([text(target, 'strong'), text(target, 'small')]);
    }
    if (target.matches('.acquired-item')) {
      return storedTitle || joinParts([text(target, 'strong'), text(target, 'small')]);
    }
    if (target.matches('.mission-pane')) {
      const stages = [...target.querySelectorAll('.objective-stage')]
        .map((row) => cleanText(row.textContent))
        .filter(Boolean)
        .join('；');
      return joinParts([
        text(target, '#objective-title'),
        text(target, '#objective-detail'),
        stages,
      ]);
    }
    if (target.matches('.objective-stage')) return cleanText(target.textContent);
    if (target.matches('.metric-chip')) {
      return joinParts([
        text(target, 'span'),
        text(target, 'strong'),
        text(target, 'small'),
      ]);
    }
    if (target.matches('.telemetry-grid > span, .player-status-grid > span, .live-upgrade-meta > span')) {
      return joinParts([text(target, 'small'), text(target, 'strong'), cleanText(target.childNodes[0]?.textContent)]);
    }
    if (target.matches('.bar-row')) {
      return joinParts([text(target, '.bar-label span'), text(target, '.bar-label strong')]);
    }
    if (target.matches('#status-message')) return cleanText(target.textContent);
    if (target.matches('.active-buffs > span, .build-chip')) return storedTitle || cleanText(target.textContent);
    return storedTitle || cleanText(target.getAttribute('aria-label')) || cleanText(target.textContent);
  }

  function isNaturallyFocusable(node) {
    return node.matches('button, a[href], input, select, textarea, summary, [contenteditable="true"]');
  }

  function markMetricKinds(root) {
    const metrics = root.matches?.('.metric-chip') ? [root] : [...root.querySelectorAll?.('.metric-chip') || []];
    metrics.forEach((metric) => {
      const label = text(metric, 'span');
      if (label === '阶段') metric.classList.add('phase-chip');
      if (label === '夜幕目标') metric.classList.add('objective-chip');
    });
  }

  function enhance(root = document) {
    markMetricKinds(root);
    const candidates = [];
    if (root.matches?.(TOOLTIP_SELECTOR)) candidates.push(root);
    candidates.push(...(root.querySelectorAll?.(TOOLTIP_SELECTOR) || []));

    candidates.forEach((node) => {
      if (node.dataset.hudEnhanced === 'true') return;
      node.dataset.hudEnhanced = 'true';
      node.dataset.hudTooltip = 'auto';
      const title = node.getAttribute('title');
      if (title) {
        node.dataset.hudOriginalTitle = title;
        node.removeAttribute('title');
      }
      if (!isNaturallyFocusable(node) && !node.hasAttribute('tabindex')) node.tabIndex = 0;
      if (!node.hasAttribute('aria-describedby')) node.setAttribute('aria-describedby', tooltip.id);
    });
  }

  function positionTooltip(target) {
    if (!target || !tooltip.classList.contains('visible')) return;
    const rect = target.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.right + margin;
    if (left + tipRect.width > viewportWidth - margin) left = rect.left - tipRect.width - margin;
    if (left < margin) left = Math.min(viewportWidth - tipRect.width - margin, Math.max(margin, lastPointerX + 12));

    let top = rect.top;
    if (top + tipRect.height > viewportHeight - margin) top = viewportHeight - tipRect.height - margin;
    if (top < margin) top = Math.min(viewportHeight - tipRect.height - margin, Math.max(margin, lastPointerY + 12));

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function showTooltip(target) {
    const content = describe(target);
    if (!content) return;
    activeTarget = target;
    tooltip.textContent = content;
    tooltip.classList.add('visible');
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    requestAnimationFrame(() => positionTooltip(target));
  }

  function hideTooltip() {
    activeTarget = null;
    tooltip.classList.remove('visible');
  }

  function findTooltipTarget(node) {
    return node instanceof Element ? node.closest('[data-hud-tooltip]') : null;
  }

  document.addEventListener('pointermove', (event) => {
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  }, { passive: true });

  document.addEventListener('pointerover', (event) => {
    const target = findTooltipTarget(event.target);
    if (!target || target === activeTarget) return;
    showTooltip(target);
  });

  document.addEventListener('pointerout', (event) => {
    if (!activeTarget) return;
    const next = event.relatedTarget;
    if (next instanceof Node && activeTarget.contains(next)) return;
    if (findTooltipTarget(next) === activeTarget) return;
    hideTooltip();
  });

  document.addEventListener('focusin', (event) => {
    const target = findTooltipTarget(event.target);
    if (target) showTooltip(target);
  });

  document.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (findTooltipTarget(next) !== activeTarget) hideTooltip();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && tooltip.classList.contains('visible')) hideTooltip();
  });

  densityToggle.addEventListener('click', () => {
    const expanded = body.classList.toggle('hud-expanded-mode');
    body.classList.toggle('hud-compact-mode', !expanded);
    document.documentElement.dataset.hudDensity = expanded ? 'expanded' : 'compact';
    densityToggle.setAttribute('aria-pressed', String(expanded));
    densityToggle.textContent = expanded ? 'HUD：展开' : 'HUD：精简';
    hideTooltip();
  });

  window.addEventListener('resize', () => positionTooltip(activeTarget), { passive: true });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) enhance(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  enhance(document);
})();
