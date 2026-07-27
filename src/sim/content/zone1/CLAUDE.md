# A zone directory

Each zone is a directory of four files behind an `index.ts` barrel. `zone1/`,
`zone2/`, and `zone3/` all have this shape; this note covers all three.

| File | Holds |
|---|---|
| `world.ts` | the `ZoneDef`, roads, camps, ground objects, props, and the zone's local constants |
| `mobs.ts` | the `MobTemplate` records |
| `npcs.ts` | the `NpcDef` records |
| `items.ts` | the `ItemDef` records (zone 1 has none) |
| `index.ts` | the barrel, re-exporting exactly what the old single module exported |

## Why it is split

Merge surface, not tidiness. Each zone used to be one file holding the zone
definition, its monsters, its NPCs, and its items together, so a branch authoring
monster records and a branch authoring weapons collided in the same file every
time. The Ragnarok conversion has several of those passes queued at once (fixed
monster stat blocks, weapon classes and refining, cards, the gear rebalance), and
they want to run in parallel.

**Split work by FILE, not by feature.** Two people can safely take `mobs.ts` and
`items.ts` in the same zone at the same time; two people cannot safely both take
"zone 2".

## Rules

- **The barrel is the public surface.** Import from `./content/zone2`, never from
  `./content/zone2/mobs` directly. Every existing import already goes through the
  barrel and none of them changed when this was split.
- **Add an export to its own file and to the barrel in the same change**, or it
  is invisible to `data.ts`.
- **A non-exported helper lives with the table that uses it**, not in `world.ts`.
  The class-group shortcuts above `ZONE2_ITEMS` are the pattern.
- Nothing here is logic. These are declarative content tables, which the root
  `CLAUDE.md` exempts from the module-first rule: a big data table is correctly
  big, and splitting one further by size rather than by merge surface buys
  nothing.
