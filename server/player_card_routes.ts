// Player-card + referral REST surface.
//
// These two routes (POST /api/card, GET /api/referrals) used to live in
// server/wallet.ts purely because the card share flow and the wallet link flow
// shipped together. Neither is web3: the card is a shareable player-card PNG and
// the referral read is its attribution counter. When the wallet/$WOC surface was
// removed they moved here unchanged, keeping their guard chains, rate-limit
// policies, and response bodies byte-identical.
//
// The bearer guard below is the same bearerActiveAccount mirror the other
// migrated surfaces carry (see the FOLLOW-UP note in server/characters.ts): it
// is a copy, not a new pattern, and the shared extraction is still owed.

import type http from 'node:http';
import {
  accountAndScopeForToken,
  moderationStatusForAccount,
  primarySlugForAccount,
  referralCountForAccount,
  scopeAllowsMutation,
} from './db';
import { ctxAccountId } from './http/context';
import { CARD_UPLOAD_POLICY, rateLimit } from './http/middleware/rate_limit';
import type { Ctx, Middleware, RouteDef } from './http/types';
import { json, moderationErrorBody } from './http_util';
import { cardUploadContentLengthTooLarge, handleCardUpload } from './player_card';
import { recordUsageMetric } from './provider_usage';

// The exact legacy { error } identities the guard + card pre-auth check emit.
const NOT_AUTHENTICATED = { error: 'not authenticated', code: 'auth.required' } as const;
const READ_ONLY_TOKEN = { error: 'this token is read-only', code: 'auth.forbidden' } as const;
const IMAGE_TOO_LARGE = { error: 'image too large' } as const;

// The bearer token shape: a 64-hex secret behind the "Bearer " scheme.
const BEARER_PATTERN = /^Bearer ([a-f0-9]{64})$/;

// ---------------------------------------------------------------------------
// Runtime injection. registry.ts spreads the static `routes` array at module
// load, before main.ts has booted the GameServer, so the card handler cannot
// close over `game` directly (that would be a cycle: main -> registry -> here
// -> main). main.ts injects the live level lookup once at boot instead.
// ---------------------------------------------------------------------------

/** The main.ts game-session hook the card handler needs (the live authoritative level). */
export interface PlayerCardGameHooks {
  /** The live Sim level for an online character, or null when it is offline. */
  liveLevelForCharacter(characterId: number): number | null;
}

let runtime: PlayerCardGameHooks | null = null;

/** Inject the main.ts game-session hook the card handler needs (boot). */
export function configurePlayerCardRuntime(rt: PlayerCardGameHooks): void {
  runtime = rt;
}

/** Clear the injected runtime so a unit test can install its own fake. */
export function resetPlayerCardRuntimeForTests(): void {
  runtime = null;
}

/** The injected runtime, or a loud failure if a request somehow beat boot wiring. */
function useRuntime(): PlayerCardGameHooks {
  if (runtime === null) {
    throw new Error('player card runtime is not configured; call configurePlayerCardRuntime');
  }
  return runtime;
}

// ---------------------------------------------------------------------------
// Db seam. The bearer-resolution reads the guard uses, bundled once behind a
// test-only setter so the guard can be driven with a fake and no Postgres.
// scopeAllowsMutation is pure (no DB), so it stays a direct import.
// ---------------------------------------------------------------------------

const REAL_CARD_DB = { accountAndScopeForToken, moderationStatusForAccount };
let cardDb = REAL_CARD_DB;

/** Override the db bundle with a fake (test-only; merges over the real reads). */
export function setPlayerCardDbForTests(overrides: Partial<typeof REAL_CARD_DB>): void {
  cardDb = { ...REAL_CARD_DB, ...overrides };
}

/** Restore the real db bundle after a setPlayerCardDbForTests override (test-only). */
export function resetPlayerCardDbForTests(): void {
  cardDb = REAL_CARD_DB;
}

/** The raw 64-hex bearer token, or null (no header or bad shape). */
function bearerToken(req: http.IncomingMessage): string | null {
  const m = BEARER_PATTERN.exec(req.headers.authorization ?? '');
  return m ? m[1] : null;
}

/** Mutating + account-scoped gate (mirrors server/main.ts bearerActiveAccount). */
const activeGuard: Middleware = async (ctx, next) => {
  const token = bearerToken(ctx.req);
  const info = token === null ? null : await cardDb.accountAndScopeForToken(token);
  if (info === null) {
    json(ctx.res, 401, NOT_AUTHENTICATED);
    return;
  }
  if (!scopeAllowsMutation(info.scope)) {
    json(ctx.res, 403, READ_ONLY_TOKEN);
    return;
  }
  const status = await cardDb.moderationStatusForAccount(info.accountId);
  if (status.locked) {
    json(ctx.res, 403, moderationErrorBody(status));
    return;
  }
  ctx.account = { accountId: info.accountId, scope: info.scope };
  await next();
};

/**
 * Card pre-auth Content-Length gate. It records the publish request, and when the
 * declared Content-Length exceeds the MAX_CARD_BYTES cap it short-circuits 413
 * { error: 'image too large' } with Connection: close BEFORE the auth guard and
 * before any body is read, so a huge upload is rejected without a DB lookup and
 * the socket is told to close rather than keep streaming.
 */
const cardContentLengthGuard: Middleware = async (ctx, next) => {
  recordUsageMetric('card.publish.request');
  if (cardUploadContentLengthTooLarge(ctx.req)) {
    recordUsageMetric('card.publish.rejected');
    ctx.res.shouldKeepAlive = false;
    ctx.res.setHeader('Connection', 'close');
    json(ctx.res, 413, IMAGE_TOO_LARGE);
    return;
  }
  await next();
};

/** POST /api/card: publish a shareable player-card PNG (binary body; self-read). */
async function cardHandler(ctx: Ctx): Promise<void> {
  return handleCardUpload(ctx.req, ctx.res, ctxAccountId(ctx), (characterId) =>
    useRuntime().liveLevelForCharacter(characterId),
  );
}

/** GET /api/referrals: the account's referral count + primary card slug. */
async function referralsHandler(ctx: Ctx): Promise<void> {
  const accountId = ctxAccountId(ctx);
  const [count, slug] = await Promise.all([
    referralCountForAccount(accountId),
    primarySlugForAccount(accountId),
  ]);
  return json(ctx.res, 200, { count, slug });
}

export const routes: RouteDef[] = [
  {
    method: 'POST',
    path: '/api/card',
    surface: 'api',
    middleware: [cardContentLengthGuard, activeGuard, rateLimit(CARD_UPLOAD_POLICY)],
    handler: cardHandler,
    // The card upload is the one registered /api route whose request body is raw
    // bytes (image/png), not JSON: the Content-Type 415 gate exempts it via
    // this classification (the response error envelope stays the surface default).
    meta: { requestBody: 'binary' },
  },
  {
    method: 'GET',
    path: '/api/referrals',
    surface: 'api',
    middleware: [activeGuard],
    handler: referralsHandler,
  },
];
