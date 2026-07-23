const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 360;
const WORLD_WIDTH = 2560;
const WORLD_HEIGHT = 1440;
const TAU = Math.PI * 2;
const PHASE_NAMES = ['薄暮', '血月', '蚀夜', '无光'];

canvas.width = VIEW_WIDTH;
canvas.height = VIEW_HEIGHT;
ctx.imageSmoothingEnabled = false;

const ui = {
  time: document.querySelector('#time-value'),
  level: document.querySelector('#level-value'),
  kills: document.querySelector('#kill-value'),
  phase: document.querySelector('#phase-value'),
  threat: document.querySelector('#threat-value'),
  healthText: document.querySelector('#health-text'),
  healthBar: document.querySelector('#health-bar'),
  xpText: document.querySelector('#xp-text'),
  xpBar: document.querySelector('#xp-bar'),
  novaText: document.querySelector('#nova-text'),
  novaBar: document.querySelector('#nova-bar'),
  buildList: document.querySelector('#build-list'),
  statusMessage: document.querySelector('#status-message'),
  startScreen: document.querySelector('#start-screen'),
  upgradeScreen: document.querySelector('#upgrade-screen'),
  upgradeTitle: document.querySelector('#upgrade-title'),
  upgradeOptions: document.querySelector('#upgrade-options'),
  gameOverScreen: document.querySelector('#game-over-screen'),
  gameOverStats: document.querySelector('#game-over-stats'),
  bossBanner: document.querySelector('#boss-banner'),
  bossName: document.querySelector('#boss-name'),
  pauseButton: document.querySelector('#pause-button'),
  soundButton: document.querySelector('#sound-toggle'),
  scaleButton: document.querySelector('#scale-toggle'),
  renderValue: document.querySelector('#render-value'),
};

const keys = new Set();
let selectedHero = 'astrologer';
let difficulty = 1;
let running = false;
let paused = false;
let choosing = false;
let lastFrame = 0;
let elapsed = 0;
let spawnClock = 0;
let hazardClock = 7;
let phase = 0;
let previousPhase = 0;
let entityId = 1;
let screenShake = 0;
let flashAlpha = 0;
let selectedScale = 0;
let currentScale = 1;
let animationFrame = 0;

let player;
let enemies = [];
let projectiles = [];
let gems = [];
let particles = [];
let numbers = [];
let hazards = [];
let beams = [];
let backgroundSeed = [];
const camera = { x: 0, y: 0 };

const PALETTE = {
  void: '#090611',
  groundA: '#100b1d',
  groundB: '#151025',
  grid: '#251b3b',
  ink: '#f6f4ff',
  muted: '#7d7197',
  violet: '#9f7aea',
  violetLight: '#c4a7ff',
  cyan: '#79e6ff',
  cyanDark: '#24728d',
  gold: '#ffd166',
  red: '#ff6b8a',
  redDark: '#7d274a',
  green: '#71e6a2',
  shadow: '#05030a',
};

const SPRITES = {
  astrologer: [
    '....vv....',
    '...vvvv...',
    '..vvvvvv..',
    '..vffffv..',
    '..fcffcf..',
    '...ffff...',
    '..VVVVVV..',
    '.VVVVVVVV.',
    '.VVVVVVVV.',
    '..VVVVVV..',
    '..VV..VV..',
    '.VV....VV.',
  ],
  warden: [
    '...gggg...',
    '..gggggg..',
    '..gffffg..',
    '..fkffkf..',
    '..gffffg..',
    '.GGGkkGGG.',
    '.GGGkkGGG.',
    'GGGGkkGGGG',
    'GGGGkkGGGG',
    '.GGGkkGGG.',
    '.GG....GG.',
    'GG......GG',
  ],
  ranger: [
    '....cc....',
    '...cccc...',
    '..cffffc..',
    '..fcffcf..',
    '...ffff...',
    '..dddddd..',
    '.dddddddd.',
    '.ddccccdd.',
    '..dddddd..',
    '..dd..dd..',
    '.dd....dd.',
    'dd......dd',
  ],
  wisp: [
    '..rrrr..',
    '.rrrrrr.',
    'rrrddrrr',
    'rrrddrrr',
    '.rrrrrr.',
    '.rr..rr.',
    'rr....rr',
    'r......r',
  ],
  bat: [
    'c......c',
    'cc....cc',
    'ccc..ccc',
    '.cccccc.',
    '..crrc..',
    '..cccc..',
    '.cc..cc.',
  ],
  brute: [
    '..rrrrrr..',
    '.rrkkkkrr.',
    '.rrkkkkrr.',
    'rrrrrrrrrr',
    'rrrddddrrr',
    'rrrrrrrrrr',
    'rrrrrrrrrr',
    'rrr....rrr',
    'rr......rr',
  ],
  seer: [
    '....r....',
    '...rrr...',
    '..rrrrr..',
    '..rrkrr..',
    '.rrrrrrr.',
    '.rrr.rrr.',
    'rrr...rrr',
    'rr.....rr',
  ],
  boss: [
    'rr......rr',
    'rrr....rrr',
    '.rrrrrrrr.',
    'rrrrrrrrrr',
    'rrrkkkkrrr',
    'rrrrrrrrrr',
    'rrrrddddrr',
    'rrrrrrrrrr',
    '.rrrrrrrr.',
    'rrr....rrr',
    'rr......rr',
  ],
};

const SPRITE_COLORS = {
  v: '#51357f', V: '#a98cff', f: '#f2d5c4', c: '#79e6ff',
  g: '#74698e', G: '#9b8cbd', k: '#ffd166', d: '#34244e',
  r: '#d95779', R: '#ff8da8',
};

const DIGITS = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '-': ['000', '000', '111', '000', '000'],
};

class SoundEngine {
  constructor() {
    this.enabled = true;
    this.context = null;
  }

  init() {
    if (!this.enabled || this.context) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) this.context = new AudioCtx();
  }

  tone(frequency, duration, type = 'square', volume = 0.025, slide = 0) {
    if (!this.enabled) return;
    this.init();
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.linearRampToValueAtTime(Math.max(40, frequency + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  shoot() { this.tone(360, 0.04, 'square', 0.014, 80); }
  hit() { this.tone(100, 0.035, 'square', 0.014, -25); }
  pickup() { this.tone(620, 0.06, 'square', 0.014, 150); }
  level() { this.tone(420, 0.14, 'square', 0.025, 360); }
  dash() { this.tone(145, 0.1, 'sawtooth', 0.02, 210); }
  nova() { this.tone(90, 0.32, 'square', 0.04, 380); }
  boss() { this.tone(58, 0.55, 'square', 0.04, -8); }
}

const sound = new SoundEngine();

const heroStats = {
  astrologer: { maxHp: 92, speed: 118, damage: 1.22, cooldown: 0.84, armor: 0, crit: 0.06, dashCooldown: 2.5, boltLevel: 2 },
  warden: { maxHp: 148, speed: 104, damage: 0.98, cooldown: 1, armor: 5, crit: 0.03, dashCooldown: 3.1, boltLevel: 1 },
  ranger: { maxHp: 104, speed: 138, damage: 1, cooldown: 0.93, armor: 1, crit: 0.18, dashCooldown: 1.85, boltLevel: 1 },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function screenX(worldX) {
  return Math.round(worldX - camera.x);
}

function screenY(worldY) {
  return Math.round(worldY - camera.y);
}

function isVisible(x, y, margin = 40) {
  return x >= camera.x - margin && x <= camera.x + VIEW_WIDTH + margin && y >= camera.y - margin && y <= camera.y + VIEW_HEIGHT + margin;
}

function resizePixelCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const availableCssPixels = Math.max(320, window.innerWidth - 28);
  const availablePhysicalPixels = availableCssPixels * dpr;
  const automatic = clamp(Math.floor(availablePhysicalPixels / VIEW_WIDTH), 1, 4);
  currentScale = selectedScale || automatic;
  const cssScale = currentScale / dpr;
  canvas.style.width = `${VIEW_WIDTH * cssScale}px`;
  canvas.style.height = `${VIEW_HEIGHT * cssScale}px`;
  ui.scaleButton.textContent = `物理像素：${selectedScale ? `${currentScale}×` : `自动 ${currentScale}×`}`;
  ui.renderValue.textContent = `${VIEW_WIDTH}×${VIEW_HEIGHT} · 每格 ${currentScale} 物理像素`;
}

function cycleScale() {
  selectedScale = selectedScale === 0 ? 1 : selectedScale === 1 ? 2 : selectedScale === 2 ? 3 : selectedScale === 3 ? 4 : 0;
  resizePixelCanvas();
}

function resetGame() {
  const stats = heroStats[selectedHero];
  player = {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    radius: 8,
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    speed: stats.speed,
    damageMultiplier: stats.damage,
    cooldownMultiplier: stats.cooldown,
    armor: stats.armor,
    crit: stats.crit,
    dashCooldownBase: stats.dashCooldown,
    dashCooldown: 0,
    dashTime: 0,
    invulnerable: 0,
    facingX: 1,
    facingY: 0,
    level: 1,
    xp: 0,
    nextXp: 24,
    kills: 0,
    nova: 0,
    novaTime: 0,
    magnet: 48,
    regen: 0.25,
    weapons: {
      bolt: { level: stats.boltLevel, timer: 0, evolved: false },
      orbit: { level: 0, angle: 0, timer: 0, evolved: false },
      aura: { level: 0, timer: 0, evolved: false },
      chain: { level: 0, timer: 0, evolved: false },
    },
    relics: { focus: 0, blood: 0, frost: 0, storm: 0 },
  };

  enemies = [];
  projectiles = [];
  gems = [];
  particles = [];
  numbers = [];
  hazards = [];
  beams = [];
  elapsed = 0;
  spawnClock = 0;
  hazardClock = 7;
  phase = 0;
  previousPhase = 0;
  entityId = 1;
  screenShake = 0;
  flashAlpha = 0;
  paused = false;
  choosing = false;
  camera.x = Math.round(player.x - VIEW_WIDTH / 2);
  camera.y = Math.round(player.y - VIEW_HEIGHT / 2);
  createBackground();
  hideOverlay(ui.upgradeScreen);
  hideOverlay(ui.gameOverScreen);
  ui.pauseButton.textContent = '暂停';
  ui.statusMessage.textContent = '星火已点燃。大地图会随角色移动。';
  updateUi();
  render();
}

function createBackground() {
  backgroundSeed = [];
  const types = ['star', 'stone', 'grass', 'crystal'];
  for (let i = 0; i < 620; i += 1) {
    backgroundSeed.push({
      x: Math.floor(Math.random() * WORLD_WIDTH),
      y: Math.floor(Math.random() * WORLD_HEIGHT),
      type: types[Math.floor(Math.random() * types.length)],
      size: 1 + Math.floor(Math.random() * 3),
    });
  }
}

function showOverlay(element) { element.classList.add('visible'); }
function hideOverlay(element) { element.classList.remove('visible'); }

function startGame() {
  difficulty = Number(document.querySelector('#difficulty-select').value);
  sound.init();
  resetGame();
  hideOverlay(ui.startScreen);
  running = true;
  lastFrame = performance.now();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  ui.gameOverStats.textContent = `生存 ${Math.floor(elapsed)} 秒，探索大地图并达到 ${player.level} 级，击败 ${player.kills} 名夜行者。`;
  showOverlay(ui.gameOverScreen);
}

function updateCamera() {
  const leftEdge = camera.x + 230;
  const rightEdge = camera.x + 410;
  const topEdge = camera.y + 125;
  const bottomEdge = camera.y + 235;

  if (player.x < leftEdge) camera.x = Math.floor(player.x - 230);
  else if (player.x > rightEdge) camera.x = Math.floor(player.x - 410);
  if (player.y < topEdge) camera.y = Math.floor(player.y - 125);
  else if (player.y > bottomEdge) camera.y = Math.floor(player.y - 235);

  camera.x = clamp(camera.x, 0, WORLD_WIDTH - VIEW_WIDTH);
  camera.y = clamp(camera.y, 0, WORLD_HEIGHT - VIEW_HEIGHT);
}

function spawnPoint() {
  const margin = 34;
  const edge = Math.floor(Math.random() * 4);
  let x;
  let y;
  if (edge === 0) {
    x = camera.x + Math.random() * VIEW_WIDTH;
    y = camera.y - margin;
  } else if (edge === 1) {
    x = camera.x + VIEW_WIDTH + margin;
    y = camera.y + Math.random() * VIEW_HEIGHT;
  } else if (edge === 2) {
    x = camera.x + Math.random() * VIEW_WIDTH;
    y = camera.y + VIEW_HEIGHT + margin;
  } else {
    x = camera.x - margin;
    y = camera.y + Math.random() * VIEW_HEIGHT;
  }
  return [clamp(x, 12, WORLD_WIDTH - 12), clamp(y, 12, WORLD_HEIGHT - 12)];
}

function spawnEnemy(type = null, elite = false) {
  const [x, y] = spawnPoint();
  const roll = Math.random();
  if (!type) {
    if (elapsed > 46 && roll < 0.13) type = 'seer';
    else if (elapsed > 26 && roll < 0.32) type = 'brute';
    else if (elapsed > 10 && roll < 0.58) type = 'bat';
    else type = 'wisp';
  }

  const config = {
    wisp: { radius: 6, hp: 32, speed: 34, damage: 14, xp: 5 },
    bat: { radius: 5, hp: 22, speed: 60, damage: 10, xp: 4 },
    brute: { radius: 11, hp: 118, speed: 22, damage: 23, xp: 12 },
    seer: { radius: 8, hp: 65, speed: 25, damage: 14, xp: 9 },
    boss: { radius: 22, hp: 980 + phase * 650, speed: 18, damage: 34, xp: 120 },
  }[type];

  const power = (1 + elapsed / 95) * (elite ? 2.1 : 1) * difficulty;
  enemies.push({
    id: entityId++, x, y, type, elite,
    radius: config.radius * (elite ? 1.15 : 1),
    hp: config.hp * power,
    maxHp: config.hp * power,
    speed: config.speed * Math.sqrt(difficulty),
    damage: config.damage * difficulty,
    xp: config.xp * (elite ? 4 : 1),
    hitFlash: 0,
    attackClock: 1.2 + Math.random(),
    pulse: Math.random() * TAU,
  });
}

function spawnBoss() {
  spawnEnemy('boss', true);
  for (let i = 0; i < 5 + phase; i += 1) spawnEnemy();
  ui.bossName.textContent = ['血月监视者', '星蚀巨像', '无光祭司'][Math.max(0, phase - 1)] || '星蚀巨像';
  ui.bossBanner.classList.remove('show');
  void ui.bossBanner.offsetWidth;
  ui.bossBanner.classList.add('show');
  ui.statusMessage.textContent = '首领降临：击败它将获得稀有遗物。';
  sound.boss();
  screenShake = 8;
}

function nearestEnemy(x = player.x, y = player.y, skipped = new Set()) {
  let target = null;
  let bestDistance = Infinity;
  for (const enemy of enemies) {
    if (skipped.has(enemy.id)) continue;
    const distance = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      target = enemy;
    }
  }
  return target;
}

function createParticle(x, y, color, count = 8, speed = 60, life = 0.45) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TAU;
    const velocity = speed * (0.35 + Math.random() * 0.75);
    particles.push({
      x, y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      color,
      life: life * (0.7 + Math.random() * 0.6),
      maxLife: life,
      size: 1 + Math.floor(Math.random() * 2),
    });
  }
}

function damageEnemy(enemy, rawDamage) {
  if (!enemies.includes(enemy)) return false;
  const critical = Math.random() < player.crit;
  const damage = rawDamage * (critical ? 1.9 : 1);
  enemy.hp -= damage;
  enemy.hitFlash = 0.08;
  numbers.push({ x: enemy.x, y: enemy.y - enemy.radius - 4, value: Math.round(damage), critical, life: 0.55 });
  createParticle(enemy.x, enemy.y, critical ? PALETTE.gold : PALETTE.violetLight, critical ? 10 : 5, 52);
  sound.hit();

  if (enemy.hp > 0) return false;

  player.kills += 1;
  player.nova = Math.min(100, player.nova + (enemy.elite ? 9 : 2));
  const gemCount = enemy.elite ? 8 : enemy.type === 'brute' ? 3 : 1;
  for (let i = 0; i < gemCount; i += 1) {
    gems.push({
      x: enemy.x + (Math.random() - 0.5) * 14,
      y: enemy.y + (Math.random() - 0.5) * 14,
      value: enemy.xp / gemCount,
      radius: enemy.elite ? 4 : 3,
      phase: Math.random() * TAU,
    });
  }
  createParticle(enemy.x, enemy.y, enemy.elite ? PALETTE.gold : PALETTE.red, enemy.elite ? 24 : 12, enemy.elite ? 105 : 72, 0.7);
  screenShake = Math.max(screenShake, enemy.elite ? 8 : 2);
  if (enemy.elite) grantRandomRelic();
  enemies.splice(enemies.indexOf(enemy), 1);
  return true;
}

function shootWeapons(dt) {
  shootBolt(dt);
  updateOrbit(dt);
  updateAura(dt);
  updateChain(dt);
}

function shootBolt(dt) {
  const weapon = player.weapons.bolt;
  weapon.timer -= dt;
  if (!weapon.level || weapon.timer > 0) return;
  const target = nearestEnemy();
  if (!target) return;

  const angle = Math.atan2(target.y - player.y, target.x - player.x);
  const count = 1 + Math.floor((weapon.level - 1) / 2);
  for (let i = 0; i < count; i += 1) {
    const spread = (i - (count - 1) / 2) * 0.13;
    const shotAngle = angle + spread;
    projectiles.push({
      kind: 'player',
      x: player.x,
      y: player.y,
      vx: Math.cos(shotAngle) * (255 + weapon.level * 10),
      vy: Math.sin(shotAngle) * (255 + weapon.level * 10),
      radius: weapon.evolved ? 4 : 3,
      damage: (18 + weapon.level * 8) * player.damageMultiplier * (player.novaTime ? 1.35 : 1),
      pierce: Math.floor(weapon.level / 3) + (weapon.evolved ? 3 : 0),
      life: 2.1,
      color: weapon.evolved ? PALETTE.cyan : PALETTE.violetLight,
      trail: [],
    });
  }
  weapon.timer = Math.max(0.17, (0.78 - weapon.level * 0.045) * player.cooldownMultiplier * (player.novaTime ? 0.55 : 1));
  sound.shoot();
}

function updateOrbit(dt) {
  const weapon = player.weapons.orbit;
  if (!weapon.level) return;
  weapon.angle += dt * (1.48 + weapon.level * 0.11);
  weapon.timer -= dt;
  if (weapon.timer > 0) return;

  const count = Math.min(7, weapon.level + 1);
  const radius = 32 + weapon.level * 3;
  const hitEnemies = new Set();
  for (let i = 0; i < count; i += 1) {
    const angle = weapon.angle + i * TAU / count;
    const bladeX = player.x + Math.cos(angle) * radius;
    const bladeY = player.y + Math.sin(angle) * radius;
    for (const enemy of [...enemies]) {
      if (hitEnemies.has(enemy.id)) continue;
      if (Math.hypot(enemy.x - bladeX, enemy.y - bladeY) < enemy.radius + 6) {
        hitEnemies.add(enemy.id);
        damageEnemy(enemy, (8 + weapon.level * 5) * player.damageMultiplier);
        if (weapon.evolved) player.hp = Math.min(player.maxHp, player.hp + 0.8);
      }
    }
  }
  weapon.timer = 0.16;
}

function updateAura(dt) {
  const weapon = player.weapons.aura;
  if (!weapon.level) return;
  weapon.timer -= dt;
  if (weapon.timer > 0) return;
  const radius = 42 + weapon.level * 8;
  for (const enemy of [...enemies]) {
    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < radius + enemy.radius) {
      damageEnemy(enemy, (6 + weapon.level * 4) * player.damageMultiplier);
      enemy.speed = Math.max(10, enemy.speed * (weapon.evolved ? 0.9 : 0.97));
    }
  }
  weapon.timer = 0.42;
}

function updateChain(dt) {
  const weapon = player.weapons.chain;
  if (!weapon.level) return;
  weapon.timer -= dt;
  if (weapon.timer > 0) return;

  const skipped = new Set();
  let sourceX = player.x;
  let sourceY = player.y;
  for (let i = 0; i < 2 + weapon.level + (weapon.evolved ? 3 : 0); i += 1) {
    const enemy = nearestEnemy(sourceX, sourceY, skipped);
    if (!enemy) break;
    skipped.add(enemy.id);
    beams.push({ x1: sourceX, y1: sourceY, x2: enemy.x, y2: enemy.y, life: 0.13 });
    sourceX = enemy.x;
    sourceY = enemy.y;
    damageEnemy(enemy, (14 + weapon.level * 7) * player.damageMultiplier);
  }
  weapon.timer = Math.max(0.72, (2.5 - weapon.level * 0.17) * player.cooldownMultiplier);
}

const upgrades = [
  { id: 'bolt', name: '星矢阵列', type: '武器', description: '增加星矢数量、伤害与穿透能力。', apply: () => player.weapons.bolt.level++ },
  { id: 'orbit', name: '月轮刃', type: '武器', description: '召唤围绕身体旋转的月轮刃。', apply: () => player.weapons.orbit.level++ },
  { id: 'aura', name: '寒星领域', type: '武器', description: '对近身敌人持续造成伤害并减速。', apply: () => player.weapons.aura.level++ },
  { id: 'chain', name: '星雷链', type: '武器', description: '周期性对多个敌人造成连锁打击。', apply: () => player.weapons.chain.level++ },
  { id: 'focus', name: '聚焦星核', type: '遗物', description: '伤害提高 12%，可使星矢进化。', apply: () => { player.relics.focus++; player.damageMultiplier *= 1.12; } },
  { id: 'blood', name: '猩红月石', type: '遗物', description: '最大生命提高 18，可使月轮刃进化。', apply: () => { player.relics.blood++; player.maxHp += 18; player.hp += 18; } },
  { id: 'frost', name: '永冻星心', type: '遗物', description: '护甲提高 2，可使寒星领域进化。', apply: () => { player.relics.frost++; player.armor += 2; } },
  { id: 'storm', name: '风暴刻印', type: '遗物', description: '暴击提高 8%，可使星雷链进化。', apply: () => { player.relics.storm++; player.crit += 0.08; } },
  { id: 'damage', name: '禁忌星图', type: '强化', description: '所有伤害提高 16%。', apply: () => { player.damageMultiplier *= 1.16; } },
  { id: 'cooldown', name: '时间折叠', type: '强化', description: '所有武器冷却缩短 12%。', apply: () => { player.cooldownMultiplier *= 0.88; } },
  { id: 'speed', name: '逐光步', type: '强化', description: '移动速度提高 12%，冲刺恢复更快。', apply: () => { player.speed *= 1.12; player.dashCooldownBase *= 0.92; } },
  { id: 'health', name: '不灭星火', type: '强化', description: '最大生命提高 22 并恢复生命。', apply: () => { player.maxHp += 22; player.hp = Math.min(player.maxHp, player.hp + 36); } },
  { id: 'magnet', name: '引力星环', type: '强化', description: '星尘吸取范围提高 32%。', apply: () => { player.magnet *= 1.32; } },
  { id: 'regen', name: '晨星余烬', type: '强化', description: '每秒生命恢复提高 0.65。', apply: () => { player.regen += 0.65; } },
];

function checkEvolution() {
  if (player.weapons.bolt.level >= 5 && player.relics.focus) player.weapons.bolt.evolved = true;
  if (player.weapons.orbit.level >= 4 && player.relics.blood) player.weapons.orbit.evolved = true;
  if (player.weapons.aura.level >= 4 && player.relics.frost) player.weapons.aura.evolved = true;
  if (player.weapons.chain.level >= 4 && player.relics.storm) player.weapons.chain.evolved = true;
}

function openUpgrade(title = '选择一项星尘强化', pool = upgrades) {
  choosing = true;
  ui.upgradeTitle.textContent = title;
  ui.upgradeOptions.innerHTML = '';
  const options = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  for (const upgrade of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'upgrade-card';
    button.innerHTML = `<span class="rarity-chip">${upgrade.type}</span><h3>${upgrade.name}</h3><p>${upgrade.description}</p>`;
    button.addEventListener('click', () => {
      upgrade.apply();
      checkEvolution();
      choosing = false;
      hideOverlay(ui.upgradeScreen);
      ui.statusMessage.textContent = `获得：${upgrade.name}`;
      updateUi();
    });
    ui.upgradeOptions.appendChild(button);
  }
  showOverlay(ui.upgradeScreen);
  sound.level();
}

function grantRandomRelic() {
  const relics = upgrades.filter((upgrade) => upgrade.type === '遗物');
  const relic = relics[Math.floor(Math.random() * relics.length)];
  relic.apply();
  checkEvolution();
  ui.statusMessage.textContent = `精英战利品：${relic.name}`;
}

function gainXp(value) {
  player.xp += value;
  if (player.xp < player.nextXp || choosing) return;
  player.xp -= player.nextXp;
  player.level += 1;
  player.nextXp = Math.round(player.nextXp * 1.22 + 7);
  openUpgrade();
}

function hurtPlayer(amount) {
  if (player.invulnerable > 0) return;
  player.hp -= Math.max(1, amount - player.armor);
  player.invulnerable = 0.18;
  flashAlpha = 0.16;
  screenShake = Math.max(screenShake, 3);
}

function dash() {
  if (!running || paused || choosing || player.dashCooldown > 0) return;
  let x = (keys.has('d') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('a') || keys.has('ArrowLeft') ? 1 : 0);
  let y = (keys.has('s') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('w') || keys.has('ArrowUp') ? 1 : 0);
  const length = Math.hypot(x, y) || 1;
  if (x || y) {
    player.facingX = x / length;
    player.facingY = y / length;
  }
  player.dashTime = 0.18;
  player.invulnerable = 0.32;
  player.dashCooldown = player.dashCooldownBase;
  createParticle(player.x, player.y, PALETTE.cyan, 14, 95, 0.35);
  sound.dash();
}

function nova() {
  if (!running || paused || choosing || player.nova < 100) return;
  player.nova = 0;
  player.novaTime = 6;
  flashAlpha = 0.3;
  screenShake = 7;
  for (const enemy of [...enemies]) {
    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 150) damageEnemy(enemy, 45 * player.damageMultiplier);
  }
  createParticle(player.x, player.y, PALETTE.cyan, 54, 160, 0.8);
  sound.nova();
}

function update(dt) {
  elapsed += dt;
  phase = Math.min(3, Math.floor(elapsed / 40));
  if (phase > previousPhase) {
    previousPhase = phase;
    spawnBoss();
  }

  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.dashTime = Math.max(0, player.dashTime - dt);
  player.novaTime = Math.max(0, player.novaTime - dt);
  player.hp = Math.min(player.maxHp, player.hp + player.regen * dt);

  let moveX = (keys.has('d') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('a') || keys.has('ArrowLeft') ? 1 : 0);
  let moveY = (keys.has('s') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('w') || keys.has('ArrowUp') ? 1 : 0);
  const moveLength = Math.hypot(moveX, moveY) || 1;
  if (moveX || moveY) {
    player.facingX = moveX / moveLength;
    player.facingY = moveY / moveLength;
  }
  const movementSpeed = player.dashTime ? 410 : player.speed * (player.novaTime ? 1.3 : 1);
  player.x += (player.dashTime ? player.facingX : moveX / moveLength) * movementSpeed * dt;
  player.y += (player.dashTime ? player.facingY : moveY / moveLength) * movementSpeed * dt;
  player.x = clamp(player.x, player.radius, WORLD_WIDTH - player.radius);
  player.y = clamp(player.y, player.radius, WORLD_HEIGHT - player.radius);
  updateCamera();

  if (player.dashTime) {
    particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, color: PALETTE.violet, life: 0.22, maxLife: 0.22, size: 7, ghost: true });
  }

  spawnClock -= dt;
  if (spawnClock <= 0) {
    const batch = elapsed > 82 ? 3 : elapsed > 34 ? 2 : 1;
    for (let i = 0; i < batch; i += 1) spawnEnemy(null, elapsed > 25 && Math.random() < 0.035);
    spawnClock = Math.max(0.18, (0.9 - elapsed / 260) / difficulty);
  }

  hazardClock -= dt;
  if (hazardClock <= 0) {
    if (phase > 0) {
      hazards.push({
        x: clamp(player.x + (Math.random() - 0.5) * 440, 35, WORLD_WIDTH - 35),
        y: clamp(player.y + (Math.random() - 0.5) * 240, 35, WORLD_HEIGHT - 35),
        radius: 28 + phase * 4,
        timer: 1.55,
        exploded: false,
      });
    }
    hazardClock = Math.max(4.2, 8 - phase);
  }

  shootWeapons(dt);
  updateProjectiles(dt);
  updateEnemies(dt);
  updateGems(dt);
  updateEffects(dt);
  updateHazards(dt);

  if (player.hp <= 0) endGame();
  updateUi();
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = projectiles[i];
    projectile.trail?.push({ x: projectile.x, y: projectile.y });
    if (projectile.trail?.length > 6) projectile.trail.shift();
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    let remove = projectile.life <= 0;

    if (projectile.kind === 'enemy') {
      if (Math.hypot(projectile.x - player.x, projectile.y - player.y) < projectile.radius + player.radius) {
        hurtPlayer(projectile.damage);
        remove = true;
      }
    } else {
      for (const enemy of [...enemies]) {
        if (remove) break;
        if (Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) < projectile.radius + enemy.radius) {
          damageEnemy(enemy, projectile.damage);
          if (projectile.pierce > 0) projectile.pierce -= 1;
          else remove = true;
        }
      }
    }

    if (remove || projectile.x < -80 || projectile.x > WORLD_WIDTH + 80 || projectile.y < -80 || projectile.y > WORLD_HEIGHT + 80) {
      projectiles.splice(i, 1);
    }
  }
}

function updateEnemies(dt) {
  for (const enemy of [...enemies]) {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.pulse += dt * 3;
    enemy.attackClock -= dt;

    if (enemy.type === 'seer' && enemy.attackClock <= 0) {
      projectiles.push({
        kind: 'enemy', x: enemy.x, y: enemy.y,
        vx: Math.cos(angle) * 95, vy: Math.sin(angle) * 95,
        radius: 4, damage: enemy.damage, life: 5,
        color: PALETTE.red, trail: [],
      });
      enemy.attackClock = 2.05;
    } else {
      enemy.x += Math.cos(angle) * enemy.speed * dt;
      enemy.y += Math.sin(angle) * enemy.speed * dt;
    }

    if (distance < player.radius + enemy.radius) {
      if (player.dashTime) damageEnemy(enemy, 30 * player.damageMultiplier);
      else hurtPlayer(enemy.damage * dt * 2.8);
    }
  }
}

function updateGems(dt) {
  for (let i = gems.length - 1; i >= 0; i -= 1) {
    const gem = gems[i];
    gem.phase += dt * 3;
    const dx = player.x - gem.x;
    const dy = player.y - gem.y;
    const distance = Math.hypot(dx, dy);
    if (distance < player.magnet && distance > 0) {
      const speed = 105 + (player.magnet - distance) * 4;
      gem.x += dx / distance * speed * dt;
      gem.y += dy / distance * speed * dt;
    }
    if (distance < player.radius + gem.radius + 3) {
      gainXp(gem.value);
      sound.pickup();
      gems.splice(i, 1);
    }
  }
}

function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.94;
    particle.vy *= 0.94;
    particle.life -= dt;
    if (particle.life <= 0) particles.splice(i, 1);
  }
  for (let i = numbers.length - 1; i >= 0; i -= 1) {
    numbers[i].y -= 16 * dt;
    numbers[i].life -= dt;
    if (numbers[i].life <= 0) numbers.splice(i, 1);
  }
  for (let i = beams.length - 1; i >= 0; i -= 1) {
    beams[i].life -= dt;
    if (beams[i].life <= 0) beams.splice(i, 1);
  }
  screenShake = Math.max(0, screenShake - dt * 25);
  flashAlpha = Math.max(0, flashAlpha - dt * 1.7);
}

function updateHazards(dt) {
  for (let i = hazards.length - 1; i >= 0; i -= 1) {
    const hazard = hazards[i];
    hazard.timer -= dt;
    if (hazard.timer <= 0 && !hazard.exploded) {
      hazard.exploded = true;
      hazard.timer = 0.28;
      if (Math.hypot(player.x - hazard.x, player.y - hazard.y) < hazard.radius) hurtPlayer(22 + phase * 8);
      createParticle(hazard.x, hazard.y, PALETTE.red, 24, 95, 0.6);
    } else if (hazard.exploded && hazard.timer <= 0) hazards.splice(i, 1);
  }
}

function drawPixelSprite(pattern, x, y, palette = SPRITE_COLORS, scale = 1, flash = false) {
  const width = pattern[0].length * scale;
  const height = pattern.length * scale;
  const startX = Math.round(x - width / 2);
  const startY = Math.round(y - height / 2);
  for (let row = 0; row < pattern.length; row += 1) {
    for (let col = 0; col < pattern[row].length; col += 1) {
      const key = pattern[row][col];
      if (key === '.') continue;
      ctx.fillStyle = flash ? PALETTE.ink : (palette[key] || PALETTE.ink);
      ctx.fillRect(startX + col * scale, startY + row * scale, scale, scale);
    }
  }
}

function drawPixelLine(x0, y0, x1, y1, color, thickness = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  ctx.fillStyle = color;
  while (true) {
    ctx.fillRect(x0 - Math.floor(thickness / 2), y0 - Math.floor(thickness / 2), thickness, thickness);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) { error += dy; x0 += sx; }
    if (e2 <= dx) { error += dx; y0 += sy; }
  }
}

function drawPixelRing(cx, cy, radius, color, spacing = 3, size = 1) {
  ctx.fillStyle = color;
  const circumference = Math.max(12, Math.floor(radius * 2.8));
  for (let i = 0; i < circumference; i += spacing) {
    const angle = i / circumference * TAU;
    ctx.fillRect(Math.round(cx + Math.cos(angle) * radius), Math.round(cy + Math.sin(angle) * radius), size, size);
  }
}

function drawBitmapNumber(value, x, y, color, scale = 1) {
  const text = String(value);
  const width = text.length * 4 * scale - scale;
  let cursor = Math.round(x - width / 2);
  ctx.fillStyle = color;
  for (const char of text) {
    const glyph = DIGITS[char];
    if (!glyph) { cursor += 4 * scale; continue; }
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] === '1') ctx.fillRect(cursor + col * scale, Math.round(y) + row * scale, scale, scale);
      }
    }
    cursor += 4 * scale;
  }
}

function drawBackground() {
  ctx.fillStyle = PALETTE.groundA;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const tile = 32;
  const startX = -((camera.x % tile + tile) % tile);
  const startY = -((camera.y % tile + tile) % tile);
  for (let y = startY; y < VIEW_HEIGHT; y += tile) {
    for (let x = startX; x < VIEW_WIDTH; x += tile) {
      const gx = Math.floor((x + camera.x) / tile);
      const gy = Math.floor((y + camera.y) / tile);
      ctx.fillStyle = (gx + gy) % 2 ? PALETTE.groundA : PALETTE.groundB;
      ctx.fillRect(x, y, tile, tile);
      ctx.fillStyle = PALETTE.grid;
      ctx.fillRect(x, y, tile, 1);
      ctx.fillRect(x, y, 1, tile);
    }
  }

  for (const decoration of backgroundSeed) {
    if (!isVisible(decoration.x, decoration.y, 8)) continue;
    drawDecoration(decoration);
  }

  ctx.fillStyle = 'rgba(3,2,8,.38)';
  ctx.fillRect(0, 0, VIEW_WIDTH, 8);
  ctx.fillRect(0, VIEW_HEIGHT - 8, VIEW_WIDTH, 8);
  ctx.fillRect(0, 0, 8, VIEW_HEIGHT);
  ctx.fillRect(VIEW_WIDTH - 8, 0, 8, VIEW_HEIGHT);
}

function drawDecoration(item) {
  const x = screenX(item.x);
  const y = screenY(item.y);
  if (item.type === 'star') {
    ctx.fillStyle = '#224657';
    ctx.fillRect(x - item.size, y, item.size * 2 + 1, 1);
    ctx.fillRect(x, y - item.size, 1, item.size * 2 + 1);
  } else if (item.type === 'stone') {
    ctx.fillStyle = '#292239';
    ctx.fillRect(x - item.size * 2, y - item.size, item.size * 4, item.size * 2);
    ctx.fillStyle = '#3c3151';
    ctx.fillRect(x - item.size, y - item.size, item.size * 2, 1);
  } else if (item.type === 'grass') {
    ctx.fillStyle = '#243b36';
    ctx.fillRect(x, y - 3, 1, 4);
    ctx.fillRect(x - 2, y - 2, 2, 1);
    ctx.fillRect(x + 1, y - 2, 2, 1);
  } else {
    ctx.fillStyle = '#3f2a61';
    ctx.fillRect(x, y - 3, 1, 7);
    ctx.fillRect(x - 2, y - 1, 5, 3);
    ctx.fillStyle = '#7657a8';
    ctx.fillRect(x, y - 2, 1, 3);
  }
}

function drawShadow(worldX, worldY, radius, alpha = 0.45) {
  const x = screenX(worldX);
  const y = screenY(worldY + radius * 0.7);
  ctx.fillStyle = `rgba(3,2,8,${alpha})`;
  const width = Math.max(4, Math.round(radius * 1.7));
  ctx.fillRect(Math.round(x - width / 2), y, width, 2);
  if (width > 8) ctx.fillRect(Math.round(x - width / 3), y + 2, Math.round(width * 0.66), 1);
}

function drawPlayer() {
  const blink = player.invulnerable > 0 && Math.floor(elapsed * 24) % 2 === 0;
  if (blink) return;
  const x = screenX(player.x);
  const y = screenY(player.y) + (Math.floor(elapsed * 7) % 2);
  drawShadow(player.x, player.y, player.radius, 0.5);
  if (player.novaTime) drawPixelRing(x, y, 17 + Math.floor(elapsed * 6) % 3, PALETTE.cyan, 2, 1);
  else drawPixelRing(x, y, 15, '#4c376e', 4, 1);
  drawPixelSprite(SPRITES[selectedHero], x, y - 2, SPRITE_COLORS, 1, false);
}

function drawEnemy(enemy) {
  if (!isVisible(enemy.x, enemy.y, 50)) return;
  const x = screenX(enemy.x);
  const bob = enemy.type === 'bat' ? (Math.floor(enemy.pulse * 2) % 3 - 1) * 2 : Math.floor(enemy.pulse) % 2;
  const y = screenY(enemy.y) + bob;
  drawShadow(enemy.x, enemy.y, enemy.radius, enemy.type === 'boss' ? 0.62 : 0.42);
  if (enemy.elite) drawPixelRing(x, y, Math.round(enemy.radius + 6), PALETTE.gold, 2, 1);
  const scale = enemy.type === 'boss' ? 2 : 1;
  drawPixelSprite(SPRITES[enemy.type], x, y, SPRITE_COLORS, scale, enemy.hitFlash > 0);

  if (enemy.type === 'boss' || enemy.elite) {
    const width = Math.max(14, Math.round(enemy.radius * 2.3));
    const barY = y + Math.round(enemy.radius) + 8;
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(x - Math.floor(width / 2), barY, width, 3);
    ctx.fillStyle = enemy.type === 'boss' ? PALETTE.red : PALETTE.gold;
    ctx.fillRect(x - Math.floor(width / 2), barY, Math.round(width * Math.max(0, enemy.hp / enemy.maxHp)), 2);
  }
}

function drawProjectiles() {
  for (const projectile of projectiles) {
    if (!isVisible(projectile.x, projectile.y, 30)) continue;
    if (projectile.trail) {
      projectile.trail.forEach((point, index) => {
        const size = index >= projectile.trail.length - 2 ? 2 : 1;
        ctx.fillStyle = projectile.color;
        ctx.globalAlpha = 0.18 + index / projectile.trail.length * 0.38;
        ctx.fillRect(screenX(point.x), screenY(point.y), size, size);
      });
      ctx.globalAlpha = 1;
    }
    const x = screenX(projectile.x);
    const y = screenY(projectile.y);
    ctx.fillStyle = projectile.kind === 'enemy' ? PALETTE.redDark : projectile.color;
    ctx.fillRect(x - projectile.radius, y - projectile.radius, projectile.radius * 2 + 1, projectile.radius * 2 + 1);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawOrbit() {
  const weapon = player.weapons.orbit;
  if (!weapon.level) return;
  const count = Math.min(7, weapon.level + 1);
  const radius = 32 + weapon.level * 3;
  for (let i = 0; i < count; i += 1) {
    const angle = weapon.angle + i * TAU / count;
    const x = screenX(player.x + Math.cos(angle) * radius);
    const y = screenY(player.y + Math.sin(angle) * radius);
    ctx.fillStyle = weapon.evolved ? PALETTE.red : PALETTE.violetLight;
    ctx.fillRect(x - 1, y - 4, 3, 9);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(x, y - 2, 1, 4);
  }
}

function drawAura() {
  const weapon = player.weapons.aura;
  if (!weapon.level) return;
  const radius = 42 + weapon.level * 8;
  const x = screenX(player.x);
  const y = screenY(player.y);
  const color = weapon.evolved ? PALETTE.cyan : PALETTE.violet;
  drawPixelRing(x, y, radius, color, 4, 1);
  drawPixelRing(x, y, Math.round(radius * 0.72), color, 7, 1);
}

function drawEffects() {
  for (const hazard of hazards) {
    if (!isVisible(hazard.x, hazard.y, hazard.radius + 10)) continue;
    const x = screenX(hazard.x);
    const y = screenY(hazard.y);
    const radius = Math.round(hazard.radius * (0.82 + (Math.floor(elapsed * 10) % 2) * 0.05));
    drawPixelRing(x, y, radius, hazard.exploded ? PALETTE.ink : PALETTE.red, 2, hazard.exploded ? 3 : 1);
    if (hazard.exploded) {
      ctx.fillStyle = 'rgba(255,107,138,.28)';
      ctx.fillRect(x - hazard.radius, y - hazard.radius, hazard.radius * 2, hazard.radius * 2);
    }
  }

  for (const beam of beams) {
    const x1 = screenX(beam.x1);
    const y1 = screenY(beam.y1);
    const x2 = screenX(beam.x2);
    const y2 = screenY(beam.y2);
    const midX = Math.round((x1 + x2) / 2) + (Math.floor(elapsed * 60) % 5 - 2);
    const midY = Math.round((y1 + y2) / 2) - (Math.floor(elapsed * 45) % 5 - 2);
    drawPixelLine(x1, y1, midX, midY, PALETTE.cyan, 2);
    drawPixelLine(midX, midY, x2, y2, PALETTE.ink, 1);
  }

  for (const gem of gems) {
    if (!isVisible(gem.x, gem.y, 10)) continue;
    const x = screenX(gem.x);
    const y = screenY(gem.y) + (Math.floor(gem.phase * 2) % 3 - 1);
    ctx.fillStyle = PALETTE.cyanDark;
    ctx.fillRect(x - gem.radius, y - gem.radius, gem.radius * 2 + 1, gem.radius * 2 + 1);
    ctx.fillStyle = PALETTE.cyan;
    ctx.fillRect(x, y - gem.radius, 1, gem.radius * 2 + 1);
    ctx.fillRect(x - gem.radius, y, gem.radius * 2 + 1, 1);
  }

  for (const particle of particles) {
    if (!isVisible(particle.x, particle.y, 10)) continue;
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife) * (particle.ghost ? 0.25 : 1);
    ctx.fillStyle = particle.color;
    const size = Math.max(1, Math.round(particle.size));
    ctx.fillRect(screenX(particle.x), screenY(particle.y), size, size);
  }
  ctx.globalAlpha = 1;

  for (const number of numbers) {
    if (!isVisible(number.x, number.y, 20)) continue;
    ctx.globalAlpha = Math.max(0, number.life / 0.55);
    drawBitmapNumber(number.value, screenX(number.x), screenY(number.y), number.critical ? PALETTE.gold : PALETTE.ink, number.critical ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

function drawWorldBounds() {
  const left = -camera.x;
  const top = -camera.y;
  const right = WORLD_WIDTH - camera.x;
  const bottom = WORLD_HEIGHT - camera.y;
  ctx.fillStyle = PALETTE.redDark;
  if (left >= 0 && left < VIEW_WIDTH) ctx.fillRect(left, 0, 3, VIEW_HEIGHT);
  if (right >= 0 && right < VIEW_WIDTH) ctx.fillRect(right - 3, 0, 3, VIEW_HEIGHT);
  if (top >= 0 && top < VIEW_HEIGHT) ctx.fillRect(0, top, VIEW_WIDTH, 3);
  if (bottom >= 0 && bottom < VIEW_HEIGHT) ctx.fillRect(0, bottom - 3, VIEW_WIDTH, 3);
}

function render() {
  ctx.imageSmoothingEnabled = false;
  const shakeX = screenShake ? Math.round((Math.random() - 0.5) * screenShake) : 0;
  const shakeY = screenShake ? Math.round((Math.random() - 0.5) * screenShake) : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawBackground();
  drawWorldBounds();
  drawAura();
  drawEffects();
  drawProjectiles();
  enemies.forEach(drawEnemy);
  drawOrbit();
  drawPlayer();

  const darkness = 0.05 + phase * 0.03;
  ctx.fillStyle = `rgba(3,2,8,${darkness})`;
  for (let y = 0; y < VIEW_HEIGHT; y += 8) {
    for (let x = 0; x < VIEW_WIDTH; x += 8) {
      if ((x / 8 + y / 8) % 5 === 0) ctx.fillRect(x, y, 2, 2);
    }
  }

  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(180,224,255,${flashAlpha})`;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }

  if (paused && running) {
    ctx.fillStyle = 'rgba(4,2,10,.74)';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    drawPixelLine(VIEW_WIDTH / 2 - 42, VIEW_HEIGHT / 2 - 8, VIEW_WIDTH / 2 + 42, VIEW_HEIGHT / 2 - 8, PALETTE.violetLight, 2);
    drawPixelLine(VIEW_WIDTH / 2 - 42, VIEW_HEIGHT / 2 + 8, VIEW_WIDTH / 2 + 42, VIEW_HEIGHT / 2 + 8, PALETTE.violetLight, 2);
  }
  ctx.restore();
}

function getBuildLabels() {
  const labels = [];
  const weapons = player.weapons;
  if (weapons.bolt.level) labels.push([weapons.bolt.evolved ? '星界长枪' : '星矢阵列', weapons.bolt.level, weapons.bolt.evolved]);
  if (weapons.orbit.level) labels.push([weapons.orbit.evolved ? '猩红月环' : '月轮刃', weapons.orbit.level, weapons.orbit.evolved]);
  if (weapons.aura.level) labels.push([weapons.aura.evolved ? '永冻星域' : '寒星领域', weapons.aura.level, weapons.aura.evolved]);
  if (weapons.chain.level) labels.push([weapons.chain.evolved ? '天罚星雷' : '星雷链', weapons.chain.level, weapons.chain.evolved]);
  return labels;
}

function updateUi() {
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const seconds = String(Math.floor(elapsed % 60)).padStart(2, '0');
  ui.time.textContent = `${minutes}:${seconds}`;
  ui.level.textContent = player.level;
  ui.kills.textContent = player.kills;
  ui.phase.textContent = PHASE_NAMES[phase];
  ui.threat.textContent = elapsed < 28 ? '低' : elapsed < 70 ? '中' : elapsed < 120 ? '高' : '灾厄';
  ui.healthText.textContent = `${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}`;
  ui.xpText.textContent = `${Math.floor(player.xp)} / ${player.nextXp}`;
  ui.novaText.textContent = player.novaTime ? `爆发 ${player.novaTime.toFixed(1)}s` : `${Math.floor(player.nova)}%`;
  ui.healthBar.style.width = `${Math.max(0, player.hp / player.maxHp * 100)}%`;
  ui.xpBar.style.width = `${Math.min(100, player.xp / player.nextXp * 100)}%`;
  ui.novaBar.style.width = `${player.novaTime ? 100 : player.nova}%`;
  ui.buildList.innerHTML = getBuildLabels().map(([name, level, evolved]) => `<span class="build-chip ${evolved ? 'evolved' : ''}">${name} Lv.${level}</span>`).join('');
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.033, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  if (!paused && !choosing) update(dt);
  render();
  animationFrame = requestAnimationFrame(loop);
}

function togglePause() {
  if (!running || choosing) return;
  paused = !paused;
  ui.pauseButton.textContent = paused ? '继续' : '暂停';
}

window.addEventListener('keydown', (event) => {
  keys.add(event.key);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  if (event.code === 'Space') dash();
  if (event.key.toLowerCase() === 'q') nova();
  if (event.key.toLowerCase() === 'p' || event.key === 'Escape') togglePause();
});
window.addEventListener('keyup', (event) => keys.delete(event.key));
window.addEventListener('resize', resizePixelCanvas);

document.querySelectorAll('.hero-card').forEach((button) => {
  button.addEventListener('click', () => {
    selectedHero = button.dataset.hero;
    document.querySelectorAll('.hero-card').forEach((item) => item.classList.toggle('selected', item === button));
  });
});

document.querySelector('#start-button').addEventListener('click', startGame);
document.querySelector('#restart-button').addEventListener('click', () => {
  hideOverlay(ui.gameOverScreen);
  startGame();
});
ui.pauseButton.addEventListener('click', togglePause);
ui.scaleButton.addEventListener('click', cycleScale);
ui.soundButton.addEventListener('click', () => {
  sound.enabled = !sound.enabled;
  ui.soundButton.textContent = `声音：${sound.enabled ? '开' : '关'}`;
  if (sound.enabled) sound.init();
});

resizePixelCanvas();
resetGame();
