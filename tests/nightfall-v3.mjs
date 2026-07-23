import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync('nightfall-v3.js', 'utf8');
const css = fs.readFileSync('nightfall-v3.css', 'utf8');
const loader = fs.readFileSync('victory-guard.js', 'utf8');

assert.match(script, /TIDE_MAX = 100/);
assert.match(script, /OVERDRIVE_BASE_DURATION = 8/);
assert.match(script, /activateOverdrive/);
assert.match(script, /event\.key\.toLowerCase\(\) !== 'e'/);
assert.match(script, /createKillBurst/);
assert.match(script, /burstDepth >= 2/);
assert.match(script, /triggerBossBreak/);
assert.match(script, /BOSS_BREAK_DURATION = 3/);
assert.match(script, /BOSS_BREAK_DAMAGE_MULTIPLIER = 1\.45/);
assert.match(script, /MUTATION_POOL/);
assert.match(script, /openUpgrade\('选择一项星蚀遗产'/);
assert.match(script, /queueMicrotask/);
assert.match(script, /finalDamageEnemy\(enemy, rawDamage \* multiplier\)/);
assert.match(script, /damageEnemyWithNightfallV3/);
assert.match(script, /hurtPlayerWithNightfallV3/);
assert.match(script, /resetGameWithNightfallV3/);
assert.match(script, /nightfall-run-summary/);
assert.match(script, /nightfall-panel-tabs/);
assert.match(script, /nightfall-left-tabs/);
assert.match(script, /nightfall-ability-dock/);
assert.match(script, /nightfall-ribbon/);

assert.match(css, /#nightfall-ribbon/);
assert.match(css, /#nightfall-ability-dock/);
assert.match(css, /\.nightfall-panel-tabs/);
assert.match(css, /\.nightfall-left-tabs/);
assert.match(css, /body\.nightfall-v3 \.stage-left/);
assert.match(css, /body\.nightfall-v3 \.stage-right/);
assert.match(css, /nightfall-overdrive-active/);
assert.match(css, /nightfall-boss-core\.broken/);
assert.match(css, /nightfall-run-promise/);
assert.match(css, /nightfall-run-summary/);
assert.match(css, /@media \(max-width: 680px\)/);
assert.match(css, /prefers-reduced-motion/);

const adaptiveScript = loader.indexOf("loadScript('adaptive-hud'");
const nightfallScript = loader.indexOf("loadScript('nightfall-v3'");
const adaptiveCss = loader.indexOf("loadStylesheet('adaptive-hud-expanded'");
const nightfallCss = loader.indexOf("loadStylesheet('nightfall-v3'");
assert.ok(adaptiveScript >= 0 && nightfallScript > adaptiveScript, 'Nightfall V3 脚本必须在自适应 HUD 后加载');
assert.ok(adaptiveCss >= 0 && nightfallCss > adaptiveCss, 'Nightfall V3 样式必须覆盖已有 HUD 样式');
assert.match(loader, /assetVersion = '20260723\.7'/);

console.log('nightfall-v3-ok');