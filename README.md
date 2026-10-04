# DVCAFA Board Resolution Tracker

A static dashboard hosted on Vercel, using Firebase Authentication for identity and Cloud Firestore for shared order updates. No build step or application server is required. Nine existing order definitions are retained in `seed.js`.

## Files

- `index.html`, `styles.css`: responsive interface and printable report.
- `app.js`: sign-in, editor access, live data, filtering and transaction-based saves.
- `persistence.js`: conflict detection and safe initialization transactions.
- `core.js`: validation, safe links, completion logic and Oman calendar dates.
- `config.js`: public Firebase web configuration (not an admin credential).
- `firestore.rules`: database authorization and validation.
- `tests/`: business logic and Firestore rules regression tests.

## Required Firebase setup before merging/deploying

1. Back up the existing Firestore `resolutions` documents and deployed rules. This repository originally did not contain rules; the review cannot establish what is currently deployed.
2. In Firebase Authentication, enable the required providers (Google and/or email/password). Confirm `nubdm04202526-dvcafa-orders.vercel.app` in **Authentication → Settings → Authorized domains**. Add a preview domain only if you intend to test sign-in there.
3. Find each approved editor's UID under **Authentication → Users**. In **Firestore Database → Data**, create collection `editors`, document ID equal to that UID, with the boolean field `enabled: true`. Sign in once first if the user does not yet exist. Only a Firebase administrator should manage these documents; browser clients cannot write them. Set `enabled: false` to revoke access.
4. Test and deploy `firestore.rules` to the existing project. You can paste the file into **Firestore Database → Rules** and publish, or use the Firebase CLI: `firebase deploy --only firestore:rules --project dvcafa-orders---nubdm04`.
5. Deploy/merge the reviewed frontend in Vercel. `vercel.json` keeps the project static (**Other**, no dependency installation or build command, output directory `.`). No environment variables are needed for this static app. Test public reading and sign-in with both an approved editor and an unapproved account.
6. Existing order documents are used as-is. On a new or partially initialized database, an editor explicitly selects **Initialize missing orders**. One transaction creates only absent IDs and never overwrites existing ones. There is no automatic write on sign-in or empty snapshots.

**Access policy:** This version preserves the original dashboard's public reading behavior. Every field of a readable Firestore document is public, including notes, evidence URLs and historical author emails, even when not displayed in the UI. Do not add confidential notes or public sharing links to restricted documents. If the tracker is intended to be private, agree a viewer policy and change the read rules and loading flow before production. Moving Firebase web configuration to environment variables would not protect those records; rules enforce access.

**Rollout:** Deploy the allowlist and rules before the frontend. Otherwise hiding editing controls alone does not secure the database. Old versions of the frontend may show errors for unapproved accounts once rules are deployed. Existing records with invalid statuses, dates, or missing fields require administrator repair; the app explicitly blocks editing and printing rather than replacing them with seed data. Legacy inconsistent completion state is corrected when an editor saves a record. Keep the old rules and backup available for recovery, but do not restore permissive writes to solve an access issue.

## Local development and verification

Serve the repository over HTTP, e.g. `python3 -m http.server 8000`, and open `http://localhost:8000`. Opening `index.html` with `file://` does not support these ES modules. For a local-only demo, copy the repository and replace the config API key with `YOUR_API_KEY`; do not commit that change. Demo data is stored in `localStorage` under `bod-tracker`.

- Node.js 22+ recommended for development tools.
- `npm test`: dependency-free unit tests.
- `npm run check`: JavaScript syntax checks.
- `npm ci`: install the locked test dependencies. The Firebase CLI is a separate administrator tool, not an application dependency.
- With Firebase CLI and Java 21 installed: `firebase emulators:exec --only firestore --project demo-dvcafa "npm run test:rules"`. This uses the `demo-dvcafa` project and does not contact production Firestore. If an emulator is already running, set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and run `npm run test:rules`.

Manual verification: search by order 001 and full order reference; filter and sort; complete/reopen an order; print desktop/mobile layouts; reject a non-HTTP evidence link; open the same order in two windows and verify the second stale save fails; simulate offline mode and permission denial; verify the form and note remain available after save errors. Do not test writes against production unless intentionally updating real records.

## Review findings and limits

Fixed: client-side edit authorization based solely on sign-in; full-document lost updates; automatic competing initialization; unhandled save/startup/sign-out failures; duplicate save submissions; dangerous evidence schemes; malformed records crashing the list; stale completion dates; missing order-number search; UTC day boundaries; print overlap; monolithic source organization.

Saves read and compare the exact record version inside a Firestore transaction. Conflicts require reopening the order; notes are not silently merged or discarded. Client validation is reinforced by database rules. Updates preserve order descriptions and subtask labels. The embedded note history is a lightweight activity log, **not an immutable compliance audit trail**; an administrator can still change records, and rules do not guarantee historical note ordering. A separate server-managed audit system is outside this patch.

No production Firebase data, deployed rules, or Vercel settings were changed by this review. The Firebase SDK version is retained to avoid an untested major upgrade. Test-tool dependencies are separate from the runtime, which loads the pinned SDK from Google's CDN.

Firebase references: https://firebase.google.com/docs/firestore/manage-data/transactions and https://firebase.google.com/docs/firestore/security/rules-conditions

## Verification performed for this review

- 9 unit tests and JavaScript syntax checks passed.
- 9 emulator tests passed, including editor revocation, simultaneous saves and non-destructive initialization (Firestore emulator 1.19.8).
- Chromium checks passed for all nine rows, full order-reference search, completion/reopening, unsafe-link rejection, retained drafts after errors, stale-tab conflicts, mobile overflow and print visibility. Browser checks used a local demo; production Google sign-in and live Firebase permissions were not tested.
- `npm audit` reported 0 vulnerabilities in the locked repository dependencies on 4 October 2026. This does not audit the separately installed Firebase CLI or the browser CDN SDK.
