// AUTO-ASSEMBLED localization for sim-emitted system/combat/loot/error log text.
// The deterministic core (src/sim) is host-agnostic and MUST stay English: it emits
// SimEvent log/error/loot text in English. The client re-renders it here, exactly
// mirroring server_i18n.ts. hud.ts calls localizeSimText() as a fallback inside
// localizeSystemText / localizeErrorText / localizeLootText (after localizeServerText).
// Player/build names splice through verbatim; item and mob names are localized via
// the entity dictionary; numbers and roll values pass through unchanged.
//
// NOTE: this is the ONE place sim English is re-localized — when a SimEvent text:
// literal in src/sim/sim.ts changes, update the matching EXACT value or RULE here.
// The S3 guard in tests/localization_fixes.test.ts parses src/sim/sim.ts, enumerates
// every player-facing emit site, and fails if any is no longer recognized by a client
// matcher — so a new unhandled sim string cannot ship silently.
import { ABILITIES, DELVES, ITEMS, MOBS } from '../sim/data';
import { DELVE_MODULE_NAMES } from '../sim/sim';
import { tEntity } from './entity_i18n';
import {
  formatNumber,
  getLanguage,
  type InterpolationValues,
  type SupportedLanguage,
  supportedLanguages,
  type TranslationKey,
  t,
} from './i18n';
import { ARENA_NEW, BASE_NEW, ITEM_NEW, PET_NEW, QUEST_NEW, RAID_NEW } from './sim_i18n.newlocales';

const baseEnTable = {
  'log.deathwardSaves': 'A deathward saves you!',
  'error.lineOfSight': 'Line of sight.',
  'error.notInGroup': 'That ally is not in your group.',
  'error.noDeadAlly': 'You must target a dead ally in your group.',
  'error.noDeadGroupMembers': 'There are no dead group members to resurrect.',
  'error.bagsFull': 'Your bags are full.',
  'error.bagSocketsFull': 'All your bag slots are full.',
  'error.bagSwapTooManyItems': 'You have too many items to swap to that bag.',
  'error.bagRemoveTooManyItems': 'You have too many items to remove that bag.',
  'error.tradeBagSpace': 'Trade failed: not enough bag space.',
  'log.bagsMigrated': 'Your belongings have been packed into new bags.',
  // Bank (guild-bank-ready pooled bank; src/sim/bank.ts). The error.* lines are the
  // refusal toasts; log.bankSlotsPurchased is the purchase notice.
  'error.bankQuestItem': 'You cannot store quest items in the bank.',
  'error.bankFull': 'Your bank is full.',
  'error.bankCannotAfford': 'You cannot afford that bank expansion.',
  'error.bankMaxSlots': 'Your bank cannot be expanded further.',
  'error.bankTooFar': 'You are too far from the banker.',
  'log.bankSlotsPurchased': 'You purchase additional bank slots.',
  'error.specLevel': 'You may choose a specialization at level {level}.',
  'error.equipLevel': 'You must be level {level} to equip that.',
  'error.invalidBuild': 'Invalid talent build.',
  'error.unknownSpec': 'Unknown specialization.',
  'error.maxLoadouts': 'You can save at most {count} loadouts.',
  'error.noLoadout': 'No such loadout.',
  'error.loadoutLevel': 'That loadout needs a higher level.',
  'error.cannotEquip': 'You cannot equip that.',
  // Refusal when an aimed equip slot (a paperdoll drop target) does not accept the
  // dragged piece, e.g. a helm dropped on a ring finger (src/sim/items.ts equipItem).
  'error.wrongEquipSlot': 'That does not go in that slot.',
  'error.faceWater': 'You need to face fishable water.',
  'error.potionNotReady': 'That potion is not ready yet.',
  'error.fullHealth': 'You are already at full health.',
  'error.nothingRestore': 'Nothing to restore.',
  'error.nothingToConsume': 'Nothing to consume.',
  'error.nothingToDevour': 'Nothing to devour.',
  'error.recentKillRequired': 'You need a recent kill.',
  'error.merchantUnavailable': 'That merchant is not available.',
  'error.notForSale': 'That item is not for sale.',
  'error.noMerchant': 'There is no merchant nearby.',
  'error.noSellQuest': 'You cannot sell quest items.',
  // Bind invariant: sellItem refuses a bound (boundTo-stamped) copy so
  // the vendor can never launder the Maker's Bond into a plain buyback copy.
  'error.sellBound': 'That item is bound and cannot be sold.',
  'error.noBuyback': 'That item is not available for buyback.',
  'error.nailedShut': 'It is nailed shut.',
  'error.enoughOfThose': 'You have enough of those.',
  'error.whoOnline': 'The /who roster is available in online play.',
  'error.alreadyInParty': 'You are already in a party.',
  'error.notPartyLeader': 'You are not the party leader.',
  'error.raidMarkersParty': 'You must be in a party to use raid markers.',
  'error.nameSellQty': 'Name how many you wish to sell.',
  'error.talentsInCombat': 'You cannot change talents in combat.',
  'error.talentsArena': 'You cannot change talents during an arena match.',
  'error.noItem': "You don't have that item.",
  'error.cantWhileDead': "You can't do that while dead.",
  'error.cantWhileSwimming': "You can't do that while swimming.",
  'error.tameThat': 'You cannot tame that.',
  'error.tameBeastsOnly': 'Only beasts can be tamed.',
  'error.tameTooStrong': 'That beast is too strong to tame.',
  'error.tameTooHigh': 'That beast is too high level for you to tame.',
  'error.tameDungeon': 'You cannot tame dungeon creatures.',
  'error.alreadyHavePet': 'You already have a pet.',
  'error.noLootPermission': "You don't have permission to loot that.",
  'error.corpseAlreadyHarvested': 'This corpse has already been harvested.',
  'error.corpseNothingToHarvest': 'That corpse has nothing to harvest.',
  'error.gatherNodeMissing': 'That resource node does not exist.',
  'error.gatherNodeNotRespawned': 'This resource node has not respawned for you yet.',
  // Profession-choice quest denials (src/sim/quests/quest_commands.ts): the archetype
  // pair or hobby selection fails validation on quest accept or again at turn-in.
  'error.professionChoiceUnavailable': 'That profession choice is not available.',
  'error.professionChoiceExpired': 'That profession choice is no longer available.',
  'error.townFocusNotInTown': 'You must be in town to set your focus.',
  'error.townFocusOverBudget': 'That allocation exceeds your focus point budget.',
  'error.townFocusInvalid': 'Invalid focus allocation.',
  // Custom per-item ground-pickup lines (src/sim/content/ground_pickup_lines.ts).
  // Emitted via def.pickupDeny/def.pickupEnough (variable-routed, so the S3 guard
  // cannot see them); values must stay byte-identical to that table for the EXACT
  // matcher to recognize them. The three grave_* deny lines share one string/key.
  'groundPickup.supplyCrateDeny': 'The crate is nailed shut.',
  'groundPickup.gravecallerSigilDeny': 'The sigil repels your touch.',
  'groundPickup.ledgerPageDeny': 'The ledger pages are bound too tightly to take.',
  'groundPickup.morthenGrimoireDeny': "The grimoire's clasp is magically sealed.",
  'groundPickup.fenMusterOrderDeny': 'The wax seal holds until the order is yours to claim.',
  'groundPickup.caravanGoodsDeny': "You aren't authorized to salvage these goods yet.",
  'groundPickup.rustedCenserDeny': 'The censer is chained in place.',
  'groundPickup.bastionWardStoneDeny': 'The ward stone will not budge.',
  'groundPickup.alienWeaponryDeny':
    'The meteor debris is too hot to handle without Aldric expecting it.',
  'groundPickup.highwatchSummonsDeny': 'The summons are sealed with Highwatch wax.',
  'groundPickup.ogreWarTotemDeny': 'The totem is planted too firmly to uproot.',
  'groundPickup.gravewyrmSigilDeny': 'Dark magic keeps the sigil rooted.',
  'groundPickup.sanctumKeyShardDeny': 'The shard is dormant and locked in place.',
  'groundPickup.moongateRubbingDeny':
    'The warding is not yours to copy until the watcher asks for it.',
  'groundPickup.graveSealedDeny':
    'The grave is sealed against the living until the dead call you to it.',
  'groundPickup.cryptRitualCircleDeny': 'The ritual circle lies cold and dormant.',
  'groundPickup.supplyCrateEnough': 'You already have enough supply crates.',
  'groundPickup.gravecallerSigilEnough': "You already carry a Gravecaller's Sigil.",
  'groundPickup.ledgerPageEnough': 'You already have enough ledger pages.',
  'groundPickup.morthenGrimoireEnough': "You already have Morthen's Grimoire.",
  'groundPickup.fenMusterOrderEnough': 'You already have the Fenbridge muster order.',
  'groundPickup.caravanGoodsEnough': 'You already have enough caravan goods.',
  'groundPickup.rustedCenserEnough': 'You already have enough rusted censers.',
  'groundPickup.bastionWardStoneEnough': 'You already have the Bastion ward stone.',
  'groundPickup.alienWeaponryEnough': 'You already recovered enough alien wreckage.',
  'groundPickup.highwatchSummonsEnough': 'You already have the Highwatch summons.',
  'groundPickup.ogreWarTotemEnough': 'You already have enough ogre war totems.',
  'groundPickup.gravewyrmSigilEnough': 'You already have enough Gravewyrm sigils.',
  'groundPickup.sanctumKeyShardEnough': 'You already have enough sanctum key shards.',
  'groundPickup.moongateRubbingEnough': 'You already have the warding rubbing.',
  'groundPickup.graveAldrenEnough': "You have already taken what Captain Aldren's grave will give.",
  'groundPickup.graveMalricEnough':
    "You have already taken what High Priest Malric's grave will give.",
  'groundPickup.graveVossEnough':
    "You have already taken what Royal Assassin Voss's grave will give.",
  'groundPickup.cryptRitualCircleEnough': 'The circle has nothing more to give you.',
  'error.vcupDeserter': 'The Groundskeeper remembers. Come back later.',
  'error.vcupPartyTooBig': 'That bracket needs a smaller party.',
  'error.vcupNoNation': 'Pick a banner nation first.',
  'error.vcupPracticeFull': 'The practice pitches are all in use. Try again shortly.',
  'log.talentsUpdated': 'Talents updated.',
  'log.talentsReset': 'Talents reset.',
  'log.cheatDeathSave': 'Cheat Death saves you!',
  'log.savedBuild': 'Saved build “{name}”.',
  'log.loadoutApplied': 'Loadout “{name}” applied.',
  'log.deletedBuild': 'Deleted build “{name}”.',
  'log.dismissPet': 'You dismiss {name}.',
  'log.summonDemon': 'You summon {name}.',
  'log.tamedPet': '{name} is now your loyal companion.',
  'log.entityDies': '{name} dies.',
  'log.prestiged': 'You have prestiged! Prestige Rank {rank}.',
  'log.enraged': '{name} becomes enraged!',
  'log.callsForAid': '{name} calls for aid!',
  'log.deathThroesArm': '{name} begins to swell — get clear!',
  'log.deathThroesBurst': '{name} bursts in a cloud of {effect}!',
  'log.discarded': 'Discarded {item}.',
  'log.equipped': 'Equipped {item}.',
  'log.unequipped': 'Unequipped {item}.',
  'log.noFish': 'No fish are biting.',
  'log.rareCatch': 'A rare catch! Something gleams on your line.',
  'log.sitEat': 'You sit down to eat.',
  'log.sitDrink': 'You sit down to drink.',
  'log.quaff': 'You quaff {item}.',
  'log.boutDecided': 'The bout is decided. Returning to the world…',
  'log.partyLeaves': '{name} leaves the party.',
  'log.partyLeft': '{name} has left the party.',
  'log.partyRemoved': '{name} has been removed from the party.',
  // Per-member ready-check follow-up lines (social/ready_check.ts finalizeReadyCheck).
  'log.readyCheckNotReady': '{name} is not ready.',
  'log.readyCheckNoResponse': '{name} did not respond to the ready check.',
  'loot.rollWin': '{winner} wins {item} ({roll})',
  'loot.rollWinnerOffline': '{winner} was offline; {item} returned to the corpse.',
  'loot.rollNeed': 'Need Roll - {roll} for {item} by {name}',
  'loot.rollGreed': 'Greed Roll - {roll} for {item} by {name}',
  'loot.marketSellerBought':
    '{buyer} bought your {item} for {price} - collect {proceeds} from the Merchant.',
  'log.learnedAbility': 'You have learned a new ability: {name}.',
  'log.abilityRankUp': 'Your {name} has improved to Rank {rank}.',
  'log.stopFollowing': 'You stop following.',
  'log.noOneToFollow': 'There is no one to follow.',
  'log.stopFollowingCombat': 'You stop following - you are in combat.',
  'log.tooFarToFollow': '{name} is too far away to follow.',
  'log.nowFollowing': 'Now following {name}.',
  'error.notFollowingAnyone': 'You are not following anyone.',
  'error.cantFollowSelf': "You can't follow yourself.",
  'error.cantFollowInCombat': "You can't start following while in combat.",
  'error.targetToFollow': 'Target a player to follow, or use /follow <name>.',
  'presence.noLongerAfk': 'You are no longer Away From Keyboard.',
  'presence.leftDnd': 'You have left Do Not Disturb mode.',
  'presence.nowAfk': 'You are now Away From Keyboard: {message}',
  'presence.nowDnd': 'You are now in Do Not Disturb mode: {message}',
  'presence.noLongerAway': 'You are no longer marked as away.',
  'presence.afkDefault': 'Away From Keyboard',
  'presence.dndDefault': 'Do Not Disturb',
  'log.channelJoined': 'Joined the {channel} channel. Type /{channel} <message> to talk.',
  'log.channelLeft': 'Left the {channel} channel.',
  'log.dungeonDifficultyHeroic': 'Dungeon difficulty set to Heroic.',
  'log.dungeonDifficultyNormal': 'Dungeon difficulty set to Normal.',
  'log.dungeonDifficultyIsHeroic': 'Dungeon difficulty: Heroic. Use /dungeon normal to change it.',
  'log.dungeonDifficultyIsNormal': 'Dungeon difficulty: Normal. Use /dungeon heroic to change it.',
  'error.heroicMarksNeeded': 'You need {marks} Heroic Marks to buy {name}.',
  'error.channelUsage': 'Usage: /{action} <channel>. Channels: {list}.',
  'error.generalAlwaysOn': 'The General channel is always on - just use /general.',
  'error.noSuchChannel': "There is no channel named '{name}'. Channels: {list}.",
  'error.alreadyInChannel': 'You are already in the {channel} channel.',
  'error.notInChannel': 'You are not in the {channel} channel.',
  'error.notInChannelJoin': 'You are not in the {channel} channel. Type /join {channel} first.',
  'log.bossUnleashes': '{name} unleashes {mechanic}!',
  'log.mobChannels': '{name} channels {mechanic}.',
  'log.channelInterrupted': '{mechanic} is interrupted!',
  'aura.tamed': 'Tamed',
  'aura.causticSpores': 'Caustic Spores',
  'aura.elixirBear': 'Might of the Bear',
  // Crafted alchemy elixir auras (content/profession_items.ts): the
  // buff_sta aura name shown on the buff bar / combat log when the crafted elixir
  // is quaffed, localized the same way as elixirBear.
  'aura.elixirBoar': 'Might of the Boar',
  'aura.elixirVenomfire': 'Vipersear Vigor',
  'aura.elixirSerpent': 'Might of the Serpent',
  // Shared Bloodlust / Temporal Acceleration exhaustion debuff (combat/haste_burst.ts).
  'aura.temporalExhaustion': 'Temporal Exhaustion',
  // Cauterize's 5 min lockout debuff (combat/fire_mage.ts); survives death.
  'aura.cauterizeFatigue': 'Cauterize Fatigue',
  'mechanic.warStomp': 'Shuddering Stomp',
  // Heroic swordman-mob anti-kite charge (MobTemplate.charge, src/sim/mob/charge.ts):
  // the stun debuff on the player and the {mechanic} in the "unleashes" line.
  'mechanic.charge': 'Onrush',
  'mechanic.boneCarapace': 'Bone Carapace',
  'mechanic.bansheesWail': 'Keening Wail',
  'mechanic.crushingSweep': 'Crushing Sweep',
  'mechanic.rallyingBanner': 'Rallying Banner',
  'mechanic.finalBell': 'Final Bell',
  'mechanic.blackwaterMark': 'Blackwater Mark',
  'mechanic.litanyPulse': 'Litany Pulse',
  'mechanic.siltWard': 'Silt Ward',
  'mechanic.siltHide': 'Silt Hide',
  'mechanic.sumpStomp': 'Sump Stomp',
  'mechanic.bellShock': 'Bell Shock',
  'mechanic.eggSacBurst': 'Egg-Sac Burst',
  'mechanic.tollingBell': 'Tolling Bell',
  'log.nhaliaTollsBells': '{name} tolls the bells!',
  'aura.drownedCanticle': 'Drowned Canticle',
  'mechanic.tectonicHeave': 'Tectonic Heave',
  'mechanic.seismicStomp': 'Seismic Stomp',
  'mechanic.mountainhide': 'Mountainhide',
  'mechanic.thunderclap': 'Thunderclap',
  'mechanic.stormcall': 'Stormcall',
  'mechanic.howlingGale': 'Howling Gale',
  'aura.spiderVenom': 'Spider Venom',
  'aura.skullthump': 'Skullthump',
  'aura.blindingPowder': 'Blinding Powder',
  'aura.witheringWail': 'Withering Wail',
  'aura.soulrot': 'Soulrot',
  'aura.mudfinHex': 'Mudfin Hex',
  'aura.miringPounce': 'Miring Pounce',
  'aura.acidSpit': 'Acid Spit',
  'aura.exposedWound': 'Exposed Wound',
  'aura.bogRot': 'Bog Rot',
  'aura.witheringRot': 'Withering Rot',
  'aura.curseOfFrailty': 'Curse of Frailty',
  'aura.weakeningHex': 'Weakening Hex',
  'aura.silencingShriek': 'Silencing Shriek',
  'aura.wailOfTheGrave': 'Wail of the Grave',
  'aura.graveBlight': 'Grave Blight',
  'aura.drainingLitany': 'Draining Litany',
  'aura.spiritSiphon': 'Spirit Siphon',
  'aura.dirgeOfTongues': 'Dirge of Tongues',
  'aura.profaneRune': 'Profane Rune',
  'aura.broodVenom': 'Brood Venom',
  'aura.rendingClaws': 'Rending Claws',
  'aura.smolderingFuse': 'Smoldering Fuse',
  'aura.cinderburn': 'Cinderburn',
  'aura.concussiveBlow': 'Concussive Blow',
  'aura.disarmingSmash': 'Disarming Smash',
  'aura.staticCharge': 'Static Charge',
  'aura.frostbite': 'Winterbite',
  'aura.maddeningWhisper': 'Maddening Whisper',
  'aura.wyrmwardSigil': 'Wyrmward Sigil',
  'aura.soulSiphon': 'Soul Siphon',
  'aura.forgottenWound': 'Forgotten Wound',
  'aura.searingMaw': 'Searing Maw',
  'aura.crackedGuard': 'Cracked Guard',
  'aura.offBalance': 'Off-Balance',
  'aura.numbingChill': 'Numbing Chill',
  'aura.webSnare': 'Web Snare',
  'aura.feedingFrenzy': 'Feeding Frenzy',
  'aura.demoralized': 'Demoralized',
  'aura.resurrectionSickness': "The Keeper's Toll",
  'aura.hotPursuit': 'Hot Pursuit',
  'aura.redHarvest': 'Red Harvest',
  'aura.recklessVow': 'Reckless Vow',
  'aura.redBanner': 'Red Banner',
  'aura.colossus': 'Colossus',
  // 4-piece set-bonus proc buffs (src/sim/content/item_sets.ts SetProc names).
  'aura.clearcasting': 'Clearcasting',
  // Talent-proc buff/ward names (choice_rows_classic.ts ProcDef names).
  'aura.searingLight': 'Searing Light',
  'aura.lingeringGraceWard': 'Lingering Grace',
  'aura.nocturns': 'Nocturns',
  'aura.greaterHealEcho': 'Greater Heal',
  'aura.innerFire': 'Inner Fire',
  'aura.blessedRecovery': 'Blessed Recovery',
  'aura.faultLine': 'Fault Line',
  'aura.thunderWardSurge': 'Thunder Ward',
  'aura.guidingSpirits': 'Guiding Spirits',
  'aura.elementalWarding': 'Elemental Warding',
  'aura.earthenFury': 'Earthen Fury',
  'aura.tidalWaves': 'Tidal Waves',
  'aura.divineWisdom': 'Divine Wisdom',
  'aura.guardiansFavor': "Guardian's Favor",
  'aura.greaterBlessing': 'Greater Blessing',
  'aura.sacredWard': 'Sacred Ward',
  'aura.firestarter': 'Firestarter',
  'aura.manaAttunement': 'Mana Attunement',
  'aura.deepRime': 'Deep Rime',
  'aura.slowBurn': 'Slow Burn',
  'aura.battlemageArmor': 'Battlemage Armor',
  'aura.improvedBackstab': 'Improved Backstab',
  'aura.improvedCutthroatTempo': 'Improved Cutthroat Tempo',
  'aura.finalNotice': 'Final Notice',
  'aura.improvedEvasion': 'Improved Evasion',
  'aura.endurance': 'Endurance',
  'aura.masterAssassin': 'Master Assassin',
  'aura.improvedVenomBarb': 'Improved Venom Barb',
  'aura.aspectMastery': 'Aspect Mastery',
  'aura.leanQuiver': 'Lean Quiver',
  'aura.deathlessWill': 'Deathless Will',
  'aura.sniperTraining': 'Sniper Training',
  'aura.masterTamer': 'Master Tamer',
  'aura.callousedHide': 'Calloused Hide',
  'aura.improvedVolley': 'Improved Volley',
  'aura.improvedWildbolt': 'Improved Wildbolt',
  'aura.redmaw': 'Redmaw',
  'aura.naturesBounty': "Nature's Bounty",
  'aura.wildsurge': 'Wildsurge',
  'aura.improvedMark': 'Improved Mark',
  'aura.savageFury': 'Savage Fury',
  'aura.moonspite': 'Moonspite',
  'aura.empoweredTouch': 'Empowered Touch',
  'aura.improvedBarkskin': 'Improved Barkskin',
  'aura.improvedHurricane': 'Improved Hurricane',
  'aura.improvedImmolate': 'Improved Immolate',
  'aura.demonArmor': 'Demon Armor',
  'aura.desolation': 'Desolation',
  'aura.umbralMastery': 'Umbral Mastery',
  'aura.improvedFear': 'Improved Fear',
  'aura.unyieldingPact': 'Unyielding Pact',
  'aura.grimoireOfCarnage': 'Grimoire of Carnage',
  'aura.curseMastery': 'Curse Mastery',
  'aura.gravemight': 'Gravemight',
  'aura.fangrush': 'Fangrush',
  'aura.bonesplinter': 'Bonesplinter',
  'aura.raggedGash': 'Ragged Gash',
  'aura.soulblaze': 'Soulblaze',
  'aura.bladedEcho': 'Bladed Echo',
  'aura.emboldened': 'Emboldened',
  'aura.enraged': 'Enraged',
  'aura.fingersOfFrost': 'Fingers of Frost',
  'aura.brainFreeze': 'Brain Freeze',
  'aura.wintersChill': "Winter's Chill",
  'aura.icicles': 'Icicles',
  'aura.perfectMoment': 'Perfect Moment',
  // Card Duel minigame (Card Master NPC, src/sim/social/card_duel.ts).
  'log.cardDuelQueued': 'You queue for a Card Duel.',
  'log.cardDuelLeftQueue': 'You leave the Card Duel queue.',
  'log.cardDuelBegins': 'Your Card Duel against {name} begins!',
  // No-opponent-meta arms (the opponent's meta is gone, e.g. they left
  // mid-match): distinct literals rather than an "?? 'an opponent'" style
  // fallback interpolated into the templates above (root CLAUDE.md bans that
  // pattern; the S3 guard only scrapes the outer literal so it cannot catch a
  // fallback hidden inside a template string).
  'log.cardDuelBeginsNoOpponent': 'Your Card Duel begins!',
  'log.cardDuelRound': 'Card Duel round: you played {mine}, opponent played {theirs}.',
  'log.cardDuelWin': 'You win the Card Duel against {name}!',
  'log.cardDuelWinNoOpponent': 'You win the Card Duel!',
  'log.cardDuelLoss': 'You lose the Card Duel against {name}.',
  'log.cardDuelLossNoOpponent': 'You lose the Card Duel.',
  'log.cardDuelForfeit': 'You forfeit the Card Duel.',
  'log.cardDuelOpponentForfeited': 'Your opponent forfeited the Card Duel. You win!',
  'log.cardDuelVoid': 'Your Card Duel is void: neither side played in time.',
  'error.cardDuelNotAtMaster': 'You must be at the Card Master to queue for a Card Duel.',
  'error.cardDuelNotInMatch': 'You are not in a Card Duel.',
  'error.cardDuelAlreadyPlayed': 'You already played a card this round.',
  'error.cardDuelNotHeld': "You don't hold that card.",
  'error.cardDuelAlreadyInDuel': 'You are already in a Card Duel.',
  'error.cardDuelAlreadyQueued': 'You are already queued for a Card Duel.',
  'error.cardDuelUnavailable': 'Card Duel requires another player online.',
  // Dungeon Finder (src/sim/social/dungeon_finder.ts emits; docs/prd/dungeon-finder.md).
  'dfinder.badRole': 'You cannot fill that role.',
  'dfinder.alreadyQueued': 'You are already in the Dungeon Finder queue.',
  'dfinder.leaderOnly': 'Only the party leader may use the Dungeon Finder.',
  'dfinder.noActivities': 'Select at least one activity to queue for.',
  'dfinder.groupTooLarge': 'Your group is too large for that activity.',
  'dfinder.levelRange': 'You do not meet the level range for that activity.',
  'dfinder.memberLevel': '{name} does not meet the level range for that activity.',
  'dfinder.selectRole': 'Select a Dungeon Finder role first.',
  'dfinder.memberRoles': '{name} has not selected a Dungeon Finder role.',
  'dfinder.cooldown': 'You cannot join the queue again yet.',
  'dfinder.memberCooldown': '{name} cannot join the queue again yet.',
  'dfinder.notQueued': 'You are not in the Dungeon Finder queue.',
  'dfinder.noProposal': 'There is no group proposal to answer.',
  'dfinder.listingGone': 'That listing is no longer available.',
  'dfinder.alreadyListing': 'You already lead a group listing.',
  'dfinder.noListing': 'You do not lead a group listing.',
  'dfinder.alreadyApplied': 'You already have a pending application.',
  'dfinder.applyInParty': 'Leave your party before applying to a listing.',
  'dfinder.noRoom': 'That listing has no room for your roles.',
  'dfinder.noApplication': 'You have no pending application.',
  'dfinder.playerUnavailable': 'That player is no longer available.',
  'dfinder.queueJoined': 'You join the Dungeon Finder queue.',
  'dfinder.queueLeft': 'You leave the Dungeon Finder queue.',
  'dfinder.youLeftQueue': 'You left the Dungeon Finder queue.',
  'dfinder.groupLeftQueue': 'Your group left the Dungeon Finder queue.',
  'dfinder.notAssembled': 'The group did not assemble. You keep your place in the queue.',
  'dfinder.assembled': 'Your Dungeon Finder group has assembled. Travel to the entrance together.',
  'dfinder.listingPublished': 'Your group listing is published.',
  'dfinder.appliedListingClosed': 'The group listing you applied to has closed.',
  'dfinder.listingClosed': 'Your group listing is now closed.',
  'dfinder.applied': 'You apply to a group listing.',
  'dfinder.applicantApplies': '{name} applies to your group listing.',
  'dfinder.applicationWithdrawn': 'You withdraw your application.',
  'dfinder.applicationDeclined': 'Your application was declined.',
  'dfinder.applicationAccepted': 'Your application was accepted.',
  'dfinder.proposalReady': 'A dungeon group is ready. Confirm your slot now.',
  'dfinder.groupChanged': 'Your group changed and left the Dungeon Finder queue.',
  'dfinder.listingFull': 'Your group listing is now full.',
} as const;

const petEnTable = {
  'error.noPet': 'You have no pet.',
  'error.petsNotAllowedInDelves': 'Pets are not allowed inside the delves.',
  'error.petAlreadyAlive': 'Your pet is already alive.',
  'error.permanentPetAbandonFrame': 'Permanent pets can only be abandoned from the pet frame.',
  'error.summonUnavailable': 'That summon is unavailable.',
  'error.huntersAbandonPets': 'Only hunters can abandon pets.',
  'error.petClassesRename': 'Only pet classes can rename pets.',
  'error.petNameInvalid':
    'Pet name must be 2-16 letters/spaces/hyphen/apostrophe and start with a letter.',
  'error.petClassesRevive': 'Only pet classes can revive pets.',
  'error.petClassesCommand': 'Only pet classes can command pets.',
  'error.noLivingPet': 'You have no living pet.',
  'error.petNeedsHostileTarget': 'Your pet needs a hostile target.',
  'error.petTauntNotReady': 'Pet taunt is not ready.',
  'error.petCannotTaunt': 'This pet cannot taunt.',
  'petGrowl.ready': "Your pet's Growl is ready. {autoState}",
  'petGrowl.cooldown': "Your pet's Growl is on cooldown. {autoState} Ready in {seconds}s.",
  'petGrowl.autoOn': 'Auto-taunt is on.',
  'petGrowl.autoOff': 'Auto-taunt is off.',
  'error.huntersFeedPets': 'Only hunters can feed pets.',
  'error.petFoodOnly': 'Your pet can only eat food.',
  'error.petFullHealth': 'Your pet is already at full health.',
  'error.warlocksDemonHeal': 'Only warlocks can channel demon healing.',
  'error.youAreDead': 'You are dead.',
  'error.youAreStunned': 'You are stunned.',
  'error.noLivingDemon': 'You have no living demon.',
  'error.demonFullHealth': 'Your demon is already at full health.',
  'log.petFadesVoid': '{name} fades back into the void.',
  'log.petAnswersSummons': '{name} answers your summons.',
  'log.abandonPet': 'You abandon {name}.',
  'log.petRenamed': 'Your pet is now named {name}.',
  'log.petReturns': '{name} returns to your side.',
  'log.petRestoreLost': '{name} could not be restored and has been lost.',
  'log.petRestoreLostNoName': 'Your pet could not be restored and has been lost.',
  'log.feedPet': 'You feed {name}.',
  'log.demonHealChannel': 'You channel healing into {name}.',
  'log.petMode': '{name} is now {mode}.',
  'petMode.passive': 'passive',
  'petMode.defensive': 'defensive',
  'petMode.aggressive': 'aggressive',
  'aura.summoned': 'Summoned',
  'aura.fed': 'Fed',
} as const;

const enTable = { ...baseEnTable, ...petEnTable } as const;

type BaseSimMessageKey = keyof typeof baseEnTable;
type PetSimMessageKey = keyof typeof petEnTable;
export type SimMessageKey = keyof typeof enTable;

// Per-locale table. Contributors add English only; non-English omissions fall
// back to English here until the release localization pass fills them.
const BASE_DICT: Record<SupportedLanguage, Partial<Record<BaseSimMessageKey, string>>> = {
  en: {
    'log.deathwardSaves': 'A deathward saves you!',
    'error.lineOfSight': 'Line of sight.',
    'error.bagsFull': 'Your bags are full.',
    'error.bagSocketsFull': 'All your bag slots are full.',
    'error.bagSwapTooManyItems': 'You have too many items to swap to that bag.',
    'error.bagRemoveTooManyItems': 'You have too many items to remove that bag.',
    'error.tradeBagSpace': 'Trade failed: not enough bag space.',
    'log.bagsMigrated': 'Your belongings have been packed into new bags.',
    'error.specLevel': 'You may choose a specialization at level {level}.',
    'error.equipLevel': 'You must be level {level} to equip that.',
    'error.invalidBuild': 'Invalid talent build.',
    'error.unknownSpec': 'Unknown specialization.',
    'error.maxLoadouts': 'You can save at most {count} loadouts.',
    'error.noLoadout': 'No such loadout.',
    'error.loadoutLevel': 'That loadout needs a higher level.',
    'error.cannotEquip': 'You cannot equip that.',
    'error.faceWater': 'You need to face fishable water.',
    'error.potionNotReady': 'That potion is not ready yet.',
    'error.fullHealth': 'You are already at full health.',
    'error.nothingRestore': 'Nothing to restore.',
    'error.nothingToConsume': 'Nothing to consume.',
    'error.nothingToDevour': 'Nothing to devour.',
    'error.merchantUnavailable': 'That merchant is not available.',
    'error.notForSale': 'That item is not for sale.',
    'error.noMerchant': 'There is no merchant nearby.',
    'error.noSellQuest': 'You cannot sell quest items.',
    'error.sellBound': 'That item is bound and cannot be sold.',
    'error.noBuyback': 'That item is not available for buyback.',
    'error.nailedShut': 'It is nailed shut.',
    'error.enoughOfThose': 'You have enough of those.',
    'error.whoOnline': 'The /who roster is available in online play.',
    'error.alreadyInParty': 'You are already in a party.',
    'error.notPartyLeader': 'You are not the party leader.',
    'error.raidMarkersParty': 'You must be in a party to use raid markers.',
    'error.nameSellQty': 'Name how many you wish to sell.',
    'error.talentsInCombat': 'You cannot change talents in combat.',
    'error.talentsArena': 'You cannot change talents during an arena match.',
    'error.noItem': "You don't have that item.",
    'error.cantWhileDead': "You can't do that while dead.",
    'error.cantWhileSwimming': "You can't do that while swimming.",
    'error.tameThat': 'You cannot tame that.',
    'error.tameBeastsOnly': 'Only beasts can be tamed.',
    'error.tameTooStrong': 'That beast is too strong to tame.',
    'error.tameTooHigh': 'That beast is too high level for you to tame.',
    'error.tameDungeon': 'You cannot tame dungeon creatures.',
    'error.alreadyHavePet': 'You already have a pet.',
    'error.noLootPermission': "You don't have permission to loot that.",
    'error.corpseAlreadyHarvested': 'This corpse has already been harvested.',
    'error.corpseNothingToHarvest': 'That corpse has nothing to harvest.',
    'error.gatherNodeMissing': 'That resource node does not exist.',
    'error.gatherNodeNotRespawned': 'This resource node has not respawned for you yet.',
    'error.vcupDeserter': 'The Groundskeeper remembers. Come back later.',
    'error.vcupPartyTooBig': 'That bracket needs a smaller party.',
    'error.vcupNoNation': 'Pick a banner nation first.',
    'error.vcupPracticeFull': 'The practice pitches are all in use. Try again shortly.',
    'log.talentsUpdated': 'Talents updated.',
    'log.talentsReset': 'Talents reset.',
    'log.savedBuild': 'Saved build “{name}”.',
    'log.loadoutApplied': 'Loadout “{name}” applied.',
    'log.deletedBuild': 'Deleted build “{name}”.',
    'log.dismissPet': 'You dismiss {name}.',
    'log.summonDemon': 'You summon {name}.',
    'log.tamedPet': '{name} is now your loyal companion.',
    'log.entityDies': '{name} dies.',
    'log.prestiged': 'You have prestiged! Prestige Rank {rank}.',
    'log.enraged': '{name} becomes enraged!',
    'log.callsForAid': '{name} calls for aid!',
    'log.deathThroesArm': '{name} begins to swell — get clear!',
    'log.deathThroesBurst': '{name} bursts in a cloud of {effect}!',
    'log.discarded': 'Discarded {item}.',
    'log.equipped': 'Equipped {item}.',
    'log.unequipped': 'Unequipped {item}.',
    'log.noFish': 'No fish are biting.',
    'log.rareCatch': 'A rare catch! Something gleams on your line.',
    'log.sitEat': 'You sit down to eat.',
    'log.sitDrink': 'You sit down to drink.',
    'log.quaff': 'You quaff {item}.',
    'log.boutDecided': 'The bout is decided. Returning to the world…',
    'log.partyLeaves': '{name} leaves the party.',
    'log.partyLeft': '{name} has left the party.',
    'log.partyRemoved': '{name} has been removed from the party.',
    'log.readyCheckNotReady': '{name} is not ready.',
    'log.readyCheckNoResponse': '{name} did not respond to the ready check.',
    'loot.rollWin': '{winner} wins {item} ({roll})',
    'loot.rollNeed': 'Need Roll - {roll} for {item} by {name}',
    'loot.rollGreed': 'Greed Roll - {roll} for {item} by {name}',
    'loot.marketSellerBought':
      '{buyer} bought your {item} for {price} - collect {proceeds} from the Merchant.',
    'log.learnedAbility': 'You have learned a new ability: {name}.',
    'log.abilityRankUp': 'Your {name} has improved to Rank {rank}.',
    'log.stopFollowing': 'You stop following.',
    'log.noOneToFollow': 'There is no one to follow.',
    'log.stopFollowingCombat': 'You stop following - you are in combat.',
    'log.tooFarToFollow': '{name} is too far away to follow.',
    'log.nowFollowing': 'Now following {name}.',
    'error.notFollowingAnyone': 'You are not following anyone.',
    'error.cantFollowSelf': "You can't follow yourself.",
    'error.cantFollowInCombat': "You can't start following while in combat.",
    'error.targetToFollow': 'Target a player to follow, or use /follow <name>.',
    'presence.noLongerAfk': 'You are no longer Away From Keyboard.',
    'presence.leftDnd': 'You have left Do Not Disturb mode.',
    'presence.nowAfk': 'You are now Away From Keyboard: {message}',
    'presence.nowDnd': 'You are now in Do Not Disturb mode: {message}',
    'presence.noLongerAway': 'You are no longer marked as away.',
    'presence.afkDefault': 'Away From Keyboard',
    'presence.dndDefault': 'Do Not Disturb',
    'log.channelJoined': 'Joined the {channel} channel. Type /{channel} <message> to talk.',
    'log.channelLeft': 'Left the {channel} channel.',
    'error.channelUsage': 'Usage: /{action} <channel>. Channels: {list}.',
    'error.generalAlwaysOn': 'The General channel is always on - just use /general.',
    'error.noSuchChannel': "There is no channel named '{name}'. Channels: {list}.",
    'error.alreadyInChannel': 'You are already in the {channel} channel.',
    'error.notInChannel': 'You are not in the {channel} channel.',
    'error.notInChannelJoin': 'You are not in the {channel} channel. Type /join {channel} first.',
    'log.bossUnleashes': '{name} unleashes {mechanic}!',
    'log.mobChannels': '{name} channels {mechanic}.',
    'aura.tamed': 'Tamed',
    'aura.causticSpores': 'Caustic Spores',
    'aura.elixirBear': 'Might of the Bear',
    'aura.elixirBoar': 'Might of the Boar',
    'aura.elixirVenomfire': 'Vipersear Vigor',
    'aura.elixirSerpent': 'Might of the Serpent',
    'mechanic.warStomp': 'Shuddering Stomp',
    'mechanic.boneCarapace': 'Bone Carapace',
    'mechanic.bansheesWail': 'Keening Wail',
    'mechanic.crushingSweep': 'Crushing Sweep',
    'mechanic.rallyingBanner': 'Rallying Banner',
    'mechanic.tectonicHeave': 'Tectonic Heave',
    'mechanic.seismicStomp': 'Seismic Stomp',
    'mechanic.mountainhide': 'Mountainhide',
    'mechanic.thunderclap': 'Thunderclap',
    'mechanic.stormcall': 'Stormcall',
    'aura.spiderVenom': 'Spider Venom',
    'aura.skullthump': 'Skullthump',
    'aura.blindingPowder': 'Blinding Powder',
    'aura.witheringWail': 'Withering Wail',
    'aura.soulrot': 'Soulrot',
    'aura.mudfinHex': 'Mudfin Hex',
    'aura.miringPounce': 'Miring Pounce',
    'aura.acidSpit': 'Acid Spit',
    'aura.exposedWound': 'Exposed Wound',
    'aura.bogRot': 'Bog Rot',
    'aura.witheringRot': 'Withering Rot',
    'aura.curseOfFrailty': 'Curse of Frailty',
    'aura.weakeningHex': 'Weakening Hex',
    'aura.silencingShriek': 'Silencing Shriek',
    'aura.wailOfTheGrave': 'Wail of the Grave',
    'aura.graveBlight': 'Grave Blight',
    'aura.drainingLitany': 'Draining Litany',
    'aura.spiritSiphon': 'Spirit Siphon',
    'aura.dirgeOfTongues': 'Dirge of Tongues',
    'aura.profaneRune': 'Profane Rune',
    'aura.broodVenom': 'Brood Venom',
    'aura.rendingClaws': 'Rending Claws',
    'aura.smolderingFuse': 'Smoldering Fuse',
    'aura.cinderburn': 'Cinderburn',
    'aura.concussiveBlow': 'Concussive Blow',
    'aura.disarmingSmash': 'Disarming Smash',
    'aura.staticCharge': 'Static Charge',
    'aura.frostbite': 'Winterbite',
    'aura.maddeningWhisper': 'Maddening Whisper',
    'aura.wyrmwardSigil': 'Wyrmward Sigil',
    'aura.soulSiphon': 'Soul Siphon',
    'aura.forgottenWound': 'Forgotten Wound',
    'aura.searingMaw': 'Searing Maw',
    'aura.crackedGuard': 'Cracked Guard',
    'aura.offBalance': 'Off-Balance',
    'aura.numbingChill': 'Numbing Chill',
    'aura.webSnare': 'Web Snare',
    'aura.feedingFrenzy': 'Feeding Frenzy',
    'mechanic.litanyPulse': 'Litany Pulse',
    'mechanic.siltHide': 'Silt Hide',
    'aura.demoralized': 'Demoralized',
    'aura.resurrectionSickness': "The Keeper's Toll",
  },
};

const PET_DICT_EN: Record<PetSimMessageKey, string> = {
  'error.noPet': 'You have no pet.',
  'error.petsNotAllowedInDelves': 'Pets are not allowed inside the delves.',
  'error.petAlreadyAlive': 'Your pet is already alive.',
  'error.permanentPetAbandonFrame': 'Permanent pets can only be abandoned from the pet frame.',
  'error.summonUnavailable': 'That summon is unavailable.',
  'error.huntersAbandonPets': 'Only hunters can abandon pets.',
  'error.petClassesRename': 'Only pet classes can rename pets.',
  'error.petNameInvalid':
    'Pet name must be 2-16 letters/spaces/hyphen/apostrophe and start with a letter.',
  'error.petClassesRevive': 'Only pet classes can revive pets.',
  'error.petClassesCommand': 'Only pet classes can command pets.',
  'error.noLivingPet': 'You have no living pet.',
  'error.petNeedsHostileTarget': 'Your pet needs a hostile target.',
  'error.petTauntNotReady': 'Pet taunt is not ready.',
  'error.petCannotTaunt': 'This pet cannot taunt.',
  'petGrowl.ready': "Your pet's Growl is ready. {autoState}",
  'petGrowl.cooldown': "Your pet's Growl is on cooldown. {autoState} Ready in {seconds}s.",
  'petGrowl.autoOn': 'Auto-taunt is on.',
  'petGrowl.autoOff': 'Auto-taunt is off.',
  'error.huntersFeedPets': 'Only hunters can feed pets.',
  'error.petFoodOnly': 'Your pet can only eat food.',
  'error.petFullHealth': 'Your pet is already at full health.',
  'error.warlocksDemonHeal': 'Only warlocks can channel demon healing.',
  'error.youAreDead': 'You are dead.',
  'error.youAreStunned': 'You are stunned.',
  'error.noLivingDemon': 'You have no living demon.',
  'error.demonFullHealth': 'Your demon is already at full health.',
  'log.petFadesVoid': '{name} fades back into the void.',
  'log.petAnswersSummons': '{name} answers your summons.',
  'log.abandonPet': 'You abandon {name}.',
  'log.petRenamed': 'Your pet is now named {name}.',
  'log.petReturns': '{name} returns to your side.',
  'log.petRestoreLost': '{name} could not be restored and has been lost.',
  'log.petRestoreLostNoName': 'Your pet could not be restored and has been lost.',
  'log.feedPet': 'You feed {name}.',
  'log.demonHealChannel': 'You channel healing into {name}.',
  'log.petMode': '{name} is now {mode}.',
  'petMode.passive': 'passive',
  'petMode.defensive': 'defensive',
  'petMode.aggressive': 'aggressive',
  'aura.summoned': 'Summoned',
  'aura.fed': 'Fed',
};

const PET_DICT_ES: Record<PetSimMessageKey, string> = {
  'error.noPet': 'No tienes una mascota.',
  'error.petsNotAllowedInDelves': 'No se permiten mascotas dentro de las expediciones.',
  'error.petAlreadyAlive': 'Tu mascota ya está viva.',
  'error.permanentPetAbandonFrame':
    'Las mascotas permanentes solo se pueden abandonar desde el marco de mascota.',
  'error.summonUnavailable': 'Esa invocación no está disponible.',
  'error.huntersAbandonPets': 'Solo los cazadores pueden abandonar mascotas.',
  'error.petClassesRename': 'Solo las clases con mascota pueden renombrar mascotas.',
  'error.petNameInvalid':
    'El nombre de mascota debe tener 2-16 letras, espacios, guiones o apóstrofos, y empezar con una letra.',
  'error.petClassesRevive': 'Solo las clases con mascota pueden revivir mascotas.',
  'error.petClassesCommand': 'Solo las clases con mascota pueden dar órdenes a mascotas.',
  'error.noLivingPet': 'No tienes una mascota viva.',
  'error.petNeedsHostileTarget': 'Tu mascota necesita un objetivo hostil.',
  'error.petTauntNotReady': 'La provocación de mascota no está lista.',
  'error.petCannotTaunt': 'Esta mascota no puede provocar.',
  'petGrowl.ready': 'El Gruñido de tu mascota está listo. {autoState}',
  'petGrowl.cooldown':
    'El Gruñido de tu mascota está en reutilización. {autoState} Listo en {seconds}s.',
  'petGrowl.autoOn': 'Provocación automática activada.',
  'petGrowl.autoOff': 'Provocación automática desactivada.',
  'error.huntersFeedPets': 'Solo los cazadores pueden alimentar mascotas.',
  'error.petFoodOnly': 'Tu mascota solo puede comer comida.',
  'error.petFullHealth': 'Tu mascota ya tiene la salud al máximo.',
  'error.warlocksDemonHeal': 'Solo los brujos pueden canalizar sanación demoníaca.',
  'error.youAreDead': 'Estás muerto.',
  'error.youAreStunned': 'Estás aturdido.',
  'error.noLivingDemon': 'No tienes un demonio vivo.',
  'error.demonFullHealth': 'Tu demonio ya tiene la salud al máximo.',
  'log.petFadesVoid': '{name} se desvanece de vuelta en el vacío.',
  'log.petAnswersSummons': '{name} responde a tu invocación.',
  'log.abandonPet': 'Abandonas a {name}.',
  'log.petRenamed': 'Tu mascota ahora se llama {name}.',
  'log.petReturns': '{name} vuelve a tu lado.',
  'log.petRestoreLost': '{name} no pudo ser restaurado y se ha perdido.',
  'log.petRestoreLostNoName': 'Tu mascota no pudo ser restaurada y se ha perdido.',
  'log.feedPet': 'Alimentas a {name}.',
  'log.demonHealChannel': 'Canalizas sanación hacia {name}.',
  'log.petMode': '{name} ahora está en modo {mode}.',
  'petMode.passive': 'pasivo',
  'petMode.defensive': 'defensivo',
  'petMode.aggressive': 'agresivo',
  'aura.summoned': 'Invocado',
  'aura.fed': 'Alimentado',
};

const PET_DICT_FR: Record<PetSimMessageKey, string> = {
  'error.noPet': "Vous n'avez pas de familier.",
  'error.petsNotAllowedInDelves': 'Les familiers ne sont pas autorisés dans les plongées.',
  'error.petAlreadyAlive': 'Votre familier est déjà en vie.',
  'error.permanentPetAbandonFrame':
    'Les familiers permanents ne peuvent être abandonnés que depuis le cadre du familier.',
  'error.summonUnavailable': "Cette invocation n'est pas disponible.",
  'error.huntersAbandonPets': 'Seuls les chasseurs peuvent abandonner des familiers.',
  'error.petClassesRename': 'Seules les classes à familier peuvent renommer des familiers.',
  'error.petNameInvalid':
    "Le nom du familier doit contenir 2 à 16 lettres, espaces, traits d'union ou apostrophes, et commencer par une lettre.",
  'error.petClassesRevive': 'Seules les classes à familier peuvent ranimer des familiers.',
  'error.petClassesCommand': 'Seules les classes à familier peuvent commander des familiers.',
  'error.noLivingPet': "Vous n'avez pas de familier vivant.",
  'error.petNeedsHostileTarget': "Votre familier a besoin d'une cible hostile.",
  'error.petTauntNotReady': "La provocation du familier n'est pas prête.",
  'error.petCannotTaunt': 'Ce familier ne peut pas provoquer.',
  'petGrowl.ready': 'Le Grondement de votre familier est prêt. {autoState}',
  'petGrowl.cooldown':
    'Le Grondement de votre familier est en recharge. {autoState} Prêt dans {seconds}s.',
  'petGrowl.autoOn': 'Provocation automatique activée.',
  'petGrowl.autoOff': 'Provocation automatique désactivée.',
  'error.huntersFeedPets': 'Seuls les chasseurs peuvent nourrir des familiers.',
  'error.petFoodOnly': 'Votre familier ne peut manger que de la nourriture.',
  'error.petFullHealth': 'Votre familier a déjà tous ses points de vie.',
  'error.warlocksDemonHeal': 'Seuls les démonistes peuvent canaliser une guérison démoniaque.',
  'error.youAreDead': 'Vous êtes mort.',
  'error.youAreStunned': 'Vous êtes étourdi.',
  'error.noLivingDemon': "Vous n'avez pas de démon vivant.",
  'error.demonFullHealth': 'Votre démon a déjà tous ses points de vie.',
  'log.petFadesVoid': '{name} se dissipe dans le Néant.',
  'log.petAnswersSummons': '{name} répond à votre invocation.',
  'log.abandonPet': 'Vous abandonnez {name}.',
  'log.petRenamed': "Votre familier s'appelle désormais {name}.",
  'log.petReturns': '{name} revient à vos côtés.',
  'log.petRestoreLost': "{name} n'a pas pu être restauré et a été perdu.",
  'log.petRestoreLostNoName': "Votre familier n'a pas pu être restauré et a été perdu.",
  'log.feedPet': 'Vous nourrissez {name}.',
  'log.demonHealChannel': 'Vous canalisez des soins vers {name}.',
  'log.petMode': '{name} est maintenant en mode {mode}.',
  'petMode.passive': 'passif',
  'petMode.defensive': 'défensif',
  'petMode.aggressive': 'agressif',
  'aura.summoned': 'Invoqué',
  'aura.fed': 'Nourri',
};

const PET_DICT_IT: Record<PetSimMessageKey, string> = {
  'error.noPet': 'Non hai una mascotte.',
  'error.petsNotAllowedInDelves': 'Le mascotte non sono ammesse nelle incursioni.',
  'error.petAlreadyAlive': 'La tua mascotte è già viva.',
  'error.permanentPetAbandonFrame':
    'Le mascotte permanenti possono essere abbandonate solo dal riquadro della mascotte.',
  'error.summonUnavailable': 'Quella evocazione non è disponibile.',
  'error.huntersAbandonPets': 'Solo i cacciatori possono abbandonare mascotte.',
  'error.petClassesRename': 'Solo le classi con mascotte possono rinominare mascotte.',
  'error.petNameInvalid':
    'Il nome della mascotte deve avere 2-16 lettere, spazi, trattini o apostrofi e iniziare con una lettera.',
  'error.petClassesRevive': 'Solo le classi con mascotte possono rianimare mascotte.',
  'error.petClassesCommand': 'Solo le classi con mascotte possono comandare mascotte.',
  'error.noLivingPet': 'Non hai una mascotte viva.',
  'error.petNeedsHostileTarget': 'La tua mascotte ha bisogno di un bersaglio ostile.',
  'error.petTauntNotReady': 'La provocazione della mascotte non è pronta.',
  'error.petCannotTaunt': 'Questa mascotte non può provocare.',
  'petGrowl.ready': 'Il Ringhio della tua mascotte è pronto. {autoState}',
  'petGrowl.cooldown':
    'Il Ringhio della tua mascotte è in recupero. {autoState} Pronto tra {seconds}s.',
  'petGrowl.autoOn': 'Provocazione automatica attiva.',
  'petGrowl.autoOff': 'Provocazione automatica disattiva.',
  'error.huntersFeedPets': 'Solo i cacciatori possono nutrire mascotte.',
  'error.petFoodOnly': 'La tua mascotte può mangiare solo cibo.',
  'error.petFullHealth': 'La tua mascotte ha già la salute al massimo.',
  'error.warlocksDemonHeal': 'Solo gli stregoni possono canalizzare cure demoniache.',
  'error.youAreDead': 'Sei morto.',
  'error.youAreStunned': 'Sei stordito.',
  'error.noLivingDemon': 'Non hai un demone vivo.',
  'error.demonFullHealth': 'Il tuo demone ha già la salute al massimo.',
  'log.petFadesVoid': '{name} svanisce di nuovo nel vuoto.',
  'log.petAnswersSummons': '{name} risponde alla tua evocazione.',
  'log.abandonPet': 'Abbandoni {name}.',
  'log.petRenamed': 'La tua mascotte ora si chiama {name}.',
  'log.petReturns': '{name} torna al tuo fianco.',
  'log.petRestoreLost': '{name} non è stato possibile ripristinarlo ed è andato perso.',
  'log.petRestoreLostNoName':
    'Non è stato possibile ripristinare la tua mascotte ed è andata persa.',
  'log.feedPet': 'Nutri {name}.',
  'log.demonHealChannel': 'Canalizzi cure verso {name}.',
  'log.petMode': '{name} è ora in modalità {mode}.',
  'petMode.passive': 'passiva',
  'petMode.defensive': 'difensiva',
  'petMode.aggressive': 'aggressiva',
  'aura.summoned': 'Evocato',
  'aura.fed': 'Nutrito',
};

const PET_DICT_DE: Record<PetSimMessageKey, string> = {
  'error.noPet': 'Du hast kein Begleittier.',
  'error.petsNotAllowedInDelves': 'Begleittiere sind in Tiefgängen nicht erlaubt.',
  'error.petAlreadyAlive': 'Dein Begleittier lebt bereits.',
  'error.permanentPetAbandonFrame':
    'Dauerhafte Begleiter können nur über das Begleiterfenster aufgegeben werden.',
  'error.summonUnavailable': 'Diese Beschwörung ist nicht verfügbar.',
  'error.huntersAbandonPets': 'Nur Jäger können Begleiter aufgeben.',
  'error.petClassesRename': 'Nur Begleiterklassen können Begleiter umbenennen.',
  'error.petNameInvalid':
    'Der Begleitername muss 2-16 Buchstaben, Leerzeichen, Bindestriche oder Apostrophe enthalten und mit einem Buchstaben beginnen.',
  'error.petClassesRevive': 'Nur Begleiterklassen können Begleiter wiederbeleben.',
  'error.petClassesCommand': 'Nur Begleiterklassen können Begleiter befehligen.',
  'error.noLivingPet': 'Du hast kein lebendes Begleittier.',
  'error.petNeedsHostileTarget': 'Dein Begleiter braucht ein feindliches Ziel.',
  'error.petTauntNotReady': 'Der Begleiterspott ist noch nicht bereit.',
  'error.petCannotTaunt': 'Dieser Begleiter kann nicht spotten.',
  'petGrowl.ready': 'Knurren deines Begleiters ist bereit. {autoState}',
  'petGrowl.cooldown':
    'Knurren deines Begleiters hat Abklingzeit. {autoState} Bereit in {seconds}s.',
  'petGrowl.autoOn': 'Automatischer Spott ist aktiviert.',
  'petGrowl.autoOff': 'Automatischer Spott ist deaktiviert.',
  'error.huntersFeedPets': 'Nur Jäger können Begleiter füttern.',
  'error.petFoodOnly': 'Dein Begleiter kann nur Nahrung fressen.',
  'error.petFullHealth': 'Dein Begleiter hat bereits volle Gesundheit.',
  'error.warlocksDemonHeal': 'Nur Hexenmeister können Dämonenheilung kanalisieren.',
  'error.youAreDead': 'Du bist tot.',
  'error.youAreStunned': 'Du bist betäubt.',
  'error.noLivingDemon': 'Du hast keinen lebenden Dämon.',
  'error.demonFullHealth': 'Dein Dämon hat bereits volle Gesundheit.',
  'log.petFadesVoid': '{name} verschwindet zurück in die Leere.',
  'log.petAnswersSummons': '{name} folgt deiner Beschwörung.',
  'log.abandonPet': 'Du gibst {name} auf.',
  'log.petRenamed': 'Dein Begleiter heißt nun {name}.',
  'log.petReturns': '{name} kehrt an deine Seite zurück.',
  'log.petRestoreLost': '{name} konnte nicht wiederhergestellt werden und ist verloren.',
  'log.petRestoreLostNoName':
    'Dein Begleiter konnte nicht wiederhergestellt werden und ist verloren.',
  'log.feedPet': 'Du fütterst {name}.',
  'log.demonHealChannel': 'Du kanalisierst Heilung in {name}.',
  'log.petMode': '{name} ist jetzt {mode}.',
  'petMode.passive': 'passiv',
  'petMode.defensive': 'defensiv',
  'petMode.aggressive': 'aggressiv',
  'aura.summoned': 'Beschworen',
  'aura.fed': 'Gefüttert',
};

const PET_DICT_ZH_CN: Record<PetSimMessageKey, string> = {
  'error.noPet': '你没有宠物。',
  'error.petsNotAllowedInDelves': '探秘中不允许携带宠物。',
  'error.petAlreadyAlive': '你的宠物已经活着。',
  'error.permanentPetAbandonFrame': '永久宠物只能从宠物框架中放弃。',
  'error.summonUnavailable': '该召唤不可用。',
  'error.huntersAbandonPets': '只有猎人可以放弃宠物。',
  'error.petClassesRename': '只有宠物职业可以重命名宠物。',
  'error.petNameInvalid': '宠物名称必须为 2-16 个字母、空格、连字符或撇号，并以字母开头。',
  'error.petClassesRevive': '只有宠物职业可以复活宠物。',
  'error.petClassesCommand': '只有宠物职业可以命令宠物。',
  'error.noLivingPet': '你没有活着的宠物。',
  'error.petNeedsHostileTarget': '你的宠物需要一个敌对目标。',
  'error.petTauntNotReady': '宠物嘲讽尚未就绪。',
  'error.petCannotTaunt': '该宠物无法嘲讽。',
  'petGrowl.ready': '宠物低吼已就绪。{autoState}',
  'petGrowl.cooldown': '宠物低吼正在冷却。{autoState} {seconds}s 后就绪。',
  'petGrowl.autoOn': '自动嘲讽已开启。',
  'petGrowl.autoOff': '自动嘲讽已关闭。',
  'error.huntersFeedPets': '只有猎人可以喂养宠物。',
  'error.petFoodOnly': '你的宠物只能吃食物。',
  'error.petFullHealth': '你的宠物生命值已满。',
  'error.warlocksDemonHeal': '只有术士可以引导恶魔治疗。',
  'error.youAreDead': '你已经死亡。',
  'error.youAreStunned': '你被击晕了。',
  'error.noLivingDemon': '你没有活着的恶魔。',
  'error.demonFullHealth': '你的恶魔生命值已满。',
  'log.petFadesVoid': '{name} 消散回虚空。',
  'log.petAnswersSummons': '{name} 回应了你的召唤。',
  'log.abandonPet': '你放弃了 {name}。',
  'log.petRenamed': '你的宠物现在名为 {name}。',
  'log.petReturns': '{name} 回到你身边。',
  'log.petRestoreLost': '无法恢复{name}，它已永远消失。',
  'log.petRestoreLostNoName': '无法恢复你的宠物，它已永远消失。',
  'log.feedPet': '你喂养了 {name}。',
  'log.demonHealChannel': '你向 {name} 引导治疗。',
  'log.petMode': '{name} 现在处于{mode}模式。',
  'petMode.passive': '被动',
  'petMode.defensive': '防御',
  'petMode.aggressive': '攻击',
  'aura.summoned': '已召唤',
  'aura.fed': '已喂养',
};

const PET_DICT_ZH_TW: Record<PetSimMessageKey, string> = {
  'error.noPet': '你沒有寵物。',
  'error.petsNotAllowedInDelves': '秘探中不允許攜帶寵物。',
  'error.petAlreadyAlive': '你的寵物已經活著。',
  'error.permanentPetAbandonFrame': '永久寵物只能從寵物框架中放棄。',
  'error.summonUnavailable': '該召喚不可用。',
  'error.huntersAbandonPets': '只有獵人可以放棄寵物。',
  'error.petClassesRename': '只有寵物職業可以重新命名寵物。',
  'error.petNameInvalid': '寵物名稱必須為 2-16 個字母、空格、連字號或撇號，並以字母開頭。',
  'error.petClassesRevive': '只有寵物職業可以復活寵物。',
  'error.petClassesCommand': '只有寵物職業可以命令寵物。',
  'error.noLivingPet': '你沒有活著的寵物。',
  'error.petNeedsHostileTarget': '你的寵物需要一個敵對目標。',
  'error.petTauntNotReady': '寵物嘲諷尚未就緒。',
  'error.petCannotTaunt': '該寵物無法嘲諷。',
  'petGrowl.ready': '寵物低吼已就緒。{autoState}',
  'petGrowl.cooldown': '寵物低吼正在冷卻。{autoState} {seconds}s 後就緒。',
  'petGrowl.autoOn': '自動嘲諷已開啟。',
  'petGrowl.autoOff': '自動嘲諷已關閉。',
  'error.huntersFeedPets': '只有獵人可以餵養寵物。',
  'error.petFoodOnly': '你的寵物只能吃食物。',
  'error.petFullHealth': '你的寵物生命值已滿。',
  'error.warlocksDemonHeal': '只有術士可以引導惡魔治療。',
  'error.youAreDead': '你已經死亡。',
  'error.youAreStunned': '你被擊暈了。',
  'error.noLivingDemon': '你沒有活著的惡魔。',
  'error.demonFullHealth': '你的惡魔生命值已滿。',
  'log.petFadesVoid': '{name} 消散回虛空。',
  'log.petAnswersSummons': '{name} 回應了你的召喚。',
  'log.abandonPet': '你放棄了 {name}。',
  'log.petRenamed': '你的寵物現在名為 {name}。',
  'log.petReturns': '{name} 回到你身邊。',
  'log.petRestoreLost': '無法恢復{name}，牠已永遠消失。',
  'log.petRestoreLostNoName': '無法恢復你的寵物，牠已永遠消失。',
  'log.feedPet': '你餵養了 {name}。',
  'log.demonHealChannel': '你向 {name} 引導治療。',
  'log.petMode': '{name} 現在處於{mode}模式。',
  'petMode.passive': '被動',
  'petMode.defensive': '防禦',
  'petMode.aggressive': '攻擊',
  'aura.summoned': '已召喚',
  'aura.fed': '已餵養',
};

const PET_DICT_KO: Record<PetSimMessageKey, string> = {
  'error.noPet': '소환수가 없습니다.',
  'error.petsNotAllowedInDelves': '탐굴 안에서는 펫을 데려갈 수 없습니다.',
  'error.petAlreadyAlive': '소환수가 이미 살아 있습니다.',
  'error.permanentPetAbandonFrame': '영구 소환수는 소환수 창에서만 포기할 수 있습니다.',
  'error.summonUnavailable': '그 소환은 사용할 수 없습니다.',
  'error.huntersAbandonPets': '사냥꾼만 소환수를 포기할 수 있습니다.',
  'error.petClassesRename': '소환수 직업만 소환수 이름을 바꿀 수 있습니다.',
  'error.petNameInvalid':
    '소환수 이름은 2-16자의 문자, 공백, 하이픈 또는 아포스트로피여야 하며 문자로 시작해야 합니다.',
  'error.petClassesRevive': '소환수 직업만 소환수를 되살릴 수 있습니다.',
  'error.petClassesCommand': '소환수 직업만 소환수에게 명령할 수 있습니다.',
  'error.noLivingPet': '살아 있는 소환수가 없습니다.',
  'error.petNeedsHostileTarget': '소환수에게 적대적인 대상이 필요합니다.',
  'error.petTauntNotReady': '소환수 도발이 아직 준비되지 않았습니다.',
  'error.petCannotTaunt': '이 소환수는 도발할 수 없습니다.',
  'petGrowl.ready': '소환수의 포효가 준비되었습니다. {autoState}',
  'petGrowl.cooldown':
    '소환수의 포효가 재사용 대기 중입니다. {autoState} {seconds}s 후 준비됩니다.',
  'petGrowl.autoOn': '자동 도발이 켜졌습니다.',
  'petGrowl.autoOff': '자동 도발이 꺼졌습니다.',
  'error.huntersFeedPets': '사냥꾼만 소환수에게 먹이를 줄 수 있습니다.',
  'error.petFoodOnly': '소환수는 음식만 먹을 수 있습니다.',
  'error.petFullHealth': '소환수의 생명력이 이미 가득 찼습니다.',
  'error.warlocksDemonHeal': '흑마법사만 악마 치유를 정신집중할 수 있습니다.',
  'error.youAreDead': '당신은 죽었습니다.',
  'error.youAreStunned': '당신은 기절했습니다.',
  'error.noLivingDemon': '살아 있는 악마가 없습니다.',
  'error.demonFullHealth': '악마의 생명력이 이미 가득 찼습니다.',
  'log.petFadesVoid': '{name}이(가) 다시 공허 속으로 사라집니다.',
  'log.petAnswersSummons': '{name}이(가) 당신의 소환에 응답합니다.',
  'log.abandonPet': '{name}을(를) 포기합니다.',
  'log.petRenamed': '소환수의 이름이 {name}(으)로 바뀌었습니다.',
  'log.petReturns': '{name}이(가) 당신 곁으로 돌아옵니다.',
  'log.petRestoreLost': '{name}을(를) 되돌릴 수 없어 잃어버렸습니다.',
  'log.petRestoreLostNoName': '소환수를 되돌릴 수 없어 잃어버렸습니다.',
  'log.feedPet': '{name}에게 먹이를 줍니다.',
  'log.demonHealChannel': '{name}에게 치유를 정신집중합니다.',
  'log.petMode': '{name}이(가) 이제 {mode} 상태입니다.',
  'petMode.passive': '수동',
  'petMode.defensive': '방어',
  'petMode.aggressive': '공격',
  'aura.summoned': '소환됨',
  'aura.fed': '먹이를 먹음',
};

const PET_DICT_JA: Record<PetSimMessageKey, string> = {
  'error.noPet': 'ペットがいません。',
  'error.petsNotAllowedInDelves': 'デルヴの中ではペットを連れて行けません。',
  'error.petAlreadyAlive': 'ペットはすでに生きています。',
  'error.permanentPetAbandonFrame': '永続ペットはペットフレームからのみ放棄できます。',
  'error.summonUnavailable': 'その召喚は使用できません。',
  'error.huntersAbandonPets': 'ハンターだけがペットを放棄できます。',
  'error.petClassesRename': 'ペットクラスだけがペットの名前を変更できます。',
  'error.petNameInvalid':
    'ペット名は2-16文字の文字、スペース、ハイフン、アポストロフィで、文字から始める必要があります。',
  'error.petClassesRevive': 'ペットクラスだけがペットを蘇生できます。',
  'error.petClassesCommand': 'ペットクラスだけがペットに命令できます。',
  'error.noLivingPet': '生きているペットがいません。',
  'error.petNeedsHostileTarget': 'ペットには敵対的な対象が必要です。',
  'error.petTauntNotReady': 'ペットの挑発はまだ準備できていません。',
  'error.petCannotTaunt': 'このペットは挑発できません。',
  'petGrowl.ready': 'ペットのグロウルは準備完了です。{autoState}',
  'petGrowl.cooldown': 'ペットのグロウルはクールダウン中です。{autoState} {seconds}s後に準備完了。',
  'petGrowl.autoOn': '自動挑発はオンです。',
  'petGrowl.autoOff': '自動挑発はオフです。',
  'error.huntersFeedPets': 'ハンターだけがペットに餌を与えられます。',
  'error.petFoodOnly': 'ペットは食べ物だけを食べられます。',
  'error.petFullHealth': 'ペットの体力はすでに最大です。',
  'error.warlocksDemonHeal': 'ウォーロックだけが悪魔の治癒をチャネルできます。',
  'error.youAreDead': 'あなたは死亡しています。',
  'error.youAreStunned': 'あなたはスタンしています。',
  'error.noLivingDemon': '生きている悪魔がいません。',
  'error.demonFullHealth': '悪魔の体力はすでに最大です。',
  'log.petFadesVoid': '{name}は虚空へ戻って消えます。',
  'log.petAnswersSummons': '{name}が召喚に応じます。',
  'log.abandonPet': '{name}を放棄しました。',
  'log.petRenamed': 'ペットの名前は{name}になりました。',
  'log.petReturns': '{name}があなたのそばに戻ります。',
  'log.petRestoreLost': '{name}を復元できず、失われました。',
  'log.petRestoreLostNoName': 'ペットを復元できず、失われました。',
  'log.feedPet': '{name}に餌を与えます。',
  'log.demonHealChannel': '{name}へ治癒をチャネルします。',
  'log.petMode': '{name}は現在{mode}です。',
  'petMode.passive': '受動',
  'petMode.defensive': '防御',
  'petMode.aggressive': '攻撃',
  'aura.summoned': '召喚済み',
  'aura.fed': '給餌済み',
};

const PET_DICT_PT: Record<PetSimMessageKey, string> = {
  'error.noPet': 'Você não tem mascote.',
  'error.petsNotAllowedInDelves': 'Mascotes não são permitidos dentro das incursões.',
  'error.petAlreadyAlive': 'Seu mascote já está vivo.',
  'error.permanentPetAbandonFrame':
    'Mascotes permanentes só podem ser abandonados pela moldura do mascote.',
  'error.summonUnavailable': 'Essa invocação não está disponível.',
  'error.huntersAbandonPets': 'Somente caçadores podem abandonar mascotes.',
  'error.petClassesRename': 'Somente classes com mascote podem renomear mascotes.',
  'error.petNameInvalid':
    'O nome do mascote deve ter 2-16 letras, espaços, hífens ou apóstrofos e começar com uma letra.',
  'error.petClassesRevive': 'Somente classes com mascote podem reviver mascotes.',
  'error.petClassesCommand': 'Somente classes com mascote podem comandar mascotes.',
  'error.noLivingPet': 'Você não tem um mascote vivo.',
  'error.petNeedsHostileTarget': 'Seu mascote precisa de um alvo hostil.',
  'error.petTauntNotReady': 'A provocação do mascote não está pronta.',
  'error.petCannotTaunt': 'Este mascote não pode provocar.',
  'petGrowl.ready': 'O Rosnar do seu mascote está pronto. {autoState}',
  'petGrowl.cooldown': 'O Rosnar do seu mascote está em recarga. {autoState} Pronto em {seconds}s.',
  'petGrowl.autoOn': 'Provocação automática ativada.',
  'petGrowl.autoOff': 'Provocação automática desativada.',
  'error.huntersFeedPets': 'Somente caçadores podem alimentar mascotes.',
  'error.petFoodOnly': 'Seu mascote só pode comer comida.',
  'error.petFullHealth': 'Seu mascote já está com a vida cheia.',
  'error.warlocksDemonHeal': 'Somente bruxos podem canalizar cura demoníaca.',
  'error.youAreDead': 'Você está morto.',
  'error.youAreStunned': 'Você está atordoado.',
  'error.noLivingDemon': 'Você não tem um demônio vivo.',
  'error.demonFullHealth': 'Seu demônio já está com a vida cheia.',
  'log.petFadesVoid': '{name} desaparece de volta no vazio.',
  'log.petAnswersSummons': '{name} responde à sua invocação.',
  'log.abandonPet': 'Você abandona {name}.',
  'log.petRenamed': 'Seu mascote agora se chama {name}.',
  'log.petReturns': '{name} volta para o seu lado.',
  'log.petRestoreLost': '{name} não pôde ser restaurado e foi perdido.',
  'log.petRestoreLostNoName': 'Seu mascote não pôde ser restaurado e foi perdido.',
  'log.feedPet': 'Você alimenta {name}.',
  'log.demonHealChannel': 'Você canaliza cura em {name}.',
  'log.petMode': '{name} agora está no modo {mode}.',
  'petMode.passive': 'passivo',
  'petMode.defensive': 'defensivo',
  'petMode.aggressive': 'agressivo',
  'aura.summoned': 'Invocado',
  'aura.fed': 'Alimentado',
};

const PET_DICT_RU: Record<PetSimMessageKey, string> = {
  'error.noPet': 'У вас нет питомца.',
  'error.petsNotAllowedInDelves': 'Питомцы не допускаются внутрь вылазок.',
  'error.petAlreadyAlive': 'Ваш питомец уже жив.',
  'error.permanentPetAbandonFrame':
    'Постоянных питомцев можно оставить только через рамку питомца.',
  'error.summonUnavailable': 'Этот призыв недоступен.',
  'error.huntersAbandonPets': 'Только охотники могут оставлять питомцев.',
  'error.petClassesRename': 'Только классы с питомцами могут переименовывать питомцев.',
  'error.petNameInvalid':
    'Имя питомца должно содержать 2-16 букв, пробелов, дефисов или апострофов и начинаться с буквы.',
  'error.petClassesRevive': 'Только классы с питомцами могут воскрешать питомцев.',
  'error.petClassesCommand': 'Только классы с питомцами могут отдавать приказы питомцам.',
  'error.noLivingPet': 'У вас нет живого питомца.',
  'error.petNeedsHostileTarget': 'Вашему питомцу нужна враждебная цель.',
  'error.petTauntNotReady': 'Провокация питомца ещё не готова.',
  'error.petCannotTaunt': 'Этот питомец не может провоцировать.',
  'petGrowl.ready': 'Рык вашего питомца готов. {autoState}',
  'petGrowl.cooldown': 'Рык вашего питомца восстанавливается. {autoState} Готово через {seconds}с.',
  'petGrowl.autoOn': 'Автопровокация включена.',
  'petGrowl.autoOff': 'Автопровокация выключена.',
  'error.huntersFeedPets': 'Только охотники могут кормить питомцев.',
  'error.petFoodOnly': 'Ваш питомец может есть только пищу.',
  'error.petFullHealth': 'У вашего питомца уже полное здоровье.',
  'error.warlocksDemonHeal': 'Только чернокнижники могут направлять исцеление демона.',
  'error.youAreDead': 'Вы мертвы.',
  'error.youAreStunned': 'Вы оглушены.',
  'error.noLivingDemon': 'У вас нет живого демона.',
  'error.demonFullHealth': 'У вашего демона уже полное здоровье.',
  'log.petFadesVoid': '{name} растворяется обратно в Бездне.',
  'log.petAnswersSummons': '{name} откликается на ваш призыв.',
  'log.abandonPet': 'Вы оставляете {name}.',
  'log.petRenamed': 'Теперь вашего питомца зовут {name}.',
  'log.petReturns': '{name} возвращается к вам.',
  'log.petRestoreLost': '{name} не удалось восстановить, питомец потерян.',
  'log.petRestoreLostNoName': 'Вашего питомца не удалось восстановить, он потерян.',
  'log.feedPet': 'Вы кормите {name}.',
  'log.demonHealChannel': 'Вы направляете исцеление в {name}.',
  'log.petMode': '{name} теперь в режиме {mode}.',
  'petMode.passive': 'пассивный',
  'petMode.defensive': 'защитный',
  'petMode.aggressive': 'агрессивный',
  'aura.summoned': 'Призван',
  'aura.fed': 'Накормлен',
};

const PET_DICT: Record<SupportedLanguage, Record<PetSimMessageKey, string>> = {
  en: PET_DICT_EN,
};

export const DICT: Record<SupportedLanguage, Record<SimMessageKey, string>> = Object.fromEntries(
  supportedLanguages.map((lang) => [
    lang,
    { ...baseEnTable, ...BASE_DICT[lang], ...PET_DICT[lang] },
  ]),
) as Record<SupportedLanguage, Record<SimMessageKey, string>>;

function interpolate(template: string, params?: InterpolationValues): string {
  if (!params) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (m, name: string) => {
    const v = params[name];
    return v === undefined ? m : String(v);
  });
}

export function tSim(
  key: SimMessageKey,
  params?: InterpolationValues,
  lang: SupportedLanguage = getLanguage(),
): string {
  const table = DICT[lang] ?? DICT.en;
  const tmpl = table[key] ?? DICT.en[key];
  return interpolate(tmpl, params);
}

// Reverse maps: the sim splices English item/mob names into its text; localize them.
const itemNameToId = new Map<string, string>();
for (const [id, it] of Object.entries(ITEMS)) itemNameToId.set(it.name, it.heroicOf ?? id);
const mobNameToId = new Map<string, string>();
for (const [id, m] of Object.entries(MOBS)) mobNameToId.set(m.name, id);
const abilityNameToId = new Map<string, string>();
for (const [id, a] of Object.entries(ABILITIES)) abilityNameToId.set(a.name, id);
const delveNameToId = new Map<string, string>();
for (const [id, d] of Object.entries(DELVES)) delveNameToId.set(d.name, id);
// Module display names are also the delveUi.moduleName.* source values; reverse
// them so the sim's English module-name splices localize like the run tracker.
const delveModuleNameToId = new Map<string, string>();
for (const [id, name] of Object.entries(DELVE_MODULE_NAMES)) delveModuleNameToId.set(name, id);

function locItem(name: string): string {
  const id = itemNameToId.get(name);
  return id ? tEntity({ kind: 'item', id, field: 'name' }) : name;
}
function locMob(name: string): string {
  const id = mobNameToId.get(name);
  return id ? tEntity({ kind: 'mob', id, field: 'name' }) : name;
}
function locAbility(name: string): string {
  const id = abilityNameToId.get(name);
  return id ? tEntity({ kind: 'ability', id, field: 'name' }) : name;
}
function locDelve(name: string): string {
  const id = delveNameToId.get(name);
  return id ? tEntity({ kind: 'delve', id, field: 'name' }) : name;
}
function locDelveModule(name: string): string {
  const id = delveModuleNameToId.get(name);
  return id ? t(`delveUi.moduleName.${id}` as TranslationKey) : name;
}
function locItemStack(name: string, stackSuffix?: string): string {
  const item = locItem(name);
  if (!stackSuffix) return item;
  const count = Number(stackSuffix.trim().slice(1));
  return `${item} ${t('itemUi.bags.stackCount', { count: formatNumber(count, { maximumFractionDigits: 0 }) })}`;
}
function locPetMode(mode: string): string {
  const normalized = mode.toLowerCase();
  if (normalized === 'passive' || normalized === 'defensive' || normalized === 'aggressive') {
    return tSim(`petMode.${normalized}` as PetSimMessageKey);
  }
  return mode;
}
function locPetGrowlAutoState(state: string): string {
  if (state === 'Auto-taunt is on.') return tSim('petGrowl.autoOn');
  if (state === 'Auto-taunt is off.') return tSim('petGrowl.autoOff');
  return state;
}

// Flavor aura names (not abilities, not talents) shown in the buff frame / combat log.
// Includes mob "mechanic" names (War Stomp, etc.) - they surface both as a debuff on the
// player (stun/incapacitate/absorb aura) and as the boss "unleashes" combat-log line, so
// they share a single English source here.
const AURA_NAME_KEY: Record<string, SimMessageKey> = {
  // Bladed Gyre's armed echo buff (whirlwind's selfBuff auraName in
  // src/sim/content/classes.ts); shown on the buff bar and combat log.
  'Bladed Echo': 'aura.bladedEcho',
  // Emboldening Roar's armed guaranteed-crit buff (the aoeAllySureCrit case in
  // src/sim/combat/effect_dispatch.ts); shown on the buff bar and combat log.
  Emboldened: 'aura.emboldened',
  // Fury's Enrage buff (the enrageChance case in src/sim/combat/effect_dispatch.ts),
  // procced by Bloodletting and Red Harvest; shown on the buff bar.
  Enraged: 'aura.enraged',
  Tamed: 'aura.tamed',
  'Temporal Exhaustion': 'aura.temporalExhaustion',
  'Cauterize Fatigue': 'aura.cauterizeFatigue',
  'Might of the Bear': 'aura.elixirBear',
  // Crafted alchemy elixir auras (content/profession_items.ts): the
  // buff_sta aura display name each crafted elixir pushes on use.
  'Might of the Boar': 'aura.elixirBoar',
  'Vipersear Vigor': 'aura.elixirVenomfire',
  // Legacy alias for mixed-fleet deploy windows: a not-yet-restarted server
  // still emits the pre-rename aura string. Drop after v0.29.0 ships.
  'Venomfire Vigor': 'aura.elixirVenomfire',
  'Might of the Serpent': 'aura.elixirSerpent',
  Summoned: 'aura.summoned',
  Fed: 'aura.fed',
  'Caustic Spores': 'aura.causticSpores',
  // Boss / mob mechanics (the {mechanic} in "{mob} unleashes {mechanic}!").
  'Shuddering Stomp': 'mechanic.warStomp',
  Onrush: 'mechanic.charge',
  'Bone Carapace': 'mechanic.boneCarapace',
  'Keening Wail': 'mechanic.bansheesWail',
  'Crushing Sweep': 'mechanic.crushingSweep',
  'Rallying Banner': 'mechanic.rallyingBanner',
  'Final Bell': 'mechanic.finalBell',
  'Blackwater Mark': 'mechanic.blackwaterMark',
  'Tolling Bell': 'mechanic.tollingBell',
  'Litany Pulse': 'mechanic.litanyPulse',
  'Silt Ward': 'mechanic.siltWard',
  'Silt Hide': 'mechanic.siltHide',
  'Sump Stomp': 'mechanic.sumpStomp',
  'Bell Shock': 'mechanic.bellShock',
  'Egg-Sac Burst': 'mechanic.eggSacBurst',
  'Drowned Canticle': 'aura.drownedCanticle',
  'Tectonic Heave': 'mechanic.tectonicHeave',
  'Seismic Stomp': 'mechanic.seismicStomp',
  Mountainhide: 'mechanic.mountainhide',
  Thunderclap: 'mechanic.thunderclap',
  Stormcall: 'mechanic.stormcall',
  'Howling Gale': 'mechanic.howlingGale',
  // On-hit / DoT / debuff flavor auras applied to players (would otherwise leak raw English
  // in the buff/debuff frame and combat log). Data-driven from src/sim/content/zone*.ts.
  'Spider Venom': 'aura.spiderVenom',
  Skullthump: 'aura.skullthump',
  'Blinding Powder': 'aura.blindingPowder',
  'Withering Wail': 'aura.witheringWail',
  Soulrot: 'aura.soulrot',
  'Mudfin Hex': 'aura.mudfinHex',
  'Miring Pounce': 'aura.miringPounce',
  'Acid Spit': 'aura.acidSpit',
  'Exposed Wound': 'aura.exposedWound',
  'Bog Rot': 'aura.bogRot',
  'Withering Rot': 'aura.witheringRot',
  'Curse of Frailty': 'aura.curseOfFrailty',
  'Weakening Hex': 'aura.weakeningHex',
  'Silencing Shriek': 'aura.silencingShriek',
  'Wail of the Grave': 'aura.wailOfTheGrave',
  'Grave Blight': 'aura.graveBlight',
  'Draining Litany': 'aura.drainingLitany',
  'Spirit Siphon': 'aura.spiritSiphon',
  'Dirge of Tongues': 'aura.dirgeOfTongues',
  'Profane Rune': 'aura.profaneRune',
  'Brood Venom': 'aura.broodVenom',
  'Rending Claws': 'aura.rendingClaws',
  'Smoldering Fuse': 'aura.smolderingFuse',
  Cinderburn: 'aura.cinderburn',
  'Concussive Blow': 'aura.concussiveBlow',
  'Disarming Smash': 'aura.disarmingSmash',
  'Static Charge': 'aura.staticCharge',
  Winterbite: 'aura.frostbite',
  'Maddening Whisper': 'aura.maddeningWhisper',
  'Wyrmward Sigil': 'aura.wyrmwardSigil',
  'Soul Siphon': 'aura.soulSiphon',
  'Forgotten Wound': 'aura.forgottenWound',
  'Searing Maw': 'aura.searingMaw',
  'Cracked Guard': 'aura.crackedGuard',
  'Off-Balance': 'aura.offBalance',
  'Numbing Chill': 'aura.numbingChill',
  'Web Snare': 'aura.webSnare',
  'Feeding Frenzy': 'aura.feedingFrenzy',
  Demoralized: 'aura.demoralized',
  'Resurrection Sickness': 'aura.resurrectionSickness',
  'Hot Pursuit': 'aura.hotPursuit',
  'Red Harvest': 'aura.redHarvest',
  'Reckless Vow': 'aura.recklessVow',
  'Red Banner': 'aura.redBanner',
  Colossus: 'aura.colossus',
  // 4-piece set-bonus proc buffs (item_sets.ts): shown in the buff frame.
  Clearcasting: 'aura.clearcasting',
  Gravemight: 'aura.gravemight',
  Fangrush: 'aura.fangrush',
  Bonesplinter: 'aura.bonesplinter',
  'Ragged Gash': 'aura.raggedGash',
  Soulblaze: 'aura.soulblaze',
  // Frost mage proc engine (src/sim/combat/frost_mage.ts): the two self
  // procs and the target debuff; buff bar, target frame and combat log.
  'Fingers of Frost': 'aura.fingersOfFrost',
  'Brain Freeze': 'aura.brainFreeze',
  "Winter's Chill": 'aura.wintersChill',
  Icicles: 'aura.icicles',
  'Perfect Moment': 'aura.perfectMoment',
  // Talent-proc buff/ward names (choice rows).
  'Searing Light': 'aura.searingLight',
  'Lingering Grace': 'aura.lingeringGraceWard',
  Nocturns: 'aura.nocturns',
  'Greater Heal': 'aura.greaterHealEcho',
  'Inner Fire': 'aura.innerFire',
  'Blessed Recovery': 'aura.blessedRecovery',
  'Fault Line': 'aura.faultLine',
  'Thunder Ward': 'aura.thunderWardSurge',
  'Guiding Spirits': 'aura.guidingSpirits',
  'Elemental Warding': 'aura.elementalWarding',
  'Earthen Fury': 'aura.earthenFury',
  'Tidal Waves': 'aura.tidalWaves',
  'Divine Wisdom': 'aura.divineWisdom',
  "Guardian's Favor": 'aura.guardiansFavor',
  'Greater Blessing': 'aura.greaterBlessing',
  'Sacred Ward': 'aura.sacredWard',
  Firestarter: 'aura.firestarter',
  'Mana Attunement': 'aura.manaAttunement',
  'Deep Rime': 'aura.deepRime',
  'Slow Burn': 'aura.slowBurn',
  'Battlemage Armor': 'aura.battlemageArmor',
  'Improved Backstab': 'aura.improvedBackstab',
  'Improved Cutthroat Tempo': 'aura.improvedCutthroatTempo',
  'Final Notice': 'aura.finalNotice',
  'Improved Evasion': 'aura.improvedEvasion',
  Endurance: 'aura.endurance',
  'Master Assassin': 'aura.masterAssassin',
  'Improved Venom Barb': 'aura.improvedVenomBarb',
  'Aspect Mastery': 'aura.aspectMastery',
  'Lean Quiver': 'aura.leanQuiver',
  'Deathless Will': 'aura.deathlessWill',
  'Sniper Training': 'aura.sniperTraining',
  'Master Tamer': 'aura.masterTamer',
  'Calloused Hide': 'aura.callousedHide',
  'Improved Volley': 'aura.improvedVolley',
  'Improved Wildbolt': 'aura.improvedWildbolt',
  Redmaw: 'aura.redmaw',
  "Nature's Bounty": 'aura.naturesBounty',
  Wildsurge: 'aura.wildsurge',
  'Improved Mark': 'aura.improvedMark',
  'Savage Fury': 'aura.savageFury',
  Moonspite: 'aura.moonspite',
  'Empowered Touch': 'aura.empoweredTouch',
  'Improved Barkskin': 'aura.improvedBarkskin',
  'Improved Hurricane': 'aura.improvedHurricane',
  'Improved Immolate': 'aura.improvedImmolate',
  'Demon Armor': 'aura.demonArmor',
  Desolation: 'aura.desolation',
  'Umbral Mastery': 'aura.umbralMastery',
  'Improved Fear': 'aura.improvedFear',
  'Unyielding Pact': 'aura.unyieldingPact',
  'Grimoire of Carnage': 'aura.grimoireOfCarnage',
  'Curse Mastery': 'aura.curseMastery',
};
export function localizeSimAuraName(name: string): string | null {
  const key = AURA_NAME_KEY[name];
  return key ? tSim(key) : null;
}

// A boss/mob "mechanic" name spliced into "{mob} unleashes {mechanic}!". Reuses the shared
// aura localizer (the mechanic names double as the debuff aura names), falling back to the
// raw English name for any mechanic not yet registered.
function locBossMechanic(name: string): string {
  return localizeSimAuraName(name) ?? name;
}

type ArenaExtraKey =
  | 'join2v2'
  | 'leave2v2'
  | 'teamLeave2v2'
  | 'alreadyQueuedOther'
  | 'leaveParty1v1'
  | 'partyLeaderQueue2v2'
  | 'premadeNeedsTwo'
  | 'partyMemberUnavailable'
  | 'memberDead'
  | 'memberInMatch'
  | 'memberQueued'
  | 'memberDueling'
  | 'memberTrading'
  | 'memberInstance';

export const ARENA_EXTRA: Record<SupportedLanguage, Record<ArenaExtraKey, string>> = {
  en: {
    join2v2: 'You join the Ashen Coliseum 2v2 queue. Stand by for opponents...',
    leave2v2: 'You leave the Ashen Coliseum 2v2 queue.',
    teamLeave2v2: 'Your team leaves the Ashen Coliseum 2v2 queue.',
    alreadyQueuedOther:
      'You are already in the {current} queue. Leave it before queueing for {next}.',
    leaveParty1v1: 'Leave your party before queueing for 1v1.',
    partyLeaderQueue2v2: 'Only the party leader may queue your team for 2v2.',
    premadeNeedsTwo: 'A 2v2 premade requires a party of exactly two.',
    partyMemberUnavailable: 'A party member is unavailable.',
    memberDead: '{name} cannot queue while dead.',
    memberInMatch: '{name} is already in an arena match.',
    memberQueued: '{name} is already in the arena queue.',
    memberDueling: '{name} cannot queue while dueling.',
    memberTrading: '{name} must finish trading before queueing.',
    memberInstance: '{name} cannot queue from inside an instance.',
  },
};

function tArenaExtra(key: ArenaExtraKey, params?: InterpolationValues): string {
  const table = ARENA_EXTRA[getLanguage()] ?? ARENA_EXTRA.en;
  return interpolate(table[key] ?? ARENA_EXTRA.en[key], params);
}

type QuestExtraKey =
  | 'ritualNeedsKey'
  | 'aldrenVision1'
  | 'aldrenVision2'
  | 'aldrenVision3'
  | 'malricVision1'
  | 'malricVision2'
  | 'malricVision3'
  | 'vossVision1'
  | 'vossVision2'
  | 'vossVision3'
  | 'vossVision4'
  | 'ritualBreaks'
  | 'cryptSealed'
  | 'awakens'
  | 'aldrenYell'
  | 'malricYell'
  | 'vossYell';

export const QUEST_EXTRA: Record<SupportedLanguage, Record<QuestExtraKey, string>> = {
  en: {
    ritualNeedsKey: 'The ritual circle is silent without the Crypt Keystone.',
    aldrenVision1: 'My king was a good man.',
    aldrenVision2: 'I swore my blade to him.',
    aldrenVision3: 'I would do so again.',
    malricVision1: 'There had to be another way.',
    malricVision2: 'I could not let him die.',
    malricVision3: 'I only wanted to save him.',
    vossVision1: 'The king was already dead.',
    vossVision2: 'Malric refused to accept it.',
    vossVision3: 'We should have let him rest.',
    vossVision4: 'If you find the crypt... end this.',
    ritualBreaks: 'The Crypt Keystone turns cold as the seal breaks.',
    cryptSealed: 'The crypt entrance is sealed to you.',
    awakens: '{name} awakens!',
    aldrenYell: '{name} yells, "None shall disturb the king\'s rest! For Thornpeak!"',
    malricYell: '{name} yells, "Death shall never claim my king! The ritual must endure!"',
    vossYell: '{name} yells, "You will not reach him! The king must endure!"',
  },
};

function tQuestExtra(key: QuestExtraKey, params?: InterpolationValues): string {
  const table = QUEST_EXTRA[getLanguage()] ?? QUEST_EXTRA.en;
  return interpolate(table[key] ?? QUEST_EXTRA.en[key], params);
}

// Item / equipment / world-object interaction strings emitted by src/sim: the
// /gear self-readout frame plus the relic + quest-item pickup error toasts. Like
// QUEST_EXTRA/ARENA_EXTRA these live here (not the DICT) and are matched by the
// RULES below; the gear readout's per-slot LABELS reuse the already-translated
// itemUi.slots.* keys via t(), so only the frame + "(empty)" marker are new here.
type ItemExtraKey =
  | 'gearReadout'
  | 'gearEmptySlot'
  | 'nothingEquipped'
  | 'cannotTakeYet'
  | 'offersNothingMore'
  | 'relicBound'
  | 'relicRecovered';

export const ITEM_EXTRA: Record<SupportedLanguage, Record<ItemExtraKey, string>> = {
  en: {
    gearReadout: 'Equipped ({worn}/{total}): {items}.',
    gearEmptySlot: '(empty)',
    nothingEquipped: 'You have nothing equipped.',
    cannotTakeYet: 'You cannot take the {name} yet.',
    offersNothingMore: '{name} offers nothing more.',
    relicBound: 'The relic is bound by the sealed crypt.',
    relicRecovered: 'You have already recovered this relic.',
  },
};

function tItemExtra(key: ItemExtraKey, params?: InterpolationValues): string {
  const table = ITEM_EXTRA[getLanguage()] ?? ITEM_EXTRA.en;
  return interpolate(table[key] ?? ITEM_EXTRA.en[key], params);
}

type RaidExtraKey =
  | 'converted'
  | 'memberMoved'
  | 'needFullParty'
  | 'leaderConvert'
  | 'alreadyRaid'
  | 'notInRaid'
  | 'leaderAdjust'
  | 'groupFull'
  | 'yourRaidFull'
  | 'thatRaidFull'
  | 'noDuelArena'
  | 'noStandardDungeons'
  | 'mustConvert'
  | 'royalDoorSealed'
  | 'locked'
  | 'engagedSealed'
  | 'mustFall';

export const RAID_EXTRA: Record<SupportedLanguage, Record<RaidExtraKey, string>> = {
  en: {
    converted: 'Your party has converted to a raid group.',
    memberMoved: '{name} has been moved to raid group {group}.',
    needFullParty: 'You need a full party of five before converting to raid.',
    leaderConvert: 'Only the party leader may convert to raid.',
    alreadyRaid: 'Your group is already a raid.',
    notInRaid: 'You are not in a raid group.',
    leaderAdjust: 'Only the raid leader may adjust groups.',
    groupFull: 'Raid group {group} is full.',
    yourRaidFull: 'Your raid is full.',
    thatRaidFull: 'That raid is full.',
    noDuelArena: 'You cannot duel in Nythraxis Raid Arena.',
    noStandardDungeons: 'Raid groups cannot enter standard dungeons.',
    mustConvert: 'You must convert your party to a raid group first.',
    royalDoorSealed: 'The royal door is sealed to you.',
    locked: 'You are locked to Nythraxis Raid Arena.',
    engagedSealed: 'Nythraxis is engaged - the royal door has sealed shut.',
    mustFall: 'The royal door is sealed - Nythraxis must fall first.',
  },
};

function tRaidExtra(key: RaidExtraKey, params?: InterpolationValues): string {
  const table = RAID_EXTRA[getLanguage()] ?? RAID_EXTRA.en;
  return interpolate(table[key] ?? RAID_EXTRA.en[key], params);
}

// The /gear readout's English slot labels -> the already-translated itemUi.slots.*
// keys the character-window paperdoll renders. Keep in sync with gearReadout() in
// src/sim/sim.ts (the slot order/labels it emits).
const GEAR_SLOT_KEYS: Record<string, TranslationKey> = {
  'Main Hand': 'itemUi.slots.mainhand',
  'Off Hand': 'itemUi.slots.offhand',
  Helmet: 'itemUi.slots.helmet',
  Face: 'itemUi.slots.face',
  Back: 'itemUi.slots.back',
  Chest: 'itemUi.slots.chest',
  Legs: 'itemUi.slots.legs',
  Feet: 'itemUi.slots.feet',
  // Both accessory slots share the one label, the same as the two ring slots
  // did before the rework named them.
  'Accessory 1': 'itemUi.slots.ring',
  'Accessory 2': 'itemUi.slots.ring',
};

// Rebuild the /gear readout in the active locale: localize each "Slot: value"
// segment (slot label via itemUi.slots.*, item name via the entity dict, the
// "(empty)" marker via ITEM_EXTRA) then re-frame via the gearReadout template.
function locGearReadout(worn: string, total: string, body: string): string {
  const items = body
    .split(', ')
    .map((seg) => {
      const sep = seg.indexOf(': ');
      if (sep < 0) return seg;
      const label = seg.slice(0, sep);
      const value = seg.slice(sep + 2);
      const slotKey = GEAR_SLOT_KEYS[label];
      const locLabel = slotKey ? t(slotKey) : label;
      const locValue = value === '(empty)' ? tItemExtra('gearEmptySlot') : locItem(value);
      return `${locLabel}: ${locValue}`;
    })
    .join(', ');
  return tItemExtra('gearReadout', { worn, total, items });
}

// EXACT (no-placeholder) sim messages: English -> key (auto-built; throws on collision).
const EXACT: Record<string, SimMessageKey> = {};
for (const key of Object.keys(enTable) as SimMessageKey[]) {
  const v = enTable[key];
  if (
    v.includes('{') ||
    key.startsWith('aura.') ||
    key.startsWith('petMode.') ||
    key.startsWith('mechanic.')
  )
    continue;
  if (EXACT[v] !== undefined)
    throw new Error(
      `sim_i18n: duplicate exact English message "${v}" (keys ${EXACT[v]} and ${key})`,
    );
  EXACT[v] = key;
}

type Rule = { re: RegExp; build: (m: RegExpExecArray) => string };
const RULES: Rule[] = [
  // Ready-check result summary (social/ready_check.ts finalizeReadyCheck).
  {
    re: /^Ready check: (\d+) ready, (\d+) not ready, (\d+) no response\.$/,
    build: (m) =>
      t('hudChrome.readyCheck.result', { ready: m[1], notReady: m[2], noResponse: m[3] }),
  },
  // Per-member ready-check follow-ups (social/ready_check.ts finalizeReadyCheck).
  // Player names splice verbatim; "Pet taunt is not ready." resolves via EXACT first.
  { re: /^(.+) is not ready\.$/, build: (m) => tSim('log.readyCheckNotReady', { name: m[1] }) },
  {
    re: /^(.+) did not respond to the ready check\.$/,
    build: (m) => tSim('log.readyCheckNoResponse', { name: m[1] }),
  },
  {
    re: /^The ritual circle is silent without the Crypt Keystone\.$/,
    build: () => tQuestExtra('ritualNeedsKey'),
  },
  { re: /^My king was a good man\.$/, build: () => tQuestExtra('aldrenVision1') },
  { re: /^I swore my blade to him\.$/, build: () => tQuestExtra('aldrenVision2') },
  { re: /^I would do so again\.$/, build: () => tQuestExtra('aldrenVision3') },
  { re: /^There had to be another way\.$/, build: () => tQuestExtra('malricVision1') },
  { re: /^I could not let him die\.$/, build: () => tQuestExtra('malricVision2') },
  { re: /^I only wanted to save him\.$/, build: () => tQuestExtra('malricVision3') },
  { re: /^The king was already dead\.$/, build: () => tQuestExtra('vossVision1') },
  { re: /^Malric refused to accept it\.$/, build: () => tQuestExtra('vossVision2') },
  { re: /^We should have let him rest\.$/, build: () => tQuestExtra('vossVision3') },
  { re: /^If you find the crypt\.\.\. end this\.$/, build: () => tQuestExtra('vossVision4') },
  {
    re: /^The Crypt Keystone turns cold as the seal breaks\.$/,
    build: () => tQuestExtra('ritualBreaks'),
  },
  { re: /^The crypt entrance is sealed to you\.$/, build: () => tQuestExtra('cryptSealed') },
  {
    re: /^That item cannot be listed on the World Market\.$/,
    build: () => t('itemUi.tooltip.cannotMarket'),
  },
  { re: /^(.+) awakens!$/, build: (m) => tQuestExtra('awakens', { name: locMob(m[1]) }) },
  {
    re: /^(.+) rises over Thornpeak Heights!$/,
    build: (m) => t('hudChrome.worldBoss.spawn', { name: locMob(m[1]) }),
  },
  {
    re: /^Fallen Captain Aldren yells, "None shall disturb the king's rest! For Thornpeak!"$/,
    build: () => tQuestExtra('aldrenYell', { name: locMob('Fallen Captain Aldren') }),
  },
  {
    re: /^Corrupted Priest Malric yells, "Death shall never claim my king! The ritual must endure!"$/,
    build: () => tQuestExtra('malricYell', { name: locMob('Corrupted Priest Malric') }),
  },
  {
    re: /^Deathstalker Voss yells, "You will not reach him! The king must endure!"$/,
    build: () => tQuestExtra('vossYell', { name: locMob('Deathstalker Voss') }),
  },
  {
    re: /^You may choose a specialization at level (\d+)\.$/,
    build: (m) => tSim('error.specLevel', { level: m[1] }),
  },
  {
    re: /^You must be level (\d+) to equip that\.$/,
    build: (m) => tSim('error.equipLevel', { level: m[1] }),
  },
  {
    re: /^You must have a shield equipped\.$/,
    build: () => t('hudChrome.abilityError.shieldRequired'),
  },
  {
    re: /^You can save at most (\d+) loadouts\.$/,
    build: (m) => tSim('error.maxLoadouts', { count: m[1] }),
  },
  { re: /^Saved build "(.+)"\.$/, build: (m) => tSim('log.savedBuild', { name: m[1] }) },
  { re: /^Loadout "(.+)" applied\.$/, build: (m) => tSim('log.loadoutApplied', { name: m[1] }) },
  { re: /^Deleted build "(.+)"\.$/, build: (m) => tSim('log.deletedBuild', { name: m[1] }) },
  { re: /^You dismiss (.+)\.$/, build: (m) => tSim('log.dismissPet', { name: locMob(m[1]) }) },
  { re: /^You summon (.+)\.$/, build: (m) => tSim('log.summonDemon', { name: locMob(m[1]) }) },
  {
    re: /^(.+) fades back into the void\.$/,
    build: (m) => tSim('log.petFadesVoid', { name: locMob(m[1]) }),
  },
  {
    re: /^(.+) answers your summons\.$/,
    build: (m) => tSim('log.petAnswersSummons', { name: locMob(m[1]) }),
  },
  {
    re: /^Your pet's Growl is ready\. (Auto-taunt is (?:on|off)\.)$/,
    build: (m) => tSim('petGrowl.ready', { autoState: locPetGrowlAutoState(m[1]) }),
  },
  {
    re: /^Your pet's Growl is on cooldown\. (Auto-taunt is (?:on|off)\.) Ready in (\d+)s\.$/,
    build: (m) =>
      tSim('petGrowl.cooldown', {
        autoState: locPetGrowlAutoState(m[1]),
        seconds: formatNumber(Number(m[2]), { maximumFractionDigits: 0, useGrouping: false }),
      }),
  },
  { re: /^You abandon (.+)\.$/, build: (m) => tSim('log.abandonPet', { name: locMob(m[1]) }) },
  { re: /^Your pet is now named (.+)\.$/, build: (m) => tSim('log.petRenamed', { name: m[1] }) },
  {
    re: /^(.+) returns to your side\.$/,
    build: (m) => tSim('log.petReturns', { name: locMob(m[1]) }),
  },
  {
    re: /^(.+) could not be restored and has been lost\.$/,
    build: (m) => tSim('log.petRestoreLost', { name: locMob(m[1]) }),
  },
  { re: /^You feed (.+)\.$/, build: (m) => tSim('log.feedPet', { name: locMob(m[1]) }) },
  {
    re: /^You channel healing into (.+)\.$/,
    build: (m) => tSim('log.demonHealChannel', { name: locMob(m[1]) }),
  },
  {
    re: /^(.+) is now your loyal companion\.$/,
    build: (m) => tSim('log.tamedPet', { name: locMob(m[1]) }),
  },
  {
    re: /^(.+) is now (.+)\.$/,
    build: (m) => tSim('log.petMode', { name: locMob(m[1]), mode: locPetMode(m[2]) }),
  },
  { re: /^(.+) dies\.$/, build: (m) => tSim('log.entityDies', { name: locMob(m[1]) }) },
  {
    re: /^You have prestiged! Prestige Rank (\d+)\.$/,
    build: (m) => tSim('log.prestiged', { rank: m[1] }),
  },
  { re: /^(.+) becomes enraged!$/, build: (m) => tSim('log.enraged', { name: locMob(m[1]) }) },
  { re: /^(.+) calls for aid!$/, build: (m) => tSim('log.callsForAid', { name: locMob(m[1]) }) },
  {
    re: /^(.+) begins to swell — get clear!$/,
    build: (m) => tSim('log.deathThroesArm', { name: locMob(m[1]) }),
  },
  {
    re: /^(.+) bursts in a cloud of (.+)!$/,
    build: (m) =>
      tSim('log.deathThroesBurst', {
        name: locMob(m[1]),
        effect: localizeSimAuraName(m[2]) ?? m[2],
      }),
  },
  {
    re: /^Discarded (.+?)( x\d+)?\.$/,
    build: (m) => tSim('log.discarded', { item: locItemStack(m[1], m[2]) }),
  },
  // /gear self-readout (must precede the single-item Equipped rule below, which is
  // anchored with (?!\() so it can never swallow this compound readout).
  { re: /^Equipped \(([^/]+)\/([^)]+)\): (.+)\.$/, build: (m) => locGearReadout(m[1], m[2], m[3]) },
  { re: /^You have nothing equipped\.$/, build: () => tItemExtra('nothingEquipped') },
  // Quest-item + relic pickup error toasts (src/sim emits these as `?? 'English'`
  // fallbacks, so the S3 drift guard's this.error regex cannot see them — covered
  // explicitly by tests/sim_item_i18n.test.ts instead).
  {
    re: /^You cannot take the (.+) yet\.$/,
    build: (m) => tItemExtra('cannotTakeYet', { name: locItem(m[1]) }),
  },
  {
    re: /^(.+) offers nothing more\.$/,
    build: (m) => tItemExtra('offersNothingMore', { name: locItem(m[1]) }),
  },
  { re: /^The relic is bound by the sealed crypt\.$/, build: () => tItemExtra('relicBound') },
  { re: /^You have already recovered this relic\.$/, build: () => tItemExtra('relicRecovered') },
  { re: /^Equipped (?!\()(.+)\.$/, build: (m) => tSim('log.equipped', { item: locItem(m[1]) }) },
  { re: /^Unequipped (.+)\.$/, build: (m) => tSim('log.unequipped', { item: locItem(m[1]) }) },
  { re: /^You quaff (.+)\.$/, build: (m) => tSim('log.quaff', { item: locItem(m[1]) }) },
  {
    re: /^(Need|Greed) Roll - (\d+) for (.+) by (.+)$/,
    build: (m) =>
      tSim(m[1] === 'Need' ? 'loot.rollNeed' : 'loot.rollGreed', {
        roll: m[2],
        item: m[3],
        name: m[4],
      }),
  },
  {
    re: /^(.+) wins (.+) \((\d+)\)$/,
    build: (m) => tSim('loot.rollWin', { winner: m[1], item: m[2], roll: m[3] }),
  },
  {
    re: /^(.+) was offline; (.+) returned to the corpse\.$/,
    build: (m) => tSim('loot.rollWinnerOffline', { winner: m[1], item: m[2] }),
  },
  {
    re: /^(.+) bought your (.+) for (.+) [—-] collect (.+) from the Merchant\.$/,
    build: (m) =>
      tSim('loot.marketSellerBought', {
        buyer: m[1],
        item: locItem(m[2]),
        price: m[3],
        proceeds: m[4],
      }),
  },
  // Ability learned / rank-up. {name} is an ability name (localized via the entity dict).
  {
    re: /^You have learned a new ability: (.+)\.$/,
    build: (m) => tSim('log.learnedAbility', { name: locAbility(m[1]) }),
  },
  {
    re: /^Your (.+) has improved to Rank (\d+)\.$/,
    build: (m) => tSim('log.abilityRankUp', { name: locAbility(m[1]), rank: m[2] }),
  },
  // /follow family. {name} is another player (a mob name only if it happens to collide).
  {
    re: /^(.+) is too far away to follow\.$/,
    build: (m) => tSim('log.tooFarToFollow', { name: locMob(m[1]) }),
  },
  { re: /^Now following (.+)\.$/, build: (m) => tSim('log.nowFollowing', { name: locMob(m[1]) }) },
  // AFK / DND presence. The {message} is custom text OR the default presence label; the
  // default labels are themselves keys, custom text splices through verbatim.
  {
    re: /^You are now Away From Keyboard: (.+)$/,
    build: (m) =>
      tSim('presence.nowAfk', {
        message: m[1] === 'Away From Keyboard' ? tSim('presence.afkDefault') : m[1],
      }),
  },
  {
    re: /^You are now in Do Not Disturb mode: (.+)$/,
    build: (m) =>
      tSim('presence.nowDnd', {
        message: m[1] === 'Do Not Disturb' ? tSim('presence.dndDefault') : m[1],
      }),
  },
  // Chat channel join/leave + /join /leave /channel readouts. The channel/action tokens
  // are command identifiers (world, lfg, join, ...) and splice through verbatim.
  {
    re: /^Joined the (.+) channel\. Type \/(.+) <message> to talk\.$/,
    build: (m) => tSim('log.channelJoined', { channel: m[1] }),
  },
  { re: /^Left the (.+) channel\.$/, build: (m) => tSim('log.channelLeft', { channel: m[1] }) },
  {
    re: /^Usage: \/(.+) <channel>\. Channels: (.+)\.$/,
    build: (m) => tSim('error.channelUsage', { action: m[1], list: m[2] }),
  },
  {
    re: /^There is no channel named '(.+)'\. Channels: (.+)\.$/,
    build: (m) => tSim('error.noSuchChannel', { name: m[1], list: m[2] }),
  },
  {
    re: /^You are not in the (.+) channel\. Type \/join (.+) first\.$/,
    build: (m) => tSim('error.notInChannelJoin', { channel: m[1] }),
  },
  {
    re: /^You are already in the (.+) channel\.$/,
    build: (m) => tSim('error.alreadyInChannel', { channel: m[1] }),
  },
  {
    re: /^You are not in the (.+) channel\.$/,
    build: (m) => tSim('error.notInChannel', { channel: m[1] }),
  },
  { re: /^(.+) leaves the party\.$/, build: (m) => tSim('log.partyLeaves', { name: m[1] }) },
  { re: /^(.+) has left the party\.$/, build: (m) => tSim('log.partyLeft', { name: m[1] }) },
  {
    re: /^(.+) has been removed from the party\.$/,
    build: (m) => tSim('log.partyRemoved', { name: m[1] }),
  },
  { re: /^Your party has converted to a raid group\.$/, build: () => tRaidExtra('converted') },
  {
    re: /^(.+) has been moved to raid group (.+)\.$/,
    build: (m) => tRaidExtra('memberMoved', { name: m[1], group: m[2] }),
  },
  {
    re: /^You need a full party of five before converting to raid\.$/,
    build: () => tRaidExtra('needFullParty'),
  },
  { re: /^Only the party leader may convert to raid\.$/, build: () => tRaidExtra('leaderConvert') },
  { re: /^Your group is already a raid\.$/, build: () => tRaidExtra('alreadyRaid') },
  { re: /^You are not in a raid group\.$/, build: () => tRaidExtra('notInRaid') },
  { re: /^Only the raid leader may adjust groups\.$/, build: () => tRaidExtra('leaderAdjust') },
  {
    re: /^Your raid has converted back to a party\.$/,
    build: () => t('hudChrome.raidConvert.toPartyDone'),
  },
  { re: /^Your group is not a raid\.$/, build: () => t('hudChrome.raidConvert.notRaid') },
  {
    re: /^Only the raid leader may convert to a party\.$/,
    build: () => t('hudChrome.raidConvert.leaderOnly'),
  },
  {
    re: /^A raid with more than five members cannot convert back to a party\.$/,
    build: () => t('hudChrome.raidConvert.tooLarge'),
  },
  { re: /^Raid group (.+) is full\.$/, build: (m) => tRaidExtra('groupFull', { group: m[1] }) },
  { re: /^Your raid is full\.$/, build: () => tRaidExtra('yourRaidFull') },
  { re: /^That raid is full\.$/, build: () => tRaidExtra('thatRaidFull') },
  { re: /^You cannot duel in Nythraxis Raid Arena\.$/, build: () => tRaidExtra('noDuelArena') },
  {
    re: /^Raid groups cannot enter standard dungeons\.$/,
    build: () => tRaidExtra('noStandardDungeons'),
  },
  {
    re: /^You must convert your party to a raid group first\.$/,
    build: () => tRaidExtra('mustConvert'),
  },
  { re: /^The royal door is sealed to you\.$/, build: () => tRaidExtra('royalDoorSealed') },
  { re: /^You are locked to Nythraxis Raid Arena\.$/, build: () => tRaidExtra('locked') },
  {
    re: /^Nythraxis is engaged — the royal door has sealed shut\.$/,
    build: () => tRaidExtra('engagedSealed'),
  },
  {
    re: /^The royal door is sealed — Nythraxis must fall first\.$/,
    build: () => tRaidExtra('mustFall'),
  },
  {
    re: /^You join the Ashen Coliseum 2v2 queue\. Stand by for opponents[.…]{1,3}$/,
    build: () => tArenaExtra('join2v2'),
  },
  { re: /^You leave the Ashen Coliseum 2v2 queue\.$/, build: () => tArenaExtra('leave2v2') },
  {
    re: /^Your team leaves the Ashen Coliseum 2v2 queue\.$/,
    build: () => tArenaExtra('teamLeave2v2'),
  },
  {
    re: /^You are already in the (.+) queue\. Leave it before queueing for (.+)\.$/,
    build: (m) => tArenaExtra('alreadyQueuedOther', { current: m[1], next: m[2] }),
  },
  { re: /^Leave your party before queueing for 1v1\.$/, build: () => tArenaExtra('leaveParty1v1') },
  {
    re: /^Only the party leader may queue your team for 2v2\.$/,
    build: () => tArenaExtra('partyLeaderQueue2v2'),
  },
  {
    re: /^2v2 premade requires a party of exactly two\.$/,
    build: () => tArenaExtra('premadeNeedsTwo'),
  },
  { re: /^A party member is unavailable\.$/, build: () => tArenaExtra('partyMemberUnavailable') },
  {
    re: /^(.+) cannot queue while dead\.$/,
    build: (m) => tArenaExtra('memberDead', { name: m[1] }),
  },
  {
    re: /^(.+) is already in an arena match\.$/,
    build: (m) => tArenaExtra('memberInMatch', { name: m[1] }),
  },
  {
    re: /^(.+) is already in the arena queue\.$/,
    build: (m) => tArenaExtra('memberQueued', { name: m[1] }),
  },
  {
    re: /^(.+) cannot queue while dueling\.$/,
    build: (m) => tArenaExtra('memberDueling', { name: m[1] }),
  },
  {
    re: /^(.+) must finish trading before queueing\.$/,
    build: (m) => tArenaExtra('memberTrading', { name: m[1] }),
  },
  {
    re: /^(.+) cannot queue from inside an instance\.$/,
    build: (m) => tArenaExtra('memberInstance', { name: m[1] }),
  },
  // Delve / lockpicking sim text. Re-localized through t() against the sim.delve.* /
  // sim.lockpick.* keys (src/ui/i18n.catalog/index.ts). The module-enter banner is two
  // rules anchored on the fixed objective lines ("X: Clear the room." / "X: Defeat the
  // boss."), each localizing the captured module name, so there is no bare catch-all.
  { re: /^You cannot enter a delve right now\.$/, build: () => t('sim.delve.cannotEnterNow') },
  { re: /^Leave the dungeon first\.$/, build: () => t('sim.delve.leaveDungeonFirst') },
  { re: /^Leave the arena first\.$/, build: () => t('sim.delve.leaveArenaFirst') },
  { re: /^You are already in a delve\.$/, build: () => t('sim.delve.alreadyInDelve') },
  { re: /^You cannot enter a delve while trading\.$/, build: () => t('sim.delve.whileTrading') },
  { re: /^You cannot enter a delve during a duel\.$/, build: () => t('sim.delve.duringDuel') },
  {
    re: /^You cannot enter a delve during an arena match\.$/,
    build: () => t('sim.delve.duringArena'),
  },
  { re: /^Unknown delve tier\.$/, build: () => t('sim.delve.unknownTier') },
  {
    re: /^A mechanism clicks open nearby\. A passage opens to the north\. Find the exit portal ahead\.$/,
    build: () => t('sim.delve.mechanismOpen'),
  },
  { re: /^The grave rite falters\.$/, build: () => t('sim.delve.graveFalters') },
  {
    re: /^The dead answer Deacon Varric's call!$/,
    build: () => t('delveUi.boss.varric.raise.interrupt_fail'),
  },
  { re: /^The door is already open\.$/, build: () => t('sim.delve.doorAlreadyOpen') },
  {
    re: /^The boss falls\. A warded reliquary chest rises on the dais\. Pick its lock to claim your spoils\.$/,
    build: () => t('sim.delve.bossChest'),
  },
  {
    re: /^Sister Nhalia falls silent\. The Drowned Reliquary rises from the blackwater\. Approach it to begin the rite\.$/,
    build: () => t('sim.delve.drownedLitanyReliquaryRise'),
  },
  {
    re: /^The bell rope snaps taut\. Drowned Cantors reel from the shock\.$/,
    build: () => t('sim.delve.bellRopeShock'),
  },
  {
    re: /^The egg-sac bursts\. Spiderlings skitter free across the baptistry rim\.$/,
    build: () => t('sim.delve.eggSacBurst'),
  },
  {
    re: /^The baptistry falls quiet\. Spider egg-sacs cling wetly to the rim\.$/,
    build: () => t('sim.delve.baptistryEggs'),
  },
  {
    re: /^You should try to destroy the spider sacs\.$/,
    build: () => t('sim.delve.baptistrySpidersSealed'),
  },
  {
    re: /^You need to open the seal by applying pressure somewhere in the room\.$/,
    build: () => t('sim.delve.puzzleSealed'),
  },
  {
    re: /^You should try pulling the bell ropes\.$/,
    build: () => t('sim.delve.ropesSealed'),
  },
  {
    re: /^Something stirs in the black baptistry water\.$/,
    build: () => t('sim.delve.baptistryWave'),
  },
  {
    re: /^The shrines fall dark\. Repeat the sequence\.$/,
    build: () => t('sim.delve.riteSequenceReady'),
  },
  {
    re: /^The shrines replay the rite\. Wait\.$/,
    build: () => t('sim.delve.riteSequencePlaying'),
  },
  { re: /^A soft chime answers your touch\.$/, build: () => t('sim.delve.riteCorrect') },
  {
    re: /^A harsh bell crack\. Black water splashes at your feet\.$/,
    build: () => t('sim.delve.riteWrong'),
  },
  { re: /^The Drowned Reliquary opens\.$/, build: () => t('sim.delve.riteReliquaryOpen') },
  {
    re: /^Complete the shrine rite to open the reliquary\.$/,
    build: () => t('sim.delve.riteReliquaryLocked'),
  },
  { re: /^The reliquary is empty\.$/, build: () => t('sim.delve.riteReliquaryEmpty') },
  {
    re: /^A stairway to the surface opens\. Press F at the stairs to leave\.$/,
    build: () => t('sim.delve.surfaceStairs'),
  },
  {
    re: /^A tombstone passage opens to the north when the room is cleared\.$/,
    build: () => t('sim.delve.tombstoneHint'),
  },
  {
    re: /^A sealed tombstone passage grinds open to the north\. Walk into it to continue\.$/,
    build: () => t('sim.delve.tombstoneOpen'),
  },
  { re: /^The chest is empty\.$/, build: () => t('sim.delve.chestEmpty') },
  { re: /^You are not in a delve\.$/, build: () => t('sim.delve.notInDelve') },
  { re: /^You cannot interact with that\.$/, build: () => t('sim.delve.cannotInteract') },
  { re: /^You are too far away\.$/, build: () => t('sim.delve.tooFar') },
  { re: /^The grave is silent for now\.$/, build: () => t('sim.delve.graveSilent') },
  { re: /^The door is locked\.$/, build: () => t('sim.delve.doorLocked') },
  { re: /^Strike the wall to break through\.$/, build: () => t('sim.delve.strikeWall') },
  { re: /^Nothing happens\.$/, build: () => t('sim.delve.nothingHappens') },
  { re: /^Unknown companion\.$/, build: () => t('sim.delve.unknownCompanion') },
  {
    re: /^This companion is already fully upgraded\.$/,
    build: () => t('sim.delve.companionMaxRank'),
  },
  {
    re: /^You cannot afford this upgrade\.$/,
    build: () => t('sim.delve.cannotAffordCompanionUpgrade'),
  },
  { re: /^The passage is sealed\.$/, build: () => t('sim.delve.passageSealed') },
  { re: /^Move closer to the passage\.$/, build: () => t('sim.delve.moveCloserPassage') },
  { re: /^Move closer to the chest\.$/, build: () => t('sim.delve.moveCloserChest') },
  { re: /^Move closer to the reliquary\.$/, build: () => t('sim.delve.moveCloserReliquary') },
  { re: /^There is nothing left to take\.$/, build: () => t('sim.delve.nothingToTake') },
  { re: /^The way out is not yet open\.$/, build: () => t('sim.delve.wayOutNotOpen') },
  { re: /^Move closer to the stairs\.$/, build: () => t('sim.delve.moveCloserStairs') },
  // Lockpicking minigame (exact lines).
  {
    re: /^Someone is already working the lock\.$/,
    build: () => t('sim.lockpick.alreadyInProgress'),
  },
  { re: /^You cannot pick that\.$/, build: () => t('sim.lockpick.cannotPickThat') },
  { re: /^Choose 1, 2, or 3 picks\.$/, build: () => t('sim.lockpick.chooseAnte') },
  { re: /^No lock attempt in progress\.$/, build: () => t('sim.lockpick.noAttempt') },
  { re: /^That is not your lock\.$/, build: () => t('sim.lockpick.notYours') },
  { re: /^That tool slips off this lock\.$/, build: () => t('sim.lockpick.toolSlips') },
  // Chest-loss lockpick lines.
  {
    re: /^The lock is jammed beyond picking\. Clear the delve again for another attempt\.$/,
    build: () => t('sim.lockpick.lockJammed'),
  },
  {
    re: /^The last pick snaps\. The lock jams\. The chest is lost unless you clear the delve again\.$/,
    build: () => t('sim.lockpick.lastPickSnaps'),
  },
  // Bountiful seal (purple coffer): requires Premium ante.
  {
    re: /^This seal yields only to a master's hand\. Only the Premium ante can open it\.$/,
    build: () => t('sim.delve.shopSealPremiumOnly'),
  },
  // Interpolated delve / lockpick lines.
  // levelRequired with tier label (must precede the two-arg form without tier).
  {
    re: /^You must be level (\d+) to enter (.+) on (.+)\.$/,
    build: (m) => t('sim.delve.levelRequiredTier', { level: m[1], name: m[2], tier: m[3] }),
  },
  {
    re: /^You must be level (\d+) to enter (.+)\.$/,
    build: (m) => t('sim.delve.levelRequired', { level: m[1], name: m[2] }),
  },
  {
    re: /^(.+) is meant for solo or duo delves\. Parties of (\d+) or more may not enter\.$/,
    build: (m) => t('sim.delve.partyTooLarge', { name: m[1], max: m[2] }),
  },
  // "All instances of X are busy" is handled by the hud-local localizeErrorText
  // arm (it runs first and resolves the dungeon-or-delve name), so no rule here.
  { re: /^(.+) run failed\.$/, build: (m) => t('sim.delve.runFailed', { name: locDelve(m[1]) }) },
  {
    re: /^(.+) begins Raise Dead\.$/,
    build: (m) => t('sim.delve.raiseDead', { name: locMob(m[1]) }),
  },
  {
    re: /^(.+) marks (.+) with Blackwater!$/,
    build: (m) => t('sim.delve.nhaliaBlackwaterMark', { name: locMob(m[1]), player: m[2] }),
  },
  { re: /^Cantors, hold the note!$/, build: () => t('sim.delve.nhaliaCantorShield') },
  {
    re: /^(.+) tolls the bells!$/,
    build: (m) => tSim('log.nhaliaTollsBells', { name: locMob(m[1]) }),
  },
  {
    re: /^You need (.+) Delve Marks to upgrade (.+)\.$/,
    build: (m) => t('sim.delve.companionMarksRequired', { marks: m[1], name: locMob(m[2]) }),
  },
  { re: /^You have not unlocked that item yet\.$/, build: () => t('sim.delve.shopItemLocked') },
  {
    re: /^You need (.+) Delve Marks to buy (.+)\.$/,
    build: (m) => t('sim.delve.shopMarksRequired', { marks: m[1], name: locItem(m[2]) }),
  },
  {
    re: /^You need (.+) Heroic Marks to buy (.+)\.$/,
    build: (m) => tSim('error.heroicMarksNeeded', { marks: m[1], name: locItem(m[2]) }),
  },
  {
    re: /^All instances have been reset\.$/,
    build: () => t('hudChrome.dungeonDifficulty.resetDone'),
  },
  {
    re: /^You have no instances to reset\.$/,
    build: () => t('hudChrome.dungeonDifficulty.resetNone'),
  },
  {
    re: /^You cannot reset instances while someone is still inside\.$/,
    build: () => t('hudChrome.dungeonDifficulty.resetOccupied'),
  },
  {
    re: /^Change dungeon difficulty before resetting these instances\. Empty instances reset on their own after 5 minutes\.$/,
    build: () => t('hudChrome.dungeonDifficulty.resetSameDifficulty'),
  },
  {
    re: /^Use \/dungeon reset to abandon your empty instances after changing difficulty\.$/,
    build: () => t('hudChrome.dungeonDifficulty.resetUsage'),
  },
  {
    re: /^You cannot reset instances while loot remains inside\.$/,
    build: () => t('hudChrome.dungeonDifficulty.resetLoot'),
  },
  {
    re: /^Instances can only be reset once every 5 minutes\.$/,
    build: () => t('hudChrome.dungeonDifficulty.resetCooldown'),
  },
  {
    re: /^This instance is set to Normal difficulty\. Use Reset All Instances to start a fresh Heroic run\.$/,
    build: () => t('hudChrome.dungeonDifficulty.entryMismatchNormal'),
  },
  {
    re: /^This instance is set to Heroic difficulty\. Use Reset All Instances to start a fresh Normal run\.$/,
    build: () => t('hudChrome.dungeonDifficulty.entryMismatchHeroic'),
  },
  {
    re: /^You pass through the tombstone into (.+)\.$/,
    build: (m) => t('sim.delve.tombstoneInto', { name: locDelveModule(m[1]) }),
  },
  {
    re: /^(.+) reaches rank (.+)\.$/,
    build: (m) => t('sim.delve.companionRankUp', { name: locMob(m[1]), rank: m[2] }),
  },
  { re: /^(.+) complete\.$/, build: (m) => t('sim.delve.complete', { name: locDelve(m[1]) }) },
  // Module-enter banner: "<module>: <objective>". Anchored on the two fixed
  // objective lines (not a bare "X: Y" catch-all), so the captured module name is
  // the only free part; localize it and the objective.
  {
    re: /^(.+): Clear the room\.$/,
    build: (m) =>
      t('sim.delve.moduleEnter', {
        name: locDelveModule(m[1]),
        objective: t('sim.delve.objectiveClearRoom'),
      }),
  },
  {
    re: /^(.+): Defeat the boss\.$/,
    build: (m) =>
      t('sim.delve.moduleEnter', {
        name: locDelveModule(m[1]),
        objective: t('sim.delve.objectiveDefeatBoss'),
      }),
  },
  // 2v2 Fiesta. The leader/premade rules are wildcards so they catch both the
  // '2v2' and 'Fiesta' label variants (the ranked exact rules above match first
  // at runtime; this picks up Fiesta and the i18n guard's placeholder token).
  {
    re: /^You join the 2v2 Fiesta queue\. Get ready to PARTY[.…]{1,3}$/,
    build: () => t('fiesta.queue.join'),
  },
  { re: /^You leave the 2v2 Fiesta queue\.$/, build: () => t('fiesta.queue.leave') },
  { re: /^Your team leaves the 2v2 Fiesta queue\.$/, build: () => t('fiesta.queue.teamLeave') },
  {
    re: /^Only the party leader may queue your team for (.+)\.$/,
    build: (m) => t('fiesta.error.leaderOnly', { label: m[1] }),
  },
  {
    re: /^(.+) premade requires a party of exactly two\.$/,
    build: (m) => t('fiesta.error.premadeTwo', { label: m[1] }),
  },
  { re: /^You have no augment to choose right now\.$/, build: () => t('fiesta.error.noAugment') },
  { re: /^That augment is not on offer\.$/, build: () => t('fiesta.error.notOnOffer') },
  {
    re: /^Welcome to the 2v2 FIESTA! Score takedowns, grab augments, survive the ring!$/,
    build: () => t('fiesta.log.welcome'),
  },
  { re: /^FIESTA — GO!$/, build: () => t('fiesta.log.go') },
  {
    re: /^FIESTA OVER! What a party\. Returning to the world[.…]{1,3}$/,
    build: () => t('fiesta.log.over'),
  },
  // Protect Yumi (social/arena.ts queue arms + social/yumi.ts match start).
  // The leader-only error rides the fiesta wildcard rule above (label
  // 'Protect Yumi'); the rest are exact.
  {
    re: /^You join the Protect Yumi queue\. Guard your familiar[.…]{1,3}$/,
    build: () => t('yumi.queue.join'),
  },
  { re: /^You leave the Protect Yumi queue\.$/, build: () => t('yumi.queue.leave') },
  { re: /^Your team leaves the Protect Yumi queue\.$/, build: () => t('yumi.queue.teamLeave') },
  {
    re: /^Protect Yumi 3v3 allows a party of up to three\.$/,
    build: () => t('yumi.error.partyTooBig3'),
  },
  {
    re: /^Protect Yumi 5v5 allows a party of up to five\.$/,
    build: () => t('yumi.error.partyTooBig5'),
  },
  {
    re: /^Protect Yumi! Defend your familiar and hunt theirs\.$/,
    build: () => t('yumi.log.start'),
  },
  // Boss/mob mechanic broadcast. Broad (two open captures), so it MUST stay last -
  // after every more-specific "{X} {verb}!" rule above (awakens, enraged, calls for aid).
  {
    re: /^(.+) channels (.+)\.$/,
    build: (m) => tSim('log.mobChannels', { name: locMob(m[1]), mechanic: locBossMechanic(m[2]) }),
  },
  // Dungeon Finder member-specific templates (player names splice verbatim).
  {
    re: /^(.+) does not meet the level range for that activity\.$/,
    build: (m) => tSim('dfinder.memberLevel', { name: m[1] }),
  },
  {
    re: /^(.+) has not selected a Dungeon Finder role\.$/,
    build: (m) => tSim('dfinder.memberRoles', { name: m[1] }),
  },
  {
    re: /^(.+) cannot join the queue again yet\.$/,
    build: (m) => tSim('dfinder.memberCooldown', { name: m[1] }),
  },
  {
    re: /^(.+) applies to your group listing\.$/,
    build: (m) => tSim('dfinder.applicantApplies', { name: m[1] }),
  },
  // "{mechanic} is interrupted!" (a channeled mob heal broken by a stun/silence).
  {
    re: /^(.+) is interrupted!$/,
    build: (m) => tSim('log.channelInterrupted', { mechanic: locBossMechanic(m[1]) }),
  },
  {
    re: /^(.+) unleashes (.+)!$/,
    build: (m) =>
      tSim('log.bossUnleashes', { name: locMob(m[1]), mechanic: locBossMechanic(m[2]) }),
  },
  // Card Duel minigame (Card Master NPC, src/sim/social/card_duel.ts).
  { re: /^You queue for a Card Duel\.$/, build: () => tSim('log.cardDuelQueued') },
  { re: /^You leave the Card Duel queue\.$/, build: () => tSim('log.cardDuelLeftQueue') },
  {
    re: /^Your Card Duel against (.+) begins!$/,
    build: (m) => tSim('log.cardDuelBegins', { name: m[1] }),
  },
  {
    re: /^Your Card Duel begins!$/,
    build: () => tSim('log.cardDuelBeginsNoOpponent'),
  },
  {
    re: /^Card Duel round: you played (.+), opponent played (.+)\.$/,
    build: (m) => tSim('log.cardDuelRound', { mine: m[1], theirs: m[2] }),
  },
  {
    re: /^You win the Card Duel against (.+)!$/,
    build: (m) => tSim('log.cardDuelWin', { name: m[1] }),
  },
  {
    re: /^You win the Card Duel!$/,
    build: () => tSim('log.cardDuelWinNoOpponent'),
  },
  {
    re: /^You lose the Card Duel against (.+)\.$/,
    build: (m) => tSim('log.cardDuelLoss', { name: m[1] }),
  },
  {
    re: /^You lose the Card Duel\.$/,
    build: () => tSim('log.cardDuelLossNoOpponent'),
  },
  { re: /^You forfeit the Card Duel\.$/, build: () => tSim('log.cardDuelForfeit') },
  {
    re: /^Your opponent forfeited the Card Duel\. You win!$/,
    build: () => tSim('log.cardDuelOpponentForfeited'),
  },
  {
    re: /^Your Card Duel is void: neither side played in time\.$/,
    build: () => tSim('log.cardDuelVoid'),
  },
  {
    re: /^You must be at the Card Master to queue for a Card Duel\.$/,
    build: () => tSim('error.cardDuelNotAtMaster'),
  },
  { re: /^You are not in a Card Duel\.$/, build: () => tSim('error.cardDuelNotInMatch') },
  {
    re: /^You already played a card this round\.$/,
    build: () => tSim('error.cardDuelAlreadyPlayed'),
  },
  { re: /^You don't hold that card\.$/, build: () => tSim('error.cardDuelNotHeld') },
  {
    re: /^You are already in a Card Duel\.$/,
    build: () => tSim('error.cardDuelAlreadyInDuel'),
  },
  {
    re: /^You are already queued for a Card Duel\.$/,
    build: () => tSim('error.cardDuelAlreadyQueued'),
  },
  {
    re: /^Card Duel requires another player online\.$/,
    build: () => tSim('error.cardDuelUnavailable'),
  },
];

// Returns the localized form of a sim-emitted message, or null if not one of ours.
export function localizeSimText(text: string): string | null {
  const exactKey = EXACT[text];
  if (exactKey) return tSim(exactKey);
  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (m) return rule.build(m);
  }
  return null;
}
