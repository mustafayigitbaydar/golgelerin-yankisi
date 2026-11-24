const CONTROLS = [
  ['W A S D', 'Hareket'],
  ['SPACE', 'Dash (kısa süre dokunulmaz)'],
  ['SOL TIK', 'Temel saldırı'],
  ['SAĞ TIK', 'Özel saldırı (bekleme süreli)'],
  ['1 · 2 · 3', 'Silah: Kılıç / Mızrak / Asa'],
  ['ESC', 'Duraklat / Devam'],
];

const TIPS = [
  '⚡ Her odayı temizleyince bir Lütuf seç. Fırtına, Zehir ve Gölge Ateşi elementleri birleşip güçlenir.',
  '💎 Düşmanlardan düşen Ruh Kristalleri kalıcıdır. Ruh Sunağı\'nda kalıcı yükseltmeye harca.',
  '📦 Sandık ve vazoları kır: Can İksiri ya da ekstra kristal çıkar.',
  '🌿 Orman tuzakları sana da düşmana da zarar verir. Düşmanları tuzağa çek!',
  '☠ Her 5. odada bir Boss seni bekliyor. Uyarı çizgilerine ve dairelere dikkat et.',
];

export function controlsHTML(withTips = false) {
  const rows = CONTROLS.map(
    ([k, d]) => `<div class="ctl-row"><span class="ctl-key">${k}</span><span class="ctl-desc">${d}</span></div>`,
  ).join('');
  const tips = withTips
    ? `<div class="howto-tips">${TIPS.map((t) => `<p>${t}</p>`).join('')}</div>`
    : '';
  return `<div class="ctl-grid">${rows}</div>${tips}`;
}

export class MenuUI {
  constructor(cfg) {
    this.cfg = cfg;
    this.menu = document.getElementById('main-menu');
    this.pause = document.getElementById('pause');
    this.howto = document.getElementById('howto');
    this.shardsEl = document.getElementById('mm-shards');
    this.volume = document.getElementById('pause-volume');
    this.volumeLabel = document.getElementById('pause-volume-label');

    document.getElementById('howto-body').innerHTML = controlsHTML(true);
    document.getElementById('pause-controls').innerHTML = controlsHTML(false);

    const sfx = (name) => {
      const sm = cfg.soundManager;
      if (sm && sm[name]) sm[name]();
    };

    document.getElementById('mm-start').addEventListener('click', () => {
      sfx('playBoonSelect');
      cfg.onStart();
    });
    document.getElementById('mm-altar').addEventListener('click', () => sfx('playWeaponSwitch'));
    document.getElementById('mm-howto').addEventListener('click', () => {
      sfx('playWeaponSwitch');
      this.showHowto();
    });
    document.getElementById('howto-close').addEventListener('click', () => this.hideHowto());
    document.getElementById('pause-resume').addEventListener('click', () => {
      sfx('playWeaponSwitch');
      cfg.onResume();
    });
    document.getElementById('pause-menu').addEventListener('click', () => {
      sfx('playWeaponSwitch');
      cfg.onMainMenu();
    });

    this.volume.addEventListener('input', () => {
      const v = Number(this.volume.value) / 100;
      this.volumeLabel.textContent = `${this.volume.value}%`;
      cfg.onVolume(v);
    });
  }

  showMenu(shards) {
    this.updateShards(shards);
    this.menu.classList.remove('hidden');
  }

  hideMenu() {
    this.menu.classList.add('hidden');
  }

  updateShards(n) {
    if (this.shardsEl) this.shardsEl.textContent = `💎 ${n}`;
  }

  showPause() {
    const v = Math.round(this.cfg.getVolume() * 100);
    this.volume.value = v;
    this.volumeLabel.textContent = `${v}%`;
    this.pause.classList.remove('hidden');
  }

  hidePause() {
    this.pause.classList.add('hidden');
  }

  showHowto() {
    this.howto.classList.remove('hidden');
  }

  hideHowto() {
    this.howto.classList.add('hidden');
  }

  isHowtoOpen() {
    return !this.howto.classList.contains('hidden');
  }
}
