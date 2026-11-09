Chord Sheet Maker is a local-first React app for editing, transposing, and printing chord charts.

Behavior is specified in `chord-sheet-maker-handoff/SPEC.md`. The screen to match is `chord-sheet-maker-handoff/mockup/`.

Use npm.

Public-domain hymns and original demo charts are the only charts in git and in the bundled app.

## Agent skills

Skills from [mattpocock/skills](https://www.aihero.dev/skills) live in `.agents/skills/`. Read that skill's `SKILL.md` and follow it before the work it names.

### Issue tracker

Issues are GitHub issues on this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical names, unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### While coding

- **tdd** for a new behavior or a bug fix. Red, then green, one vertical slice at a time.
- **codebase-design** for a new module or a seam. Deep module, small interface, test through that interface.
- **diagnosing-bugs** when a failure is not yet reproduced. The loop goes red on the bug before any fix.
- **domain-modeling** when a term is fuzzy. Update `GLOSSARY.md` or `docs/adr/`.
- **code-review** when reviewing a diff, or before calling implementation done.
- **prototype** for a throwaway that answers a UI or state question.
- **pr** when writing a pull request body.
- **writing-for-agents** when editing this file or any doc an agent reads.

When the user names a skill, read `.agents/skills/<name>/SKILL.md` and follow it. `ask-matt` routes when the fit is unclear.
