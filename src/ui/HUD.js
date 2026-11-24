export class HUD {
  constructor(soundManager = null, onWeaponSelect = null) {
    this.soundManager = soundManager;
    this.onWeaponSelect = onWeaponSelect;

    this.hpBar = document.getElementById('hp-bar-inner');
    this.hpText = document.getElementById('hp-text');
    this.dashBar = document.getElementById('dash-bar-inner');
    this.roomInfo = document.getElementById('room-info');
    this.boonList = document.getElementById('boon-list');
    this.goOverlay = document.getElementById('game-over');
    this.goRoom = document.getElementById('final-room');
    this.goBtn = document.getElementById('restart-btn');
    this.muteBtn = document.getElementById('mute-btn');
    this._btnHandler = null;

    // Weapon cards & meters
    this.weaponCards = {
      sword: document.getElementById('card-sword'),
      spear: document.getElementById('card-spear'),
      staff: document.getElementById('card-staff'),
    };

    this.specialMeters = {
      sword: document.getElementById('meter-sword'),
      spear: document.getElementById('meter-spear'),
      staff: document.getElementById('meter-staff'),
    };

    // Attach click listeners to weapon cards
    Object.keys(this.weaponCards).forEach((weaponType) => {
      const card = this.weaponCards[weaponType];
      if (card) {
        card.addEventListener('click', () => {
          if (this.onWeaponSelect) this.onWeaponSelect(weaponType);
        });
      }
    });

    if (this.muteBtn) {
      this.muteBtn.addEventListener('click', () => {
        if (this.soundManager) {
          const isMuted = this.soundManager.toggleMute();
          this.muteBtn.textContent = isMuted ? '🔇' : '🔊';
        }
      });
    }
  }

  setSoundManager(sm) {
    this.soundManager = sm;
  }

  setOnWeaponSelect(cb) {
    this.onWeaponSelect = cb;
  }

  updateHp(player) {
    const r = Math.max(0, player.stats.hp / player.stats.maxHp);
    this.hpBar.style.width = `${r * 100}%`;
    this.hpText.textContent = `${Math.ceil(player.stats.hp)} / ${player.stats.maxHp}`;
  }

  updateDash(player) {
    const maxD = player.stats.maxDashes || 1;
    let r = 1;
    if (player.dashCharges < maxD) {
      const partial = player.stats.dashCooldown > 0
        ? 1 - Math.max(0, player.dashCooldownTimer) / player.stats.dashCooldown
        : 1;
      r = (player.dashCharges + Math.min(1, Math.max(0, partial))) / maxD;
    }
    this.dashBar.style.width = `${Math.min(1, Math.max(0, r)) * 100}%`;
    const lbl = document.getElementById('dash-label');
    if (lbl) lbl.textContent = maxD > 1 ? `ATILMA [SPACE] x${player.dashCharges}/${maxD}` : 'ATILMA [SPACE]';
  }

  updateShards(total, run) {
    const el = document.getElementById('shard-count');
    if (el) el.textContent = `💎 ${total}` + (run > 0 ? `  (+${run})` : '');
  }

  _oldUpdateDash(player) {
    let r = 1;
    if (player.dashCooldownTimer > 0) {
      r = 1 - player.dashCooldownTimer / player.stats.dashCooldown;
    }
    this.dashBar.style.width = `${Math.min(1, Math.max(0, r)) * 100}%`;
  }

  updateWeapons(player) {
    // 1. Highlight active weapon card
    Object.keys(this.weaponCards).forEach((type) => {
      const card = this.weaponCards[type];
      if (card) {
        if (player.currentWeapon === type) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      }
    });

    // 2. Update special attack cooldown meters
    Object.keys(this.specialMeters).forEach((type) => {
      const meter = this.specialMeters[type];
      const wStat = player.weaponStats[type];
      if (meter && wStat) {
        let pct = 1.0;
        if (wStat.specialTimer > 0) {
          pct = 1 - wStat.specialTimer / wStat.specialCooldown;
        }
        meter.style.width = `${Math.min(100, Math.max(0, pct * 100))}%`;
      }
    });
  }

  updateRoom(n, biome = null) {
    this._renderRoom(n, biome);
  }

  _renderRoom(n, biome = null) {
    const isBoss = n % 5 === 0;
    const target = Math.ceil(n / 5) * 5;
    const left = target - n;
    const idx = ((n - 1) % 5) + 1;
    let pips = '';
    for (let i = 1; i <= 5; i++) {
      const cls = i < idx ? 'done' : i === idx ? 'current' : '';
      pips += `<span class="ri-pip ${cls}${i === 5 ? ' boss' : ''}">${i === 5 ? '☠' : ''}</span>`;
    }
    const sub = isBoss
      ? '☠ BOSS SAVAŞI'
      : left === 1
        ? "Boss'a 1 Oda Kaldı!"
        : `Boss'a ${left} Oda Kaldı`;
    const regionHtml = biome
      ? `<div class="ri-region" style="color:${biome.accentCss};text-shadow:0 0 12px ${biome.accentCss}">${biome.regionLabel} • ${biome.name}</div>`
      : '';
    this.roomInfo.innerHTML =
      regionHtml +
      `<div class="ri-title">ODA ${idx} / 5 <span class="ri-total">• TOPLAM ${n}</span></div>` +
      `<div class="ri-bar">${pips}</div>` +
      `<div class="ri-sub${isBoss ? ' boss' : ''}">${sub}</div>`;
  }

  addBoonIcon(boon) {
    this._boonIcons = this._boonIcons || {};
    const known = this._boonIcons[boon.id];
    if (known) {
      known.count++;
      let badge = known.el.querySelector('.stack');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'stack';
        known.el.appendChild(badge);
      }
      badge.textContent = `x${known.count}`;
      return;
    }
    const el = document.createElement('div');
    el.className = 'boon-icon-small' + (boon.element ? ` el-${boon.element}` : '');
    el.textContent = boon.icon;
    el.title = `${boon.name}: ${boon.description}`;
    this.boonList.appendChild(el);
    this._boonIcons[boon.id] = { el, count: 1 };
  }

  _oldAddBoonIcon(boon) {
    const el = document.createElement('div');
    el.className = 'boon-icon-small';
    el.textContent = boon.icon;
    el.title = `${boon.name}: ${boon.description}`;
    this.boonList.appendChild(el);
  }

  showBossBar(name) {
    this.bossBar = document.getElementById('boss-bar');
    this.bossFill = document.getElementById('boss-bar-inner');
    const n = document.getElementById('boss-name');
    const boss = name && typeof name === 'object' ? name : null;
    if (n) n.textContent = (boss ? boss.bossName : name || '').toUpperCase();
    const t = document.getElementById('boss-title');
    if (t) t.textContent = boss ? boss.bossTitle : '';
    this._bossTheme = boss ? boss.theme : null;
    this._lastP2 = null;
    this._applyBossColors(false);
    this.bossBar.classList.remove('hidden', 'phase2');
    this.bossFill.style.width = '100%';
  }

  updateBossBar(boss) {
    if (!this.bossBar || !boss) return;
    const r = Math.max(0, boss.stats.hp / boss.stats.maxHp);
    this.bossFill.style.width = `${r * 100}%`;
    this.bossBar.classList.toggle('phase2', !!boss.phase2);
    this._applyBossColors(!!boss.phase2);
  }

  _applyBossColors(p2) {
    const th = this._bossTheme;
    if (!th || this._lastP2 === p2) return;
    this._lastP2 = p2;
    const col = p2 ? th.p2b : th.b;
    this.bossFill.style.background = `linear-gradient(90deg, ${p2 ? th.p2a : th.a}, ${col})`;
    const outer = document.getElementById('boss-bar-outer');
    if (outer) {
      outer.style.borderColor = col;
      outer.style.boxShadow = `0 0 22px ${col}`;
    }
    const n = document.getElementById('boss-name');
    if (n) {
      n.style.color = th.css;
      n.style.textShadow = `0 0 14px ${col}`;
    }
    const t = document.getElementById('boss-title');
    if (t) t.style.color = th.css;
  }

  hideBossBar() {
    const b = document.getElementById('boss-bar');
    if (b) b.classList.add('hidden');
  }

  showVictory(cycle, onNext) {
    const ov = document.getElementById('victory');
    const btn = document.getElementById('next-cycle-btn');
    document.getElementById('victory-cycle').textContent = cycle;
    ov.classList.remove('hidden');
    const handler = () => {
      btn.removeEventListener('click', handler);
      ov.classList.add('hidden');
      onNext();
    };
    btn.addEventListener('click', handler);
  }

  showGameOver(roomNumber, onRestart) {
    this.goRoom.textContent = roomNumber;
    this.goOverlay.classList.remove('hidden');

    if (this._btnHandler) this.goBtn.removeEventListener('click', this._btnHandler);
    this._btnHandler = () => {
      this.hideGameOver();
      onRestart();
    };
    this.goBtn.addEventListener('click', this._btnHandler);
  }

  hideGameOver() {
    this.goOverlay.classList.add('hidden');
  }

  reset() {
    this.boonList.innerHTML = '';
    this._boonIcons = {};
    this.hideBossBar();
    const v = document.getElementById('victory');
    if (v) v.classList.add('hidden');
    this.hideGameOver();
  }
}
