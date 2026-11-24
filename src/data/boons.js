export const BOONS = [
  // ── 1. FIRTINA LÜTFU (TURKUAZ / MAVİ) ──
  {
    id: 'storm_lightning',
    name: 'Fırtına Lütfu',
    element: 'storm',
    elementName: 'FIRTINA',
    description: 'Saldırılar yakındaki 2 düşmana sıçrayan zincirleme yıldırım (Chain Lightning) çarpar.',
    icon: '⚡',
    rarity: 'epic',
    apply: (player) => {
      player.elements.storm = true;
      player.elements.stormChains = (player.elements.stormChains || 0) + 2;
    },
  },
  {
    id: 'storm_overcharge',
    name: 'Aşırı Yüklü Yıldırım',
    element: 'storm',
    elementName: 'FIRTINA',
    description: 'Zincirleme yıldırım +1 düşmana daha sıçrar ve şok hasarı %50 artar.',
    icon: '🌩️',
    rarity: 'rare',
    apply: (player) => {
      player.elements.storm = true;
      player.elements.stormChains = (player.elements.stormChains || 0) + 1;
      player.elements.stormDamageMult = (player.elements.stormDamageMult || 1.0) * 1.5;
    },
  },

  // ── 2. ORMAN ZEHİRİ LÜTFU (ZÜMRÜT YEŞİLİ) ──
  {
    id: 'forest_poison',
    name: 'Orman Zehri Lütfu',
    element: 'poison',
    elementName: 'ZEHİR',
    description: 'Vurulan düşmanlar 4 saniye boyunca zehirlenir, yeşil parlar ve saniye başı hasar alır.',
    icon: '🧪',
    rarity: 'epic',
    apply: (player) => {
      player.elements.poison = true;
      player.elements.poisonDamageMult = (player.elements.poisonDamageMult || 1.0);
    },
  },
  {
    id: 'toxic_agony',
    name: 'Ölümcül Toksin',
    element: 'poison',
    elementName: 'ZEHİR',
    description: 'Zehir hasarı %60 artar.',
    icon: '🌿',
    rarity: 'rare',
    apply: (player) => {
      player.elements.poison = true;
      player.elements.poisonDamageMult = (player.elements.poisonDamageMult || 1.0) * 1.6;
    },
  },

  // ── 3. GÖLGE ATEŞİ LÜTFU (MOR / KIZIL) ──
  {
    id: 'shadow_fire',
    name: 'Gölge Ateşi Lütfu',
    element: 'shadow_fire',
    elementName: 'GÖLGE ATEŞİ',
    description: 'Dash arkasında düşmanları yakan lanetli ateş izi bırakır. Sağ Tık Özel Saldırı hasarı +%50!',
    icon: '🔥',
    rarity: 'epic',
    apply: (player) => {
      player.elements.shadowFire = true;
      player.stats.specialDamageMultiplier = (player.stats.specialDamageMultiplier || 1.0) * 1.5;
    },
  },
  {
    id: 'infernal_flame',
    name: 'Cehennem Kıvılcımı',
    element: 'shadow_fire',
    elementName: 'GÖLGE ATEŞİ',
    description: 'Ateş izi hasarı %50 artar ve Dash bekleme süresi %30 azalır.',
    icon: '💥',
    rarity: 'rare',
    apply: (player) => {
      player.elements.shadowFire = true;
      player.elements.shadowFireDamageMult = (player.elements.shadowFireDamageMult || 1.0) * 1.5;
      player.stats.dashCooldown *= 0.7;
    },
  },

  // ── TEMEL VE YARDIMCI LÜTUFLAR ──
  {
    id: 'swift_strike',
    name: 'Hızlı Vuruş',
    element: 'combat',
    elementName: 'SAVAŞ',
    description: 'Saldırı hızı %25 artar.',
    icon: '⚔️',
    rarity: 'common',
    apply: (player) => {
      Object.keys(player.weaponStats).forEach((k) => {
        player.weaponStats[k].attackCooldown *= 0.75;
      });
    },
  },
  {
    id: 'iron_skin',
    name: 'Kadim Zırh',
    element: 'vitality',
    elementName: 'CAN',
    description: 'Maksimum can 40 artar ve canın anında dolar.',
    icon: '🛡️',
    rarity: 'common',
    apply: (player) => {
      player.stats.maxHp += 40;
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 40);
    },
  },
  {
    id: 'vampiric_blade',
    name: 'Ruh Emici',
    element: 'dark',
    elementName: 'GÖLGE',
    description: 'Verilen hasarın %15\'i can olarak geri döner.',
    icon: '🩸',
    rarity: 'rare',
    apply: (player) => {
      player.stats.lifesteal = (player.stats.lifesteal || 0) + 0.15;
    },
  },
  {
    id: 'critical_eye',
    name: 'Keskin Göz',
    element: 'combat',
    elementName: 'SAVAŞ',
    description: '%25 kritik vuruş şansı kazanırsın.',
    icon: '👁️',
    rarity: 'rare',
    apply: (player) => {
      player.stats.critChance = (player.stats.critChance || 0) + 0.25;
    },
  },
  {
    id: 'titan_strike',
    name: 'Titan Darbesi',
    element: 'combat',
    elementName: 'SAVAŞ',
    description: 'Tüm birincil silah vuruşlarının hasarı %40 artar.',
    icon: '🥊',
    rarity: 'epic',
    apply: (player) => {
      player.stats.attackDamageMult = (player.stats.attackDamageMult || 1.0) * 1.4;
    },
  },
  {
    id: 'wind_runner',
    name: 'Rüzgar Adımı',
    element: 'agility',
    elementName: 'ÇEVİKLİK',
    description: 'Koşma hızı %25 artar.',
    icon: '🌪️',
    rarity: 'common',
    apply: (player) => {
      player.stats.speed *= 1.25;
    },
  },
];
