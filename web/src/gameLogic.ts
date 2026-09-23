import { shuffle } from "./rules";

export type Role = "resistance" | "spy";

export interface Player {
  id: number;
  name: string;
  customName: boolean;
  role: Role;
  hasSeenRole: boolean;
}

/**
 * Builds the player list with roles randomly assigned (spyCount spies,
 * the rest resistance). Names default to null (rendered as "Player N" /
 * "Гравець N" by the caller, in whichever language is active) until a
 * player sets a custom one.
 */
export function createPlayers(playerCount: number, spyCount: number, random: () => number = Math.random): Player[] {
  const ids = Array.from({ length: playerCount }, (_, i) => i + 1);
  const spyIds = new Set(shuffle(ids, random).slice(0, spyCount));
  return ids.map((id) => ({
    id,
    name: "",
    customName: false,
    role: spyIds.has(id) ? "spy" : "resistance",
    hasSeenRole: false,
  }));
}

export function countSpies(players: Player[]): number {
  return players.filter((p) => p.role === "spy").length;
}
