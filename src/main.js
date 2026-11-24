import * as THREE from 'three';
import { createRenderer, createScene } from './engine/Renderer.js';
import { createCamera, updateCamera } from './engine/Camera.js';
import { GameLoop } from './engine/GameLoop.js';
import { Player } from './entities/Player.js';
import { EnemyFactory } from './entities/EnemyFactory.js';
import { InputManager } from './systems/InputManager.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { RoomManager } from './systems/RoomManager.js';
import { BoonSystem } from './systems/BoonSystem.js';
import { FXManager } from './systems/FXManager.js';
import { ProjectileManager } from './systems/ProjectileManager.js';
import { PlayerProjectileManager } from './systems/PlayerProjectileManager.js';
import { SoundManager } from './systems/SoundManager.js';
import { ElementalManager } from './systems/ElementalManager.js';
import { BiomeManager } from './systems/BiomeManager.js';
import { RoomObjects } from './systems/RoomObjects.js';
import { MetaProgression } from './systems/MetaProgression.js';
import { AltarUI } from './ui/AltarUI.js';
import { MenuUI } from './ui/MenuUI.js';
import { Enemy } from './entities/Enemy.js';
import { BoonUI } from './ui/BoonUI.js';
import { HUD } from './ui/HUD.js';

/* ═══════════════════════════════════════════
   SCENE & CURSED FOREST ATMOSPHERE
   ═══════════════════════════════════════════ */
const renderer = createRenderer();
const scene = createScene();
const camera = createCamera();

// Deep emerald night / dark teal Cursed Forest fog (#071412)
const FOREST_COLOR = 0x071412;
scene.background = new THREE.Color(FOREST_COLOR);
scene.fog = new THREE.FogExp2(FOREST_COLOR, 0.035);

/* ═══════════════════════════════════════════
   LIGHTING (Cool pale moonlight & mystical teal)
   ═══════════════════════════════════════════ */
const ambientLight = new THREE.AmbientLight(0x0e2825, 0.35);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0x18483f, 0x09170f, 0.3);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0x7ad6c8, 0.85);
dirLight.position.set(12, 18, 12);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -15;
dirLight.shadow.camera.right = 15;
dirLight.shadow.camera.top = 15;
dirLight.shadow.camera.bottom = -15;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);
scene.add(dirLight.target);

/* ═══════════════════════════════════════════
   MOSSY STONE & ANCIENT FOREST RUNIC FLOOR
   ═══════════════════════════════════════════ */
function createCursedForestFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#081713';
  ctx.fillRect(0, 0, 512, 512);

  const tileSize = 64;
  for (let x = 0; x < 512; x += tileSize) {
    for (let y = 0; y < 512; y += tileSize) {
      const greenVariation = 16 + Math.floor(Math.random() * 12);
      ctx.fillStyle = `rgb(${greenVariation - 6}, ${greenVariation + 10}, ${greenVariation + 4})`;
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

      ctx.strokeStyle = '#052219';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 12);
      ctx.lineTo(x + tileSize - 12, y + tileSize - 16);
      ctx.stroke();
    }
  }

  const cx = 256, cy = 256;
  ctx.strokeStyle = 'rgba(0, 255, 170, 0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 140, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 108, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(122, 255, 178, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const x = cx + Math.cos(angle) * 108;
    const y = cy + Math.sin(angle) * 108;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

const floorTex = createCursedForestFloorTexture();
const floorMat = new THREE.MeshStandardMaterial({
  map: floorTex,
  roughness: 0.8,
  metalness: 0.2,
});
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 16),
  floorMat
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

/* ═══════════════════════════════════════════
   PULSING TOXIC SWAMP / EMERALD RUNIC CRACKS
   ═══════════════════════════════════════════ */
function createEmeraldRuneCrackTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#04100d';
  ctx.fillRect(0, 0, 256, 32);

  ctx.strokeStyle = '#00ffaa';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 9;

  ctx.beginPath();
  ctx.moveTo(0, 16);
  for (let x = 10; x < 256; x += 15) {
    const y = 16 + (Math.sin(x * 0.12) * 8 + (Math.random() - 0.5) * 5);
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.strokeStyle = '#b9f6ca';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 16);
  for (let x = 10; x < 256; x += 25) {
    const y = 16 + (Math.sin(x * 0.12) * 5);
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

const runeCrackTex = createEmeraldRuneCrackTexture();
const runeCrackMaterial = new THREE.MeshStandardMaterial({
  map: runeCrackTex,
  emissive: 0x00ffaa,
  emissiveMap: runeCrackTex,
  emissiveIntensity: 2.2,
  roughness: 0.35,
});

const borderFissures = [
  { p: [0, 0.02, -7.5], s: [15.2, 0.7], rot: 0 },
  { p: [0, 0.02, 7.5], s: [15.2, 0.7], rot: 0 },
  { p: [-7.5, 0.02, 0], s: [15.2, 0.7], rot: Math.PI / 2 },
  { p: [7.5, 0.02, 0], s: [15.2, 0.7], rot: Math.PI / 2 },
];
borderFissures.forEach(({ p, s, rot }) => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s[0], s[1]), runeCrackMaterial);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rot;
  mesh.position.set(...p);
  scene.add(mesh);
});

/* ═══════════════════════════════════════════
   ANCIENT MOSSY STONE WALLS & GLOWING RUNES
   ═══════════════════════════════════════════ */
const wallMat = new THREE.MeshStandardMaterial({
  color: 0x0e241c,
  roughness: 0.9,
  metalness: 0.2,
});

const wallRuneMat = new THREE.MeshStandardMaterial({
  color: 0x00e676,
  emissive: 0x00ffaa,
  emissiveIntensity: 1.6,
  roughness: 0.3,
});

[
  { p: [0, 0.6, -8.15], s: [16.6, 1.2, 0.3] },
  { p: [0, 0.6, 8.15], s: [16.6, 1.2, 0.3] },
  { p: [-8.15, 0.6, 0], s: [0.3, 1.2, 16.6] },
  { p: [8.15, 0.6, 0], s: [0.3, 1.2, 16.6] },
].forEach(({ p, s }) => {
  const w = new THREE.Mesh(new THREE.BoxGeometry(...s), wallMat);
  w.position.set(...p);
  w.castShadow = true;
  w.receiveShadow = true;
  scene.add(w);

  const runeTrim = new THREE.Mesh(
    new THREE.BoxGeometry(s[0] === 0.3 ? 0.34 : s[0] * 0.96, 0.08, s[2] === 0.3 ? 0.34 : s[2] * 0.96),
    wallRuneMat
  );
  runeTrim.position.set(p[0], 0.75, p[2]);
  scene.add(runeTrim);
});

/* ═══════════════════════════════════════════
   SYSTEMS & WEAPON ARCHITECTURE
   ═══════════════════════════════════════════ */
const soundManager = new SoundManager();
const inputManager = new InputManager(renderer.domElement);
const fxManager = new FXManager(scene); // Fireflies / Embers / Spirit Crystals
const biomeManager = new BiomeManager(scene, {
  ambientLight,
  hemiLight,
  dirLight,
  floorMat,
  fissureMat: runeCrackMaterial,
  wallMat,
  wallRuneMat,
  fxManager,
  soundManager,
});
biomeManager.applyForRoom(1, false);
const enemyProjectileManager = new ProjectileManager(scene, fxManager);
const playerProjectileManager = new PlayerProjectileManager(scene, fxManager, soundManager);

const player = new Player(scene, soundManager, playerProjectileManager);
const enemyFactory = new EnemyFactory(scene, enemyProjectileManager);
const elementalManager = new ElementalManager(scene, soundManager, fxManager);
const combatSystem = new CombatSystem(fxManager, soundManager, elementalManager);
playerProjectileManager.setElemental(elementalManager, player);
enemyFactory.setSoundManager(soundManager);
const roomManager = new RoomManager();
const boonSystem = new BoonSystem();
const boonUI = new BoonUI(soundManager);
const hud = new HUD(soundManager, (weaponType) => player.switchWeapon(weaponType));

let gameState = 'menu'; // menu | playing | paused | boonSelect | victory | gameOver
let menuAngle = Math.PI / 4;
let worldTime = 0;
let clearTimer = 0;
let runShards = 0;
let isTransitioning = false;
let spawnDelayTimer = 0;

/* ═══════════════════════════════════════════
   META-PROGRESSION, ROOM OBJECTS & DAMAGE NUMBERS
   ═══════════════════════════════════════════ */
const meta = new MetaProgression();
const altarUI = new AltarUI(meta, soundManager, () => {
  hud.updateShards(meta.shards, runShards);
  menuUI.updateShards(meta.shards);
});
const roomObjects = new RoomObjects(scene, fxManager, soundManager, {
  onShard: (n) => {
    runShards += n;
    meta.addShards(n);
    hud.updateShards(meta.shards, runShards);
  },
});

Enemy.onDamage = (enemy, amount, crit, type = 'normal', from = null) => {
  const y = enemy.isBoss ? 5.2 : enemy.type === 'tank' ? 2.6 : 1.7;
  const p = enemy.mesh.position.clone();
  if (from) {
    // Sayıyı vuruşun geldiği tarafa doğru kaydır
    const dx = from.x - p.x;
    const dz = from.z - p.z;
    const k = (enemy.isBoss ? 1.6 : 0.4) / (Math.hypot(dx, dz) || 1);
    p.x += dx * k;
    p.z += dz * k;
  }
  fxManager.spawnDamageNumber(p, amount, crit, y, type);
};

player.applyMeta(meta.levels);

function cancelTransition() {
  isTransitioning = false;
  spawnDelayTimer = 0;
  player.transitionInvulnerable = false;
  biomeManager.cancelBanner();
}

function onRoomStarted(allowBanner = false) {
  clearTimer = 0;
  spawnDelayTimer = 0;

  const isBiomeChange = allowBanner && biomeManager.willChangeBiome(roomManager.roomNumber);
  if (isBiomeChange) {
    isTransitioning = true;
    player.transitionInvulnerable = true;
    clearInputState();
  } else {
    isTransitioning = false;
    player.transitionInvulnerable = false;
  }

  const biome = biomeManager.applyForRoom(roomManager.roomNumber, isBiomeChange, () => {
    if (!isBiomeChange) return;
    isTransitioning = false;
    player.transitionInvulnerable = false;
    clearInputState();
    // Geçiş yazısı tamamen kaybolduktan 1 saniye sonra düşmanlar doğsun
    spawnDelayTimer = 1.0;
  });

  hud.updateRoom(roomManager.roomNumber, biome);
  const boss = enemyFactory.getBoss();
  const avoid = boss ? [new THREE.Vector3(boss.mesh.position.x, 0, boss.mesh.position.z)] : [];
  roomObjects.populate(roomManager.roomNumber, roomManager.isBossRoom, avoid);
  hud.updateShards(meta.shards, runShards);
  if (roomManager.isBossRoom && boss) {
    hud.showBossBar(boss);
  } else {
    hud.hideBossBar();
  }
}

/* ═══════════════════════════════════════════
   ANA MENÜ, DURAKLATMA & OYUN AKIŞI
   ═══════════════════════════════════════════ */
const VOL_KEY = 'cursedForestVolume';
try {
  const saved = parseFloat(localStorage.getItem(VOL_KEY));
  if (!Number.isNaN(saved)) soundManager.setVolume(saved);
} catch (e) {
  /* yok say */
}

const menuUI = new MenuUI({
  soundManager,
  onStart: () => startRun(),
  onResume: () => resumeGame(),
  onMainMenu: () => enterMenu(),
  onVolume: (v) => {
    soundManager.setVolume(v);
    try {
      localStorage.setItem(VOL_KEY, String(v));
    } catch (e) {
      /* yok say */
    }
  },
  getVolume: () => (soundManager.volume ?? 0.7),
});

function clearInputState() {
  inputManager.keys.w = inputManager.keys.a = inputManager.keys.s = inputManager.keys.d = false;
  inputManager.spaceDown = false;
  inputManager.mouseLeftDown = false;
  inputManager.mouseRightDown = false;
  inputManager.clearTouchState();
  inputManager.resetFrame();
}

function startRun() {
  document.body.classList.remove('menu-mode');
  menuUI.hideMenu();
  restartGame();
}

function pauseGame() {
  if (gameState !== 'playing') return;
  gameState = 'paused';
  clearInputState();
  menuUI.showPause();
}

function resumeGame() {
  if (gameState !== 'paused') return;
  menuUI.hidePause();
  clearInputState();
  gameState = 'playing';
}

function enterMenu() {
  cancelTransition();
  hud.hideGameOver();
  document.getElementById('victory').classList.add('hidden');
  boonUI.hide();
  menuUI.hidePause();
  player.reset();
  enemyProjectileManager.clearAll();
  playerProjectileManager.clearAll();
  elementalManager.clearAll();
  enemyFactory.clearAll();
  roomObjects.clearRoom();
  roomManager.reset();
  boonSystem.reset();
  hud.reset();
  runShards = 0;
  biomeManager.applyForRoom(1, false);
  clearInputState();
  gameState = 'menu';
  document.body.classList.add('menu-mode');
  menuUI.showMenu(meta.shards);
}

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  if (menuUI.isHowtoOpen()) {
    menuUI.hideHowto();
  } else if (!document.getElementById('altar').classList.contains('hidden')) {
    altarUI.hide();
  } else if (gameState === 'playing') {
    pauseGame();
  } else if (gameState === 'paused') {
    resumeGame();
  }
});

document.getElementById('menu-btn-go').addEventListener('click', () => enterMenu());
const pauseBtn = document.getElementById('pause-btn');
if (pauseBtn) {
  pauseBtn.addEventListener('click', () => {
    if (gameState === 'playing') pauseGame();
    else if (gameState === 'paused') resumeGame();
  });
}

// Oyun ana menüde başlar: arka planda boş orman arenası, kamera yavaşça döner
document.body.classList.add('menu-mode');
menuUI.showMenu(meta.shards);
hud.updateShards(meta.shards, 0);

/* ═══════════════════════════════════════════
   GAME LOOP
   ═══════════════════════════════════════════ */
function tick(dt) {
  worldTime += dt;

  // Sound manager update (wind & forest echo ambience)
  soundManager.update(dt);

  // Pulse rune cracks, wall runes, and biome crystals
  const runePulse = 1.8 + Math.sin(worldTime * 3.0) * 0.55;
  runeCrackMaterial.emissiveIntensity = runePulse;
  wallRuneMat.emissiveIntensity = 1.3 + Math.sin(worldTime * 2.2) * 0.35;
  biomeManager.update(dt, worldTime);

  // Kamera yakınlaştırması: menüde geniş plan, oyunda normal
  const targetZoom = gameState === 'menu' ? 0.78 : 1;
  if (Math.abs(camera.zoom - targetZoom) > 0.002) {
    camera.zoom += (targetZoom - camera.zoom) * Math.min(1, dt * 2.5);
    camera.updateProjectionMatrix();
  }

  if (gameState === 'menu') {
    menuAngle += dt * 0.14;
    camera.position.set(
      Math.cos(menuAngle) * 22,
      16 + Math.sin(worldTime * 0.35),
      Math.sin(menuAngle) * 22,
    );
    camera.lookAt(0, 0.4, 0);
    fxManager.update(dt);
    inputManager.resetFrame();
    player.update(dt, inputManager);
    renderer.render(scene, camera);
    return;
  }

  if (gameState === 'paused') {
    renderer.render(scene, camera);
    return;
  }

  // Bölge geçişi aktifken düşman yapay zekası, saldırılar ve hasar kilitlidir
  if (isTransitioning) {
    fxManager.update(dt);
    updateCamera(camera, player.mesh.position, dt);
    dirLight.position.set(player.mesh.position.x + 12, 18, player.mesh.position.z + 12);
    dirLight.target.position.copy(player.mesh.position);
    inputManager.resetFrame();
    renderer.render(scene, camera);
    return;
  }

  // Visuals, camera & screen shake
  enemyFactory.update(dt, player.mesh.position, player, fxManager);
  enemyProjectileManager.update(dt, player);
  const targets = roomObjects.getTargets(enemyFactory.enemies);
  playerProjectileManager.update(dt, targets);
  fxManager.update(dt);
  updateCamera(camera, player.mesh.position, dt);
  camera.position.add(fxManager.shakeOffset);

  // Directional moonlight follows player
  dirLight.position.set(player.mesh.position.x + 12, 18, player.mesh.position.z + 12);
  dirLight.target.position.copy(player.mesh.position);

  if (gameState === 'playing') {
    // Bölge geçişi sonrası 1 saniyelik gecikmeli düşman doğuşu
    if (spawnDelayTimer > 0) {
      spawnDelayTimer -= dt;
      if (spawnDelayTimer <= 0 && roomManager.state === 'spawning') {
        const accent = biomeManager.currentBiome ? biomeManager.currentBiome.fissureEmissive : 0x00ffcc;
        roomManager.spawnRoomEnemies(enemyFactory, fxManager, accent);
        soundManager.playWeaponSwitch();
        const boss = enemyFactory.getBoss();
        if (roomManager.isBossRoom && boss) hud.showBossBar(boss);
      }
    }

    inputManager.update(camera);
    // Dokunmatik cihazlarda en yakın düşmana (yoksa bakış yönüne) otomatik nişan al
    if (inputManager.isTouchActive) {
      let best = null;
      let bestDist = 12.0;
      for (const e of enemyFactory.enemies) {
        if (!e.alive || e.isDecoy) continue;
        const d = e.mesh.position.distanceTo(player.mesh.position);
        if (d < bestDist) {
          bestDist = d;
          best = e.mesh.position;
        }
      }
      if (!best) {
        let bestPropDist = 4.5;
        for (const p of roomObjects.props) {
          if (!p.alive) continue;
          const d = p.mesh.position.distanceTo(player.mesh.position);
          if (d < bestPropDist) {
            bestPropDist = d;
            best = p.mesh.position;
          }
        }
      }
      if (best) {
        inputManager.setAutoAimTarget(best);
      } else {
        const ahead = player.mesh.position.clone();
        ahead.x += Math.sin(player.mesh.rotation.y) * 4;
        ahead.z += Math.cos(player.mesh.rotation.y) * 4;
        inputManager.setAutoAimTarget(ahead);
      }
    }
    player.update(dt, inputManager);
    combatSystem.update(dt, player, targets);
    elementalManager.update(dt, player, targets);

    // Ölen düşmanlardan ruh kristali / iksir düşür
    for (const e of enemyFactory.enemies) {
      if (!e.alive && !e._dropped) {
        e._dropped = true;
        roomObjects.onEnemyDied(e);
      }
    }
    roomObjects.update(dt, player, enemyFactory.enemies);
    if (roomManager.isBossRoom) hud.updateBossBar(enemyFactory.getBoss());

    hud.updateHp(player);
    hud.updateDash(player);
    hud.updateWeapons(player);

    // ── death check ──
    if (player.isDead()) {
      gameState = 'gameOver';
      const goShards = document.getElementById('go-shards');
      if (goShards) goShards.textContent = `Bu koşuda toplanan: 💎 ${runShards}  •  Toplam: 💎 ${meta.shards}`;
      hud.showGameOver(roomManager.roomNumber, restartGame);
    }
    // ── room clear check ──
    else if (
      roomManager.state === 'combat' &&
      enemyFactory.allDead() &&
      (clearTimer += dt) >= (roomManager.isBossRoom ? 2.2 : 1.3)
    ) {
      clearTimer = 0;
      roomObjects.collectRemainingShards();
      roomManager.state = 'cleared';
      gameState = 'boonSelect';
      enemyProjectileManager.clearAll();
      playerProjectileManager.clearAll();
      elementalManager.clearAll();

      if (roomManager.isBossRoom) {
        hud.hideBossBar();
        gameState = 'victory';
        soundManager.playVictory();
        hud.showVictory(roomManager.cycle + 1, () => {
          roomManager.cycle++;
          player.stats.hp = Math.min(
            player.stats.maxHp,
            player.stats.hp + Math.round(player.stats.maxHp * 0.5),
          );
          hud.updateHp(player);
          showBoonChoice();
        });
      } else {
        showBoonChoice();
      }
    }

    inputManager.resetFrame();
  }

  renderer.render(scene, camera);
}

function showBoonChoice() {
  gameState = 'boonSelect';
  const boons = boonSystem.getRandomBoons(3);
  boonUI.show(boons, (chosen) => {
    boonSystem.applyBoon(player, chosen);
    hud.addBoonIcon(chosen);
    const biomeChanging = biomeManager.willChangeBiome(roomManager.roomNumber + 1);
    roomManager.nextRoom(enemyFactory, player, { deferSpawn: biomeChanging });
    onRoomStarted(true);
    hud.updateHp(player);
    hud.updateDash(player);
    hud.updateWeapons(player);
    gameState = 'playing';
  });
}

function restartGame() {
  cancelTransition();
  player.reset();
  player.applyMeta(meta.levels);
  runShards = 0;
  enemyProjectileManager.clearAll();
  playerProjectileManager.clearAll();
  elementalManager.clearAll();
  enemyFactory.clearAll();
  roomManager.reset();
  boonSystem.reset();
  hud.reset();
  roomManager.setupRoom(enemyFactory, player);
  onRoomStarted();
  hud.updateHp(player);
  hud.updateDash(player);
  hud.updateWeapons(player);
  gameState = 'playing';
}

const loop = new GameLoop(tick);
loop.start();
