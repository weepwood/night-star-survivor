(() => {
  const finalEndGame = endGame;
  endGame = function endGameAfterVictoryGuard() {
    const victoryScreen = document.querySelector('#victory-screen');
    if (victoryScreen?.classList.contains('visible')) return;
    finalEndGame();
  };

  const assetVersion = '20260723.6';

  function loadStylesheet(name, marker) {
    if (document.querySelector(`link[data-${marker}]`)) return;
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `./${name}.css?v=${assetVersion}`;
    stylesheet.dataset[marker] = 'true';
    document.head.appendChild(stylesheet);
  }

  function loadScript(name, marker) {
    if (document.querySelector(`script[data-${marker}]`)) return;
    const script = document.createElement('script');
    script.src = `./${name}.js?v=${assetVersion}`;
    script.async = false;
    script.dataset[marker] = 'true';
    document.body.appendChild(script);
  }

  loadStylesheet('cosmic-contracts', 'cosmicContracts');
  loadStylesheet('adaptive-hud', 'adaptiveHud');
  loadScript('cosmic-contracts', 'cosmicContracts');
  loadScript('adaptive-hud', 'adaptiveHud');
})();
