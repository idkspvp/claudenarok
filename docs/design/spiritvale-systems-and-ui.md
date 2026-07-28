# Which existing systems survive the SpiritVale conversion

Companion to `spiritvale-conversion-plan.md`. Two audits: every gameplay system
this game inherited from World of Claudecraft, and every UI surface, each sorted
into keep, adapt or cut.

Two rules used throughout:

- **"SpiritVale does not have it" is not the same as "cut it."** The reference
  data is a wiki's reading of a closed client; absence there is weak evidence.
  A system is only cut when it CONFLICTS with the SpiritVale design or when it
  is WoW-shaped in a way that reads wrong in a Ragnarok-like.
- **A system that is good and does not conflict stays**, even if SpiritVale has
  no counterpart. The goal is a good game, not a clone.

## Part 1: the gameplay systems

### Keep, unchanged

These need no work and conflict with nothing.

| System | Where | Why it stays |
|---|---|---|
| **Dungeons** | `content/dungeons.ts`, `dungeon_layout.ts`, `dungeon_difficulty.ts` | SpiritVale has exactly one dungeon (the Eternal Tower) and it is a 101-floor grind. Ours are authored encounters, which is strictly more interesting. Keep and let SpiritVale's tower be a SECOND mode. |
| **Dungeon Finder** | `content/dungeon_finder.ts`, `world_api/dungeon_finder.ts` | Group formation is orthogonal to any combat model. Nothing to change. |
| **Party** | `world_api/party.ts` | Needed, and phase 3 improves it: SpiritVale's party bonus (+20% exp per member) and its level-gap brake are a real upgrade over what we have. |
| **Bank, bags, trade** | `bags.ts`, `world_api/bank.ts`, `trade.ts` | SpiritVale calls it Storage and has the same thing. |
| **Social graph, chat, mail** | `world_api/social_graph.ts`, `chat.ts`, `mail.ts` | Infrastructure, not design. |
| **Duel / Arena** | `world_api/duel_arena.ts`, `arena_window.ts` | SpiritVale ships a PvP Arena map as its own map type (`type: 2`). Direct counterpart. |
| **Leaderboards** | `server/leaderboard.ts` | The reference site hosts `/game/leaderboards`, so the game has them. |
| **Claudium (Stripe)** | `claudium.ts` | The commercial layer. Untouched by any of this. |
| **Cosmetics** | `content/skins.ts`, `weapon_skins.ts`, `world_api/cosmetics.ts` | SpiritVale runs 447 premium cosmetics across 14 slots including Pet, Mount and Emote. We are UNDER-built here, not over-built. |
| **Lockpick** | `lockpick.ts` | A small self-contained interaction. Harmless and good. |

### Keep, but rework in a numbered phase

| System | Rework | Phase |
|---|---|---|
| **PvP / Frontier honor** | Keep the zone and the stakes. SpiritVale pins siphon to level 100 in PvP (`CombatComponent.Pvp`), which is a level-normalising idea worth copying so a level-150 does not farm a level-40. | 7 |
| **Deeds (achievements)** | Keep. 1,834 lines and cosmetic-only by design, which is exactly right. Needs re-banding for level cap 150 and new deeds for SpiritVale content. Already an open task (#18). | 3, then 7 |
| **Augments / enchants** | These ARE SpiritVale's substat system, badly. Replace their innards with the 9 substat pools plus the 5 essence types; keep the UI and the item plumbing. | 6 |
| **Item sets** | Keep the mechanism, replace the content with SpiritVale's 24 sets of 3 to 4 pieces. | 6 |
| **Crafting / recipes** | Keep the window. Replace the recipe model with SpiritVale's: the crafter is a PLACE, and every recipe is N of exactly one material. Far simpler than what we have. | 6 |
| **Gather nodes** | Keep as the delivery mechanism for the guaranteed zone material. | 6 |

### Cut, because they conflict

| System | Why it goes |
|---|---|
| **Professions** | The single biggest WoC holdover. SpiritVale has no profession layer at all: crafting is unlocked by walking to a place, and its "craft classes" (Blacksmith, Gemsmith, Cardweaver, Alchemist) are ADVANCED JOBS, not a parallel skill track. Our profession system is a second progression spine competing with job level. Cut it; fold anything worth keeping into the phase-6 crafting rework. |
| **Heroic variants / heroic vendor / heroic marks** | A WoW difficulty-tier currency. SpiritVale has no difficulty tiers; its escalation is the Eternal Tower's floor number. |
| **Chronomancy, druid forms, warlock/mage pets** | Class systems for classes that will not exist after phase 4. Forms is already half-removed (`8bd31ee`). Pets return in phase 8 as SpiritVale SUMMONS, which are a different and better-specified thing (29 of them, each a stat block plus an autonomous rotation). |
| **Talent system** | Already being removed (tasks D0-2, D0-4 to D0-7). SpiritVale's equivalent is the grimoire: an equippable passive outside the skill budget. Finish the removal in phase 0, build the replacement in phase 6. |
| **Spec gating on abilities** | Same reason. Phase 4 replaces it with prerequisites. |

### Decide later (phase 9), no urgency

| System | The question |
|---|---|
| **Market / auction house** | SpiritVale publishes no auction data, but `Stall` appears as a cosmetic slot, which implies player vending. Ours works. Keep unless it becomes a balance problem. |
| **Delves** | A roguelike mini-dungeon with its own layout generator and companion NPC. Genuinely interesting and entirely ours. No conflict. The question is only whether it earns its maintenance next to dungeons plus the tower. |
| **Vale Cup** | A sports minigame. Fully orthogonal, zero conflict, pure content. |
| **Yumi maze** | Same. A cat maze. |
| **Card duel minigame** | This one has a real conflict of NAME: SpiritVale's "cards" are gear affixes dropped by monsters at 0.5%, which is the meaning a Ragnarok player expects. Two systems called cards will confuse. Rename the minigame or cut it. |
| **Temple, tunnels, graveyards, noticeboards, letters, mailboxes** | World furniture. Keep; they cost nothing. |

### What SpiritVale has that we do NOT, ranked

Worth building, in this order:

1. **Grimoires** (phase 6). An equippable passive outside the skill budget, fed
   by the artifact loop. Highest value item in the whole conversion.
2. **Artifacts** (phase 6). 34 sets of four pieces with four bonus tracks, and
   the only drop that comes from ordinary monsters rather than bosses.
3. **Gems** (phase 6). 129, of which 100 are "+2% to one named skill per
   refine". This is how a build commits to a rotation and we have no equivalent.
4. **Summons** (phase 8). 29 with autonomous rotations gated on target status.
5. **Essence re-rolls** (phase 6). Five types, a potential budget, a
   two-thirds roll floor.
6. **Dodge roll.** Listed as a combat system on the reference wiki and we have
   nothing like it. Not in the data files, so it needs its own design pass.
7. **Boss lures.** 24 consumables that force a boss spawn instead of waiting the
   hour. A small, excellent idea.

## Part 2: the UI

279 modules and 24 windows. The good news is structural: this repo already
enforces a **pure view-core plus thin painter** split, so most windows have
their decision logic in a DOM-free `*_view.ts` that a test drives directly. That
means a window's SHELL almost always survives even when its CONTENT changes
completely: the work is in the view core, not the painter.

### Reuse as-is

No conversion work at all.

```
bags · bank · social · mailbox · options · leaderboard · calendar
dev_command · store · claudium · inspect · char_skin · dungeon_finder
```

`inspect` deserves a note: it already paints a 6-slot paperdoll and a live
turntable. SpiritVale runs more slots than that (9 armour and accessory slots
plus Grimoire plus the weapon), so it needs slots ADDED, not rebuilt.

### Adapt: the shell stays, the view core is rewritten

This is where the UI work actually is.

| Window | What changes | Phase |
|---|---|---|
| **`char_window` + `char_stats_view` + `derived_stats_view`** | The derived-stat panel (built this year, `cdaffce`) currently shows Ragnarok's eight derived stats. SpiritVale's set overlaps heavily but computes differently and adds Block and CTR. The panel structure is right; the formulas behind it change. | 2 |
| **The status-point allocator** (task #25, unbuilt) | Build it once, against SpiritVale's ladder, not Ragnarok's. Needs the shift/right-click `-1` refund, which the reference's own UI has (`sim.skills.hint`). Do not build it twice. | 3 |
| **`spellbook_window` + `spellbook_view`** | Today it lists a flat class kit. SpiritVale needs a **7-column grid tree** with prerequisites, per-skill levels, a point counter and TWO separate pools (base and advanced). This is the single biggest UI job in the conversion. The good news: the grid layout comes across verbatim in the data, so the view core never has to lay out a graph. | 4 |
| **`crafting_window` + `crafting_view`** | Recipes become "N of one material, at a place". Simpler than what the view core handles now, so this is a subtraction. | 6 |
| **`deeds_window`** | Content and level bands change; the window does not. | 7 |
| **`arena_window`** | Keep. Add the PvP level-normalisation readout. | 7 |
| **`professions_window` + `profession_tutorial`** | **Deleted** with the profession system. Its i18n keys go with it (open task #5). | 0/9 |
| **`card_duel_window`** | Depends on the naming decision above. | 9 |
| **`town_focus_window`** | A WoC allocation panel. Re-evaluate in phase 9; probably cut. | 9 |
| **`vale_cup_window`** | Untouched. | -- |

### Build new

Nothing here exists yet.

| Surface | What it is | Phase |
|---|---|---|
| **Skill tree window** | Strictly, this is `spellbook` rebuilt: a 7-wide grid, prerequisite lines, +1 on click and -1 on shift/right-click, two point pools, a reset. | 4 |
| **Grimoire slot** | One equipment slot whose item grants a passive. The paperdoll needs the slot; the tooltip needs to render a passive's trigger text. | 6 |
| **Artifact panel** | Four pieces, four bonus tracks (full set, per piece, per refine, individual), plus gem sockets. Nothing in the current UI resembles this. | 6 |
| **Essence re-roll panel** | Pick a substat, pick an essence, spend potential and coin. Closest existing surface is the enchant UI, which is why phase 6 reworks that rather than starting over. | 6 |
| **Monster inspect** | SpiritVale shows a monster's stats, health, element and loot table on a keypress. We have nothing. Cheap and very good for a grind-first game. | 7 |
| **Advancement flow** | Job 50, talk to a class master, pick an advanced class, attributes reset to 1 with points returned. | 8 |

### The UI rules that do not change

Restating the invariants so no phase drifts:

- Every new component is a **DOM-free pure core** (`*_view.ts`, registered in
  `UI_PURE_CORES` in `tests/architecture.test.ts`) plus a **thin painter** on the
  `PainterHost` seam. Reuse a painter FAMILY before writing a bespoke one.
- HUD-domain components land in `src/ui/hud/<domain>/` behind its `index.ts`.
- **Every player-visible string is a `t()` key.** A conversion of this size
  will add hundreds; English-only in the catalog module, maintainer fills the
  rest at release.
- **Graphics settings stay gameplay-neutral.** A preset may drop cosmetic
  richness, never actionable information.

## The order this implies

The UI work is not a phase of its own. It rides along:

```
phase 0   delete professions UI + finish the talent UI removal
phase 2   derived-stat panel formulas
phase 3   status-point allocator (build ONCE, SpiritVale's ladder)
phase 4   skill tree window          <- the big one
phase 6   grimoire slot, artifact panel, essence re-roll
phase 7   monster inspect
phase 8   advancement flow
phase 9   card-duel naming, town focus, delve and market decisions
```

Two things are worth pulling forward because they are cheap and a player feels
them immediately: the **shift/right-click -1 refund** (phase 3) and **monster
inspect** (phase 7, movable to phase 2 since it only needs the stat core).
