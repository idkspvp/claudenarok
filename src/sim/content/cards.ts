// The card catalogue.
//
// Data-as-code, like every other content table. One card per monster that
// carries one, named for the monster and doing something that monster would
// plausibly teach you.
//
// The effect MIX follows what was measured over the reference game's 538 cards:
// a flat attribute is the most common thing a card does by a wide margin, then
// defence against a race or an attribute, then flat defence and health, then the
// rarer damage-against bonuses, and at the top of the ladder the attribute cards
// that change what your armour is made of. The magnitudes are ours, sized to the
// attribute scale this game now runs on (item_stat_policy.ts): a card that
// granted ten Strength would undo the whole point of that rule.
//
// What is NOT here yet: inflicting or resisting a status, and auto-casting a
// spell. Both are common in the reference and both need combat systems this game
// does not have; they are phase 5 of docs/design/ro-equipment-full-model.md.

import type { CardDef } from '../cards';
import type { ItemDef } from '../types';

const WEAPON = ['mainhand'] as const;
const ARMOR = ['chest', 'legs'] as const;
const HEADGEAR = ['helmet', 'face'] as const;
const SHIELD = ['offhand'] as const;
const GARMENT = ['back'] as const;
const SHOES = ['feet'] as const;
const ACCESSORY = ['ring1', 'ring2'] as const;

export const CARDS: Record<string, CardDef> = {
  // --- Flat attributes: the bread and butter, and the largest share ---
  card_forest_wolf: {
    id: 'card_forest_wolf',
    name: 'Forest Wolf Card',
    fits: ACCESSORY,
    from: 'forest_wolf',
    effect: { stats: { agi: 1 } },
  },
  card_wild_boar: {
    id: 'card_wild_boar',
    name: 'Wild Boar Card',
    fits: ACCESSORY,
    from: 'wild_boar',
    effect: { stats: { str: 1 } },
  },
  card_mogger: {
    id: 'card_mogger',
    name: 'Mogger Card',
    fits: ACCESSORY,
    from: 'mogger',
    effect: { stats: { dex: 1 } },
  },
  card_tunnel_rat: {
    id: 'card_tunnel_rat',
    name: 'Deeprock Digger Card',
    fits: ACCESSORY,
    from: 'tunnel_rat',
    effect: { stats: { luk: 1 } },
  },
  card_vale_bandit: {
    id: 'card_vale_bandit',
    name: 'Vale Bandit Card',
    fits: ACCESSORY,
    from: 'vale_bandit',
    effect: { stats: { vit: 1 } },
  },
  card_gravecaller_cultist: {
    id: 'card_gravecaller_cultist',
    name: 'Gravecaller Cultist Card',
    fits: ACCESSORY,
    from: 'gravecaller_cultist',
    effect: { stats: { int: 1 } },
  },
  card_restless_bones: {
    id: 'card_restless_bones',
    name: 'Restless Bones Card',
    fits: HEADGEAR,
    from: 'restless_bones',
    effect: { stats: { vit: 1 } },
  },
  card_webwood_spider: {
    id: 'card_webwood_spider',
    name: 'Sableweb Lurker Card',
    fits: HEADGEAR,
    from: 'webwood_spider',
    effect: { stats: { agi: 1 } },
  },

  // --- Defence: flat, and against a race or an attribute ---
  card_thornpeak_ogre: {
    id: 'card_thornpeak_ogre',
    name: 'Thornpeak Ogre Card',
    fits: ARMOR,
    from: 'thornpeak_ogre',
    effect: { stats: { armor: 1, vit: 1 } },
  },
  card_deeprock_kobold: {
    id: 'card_deeprock_kobold',
    name: 'Deeprock Tunneler Card',
    fits: SHIELD,
    from: 'deeprock_kobold',
    effect: { resistRace: { race: 'demihuman', fraction: 0.1 } },
  },
  card_raised_bonewalker: {
    id: 'card_raised_bonewalker',
    name: 'Raised Bonewalker Card',
    fits: SHIELD,
    from: 'raised_bonewalker',
    effect: { resistRace: { race: 'undead', fraction: 0.1 } },
  },
  card_mire_prowler: {
    id: 'card_mire_prowler',
    name: 'Mire Prowler Card',
    fits: SHIELD,
    from: 'mire_prowler',
    effect: { resistRace: { race: 'brute', fraction: 0.1 } },
  },
  card_drowned_dead: {
    id: 'card_drowned_dead',
    name: 'Drowned Dead Card',
    fits: GARMENT,
    from: 'drowned_dead',
    effect: { resistElement: { element: 'water', fraction: 0.15 } },
  },
  card_emberkin: {
    id: 'card_emberkin',
    name: 'Emberkin Card',
    fits: GARMENT,
    from: 'emberkin',
    effect: { resistElement: { element: 'fire', fraction: 0.15 } },
  },
  card_gloomshade: {
    id: 'card_gloomshade',
    name: 'Gloomshade Card',
    fits: GARMENT,
    from: 'gloomshade',
    effect: { resistElement: { element: 'shadow', fraction: 0.15 } },
  },

  card_wyrmcult_necromancer: {
    id: 'card_wyrmcult_necromancer',
    name: 'Wyrmcult Necromancer Card',
    fits: HEADGEAR,
    from: 'wyrmcult_necromancer',
    effect: { stats: { mdef: 2 } },
  },
  card_hollow_acolyte: {
    id: 'card_hollow_acolyte',
    name: 'Hollow Acolyte Card',
    fits: ARMOR,
    from: 'hollow_acolyte',
    effect: { stats: { mdef: 2, int: 1 } },
  },

  // --- Health and mobility ---
  card_bog_bloat: {
    id: 'card_bog_bloat',
    name: 'Bog Bloat Card',
    fits: ARMOR,
    from: 'bog_bloat',
    effect: { stats: { vit: 2 } },
  },
  card_ridge_stalker: {
    id: 'card_ridge_stalker',
    name: 'Ridge Stalker Card',
    fits: SHOES,
    from: 'ridge_stalker',
    effect: { stats: { agi: 1 } },
  },
  card_mudfin_murloc: {
    id: 'card_mudfin_murloc',
    name: 'Mudfin Skulker Card',
    fits: SHOES,
    from: 'mudfin_murloc',
    effect: { stats: { agi: 1, luk: 1 } },
  },

  // --- Damage against a race, an attribute, or a size: the hunter cards ---
  card_boneclad_revenant: {
    id: 'card_boneclad_revenant',
    name: 'Boneclad Revenant Card',
    fits: WEAPON,
    from: 'boneclad_revenant',
    effect: { versusRace: { race: 'undead', fraction: 0.2 } },
  },
  card_warlock_imp: {
    id: 'card_warlock_imp',
    name: 'Fire Demon Card',
    fits: WEAPON,
    from: 'warlock_imp',
    effect: { versusRace: { race: 'demon', fraction: 0.2 } },
  },
  card_mire_widow: {
    id: 'card_mire_widow',
    name: 'Mirefen Widow Card',
    fits: WEAPON,
    from: 'mire_widow',
    effect: { versusRace: { race: 'insect', fraction: 0.2 } },
  },
  card_ogre_crusher: {
    id: 'card_ogre_crusher',
    name: 'Thornpeak Crusher Card',
    fits: WEAPON,
    from: 'ogre_crusher',
    effect: { versusSize: { size: 'large', fraction: 0.2 } },
  },
  card_moonspawn: {
    id: 'card_moonspawn',
    name: 'Moonspawn Card',
    fits: WEAPON,
    from: 'moonspawn',
    effect: { versusSize: { size: 'small', fraction: 0.2 } },
  },

  // --- The attribute cards: the top of the ladder, from bosses ---
  card_korzul_the_gravewyrm: {
    id: 'card_korzul_the_gravewyrm',
    name: 'Korzul Card',
    fits: ARMOR,
    from: 'korzul_the_gravewyrm',
    effect: { armorElement: 'undead' },
  },
  card_voskar_emberwing: {
    id: 'card_voskar_emberwing',
    name: 'Voskar Card',
    fits: WEAPON,
    from: 'voskar_emberwing',
    effect: { weaponElement: 'fire' },
  },
  card_ysolei: {
    id: 'card_ysolei',
    name: 'Ysolei Card',
    fits: WEAPON,
    from: 'ysolei',
    effect: { weaponElement: 'water' },
  },
  card_marrowlord_varkas: {
    id: 'card_marrowlord_varkas',
    name: 'Marrowlord Varkas Card',
    fits: ARMOR,
    from: 'marrowlord_varkas',
    effect: { armorElement: 'shadow' },
  },
  card_thunzharr_waking_peak: {
    id: 'card_thunzharr_waking_peak',
    name: 'Thunzharr Card',
    fits: WEAPON,
    from: 'thunzharr_waking_peak',
    effect: { weaponElement: 'wind' },
  },
  card_nythraxis: {
    id: 'card_nythraxis',
    name: 'Nythraxis Card',
    fits: ARMOR,
    from: 'nythraxis_scourge_of_thornpeak',
    effect: { stats: { armor: 2, vit: 2 }, resistRace: { race: 'undead', fraction: 0.15 } },
  },
};

export const ALL_CARD_IDS = Object.keys(CARDS);

/** Card ITEM records, so a card is a first-class thing a player loots, carries,
 *  trades and sockets. Generated from the catalogue rather than authored twice,
 *  which is the same arrangement the heroic variants use. */
export function buildCardItems(): Record<string, ItemDef> {
  const items: Record<string, ItemDef> = {};
  for (const card of Object.values(CARDS)) {
    items[card.id] = {
      id: card.id,
      name: card.name,
      kind: 'card',
      quality: 'rare',
      sellValue: 0,
      // A card is the one thing in this game worth more than what it goes into,
      // so it is never vendor trash.
    };
  }
  return items;
}
