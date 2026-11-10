# Play-mode UI prototype (throwaway)

**Question:** What should on-screen chord reading look like (separate from PDF Preview)?

Three structurally different Stage variants, switchable while the app runs.

## How to open

```bash
npm run prototype:play
```

1. Open a song in the editor.
2. Click **Stage**.
3. Flip variants with the floating bottom bar, `?variant=A|B|C` in the URL, or `←` / `→`.

| Key | Name | Idea |
|---|---|---|
| A | Quiet Chart | Continuous scroll, serif title, warm chords, auto-hiding chrome |
| B | Focus Column | Narrow column + section jump rail |
| C | Spotlight | One section per screen, oversized type |

Default is `A`. The switcher is **dev-only** (`import.meta.env.DEV`).

## Shared constraints

- No edit affordances, no tempo/BPM/time forms in the body
- Chord-over-lyric alignment via `padCollisions`
- Always-dark reading surface; Exit always available
- PDF Preview stays the print proof and is unchanged

## After picking a winner

Fold the winner into real `StageView`, drop losing variants + switcher from main, keep this set on a `prototype/play-mode` branch as the primary source.
