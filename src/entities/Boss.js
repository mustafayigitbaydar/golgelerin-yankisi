import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Enemy } from './Enemy.js';

const BOUND = 7.2;
const UP = new THREE.Vector3(0, 1, 0);

function flatMat(color, opacity = 0.6) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function disposeObject(obj) {
  obj.traverse((c) => {
    if (c.isMesh) {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  });
}

/* ═══════════════════════════════════════════
   Gölge Klonu (hedef alınabilir sahte kopya)
   ═══════════════════════════════════════════ */
class Decoy {
  constructor(scene, template, pos, scale, color) {
    this.scene = scene;
    this.type = 'decoy';
    this.isDecoy = true;
    this.alive = true;
    this.readyToRemove = false;
    this.deathTimer = 0;
    this.stats = { hp: 1, maxHp: 1, knockbackResistance: 0 };
    this.knockbackVel = new THREE.Vector3();
    this.modelMaterials = [];

    this.mesh = new THREE.Group();
    this.mesh.position.copy(pos);
    this.mesh.scale.setScalar(scale);
    this.container = new THREE.Group();
    this.mesh.add(this.container);

    if (template) {
      template.scale.setScalar(1.22);
      template.rotation.y = Math.PI;
      template.traverse((c) => {
        if (c.isMesh && c.material) {
          c.material = c.material.clone();
          if (c.material.metalness !== undefined) c.material.metalness = Math.min(c.material.metalness, 0.1);
          if (c.material.roughness !== undefined) c.material.roughness = Math.max(c.material.roughness, 0.65);
          c.material.transparent = true;
          c.material.opacity = 0.62;
          if (c.material.emissive) c.material.emissive.setHex(color).multiplyScalar(0.35);
          this.modelMaterials.push(c.material);
        }
      });
      this.container.add(template);
    } else {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.9, 0.6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }),
      );
      m.position.y = 0.45;
      this.container.add(m);
      this.modelMaterials.push(m.material);
    }
    scene.add(this.mesh);
  }

  takeDamage() {
    this.stats.hp = 0;
    this.pop();
  }

  pop() {
    if (!this.alive) return;
    this.alive = false;
    this.deathTimer = 0.3;
  }

  update(dt, playerPos) {
    if (!this.alive) {
      this.deathTimer -= dt;
      const s = Math.max(0, this.deathTimer / 0.3);
      this.container.scale.setScalar(s);
      for (const m of this.modelMaterials) m.opacity = 0.62 * s;
      if (this.deathTimer <= 0) this.readyToRemove = true;
      return;
    }
    const dx = playerPos.x - this.mesh.position.x;
    const dz = playerPos.z - this.mesh.position.z;
    if (dx * dx + dz * dz > 0.01) this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  dispose() {
    this.scene.remove(this.mesh);
    for (const m of this.modelMaterials) m.dispose();
  }
}

/* ═══════════════════════════════════════════
   Boss taban sınıfı
   ═══════════════════════════════════════════ */
class BossBase extends Enemy {
  constructor(scene, position, difficulty, projectileManager, modelTemplate, soundManager, cfg) {
    super(scene, position, 'boss', {}, projectileManager, modelTemplate);

    this.isBoss = true;
    this.soundManager = soundManager;
    this.difficulty = difficulty;
    this.cfg = cfg;
    this.bossName = cfg.name;
    this.bossTitle = cfg.title;
    this.theme = cfg.theme;
    this.factory = null;
    this.models = null;
    this.fx = null;

    const maxHp = Math.round(cfg.hp * difficulty);
    this.stats.maxHp = maxHp;
    this.stats.hp = maxHp;
    this.stats.damage = Math.round(cfg.damage * difficulty);
    this.stats.speed = cfg.speed;
    this.stats.knockbackResistance = 0.02;

    this.mesh.scale.setScalar(cfg.scale);
    this.hpSprite.visible = false;

    this.auraBase = 5.0;
    this.auraLight.color.setHex(cfg.theme.hex);
    this.auraLight.intensity = this.auraBase;
    this.auraLight.distance = 15;
    this.auraLight.position.set(0, 1.2, 0);

    this.state = 'intro';
    this.stateTimer = 1.6;
    this.attackTimer = 2.0;
    this.attackIdx = 0;
    this.phase2 = false;
    this.hazards = [];
    this.lineMeshes = [];
    this._introPlayed = false;
    this._baseEmissive = cfg.theme.emissive;

    // Zemindeki element aurası
    this.auraRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 48), flatMat(cfg.theme.hex, 0.55));
    this.auraRing.rotation.x = -Math.PI / 2;
    scene.add(this.auraRing);
    this.auraDisc = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), flatMat(cfg.theme.hex, 0.14));
    this.auraDisc.rotation.x = -Math.PI / 2;
    scene.add(this.auraDisc);

    this._applyTint();
  }

  attachModel(clonedModel) {
    const t = this.type;
    this.type = 'tank';
    super.attachModel(clonedModel);
    this.type = t;
    if (this.theme) this._applyTint();
  }

  _applyTint() {
    for (const m of this.modelMaterials) if (m.emissive) m.emissive.setHex(this._baseEmissive);
  }

  _setEmissive(hex) {
    for (const m of this.modelMaterials) if (m.emissive) m.emissive.setHex(hex);
  }

  introSound() {}
  canTurn() {
    return this.state === 'chase' || this.state === 'intro';
  }
  ai() {}
  onPhase2() {}
  onDeath() {}

  /* ---------- yardımcılar ---------- */
  hitPlayer(player, dmg, shake = 0.3) {
    if (!player || player.isDead() || player.invincible) return false;
    player.takeDamage(Math.round(dmg));
    if (this.fx) this.fx.screenShake(shake, 0.25);
    return true;
  }

  _chaseMove(dt, toPlayer, dist, stopDist, mult = 1) {
    if (dist > stopDist && toPlayer.lengthSq() > 0.001) {
      const d = toPlayer.clone().normalize();
      this.mesh.position.addScaledVector(d, this.stats.speed * mult * dt);
    }
  }

  makeLine(color) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, flatMat(color, 0));
    m.position.y = 0.07;
    m.visible = false;
    this.scene.add(m);
    this.lineMeshes.push(m);
    return m;
  }

  setLine(line, origin, dir, length, width, opacity) {
    line.visible = true;
    line.position.set(origin.x + (dir.x * length) / 2, 0.07, origin.z + (dir.z * length) / 2);
    line.rotation.y = Math.atan2(dir.x, dir.z);
    line.scale.set(width, 1, length);
    line.material.opacity = opacity;
  }

  hideLines() {
    for (const l of this.lineMeshes) l.visible = false;
  }

  addHazard(h) {
    this.hazards.push(h);
    this.scene.add(h.mesh);
  }

  _updateHazards(dt, player) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.life -= dt;
      if (h.update) h.update(dt, h, player);
      if (h.life <= 0) {
        this.scene.remove(h.mesh);
        disposeObject(h.mesh);
        this.hazards.splice(i, 1);
        if (h.onEnd) h.onEnd(h);
      }
    }
  }

  _clearHazards() {
    for (const h of this.hazards) {
      this.scene.remove(h.mesh);
      disposeObject(h.mesh);
    }
    this.hazards = [];
  }

  _updateAura() {
    const p = Math.sin(this.animTime * 3);
    this.auraLight.intensity = this.auraBase + p * 0.9;
    this.auraRing.position.set(this.mesh.position.x, 0.05, this.mesh.position.z);
    this.auraDisc.position.set(this.mesh.position.x, 0.04, this.mesh.position.z);
    const s = this.cfg.scale * 0.8 + p * 0.15;
    this.auraRing.scale.setScalar(s);
    this.auraDisc.scale.setScalar(s);
    this.auraRing.rotation.z += 0.01;
  }

  /* ---------- ana güncelleme ---------- */
  update(dt, playerPos, player, fxManager) {
    this.animTime += dt;
    this.fx = fxManager;

    if (!this.alive) {
      this.auraRing.visible = false;
      this.auraDisc.visible = false;
      super.update(dt, playerPos, player, fxManager);
      return;
    }

    if (!this._introPlayed) {
      this._introPlayed = true;
      this.introSound();
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this._setEmissive(this._baseEmissive);
    }

    if (!this.phase2 && this.stats.hp <= this.stats.maxHp * 0.5) {
      this.phase2 = true;
      this.auraBase = 7.5;
      if (fxManager) fxManager.screenShake(0.4, 0.6);
      this.onPhase2();
    }

    if (this.knockbackVel.lengthSq() > 0.1) {
      this.mesh.position.addScaledVector(this.knockbackVel, dt);
      this.knockbackVel.multiplyScalar(Math.max(0, 1 - 10 * dt));
    }

    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    if (this.canTurn() && toPlayer.lengthSq() > 0.001) {
      this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    }

    this.stateTimer -= dt;

    if (this.state === 'intro') {
      const s = 1 - Math.max(0, this.stateTimer / 1.6);
      this.modelContainer.position.y = (1 - s) * -0.8;
      if (this.stateTimer <= 0) {
        this.modelContainer.position.y = 0;
        this.state = 'chase';
        if (fxManager) fxManager.screenShake(0.35, 0.5);
      }
    } else {
      this.ai(dt, playerPos, player, fxManager, toPlayer, dist);
    }

    this._updateHazards(dt, player);
    this._updateAura();

    this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, -BOUND, BOUND);
    this.mesh.position.z = THREE.MathUtils.clamp(this.mesh.position.z, -BOUND, BOUND);
  }

  die() {
    super.die();
    this._clearHazards();
    this.hideLines();
    this.onDeath();
  }

  dispose() {
    this._clearHazards();
    for (const l of this.lineMeshes) {
      this.scene.remove(l);
      l.geometry.dispose();
      l.material.dispose();
    }
    this.lineMeshes = [];
    for (const m of [this.auraRing, this.auraDisc]) {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    super.dispose();
  }
}

/* ═══════════════════════════════════════════
   1. ORMANIN KADİM MUHAFIZI — Zehir & Kök
   ═══════════════════════════════════════════ */
export class ForestGuardian extends BossBase {
  constructor(scene, position, difficulty, pm, model, sound) {
    super(scene, position, difficulty, pm, model, sound, {
      name: 'Ormanın Kadim Muhafızı',
      title: 'Zehir & Kök Elementi',
      hp: 900,
      damage: 26,
      speed: 1.7,
      scale: 2.9,
      theme: {
        hex: 0x22ff88,
        emissive: 0x0a4a22,
        css: '#4dffa0',
        a: '#0b5a30',
        b: '#2eff88',
        p2a: '#5a7a00',
        p2b: '#c8ff3a',
      },
    });
    this.summoned = false;
    this.aimDir = new THREE.Vector3(0, 0, 1);
    this.lines = [this.makeLine(0x33ff77), this.makeLine(0x33ff77), this.makeLine(0x33ff77)];
  }

  introSound() {
    if (this.soundManager) this.soundManager.playBossRoar();
  }

  ai(dt, playerPos, player, fx, toPlayer, dist) {
    switch (this.state) {
      case 'chase':
        this._chaseMove(dt, toPlayer, dist, 3.2, this.phase2 ? 1.3 : 1);
        this.modelContainer.position.y = Math.abs(Math.sin(this.animTime * 3.5)) * 0.1;
        this.modelContainer.rotation.z = Math.sin(this.animTime * 3.5) * 0.04;
        this.attackTimer -= dt;
        if (this.phase2 && !this.summoned) {
          this.summoned = true;
          this.state = 'summonWindup';
          this.stateTimer = 1.4;
          if (this.soundManager) this.soundManager.playBossRoar();
          if (fx) fx.screenShake(0.5, 1.2);
        } else if (this.attackTimer <= 0) {
          this.state = 'rootWindup';
          this.stateTimer = this.phase2 ? 0.85 : 1.1;
          if (this.soundManager) this.soundManager.playBossWarning();
        }
        break;

      case 'rootWindup': {
        const total = this.phase2 ? 0.85 : 1.1;
        const p = 1 - Math.max(0, this.stateTimer / total);
        this.modelContainer.position.y = p * 0.5;
        this.modelContainer.rotation.x = -0.25 * p;
        if (this.stateTimer > 0.25 && toPlayer.lengthSq() > 0.001) {
          this.aimDir.copy(toPlayer).normalize();
        }
        const angles = [-0.5, 0, 0.5];
        for (let i = 0; i < 3; i++) {
          const d = this.aimDir.clone().applyAxisAngle(UP, angles[i]);
          this.setLine(this.lines[i], this.mesh.position, d, 11, 1.2, 0.2 + 0.4 * p);
        }
        this._setEmissive(Math.sin(this.animTime * 28) > 0 ? 0x33ff77 : this._baseEmissive);
        if (this.stateTimer <= 0) this._fireRoots(fx);
        break;
      }

      case 'rootRecover':
        this.modelContainer.rotation.x = THREE.MathUtils.lerp(this.modelContainer.rotation.x, 0, 8 * dt);
        this.modelContainer.position.y = THREE.MathUtils.lerp(this.modelContainer.position.y, 0, 10 * dt);
        if (this.stateTimer <= 0) {
          this.state = 'chase';
          this._setEmissive(this._baseEmissive);
          this.attackTimer = this.phase2 ? 1.7 : 2.4;
        }
        break;

      case 'summonWindup': {
        const p = 1 - Math.max(0, this.stateTimer / 1.4);
        this.modelContainer.position.y = Math.sin(p * Math.PI) * 0.7;
        this.modelContainer.rotation.x = -0.3 * Math.sin(p * Math.PI);
        this._setEmissive(Math.sin(this.animTime * 22) > 0 ? 0x88ff44 : this._baseEmissive);
        if (this.stateTimer <= 0) this._doSummon(fx);
        break;
      }
    }
  }

  _fireRoots(fx) {
    this.hideLines();
    const angles = [-0.5, 0, 0.5];
    for (const a of angles) this._spawnWave(this.aimDir.clone().applyAxisAngle(UP, a));
    if (this.soundManager) this.soundManager.playRootWave();
    if (fx) fx.screenShake(0.45, 0.35);
    this.modelContainer.rotation.x = 0.4;
    this.state = 'rootRecover';
    this.stateTimer = 0.7;
  }

  _spawnWave(dir) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.8), flatMat(0x33ff77, 0.75)));
    const coneMat = new THREE.MeshBasicMaterial({ color: 0x8dffa8 });
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 5), coneMat);
      c.position.set((i - 2) * 0.28, 0.4, (i % 2) * 0.5 - 0.2);
      g.add(c);
    }
    g.position.set(this.mesh.position.x, 0.06, this.mesh.position.z);
    g.rotation.y = Math.atan2(dir.x, dir.z);
    const dmg = this.stats.damage * 0.85;
    this.addHazard({
      mesh: g,
      life: 3,
      traveled: 0,
      hit: false,
      update: (dt, h, player) => {
        const step = 9 * dt;
        h.mesh.position.addScaledVector(dir, step);
        h.traveled += step;
        h.mesh.children.forEach((c, i) => {
          if (i > 0) c.scale.y = 0.8 + Math.sin(h.traveled * 6 + i) * 0.3;
        });
        const dx = player.mesh.position.x - h.mesh.position.x;
        const dz = player.mesh.position.z - h.mesh.position.z;
        if (!h.hit && Math.hypot(dx, dz) < 1.1) {
          h.hit = true;
          this.hitPlayer(player, dmg, 0.25);
        }
        if (h.traveled > 11 || Math.abs(h.mesh.position.x) > 8 || Math.abs(h.mesh.position.z) > 8) h.life = 0;
      },
    });
  }

  _doSummon(fx) {
    this.modelContainer.position.y = 0;
    this.modelContainer.rotation.x = 0;
    this._setEmissive(this._baseEmissive);
    if (this.factory) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.random();
        const pos = new THREE.Vector3(
          THREE.MathUtils.clamp(this.mesh.position.x + Math.cos(a) * 3.0, -7, 7),
          0,
          THREE.MathUtils.clamp(this.mesh.position.z + Math.sin(a) * 3.0, -7, 7),
        );
        const e = this.factory.spawnEnemy(pos, 'grunt', this.difficulty);
        e.stats.speed *= 1.8;
        e.stats.maxHp = Math.round(e.stats.maxHp * 0.5);
        e.stats.hp = e.stats.maxHp;
        e._drawHp();
        e.mesh.scale.setScalar(0.8);
      }
    }
    if (this.soundManager) this.soundManager.playBossSlam();
    if (fx) fx.screenShake(0.5, 0.5);
    this.state = 'chase';
    this.attackTimer = 1.5;
  }
}

/* ═══════════════════════════════════════════
   2. GÖLGE AVCISI — Hız & Karanlık
   ═══════════════════════════════════════════ */
export class ShadowHunter extends BossBase {
  constructor(scene, position, difficulty, pm, model, sound) {
    super(scene, position, difficulty, pm, model, sound, {
      name: 'Gölge Avcısı',
      title: 'Hız & Karanlık Elementi',
      hp: 700,
      damage: 24,
      speed: 3.0,
      scale: 2.3,
      theme: {
        hex: 0xb040ff,
        emissive: 0x3a0a55,
        css: '#d58bff',
        a: '#4a0a80',
        b: '#c040ff',
        p2a: '#800060',
        p2b: '#ff3ac0',
      },
    });
    this.clones = [];
    this.dashers = [];
    this.dashRepeat = 0;
    this.cloneDash = false;
    this.windupTotal = 0.9;
    this.lines = [this.makeLine(0xff2020), this.makeLine(0xff2020), this.makeLine(0xff2020)];
  }

  introSound() {
    if (this.soundManager) this.soundManager.playShadowClone();
  }

  canTurn() {
    return this.state === 'chase' || this.state === 'intro' || this.state === 'cloneWait';
  }

  onDeath() {
    this._dissolveClones();
  }

  takeDamage(amount, attackerPos) {
    super.takeDamage(amount, attackerPos);
    if (this.clones.length > 0) {
      this._dissolveClones();
      if (this.state === 'cloneWait' || this.state === 'cloneSummon') {
        this.state = 'chase';
        this.attackTimer = 1.4;
        this.hideLines();
      }
    }
  }

  _dissolveClones() {
    for (const c of this.clones) c.pop();
    this.clones = [];
  }

  ai(dt, playerPos, player, fx, toPlayer, dist) {
    switch (this.state) {
      case 'chase':
        this._chaseMove(dt, toPlayer, dist, 3.5, this.phase2 ? 1.3 : 1);
        this.modelContainer.position.y = Math.abs(Math.sin(this.animTime * 8)) * 0.12;
        this.modelContainer.rotation.x = 0.15;
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
          if (this.attackIdx++ % 2 === 0) {
            this._startDash(this.phase2 ? 2 : 1, false);
          } else {
            this.state = 'cloneSummon';
            this.stateTimer = 0.8;
            if (this.soundManager) this.soundManager.playShadowClone();
          }
        }
        break;

      case 'cloneSummon':
        this._setEmissive(Math.sin(this.animTime * 30) > 0 ? 0xd070ff : this._baseEmissive);
        this.modelContainer.position.y = Math.sin((1 - this.stateTimer / 0.8) * Math.PI) * 0.4;
        if (this.stateTimer <= 0) this._makeClones();
        break;

      case 'cloneWait': {
        this._chaseMove(dt, toPlayer, dist, 4.5, 0.6);
        this.cloneAngle += dt * 1.3;
        this.clones.forEach((c, i) => {
          const a = this.cloneAngle + i * Math.PI;
          c.mesh.position.set(
            THREE.MathUtils.clamp(this.mesh.position.x + Math.cos(a) * 3.2, -BOUND, BOUND),
            0,
            THREE.MathUtils.clamp(this.mesh.position.z + Math.sin(a) * 3.2, -BOUND, BOUND),
          );
        });
        if (this.stateTimer <= 0) this._startDash(1, true);
        break;
      }

      case 'dashWindup': {
        const p = 1 - Math.max(0, this.stateTimer / this.windupTotal);
        for (const d of this.dashers) {
          if (d.ent !== this && !d.ent.alive) {
            d.line.visible = false;
            continue;
          }
          if (this.stateTimer > 0.28) {
            const v = new THREE.Vector3().subVectors(playerPos, d.ent.mesh.position);
            v.y = 0;
            if (v.lengthSq() > 0.001) d.dir.copy(v).normalize();
          }
          d.ent.mesh.rotation.y = Math.atan2(d.dir.x, d.dir.z);
          this.setLine(d.line, d.ent.mesh.position, d.dir, 16, 1.1, 0.3 + 0.5 * p);
        }
        this._setEmissive(Math.sin(this.animTime * 30) > 0 ? 0xff3030 : this._baseEmissive);
        if (this.stateTimer <= 0) {
          this.state = 'dashing';
          this.stateTimer = 0.38;
          this.hideLines();
          if (this.soundManager) this.soundManager.playShadowDash();
          if (fx) fx.screenShake(0.25, 0.3);
        }
        break;
      }

      case 'dashing': {
        for (const d of this.dashers) {
          const ent = d.ent;
          if (ent !== this && !ent.alive) continue;
          ent.mesh.position.addScaledVector(d.dir, 38 * dt);
          ent.mesh.position.x = THREE.MathUtils.clamp(ent.mesh.position.x, -7.4, 7.4);
          ent.mesh.position.z = THREE.MathUtils.clamp(ent.mesh.position.z, -7.4, 7.4);
          if (ent === this && ent.mesh.position.distanceTo(d.last) > 0.9) {
            d.last.copy(ent.mesh.position);
            this._spawnFire(ent.mesh.position);
          }
          if (!d.hit) {
            const dx = playerPos.x - ent.mesh.position.x;
            const dz = playerPos.z - ent.mesh.position.z;
            if (Math.hypot(dx, dz) < 1.3) {
              d.hit = true;
              this.hitPlayer(player, this.stats.damage * (ent === this ? 1 : 0.6), 0.35);
            }
          }
        }
        if (this.stateTimer <= 0) {
          if (this.dashRepeat > 1) {
            this.dashRepeat--;
            this._beginWindup(0.55);
          } else {
            if (this.cloneDash) this._dissolveClones();
            this.state = 'dashRecover';
            this.stateTimer = 0.7;
            this._setEmissive(this._baseEmissive);
          }
        }
        break;
      }

      case 'dashRecover':
        this.modelContainer.position.y = THREE.MathUtils.lerp(this.modelContainer.position.y, 0, 8 * dt);
        if (this.stateTimer <= 0) {
          this.state = 'chase';
          this.attackTimer = this.phase2 ? 1.2 : 1.9;
        }
        break;
    }
  }

  _makeClones() {
    this._setEmissive(this._baseEmissive);
    this.cloneAngle = Math.random() * Math.PI * 2;
    this.clones = [];
    for (let i = 0; i < 2; i++) {
      const tpl = this.models && this.models.imp ? SkeletonUtils.clone(this.models.imp) : null;
      const a = this.cloneAngle + i * Math.PI;
      const pos = new THREE.Vector3(
        THREE.MathUtils.clamp(this.mesh.position.x + Math.cos(a) * 3.2, -BOUND, BOUND),
        0,
        THREE.MathUtils.clamp(this.mesh.position.z + Math.sin(a) * 3.2, -BOUND, BOUND),
      );
      const c = new Decoy(this.scene, tpl, pos, this.cfg.scale, this.theme.hex);
      this.clones.push(c);
      if (this.factory) this.factory.enemies.push(c);
    }
    if (this.soundManager) this.soundManager.playShadowClone();
    this.state = 'cloneWait';
    this.stateTimer = 3.2;
  }

  _startDash(repeat, withClones) {
    this.dashRepeat = repeat;
    this.cloneDash = withClones;
    this._beginWindup(0.9);
  }

  _beginWindup(t) {
    this.state = 'dashWindup';
    this.stateTimer = t;
    this.windupTotal = t;
    this.dashers = [
      { ent: this, line: this.lines[0], dir: new THREE.Vector3(0, 0, 1), hit: false, last: this.mesh.position.clone() },
    ];
    if (this.cloneDash) {
      this.clones.forEach((c, i) => {
        if (c.alive) {
          this.dashers.push({ ent: c, line: this.lines[i + 1], dir: new THREE.Vector3(0, 0, 1), hit: false, last: c.mesh.position.clone() });
        }
      });
    }
    if (this.soundManager) this.soundManager.playShadowWarn();
  }

  _spawnFire(pos) {
    const g = new THREE.CircleGeometry(0.95, 20);
    g.rotateX(-Math.PI / 2);
    const mat = flatMat(0xb040ff, 0.65);
    const m = new THREE.Mesh(g, mat);
    m.position.set(pos.x, 0.05, pos.z);
    const dmg = this.stats.damage * 0.3;
    this.addHazard({
      mesh: m,
      life: 3.5,
      tick: 0.3,
      update: (dt, h, player) => {
        h.tick -= dt;
        mat.opacity = Math.min(0.65, h.life * 0.4);
        h.mesh.scale.setScalar(0.9 + Math.sin(h.life * 12) * 0.1);
        if (h.tick <= 0) {
          h.tick = 0.5;
          const dx = player.mesh.position.x - h.mesh.position.x;
          const dz = player.mesh.position.z - h.mesh.position.z;
          if (Math.hypot(dx, dz) < 1.0) this.hitPlayer(player, dmg, 0.12);
        }
      },
    });
  }
}

/* ═══════════════════════════════════════════
   3. FIRTINA LORDU — Yıldırım & Alan Kontrolü
   ═══════════════════════════════════════════ */
export class StormLord extends BossBase {
  constructor(scene, position, difficulty, pm, model, sound) {
    super(scene, position, difficulty, pm, model, sound, {
      name: 'Fırtına Lordu',
      title: 'Yıldırım & Alan Kontrolü',
      hp: 1000,
      damage: 30,
      speed: 1.6,
      scale: 2.6,
      theme: {
        hex: 0x38e8ff,
        emissive: 0x0a3a55,
        css: '#7df3ff',
        a: '#0a4a6b',
        b: '#38e8ff',
        p2a: '#4a2bd0',
        p2b: '#b58cff',
      },
    });
    this.beamAngle = 0;
    this.beamHitCd = 0;
    this.beamAlpha = 0;
    this.beams = new THREE.Group();
    this.beamMats = [];
    for (let k = 0; k < 2; k++) {
      const holder = new THREE.Group();
      holder.rotation.y = k * Math.PI;
      const outerMat = flatMat(0x38e8ff, 0);
      const innerMat = flatMat(0xffffff, 0);
      this.beamMats.push(outerMat, innerMat);
      const outer = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 11), outerMat);
      outer.position.z = 5.8;
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 11), innerMat);
      inner.position.z = 5.8;
      holder.add(outer, inner);
      this.beams.add(holder);
    }
    this.beams.visible = false;
    scene.add(this.beams);
  }

  introSound() {
    if (this.soundManager) this.soundManager.playThunderStrike();
  }

  canTurn() {
    return this.state === 'chase' || this.state === 'intro' || this.state === 'rainWindup';
  }

  onDeath() {
    this.beams.visible = false;
  }

  ai(dt, playerPos, player, fx, toPlayer, dist) {
    switch (this.state) {
      case 'chase': {
        // Havada süzülür, mesafeyi korur
        this.modelContainer.position.y = 0.5 + Math.sin(this.animTime * 2.4) * 0.2;
        if (dist < 4.0 && toPlayer.lengthSq() > 0.001) {
          this.mesh.position.addScaledVector(toPlayer.clone().normalize(), -this.stats.speed * 1.2 * dt);
        } else if (dist > 7.0) {
          this.mesh.position.addScaledVector(toPlayer.clone().normalize(), this.stats.speed * dt);
        }
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
          if (this.attackIdx++ % 2 === 0) {
            this.state = 'rainWindup';
            this.stateTimer = 0.9;
            if (this.soundManager) this.soundManager.playThunderWarn();
          } else {
            this.state = 'laserWindup';
            this.stateTimer = 1.0;
            this.beams.visible = true;
            if (this.soundManager) this.soundManager.playThunderWarn();
          }
        }
        break;
      }

      case 'rainWindup': {
        const p = 1 - Math.max(0, this.stateTimer / 0.9);
        this.modelContainer.position.y = 0.5 + p * 0.8;
        this._setEmissive(Math.sin(this.animTime * 30) > 0 ? 0x38e8ff : this._baseEmissive);
        if (this.stateTimer <= 0) this._castRain(playerPos, fx);
        break;
      }

      case 'rainRecover':
        this.modelContainer.position.y = THREE.MathUtils.lerp(this.modelContainer.position.y, 0.5, 6 * dt);
        if (this.stateTimer <= 0) {
          this.state = 'chase';
          this.attackTimer = this.phase2 ? 1.6 : 2.4;
        }
        break;

      case 'laserWindup': {
        const p = 1 - Math.max(0, this.stateTimer / 1.0);
        const to = new THREE.Vector3(-this.mesh.position.x, 0, -this.mesh.position.z);
        if (to.length() > 0.3) this.mesh.position.addScaledVector(to.normalize(), 7 * dt);
        this.modelContainer.position.y = 0.5 + p * 0.5;
        this.beamAlpha = p * 0.4;
        this._syncBeams();
        if (this.stateTimer <= 0) {
          this.state = 'laser';
          this.stateTimer = this.phase2 ? 7.5 : 6.5;
          this.beamHitCd = 0;
          if (this.soundManager) this.soundManager.playLaserHum(this.stateTimer);
          if (fx) fx.screenShake(0.3, 0.4);
        }
        break;
      }

      case 'laser': {
        const speed = this.phase2 ? 1.15 : 0.85;
        this.beamAngle += speed * dt;
        this.beamAlpha = 0.85 + Math.sin(this.animTime * 25) * 0.12;
        this._syncBeams();
        this.beamHitCd -= dt;
        this._setEmissive(Math.sin(this.animTime * 14) > 0 ? 0x38a0ff : this._baseEmissive);

        const bx = this.mesh.position.x;
        const bz = this.mesh.position.z;
        const dx = Math.sin(this.beamAngle);
        const dz = Math.cos(this.beamAngle);
        const vx = player.mesh.position.x - bx;
        const vz = player.mesh.position.z - bz;
        const along = Math.abs(vx * dx + vz * dz);
        const lateral = Math.abs(vx * dz - vz * dx);
        if (this.beamHitCd <= 0 && along > 0.6 && along < 11.5 && lateral < 0.65) {
          if (this.hitPlayer(player, this.stats.damage * 0.8, 0.3)) this.beamHitCd = 0.7;
        }

        if (this.stateTimer <= 0) {
          this.beams.visible = false;
          this.beamAlpha = 0;
          this._syncBeams();
          this._setEmissive(this._baseEmissive);
          this.state = 'rainRecover';
          this.stateTimer = 1.0;
        }
        break;
      }
    }
  }

  _syncBeams() {
    this.beams.position.set(this.mesh.position.x, 0.7, this.mesh.position.z);
    this.beams.rotation.y = this.beamAngle;
    this.beamMats.forEach((m, i) => {
      m.opacity = i % 2 === 0 ? this.beamAlpha * 0.8 : this.beamAlpha;
    });
  }

  _castRain(playerPos, fx) {
    this._setEmissive(this._baseEmissive);
    const count = 5 + (Math.random() < 0.5 ? 1 : 0) + (this.phase2 ? 1 : 0);
    const spots = [{ x: playerPos.x, z: playerPos.z }];
    for (let i = 0; i < count; i++) {
      spots.push({ x: (Math.random() * 2 - 1) * 6.6, z: (Math.random() * 2 - 1) * 6.6 });
    }
    spots.forEach((s, i) => this._spawnWarn(s.x, s.z, 1.0 + i * 0.12));
    if (fx) fx.screenShake(0.2, 0.3);
    this.state = 'rainRecover';
    this.stateTimer = 1.0 + spots.length * 0.12;
  }

  _spawnWarn(x, z, delay) {
    const g = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(1.15, 1.4, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const fillGeo = new THREE.CircleGeometry(1.4, 36);
    fillGeo.rotateX(-Math.PI / 2);
    const ringMat = flatMat(0x38e8ff, 0.8);
    const fillMat = flatMat(0x2aa8ff, 0.1);
    g.add(new THREE.Mesh(ringGeo, ringMat), new THREE.Mesh(fillGeo, fillMat));
    g.position.set(x, 0.06, z);
    this.addHazard({
      mesh: g,
      life: delay,
      delay,
      update: (dt, h) => {
        const p = 1 - Math.max(0, h.life / h.delay);
        fillMat.opacity = 0.1 + p * 0.4;
        ringMat.opacity = 0.5 + Math.abs(Math.sin(p * 20)) * 0.5;
      },
      onEnd: () => this._strike(x, z),
    });
  }

  _strike(x, z) {
    if (!this.alive) return;
    const g = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 14, 8), flatMat(0x38e8ff, 0.7));
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 14, 8), flatMat(0xffffff, 1));
    outer.position.y = 7;
    inner.position.y = 7;
    const flashGeo = new THREE.CircleGeometry(1.7, 28);
    flashGeo.rotateX(-Math.PI / 2);
    const flash = new THREE.Mesh(flashGeo, flatMat(0xaaf4ff, 0.8));
    flash.position.y = 0.08;
    g.add(outer, inner, flash);
    g.position.set(x, 0, z);
    this.addHazard({
      mesh: g,
      life: 0.3,
      update: (dt, h) => {
        const t = Math.max(0, h.life / 0.3);
        outer.material.opacity = 0.7 * t;
        inner.material.opacity = t;
        flash.material.opacity = 0.8 * t;
        outer.scale.x = outer.scale.z = 0.6 + (1 - t) * 0.8;
      },
    });
    if (this.soundManager) this.soundManager.playThunderStrike(true);
    if (this.fx) this.fx.screenShake(0.18, 0.2);
    const p = this.playerRef;
    if (p) {
      const dx = p.mesh.position.x - x;
      const dz = p.mesh.position.z - z;
      if (Math.hypot(dx, dz) < 1.45) this.hitPlayer(p, this.stats.damage, 0.3);
    }
  }

  update(dt, playerPos, player, fxManager) {
    this.playerRef = player;
    super.update(dt, playerPos, player, fxManager);
  }

  dispose() {
    this.scene.remove(this.beams);
    disposeObject(this.beams);
    super.dispose();
  }
}

export const BOSS_CLASSES = [ForestGuardian, ShadowHunter, StormLord];

// Geriye dönük uyumluluk
export { BossBase as Boss };
