import * as THREE from 'three';

export class RoomManager {
  constructor() {
    this.roomNumber = 0;
    this.state = 'idle'; // idle | spawning | combat | cleared
    this.cycle = 0; // tamamlanan boss turu sayısı
    this.isBossRoom = false;
  }

  static isBossRoomNumber(n) {
    return n > 0 && n % 5 === 0;
  }

  setupRoom(enemyFactory, player, { deferSpawn = false } = {}) {
    this.roomNumber++;
    this.isBossRoom = RoomManager.isBossRoomNumber(this.roomNumber);

    player.mesh.position.set(0, 0, 0);
    player.mesh.rotation.set(0, 0, 0);

    if (deferSpawn) {
      this.state = 'spawning';
      return;
    }

    this.spawnRoomEnemies(enemyFactory);
  }

  spawnRoomEnemies(enemyFactory, fxManager = null, accentHex = 0x00ffcc) {
    this.state = 'combat';
    const difficulty = 1 + (this.roomNumber - 1) * 0.15 + this.cycle * 0.3;

    if (this.isBossRoom) {
      const bossPos = new THREE.Vector3(0, 0, -4.5);
      enemyFactory.spawnBoss(
        bossPos,
        difficulty,
        Math.min(2, Math.floor(this.roomNumber / 5) - 1),
      );
      if (fxManager) fxManager.spawnPortalBurst(bossPos, accentHex, 2.2);
      return;
    }

    // Composition based on room number
    let grunts = 2;
    let ranged = 1;
    let tanks = 0;

    if (this.roomNumber >= 2) {
      grunts = 2 + Math.floor(this.roomNumber / 2);
      ranged = 1 + Math.floor(this.roomNumber / 2);
    }
    if (this.roomNumber >= 3) {
      tanks = Math.min(2, Math.floor((this.roomNumber - 1) / 2));
    }

    // Spawn grunts
    for (let i = 0; i < grunts; i++) {
      const pos = this._spawnPos();
      enemyFactory.spawnEnemy(pos, 'grunt', difficulty);
      if (fxManager) fxManager.spawnPortalBurst(pos, accentHex, 1.0);
    }
    // Spawn ranged
    for (let i = 0; i < ranged; i++) {
      const pos = this._spawnPos();
      enemyFactory.spawnEnemy(pos, 'ranged', difficulty);
      if (fxManager) fxManager.spawnPortalBurst(pos, accentHex, 1.0);
    }
    // Spawn tanks
    for (let i = 0; i < tanks; i++) {
      const pos = this._spawnPos();
      enemyFactory.spawnEnemy(pos, 'tank', difficulty);
      if (fxManager) fxManager.spawnPortalBurst(pos, accentHex, 1.35);
    }
  }

  nextRoom(enemyFactory, player, opts = {}) {
    enemyFactory.clearAll();
    this.setupRoom(enemyFactory, player, opts);
  }

  reset() {
    this.roomNumber = 0;
    this.state = 'idle';
    this.cycle = 0;
    this.isBossRoom = false;
  }

  _spawnPos() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 3.5 + Math.random() * 3.5;
    return new THREE.Vector3(
      THREE.MathUtils.clamp(Math.cos(angle) * dist, -7, 7),
      0,
      THREE.MathUtils.clamp(Math.sin(angle) * dist, -7, 7),
    );
  }
}
