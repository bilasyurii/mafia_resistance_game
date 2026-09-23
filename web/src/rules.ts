/**
 * Pure game-rules logic for The Resistance (5-10 players): spy counts,
 * per-mission team sizes, the two-fail rule on certain missions, majority
 * voting, mission outcomes, leader rotation, and the timer beep schedule.
 * Nothing here touches the DOM - see app.ts for that - so it can be unit
 * tested directly with node's test runner.
 */

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;
export const MISSIONS_PER_GAME = 5;
export const MAX_VOTE_ROUNDS_PER_MISSION = 5;
export const MISSIONS_TO_WIN = 3;

const SUGGESTED_SPY_COUNT: Record<number, number> = {
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 3,
  10: 4,
};

/** Team size per mission (1-indexed) for each supported player count, per https://beincognito.ru/resistance_rules/ */
const MISSION_TEAM_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 3, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

/** Mission 4 requires two fail cards (instead of one) to fail once there are 7+ players. */
export function missionRequiresTwoFails(playerCount: number, missionNumber: number): boolean {
  return missionNumber === 4 && playerCount >= 7;
}

export function clampPlayerCount(count: number): number {
  if (Number.isNaN(count)) return MIN_PLAYERS;
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.round(count)));
}

export function suggestSpyCount(playerCount: number): number {
  const clamped = clampPlayerCount(playerCount);
  return SUGGESTED_SPY_COUNT[clamped];
}

export function clampSpyCount(spyCount: number, playerCount: number): number {
  const max = playerCount - 2; // always leave at least 2 resistance members
  if (Number.isNaN(spyCount)) return suggestSpyCount(playerCount);
  return Math.min(max, Math.max(1, Math.round(spyCount)));
}

export interface MissionRule {
  teamSize: number;
  requiresTwoFails: boolean;
}

export function getMissionRule(playerCount: number, missionNumber: number): MissionRule {
  const clamped = clampPlayerCount(playerCount);
  const sizes = MISSION_TEAM_SIZES[clamped];
  const teamSize = sizes[Math.min(Math.max(missionNumber, 1), MISSIONS_PER_GAME) - 1];
  return { teamSize, requiresTwoFails: missionRequiresTwoFails(clamped, missionNumber) };
}

export function nextLeaderIndex(currentIndex: number, playerCount: number): number {
  return (currentIndex + 1) % playerCount;
}

/** Strict majority: more approvals than the rest combined. A tie fails, matching the official rules. */
export function voteApproved(approveCount: number, totalVoters: number): boolean {
  return approveCount * 2 > totalVoters;
}

export function missionResult(failCount: number, requiresTwoFails: boolean): "success" | "fail" {
  const threshold = requiresTwoFails ? 2 : 1;
  return failCount >= threshold ? "fail" : "success";
}

export type GameOverReason = "missionsResolved" | "voteExhausted";

export interface GameOverCheck {
  over: boolean;
  winner?: "resistance" | "spies";
  reason?: GameOverReason;
}

export function checkMissionsGameOver(successCount: number, failCount: number): GameOverCheck {
  if (successCount >= MISSIONS_TO_WIN) return { over: true, winner: "resistance", reason: "missionsResolved" };
  if (failCount >= MISSIONS_TO_WIN) return { over: true, winner: "spies", reason: "missionsResolved" };
  return { over: false };
}

/** Fisher-Yates shuffle; `random` is injectable so tests can make it deterministic. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const MIN_TIMER_SECONDS = 15;

/**
 * Countdown timestamps (seconds remaining) at which a mid-countdown beep
 * should fire: 10, 5, 4, 3, 2, 1, plus the halfway point - but only for
 * timers of 20s or more (shorter ones skip it, so it never lands close to or
 * before the 10s beep). Each second appears at most once, so a second never
 * beeps twice (a 20s timer's halfway point IS the 10s beep). The final beep
 * at 0 is handled separately by the caller (it uses a different tone).
 * Sorted descending.
 */
export function timerBeepSchedule(durationSeconds: number): number[] {
  const candidates = [10, 5, 4, 3, 2, 1];
  if (durationSeconds >= 20) candidates.push(Math.floor(durationSeconds / 2));
  const unique = Array.from(new Set(candidates)).filter((s) => s > 0 && s < durationSeconds);
  return unique.sort((a, b) => b - a);
}
