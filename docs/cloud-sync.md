# Cloud sync

Devices sync through a sync code (`XXXX-XXXX-XX`). The code never leaves the device: it is
turned (PBKDF2, 310,000 rounds) into an AES key and a document ID. The cloud copy is gzip-
compressed and AES-GCM encrypted on the device and stored as `sync/<id>` in Cloud Firestore.
Firestore only ever sees an ID and an unreadable blob. Writes carry the version they were
based on; if another device wrote in between, the device reads again and merges
(`src/lib/sync/merge.ts`), so nothing is overwritten.

Code: `src/lib/sync/` (code, crypto, merge, engine, firestore backend, sigil), UI in
`src/pages/Sync.tsx`.

## Setting up the Firebase project (once)

1. Open https://console.firebase.google.com, choose **Create a project**, name it e.g.
   `endstep-sync`. Google Analytics isn't needed.
2. In the project: **Build → Firestore Database → Create database**. Pick a location close
   to you (e.g. `europe-west3`, Frankfurt) and **Start in production mode**.
3. In Firestore, open the **Rules** tab, replace everything with the contents of
   `firestore.rules` from this repo and press **Publish**.
4. **Project settings** (gear icon) → **General** → **Your apps** → the web icon `</>`.
   Register an app named `Endstep` (no hosting). Copy `projectId` and `apiKey` from the
   config it shows.
5. Put both values into `src/lib/sync/config.ts`. They are not secret: Firebase web config is
   meant to be public, the rules guard access and the data is encrypted.

The free Spark plan (50,000 reads and 20,000 writes per day) is plenty: an open app reads
about twice a minute and writes only after changes.
