import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Enemy } from './Enemy.js';
import { BOSS_CLASSES } from './Boss.js';

export class EnemyFactory {
  constructor(scene, projectileManager = null) {
    this.scene = scene;
    this.projectileManager = projectileManager;
    /** @type {Enemy[]} */
    this.enemies = [];
    this.totalSpawned = 0;

    this.models = {
      puglin: null,
      imp: null,
    };

    this._loadModels();
  }

  _loadModels() {
    const loader = new GLTFLoader();

    // Load Puglin (Grunt)
    loader.load(
      '/models/Puglin.glb',
      (gltf) => {
        this.models.puglin = gltf.scene;
        // retroactively attach to any waiting grunt enemies
        this.enemies.forEach((e) => {
          if (e.type === 'grunt' && e.fallbackMesh) {
            e.attachModel(SkeletonUtils.clone(gltf.scene));
          }
        });
      },
      undefined,
      (err) => console.error('Error loading Puglin.glb:', err)
    );

    // Load Imp (Ranged & Tank)
    loader.load(
      '/models/Imp.glb',
      (gltf) => {
        this.models.imp = gltf.scene;
        // retroactively attach to any waiting ranged or tank enemies
        this.enemies.forEach((e) => {
          if ((e.type === 'ranged' || e.type === 'tank' || e.type === 'boss') && e.fallbackMesh) {
            e.attachModel(SkeletonUtils.clone(gltf.scene));
          }
        });
      },
      undefined,
      (err) => console.error('Error loading Imp.glb:', err)
    );
  }

  setProjectileManager(pm) {
    this.projectileManager = pm;
  }

  setSoundManager(sm) {
    this.soundManager = sm;
  }

  spawnBoss(position, difficulty = 1, index = 0) {
    const template = this.models.imp ? SkeletonUtils.clone(this.models.imp) : null;
    const BossClass = BOSS_CLASSES[Math.min(index, BOSS_CLASSES.length - 1)];
    const boss = new BossClass(this.scene, position, difficulty, this.projectileManager, template, this.soundManager || null);
    boss.factory = this;
    boss.models = this.models;
    this.enemies.push(boss);
    this.totalSpawned++;
    return boss;
  }

  getBoss() {
    return this.enemies.find((e) => e.isBoss) || null;
  }

  spawnEnemy(position, type = 'grunt', difficulty = 1) {
    // Select model template
    let template = null;
    if (type === 'grunt' && this.models.puglin) {
      template = SkeletonUtils.clone(this.models.puglin);
    } else if ((type === 'ranged' || type === 'tank') && this.models.imp) {
      template = SkeletonUtils.clone(this.models.imp);
    }

    const enemy = new Enemy(
      this.scene,
      position,
      type,
      {},
      this.projectileManager,
      template
    );

    // Apply difficulty scaling
    enemy.stats.maxHp = Math.round(enemy.stats.maxHp * difficulty);
    enemy.stats.hp = enemy.stats.maxHp;
    enemy.stats.damage = Math.round(enemy.stats.damage * difficulty);
    enemy._drawHp();

    this.enemies.push(enemy);
    this.totalSpawned++;
    return enemy;
  }

  update(dt, playerPos, player, fxManager) {
    for (const e of this.enemies) e.update(dt, playerPos, player, fxManager);

    // remove finished death anims
    this.enemies = this.enemies.filter((e) => {
      if (e.readyToRemove) {
        this.scene.remove(e.mesh);
        e.dispose();
        return false;
      }
      return true;
    });
  }

  allDead() {
    if (this.totalSpawned === 0) return false;
    return this.enemies.every((e) => !e.alive);
  }

  clearAll() {
    for (const e of this.enemies) {
      this.scene.remove(e.mesh);
      e.dispose();
    }
    this.enemies = [];
    this.totalSpawned = 0;
  }
}
