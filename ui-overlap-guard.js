(() => {
  const body = document.body;
  const upgradeScreen = document.querySelector('#upgrade-screen');
  const compactViewport = window.matchMedia('(max-width: 680px), (max-height: 470px)');
  let terminal = null;

  function findTerminal() {
    terminal ||= document.querySelector('#cosmic-contract-terminal');
    return terminal;
  }

  function upgradeIsActive() {
    return body.classList.contains('live-upgrade-active')
      || Boolean(upgradeScreen?.classList.contains('visible'));
  }

  function syncUiPriority() {
    const contractTerminal = findTerminal();
    if (!contractTerminal) return;

    const deferred = upgradeIsActive();
    const hiddenForViewport = deferred && compactViewport.matches;
    contractTerminal.classList.toggle('contract-deferred-for-upgrade', deferred);
    contractTerminal.dataset.uiPriority = deferred ? 'deferred' : 'normal';
    contractTerminal.setAttribute('aria-hidden', hiddenForViewport ? 'true' : 'false');
    contractTerminal.setAttribute(
      'aria-label',
      deferred
        ? '星象契约已暂时折叠，星尘强化结束后恢复完整界面'
        : '星象契约',
    );

    if ('inert' in contractTerminal) contractTerminal.inert = hiddenForViewport;
  }

  const stateObserver = new MutationObserver(syncUiPriority);
  stateObserver.observe(body, { attributes: true, attributeFilter: ['class'] });
  if (upgradeScreen) stateObserver.observe(upgradeScreen, { attributes: true, attributeFilter: ['class'] });

  const terminalObserver = new MutationObserver(() => {
    if (!findTerminal()) return;
    syncUiPriority();
    terminalObserver.disconnect();
  });
  if (!findTerminal()) terminalObserver.observe(body, { childList: true, subtree: true });

  compactViewport.addEventListener?.('change', syncUiPriority);
  window.addEventListener('resize', syncUiPriority, { passive: true });
  syncUiPriority();
})();
