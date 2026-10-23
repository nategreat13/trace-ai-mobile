import { test } from "node:test";
import assert from "node:assert/strict";
import { searchAirports } from "./airports";

const codes = (q: string) => searchAirports(q).map((m) => m.airport.code);

test("codes, cities, states and abbreviations", () => {
  assert.equal(codes("slc")[0], "SLC");
  assert.equal(codes("Salt Lake")[0], "SLC");
  assert.deepEqual(codes("ut"), ["SLC"]);
  assert.deepEqual(codes("Utah"), ["SLC"]);
  assert.deepEqual(codes("az").sort(), ["PHX", "TUS"]);
});

test("aliases", () => {
  assert.deepEqual(codes("bay area").sort(), ["OAK", "SFO", "SJC"]);
  assert.deepEqual(codes("vegas"), ["LAS"]);
});

test("zip codes find the nearest launch airports", () => {
  assert.equal(codes("84101")[0], "SLC");
  assert.equal(codes("90210")[0], "LAX");
  assert.equal(codes("98101")[0], "SEA");
  assert.ok(codes("94110").slice(0, 3).every((c) => ["SFO", "OAK", "SJC"].includes(c)));
});

test("outside the region returns nothing", () => {
  assert.deepEqual(codes("10001"), []);
  assert.deepEqual(codes("Chicago"), []);
});

test("typos", () => {
  assert.equal(codes("Pheonix")[0], "PHX");
});
