// Warrior combat stances: a small, host-agnostic system layered on the existing
// aura + exclusive-group machinery. Every warrior always lives in exactly one
// stance; the stance is auto-applied by ensureWarriorStance, and the player
// swaps it by casting a stance ability (the exclusiveGroup 'warrior_stance'
// cancels the sibling).
//
// The three stances used to be spec-gated (Fury lived only in Berserker,
// Arms/Prot in Battle + Guarded). Specs are gone, so every warrior may wear any
// of the three, exactly as they may now LEARN all three.
//
// The pure decision helpers (which stances exist, which is the default, and
// the reconcile diff) carry NO ctx/DOM and are unit-tested directly. The thin
// ensureWarriorStance consumer applies that decision through SimContext.
import { ABILITIES } from '../data';
import type { PlayerMeta } from '../sim';
import type { SimContext } from '../sim_context';
import type { Aura, AuraKind, Entity } from '../types';

// The three stance ability ids (also their aura kinds and buff ids). Battle and
// Berserker are the offensive stances; Guarded (defensive) is the retreat one.
export const BATTLE_STANCE = 'battle_stance';
export const BERSERKER_STANCE = 'berserker_stance';
export const DEFENSIVE_STANCE = 'defensive_stance';

export const WARRIOR_STANCE_IDS: readonly string[] = [
  BATTLE_STANCE,
  DEFENSIVE_STANCE,
  BERSERKER_STANCE,
];

// The aura kinds that ARE a stance, so a caller can pick the stance auras off an
// entity without hardcoding the list at each site.
export const WARRIOR_STANCE_KINDS: ReadonlySet<AuraKind> = new Set<AuraKind>([
  'battle_stance',
  'defensive_stance',
  'berserker_stance',
]);

export function isWarriorStanceKind(kind: AuraKind): boolean {
  return WARRIOR_STANCE_KINDS.has(kind);
}

// The stance aura kinds a warrior may wear. Every stance the class can learn is
// wearable now that no spec gates the ability defs in classes.ts (a unit test
// pins the two in sync).
export function availableWarriorStanceKinds(): AuraKind[] {
  return ['battle_stance', 'defensive_stance', 'berserker_stance'];
}

// The stance a warrior spawns into. Always a learn-level-1 stance, so it is
// always applicable.
export function defaultWarriorStanceId(): string {
  return BATTLE_STANCE;
}

// Build the aura for a stance ability id from its selfBuff effect (the single
// source of the aura's kind/value/duration), or null if the id is not a stance
// selfBuff. Shared by the spawn-time seed (createPlayer) and the tick reconcile.
export function buildStanceAura(stanceId: string, ownerId: number): Aura | null {
  const def = ABILITIES[stanceId];
  const eff = def?.effects.find((e) => e.type === 'selfBuff');
  if (!def || !eff || eff.type !== 'selfBuff') return null;
  return {
    id: stanceId,
    name: def.name,
    kind: eff.kind,
    remaining: eff.duration,
    duration: eff.duration,
    value: eff.value,
    sourceId: ownerId,
    school: def.school,
  };
}

export interface StanceReconcile {
  // Stance aura kinds to strip (not a real stance kind); empty when a valid
  // stance is already worn.
  removeKinds: AuraKind[];
  // The stance ability id to apply, or null when a valid stance is already worn.
  applyId: string | null;
}

// Pure reconcile: given the stance kinds currently worn, decide whether the
// warrior already holds a valid stance (no change), or must drop the invalid
// ones and gain the default stance.
export function warriorStanceReconcile(currentStanceKinds: readonly AuraKind[]): StanceReconcile {
  const available = availableWarriorStanceKinds();
  if (currentStanceKinds.some((k) => available.includes(k))) {
    return { removeKinds: [], applyId: null };
  }
  return { removeKinds: [...currentStanceKinds], applyId: defaultWarriorStanceId() };
}

// Ensure a live warrior wears exactly one stance. A no-op for non-warriors and
// for a warrior already in a valid stance; on spawn it applies the default.
// Draws no rng. Runs once per player-tick.
export function ensureWarriorStance(ctx: SimContext, p: Entity, meta: PlayerMeta): void {
  if (meta.cls !== 'warrior') return;
  const worn = p.auras.filter((a) => isWarriorStanceKind(a.kind)).map((a) => a.kind);
  const plan = warriorStanceReconcile(worn);
  if (plan.applyId === null) return;
  // Drop any invalid stance auras (announce the loss like the exclusive-group path).
  for (let i = p.auras.length - 1; i >= 0; i--) {
    if (plan.removeKinds.includes(p.auras[i].kind)) {
      const a = p.auras[i];
      p.auras.splice(i, 1);
      ctx.emit({ type: 'aura', targetId: p.id, name: a.name, gained: false });
    }
  }
  const aura = buildStanceAura(plan.applyId, p.id);
  if (!aura) return;
  // applyAura emits the 'aura' gained event and re-runs recalcPlayerStats, so
  // Berserker's crit-chance bonus takes effect the same tick.
  ctx.applyAura(p, aura);
}
