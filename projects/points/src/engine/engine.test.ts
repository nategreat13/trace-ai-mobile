import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDeck, evalAll, evalTrip, pointValues } from "./engine";
import { tripDefs } from "./data";
import type { PointsInput } from "./types";

const ASOF = "2026-10-22";
const input = (p: Partial<PointsInput>): PointsInput => ({
  balances: {},
  origin: "LAX",
  travelers: 1,
  picks: [],
  asOf: ASOF,
  ...p,
});
const trip = (origin: string, id: string) => tripDefs(origin).find((t) => t.id === id)!;

test("100k Amex from LAX, solo: ANA business via Virgin at 52,500 is bookable", () => {
  const i = input({ balances: { amex: 100000 } });
  const r = evalTrip(trip("LAX", "tokyo-j"), i);
  assert.equal(r.ok, true);
  assert.equal(r.best.option.program, "virgin");
  assert.equal(r.need, 52500);
  assert.deepEqual(
    r.best.parts.map((p) => [p.from, p.spend, p.miles]),
    [["amex", 52500, 52500]],
  );
});

test("40k Amex + 15k Chase from SLC, 2 travelers: Maui via Aeroplan needs 70,000, short, suggests Sapphire Preferred", () => {
  const i = input({ balances: { amex: 40000, chase: 15000 }, origin: "SLC", travelers: 2 });
  const r = evalTrip(trip("SLC", "maui"), i);
  assert.equal(r.ok, false);
  assert.equal(r.best.option.program, "aeroplan");
  assert.equal(r.need, 70000);
  assert.equal(r.gap, 15000);
  assert.equal(r.suggestion?.card.id, "csp");
  assert.equal(r.suggestion?.closesGap, true);
});

test("30k Southwest only from DEN: Southwest trips bookable, the rest almost there with full points and a card", () => {
  const i = input({ balances: { sw: 30000 }, origin: "DEN" });
  const results = evalAll(i);
  const swBookable = results.filter((r) => r.trip.options.some((o) => o.program === "sw" && o.points <= 30000));
  assert.ok(swBookable.length >= 4);
  for (const r of swBookable) {
    assert.equal(r.ok, true, r.trip.id);
    assert.equal(r.best.option.program, "sw", r.trip.id);
  }
  const rest = results.filter((r) => !r.trip.options.some((o) => o.program === "sw"));
  assert.ok(rest.length > 0);
  for (const r of rest) {
    assert.equal(r.ok, false, r.trip.id);
    assert.equal(r.gap, r.need, `${r.trip.id} should need its full price`);
    assert.ok(r.suggestion, `${r.trip.id} should suggest a card`);
  }
});

test("fills from airline miles first, then banks with the best ratio", () => {
  // Atmos for Maui from LAX: 30,000. User has 10k Atmos miles and 50k Bilt.
  const r = evalTrip(trip("LAX", "maui"), input({ balances: { atmos: 10000, bilt: 50000, amex: 0 } }));
  const atmos = r.best.option.program === "atmos" ? r.best : null;
  // Aeroplan via Bilt (25,000) is cheaper, so it wins.
  assert.equal(r.best.option.program, "aeroplan");
  assert.equal(atmos, null);

  const hnl = evalTrip(trip("LAX", "hnl-j"), input({ balances: { atmos: 10000, bilt: 20000 } }));
  // Aeroplan 25k: Bilt 20k → short 5k. Atmos 35k: 10k + 20k → short 5k. Tie on gap, smaller need wins.
  assert.equal(hnl.ok, false);
  assert.equal(hnl.gap, 5000);
  assert.equal(hnl.best.option.program, "aeroplan");

  const both = evalTrip(trip("LAX", "hnl-j"), input({ balances: { atmos: 10000, bilt: 30000 } }));
  assert.equal(both.best.option.program, "aeroplan");
  assert.deepEqual(both.best.parts.map((p) => p.from), ["bilt"]);
});

test("combines several banks into one airline account", () => {
  const r = evalTrip(trip("LAX", "maui"), input({ balances: { amex: 15000, chase: 12000 } }));
  assert.equal(r.ok, true);
  assert.equal(r.best.option.program, "aeroplan");
  assert.equal(r.best.parts.reduce((s, p) => s + p.miles, 0), 25000);
  assert.equal(r.best.parts.length, 2);
});

test("transfer bonuses apply until they end", () => {
  // Amex → Flying Blue +25% through Oct 31: 40,000 Amex becomes 50,000 miles.
  const live = evalTrip(trip("LAX", "paris"), input({ balances: { amex: 40000 } }));
  assert.equal(live.ok, true);
  assert.equal(live.best.option.program, "flyingblue");
  assert.equal(live.best.parts[0].spend, 40000);
  assert.equal(live.best.parts[0].bonus?.pct, 25);

  const after = evalTrip(trip("LAX", "paris"), input({ balances: { amex: 40000 }, asOf: "2026-11-01" }));
  assert.equal(after.ok, false);
});

test("Seattle Flying Blue promo only applies from SEA and only through Oct 31", () => {
  const sea = evalTrip(trip("SEA", "paris-j"), input({ origin: "SEA", balances: { chase: 45000 } }));
  assert.equal(sea.ok, true);
  assert.equal(sea.need, 45000);
  const late = evalTrip(trip("SEA", "paris-j"), input({ origin: "SEA", balances: { chase: 45000 }, asOf: "2026-11-01" }));
  assert.equal(late.ok, false);
  const lax = evalTrip(trip("LAX", "paris-j"), input({ balances: { chase: 45000 } }));
  assert.equal(lax.ok, false);
});

test("Atmos hop isn't offered from the Northwest", () => {
  const sea = evalTrip(trip("SEA", "hop"), input({ origin: "SEA", balances: { atmos: 9000 } }));
  assert.equal(sea.ok, false);
  const lax = evalTrip(trip("LAX", "hop"), input({ balances: { atmos: 9000 } }));
  assert.equal(lax.ok, true);
});

test("prices multiply by travelers", () => {
  const solo = evalTrip(trip("LAX", "nyc"), input({ balances: { aa: 100000 } }));
  const four = evalTrip(trip("LAX", "nyc"), input({ balances: { aa: 100000 }, travelers: 4 }));
  assert.equal(four.need, solo.need * 4);
  assert.equal(four.cashTotal, solo.cashTotal * 4);
});

test("deck puts picked cities first and drops far-off trips", () => {
  // Southwest miles can't reach KrisFlyer, so Bali is the full 120,000 away.
  const unpicked = buildDeck(input({ balances: { sw: 30000 } })).map((r) => r.trip.id);
  assert.ok(!unpicked.includes("bali-j"), "trips over 100k away are dropped");
  const deck = buildDeck(input({ balances: { sw: 30000 }, picks: ["Bali"] }));
  const ids = deck.map((r) => r.trip.id);
  assert.ok(ids.includes("bali-j"), "picked trips stay even when far off");
  const firstNear = deck.findIndex((r) => !r.ok);
  assert.equal(deck[firstNear].trip.id, "bali-j");
  assert.ok(deck.slice(0, firstNear).every((r) => r.ok));
});

test("point values", () => {
  const v = pointValues({ amex: 100000, delta: 50000 });
  assert.equal(v.total, 150000);
  assert.equal(v.flights, 2400);
  assert.equal(v.bankCash, 600);
  assert.equal(v.bankFlights, 1800);
});
