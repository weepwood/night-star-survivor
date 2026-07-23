import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const visibilityCss = readFileSync('hud-visibility.css', 'utf8');

const requiredIds = [
  'combat-output-chip',
  'combat-dps-value',
  'combat-total-value',
  'telemetry-panel',
  'telemetry-dps',
  'telemetry-total',
  'telemetry-peak',
  'telemetry-hits',
  'acquired-panel',
  'acquired-item-list',
  'acquired-items-strip',
];

for (const id of requiredIds) {
  const matches = html.match(new RegExp(`id=["']${id}["']`, 'g')) || [];
  assert.equal(matches.length, 1, `HUD 节点 #${id} 必须在 HTML 中静态存在且仅出现一次`);
}

const allIds = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicateIds = allIds.filter((id, index) => allIds.indexOf(id) !== index);
assert.deepEqual([...new Set(duplicateIds)], [], `HTML 存在重复 id：${duplicateIds.join(', ')}`);

const richScriptAt = html.indexOf('rich-content.js');
const telemetryScriptAt = html.indexOf('combat-telemetry.js');
const fitScriptAt = html.indexOf('fit-canvas.js');
assert.ok(richScriptAt >= 0 && telemetryScriptAt > richScriptAt, '统计模块必须在丰富内容模块之后加载');
assert.ok(fitScriptAt > telemetryScriptAt, '画布适配模块必须在统计模块之后加载');

assert.match(html, /data-hud-version=["']2["']/, '战场必须声明 HUD v2');
assert.match(html, /hud-visibility\.css\?v=/, 'HUD 可见性样式必须带缓存版本号');
assert.match(html, /combat-telemetry\.js\?v=/, '统计脚本必须带缓存版本号');

assert.match(visibilityCss, /\.stage-right\s*\{[\s\S]*?display:\s*grid/i, '右侧 HUD 默认必须可见');
assert.match(visibilityCss, /max-height:\s*520px[\s\S]*?\.stage-right[\s\S]*?display:\s*grid\s*!important/i, '低高度窗口必须保留紧凑输出终端');
assert.match(visibilityCss, /#telemetry-panel[\s\S]*?visibility:\s*visible/i, '输出终端必须显式可见');

console.log('HUD 结构、加载顺序、唯一 ID 和低高度可见性检查通过。');
