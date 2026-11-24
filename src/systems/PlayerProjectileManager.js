import * as THREE from 'three';

const ROOM_BOUND = 7.8;

export class PlayerProjectileManager {
  constructor(scene, fxManager, soundManager, elementalManager = null) {
    this.scene = scene;
    this.fxManager = fxManager;
    this.soundManager = soundManager;
    this.elementalManager = elementalManager;

    this.bolts = [];
    this.thrownSpears = [];

    // Shared bolt geometry & materials
    this.boltGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8);
    this.boltGeo.rotateX(Math.PI / 2); // Orient forward along Z
    this.boltMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
    });

    // Thrown spear template
    this.spearTemplate = this._createSpearMesh();
  }

  _createSpearMesh() {
    const group = new THREE.Group();

    // Shaft
    const shaftGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.1, 8);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0x142822,
      roughness: 0.6,
      metalness: 0.4,
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.rotation.x = Math.PI / 2;
    group.add(shaft);

    // Spearhead
    const headGeo = new THREE.ConeGeometry(0.09, 0.48, 4);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ddaa,
      emissiveIntensity: 2.0,
      roughness: 0.2,
      metalness: 0.8,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.rotation.x = -Math.PI / 2;
    head.position.z = 1.25;
    group.add(head);

    return group;
  }

  // ── Spawn Staff Soul Bolt ──
  spawnBolt(startPos, targetPos, damage = 28, speed = 18.0) {
    const dir = new THREE.Vector3().subVectors(targetPos, startPos);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
    dir.normalize();

    const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
    mesh.position.copy(startPos);
    mesh.position.y = 0.55;
    mesh.lookAt(mesh.position.clone().add(dir));
    this.scene.add(mesh);

    this.bolts.push({
      mesh,
      dir,
      speed,
      damage,
      distanceTraveled: 0,
      maxDistance: 13.0,
    });
  }

  // ── Spawn Staff 5-Way Spread ──
  spawnSpreadBolts(startPos, targetPos, damage = 25) {
    const baseDir = new THREE.Vector3().subVectors(targetPos, startPos);
    baseDir.y = 0;
    if (baseDir.lengthSq() < 0.001) baseDir.set(0, 0, 1);
    baseDir.normalize();

    // 5 angles: -30°, -15°, 0°, +15°, +30°
    const angles = [-0.52, -0.26, 0, 0.26, 0.52];
    const UP = new THREE.Vector3(0, 1, 0);

    for (const angle of angles) {
      const dir = baseDir.clone().applyAxisAngle(UP, angle);
      const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
      mesh.position.copy(startPos);
      mesh.position.y = 0.55;
      mesh.lookAt(mesh.position.clone().add(dir));
      this.scene.add(mesh);

      this.bolts.push({
        mesh,
        dir,
        speed: 17.0,
        damage,
        distanceTraveled: 0,
        maxDistance: 12.0,
      });
    }
  }

  // ── Spawn Thrown Spear (Special Attack) ──
  spawnThrownSpear(startPos, targetPos, damage = 40, player) {
    const dir = new THREE.Vector3().subVectors(targetPos, startPos);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
    dir.normalize();

    const mesh = this.spearTemplate.clone();
    mesh.position.copy(startPos);
    mesh.position.y = 0.6;
    mesh.lookAt(mesh.position.clone().add(dir));
    this.scene.add(mesh);

    this.thrownSpears.push({
      mesh,
      dir,
      speed: 20.0,
      damage,
      returnDamage: 48,
      state: 'flying', // 'flying' | 'hovering' | 'returning'
      distanceTraveled: 0,
      maxDistance: 8.5,
      hoverTimer: 0.22,
      hitEnemies: new Set(),
      player,
    });
  }

  setElemental(em, player) {
    this.elementalManager = em;
    this.player = player;
  }

  _hit(enemy, damage, pos) {
    if (this.player && Math.random() < this.player.stats.critChance) {
      damage = Math.round(damage * 1.8);
      enemy.lastHitCrit = true;
    }
    enemy.takeDamage(damage, pos);
  }

  _elemHit(enemy, enemies) {
    if (!this.elementalManager || !this.player) return;
    this.elementalManager.triggerChainLightning(enemy.mesh.position, enemy, enemies, this.player);
    this.elementalManager.applyPoison(enemy, this.player);
  }

  // ── Main Update ──
  update(dt, enemies) {
    // 1. Update Staff Bolts
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      const step = b.speed * dt;
      b.mesh.position.addScaledVector(b.dir, step);
      b.distanceTraveled += step;

      let hit = false;
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const dist = b.mesh.position.distanceTo(enemy.mesh.position);
        if (dist < 0.75) {
          this._hit(enemy, b.damage, b.mesh.position);
          this._elemHit(enemy, enemies);
          if (this.soundManager) this.soundManager.playHitImpact(false);
          this.fxManager.screenShake(0.12, 0.1);
          hit = true;
          break;
        }
      }

      if (
        hit ||
        b.distanceTraveled >= b.maxDistance ||
        Math.abs(b.mesh.position.x) > ROOM_BOUND ||
        Math.abs(b.mesh.position.z) > ROOM_BOUND
      ) {
        this.scene.remove(b.mesh);
        this.bolts.splice(i, 1);
      }
    }

    // 2. Update Thrown Spears
    for (let i = this.thrownSpears.length - 1; i >= 0; i--) {
      const sp = this.thrownSpears[i];

      if (sp.state === 'flying') {
        const step = sp.speed * dt;
        sp.mesh.position.addScaledVector(sp.dir, step);
        sp.distanceTraveled += step;
        sp.mesh.rotation.z += dt * 18; // fast spin while flying

        // Pierce enemies on outbound path
        for (const enemy of enemies) {
          if (!enemy.alive || sp.hitEnemies.has(enemy)) continue;
          const dist = sp.mesh.position.distanceTo(enemy.mesh.position);
          if (dist < 1.0) {
            sp.hitEnemies.add(enemy);
            this._hit(enemy, sp.damage, sp.mesh.position);
            this._elemHit(enemy, enemies);
            if (this.soundManager) this.soundManager.playHitImpact(true);
            this.fxManager.screenShake(0.18, 0.14);
          }
        }

        if (
          sp.distanceTraveled >= sp.maxDistance ||
          Math.abs(sp.mesh.position.x) > ROOM_BOUND ||
          Math.abs(sp.mesh.position.z) > ROOM_BOUND
        ) {
          sp.state = 'hovering';
        }
      } else if (sp.state === 'hovering') {
        sp.hoverTimer -= dt;
        sp.mesh.rotation.y += dt * 15;
        if (sp.hoverTimer <= 0) {
          sp.state = 'returning';
          sp.hitEnemies.clear(); // Can hit enemies again on return!
        }
      } else if (sp.state === 'returning') {
        const toPlayer = new THREE.Vector3().subVectors(sp.player.mesh.position, sp.mesh.position);
        toPlayer.y = 0;
        const distToPlayer = toPlayer.length();

        toPlayer.normalize();
        sp.mesh.position.addScaledVector(toPlayer, sp.speed * 1.35 * dt);
        sp.mesh.lookAt(sp.mesh.position.clone().add(toPlayer));
        sp.mesh.rotation.z += dt * 22;

        // Pierce enemies on return path (critical backstab damage)
        for (const enemy of enemies) {
          if (!enemy.alive || sp.hitEnemies.has(enemy)) continue;
          const dist = sp.mesh.position.distanceTo(enemy.mesh.position);
          if (dist < 1.0) {
            sp.hitEnemies.add(enemy);
            this._hit(enemy, sp.returnDamage, sp.mesh.position);
            this._elemHit(enemy, enemies);
            if (this.soundManager) this.soundManager.playHitImpact(true);
            this.fxManager.screenShake(0.24, 0.16);
          }
        }

        // Catch spear when back to player
        if (distToPlayer < 0.9) {
          if (this.soundManager) this.soundManager.playSpearCatch();
          this.fxManager.screenShake(0.12, 0.1);
          if (sp.player) sp.player.onSpearReturned();
          this.scene.remove(sp.mesh);
          this.thrownSpears.splice(i, 1);
        }
      }
    }
  }

  clearAll() {
    for (const b of this.bolts) this.scene.remove(b.mesh);
    this.bolts = [];
    for (const sp of this.thrownSpears) {
      if (sp.player) sp.player.onSpearReturned();
      this.scene.remove(sp.mesh);
    }
    this.thrownSpears = [];
  }
}

