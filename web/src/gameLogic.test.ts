import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlayers, countSpies } from "./gameLogic";

test("createPlayers assigns exactly spyCount spies and the rest resistance", () => {
  const players = createPlayers(7, 3, () => 0.5);
  assert.equal(players.length, 7);
  assert.equal(countSpies(players), 3);
  assert.equal(
    players.filter((p) => p.role === "resistance").length,
    4
  );
  assert.deepEqual(
    players.map((p) => p.id),
    [1, 2, 3, 4, 5, 6, 7]
  );
});

test("createPlayers gives every player a blank, non-custom name by default", () => {
  const players = createPlayers(5, 2);
  assert.ok(players.every((p) => p.name === "" && p.customName === false));
});

test("createPlayers spy placement changes with the injected random source", () => {
  const a = createPlayers(6, 2, () => 0);
  const b = createPlayers(6, 2, () => 0.99);
  const spiesA = a.filter((p) => p.role === "spy").map((p) => p.id);
  const spiesB = b.filter((p) => p.role === "spy").map((p) => p.id);
  assert.notDeepEqual(spiesA, spiesB);
});
