export class BoonUI {
  constructor(soundManager = null) {
    this.soundManager = soundManager;
    this.overlay = document.getElementById('boon-overlay');
    this.cards = document.getElementById('boon-cards');
  }

  setSoundManager(sm) {
    this.soundManager = sm;
  }

  show(boons, onSelect) {
    if (this.soundManager) {
      this.soundManager.playBoonStinger();
    }

    this.cards.innerHTML = '';

    for (const boon of boons) {
      const card = document.createElement('div');
      card.className = `boon-card ${boon.rarity}` + (['storm', 'poison', 'shadow_fire'].includes(boon.element) ? ` el-${boon.element}` : '');
      const tag = ['storm', 'poison', 'shadow_fire'].includes(boon.element)
        ? `<div class="element-tag">${boon.elementName}</div>`
        : '';
      card.innerHTML = `
        <div class="icon">${boon.icon}</div>
        ${tag}
        <div class="name">${boon.name}</div>
        <div class="desc">${boon.description}</div>
        <div class="rarity-label">${this._label(boon.rarity)}</div>
      `;
      card.addEventListener('click', () => {
        if (this.soundManager) {
          this.soundManager.playBoonSelect();
        }
        this.hide();
        onSelect(boon);
      });
      this.cards.appendChild(card);
    }

    this.overlay.classList.remove('hidden');
  }

  hide() {
    this.overlay.classList.add('hidden');
  }

  _label(r) {
    return { common: '★ Sıradan', rare: '★★ Nadir', epic: '★★★ Destansı' }[r] || r;
  }
}
