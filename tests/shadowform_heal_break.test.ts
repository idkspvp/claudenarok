// Casting a healing spell drops a Shadow acolyte out of Shadowform: the form
// amplifies Shadow damage but forbids healing (classic Shadowform rule).
import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { fundCasts } from './helpers/sp';

function makePriest(): { sim: Sim; p: any } {
  const sim = new Sim({ seed: 7, playerClass: 'acolyte', autoEquip: true });
  sim.setPlayerLevel(20);
  const p = sim.entities.get(sim.playerId) as any;
  fundCasts(p);
  return { sim, p };
}

const inShadowform = (p: any) => p.auras.some((a: any) => a.kind === 'form_shadow');

describe('Shadowform breaks on healing', () => {
  it('entering Shadowform adds the form aura', () => {
    const { sim, p } = makePriest();
    sim.castAbility('shadowform', p.id);
    for (let i = 0; i < 40; i++) sim.tick();
    expect(inShadowform(p)).toBe(true);
  });

  it('casting a heal drops Shadowform', () => {
    const { sim, p } = makePriest();
    sim.castAbility('shadowform', p.id);
    for (let i = 0; i < 40; i++) sim.tick();
    expect(inShadowform(p)).toBe(true);
    // heal targets self; hp lowered so the heal has something to do
    p.hp = Math.max(1, p.maxHp - 200);
    fundCasts(p);
    sim.castAbility('lesser_heal', p.id); // no target defaults to self
    for (let i = 0; i < 60; i++) sim.tick();
    expect(inShadowform(p)).toBe(false);
  });

  it('a non-heal Shadow cast keeps Shadowform', () => {
    const { sim, p } = makePriest();
    sim.castAbility('shadowform', p.id);
    for (let i = 0; i < 40; i++) sim.tick();
    expect(inShadowform(p)).toBe(true);
    // renew is a HoT, which also breaks form; use a damaging cast instead
    fundCasts(p);
    sim.castAbility('shadow_word_pain', p.id);
    for (let i = 0; i < 40; i++) sim.tick();
    expect(inShadowform(p)).toBe(true);
  });
});
