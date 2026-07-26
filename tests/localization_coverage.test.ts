import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { abilitiesKnownAt } from '../src/sim/content/classes';
import { DEEDS } from '../src/sim/content/deeds';
import {
  GUILD_TREND_LETTERS,
  MASTER_TIER_LETTERS,
  QUEST_LETTERS,
} from '../src/sim/content/letters';
import { ABILITIES, CLASSES, DELVES, DUNGEONS, ITEMS, MOBS, NPCS, ZONES } from '../src/sim/data';
import type { PlayerClass } from '../src/sim/types';
import { abilityBuffValue } from '../src/ui/ability_damage';
import {
  deedDesc,
  deedName,
  deedTitleText,
  deedTranslationManifest,
  ensureDeedLocalesLoaded,
} from '../src/ui/deed_i18n';
import {
  assertEntityTranslationsReady,
  entityTranslationFallbackLog,
  entityTranslationManifest,
  missingEntityTranslationsForGroups,
  resetEntityTranslationFallbackLog,
  tEntity,
} from '../src/ui/entity_i18n';
import {
  en,
  ensureLocaleLoaded,
  formatDateTime,
  formatMoney,
  formatNumber,
  isSupportedLanguage,
  languageTag,
  type SupportedLanguage,
  setLanguage,
  supportedLanguages,
  type TranslationKey,
  t,
} from '../src/ui/i18n';
import {
  hasTalentTitleOverride,
  renderTalentManifestEntry,
  type TalentTranslationManifestEntry,
  talentTranslationManifest,
} from '../src/ui/talent_i18n';

// The NON-English resolved tables, keyed by code. Empty while English is the only
// shipped locale: the per-locale parity loops below iterate nothing, while every
// test driven by `supportedLanguages` still runs and still proves each key exists,
// resolves non-empty, and keeps its interpolation tokens — in English.
const locales: Record<string, typeof en> = {};

// Two-tier gate (see .github/workflows/ci.yml). The release tier runs with
// I18N_RELEASE_TIER=1. Structural coverage (every key resolves non-empty,
// placeholders preserved, source scrapes) runs at the PR tier; copied-English /
// real-translation content checks run RELEASE-only, because an English-only PR or a
// sparse locale legitimately renders the English fill for an untranslated key (the
// dense resolved table fills it) - that is a `pending` row blocked at the release
// gate, not a PR failure.
const RELEASE_TIER = process.env.I18N_RELEASE_TIER === '1';

describe('i18n Localization Key Coverage', () => {
  // Lazy locale flip: non-en locales (and the deed locale tables, which ride their own
  // dynamically imported chunk) are no longer statically resident. This suite
  // setLanguage(non-en)s and reads synchronously via t()/tEntity/formatMoney/talent/deed
  // helpers, so make every supported locale resident up front - the test-harness mirror of
  // the bootstrap's await-before-paint. Each setLanguage(lang) read then resolves the
  // localized table instead of the English fallback.
  beforeAll(async () => {
    await Promise.all(
      supportedLanguages.flatMap((lang) => [
        ensureLocaleLoaded(lang),
        ensureDeedLocalesLoaded(lang),
      ]),
    );
  });

  // Case-sensitive on purpose: leftover markers are uppercase by convention,
  // and the case-insensitive form false-fails ordinary vocabulary in several
  // locales (Spanish and Portuguese "todo").
  const placeholderPattern = /\b(TODO|TBD|FIXME|PLACEHOLDER|TRANSLATE|LOREM)\b/;
  const shellKeys: TranslationKey[] = [
    'seo.title',
    'seo.description',
    'a11y.goHome',
    'loading.worldProgress',
    'errors.characterNameInvalid',
    'realm.onlineNow',
    'character.levelClass',
    'deleteCharacter.body',
    'classDetails.sections.startingStats',
    'mobilePreflight.title',
    'serverUnavailable.heading',
  ];
  const hudKeys: TranslationKey[] = [
    'hud.core.chatPlaceholder',
    'hud.core.xpGain',
    'hud.core.communityLinks',
    'hud.core.mobileControls',
    'hud.core.mobileMove',
    'hud.core.mobileCamera',
    'hud.core.mobileAttack',
    'hud.core.mobileTarget',
    'hud.core.mobileChat',
    'hud.core.mobileMore',
    'hud.core.mobileMoreAria',
    'hud.core.mobileSocial',
    'hud.core.mobileArena',
    'hud.core.mobileMenu',
    'hud.core.mobileUse',
    'hud.core.mobileMeters',
    'hud.core.mobileMap',
    'hud.core.closeMap',
    'hud.options.gameMenu',
    'hud.options.keybindHelp',
    'hud.options.unbound',
    'hud.keybinds.categories.movement',
    'hud.keybinds.actions.forward',
    'hud.meters.noCombat',
    'hud.chat.templates.guild',
    'hud.chat.context.trade',
    'hud.report.reasons.offensiveNameOrChat',
    'hud.prompts.duelRequest',
    'hud.combat.damageDoneCrit',
    'hud.system.arenaVictoryLog',
    'hud.errors.chatCooldown',
    'hud.logs.lootReceiveItem',
  ];
  const abilityKeys: TranslationKey[] = [
    'abilityUi.actionBar.attackName',
    'abilityUi.actionBar.attackTooltip',
    'abilityUi.actionBar.emptySlot',
    'abilityUi.actionBar.clearHint',
    'abilityUi.actionBar.itemInBags',
    'abilityUi.actionBar.itemNoneInBags',
    'abilityUi.cast.fishing',
    'abilityUi.spellbook.title',
    'abilityUi.spellbook.classSubtitle',
    'abilityUi.spellbook.trainableAtLevel',
    'abilityUi.spellbook.learnAtLevel',
    'abilityUi.tooltip.rank',
    'abilityUi.tooltip.cost',
    'abilityUi.tooltip.rangeWithMin',
    'abilityUi.tooltip.channeledSeconds',
    'abilityUi.tooltip.cooldownSeconds',
    'abilityUi.tooltip.requiresForm',
    'abilityUi.tooltip.requiresCombo',
    'abilityUi.tooltip.finisherDamage',
    'abilityUi.resources.mana',
  ];
  const questKeys: TranslationKey[] = [
    'questUi.tracker.title',
    'questUi.tracker.complete',
    'questUi.log.title',
    'questUi.log.summary',
    'questUi.log.emptyTitle',
    'questUi.log.emptyHint',
    'questUi.log.returnTo',
    'questUi.log.abandon',
    'questUi.dialog.accept',
    'questUi.dialog.completeQuest',
    'questUi.dialog.back',
    'questUi.dialog.availableQuestAria',
    'questUi.detail.objectives',
    'questUi.detail.rewards',
    'questUi.detail.xpReward',
    'questUi.detail.objectiveProgress',
    'questUi.logs.accepted',
    'questUi.errors.unavailable',
  ];
  const itemKeys: TranslationKey[] = [
    'itemUi.money.goldShort',
    'itemUi.money.copper',
    'itemUi.slots.mainhand',
    'itemUi.quality.rare',
    'itemUi.kind.quest',
    'itemUi.kind.tool',
    'itemUi.kind.potion',
    'itemUi.stats.attackPower',
    'itemUi.tooltip.damageSpeed',
    'itemUi.tooltip.useFood',
    'itemUi.tooltip.useFishing',
    'itemUi.tooltip.useHealingPotion',
    'itemUi.tooltip.useManaPotion',
    'itemUi.tooltip.clickUseInstant',
    'itemUi.tooltip.clickUse',
    'itemUi.tooltip.clickBuyback',
    'itemUi.tooltip.sellPrice',
    'itemUi.bags.title',
    'itemUi.bags.itemAria',
    'itemUi.equipment.levelClass',
    'itemUi.vendor.goodsTitle',
    'itemUi.vendor.buyAria',
    'itemUi.vendor.buybackTitle',
    'itemUi.vendor.buybackEmpty',
    'itemUi.vendor.buybackAria',
    'itemUi.vendor.sellQuantityTitle',
    'itemUi.vendor.sellQuantityInput',
    'itemUi.vendor.sellQuantityConfirm',
    'itemUi.vendor.sellQuantityCancel',
    'itemUi.market.title',
    'itemUi.market.sellNote',
    'itemUi.market.buyAria',
    'itemUi.logs.sellerSold',
    'itemUi.logs.boughtBackItem',
    'itemUi.errors.tooManyListings',
    'itemUi.loot.takeAll',
  ];
  const mergeKeys: TranslationKey[] = [
    'hud.options.mouseCamera',
    'hud.options.keybindHelpMouseCamera',
    'hud.markers.names.star',
    'hud.markers.names.circle',
    'hud.markers.names.diamond',
    'hud.markers.names.triangle',
    'hud.markers.names.moon',
    'hud.markers.names.square',
    'hud.markers.names.cross',
    'hud.markers.names.skull',
    'hud.markers.clear',
    'hud.markers.cancel',
    'hud.markers.markerAria',
    'hud.markers.markerSelectedAria',
    'hud.social.title',
    'hud.social.friendsTab',
    'hud.social.guildTab',
    'hud.social.ignoreTab',
    'hud.social.leaveParty',
    'hud.social.offlineEmpty',
    'hud.social.friendsEmpty',
    'hud.social.ignoreEmpty',
    'hud.social.noGuild',
    'hud.social.whisperTitle',
    'hud.social.removeFriendTitle',
    'hud.social.stopIgnoringTitle',
    'hud.social.makeGuildMasterTitle',
    'hud.social.promoteTitle',
    'hud.social.demoteTitle',
    'hud.social.removeGuildTitle',
    'hud.social.friendSearchPlaceholder',
    'hud.social.ignoreSearchPlaceholder',
    'hud.social.guildNamePlaceholder',
    'hud.social.guildInvitePlaceholder',
    'hud.social.add',
    'hud.social.ignoreAction',
    'hud.social.found',
    'hud.social.invite',
    'hud.social.disbandGuild',
    'hud.social.leaveGuild',
    'hud.social.disbandPrompt',
    'hud.social.disbandConfirm',
    'hud.social.transferPrompt',
    'hud.social.transferConfirm',
    'hud.social.selfNotice',
    'hud.social.noPlayerNamed',
    'hud.social.currentRealm',
    'hud.social.friendAdded',
    'hud.social.nowIgnoring',
    'hud.social.guildInvited',
    'hud.social.levelClass',
    'hud.social.status.online',
    'hud.social.status.offline',
    'hud.social.status.combat',
    'hud.social.status.dungeon',
    'hud.social.status.dead',
    'hud.social.statusWithZone',
    'hud.social.ranks.leader',
    'hud.social.ranks.officer',
    'hud.social.ranks.member',
    'hud.social.guildHeadOne',
    'hud.social.guildHeadMany',
    'hud.trade.title',
    'hud.trade.yourOffer',
    'hud.trade.theirOffer',
    'hud.trade.emptyMine',
    'hud.trade.emptyTheirs',
    'hud.trade.money',
    'hud.trade.copper',
    'hud.trade.hint',
    'hud.trade.accept',
    'hud.trade.waiting',
    'hud.trade.cancel',
    'hud.arena.title',
    'hud.arena.subtitle',
    'hud.arena.close',
    'hud.arena.offlineNote',
    'hud.arena.playerClassTitle',
    'hud.arena.playerLevelClassTitle',
    'hud.arena.noChallengers',
    'hud.arena.matchInProgress',
    'hud.arena.leaveQueue',
    'hud.arena.searching',
    'hud.arena.enterQueue',
    'hud.arena.queueNote',
    'hud.arena.ladderAllTime',
    'hud.arena.ladderOnline',
    'hud.arena.ratingSummary',
    'hud.arena.statusCountdown',
    'hud.arena.statusReturning',
    'hud.arena.statusFight',
    'hud.arena.vsLine',
    'hud.arena.levelClass',
  ];
  const interpolationValues: Record<string, string | number> = {
    active: 3,
    ability: 'Fireball',
    action: 'Open Chat',
    amount: 42,
    answered: 6,
    base: 14,
    rested: 18,
    buyer: 'Mira',
    channel: 'World',
    classes: 'Warrior, Mage',
    className: 'Mage',
    command: '/dance',
    completed: 12,
    count: 5,
    cost: 30,
    current: 120,
    cut: 5,
    delta: '+13',
    dps: '7.4',
    duration: '15s',
    form: 'Bear',
    fps: 60,
    guild: 'Night Watch',
    index: 2,
    interactKey: 'F',
    moveKeys: 'W/A/S/D',
    questKey: 'L',
    item: 'Rough Bracers',
    key: 'K',
    kind: 'Weapon',
    slots: 14,
    label: 'Wolf',
    level: 10,
    losses: 4,
    loser: 'Mira',
    marker: 'Skull',
    max: 25,
    message: 'Meet at the inn',
    min: 16,
    money: '12 copper',
    name: 'Aki',
    needed: 400,
    perCombo: 7,
    percent: 30,
    position: 3,
    price: '1g 20s',
    proceeds: '95s',
    quality: 'Rare',
    quest: 'A Trade for Every Hand',
    rating: 1513,
    range: 30,
    rank: 2,
    realm: 'Eastbrook',
    resource: 'Mana',
    seconds: 7,
    shown: 120,
    slot: 5,
    source: 'Wolf',
    speed: 2.4,
    stat: 'Strength',
    status: 'Complete',
    summary: '30 Mana / Instant',
    tab: 'Damage',
    target: 'Wolf',
    view: 'Current',
    wins: 9,
    winner: 'Rook',
    total: 125,
    used: 2,
    value: 9,
    xp: 450,
    zone: 'Northshire',
  };

  function verifyKeys(base: Record<string, unknown>, target: Record<string, unknown>, path = '') {
    for (const key in base) {
      const currentPath = path ? `${path}.${key}` : key;
      expect(target).toHaveProperty(key);
      const baseValue = base[key];
      const targetValue = target[key];
      if (typeof baseValue === 'object' && baseValue !== null) {
        expect(typeof target[key]).toBe('object');
        verifyKeys(
          baseValue as Record<string, unknown>,
          targetValue as Record<string, unknown>,
          currentPath,
        );
      } else {
        expect(typeof targetValue).toBe('string');
        const text = targetValue as string;
        expect(text.trim().length, `${currentPath} should not be empty`).toBeGreaterThan(0);
        expect(text, `${currentPath} should not contain placeholder markers`).not.toMatch(
          placeholderPattern,
        );
      }
    }
  }

  function nestedString(target: Record<string, unknown>, key: string): string {
    let node: unknown = target;
    for (const segment of key.split('.')) {
      if (typeof node !== 'object' || node === null || !(segment in node)) return '';
      node = (node as Record<string, unknown>)[segment];
    }
    return typeof node === 'string' ? node : '';
  }

  function flattenStrings(
    base: Record<string, unknown>,
    path = '',
  ): { key: TranslationKey; value: string }[] {
    const entries: { key: TranslationKey; value: string }[] = [];
    for (const [key, value] of Object.entries(base)) {
      const currentPath = path ? `${path}.${key}` : key;
      if (typeof value === 'string') {
        entries.push({ key: currentPath as TranslationKey, value });
      } else if (typeof value === 'object' && value !== null) {
        entries.push(...flattenStrings(value as Record<string, unknown>, currentPath));
      }
    }
    return entries;
  }

  function placeholders(value: string): string[] {
    return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map((match) => match[1]).sort();
  }

  function entityCount(kind: string, field: string): number {
    return entityTranslationManifest().filter(
      (entry) => entry.kind === kind && entry.field === field,
    ).length;
  }

  type EntityManifestEntry = ReturnType<typeof entityTranslationManifest>[number];
  type EntityRequest = Parameters<typeof tEntity>[0];

  function classAbilityRequest(entry: EntityManifestEntry): EntityRequest {
    if (entry.kind === 'class') {
      return {
        kind: 'class',
        id: entry.id as PlayerClass,
        field: entry.field as 'name' | 'description',
      };
    }
    if (entry.kind === 'ability') {
      return {
        kind: 'ability',
        id: entry.id,
        field: entry.field as 'name' | 'description',
        values: { damage: '11-14', overTime: '57', buff: '35', duration: '12' },
      };
    }
    throw new Error(`Unexpected entity kind: ${entry.kind}`);
  }

  function itemRequest(entry: EntityManifestEntry): EntityRequest {
    if (entry.kind === 'item') {
      return { kind: 'item', id: entry.id, field: 'name' };
    }
    throw new Error(`Unexpected entity kind: ${entry.kind}`);
  }

  function parseIndexedEntry(id: string, segment: string): { ownerId: string; index: number } {
    const marker = `.${segment}.`;
    const markerIndex = id.lastIndexOf(marker);
    if (markerIndex < 0) throw new Error(`Malformed indexed entity id: ${id}`);
    const ownerId = id.slice(0, markerIndex);
    const index = Number(id.slice(markerIndex + marker.length));
    if (!Number.isInteger(index)) throw new Error(`Malformed indexed entity index: ${id}`);
    return { ownerId, index };
  }

  function worldRequest(entry: EntityManifestEntry): EntityRequest {
    if (entry.kind === 'mob') return { kind: 'mob', id: entry.id, field: 'name' };
    if (entry.kind === 'npc') {
      return {
        kind: 'npc',
        id: entry.id,
        field: entry.field as 'name' | 'title' | 'greeting',
        values: { className: 'Mage', classNameLower: 'mage', playerName: 'Mira' },
      };
    }
    if (entry.kind === 'zone') {
      return { kind: 'zone', id: entry.id, field: entry.field as 'name' | 'welcome' };
    }
    if (entry.kind === 'zonePoi') {
      const { ownerId, index } = parseIndexedEntry(entry.id, 'pois');
      return { kind: 'zonePoi', zoneId: ownerId, poiIndex: index, field: 'label' };
    }
    if (entry.kind === 'dungeon') {
      return {
        kind: 'dungeon',
        id: entry.id,
        field: entry.field as 'name' | 'enterText' | 'leaveText',
      };
    }
    if (entry.kind === 'delve') {
      return {
        kind: 'delve',
        id: entry.id,
        field: entry.field as 'name' | 'enterText' | 'leaveText',
      };
    }
    if (entry.kind === 'letter') {
      return {
        kind: 'letter',
        id: entry.id,
        field: entry.field as 'sender' | 'subject' | 'body',
      };
    }
    throw new Error(`Unexpected entity kind: ${entry.kind}`);
  }

  function sourceFilesUnder(relativeDir: string): string[] {
    const root = path.resolve(process.cwd(), relativeDir);
    if (!fs.existsSync(root)) return [];
    const files: string[] = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory())
        files.push(...sourceFilesUnder(path.relative(process.cwd(), entryPath)));
      else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(entryPath);
    }
    return files;
  }

  function questNarrativeSkeleton(value: string): string {
    return value
      .replace(/"[^"]*"|'[^']*'|“[^”]*”|「[^」]*」/g, '<title>')
      .replace(/\b\d+\b/g, '<count>')
      .split(/[.!?。！？:：]/)[0]
      .toLowerCase()
      .replace(/\{playername\}/g, '<player>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function copiedEnglishComparable(value: string): string {
    return value
      .normalize('NFKC')
      .replace(/\u2014/g, '-')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\$N/g, 'Mira')
      .replace(/\$C/g, 'Mage')
      .replace(/\{playerName\}/g, 'Mira')
      .replace(/\{className\}/g, 'Mage')
      .replace(/\{classNameLower\}/g, 'mage')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  for (const [code, locale] of Object.entries(locales)) {
    it(`should have 100% key match and non-empty translations for locale: ${code}`, () => {
      verifyKeys(en, locale);
    });
  }

  it('should resolve nested keys accurately using t() helper', () => {
    setLanguage('en');
    expect(t('nav.home')).toBe('Home');
    expect(t('auth.usernamePlaceholder')).toBe('Enter username');
    expect(t('loading.worldProgress', { done: 3, total: 9 })).toBe('Loading world... 3/9');

    setLanguage('en');
  });

  it('interpolates {playerName} into the delve board greeting in every locale', () => {
    // Regression for the Brother Halven greeting that once rendered a literal
    // {playerName}: guards both the call-site value-pass and the token's
    // cross-locale parity (a translator dropping the token is caught here too).
    for (const lang of supportedLanguages) {
      setLanguage(lang);
      const greeting = t('delveUi.npc.halven.greeting', { playerName: 'Mira' });
      expect(greeting, `${lang} greeting`).not.toContain('{playerName}');
      expect(greeting, `${lang} greeting`).toContain('Mira');
    }
    setLanguage('en');
  });

  it('should expose typed locale utilities for shell metadata and formatting', () => {
    expect(supportedLanguages).toEqual(['en']);
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('de_DE')).toBe(false);
    expect(isSupportedLanguage('de-DE')).toBe(false);
    // languageTag and formatNumber take a tag and hand it to Intl; they are not
    // limited to shipped locales, and that passthrough is the thing worth pinning.
    // Cast because SupportedLanguage currently narrows to 'en'.
    expect(languageTag('fr_CA' as SupportedLanguage)).toBe('fr-CA');
    expect(formatNumber(1234.5, { maximumFractionDigits: 1 }, 'de_DE' as SupportedLanguage)).toBe(
      '1.234,5',
    );
    expect(formatNumber(1234.5, { maximumFractionDigits: 1 }, 'en')).toBe('1,234.5');
    expect(
      formatDateTime(
        new Date(Date.UTC(2026, 5, 14, 12)),
        { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' },
        'en',
      ),
    ).toBe('06/14/2026');
  });

  it('should keep technical transport errors out of localized user-facing dictionaries', () => {
    for (const locale of [en, ...Object.values(locales)]) {
      expect(locale.errors.api).not.toHaveProperty('requestFailed');
    }
  });

  it('should include public shell keys in every locale', () => {
    for (const key of shellKeys) {
      for (const lang of supportedLanguages) {
        setLanguage(lang);
        expect(t(key), `${lang}.${key}`).not.toBe(key);
        expect(t(key).trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
    setLanguage('en');
  });

  it('should include HUD, chat, and combat keys in every locale', () => {
    for (const key of hudKeys) {
      for (const lang of supportedLanguages) {
        setLanguage(lang);
        expect(t(key), `${lang}.${key}`).not.toBe(key);
        expect(t(key).trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
    setLanguage('en');
  });

  it('should include action bar, spellbook, and ability tooltip keys in every locale', () => {
    for (const key of abilityKeys) {
      for (const lang of supportedLanguages) {
        setLanguage(lang);
        expect(t(key), `${lang}.${key}`).not.toBe(key);
        expect(t(key).trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
    setLanguage('en');
  });

  it('should include quest log and dialogue keys in every locale', () => {
    for (const key of questKeys) {
      for (const lang of supportedLanguages) {
        setLanguage(lang);
        expect(t(key), `${lang}.${key}`).not.toBe(key);
        expect(t(key).trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
    setLanguage('en');
  });

  it('should include item, vendor, market, and currency keys in every locale', () => {
    for (const key of itemKeys) {
      for (const lang of supportedLanguages) {
        setLanguage(lang);
        expect(t(key), `${lang}.${key}`).not.toBe(key);
        expect(t(key).trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
    setLanguage('en');
  });

  it('should include merge UI keys in every locale', () => {
    for (const key of mergeKeys) {
      for (const lang of supportedLanguages) {
        setLanguage(lang);
        const text = t(key, interpolationValues);
        expect(text, `${lang}.${key}`).not.toBe(key);
        expect(text.trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
    setLanguage('en');
  });

  it('should resolve class and ability text without canonical fallbacks', () => {
    resetEntityTranslationFallbackLog();
    setLanguage('en');
    expect(tEntity({ kind: 'class', id: 'mage', field: 'name' })).toBe(t('classes.mage'));
    expect(entityTranslationFallbackLog()).toHaveLength(0);

    const ability = ABILITIES.fireball;
    const abilityName = tEntity({ kind: 'ability', id: ability.id, field: 'name' });
    const abilityDescription = tEntity({
      kind: 'ability',
      id: ability.id,
      field: 'description',
      values: { damage: '11-14' },
    });
    expect(abilityName).toBe(ability.name);
    expect(abilityDescription).toContain('11-14');
    expect(abilityDescription).not.toContain('$d');
    expect(abilityDescription).not.toContain('{damage}');
    expect(entityTranslationFallbackLog()).toHaveLength(0);

    const npcGreeting = tEntity({
      kind: 'npc',
      id: 'marshal_redbrook',
      field: 'greeting',
      values: { className: 'Magier', classNameLower: 'magier', playerName: 'Mira' },
    });
    expect(npcGreeting).toContain('Magier');
    expect(npcGreeting).not.toContain('$C');
    expect(entityTranslationFallbackLog()).toHaveLength(0);

    setLanguage('en');
    resetEntityTranslationFallbackLog();
  });

  it('should provide every class and ability translation in every locale', () => {
    const classAbilityEntries = entityTranslationManifest().filter(
      (entry) => entry.group === 'classAbility',
    );
    expect(classAbilityEntries).toHaveLength(
      Object.keys(CLASSES).length * 2 + Object.keys(ABILITIES).length * 2,
    );
    const missingClassAbilities = missingEntityTranslationsForGroups(['classAbility']);
    expect(missingClassAbilities, JSON.stringify(missingClassAbilities, null, 2)).toHaveLength(0);

    for (const lang of supportedLanguages) {
      setLanguage(lang);
      resetEntityTranslationFallbackLog();
      for (const entry of classAbilityEntries) {
        const rendered = tEntity(classAbilityRequest(entry));
        expect(rendered.trim().length, `${lang}.${entry.key}`).toBeGreaterThan(0);
        expect(rendered, `${lang}.${entry.key}`).not.toBe(entry.key);
        expect(rendered, `${lang}.${entry.key}`).not.toContain('$d');
        expect(rendered, `${lang}.${entry.key}`).not.toMatch(/\{damage\}/);
        // The other tooltip placeholders ($o over-time, $b buff value, $t
        // duration) must interpolate in every locale exactly like $d.
        expect(rendered, `${lang}.${entry.key}`).not.toMatch(/\$[obt]\b/);
        expect(rendered, `${lang}.${entry.key}`).not.toMatch(/\{(overTime|buff|duration)\}/);
        if (
          lang !== 'en' &&
          lang !== 'en_CA' &&
          entry.kind === 'ability' &&
          entry.field === 'description'
        ) {
          expect(
            rendered,
            `${lang}.${entry.key} should not use English yard abbreviation`,
          ).not.toMatch(/\byd\b/i);
        }
        // Placeholder-substitution parity. The fixture feeds SENTINEL values
        // (damage '11-14', overTime '57', buff '35', duration '12'); an ability
        // whose sim SOURCE carries a macro must echo that sentinel back in every
        // locale, proving the localized string kept the interpolation token and
        // did not hardcode a number or drop it (the pre-tokenization staleness
        // this suite now guards). The check is deliberately value-agnostic: the
        // sentinel is the injected input, not the ability's real value, so a
        // second ability that legitimately shares a macro (many carry $b now)
        // never trips it. A companion hard data pin below covers the real values.
        if (entry.kind === 'ability' && entry.field === 'description') {
          const src = entry.source;
          if (src.includes('$d')) expect(rendered, `${lang}.${entry.key} $d`).toContain('11-14');
          if (src.includes('$o')) expect(rendered, `${lang}.${entry.key} $o`).toContain('57');
          if (src.includes('$b')) expect(rendered, `${lang}.${entry.key} $b`).toContain('35');
          if (src.includes('$t')) expect(rendered, `${lang}.${entry.key} $t`).toContain('12');
        }
      }
      expect(entityTranslationFallbackLog(), `${lang} fallback log`).toHaveLength(0);
    }

    // Hard data-regression pin. The sentinel check above proves the {buff} token
    // survives interpolation everywhere but is value-agnostic, so it cannot catch
    // a silent balance change. Iron Bellow is the winning Warrior's baseline
    // raid-buff ability: its $b resolves to its rank-1 attack-power percentage via
    // the same picker hud.ts feeds the token. Pinning the literal fails if the datum
    // (or the picker) changes, and rendering with it confirms the EN description
    // interpolates the real number instead of a stale hardcoded one.
    const battleShout = abilitiesKnownAt('warrior', ABILITIES.battle_shout.learnLevel).find(
      (known) => known.def.id === 'battle_shout' && known.rank === 1,
    );
    if (!battleShout) throw new Error('battle_shout rank 1 did not resolve');
    const battleShoutBuff = abilityBuffValue(battleShout);
    expect(battleShoutBuff, 'battle_shout rank-1 attack-power buff').toBe(10);
    setLanguage('en');
    const battleShoutDesc = tEntity({
      kind: 'ability',
      id: 'battle_shout',
      field: 'description',
      values: { buff: String(battleShoutBuff) },
    });
    expect(battleShoutDesc).toContain('10');
    expect(battleShoutDesc).not.toContain('{buff}');
  });

  it('should provide every item translation in every locale without canonical fallbacks', () => {
    const itemEntries = entityTranslationManifest().filter((entry) => entry.group === 'item');
    // Heroic upgraded variants (heroicOf) carry no name key: they share the base
    // item name (see itemDisplayName), so they are not in the manifest.
    const namedItems = Object.values(ITEMS).filter((i) => !i.heroicOf).length;
    expect(itemEntries).toHaveLength(namedItems);
    const missingItems = missingEntityTranslationsForGroups(['item']);
    expect(missingItems, JSON.stringify(missingItems, null, 2)).toHaveLength(0);

    for (const lang of supportedLanguages) {
      setLanguage(lang);
      resetEntityTranslationFallbackLog();
      for (const entry of itemEntries) {
        const rendered = tEntity(itemRequest(entry));
        expect(rendered.trim().length, `${lang}.${entry.key}`).toBeGreaterThan(0);
        expect(rendered, `${lang}.${entry.key}`).not.toBe(entry.key);
        // RELEASE-TIER ONLY: a sparse/English-only overlay renders the English fill
        // for an untranslated item name, which is legal on a PR (a `pending` row)
        // and blocked only at the release gate (matches the world-content check below).
        if (RELEASE_TIER && lang !== 'en' && lang !== 'en_CA') {
          expect(
            rendered,
            `${lang}.${entry.key} should not copy canonical English item text`,
          ).not.toBe(entry.source);
        }
      }
      expect(entityTranslationFallbackLog(), `${lang} fallback log`).toHaveLength(0);
    }

    setLanguage('en');
  });

  it('should track item-set names and bonus text in the entity catalog', async () => {
    const itemSetEntries = entityTranslationManifest().filter((entry) => entry.group === 'itemSet');
    // 7 raid/dungeon families with name+bonus2+bonus3+bonus4 (every epic family
    // carries a 4-piece proc tier), plus 3 leveling haste kits carrying a
    // single 3-piece tier (name+bonus3 only).
    expect(itemSetEntries).toHaveLength(7 * 4 + 3 * 2);
    expect(missingEntityTranslationsForGroups(['itemSet'])).toHaveLength(0);

    // Ran over the non-Latin locales to prove item-set names were really translated
    // rather than English-filled. Empty until a second locale ships; the manifest
    // completeness assertions above still run.
    for (const lang of [] as SupportedLanguage[]) {
      await ensureLocaleLoaded(lang);
      setLanguage(lang);
      resetEntityTranslationFallbackLog();
      for (const entry of itemSetEntries) {
        const rendered = tEntity({
          kind: 'itemSet',
          id: entry.id,
          field: entry.field as 'name' | 'bonus2' | 'bonus3',
        });
        expect(rendered.trim().length, `${lang}.${entry.key}`).toBeGreaterThan(0);
        expect(rendered, `${lang}.${entry.key}`).not.toBe(entry.key);
        expect(rendered, `${lang}.${entry.key}`).not.toBe(entry.source);
      }
      expect(entityTranslationFallbackLog(), `${lang} fallback log`).toHaveLength(0);
    }

    setLanguage('en');
  });

  it('should route class-detail damage ranges through localized templates', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/main.ts'), 'utf8');
    expect(source).toContain('abilityUi.tooltip.damageRange');
    expect(source).toContain('abilityUi.tooltip.finisherDamage');
    expect(source).not.toContain(' to ${primaryEffect.max}');
    expect(source).not.toContain(' plus ${primaryEffect.perCombo} per combo point');

    setLanguage('en');
    expect(t('abilityUi.tooltip.damageRange', { min: '16', max: '25' })).toContain('16');
    expect(t('abilityUi.tooltip.damageRange', { min: '16', max: '25' })).toContain('25');
  });

  it('should expose no missing entity translations across all entity groups', () => {
    const classAbilityMissing = missingEntityTranslationsForGroups(['classAbility']);
    expect(classAbilityMissing).toHaveLength(0);

    expect(missingEntityTranslationsForGroups(['classAbility', 'item'])).toHaveLength(0);
    expect(missingEntityTranslationsForGroups(['itemSet'])).toHaveLength(0);
    const missingWorld = missingEntityTranslationsForGroups(['world']);
    expect(missingWorld, JSON.stringify(missingWorld, null, 2)).toHaveLength(0);
    expect(
      missingEntityTranslationsForGroups(['classAbility', 'item', 'itemSet', 'world']),
    ).toHaveLength(0);
    expect(() => assertEntityTranslationsReady([])).not.toThrow();
    expect(() => assertEntityTranslationsReady(['classAbility'])).not.toThrow();
    expect(() => assertEntityTranslationsReady(['classAbility', 'item'])).not.toThrow();
    expect(() =>
      assertEntityTranslationsReady(['classAbility', 'item', 'itemSet', 'world']),
    ).not.toThrow();
  });

  it('keeps generated talent effect labels out of English fallback in translated locales', () => {
    const englishEffectFragments = [
      'damage-over-time damage',
      'heal-over-time healing',
      'melee haste',
      'pet damage',
      'damage redirected to pet',
    ];
    const descriptions = talentTranslationManifest().filter(
      (entry) => entry.field === 'description',
    );

    for (const lang of supportedLanguages) {
      if (lang === 'en' || lang === 'en_CA') continue;
      setLanguage(lang);
      const rendered = descriptions.map(renderTalentManifestEntry).join('\n').toLowerCase();
      for (const fragment of englishEffectFragments) {
        expect(rendered, `${lang}: copied English talent effect label ${fragment}`).not.toContain(
          fragment,
        );
      }
    }

    setLanguage('en');
  });

  it('renders the mobile Store label in every locale', () => {
    const expected: Record<SupportedLanguage, string> = {
      en: 'Store',
    };
    for (const lang of supportedLanguages) {
      setLanguage(lang);
      expect(t('hudChrome.mobile.dailyRewards'), lang).toBe(expected[lang]);
    }
    setLanguage('en');
  });

  it('should provide talent content translations for every supported locale', () => {
    const talentEntries = talentTranslationManifest();
    expect(talentEntries.length).toBeGreaterThan(250);
    expect(
      new Set(
        talentEntries.map(
          (entry) =>
            `${entry.kind}:${entry.classId}:${entry.specId ?? 'class'}:${entry.id}:${entry.field}`,
        ),
      ).size,
    ).toBe(talentEntries.length);

    for (const lang of supportedLanguages) {
      setLanguage(lang);
      for (const entry of talentEntries) {
        const rendered = renderTalentManifestEntry(entry);
        expect(rendered.trim().length, `${lang}.${entry.id}.${entry.field}`).toBeGreaterThan(0);
        expect(rendered, `${lang}.${entry.id}.${entry.field}`).not.toMatch(placeholderPattern);
        // RELEASE-TIER ONLY (copied-English talent content): an untranslated talent
        // renders the English fill on a PR (a `pending` row), blocked at release.
        if (RELEASE_TIER && lang !== 'en' && lang !== 'en_CA' && entry.field === 'description') {
          expect(
            copiedEnglishComparable(rendered),
            `${lang}.${entry.id}.${entry.field} should not copy canonical English talent prose`,
          ).not.toBe(copiedEnglishComparable(entry.source));
        }
        // Talent NAMES must not leak English either. A name may legitimately equal
        // English only when it is a deliberate cross-language cognate recorded as an
        // explicit titleOverride (e.g. French "Comeuppance", Spanish "Vigor"); a name that
        // matches English WITHOUT such an override is an accidental leak (e.g. a new
        // talent whose vocabulary the translation tables do not yet cover).
        if (
          RELEASE_TIER &&
          lang !== 'en' &&
          lang !== 'en_CA' &&
          entry.field === 'name' &&
          !hasTalentTitleOverride(lang, entry.source)
        ) {
          expect(
            copiedEnglishComparable(rendered),
            `${lang}.${entry.id}.name leaks English with no explicit titleOverride`,
          ).not.toBe(copiedEnglishComparable(entry.source));
        }
      }
    }

    // The release-tier block that stood here spot-checked real translated talent
    // strings in es / zh_CN / ko_KR. It went with the locale cut; the manifest
    // completeness loop above is what still runs, in English.
    setLanguage('en');
  });

  // Deed names and reward titles that legitimately equal English in a locale,
  // recorded as deliberate cross-language cognates (Veteran, Champion, Paragon,
  // and Gladiator are those languages' own words; Marginalia is Latin; nl keeps
  // the poker term Full House). This list IS the recording mechanism: a deed
  // name or title that matches English WITHOUT a row here is an accidental
  // leak at the release gate. Dialect locales list their rendered result
  // (es_ES and fr_CA resolve through their base tables plus overrides).
  const deedCognateAllowlist: Record<string, readonly string[]> = {
    es: ['soc_market_magnate.title'],
    es_ES: ['soc_market_magnate.title'],
    fr_FR: ['prog_champion.name', 'prog_champion.title', 'dlv_lore_journal.name'],
    fr_CA: ['prog_champion.name', 'prog_champion.title', 'dlv_lore_journal.name'],
    it_IT: ['soc_market_magnate.title'],
    de_DE: [
      'prog_veteran.name',
      'prog_veteran.title',
      'prog_champion.name',
      'prog_champion.title',
      'prog_paragon.name',
      'prog_paragon.title',
      'pvp_arena_1v1_1900.name',
      'pvp_arena_1v1_1900.title',
    ],
    pt_BR: ['prog_paragon.name', 'prog_paragon.title'],
    nl_NL: [
      'dlv_lore_journal.name',
      'pvp_arena_1v1_1900.name',
      'pvp_arena_1v1_1900.title',
      'soc_full_house.name',
    ],
    pl_PL: ['dlv_lore_journal.name', 'pvp_arena_1v1_1900.name', 'pvp_arena_1v1_1900.title'],
    id_ID: [
      'prog_veteran.name',
      'prog_veteran.title',
      'pvp_arena_1v1_1900.name',
      'pvp_arena_1v1_1900.title',
    ],
    sv_SE: [
      'prog_veteran.name',
      'prog_veteran.title',
      'pvp_arena_1v1_1900.name',
      'pvp_arena_1v1_1900.title',
    ],
    da_DK: [
      'prog_veteran.name',
      'prog_veteran.title',
      'pvp_arena_1v1_1900.name',
      'pvp_arena_1v1_1900.title',
    ],
  };

  it('should provide deed content translations for every supported locale', () => {
    const deedEntries = deedTranslationManifest();
    // name + desc per deed, plus one title entry per title deed (30 as of
    // Professions 2.0; tests/deeds_content.test.ts pins the count).
    expect(deedEntries.length).toBe(Object.keys(DEEDS).length * 2 + 30);

    for (const lang of supportedLanguages) {
      setLanguage(lang);
      for (const entry of deedEntries) {
        const rendered =
          entry.field === 'name'
            ? deedName(entry.id)
            : entry.field === 'desc'
              ? deedDesc(entry.id)
              : deedTitleText(entry.id);
        expect(rendered.trim().length, `${lang}.${entry.id}.${entry.field}`).toBeGreaterThan(0);
        // RELEASE-TIER ONLY (copied-English deed prose): an unfilled deed desc
        // renders the authored English fallback, which is legal on a PR (the
        // English-only contributor rule) and blocked only at the release gate.
        if (RELEASE_TIER && lang !== 'en' && lang !== 'en_CA' && entry.field === 'desc') {
          expect(
            copiedEnglishComparable(rendered),
            `${lang}.${entry.id}.desc should not copy canonical English deed prose`,
          ).not.toBe(copiedEnglishComparable(entry.source));
        }
        // Deed NAMES and reward TITLES must not leak English either. A value may
        // legitimately equal English only as a deliberate cross-language cognate
        // recorded in deedCognateAllowlist above; a match WITHOUT such a row is
        // an accidental leak (e.g. a new deed the locale tables do not yet cover).
        if (
          RELEASE_TIER &&
          lang !== 'en' &&
          lang !== 'en_CA' &&
          entry.field !== 'desc' &&
          !(deedCognateAllowlist[lang] ?? []).includes(`${entry.id}.${entry.field}`)
        ) {
          expect(
            copiedEnglishComparable(rendered),
            `${lang}.${entry.id}.${entry.field} leaks English with no deedCognateAllowlist row`,
          ).not.toBe(copiedEnglishComparable(entry.source));
        }
      }
      // The five milestone titles are locked to the established game.milestone.*
      // renderings in every locale (milestones unified into deeds: one prestige
      // system, one vocabulary).
      for (const [deedId, milestoneKey] of [
        ['prog_veteran', 'game.milestone.veteran'],
        ['prog_champion', 'game.milestone.champion'],
        ['prog_paragon', 'game.milestone.paragon'],
        ['prog_mythic', 'game.milestone.mythic'],
        ['prog_eternal', 'game.milestone.eternal'],
      ] as [string, TranslationKey][]) {
        expect(deedTitleText(deedId), `${lang} ${deedId} title`).toBe(t(milestoneKey));
      }
    }

    // Real-translation spot pins (these would render the English fill if the
    // locale tables were dropped or the language wiring broke).
    setLanguage('en');
  });

  // RELEASE-TIER ONLY: real quest-narrative content checks. A sparse /
  // English-only overlay renders the English fill for an untranslated quest (legal
  // on a PR as a `pending` row, blocked at the release gate), so the generic-template
  // and per-locale-diversity assertions are release-only.

  // A release-tier block stood here pinning real translated quest narratives in ten
  // locales, and beside it a sweep asserting the non-Latin scripts never left the raw
  // Latin word "Wyrm" in quest prose. Both needed locales that no longer ship.

  it('should keep Traditional Chinese world content out of Simplified-only shortcuts', () => {
    const simplifiedOnlyCharacters =
      /[颚猪网潜强盗宁无钳鱼妇贪鲁唤师执荆军风领热灵蹒垒缚仆骑挥雾维圣卫复这门进队战击个补桥吗块环声钥]/;
    const worldEntries = entityTranslationManifest().filter((entry) => entry.group === 'world');

    setLanguage('en');
  });

  it('should keep the entity resolver out of simulation and server modules', () => {
    for (const file of [...sourceFilesUnder('src/sim'), ...sourceFilesUnder('server')]) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/(?:from|import)\s+["'][^"']*ui\/(?:i18n|entity_i18n)["']/);
    }
  });

  it('should route rendered world-content labels through localized entity helpers', () => {
    const hudSource = fs.readFileSync(path.resolve(process.cwd(), 'src/ui/hud.ts'), 'utf8');
    expect(hudSource).toContain('zoneDisplayName');
    // The overworld #zone-label write moved into minimap_painter: hud wires
    // zoneDisplayName into the painter, and the painter writes the label through the
    // elided setText. The localization is preserved, just relocated.
    expect(hudSource).toContain('zoneDisplayName(zoneId)');
    const minimapPainterSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/ui/minimap_painter.ts'),
      'utf8',
    );
    expect(minimapPainterSource).toContain('this.writers.setText(zoneLabelEl, this.localizeZone(');
    expect(hudSource).toContain('zonePoiLabel');
    expect(hudSource).toContain('dungeonDisplayNameFromSource');
    expect(hudSource).not.toContain('zoneWelcomeText(');

    const rendererSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/render/renderer.ts'),
      'utf8',
    );
    // objectDisplayName still localizes the build-time object nameplate write in the
    // renderer; the helper itself moved into entity_labels.ts.
    expect(rendererSource).toContain('objectDisplayName');
    // The per-entity nameplate content (corpse/mob names) moved into the
    // NameplatePainter; localization is preserved, just relocated (mirrors the
    // minimap_painter zone-label move above).
    const nameplatePainterSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/render/nameplate_painter.ts'),
      'utf8',
    );
    expect(nameplatePainterSource).toContain('objectDisplayName');
    expect(nameplatePainterSource).toContain('worldContent.corpseName');
    expect(nameplatePainterSource).not.toContain('`${e.name} (corpse)`');
  });

  it('should preserve and render every HUD interpolation placeholder in every locale', () => {
    const hudDynamicKeys = flattenStrings(en.hud, 'hud')
      .map(({ key, value }) => ({ key, expected: placeholders(value) }))
      .filter(({ expected }) => expected.length > 0);
    const allLocales: Record<string, typeof en> = { en, ...locales };

    for (const { key, expected } of hudDynamicKeys) {
      for (const [lang, locale] of Object.entries(allLocales)) {
        const template = nestedString(locale, key);
        expect(placeholders(template), `${lang}.${key} placeholders`).toEqual(expected);
        expect(isSupportedLanguage(lang)).toBe(true);
        if (!isSupportedLanguage(lang)) continue;
        setLanguage(lang);
        const rendered = t(key, interpolationValues);
        expect(rendered, `${lang}.${key} should not leave placeholders unresolved`).not.toMatch(
          /\{[A-Za-z][A-Za-z0-9]*\}/,
        );
        for (const placeholder of expected) {
          expect(rendered, `${lang}.${key} should include ${placeholder}`).toContain(
            String(interpolationValues[placeholder]),
          );
        }
      }
    }

    setLanguage('en');
  });

  it('should preserve and render every ability UI interpolation placeholder in every locale', () => {
    const abilityDynamicKeys = flattenStrings(en.abilityUi, 'abilityUi')
      .map(({ key, value }) => ({ key, expected: placeholders(value) }))
      .filter(({ expected }) => expected.length > 0);
    const allLocales: Record<string, typeof en> = { en, ...locales };

    for (const { key, expected } of abilityDynamicKeys) {
      for (const [lang, locale] of Object.entries(allLocales)) {
        const template = nestedString(locale, key);
        expect(placeholders(template), `${lang}.${key} placeholders`).toEqual(expected);
        expect(isSupportedLanguage(lang)).toBe(true);
        if (!isSupportedLanguage(lang)) continue;
        setLanguage(lang);
        const rendered = t(key, interpolationValues);
        expect(rendered, `${lang}.${key} should not leave placeholders unresolved`).not.toMatch(
          /\{[A-Za-z][A-Za-z0-9]*\}/,
        );
        for (const placeholder of expected) {
          expect(rendered, `${lang}.${key} should include ${placeholder}`).toContain(
            String(interpolationValues[placeholder]),
          );
        }
      }
    }

    setLanguage('en');
  });

  it('should preserve and render every quest UI interpolation placeholder in every locale', () => {
    const questDynamicKeys = flattenStrings(en.questUi, 'questUi')
      .map(({ key, value }) => ({ key, expected: placeholders(value) }))
      .filter(({ expected }) => expected.length > 0);
    const allLocales: Record<string, typeof en> = { en, ...locales };

    for (const { key, expected } of questDynamicKeys) {
      for (const [lang, locale] of Object.entries(allLocales)) {
        const template = nestedString(locale, key);
        expect(placeholders(template), `${lang}.${key} placeholders`).toEqual(expected);
        expect(isSupportedLanguage(lang)).toBe(true);
        if (!isSupportedLanguage(lang)) continue;
        setLanguage(lang);
        const rendered = t(key, interpolationValues);
        expect(rendered, `${lang}.${key} should not leave placeholders unresolved`).not.toMatch(
          /\{[A-Za-z][A-Za-z0-9]*\}/,
        );
        for (const placeholder of expected) {
          expect(rendered, `${lang}.${key} should include ${placeholder}`).toContain(
            String(interpolationValues[placeholder]),
          );
        }
      }
    }

    setLanguage('en');
  });

  it('should preserve and render every item UI interpolation placeholder in every locale', () => {
    const itemDynamicKeys = flattenStrings(en.itemUi, 'itemUi')
      .map(({ key, value }) => ({ key, expected: placeholders(value) }))
      .filter(({ expected }) => expected.length > 0);
    const allLocales: Record<string, typeof en> = { en, ...locales };

    for (const { key, expected } of itemDynamicKeys) {
      for (const [lang, locale] of Object.entries(allLocales)) {
        const template = nestedString(locale, key);
        expect(placeholders(template), `${lang}.${key} placeholders`).toEqual(expected);
        expect(isSupportedLanguage(lang)).toBe(true);
        if (!isSupportedLanguage(lang)) continue;
        setLanguage(lang);
        const rendered = t(key, interpolationValues);
        expect(rendered, `${lang}.${key} should not leave placeholders unresolved`).not.toMatch(
          /\{[A-Za-z][A-Za-z0-9]*\}/,
        );
        for (const placeholder of expected) {
          expect(rendered, `${lang}.${key} should include ${placeholder}`).toContain(
            String(interpolationValues[placeholder]),
          );
        }
      }
    }

    setLanguage('en');
  });

  // These four kept their teeth through the locale cut. They never asserted a
  // TRANSLATION — they assert that every dynamic value survives interpolation into
  // the template, which is a property of interpolate(), not of any locale. The
  // originals switched locale only to prove it held everywhere; English alone still
  // catches a dropped or renamed token.
  it('should interpolate combat, chat, and log templates without dropping values', () => {
    setLanguage('en');
    expect(
      t('hud.combat.damageDoneCrit', { ability: 'Fireball', target: 'Wolf', amount: 42 }),
    ).toContain('42');
    expect(t('hud.errors.chatCooldown', { seconds: 7 })).toContain('7');

    const guildChat = t('hud.chat.templates.guild', { name: 'Aki', message: 'regroup' });
    expect(guildChat).toContain('Aki');
    expect(guildChat).toContain('regroup');

    expect(t('hud.logs.lootReceiveItem', { item: 'Rough Bracers' })).toContain('Rough Bracers');
  });

  it('should format ability tooltip templates without dropping dynamic values', () => {
    setLanguage('en');
    expect(t('abilityUi.tooltip.cooldownSeconds', { seconds: 8 })).toContain('8');
    expect(t('abilityUi.spellbook.trainableAtLevel', { level: 10 })).toContain('10');

    const knownAbility = t('abilityUi.spellbook.knownAbilityAria', {
      name: 'Fireball',
      rank: 2,
      summary: '30 Mana / Instant',
    });
    expect(knownAbility).toContain('Fireball');
    expect(knownAbility).toContain('2');

    const finisher = t('abilityUi.tooltip.finisherDamage', { base: 14, perCombo: 7 });
    expect(finisher).toContain('14');
    expect(finisher).toContain('7');
  });

  it('should format quest UI templates without dropping dynamic values', () => {
    setLanguage('en');
    expect(t('questUi.log.summary', { active: 3, completed: 8 })).toContain('3');
    expect(t('questUi.log.summary', { active: 3, completed: 8 })).toContain('8');
    expect(t('questUi.dialog.availableQuestAria', { name: 'A Swift Response' })).toContain(
      'A Swift Response',
    );

    const progress = t('questUi.detail.objectiveProgress', {
      label: 'Forest Wolves slain',
      current: 4,
      total: 8,
    });
    expect(progress).toContain('Forest Wolves slain');
    expect(progress).toContain('4');
    expect(progress).toContain('8');
  });

  it('should format item UI and money helpers without dropping dynamic values', () => {
    setLanguage('en');
    expect(t('itemUi.vendor.goodsTitle', { name: 'Haldren' })).toContain('Haldren');
    expect(t('itemUi.market.sellNote', { cut: 5, used: 2, max: 12 })).toContain('5');
    // formatMoney splits copper into gold/silver/copper; the shape is locale-aware
    // but the split is not, so the three components must all survive.
    const money = formatMoney(123456);
    expect(money).toContain('12');
    expect(money).toContain('34');
    expect(money).toContain('56');

    const sold = t('itemUi.logs.sellerSold', {
      buyer: 'Mira',
      item: 'Cracked Wolf Fang',
      money: '1g',
    });
    expect(sold).toContain('Mira');
    expect(sold).toContain('Cracked Wolf Fang');
  });

  it('should expose all supported hreflang alternates in index.html', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const expectedHreflang = [...supportedLanguages.map((lang) => languageTag(lang)), 'x-default'];
    for (const hreflang of expectedHreflang) {
      expect(html, `missing hreflang ${hreflang}`).toContain(`hreflang="${hreflang}"`);
    }
    expect(html).toContain('data-i18n-content="seo.description"');
    expect(html).toContain('data-i18n-placeholder="hud.core.chatPlaceholder"');
    // The chat tabs (Chat / Combat Log / per-channel) are rendered by the HUD
    // via t() rather than static markup, so #chatlog-tabs is an empty tablist
    // here. Its labels are localized in hud.ts (initChatTabs), not in index.html.
    expect(html).toContain('id="chatlog-tabs"');
    expect(html).toContain('data-i18n="entities.zones.eastbrook_vale.name"');
    expect(html).toContain('data-i18n-title="itemUi.bags.title"');
    expect(html).toContain('data-i18n-aria="hud.core.mobileControls"');
    expect(html).toContain('data-i18n="hud.core.mobileMove"');
    expect(html).toContain('data-i18n="hud.core.mobileCamera"');
    // #mobile-target-cycle is the ring's Target swap helper (it replaced the
    // Target Closest button when acquire-nearest moved onto the ring's own
    // #mobile-action-attack toggle), so its copy lives at
    // hudChrome.mobile.targetCycleShort.
    expect(html).toContain('data-i18n="hudChrome.mobile.targetCycleShort"');
    // The old bottom-centre Target button stays removed (the ring's Target
    // swap is the one target-cycling helper); hud.core.mobileTarget stays in
    // the catalog (the hudKeys existence list above) but no longer appears in
    // the markup.
    expect(html).not.toContain('data-i18n="hud.core.mobileTarget"');
    expect(html).toContain('data-i18n="hud.core.mobileChat"');
    expect(html).toContain('data-i18n="hud.core.mobileMore"');
    expect(html).toContain('data-i18n="hud.core.mobileSocial"');
    expect(html).toContain('data-i18n="hud.core.mobileArena"');
    // The Settings button (promoted to the bar between Social and More) uses
    // mobileSettings ("Settings"); the old mobileMenu ("Menu") key stays in the
    // catalog but, like mobileTarget, no longer appears in the markup.
    expect(html).toContain('data-i18n="hud.core.mobileSettings"');
    expect(html).not.toContain('data-i18n="hud.core.mobileMenu"');
    // The Quests button reuses the tracker's "Quests" label rather than the
    // longer "Quest Log" title.
    expect(html).toContain('data-i18n="questUi.tracker.title"');
    expect(html).toContain('data-i18n="hud.core.mobileUse"');
    // Note: the v0.7 layout moved damage meters from a mobile tray button to a
    // dedicated #meters-window, so there is no longer a mobile-meters button to
    // localize here (see client_shell.test.ts, which asserts no id="mobile-meters").
    expect(html).toContain('data-i18n="hud.core.mobileMap"');
    expect(html).toContain('data-i18n-title="hud.core.closeMap"');
    expect(html).toContain('id="structured-data"');
  });
});
