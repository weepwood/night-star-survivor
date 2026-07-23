import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync('nightfall-v3.js', 'utf8');
const integrity = fs.readFileSync('nightfall-v3-integrity.js', 'utf8');
const css = fs.readFileSync('nightfall-v3.css', 'utf8');
const overlapGuard = fs.readFileSync('ui-overlap-guard.js', 'utf8');
const overlapCss = fs.readFileSync('ui-overlap-guard.css', 'utf8');
const loader = fs.readFileSync('victory-guard.js', 'utf8');

new Function(overlapGuard);

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

assert.match(integrity, /WeakMap/);
assert.match(integrity, /enemy\.damage = 0/);
assert.match(integrity, /enemy\.nightfallBreakCharge = 0/);
assert.match(integrity, /originalBossDamage\.get\(enemy\)/);
assert.match(integrity, /damageEnemyWithNightfallIntegrity/);
assert.match(integrity, /updateWithNightfallIntegrity/);

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

assert.match(overlapGuard, /live-upgrade-active/);
assert.match(overlapGuard, /contract-deferred-for-upgrade/);
assert.match(overlapGuard, /MutationObserver/);
assert.match(overlapGuard, /aria-hidden/);
assert.match(overlapCss, /left: calc\(var\(--arena-left\) \+ 7px\)/);
assert.match(overlapCss, /\.contract-options/);
assert.match(overlapCss, /display: none !important/);
assert.match(overlapCss, /max-height: 78px/);
assert.match(overlapCss, /@media \(max-width: 680px\), \(max-height: 470px\)/);

const adaptiveScript = loader.indexOf("loadScript('adaptive-hud'");
const nightfallScript = loader.indexOf("loadScript('nightfall-v3'");
const integrityScript = loader.indexOf("loadScript('nightfall-v3-integrity'");
const overlapScript = loader.indexOf("loadScript('ui-overlap-guard'");
const adaptiveCss = loader.indexOf("loadStylesheet('adaptive-hud-expanded'");
const nightfallCss = loader.indexOf("loadStylesheet('nightfall-v3'");
const overlapStyle = loader.indexOf("loadStylesheet('ui-overlap-guard'");
assert.ok(adaptiveScript >= 0 && nightfallScript > adaptiveScript, 'Nightfall V3 脚本必须在自适应 HUD 后加载');
assert.ok(integrityScript > nightfallScript, '首领完整性守卫必须在 Nightfall V3 后加载');
assert.ok(overlapScript > integrityScript, '界面重叠守卫必须最后加载');
assert.ok(adaptiveCss >= 0 && nightfallCss > adaptiveCss, 'Nightfall V3 样式必须覆盖已有 HUD 样式');
assert.ok(overlapStyle > nightfallCss, '界面重叠守卫样式必须最后覆盖');
assert.match(loader, /assetVersion = '20260723\.8'/);

console.log('nightfall-v3-ok');