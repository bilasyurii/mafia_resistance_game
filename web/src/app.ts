import { Language, t } from "./i18n";
import { Player, createPlayers } from "./gameLogic";
import {
  MAX_VOTE_ROUNDS_PER_MISSION,
  MISSIONS_PER_GAME,
  MIN_PLAYERS,
  MAX_PLAYERS,
  clampPlayerCount,
  clampSpyCount,
  suggestSpyCount,
  getMissionRule,
  nextLeaderIndex,
  voteApproved,
  missionResult,
  checkMissionsGameOver,
  timerBeepSchedule,
  GameOverReason,
  MIN_TIMER_SECONDS,
} from "./rules";
import { playBeep } from "./audio";

/**
 * The one file in this app that touches the DOM. Pure rules/logic live in
 * rules.ts and gameLogic.ts (unit tested); this file only builds elements
 * from `state` and routes taps back into state mutations + render().
 */

const STORAGE_KEY = "resistance-game-state";

type Screen = "menu" | "setup" | "reveal" | "night" | "day" | "mission" | "gameOver";
type RevealStage = "home" | "gate" | "shown";
type DayStage = "leader" | "discussion" | "voting" | "votingResult";
type MissionStage = "handoff" | "gate" | "decision" | "confirm" | "moderatorReveal" | "revealed";

interface CountdownTimer {
  totalSeconds: number;
  remainingSeconds: number;
  running: boolean;
  paused?: boolean;
  beepSchedule: number[];
}

interface MissionRecord {
  missionNumber: number;
  teamSize: number;
  requiresTwoFails: boolean;
  team: number[];
  fails: number;
  result: "success" | "fail";
}

interface State {
  screen: Screen;
  language: Language;

  playerCountInput: number;
  spyCountInput: number;
  spyCountOverridden: boolean;

  players: Player[];
  missions: MissionRecord[];
  currentMissionNumber: number;
  leaderIndex: number;
  teamSize: number;
  voteRound: number;

  revealIndex: number;
  recapMode: boolean;
  recapSelectedId: number | null;
  revealStage: RevealStage;

  countdownTimer: CountdownTimer | null;
  nightDone: boolean;
  nightDurationInput: number;

  dayStage: DayStage;
  nominatedIds: number[];
  discussionDurationInput: number;
  approveIds: number[];
  voteApprovedResult: boolean | null;

  missionTeamOrder: number[];
  missionIndex: number;
  decisions: Record<number, "success" | "fail">;
  pendingChoice: "success" | "fail" | null;
  missionStage: MissionStage;
  missionElapsedSeconds: number;
  lastMissionResult: MissionRecord | null;

  tapCount: number;
  lastTapTime: number;

  gameOverWinner: "resistance" | "spies" | null;
  gameOverReason: GameOverReason | null;
  rolesRevealed: boolean;
}

function initialState(): State {
  return {
    screen: "menu",
    language: "uk",

    playerCountInput: 7,
    spyCountInput: suggestSpyCount(7),
    spyCountOverridden: false,

    players: [],
    missions: [],
    currentMissionNumber: 1,
    leaderIndex: 0,
    teamSize: 0,
    voteRound: 1,

    revealIndex: 0,
    recapMode: false,
    recapSelectedId: null,
    revealStage: "home",

    countdownTimer: null,
    nightDone: false,
    nightDurationInput: 30,

    dayStage: "leader",
    nominatedIds: [],
    discussionDurationInput: 30,
    approveIds: [],
    voteApprovedResult: null,

    missionTeamOrder: [],
    missionIndex: 0,
    decisions: {},
    pendingChoice: null,
    missionStage: "handoff",
    missionElapsedSeconds: 0,
    lastMissionResult: null,

    tapCount: 0,
    lastTapTime: 0,

    gameOverWinner: null,
    gameOverReason: null,
    rolesRevealed: false,
  };
}

/**
 * Restores the whole game from localStorage (if a game was in progress when
 * the page was last unloaded) so a reload or an accidental tab close mid-game
 * doesn't lose it - only the language toggle and the setup screen's inputs
 * used to survive a reload; now the entire game does.
 */
function loadPersistedState(): State {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      if (parsed && typeof parsed.screen === "string" && Array.isArray(parsed.players)) {
        const restored = { ...initialState(), ...parsed, tapCount: 0, lastTapTime: 0 };
        restored.nightDurationInput = Math.max(MIN_TIMER_SECONDS, restored.nightDurationInput);
        restored.discussionDurationInput = Math.max(MIN_TIMER_SECONDS, restored.discussionDurationInput);
        return restored;
      }
    }
  } catch {
    // Corrupted or unavailable storage - start fresh rather than crash.
  }
  return initialState();
}

function persistState(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) - the game still works, just without reload-survival.
  }
}

let state: State = loadPersistedState();
const root = document.getElementById("app")!;
let activeInterval: ReturnType<typeof setInterval> | null = null;

function clearActiveInterval(): void {
  if (activeInterval !== null) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
}

function startMissionStopwatch(): void {
  activeInterval = setInterval(() => {
    state.missionElapsedSeconds += 1;
    render();
  }, 1000);
}

/**
 * Re-arms whichever interval was running when the page was last unloaded, so
 * a restored countdown or mission stopwatch keeps ticking instead of
 * silently freezing until the moderator happens to trigger a re-render.
 */
function resumeIntervalsIfNeeded(): void {
  const inDiscussion = state.screen === "day" && state.dayStage === "discussion";
  if (state.countdownTimer && state.countdownTimer.running && !state.countdownTimer.paused && (state.screen === "night" || inDiscussion)) {
    activeInterval = setInterval(tickCountdown, 1000);
    return;
  }
  const missionInProgress = state.screen === "mission" && (state.missionStage === "handoff" || state.missionStage === "gate" || state.missionStage === "decision" || state.missionStage === "confirm");
  if (missionInProgress) {
    startMissionStopwatch();
  }
}

// ============================================================
// tiny DOM helpers
// ============================================================

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(label: string, onClick: () => void, className = "btn"): HTMLButtonElement {
  const b = el("button", className, label);
  b.type = "button";
  b.onclick = () => onClick();
  return b;
}

function render(): void {
  root.innerHTML = "";
  root.appendChild(buildHeader());
  switch (state.screen) {
    case "menu":
      root.appendChild(buildMenuScreen());
      break;
    case "setup":
      root.appendChild(buildSetupScreen());
      break;
    case "reveal":
      root.appendChild(buildRevealScreen());
      break;
    case "night":
      root.appendChild(buildNightScreen());
      break;
    case "day":
      root.appendChild(buildDayScreen());
      break;
    case "mission":
      root.appendChild(buildMissionScreen());
      break;
    case "gameOver":
      root.appendChild(buildGameOverScreen());
      break;
  }
  persistState();
}

// ============================================================
// header (language toggle + exit to menu)
// ============================================================

function buildHeader(): HTMLElement {
  const header = el("div", "app-header");
  const title = el("div", "app-header-title", t(state.language).appTitle);
  header.appendChild(title);

  const actions = el("div", "app-header-actions");
  actions.appendChild(
    button(
      t(state.language).languageToggle,
      () => {
        state.language = state.language === "en" ? "uk" : "en";
        render();
      },
      "btn btn-small"
    )
  );
  if (state.screen !== "menu") {
    actions.appendChild(button(t(state.language).menuButton, exitToMenu, "btn btn-small btn-danger"));
  }
  header.appendChild(actions);
  return header;
}

function exitToMenu(): void {
  if (!window.confirm(t(state.language).exitConfirm)) return;
  clearActiveInterval();
  const language = state.language;
  const playerCountInput = state.playerCountInput;
  const spyCountInput = state.spyCountInput;
  state = initialState();
  state.language = language;
  state.playerCountInput = playerCountInput;
  state.spyCountInput = spyCountInput;
  render();
}

// ============================================================
// menu
// ============================================================

function buildMenuScreen(): HTMLElement {
  const lang = t(state.language);
  const screen = el("div", "screen menu-screen");
  screen.appendChild(el("h1", "menu-title", lang.appTitle));
  screen.appendChild(el("p", "menu-subtitle", lang.menuSubtitle));
  screen.appendChild(button(lang.newGame, startNewGameSetup, "btn btn-primary btn-large"));
  return screen;
}

function startNewGameSetup(): void {
  state.screen = "setup";
  state.spyCountInput = state.spyCountOverridden ? state.spyCountInput : suggestSpyCount(state.playerCountInput);
  render();
}

// ============================================================
// setup
// ============================================================

function buildSetupScreen(): HTMLElement {
  const lang = t(state.language);
  const screen = el("div", "screen setup-screen");
  screen.appendChild(el("h2", "screen-title", lang.setupTitle));

  const card = el("div", "card");

  const playersRow = el("div", "field-row");
  playersRow.appendChild(el("label", "field-label", lang.playersCountLabel));
  const stepper = el("div", "stepper");
  stepper.appendChild(
    button(
      "-",
      () => {
        setPlayerCount(state.playerCountInput - 1);
      },
      "btn btn-small"
    )
  );
  stepper.appendChild(el("div", "stepper-value", String(state.playerCountInput)));
  stepper.appendChild(
    button(
      "+",
      () => {
        setPlayerCount(state.playerCountInput + 1);
      },
      "btn btn-small"
    )
  );
  playersRow.appendChild(stepper);
  card.appendChild(playersRow);
  card.appendChild(el("div", "field-hint", lang.playersRangeHint));

  const spiesRow = el("div", "field-row");
  spiesRow.appendChild(el("label", "field-label", lang.spiesCountLabel));
  const spyStepper = el("div", "stepper");
  spyStepper.appendChild(
    button(
      "-",
      () => {
        setSpyCount(state.spyCountInput - 1);
      },
      "btn btn-small"
    )
  );
  spyStepper.appendChild(el("div", "stepper-value", String(state.spyCountInput)));
  spyStepper.appendChild(
    button(
      "+",
      () => {
        setSpyCount(state.spyCountInput + 1);
      },
      "btn btn-small"
    )
  );
  spiesRow.appendChild(spyStepper);
  card.appendChild(spiesRow);
  card.appendChild(el("div", "field-hint", lang.spiesSuggestedNote(suggestSpyCount(state.playerCountInput))));

  screen.appendChild(card);
  screen.appendChild(button(lang.startButton, beginRoleAssignment, "btn btn-primary btn-large"));
  return screen;
}

function setPlayerCount(value: number): void {
  state.playerCountInput = clampPlayerCount(value);
  if (!state.spyCountOverridden) {
    state.spyCountInput = suggestSpyCount(state.playerCountInput);
  } else {
    state.spyCountInput = clampSpyCount(state.spyCountInput, state.playerCountInput);
  }
  render();
}

function setSpyCount(value: number): void {
  state.spyCountOverridden = true;
  state.spyCountInput = clampSpyCount(value, state.playerCountInput);
  render();
}

function beginRoleAssignment(): void {
  state.players = createPlayers(state.playerCountInput, state.spyCountInput);
  state.missions = [];
  state.currentMissionNumber = 1;
  state.leaderIndex = 0;
  state.teamSize = getMissionRule(state.players.length, 1).teamSize;
  state.voteRound = 1;
  state.revealIndex = 0;
  state.recapMode = false;
  state.recapSelectedId = null;
  state.revealStage = "home";
  state.screen = "reveal";
  render();
}

// ============================================================
// role reveal (pass-and-play)
// ============================================================

function displayName(player: Player): string {
  return player.customName && player.name.trim() ? player.name.trim() : t(state.language).playerLabel(player.id);
}

function currentRevealPlayer(): Player {
  if (state.recapMode && state.recapSelectedId !== null) {
    return state.players.find((p) => p.id === state.recapSelectedId)!;
  }
  return state.players[state.revealIndex];
}

function buildRevealScreen(): HTMLElement {
  if (state.recapMode && state.recapSelectedId === null) {
    return buildRecapListScreen();
  }
  const player = currentRevealPlayer();
  switch (state.revealStage) {
    case "gate":
      return buildTapGateScreen(t(state.language).tapToRevealInstruction, () => {
        state.revealStage = "shown";
        render();
      });
    case "shown":
      return buildRoleShownScreen(player);
    case "home":
    default:
      return buildRevealHomeScreen(player);
  }
}

function buildRevealHomeScreen(player: Player): HTMLElement {
  const lang = t(state.language);
  const screen = el("div", "screen reveal-home-screen");
  screen.appendChild(el("p", "warning-text", lang.revealWarning(displayName(player))));
  screen.appendChild(el("div", "player-name-big", displayName(player)));

  if (!player.hasSeenRole) {
    const nameField = el("div", "field-row name-field");
    nameField.appendChild(el("label", "field-label", lang.nameLabel));
    const input = el("input", "text-input") as HTMLInputElement;
    input.type = "text";
    input.placeholder = lang.namePlaceholder;
    input.value = player.name;
    input.oninput = () => {
      player.name = input.value;
      player.customName = input.value.trim().length > 0;
    };
    nameField.appendChild(input);
    screen.appendChild(nameField);
    screen.appendChild(
      button(
        lang.revealButton,
        () => {
          state.tapCount = 0;
          state.revealStage = "gate";
          render();
        },
        "btn btn-primary btn-large"
      )
    );
  } else {
    screen.appendChild(
      button(
        lang.peekAgain,
        () => {
          state.tapCount = 0;
          state.revealStage = "gate";
          render();
        },
        "btn btn-primary btn-large"
      )
    );
    if (state.recapMode) {
      screen.appendChild(
        button(
          lang.recapBackToList,
          () => {
            state.recapSelectedId = null;
            render();
          },
          "btn btn-large"
        )
      );
    } else {
      screen.appendChild(button(lang.passPhoneButton, advanceRevealToNextPlayer, "btn btn-large"));
    }
  }
  return screen;
}

function advanceRevealToNextPlayer(): void {
  state.revealIndex += 1;
  state.revealStage = "home";
  if (state.revealIndex >= state.players.length) {
    state.recapMode = true;
  }
  render();
}

function buildRoleShownScreen(player: Player): HTMLElement {
  const lang = t(state.language);
  const isSpy = player.role === "spy";
  const screen = el("div", "screen role-shown-screen " + (isSpy ? "role-shown-spy" : "role-shown-resistance"));
  screen.appendChild(el("div", "role-title", lang.yourRoleIs));
  screen.appendChild(el("div", "role-name", isSpy ? lang.roleSpyName : lang.roleResistanceName));
  screen.appendChild(el("div", "role-desc", isSpy ? lang.roleSpyDesc : lang.roleResistanceDesc));
  screen.appendChild(
    button(
      lang.hideRole,
      () => {
        player.hasSeenRole = true;
        state.revealStage = "home";
        render();
      },
      "btn btn-large"
    )
  );
  return screen;
}

/** A full-screen tap target requiring 3 quick taps before calling onComplete - protects against an accidental peek while the phone is being handed over. */
function buildTapGateScreen(instruction: string, onComplete: () => void): HTMLElement {
  const screen = el("div", "screen tap-gate-screen");
  screen.appendChild(el("div", "tap-gate-instruction", instruction));
  const dots = el("div", "tap-gate-dots");
  for (let i = 0; i < 3; i += 1) {
    dots.appendChild(el("span", "tap-gate-dot" + (i < state.tapCount ? " tap-gate-dot-filled" : "")));
  }
  screen.appendChild(dots);
  screen.onclick = () => registerTripleTap(onComplete);
  return screen;
}

const TRIPLE_TAP_WINDOW_MS = 630;

let tapResetTimeout: ReturnType<typeof setTimeout> | null = null;

function clearTapResetTimeout(): void {
  if (tapResetTimeout !== null) {
    clearTimeout(tapResetTimeout);
    tapResetTimeout = null;
  }
}

function registerTripleTap(onComplete: () => void): void {
  const now = Date.now();
  const tooSlow = state.tapCount > 0 && now - state.lastTapTime > TRIPLE_TAP_WINDOW_MS;
  // A slow tap clears the progress dots entirely (and isn't counted) so the player sees the sequence was rejected.
  state.tapCount = tooSlow ? 0 : state.tapCount + 1;
  state.lastTapTime = now;
  clearTapResetTimeout();
  if (state.tapCount >= 3) {
    state.tapCount = 0;
    onComplete();
    return;
  }
  // If no follow-up tap arrives within the window, the sequence is dead: turn the dots off without waiting for another tap.
  if (state.tapCount > 0) {
    tapResetTimeout = setTimeout(() => {
      tapResetTimeout = null;
      if (state.tapCount > 0) {
        state.tapCount = 0;
        render();
      }
    }, TRIPLE_TAP_WINDOW_MS);
  }
  render();
}

function buildRecapListScreen(): HTMLElement {
  const lang = t(state.language);
  const screen = el("div", "screen recap-screen");
  screen.appendChild(el("h2", "screen-title", lang.recapTitle));
  screen.appendChild(el("p", "screen-instructions", lang.recapInstructions));

  const grid = el("div", "player-grid");
  state.players.forEach((player) => {
    grid.appendChild(
      button(
        displayName(player),
        () => {
          state.recapSelectedId = player.id;
          state.revealStage = "home";
          render();
        },
        "btn player-chip"
      )
    );
  });
  screen.appendChild(grid);

  screen.appendChild(button(lang.recapStartGame, beginNightPhase, "btn btn-primary btn-large"));
  return screen;
}

function beginNightPhase(): void {
  state.screen = "night";
  state.countdownTimer = null;
  state.nightDone = false;
  render();
}

// ============================================================
// night phase (spies identify each other)
// ============================================================

function buildNightScreen(): HTMLElement {
  const lang = t(state.language);
  const screen = el("div", "screen night-screen");
  screen.appendChild(el("h2", "screen-title", lang.nightTitle));

  if (!state.countdownTimer) {
    screen.appendChild(el("p", "screen-instructions", lang.nightInstruction));
    const timerRow = el("div", "field-row");
    timerRow.appendChild(el("label", "field-label", lang.dayTimerDurationLabel));
    const stepper = el("div", "stepper");
    stepper.appendChild(
      button(
        "-",
        () => {
          state.nightDurationInput = Math.max(MIN_TIMER_SECONDS, state.nightDurationInput - 5);
          render();
        },
        "btn btn-small"
      )
    );
    stepper.appendChild(el("div", "stepper-value", String(state.nightDurationInput)));
    stepper.appendChild(
      button(
        "+",
        () => {
          state.nightDurationInput = Math.min(300, state.nightDurationInput + 5);
          render();
        },
        "btn btn-small"
      )
    );
    timerRow.appendChild(stepper);
    screen.appendChild(timerRow);
    const tapArea = el("div", "tap-gate-screen tap-anywhere");
    tapArea.appendChild(el("div", "tap-gate-instruction", lang.nightTapToStart));
    tapArea.onclick = () => startCountdown(state.nightDurationInput);
    screen.appendChild(tapArea);
    return screen;
  }

  if (state.countdownTimer.running) {
    screen.appendChild(buildTimerDisplay());
    screen.appendChild(buildPauseResumeButton());
    return screen;
  }

  screen.appendChild(el("p", "screen-instructions night-time-up", lang.nightTimeUp));
  screen.appendChild(
    button(
      lang.continueButton,
      () => {
        state.nightDone = true;
        state.screen = "day";
        state.dayStage = "leader";
        render();
      },
      "btn btn-primary btn-large"
    )
  );
  return screen;
}

function buildTimerDisplay(): HTMLElement {
  const timer = state.countdownTimer!;
  const wrap = el("div", "timer-display" + (timer.paused ? " timer-display-paused" : ""));
  wrap.appendChild(el("div", "timer-seconds", String(timer.remainingSeconds)));
  return wrap;
}

function startCountdown(requestedSeconds: number): void {
  const seconds = Math.max(MIN_TIMER_SECONDS, requestedSeconds);
  clearActiveInterval();
  state.countdownTimer = {
    totalSeconds: seconds,
    remainingSeconds: seconds,
    running: true,
    beepSchedule: timerBeepSchedule(seconds),
  };
  activeInterval = setInterval(tickCountdown, 1000);
  render();
}

function stopCountdown(): void {
  clearActiveInterval();
  if (state.countdownTimer) {
    state.countdownTimer.running = false;
    state.countdownTimer.paused = false;
  }
  render();
}

function buildPauseResumeButton(): HTMLButtonElement {
  const lang = t(state.language);
  const timer = state.countdownTimer!;
  return button(
    timer.paused ? lang.resumeTimerButton : lang.pauseTimerButton,
    () => {
      if (timer.paused) {
        timer.paused = false;
        activeInterval = setInterval(tickCountdown, 1000);
      } else {
        timer.paused = true;
        clearActiveInterval();
      }
      render();
    },
    "btn btn-large pause-btn"
  );
}

function tickCountdown(): void {
  const timer = state.countdownTimer;
  if (!timer || !timer.running || timer.paused) return;
  timer.remainingSeconds -= 1;
  if (timer.remainingSeconds <= 0) {
    timer.remainingSeconds = 0;
    timer.running = false;
    clearActiveInterval();
    playBeep("final");
  } else if (timer.beepSchedule.includes(timer.remainingSeconds)) {
    playBeep("tick");
  } else {
    playBeep("clock");
  }
  render();
}

// ============================================================
// day phase: leader -> discussion -> voting -> votingResult
// ============================================================

function missionHistoryDots(): HTMLElement {
  const wrap = el("div", "history-dots");
  for (let i = 1; i <= MISSIONS_PER_GAME; i += 1) {
    const record = state.missions.find((m) => m.missionNumber === i);
    const cls = record ? (record.result === "success" ? "dot dot-success" : "dot dot-fail") : "dot dot-pending";
    wrap.appendChild(el("span", cls));
  }
  return wrap;
}

function buildDayScreen(): HTMLElement {
  const lang = t(state.language);
  const screen = el("div", "screen day-screen");
  screen.appendChild(el("h2", "screen-title", lang.dayMissionLabel(state.currentMissionNumber)));
  screen.appendChild(el("div", "history-label", lang.dayHistoryLabel));
  screen.appendChild(missionHistoryDots());
  const justRejected = state.dayStage === "votingResult" && state.voteApprovedResult === false ? 1 : 0;
  screen.appendChild(el("div", "rejected-count", lang.dayRejectedCount(state.voteRound - 1 + justRejected, MAX_VOTE_ROUNDS_PER_MISSION)));

  switch (state.dayStage) {
    case "leader":
      screen.appendChild(buildLeaderStage());
      break;
    case "discussion":
      screen.appendChild(buildDiscussionStage());
      break;
    case "voting":
      screen.appendChild(buildVotingStage());
      break;
    case "votingResult":
      screen.appendChild(buildVotingResultStage());
      break;
  }
  return screen;
}

function buildLeaderStage(): HTMLElement {
  const lang = t(state.language);
  const wrap = el("div", "stage-block");
  wrap.appendChild(el("h3", "stage-title", lang.dayLeaderTitle));
  wrap.appendChild(el("p", "screen-instructions", lang.daySelectLeaderInstruction));

  const grid = el("div", "player-grid");
  state.players.forEach((player, index) => {
    const selected = index === state.leaderIndex;
    grid.appendChild(
      button(
        displayName(player),
        () => {
          state.leaderIndex = index;
          render();
        },
        "btn player-chip" + (selected ? " player-chip-selected" : "")
      )
    );
  });
  wrap.appendChild(grid);

  const sizeRow = el("div", "field-row");
  sizeRow.appendChild(el("label", "field-label", lang.dayTeamSizeLabel));
  const stepper = el("div", "stepper");
  stepper.appendChild(
    button(
      "-",
      () => {
        state.teamSize = Math.max(1, state.teamSize - 1);
        render();
      },
      "btn btn-small"
    )
  );
  stepper.appendChild(el("div", "stepper-value", String(state.teamSize)));
  stepper.appendChild(
    button(
      "+",
      () => {
        state.teamSize = Math.min(state.players.length, state.teamSize + 1);
        render();
      },
      "btn btn-small"
    )
  );
  sizeRow.appendChild(stepper);
  wrap.appendChild(sizeRow);
  const suggestedSize = getMissionRule(state.players.length, state.currentMissionNumber).teamSize;
  wrap.appendChild(el("div", "field-hint suggested-size" + (state.teamSize !== suggestedSize ? " suggested-size-differs" : ""), lang.daySuggestedTeamSize(suggestedSize)));

  wrap.appendChild(
    button(
      lang.dayConfirmLeaderButton,
      () => {
        state.dayStage = "discussion";
        render();
      },
      "btn btn-primary btn-large"
    )
  );
  return wrap;
}

function buildDiscussionStage(): HTMLElement {
  const lang = t(state.language);
  const wrap = el("div", "stage-block");
  wrap.appendChild(el("h3", "stage-title", lang.dayDiscussionTitle));
  wrap.appendChild(el("p", "screen-instructions", lang.dayNominateInstruction(state.teamSize)));
  wrap.appendChild(el("p", "nominated-count", lang.dayNominatedCount(state.nominatedIds.length, state.teamSize)));

  const timerRow = el("div", "field-row");
  timerRow.appendChild(el("label", "field-label", lang.dayTimerDurationLabel));
  const stepper = el("div", "stepper");
  stepper.appendChild(
    button(
      "-",
      () => {
        state.discussionDurationInput = Math.max(MIN_TIMER_SECONDS, state.discussionDurationInput - 5);
        render();
      },
      "btn btn-small"
    )
  );
  stepper.appendChild(el("div", "stepper-value", String(state.discussionDurationInput)));
  stepper.appendChild(
    button(
      "+",
      () => {
        state.discussionDurationInput = Math.min(300, state.discussionDurationInput + 5);
        render();
      },
      "btn btn-small"
    )
  );
  timerRow.appendChild(stepper);
  wrap.appendChild(timerRow);

  if (state.countdownTimer && state.countdownTimer.running) {
    wrap.appendChild(buildTimerDisplay());
    wrap.appendChild(buildPauseResumeButton());
    wrap.appendChild(button(lang.dayStopTimerButton, stopCountdown, "btn btn-danger btn-large"));
  } else {
    wrap.appendChild(
      button(
        lang.dayStartTimerButton,
        () => startCountdown(state.discussionDurationInput),
        "btn btn-large"
      )
    );
  }

  const grid = el("div", "player-grid");
  state.players.forEach((player) => {
    const selected = state.nominatedIds.includes(player.id);
    grid.appendChild(
      button(
        displayName(player),
        () => toggleNominated(player.id),
        "btn player-chip" + (selected ? " player-chip-selected" : "")
      )
    );
  });
  wrap.appendChild(grid);

  const proceedBtn = button(
    lang.dayProceedToVoting,
    () => {
      clearActiveInterval();
      state.countdownTimer = null;
      state.approveIds = [];
      state.dayStage = "voting";
      render();
    },
    "btn btn-primary btn-large"
  );
  proceedBtn.disabled = state.nominatedIds.length !== state.teamSize;
  wrap.appendChild(proceedBtn);
  return wrap;
}

function toggleNominated(playerId: number): void {
  const idx = state.nominatedIds.indexOf(playerId);
  if (idx >= 0) {
    state.nominatedIds.splice(idx, 1);
  } else if (state.nominatedIds.length < state.teamSize) {
    state.nominatedIds.push(playerId);
  }
  render();
}

function buildVotingStage(): HTMLElement {
  const lang = t(state.language);
  const wrap = el("div", "stage-block");
  wrap.appendChild(el("h3", "stage-title", lang.dayVotingTitle));
  wrap.appendChild(el("p", "screen-instructions", lang.dayVoteRound(state.voteRound, MAX_VOTE_ROUNDS_PER_MISSION)));

  const teamNames = state.nominatedIds.map((id) => displayName(state.players.find((p) => p.id === id)!)).join(", ");
  wrap.appendChild(el("p", "nominated-team", teamNames));
  wrap.appendChild(el("p", "screen-instructions", lang.dayVotingInstruction));

  const grid = el("div", "player-grid");
  state.players.forEach((player) => {
    const approved = state.approveIds.includes(player.id);
    const chip = button(
      `${displayName(player)}: ${approved ? lang.approveLabel : lang.rejectLabel}`,
      () => {
        const idx = state.approveIds.indexOf(player.id);
        if (idx >= 0) state.approveIds.splice(idx, 1);
        else state.approveIds.push(player.id);
        render();
      },
      "btn player-chip vote-chip" + (approved ? " vote-chip-approve" : " vote-chip-reject")
    );
    grid.appendChild(chip);
  });
  wrap.appendChild(grid);

  wrap.appendChild(button(lang.dayConfirmVote, confirmVote, "btn btn-primary btn-large"));
  wrap.appendChild(
    button(
      lang.dayBackToDiscussion,
      () => {
        state.approveIds = [];
        state.dayStage = "discussion";
        render();
      },
      "btn btn-large"
    )
  );
  return wrap;
}

function confirmVote(): void {
  const approved = voteApproved(state.approveIds.length, state.players.length);
  state.voteApprovedResult = approved;
  state.dayStage = "votingResult";
  render();
}

function buildVotingResultStage(): HTMLElement {
  const lang = t(state.language);
  const wrap = el("div", "stage-block");

  if (state.voteApprovedResult) {
    wrap.appendChild(el("p", "vote-result vote-result-approved", lang.dayVoteApproved));
    wrap.appendChild(
      button(
        lang.missionContinueButton,
        () => {
          startMissionPhase();
        },
        "btn btn-primary btn-large"
      )
    );
    return wrap;
  }

  wrap.appendChild(el("p", "vote-result vote-result-rejected", lang.dayVoteRejected));

  if (state.voteRound >= MAX_VOTE_ROUNDS_PER_MISSION) {
    wrap.appendChild(
      button(
        lang.missionContinueButton,
        () => {
          state.gameOverWinner = "spies";
          state.gameOverReason = "voteExhausted";
          state.rolesRevealed = false;
          state.screen = "gameOver";
          render();
        },
        "btn btn-primary btn-large"
      )
    );
    return wrap;
  }

  wrap.appendChild(
    button(
      lang.dayNextLeader,
      () => {
        state.voteRound += 1;
        state.leaderIndex = nextLeaderIndex(state.leaderIndex, state.players.length);
        state.dayStage = "leader";
        render();
      },
      "btn btn-primary btn-large"
    )
  );
  return wrap;
}

// ============================================================
// mission phase
// ============================================================

function startMissionPhase(): void {
  state.missionTeamOrder = state.nominatedIds.slice();
  state.missionIndex = 0;
  state.decisions = {};
  state.pendingChoice = null;
  state.missionStage = "handoff";
  state.missionElapsedSeconds = 0;
  state.screen = "mission";
  clearActiveInterval();
  startMissionStopwatch();
  render();
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildMissionScreen(): HTMLElement {
  const lang = t(state.language);
  const screen = el("div", "screen mission-screen");

  if (state.missionStage === "moderatorReveal" || state.missionStage === "revealed") {
    return buildMissionRevealArea(screen);
  }

  const currentPlayerId = state.missionTeamOrder[state.missionIndex];
  const currentPlayer = state.players.find((p) => p.id === currentPlayerId)!;

  screen.appendChild(el("div", "mission-clock", formatElapsed(state.missionElapsedSeconds)));

  if (state.missionStage === "handoff") {
    screen.appendChild(el("h2", "screen-title", lang.missionHandoffTitle));
    screen.appendChild(el("p", "screen-instructions", lang.missionPassTo(displayName(currentPlayer))));
    screen.appendChild(
      button(
        lang.missionReadyButton,
        () => {
          state.tapCount = 0;
          state.missionStage = "gate";
          render();
        },
        "btn btn-primary btn-large"
      )
    );
    return screen;
  }

  if (state.missionStage === "gate") {
    const gate = buildTapGateScreen(lang.missionTapToReveal, () => {
      state.missionStage = "decision";
      render();
    });
    gate.appendChild(el("div", "mission-clock", formatElapsed(state.missionElapsedSeconds)));
    return gate;
  }

  if (state.missionStage === "decision") {
    screen.appendChild(el("h2", "screen-title", lang.missionChooseOutcome));
    const isSpy = currentPlayer.role === "spy";
    const options = el("div", "mission-options");
    options.appendChild(
      button(
        lang.missionSuccessOption,
        () => {
          state.pendingChoice = "success";
          state.missionStage = "confirm";
          render();
        },
        "btn btn-large mission-option"
      )
    );
    options.appendChild(
      button(
        isSpy ? lang.missionFailOption : lang.missionSuccessOption,
        () => {
          state.pendingChoice = isSpy ? "fail" : "success";
          state.missionStage = "confirm";
          render();
        },
        "btn btn-large mission-option"
      )
    );
    screen.appendChild(options);
    return screen;
  }

  // confirm
  const choiceLabel = state.pendingChoice === "fail" ? lang.missionFailOption : lang.missionSuccessOption;
  screen.appendChild(el("h2", "screen-title", lang.missionConfirmChoicePrompt(choiceLabel)));
  screen.appendChild(
    button(
      lang.missionConfirmButton,
      () => {
        state.decisions[currentPlayer.id] = state.pendingChoice!;
        state.pendingChoice = null;
        if (state.missionIndex + 1 >= state.missionTeamOrder.length) {
          clearActiveInterval();
          playBeep("final");
          state.missionStage = "moderatorReveal";
        } else {
          state.missionIndex += 1;
          state.missionStage = "handoff";
        }
        render();
      },
      "btn btn-primary btn-large"
    )
  );
  screen.appendChild(
    button(
      lang.missionChangeChoice,
      () => {
        state.pendingChoice = null;
        state.missionStage = "decision";
        render();
      },
      "btn btn-large"
    )
  );
  return screen;
}

function buildMissionRevealArea(screen: HTMLElement): HTMLElement {
  const lang = t(state.language);

  if (state.missionStage === "moderatorReveal") {
    screen.appendChild(el("p", "screen-instructions", lang.missionWakeUpInstruction));
    screen.appendChild(el("p", "screen-instructions", lang.missionModeratorHandoff));
    screen.appendChild(button(lang.missionRevealButton, revealMissionResult, "btn btn-primary btn-large"));
    return screen;
  }

  const record = state.lastMissionResult!;
  const isSuccess = record.result === "success";
  screen.appendChild(el("div", "role-title", isSuccess ? lang.missionResultSuccess : lang.missionResultFail));
  const banner = el("div", "mission-result-banner " + (isSuccess ? "mission-result-success" : "mission-result-fail"));
  banner.textContent = isSuccess ? "✓" : "✗";
  screen.appendChild(banner);

  if (record.requiresTwoFails && record.fails === 1) {
    screen.appendChild(el("p", "screen-instructions", lang.missionTwoFailNote));
  }

  screen.appendChild(button(lang.missionContinueButton, proceedAfterMissionReveal, "btn btn-primary btn-large"));
  return screen;
}

function revealMissionResult(): void {
  const teamSize = state.teamSize;
  const requiresTwoFails = getMissionRule(state.players.length, state.currentMissionNumber).requiresTwoFails;
  const fails = state.missionTeamOrder.filter((id) => state.decisions[id] === "fail").length;
  const result = missionResult(fails, requiresTwoFails);
  const record: MissionRecord = {
    missionNumber: state.currentMissionNumber,
    teamSize,
    requiresTwoFails,
    team: state.missionTeamOrder.slice(),
    fails,
    result,
  };
  state.missions.push(record);
  state.lastMissionResult = record;
  state.missionStage = "revealed";
  render();
}

function proceedAfterMissionReveal(): void {
  const successCount = state.missions.filter((m) => m.result === "success").length;
  const failCount = state.missions.filter((m) => m.result === "fail").length;
  const check = checkMissionsGameOver(successCount, failCount);
  if (check.over) {
    state.gameOverWinner = check.winner!;
    state.gameOverReason = check.reason!;
    state.rolesRevealed = false;
          state.screen = "gameOver";
    render();
    return;
  }

  state.currentMissionNumber += 1;
  state.leaderIndex = nextLeaderIndex(state.leaderIndex, state.players.length);
  state.teamSize = getMissionRule(state.players.length, state.currentMissionNumber).teamSize;
  state.voteRound = 1;
  state.nominatedIds = [];
  state.dayStage = "leader";
  state.screen = "day";
  render();
}

// ============================================================
// game over
// ============================================================

function buildGameOverScreen(): HTMLElement {
  const lang = t(state.language);
  const screen = el("div", "screen game-over-screen");
  screen.appendChild(el("h2", "screen-title", lang.gameOverTitle));
  screen.appendChild(
    el(
      "div",
      "role-title " + (state.gameOverWinner === "resistance" ? "role-shown-resistance" : "role-shown-spy"),
      state.gameOverWinner === "resistance" ? lang.resistanceWins : lang.spiesWin
    )
  );
  screen.appendChild(el("p", "screen-instructions", state.gameOverReason === "voteExhausted" ? lang.reasonVotes : lang.reasonMissions));

  if (!state.rolesRevealed) {
    screen.appendChild(
      button(
        lang.revealRolesButton,
        () => {
          state.rolesRevealed = true;
          render();
        },
        "btn btn-large"
      )
    );
  } else {
    screen.appendChild(el("h3", "stage-title", lang.rolesRevealTitle));
    const list = el("div", "roles-reveal-list");
    state.players.forEach((player) => {
      const row = el(
        "div",
        "roles-reveal-row " + (player.role === "spy" ? "role-shown-spy" : "role-shown-resistance"),
        `${displayName(player)}: ${player.role === "spy" ? lang.roleSpyName : lang.roleResistanceName}`
      );
      list.appendChild(row);
    });
    screen.appendChild(list);
  }

  if (state.gameOverReason === "voteExhausted") {
    screen.appendChild(
      button(
        lang.overrideContinue,
        () => {
          state.voteRound = 1;
          state.gameOverWinner = null;
          state.gameOverReason = null;
          state.dayStage = "leader";
          state.screen = "day";
          render();
        },
        "btn btn-large"
      )
    );
  }

  screen.appendChild(button(lang.backToMenu, exitToMenu, "btn btn-primary btn-large"));
  return screen;
}

resumeIntervalsIfNeeded();
render();
