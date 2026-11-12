# The library is a band stored in Cloud Firestore

The library lived in one browser's IndexedDB, so laptop and phone never matched, bandmates only ever held copies that drifted, and a browser could evict the lot (Safari on iOS clears site storage after about 7 days without a visit unless the app is installed). We decided every library is a **band**: songs and setlists in Cloud Firestore, synced live to every member and cached for offline use. Terms are in `GLOSSARY.md`; the full spec is GitHub issue #43.

## Decisions

- **Spark plan, not Blaze.** Nothing here needs a paid feature, and a Spark project cannot bill, so abuse can never produce an invoice. This rules out Cloud Functions: everything is the client SDK plus security rules.
- **Anonymous auth plus a join code, not accounts.** The app signs in anonymously on first launch, so nobody meets a sign-in screen. Access comes from membership, and a newcomer becomes a member by presenting the band's join code, which the rules check server-side. The invite link carries the band id and the join code, and doubles as the recovery link, because an anonymous identity dies with the browser's storage.
- **Always a band.** A solo user is a band of one. There is no local-only mode, which removes a mode switch and a "copy my songs into the band" step.
- **No migration from IndexedDB.** The app's own IndexedDB code is deleted outright. A user exports a JSON backup before the switch and restores it into their band after. The user base is one band, so a one-time uploader would cost more to build and test than it saves.
- **Settings get their own store.** Theme, accent, text size, spelling, paper and lyric size are per device: a bandmate's dark mode must not switch yours. They live in `localStorage` behind `SettingsStore`, separate from `LibraryRepository`, and read synchronously so the theme applies before first render.

## Considered options

- **A secret library id as the only access check, no auth.** Simpler, but access can never be narrowed later without a migration, and the rules cannot tell one visitor from another.
- **Google or email sign-in.** Gives real recovery and revocable access, at the price of a sign-in screen for every band member. Deferred; an anonymous identity can be upgraded later.
- **Firestore beside IndexedDB.** Keeps a Firebase-free local mode, but doubles the code paths and needs a library switcher.
- **Supabase, Cloudflare D1, Turso, Neon.** Live sync, the offline queue and conflict handling would all be hand-built; Firestore's SDK ships them.

## Consequences

- Losing the browser's storage and the recovery link loses access to a band of one. The app prompts the user to save the link, and the backup file stays as the safety net.
- Conflicts resolve as last write wins per song or setlist document.
- Every user depends on Firebase, and a band's charts sit on Google's servers, private to its members.
- The Firestore SDK's offline cache is itself IndexedDB. "Drop IndexedDB" means the app's own code.
