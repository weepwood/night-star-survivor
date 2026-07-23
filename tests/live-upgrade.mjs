import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('live-upgrade.js', 'utf8');
const css = fs.readFileSync('live-upgrade.css', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const requiredIds = [
  'upgrade-screen',
  'upgrade-title',
  'upgrade-queue-value',
  'upgrade-slow-value',
  'upgrade-timer-value',
  'upgrade-protection-value',
  'upgrade-timer-bar',
  'upgrade-options',
];

for (const id of requiredIds) {
  const matches = html.match(new RegExp(`id="${id}"`, 'g')) || [];
  assert(matches.length === 1, `HUD 节点 ${id} 应存在且仅存在一次，实际为 ${matches.length}`);
}

const orderedScripts = [
  './game.js',
  './single-screen.js',
  './rich-content.js',
  './combat-telemetry.js',
  './live-upgrade.js',
  './fit-canvas.js',
];
let previousIndex = -1;
for (const src of orderedScripts) {
  const index = html.indexOf(`src="${src}?v=`);
  assert(index > previousIndex, `脚本加载顺序错误：${src}`);
  previousIndex = index;
}

assert(script.includes('WORLD_TIME_SCALE = 0.35'), '缺少 35% 世界流速');
assert(script.includes('PLAYER_WEAPON_SCALE = 0.6'), '缺少 60% 武器计时');
assert(script.includes('CHOICE_DURATION = 8'), '缺少 8 秒倒计时');
assert(script.includes('PROTECTION_DURATION = 1.2'), '缺少 1.2 秒保护');
assert(script.includes('PROTECTION_DAMAGE_MULTIPLIER = 0.3'), '缺少 70% 减伤');
assert(script.includes('while (player.xp >= player.nextXp)'), '经验升级没有连续队列处理');
assert(script.includes("['1', '2', '3']"), '缺少 1/2/3 快捷选择');
assert(script.includes('if (!paused)'), '实时构筑循环必须只在手动暂停时停止');
assert(script.includes('updateUpgradeState(dt)'), '倒计时未接入主循环');
assert(script.includes('currentButtons[recommendedIndex]'), '超时后未自动选择推荐构筑');
assert(script.includes('closeUpgradeTerminal(true)'), '重开或结束时未清理构筑队列');
assert(script.includes("classList.contains('live-upgrade-active')"), '连续选择未识别已开启的构筑终端');
assert(script.includes('if (!continuingQueue) protectionRemaining = PROTECTION_DURATION'), '连续选择会重复刷新减伤保护');
assert(script.includes('metaClock = 0.1'), '构筑倒计时 UI 没有限制到 10Hz');

assert(css.includes('background: transparent'), '升级层仍存在全屏遮罩');
assert(css.includes('pointer-events: none'), '升级层应允许战场继续接收交互');
assert(css.includes('pointer-events: auto'), '升级面板自身必须可以点击');
assert(css.includes('grid-template-columns: repeat(3'), '极小窗口缺少横向三卡布局');
assert(css.includes('steps(3, end)'), '升级终端缺少像素阶梯动画');

console.log('实时构筑结构与状态机检查通过');
