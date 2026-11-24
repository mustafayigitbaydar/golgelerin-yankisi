import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { easeOutCubic } from '../utils/math.js';

const UP = new THREE.Vector3(0, 1, 0);
const ROOM_BOUND = 7.5;

const DEFAULT_STATS = {
  maxHp: 100,
  hp: 100,
  speed: 5.2,
  dashSpeed: 22,
  dashDuration: 0.28,
  dashCooldown: 1.0,
  critChance: 0.05,
  lifesteal: 0,
  maxDashes: 1,
};

export class Player {
  constructor(scene, soundManager = null, projectileManager = null) {
    this.scene = scene;
    this.soundManager = soundManager;
    this.projectileManager = projectileManager;
    this.stats = { ...DEFAULT_STATS };

    // ── Elemental Powers ──
    this.elements = {
      storm: false,
      stormChains: 0,
      stormDamageMult: 1.0,
      poison: false,
      poisonDamageMult: 1.0,
      shadowFire: false,
      shadowFireDamageMult: 1.0,
    };

    // ── Weapons Definition ──
    this.currentWeapon = 'sword'; // 'sword' | 'spear' | 'staff'
    this.weaponStats = {
      sword: {
        name: 'Ruh Kılıcı',
        icon: '⚔️',
        specialCooldown: 3.5,
        specialTimer: 0,
        attackDuration: 0.28,
        attackCooldown: 0.24,
      },
      spear: {
        name: 'Lanetli Mızrak',
        icon: '🔱',
        specialCooldown: 4.0,
        specialTimer: 0,
        attackDuration: 0.30,
        attackCooldown: 0.32,
      },
      staff: {
        name: 'Gölge Asası',
        icon: '🪄',
        specialCooldown: 4.5,
        specialTimer: 0,
        attackDuration: 0.26,
        attackCooldown: 0.26,
      },
    };

    // Attack state
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldownTimer = 0;
    this.attackHits = new Set();
    this.comboStep = 1;
    this.comboResetTimer = 0;

    // Special attacks flags for CombatSystem
    this.whirlwindTriggered = false;
    this.spearThrustTriggered = false;
    this.isSpearThrown = false;

    // Movement & Dash
    this.isDashing = false;
    this.invincible = false;
    this.transitionInvulnerable = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.dashCharges = this.stats.maxDashes || 1;
    this.dashDir = new THREE.Vector3();

    this.flashTimer = 0;
    this.torchTime = 0;

    // ── Mesh Root ──
    this.mesh = new THREE.Group();
    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.currentAction = null;
    this.modelMaterials = [];

    // Weapon hand meshes
    this.weaponRBone = null;
    this.swordMesh = null;
    this.spearMesh = null;
    this.staffMesh = null;
    this.staffCrystal = null;

    // ── Warm Amber / Golden Hero Torch Light ──
    this.torchLight = new THREE.PointLight(0xffaa33, 2.9, 11.5, 1.35);
    this.torchLight.position.set(0, 1.25, 0);
    this.mesh.add(this.torchLight);

    // ── Sword Slash Trail Mesh (Emerald Spirit Fire) ──
    const slashGeo = new THREE.RingGeometry(0.85, 2.05, 32, 1, -Math.PI / 3, (2 * Math.PI) / 3);
    const slashMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.slashMesh = new THREE.Mesh(slashGeo, slashMat);
    this.slashMesh.rotation.x = -Math.PI / 2;
    this.slashMesh.position.y = 0.1;
    this.mesh.add(this.slashMesh);
    this.slashTimer = 0;
    this.slashDuration = 0.28;

    // ── Whirlwind 360 Spin Visual Mesh ──
    const whirlGeo = new THREE.RingGeometry(1.2, 4.3, 48);
    const whirlMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.whirlMesh = new THREE.Mesh(whirlGeo, whirlMat);
    this.whirlMesh.rotation.x = -Math.PI / 2;
    this.whirlMesh.position.y = 0.1;
    this.mesh.add(this.whirlMesh);
    this.whirlTimer = 0;

    // ── Spear Thrust Line Visual Mesh ──
    const thrustGeo = new THREE.PlaneGeometry(1.0, 3.8);
    const thrustMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.thrustMesh = new THREE.Mesh(thrustGeo, thrustMat);
    this.thrustMesh.rotation.x = -Math.PI / 2;
    this.thrustMesh.position.set(0, 0.1, 1.9); // Extended forward
    this.mesh.add(this.thrustMesh);
    this.thrustTimer = 0;

    // ── Temporary fallback box while GLTF loads ──
    const fallbackGeo = new THREE.CapsuleGeometry(0.25, 0.5, 8, 16);
    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0x226655,
      roughness: 0.5,
    });
    this.fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
    this.fallbackMesh.position.y = 0.5;
    this.fallbackMesh.castShadow = true;
    this.mesh.add(this.fallbackMesh);

    scene.add(this.mesh);

    // ── Load 3D Warrior GLTF model ──
    this._loadModel();
  }

  setSoundManager(sm) {
    this.soundManager = sm;
  }

  setProjectileManager(pm) {
    this.projectileManager = pm;
  }

  _loadModel() {
    const loader = new GLTFLoader();
    loader.load(
      '/models/Warrior.gltf',
      (gltf) => {
        if (this.fallbackMesh) {
          this.mesh.remove(this.fallbackMesh);
          this.fallbackMesh.geometry.dispose();
          this.fallbackMesh.material.dispose();
          this.fallbackMesh = null;
        }

        const model = gltf.scene;
        this.model = model;

        model.scale.setScalar(0.55);
        model.position.y = 0;

        // Configure shadows & clone materials
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material = child.material.clone();
              this.modelMaterials.push(child.material);
            }
          }
        });

        // ── Find Weapon.R Hand Bone & Setup 3D Weapons ──
        this.weaponRBone = model.getObjectByName('Weapon.R');
        const modelSword = model.getObjectByName('Warrior_Sword');
        if (modelSword) modelSword.visible = false; // yerine prosedürel Ruh Kılıcı kullanılır
        this.swordMesh = null;

        if (this.weaponRBone) {
          this._createSwordMesh();
          this._createSpearMesh();
          this._createStaffMesh();
        }

        this.mesh.add(model);
        this._updateWeaponMeshes();

        // Setup AnimationMixer
        this.mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
          this.actions[clip.name] = this.mixer.clipAction(clip);
        });

        const idleAnim = this.actions['Idle_Weapon'] ? 'Idle_Weapon' : 'Idle';
        this.playAction(idleAnim, 0.1, 1.0);
      },
      undefined,
      (err) => console.error('Error loading Warrior.gltf:', err)
    );
  }

  _createSwordMesh() {
    this.swordMesh = new THREE.Group();

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x9ffbe8,
      emissive: 0x00ddaa,
      emissiveIntensity: 1.6,
      roughness: 0.25,
      metalness: 0.2,
    });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.95, 0.025), bladeMat);
    blade.position.y = 0.62;
    blade.castShadow = true;
    this.swordMesh.add(blade);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.064, 0.2, 4), bladeMat);
    tip.position.y = 1.19;
    tip.rotation.y = Math.PI / 4;
    this.swordMesh.add(tip);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2a4a44, roughness: 0.5, metalness: 0.3 });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.07), metalMat);
    guard.position.y = 0.12;
    this.swordMesh.add(guard);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), metalMat);
    grip.position.y = 0.0;
    this.swordMesh.add(grip);

    this.swordMesh.rotation.x = Math.PI / 2;
    this.swordMesh.position.set(-0.05, 0.08, -0.05);
    this.weaponRBone.add(this.swordMesh);
  }

  _createSpearMesh() {
    this.spearMesh = new THREE.Group();

    // Spear shaft
    const shaftGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.3, 8);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0x142820,
      metalness: 0.5,
      roughness: 0.5,
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = 0.35;
    shaft.castShadow = true;
    this.spearMesh.add(shaft);

    // Spearhead
    const headGeo = new THREE.ConeGeometry(0.08, 0.52, 4);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ddaa,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.8,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.55;
    head.castShadow = true;
    this.spearMesh.add(head);

    // Grip mount
    this.spearMesh.rotation.x = Math.PI / 2; // Point forward from hand
    this.spearMesh.position.set(-0.05, 0.08, -0.05);

    this.weaponRBone.add(this.spearMesh);
  }

  _createStaffMesh() {
    this.staffMesh = new THREE.Group();

    // Staff wood body
    const staffGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.85, 8);
    const staffMat = new THREE.MeshStandardMaterial({
      color: 0x24142e,
      roughness: 0.7,
      metalness: 0.3,
    });
    const staffBody = new THREE.Mesh(staffGeo, staffMat);
    staffBody.position.y = 0.25;
    staffBody.castShadow = true;
    this.staffMesh.add(staffBody);

    // Floating crystal head
    const crystalGeo = new THREE.OctahedronGeometry(0.13);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffaa,
      emissiveIntensity: 2.5,
      roughness: 0.1,
      metalness: 0.9,
    });
    this.staffCrystal = new THREE.Mesh(crystalGeo, crystalMat);
    this.staffCrystal.position.y = 1.25;
    this.staffCrystal.castShadow = true;
    this.staffMesh.add(this.staffCrystal);

    this.staffMesh.rotation.x = Math.PI / 2;
    this.staffMesh.position.set(-0.05, 0.08, -0.05);

    this.weaponRBone.add(this.staffMesh);
  }

  _updateWeaponMeshes() {
    if (this.swordMesh) this.swordMesh.visible = (this.currentWeapon === 'sword');
    if (this.spearMesh) this.spearMesh.visible = (this.currentWeapon === 'spear' && !this.isSpearThrown);
    if (this.staffMesh) this.staffMesh.visible = (this.currentWeapon === 'staff');
  }

  switchWeapon(type) {
    if (this.currentWeapon === type || !this.weaponStats[type]) return;
    this.currentWeapon = type;
    this._updateWeaponMeshes();
    if (this.soundManager) this.soundManager.playWeaponSwitch();
  }

  onSpearReturned() {
    this.isSpearThrown = false;
    this._updateWeaponMeshes();
  }

  playAction(name, fadeTime = 0.12, timeScale = 1.0, loopOnce = false) {
    if (!this.actions || !this.actions[name]) return;
    const nextAction = this.actions[name];

    if (this.currentAction === nextAction && nextAction.isRunning()) return;

    if (loopOnce) {
      nextAction.reset();
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
    } else {
      nextAction.setLoop(THREE.LoopRepeat);
      nextAction.clampWhenFinished = false;
    }

    nextAction.timeScale = timeScale;

    if (this.currentAction && this.currentAction !== nextAction) {
      this.currentAction.fadeOut(fadeTime);
    }

    nextAction.reset().fadeIn(fadeTime).play();
    this.currentAction = nextAction;
  }

  /* ─────── Main Update ─────── */
  update(dt, input) {
    this.torchTime += dt;
    {
      const maxD = this.stats.maxDashes || 1;
      if (this.dashCharges < maxD) {
        this.dashCooldownTimer -= dt;
        if (this.dashCooldownTimer <= 0) {
          this.dashCharges++;
          this.dashCooldownTimer = this.dashCharges < maxD ? this.stats.dashCooldown : 0;
        }
      } else {
        this.dashCooldownTimer = 0;
    this.dashCharges = this.stats.maxDashes || 1;
      }
    }
    if (this.attackCooldownTimer > 0) this.attackCooldownTimer -= dt;

    // Weapon special cooldown timers
    for (const key of Object.keys(this.weaponStats)) {
      if (this.weaponStats[key].specialTimer > 0) {
        this.weaponStats[key].specialTimer -= dt;
      }
    }

    // Combo reset timer
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.comboStep = 1;
    }

    // Weapon selection inputs (1, 2, 3)
    if (input.weapon1Pressed) this.switchWeapon('sword');
    if (input.weapon2Pressed) this.switchWeapon('spear');
    if (input.weapon3Pressed) this.switchWeapon('staff');

    // Warm torch flicker
    this.torchLight.intensity = 2.7 + Math.sin(this.torchTime * 13) * 0.28 + Math.cos(this.torchTime * 21) * 0.14;

    // Staff crystal rotation
    if (this.staffCrystal) {
      this.staffCrystal.rotation.y += dt * 3.5;
      this.staffCrystal.rotation.x += dt * 2.0;
    }

    // Update animations
    if (this.mixer) this.mixer.update(dt);

    // Flash decay
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        for (const mat of this.modelMaterials) {
          if (mat.emissive) mat.emissive.set(0x000000);
        }
      }
    }

    // ── Sword Slash Trail Visual ──
    if (this.slashTimer > 0) {
      this.slashTimer -= dt;
      const p = 1 - Math.max(0, this.slashTimer / this.slashDuration);
      this.slashMesh.scale.setScalar(0.75 + p * 0.55);
      this.slashMesh.material.opacity = Math.max(0, (1 - p) * 0.5);
      if (this.slashTimer <= 0) this.slashMesh.material.opacity = 0;
    }

    // ── Whirlwind 360 Spin Visual ──
    if (this.whirlTimer > 0) {
      this.whirlTimer -= dt;
      const p = 1 - Math.max(0, this.whirlTimer / 0.38);
      this.whirlMesh.scale.setScalar(0.5 + p * 0.65);
      this.whirlMesh.rotation.z += dt * 18;
      this.whirlMesh.material.opacity = Math.max(0, (1 - p) * 0.45);
      if (this.whirlTimer <= 0) this.whirlMesh.material.opacity = 0;
    }

    // ── Spear Thrust Line Visual ──
    if (this.thrustTimer > 0) {
      this.thrustTimer -= dt;
      const p = 1 - Math.max(0, this.thrustTimer / 0.24);
      this.thrustMesh.scale.set(1.0, 0.4 + p * 0.7, 1.0);
      this.thrustMesh.material.opacity = Math.max(0, (1 - p) * 0.5);
      if (this.thrustTimer <= 0) this.thrustMesh.material.opacity = 0;
    }

    // Dead animation check
    if (this.isDead()) {
      if (this.actions['Death'] && this.currentAction !== this.actions['Death']) {
        this.playAction('Death', 0.2, 1.0, true);
      }
      return;
    }

    // ── Dash Active ──
    if (this.isDashing) {
      this.dashTimer -= dt;
      this.mesh.position.addScaledVector(this.dashDir, this.stats.dashSpeed * dt);
      this._clamp();
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.invincible = false;
        for (const mat of this.modelMaterials) {
          mat.transparent = false;
          mat.opacity = 1.0;
          if (mat.emissive) mat.emissive.set(0x000000);
        }
        this._updateLocomotionAnim(input);
      }
      return;
    }

    // ── Movement ──
    const rawDir = new THREE.Vector3();
    if (input.keys.w) rawDir.z -= 1;
    if (input.keys.s) rawDir.z += 1;
    if (input.keys.a) rawDir.x -= 1;
    if (input.keys.d) rawDir.x += 1;
    if (rawDir.lengthSq() === 0 && input.moveVec && (input.moveVec.x !== 0 || input.moveVec.z !== 0)) {
      rawDir.x = input.moveVec.x;
      rawDir.z = input.moveVec.z;
    }

    const worldDir = new THREE.Vector3();
    const isMoving = rawDir.lengthSq() > 0;
    if (isMoving) {
      worldDir.copy(rawDir).normalize().applyAxisAngle(UP, Math.PI / 4);
      const spd = this.isAttacking ? this.stats.speed * 0.4 : this.stats.speed;
      this.mesh.position.addScaledVector(worldDir, spd * dt);
      if (!this.isAttacking) {
        this.mesh.rotation.y = Math.atan2(worldDir.x, worldDir.z);
      }
    }

    // ── Attack Timers ──
    if (this.isAttacking) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.attackCooldownTimer = this.weaponStats[this.currentWeapon].attackCooldown;
        this._updateLocomotionAnim(input);
      }
    } else if (!this.isDashing) {
      this._updateLocomotionAnim(input);
    }

    // ── Dash Input ──
    if (input.spacePressed && this.dashCharges > 0) {
      if (this.isAttacking) this.isAttacking = false;
      this._startDash(worldDir);
    }

    // ── Primary Attack Input (Left Click / Mobile Attack Button) ──
    const attackTrigger = input.mouseLeftPressed || (input.isTouchActive && input.mouseLeftDown);
    if (attackTrigger && !this.isAttacking && this.attackCooldownTimer <= 0) {
      this._startPrimaryAttack(input.mouseWorldPos);
    }

    // ── Special Attack Input (Right Click) ──
    if (input.mouseRightPressed && !this.isAttacking) {
      const wStat = this.weaponStats[this.currentWeapon];
      if (wStat.specialTimer <= 0) {
        this._startSpecialAttack(input.mouseWorldPos);
      }
    }

    this._clamp();
  }

  _updateLocomotionAnim(input) {
    if (this.isAttacking || this.isDashing || this.isDead()) return;

    const isMoving =
      input.keys.w ||
      input.keys.a ||
      input.keys.s ||
      input.keys.d ||
      (input.moveVec && (input.moveVec.x !== 0 || input.moveVec.z !== 0));
    if (isMoving) {
      const runAnim = this.actions['Run_Weapon'] ? 'Run_Weapon' : 'Run';
      this.playAction(runAnim, 0.12, 1.35);
    } else {
      const idleAnim = this.actions['Idle_Weapon'] ? 'Idle_Weapon' : 'Idle';
      this.playAction(idleAnim, 0.2, 1.0);
    }
  }

  /* ─────── Primary Attack (Left Click) ─────── */
  _startPrimaryAttack(targetPos) {
    const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position);
    dir.y = 0;
    if (dir.lengthSq() > 0.01) {
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }

    const wStat = this.weaponStats[this.currentWeapon];
    this.isAttacking = true;
    this.attackTimer = wStat.attackDuration;
    this.attackHits = new Set();

    if (this.currentWeapon === 'sword') {
      // 3-Hit Combo
      const step = this.comboStep;
      if (this.soundManager) this.soundManager.playSwordCombo(step);

      // Animation selection
      let anim = 'Sword_Attack';
      if (step === 2 && this.actions['Sword_Attack2']) anim = 'Sword_Attack2';
      else if (step === 3 && this.actions['Punch']) anim = 'Punch';
      this.playAction(anim, 0.04, step === 3 ? 2.6 : 2.4, true);

      // Slash visual
      this.slashTimer = this.slashDuration;
      this.slashMesh.material.opacity = 0.5;
      this.slashMesh.scale.set(0.7 + step * 0.1, 0.7 + step * 0.1, 0.7 + step * 0.1);

      // Advance combo
      this.comboStep = (this.comboStep % 3) + 1;
      this.comboResetTimer = 0.85; // Combo window
    } else if (this.currentWeapon === 'spear') {
      // Piercing Spear Thrust
      if (this.soundManager) this.soundManager.playSpearThrust();

      const anim = this.actions['Punch'] ? 'Punch' : 'Sword_Attack';
      this.playAction(anim, 0.04, 2.7, true);

      // Spear thrust line visual & trigger CombatSystem
      this.thrustTimer = 0.24;
      this.thrustMesh.material.opacity = 0.5;
      this.spearThrustTriggered = true;
    } else if (this.currentWeapon === 'staff') {
      // Magic Soul Bolt Projectile
      if (this.soundManager) this.soundManager.playStaffShoot();

      const anim = this.actions['Sword_Attack'] ? 'Sword_Attack' : 'Punch';
      this.playAction(anim, 0.04, 2.8, true);

      if (this.projectileManager) {
        const handPos = this.mesh.position.clone();
        handPos.y += 0.55;
        this.projectileManager.spawnBolt(handPos, targetPos, Math.round(28 * (this.stats.attackDamageMult || 1)));
      }
    }
  }

  /* ─────── Special Attack (Right Click) ─────── */
  _startSpecialAttack(targetPos) {
    const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position);
    dir.y = 0;
    if (dir.lengthSq() > 0.01) {
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }

    const wStat = this.weaponStats[this.currentWeapon];
    wStat.specialTimer = wStat.specialCooldown;
    this.isAttacking = true;
    this.attackTimer = 0.35;
    this.attackHits = new Set();

    if (this.currentWeapon === 'sword') {
      // 360° Whirlwind Spin
      if (this.soundManager) this.soundManager.playSwordWhirlwind();

      const anim = this.actions['Sword_Attack'] ? 'Sword_Attack' : 'Run_Weapon';
      this.playAction(anim, 0.04, 3.2, true);

      this.whirlTimer = 0.38;
      this.whirlMesh.material.opacity = 0.45;
      this.whirlwindTriggered = true;
    } else if (this.currentWeapon === 'spear') {
      // Spear Throw & Recall Javelin
      if (this.soundManager) this.soundManager.playSpearThrow();

      const anim = this.actions['Punch'] ? 'Punch' : 'Sword_Attack';
      this.playAction(anim, 0.04, 2.6, true);

      // Hide spear in hand and launch projectile
      this.isSpearThrown = true;
      this._updateWeaponMeshes();

      if (this.projectileManager) {
        const handPos = this.mesh.position.clone();
        handPos.y += 0.6;
        this.projectileManager.spawnThrownSpear(handPos, targetPos, Math.round(40 * (this.stats.specialDamageMultiplier || 1)), this);
      }
    } else if (this.currentWeapon === 'staff') {
      // 5-Way Spread Barrage
      if (this.soundManager) this.soundManager.playStaffSpread();

      const anim = this.actions['Sword_Attack2'] ? 'Sword_Attack2' : 'Sword_Attack';
      this.playAction(anim, 0.04, 2.8, true);

      if (this.projectileManager) {
        const handPos = this.mesh.position.clone();
        handPos.y += 0.55;
        this.projectileManager.spawnSpreadBolts(handPos, targetPos, Math.round(25 * (this.stats.specialDamageMultiplier || 1)));
      }

      this.flashTimer = 0.2;
      for (const mat of this.modelMaterials) {
        if (mat.emissive) mat.emissive.set(0x00ffcc);
      }
    }
  }

  /* ─────── Dash ─────── */
  _startDash(moveDir) {
    this.isDashing = true;
    this.invincible = true;
    this.dashTimer = this.stats.dashDuration;
    if (this.dashCharges >= (this.stats.maxDashes || 1)) {
      this.dashCooldownTimer = this.stats.dashCooldown;
    }
    this.dashCharges--;

    if (this.soundManager) this.soundManager.playDash();

    if (moveDir.lengthSq() > 0) {
      this.dashDir.copy(moveDir).normalize();
    } else {
      this.dashDir.set(
        Math.sin(this.mesh.rotation.y),
        0,
        Math.cos(this.mesh.rotation.y),
      );
    }

    const rollAnim = this.actions['Roll'] ? 'Roll' : (this.actions['Run_Weapon'] ? 'Run_Weapon' : 'Run');
    this.playAction(rollAnim, 0.04, 3.4, true);

    for (const mat of this.modelMaterials) {
      mat.transparent = true;
      mat.opacity = 0.35;
      if (mat.emissive) mat.emissive.set(0x00ffaa);
    }
  }

  takeDamage(amount) {
    if (this.invincible || this.transitionInvulnerable) return;
    this.stats.hp = Math.max(0, this.stats.hp - amount);
    this.flashTimer = 0.15;

    if (this.soundManager) this.soundManager.playPlayerHurt();

    for (const mat of this.modelMaterials) {
      if (mat.emissive) mat.emissive.set(0xff0022);
    }
  }

  isDead() {
    return this.stats.hp <= 0;
  }

  reset() {
    this.mesh.position.set(0, 0, 0);
    this.mesh.rotation.set(0, 0, 0);
    this.stats = { ...DEFAULT_STATS };

    // ── Elemental Powers ──
    this.elements = {
      storm: false,
      stormChains: 0,
      stormDamageMult: 1.0,
      poison: false,
      poisonDamageMult: 1.0,
      shadowFire: false,
      shadowFireDamageMult: 1.0,
    };
    this.isAttacking = false;
    this.isDashing = false;
    this.invincible = false;
    this.transitionInvulnerable = false;
    this.attackTimer = 0;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.dashCharges = this.stats.maxDashes || 1;
    this.attackCooldownTimer = 0;
    this.whirlwindTriggered = false;
    this.spearThrustTriggered = false;
    this.isSpearThrown = false;
    this.comboStep = 1;
    this.comboResetTimer = 0;
    this.slashTimer = 0;
    this.whirlTimer = 0;
    this.thrustTimer = 0;
    this.slashMesh.material.opacity = 0;
    this.whirlMesh.material.opacity = 0;
    this.thrustMesh.material.opacity = 0;
    this.flashTimer = 0;

    for (const k of Object.keys(this.weaponStats)) {
      this.weaponStats[k].specialTimer = 0;
    }

    for (const mat of this.modelMaterials) {
      mat.opacity = 1;
      mat.transparent = false;
      if (mat.emissive) mat.emissive.set(0x000000);
    }

    this._updateWeaponMeshes();
    const idleAnim = this.actions['Idle_Weapon'] ? 'Idle_Weapon' : 'Idle';
    this.playAction(idleAnim, 0.1, 1.0);
  }

  /** Kalıcı (Ruh Sunağı) yükseltmelerini koşu başında uygula */
  applyMeta(levels) {
    this.stats.maxHp += 20 * (levels.hp || 0);
    this.stats.hp = this.stats.maxHp;
    this.stats.maxDashes = 1 + (levels.dash || 0);
    this.stats.attackDamageMult = (this.stats.attackDamageMult || 1) * (1 + 0.1 * (levels.damage || 0));
    this.stats.critChance += 0.05 * (levels.crit || 0);
    this.dashCharges = this.stats.maxDashes;
    this.dashCooldownTimer = 0;
  }

  _clamp() {
    this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, -ROOM_BOUND, ROOM_BOUND);
    this.mesh.position.z = THREE.MathUtils.clamp(this.mesh.position.z, -ROOM_BOUND, ROOM_BOUND);
  }
}
