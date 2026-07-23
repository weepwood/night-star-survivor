import fs from 'node:fs';

const script = fs.readFileSync('cosmic-contracts.js', 'utf8');
const css = fs.readFileSync('cosmic-contracts.css', 'utf8');
const loader = fs.readFileSync('victory-guard.js', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(script.includes('CONTRACT_TRIGGER_TIMES = [25, 65, 105]'), '缺少三次星象契约触发时间');
assert(script.includes('CHOICE_SECONDS = 7'), '缺少契约选择倒计时');
assert(script.includes("['4', '5', '6']"), '缺少 4/5/6 快捷选择');
assert(script.includes("metric: 'kills'"), '缺少猎杀任务');
assert(script.includes("metric: 'damage'"), '缺少输出任务');
assert(script.includes("metric: 'nohit'"), '缺少无伤任务');
assert(script.includes("metric: 'xp'"), '缺少采集任务');
assert(script.includes("metric: 'dashes'"), '缺少冲刺任务');
assert(script.includes("metric: 'distance'"), '缺少移动任务');
assert(script.includes('chainMultiplier()'), '缺少星链倍率');
assert(script.includes('starChain >= 50'), '缺少高阶星链阈值');
assert(script.includes('applyResonance(tag)'), '缺少星印共鸣');
assert(script.includes("tag === 'assault'"), '缺少猎杀共鸣');
assert(script.includes("tag === 'survival'"), '缺少守望共鸣');
assert(script.includes("tag === 'growth'"), '缺少采集共鸣');
assert(script.includes("tag === 'mobility'"), '缺少跃迁共鸣');
assert(script.includes("tag === 'burst'"), '缺少爆发共鸣');
assert(script.includes("encounterState === 'selecting'"), '缺少契约状态机');
assert(script.includes('if (choosing) pendingChoice = true'), '契约未避让实时构筑');
assert(script.includes('damageEnemyWithCosmicContracts'), '缺少伤害包装');
assert(script.includes('spawnEnemyWithCosmicContracts'), '缺少敌人风险包装');
assert(script.includes('resetGameWithCosmicContracts'), '缺少重开清理');

assert(css.includes('.cosmic-contract-terminal'), '缺少契约终端样式');
assert(css.includes('border-radius: 0'), '契约终端未保持硬边像素风');
assert(css.includes('.contract-option'), '缺少契约选项样式');
assert(css.includes('.contract-imprint.resonant'), '缺少星印共鸣样式');
assert(css.includes('@media (max-width: 680px)'), '缺少小窗口布局');

assert(loader.includes("loadStylesheet('cosmic-contracts'"), '未通过资源加载器加载契约样式');
assert(loader.includes("loadScript('cosmic-contracts'"), '未通过资源加载器加载契约脚本');
assert(loader.includes('script.async = false'), '契约脚本加载顺序不稳定');

console.log('星象契约、星链倍率、风险任务与星印共鸣检查通过');
