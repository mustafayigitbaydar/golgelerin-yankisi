import * as THREE from 'three';

export const BIOMES = {
  forest: {
    id: 'forest',
    index: 1,
    regionLabel: 'BÖLGE 1',
    name: 'LANETLİ ORMAN',
    bannerTitle: 'BÖLGE 1: LANETLİ ORMAN',
    bannerSub: 'Kadim Sislerin ve Zehirli Köklerin Diyarı',
    accentCss: '#4dffa0',
    fogColor: 0x071412,
    fogDensity: 0.035,
    ambientColor: 0x0e2825,
    ambientIntensity: 0.38,
    hemiSky: 0x18483f,
    hemiGround: 0x09170f,
    hemiIntensity: 0.32,
    dirColor: 0x7ad6c8,
    dirIntensity: 0.85,
    wallColor: 0x0e241c,
    wallRuneColor: 0x00e676,
    wallRuneEmissive: 0x00ffaa,
    fissureEmissive: 0x00ffaa,
    particlePalette: [0x00ffaa, 0x22ffbb, 0x00e5ff, 0x7affb2],
    particleSpeedMult: 1.0,
    pillarsVisible: false,
  },
  ash: {
    id: 'ash',
    index: 2,
    regionLabel: 'BÖLGE 2',
    name: 'KÜL VADİSİ',
    bannerTitle: 'BÖLGE 2: KÜL VADİSİ',
    bannerSub: 'Volkanik Kayaların ve Ebedi Lavların Diyarı',
    accentCss: '#ff8a3d',
    fogColor: 0x1d0805,
    fogDensity: 0.037,
    ambientColor: 0x3d140b,
    ambientIntensity: 0.44,
    hemiSky: 0x611e0d,
    hemiGround: 0x1c0704,
    hemiIntensity: 0.38,
    dirColor: 0xff9b54,
    dirIntensity: 0.95,
    wallColor: 0x22120f,
    wallRuneColor: 0xff5a00,
    wallRuneEmissive: 0xff3b00,
    fissureEmissive: 0xff4500,
    particlePalette: [0xff5500, 0xff8800, 0xffcc33, 0xff2200],
    particleSpeedMult: 1.75,
    pillarsVisible: false,
  },
  crystal: {
    id: 'crystal',
    index: 3,
    regionLabel: 'BÖLGE 3',
    name: 'KRİSTAL TAPINAK',
    bannerTitle: 'BÖLGE 3: KRİSTAL TAPINAK',
    bannerSub: 'Unutulmuş Rünlerin ve Sonsuz Boşluğun Tapınağı',
    accentCss: '#c98aff',
    fogColor: 0x09071c,
    fogDensity: 0.034,
    ambientColor: 0x1c1545,
    ambientIntensity: 0.46,
    hemiSky: 0x302570,
    hemiGround: 0x0c0822,
    hemiIntensity: 0.4,
    dirColor: 0xb8a3ff,
    dirIntensity: 0.92,
    wallColor: 0x15112e,
    wallRuneColor: 0xa252ff,
    wallRuneEmissive: 0xbc70ff,
    fissureEmissive: 0xb05cff,
    particlePalette: [0xc58bff, 0xe8d8ff, 0xffffff, 0x7b7dff],
    particleSpeedMult: 0.72,
    pillarsVisible: true,
  },
};

export function getBiomeForRoom(roomNumber) {
  if (roomNumber <= 5) return BIOMES.forest;
  if (roomNumber <= 10) return BIOMES.ash;
  return BIOMES.crystal;
}

/* ═══════════════ PROCEDURAL BIOME TEXTURES ═══════════════ */
function createFloorTexture(biomeId) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const tileSize = 64;

  if (biomeId === 'forest') {
    ctx.fillStyle = '#081713';
    ctx.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += tileSize) {
      for (let y = 0; y < 512; y += tileSize) {
        const v = 16 + Math.floor(Math.random() * 12);
        ctx.fillStyle = `rgb(${v - 6}, ${v + 10}, ${v + 4})`;
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
      const a = (i * Math.PI) / 3;
      const px = cx + Math.cos(a) * 108;
      const py = cy + Math.sin(a) * 108;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  } else if (biomeId === 'ash') {
    // Volcanic basalt & glowing magma cracks
    ctx.fillStyle = '#180907';
    ctx.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += tileSize) {
      for (let y = 0; y < 512; y += tileSize) {
        const v = 22 + Math.floor(Math.random() * 14);
        ctx.fillStyle = `rgb(${v + 12}, ${v - 2}, ${v - 6})`;
        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
        // Subtle magma cracks on some tiles
        if (Math.random() < 0.45) {
          ctx.strokeStyle = 'rgba(255, 90, 20, 0.48)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + 6, y + Math.random() * tileSize);
          ctx.lineTo(x + tileSize * 0.5, y + tileSize * 0.5 + (Math.random() - 0.5) * 18);
          ctx.lineTo(x + tileSize - 6, y + Math.random() * tileSize);
          ctx.stroke();
        }
      }
    }
    const cx = 256, cy = 256;
    ctx.strokeStyle = 'rgba(255, 100, 20, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 142, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 190, 40, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 102, 0, Math.PI * 2);
    ctx.stroke();

    // Radial lava veins
    ctx.strokeStyle = 'rgba(255, 65, 10, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 102, cy + Math.sin(a) * 102);
      ctx.lineTo(cx + Math.cos(a) * 230, cy + Math.sin(a) * 230);
      ctx.stroke();
    }
  } else {
    // Forgotten Crystal Temple: midnight obsidian slabs & glowing arcane runes
    ctx.fillStyle = '#09071a';
    ctx.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += tileSize) {
      for (let y = 0; y < 512; y += tileSize) {
        const v = 18 + Math.floor(Math.random() * 12);
        ctx.fillStyle = `rgb(${v}, ${v - 2}, ${v + 24})`;
        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
        ctx.strokeStyle = 'rgba(160, 110, 255, 0.14)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 6, y + 6, tileSize - 12, tileSize - 12);
      }
    }
    const cx = 256, cy = 256;
    ctx.strokeStyle = 'rgba(180, 110, 255, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 146, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(220, 200, 255, 0.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 112, 0, Math.PI * 2);
    ctx.stroke();

    // 8-point arcane star
    ctx.strokeStyle = 'rgba(155, 115, 255, 0.35)';
    ctx.lineWidth = 2;
    for (let offset = 0; offset < 2; offset++) {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + (offset * Math.PI) / 4;
        const px = cx + Math.cos(a) * 112;
        const py = cy + Math.sin(a) * 112;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

function createFissureTexture(biomeId) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  const styles = {
    forest: { bg: '#04100d', main: '#00ffaa', glow: '#00e5ff', core: '#b9f6ca' },
    ash: { bg: '#160502', main: '#ff4800', glow: '#ff9900', core: '#ffe082' },
    crystal: { bg: '#070418', main: '#aa55ff', glow: '#d8b4ff', core: '#ffffff' },
  };
  const s = styles[biomeId] || styles.forest;

  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, 256, 32);

  ctx.strokeStyle = s.main;
  ctx.lineWidth = 3;
  ctx.shadowColor = s.glow;
  ctx.shadowBlur = 9;

  ctx.beginPath();
  ctx.moveTo(0, 16);
  for (let x = 10; x < 256; x += 15) {
    const y = 16 + (Math.sin(x * 0.12) * 8 + (Math.random() - 0.5) * 5);
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.strokeStyle = s.core;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 16);
  for (let x = 10; x < 256; x += 25) {
    const y = 16 + Math.sin(x * 0.12) * 5;
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

/* ═══════════════ BIOME MANAGER ═══════════════ */
export class BiomeManager {
  constructor(scene, refs) {
    this.scene = scene;
    this.refs = refs; // { ambientLight, hemiLight, dirLight, floorMat, fissureMat, wallMat, wallRuneMat, fxManager, soundManager }
    this.currentBiome = null;
    this.bannerTimer = null;

    // Pre-generate textures for instant, hitch-free switching
    this.floorTextures = {
      forest: createFloorTexture('forest'),
      ash: createFloorTexture('ash'),
      crystal: createFloorTexture('crystal'),
    };
    this.fissureTextures = {
      forest: createFissureTexture('forest'),
      ash: createFissureTexture('ash'),
      crystal: createFissureTexture('crystal'),
    };

    // Ancient Crystal Temple Pillars (shown only in Biome 3)
    this.pillarGroup = this._createTemplePillars();
    this.pillarGroup.visible = false;
    scene.add(this.pillarGroup);
  }

  _createTemplePillars() {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x1b163a,
      roughness: 0.7,
      metalness: 0.25,
    });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xd8b4ff,
      emissive: 0xa252ff,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.2,
    });
    this.pillarCrystalMat = crystalMat;

    const baseGeo = new THREE.BoxGeometry(0.95, 0.4, 0.95);
    const colGeo = new THREE.CylinderGeometry(0.32, 0.38, 3.2, 6);
    const capGeo = new THREE.BoxGeometry(0.9, 0.28, 0.9);
    const crystalGeo = new THREE.OctahedronGeometry(0.36, 0);

    // Placed along the outer wall corners/edges so they never block arena movement
    const positions = [
      [-7.7, -7.7], [7.7, -7.7], [-7.7, 7.7], [7.7, 7.7],
      [0, -7.85], [0, 7.85], [-7.85, 0], [7.85, 0],
    ];

    this.floatingCrystals = [];
    for (const [x, z] of positions) {
      const p = new THREE.Group();
      p.position.set(x, 0, z);

      const base = new THREE.Mesh(baseGeo, stoneMat);
      base.position.y = 0.2;
      base.castShadow = true;
      base.receiveShadow = true;
      p.add(base);

      const col = new THREE.Mesh(colGeo, stoneMat);
      col.position.y = 1.9;
      col.castShadow = true;
      col.receiveShadow = true;
      p.add(col);

      const cap = new THREE.Mesh(capGeo, stoneMat);
      cap.position.y = 3.55;
      p.add(cap);

      const cry = new THREE.Mesh(crystalGeo, crystalMat);
      cry.position.y = 4.25;
      p.add(cry);
      this.floatingCrystals.push({ mesh: cry, phase: Math.random() * Math.PI * 2 });

      group.add(p);
    }

    return group;
  }

  willChangeBiome(roomNumber) {
    const target = getBiomeForRoom(roomNumber);
    return !this.currentBiome || this.currentBiome.id !== target.id;
  }

  applyForRoom(roomNumber, showBanner = false, onBannerDone = null) {
    const target = getBiomeForRoom(roomNumber);
    const changed = !this.currentBiome || this.currentBiome.id !== target.id;
    this.currentBiome = target;

    if (changed) {
      this._applyVisuals(target);
      if (this.refs.fxManager) this.refs.fxManager.setBiome(target);
      if (this.refs.soundManager) this.refs.soundManager.setBiome(target.id);
    }

    if (changed && showBanner) {
      this.showTransitionBanner(target, onBannerDone);
      if (this.refs.soundManager) this.refs.soundManager.playBiomeTransition(target.id);
    } else if (onBannerDone) {
      onBannerDone();
    }

    return target;
  }

  _applyVisuals(b) {
    this.scene.background.setHex(b.fogColor);
    this.scene.fog.color.setHex(b.fogColor);
    this.scene.fog.density = b.fogDensity;

    const { ambientLight, hemiLight, dirLight, floorMat, fissureMat, wallMat, wallRuneMat } = this.refs;
    ambientLight.color.setHex(b.ambientColor);
    ambientLight.intensity = b.ambientIntensity;
    hemiLight.color.setHex(b.hemiSky);
    hemiLight.groundColor.setHex(b.hemiGround);
    hemiLight.intensity = b.hemiIntensity;
    dirLight.color.setHex(b.dirColor);
    dirLight.intensity = b.dirIntensity;

    floorMat.map = this.floorTextures[b.id];
    floorMat.needsUpdate = true;

    fissureMat.map = this.fissureTextures[b.id];
    fissureMat.emissiveMap = this.fissureTextures[b.id];
    fissureMat.emissive.setHex(b.fissureEmissive);
    fissureMat.needsUpdate = true;

    wallMat.color.setHex(b.wallColor);
    wallRuneMat.color.setHex(b.wallRuneColor);
    wallRuneMat.emissive.setHex(b.wallRuneEmissive);

    this.pillarGroup.visible = b.pillarsVisible;
  }

  cancelBanner() {
    if (this.bannerTimer) {
      clearTimeout(this.bannerTimer);
      this.bannerTimer = null;
    }
    if (this.bannerFadeTimer) {
      clearTimeout(this.bannerFadeTimer);
      this.bannerFadeTimer = null;
    }
    const el = document.getElementById('biome-banner');
    if (el) {
      el.classList.remove('show', 'fade-out');
      el.classList.add('hidden');
    }
  }

  showTransitionBanner(biome, onDone = null) {
    this.cancelBanner();
    const el = document.getElementById('biome-banner');
    if (!el) {
      if (onDone) onDone();
      return;
    }
    const title = document.getElementById('biome-banner-title');
    const sub = document.getElementById('biome-banner-sub');
    if (title) {
      title.textContent = biome.bannerTitle;
      title.style.color = biome.accentCss;
      title.style.textShadow = `0 0 28px ${biome.accentCss}`;
    }
    if (sub) sub.textContent = biome.bannerSub;

    el.classList.remove('hidden', 'fade-out');
    // Restart animation cleanly
    void el.offsetWidth;
    el.classList.add('show');

    this.bannerTimer = setTimeout(() => {
      el.classList.remove('show');
      el.classList.add('fade-out');
      this.bannerFadeTimer = setTimeout(() => {
        el.classList.add('hidden');
        el.classList.remove('fade-out');
        this.bannerTimer = null;
        this.bannerFadeTimer = null;
        if (onDone) onDone();
      }, 900);
    }, 2400);
  }

  update(dt, worldTime) {
    if (this.pillarGroup.visible) {
      for (const c of this.floatingCrystals) {
        c.mesh.rotation.y += dt * 1.4;
        c.mesh.position.y = 4.25 + Math.sin(worldTime * 2.2 + c.phase) * 0.16;
      }
      if (this.pillarCrystalMat) {
        this.pillarCrystalMat.emissiveIntensity = 1.5 + Math.sin(worldTime * 3.0) * 0.45;
      }
    }
  }
}
