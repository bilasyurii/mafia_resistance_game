import { test } from "node:test";
import assert from "node:assert/strict";
import {
  suggestSpyCount,
  clampSpyCount,
  getMissionRule,
  missionRequiresTwoFails,
  nextLeaderIndex,
  voteApproved,
  missionResult,
  checkMissionsGameOver,
  shuffle,
  timerBeepSchedule,
  clampPlayerCount,
} from "./rules";

test("suggestSpyCount matches the official Resistance table", () => {
  assert.equal(suggestSpyCount(5), 2);
  assert.equal(suggestSpyCount(6), 2);
  assert.equal(suggestSpyCount(7), 3);
  assert.equal(suggestSpyCount(8), 3);
  assert.equal(suggestSpyCount(9), 3);
  assert.equal(suggestSpyCount(10), 4);
});

test("clampPlayerCount stays within 5-10", () => {
  assert.equal(clampPlayerCount(2), 5);
  assert.equal(clampPlayerCount(20), 10);
  assert.equal(clampPlayerCount(7), 7);
});

test("clampSpyCount never leaves fewer than 2 resistance members and at least 1 spy", () => {
  assert.equal(clampSpyCount(0, 5), 1);
  assert.equal(clampSpyCount(10, 5), 3);
  assert.equal(clampSpyCount(4, 10), 4);
});

test("getMissionRule returns official team sizes for every supported player count", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((m) => getMissionRule(5, m).teamSize),
    [2, 3, 2, 3, 3]
  );
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((m) => getMissionRule(7, m).teamSize),
    [2, 3, 3, 4, 4]
  );
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((m) => getMissionRule(10, m).teamSize),
    [3, 4, 4, 5, 5]
  );
});

test("mission 4 requires two fails only at 7+ players", () => {
  assert.equal(missionRequiresTwoFails(6, 4), false);
  assert.equal(missionRequiresTwoFails(7, 4), true);
  assert.equal(missionRequiresTwoFails(10, 4), true);
  assert.equal(missionRequiresTwoFails(7, 3), false);
});

test("nextLeaderIndex wraps around", () => {
  assert.equal(nextLeaderIndex(0, 5), 1);
  assert.equal(nextLeaderIndex(4, 5), 0);
});

test("voteApproved requires a strict majority (ties fail)", () => {
  assert.equal(voteApproved(3, 5), true);
  assert.equal(voteApproved(2, 5), false);
  assert.equal(voteApproved(3, 6), false); // 3 vs 3 is a tie, not a majority
  assert.equal(voteApproved(4, 6), true);
});

test("missionResult needs 2 fails only when requiresTwoFails is set", () => {
  assert.equal(missionResult(0, false), "success");
  assert.equal(missionResult(1, false), "fail");
  assert.equal(missionResult(1, true), "success");
  assert.equal(missionResult(2, true), "fail");
});

test("checkMissionsGameOver ends the game at 3 successes or 3 fails", () => {
  assert.deepEqual(checkMissionsGameOver(3, 1), { over: true, winner: "resistance", reason: "missionsResolved" });
  assert.deepEqual(checkMissionsGameOver(1, 3), { over: true, winner: "spies", reason: "missionsResolved" });
  assert.deepEqual(checkMissionsGameOver(2, 2), { over: false });
});

test("shuffle preserves the same elements and respects an injected random source", () => {
  const items = [1, 2, 3, 4, 5];
  const result = shuffle(items, () => 0); // always picks index 0 -> reverses via swaps deterministically
  assert.deepEqual([...result].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(items, [1, 2, 3, 4, 5], "original array must not be mutated");
});

test("timerBeepSchedule for the fixed 30s night timer matches the spec exactly", () => {
  assert.deepEqual(timerBeepSchedule(30), [15, 10, 5, 4, 3, 2, 1]);
});

test("timerBeepSchedule for 20s has no duplicate: the halfway point IS the 10s beep", () => {
  assert.deepEqual(timerBeepSchedule(20), [10, 5, 4, 3, 2, 1]);
});

test("timerBeepSchedule skips the halfway beep below 20s so it never precedes or crowds the 10s beep", () => {
  assert.deepEqual(timerBeepSchedule(19), [10, 5, 4, 3, 2, 1]);
  assert.deepEqual(timerBeepSchedule(15), [10, 5, 4, 3, 2, 1]);
});

test("timerBeepSchedule never lists a second twice and always keeps the halfway beep above the 10s beep for 21s+", () => {
  for (let d = 15; d <= 300; d += 1) {
    const schedule = timerBeepSchedule(d);
    assert.equal(new Set(schedule).size, schedule.length, `duplicate beep second for ${d}s`);
    assert.deepEqual(schedule, [...schedule].sort((a, b) => b - a));
    if (d >= 22) assert.equal(schedule[0], Math.floor(d / 2), `halfway beep expected first for ${d}s`);
  }
});
