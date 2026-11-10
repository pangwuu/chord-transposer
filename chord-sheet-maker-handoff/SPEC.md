# Chord Sheet Maker — Product & Technical Spec

**Owner:** Johnny Wu (GitHub `pangwuu`)  
**Repo:** `pangwuu/chord-sheet-maker`  
**Hosting:** Vercel (auto-deploy from `main`, preview deploys on PRs)  
**Users:** Johnny plus his worship band/team, on laptop and phone. No accounts or cloud sync in v1.

---

## 0. Priorities (in order — when trade-offs arise, the higher one wins)

1. **Accurate chords.** A chord is never silently changed, dropped, misplaced, or misspelled.
2. **Customisable chords.** Any chord can be moved, added, edited, or deleted, and custom chords can be built.
3. **Transposable keys.** Any key, capo, correct sharp/flat spelling, reversible.
4. **Printable, readable PDFs** that make sense when several pages are laid out on a music stand.

Everything else (setlists, stage view, projector view, imports) is secondary and must not compromise 1–4.

---

## 1. Stack

- TypeScript (strict), React, Vite.
- ChordPro as the storage/interchange format. Use **ChordSheetJS** for parsing/serialising where it helps, but the app's own chord model (section 3) is the source of truth for transposition and spelling, with its own tests.
- Storage: IndexedDB (via a small wrapper such as `idb`), with export/import of a JSON backup and per-song `.cho` export.
- PDF: generated client-side with a deterministic layout engine (recommended: `pdf-lib` or `@react-pdf/renderer` with an embedded monospace + sans font). **Do not rely on the browser's print dialog for the PDF**, because browser print pagination is inconsistent across devices. A print-CSS view may exist as a fallback.
- Testing: Vitest for unit tests, Playwright for end-to-end and PDF snapshot tests.
- Lint/format: ESLint + Prettier. CI on GitHub Actions: typecheck, lint, test, build.

---

## 2. Data model

```ts
type Song = {
  id: string;
  title: string;
  artist?: string;
  writers?: string;
  originalKey: Key;        // key the song was entered in
  tempo?: number;          // bpm
  timeSignature?: string;  // "4/4"
  ccli?: string;
  notes?: string;
  sections: Section[];
  arrangement?: ArrangementItem[]; // order to perform; defaults to sections in order
  updatedAt: string;
};

type Section = {
  id: string;
  kind: 'intro'|'verse'|'prechorus'|'chorus'|'bridge'|'tag'|'instrumental'|'interlude'|'outro'|'custom';
  label: string;           // "Verse 1", "Chorus", or custom text
  lines: Line[];
};

type Line =
  | { type: 'lyric'; text: string; chords: ChordPlacement[] }
  | { type: 'bars'; bars: Bar[] }        // chord-only lines like | C | F/A | C/G |
  | { type: 'comment'; text: string };   // "Repeat x2", "Build", etc.

type ChordPlacement = {
  id: string;
  index: number;    // character offset into lyric text (0..text.length); text.length = after the last word
  chord: Chord;
};

type Bar = { chords: Chord[]; beats?: number[] }; // e.g. "C - - -" = C for 4 beats

type ArrangementItem = { sectionId: string; repeat?: number; note?: string };
```

- Chords are stored **as parsed structures**, not strings, and serialised back to ChordPro text.
- Chord positions are stored as a **character index into the lyric**, never as pixel or column positions. Rendering computes the column.

---

## 3. Chord model (priority 1 and 3)

```ts
type Note = { letter: 'A'|'B'|'C'|'D'|'E'|'F'|'G'; accidental: ''|'#'|'b'|'##'|'bb' };
type Chord = {
  root: Note;
  quality: string;   // normalised suffix: '', 'm', '7', 'maj7', 'm7', 'sus', 'sus2', 'sus4', 'add9', '2', '5', '6', 'm6', '9', 'dim', 'dim7', 'aug', 'm7b5', ...
  bass?: Note;       // slash chord bass
  raw: string;       // original text, for round-trip and error display
};
```

### 3.1 Parsing and validation
- A strict parser accepts the standard chord grammar: root, optional accidental, quality suffix, optional `/bass`.
- Anything that does not parse is **flagged visibly** (red underline in the editor, listed in a "Check chords" panel). It is never silently dropped or "fixed".
- Common aliases are normalised for display but `raw` is kept: `Cmaj7 = CM7 = CΔ7`, `Csus = Csus4` (show as written by the user unless they choose a normalisation setting), `Cmin = Cm`.
- No-chord markers (`N.C.`) are supported and never transposed.

### 3.2 Transposition
- Transpose by semitones, or by choosing a target key.
- **Spelling is key-aware**, not "always sharps":
  - Sharp keys use sharps: G, D, A, E, B, F#, C# (and their relative minors). In B: `F#`, `C#m`, `D#m`, `G#m`, `E/G#`.
  - Flat keys use flats: F, Bb, Eb, Ab, Db, Gb (and relative minors). In F: `Bb`, `Gm`, `Dm`, `C/E`.
  - C / Am: naturals, with `Bb` and `F#` chosen by function (e.g. bVII = `Bb`, `D/F#`).
  - Enharmonic choice for the ambiguous key (F#/Gb, C#/Db) is a user toggle, defaulting to F# and Db.
  - Slash bass notes follow the same key spelling (`F/A` in F → `E/G#` in E, not `E/Ab`).
  - Spell chords against the target key's scale degree, so the interval spelling stays correct (e.g. a III chord in B is `D#m`, never `Ebm`).
- Transposing is **lossless and reversible**: transposing +3 then −3 returns exactly the original chord strings (property-based test over all chords and keys).
- Transposed views do not overwrite the stored song unless the user explicitly chooses "Save as the song's key".
- **Capo:** a capo setting shows the shapes to play (concert key minus capo), with a header like "Capo 4 — play G shapes (sounds in B)". The app suggests friendly capo positions for a target key (shapes in C, G, D, A, E).

### 3.3 Nashville numbers
- Optional display mode: chords shown as numbers relative to the current key (`1`, `4/6`, `5sus`, `b7`, `2m`). Toggle per view and in PDF export.

---

## 4. Editing (priority 2)

Editing works with mouse, keyboard, and touch. Every action is undoable (undo/redo stack, at least 100 steps) and autosaves.

### 4.1 Moving chords
- **Drag** a chord along its lyric line; it snaps to character positions, with a preview caret showing where it will land.
- **Keyboard nudge** with a chord selected: `←/→` moves one character, `Alt/Option+←/→` moves to the previous/next word start, `Home/End` goes to the line start or end. On touch, a selected chord shows ◀ ▶ buttons (letter) and ⏮ ⏭ buttons (word).
- Moving a chord past the end of the line places it after the last word (for held notes); it never jumps to another line unless dragged there.

### 4.2 Adding, editing, and deleting
- Click or tap any character gap in a lyric to add a chord there.
- The chord picker shows, in this order: chords already used in this song, then the **diatonic chords of the current key** (I ii iii IV V vi vii°, with common borrowed chords bIII, bVI, bVII and slash inversions like I/3 and IV/1), then a full builder.
- **Chord builder:** root + accidental, quality (dropdown of common qualities plus free text, validated), optional slash bass. A live preview shows the result. Custom chords are added to the song's palette.
- Double-click or tap-and-hold a chord to edit it in place; typing is validated live.
- `Delete`/`Backspace` removes the selected chord.
- Multi-select (shift-click) to move or delete several chords at once.
- A "Replace chord" action swaps every instance of a chord in the song (e.g. all `Csus` → `C2`).

### 4.3 Sections and arrangement
- Add, rename, duplicate, delete, and drag to reorder sections.
- Section kinds come with standard labels (Verse 1, Pre-Chorus, Chorus, Bridge, Tag, Instrumental...) plus custom labels.
- An arrangement can reuse a section ("Chorus ×2") without duplicating its content.
- Chord-only bar lines for intros and instrumentals, edited as `| C - - - | F/A - - - |` with validation of each chord.
- Comment lines ("Repeat ×2", "Build", "Drums only").

### 4.4 Text editor mode
- A toggle to edit the raw ChordPro text directly, side by side with the live rendered chart. Both views stay in sync.

### 4.5 Song details
- Editable title, artist, writers, original key, tempo, time signature, CCLI number, notes.

---

## 5. Importing songs

1. **Bracket/ChordPro text** (`What [C]gift of grace`, with `{title:}`, `{key:}`, `{start_of_chorus}` and similar directives).
2. **Chords-over-lyrics plain text** (the common format on worship sites). Detect chord lines (lines where every token parses as a chord) and map each chord to the lyric character beneath its column. Detect section headings ("Verse 1", "Chorus:", "Bridge").
3. **ChordPro files** (`.cho`, `.chordpro`, `.chopro`, `.crd`).
4. **PDF upload** (best effort): extract text with positions (pdf.js), rebuild chords-over-lyrics lines from x/y coordinates, then run importer 2.

**Every import goes through a review screen before saving**: the rendered result side by side with the source text, a count of chords found, and any unparseable tokens highlighted. Nothing that looks like a chord is ever discarded without being shown to the user.

---

## 6. PDF output (priority 4)

The PDF must be readable at a distance on a music stand, with pages laid side by side.

### 6.1 Page layout
- Default A4 portrait; US Letter as an option.
- Margins of at least 15 mm.
- Fonts embedded: a monospace face for lyric+chord lines (so alignment is exact) and a sans face for headings. Default lyric size 12 pt, chords 12 pt bold in a distinct colour that also prints well in greyscale (e.g. dark blue). Font size is adjustable from 10–16 pt.
- Chords are positioned by measuring the actual rendered lyric text (character widths in the embedded monospace font), so they always sit over the correct syllable.
- If two chords are too close to fit, the lyric is padded with a spacer (as on professional charts) instead of letting the chord names overlap.

### 6.2 Header and footer (every page)
- **Page 1:** title (large), artist/writers, key, capo line if any, tempo, time signature, and the arrangement order as a compact line (e.g. `V1 C V2 C B C C Tag`).
- **Every following page:** a slim running header with the title, key, and capo, so a loose page is identifiable.
- **Footer on every page:** `Page 2 of 3`, and in setlists also the song's position (e.g. `Song 3 of 6`). Optional CCLI line.
- When a section continues onto the next page, the bottom of the page shows `Verse 2 continues →` and the next page starts with `Verse 2 (cont.)`.

### 6.3 Pagination rules
- **Never split a section across pages if it fits on a page by itself**; move the whole section to the next page instead.
- If a section is longer than a page, split it only between lines, never between a chord line and its lyric.
- Avoid a page that holds just one short section at the end: try fitting, in order, by reducing spacing, then by switching to two columns (if the user allowed it), then by reducing font size (never below 10 pt).
- A "Fit to N pages" option (1, 2, auto) that applies these rules.
- **Two-column mode:** sections flow down column 1 then column 2. A section never splits across columns.
- **Side-by-side layout check:** pages are designed to be laid left to right, so an arrangement should be readable without flipping back. Repeated sections are printed where they occur in the arrangement by default (option: print once with "Chorus ×2" or a "Repeat Chorus" pointer instead).

### 6.4 Export options
- Concert key or capo shapes; letters or Nashville numbers; full chart, chords only, or lyrics only.
- Single song or a whole setlist as one PDF. For a setlist, each song starts on a new page (option: start each song on a right-hand page for two-up stands).
- File name: `Song Title - Key.pdf` (with `- Capo 4` when relevant); setlist: `Setlist Name - Date.pdf`.
- The PDF is generated identically on phone and laptop (same layout engine, same fonts).

---

## 7. Other views (secondary)

- **Stage view:** Quiet Chart reading mode — large text, dark mode, auto-hiding chrome with Pin (Exit / key / Speed / Autoscroll / Next section / Next song + transpose/Capo/accidentals/Nashville), in-flow section headings, chords over lyrics with wrap, screen wake lock; autoscroll default 0.8 in 0.1 steps; session-local controls (no save-back); uses the setlist order.
- **Projector view:** lyrics only, large, one section per screen, arrow keys to advance.
- **Setlists:** name, date, ordered songs, key and capo per song, notes; export as one PDF; step through on stage.
- **Sharing:** export a song or setlist as a file, and a share link that encodes the song in the URL (compressed). Opening the link imports an editable local copy into the recipient's library (no account). For view-only handoff, export a PDF instead.

---

## 8. Seed content

Preload Johnny's six charts. The chord placements are in the reference script (`rebuild_lyrics.py`) and PDFs attached alongside this spec:
- Yet Not I But Through Christ In Me — C
- Jerusalem — B (and a Capo 4, G shapes version as a saved view)
- Amazing Grace (My Chains Are Gone) — D
- This I Believe (The Creed) — F (and E as a saved view)

These must be private to Johnny's browser (lyrics are copyrighted), so ship them as an importable file rather than in a public page.

---

## 9. Acceptance criteria

**Chord accuracy**
- Parser unit tests cover every quality listed in 3, slash chords, double accidentals, and `N.C.`; invalid tokens are flagged and never dropped.
- Round trip: import ChordPro → export ChordPro produces identical chord text and positions.
- Transposition tests for all 12 keys, including the examples: `F/A` in F → `E/G#` in E; `Bb` in F → `A` in E; B-key chords spelled `F#`, `D#m`, `G#m`; Capo 4 on B shows G shapes.
- Property test: transposing +n then −n is the identity for every chord in a large generated set.

**Editing**
- Drag, keyboard nudge (letter and word), add, edit, delete, multi-select, and replace-all all work on laptop and phone (Playwright on desktop and mobile viewports).
- Undo/redo restores exact chord positions.

**PDF**
- Snapshot tests render each seed song to PDF and compare against approved images.
- Automated checks: no section split across pages when it fits on one page; every page after the first has the running header; every page has "Page X of Y"; chord glyphs never overlap each other or the margins.
- Manual check: print the Jerusalem and This I Believe charts, lay them side by side, and confirm they read in order without confusion.

**General**
- Lighthouse accessibility score at least 90; works offline after the first load (PWA).
- Deployed on Vercel from `main`.

---

## 10. Suggested build order

1. Chord model, parser, transposer, and spelling, with full tests (priorities 1 and 3).
2. ChordPro import/export and the song data model.
3. Rendered chart view plus the editor (move, add, edit, delete chords; sections) (priority 2).
4. PDF layout engine and pagination (priority 4).
5. Song library, storage, backup.
6. Importers for chords-over-lyrics and PDF.
7. Setlists, stage view, projector view, sharing.
