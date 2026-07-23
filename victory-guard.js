(() => {
  const finalEndGame = endGame;
  endGame = function endGameAfterVictoryGuard() {
    const victoryScreen = document.querySelector('#victory-screen');
    if (victoryScreen?.classList.contains('visible')) return;
    finalEndGame();
  };

  const assetVersion = '20260723.7';

  function loadStylesheet(name, marker) {
    if (document.querySelector(`link[data-${marker}]`)) return;
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `./${name}.css?v=${assetVersion}`;
    stylesheet.setAttribute(`data-${marker}`, 'true');
    document.head.appendChild(stylesheet);
  }

  function loadScript(name, marker) {
    if (document.querySelector(`script[data-${marker}]`)) return;
    const script = document.createElement('script');
    script.src = `./${name}.js?v=${assetVersion}`;
    script.async = false;
    script.setAttribute(`data-${marker}`, 'true');
    document.body.appendChild(script);
  }

  loadStylesheet('cosmic-contracts', 'cosmic-contracts');
  loadStylesheet('adaptive-hud', 'adaptive-hud');
  loadStylesheet('adaptive-hud-expanded', 'adaptive-hud-expanded');
  loadStylesheet('nightfall-v3', 'nightfall-v3');
  loadScript('cosmic-contracts', 'cosmic-contracts');
  loadScript('adaptive-hud', 'adaptive-hud');
  loadScript('nightfall-v3', 'nightfall-v3');
  loadScript('nightfall-v3-integrity', 'nightfall-v3-integrity');
})();