/** A currency the user can hold: a bank's points or an airline's miles. */
export type ProgramId =
  | "amex"
  | "chase"
  | "c1"
  | "citi"
  | "bilt"
  | "wells"
  | "delta"
  | "united"
  | "atmos"
  | "aa"
  | "sw";

/** An airline program that can book an award seat. */
export type AwardProgramId =
  | "avios"
  | "aeroplan"
  | "virgin"
  | "flyingblue"
  | "turkish"
  | "aa"
  | "atmos"
  | "delta"
  | "united"
  | "sw"
  | "kris";

export interface Program {
  id: ProgramId;
  name: string;
  short: string;
  kind: "bank" | "airline";
  /** 2–3 letter stand-in for the logo until we have licensed marks. */
  badge: string;
  badgeColor: string;
  /** Cards that earn it, shown on the balances screen. */
  earnedOn: string;
  /** The "Not sure" estimate. */
  typical: number;
  sliderMax: number;
  /** Estimated cents per point when redeemed for flights. */
  flightCents: number;
  /** Estimated cents per point when cashed out. Banks only. */
  cashCents?: number;
  /** The airline program a user's own miles sit in. Airlines only. */
  awardProgram?: AwardProgramId;
  /** Where to move points out, or manage miles. */
  transferUrl: string;
  /** Square logo under /public/logos. Development placeholder until licensed marks arrive. */
  logo: string;
}

export interface TransferPartner {
  program: AwardProgramId;
  name: string;
  short: string;
  /** Who can move points in, at the base ratio before any bonus. */
  sources: { from: ProgramId; ratio: number }[];
  /** Prices move daily rather than following an award chart. */
  dynamic?: boolean;
  searchUrl: string;
}

export interface TransferBonus {
  from: ProgramId;
  /** May name a program Trace doesn't price trips with yet (Qatar, LifeMiles). */
  to: AwardProgramId | "qatar" | "lifemiles";
  toName: string;
  pct: number;
  /** Last day the bonus applies, inclusive, YYYY-MM-DD. */
  endsOn: string;
}

export type Origin = string;

export interface AwardOption {
  program: AwardProgramId;
  /** Per person, typical saver price. */
  points: number;
  /** Per-origin overrides of `points`, checked in order. `until` (YYYY-MM-DD) limits a promo price. */
  byOrigin?: { origins: Origin[]; points: number; until?: string; note?: string }[];
  /** Origins this option isn't offered from. */
  notFrom?: Origin[];
  /** The airline actually flown. */
  on: string;
  note?: string;
}

export type Region =
  | "USA"
  | "Hawaii"
  | "Canada"
  | "Mexico & Caribbean"
  | "Central & South America"
  | "Europe"
  | "Asia"
  | "Oceania"
  | "Middle East";

export interface TripDef {
  id: string;
  city: string;
  code: string;
  route: "Round trip" | "One way";
  cabin: "Economy" | "Business" | "Lie-flat business" | "First/Business" | "Business on ANA" | "Business on Qantas";
  /** Typical cash fare per person, USD. */
  cash: number;
  /** Typical award taxes and fees per person, USD. */
  taxes: number;
  kind: "beach" | "city" | "nature";
  region: Region;
  international: boolean;
  options: AwardOption[];
  /**
   * "brief": researched Oct 21, 2026. "estimate": Trace's estimate from
   * published award charts, not yet verified. Both are labeled in the UI.
   */
  source: "brief" | "estimate";
}

export interface CardOffer {
  id: string;
  name: string;
  currency: ProgramId;
  bonus: number;
  upTo?: boolean;
  extra?: string;
  spend: string;
  fee: string;
  tag?: string;
  /** The issuer's card page. Swap for the affiliate link once approved. */
  applyUrl: string;
}

export type Balances = Partial<Record<ProgramId, number>>;

/** One leg of moving points into the airline account. */
export interface TransferPart {
  from: ProgramId;
  /** Points taken out of the source. */
  spend: number;
  /** Miles that land in the airline account. */
  miles: number;
  ratio: number;
  /** The bonus that raised the ratio, if any. */
  bonus?: TransferBonus;
  /** The user's own airline miles, no transfer needed. */
  direct: boolean;
}

export interface OptionResult {
  option: AwardOption;
  partner: TransferPartner;
  /** Points needed for the whole party. */
  need: number;
  /** Everything the user could get into this airline account. */
  capacity: number;
  gap: number;
  ok: boolean;
  parts: TransferPart[];
}

export interface CardSuggestion {
  card: CardOffer;
  /** The booking option the card feeds. */
  program: AwardProgramId;
  closesGap: boolean;
  /** Shortfall left even with the bonus, 0 when it closes the gap. */
  stillShort: number;
}

export interface TripResult {
  trip: TripDef;
  best: OptionResult;
  ok: boolean;
  need: number;
  gap: number;
  cashTotal: number;
  taxesTotal: number;
  isBusiness: boolean;
  suggestion: CardSuggestion | null;
}

export interface PointsInput {
  balances: Balances;
  origin: Origin;
  travelers: number;
  picks: string[];
  /** YYYY-MM-DD; decides which transfer bonuses are live. */
  asOf: string;
}
