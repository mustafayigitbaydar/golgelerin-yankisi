import { BOONS } from '../data/boons.js';

export class BoonSystem {
  constructor() {
    this.acquiredBoons = [];
  }

  getRandomBoons(count) {
    const weights = { common: 60, rare: 30, epic: 10 };
    const pool = [...BOONS];
    const selected = [];

    while (selected.length < count && pool.length > 0) {
      const totalW = pool.reduce((s, b) => s + (weights[b.rarity] || 10), 0);
      let r = Math.random() * totalW;

      for (let i = 0; i < pool.length; i++) {
        r -= weights[pool[i].rarity] || 10;
        if (r <= 0) {
          selected.push(pool[i]);
          pool.splice(i, 1);
          break;
        }
      }
    }
    return selected;
  }

  applyBoon(player, boon) {
    if (!player.elements) {
      player.elements = {
        storm: false,
        stormChains: 0,
        stormDamageMult: 1.0,
        poison: false,
        poisonDamageMult: 1.0,
        shadowFire: false,
        shadowFireDamageMult: 1.0,
      };
    }
    // Supports both (player) and (player.stats) legacy boons
    if (typeof boon.apply === 'function') {
      try {
        boon.apply(player);
      } catch (e) {
        boon.apply(player.stats);
      }
    }
    this.acquiredBoons.push(boon);
  }

  reset() {
    this.acquiredBoons = [];
  }
}
