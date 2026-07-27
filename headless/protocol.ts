import { NUM_ACTIONS } from '../src/sim/obs';
import { ALL_CLASSES, MAX_LEVEL, type PlayerClass } from '../src/sim/types';

export const MAX_INPUT_LINE_LENGTH = 1024 * 1024;

export function validateAction(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 0 || value >= NUM_ACTIONS) return null;
  return value;
}

export function validatePlayerClass(value: unknown): PlayerClass | null {
  return (ALL_CLASSES as string[]).includes(value as string) ? (value as PlayerClass) : null;
}

export function validatePlayerLevel(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return null;
  return value >= 1 && value <= MAX_LEVEL ? value : null;
}

export type ResetRequest = { ok: true; playerLevel: number } | { ok: false; error: string };

/** Validate a headless reset request. */
export function parseResetRequest(value: unknown): ResetRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'invalid reset request: expected object' };
  }
  const request = value as Record<string, unknown>;
  const playerLevel = validatePlayerLevel(request.player_level ?? 1);
  if (playerLevel === null) {
    return { ok: false, error: `invalid player_level: expected integer 1-${MAX_LEVEL}` };
  }
  return { ok: true, playerLevel };
}
