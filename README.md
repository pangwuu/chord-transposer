# Chord Sheet Maker

A web app for writing, transposing and printing chord charts, and sharing them with your band. Charts are stored as plain ChordPro-style text, so a song is easy to type, paste in, or fix by hand.

It installs as a PWA and keeps working offline: the whole library is cached on the device and syncs when you reconnect.

## What it does

**Songs**
- Edit a chart as text, or by tapping chords in the inspector. Paste a chart from anywhere and the importer works out which lines are chords and which are lyrics. It also reads ChordPro and PDF files.
- The song list searches title, lyrics and chords, and sorts by title, date added, date edited or key. Adding a song with a title you already have offers to replace it or keep both.
- Transposition, capo, Nashville numbers, flats or sharps and **easy chords** (every chord shown as plain major, minor, dim or aug) change what you see and print. They never change the stored song.
- Optional highlighting for chords that sit outside the song's key, so a typo stands out.
- Undo for edits and deletes. Keyboard shortcuts are listed in Settings, or press `?`.

**Setlists**
- Named, dated, ordered lists. Each song carries its own key, capo and notes for that service.
- Add songs from a searchable, sortable picker that shows which songs are already in the set and when each was last played.
- Copy or share the running order as text for the band chat.

**Stage view**
- Full-screen, scrolling chart for a gig, with auto-scroll, section jumps and an Easy toggle.
- Shows per-song notes and a strip of the chords the song uses. Works with Bluetooth page-turner pedals and a projector.
- Reopens where you left off if the page reloads mid-set.

**Printing and sharing**
- PDF export for one song or a whole setlist, with paper size, text size, columns, easy chords, a strip of the chords used and an optional cover page with the running order. Share the PDF straight from a phone, or download it.
- Share links carry a copy of one song or one setlist.
- JSON backup and restore of the whole library.

**Bands**
- Every library belongs to a band: songs and setlists in Cloud Firestore, synced live to every member and cached for offline use. A solo user is a band of one.
- Sign-in is anonymous. Anyone with the band's invite link can join, and the same link recovers a band on a new device.
- Theme, accent colour, text size and similar preferences stay per device.
- Why Firestore, and what that costs: [docs/adr/0001-band-sync-on-firestore.md](docs/adr/0001-band-sync-on-firestore.md).

## Stack

React 18, TypeScript and Vite. PDF output uses `pdf-lib` and `pdfjs-dist`; sync and auth use Firebase (Firestore and anonymous auth); the PWA comes from `vite-plugin-pwa`. Tests are Vitest and Playwright. Deploys run on Vercel.

## Getting started

You need Node 22 (what CI uses) and npm.

```bash
npm ci
```

Development talks to the Firebase emulators. The emulators need Java 21. Start them in one terminal:

```bash
npm run emulators
```

then the app in another:

```bash
npm run dev
```

and open http://localhost:5173. With no `VITE_FIREBASE_*` variables set, the app connects to the emulators and needs no Firebase project.

### Configuration

`.env.example` lists the four Firebase web-app settings: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` and `VITE_FIREBASE_APP_ID`. They are not secrets, because the security rules in `firestore.rules` are the protection. `.env.production` and `.env.preview` hold the real projects, and Vercel picks one with `--mode $VERCEL_ENV`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5173, against the emulators |
| `npm run emulators` | Firebase auth and Firestore emulators |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serve the production build on port 4173 |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | ESLint |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:emulator` | Tests that need the emulators (`*.emulator.test.ts`) |
| `npm run test:e2e` | Playwright on desktop and a Pixel 5 phone, with an in-memory library |
| `npm run test:e2e:emulator` | Playwright against the emulators (`*.emulator.spec.ts`) |
| `npm run rules:deploy:preview` / `:production` | Deploy `firestore.rules` to that Firebase project |

`npm run test:e2e` starts its own dev server on port 5174 in a test mode that swaps Firestore for an in-memory library. Set `E2E_PREVIEW=1` to run it against a production build instead, as CI does. The first run needs `npx playwright install`.

CI (`.github/workflows/ci.yml`) runs install, typecheck, lint, tests, emulator tests, build and both e2e suites on every pull request.

## Project layout

```
src/domain/   Pure logic with no React: chord parsing and transposition, song and
              setlist operations, chart paste detection, PDF layout and rendering,
              share links, the editor state machine, settings and library types
src/ui/       React components: the editor, inspector, setlist and stage screens,
              import, export, settings and band screens
src/firebase/ Firestore library and band code
src/fixtures/ Public-domain hymns and original demo charts
e2e/          Playwright specs
firestore.rules  Security rules for band data
```

Only public-domain hymns and original demo charts belong in git and in the bundled app.

## Docs

- [chord-sheet-maker-handoff/SPEC.md](chord-sheet-maker-handoff/SPEC.md) specifies the behaviour, and `chord-sheet-maker-handoff/mockup/` is the screen to match.
- [GLOSSARY.md](GLOSSARY.md) defines the terms: song, setlist, running order, easy chords, band, library.
- [docs/adr/](docs/adr/) records architecture decisions.
- [AGENTS.md](AGENTS.md) and `docs/agents/` hold the conventions for coding agents, including how issues are tracked.
