import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import type { SimEvent } from '../src/sim/types';

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'swordman', noPlayer: true });
}

function errorText(events: SimEvent[]): string | undefined {
  const e = events.find((ev) => ev.type === 'error');
  return e && e.type === 'error' ? e.text : undefined;
}

describe('/gear command', () => {
  it('lists equipped slots in a fixed order and marks empty ones', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('swordman', 'Aleph');
    // A fresh swordman starts with a main hand, a buckler, and a chest piece.
    sim.tick();
    sim.chat('/gear', a);
    const text = errorText(sim.tick());
    expect(text).toBeDefined();
    expect(text).toMatch(/^Equipped \(3\/10\):/);
    expect(text).toContain('Main Hand:');
    expect(text).toContain('Off Hand:');
    expect(text).toContain('Chest:');
    expect(text).toContain('Helmet: (empty)');
    expect(text).toContain('Face: (empty)');
    expect(text).toContain('Back: (empty)');
    expect(text).toContain('Legs: (empty)');
    expect(text).toContain('Feet: (empty)');
    expect(text).toContain('Accessory 1: (empty)');
    expect(text).toContain('Accessory 2: (empty)');
    // fixed slot order: main hand before off hand before chest before legs before feet
    expect(text!.indexOf('Main Hand')).toBeLessThan(text!.indexOf('Off Hand'));
    expect(text!.indexOf('Off Hand')).toBeLessThan(text!.indexOf('Chest'));
    expect(text!.indexOf('Chest')).toBeLessThan(text!.indexOf('Legs'));
    expect(text!.indexOf('Legs')).toBeLessThan(text!.indexOf('Feet'));
  });

  it('reflects newly equipped gear and resolves item names', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('swordman', 'Aleph');
    const meta = sim.players.get(a)!;
    meta.equipment = {
      mainhand: 'worn_sword',
      offhand: 'eastbrook_buckler',
      helmet: 'cryptbone_helm',
      back: 'cryptbone_pauldrons',
      chest: 'recruit_tunic',
      legs: 'quilted_trousers',
      ring1: 'mistveil_cord',
      ring2: 'mistveil_grips',
      feet: 'oiled_boots',
      face: 'swiftfang_talisman',
    };
    sim.tick();
    sim.chat('/gear', a);
    const text = errorText(sim.tick());
    expect(text).toMatch(/^Equipped \(10\/10\):/);
    expect(text).toContain('Pitted Shortsword');
    expect(text).toContain('Eastbrook Buckler');
    expect(text).toContain('Quilted Trousers');
    expect(text).not.toContain('(empty)');
  });

  it('reports nothing equipped when every slot is empty', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('swordman', 'Aleph');
    const meta = sim.players.get(a)!;
    meta.equipment = {};
    sim.tick();
    sim.chat('/gear', a);
    expect(errorText(sim.tick())).toBe('You have nothing equipped.');
  });

  it('is reachable via the /equip and /equipment aliases', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('swordman', 'Aleph');
    sim.tick();
    for (const alias of ['/equip', '/equipment']) {
      sim.chat(alias, a);
      expect(errorText(sim.tick())).toMatch(/^Equipped /);
    }
  });

  it('does not emit a chat event or broadcast to others', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('swordman', 'Aleph');
    sim.addPlayer('mage', 'Bet');
    sim.tick();
    const sent = sim.chat('/gear', a);
    expect(sent).toBeNull();
    expect(sim.tick().some((e) => e.type === 'chat')).toBe(false);
  });
});
