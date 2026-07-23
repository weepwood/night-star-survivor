(() => {
  const finalEndGame = endGame;
  endGame = function endGameAfterVictoryGuard() {
    const victoryScreen = document.querySelector('#victory-screen');
    if (victoryScreen?.classList.contains('visible')) return;
    finalEndGame();
  };

  const assetVersion = '20260723.5';
  if (!document.querySelector('link[data-cosmic-contracts]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = `./cosmic-contracts.css?v=${assetVersion}`;
    stylesheet.dataset.cosmicContracts = 'true';
    document.head.appendChild(stylesheet);
  }

  if (!document.querySelector('script[data-cosmic-contracts]')) {
    const script = document.createElement('script');
    script.src = `./cosmic-contracts.js?v=${assetVersion}`;
    script.async = false;
    script.dataset.cosmicContracts = 'true';
    document.body.appendChild(script);
  }
})();
