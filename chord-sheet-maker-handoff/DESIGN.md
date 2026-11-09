# Chord Sheet Maker: Design Spec

**Companion to:** `SPEC.md` (product and technical spec). SPEC says *what* the app does; this file says *how it looks and behaves*.
**Mockup:** `mockup/index.html` (open it in a browser; no build step). Screenshots are in `mockup/screenshot-*.png`.
**Owner:** Johnny Wu. **Audience:** whoever builds it (Cursor).

> Where this file and SPEC.md disagree on something visual, **this file wins**. Known override: SPEC §6.1 suggests dark-blue chords in the PDF. Johnny chose a **classic black-and-white PDF**, so chords print **black, bold** (see §9).

---

## 0. Design answers from Johnny (fixed inputs)

| Question | Answer |
|---|---|
| Overall feel | Clean and minimal, like Notion |
| Theme | Follows the device (light and dark), with a manual override |
| Accent | Purple |
| Laptop layout | Three panes: song list, editor, live PDF preview |
| Chords in the editor | Plain bold chord text, like the printed chart (no pills or boxes) |
| Editing tools | Both: a floating toolbar on the selected chord **and** an inspector side panel |
| Phone | Bottom tabs (Songs, Setlists, Settings); full-screen editor; bottom sheet for chord tools; preview as a toggle |
| PDF | Classic black and white |

Product priorities (from SPEC §0) also drive design trade-offs, in order: **1. accurate chords, 2. customisable chords, 3. transposition, 4. readable multi-page PDFs.**

---

## 1. Design principles

1. **The chart is the interface.** The editor looks like the printed chart: monospace lyrics, bold chord names above them. There are no boxes, pills or coloured chips around chords at rest. Colour shows up only for state (hover, selected, invalid).
2. **Never lie about a chord.** Anything the app can't parse stays exactly as typed and is shown in **red with a wavy underline** everywhere it appears (editor, preview, PDF review). Nothing is silently fixed, respelled or dropped. Suggestions are offered as one-click buttons and never applied automatically.
3. **What you see is what prints.** The editor and the PDF use the same layout rules (same chord-collision padding, same section order), so a chord over "grace" in the editor is over "grace" on paper. The live preview proves it at all times.
4. **Transposing is a view, not an edit.** Changing key or capo never changes the stored song until the user presses **Save as song key**. A purple "From C" chip is always visible while you're looking at a transposed view.
5. **One accent, used sparingly.** Purple marks the one thing that is active (selected chord, primary button, current tab). Everything else is greys.
6. **Every edit is undoable and announced.** Destructive actions show a toast with **Undo**. There are no confirmation dialogs for single-chord edits.
7. **Laptop-first precision, phone-first reach.** Mouse and keyboard get drag, arrow-key nudges and shortcuts. Touch gets large targets in a bottom sheet within thumb reach.

---

## 2. Design tokens

All tokens are CSS custom properties on `:root`. The dark theme overrides the same names. Theme selection:

```css
:root            { /* light tokens */ }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* dark tokens */ } }
:root[data-theme="dark"] { /* dark tokens */ }
```

`data-theme` is absent for **System** (the default), and `light` or `dark` when the user overrides it in Settings or with the sidebar theme button. Store the choice in `localStorage` and apply it before first paint (inline script in `<head>`) to avoid a flash of the wrong theme.

### 2.1 Purple accent scale

| Token | Hex | Use |
|---|---|---|
| `--p-50`  | `#F6F3FF` | Light: soft selected backgrounds, capo banner |
| `--p-100` | `#EDE7FE` | Light: selected ring, hover on soft |
| `--p-200` | `#DCD1FD` | Light: borders on soft surfaces |
| `--p-300` | `#C2AEFB` | Dark: accent text, hover on accent; stage-view chords |
| `--p-400` | `#A383F7` | **Dark accent** (buttons, selected chord) |
| `--p-500` | `#8A5CF2` | Focus ring on preview pages |
| `--p-600` | `#7540E6` | **Light accent** (buttons, selected chord) |
| `--p-700` | `#6430C9` | Light: accent text, primary hover |
| `--p-800` | `#5228A3` | Reserved (pressed) |
| `--p-900` | `#432485` | Reserved |

### 2.2 Semantic colours

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#191919` | Editor and dialogs |
| `--bg-sidebar` | `#FBFBFA` | `#202020` | Library pane |
| `--bg-subtle` | `#F7F7F5` | `#232323` | Line hover, code areas |
| `--bg-canvas` | `#F1F1EF` | `#141414` | Behind PDF pages |
| `--bg-raised` | `#FFFFFF` | `#252525` | Popovers, toolbar, sheet |
| `--bg-hover` | `rgba(55,53,47,.06)` | `rgba(255,255,255,.055)` | Row and button hover |
| `--bg-active` | `rgba(55,53,47,.09)` | `rgba(255,255,255,.085)` | Current song row |
| `--border` | `#E9E9E7` | `#2F2F2F` | Pane dividers, cards |
| `--border-strong` | `#DCDCD8` | `#3A3A3A` | Inputs, outline buttons |
| `--text` | `#37352F` | `#E6E6E4` | Body, lyrics, chords at rest |
| `--text-muted` | `#6F6E69` | `#9B9B97` | Labels, metadata |
| `--text-faint` | `#A5A5A1` | `#6B6B68` | Decorative only (grips, hyphen padding). **Never for content.** |
| `--accent` | `#7540E6` (p-600) | `#A383F7` (p-400) | |
| `--accent-hover` | `#6430C9` | `#C2AEFB` | |
| `--accent-soft` | `#F6F3FF` | `rgba(163,131,247,.14)` | |
| `--accent-text` | `#6430C9` | `#C2AEFB` | Purple text on soft purple |
| `--text-on-accent` | `#FFFFFF` | `#1A1033` | Text on solid accent |
| `--danger` | `#D93A3A` | `#FF7B72` | Invalid chords, delete |
| `--danger-soft` | `#FDECEC` | `rgba(255,123,114,.14)` | |
| `--success` | `#0F7B6C` | `#4CC2AE` | "All chords valid" |
| `--success-soft` | `#E6F4F1` | `rgba(76,194,174,.14)` | |

PDF colours are fixed and **not themed**: paper `#FFFFFF`, ink `#000000`, secondary ink `#333333`, hairlines `#999999`. The preview page is always white, even in dark mode.

### 2.3 Typography

| Role | Font | Fallback stack |
|---|---|---|
| UI | **Inter** (400/500/600/700) | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif` |
| Lyrics and chords | **JetBrains Mono** (400 lyrics, 700 chords editor, 800 chords PDF) | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` |

Both are OFL-licensed, so they can be **self-hosted and embedded in the PDF** (SPEC §1 needs the same font on every device). JetBrains Mono was picked because it separates `0/O`, `1/l/I` and `G/6`, and its bold has the same advance width as regular, so chord columns line up exactly. Self-host the fonts in the real app (the mockup loads them from Google Fonts for convenience).

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `--fs-title` | 30/36 (phone 24/30) | 700 | Song title in editor |
| `--fs-h2` | 26/32 | 700 | Screen titles (Setlists, Settings) |
| `--fs-h3` | 16/24 | 600 | Dialog titles |
| `--fs-section` | 14/20 | 600 | Section labels in editor |
| `--fs-body` | 14/20 (phone 15/22) | 400 | Default UI |
| `--fs-small` | 13/18 | 400–500 | Buttons, rows |
| `--fs-caption` | 12/16 | 400–500 | Metadata, hints |
| `--fs-label` | 11.5/16 | 600 | Inspector field labels |
| `--fs-lyric` | **15** (phone 14) | 400 | Editor lyric row, line height 22 |
| `--fs-chord` | **15** (phone 14) | 700 | Editor chord row, line height 21 |
| Stage | 24 | 400/700 | Stage view lyric/chord |
| Projector | clamp(28px, 4.2vw, 56px) | 600 | Lyrics-only slides |

Editor text size is user-adjustable (S/M/L = 13/15/18) in Settings; chords always match the lyric size.

### 2.4 Spacing, radii, shadows

- **Spacing scale (4 px grid):** 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Radii:** `--r-xs 4px` (chord highlight, key badge), `--r-sm 6px` (buttons, inputs), `--r-md 8px` (popovers, toolbar, cards inside panels), `--r-lg 12px` (dialogs, cards), sheet top corners `16px`, pills `999px`.
- **Shadows:**
  - `--shadow-sm`: `0 1px 2px rgba(15,15,15,.06)` (pressed segmented button)
  - `--shadow-md`: `0 0 0 1px rgba(15,15,15,.05), 0 3px 6px rgba(15,15,15,.08), 0 9px 24px rgba(15,15,15,.12)` (floating toolbar, popovers)
  - `--shadow-lg`: `0 0 0 1px rgba(15,15,15,.05), 0 5px 10px rgba(15,15,15,.1), 0 15px 40px rgba(15,15,15,.2)` (dialogs, bottom sheet, toast)
  - Dark versions use stronger black alpha plus a 1 px white-6% ring (see the mockup CSS).
- **Motion:** 120–220 ms, `cubic-bezier(.2,.8,.2,1)`. The sheet slides in 220 ms. Respect `prefers-reduced-motion` (no slides; fade only).
- **Icons:** 16 px line icons, 1.75 stroke, rounded caps (Lucide set). 20–22 px on phone.

---

## 3. Layout and breakpoints

| Name | Width | Layout |
|---|---|---|
| **Phone** | < 768 px | One screen at a time. Bottom tabs. Editor full screen; chord tools in a bottom sheet; preview is a toggle that replaces the editor. |
| **Tablet** | 768–1199 px | Library + editor (+ inspector when a chord is selected). Preview opens as a 440 px slide-over from the right (file icon in the editor bar). |
| **Laptop** | 1200–1599 px | Three panes. Inspector appears between editor and preview when a chord is selected; the library collapses to a 56 px icon rail to make room. |
| **Wide** | ≥ 1600 px | Four columns at once: library, editor, inspector, preview. No collapsing. |

Pane widths: library **240** (rail **56**), inspector **296**, preview **420** (≥ 1600: 480), editor flexible with a min of 560 and the document column capped at **760** and centred.

### 3.1 Decision: where the inspector lives on laptop

**Docked column between the editor and the preview, opened automatically when a chord is selected; the library collapses to a rail while it's open below 1600 px.**

Why not a tab in the preview pane: the moment you're changing a chord is exactly when you want to see the PDF update, which is priority 4. A tab would hide the preview at that moment. Putting the inspector next to the editor also keeps the mouse travel short (chord → panel), and the song list is the least useful pane while you're fine-tuning one chord. Users can pin the inspector open (panel button in the editor bar) or close it (×, or Esc to deselect). `⌘K` focuses library search and expands the rail.

```
Laptop 1440, nothing selected                    Laptop 1440, chord selected
┌──────────┬───────────────────────┬──────────┐  ┌──┬──────────────────┬─────────┬──────────┐
│ Library  │ Editor                │ Preview  │  │▤ │ Editor           │Inspector│ Preview  │
│ 240      │ flex                  │ 420      │  │56│ flex             │ 296     │ 420      │
└──────────┴───────────────────────┴──────────┘  └──┴──────────────────┴─────────┴──────────┘
```

---

## 4. Screens

Each screen below lists purpose, layout and key states. Wireframes are approximate.

### 4.1 App shell and library (laptop)

```
┌───────────────────────┬──────────────────────────────────────────────────┬──────────────────────────┐
│ [C/E] Chord Sheet M… + │ Songs / Yet Not I…  · Saved  [Visual|ChordPro] ↶ ↷ ▷ ▭ ▯│ Preview A4·2 pages [Export PDF]│
│ ┌───────────────────┐ │──────────────────────────────────────────────────│──────────────────────────│
│ │⌕ Search songs  ⌘K │ │ [− Key C +] [Capo] [1-4-5]          ✓ All chords valid│ Page 1                   │
│ └───────────────────┘ │──────────────────────────────────────────────────│ ┌──────────────────────┐ │
│ Songs   4 songs·2 views│   Yet Not I But Through Christ In Me             │ │ Yet Not I But…       │ │
│ ▌Yet Not I But Thro… C│   Artist       CityAlight                        │ │ CityAlight           │ │
│  Jerusalem          B │   Key          [C] original                      │ │ Key C 4/4 75 bpm     │ │
│   ↳ Capo 4 · G shapes B│   Tempo · Time 75 bpm · 4/4                      │ │ Order: Intro·V1·…    │ │
│  Amazing Grace (…)  D │   Arrangement  [Intro][V1][Intro][V2]… + Add     │ │ ──────────────────── │ │
│  This I Believe…    F │   ─────────────────────────────────────          │ │ INTRO ─────────────  │ │
│   ↳ Key of E         E │   Intro                                          │ │ C - - - | F/A - - -  │ │
│                       │   C - - - | F/A - - - | C/G - - - | F/A - - - |  │ │ VERSE 1 ───────────  │ │
│                       │   Verse 1                                        │ │      C          F    │ │
│                       │               C                     F            │ │ What gift of grace…  │ │
│ ♫ Songs               │   What gift of grace is Jesus, my Redeemer       │ │                      │ │
│ ☰ Setlists            │           C                 Am     G             │ │ …          Page 1 of 2│ │
│ ⇪ Import              │   There is no more for heaven now to give        │ └──────────────────────┘ │
│ ⚙ Settings            │   …                                              │ Page 2                   │
│ ▭ Theme: System       │   + Add section                                  │                          │
└───────────────────────┴──────────────────────────────────────────────────┴──────────────────────────┘
```

- **Song rows:** title (13.5/500, one line, ellipsis), then artist and a **key badge** (mono 11/600 on `--bg-active`). The current row uses `--bg-active`.
- **Saved views** (e.g. Jerusalem capo 4, This I Believe in E) are nested under their song with `↳`, and their badge shows the concert key. Opening one sets the editor's key and capo; it never duplicates the song's content. A view is created from the key or capo popover ("Save this view").
- **Search** filters titles, artists and lyrics as you type. `⌘K`/`Ctrl+K` focuses it.
- **Bottom nav:** Songs, Setlists, Import, Settings, theme cycle (System → Light → Dark).
- **Rail mode (56 px):** logo, expand button and nav icons only, each with a tooltip.

### 4.2 Song editor (visual mode)

Structure, top to bottom:

1. **Editor bar (48 px):** breadcrumb `Songs / Title` and autosave status (`· Saving…` then `· Saved`); mode switch **Visual | ChordPro**; Undo, Redo, Stage, Projector, (tablet) Preview, Inspector toggle.
2. **Transport bar:** the key control `[− Key C +]`, Capo button, Nashville toggle `1-4-5`, the transposed chip (`From C · Save as song key`), and on the right the **chord check chip** (`✓ All chords valid` in green, or `⚠ 2 chords to check` in red, which jumps to the first problem when clicked).
3. **Document column** (max 760 px, Notion-style): title (editable inline), properties table (Artist, Key, Tempo · Time, Arrangement), the **capo banner** when a capo is set (`♫ Capo 4 · showing G shapes · sounds in B`), a hairline, then sections.
4. **Sections:** label (editable inline; Enter commits), a faint kind tag only when the label doesn't already say it (e.g. "Final refrain / tag" shows REFRAIN), and hover actions (Duplicate, Delete, More ⋯). A drag grip appears in the left gutter on hover.
5. **Lines:** three kinds.
   - **Lyric line:** chord row (21 px) above a lyric row (22 px), both monospace. Chords are absolutely positioned at the column of their character index.
   - **Bar line:** `C - - - | F/A - - - |` in mono. Chords are bold, separators faint. Each chord can be selected and edited; it moves by beat, not by letter.
   - **Comment line:** italic UI font, muted ("Intro: repeat the 4-bar progression above.").
6. **+ Add section** at the end (and between sections on hover in the real app).

**Chord collision rule (same as PDF):** if a chord name would touch the next one, pad the lyric at the second chord's position. Mid-word padding shows as faint hyphens (`mur--der`); between words it's spaces. Padding is display-only and never stored in the lyric.

**Wrapping:** long lines wrap only at spaces, into balanced parts (no single orphan word), and continuation parts get a **2ch hanging indent**. Chords travel with their characters. The PDF never wraps; it uses the fit rules in SPEC §6.3.

### 4.3 Chord states (editor)

| State | Look |
|---|---|
| Rest | `--text`, weight 700, no background |
| Hover | `--accent` text on `--accent-soft`, radius 4, cursor `grab` |
| Selected | `--text-on-accent` on solid `--accent`, plus a 2 px `--accent-soft-2` ring. The same chord gets a purple outline in the preview. |
| Dragging | Selected style, `--shadow-md`, cursor `grabbing`; a 2 px purple **drop caret** sits in the lyric row at the target letter |
| Invalid | `--danger` text with a **wavy underline**; selected invalid = white on `--danger` |
| Add ghost | Hovering a letter shows a dashed purple `+ chord` tag in the chord row above it |
| Focus (keyboard) | 2 px `--accent` outline, 2 px offset |

Hit area: each chord has an invisible padding of 6 px top, 4 px sides and bottom (≥ 32 px tall on touch).

### 4.4 Floating chord toolbar

Appears 8 px above the selected chord (below it if there's no room), centred on the chord and clamped inside the editor pane. Hidden while dragging and on phone.

```
          ┌─────────────────────────────────────────┐
          │ «  ‹   C   ›  »  │  ⇄  🗑               │
          └─────────────────────────────────────────┘
                     [C]
What gift of grace is Jesus, my Redeemer
```

| Control | Action | Shortcut |
|---|---|---|
| « | Move to previous word start | ⌥← (Alt+←) |
| ‹ | Move left one letter | ← |
| **C** (chord name, purple mono) | Focus the inspector's chord field | ↵ or F2 |
| › | Move right one letter | → |
| » | Move to next word start (or end of line) | ⌥→ |
| ⇄ | Replace every instance of this chord in the song… | |
| 🗑 | Delete chord | ⌫ / Delete |

Each button has a tooltip with its shortcut. Letter and word buttons are disabled for bar-line chords.

### 4.5 Inspector (chord builder)

Two modes.

**Nothing selected → "Song" panel:** Check chords (green "All 129 chords read correctly" or red "2 chords couldn't be read. Click to review."), a palette of chords used in the song with counts, a short how-to, and the keyboard shortcut list.

**Chord selected → "Chord" panel:**

```
┌ Chord ─────────────────────────── × ┐
│ C/E    Nashville 1/3 in C            │   big name (mono 34/700); capo shows "sounds as E/G#"
│                                      │
│ Chord                  type to change│
│ [ C/E                             ]  │   live validation; red border + message if invalid
│ Enter to apply · Esc to cancel       │
│                                      │
│ Position                             │
│ Verse 1 · line 7 · over "sing", 1st  │
│                                      │
│ In the key of C                      │
│ [C I][Dm ii][Em iii][F IV][G V][Am vi][B° vii°]
│ [C/E I/3][F/A IV/6][G/B V/7][C/G I/5][Csus][Gsus][B♭ ♭VII][A♭ ♭VI][E♭ ♭III]
│                                      │
│ Used in this song                    │
│ [C][F/A][C/G][F][Am][G][Csus]…       │
│                                      │
│ Build a chord                        │
│ Root   [C][D][E][F][G][A][B]         │
│        [♭ flat][♮ natural][♯ sharp]  │
│ Quality [maj][m][7][maj7]            │
│         [m7][sus][sus2][sus4]        │
│         [2][add9][5][6]              │
│         [dim][aug][m7b5][7sus4]      │
│ Bass   [ None ▾ ]  (in-key notes first)
│                                      │
│ [⇄ Replace every C/E…]     [🗑]      │
└──────────────────────────────────────┘
```

- Every control applies immediately (one undo step each). The current root, accidental, quality and the matching suggestion are highlighted.
- Suggestions are the **diatonic chords of the displayed key** (the capo-shape key if a capo is set), then common borrowed chords and inversions (SPEC §4.2 order: used → diatonic → builder).
- Typing an unknown chord (e.g. `Hx7`) is **allowed**: it's stored as raw text, flagged red everywhere, counted in the check chip, and a toast says "‘Hx7’ isn't a recognised chord. Kept as typed and flagged in red. [Undo]".
- When the view is transposed, the inspector edits in the **displayed** key, and the app converts back to the stored key with the same spelling rules (lossless).
- Nashville mode changes how chords are shown on the chart, but the inspector always edits letters and shows the number beside it.

### 4.6 Transpose and capo control

```
[ − | Key C | + ]   [ Capo 4  G shapes ]   [1-4-5]   (From C · Save as song key)
```

- **− / +** move the concert key by a semitone. Names come from the key list `C Db D Eb E F F# G Ab A Bb B` (F#/Gb and Db/C# are user toggles).
- **Key popover:** a 6×2 grid of keys; the original key has a purple underline and the current key is solid purple. Below it are the two enharmonic toggles and a one-line explanation.
- **Capo popover:** a 0–11 grid, then "Easy shapes for B": `Capo 2 · play A shapes`, `Capo 4 · play G shapes`, … (shapes in C, G, D, A, E only).
- With a capo, the button shows `Capo 4 [G shapes]`, the editor shows a capo banner, and the PDF header gets a boxed `CAPO 4 · PLAY G SHAPES`.
- **Spelling** follows SPEC §3.2: target-key scale degrees, so `F/A` in F becomes `E/G#` in E, and `F#sus` in B becomes `Dsus` with capo 4.
- **Save as song key** rewrites stored chords (one undo step) and toasts `Saved Yet Not I in D (was C)`.

### 4.7 Section management

- **Rename:** click the label (contenteditable), Enter or blur commits.
- **Hover actions:** Duplicate, Delete (toast with Undo), More ⋯ menu: Move up / Move down (⌥⇧↑/↓), Duplicate (⌘D), Add chord-only bar line, Add comment line, Add to arrangement, Delete section (⌘⌫).
- **Reorder:** drag the grip in the left gutter. A 2 px purple insertion line shows the drop point. Keyboard: ⌥⇧↑/↓.
- **Add section:** opens a kind menu (Intro, Verse n, Pre-Chorus, Chorus, Bridge, Tag, Instrumental, Interlude, Outro, Custom…). The new section gets one empty lyric line with placeholder text and its label is selected for typing.
- **Arrangement row** (in the properties table): chips in performance order, chorus-like chips tinted purple. Drag to reorder, click a chip for `×2`, `Repeat`, `Remove`. `+ Add` lists sections. Reusing a section never copies its content (SPEC §4.3).
- **Lyric text editing:** double-click a lyric row (or press ↵ with the caret in a line) to edit the text inline. Chord anchors follow their characters by diffing the old and new text; a chord whose character is deleted moves to the nearest surviving character and is briefly flashed. (Not in the mockup: the mockup edits text through ChordPro mode.)

### 4.8 ChordPro mode

The **Visual | ChordPro** switch swaps the document for a monospace textarea with the song's ChordPro source (`{title:}`, `{key:}`, `{start_of_verse: Verse 1}`, `What gift of [C]grace…`, `{comment: …}`). Edits re-parse after 400 ms of idle and update the preview live. Invalid chords stay flagged in the visual view. On laptop ≥ 1600 px, ChordPro mode can sit side by side with the visual view (SPEC §4.4). Syntax highlighting: chords in `--accent-text`, directives in `--text-muted`, invalid chords underlined red.

### 4.9 Import review screen

Every import (paste, ChordPro file, PDF) lands here before saving.

```
Review import
Pasted text · chords-over-lyrics detected. Check it before it's saved.
[✓ 13 chords read] [⚠ 1 needs checking] [2 sections] [Key detected: D]      [Cancel] [Save song]
┌ ⚠ Line 6: H7 isn't a chord the app understands, so it's kept as written and flagged.  ┐
│   Did you mean B7?                                         [Use B7] [Keep as text]    │
└───────────────────────────────────────────────────────────────────────────────────────┘
┌ Source, as pasted ──────────────────┐ ┌ Result · what will be saved ────────────────┐
│ Verse 1                              │ │ Verse 1                                     │
│ D            G/D     D               │ │ D               G/D      D                  │
│ Amazing grace, how sweet the sound   │ │ Amazing grace, how sweet the sound          │
│   D    D/F#   G    D   [H7]          │ │   D     D/F#    G      D   H7 (red, wavy)   │
│ I once was lost but now I'm found,   │ │ I once was lost but now I'm found,          │
└──────────────────────────────────────┘ └─────────────────────────────────────────────┘
```

- Source lines detected as chord lines are tinted `--accent-text`; detected section headings are bold; unparseable tokens get a red box.
- Hovering a chord on either side highlights its twin on the other.
- Each issue card offers a fix or **Keep as text**. Saving with open issues is allowed; the song opens with the check chip in red.
- For PDF imports, the source panel shows the extracted page image with recognised text boxes overlaid.

### 4.10 PDF preview pane and export dialog

**Preview pane:** header `Preview · A4 · 2 pages · key C` with **Export PDF** (primary). Pages are rendered at true A4 proportions (595×842 pt) and scaled to the pane width, with a `Page n` label above each one, 18 px apart on `--bg-canvas`. The selected chord is outlined in purple on the page. Clicking a line on a page scrolls the editor to it.

**Export dialog** (modal, 720 px):

```
┌ Export PDF ───────────────────────────────────────────────── × ┐
│ Paper        [A4 | US Letter]                    Result        │
│ Chords for   [Concert (B) | Capo shapes (G)]     ┌───────────┐ │
│ Chord style  [Letters | Numbers]                 │ 2 pages A4│ │
│ Content      [Full chart | Chords only | Lyrics] │ ✓ no split│ │
│ Columns      [1 | 2]                             │ ✓ header  │ │
│ Fit to       [Auto | 1 page | 2 pages]           │ ✓ Page X/Y│ │
│ Lyric size   ───●────── 12 pt                    │ ✓ B&W     │ │
│ Repeats      [Print in full | "Repeat Chorus"]   └───────────┘ │
│────────────────────────────────────────────────────────────────│
│ Jerusalem - B - Capo 4.pdf                [Cancel] [Download]  │
└────────────────────────────────────────────────────────────────┘
```

Options update the preview pane live behind the dialog. On phone the dialog becomes a full-height sheet. "Share" (in a ⋯ menu) offers the read-only link from SPEC §7.

### 4.11 Setlists

Two columns on laptop: a list of setlists (name, date, song count, `+ New setlist`) and the selected setlist. Each song row has a drag grip, number, title, notes ("Capo 4 for acoustic"), a key badge (click for the key popover), capo and shapes, and a ⋯ menu. Header actions: **Share**, **Stage** (steps through the set), **Export PDF** (one file; each song starts on a new page; footer `Song 2 of 4 · Page 1 of 2`; option to start each song on a left-hand page for two-up stands). On phone the two columns stack.

### 4.12 Stage view

Full-screen, always dark (`#0E0E0E`), regardless of theme. The top bar has Exit, title, key or capo in purple, speed `− Speed 3 +`, **Autoscroll** (play/pause, Space), and **Next section ↓**. The body is mono 24 px with chords in `--p-300`, section labels in `--p-400` small caps with a hairline. Tapping the lower third of the screen jumps to the next section; tapping the upper third goes back. Screen Wake Lock is on while open. In a setlist, swiping left or right changes song, with a `Song 2 of 4` chip.

### 4.13 Projector view

Black background, white Inter 600, centred, one section per slide (lyrics only, chord-padding hyphens and bar lines stripped). Arrow keys, Space, PageUp/PageDown or a click advance. The footer shows `Title · Verse 1 · 1/5` and the key hints in `#666`. Exit with Esc or the corner button. Designed to be dragged onto a second display (Presentation API later).

### 4.14 Settings

Grouped cards, Notion-style rows (label and description on the left, control on the right):
- **Appearance:** Theme (System / Light / Dark), editor text size (S / M / L).
- **Chords:** default chord style (Letters / Numbers), F# or Gb, Db or C#, chord names as written or normalised.
- **PDF defaults:** paper, lyric size, allow two columns.
- **Your data:** Export backup (.json), Restore (with a conflict review).

### 4.15 Phone

```
Songs tab                Editor (chord selected)       Preview toggle
┌──────────────────┐     ┌──────────────────────┐      ┌──────────────────────┐
│ Songs          + │     │ ‹ Yet Not I…  ↶ ▤ ▷  │      │ ‹ Yet Not I…  ↶ ▣ ▷  │
│ [⌕ Search songs ]│     │ [−Key C+][Capo][1-4-5]│     │ [−Key C+][Capo][1-4-5]│
│──────────────────│     │ Verse 1            ⧉🗑⋯│     │  Page 1               │
│ Yet Not I…     C │     │        C          F  │      │ ┌──────────────────┐ │
│ CityAlight·75bpm │     │ What gift of grace is│      │ │ A4 page, scaled  │ │
│ Jerusalem      B │     │   [C]         Am   G │      │ │ to screen width  │ │
│  ↳ Capo 4·G    B │     │ There is no more for…│      │ │                  │ │
│ Amazing Grace  D │     │╭────────────────────╮│      │ └──────────────────┘ │
│ This I Believe F │     ││ C  Nashville 1 Type🗑×│      │  Page 2               │
│  ↳ Key of E    E │     ││[«Word][‹Ltr][Ltr›][Word»]│  │                      │
│                  │     ││ In the key of C       ││      │                      │
│                  │     ││[C][Dm][Em][F][G][Am]→ ││      │                      │
│                  │     ││ Quality [maj][m][7]…  ││      │                      │
│ ♫ Songs ☰ Sets ⚙ │     │╰────────────────────╯│      │                      │
└──────────────────┘     └──────────────────────┘      └──────────────────────┘
```

- **Bottom tabs:** Songs, Setlists, Settings. 22 px icons and 11 px labels; the active tab is purple. They're hidden inside the editor, where the top bar's ‹ goes back.
- **Editor top bar:** back, title (ellipsis), Undo, **Preview toggle** (▤; pressed = showing pages), Stage.
- **Transport** scrolls horizontally if needed; 36 px tall controls.
- **Bottom sheet** (chord tools): grab handle, chord name (mono 28/700), Nashville number, **Type** (keyboard entry), Delete, Close. Then four 48 px nudge buttons (Word ‹‹, Letter ‹, Letter ›, Word ››), a horizontally scrolling in-key suggestion row, and a quality grid. Swipe up expands to the full builder (root, accidental, bass, replace all). Swipe down or × deselects. The editor scrolls so the selected chord sits above the sheet.
- **Adding a chord on touch:** the first tap on a letter shows the `+ tap again` ghost; a second tap on the same letter adds the chord. This stops chords being added by accident while scrolling.
- **Dragging on touch:** chords use `touch-action: none`, so a drag that starts on a chord moves the chord while a drag elsewhere scrolls. A long-press (300 ms) on a lyric letter starts a text selection for lyric editing.

---

## 5. Component inventory

| Component | Variants | States |
|---|---|---|
| **Button** | primary (solid accent), outline, ghost, danger | default, hover, active, focus-visible, disabled (40% opacity), loading (spinner replaces icon) |
| **Icon button** | 28 px (laptop), 40 px (phone) | default, hover, pressed (`aria-pressed` → accent-soft), disabled |
| **Segmented control** | 2–4 options | selected (raised white + ring), unselected, focus |
| **Key control** | − / key / + | default, popover open, transposed (chip appears) |
| **Chip** | neutral, accent, ok, warn | static or clickable (hover darkens) |
| **Key badge** | mono 11/600 | — |
| **Song row** | song, saved view (nested) | default, hover, active, focus, search-match highlight |
| **Section header** | — | default, hover (grip and actions appear), editing label, dragging, drop target |
| **Lyric line** | with chords, without chords | default, hover (subtle bg), add-ghost, wrapped (hanging indent) |
| **Chord** | lyric chord, bar chord | rest, hover, selected, dragging, invalid, invalid+selected, focus |
| **Bar line** | — | default, chord selected, invalid token |
| **Comment line** | — | default, editing |
| **Floating toolbar** | — | shown, flipped below, disabled controls (bar chord) |
| **Inspector** | Song panel, Chord panel | collapsed, open, pinned |
| **Chord input** | — | default, focus (accent ring), invalid (danger ring and message) |
| **Toggle tile** (root / quality) | mono, text | off, on (solid accent), hover, focus |
| **Suggestion tile** | name + roman/count | default, hover, current (accent outline) |
| **Popover** | key, capo, section menu | open/closed; closes on outside click and Esc |
| **Dialog** | export, confirm (rare) | open; focus trapped; Esc closes |
| **Bottom sheet** | chord tools | hidden, peek (default), expanded |
| **Toast** | info, with Undo | enter, visible 3.5 s, exit; hovering pauses the timer |
| **Check chip** | ok, warn | clickable when warn |
| **Preview page** | first page, continuation page | default, highlighted chord |
| **Tabs (phone)** | 3 tabs | current (purple), default |

---

## 6. Interaction details

### 6.1 Selecting

- Click or tap a chord to select it (inspector or sheet opens). Click empty editor space or press Esc to deselect.
- **Tab / Shift+Tab** goes to the next or previous chord in song order (across lines and sections).
- **↑ / ↓** selects the nearest chord (by character index) on the previous or next line that has chords.
- **Shift+click** adds to the selection (multi-select): the toolbar shows `3 chords`, nudges move them all, and Delete removes them all. (Not in the mockup.)

### 6.2 Moving chords

| Input | Effect |
|---|---|
| ← / → | One character (letter or space) |
| ⌥/Alt + ← / → | Previous or next **word start**; → past the last word goes to the end of the line (for held chords like `peace   C`) |
| Home / End | Start or end of the line |
| Drag (mouse) | Snaps to character positions; purple drop caret shows the landing letter; moving < 4 px counts as a click |
| Drag (touch) | Same, starting on the chord |
| Toolbar or sheet buttons | Same as the keys |

Chords never leave their line through nudges. Dragging to another line is allowed in the real app (drop caret appears on the target line). Every move is one undo step; a drag is one step no matter how far it goes.

### 6.3 Adding, editing, deleting

- **Add (laptop):** hover a letter to see `+ chord`, then click. The new chord defaults to the **nearest chord before it on the same line** (or the key's I chord), is selected, and the inspector's chord field is focused with its text selected, so typing replaces it immediately. Enter applies, Esc keeps the default.
- **Add (touch):** tap then tap again (see §4.15).
- **Edit:** Enter or F2 (or click the name in the toolbar) focuses the chord field; double-click a chord does the same. On phone, **Type** opens a keyboard prompt.
- **Delete:** ⌫ or Delete, or the toolbar or sheet trash. Toast: `Deleted C [Undo]`.
- **Replace all:** opens a small field; on apply, toast `Replaced 4 × Csus with C2 [Undo]`.

### 6.4 Undo

- ⌘Z / Ctrl+Z to undo, ⇧⌘Z or Ctrl+Y to redo, plus toolbar buttons. At least 100 steps per song, kept for the session.
- Every undo restores **exact chord positions and the selection**. A toast names what was undone (`Undid: Drag chord`).
- Autosave runs after every committed change (debounced 500 ms): `· Saving…` then `· Saved`. If saving fails: `· Not saved. Retry` in `--danger`.

### 6.5 Keyboard map (laptop)

| Keys | Action |
|---|---|
| ⌘K | Search songs |
| ⌘Z / ⇧⌘Z | Undo / redo |
| ←/→, ⌥←/⌥→, Home/End | Nudge selected chord |
| ↑/↓, Tab/⇧Tab | Select neighbouring chord |
| ↵ / F2 | Edit chord name |
| ⌫ / Delete | Delete chord |
| Esc | Close popover → deselect → exit stage or projector |
| ⌥⇧↑/↓ | Move section |
| ⌘D | Duplicate section |
| ⌘P / ⌘E | Export PDF dialog |
| ⌘[ / ⌘] | Transpose down / up a semitone |
| Space (stage) | Autoscroll play/pause |
| ← → Space (projector) | Previous / next slide |

On Windows and Linux, ⌘ means Ctrl and ⌥ means Alt. Shortcuts never fire while a text field or contenteditable has focus (except Enter/Esc in the chord field).

---

## 7. Accessibility

- **Contrast (WCAG 2.2 AA):** text `#37352F` on white 12.3:1; muted `#6F6E69` on white 5.1:1 (4.9:1 on sidebar); accent `#7540E6` on white 5.8:1 and white on accent 5.8:1; danger `#D93A3A` on white 4.6:1. Dark: text 14.1:1, muted 6.3:1, accent `#A383F7` 6.0:1, danger `#FF7B72` 7.0:1. `--text-faint` (2.5:1) is decorative only.
- **Not colour alone:** invalid chords also get a wavy underline and an icon in the check chip; selected chords also get a solid fill; the current tab also gets weight 600.
- **Focus:** every interactive element shows a 2 px `--accent` focus ring with 2 px offset (`:focus-visible` only). Popovers, dialogs and the sheet trap focus and return it to the trigger on close.
- **Editor semantics:** each line is a `group` labelled `Verse 1, line 2: There is no more for heaven now to give`. Chords are `button`s labelled `Chord C over "no", Verse 1 line 2`, with a roving tabindex so Tab moves between chords. Moves, adds and deletes are announced through an `aria-live="polite"` region ("C moved to 'more'").
- **Keyboard-complete:** everything that drag does, the keyboard can do.
- **Touch targets** are ≥ 44×44 px on phone (nudge buttons 48 px tall).
- **Motion:** honour `prefers-reduced-motion`. Autoscroll never starts by itself.
- **Zoom:** layout holds to 200% browser zoom; at narrow effective widths it switches to the tablet or phone layout.
- **Lighthouse accessibility ≥ 90** (SPEC §9).

---

## 8. Empty, loading and error states

| Where | State | Design |
|---|---|---|
| Library | No songs | Illustration-free card: "No songs yet." [Import a song] [Paste chords]; also "Restore a backup". |
| Library | Search has no match | "No songs match ‘xyz’." and a Clear link. |
| Editor | New song | Title placeholder "Untitled song", one Verse 1 with placeholder lyric, and a hint "Paste a chord chart, or type lyrics and click a letter to add a chord." |
| Editor | Invalid chord | Chord in `--danger` with a wavy underline; check chip `⚠ 1 chord to check` (clicking selects it); inspector message "‘Hx7’ isn't a chord the app understands. It's kept exactly as typed and flagged on the chart and PDF until you fix it." The PDF preview also shows it underlined; **export asks for confirmation** if invalid chords remain ("1 chord isn't recognised and will print as typed"). |
| Editor | Section with no lines | Faint "Empty section. Add a line" row. |
| Inspector | Bar chord selected | Nudge controls disabled with tooltip "Bar chords move by beat". |
| Preview | Rendering | Previous pages stay visible with a thin progress bar in the pane header (no spinners over content). |
| Preview | Song longer than fit target | Amber chip "Doesn't fit in 1 page at 10 pt. Showing 2 pages." |
| Import | Nothing recognised | "We couldn't find chords or lyrics in this file." Show the extracted text so the user can copy it. |
| Import | PDF is a scan (no text) | "This PDF is an image. Text can't be read from it yet." |
| Save | Storage full or blocked | Red `· Not saved. Retry` in the editor bar and a toast with "Export backup now". |
| Offline | (PWA) | Works normally; Settings shows "Available offline". |
| Setlist | Empty | "Add songs from your library" with a search field. |

---

## 9. PDF visual design (classic black and white)

The PDF is the most important output. Everything is black on white so it photocopies and prints on any printer. Hierarchy comes from **weight, size and rules**, never colour.

### 9.1 Page geometry

- A4 portrait (595 × 842 pt), margins **42 pt (≈15 mm)** on all sides; US Letter optional.
- Content width 511 pt. At 12 pt JetBrains Mono (7.2 pt per character) that's **70 characters** per line; at 11 pt, 77.
- The footer sits in the bottom margin band: baseline at 22 pt from the bottom edge.

### 9.2 Page 1 header

```
Yet Not I But Through Christ In Me                         ← Inter Bold 21 pt
CityAlight                                                  ← Inter 10.5 pt, #333
Key C    4/4    75 bpm   ┌─────────────────────────┐        ← 10 pt; "Key C" bold
                         │ CAPO 4 · PLAY G SHAPES  │        ← only with capo: 1.25 pt box, bold caps
                         └─────────────────────────┘
Order: Intro · V1 · Intro · V2 · Intro · V3 · Intro · V4 · Tag · Intro   ← 9 pt, "Order:" bold
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ← 1 pt rule
```

The capo box is the one boxed element on the page, so a guitarist can't miss it on a music stand. In Nashville mode the meta line adds `Numbers in G`.

### 9.3 Running header (pages 2+)

```
Yet Not I But Through Christ In Me (cont.)                Key C · Capo 4 (G shapes)
─────────────────────────────────────────────────────────────────────────────── 0.75 pt
```
9.5 pt; title bold. A loose page is always identifiable.

### 9.4 Footer (every page)

```
─────────────────────────────────────────────────────────────────────────────── 0.6 pt #999
Yet Not I But Through Christ In Me · Key C                              Page 1 of 2
Next page: Verse 3 →                                                    (bold 9.5 pt)
```
- Left: title and key (8.5 pt), then the **next-page cue** in italic, which is what a player needs when laying pages side by side: `Next page: Verse 3 →`, or `End of song` on the last page.
- Right: **`Page X of Y`**, bold 9.5 pt. In setlists: `Song 2 of 4 · Page 1 of 2`.
- Optional CCLI line above the rule (7.5 pt) when the setting is on.

### 9.5 Body

- **Section heading:** Inter Bold 11 pt, UPPERCASE, letter-spacing 0.06 em, followed by a 0.6 pt `#999` rule to the right margin. 22 pt tall, 8 pt gap after each section.
- **Chord row:** JetBrains Mono **ExtraBold (800)**, same size as the lyric, black. Positioned by measured glyph advance at the chord's character index.
- **Lyric row:** JetBrains Mono Regular, default **12 pt** (mockup preview uses 11 pt to match Johnny's current PDFs); line pair height ≈ 2.2 × size.
- **Lines without chords** take only the lyric row height (no blank chord row).
- **Collision spacing:** if chord n would end within 1 character of chord n+1, insert padding into the lyric at chord n+1 (hyphens if inside a word, `mur--der`, spaces between words). Never shrink, overlap or squash chord names.
- **Bar lines:** mono, chords ExtraBold, `- | ` regular, 20 pt line.
- **Comments / instructions:** Inter Italic 9.5 pt, `#222`, 16 pt line.
- **Invalid chords** print exactly as typed with a wavy underline, so the problem is visible on paper too.
- **Repeats:** default prints sections where they occur in the arrangement; option prints one copy with `Chorus ×2` in the heading or a single italic `Repeat Chorus 1` pointer line.

### 9.6 Continuation markers

Only used when a single section is taller than a page (sections that fit are never split, SPEC §6.3):

```
…last line that fits
                                                    Verse 2 continues →     ← italic 9 pt, right-aligned
═════ page break ═════
VERSE 2 (CONT.) ────────────────────────────────────────────────           ← heading repeated with "(cont.)"
next line…
```
A chord row is never separated from its lyric row.

### 9.7 Two-column mode

- Two columns of 245 pt with an 18 pt gutter and a 0.5 pt `#999` vertical rule centred in it (body only; headers and footers span the full width).
- Sections flow down column 1, then column 2; a section never splits across columns.
- Long lines get the 2ch hanging-indent wrap at spaces (§4.2) instead of overflowing. "Fit to N pages" tries reduced spacing, then two columns, then smaller type (min 10 pt), in that order.

### 9.8 Lyrics-only and chords-only

- **Lyrics only:** no chord rows, Inter 12 pt, section headings unchanged (for singers and copy for slides).
- **Chords only:** each lyric line collapses to its chords separated by ` | ` in mono (like the intro bars), so the whole song fits on one page for the band.

---

## 10. What the mockup shows (and doesn't)

**Working:** three-pane layout with all six charts (4 songs + 2 saved views) using the real chord placements from `rebuild_lyrics.py`; selecting a chord populates the floating toolbar and inspector; ←/→ letter nudge, Alt+←/→ word nudge, Home/End, ↑/↓ and Tab selection; drag with a snap caret; click a letter to add; Delete; edit by typing (invalid chords flagged red, never dropped); root, accidental, quality and bass builder; in-key suggestions; replace all; undo/redo with toasts; key picker, ±semitone, capo with easy-shape suggestions, enharmonic toggles; key-aware spelling (e.g. This I Believe F → E gives `A C#m B E/G#`; Jerusalem capo 4 gives `G C/G Dsus Em`); Nashville numbers; save as song key; section rename, duplicate, delete, move, add, add bar line or comment; ChordPro source mode with live re-parse; A4 preview with page-1 header, running header, `Page X of Y`, next-page cue and section-aware pagination; light and dark following the device with a System/Light/Dark override; tablet preview slide-over; phone list, editor, bottom sheet, tap-twice-to-add, preview toggle and bottom tabs; stage view with autoscroll; projector view.

**Static or simplified:** setlists, import review, settings and export options are clickable views but don't persist anything; the PDF download is a toast; dragging a chord to a different line, multi-select, drag-to-reorder sections and arrangement chips, inline lyric text editing, two-column PDF and continuation markers are specified above but not built in the mockup; persistence is in memory only (a reload resets).

**Copyright:** the mockup embeds Johnny's six charts (lyrics he supplied) so it looks real. Keep `mockup/index.html` out of any public repo or public Vercel deploy, or swap in public-domain songs first (SPEC §8).
