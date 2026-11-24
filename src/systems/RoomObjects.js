import * as THREE from 'three';

const ARENA = 6.2;

/* ═══════════════ Kırılabilir Sandık / Vazo ═══════════════ */
class Breakable {
  constructor(scene, pos, kind) {
    this.scene = scene;
    this.kind = kind;
    this.type = 'prop';
    this.isProp = true;
    this.alive = true;
    this.stats = { hp: 30, maxHp: 30, knockbackResistance: 0 };
    this.knockbackVel = new THREE.Vector3();
    this.modelMaterials = [];
    this.flash = 0;
    this.shake = 0;

    this.mesh = new THREE.Group();
    this.mesh.position.set(pos.x, 0.3, pos.z);
    this.mesh.rotation.y = Math.random() * Math.PI;

    this.mats = [];
    if (kind === 'crate') {
      const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.95 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x2e1d0e, roughness: 0.95 });
      this.mats.push(wood, dark);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), wood);
      box.position.y = 0.1;
      this.mesh.add(box);
      for (const dy of [-0.18, 0.38]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.1, 0.86), dark);
        band.position.y = dy;
        this.mesh.add(band);
      }
      const diag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.84), dark);
      diag.rotation.z = 0.7;
      diag.position.set(0, 0.1, 0);
      this.mesh.add(diag);
    } else {
      const clay = new THREE.MeshStandardMaterial({
        color: 0x3b5a4e,
        roughness: 0.7,
        metalness: 0.1,
      });
      this.mats.push(clay);
      const pts = [
        [0.0, 0.0], [0.26, 0.0], [0.38, 0.28], [0.34, 0.5],
        [0.2, 0.74], [0.24, 0.9], [0.0, 0.9],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const vase = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), clay);
      vase.position.y = -0.3;
      this.mesh.add(vase);
    }
    this.mesh.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    this.baseX = pos.x;
    this.baseZ = pos.z;
    scene.add(this.mesh);
  }

  takeDamage(amount) {
    this.stats.hp -= amount;
    this.flash = 0.12;
    this.shake = 0.18;
    for (const m of this.mats) m.emissive.set(0x99663a);
    if (this.stats.hp <= 0) this.alive = false;
  }

  update(dt) {
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) for (const m of this.mats) m.emissive.set(0x000000);
    }
    if (this.shake > 0) {
      this.shake -= dt;
      this.mesh.position.x = this.baseX + (Math.random() - 0.5) * 0.08;
      this.mesh.position.z = this.baseZ + (Math.random() - 0.5) * 0.08;
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((m) => {
      if (m.isMesh) m.geometry.dispose();
    });
    for (const m of this.mats) m.dispose();
  }
}

/* ═══════════════ Orman Tuzağı ═══════════════ */
const TRAP_TRIGGER = 0.85;
const TRAP_BLAST = 1.9;

class Trap {
  constructor(scene, pos) {
    this.scene = scene;
    this.pos = new THREE.Vector3(pos.x, 0, pos.z);
    this.state = 'idle'; // idle | armed | burst | cooldown
    this.timer = 0;
    this.time = Math.random() * 10;
    this.damaged = false;

    this.group = new THREE.Group();
    this.group.position.copy(this.pos);

    this.discMat = new THREE.MeshBasicMaterial({ color: 0x0b2a14, transparent: true, opacity: 0.92 });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 28), this.discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.03;
    this.group.add(disc);

    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0x2bd66b,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.95, 32), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.045;
    this.group.add(ring);

    this.spikes = new THREE.Group();
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0x2a5a2a,
      emissive: 0x1a8a3a,
      emissiveIntensity: 0.9,
      roughness: 0.5,
    });
    this.spikeMat = spikeMat;
    const coneGeo = new THREE.ConeGeometry(0.1, 1, 6);
    coneGeo.translate(0, 0.5, 0);
    this.coneGeo = coneGeo;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(coneGeo, spikeMat);
      if (i === 0) c.position.set(0, 0, 0);
      else {
        const a = (i / (n - 1)) * Math.PI * 2;
        const r = 0.45 + (i % 2) * 0.25;
        c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      }
      c.rotation.z = (Math.random() - 0.5) * 0.25;
      c.rotation.x = (Math.random() - 0.5) * 0.25;
      this.spikes.add(c);
    }
    this.spikes.scale.y = 0.1;
    this.group.add(this.spikes);

    this.cloudMat = new THREE.MeshBasicMaterial({
      color: 0x44ff66,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.cloudMat);
    this.cloud.visible = false;
    this.cloud.position.y = 0.4;
    this.group.add(this.cloud);

    scene.add(this.group);
  }

  _canTrigger(e) {
    return e.alive && e.type !== 'ranged' && !e.isProp && !e.isDecoy;
  }

  update(dt, player, enemies, ctx) {
    this.time += dt;

    if (this.state === 'idle') {
      this.ringMat.opacity = 0.55 + Math.sin(this.time * 2.5) * 0.2;
      this.ringMat.color.setHex(0x2bd66b);
      this.discMat.color.setHex(0x0b2a14);
      this.spikes.scale.y = 0.1;

      let triggered = false;
      const pp = player.mesh.position;
      if (!player.isDead() && Math.hypot(pp.x - this.pos.x, pp.z - this.pos.z) < TRAP_TRIGGER) triggered = true;
      if (!triggered) {
        for (const e of enemies) {
          if (!this._canTrigger(e)) continue;
          const ep = e.mesh.position;
          if (Math.hypot(ep.x - this.pos.x, ep.z - this.pos.z) < TRAP_TRIGGER) {
            triggered = true;
            break;
          }
        }
      }
      if (triggered) {
        this.state = 'armed';
        this.timer = 1.0;
        if (ctx.sound) ctx.sound.playTrapArm();
      }
    } else if (this.state === 'armed') {
      this.timer -= dt;
      const p = 1 - Math.max(0, this.timer);
      const blink = Math.sin(this.time * (14 + p * 22)) > 0;
      this.ringMat.color.setHex(blink ? 0xffe14d : 0xff4422);
      this.ringMat.opacity = 1.0;
      this.discMat.color.setHex(blink ? 0x3a3a00 : 0x2a0f05);
      this.spikes.scale.y = 0.1 + p * 0.35;
      if (this.timer <= 0) this._burst(player, enemies, ctx);
    } else if (this.state === 'burst') {
      this.timer -= dt;
      const t = 1 - this.timer / 0.8;
      this.cloud.scale.setScalar(0.5 + t * (TRAP_BLAST - 0.5));
      this.cloudMat.opacity = Math.max(0, 0.6 * (1 - t));
      this.spikes.scale.y = t < 0.5 ? 1.2 : Math.max(0.1, 1.2 * (1 - (t - 0.5) * 2));
      this.ringMat.color.setHex(0x66ff88);
      if (this.timer <= 0) {
        this.cloud.visible = false;
        this.state = 'cooldown';
        this.timer = 3.0;
      }
    } else if (this.state === 'cooldown') {
      this.timer -= dt;
      this.ringMat.opacity = 0.15;
      this.discMat.color.setHex(0x061408);
      this.spikes.scale.y = 0.05;
      if (this.timer <= 0) this.state = 'idle';
    }
  }

  _burst(player, enemies, ctx) {
    this.state = 'burst';
    this.timer = 0.8;
    this.cloud.visible = true;
    this.cloud.scale.setScalar(0.5);
    if (ctx.sound) ctx.sound.playTrapBurst();
    if (ctx.fx) ctx.fx.screenShake(0.22, 0.25);

    // Oyuncu
    const pp = player.mesh.position;
    if (!player.isDead() && Math.hypot(pp.x - this.pos.x, pp.z - this.pos.z) <= TRAP_BLAST && !player.invincible) {
      player.takeDamage(18);
    }

    // Düşmanlar (uçan imp'ler hariç)
    for (const e of enemies) {
      if (!e.alive || e.type === 'ranged' || e.isProp || e.isDecoy) continue;
      const ep = e.mesh.position;
      if (Math.hypot(ep.x - this.pos.x, ep.z - this.pos.z) > TRAP_BLAST) continue;
      e.takeDamage(e.isBoss ? 30 : 45, this.pos);
      e.poisonState = { active: true, duration: 3, tickTimer: 0.6, tickInterval: 0.6, damage: 6 };
      const dir = new THREE.Vector3().subVectors(ep, this.pos);
      dir.y = 0;
      if (dir.lengthSq() > 0.001) dir.normalize();
      e.knockbackVel.addScaledVector(dir, 8 * (e.stats.knockbackResistance ?? 1));
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((m) => {
      if (m.isMesh) {
        m.geometry.dispose();
      }
    });
    this.discMat.dispose();
    this.ringMat.dispose();
    this.spikeMat.dispose();
    this.cloudMat.dispose();
  }
}

/* ═══════════════ Oda Nesneleri Yöneticisi ═══════════════ */
export class RoomObjects {
  constructor(scene, fxManager, soundManager, callbacks = {}) {
    this.scene = scene;
    this.fx = fxManager;
    this.sound = soundManager;
    this.onShard = callbacks.onShard || (() => {});

    this.shards = [];
    this.potions = [];
    this.props = [];
    this.traps = [];
    this.debris = [];
    this.shardSoundTimer = 0;

    this.shardGeo = new THREE.OctahedronGeometry(0.16);
    this.shardMat = new THREE.MeshBasicMaterial({ color: 0xc58bff });
    this.glowGeo = new THREE.SphereGeometry(0.3, 10, 8);
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0x9a3cff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.potionBody = new THREE.CylinderGeometry(0.14, 0.2, 0.3, 10);
    this.potionNeck = new THREE.CylinderGeometry(0.06, 0.06, 0.14, 8);
    this.potionMat = new THREE.MeshBasicMaterial({ color: 0x38ff80 });
    this.corkMat = new THREE.MeshBasicMaterial({ color: 0x8a5a2a });
    this.potionGlowMat = new THREE.MeshBasicMaterial({
      color: 0x22ff77,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.potionGlowGeo = new THREE.SphereGeometry(0.42, 10, 8);

    this.debrisGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    this.debrisMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.9 });
  }

  /* ---------- hedefler (kırılabilirler dövüş sistemine dahil) ---------- */
  getTargets(enemies) {
    if (this.props.length === 0) return enemies;
    return enemies.concat(this.props);
  }

  /* ---------- oda kurulumu ---------- */
  populate(roomNumber, isBossRoom, avoid = []) {
    this.clearRoom();

    const taken = [new THREE.Vector3(0, 0, 0), ...avoid];
    const pick = (minCenter, gap) => {
      for (let tries = 0; tries < 60; tries++) {
        const p = new THREE.Vector3((Math.random() * 2 - 1) * ARENA, 0, (Math.random() * 2 - 1) * ARENA);
        if (p.length() < minCenter) continue;
        if (taken.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < gap)) continue;
        taken.push(p);
        return p;
      }
      return null;
    };

    const propCount = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < propCount; i++) {
      const p = pick(2.5, 2.0);
      if (p) this.props.push(new Breakable(this.scene, p, Math.random() < 0.6 ? 'crate' : 'vase'));
    }

    const trapCount = isBossRoom ? 2 : 2 + (roomNumber > 2 ? 1 : 0);
    for (let i = 0; i < trapCount; i++) {
      const p = pick(3.0, 2.8);
      if (p) this.traps.push(new Trap(this.scene, p));
    }
  }

  clearRoom() {
    this.collectRemainingShards();
    for (const p of this.props) p.dispose();
    this.props = [];
    for (const t of this.traps) t.dispose();
    this.traps = [];
    for (const po of this.potions) this.scene.remove(po.mesh);
    this.potions = [];
    for (const d of this.debris) this.scene.remove(d.mesh);
    this.debris = [];
  }

  /* ---------- düşürmeler ---------- */
  onEnemyDied(enemy) {
    if (enemy.isDecoy) return;
    const pos = enemy.mesh.position;
    const counts = { grunt: 2, ranged: 3, tank: 5, boss: 40 };
    this.dropShards(pos, counts[enemy.type] ?? 2);
    if (!enemy.isBoss && Math.random() < 0.08) this.dropPotion(pos);
  }

  dropShards(pos, count) {
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(this.shardGeo, this.shardMat));
      g.add(new THREE.Mesh(this.glowGeo, this.glowMat));
      g.position.set(pos.x, 0.8, pos.z);
      this.scene.add(g);
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3;
      this.shards.push({
        mesh: g,
        vel: new THREE.Vector3(Math.cos(a) * sp, 3 + Math.random() * 3, Math.sin(a) * sp),
        age: 0,
        magnet: false,
        speed: 5,
      });
    }
  }

  dropPotion(pos) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.potionBody, this.potionMat);
    const neck = new THREE.Mesh(this.potionNeck, this.potionMat);
    neck.position.y = 0.2;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), this.corkMat);
    cork.position.y = 0.3;
    const glow = new THREE.Mesh(this.potionGlowGeo, this.potionGlowMat);
    g.add(body, neck, cork, glow);
    const px = THREE.MathUtils.clamp(pos.x, -ARENA - 1, ARENA + 1);
    const pz = THREE.MathUtils.clamp(pos.z, -ARENA - 1, ARENA + 1);
    g.position.set(px, 0.5, pz);
    this.scene.add(g);
    this.potions.push({ mesh: g, baseY: 0.5, t: Math.random() * 6 });
  }

  _breakProp(prop) {
    const p = prop.mesh.position;
    if (this.sound) this.sound.playCrateBreak();
    if (this.fx) this.fx.screenShake(0.1, 0.1);

    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(this.debrisGeo, this.debrisMat);
      m.position.set(p.x, 0.5, p.z);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2;
      this.debris.push({
        mesh: m,
        vel: new THREE.Vector3(Math.cos(a) * 2.5, 2.5 + Math.random() * 2.5, Math.sin(a) * 2.5),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: 0.9,
      });
    }

    if (Math.random() < 0.45) this.dropPotion(p);
    else this.dropShards(p, 4 + Math.floor(Math.random() * 3));
  }

  collectRemainingShards() {
    if (this.shards.length > 0) this.onShard(this.shards.length);
    for (const s of this.shards) this.scene.remove(s.mesh);
    this.shards = [];
  }

  /* ---------- güncelleme ---------- */
  update(dt, player, enemies) {
    this.shardSoundTimer -= dt;
    const pp = player.mesh.position;

    // Kırılabilirler
    for (let i = this.props.length - 1; i >= 0; i--) {
      const pr = this.props[i];
      if (!pr.alive) {
        this._breakProp(pr);
        pr.dispose();
        this.props.splice(i, 1);
      } else {
        pr.update(dt);
      }
    }

    // Tuzaklar
    const ctx = { sound: this.sound, fx: this.fx };
    for (const t of this.traps) t.update(dt, player, enemies, ctx);

    // Ruh kristalleri
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.age += dt;
      s.mesh.rotation.y += dt * 4;
      s.mesh.scale.setScalar(1 + Math.sin(s.age * 8) * 0.1);
      const pos = s.mesh.position;

      if (!s.magnet) {
        s.vel.y -= 14 * dt;
        pos.addScaledVector(s.vel, dt);
        if (pos.y < 0.35) {
          pos.y = 0.35;
          s.vel.y *= -0.35;
          s.vel.x *= 0.8;
          s.vel.z *= 0.8;
          if (Math.abs(s.vel.y) < 0.5) s.vel.y = 0;
        }
        pos.x = THREE.MathUtils.clamp(pos.x, -7.4, 7.4);
        pos.z = THREE.MathUtils.clamp(pos.z, -7.4, 7.4);
        const d = Math.hypot(pp.x - pos.x, pp.z - pos.z);
        if (s.age > 0.5 && (d < 3.4 || s.age > 1.0)) s.magnet = true;
      } else {
        const tx = pp.x - pos.x;
        const ty = pp.y + 0.8 - pos.y;
        const tz = pp.z - pos.z;
        const d = Math.sqrt(tx * tx + ty * ty + tz * tz);
        s.speed = Math.min(30, s.speed + 40 * dt);
        if (d < 0.6) {
          this.onShard(1);
          if (this.sound && this.shardSoundTimer <= 0) {
            this.sound.playShardPickup();
            this.shardSoundTimer = 0.05;
          }
          this.scene.remove(s.mesh);
          this.shards.splice(i, 1);
          continue;
        }
        const k = (s.speed * dt) / d;
        pos.x += tx * k;
        pos.y += ty * k;
        pos.z += tz * k;
      }
    }

    // Can iksirleri
    for (let i = this.potions.length - 1; i >= 0; i--) {
      const po = this.potions[i];
      po.t += dt;
      po.mesh.position.y = po.baseY + Math.sin(po.t * 3) * 0.1;
      po.mesh.rotation.y += dt * 2;
      const d = Math.hypot(pp.x - po.mesh.position.x, pp.z - po.mesh.position.z);
      if (d < 0.9 && player.stats.hp < player.stats.maxHp && !player.isDead()) {
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 25);
        if (this.sound) this.sound.playPotion();
        if (this.fx) {
          for (let k = 0; k < 12; k++) this.fx.spawnPoisonParticle(pp);
        }
        player.flashTimer = 0.25;
        for (const mat of player.modelMaterials) {
          if (mat.emissive) mat.emissive.set(0x22ff77);
        }
        this.scene.remove(po.mesh);
        this.potions.splice(i, 1);
      }
    }

    // Enkaz
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      d.vel.y -= 12 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      if (d.mesh.position.y < 0.07) {
        d.mesh.position.y = 0.07;
        d.vel.set(0, 0, 0);
        d.spin.multiplyScalar(0);
      }
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.scale.setScalar(Math.max(0.01, Math.min(1, d.life * 2)));
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.debris.splice(i, 1);
      }
    }
  }
}
