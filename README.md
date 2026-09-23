# Rules

https://beincognito.ru/resistance_rules/

https://justmafia.ru/resistance/

https://ihstattler.com/blog/2015/06/the-resistance-how-to-play-mafia-but-better/

# The App

A frontend-only, single-device pass-and-play companion app for The Resistance
(no backend, no accounts, no network calls). One phone acts as the shared
device: it assigns roles, walks each player through a private role reveal,
runs the moderator through the night phase, day discussion/voting, and the
mission hand-off sequence, with timers and beeps at the checkpoints the
rules call for. English and Ukrainian are both supported (toggle in the
header).

Everything lives under `web/` and builds to plain static files
(`index.html`, `styles.css`, `dist/bundle.js`) that any static web host can
serve.

## Scripts

- `npm start` - build and serve locally at http://localhost:8081
- `npm test` (or `npm run test:web`) - pure game-rules unit tests (no browser needed)
- `npm run typecheck:web` - TypeScript type checking
- `npm run playtest` - full Playwright end-to-end run through a real game (~40s, needs `npx playwright install chromium` once)
- `npm run deploy:web` - build and upload `index.html`, `styles.css`, `dist/bundle.js` to your web host over FTP

## Deploying

Copy `example.env` to `.env` in the repo root and fill in your real FTP
host/credentials (`.env` is git-ignored). Set `FTP_REMOTE_DIR` to a folder
dedicated to this app - it should be different from wherever
`mafia_game_predictor` deploys, so the two apps don't overwrite each other.
Then run `npm run deploy:web`.
