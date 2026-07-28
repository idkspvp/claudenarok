// Card sockets: the system Ragnarok's endgame is actually made of.
//
// Two halves. The pure leaf decides what fits and what a socketed set adds up
// to; the content check makes sure the catalogue and the equipment agree, so a
// card that fits nothing, or a socket nothing can go into, fails here rather
// than confusing a player.

import { describe, expect, it } from 'vitest';
import {
  aggregateCards,
  canSocket,
  cardAttackMultiplier,
  cardDefenceMultiplier,
  cardFitsSlot,
  MAX_CARD_SLOTS,
} from '../src/sim/cards';
import { CARDS } from '../src/sim/content/cards';
import { ITEMS, MOBS } from '../src/sim/data';
import { socketCard } from '../src/sim/items';
import { Sim } from '../src/sim/sim';

const catalogue = () => Object.values(CARDS);
const equipment = () =>
  Object.values(ITEMS).filter(
    (i) => (i.kind === 'armor' || i.kind === 'weapon' || i.kind === 'held_offhand') && !i.heroicOf,
  );

describe('the catalogue', () => {
  it('gives every card a slot it can actually go into', () => {
    for (const card of catalogue()) {
      expect(card.fits.length, card.id).toBeGreaterThan(0);
      const homes = equipment().filter(
        (item) => (item.cardSlots ?? 0) > 0 && cardFitsSlot(card, item.slot),
      );
      expect(homes.length, `${card.id} has nowhere to go`).toBeGreaterThan(0);
    }
  });

  it('names a real monster as its source, and that monster drops it', () => {
    for (const card of catalogue()) {
      const mob = MOBS[card.from];
      expect(mob, `${card.id} source ${card.from}`).toBeDefined();
      const drop = (mob.loot ?? []).find((l: { itemId?: string }) => l.itemId === card.id);
      expect(drop, `${card.from} does not drop ${card.id}`).toBeDefined();
    }
  });

  it('drops at the chosen rates, not the ones the reference game uses', () => {
    // A hundredth of a percent is a rate for a different era; these are the
    // figures docs/design/drops-and-crafting.md settled on.
    for (const card of catalogue()) {
      const mob = MOBS[card.from];
      const drop = (mob.loot ?? []).find((l: { itemId?: string }) => l.itemId === card.id) as
        | { chance: number }
        | undefined;
      expect(drop?.chance, card.id).toBeGreaterThanOrEqual(0.03);
      if (mob.boss || mob.worldBoss) expect(drop?.chance, card.id).toBeGreaterThanOrEqual(0.25);
      else if (mob.elite) expect(drop?.chance, card.id).toBeGreaterThanOrEqual(0.1);
    }
  });

  it('exists as a carryable item, not just a rule', () => {
    for (const card of catalogue()) {
      const item = ITEMS[card.id];
      expect(item, `${card.id} item record`).toBeDefined();
      expect(item.kind).toBe('card');
    }
  });
});

describe('sockets on equipment', () => {
  it('puts sockets on a real share of gear, none of it over the cap', () => {
    const all = equipment();
    const slotted = all.filter((i) => (i.cardSlots ?? 0) > 0);
    expect(slotted.length).toBeGreaterThan(0);
    expect(slotted.length / all.length).toBeGreaterThan(0.2);
    expect(slotted.length / all.length).toBeLessThan(0.6);
    for (const item of slotted) {
      expect(item.cardSlots, item.id).toBeLessThanOrEqual(MAX_CARD_SLOTS);
      expect(item.cardSlots, item.id).toBeGreaterThan(0);
    }
  });

  it('leaves more than one socket rare, the way the reference does', () => {
    const slotted = equipment().filter((i) => (i.cardSlots ?? 0) > 0);
    const single = slotted.filter((i) => i.cardSlots === 1);
    expect(single.length / slotted.length).toBeGreaterThan(0.5);
  });
});

describe('what fits where', () => {
  it('refuses a card that does not belong in the slot', () => {
    const weaponCard = CARDS.card_boneclad_revenant;
    expect(cardFitsSlot(weaponCard, 'mainhand')).toBe(true);
    expect(cardFitsSlot(weaponCard, 'helmet')).toBe(false);
    expect(cardFitsSlot(weaponCard, undefined)).toBe(false);
  });

  it('treats the two accessory slots as one kind', () => {
    const accessory = CARDS.card_forest_wolf;
    expect(cardFitsSlot(accessory, 'ring')).toBe(true);
    expect(cardFitsSlot(accessory, 'ring1')).toBe(true);
  });

  it('refuses when the sockets are full, and when there are none', () => {
    const card = CARDS.card_forest_wolf;
    expect(canSocket(card, { slot: 'ring', cardSlots: 1 }, [])).toBe(true);
    expect(canSocket(card, { slot: 'ring', cardSlots: 1 }, ['card_wild_boar'])).toBe(false);
    expect(canSocket(card, { slot: 'ring', cardSlots: 0 }, [])).toBe(false);
    expect(canSocket(card, { slot: 'mainhand', cardSlots: 4 }, [])).toBe(false);
  });
});

describe('what a socketed set adds up to', () => {
  it('stacks duplicates, which is why a player hunts four of one card', () => {
    const one = aggregateCards([CARDS.card_wild_boar]);
    const four = aggregateCards(Array(4).fill(CARDS.card_wild_boar));
    expect(one.stats.str).toBe(1);
    expect(four.stats.str).toBe(4);
  });

  it('turns a hunter card into damage against that race only', () => {
    const agg = aggregateCards([CARDS.card_boneclad_revenant]);
    expect(cardAttackMultiplier(agg, { race: 'undead' })).toBeGreaterThan(1);
    expect(cardAttackMultiplier(agg, { race: 'brute' })).toBe(1);
  });

  it('turns a resist card into damage taken from that race only', () => {
    const agg = aggregateCards([CARDS.card_raised_bonewalker]);
    expect(cardDefenceMultiplier(agg, { race: 'undead' })).toBeLessThan(1);
    expect(cardDefenceMultiplier(agg, { race: 'brute' })).toBe(1);
  });

  it('never lets a resist stack turn a hit into a heal', () => {
    const agg = aggregateCards(Array(20).fill(CARDS.card_raised_bonewalker));
    expect(cardDefenceMultiplier(agg, { race: 'undead' })).toBe(0);
  });

  it('lets an attribute card override what the weapon is made of', () => {
    const agg = aggregateCards([CARDS.card_voskar_emberwing]);
    expect(agg.weaponElement).toBe('fire');
  });
});

describe('socketing through the sim', () => {
  const armed = () => {
    const sim = new Sim({ seed: 5, playerClass: 'swordman', autoEquip: true });
    // Socketed gear is chase gear, so the fixture has to be able to WEAR it:
    // every accessory with a socket sits behind a level requirement.
    sim.setPlayerLevel(30);
    return sim;
  };

  it('sockets a card and folds its bonus into the character', () => {
    const sim = armed();
    const pid = sim.playerId;
    const meta = sim.players.get(pid)!;
    // A ring with a socket, and the card that fits it.
    const ring = Object.values(ITEMS).find(
      (i) => i.slot === 'ring' && (i.cardSlots ?? 0) > 0 && !i.heroicOf,
    );
    expect(ring).toBeDefined();
    sim.addItem(ring!.id, 1, pid);
    sim.equipItem(ring!.id, pid);
    sim.addItem('card_wild_boar', 1, pid);
    const before = sim.entities.get(pid)!.stats.str;
    expect(socketCard(sim.ctx, 'ring1', 'card_wild_boar', pid)).toBe(true);
    expect(sim.entities.get(pid)!.stats.str).toBe(before + 1);
    expect(meta.equipmentInstance?.ring1?.cards).toEqual(['card_wild_boar']);
    // The card is spent, not duplicated.
    expect(sim.countItem('card_wild_boar', pid)).toBe(0);
  });

  it('refuses a card the player does not hold, and one that does not fit', () => {
    const sim = armed();
    const pid = sim.playerId;
    const ring = Object.values(ITEMS).find(
      (i) => i.slot === 'ring' && (i.cardSlots ?? 0) > 0 && !i.heroicOf,
    );
    sim.addItem(ring!.id, 1, pid);
    sim.equipItem(ring!.id, pid);
    // Not held.
    expect(socketCard(sim.ctx, 'ring1', 'card_wild_boar', pid)).toBe(false);
    // Held, but a weapon card in an accessory.
    sim.addItem('card_boneclad_revenant', 1, pid);
    expect(socketCard(sim.ctx, 'ring1', 'card_boneclad_revenant', pid)).toBe(false);
    expect(sim.countItem('card_boneclad_revenant', pid)).toBe(1);
  });
});
