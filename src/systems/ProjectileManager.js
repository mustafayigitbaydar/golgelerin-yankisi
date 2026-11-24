import * as THREE from 'three';

const ROOM_BOUND = 7.8;

export class ProjectileManager {
  constructor(scene, fxManager) {
    this.scene = scene;
    this.fxManager = fxManager;
    this.projectiles = [];

    // Shared sphere geometry
    this.geo = new THREE.SphereGeometry(0.18, 12, 12);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ddaa,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
  }

  spawn(startPos, targetPos, damage = 12, speed = 7.0) {
    const dir = new THREE.Vector3().subVectors(targetPos, startPos);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
    dir.normalize();

    const mesh = new THREE.Mesh(this.geo, this.mat.clone());
    mesh.position.copy(startPos);
    mesh.position.y = 0.5;
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      dir,
      speed,
      damage,
      lifetime: 3.5,
    });
  }

  update(dt, player) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.lifetime -= dt;

      p.mesh.position.addScaledVector(p.dir, p.speed * dt);

      // Hit player check
      const distToPlayer = p.mesh.position.distanceTo(player.mesh.position);
      if (distToPlayer < 0.65) {
        if (!player.invincible) {
          player.takeDamage(p.damage);
          this.fxManager.screenShake(0.2, 0.2);
        }
        this._removeAt(i);
        continue;
      }

      // Out of bounds or expired
      if (
        p.lifetime <= 0 ||
        Math.abs(p.mesh.position.x) > ROOM_BOUND ||
        Math.abs(p.mesh.position.z) > ROOM_BOUND
      ) {
        this._removeAt(i);
      }
    }
  }

  _removeAt(index) {
    const p = this.projectiles[index];
    this.scene.remove(p.mesh);
    p.mesh.material.dispose();
    this.projectiles.splice(index, 1);
  }

  clearAll() {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      p.mesh.material.dispose();
    }
    this.projectiles = [];
  }
}
