const KEY = 'cursedForestMeta_v1';

export const UPGRADES = [
  {
    id: 'hp',
    name: 'Yaşam Özü',
    icon: '❤️',
    desc: '+20 Maksimum Can',
    max: 5,
    costs: [40, 70, 100, 140, 180],
  },
  {
    id: 'dash',
    name: 'Çoklu Atılma',
    icon: '💨',
    desc: 'Arka arkaya +1 Dash hakkı (en fazla 3)',
    max: 2,
    costs: [120, 250],
  },
  {
    id: 'damage',
    name: 'Ruh Keskinliği',
    icon: '⚔️',
    desc: '+%10 Temel Saldırı Hasarı',
    max: 5,
    costs: [50, 80, 120, 170, 230],
  },
  {
    id: 'crit',
    name: 'Ölümcül Göz',
    icon: '🎯',
    desc: '+%5 Kritik Vuruş Şansı (sarı dev hasar sayıları)',
    max: 5,
    costs: [60, 90, 130, 180, 240],
  },
];

export class MetaProgression {
  constructor() {
    this.shards = 0;
    this.levels = { hp: 0, dash: 0, damage: 0, crit: 0 };
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.shards = Math.max(0, Math.floor(data.shards || 0));
      for (const u of UPGRADES) {
        this.levels[u.id] = Math.min(u.max, Math.max(0, Math.floor((data.levels || {})[u.id] || 0)));
      }
    } catch (e) {
      console.warn('Meta kayıt okunamadı:', e);
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ shards: this.shards, levels: this.levels }));
    } catch (e) {
      console.warn('Meta kayıt yazılamadı:', e);
    }
  }

  addShards(n) {
    this.shards += n;
    this.save();
  }

  level(id) {
    return this.levels[id] || 0;
  }

  nextCost(id) {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u || this.level(id) >= u.max) return null;
    return u.costs[this.level(id)];
  }

  canBuy(id) {
    const c = this.nextCost(id);
    return c !== null && this.shards >= c;
  }

  buy(id) {
    if (!this.canBuy(id)) return false;
    this.shards -= this.nextCost(id);
    this.levels[id] = this.level(id) + 1;
    this.save();
    return true;
  }
}
