(() => {
  const arenaWidth = VIEW_WIDTH;
  const arenaHeight = VIEW_HEIGHT;
  const originalResetGame = resetGame;
  const originalUpdate = update;
  const originalEndGame = endGame;

  function clampToArena(entity, radius = entity.radius || 0) {
    entity.x = clamp(entity.x, radius, arenaWidth - radius);
    entity.y = clamp(entity.y, radius, arenaHeight - radius);
  }

  updateCamera = function updateCameraSingleScreen() {
    camera.x = 0;
    camera.y = 0;
  };

  spawnPoint = function spawnPointSingleScreen() {
    const margin = 14;
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) return [Math.floor(Math.random() * (arenaWidth - margin * 2)) + margin, margin];
    if (edge === 1) return [arenaWidth - margin, Math.floor(Math.random() * (arenaHeight - margin * 2)) + margin];
    if (edge === 2) return [Math.floor(Math.random() * (arenaWidth - margin * 2)) + margin, arenaHeight - margin];
    return [margin, Math.floor(Math.random() * (arenaHeight - margin * 2)) + margin];
  };

  drawWorldBounds = function drawSingleScreenBounds() {
    ctx.fillStyle = PALETTE.redDark;
    ctx.fillRect(0, 0, arenaWidth, 3);
    ctx.fillRect(0, arenaHeight - 3, arenaWidth, 3);
    ctx.fillRect(0, 0, 3, arenaHeight);
    ctx.fillRect(arenaWidth - 3, 0, 3, arenaHeight);
  };

  resetGame = function resetSingleScreenGame() {
    originalResetGame();
    player.x = Math.round(arenaWidth / 2);
    player.y = Math.round(arenaHeight / 2);
    camera.x = 0;
    camera.y = 0;

    backgroundSeed = [];
    const types = ['star', 'stone', 'grass', 'crystal'];
    for (let i = 0; i < 150; i += 1) {
      backgroundSeed.push({
        x: Math.floor(Math.random() * arenaWidth),
        y: Math.floor(Math.random() * arenaHeight),
        type: types[Math.floor(Math.random() * types.length)],
        size: 1 + Math.floor(Math.random() * 3),
      });
    }

    ui.statusMessage.textContent = '星火已点燃。整个竞技场已完整显示。';
    updateUi();
    render();
  };

  update = function updateSingleScreen(dt) {
    originalUpdate(dt);
    clampToArena(player);
    camera.x = 0;
    camera.y = 0;

    enemies.forEach((enemy) => clampToArena(enemy));
    gems.forEach((gem) => clampToArena(gem));
    hazards.forEach((hazard) => clampToArena(hazard));
  };

  endGame = function endSingleScreenGame() {
    originalEndGame();
    ui.gameOverStats.textContent = `生存 ${Math.floor(elapsed)} 秒，在完整可见的单屏竞技场达到 ${player.level} 级，击败 ${player.kills} 名夜行者。`;
  };

  ui.scaleButton.textContent = '地图：完整单屏';
  ui.scaleButton.disabled = true;
  ui.scaleButton.setAttribute('aria-label', '完整地图已全部显示');
  ui.renderValue.textContent = `${VIEW_WIDTH}×${VIEW_HEIGHT} · 全地图可见`;

  resetGame();
})();
