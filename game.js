const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;

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
};

const keys = new Set();
const TAU = Math.PI * 2;
const PHASE_NAMES = ['薄暮', '血月', '蚀夜', '无光'];

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
let backgroundSeed = [];

let player;
let enemies = [];
let projectiles = [];
let gems = [];
let particles = [];
let numbers = [];
let hazards = [];
let beams = [];

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

  tone(frequency, duration, type = 'sine', volume = 0.035, slide = 0) {
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

  shoot() { this.tone(360, 0.05, 'triangle', 0.018, 95); }
  hit() { this.tone(115, 0.04, 'square', 0.018, -35); }
  pickup() { this.tone(620, 0.07, 'sine', 0.018, 170); }
  level() { this.tone(440, 0.15, 'triangle', 0.03, 430); }
  dash() { this.tone(150, 0.12, 'sawtooth', 0.025, 260); }
  nova() { this.tone(90, 0.38, 'sawtooth', 0.05, 440); }
  boss() { this.tone(62, 0.65, 'square', 0.045, -10); }
}

const sound = new SoundEngine();

const heroStats = {
  astrologer: { maxHp: 92, speed: 220, damage: 1.22, cooldown: 0.84, armor: 0, crit: 0.06, dashCooldown: 2.5, boltLevel: 2 },
  warden: { maxHp: 148, speed: 194, damage: 0.98, cooldown: 1, armor: 5, crit: 0.03, dashCooldown: 3.1, boltLevel: 1 },
  ranger: { maxHp: 104, speed: 258, damage: 1, cooldown: 0.93, armor: 1, crit: 0.18, dashCooldown: 1.85, boltLevel: 1 },
};

function resetGame() {
  const stats = heroStats[selectedHero];
  player = {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    radius: 15,
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
    magnet: 82,
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
  createBackground();
  hideOverlay(ui.upgradeScreen);
  hideOverlay(ui.gameOverScreen);
  ui.pauseButton.textContent = '暂停';
  ui.statusMessage.textContent = '星火已点燃。';
  updateUi();
  render();
}

function createBackground() {
  backgroundSeed = [];
  const types = ['star', 'stone', 'grass', 'crystal'];
  for (let i = 0; i < 92; i += 1) {
    backgroundSeed.push({
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
      type: types[Math.floor(Math.random() * types.length)],
      size: 1 + Math.random() * 3,
      rotation: Math.random() * TAU,
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
  requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  ui.gameOverStats.textContent = `生存 ${Math.floor(elapsed)} 秒，达到 ${player.level} 级，击败 ${player.kills} 名夜行者。`;
  showOverlay(ui.gameOverScreen);
}

function spawnPoint() {
  const margin = 42;
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return [Math.random() * WORLD_WIDTH, -margin];
  if (edge === 1) return [WORLD_WIDTH + margin, Math.random() * WORLD_HEIGHT];
  if (edge === 2) return [Math.random() * WORLD_WIDTH, WORLD_HEIGHT + margin];
  return [-margin, Math.random() * WORLD_HEIGHT];
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
    wisp: { radius: 12, hp: 32, speed: 60, damage: 14, xp: 5 },
    bat: { radius: 10, hp: 22, speed: 108, damage: 10, xp: 4 },
    brute: { radius: 21, hp: 118, speed: 38, damage: 23, xp: 12 },
    seer: { radius: 15, hp: 65, speed: 43, damage: 14, xp: 9 },
    boss: { radius: 42, hp: 980 + phase * 650, speed: 30, damage: 34, xp: 120 },
  }[type];

  const scale = (1 + elapsed / 95) * (elite ? 2.1 : 1) * difficulty;
  enemies.push({
    id: entityId++, x, y, type, elite,
    radius: config.radius * (elite ? 1.14 : 1),
    hp: config.hp * scale,
    maxHp: config.hp * scale,
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
  screenShake = 14;
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

function createParticle(x, y, color, count = 8, speed = 110, life = 0.45) {
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
      size: 1 + Math.random() * 3,
    });
  }
}

function damageEnemy(enemy, rawDamage) {
  const critical = Math.random() < player.crit;
  const damage = rawDamage * (critical ? 1.9 : 1);
  enemy.hp -= damage;
  enemy.hitFlash = 0.08;
  numbers.push({ x: enemy.x, y: enemy.y - enemy.radius, value: Math.round(damage), critical, life: 0.55 });
  createParticle(enemy.x, enemy.y, critical ? '#ffd166' : '#bda8ff', critical ? 12 : 6, 95);
  sound.hit();

  if (enemy.hp > 0) return false;

  player.kills += 1;
  player.nova = Math.min(100, player.nova + (enemy.elite ? 9 : 2));
  const gemCount = enemy.elite ? 8 : enemy.type === 'brute' ? 3 : 1;
  for (let i = 0; i < gemCount; i += 1) {
    gems.push({
      x: enemy.x + (Math.random() - 0.5) * 22,
      y: enemy.y + (Math.random() - 0.5) * 22,
      value: enemy.xp / gemCount,
      radius: enemy.elite ? 6 : 4,
      phase: Math.random() * TAU,
    });
  }
  createParticle(enemy.x, enemy.y, enemy.elite ? '#ffd166' : '#ff668a', enemy.elite ? 34 : 15, enemy.elite ? 190 : 130, 0.7);
  screenShake = Math.max(screenShake, enemy.elite ? 15 : 3);
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
      vx: Math.cos(shotAngle) * (475 + weapon.level * 18),
      vy: Math.sin(shotAngle) * (475 + weapon.level * 18),
      radius: weapon.evolved ? 9 : 6,
      damage: (18 + weapon.level * 8) * player.damageMultiplier * (player.novaTime ? 1.35 : 1),
      pierce: Math.floor(weapon.level / 3) + (weapon.evolved ? 3 : 0),
      life: 2.1,
      color: weapon.evolved ? '#79e6ff' : '#bda8ff',
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
  const radius = 58 + weapon.level * 5;
  const hitEnemies = new Set();
  for (let i = 0; i < count; i += 1) {
    const angle = weapon.angle + i * TAU / count;
    const bladeX = player.x + Math.cos(angle) * radius;
    const bladeY = player.y + Math.sin(angle) * radius;
    for (const enemy of [...enemies]) {
      if (hitEnemies.has(enemy.id)) continue;
      if (Math.hypot(enemy.x - bladeX, enemy.y - bladeY) < enemy.radius + 11) {
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
  const radius = 76 + weapon.level * 14;
  for (const enemy of [...enemies]) {
    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < radius + enemy.radius) {
      damageEnemy(enemy, (6 + weapon.level * 4) * player.damageMultiplier);
      enemy.speed = Math.max(16, enemy.speed * (weapon.evolved ? 0.9 : 0.97));
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
  ui.statusMessage.textContent = `首领战利品：${relic.name}`;
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
  screenShake = Math.max(screenShake, 4);
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
  createParticle(player.x, player.y, '#79e6ff', 18, 180, 0.35);
  sound.dash();
}

function nova() {
  if (!running || paused || choosing || player.nova < 100) return;
  player.nova = 0;
  player.novaTime = 6;
  flashAlpha = 0.3;
  screenShake = 13;
  for (const enemy of [...enemies]) {
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance < 270) damageEnemy(enemy, 45 * player.damageMultiplier * (1 - distance / 540));
  }
  createParticle(player.x, player.y, '#79e6ff', 56, 310, 0.85);
  ui.statusMessage.textContent = '星爆释放：六秒内伤害、攻速与移动速度提高。';
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
  const movementSpeed = player.dashTime ? 760 : player.speed * (player.novaTime ? 1.3 : 1);
  player.x += (player.dashTime ? player.facingX : moveX / moveLength) * movementSpeed * dt;
  player.y += (player.dashTime ? player.facingY : moveY / moveLength) * movementSpeed * dt;
  player.x = Math.max(player.radius, Math.min(WORLD_WIDTH - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(WORLD_HEIGHT - player.radius, player.y));

  if (player.dashTime) {
    particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, color: '#9f7aea', life: 0.22, maxLife: 0.22, size: 13, ghost: true });
  }

  spawnClock -= dt;
  if (spawnClock <= 0) {
    const batch = elapsed > 82 ? 3 : elapsed > 34 ? 2 : 1;
    for (let i = 0; i < batch; i += 1) spawnEnemy(null, elapsed > 25 && Math.random() < 0.035);
    spawnClock = Math.max(0.18, (0.9 - elapsed / 260) / difficulty);
  }

  hazardClock -= dt;
  if (hazardClock <= 0) {
    if (phase > 0) hazards.push({ x: 75 + Math.random() * 810, y: 65 + Math.random() * 410, radius: 50 + phase * 7, timer: 1.55, exploded: false });
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
    projectile.trail?.push({ x: projectile.x, y: projectile.y, life: 0.16 });
    if (projectile.trail?.length > 8) projectile.trail.shift();
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

    if (remove || projectile.x < -60 || projectile.x > WORLD_WIDTH + 60 || projectile.y < -60 || projectile.y > WORLD_HEIGHT + 60) {
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
      projectiles.push({ kind: 'enemy', x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 175, vy: Math.sin(angle) * 175, radius: 7, damage: enemy.damage, life: 4, color: '#ff6b8a', trail: [] });
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
      const speed = 190 + (player.magnet - distance) * 4;
      gem.x += dx / distance * speed * dt;
      gem.y += dy / distance * speed * dt;
    }
    if (distance < player.radius + gem.radius + 5) {
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
    particle.vx *= 0.95;
    particle.vy *= 0.95;
    particle.life -= dt;
    if (particle.life <= 0) particles.splice(i, 1);
  }
  for (let i = numbers.length - 1; i >= 0; i -= 1) {
    numbers[i].y -= 28 * dt;
    numbers[i].life -= dt;
    if (numbers[i].life <= 0) numbers.splice(i, 1);
  }
  for (let i = beams.length - 1; i >= 0; i -= 1) {
    beams[i].life -= dt;
    if (beams[i].life <= 0) beams.splice(i, 1);
  }
  screenShake = Math.max(0, screenShake - dt * 30);
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
      createParticle(hazard.x, hazard.y, '#ff6b8a', 30, 180, 0.6);
    } else if (hazard.exploded && hazard.timer <= 0) hazards.splice(i, 1);
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, '#171027');
  gradient.addColorStop(1, '#0c0914');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.strokeStyle = 'rgba(160,135,211,.055)';
  ctx.lineWidth = 1;
  const gridSize = 48;
  const offsetX = (elapsed * 6) % gridSize;
  const offsetY = (elapsed * 3) % gridSize;
  for (let x = -gridSize + offsetX; x < WORLD_WIDTH + gridSize; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_HEIGHT); ctx.stroke();
  }
  for (let y = -gridSize + offsetY; y < WORLD_HEIGHT + gridSize; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_WIDTH, y); ctx.stroke();
  }

  for (const decoration of backgroundSeed) drawDecoration(decoration);

  const vignette = ctx.createRadialGradient(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 120, WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 580);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.58)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawDecoration(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation);
  if (item.type === 'star') {
    ctx.fillStyle = 'rgba(121,230,255,.16)';
    ctx.fillRect(-item.size, -1, item.size * 2, 2);
    ctx.fillRect(-1, -item.size, 2, item.size * 2);
  } else if (item.type === 'stone') {
    ctx.fillStyle = 'rgba(101,90,129,.16)';
    ctx.fillRect(-item.size * 2, -item.size, item.size * 4, item.size * 2);
  } else if (item.type === 'grass') {
    ctx.strokeStyle = 'rgba(90,126,111,.18)';
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(-3, -4); ctx.moveTo(0, 2); ctx.lineTo(2, -5); ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(159,122,234,.13)';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4, 2); ctx.lineTo(0, 5); ctx.lineTo(-4, 2); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawShadow(x, y, radius, alpha = 0.3) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.65, radius * 0.9, radius * 0.36, 0, 0, TAU);
  ctx.fill();
}

function drawPlayer() {
  const blink = player.invulnerable > 0 && Math.floor(elapsed * 24) % 2 === 0;
  if (blink) return;
  drawShadow(player.x, player.y, player.radius, 0.42);

  const aura = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, 58);
  aura.addColorStop(0, player.novaTime ? 'rgba(121,230,255,.32)' : 'rgba(159,122,234,.23)');
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(player.x, player.y, 58, 0, TAU); ctx.fill();

  ctx.save();
  ctx.translate(player.x, player.y);
  const bob = Math.sin(elapsed * 7) * 1.5;
  ctx.translate(0, bob);

  if (selectedHero === 'warden') {
    ctx.fillStyle = '#665a83';
    ctx.fillRect(-12, -8, 24, 23);
    ctx.fillStyle = '#9b8cbd';
    ctx.fillRect(-10, -15, 20, 14);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-2, -12, 4, 16);
    ctx.fillStyle = '#2b203d';
    ctx.fillRect(-7, -10, 4, 3); ctx.fillRect(3, -10, 4, 3);
  } else if (selectedHero === 'ranger') {
    ctx.fillStyle = '#34244e';
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(13, 12); ctx.lineTo(-13, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#79e6ff';
    ctx.fillRect(-9, -8, 18, 3);
    ctx.fillRect(7, -2, 11, 3);
    ctx.fillStyle = '#f2d5c4';
    ctx.fillRect(-5, -12, 10, 9);
  } else {
    ctx.fillStyle = '#51357f';
    ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(15, 13); ctx.lineTo(-15, 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a98cff';
    ctx.fillRect(-11, -5, 22, 13);
    ctx.fillStyle = '#f2d5c4';
    ctx.fillRect(-5, -13, 10, 9);
    ctx.fillStyle = '#79e6ff';
    ctx.fillRect(-2, -10, 4, 4);
  }
  ctx.restore();
}

function drawEnemy(enemy) {
  drawShadow(enemy.x, enemy.y, enemy.radius, enemy.type === 'boss' ? 0.55 : 0.35);
  ctx.save();
  ctx.translate(enemy.x, enemy.y + Math.sin(enemy.pulse) * (enemy.type === 'bat' ? 4 : 1.5));
  const flash = enemy.hitFlash > 0;

  if (enemy.elite) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7 + Math.sin(enemy.pulse * 2) * 0.2;
    ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 6, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (enemy.type === 'wisp') {
    ctx.fillStyle = flash ? '#fff' : '#d95779';
    ctx.beginPath(); ctx.arc(0, -2, enemy.radius, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-enemy.radius, 2); ctx.lineTo(-5, enemy.radius + 8); ctx.lineTo(0, enemy.radius); ctx.lineTo(6, enemy.radius + 7); ctx.lineTo(enemy.radius, 2); ctx.fill();
    ctx.fillStyle = '#241329'; ctx.fillRect(-6, -5, 3, 4); ctx.fillRect(3, -5, 3, 4);
  } else if (enemy.type === 'bat') {
    ctx.fillStyle = flash ? '#fff' : '#9382b4';
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(18, -3); ctx.lineTo(10, 9); ctx.lineTo(2, 4); ctx.lineTo(-2, 4); ctx.lineTo(-10, 9); ctx.lineTo(-18, -3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff668a'; ctx.fillRect(-5, -4, 3, 3); ctx.fillRect(2, -4, 3, 3);
  } else if (enemy.type === 'brute') {
    ctx.fillStyle = flash ? '#fff' : '#6f4c67';
    ctx.fillRect(-enemy.radius, -enemy.radius + 4, enemy.radius * 2, enemy.radius * 2 - 4);
    ctx.fillStyle = '#a46c7f';
    ctx.fillRect(-15, -22, 30, 17);
    ctx.fillStyle = '#ffd166'; ctx.fillRect(-9, -15, 5, 4); ctx.fillRect(4, -15, 5, 4);
    ctx.fillStyle = '#342137'; ctx.fillRect(-24, -5, 7, 18); ctx.fillRect(17, -5, 7, 18);
  } else if (enemy.type === 'seer') {
    ctx.fillStyle = flash ? '#fff' : '#733c77';
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(16, 16); ctx.lineTo(-16, 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8da8'; ctx.beginPath(); ctx.arc(0, -7, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1430'; ctx.beginPath(); ctx.arc(0, -7, 2, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = flash ? '#fff' : '#aa416d';
    ctx.beginPath(); ctx.arc(0, 0, enemy.radius, 0, TAU); ctx.fill();
    ctx.fillStyle = '#56223e';
    ctx.beginPath(); ctx.moveTo(-25, -25); ctx.lineTo(-12, -48); ctx.lineTo(-2, -24); ctx.moveTo(25, -25); ctx.lineTo(12, -48); ctx.lineTo(2, -24); ctx.fill();
    ctx.fillStyle = '#ffd166'; ctx.fillRect(-15, -8, 8, 6); ctx.fillRect(7, -8, 8, 6);
    ctx.fillStyle = '#311226'; ctx.fillRect(-18, 8, 36, 8);
  }

  if (enemy.type === 'boss' || enemy.elite) {
    const width = enemy.radius * 2.2;
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(-width / 2, enemy.radius + 9, width, 5);
    ctx.fillStyle = enemy.type === 'boss' ? '#ff6b8a' : '#ffd166';
    ctx.fillRect(-width / 2, enemy.radius + 9, width * Math.max(0, enemy.hp / enemy.maxHp), 5);
  }
  ctx.restore();
}

function drawProjectiles() {
  for (const projectile of projectiles) {
    if (projectile.trail) {
      projectile.trail.forEach((point, index) => {
        ctx.globalAlpha = (index + 1) / projectile.trail.length * 0.22;
        ctx.fillStyle = projectile.color;
        ctx.beginPath(); ctx.arc(point.x, point.y, projectile.radius * 0.65, 0, TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    const glow = ctx.createRadialGradient(projectile.x, projectile.y, 1, projectile.x, projectile.y, projectile.radius * 3.5);
    glow.addColorStop(0, projectile.color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.radius * 3.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.radius * 0.55, 0, TAU); ctx.fill();
  }
}

function drawOrbit() {
  const weapon = player.weapons.orbit;
  if (!weapon.level) return;
  const count = Math.min(7, weapon.level + 1);
  const radius = 58 + weapon.level * 5;
  for (let i = 0; i < count; i += 1) {
    const angle = weapon.angle + i * TAU / count;
    const x = player.x + Math.cos(angle) * radius;
    const y = player.y + Math.sin(angle) * radius;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = weapon.evolved ? '#ff6b8a' : '#d8ccff';
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, 4); ctx.lineTo(0, 10); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawAura() {
  const weapon = player.weapons.aura;
  if (!weapon.level) return;
  const radius = 76 + weapon.level * 14;
  const aura = ctx.createRadialGradient(player.x, player.y, 20, player.x, player.y, radius);
  aura.addColorStop(0, weapon.evolved ? 'rgba(121,230,255,.12)' : 'rgba(159,122,234,.08)');
  aura.addColorStop(0.78, weapon.evolved ? 'rgba(121,230,255,.08)' : 'rgba(159,122,234,.05)');
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(player.x, player.y, radius, 0, TAU); ctx.fill();
  ctx.strokeStyle = weapon.evolved ? 'rgba(121,230,255,.28)' : 'rgba(196,167,255,.18)';
  ctx.beginPath(); ctx.arc(player.x, player.y, radius * (0.86 + Math.sin(elapsed * 2) * 0.03), 0, TAU); ctx.stroke();
}

function drawEffects() {
  for (const hazard of hazards) {
    ctx.fillStyle = hazard.exploded ? 'rgba(255,107,138,.34)' : 'rgba(255,107,138,.11)';
    ctx.beginPath(); ctx.arc(hazard.x, hazard.y, hazard.radius, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,107,138,.72)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hazard.x, hazard.y, hazard.radius * (0.75 + Math.sin(elapsed * 10) * 0.05), 0, TAU); ctx.stroke();
  }

  for (const beam of beams) {
    ctx.globalAlpha = Math.min(1, beam.life * 8);
    ctx.strokeStyle = '#79e6ff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(beam.x1, beam.y1); ctx.lineTo((beam.x1 + beam.x2) / 2 + Math.random() * 14 - 7, (beam.y1 + beam.y2) / 2 + Math.random() * 14 - 7); ctx.lineTo(beam.x2, beam.y2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (const gem of gems) {
    ctx.save(); ctx.translate(gem.x, gem.y + Math.sin(gem.phase) * 2); ctx.rotate(gem.phase * 0.6);
    ctx.fillStyle = '#79e6ff';
    ctx.beginPath(); ctx.moveTo(0, -gem.radius); ctx.lineTo(gem.radius, 0); ctx.lineTo(0, gem.radius); ctx.lineTo(-gem.radius, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife) * (particle.ghost ? 0.25 : 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const number of numbers) {
    ctx.globalAlpha = Math.max(0, number.life / 0.55);
    ctx.fillStyle = number.critical ? '#ffd166' : '#f8f3ff';
    ctx.font = `${number.critical ? 800 : 600} ${number.critical ? 15 : 12}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(number.critical ? `✦ ${number.value}` : number.value, number.x, number.y);
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.save();
  const shakeX = screenShake ? (Math.random() - 0.5) * screenShake : 0;
  const shakeY = screenShake ? (Math.random() - 0.5) * screenShake : 0;
  ctx.translate(shakeX, shakeY);

  drawBackground();
  drawAura();
  drawEffects();
  drawProjectiles();
  enemies.forEach(drawEnemy);
  drawOrbit();
  drawPlayer();

  const lightMask = ctx.createRadialGradient(player.x, player.y, 80, player.x, player.y, 350);
  lightMask.addColorStop(0, 'rgba(0,0,0,0)');
  lightMask.addColorStop(1, `rgba(4,2,10,${0.18 + phase * 0.06})`);
  ctx.fillStyle = lightMask;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(180,224,255,${flashAlpha})`;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  if (paused && running) {
    ctx.fillStyle = 'rgba(4,2,10,.6)';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.fillStyle = '#f6f4ff';
    ctx.font = '700 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('时间被冻结', WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
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
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  keys.add(event.key);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  if (event.code === 'Space') dash();
  if (event.key.toLowerCase() === 'q') nova();
  if (event.key.toLowerCase() === 'p' || event.key === 'Escape') togglePause();
});
window.addEventListener('keyup', (event) => keys.delete(event.key));

function togglePause() {
  if (!running || choosing) return;
  paused = !paused;
  ui.pauseButton.textContent = paused ? '继续' : '暂停';
}

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
ui.soundButton.addEventListener('click', () => {
  sound.enabled = !sound.enabled;
  ui.soundButton.textContent = `声音：${sound.enabled ? '开' : '关'}`;
  if (sound.enabled) sound.init();
});

resetGame();
