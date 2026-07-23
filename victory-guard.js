(() => {
  const finalEndGame = endGame;
  endGame = function endGameAfterVictoryGuard() {
    const victoryScreen = document.querySelector('#victory-screen');
    if (victoryScreen?.classList.contains('visible')) return;
    finalEndGame();
  };
})();