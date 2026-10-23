import {
  BONUSES,
  CARD_OFFERS,
  PARTNERS,
  PROGRAMS,
  tripDefs,
} from "./data";
import type {
  AwardOption,
  AwardProgramId,
  Balances,
  CardOffer,
  CardSuggestion,
  OptionResult,
  PointsInput,
  ProgramId,
  TransferBonus,
  TransferPart,
  TransferPartner,
  TripDef,
  TripResult,
} from "./types";

/**
 * The points math. Pure: same input, same answer, no I/O.
 *
 * For each trip it checks every airline program that can book it, works out
 * how much the user could get into that airline account (their own miles plus
 * every bank that transfers there, bonuses applied), then picks the cheapest
 * option they can afford, or the one they're closest to.
 */

export function partnerFor(program: AwardProgramId): TransferPartner {
  const p = PARTNERS.find((x) => x.program === program);
  if (!p) throw new Error(`Unknown award program ${program}`);
  return p;
}

export function activeBonuses(asOf: string): TransferBonus[] {
  return BONUSES.filter((b) => b.endsOn >= asOf);
}

function bonusFor(from: ProgramId, to: AwardProgramId, asOf: string): TransferBonus | undefined {
  return activeBonuses(asOf).find((b) => b.from === from && b.to === to);
}

/** The ratio a source moves into a program today, bonus included. */
export function liveRatio(
  partner: TransferPartner,
  from: ProgramId,
  asOf: string,
): { ratio: number; bonus?: TransferBonus } | null {
  const src = partner.sources.find((s) => s.from === from);
  if (!src) return null;
  const bonus = bonusFor(from, partner.program, asOf);
  return { ratio: src.ratio * (1 + (bonus?.pct ?? 0) / 100), bonus };
}

/** Per-person price for this origin, or null when the option isn't offered there. */
export function priceFor(
  option: AwardOption,
  origin: string,
  asOf: string,
): { points: number; note?: string } | null {
  if (option.notFrom?.includes(origin)) return null;
  const o = option.byOrigin?.find(
    (b) => b.origins.includes(origin) && (!b.until || b.until >= asOf),
  );
  return o ? { points: o.points, note: o.note ?? option.note } : { points: option.points, note: option.note };
}

const isDirect = (from: ProgramId) => PROGRAMS[from].kind === "airline";

/**
 * How much of `need` the user can cover in one airline account. Fills from
 * their own airline miles first, then from banks with the best ratio, so
 * bonus-boosted points get used before plain ones.
 */
export function evalOption(
  option: AwardOption,
  points: number,
  balances: Balances,
  travelers: number,
  asOf: string,
): OptionResult {
  const partner = partnerFor(option.program);
  const need = points * travelers;
  const sources = partner.sources
    .filter((s) => (balances[s.from] ?? 0) > 0)
    .map((s) => ({ from: s.from, ...liveRatio(partner, s.from, asOf)! }))
    .sort((a, b) => Number(isDirect(b.from)) - Number(isDirect(a.from)) || b.ratio - a.ratio);

  let left = need;
  let capacity = 0;
  const parts: TransferPart[] = [];
  for (const s of sources) {
    const miles = Math.floor((balances[s.from] ?? 0) * s.ratio);
    capacity += miles;
    if (left <= 0) continue;
    const take = Math.min(miles, left);
    parts.push({
      from: s.from,
      spend: Math.ceil(take / s.ratio),
      miles: take,
      ratio: s.ratio,
      bonus: s.bonus,
      direct: isDirect(s.from),
    });
    left -= take;
  }
  return { option, partner, need, capacity, gap: Math.max(need - capacity, 0), ok: capacity >= need, parts };
}

/**
 * The best card to close (or shrink) the gap on a trip. Ranked: cards that
 * close the gap, then cards in a currency the user already holds, then the
 * smallest bonus that does the job.
 */
export function suggestCard(
  trip: TripDef,
  input: PointsInput,
  offers: CardOffer[] = CARD_OFFERS,
): CardSuggestion | null {
  let best: (CardSuggestion & { score: number }) | null = null;
  for (const card of offers) {
    for (const option of trip.options) {
      const price = priceFor(option, input.origin, input.asOf);
      if (!price) continue;
      const partner = partnerFor(option.program);
      const r = liveRatio(partner, card.currency, input.asOf);
      if (!r) continue;
      const res = evalOption(option, price.points, input.balances, input.travelers, input.asOf);
      const withCard = res.capacity + Math.floor(card.bonus * r.ratio);
      const closesGap = withCard >= res.need;
      const stillShort = Math.max(res.need - withCard, 0);
      const held = (input.balances[card.currency] ?? 0) > 0;
      const score = (closesGap ? 0 : 1e9) + (held ? 0 : 1e6) + (closesGap ? card.bonus : stillShort);
      if (!best || score < best.score) {
        best = { card, program: option.program, closesGap, stillShort, score };
      }
    }
  }
  if (!best) return null;
  const { score: _score, ...suggestion } = best;
  return suggestion;
}

const BUSINESS = /Business|First|Lie-flat/;

export function evalTrip(trip: TripDef, input: PointsInput): TripResult {
  const n = Math.max(1, input.travelers);
  let bestOk: OptionResult | null = null;
  let nearest: OptionResult | null = null;
  for (const option of trip.options) {
    const price = priceFor(option, input.origin, input.asOf);
    if (!price) continue;
    const r = evalOption({ ...option, note: price.note }, price.points, input.balances, n, input.asOf);
    if (r.ok) {
      if (!bestOk || r.need < bestOk.need || (r.need === bestOk.need && r.parts.length < bestOk.parts.length)) bestOk = r;
    } else if (!nearest || r.gap < nearest.gap || (r.gap === nearest.gap && r.need < nearest.need)) {
      nearest = r;
    }
  }
  const best = (bestOk ?? nearest)!;
  return {
    trip,
    best,
    ok: best.ok,
    need: best.need,
    gap: best.gap,
    cashTotal: trip.cash * n,
    taxesTotal: trip.taxes * n,
    isBusiness: BUSINESS.test(trip.cabin),
    suggestion: best.ok ? null : suggestCard(trip, { ...input, travelers: n }),
  };
}

export function evalAll(input: PointsInput): TripResult[] {
  return tripDefs(input.origin).map((t) => evalTrip(t, input));
}

/**
 * The user's trips in deck order: picked trips they can book, then every
 * other bookable trip by cash value, then picked trips they're short on, then
 * the rest by how close they are. Trips more than `maxGap` away are dropped
 * unless the user picked that city.
 */
export function buildDeck(input: PointsInput, maxGap = 100000): TripResult[] {
  const picked = (r: TripResult) => input.picks.includes(r.trip.city);
  const all = evalAll(input).filter((r) => r.ok || r.gap <= maxGap || picked(r));
  const byCash = (a: TripResult, b: TripResult) => b.cashTotal - a.cashTotal;
  const byGap = (a: TripResult, b: TripResult) => a.gap - b.gap || a.need - b.need;
  return [
    ...all.filter((r) => picked(r) && r.ok).sort(byCash),
    ...all.filter((r) => !picked(r) && r.ok).sort(byCash),
    ...all.filter((r) => picked(r) && !r.ok).sort(byGap),
    ...all.filter((r) => !picked(r) && !r.ok).sort(byGap),
  ];
}

/** One tile per city, green if any of its trips is bookable, else the smallest gap. */
export function cityStatuses(input: PointsInput): { city: string; code: string; ok: boolean; gap: number }[] {
  const out = new Map<string, { city: string; code: string; ok: boolean; gap: number }>();
  for (const r of evalAll(input)) {
    const c = out.get(r.trip.city) ?? { city: r.trip.city, code: r.trip.code, ok: false, gap: Infinity };
    c.ok = c.ok || r.ok;
    c.gap = Math.min(c.gap, r.gap);
    out.set(r.trip.city, c);
  }
  return [...out.values()];
}

/** Estimated dollar values. Labeled as estimates wherever they're shown. */
export function pointValues(balances: Balances) {
  let total = 0;
  let flights = 0;
  let bankCash = 0;
  let bankFlights = 0;
  for (const [id, v] of Object.entries(balances) as [ProgramId, number][]) {
    if (!v) continue;
    const p = PROGRAMS[id];
    total += v;
    flights += (v * p.flightCents) / 100;
    if (p.kind === "bank") {
      bankCash += (v * (p.cashCents ?? 0)) / 100;
      bankFlights += (v * p.flightCents) / 100;
    }
  }
  return { total, flights: Math.round(flights / 10) * 10, bankCash, bankFlights };
}
