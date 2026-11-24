import * as THREE from 'three';

export class FXManager {
  constructor(scene = null) {
    this.scene = scene;
    this.shakeTimer = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeOffset = new THREE.Vector3();
    this._flashTargets = [];

    // ── Biome Airborne Particles (Fireflies / Embers / Spirit Crystals) ──
    this.fireflyPoints = null;
    this.fireflyData = [];
    this.fireflyCount = 220;
    this.particleSpeedMult = 1.0;
    this.time = 0;

    this.sparks = [];
    this.dmgNumbers = [];
    this.spawnBursts = [];

    if (scene) {
      this._initFireflies(scene);
    }
  }

  spawnPortalBurst(pos, colorHex = 0x00ffcc, scale = 1.0) {
    if (!this.scene) return;
    const group = new THREE.Group();
    group.position.set(pos.x, 0.05, pos.z);

    const ringGeo = new THREE.RingGeometry(0.25 * scale, 0.55 * scale, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);

    const beamGeo = new THREE.CylinderGeometry(0.18 * scale, 0.42 * scale, 2.6 * scale, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 1.3 * scale;
    group.add(beam);

    this.scene.add(group);
    this.spawnBursts.push({ group, ring, beam, ringMat, beamMat, life: 0.55, maxLife: 0.55 });
  }

  spawnPoisonParticle(pos) {
    if (!this.scene) return;
    const geo = new THREE.SphereGeometry(0.08, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.position.x += (Math.random() - 0.5) * 0.5;
    mesh.position.y += 0.4 + Math.random() * 0.4;
    mesh.position.z += (Math.random() - 0.5) * 0.5;
    this.scene.add(mesh);

    this.sparks.push({
      mesh,
      velY: 1.2 + Math.random() * 0.8,
      life: 0.4,
      maxLife: 0.4,
    });
  }

  setScene(scene) {
    this.scene = scene;
    if (!this.fireflyPoints) {
      this._initFireflies(scene);
    }
  }

  _createFireflyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.28, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.6, 'rgba(220, 220, 220, 0.35)');
    grad.addColorStop(1, 'rgba(180, 180, 180, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  _initFireflies(scene) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.fireflyCount * 3);
    const colors = new Float32Array(this.fireflyCount * 3);
    const baseSizes = new Float32Array(this.fireflyCount);

    const palette = [
      new THREE.Color(0x00ffaa), // Vibrant emerald
      new THREE.Color(0x22ffbb), // Cyan firefly
      new THREE.Color(0x00e5ff), // Soul turquoise
      new THREE.Color(0x7affb2), // Pale ethereal mist green
    ];

    for (let i = 0; i < this.fireflyCount; i++) {
      const x = (Math.random() - 0.5) * 16;
      const y = 0.2 + Math.random() * 6.5;
      const z = (Math.random() - 0.5) * 16;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      baseSizes[i] = 0.16 + Math.random() * 0.18;

      this.fireflyData.push({
        baseX: x,
        baseZ: z,
        baseY: y,
        speedY: 0.2 + Math.random() * 0.6, // gentle wandering upward
        swaySpeed: 1.0 + Math.random() * 1.8,
        swayRadius: 0.25 + Math.random() * 0.5,
        pulseSpeed: 2.0 + Math.random() * 4.0, // blinking firefly rate
        phase: Math.random() * Math.PI * 2,
        initialSize: baseSizes[i],
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(baseSizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.26,
      vertexColors: true,
      map: this._createFireflyTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.fireflyPoints = new THREE.Points(geometry, material);
    scene.add(this.fireflyPoints);
  }

  setBiome(biome) {
    if (!this.fireflyPoints || !biome) return;
    this.particleSpeedMult = biome.particleSpeedMult ?? 1.0;
    const palette = (biome.particlePalette || [0x00ffaa]).map((h) => new THREE.Color(h));
    const colAttr = this.fireflyPoints.geometry.attributes.color;
    const colors = colAttr.array;
    for (let i = 0; i < this.fireflyCount; i++) {
      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    colAttr.needsUpdate = true;
    this.fireflyPoints.material.size = biome.id === 'crystal' ? 0.32 : biome.id === 'ash' ? 0.24 : 0.26;
  }

  spawnDamageNumber(pos, amount, crit = false, yOffset = 1.6, type = 'normal') {
    if (!this.scene) return;
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    const text = String(Math.round(amount)) + (crit ? '!' : '');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = crit ? 'bold 62px Segoe UI, Arial' : 'bold 40px Segoe UI, Arial';
    ctx.lineWidth = crit ? 9 : 6;
    ctx.strokeStyle = crit ? '#7a3b00' : '#000000';
    ctx.strokeText(text, 80, 40);
    const colors = { normal: '#ffffff', poison: '#4dff7a', lightning: '#4df5ff', fire: '#ff9a3c' };
    ctx.shadowColor = crit ? '#ffcc00' : (colors[type] || '#ffffff');
    ctx.shadowBlur = crit ? 20 : 8;
    ctx.fillStyle = crit ? '#ffe600' : (colors[type] || '#ffffff');
    ctx.fillText(text, 80, 40);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(crit ? 3.0 : 1.2, crit ? 1.5 : 0.6, 1);
    sprite.position.set(
      pos.x + (Math.random() - 0.5) * 0.6,
      pos.y + yOffset,
      pos.z + (Math.random() - 0.5) * 0.6,
    );
    sprite.renderOrder = 999;
    this.scene.add(sprite);
    const life = crit ? 1.1 : 0.7;
    this.dmgNumbers.push({ sprite, tex, mat, life, maxLife: life, vy: crit ? 2.2 : 1.6, crit });
  }

  screenShake(intensity, duration) {
    const remaining = this.shakeIntensity * (this.shakeTimer / (this.shakeDuration || 1));
    if (intensity >= remaining) {
      this.shakeIntensity = intensity;
      this.shakeDuration = duration;
      this.shakeTimer = duration;
    }
  }

  hitFlash(mesh, color, duration) {
    if (!mesh || !mesh.material || !mesh.material.emissive) return;
    mesh.material.emissive.set(color);
    this._flashTargets.push({ mesh, timer: duration });
  }

  update(dt) {
    this.time += dt;

    // ── screen shake ──
    this.shakeOffset.set(0, 0, 0);
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const t = Math.max(0, this.shakeTimer / this.shakeDuration);
      const a = this.shakeIntensity * t;
      this.shakeOffset.set(
        (Math.random() - 0.5) * 2 * a,
        (Math.random() - 0.5) * 2 * a,
        (Math.random() - 0.5) * 2 * a,
      );
    }

    // ── hit flash decay ──
    for (let i = this._flashTargets.length - 1; i >= 0; i--) {
      const f = this._flashTargets[i];
      f.timer -= dt;
      if (f.timer <= 0) {
        if (f.mesh.material && f.mesh.material.emissive) {
          f.mesh.material.emissive.set(0x000000);
        }
        this._flashTargets.splice(i, 1);
      }
    }

    // ── damage numbers ──
    for (let i = this.dmgNumbers.length - 1; i >= 0; i--) {
      const n = this.dmgNumbers[i];
      n.life -= dt;
      n.sprite.position.y += n.vy * dt;
      n.vy *= Math.max(0, 1 - 2.5 * dt);
      const t = Math.max(0, n.life / n.maxLife);
      n.mat.opacity = Math.min(1, t * 2.5);
      if (n.crit) {
        const pop = 1 + Math.max(0, (t - 0.8) * 2.5);
        n.sprite.scale.set(3.0 * pop, 1.5 * pop, 1);
      }
      if (n.life <= 0) {
        this.scene.remove(n.sprite);
        n.tex.dispose();
        n.mat.dispose();
        this.dmgNumbers.splice(i, 1);
      }
    }

    // ── enemy spawn portal bursts ──
    for (let i = this.spawnBursts.length - 1; i >= 0; i--) {
      const b = this.spawnBursts[i];
      b.life -= dt;
      const p = 1 - Math.max(0, b.life / b.maxLife);
      b.ring.scale.setScalar(0.6 + p * 1.8);
      b.ringMat.opacity = Math.max(0, (1 - p) * 0.9);
      b.beam.scale.set(1 - p * 0.6, 1 + p * 0.5, 1 - p * 0.6);
      b.beamMat.opacity = Math.max(0, (1 - p) * 0.65);
      if (b.life <= 0) {
        this.scene.remove(b.group);
        b.ring.geometry.dispose();
        b.beam.geometry.dispose();
        b.ringMat.dispose();
        b.beamMat.dispose();
        this.spawnBursts.splice(i, 1);
      }
    }

    // ── sparks / poison bubble particles ──
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.mesh.position.y += s.velY * dt;
      s.mesh.scale.multiplyScalar(0.96);
      s.mesh.material.opacity = Math.max(0, s.life / s.maxLife);
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        this.sparks.splice(i, 1);
      }
    }

    // ── Fireflies wandering & twinkling ──
    if (this.fireflyPoints) {
      const posAttr = this.fireflyPoints.geometry.attributes.position;
      const positions = posAttr.array;

      for (let i = 0; i < this.fireflyCount; i++) {
        const d = this.fireflyData[i];
        let y = positions[i * 3 + 1] + d.speedY * this.particleSpeedMult * dt;

        // Reset if drifted too high
        if (y > 6.5) {
          y = 0.2;
          positions[i * 3] = (Math.random() - 0.5) * 15.5;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 15.5;
          d.baseX = positions[i * 3];
          d.baseZ = positions[i * 3 + 2];
        }

        positions[i * 3 + 1] = y;
        // Natural firefly hovering/meandering
        positions[i * 3] = d.baseX + Math.sin(this.time * d.swaySpeed + d.phase) * d.swayRadius;
        positions[i * 3 + 2] = d.baseZ + Math.cos(this.time * (d.swaySpeed * 0.8) + d.phase) * d.swayRadius;
      }

      posAttr.needsUpdate = true;
    }
  }
}
