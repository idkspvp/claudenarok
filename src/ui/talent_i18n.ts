import {
  type ClassTalents,
  type GlobalModEffect,
  type ProcDef,
  ROW_TREES,
  type Role,
  rowTreeFor,
  type SpecDef,
  type StatModEffect,
  TALENTS,
  type TalentEffect,
  type TalentRowOption,
} from '../sim/content/talents';
import { ABILITIES, CLASSES } from '../sim/data';
import type { AbilityEffect, PlayerClass } from '../sim/types';
import { tEntity } from './entity_i18n';
import {
  getLanguage,
  type InterpolationValues,
  isAuthoredEnglish,
  languageTag,
  type SupportedLanguage,
  t,
} from './i18n';

// Localized UI label for a spec's combat role (tank/healer/dps). Shared by the
// talents window (spec cards) and the character sheet's spec summary so the role
// name reads identically in both. Distinct from the lowercased role words used to
// generate talent descriptions (localeText.roleLabels below).
export function roleLabel(role: Role): string {
  return role === 'tank'
    ? t('game.talents.roleTank')
    : role === 'healer'
      ? t('game.talents.roleHealer')
      : t('game.talents.roleDps');
}

export type TalentTranslationKind = 'talentChoice' | 'talentSpec' | 'talentMastery';
export type TalentTranslationField = 'name' | 'description';

export type TalentTranslationRequest =
  | { kind: 'talentChoice'; choice: TalentRowOption; field: TalentTranslationField }
  | { kind: 'talentSpec'; spec: SpecDef; field: TalentTranslationField }
  | { kind: 'talentMastery'; spec: SpecDef; field: TalentTranslationField };

export interface TalentTranslationManifestEntry {
  kind: TalentTranslationKind;
  id: string;
  classId: PlayerClass;
  specId?: string;
  field: TalentTranslationField;
  source: string;
}

type StatKey = keyof StatModEffect;
type GlobalKey = keyof GlobalModEffect;
type DisplayGlobalKey = Exclude<
  GlobalKey,
  | 'critVsRooted'
  | 'moonwingPartyCritPct'
  | 'autoRagePct'
  | 'abilityRagePct'
  | 'onKillSpeedPct'
  | 'onKillSpeedDuration'
  | 'secondWindPctPerSec'
  | 'battleRhythm'
  | 'bloodbathPct'
  | 'bloodbathDuration'
  | 'bloodbathMaxPct'
  | 'cdrPerRage'
  | 'stanceMastery'
  | 'fearBreakPct'
  | 'masteryTwoHandDmgPct'
  | 'cheatDeathIcd'
  | 'barrierDrPct'
  | 'manaDefCdrPer10'
  | 'blinkCast'
  | 'convergence'
  | 'ignitionPct'
  | 'manaPct'
  | 'manaRegenPct'
>;

const NON_DISPLAY_GLOBALS = new Set<GlobalKey>([
  'critVsRooted',
  'autoRagePct',
  'abilityRagePct',
  'onKillSpeedPct',
  'onKillSpeedDuration',
  'secondWindPctPerSec',
  'battleRhythm',
  'bloodbathPct',
  'bloodbathDuration',
  'bloodbathMaxPct',
  'cdrPerRage',
  'stanceMastery',
  'fearBreakPct',
  'masteryTwoHandDmgPct',
  'cheatDeathIcd',
  'barrierDrPct',
  'manaDefCdrPer10',
  'blinkCast',
  'convergence',
  'ignitionPct',
  'manaPct',
  'manaRegenPct',
]);

export interface TalentLocaleText {
  // Primary-attribute multipliers (strPct/agiPct/intPct/dexPct/lukPct) reuse their base stat
  // label ("+10% Agility"), so locales don't repeat them here. armorFromStrPct is
  // likewise excluded: it appears only in the Protection mastery, which carries its
  // own written description, so no auto-generated stat label is ever needed for it.
  statLabels: Record<
    | Exclude<StatKey, 'strPct' | 'agiPct' | 'intPct' | 'dexPct' | 'lukPct' | 'armorFromStrPct'>
    | DisplayGlobalKey
    | 'damage'
    | 'cost'
    | 'cooldown'
    | 'castTime',
    string
  >;
  roleLabels: Record<'tank' | 'healer' | 'dps', string>;
  perRank: string;
  noEffect: string;
  chooseOne: (name: string) => string;
  specDescription: (className: string, role: string, abilityName: string) => string;
  // Hand-authored flavor prose per spec id, keyed exactly like the English
  // SpecDef.description. Spec descriptions carry no numbers, so unlike node/mastery
  // text they never drift from the effect and are safe to translate by hand. A locale
  // that omits a spec id (or omits the map entirely) falls back to specDescription().
  specDescriptions?: Record<string, string>;
  // Hand-authored mastery prose per spec id, for masteries whose bonus is applied at
  // runtime (e.g. Master Armorer's 2H-gated damage) so the effect object is empty and
  // effectDescription() would otherwise fall back to the generic noEffect string.
  masteryDescriptions?: Record<string, string>;
  grant: (abilityName: string) => string;
  increase: (target: string, amount: string, perRank: string) => string;
  reduce: (target: string, amount: string, perRank: string) => string;
}

const abilityIdByName = new Map(
  Object.values(ABILITIES).map((ability) => [ability.name, ability.id]),
);
const grantAbilityIdByTitle = new Map(
  Object.values(ROW_TREES).flatMap((rows) =>
    rows.flatMap((row) =>
      row.options.flatMap((option) => {
        const abilityId = option.effect.grant?.ability;
        return abilityId ? ([[option.name, abilityId]] as const) : [];
      }),
    ),
  ),
);

const enText: TalentLocaleText = {
  statLabels: {
    str: 'Strength',
    agi: 'Agility',
    vit: 'Vitality',
    int: 'Intelligence',
    dex: 'Dexterity',
    luk: 'Luck',
    armor: 'armor',
    ap: 'attack power',
    crit: 'critical strike chance',
    dodge: 'dodge chance',
    apPct: 'attack power',
    vitPct: 'Vitality',
    armorPct: 'armor',
    maxHpPct: 'maximum health',
    meleeDmgPct: 'melee ability damage',
    spellDmgPct: 'spell damage',
    healPct: 'healing done',
    threatPct: 'threat generated',
    critDmgSpellPct: 'critical strike damage',
    critDmgPhysPct: 'critical strike damage',
    critDmgHealPct: 'critical strike damage',
    spellHastePct: 'spell haste',
    dotDmgPct: 'damage-over-time damage',
    hotHealPct: 'heal-over-time healing',
    absorbPct: 'absorption',
    meleeHastePct: 'melee haste',
    extraAttackPct: 'extra attack chance',
    petDmgPct: 'pet damage',
    petDmgSharePct: 'damage redirected to pet',
    damage: 'damage',
    cost: 'cost',
    cooldown: 'cooldown',
    castTime: 'cast time',
  },
  roleLabels: { tank: 'tank', healer: 'healer', dps: 'damage' },
  perRank: ' per rank',
  noEffect: 'Provides a specialization benefit.',
  specDescriptions: {
    fire: 'A master of flame who chains critical strikes into devastating explosions. Fast, aggressive, and capable of igniting many enemies.',
    frost:
      'A spellcaster who controls the battlefield with ice, slows, and freezes. They build glacial power to destroy enemies with precise attacks.',
    arcane:
      'A mage who manipulates time and aether to protect allies. They can anticipate wounds, repeat healing, and reverse damage before it is too late.',
  },
  chooseOne: (name) => `Choose one ${name} option.`,
  specDescription: (className, role, abilityName) =>
    `${className} specialization focused on ${role}. Signature ability: ${abilityName}.`,
  grant: (abilityName) => `Grants ${abilityName}.`,
  increase: (target, amount, perRank) => `Increases ${target} by ${amount}${perRank}.`,
  reduce: (target, amount, perRank) => `Reduces ${target} by ${amount}${perRank}.`,
};

// The non-dialect locales. es_ES and fr_CA are not declared here; they are pure
// dialect aliases assembled into `localeText` below (no `{} as` cast).
const localeTextByBase = {
  en: enText,
} satisfies Record<SupportedLanguage, TalentLocaleText>;

// es_ES and fr_CA are pure dialect aliases of their base locale (declared base:
// es_ES->es, fr_CA->fr_FR), matching the main translation table's dialect model.
// They inherit the base's talent text verbatim, so the value is the base object
// itself - no `{} as TalentLocaleText` cast and no post-hoc reassignment.
const localeText: Record<SupportedLanguage, TalentLocaleText> = localeTextByBase;

// Single authoritative table of per-name talent-title translations using official
// classic-MMO terminology. translateTitle() consults this after ability-name
// resolution. To add a talent or locale, add its localized name here for each
// locale — there is no secondary additions/corrections layer.
// Emptied with the locale cut: every entry here was a non-English talent-title
// translation. translateTitle() returns early for English, so the lookup below is
// dead until a second locale lands and this table is repopulated.
const titleOverrides: Partial<Record<SupportedLanguage, Record<string, string>>> = {};

function talentClassData(): ClassTalents[] {
  return Object.values(TALENTS).filter((ct): ct is ClassTalents => ct !== undefined);
}

function formatNumber(value: number, lang: SupportedLanguage): string {
  return new Intl.NumberFormat(languageTag(lang), { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number, lang: SupportedLanguage): string {
  // Intl percent style applies the locale's percent spacing/placement (e.g. fr/de/es/ru
  // render "5 %" with a no-break space, en/it/CJK render "5%"). `value` is a fraction, so
  // pass it directly rather than pre-multiplying and appending a raw "%". Mirrors the HUD
  // settings percent renderer in hud.ts.
  return new Intl.NumberFormat(languageTag(lang), {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
}

function statAmount(stat: StatKey, value: number, lang: SupportedLanguage): string {
  return stat === 'crit' || stat === 'dodge' || stat.endsWith('Pct')
    ? formatPercent(value, lang)
    : formatNumber(Math.abs(value), lang);
}

function translateTitle(source: string, lang: SupportedLanguage): string {
  if (isAuthoredEnglish(lang)) return source;
  const abilityId = abilityIdByName.get(source) ?? grantAbilityIdByTitle.get(source);
  if (abilityId) {
    const abilityTitle = tEntity({ kind: 'ability', id: abilityId, field: 'name' });
    if (abilityTitle !== source) return abilityTitle;
  }
  const override = titleOverrides[lang]?.[source];
  if (override !== undefined) return override;
  // Every shipped talent name has an explicit override (enforced by tests) or is an
  // ability name (resolved above). A bare return here only triggers for a newly-added
  // talent that still needs a localized override — clean English is preferable to a
  // broken word-by-word guess, and the leak-guard test flags it for translation.
  return source;
}

function abilityName(id: string): string {
  return tEntity({ kind: 'ability', id, field: 'name' });
}

type GrantEffectShape = {
  type: string;
  min?: number;
  max?: number;
  amount?: number;
  total?: number;
  value?: number;
  mult?: number;
  duration?: number;
  interval?: number;
  radius?: number;
  jumps?: number;
  falloff?: number;
  kind?: string;
};

function grantAmountRange(min: number, max: number, lang: SupportedLanguage): string {
  const minText = formatNumber(min, lang);
  const maxText = formatNumber(max, lang);
  return min === max ? minText : t('abilityUi.tooltip.damageRange', { min: minText, max: maxText });
}

export function grantAbilityValues(id: string): InterpolationValues {
  const def = ABILITIES[id];
  const effects = (def?.effects ?? []) as GrantEffectShape[];
  const lang = getLanguage();
  const values: Record<string, string> = {};
  const chain = effects.find((effect) => effect.type === 'chainDamage');
  const direct = effects.find((effect) =>
    ['directDamage', 'aoeDamage', 'heal', 'aoeHeal', 'drainTick', 'groundAoE'].includes(
      effect.type,
    ),
  );
  const ground = effects.find((effect) => effect.type === 'groundAoE');
  const absorb = effects.find((effect) => effect.type === 'absorb');
  const overTime = effects.find((effect) => effect.type === 'dot' || effect.type === 'hot');
  const resource = effects.find((effect) => effect.type === 'gainResource');
  const buff = effects.find((effect) => effect.type === 'selfBuff' || effect.type === 'buffTarget');
  const allyAttackPower = effects.find((effect) => effect.type === 'aoeAllyAttackPower');
  const allyHaste = effects.find((effect) => effect.type === 'aoeAllyHaste');
  const timed = effects.find((effect) => typeof effect.duration === 'number');

  if (chain?.min !== undefined && chain.max !== undefined) {
    values.min = formatNumber(chain.min, lang);
    values.max = formatNumber(chain.max, lang);
    values.damage = grantAmountRange(chain.min, chain.max, lang);
    if (chain.jumps !== undefined) values.jumps = formatNumber(chain.jumps, lang);
    if (chain.falloff !== undefined) values.falloff = formatPercent(chain.falloff, lang);
    if (chain.radius !== undefined) values.radius = formatNumber(chain.radius, lang);
  } else if (direct?.min !== undefined && direct.max !== undefined) {
    values.min = formatNumber(direct.min, lang);
    values.max = formatNumber(direct.max, lang);
    values.damage = grantAmountRange(direct.min, direct.max, lang);
  }

  if (absorb?.amount !== undefined) {
    const amount = formatNumber(absorb.amount, lang);
    values.amount = amount;
    if (values.damage === undefined) values.damage = amount;
  }
  if (overTime?.total !== undefined) {
    const total = formatNumber(overTime.total, lang);
    values.overTime = total;
    if (values.damage === undefined) values.damage = total;
  }
  if (ground?.min !== undefined && ground.max !== undefined) {
    values.overTime = grantAmountRange(ground.min, ground.max, lang);
  }
  if (resource?.amount !== undefined) values.amount = formatNumber(resource.amount, lang);
  if (buff?.value !== undefined) values.buff = formatNumber(buff.value, lang);
  if (allyAttackPower?.amount !== undefined) {
    values.buff = formatNumber(allyAttackPower.amount, lang);
  }
  if (allyHaste?.mult !== undefined && values.buff === undefined) {
    values.buff = formatPercent(allyHaste.mult - 1, lang);
  }
  for (const effect of effects) {
    if (effect.type !== 'selfBuff' || effect.value === undefined) continue;
    if (effect.kind === 'buff_ap') values.attackPower = formatNumber(effect.value, lang);
    if (effect.kind === 'buff_spellpower') values.spellPower = formatNumber(effect.value, lang);
  }

  const duration = timed?.duration ?? def?.channel?.duration;
  if (duration !== undefined) values.duration = formatNumber(duration, lang);
  const interval = ground?.interval ?? overTime?.interval;
  if (interval !== undefined) values.interval = formatNumber(interval, lang);
  const radius =
    chain?.radius ??
    ground?.radius ??
    allyAttackPower?.radius ??
    allyHaste?.radius ??
    direct?.radius;
  if (radius !== undefined) values.radius = formatNumber(radius, lang);
  return values;
}

function grantResourceName(id: string): string | null {
  const cls = ABILITIES[id]?.class;
  const resource = cls ? CLASSES[cls]?.resourceType : null;
  if (resource === 'mana') return t('abilityUi.resources.mana');
  if (resource === 'rage') return t('abilityUi.resources.rage');
  if (resource === 'energy') return t('abilityUi.resources.energy');
  return null;
}

export function grantAbilityMetadata(id: string): string {
  const def = ABILITIES[id];
  if (!def) return '';
  const lang = getLanguage();
  const parts: string[] = [];
  const resource = grantResourceName(id);
  if (def.cost > 0 && resource) {
    parts.push(t('abilityUi.tooltip.cost', { cost: formatNumber(def.cost, lang), resource }));
  }
  if (def.channel) {
    parts.push(
      t('abilityUi.tooltip.channeledSeconds', {
        seconds: formatNumber(def.channel.duration, lang),
      }),
    );
  } else if (def.castTime > 0) {
    parts.push(t('abilityUi.tooltip.castSeconds', { seconds: formatNumber(def.castTime, lang) }));
  } else {
    parts.push(t('abilityUi.tooltip.instant'));
  }
  if (def.range > 0) {
    parts.push(
      def.minRange !== undefined
        ? t('abilityUi.tooltip.rangeWithMin', {
            min: formatNumber(def.minRange, lang),
            max: formatNumber(def.range, lang),
          })
        : t('abilityUi.tooltip.range', { range: formatNumber(def.range, lang) }),
    );
  }
  if (def.cooldown > 0) {
    parts.push(
      t('abilityUi.tooltip.cooldownSeconds', {
        seconds: formatNumber(def.cooldown, lang),
      }),
    );
  }
  return parts.join(' · ');
}

function abilityDescription(id: string): string {
  return tEntity({ kind: 'ability', id, field: 'description', values: grantAbilityValues(id) })
    .replace(/\s*\([^)]*(?:talent|signature)[^)]*\)\.?\s*$/i, '')
    .trim();
}

function authoredChoiceDescription(choice: TalentRowOption): string {
  const grantId = choice.effect.grant?.ability;
  if (!grantId) return choice.description;
  return [abilityDescription(grantId), grantAbilityMetadata(grantId)].filter(Boolean).join(' ');
}

function seconds(value: number, lang: SupportedLanguage): string {
  return `${formatNumber(value, lang)} s`;
}

function abilityList(ids: readonly string[] | undefined): string {
  return ids && ids.length > 0 ? ids.map(abilityName).join(' / ') : '*';
}

function procTriggerDescription(
  proc: ProcDef,
  lang: SupportedLanguage,
  text: TalentLocaleText,
): string {
  const trigger = proc.trigger;
  switch (trigger.on) {
    case 'castNth':
      return `${abilityList(trigger.abilities)}${trigger.n > 1 ? ` x${trigger.n}` : ''}`;
    case 'spellCrit':
      return `${text.statLabels.crit}: ${abilityList(trigger.abilities)}`;
    case 'shieldConsumed':
      return `${abilityName(trigger.ability)}: ${t('hudChrome.auraEffect.absorb', { value: '0' })}`;
    case 'hotExpired':
      return `${abilityName(trigger.ability)}: 0 s`;
    case 'bigHitTaken':
      return `>= ${formatPercent(trigger.hpFrac, lang)} ${text.statLabels.maxHpPct} (${seconds(trigger.icd, lang)} ${text.statLabels.cooldown})`;
    case 'meleeSwingWhile':
      return `${text.statLabels.meleeDmgPct} @ ${t('hudChrome.auraEffect.imbue')}`;
    case 'thornsReflect':
      return `${abilityName(trigger.ability)}: ${t('guide.abilityHook.thorns')}`;
  }
}

function procResponseDescription(
  response: ProcDef['responses'][number],
  lang: SupportedLanguage,
  text: TalentLocaleText,
): string {
  switch (response.kind) {
    case 'empowerNext': {
      const name = abilityList(response.abilities);
      const window = `(${seconds(response.duration, lang)})`;
      if (response.aura === 'next_cast_instant') {
        return `${name}: -${formatPercent(1, lang)} ${text.statLabels.castTime} ${window}`;
      }
      const reduction = response.aura === 'next_cast_free' ? 1 : (response.costPct ?? 0);
      return `${name}: -${formatPercent(reduction, lang)} ${text.statLabels.cost} ${window}`;
    }
    case 'cooldownRefund':
      return `${abilityName(response.ability)}: -${response.seconds === 'reset' ? formatPercent(1, lang) : seconds(response.seconds, lang)} ${text.statLabels.cooldown}`;
    case 'resource':
      return `+${formatNumber(response.amount, lang)} ${t('classDetails.labels.resource')}`;
    case 'heal': {
      const healValue =
        response.amountPctSourceMaxHp !== undefined
          ? `${formatPercent(response.amountPctSourceMaxHp, lang)} ${text.statLabels.maxHpPct}`
          : response.amountPctMaxHp !== undefined
            ? `${formatPercent(response.amountPctMaxHp, lang)} ${text.statLabels.maxHpPct}`
            : formatNumber(response.amount ?? 0, lang);
      return `+${healValue} ${t('hud.meters.healing')}`;
    }
    case 'absorb': {
      const absorbValue =
        response.amountPctMaxHp !== undefined
          ? `${formatPercent(response.amountPctMaxHp, lang)} ${text.statLabels.maxHpPct}`
          : formatNumber(response.amount ?? 0, lang);
      return `${t('hudChrome.auraEffect.absorb', { value: absorbValue })} (${seconds(response.duration, lang)})`;
    }
    case 'aura': {
      // Multiplier-shaped kinds (buff_speed 1.4 = +40%) render their delta;
      // additive kinds render the raw fraction.
      const multiplierShaped =
        response.auraKind === 'buff_speed' || response.auraKind === 'buff_haste';
      const fraction = multiplierShaped ? response.value - 1 : response.value;
      return `+${formatPercent(fraction, lang)} (${seconds(response.duration, lang)})`;
    }
    case 'echo': {
      const echoValue =
        response.healPctMaxHp !== undefined
          ? `${formatPercent(response.healPctMaxHp, lang)} ${text.statLabels.maxHpPct}`
          : formatNumber(response.heal ?? 0, lang);
      return `+${echoValue} ${t('hud.meters.healing')} @ <= ${formatPercent(response.belowFrac, lang)} ${text.statLabels.maxHpPct} (${seconds(response.window, lang)})`;
    }
  }
}

function procDescription(proc: ProcDef, lang: SupportedLanguage, text: TalentLocaleText): string {
  const trigger = procTriggerDescription(proc, lang, text);
  const responses = proc.responses
    .map((response) => procResponseDescription(response, lang, text))
    .join('; ');
  return `${trigger} -> ${responses}.`;
}

type DescribedAddedEffect = Extract<
  AbilityEffect,
  {
    type: 'root' | 'aoeRoot' | 'slow' | 'absorb' | 'dot' | 'extendDot' | 'interrupt' | 'consumeDot';
  }
>;

function assertDescribedAddedEffect(effect: AbilityEffect): asserts effect is DescribedAddedEffect {
  if (
    effect.type !== 'root' &&
    effect.type !== 'aoeRoot' &&
    effect.type !== 'slow' &&
    effect.type !== 'absorb' &&
    effect.type !== 'dot' &&
    effect.type !== 'extendDot' &&
    effect.type !== 'interrupt' &&
    effect.type !== 'consumeDot'
  ) {
    throw new Error(`Unsupported talent rider effect: ${effect.type}`);
  }
}

function addedEffectDescription(
  sourceAbility: string,
  effect: AbilityEffect,
  lang: SupportedLanguage,
  text: TalentLocaleText,
): string {
  assertDescribedAddedEffect(effect);
  const name = abilityName(sourceAbility);
  switch (effect.type) {
    case 'root':
      return `${name}: ${t('hudChrome.auraEffect.root')} (${seconds(effect.duration, lang)}).`;
    case 'aoeRoot':
      return `${name}: ${t('hudChrome.auraEffect.root')} (${seconds(effect.duration, lang)}; r=${formatNumber(effect.radius, lang)}).`;
    case 'slow':
      return `${name}: ${t('hudChrome.auraEffect.slow', { pct: formatNumber((1 - effect.mult) * 100, lang) })} (${seconds(effect.duration, lang)}).`;
    case 'absorb':
      return `${name}: ${t('hudChrome.auraEffect.absorb', { value: formatNumber(effect.amount, lang) })} (${seconds(effect.duration, lang)}).`;
    case 'dot': {
      const leech = effect.leechPct
        ? `; +${formatPercent(effect.leechPct, lang)} ${t('hud.meters.healing')}`
        : '';
      return `${name}: ${formatNumber(effect.total, lang)} ${text.statLabels.damage} / ${seconds(effect.duration, lang)} (${seconds(effect.interval, lang)}${leech}).`;
    }
    case 'extendDot':
      return `${name} -> ${abilityName(effect.dot)}: +${seconds(effect.seconds, lang)} (<= +${seconds(effect.maxBonus, lang)}).`;
    case 'interrupt':
      return `${name}: ${t('hudChrome.auraEffect.lockout')} (${seconds(effect.lockout, lang)}).`;
    case 'consumeDot':
      return `${name} -> ${abilityName(effect.dot)}: ${formatPercent(1, lang)} ${text.statLabels.damage} / 0 s.`;
  }
}

// True when a talent title has an explicit per-locale translation override. The
// coverage test uses this to tell a deliberately-kept cognate (e.g. French
// "Riposte", Spanish "Vigor") apart from a name that leaks English by accident
// because the word-substitution dictionary does not cover its vocabulary.
export function hasTalentTitleOverride(lang: SupportedLanguage, source: string): boolean {
  return grantAbilityIdByTitle.has(source) || titleOverrides[lang]?.[source] !== undefined;
}

// Public wrapper: localize a content title given its English source name. Resolves an
// ability name (via the entity dictionary) or a talent-title override, else returns the
// source unchanged. Used by the HUD to localize aura/buff names that are granted by a
// talent or ability but surface in the buff frame / combat log by their raw English name.
export function localizeTalentTitle(
  source: string,
  lang: SupportedLanguage = getLanguage(),
): string {
  return translateTitle(source, lang);
}

function effectDescription(
  effect: TalentEffect | undefined,
  maxRank: number,
  lang: SupportedLanguage,
): string {
  if (!effect) return localeText[lang].noEffect;
  const text = localeText[lang];
  const perRank = maxRank > 1 ? text.perRank : '';
  const parts: string[] = [];

  if (effect.grant) {
    parts.push(text.grant(abilityName(effect.grant.ability)));
    const granted = abilityDescription(effect.grant.ability);
    if (granted) parts.push(granted);
    const metadata = grantAbilityMetadata(effect.grant.ability);
    if (metadata) parts.push(metadata);
  }

  const stats = effect.stats ?? {};
  const PRIMARY_PCT: Partial<Record<StatKey, 'str' | 'agi' | 'int' | 'dex' | 'luk'>> = {
    strPct: 'str',
    agiPct: 'agi',
    intPct: 'int',
    dexPct: 'dex',
    lukPct: 'luk',
  };
  for (const [key, value] of Object.entries(stats) as [StatKey, number][]) {
    if (value === undefined || value === 0) continue;
    if (key === 'armorFromStrPct') continue;
    const label: string | undefined =
      text.statLabels[PRIMARY_PCT[key] ?? (key as keyof typeof text.statLabels)];
    // Fail closed: a stat key with no localized label is skipped rather than rendered
    // as the literal "undefined" (a new sim stat field can land before its label does).
    if (label === undefined) continue;
    parts.push(text.increase(label, statAmount(key, value, lang), perRank));
  }

  const global = effect.global ?? {};
  for (const [key, value] of Object.entries(global) as [GlobalKey, number][]) {
    if (value === undefined || value === 0) continue;
    if (NON_DISPLAY_GLOBALS.has(key)) continue;
    // Fail closed here too: a global key missing from both NON_DISPLAY_GLOBALS and
    // statLabels must never surface as "Increases undefined by 70%".
    const label: string | undefined = text.statLabels[key as DisplayGlobalKey];
    if (label === undefined) continue;
    parts.push(text.increase(label, formatPercent(value, lang), perRank));
  }
  if (global.critVsRooted) {
    parts.push(
      `${text.statLabels.crit}: +${formatPercent(global.critVsRooted, lang)} @ ${t('hudChrome.auraEffect.root')}.`,
    );
  }
  if (global.cheatDeathIcd) {
    parts.push(
      `0 HP -> 1 HP (${seconds(global.cheatDeathIcd, lang)} ${text.statLabels.cooldown}).`,
    );
  }
  if (global.fearBreakPct) {
    parts.push(`${formatPercent(global.fearBreakPct, lang)} ${text.statLabels.maxHpPct} -> 0 s.`);
  }
  if (global.onKillSpeedPct) {
    parts.push(
      `${t('hudChrome.auraEffect.speed', { pct: formatNumber(global.onKillSpeedPct * 100, lang) })} (${seconds(global.onKillSpeedDuration ?? 0, lang)}).`,
    );
  }
  if (global.bloodbathPct) {
    parts.push(
      `${text.increase(text.statLabels.damage, formatPercent(global.bloodbathPct, lang), '')} <= ${formatPercent(global.bloodbathMaxPct ?? global.bloodbathPct, lang)} (${seconds(global.bloodbathDuration ?? 0, lang)}).`,
    );
  }
  if (global.cdrPerRage) {
    parts.push(
      `-${seconds(global.cdrPerRage, lang)} ${text.statLabels.cooldown} / 1 ${t('classDetails.labels.resource')}.`,
    );
  }

  for (const mod of effect.ability ?? []) {
    const name = abilityName(mod.ability);
    if (mod.dmgPct)
      parts.push(
        text.increase(
          `${name} ${text.statLabels.damage}`,
          formatPercent(mod.dmgPct, lang),
          perRank,
        ),
      );
    if (mod.flatDmg)
      parts.push(
        text.increase(
          `${name} ${text.statLabels.damage}`,
          formatNumber(Math.abs(mod.flatDmg), lang),
          perRank,
        ),
      );
    if (mod.costPct)
      parts.push(
        (mod.costPct < 0 ? text.reduce : text.increase)(
          `${name} ${text.statLabels.cost}`,
          formatPercent(mod.costPct, lang),
          perRank,
        ),
      );
    if (mod.cooldownPct)
      parts.push(
        (mod.cooldownPct < 0 ? text.reduce : text.increase)(
          `${name} ${text.statLabels.cooldown}`,
          formatPercent(mod.cooldownPct, lang),
          perRank,
        ),
      );
    if (mod.castPct)
      parts.push(
        (mod.castPct < 0 ? text.reduce : text.increase)(
          `${name} ${text.statLabels.castTime}`,
          formatPercent(mod.castPct, lang),
          perRank,
        ),
      );
    // buffPct strengthens the named buff itself (e.g. "Increases Devotion Aura by 20%").
    if (mod.buffPct) parts.push(text.increase(name, formatPercent(mod.buffPct, lang), perRank));
    if (mod.dmgPctVsDotted) {
      parts.push(
        `${text.increase(`${name} ${text.statLabels.damage}`, formatPercent(mod.dmgPctVsDotted, lang), perRank)} @ ${text.statLabels.dotDmgPct}.`,
      );
    }
    if (mod.castWhileMoving) {
      parts.push(
        `${name}: ${text.statLabels.castTime} @ ${t('hud.keybinds.categories.movement')}.`,
      );
    }
    if (mod.damagePushbackImmune) {
      parts.push(`${name}: ${text.statLabels.castTime} @ 0.`);
    }
    if (mod.bonusCharges) parts.push(`${name}: +${formatNumber(mod.bonusCharges, lang)}x.`);
    for (const addedEffect of mod.addEffects ?? []) {
      parts.push(addedEffectDescription(mod.ability, addedEffect, lang, text));
    }
  }

  if (effect.proc) parts.push(procDescription(effect.proc, lang, text));

  return parts.length > 0 ? parts.join(' ') : text.noEffect;
}

function className(id: PlayerClass): string {
  return tEntity({ kind: 'class', id, field: 'name' });
}

export function tTalent(request: TalentTranslationRequest): string {
  const lang = getLanguage();
  // English is the authored source of truth: the hand-written `description` strings carry
  // the real numbers (kept honest against the effect by tests/talent_tooltip_accuracy.ts).
  // Release locales generate ordinary effects from data. The narrow retained-description
  // table handles the four Warrior globals whose stance/resource prose cannot be expressed by
  // the generic renderer without losing behavior.
  if (isAuthoredEnglish(lang)) {
    if (request.kind === 'talentMastery') {
      return request.field === 'name'
        ? request.spec.mastery.name
        : request.spec.mastery.description;
    }
    if (request.kind === 'talentSpec') {
      // The description names the signature spell so the spec card tooltip always
      // tells the player which spell picking this spec grants (parity with the
      // localized specDescription arms, pinned by talent_tooltip_accuracy).
      return request.field === 'name'
        ? request.spec.name
        : `${request.spec.description} Signature: ${abilityName(request.spec.signature)}.`;
    }
    if (request.kind === 'talentChoice') {
      return request.field === 'name'
        ? request.choice.name
        : authoredChoiceDescription(request.choice);
    }
    const exhaustive: never = request;
    return exhaustive;
  }

  if (request.kind === 'talentMastery') {
    if (request.field === 'name') return translateTitle(request.spec.mastery.name, lang);
    const authored = localeText[lang].masteryDescriptions?.[request.spec.id];
    if (authored !== undefined) return authored;
    const generated = effectDescription(request.spec.mastery.effect, 1, lang);
    // Fail closed like the talentChoice arm: when the effect yields nothing
    // generatable (runtime-applied or unmapped fields), the authored English
    // description beats the generic no-effect blurb.
    return generated === localeText[lang].noEffect ? request.spec.mastery.description : generated;
  }
  if (request.kind === 'talentSpec') {
    if (request.field === 'name') return translateTitle(request.spec.name, lang);
    return (
      localeText[lang].specDescriptions?.[request.spec.id] ??
      localeText[lang].specDescription(
        className(request.spec.class),
        localeText[lang].roleLabels[request.spec.role],
        abilityName(request.spec.signature),
      )
    );
  }
  if (request.kind === 'talentChoice') {
    if (request.field === 'name') return translateTitle(request.choice.name, lang);
    const generated = effectDescription(request.choice.effect, 1, lang);
    return generated === localeText[lang].noEffect ? request.choice.description : generated;
  }
  const exhaustive: never = request;
  return exhaustive;
}

export function talentTranslationManifest(): TalentTranslationManifestEntry[] {
  const entries: TalentTranslationManifestEntry[] = [];
  for (const ct of talentClassData()) {
    for (const spec of ct.specs) {
      entries.push({
        kind: 'talentSpec',
        id: spec.id,
        classId: spec.class,
        field: 'name',
        source: spec.name,
      });
      entries.push({
        kind: 'talentSpec',
        id: spec.id,
        classId: spec.class,
        field: 'description',
        source: spec.description,
      });
      entries.push({
        kind: 'talentMastery',
        id: `${spec.id}.mastery`,
        classId: spec.class,
        specId: spec.id,
        field: 'name',
        source: spec.mastery.name,
      });
      entries.push({
        kind: 'talentMastery',
        id: `${spec.id}.mastery`,
        classId: spec.class,
        specId: spec.id,
        field: 'description',
        source: spec.mastery.description,
      });
    }
    for (const row of rowTreeFor(ct.class) ?? []) {
      for (const choice of row.options) {
        entries.push({
          kind: 'talentChoice',
          id: `${row.level}.${choice.id}`,
          classId: ct.class,
          field: 'name',
          source: choice.name,
        });
        entries.push({
          kind: 'talentChoice',
          id: `${row.level}.${choice.id}`,
          classId: ct.class,
          field: 'description',
          source: choice.description,
        });
      }
    }
  }
  return entries;
}

export function renderTalentManifestEntry(entry: TalentTranslationManifestEntry): string {
  const ct = TALENTS[entry.classId];
  if (!ct) return entry.source;
  if (entry.kind === 'talentSpec' || entry.kind === 'talentMastery') {
    const spec = ct.specs.find(
      (candidate) => candidate.id === (entry.kind === 'talentSpec' ? entry.id : entry.specId),
    );
    if (!spec) return entry.source;
    return tTalent({ kind: entry.kind, spec, field: entry.field });
  }
  const [, choiceId] = entry.id.split('.');
  const choice = (rowTreeFor(entry.classId) ?? [])
    .flatMap((row) => row.options)
    .find((candidate) => candidate.id === choiceId);
  if (!choice) return entry.source;
  return tTalent({ kind: 'talentChoice', choice, field: entry.field });
}
