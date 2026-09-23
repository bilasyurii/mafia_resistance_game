/** All user-facing strings, in English and Ukrainian. Nothing else in this app hardcodes display text. */

export type Language = "en" | "uk";

export interface Dictionary {
  appTitle: string;
  menuSubtitle: string;
  newGame: string;
  languageToggle: string;
  menuButton: string;
  exitConfirm: string;
  close: string;
  back: string;
  editName: string;
  nameLabel: string;
  namePlaceholder: string;

  setupTitle: string;
  playersCountLabel: string;
  playersRangeHint: string;
  spiesCountLabel: string;
  spiesSuggestedNote: (n: number) => string;
  startButton: string;

  revealWarning: (who: string) => string;
  revealButton: string;
  tapToRevealInstruction: string;
  yourRoleIs: string;
  roleSpyName: string;
  roleSpyDesc: string;
  roleResistanceName: string;
  roleResistanceDesc: string;
  hideRole: string;
  peekAgain: string;
  passPhoneButton: string;
  playerLabel: (n: number) => string;

  recapTitle: string;
  recapInstructions: string;
  recapStartGame: string;
  recapBackToList: string;

  nightTitle: string;
  nightInstruction: string;
  nightTapToStart: string;
  nightTimeUp: string;
  continueButton: string;

  dayMissionLabel: (n: number) => string;
  dayHistoryLabel: string;
  dayRejectedCount: (n: number, max: number) => string;
  dayLeaderTitle: string;
  daySelectLeaderInstruction: string;
  dayTeamSizeLabel: string;
  dayConfirmLeaderButton: string;
  dayDiscussionTitle: string;
  dayNominateInstruction: (size: number) => string;
  dayNominatedCount: (selected: number, size: number) => string;
  dayTimerDurationLabel: string;
  dayStartTimerButton: string;
  dayStopTimerButton: string;
  dayProceedToVoting: string;
  dayVotingTitle: string;
  dayVotingInstruction: string;
  dayVoteRound: (round: number, max: number) => string;
  dayConfirmVote: string;
  dayBackToDiscussion: string;
  dayVoteApproved: string;
  dayVoteRejected: string;
  dayNextLeader: string;
  approveLabel: string;
  rejectLabel: string;

  missionHandoffTitle: string;
  missionPassTo: (who: string) => string;
  missionReadyButton: string;
  missionTapToReveal: string;
  missionChooseOutcome: string;
  missionSuccessOption: string;
  missionFailOption: string;
  missionConfirmChoicePrompt: (choice: string) => string;
  missionConfirmButton: string;
  missionChangeChoice: string;
  missionAllDoneTitle: string;
  missionWakeUpInstruction: string;
  missionModeratorHandoff: string;
  missionRevealButton: string;
  missionResultSuccess: string;
  missionResultFail: string;
  missionTwoFailNote: string;
  missionContinueButton: string;

  gameOverTitle: string;
  resistanceWins: string;
  spiesWin: string;
  reasonMissions: string;
  reasonVotes: string;
  rolesRevealTitle: string;
  revealRolesButton: string;
  backToMenu: string;
  overrideContinue: string;
}

const en: Dictionary = {
  appTitle: "The Resistance",
  menuSubtitle: "A social deduction game of hidden loyalty",
  newGame: "New Game",
  languageToggle: "UA",
  menuButton: "Menu",
  exitConfirm: "Exit to the main menu? The current game will be lost.",
  close: "Close",
  back: "Back",
  editName: "Edit name",
  nameLabel: "Your name (optional)",
  namePlaceholder: "Leave blank to use your number",

  setupTitle: "New Game Setup",
  playersCountLabel: "Number of players",
  playersRangeHint: "5-10 players",
  spiesCountLabel: "Number of spies",
  spiesSuggestedNote: (n) => `Suggested for this many players: ${n}`,
  startButton: "Start Game",

  revealWarning: (who) => `Only ${who} should look at the screen now.`,
  revealButton: "Reveal my role",
  tapToRevealInstruction: "Tap the screen 3 times quickly to reveal",
  yourRoleIs: "Your role is:",
  roleSpyName: "SPY",
  roleSpyDesc: "Disrupt 3 missions together with other spies",
  roleResistanceName: "RESISTANCE",
  roleResistanceDesc: "Successfully complete 3 missions!",
  hideRole: "Hide",
  peekAgain: "Peek my role again",
  passPhoneButton: "Pass phone to next player",
  playerLabel: (n) => `Player ${n}`,

  recapTitle: "Everyone knows their role",
  recapInstructions: "Forgot your role? Tap your name, then hand the phone to that player to peek again.",
  recapStartGame: "Proceed to Game",
  recapBackToList: "Back to player list",

  nightTitle: "Night falls",
  nightInstruction: "Everyone closes their eyes. Spies quietly open their eyes and identify each other. Set the timer below, then tap anywhere to start it.",
  nightTapToStart: "Tap anywhere to start",
  nightTimeUp: "Time's up! Spies close your eyes. City wakes up.",
  continueButton: "Continue to Day 1",

  dayMissionLabel: (n) => `Mission ${n} of 5`,
  dayHistoryLabel: "Missions so far",
  dayRejectedCount: (n, max) => `Teams rejected this mission: ${n} / ${max}`,
  dayLeaderTitle: "Choose the leader",
  daySelectLeaderInstruction: "Tap a player to make them the mission leader",
  dayTeamSizeLabel: "Players needed for this mission",
  dayConfirmLeaderButton: "Confirm & start discussion",
  dayDiscussionTitle: "Discussion",
  dayNominateInstruction: (size) => `Leader nominates ${size} player(s) for the mission`,
  dayNominatedCount: (selected, size) => `Nominated: ${selected} / ${size}`,
  dayTimerDurationLabel: "Timer (seconds)",
  dayStartTimerButton: "Start timer",
  dayStopTimerButton: "Stop timer",
  dayProceedToVoting: "Proceed to voting",
  dayVotingTitle: "Voting",
  dayVotingInstruction: "Ask who approves this team, then tap them. Anyone not marked is counted against.",
  dayVoteRound: (round, max) => `Voting round ${round} of ${max}`,
  dayConfirmVote: "Confirm vote",
  dayBackToDiscussion: "Back to discussion",
  dayVoteApproved: "Approved! The mission begins.",
  dayVoteRejected: "Rejected. Leadership passes to the next player.",
  dayNextLeader: "Next leader",
  approveLabel: "Approve",
  rejectLabel: "Reject",

  missionHandoffTitle: "Mission underway",
  missionPassTo: (who) => `Hand the phone to ${who}`,
  missionReadyButton: "I have the phone",
  missionTapToReveal: "Tap 3 times quickly to reveal your decision",
  missionChooseOutcome: "Choose the outcome of the mission",
  missionSuccessOption: "Success",
  missionFailOption: "Fail",
  missionConfirmChoicePrompt: (choice) => `Confirm: ${choice}?`,
  missionConfirmButton: "Confirm",
  missionChangeChoice: "Choose again",
  missionAllDoneTitle: "All decisions made",
  missionWakeUpInstruction: "Everyone wakes up. Hand the phone to the moderator.",
  missionModeratorHandoff: "Moderator: tap to reveal the mission result",
  missionRevealButton: "Reveal result",
  missionResultSuccess: "Mission Success",
  missionResultFail: "Mission Failed",
  missionTwoFailNote: "This mission needed 2 fail cards to fail.",
  missionContinueButton: "Continue",

  gameOverTitle: "Game Over",
  resistanceWins: "The Resistance wins!",
  spiesWin: "The Spies win!",
  reasonMissions: "3 missions were resolved.",
  reasonVotes: "5 team proposals were rejected in a row.",
  rolesRevealTitle: "Everyone's roles",
  revealRolesButton: "Reveal roles",
  backToMenu: "Back to main menu",
  overrideContinue: "Override: continue the game",
};

const uk: Dictionary = {
  appTitle: "Опір",
  menuSubtitle: "Соціальна дедукційна гра з прихованою лояльністю",
  newGame: "Нова гра",
  languageToggle: "EN",
  menuButton: "Меню",
  exitConfirm: "Вийти в головне меню? Поточна гра буде втрачена.",
  close: "Закрити",
  back: "Назад",
  editName: "Змінити ім'я",
  nameLabel: "Ваше ім'я (необов'язково)",
  namePlaceholder: "Залиште порожнім, щоб отримати номер",

  setupTitle: "Налаштування нової гри",
  playersCountLabel: "Кількість гравців",
  playersRangeHint: "5-10 гравців",
  spiesCountLabel: "Кількість шпигунів",
  spiesSuggestedNote: (n) => `Рекомендовано для цієї кількості гравців: ${n}`,
  startButton: "Почати гру",

  revealWarning: (who) => `Зараз на екран має дивитись лише ${who}.`,
  revealButton: "Дізнатись мою роль",
  tapToRevealInstruction: "Тричі швидко торкніться екрана, щоб побачити роль",
  yourRoleIs: "Ваша роль:",
  roleSpyName: "ШПИГУН",
  roleSpyDesc: "Саботуйте 3 місії разом з іншими шпигунами",
  roleResistanceName: "ОПІР",
  roleResistanceDesc: "Проведіть 3 успішні місії!",
  hideRole: "Сховати",
  peekAgain: "Подивитись роль ще раз",
  passPhoneButton: "Передати телефон наступному гравцю",
  playerLabel: (n) => `Гравець ${n}`,

  recapTitle: "Усі знають свою роль",
  recapInstructions: "Забули роль? Торкніться свого імені, а тоді передайте телефон цьому гравцю, щоб подивитись знову.",
  recapStartGame: "Перейти до гри",
  recapBackToList: "Назад до списку гравців",

  nightTitle: "Настає ніч",
  nightInstruction: "Всі заплющують очі. Шпигуни тихо розплющують очі й впізнають одне одного. Встановіть таймер нижче, а тоді торкніться екрана, щоб його запустити.",
  nightTapToStart: "Торкніться, щоб почати",
  nightTimeUp: "Час вийшов! Шпигуни заплющують очі. Місто прокидається.",
  continueButton: "Перейти до дня 1",

  dayMissionLabel: (n) => `Місія ${n} з 5`,
  dayHistoryLabel: "Місії дотепер",
  dayRejectedCount: (n, max) => `Відхилено команд у цій місії: ${n} / ${max}`,
  dayLeaderTitle: "Оберіть лідера",
  daySelectLeaderInstruction: "Торкніться гравця, щоб зробити його лідером місії",
  dayTeamSizeLabel: "Гравців потрібно для місії",
  dayConfirmLeaderButton: "Підтвердити та почати обговорення",
  dayDiscussionTitle: "Обговорення",
  dayNominateInstruction: (size) => `Лідер висуває ${size} гравця(ів) на місію`,
  dayNominatedCount: (selected, size) => `Висунуто: ${selected} / ${size}`,
  dayTimerDurationLabel: "Таймер (секунд)",
  dayStartTimerButton: "Запустити таймер",
  dayStopTimerButton: "Зупинити таймер",
  dayProceedToVoting: "Перейти до голосування",
  dayVotingTitle: "Голосування",
  dayVotingInstruction: "Запитайте, хто підтримує цю команду, і відзначте їх. Хто не відзначений - вважається проти.",
  dayVoteRound: (round, max) => `Раунд голосування ${round} з ${max}`,
  dayConfirmVote: "Підтвердити голосування",
  dayBackToDiscussion: "Назад до обговорення",
  dayVoteApproved: "Схвалено! Місія починається.",
  dayVoteRejected: "Відхилено. Лідерство переходить до наступного гравця.",
  dayNextLeader: "Наступний лідер",
  approveLabel: "За",
  rejectLabel: "Проти",

  missionHandoffTitle: "Місія триває",
  missionPassTo: (who) => `Передайте телефон гравцю ${who}`,
  missionReadyButton: "Телефон у мене",
  missionTapToReveal: "Тричі швидко торкніться, щоб побачити рішення",
  missionChooseOutcome: "Оберіть результат місії",
  missionSuccessOption: "Успіх",
  missionFailOption: "Провал",
  missionConfirmChoicePrompt: (choice) => `Підтвердити: ${choice}?`,
  missionConfirmButton: "Підтвердити",
  missionChangeChoice: "Обрати ще раз",
  missionAllDoneTitle: "Усі рішення прийнято",
  missionWakeUpInstruction: "Всі прокидаються. Передайте телефон ведучому.",
  missionModeratorHandoff: "Ведучий: торкніться, щоб побачити результат місії",
  missionRevealButton: "Показати результат",
  missionResultSuccess: "Місія успішна",
  missionResultFail: "Місію провалено",
  missionTwoFailNote: "Для провалу цієї місії було потрібно 2 картки провалу.",
  missionContinueButton: "Продовжити",

  gameOverTitle: "Гру завершено",
  resistanceWins: "Опір перемагає!",
  spiesWin: "Шпигуни перемагають!",
  reasonMissions: "Було завершено 3 місії.",
  reasonVotes: "5 пропозицій команди поспіль було відхилено.",
  rolesRevealTitle: "Ролі всіх гравців",
  revealRolesButton: "Показати ролі",
  backToMenu: "На головне меню",
  overrideContinue: "Скасувати поразку і продовжити гру",
};

const DICTIONARIES: Record<Language, Dictionary> = { en, uk };

export function t(language: Language): Dictionary {
  return DICTIONARIES[language];
}
