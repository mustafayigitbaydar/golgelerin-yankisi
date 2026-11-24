import * as THREE from 'three';

export class ElementalManager {
  constructor(scene, soundManager = null, fxManager = null) {
    this.scene = scene;
    this.soundManager = soundManager;
    this.fxManager = fxManager;

    // Active visual lightning lines
    this.lightningBolts = [];

    // Active shadow fire patches on the floor
    this.firePatches = [];

    // Shared materials & geometries for lightning & fire
    this.lightningMat = new THREE.LineBasicMaterial({
      color: 0x4df5ff,
      linewidth: 3,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });

    // Shadow fire circle geometry
    this.fireGeo = new THREE.CircleGeometry(1.05, 16);
    this.fireGeo.rotateX(-Math.PI / 2);

    this.fireMat = new THREE.MeshBasicMaterial({
      color: 0xb5179e,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.lastDashPatchPos = new THREE.Vector3();
  }

  setSoundManager(sm) {
    this.soundManager = sm;
  }

  setFXManager(fx) {
    this.fxManager = fx;
  }

  /* ═══════════════════════════════════════════
     1. FIRTINA LÜTFU — ZİNCİRLEME YILDIRIM (CHAIN LIGHTNING)
     ═══════════════════════════════════════════ */
  triggerChainLightning(sourcePos, primaryEnemy, allEnemies, player) {
    if (!player.elements || !player.elements.storm) return;

    const maxTargets = 2 + (player.elements.stormChains || 0);
    const maxRadius = 6.2;
    const shockDamage = Math.round(22 * (player.elements.stormDamageMult || 1.0));

    // Find nearby alive enemies except the primary target
    const candidates = [];
    for (const enemy of allEnemies) {
      if (!enemy.alive || enemy === primaryEnemy || enemy.stats.hp <= 0) continue;
      const dist = enemy.mesh.position.distanceTo(sourcePos);
      if (dist <= maxRadius) {
        candidates.push({ enemy, dist });
      }
    }

    // Sort by nearest
    candidates.sort((a, b) => a.dist - b.dist);
    const targets = candidates.slice(0, maxTargets).map(c => c.enemy);

    if (targets.length === 0) return;

    if (this.soundManager) {
      this.soundManager.playChainLightning();
    }

    let prevPos = sourcePos.clone();
    prevPos.y = 0.6;

    for (const target of targets) {
      const targetPos = target.mesh.position.clone();
      targetPos.y = 0.6;

      // Draw zigzag lightning arc
      this._createLightningArc(prevPos, targetPos);

      // Deal shock damage to target
      target.lastHitType = 'lightning';
      target.takeDamage(shockDamage, prevPos);

      // Apply poison if player also has poison synergy!
      if (player.elements.poison) {
        this.applyPoison(target, player);
      }

      if (this.fxManager) {
        this.fxManager.screenShake(0.08, 0.1);
      }

      prevPos = targetPos;
    }
  }

  _createLightningArc(start, end) {
    const points = [];
    const segments = 8;
    const diff = new THREE.Vector3().subVectors(end, start);
    const len = diff.length();
    const dir = diff.clone().normalize();

    // Perpendicular vector for jitter
    const up = new THREE.Vector3(0, 1, 0);
    const perp = new THREE.Vector3().crossVectors(dir, up).normalize();

    points.push(start.clone());
    for (let i = 1; i < segments; i++) {
      const frac = i / segments;
      const basePos = start.clone().addScaledVector(diff, frac);
      const jitterAmount = (Math.random() - 0.5) * Math.min(0.8, len * 0.22);
      const verticalJitter = (Math.random() - 0.5) * 0.4;
      basePos.addScaledVector(perp, jitterAmount);
      basePos.y += verticalJitter;
      points.push(basePos);
    }
    points.push(end.clone());

    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = this.lightningMat.clone();
    const line = new THREE.Line(geom, lineMat);
    this.scene.add(line);

    this.lightningBolts.push({
      mesh: line,
      life: 0.16,
      maxLife: 0.16,
    });
  }

  /* ═══════════════════════════════════════════
     2. ORMAN ZEHİRİ LÜTFU — ZEHİRLENME (POISON DoT)
     ═══════════════════════════════════════════ */
  applyPoison(enemy, player) {
    if (!player.elements || !player.elements.poison || !enemy.alive) return;

    const baseDuration = 4.0;
    const tickInterval = 0.6;
    const tickDamage = Math.round(8 * (player.elements.poisonDamageMult || 1.0));

    enemy.poisonState = {
      active: true,
      duration: baseDuration,
      tickTimer: tickInterval,
      tickInterval: tickInterval,
      damage: tickDamage,
    };
  }

  updatePoison(dt, enemies) {
    for (const enemy of enemies) {
      if (!enemy.alive || !enemy.poisonState || !enemy.poisonState.active) continue;

      const p = enemy.poisonState;
      p.duration -= dt;
      p.tickTimer -= dt;

      // Glow toxic green
      const pulse = 0.5 + Math.sin(p.duration * 12) * 0.5;
      for (const mat of enemy.modelMaterials) {
        if (mat.emissive) {
          mat.emissive.setRGB(0.05, 0.55 * pulse, 0.15 * pulse);
        }
      }

      // Tick damage
      if (p.tickTimer <= 0) {
        p.tickTimer = p.tickInterval;
        enemy.lastHitType = 'poison';
        enemy.takeDamage(p.damage, enemy.mesh.position);

        if (this.soundManager) {
          this.soundManager.playPoisonTick();
        }

        if (this.fxManager) {
          this.fxManager.spawnPoisonParticle(enemy.mesh.position);
        }
      }

      // Poison finished
      if (p.duration <= 0 || enemy.stats.hp <= 0) {
        p.active = false;
        for (const mat of enemy.modelMaterials) {
          if (mat.emissive) mat.emissive.set(0x000000);
        }
      }
    }
  }

  /* ═══════════════════════════════════════════
     3. GÖLGE ATEŞİ LÜTFU — DASH ATEŞ İZİ (SHADOW FIRE)
     ═══════════════════════════════════════════ */
  onPlayerDashTick(player) {
    if (!player.elements || !player.elements.shadowFire || !player.isDashing) return;

    const pos = player.mesh.position;
    // Check distance from last dropped flame
    if (this.lastDashPatchPos.distanceTo(pos) > 0.8) {
      this.lastDashPatchPos.copy(pos);
      this.spawnShadowFirePatch(pos, player);
    }
  }

  spawnShadowFirePatch(pos, player) {
    const mesh = new THREE.Mesh(this.fireGeo, this.fireMat.clone());
    mesh.position.set(pos.x, 0.04, pos.z);
    mesh.scale.set(0.6, 0.6, 0.6);
    this.scene.add(mesh);

    if (this.soundManager) {
      this.soundManager.playShadowFireIgnite();
    }

    this.firePatches.push({
      mesh,
      position: pos.clone(),
      life: 3.2,
      maxLife: 3.2,
      damage: Math.round(9 * (player.elements.shadowFireDamageMult || 1.0)),
      tickTimer: 0.3,
    });
  }

  updateFirePatches(dt, enemies) {
    for (let i = this.firePatches.length - 1; i >= 0; i--) {
      const patch = this.firePatches[i];
      patch.life -= dt;
      patch.tickTimer -= dt;

      // Pulse visual
      const p = Math.max(0, patch.life / patch.maxLife);
      patch.mesh.material.opacity = p * 0.75;
      patch.mesh.scale.setScalar(0.85 + Math.sin(patch.life * 15) * 0.15);
      patch.mesh.rotation.z += dt * 2.5;

      // Damage enemies touching the fire
      if (patch.tickTimer <= 0) {
        patch.tickTimer = 0.32;
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          const dist = patch.position.distanceTo(enemy.mesh.position);
          if (dist <= 1.25) {
            enemy.lastHitType = 'fire';
            enemy.takeDamage(patch.damage, patch.position);
            // Burn flash
            for (const mat of enemy.modelMaterials) {
              if (mat.emissive) mat.emissive.set(0x7209b7);
            }
          }
        }
      }

      if (patch.life <= 0) {
        this.scene.remove(patch.mesh);
        patch.mesh.geometry.dispose();
        patch.mesh.material.dispose();
        this.firePatches.splice(i, 1);
      }
    }
  }

  /* ═══════════════════════════════════════════
     MAIN FRAME UPDATE
     ═══════════════════════════════════════════ */
  update(dt, player, enemies) {
    // 1. Update lightning visuals
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const b = this.lightningBolts[i];
      b.life -= dt;
      b.mesh.material.opacity = Math.max(0, b.life / b.maxLife);
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        this.lightningBolts.splice(i, 1);
      }
    }

    // 2. Dash fire creation
    if (player) {
      this.onPlayerDashTick(player);
    }

    // 3. Fire patch updates
    this.updateFirePatches(dt, enemies);

    // 4. Poison DoT updates
    this.updatePoison(dt, enemies);
  }

  clearAll() {
    for (const b of this.lightningBolts) {
      this.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
    }
    this.lightningBolts = [];

    for (const p of this.firePatches) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.firePatches = [];
  }
}
