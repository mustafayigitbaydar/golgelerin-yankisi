import * as THREE from 'three';

const ROOM_BOUND = 7.5;

export class Enemy {
  constructor(scene, position, type = 'grunt', stats = {}, projectileManager = null, modelTemplate = null) {
    this.scene = scene;
    this.type = type; // 'grunt' (Puglin) | 'ranged' (Imp) | 'tank' (Giant Imp)
    this.projectileManager = projectileManager;
    this.alive = true;
    this.readyToRemove = false;
    this.deathTimer = 0;
    this.flashTimer = 0;
    this.animTime = Math.random() * 10;
    this.knockbackVel = new THREE.Vector3();
    this.attackCooldownTimer = 1.0 + Math.random() * 0.5;

    // Slam state for Tank
    this.isPreparingSlam = false;
    this.slamTimer = 0;
    this.slamDuration = 0.65;

    // Base type stats
    const baseStats = this._getBaseStats(type);
    this.stats = {
      maxHp: stats.maxHp ?? baseStats.maxHp,
      hp: stats.hp ?? stats.maxHp ?? baseStats.maxHp,
      speed: stats.speed ?? baseStats.speed,
      damage: stats.damage ?? baseStats.damage,
      attackRange: stats.attackRange ?? baseStats.attackRange,
      detectionRange: stats.detectionRange ?? baseStats.detectionRange,
      attackCooldown: stats.attackCooldown ?? baseStats.attackCooldown,
      knockbackResistance: baseStats.knockbackResistance,
    };

    // ── mesh root ──
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Inner container for procedural wobbles / animations
    this.modelContainer = new THREE.Group();
    this.mesh.add(this.modelContainer);

    this.modelMaterials = [];
    this.fallbackMesh = null;

    // ── Cursed Forest Themed Enemy Aura Light ──
    if (type === 'tank') {
      this.auraLight = new THREE.PointLight(0x00ee77, 2.4, 6.2, 1.6);
      this.auraLight.position.set(0, 0.85, 0);
    } else if (type === 'ranged') {
      this.auraLight = new THREE.PointLight(0x00ffcc, 1.6, 4.5, 1.8);
      this.auraLight.position.set(0, 0.65, 0);
    } else {
      // Puglin (Grunt) - Toxic forest green
      this.auraLight = new THREE.PointLight(0x33ff55, 1.3, 3.8, 2.0);
      this.auraLight.position.set(0, 0.45, 0);
    }
    this.mesh.add(this.auraLight);

    // HP bar vertical offset
    const hpOffsetY = type === 'tank' ? 2.35 : type === 'ranged' ? 1.45 : 1.1;

    // Attach 3D model or placeholder
    if (modelTemplate) {
      this.attachModel(modelTemplate);
    } else {
      this._createFallbackMesh();
    }

    // ── hp bar (sprite with canvas) ──
    this._hpCanvas = document.createElement('canvas');
    this._hpCanvas.width = 64;
    this._hpCanvas.height = 8;
    this._hpCtx = this._hpCanvas.getContext('2d');
    this._hpTex = new THREE.CanvasTexture(this._hpCanvas);
    this._hpTex.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this._hpTex,
      depthTest: false,
      transparent: true,
    });
    this.hpSprite = new THREE.Sprite(spriteMat);
    this.hpSprite.scale.set(1.0, 0.12, 1);
    this.hpSprite.position.y = hpOffsetY;
    this.mesh.add(this.hpSprite);
    this._drawHp();

    scene.add(this.mesh);
  }

  _getBaseStats(type) {
    switch (type) {
      case 'ranged':
        return {
          maxHp: 38,
          speed: 2.4,
          damage: 12,
          attackRange: 7.0,
          detectionRange: 16,
          attackCooldown: 2.2,
          knockbackResistance: 0.9,
        };
      case 'tank':
        return {
          maxHp: 120,
          speed: 1.5,
          damage: 25,
          attackRange: 2.3,
          detectionRange: 14,
          attackCooldown: 2.6,
          knockbackResistance: 0.35,
        };
      case 'grunt':
      default:
        return {
          maxHp: 50,
          speed: 2.9,
          damage: 10,
          attackRange: 1.3,
          detectionRange: 14,
          attackCooldown: 1.3,
          knockbackResistance: 1.0,
        };
    }
  }

  _createFallbackMesh() {
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const color = this.type === 'ranged' ? 0x00ccaa : this.type === 'tank' ? 0x11aa55 : 0x22aa44;
    const mat = new THREE.MeshStandardMaterial({ color });
    this.fallbackMesh = new THREE.Mesh(geo, mat);
    this.fallbackMesh.position.y = 0.35;
    this.fallbackMesh.castShadow = true;
    this.modelContainer.add(this.fallbackMesh);
  }

  attachModel(clonedModel) {
    if (this.fallbackMesh) {
      this.modelContainer.remove(this.fallbackMesh);
      this.fallbackMesh.geometry.dispose();
      this.fallbackMesh.material.dispose();
      this.fallbackMesh = null;
    }

    // Set scale based on archetype
    if (this.type === 'tank') {
      clonedModel.scale.setScalar(1.22); // Giant brute Imp
    } else if (this.type === 'ranged') {
      clonedModel.scale.setScalar(0.72); // Hovering Caster Imp
    } else {
      clonedModel.scale.setScalar(0.78); // Goblin Puglin
    }

    // Face forward (+Z)
    clonedModel.rotation.y = Math.PI;

    // Enable shadows and clone materials for independent hit flashes
    this.modelMaterials = [];
    clonedModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          // Ortam haritası olmadığı için metalik malzemeler simsiyah görünür: mat hale getir
          const mt = child.material;
          if (mt.metalness !== undefined) mt.metalness = Math.min(mt.metalness, 0.1);
          if (mt.roughness !== undefined) mt.roughness = Math.max(mt.roughness, 0.65);
          mt.needsUpdate = true;
          this.modelMaterials.push(child.material);
        }
      }
    });

    this.modelContainer.add(clonedModel);
  }

  /* ─────── hp bar ─────── */
  _drawHp() {
    const ctx = this._hpCtx;
    const w = 64, h = 8;
    const ratio = Math.max(0, this.stats.hp / this.stats.maxHp);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = ratio > 0.5 ? '#4f4' : ratio > 0.25 ? '#fa4' : '#f44';
    ctx.fillRect(1, 1, (w - 2) * ratio, h - 2);
    this._hpTex.needsUpdate = true;
  }

  /* ─────── update ─────── */
  update(dt, playerPos, player, fxManager) {
    this.animTime += dt;

    if (!this.alive) {
      this.deathTimer -= dt;
      const s = Math.max(0, this.deathTimer / 0.35);
      this.modelContainer.scale.setScalar(s);
      this.modelContainer.rotation.x = -Math.PI / 2 * (1 - s);
      this.hpSprite.visible = false;
      if (this.auraLight) this.auraLight.intensity = Math.max(0, s * 1.5);
      if (this.deathTimer <= 0) this.readyToRemove = true;
      return;
    }

    // flash decay
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        for (const mat of this.modelMaterials) {
          if (mat.emissive) mat.emissive.set(0x000000);
        }
      }
    }

    // knockback
    if (this.knockbackVel.lengthSq() > 0.1) {
      this.mesh.position.addScaledVector(this.knockbackVel, dt);
      this.knockbackVel.multiplyScalar(Math.max(0, 1 - 10 * dt));
    } else {
      this.knockbackVel.set(0, 0, 0);
    }

    // Distance & Direction to player
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    // Rotate mesh to face player
    if (toPlayer.lengthSq() > 0.001) {
      this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    }

    // ── AI behaviors & procedural animations ──
    if (this.type === 'ranged') {
      // Hovering Imp Animation (smooth floating)
      this.modelContainer.position.y = 0.3 + Math.sin(this.animTime * 3.5) * 0.12;
      this.modelContainer.rotation.z = Math.sin(this.animTime * 2.0) * 0.08;
      this.modelContainer.rotation.x = 0.1;

      // Kiting AI: Maintain 4.5 to 7.0 range
      if (dist < 4.2) {
        // Run away from player
        const retreatDir = toPlayer.clone().negate().normalize();
        this.mesh.position.addScaledVector(retreatDir, this.stats.speed * 1.1 * dt);
      } else if (dist > 7.0) {
        // Approach player to get into range
        const approachDir = toPlayer.clone().normalize();
        this.mesh.position.addScaledVector(approachDir, this.stats.speed * dt);
      }

      // Attack (shoot projectile)
      if (dist <= this.stats.attackRange && this.attackCooldownTimer <= 0) {
        if (this.projectileManager) {
          const spawnPos = this.mesh.position.clone();
          spawnPos.y += 0.5;
          this.projectileManager.spawn(spawnPos, playerPos, this.stats.damage, 7.5);
        }
        this.attackCooldownTimer = this.stats.attackCooldown;
        this.flashTimer = 0.15;
        for (const mat of this.modelMaterials) {
          if (mat.emissive) mat.emissive.set(0x00ffcc);
        }
      }
    } else if (this.type === 'tank') {
      // Giant Imp Tank
      if (this.isPreparingSlam) {
        this.slamTimer -= dt;
        // Float and tremble upward while charging mace
        this.modelContainer.position.y = 0.45 + Math.sin(this.slamTimer * 25) * 0.15;
        this.modelContainer.rotation.x = -0.3; // leaning back to strike

        const pulse = Math.sin(this.slamTimer * 25) > 0;
        for (const mat of this.modelMaterials) {
          if (mat.emissive) mat.emissive.set(pulse ? 0x00ff88 : 0x006633);
        }

        if (this.slamTimer <= 0) {
          // Slam impact!
          this.isPreparingSlam = false;
          this.modelContainer.position.y = 0;
          this.modelContainer.rotation.x = 0.4; // slam forward
          for (const mat of this.modelMaterials) {
            if (mat.emissive) mat.emissive.set(0x000000);
          }
          this.attackCooldownTimer = this.stats.attackCooldown;

          // Check AoE hit on player
          const slamDist = this.mesh.position.distanceTo(playerPos);
          if (slamDist <= this.stats.attackRange + 0.5) {
            if (!player.invincible) {
              player.takeDamage(this.stats.damage);
              if (fxManager) fxManager.screenShake(0.35, 0.3);
            }
          }
        }
      } else {
        // Heavy Stomp Movement
        const moving = dist > this.stats.attackRange * 0.9;
        if (moving) {
          toPlayer.normalize();
          this.mesh.position.addScaledVector(toPlayer, this.stats.speed * dt);
          this.modelContainer.position.y = Math.abs(Math.sin(this.animTime * 6)) * 0.12;
          this.modelContainer.rotation.z = Math.sin(this.animTime * 6) * 0.08;
          this.modelContainer.rotation.x = 0.1;
        } else {
          this.modelContainer.position.y = 0;
          this.modelContainer.rotation.set(0, 0, 0);
          if (this.attackCooldownTimer <= 0) {
            this.isPreparingSlam = true;
            this.slamTimer = this.slamDuration;
          }
        }
      }
    } else {
      // Grunt (Puglin) - Goblin minion
      const moving = dist < this.stats.detectionRange && dist > this.stats.attackRange * 0.8;
      if (moving) {
        toPlayer.normalize();
        this.mesh.position.addScaledVector(toPlayer, this.stats.speed * dt);
        // Fast waddle & bobbing
        this.modelContainer.position.y = Math.abs(Math.sin(this.animTime * 13)) * 0.09;
        this.modelContainer.rotation.z = Math.sin(this.animTime * 13) * 0.14;
        this.modelContainer.rotation.x = 0.2; // leaning aggressively forward
      } else {
        // Idle breathing
        this.modelContainer.position.y = Math.sin(this.animTime * 3) * 0.03;
        this.modelContainer.rotation.set(0, 0, 0);
      }
    }

    // Room boundaries
    this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, -ROOM_BOUND, ROOM_BOUND);
    this.mesh.position.z = THREE.MathUtils.clamp(this.mesh.position.z, -ROOM_BOUND, ROOM_BOUND);

    // Cooldown decay
    if (this.attackCooldownTimer > 0) this.attackCooldownTimer -= dt;
  }

  /* ─────── damage ─────── */
  takeDamage(amount, attackerPos) {
    this.stats.hp -= amount;
    if (Enemy.onDamage) Enemy.onDamage(this, amount, !!this.lastHitCrit, this.lastHitType || 'normal', attackerPos);
    this.lastHitType = null;
    this.lastHitCrit = false;

    // knockback scaled by resistance
    const dir = new THREE.Vector3().subVectors(this.mesh.position, attackerPos);
    dir.y = 0;
    if (dir.lengthSq() > 0.001) dir.normalize();
    this.knockbackVel.copy(dir).multiplyScalar(12 * this.stats.knockbackResistance);

    // flash
    this.flashTimer = 0.12;
    for (const mat of this.modelMaterials) {
      if (mat.emissive) mat.emissive.set(0xffffff);
    }

    this._drawHp();
    if (this.stats.hp <= 0) this.die();
  }

  die() {
    this.alive = false;
    this.deathTimer = 0.35;
  }

  dispose() {
    if (this.auraLight) {
      this.mesh.remove(this.auraLight);
      this.auraLight.dispose();
    }
    this.modelMaterials.forEach(m => m.dispose());
    this._hpTex.dispose();
    this.hpSprite.material.dispose();
  }
}

Enemy.onDamage = null;
