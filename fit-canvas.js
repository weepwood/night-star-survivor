const canvas = document.querySelector('#game-canvas');
const canvasShell = document.querySelector('.canvas-shell');
const scaleButton = document.querySelector('#scale-toggle');
const renderValue = document.querySelector('#render-value');

const LOGICAL_WIDTH = 640;
const LOGICAL_HEIGHT = 360;

function fitWholeBattlefield() {
  if (!canvas || !canvasShell) return;

  const shellStyle = getComputedStyle(canvasShell);
  const horizontalPadding = parseFloat(shellStyle.paddingLeft) + parseFloat(shellStyle.paddingRight);
  const verticalPadding = parseFloat(shellStyle.paddingTop) + parseFloat(shellStyle.paddingBottom);
  const availableWidth = Math.max(280, canvasShell.clientWidth - horizontalPadding);
  const stageTop = canvasShell.getBoundingClientRect().top;
  const availableHeight = Math.max(220, window.innerHeight - stageTop - verticalPadding - 20);
  const fitScale = Math.min(availableWidth / LOGICAL_WIDTH, availableHeight / LOGICAL_HEIGHT);
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  // 优先使用整数物理像素倍率；空间不足时才采用最近邻缩小。
  const integerPhysicalScale = Math.floor(fitScale * dpr);
  const cssScale = integerPhysicalScale >= 1
    ? integerPhysicalScale / dpr
    : Math.max(0.45, fitScale);

  const width = Math.floor(LOGICAL_WIDTH * cssScale);
  const height = Math.floor(LOGICAL_HEIGHT * cssScale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.maxWidth = '100%';

  if (scaleButton) {
    scaleButton.disabled = true;
    scaleButton.textContent = '战场：完整显示';
    scaleButton.title = '战场会自动缩放到页面内，避免横向滚动和裁切';
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
requestAnimationFrame(fitWholeBattlefield);
