/**
 * The authored dataset.
 *
 * Single source of truth for both the seed script (which writes these documents
 * into Sanity) and the test suite (which builds snapshots from them). Every
 * factual claim carries a `sourceKey` pointing at an entry in `SOURCES`, and the
 * engine refuses to classify a day it cannot attribute to at least one source.
 *
 * Scope is deliberately narrow. This dataset covers the Schengen short-stay
 * allowance for a handful of passport classes. It does not attempt to be a
 * complete immigration reference, and the product says so out loud rather than
 * guessing past its coverage.
 */

// --- Sources ----------------------------------------------------------------

export interface SourceRecord {
  key: string
  title: string
  publisher: string
  url: string
  kind: 'legislation' | 'guidance' | 'calculator' | 'faq' | 'treaty'
  retrievedAt: string
  notes?: string
}

export const SOURCES: SourceRecord[] = [
  {
    key: 'ec-border-crossing',
    title: 'Schengen: border crossing',
    publisher: 'European Commission, Directorate-General for Migration and Home Affairs',
    url: 'https://home-affairs.ec.europa.eu/policies/schengen/border-crossing_en',
    kind: 'guidance',
    retrievedAt: '2026-10-03T00:00:00Z',
    notes:
      'Official landing page for who crosses an internal Schengen border and under what conditions.',
  },
  {
    key: 'ec-short-stay-calculator',
    title: 'Short-stay calculator',
    publisher: 'European Commission, Directorate-General for Migration and Home Affairs',
    url: 'https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en',
    kind: 'calculator',
    retrievedAt: '2026-10-03T00:00:00Z',
    notes:
      'The Commission\u2019s own calculator for the 90-in-any-180-day rule. Used as the external cross-check for this product\u2019s arithmetic.',
  },
  {
    key: 'ec-visa-policy',
    title: 'Schengen visa policy',
    publisher: 'European Commission, Directorate-General for Migration and Home Affairs',
    url: 'https://home-affairs.ec.europa.eu/policies/schengen/visa-policy_en',
    kind: 'guidance',
    retrievedAt: '2026-10-03T00:00:00Z',
    notes: 'Who needs a Schengen visa and the 90/180 ceiling that applies once admitted.',
  },
  {
    key: 'ec-schengen-area',
    title: 'Schengen area',
    publisher: 'European Commission, Directorate-General for Migration and Home Affairs',
    url: 'https://home-affairs.ec.europa.eu/policies/schengen-area_en',
    kind: 'guidance',
    retrievedAt: '2026-10-03T00:00:00Z',
    notes: 'Membership of the Schengen area and the rules applying on internal borders.',
  },
  {
    key: 'schengen-wiki-membership',
    title: 'Schengen Area — current members and accession dates',
    publisher: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Schengen_Area',
    kind: 'guidance',
    retrievedAt: '2026-10-03T00:00:00Z',
    notes:
      'Secondary source, used only for the dated membership history of Croatia, Bulgaria and Romania. Flagged as secondary so it is never silently promoted to primary law.',
  },
]

// --- Allowance --------------------------------------------------------------

export interface AllowanceRecord {
  key: string
  title: string
  windowDays: number
  limitDays: number
  countingBasis: 'arrival_inclusive' | 'any_touch' | 'departure_inclusive'
  consequences: string[]
  sourceKeys: string[]
}

export const ALLOWANCES: AllowanceRecord[] = [
  {
    key: 'schengen-short-stay',
    title: 'Schengen short stay (90 in any 180 days)',
    windowDays: 180,
    limitDays: 90,
    countingBasis: 'arrival_inclusive',
    consequences: [
      'Fines in the country of overstay',
      'A recorded entry ban of up to five years',
      'Removal at the traveller\u2019s expense',
      'Loss of visa-free access for the remainder of the current period',
    ],
    sourceKeys: ['ec-visa-policy', 'ec-short-stay-calculator'],
  },
]

// --- Territories ------------------------------------------------------------

export interface AccessBandRecord {
  from: string
  to?: string
  counted: boolean
  modes?: string[]
  basis: string
  sourceKeys: string[]
}

export interface TerritoryRecord {
  key: string
  name: string
  code: string
  kind: 'state' | 'carve_out' | 'external'
  carveOutOf?: string
  accessBands: AccessBandRecord[]
}

/**
 * A territory inside the area from `from` onwards.
 *
 * Dates are the dates the acquis actually applied, not a convenient constant.
 * A dataset that models date-banded membership while filling every band with
 * the same start date would be modelling nothing.
 */
const FULL = (from: string, basis: string, sourceKeys: string[] = ['ec-schengen-area']): AccessBandRecord[] => [
  {from, counted: true, basis, sourceKeys},
]

const FOUNDING_1995 = '1995-03-25'
const NORDIC_1995 = '1995-01-01'
const ENLARGEMENT_2004 = '2004-05-01'
const ENLARGEMENT_2007 = '2007-12-21'

export const TERRITORIES: TerritoryRecord[] = [
  // --- Inside the area ------------------------------------------------------
  {key: 'fr', name: 'France', code: 'FR', kind: 'state', accessBands: FULL(FOUNDING_1995, 'In the Schengen area since the agreement took effect.')},
  {key: 'de', name: 'Germany', code: 'DE', kind: 'state', accessBands: FULL(FOUNDING_1995, 'In the Schengen area since the agreement took effect.')},
  {key: 'es', name: 'Spain', code: 'ES', kind: 'state', accessBands: FULL(FOUNDING_1995, 'In the Schengen area since the agreement took effect.')},
  {key: 'it', name: 'Italy', code: 'IT', kind: 'state', accessBands: FULL(FOUNDING_1995, 'In the Schengen area since the agreement took effect.')},
  {key: 'pt', name: 'Portugal', code: 'PT', kind: 'state', accessBands: FULL(FOUNDING_1995, 'In the Schengen area since the agreement took effect.')},
  {key: 'nl', name: 'Netherlands', code: 'NL', kind: 'state', accessBands: FULL(FOUNDING_1995, 'In the Schengen area since the agreement took effect.')},
  {key: 'be', name: 'Belgium', code: 'BE', kind: 'state', accessBands: FULL(FOUNDING_1995, 'In the Schengen area since the agreement took effect.')},
  {key: 'at', name: 'Austria', code: 'AT', kind: 'state', accessBands: FULL(ENLARGEMENT_2004, 'Joined the area with the 2004 enlargement.')},
  {key: 'cz', name: 'Czechia', code: 'CZ', kind: 'state', accessBands: FULL(ENLARGEMENT_2004, 'Joined the area with the 2004 enlargement.')},
  {key: 'sk', name: 'Slovakia', code: 'SK', kind: 'state', accessBands: FULL(ENLARGEMENT_2004, 'Joined the area with the 2004 enlargement.')},
  {key: 'si', name: 'Slovenia', code: 'SI', kind: 'state', accessBands: FULL(ENLARGEMENT_2004, 'Joined the area with the 2004 enlargement.')},
  {key: 'mt', name: 'Malta', code: 'MT', kind: 'state', accessBands: FULL(ENLARGEMENT_2004, 'Joined the area with the 2004 enlargement.')},
  {key: 'hu', name: 'Hungary', code: 'HU', kind: 'state', accessBands: FULL(ENLARGEMENT_2004, 'Joined the area with the 2004 enlargement.')},
  {key: 'pl', name: 'Poland', code: 'PL', kind: 'state', accessBands: FULL(ENLARGEMENT_2004, 'Joined the area with the 2004 enlargement.')},
  {key: 'ee', name: 'Estonia', code: 'EE', kind: 'state', accessBands: FULL(ENLARGEMENT_2007, 'Joined the area with the 2007 enlargement.')},
  {key: 'lv', name: 'Latvia', code: 'LV', kind: 'state', accessBands: FULL(ENLARGEMENT_2007, 'Joined the area with the 2007 enlargement.')},
  {key: 'lt', name: 'Lithuania', code: 'LT', kind: 'state', accessBands: FULL(ENLARGEMENT_2007, 'Joined the area with the 2007 enlargement.')},
  {key: 'dk', name: 'Denmark', code: 'DK', kind: 'state', accessBands: FULL(NORDIC_1995, 'Nordic member.')},
  {key: 'no', name: 'Norway', code: 'NO', kind: 'state', accessBands: FULL(NORDIC_1995, 'Nordic member; not an EU member.')},
  {key: 'se', name: 'Sweden', code: 'SE', kind: 'state', accessBands: FULL(NORDIC_1995, 'Nordic member.')},
  {key: 'fi', name: 'Finland', code: 'FI', kind: 'state', accessBands: FULL(NORDIC_1995, 'Nordic member.')},
  {key: 'is', name: 'Iceland', code: 'IS', kind: 'state', accessBands: FULL('2001-03-25', 'Joined the area in 2001; not an EU member.')},
  {key: 'ch', name: 'Switzerland', code: 'CH', kind: 'state', accessBands: FULL('2008-03-01', 'Applied the full acquis in 2008; not an EU member.')},
  {key: 'gr', name: 'Greece', code: 'GR', kind: 'state', accessBands: FULL('2000-01-01', 'Applies the Schengen acquis; signed the agreement in 1985.')},

  // --- Joined part-way through our window ----------------------------------
  {
    key: 'hr',
    name: 'Croatia',
    code: 'HR',
    kind: 'state',
    accessBands: [
      {from: '2000-01-01', to: '2023-01-01', counted: false, basis: 'Outside the area before 1 January 2023.', sourceKeys: ['schengen-wiki-membership']},
      {from: '2023-01-01', counted: true, basis: 'Joined the Schengen area on 1 January 2023.', sourceKeys: ['schengen-wiki-membership', 'ec-schengen-area']},
    ],
  },
  {
    key: 'bg',
    name: 'Bulgaria',
    code: 'BG',
    kind: 'state',
    accessBands: [
      {from: '2000-01-01', to: '2024-12-31', counted: false, basis: 'Outside the area before 31 December 2024.', sourceKeys: ['schengen-wiki-membership']},
      {
        from: '2024-12-31',
        to: '2025-03-31',
        counted: true,
        modes: ['land', 'sea'],
        basis:
          'Land and sea borders became internal on 31 December 2024. Air borders were still external, so an air arrival did not yet count as time in the area.',
        sourceKeys: ['schengen-wiki-membership'],
      },
      {
        from: '2025-03-31',
        counted: true,
        basis: 'Air borders became internal on 31 March 2025; all crossings count from here.',
        sourceKeys: ['schengen-wiki-membership'],
      },
    ],
  },
  {
    key: 'ro',
    name: 'Romania',
    code: 'RO',
    kind: 'state',
    accessBands: [
      {from: '2000-01-01', to: '2024-12-31', counted: false, basis: 'Outside the area before 31 December 2024.', sourceKeys: ['schengen-wiki-membership']},
      {
        from: '2024-12-31',
        to: '2025-03-31',
        counted: true,
        modes: ['land', 'sea'],
        basis:
          'Land and sea borders became internal on 31 December 2024. Air borders were still external.',
        sourceKeys: ['schengen-wiki-membership'],
      },
      {from: '2025-03-31', counted: true, basis: 'Air borders became internal on 31 March 2025.', sourceKeys: ['schengen-wiki-membership']},
    ],
  },

  // --- EU members outside the area -----------------------------------------
  {
    key: 'ie',
    name: 'Ireland',
    code: 'IE',
    kind: 'external',
    accessBands: [
      {
        from: '2000-01-01',
        counted: false,
        basis:
          'Ireland opted out of the Schengen border and visa acquis. A Schengen visa is not valid for Ireland, and Irish days do not count against 90/180.',
        sourceKeys: ['schengen-wiki-membership', 'ec-schengen-area'],
      },
    ],
  },
  {
    key: 'cy',
    name: 'Cyprus',
    code: 'CY',
    kind: 'external',
    accessBands: [
      {
        from: '2000-01-01',
        counted: false,
        basis:
          'Cyprus is an EU member but not in the Schengen area. It does apply the common visa policy, so a Schengen visa is accepted; its days still do not count against 90/180.',
        sourceKeys: ['schengen-wiki-membership', 'ec-visa-policy'],
      },
    ],
  },

  // --- Outside the area -----------------------------------------------------
  {
    key: 'gb',
    name: 'United Kingdom',
    code: 'GB',
    kind: 'external',
    accessBands: [
      {from: '2000-01-01', counted: false, basis: 'Outside the Schengen area. UK days never count against 90/180.', sourceKeys: ['ec-schengen-area']},
    ],
  },
  {
    key: 'tr',
    name: 'Türkiye',
    code: 'TR',
    kind: 'external',
    accessBands: [
      {from: '2000-01-01', counted: false, basis: 'Outside the Schengen area.', sourceKeys: ['ec-schengen-area']},
    ],
  },

  // --- In-state carve-outs: the real trip-ups ------------------------------
  {
    key: 'es-canary',
    name: 'Canary Islands (Spain)',
    code: 'XCI',
    kind: 'carve_out',
    carveOutOf: 'es',
    accessBands: [
      {from: '2000-01-01', counted: false, basis: 'Outside the Schengen area despite being Spanish territory.', sourceKeys: ['schengen-wiki-membership']},
    ],
  },
  {
    key: 'pt-madeira',
    name: 'Madeira and the Azores (Portugal)',
    code: 'XPM',
    kind: 'carve_out',
    carveOutOf: 'pt',
    accessBands: [
      {from: '2000-01-01', counted: false, basis: 'Outside the Schengen area despite being Portuguese territory.', sourceKeys: ['schengen-wiki-membership']},
    ],
  },
  {
    key: 'fi-aland',
    name: 'Åland (Finland)',
    code: 'XFI',
    kind: 'carve_out',
    carveOutOf: 'fi',
    accessBands: [
      {from: '2000-01-01', counted: false, basis: 'Outside the Schengen area despite being Finnish territory.', sourceKeys: ['schengen-wiki-membership']},
    ],
  },
  {
    key: 'no-svalbard',
    name: 'Svalbard (Norway)',
    code: 'XNO',
    kind: 'carve_out',
    carveOutOf: 'no',
    accessBands: [
      {from: '2000-01-01', counted: false, basis: 'Outside the Schengen area despite being Norwegian territory.', sourceKeys: ['schengen-wiki-membership']},
    ],
  },
  {
    key: 'fr-overseas',
    name: 'French overseas departments',
    code: 'XFR',
    kind: 'carve_out',
    carveOutOf: 'fr',
    accessBands: [
      {from: '2000-01-01', counted: false, basis: 'Outside the Schengen area despite being French territory.', sourceKeys: ['schengen-wiki-membership']},
    ],
  },
]

// --- Nationality classes ----------------------------------------------------

export interface NationalityClassRecord {
  key: string
  label: string
  passports: string[]
  summary: string
  /**
   * Applied automatically when the holder does not state their own status.
   * Free movement is not a choice the traveller makes, so making them opt into
   * their own exemption would be a trap.
   */
  defaultPermitKey?: string
  sourceKeys: string[]
}

export const NATIONALITY_CLASSES: NationalityClassRecord[] = [
  {
    key: 'eu-eea-swiss',
    label: 'EU, EEA and Swiss citizens',
    passports: [
      'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','CH','LI',
    ],
    summary: 'Free movement applies, so the 90/180 short-stay ceiling is not the operative limit.',
    defaultPermitKey: 'eu-free-movement',
    sourceKeys: ['ec-schengen-area'],
  },
  {
    key: 'visa-free-90-180',
    label: 'Visa-free short stay for 90 days in any 180',
    passports: ['US', 'CA', 'AU', 'NZ', 'JP', 'KR', 'GB', 'SG', 'MX', 'BR', 'IL', 'ZA'],
    summary: 'Admitted without a Schengen visa, capped at 90 days in any rolling 180-day window.',
    sourceKeys: ['ec-visa-policy'],
  },
  {
    key: 'visa-required',
    label: 'Visa required for short stays',
    passports: ['IN', 'CN', 'RU', 'PK', 'NG', 'PH', 'VN', 'EG', 'MA', 'DZ'],
    summary: 'A Schengen short-stay visa must be obtained in advance. The 90/180 ceiling still applies once admitted.',
    sourceKeys: ['ec-visa-policy'],
  },
]

// --- Visa regimes -----------------------------------------------------------

export interface VisaRegimeRecord {
  key: string
  nationalityClassKey: string
  from: string
  to?: string
  visaRequired: boolean
  maxDaysPerEntry?: number
  allowedPurposes?: string[]
  notes?: string
  sourceKeys: string[]
}

export const VISA_REGIMES: VisaRegimeRecord[] = [
  {
    key: 'eu-eea-schengen',
    nationalityClassKey: 'eu-eea-swiss',
    from: '2000-01-01',
    visaRequired: false,
    notes: 'Free movement. Not subject to the 90/180 short-stay ceiling in the same way; treated as exempt.',
    sourceKeys: ['ec-schengen-area'],
  },
  {
    key: 'visafree-schengen',
    nationalityClassKey: 'visa-free-90-180',
    from: '2000-01-01',
    visaRequired: false,
    maxDaysPerEntry: 90,
    allowedPurposes: ['tourism', 'business', 'family', 'transit'],
    notes: 'A single entry may not exceed 90 days, and the rolling 180-day window also applies.',
    sourceKeys: ['ec-visa-policy', 'ec-short-stay-calculator'],
  },
  {
    key: 'visarequired-schengen',
    nationalityClassKey: 'visa-required',
    from: '2000-01-01',
    visaRequired: true,
    maxDaysPerEntry: 90,
    allowedPurposes: ['tourism', 'business', 'family', 'study', 'work', 'transit'],
    notes: 'Requires a Schengen short-stay visa issued in advance. The rolling ceiling is unchanged.',
    sourceKeys: ['ec-visa-policy'],
  },
]

// --- Permit exemptions ------------------------------------------------------

export interface PermitExemptionRecord {
  key: string
  label: string
  kind: 'residence_permit' | 'long_stay_visa' | 'free_movement' | 'permanent_residence' | 'pending_application'
  exemptsFromAllowance: boolean
  scopeTerritoryKeys?: string[]
  conditions: string
  sourceKeys: string[]
}

export const PERMIT_EXEMPTIONS: PermitExemptionRecord[] = [
  {
    key: 'residence-permit',
    label: 'Residence permit',
    kind: 'residence_permit',
    exemptsFromAllowance: true,
    conditions: 'A residence permit issued by a Schengen state exempts its holder from the 90/180 ceiling for the covered territory.',
    sourceKeys: ['ec-border-crossing'],
  },
  {
    key: 'long-stay-visa',
    label: 'Long-stay visa (type D)',
    kind: 'long_stay_visa',
    exemptsFromAllowance: true,
    conditions: 'A type D visa is a long-stay authorisation and is not counted against 90/180.',
    sourceKeys: ['ec-visa-policy'],
  },
  {
    key: 'permanent-residence',
    label: 'Permanent residence status',
    kind: 'permanent_residence',
    exemptsFromAllowance: true,
    conditions: 'Permanent residence status exempts the holder from the short-stay ceiling.',
    sourceKeys: ['ec-border-crossing'],
  },
  {
    key: 'eu-free-movement',
    label: 'EU / EEA / Swiss free movement',
    kind: 'free_movement',
    exemptsFromAllowance: true,
    conditions: 'Free movement rights apply instead of the short-stay regime.',
    sourceKeys: ['ec-schengen-area'],
  },
  {
    key: 'pending-application',
    label: 'Pending residence application',
    kind: 'pending_application',
    exemptsFromAllowance: false,
    conditions:
      'An application is not a permit. Until the permit is issued and valid, the 90/180 ceiling continues to apply in full.',
    sourceKeys: ['ec-border-crossing'],
  },
]

// --- Presence rules ---------------------------------------------------------

export interface PresenceRuleRecord {
  key: string
  label: string
  kind: string
  counted: boolean
  disputed: boolean
  rationale: string
  sourceKeys: string[]
}

export const PRESENCE_RULES: PresenceRuleRecord[] = [
  {
    key: 'cleared-entry',
    label: 'Cleared entry (passed border control)',
    kind: 'cleared_entry',
    counted: true,
    disputed: false,
    rationale: 'You entered the territory and were admitted as a short-stay visitor. The day counts.',
    sourceKeys: ['ec-visa-policy'],
  },
  {
    key: 'airport-transit',
    label: 'Airport transit, airside, no border control',
    kind: 'airport_transit',
    counted: false,
    disputed: false,
    rationale:
      'Remaining within an international airport transit area without passing border control is not a stay in the territory, so the day does not count.',
    sourceKeys: ['ec-border-crossing', 'ec-visa-policy'],
  },
  {
    key: 'airport-transit-landside',
    label: 'Airport transit that cleared border control',
    kind: 'airport_transit_landside',
    counted: false,
    disputed: true,
    rationale:
      'Passing border control admits you to the territory, which suggests the day counts — but guidance is phrased in terms of "staying" rather than "entering", and consulates and border authorities do not agree. Ninety will not decide this for you.',
    sourceKeys: ['ec-border-crossing', 'ec-visa-policy'],
  },
  {
    key: 'overnight-arrival',
    label: 'Overnight arrival',
    kind: 'overnight_arrival',
    counted: true,
    disputed: false,
    rationale:
      'Arriving and sleeping in the territory consumes a day. Under the Schengen convention the arrival day counts and the departure day does not.',
    sourceKeys: ['ec-visa-policy', 'ec-short-stay-calculator'],
  },
  {
    key: 'same-day-visit',
    label: 'Same-day visit',
    kind: 'same_day',
    counted: true,
    disputed: false,
    rationale: 'A day on which you were present in the territory is a day in the area, even if you left the same evening.',
    sourceKeys: ['ec-visa-policy'],
  },
  {
    key: 'permitted-presence',
    label: 'Long-stay or otherwise permitted presence',
    kind: 'permitted',
    counted: false,
    disputed: false,
    rationale: 'Presence authorised outside the short-stay regime is not charged to the 90/180 counter.',
    sourceKeys: ['ec-visa-policy'],
  },
]

// --- Precedents -------------------------------------------------------------
// Seeded empty. Precedents are produced by adjudicating disputes, not authored.

export interface PrecedentSeedRecord {
  key: string
  label: string
  subjectKind: 'presence_kind' | 'territory' | 'nationality_class'
  presenceKind?: string
  counted: boolean
  rationale: string
  from: string
  decidedBy: string
  scope: 'presence_kind' | 'global'
  sourceKeys: string[]
}

/**
 * One seeded precedent, so the public dataset demonstrates the mechanism rather
 * than describing it. It is attributed to a person, dated, and scoped.
 */
export const PRECEDENTS: PrecedentSeedRecord[] = [
  {
    key: 'airport-transit-landside-adjudicated',
    label: 'Cleared transit counts as a day in the area',
    subjectKind: 'presence_kind',
    presenceKind: 'airport_transit_landside',
    counted: true,
    rationale:
      'Adjudicated against the European Commission border-crossing guidance, which treats admission at an internal border as entry into the territory. Where a traveller lands, clears border control and re-departs the same airport, the day is charged. Scoped to future travel only: days already counted are not revisited.',
    from: '2026-01-01',
    decidedBy: 'Dataset curator',
    scope: 'presence_kind',
    sourceKeys: ['ec-border-crossing'],
  },
]