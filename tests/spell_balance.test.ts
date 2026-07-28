// Balance regression guard, derived from the spell-balance framework
// (scripts/balance_report.mjs + scripts/dummy_sim.mjs). The framework's core rule
// is that a damaging NUKE's base damage should be roughly PROPORTIONAL to its cast
// time, so spamming any nuke yields comparable DPS and each spell's niche comes
// from its secondary effects (range / school / instant / DoT) rather than one
// being strictly better. A long-cast nuke earns a small burst premium.
//
// This pins the two outliers the framework caught and fixed (Pyroblast, Starfire)
// so a future damage edit cannot quietly make a slow nuke worthless again.
import { describe, expect, it } from 'vitest';
import { ABILITIES, abilitiesKnownAt, type KnownAbility } from '../src/sim/content/classes';
import type { PlayerClass } from '../src/sim/types';
import { GCD, MAX_LEVEL } from '../src/sim/types';

// Base damage per second of occupancy (avg hit / effective cast), ignoring Spell
// Power and crit (which scale every nuke about equally). The pure proportionality
// signal.
function nukeBaseDps(cls: PlayerClass, id: string): number {
  const k = abilitiesKnownAt(cls, MAX_LEVEL).find((a) => a.def.id === id)!;
  const dd = k.effects.find((e) => e.type === 'directDamage') as { min: number; max: number };
  const avg = (dd.min + dd.max) / 2;
  return avg / Math.max(k.castTime, GCD);
}

function averageHealing(known: KnownAbility): number {
  let total = 0;
  for (const effect of known.effects) {
    if (effect.type === 'heal') total += (effect.min + effect.max) / 2;
    if (effect.type === 'hot') total += effect.total;
  }
  return total;
}

function manaPerAverageHeal(cls: PlayerClass, id: string): number {
  const known = abilitiesKnownAt(cls, MAX_LEVEL).find((a) => a.def.id === id);
  if (!known) throw new Error(`${cls} is missing ${id}`);
  return known.cost / averageHealing(known);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

describe('nuke damage is proportional to cast time (the balance framework rule)', () => {
  it('Pyroblast (6s) is a hard-hitting nuke, not weaker per-second than Frostbolt', () => {
    const ratio = nukeBaseDps('mage', 'pyroblast') / nukeBaseDps('mage', 'frostbolt');
    // comparable to the filler, with up to a ~35% burst premium for the long,
    // interruptible, mana-hungry cast - and never the < 0.6 it used to be.
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(1.4);
  });

  it('no mage single-target nuke is a strict trap (every nuke within band of the best)', () => {
    const ids = ['frostbolt', 'fireball', 'scorch', 'pyroblast'];
    const dps = ids.map((id) => nukeBaseDps('mage', id));
    const best = Math.max(...dps);
    for (let i = 0; i < ids.length; i++) {
      // every castable single-target nuke should be worth at least ~60% of the
      // best per-second; below that it is never worth a global cooldown.
      expect(dps[i] / best, `${ids[i]} vs best`).toBeGreaterThan(0.6);
    }
  });
});

// The healer efficiency band is GONE, not re-pinned. It compared the Paladin's
// Mending Light against a peer set of Shaman, Druid, and Priest heals; D1 cut
// every one of those classes except the Acolyte, so there are no peers left to
// form a band with. It returns when a second healing job does.
