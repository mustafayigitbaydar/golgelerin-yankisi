import * as THREE from 'three';

export class CombatSystem {
  constructor(fxManager, soundManager = null, elementalManager = null) {
    this.fxManager = fxManager;
    this.soundManager = soundManager;
    this.elementalManager = elementalManager;
  }

  setSoundManager(sm) {
    this.soundManager = sm;
  }

  setElementalManager(em) {
    this.elementalManager = em;
  }

  update(dt, player, enemies) {
    // ── 1. Sword Special: 360° Whirlwind Spin ──
    if (player.whirlwindTriggered) {
      player.whirlwindTriggered = false;
      this.fxManager.screenShake(0.32, 0.22);

      let anyHit = false;
      const specialMult = player.stats.specialDamageMultiplier || 1.0;

      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const dist = enemy.mesh.position.distanceTo(player.mesh.position);
        if (dist <= 4.2) {
          anyHit = true;
          let damage = Math.round(55 * specialMult);
          if (Math.random() < player.stats.critChance) { damage = Math.round(damage * 1.8); enemy.lastHitCrit = true; }

          const wasAlive = enemy.alive && enemy.stats.hp > 0;
          enemy.takeDamage(damage, player.mesh.position);

          // Apply Elemental Synergies
          if (this.elementalManager) {
            this.elementalManager.triggerChainLightning(enemy.mesh.position, enemy, enemies, player);
            this.elementalManager.applyPoison(enemy, player);
          }

          if (wasAlive && enemy.stats.hp <= 0 && this.soundManager) {
            this.soundManager.playEnemyDeath();
          }

          // Outward radial knockback
          const knockDir = new THREE.Vector3().subVectors(enemy.mesh.position, player.mesh.position);
          knockDir.y = 0;
          if (knockDir.lengthSq() > 0.001) knockDir.normalize();
          enemy.knockbackVel.addScaledVector(knockDir, 18 * enemy.stats.knockbackResistance);
        }
      }
      if (anyHit && this.soundManager) {
        this.soundManager.playHitImpact(true);
      }
    }

    // ── 2. Spear Normal: Piercing Line Thrust ──
    if (player.spearThrustTriggered) {
      player.spearThrustTriggered = false;
      this.fxManager.screenShake(0.18, 0.14);

      const forward = new THREE.Vector3(
        Math.sin(player.mesh.rotation.y),
        0,
        Math.cos(player.mesh.rotation.y),
      );

      let anyHit = false;
      const attackMult = player.stats.attackDamageMult || 1.0;

      for (const enemy of enemies) {
        if (!enemy.alive) continue;

        const toEnemy = new THREE.Vector3().subVectors(enemy.mesh.position, player.mesh.position);
        toEnemy.y = 0;

        // Project enemy pos onto forward direction
        const forwardDist = toEnemy.dot(forward);
        if (forwardDist < 0 || forwardDist > 3.9) continue; // In front, up to 3.9 units

        // Lateral distance (perpendicular to forward)
        const lateralDist = toEnemy.clone().cross(forward).length();
        if (lateralDist > 0.65) continue; // Width corridor

        anyHit = true;
        let damage = Math.round(35 * attackMult);
        if (Math.random() < player.stats.critChance) { damage = Math.round(damage * 1.8); enemy.lastHitCrit = true; }

        const wasAlive = enemy.alive && enemy.stats.hp > 0;
        enemy.takeDamage(damage, player.mesh.position);

        // Apply Elemental Synergies
        if (this.elementalManager) {
          this.elementalManager.triggerChainLightning(enemy.mesh.position, enemy, enemies, player);
          this.elementalManager.applyPoison(enemy, player);
        }

        if (wasAlive && enemy.stats.hp <= 0 && this.soundManager) {
          this.soundManager.playEnemyDeath();
        }

        // Forward knockback
        enemy.knockbackVel.addScaledVector(forward, 12 * enemy.stats.knockbackResistance);
      }

      if (anyHit && this.soundManager) {
        this.soundManager.playHitImpact(false);
      }
    }

    // ── 3. Sword Primary Combo Melee Hits ──
    if (player.isAttacking && player.currentWeapon === 'sword') {
      const forward = new THREE.Vector3(
        Math.sin(player.mesh.rotation.y),
        0,
        Math.cos(player.mesh.rotation.y),
      );
      const attackMult = player.stats.attackDamageMult || 1.0;

      for (const enemy of enemies) {
        if (!enemy.alive || player.attackHits.has(enemy)) continue;

        const toEnemy = new THREE.Vector3().subVectors(
          enemy.mesh.position,
          player.mesh.position,
        );
        toEnemy.y = 0;
        const dist = toEnemy.length();
        if (dist > 2.0) continue;

        const angle = forward.angleTo(toEnemy.normalize());
        if (angle > Math.PI / 3) continue;

        player.attackHits.add(enemy);

        // Damage based on combo step
        const isFinisher = player.comboStep === 3;
        let damage = isFinisher ? 42 : (player.comboStep === 2 ? 28 : 24);
        damage = Math.round(damage * attackMult);

        let isCrit = false;
        if (Math.random() < player.stats.critChance) {
          damage = Math.round(damage * 1.8);
          isCrit = true;
          enemy.lastHitCrit = true;
        }

        const wasAlive = enemy.alive && enemy.stats.hp > 0;
        enemy.takeDamage(damage, player.mesh.position);

        // Apply Elemental Synergies
        if (this.elementalManager) {
          this.elementalManager.triggerChainLightning(enemy.mesh.position, enemy, enemies, player);
          this.elementalManager.applyPoison(enemy, player);
        }

        if (this.soundManager) {
          this.soundManager.playHitImpact(isCrit || isFinisher);
          if (wasAlive && enemy.stats.hp <= 0) {
            this.soundManager.playEnemyDeath();
          }
        }

        // Lifesteal
        if (player.stats.lifesteal > 0) {
          const heal = Math.round(damage * player.stats.lifesteal);
          player.stats.hp = Math.min(player.stats.hp + heal, player.stats.maxHp);
        }

        this.fxManager.screenShake(isFinisher ? 0.25 : 0.12, isFinisher ? 0.18 : 0.12);
      }
    }

    // ── 4. Enemy Attacks on Player ──
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (enemy.type !== 'grunt') continue;

      const dist = enemy.mesh.position.distanceTo(player.mesh.position);
      if (dist < enemy.stats.attackRange && enemy.attackCooldownTimer <= 0) {
        if (!player.invincible) {
          player.takeDamage(enemy.stats.damage);
          this.fxManager.screenShake(0.18, 0.2);
        }
        enemy.attackCooldownTimer = enemy.stats.attackCooldown;
      }
    }
  }
}
