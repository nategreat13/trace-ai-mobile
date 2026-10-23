import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDeck } from "../engine/engine";
import type { PointsInput } from "../engine/types";
import { groupDestinations, rankDestinations } from "./destinations";

const input = (p: Partial<PointsInput>): PointsInput => ({
  balances: { amex: 80000, chase: 40000 },
  origin: "SFO",
  travelers: 1,
  picks: [],
  asOf: "2026-10-22",
  ...p,
});

test("opens with the cheapest trip they can book", () => {
  const all = groupDestinations(buildDeck(input({})));
  const ranked = rankDestinations(all, { picks: [], saved: [] });
  const cheapestNeed = Math.min(...all.filter((d) => d.ok).flatMap((d) => d.options.filter((o) => o.ok).map((o) => o.need)));
  assert.equal(ranked[0].ok, true);
  assert.equal(Math.min(...ranked[0].options.filter((o) => o.ok).map((o) => o.need)), cheapestNeed);
});

test("picks come right after the cheap opener, bookable ones first", () => {
  // 80k Amex reaches Paris on Flying Blue but not Bali's 120k KrisFlyer.
  const all = groupDestinations(buildDeck(input({ balances: { amex: 80000 }, picks: ["Paris", "Bali"] })));
  const ranked = rankDestinations(all, { picks: ["Paris", "Bali"], saved: [] });
  assert.equal(ranked[1].city, "Paris");
  // Bali is short, so it leads the "almost there" group instead.
  const firstNear = ranked.findIndex((d) => !d.ok);
  assert.equal(ranked[firstNear].city, "Bali");
  assert.ok(ranked.slice(0, firstNear).every((d) => d.ok));
});

test("saved trips pull their region forward", () => {
  const all = groupDestinations(buildDeck(input({})));
  const plain = rankDestinations(all, { picks: [], saved: [] }).map((d) => d.city);
  const liked = rankDestinations(all, { picks: [], saved: ["Cancún", "Punta Cana"] }).map((d) => d.city);
  const caribbean = ["Aruba", "San Juan", "Puerto Vallarta"];
  const pos = (list: string[]) => Math.min(...caribbean.map((c) => list.indexOf(c)).filter((i) => i >= 0));
  assert.ok(pos(liked) < pos(plain), "Caribbean and Mexico trips should move up");
});
