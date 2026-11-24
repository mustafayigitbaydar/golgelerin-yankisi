export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambienceGain = null;
    this.isMuted = false;
    this.ambienceStarted = false;
    this.currentBiome = 'forest';
    this.windFilter = null;
    this.lfo = null;
    this.lfoGain = null;
    this.nextEchoTime = 5;

    this._initAudio();
  }

  _initAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      this.ambienceGain.connect(this.masterGain);

      // Auto-unlock on first user interaction
      const unlock = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().then(() => {
            this.startAmbience();
          });
        } else {
          this.startAmbience();
        }
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      };

      window.addEventListener('click', unlock);
      window.addEventListener('keydown', unlock);
      window.addEventListener('touchstart', unlock);
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  }

  resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.ambienceStarted) {
      this.startAmbience();
    }
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  toggleMute() {
    if (!this.masterGain || !this.ctx) return false;
    this.isMuted = !this.isMuted;
    const target = this.isMuted ? 0 : (this.volume ?? 0.7);
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    return this.isMuted;
  }

  /* ═══════════════════════════════════════════
     WEAPON SFX SYNTHESIZERS
     ═══════════════════════════════════════════ */

  // 1. Kılıç Kombo Vuruşları (3-Hit Combo)
  playSwordCombo(step = 1) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const pitchMap = { 1: [520, 160], 2: [440, 130], 3: [680, 90] };
    const [startFreq, endFreq] = pitchMap[step] || pitchMap[1];
    const isFinisher = step === 3;

    // Noise whoosh
    const bufferSize = Math.floor(this.ctx.sampleRate * (isFinisher ? 0.22 : 0.15));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(isFinisher ? 3.2 : 2.5, now);
    filter.frequency.setValueAtTime(isFinisher ? 1800 : 1400, now);
    filter.frequency.exponentialRampToValueAtTime(isFinisher ? 220 : 350, now + (isFinisher ? 0.2 : 0.14));

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(isFinisher ? 0.45 : 0.35, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinisher ? 0.22 : 0.15));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + (isFinisher ? 0.22 : 0.15));

    // Blade whistling tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = isFinisher ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + (isFinisher ? 0.18 : 0.13));

    oscGain.gain.setValueAtTime(isFinisher ? 0.25 : 0.15, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + (isFinisher ? 0.18 : 0.13));

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (isFinisher ? 0.18 : 0.13));

    // Finisher bass punch
    if (isFinisher) {
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(140, now);
      sub.frequency.exponentialRampToValueAtTime(40, now + 0.18);
      subGain.gain.setValueAtTime(0.35, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      sub.connect(subGain);
      subGain.connect(this.masterGain);
      sub.start(now);
      sub.stop(now + 0.18);
    }
  }

  // 2. Kılıç Özel: 360° Kasırga Kesişi (Whirlwind Spin)
  playSwordWhirlwind() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Sweeping whirlwind noise
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.38);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const out = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) out[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(3.0, now);
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.12);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.36);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.55, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.38);

    // Resonant hum
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);

    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(350, now);

    oGain.gain.setValueAtTime(0.4, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(lpf);
    lpf.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  // 3. Mızrak Normal: Delici Saplama (Spear Thrust Pierce)
  playSpearThrust() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // High velocity piercing noise
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const out = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) out[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(4.5, now);
    filter.frequency.setValueAtTime(2800, now);
    filter.frequency.exponentialRampToValueAtTime(450, now + 0.16);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.48, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.18);

    // Sharp metallic ring
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.15);

    oGain.gain.setValueAtTime(0.2, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // 4. Mızrak Özel: Fırlatma (Spear Throw)
  playSpearThrow() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.28);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  // 5. Mızrak Özel: Yakalama / Geri Dönüş (Spear Catch)
  playSpearCatch() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.14);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // 6. Asa Normal: Büyülü Enerji Oku (Staff Magic Bolt)
  playStaffShoot() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Crystal zap
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.14);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);

    // Sparkle chime harmonic
    const shimmer = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(1450, now);
    shimmer.frequency.exponentialRampToValueAtTime(720, now + 0.12);

    sGain.gain.setValueAtTime(0.15, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    shimmer.connect(sGain);
    sGain.connect(this.masterGain);
    shimmer.start(now);
    shimmer.stop(now + 0.12);
  }

  // 7. Asa Özel: 5'li Yaylım Ateşi (Staff 5-Way Spread Barrage)
  playStaffSpread() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Rapid cluster of crystal magic bursts
    const freqs = [620, 780, 960, 1180, 1420];
    freqs.forEach((freq, idx) => {
      const t = now + idx * 0.025;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, t + 0.16);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.16);
    });

    // Sub burst
    const sub = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(200, now);
    sub.frequency.exponentialRampToValueAtTime(50, now + 0.22);
    sGain.gain.setValueAtTime(0.4, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    sub.connect(sGain);
    sGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.22);
  }

  // 8. Silah Değiştirme (Weapon Switch Chime)
  playWeaponSwitch() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    [480, 720].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + i * 0.04 + 0.12);

      gain.gain.setValueAtTime(0.001, now + i * 0.04);
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.04 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.16);
    });
  }

  /* ═══════════════════════════════════════════
     COMMON COMBAT & IMPACT SFX
     ═══════════════════════════════════════════ */

  playHitImpact(isCrit = false) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Punchy bass transient
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isCrit ? 260 : 180, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

    gain.gain.setValueAtTime(isCrit ? 0.7 : 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);

    // Crack noise
    const noiseLen = Math.floor(this.ctx.sampleRate * 0.05);
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) d[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const nFilter = this.ctx.createBiquadFilter();
    nFilter.type = 'lowpass';
    nFilter.frequency.setValueAtTime(isCrit ? 1600 : 900, now);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.4, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.05);
  }

  playDash() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const out = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) out[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.8, now);
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.22);

    // Ethereal sweep
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.18);

    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playPlayerHurt() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.25);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playEnemyDeath() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);

    // Ethereal soul chime
    [660, 880].forEach((freq, idx) => {
      const chime = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(freq, now + idx * 0.04);
      chime.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.35);

      cGain.gain.setValueAtTime(0.15, now + idx * 0.04);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      chime.connect(cGain);
      cGain.connect(this.masterGain);
      chime.start(now + idx * 0.04);
      chime.stop(now + 0.35);
    });
  }

  playBoonStinger() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const notes = [349.2, 440.0, 523.3, 659.3, 784.0];
    notes.forEach((freq, i) => {
      const time = now + i * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.22, time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + 1.2);
    });
  }

  playBoonSelect() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const notes = [440.0, 554.4, 659.3, 880.0];
    notes.forEach((freq, i) => {
      const time = now + i * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.01, time);
      gain.gain.linearRampToValueAtTime(0.28, time + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.85);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + 0.85);
    });
  }

  /* ═══════════════════════════════════════════
     LANETLİ ORMAN AMBİYANSI (WIND & FOREST ECHOES)
     ═══════════════════════════════════════════ */
  startAmbience() {
    if (this.ambienceStarted || !this.ctx) return;
    this.ambienceStarted = true;

    const seconds = 5;
    const bufferSize = this.ctx.sampleRate * seconds;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + white * 0.05;
      b1 = 0.96 * b1 + white * 0.11;
      b2 = 0.86 * b2 + white * 0.25;
      data[i] = (b0 + b1 + b2) * 0.5;
    }

    const windSource = this.ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.Q.setValueAtTime(2.2, this.ctx.currentTime);
    windFilter.frequency.setValueAtTime(200, this.ctx.currentTime);
    this.windFilter = windFilter;

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.18, this.ctx.currentTime);
    lfoGain.gain.setValueAtTime(110, this.ctx.currentTime);
    this.lfo = lfo;
    this.lfoGain = lfoGain;

    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);

    windSource.connect(windFilter);
    windFilter.connect(this.ambienceGain);

    windSource.start();
    lfo.start();
    this._applyBiomeAmbience();
  }

  setBiome(biomeId) {
    this.currentBiome = biomeId || 'forest';
    this.nextEchoTime = biomeId === 'ash' ? 1.5 : 4.0;
    this._applyBiomeAmbience();
  }

  _applyBiomeAmbience() {
    if (!this.ctx || !this.windFilter || !this.lfo || !this.lfoGain) return;
    const now = this.ctx.currentTime;
    if (this.currentBiome === 'ash') {
      // Deep volcanic rumble
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.setTargetAtTime(125, now, 0.4);
      this.windFilter.Q.setTargetAtTime(1.4, now, 0.4);
      this.lfo.frequency.setTargetAtTime(0.32, now, 0.4);
      this.lfoGain.gain.setTargetAtTime(45, now, 0.4);
    } else if (this.currentBiome === 'crystal') {
      // Ethereal crystalline temple air
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.setTargetAtTime(420, now, 0.4);
      this.windFilter.Q.setTargetAtTime(4.8, now, 0.4);
      this.lfo.frequency.setTargetAtTime(0.11, now, 0.4);
      this.lfoGain.gain.setTargetAtTime(90, now, 0.4);
    } else {
      // Eerie cursed forest wind
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.setTargetAtTime(200, now, 0.4);
      this.windFilter.Q.setTargetAtTime(2.2, now, 0.4);
      this.lfo.frequency.setTargetAtTime(0.18, now, 0.4);
      this.lfoGain.gain.setTargetAtTime(110, now, 0.4);
    }
  }

  update(dt) {
    if (!this.ctx || this.isMuted || !this.ambienceStarted) return;
    this.nextEchoTime -= dt;

    if (this.nextEchoTime <= 0) {
      if (this.currentBiome === 'ash') {
        this.nextEchoTime = 1.4 + Math.random() * 2.2;
        this._playLavaCrackle();
      } else if (this.currentBiome === 'crystal') {
        this.nextEchoTime = 4.5 + Math.random() * 4.5;
        this._playTempleChime();
      } else {
        this.nextEchoTime = 7 + Math.random() * 8;
        this._playForestEcho();
      }
    }
  }

  _playLavaCrackle() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    // Crisp ember snap
    this._noise(0.06, 0.09, 2600 + Math.random() * 1400);
    // Occasional magma bubble pop
    if (Math.random() < 0.55) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(75 + Math.random() * 35, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.14);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ambienceGain);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  }

  _playTempleChime() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [587.3, 698.5, 880, 1046.5, 1174.7];
    const base = notes[Math.floor(Math.random() * notes.length)];
    [base, base * 1.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.001, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(i === 0 ? 0.09 : 0.05, now + i * 0.12 + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 2.6);
      osc.connect(gain);
      gain.connect(this.ambienceGain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 2.7);
    });
  }

  playBiomeTransition(biomeId) {
    if (!this.ctx || this.isMuted) return;
    if (biomeId === 'ash') {
      this._tone('sawtooth', 75, 42, 1.4, 0.25);
      this._noise(1.1, 0.2, 420);
      this._tone('triangle', 220, 165, 1.2, 0.14, 0.15);
    } else if (biomeId === 'crystal') {
      [440, 554.4, 659.3, 880, 1108.7].forEach((f, i) => {
        this._tone('sine', f, f * 1.005, 1.6, 0.14, i * 0.12);
      });
    } else {
      this._tone('sine', 196, 146.8, 1.1, 0.18);
    }
  }

  _playForestEcho() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const baseFreq = [520, 640, 780, 920][Math.floor(Math.random() * 4)];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + 1.8);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    osc.connect(gain);
    gain.connect(this.ambienceGain);

    osc.start(now);
    osc.stop(now + 2.2);
  }

  /* === ELEMENT & BOSS SFX === */
  _tone(type, f0, f1, dur, vol, delay = 0) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.masterGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, freq = 1000, delay = 0) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource(); s.buffer = b;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.masterGain);
    s.start(t);
  }

  playChainLightning() {
    this._noise(0.18, 0.3, 3500);
    this._tone('sawtooth', 1800, 200, 0.16, 0.14);
  }

  playPoisonTick() {
    this._tone('sine', 300, 120, 0.12, 0.1);
  }

  playShadowFireIgnite() {
    this._noise(0.2, 0.12, 500);
    this._tone('triangle', 140, 60, 0.2, 0.1);
  }

  playBossWarning() {
    this._tone('sawtooth', 110, 70, 0.7, 0.22);
    this._tone('square', 220, 140, 0.6, 0.08, 0.1);
  }

  playBossSlam() {
    this._tone('sine', 90, 25, 0.6, 0.6);
    this._noise(0.45, 0.4, 250);
  }

  playBossOrbs() {
    this._tone('triangle', 400, 900, 0.3, 0.2);
    this._tone('sine', 600, 1200, 0.3, 0.12, 0.05);
  }

  playBossRoar() {
    this._tone('sawtooth', 70, 40, 1.1, 0.3);
    this._noise(0.9, 0.2, 180);
  }

  playVictory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone('sine', f, f * 0.99, 1.1, 0.2, i * 0.16));
  }

  /* ═══ WORLD OBJECT SFX ═══ */
  playShardPickup() {
    const f = 900 + Math.random() * 500;
    this._tone('sine', f, f * 1.5, 0.12, 0.09);
  }

  playPotion() {
    this._tone('sine', 400, 800, 0.25, 0.2);
    this._tone('sine', 600, 1200, 0.3, 0.14, 0.08);
  }

  playCrateBreak() {
    this._noise(0.25, 0.4, 700);
    this._tone('square', 180, 60, 0.15, 0.12);
  }

  playTrapArm() {
    this._tone('square', 500, 520, 0.08, 0.08);
    this._tone('square', 500, 520, 0.08, 0.08, 0.2);
    this._tone('square', 560, 580, 0.08, 0.1, 0.4);
  }

  playTrapBurst() {
    this._noise(0.4, 0.4, 1800);
    this._tone('sawtooth', 220, 50, 0.35, 0.2);
  }

  playAltarBuy() {
    [440, 660, 880].forEach((f, i) => this._tone('sine', f, f, 0.4, 0.15, i * 0.07));
  }

  /* ═══ BOSS ÖZEL SESLERİ ═══ */
  // Orman Muhafızı: kök dalgası
  playRootWave() {
    this._tone('sawtooth', 70, 35, 0.6, 0.35);
    this._noise(0.5, 0.3, 300);
    this._noise(0.3, 0.2, 1400, 0.1);
  }

  // Gölge Avcısı
  playShadowWarn() {
    this._tone('sine', 300, 900, 0.8, 0.12);
    this._tone('sine', 310, 930, 0.8, 0.1);
  }

  playShadowDash() {
    this._noise(0.35, 0.35, 2500);
    this._tone('sawtooth', 1200, 80, 0.35, 0.18);
    this._tone('sine', 90, 40, 0.4, 0.3);
  }

  playShadowClone() {
    [220, 277, 330, 415].forEach((f, i) => this._tone('triangle', f * 2, f * 0.5, 0.9, 0.08, i * 0.06));
    this._noise(0.6, 0.1, 900);
  }

  // Fırtına Lordu
  playThunderWarn() {
    this._tone('sawtooth', 60, 240, 0.9, 0.12);
    this._tone('sine', 1200, 2400, 0.8, 0.05);
  }

  playThunderStrike(small = false) {
    const v = small ? 0.35 : 0.6;
    this._noise(0.12, v, 5000);
    this._noise(small ? 0.5 : 0.9, v * 0.8, 160);
    this._tone('sine', 80, 25, small ? 0.5 : 0.9, v);
  }

  playLaserHum(duration = 6) {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.3);
    g.gain.setValueAtTime(0.09, t + duration - 0.5);
    g.gain.linearRampToValueAtTime(0.001, t + duration);
    g.connect(this.masterGain);
    [95, 98.5, 190].forEach((f) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.frequency.value = 9;
      lg.gain.value = 14;
      lfo.connect(lg);
      lg.connect(o.frequency);
      o.connect(g);
      o.start(t);
      lfo.start(t);
      o.stop(t + duration);
      lfo.stop(t + duration);
    });
  }
}