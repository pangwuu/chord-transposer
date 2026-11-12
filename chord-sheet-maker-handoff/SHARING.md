# Sharing and Sync — Proposed Spec

**Status:** proposed, not built. When accepted, it replaces the **Sharing** bullet in `SPEC.md` §7, the "No accounts or cloud sync in v1" line in the `SPEC.md` header, and the IndexedDB storage line in `SPEC.md` §1.

**Phase B is superseded** by `docs/adr/0001-band-sync-on-firestore.md` and GitHub issue #43: the cloud library is a band, joined with an invite link, with anonymous sign-in and no IndexedDB migration. Where §4 and §8 differ from those, they are history. Phases A and C are still proposed.

Terms (library, share link, setlist file, backup) are defined in `GLOSSARY.md`. "Library link" below is the old name for the invite link.

---

## 1. The problem

Today a share link carries the whole song or setlist, gzipped, after the `#`, capped at 12,000 characters (`src/domain/share.ts`). Setlist links fail at about three songs, so they are not usable for a Sunday set.

Measured on the bundled charts (`src/fixtures/charts.ts`), link length per song:

| Song | Lines / chords | Link today | Link without inner ids |
| --- | --- | --- | --- |
| Amazing Grace (4 sections) | 16 / 56 | ~4,050 chars | ~1,240 chars |
| First Light (3 sections) | 6 / 12 | ~2,290 chars | ~800 chars |
| 3 × Amazing Grace, fresh ids | — | ~10,200 chars | — |

About 70% of a link is the random UUIDs on every section, line and chord placement. UUIDs do not compress. The lyrics and chords themselves are small.

Second problem: each browser holds its own library in IndexedDB. Laptop and phone do not see each other, the band only ever has copies, and clearing site data loses everything not in a backup file.

## 2. Plan in three phases

Each phase ships on its own and is useful without the next.

| Phase | What changes | Server | Size |
| --- | --- | --- | --- |
| A. Compact links | Share links drop inner ids | None | Small; hours |
| B. Cloud library | Library lives in Firestore, opened by a secret link, syncs live, works offline | Firebase (existing project) | Large; days |
| C. Short share links | A setlist link becomes `#/s/<id>`, any size | Firestore, same project | Small once B exists |

Phase A comes first whatever is decided about B. If B is rejected, C can still be built on Vercel Blob instead (§5).

---

## 3. Phase A — Compact share links

### Behaviour
- A new link format `3.` encodes a bundle with song ids and setlist ids kept, and section, line and chord placement ids left out.
- Arrangement items refer to sections by position in the compact form, since section ids are gone.
- On import, the app gives every section, line and chord placement a fresh id, then maps arrangement positions back to the new section ids.
- Song id is kept so that importing the same song again updates it instead of duplicating it (`mergeBundle` already relies on this).
- Links in format `1.` and `2.` still open. New links are always `3.`.
- Shared files and backups keep the full shape with all ids; only links are compacted.
- The 12,000 character cap stays. The "too large" message and the Download file fallback stay for anything that still goes over.

### Expected result
Roughly 1–3k characters per typical song, so about 5–8 songs per setlist link. That is an estimate from two charts; measure a real 6-song set before relying on it.

### Acceptance
- Round trip: `readShare(encode(bundle))` gives songs whose chords, chord positions, lyrics, arrangement order and named views equal the originals, ignoring inner ids.
- A `1.` and a `2.` link made by the current code still import.
- A test asserts a 5-song setlist built from realistic charts fits under the cap.

---

## 4. Phase B — Cloud library on Firestore

### 4.1 What the user sees
- No sign-in, ever, in this phase.
- The first time the app opens on a device, it creates a **library** in Firestore with a long random id and opens it.
- Settings → **Library** shows the library's name, a **Copy library link** button, and **Open another library** (paste a link).
- Anyone who opens a library link (`#/join/<libraryId>`) sees and edits that library. That is how laptop and phone share one library, and how a band shares one.
- An edit on one device shows on the others within a couple of seconds while online.
- Offline, the app runs from a local cache: stage view, editing and PDF export keep working, and edits upload on reconnect.
- After joining, the id is saved on the device and removed from the address bar, so screenshots and history do not leak it.
- Losing every device and the link loses access. The backup file in Settings stays the safety net, and the app nudges once a month to download one.

### 4.2 Joining when you already have songs
A device that already has a library and opens a different library link asks once:
- **Switch to this library** — the device now opens the new one. The old one still exists and its link is kept under Settings → Library → Recent.
- **Bring my songs into it** — copies the device's songs and setlists into the new library, then switches.

One library is open at a time. A device remembers the libraries it has opened so the user can switch back.

### 4.3 First run after this ships
- If the device's IndexedDB library (`chord-sheet-maker`) has songs, they are uploaded once into the device's new cloud library.
- The IndexedDB database is then left as it is, read-only, as a fallback copy. The app stops writing to it.
- A device that has never been online creates its library id locally; Firestore uploads when it connects.

### 4.4 Data layout
```
libraries/{libraryId}                       name, createdAt, schemaVersion
libraries/{libraryId}/songs/{songId}        Song + sync fields
libraries/{libraryId}/setlists/{setlistId}  Setlist + sync fields
shares/{shareId}                            Phase C, see §6
```
- `Song` and `Setlist` keep their current shape (`src/domain/song.ts`, `src/domain/library-types.ts`), so share links, setlist files and backups keep working unchanged.
- Settings stay on the device, not in the library.
- Sync fields on every song and setlist document:

| Field | Purpose |
| --- | --- |
| `schemaVersion` | Lets the song shape change later without breaking older devices |
| `serverUpdatedAt` | Server timestamp; decides "newest wins", independent of device clocks |
| `updatedBy` | Random per-device id; drives "changed elsewhere" notices, later history |
| `deleted` | Tombstone instead of a hard delete, so offline devices learn about deletes |

- A whole song is one document. Firestore's limit is 1 MB per document; a song is a few KB.

### 4.5 Access rules
- Reading or writing `libraries/{id}` and anything under it needs only the id. Knowing the id is the access.
- Listing the `libraries` collection is denied, and no collection-group read is allowed on `songs` or `setlists`, so ids cannot be discovered.
- Writes are rejected when a document is over a size limit or has the wrong shape (required fields and types).
- App Check is on, so only the deployed app (and the emulator in tests) can reach the database.
- The library id is at least 128 bits of randomness (a UUID or longer).

### 4.6 Sync behaviour
- **Conflicts:** the later save of a whole song wins. Two people editing the same song at the same time lose one set of changes. Finer merging is out of scope (§7).
- **Song open while it changes elsewhere:** no unsaved edits → it refreshes in place. Unsaved edits → the user's version is kept and a notice says "Changed on another device"; saving overwrites.
- **Stage view** never re-renders mid-song from a remote change; it picks up changes when moving to the next song.
- **Save rate:** cloud saves wait about 3 seconds after typing stops (today's IndexedDB save waits 0.5 s), to stay well inside the free tier's daily write allowance.
- **Deleting a song** sets its tombstone and removes it from every setlist in one batched write.
- **Undo/redo** stays local to the device and the editing session.

### 4.7 Code
- A `FirestoreLibrary` adapter implements `LibraryRepository` beside `idb-library.ts` and `memory-library.ts`.
- `LibraryRepository` gains `subscribe(onChange)`, called with changed songs and setlists when remote edits arrive. The in-memory adapter implements it too, so tests can simulate remote edits.
- The in-memory adapter stays as the test back end. The IndexedDB adapter stays for the one-time upload in §4.3 and can be removed later.
- Firestore offline persistence is on (the SDK keeps its own IndexedDB cache, separate from `chord-sheet-maker`).
- Firebase config lives in env vars read by Vite; nothing secret is committed.
- Rules and sync are tested against the Firebase Local Emulator in CI.

### 4.8 Acceptance
- Two browsers on the same library link: a chord moved in one appears in the other within 3 s.
- Offline edit in one browser, reconnect: the edit arrives in the other.
- Rules tests: get by id allowed; listing `libraries` denied; collection-group query on `songs` denied; oversized and malformed writes denied.
- A device with songs in IndexedDB uploads them all on first run, and a second run uploads nothing.
- Stage view runs with the network off after one online load.

---

## 5. Phase C — Short share links

Fixes setlist links for good, at any size, without giving away the whole library.

- **Copy share link** on a setlist uploads the same bundle the app builds today to `shares/{shareId}` and copies `…/#/s/<shareId>`.
- Opening the link downloads the bundle and imports it through the existing `mergeBundle` path. The recipient gets a copy, as now.
- A share is frozen: editing the setlist later does not change it. Sharing again makes a new link.
- Shares expire after 30 days (Firestore TTL policy on an `expiresAt` field; check TTL is available on the plan in use).
- Rules: create and get allowed, list, update and delete denied. Size-capped.
- Offline or upload failed → fall back to the compact link from Phase A, then to the file.
- Song links stay inline (Phase A) since one song fits.

If Phase B is not adopted, the same feature runs on a Vercel serverless function plus Vercel Blob, keyed by a random id. Same behaviour, different store.

---

## 6. Alternatives considered

| Option | What it gives | Why not chosen (or not alone) |
| --- | --- | --- |
| **Raise the link cap** | Bigger links with no work | Long links get cut by chat apps; failures are silent and confusing. Phase A gets most of the gain safely. |
| **Files only** (what exists today) | No server, works for any size | Clumsy on phones; every update means re-sending. Kept as the fallback. |
| **Short-link store only** (Phase C alone, Vercel Blob) | Short links of any size, no accounts, an afternoon of work | Still copies: a chord fix never reaches the band, and laptop and phone still drift. Good if live sync is not wanted. |
| **Firestore library beside IndexedDB** (two back ends) | Local-only use stays fully offline and Firebase-free | Two code paths, a library switcher, copy-between-libraries UI. More to build and test than it protects against for this app's users. |
| **Firestore only** (chosen, Phase B) | Live sync, offline cache, free backup, laptop–phone sync | Every user depends on Firebase; heavier first load; charts sit on Google's servers; losing the link loses access. |
| **Supabase / Postgres** | Tables and SQL | Free projects pause when idle; offline cache and live sync must be hand-built. |
| **Cloudflare Workers + D1/KV, Turso** | Always on, cheap, plain SQL | Sync, offline queue and conflict handling all hand-built. A second host beside Vercel. |
| **Neon (Postgres)** | Closest to Supabase | Sleeps and wakes with delay; needs an API in front; sync hand-built. |
| **File-based sync** (Drive / Dropbox / iCloud folder) | No server of ours | Each person connects their own storage; weak on phones; poor for a band sharing one library. |
| **Fully public library, no secret** | Simplest rules | Anyone can wipe it; publishes copyrighted lyrics to the world; everyone's songs in one pile. |
| **Accounts (Firebase Auth) from day one** | Revocable access, read-only members, recovery | Sign-in screens for every band member. Deferred: the data layout in §4.4 lets members be added later without migration. |

---

## 7. Out of scope for this spec, and how each fits later

| Later feature | How it fits |
| --- | --- |
| Read-only link | Needs to tell readers from editors: anonymous Firebase Auth plus a `members` subcollection, then tighter rules. No data migration. |
| Revoking access | Same as above. Until then: copy the library to a new id and share the new link. |
| Change history / undo others' edits | A `revisions` subcollection per song, written on save. |
| Per-player key or capo | A per-member document; needs the member list above. |
| Merging simultaneous edits to one song | Would split sections into their own documents. The only change here that is a real migration; do it only if simultaneous editing turns out to be common. |
| Tags, folders, search | New fields on the song document. |

---

## 8. Decisions needed

1. **Adopt Phase B (Firestore only)?** It reverses the "no cloud sync" line in `SPEC.md`. If no, build A then C on Vercel Blob.
2. **Several libraries per device, or one?** This spec assumes several, one open at a time (§4.2). One is simpler but blocks someone who plays in two teams.
3. **Anonymous Firebase Auth in v1?** This spec says no. Turning it on early makes read-only links and revoking easier later, at the cost of setup now.
4. **Share expiry in Phase C:** 30 days, or never?

Once 1–3 are answered, record the decision as an ADR in `docs/adr/` and fold this file into `SPEC.md`.

## 9. Unverified facts to check before building
- Firestore free-tier limits (assumed about 50k reads and 20k writes per day, 1 GiB stored) and that Spark projects do not pause.
- Offline writes stay queued across app restarts with persistent cache on, in Safari on iOS in particular.
- TTL policies are available on the plan in use.
- Size of the Firebase SDK in the bundle, measured with Firestore and App Check only.
