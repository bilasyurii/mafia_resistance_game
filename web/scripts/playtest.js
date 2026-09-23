/**
 * End-to-end browser playtest for The Resistance pass-and-play app: drives
 * a real Chromium instance through menu -> setup -> the full per-player
 * role-reveal pass-around (with the triple-tap peek gate) -> recap re-peek
 * -> night phase (real 30s timer with beeps) -> day (leader/team size ->
 * discussion timer start/stop -> nomination -> voting) -> a rejected vote
 * (leader rotation) -> an approved vote -> the full mission hand-off
 * sequence (including "choose again") -> moderator result reveal -> the
 * next mission's day screen, plus a quick check of a fresh 7-player setup's
 * suggested spy count and the exit-to-menu confirmation. Fails loudly on
 * any console error, page error, or assertion mismatch. Not part of
 * `npm test` (needs a browser binary and takes ~40s for the real night
 * timer) - run explicitly with `node web/scripts/playtest.js` (or
 * `npm run playtest`, which builds first).
 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const assert = require("node:assert/strict");

const PORT = 8936;
const WEB_ROOT = path.join(__dirname, "..");
const SHOT_DIR = "/tmp/resistance-playtest";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const consoleErrors = [];
const bugs = [];
let shotN = 0;

function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: WEB_ROOT });
    let started = false;
    server.stderr.on("data", (d) => {
      if (!started && d.toString().includes("Serving HTTP")) {
        started = true;
        resolve(server);
      }
    });
    server.on("error", reject);
    setTimeout(() => {
      if (!started) resolve(server);
    }, 1000);
  });
}

async function shot(page, name) {
  shotN += 1;
  const file = path.join(SHOT_DIR, `${String(shotN).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file }).catch(() => {});
}

async function step(page, name, fn) {
  try {
    await fn();
    await shot(page, name.replace(/[^a-z0-9]+/gi, "-"));
  } catch (e) {
    bugs.push(`STEP FAILED "${name}": ${e.message}`);
    await shot(page, `FAIL-${name.replace(/[^a-z0-9]+/gi, "-")}`);
    throw e;
  }
}

function btn(page, name, exact = true) {
  return page.getByRole("button", { name, exact });
}

/** Taps the current full-screen gate 3 times quickly, mirroring a real hurried pass-and-play tap. */
async function tripleTap(page) {
  const gate = page.locator(".tap-gate-screen").first();
  await gate.click();
  await gate.click();
  await gate.click();
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on("dialog", (dialog) => dialog.accept());

  const roleOf = {}; // playerId -> "spy" | "resistance", captured live from each player's own reveal

  try {
    await step(page, "load menu in Ukrainian by default", async () => {
      await page.goto(`http://localhost:${PORT}/index.html`);
      await page.waitForSelector('text="Опір"');
      await btn(page, "Нова гра").isVisible();
    });

    await step(page, "switch language to English via header toggle", async () => {
      await btn(page, "EN").click();
      await page.waitForSelector('text="The Resistance"');
    });

    await step(page, "open setup and reduce to 5 players", async () => {
      await btn(page, "New Game").click();
      await page.waitForSelector('text="New Game Setup"');
      const minus = page.locator(".setup-screen .stepper").first().getByRole("button", { name: "-", exact: true });
      await minus.click();
      await minus.click();
      const value = await page.locator(".setup-screen .stepper-value").first().innerText();
      assert.equal(value, "5", "player count should be 5 after two decrements from 7");
      const spyValue = await page.locator(".setup-screen .stepper-value").nth(1).innerText();
      assert.equal(spyValue, "2", "suggested spy count for 5 players should be 2");
    });

    await step(page, "start the game", async () => {
      await btn(page, "Start Game").click();
      await page.waitForSelector('text="Only Player 1 should look at the screen now."');
    });

    // ---- role reveal pass-around for all 5 players ----
    for (let i = 1; i <= 5; i += 1) {
      await step(page, `player ${i} enters name (if first) and reveals role`, async () => {
        if (i === 1) {
          await page.locator(".name-field input").fill("Alice");
          await btn(page, "Reveal my role").click();
          // REGRESSION: slow taps clear the progress dots and don't reveal the role.
          const gate = page.locator(".tap-gate-screen").first();
          await gate.click();
          await gate.click();
          assert.equal(await page.locator(".tap-gate-dot-filled").count(), 2, "two quick taps should fill two dots");
          await page.waitForTimeout(900); // stopping for longer than the 630ms window must turn the dots off by itself
          assert.equal(await page.locator(".tap-gate-dot-filled").count(), 0, "dots must reset on their own after tapping stops");
          await gate.click();
          await gate.click();
          await page.waitForTimeout(800);
          await gate.click(); // a late third tap must not count either
          assert.equal(await page.locator(".tap-gate-dot-filled").count(), 1, "a late tap starts a fresh sequence");
          await page.waitForTimeout(800);
          assert.equal(await page.locator('text="Your role is:"').count(), 0, "role must stay hidden after a slow tap");
        } else {
          await btn(page, "Reveal my role").click();
        }
        await page.waitForSelector(".tap-gate-screen");
        await tripleTap(page);
        await page.waitForSelector('text="Your role is:"');
        const roleText = await page.locator(".role-name").innerText();
        const label = i === 1 ? "Alice" : `Player ${i}`;
        const idMatch = roleText === "SPY" ? "spy" : "resistance";
        roleOf[i] = idMatch;
        assert.ok(roleText === "SPY" || roleText === "RESISTANCE", `unexpected role text "${roleText}" for ${label}`);
      });

      await step(page, `player ${i} hides role and ${i < 5 ? "passes phone" : "reaches recap"}`, async () => {
        await btn(page, "Hide").click();
        await page.waitForSelector('text="Peek my role again"');
        if (i < 5) {
          await btn(page, "Pass phone to next player").click();
          await page.waitForSelector('text="Only Player ' + (i + 1) + ' should look at the screen now."');
        } else {
          await btn(page, "Pass phone to next player").click();
          await page.waitForSelector('text="Everyone knows their role"');
        }
      });
    }

    await step(page, "recap: re-peek Player 2's role then return to list", async () => {
      await btn(page, "Player 2").click();
      await page.waitForSelector('text="Only Player 2 should look at the screen now."');
      await btn(page, "Peek my role again").click();
      await tripleTap(page);
      await page.waitForSelector('text="Your role is:"');
      await btn(page, "Hide").click();
      await btn(page, "Back to player list").click();
      await page.waitForSelector('text="Everyone knows their role"');
      assert.equal(consoleErrors.length, 0, `console errors after recap re-peek: ${JSON.stringify(consoleErrors)}`);
    });

    await step(page, "proceed to game -> night phase", async () => {
      await btn(page, "Proceed to Game").click();
      await page.waitForSelector('text="Night falls"');
    });

    await step(page, "tap to start the 30s night timer, reload mid-countdown, and confirm it keeps ticking to completion", async () => {
      const nightPlus = page.locator(".night-screen .stepper").getByRole("button", { name: "+", exact: true });
      await nightPlus.click();
      await nightPlus.click();
      await nightPlus.click();
      await page.locator(".night-screen .stepper").getByRole("button", { name: "-", exact: true }).click();
      assert.equal(await page.locator(".night-screen .stepper-value").innerText(), "40", "night timer should be adjustable from the default 30");
      await page.locator(".night-screen .stepper").getByRole("button", { name: "-", exact: true }).click();
      await page.locator(".night-screen .stepper").getByRole("button", { name: "-", exact: true }).click();
      assert.equal(await page.locator(".night-screen .stepper-value").innerText(), "30");
      await page.locator(".tap-anywhere").click();
      await page.waitForSelector(".timer-seconds");
      await page.waitForTimeout(3000);
      await btn(page, "Pause").click();
      const pausedAt = Number(await page.locator(".timer-seconds").innerText());
      await page.waitForTimeout(2500);
      assert.equal(Number(await page.locator(".timer-seconds").innerText()), pausedAt, "a paused timer must not tick");
      await btn(page, "Resume").click();
      await page.waitForTimeout(1500);
      assert.ok(Number(await page.locator(".timer-seconds").innerText()) < pausedAt, "a resumed timer must tick again");
      const beforeReload = Number(await page.locator(".timer-seconds").innerText());
      assert.ok(beforeReload <= 27, `expected the timer to have ticked down before reload, saw ${beforeReload}`);

      await page.reload();
      await page.waitForSelector('text="Night falls"');
      await page.waitForSelector(".timer-seconds");
      const afterReload = Number(await page.locator(".timer-seconds").innerText());
      assert.ok(afterReload <= beforeReload, `REGRESSION: the night countdown must resume from where it left off after a reload, not restart - before=${beforeReload} after=${afterReload}`);

      await page.waitForSelector('text="Time\'s up! Spies close your eyes. City wakes up."', { timeout: 35000 });
    });

    await step(page, "continue to Day 1", async () => {
      await btn(page, "Continue to Day 1").click();
      await page.waitForSelector('text="Mission 1 of 5"');
    });

    await step(page, "day 1: confirm leader (Alice) and default team size 2", async () => {
      const teamSizeValue = await page.locator(".stepper-value").first().innerText();
      assert.equal(teamSizeValue, "2", "mission 1 with 5 players should suggest a team of 2");
      await page.waitForSelector('text="Suggested by the rules: 2"');
      await btn(page, "+").click();
      assert.equal(await page.locator(".suggested-size-differs").count(), 1, "an overridden size must flag the suggestion");
      await btn(page, "-").click();
      assert.equal(await page.locator(".suggested-size-differs").count(), 0);
      await btn(page, "Confirm & start discussion").click();
      await page.waitForSelector('text="Discussion"');
    });

    await step(page, "discussion: start and stop the timer, then nominate players 1 and 2", async () => {
      await btn(page, "Start timer").click();
      await page.waitForSelector(".timer-seconds");
      await btn(page, "Stop timer").click();
      await page.waitForSelector('text="Start timer"');
      await btn(page, "Alice").click();
      await btn(page, "Player 2").click();
      assert.equal(await page.locator("text=Nominated: 2 / 2").count(), 1);
    });

    await step(page, "REGRESSION: voting started by accident can go back to discussion with the nomination kept", async () => {
      await btn(page, "Proceed to voting").click();
      await page.waitForSelector('text="Voting round 1 of 5"');
      await btn(page, "Back to discussion").click();
      await page.waitForSelector('text="Discussion"');
      assert.equal(await page.locator("text=Nominated: 2 / 2").count(), 1, "nomination must survive going back");
      await btn(page, "Start timer").waitFor();
    });

    await step(page, "REGRESSION: a rejected vote (round 1) rotates the leader and returns to the leader stage", async () => {
      await btn(page, "Proceed to voting").click();
      await page.waitForSelector('text="Voting round 1 of 5"');
      // Only one approval out of 5 - not a majority.
      await page.locator(".vote-chip", { hasText: "Alice" }).click();
      await btn(page, "Confirm vote").click();
      await page.waitForSelector('text="Rejected. Leadership passes to the next player."');
      await page.waitForSelector('text="Teams rejected this mission: 1 / 5"');
      await btn(page, "Next leader").click();
      await page.waitForSelector('text="Teams rejected this mission: 1 / 5"');
      await page.waitForSelector('text="Choose the leader"');
      const selected = page.locator(".player-chip-selected");
      await assert.doesNotReject(selected.waitFor());
      assert.equal(await selected.innerText(), "Player 2", "leader should rotate to Player 2 after a rejected vote");
      assert.equal(consoleErrors.length, 0, `console errors after a rejected vote: ${JSON.stringify(consoleErrors)}`);
    });

    await step(page, "round 2: the nomination persists from round 1, so just proceed and approve with a majority", async () => {
      await btn(page, "Confirm & start discussion").click();
      await page.waitForSelector('text="Discussion"');
      assert.equal(await page.locator("text=Nominated: 2 / 2").count(), 1, "the previous round's nomination should still be selected");
      await btn(page, "Proceed to voting").click();
      await page.waitForSelector('text="Voting round 2 of 5"');
      for (const name of ["Alice", "Player 2", "Player 3"]) {
        await page.locator(".vote-chip", { hasText: name }).click();
      }
      await btn(page, "Confirm vote").click();
      await page.waitForSelector('text="Approved! The mission begins."');
      await btn(page, "Continue").click();
      await page.waitForSelector('text="Mission underway"');
    });

    await step(page, "REGRESSION: reloading mid-mission restores the exact hand-off screen and player, not the main menu", async () => {
      await page.waitForSelector('text="Hand the phone to Alice"');
      await page.reload();
      await page.waitForSelector('text="Mission underway"');
      await page.waitForSelector('text="Hand the phone to Alice"');
      assert.equal(consoleErrors.length, 0, `console errors after a reload mid-mission: ${JSON.stringify(consoleErrors)}`);
    });

    await step(page, "mission: Alice hands off, previews decision, changes her mind, then confirms", async () => {
      await page.waitForSelector('text="Hand the phone to Alice"');
      await btn(page, "I have the phone").click();
      await page.waitForSelector(".tap-gate-screen");
      await tripleTap(page);
      await page.waitForSelector('text="Choose the outcome of the mission"');
      const options = page.locator(".mission-option");
      assert.equal(await options.count(), 2, "exactly two decision buttons must be shown, regardless of role");
      await options.first().click();
      await page.waitForSelector('text="Confirm: Success?"');
      await btn(page, "Choose again").click();
      await page.waitForSelector('text="Choose the outcome of the mission"');
      const isAliceSpy = roleOf[1] === "spy";
      if (isAliceSpy) {
        await btn(page, "Fail").click();
        await page.waitForSelector('text="Confirm: Fail?"');
      } else {
        await options.first().click();
        await page.waitForSelector('text="Confirm: Success?"');
      }
      await btn(page, "Confirm").click();
      await page.waitForSelector('text="Hand the phone to Player 2"');
    });

    await step(page, "mission: Player 2 hands off and confirms their decision", async () => {
      await btn(page, "I have the phone").click();
      await page.waitForSelector(".tap-gate-screen");
      await tripleTap(page);
      await page.waitForSelector('text="Choose the outcome of the mission"');
      const isSpy = roleOf[2] === "spy";
      if (isSpy) {
        await btn(page, "Fail").click();
      } else {
        await page.locator(".mission-option").first().click();
      }
      await btn(page, "Confirm").click();
      await page.waitForSelector('text="Everyone wakes up. Hand the phone to the moderator."');
      assert.equal(consoleErrors.length, 0, `console errors during the mission hand-off sequence: ${JSON.stringify(consoleErrors)}`);
    });

    await step(page, "moderator reveals the mission result and continues to mission 2", async () => {
      await btn(page, "Reveal result").click();
      const failed = roleOf[1] === "spy" || roleOf[2] === "spy";
      await page.waitForSelector(failed ? 'text="Mission Failed"' : 'text="Mission Success"');
      await btn(page, "Continue").click();
      await page.waitForSelector('text="Mission 2 of 5"');
      const dots = page.locator(".dot-success, .dot-fail");
      assert.equal(await dots.count(), 1, "exactly one mission dot should be filled in after mission 1");
    });

    await step(page, "exit to menu asks for confirmation and returns to a clean menu", async () => {
      await btn(page, "Menu").click();
      await page.waitForSelector('text="The Resistance"');
      await page.waitForSelector('text="New Game"');
      assert.equal(consoleErrors.length, 0, `console errors after exiting to menu mid-game: ${JSON.stringify(consoleErrors)}`);
    });

    await step(page, "setup remembers the last player count and updates the spy suggestion when it changes", async () => {
      await btn(page, "New Game").click();
      await page.waitForSelector('text="New Game Setup"');
      const playersValue = await page.locator(".setup-screen .stepper-value").first().innerText();
      assert.equal(playersValue, "5", "setup should remember the last-used player count (5) after returning to the menu");
      const plus = page.locator(".setup-screen .stepper").first().getByRole("button", { name: "+", exact: true });
      await plus.click();
      await plus.click();
      const spyValue = await page.locator(".setup-screen .stepper-value").nth(1).innerText();
      assert.equal(spyValue, "3", "suggested spy count for 7 players should update to 3");
    });

    await step(page, "game over announces the winner but keeps roles hidden until 'Reveal roles' is pressed", async () => {
      await page.evaluate(() => {
        const players = [1, 2, 3, 4, 5].map((id) => ({ id, name: "", customName: false, role: id <= 2 ? "spy" : "resistance", hasSeenRole: true }));
        localStorage.setItem(
          "resistance-game-state",
          JSON.stringify({ screen: "gameOver", language: "en", players, gameOverWinner: "spies", gameOverReason: "missionsResolved", rolesRevealed: false })
        );
      });
      await page.reload();
      await page.waitForSelector('text="The Spies win!"');
      const before = await page.locator("body").innerText();
      assert.ok(!/SPY|RESISTANCE/.test(before), `roles must stay hidden before pressing reveal, got: ${before}`);
      await btn(page, "Reveal roles").click();
      await page.waitForSelector('text="Player 1: SPY"');
      await page.waitForSelector('text="Player 3: RESISTANCE"');
    });

    if (consoleErrors.length > 0) bugs.push(`Unhandled console/page errors: ${JSON.stringify(consoleErrors, null, 2)}`);
  } finally {
    await browser.close();
    server.kill();
  }

  if (bugs.length > 0) {
    console.error("\n=== PLAYTEST FAILED ===");
    bugs.forEach((b) => console.error(`- ${b}`));
    console.error(`\nScreenshots: ${SHOT_DIR}`);
    process.exit(1);
  } else {
    console.log(`\nAll playtest steps passed. Screenshots: ${SHOT_DIR}`);
  }
}

main().catch((e) => {
  console.error("Playtest crashed:", e);
  process.exit(1);
});
