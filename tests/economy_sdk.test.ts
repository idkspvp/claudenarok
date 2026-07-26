import { afterEach, describe, expect, it, vi } from 'vitest';
import { EconomyClient } from '../src/net/economy_sdk';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EconomyClient store snapshot', () => {
  it('marks the snapshot available only when balance and catalog both load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/api/claudium/balance')) {
          return new Response(JSON.stringify({ balance: 750 }), { status: 200 });
        }
        if (url.endsWith('/api/claudium/store')) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  itemId: 'ice_fang_sword',
                  name: 'Ice Fang',
                  kind: 'skin',
                  costClaudium: 3000,
                  owned: false,
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(null, { status: 404 });
      }),
    );

    const snapshot = await new EconomyClient({
      token: () => 'token',
      base: 'https://game.example',
    }).storeSnapshot();

    expect(snapshot).toEqual({
      available: true,
      balance: 750,
      items: [
        {
          itemId: 'ice_fang_sword',
          name: 'Ice Fang',
          kind: 'skin',
          costClaudium: 3000,
          owned: false,
        },
      ],
    });
  });

  it('marks a partial refresh unavailable instead of presenting fallback rows as fresh data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/api/claudium/balance')) {
          return new Response(JSON.stringify({ balance: 250 }), { status: 200 });
        }
        return new Response(null, { status: 503 });
      }),
    );

    const snapshot = await new EconomyClient({
      token: () => 'token',
      base: 'https://game.example',
    }).storeSnapshot();

    expect(snapshot).toEqual({ available: false, balance: 250, items: [] });
  });

  it('preserves the upstream unavailable marker returned through the game proxy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/api/claudium/balance')) {
          return new Response(JSON.stringify({ balance: 250 }), { status: 200 });
        }
        if (url.endsWith('/api/claudium/store')) {
          return new Response(JSON.stringify({ available: false, items: [] }), { status: 200 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    const snapshot = await new EconomyClient({
      token: () => 'token',
      base: 'https://game.example',
    }).storeSnapshot();

    expect(snapshot).toEqual({ available: false, balance: 250, items: [] });
  });
});

describe('EconomyClient pack snapshot', () => {});
