import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('adaptive-hud.css', 'utf8');
const expandedCss = fs.readFileSync('adaptive-hud-expanded.css', 'utf8');
const js = fs.readFileSync('adaptive-hud.js', 'utf8');
const loader = fs.readFileSync('victory-guard.js', 'utf8');

assert.match(css, /#hud-detail-tooltip/);
assert.match(css, /body\.hud-compact-mode \.stage-left/);
assert.match(css, /width: min\(244px/);
assert.match(css, /width: min\(224px/);
assert.match(css, /\.mission-summary small[\s\S]*display: none/);
assert.match(css, /\.live-upgrade-card p[\s\S]*display: none/);
assert.match(css, /\.contract-option small[\s\S]*display: none/);
assert.match(css, /body\.hud-expanded-mode/);
assert.match(css, /@media \(max-width: 980px\)/);

assert.match(expandedCss, /max-height: calc\(100vh - 18px\)/);
assert.match(expandedCss, /body\.hud-expanded-mode \.objective-stage-list[\s\S]*display: grid/);
assert.match(expandedCss, /body\.hud-expanded-mode \.contract-option small/);

assert.match(js, /hud-density-toggle/);
assert.match(js, /hud-compact-mode/);
assert.match(js, /hud-expanded-mode/);
assert.match(js, /MutationObserver/);
assert.match(js, /pointerover/);
assert.match(js, /focusin/);
assert.match(js, /aria-describedby/);
assert.match(js, /requestAnimationFrame\(\(\) => positionTooltip/);
assert.match(js, /\.contract-option/);
assert.match(js, /\.live-upgrade-card/);
assert.match(js, /\.synergy-chip/);
assert.match(js, /\.acquired-item/);

const cosmicCss = loader.indexOf("loadStylesheet('cosmic-contracts'");
const adaptiveCss = loader.indexOf("loadStylesheet('adaptive-hud'");
const expandedCssIndex = loader.indexOf("loadStylesheet('adaptive-hud-expanded'");
const cosmicJs = loader.indexOf("loadScript('cosmic-contracts'");
const adaptiveJs = loader.indexOf("loadScript('adaptive-hud'");
assert.ok(cosmicCss >= 0 && adaptiveCss > cosmicCss, '自适应 HUD 样式必须在星象契约样式之后加载');
assert.ok(expandedCssIndex > adaptiveCss, '展开模式修正规则必须最后加载');
assert.ok(cosmicJs >= 0 && adaptiveJs > cosmicJs, '自适应 HUD 脚本必须在星象契约脚本之后加载');
assert.match(loader, /data-\$\{marker\}/);

console.log('adaptive-hud-ok');
