(() => {
  const fitCanvas = document.querySelector('#game-canvas');
  const canvasShell = document.querySelector('.canvas-shell');
  const battlefieldFrame = document.querySelector('.battlefield-frame');
  const scaleButton = document.querySelector('#scale-toggle');
  const renderValue = document.querySelector('#render-value');

  const LOGICAL_WIDTH = 640;
  const LOGICAL_HEIGHT = 360;

  function setArenaInsets(width, height) {
    if (!canvasShell || !battlefieldFrame) return;
    const left = Math.max(0, Math.floor((canvasShell.clientWidth - width) / 2));
    const top = Math.max(0, Math.floor((canvasShell.clientHeight - height) / 2));
    const right = Math.max(0, canvasShell.clientWidth - width - left);
    const bottom = Math.max(0, canvasShell.clientHeight - height - top);

    battlefieldFrame.style.setProperty('--arena-left', `${left}px`);
    battlefieldFrame.style.setProperty('--arena-right', `${right}px`);
    battlefieldFrame.style.setProperty('--arena-top', `${top}px`);
    battlefieldFrame.style.setProperty('--arena-bottom', `${bottom}px`);
  }

  function fitWholeBattlefield() {
    if (!fitCanvas || !canvasShell) return;

    const availableWidth = Math.max(280, canvasShell.clientWidth);
    const availableHeight = Math.max(158, canvasShell.clientHeight);
    const fitScale = Math.min(availableWidth / LOGICAL_WIDTH, availableHeight / LOGICAL_HEIGHT);
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // 优先保持整数物理像素；窗口不足时使用最近邻缩小，但不裁切完整地图。
    const integerPhysicalScale = Math.floor(fitScale * dpr);
    const cssScale = integerPhysicalScale >= 1
      ? integerPhysicalScale / dpr
      : Math.max(0.4, fitScale);

    const width = Math.max(256, Math.floor(LOGICAL_WIDTH * cssScale));
    const height = Math.max(144, Math.floor(LOGICAL_HEIGHT * cssScale));

    fitCanvas.style.width = `${width}px`;
    fitCanvas.style.height = `${height}px`;
    fitCanvas.style.maxWidth = 'none';
    fitCanvas.style.maxHeight = 'none';
    setArenaInsets(width, height);

    if (scaleButton) {
      scaleButton.disabled = true;
      scaleButton.textContent = '战场：全窗口';
      scaleButton.title = '战场使用整个网页窗口，并保持完整地图与像素比例';
    }

    if (renderValue) {
      const physicalPixels = cssScale * dpr;
      const integerLabel = Number.isInteger(physicalPixels)
        ? `每格 ${physicalPixels} 物理像素`
        : '最近邻适配';
      renderValue.textContent = `${width}×${height} · ${integerLabel}`;
    }
  }

  const observer = new ResizeObserver(() => requestAnimationFrame(fitWholeBattlefield));
  if (canvasShell) observer.observe(canvasShell);

  window.addEventListener('resize', () => requestAnimationFrame(fitWholeBattlefield));
  window.addEventListener('orientationchange', () => requestAnimationFrame(fitWholeBattlefield));
  window.visualViewport?.addEventListener('resize', () => requestAnimationFrame(fitWholeBattlefield));
  requestAnimationFrame(fitWholeBattlefield);
})();
