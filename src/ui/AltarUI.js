import { UPGRADES } from '../systems/MetaProgression.js';

export class AltarUI {
  constructor(meta, soundManager = null, onChange = null) {
    this.meta = meta;
    this.soundManager = soundManager;
    this.onChange = onChange;
    this.overlay = document.getElementById('altar');
    this.list = document.getElementById('altar-list');
    this.shardsEl = document.getElementById('altar-shards');

    document.getElementById('altar-close').addEventListener('click', () => this.hide());
    for (const id of ['altar-btn-go', 'altar-btn-victory', 'mm-altar']) {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', () => this.show());
    }
  }

  show() {
    this.render();
    this.overlay.classList.remove('hidden');
  }

  hide() {
    this.overlay.classList.add('hidden');
  }

  render() {
    this.shardsEl.textContent = `💎 ${this.meta.shards} Ruh Kristali`;
    this.list.innerHTML = '';

    for (const u of UPGRADES) {
      const lvl = this.meta.level(u.id);
      const cost = this.meta.nextCost(u.id);
      const item = document.createElement('div');
      item.className = 'altar-item';

      const pips = '◆'.repeat(lvl) + '◇'.repeat(u.max - lvl);
      item.innerHTML = `
        <div class="a-icon">${u.icon}</div>
        <div class="a-info">
          <div class="a-name">${u.name}</div>
          <div class="a-desc">${u.desc}</div>
          <div class="a-pips">${pips}</div>
        </div>
      `;

      const btn = document.createElement('button');
      if (cost === null) {
        btn.textContent = 'MAKS';
        btn.disabled = true;
      } else {
        btn.textContent = `💎 ${cost}`;
        btn.disabled = !this.meta.canBuy(u.id);
        btn.addEventListener('click', () => {
          if (this.meta.buy(u.id)) {
            if (this.soundManager) this.soundManager.playAltarBuy();
            this.render();
            if (this.onChange) this.onChange();
          }
        });
      }
      item.appendChild(btn);
      this.list.appendChild(item);
    }
  }
}
