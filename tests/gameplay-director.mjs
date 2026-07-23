import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('gameplay-director.js', 'utf8');
const css = fs.readFileSync('gameplay-director.css', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const requiredIds = [
  'objective-brief',
  'objective-title',
  'objective-detail',
  'objective-progress-bar',
  'synergy-list',
  'player-pixel-core',
  'status-armor-value',
  'status-dash-value',
  'status-nova-value',
  'status-combo-value',
  'victory-screen',
  'victory-stats',
  'victory-synergies',
  'victory-restart-button',
];

for (const id of requiredIds) {
  assert((html.match(new RegExp(`id="${id}"`, 'g')) || []).length === 1, `缺少或重复节点：${id}`);
}

assert(html.includes('gameplay-director.css?v='), '未加载玩法导演样式');
assert(html.includes('gameplay-director.js?v='), '未加载玩法导演脚本');
assert(html.indexOf('live-upgrade.js') < html.indexOf('gameplay-director.js'), '玩法导演必须在实时构筑之后加载');
assert(html.indexOf('gameplay-director.js') < html.indexOf('fit-canvas.js'), '画布适配必须最后加载');

assert(script.includes("BOSS_NAMES = ['血月监视者', '星蚀巨像', '无光祭司']"), '缺少三首领任务');
assert(script.includes('bossesDefeated >= BOSS_NAMES.length'), '缺少最终胜利条件');
assert(script.includes('selectedSynergies = shuffle(SYNERGY_POOL).slice(0, 3)'), '每局未随机抽取三条星契');
assert(script.includes('sound.directorAudioInstalled'), '缺少新版音效总线');
assert(script.includes('sound.critical'), '缺少暴击音效');
assert(script.includes('sound.victory'), '缺少胜利音效');
assert(script.includes('drawPlayerWithStatusPixels'), '缺少角色状态像素');
assert(script.includes('drawEffectsWithImpacts'), '缺少局部命中反馈');
assert(script.includes('completeVictory()'), '缺少胜利结算调用');

assert(css.includes('#acquired-items-strip'), '未处理左下重复道具条');
assert(css.includes('display: none !important'), '左下重复道具条仍可能显示');
assert(css.includes('.synergy-chip.active'), '缺少星契激活样式');
assert(css.includes('.objective-stage.complete'), '缺少目标完成样式');

console.log('玩法目标、随机星契、音效、角色状态像素与重复道具隐藏检查通过');