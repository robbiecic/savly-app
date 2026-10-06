# Savly

A mobile shopping companion that answers: **“What will this cost me in my home currency, and how much could I save?”**

Status: the calculator foundation and interactive sample prototype are implemented, including submitted estimates, editable assumptions, remembered settings, local saved comparisons, and sharing. Automatic recent history, billing, real refund data, and production API access remain future work.

## Start here

1. Read [the product brief](docs/product-brief.md) to understand the proposed scope.
2. Review [the first feature specification](specs/001-shopping-calculator/spec.md), especially the examples.
3. Follow [the build plan](specs/001-shopping-calculator/plan.md) one milestone at a time.
4. Track progress in [the task list](specs/001-shopping-calculator/tasks.md).

MVP also includes [sharing savings through WhatsApp and other apps](specs/003-sharing/spec.md).

Visual reference: [owner's design board](images/Savly-design-board.jpeg), translated into [the design brief](docs/design-brief.md).

## How spec-driven development works here

We describe the intended behavior in plain English, give concrete examples of success, implement a small piece, and check it against those examples. If behavior changes, update the spec and checks together. You make the product decisions; your coding assistant handles implementation and explains the results.

You do not need a special specification tool or paid service to start. These Markdown files are the source of truth.

Suggested next instruction to your coding assistant:

> Read the project specs and build milestone 3: local history, saved comparisons, and mocked premium/account flows. Preserve the completed calculator and keep the task list current.

## Technology and local setup

Expo + React Native + TypeScript, using one project for Android and iOS. Expo supports both platforms: [official documentation](https://docs.expo.dev/). The scaffold uses the [official blank TypeScript starter](https://docs.expo.dev/more/create-expo/): Expo SDK 57, React 19.2, React Native 0.86, and strict TypeScript. Exact versions are locked in `package-lock.json`.

Use Node.js 24 LTS or newer and npm. Install and start from this directory:

```bash
npm ci
npm start
```

Use a Savly development build for sign-in: `npm run android` builds and installs it on an Android emulator; `npm run ios` does the same for an iOS simulator (Xcode required). Add `-- --device` to select a USB-connected phone; an iPhone also needs developer mode and configured Apple signing. After installing the build, use `npm run start:dev` for code reloads. A physical phone must be able to reach the development server. Expo Go can still preview the guest calculator via `npx expo start --go`, but cannot complete Cognito sign-in. For a browser preview, run `npm run web`.

Checks:

```bash
npm run typecheck
npm test
npm run check:dependencies
NODE_ENV=production npm run export:mobile
```

The export command bundles Android and iOS JavaScript into ignored `dist/`; it does not produce installable store binaries. `npm test` runs the calculation, refund-selection, and reference-data tests without Expo, a device, or a backend. `npm run typecheck` checks both app code and tests.

`App.tsx` sets up safe areas and the status bar; `src/app/CompareScreen.tsx` presents the calculator, `src/app/ResultScreen.tsx` presents submitted savings details, and `src/app/SavedScreen.tsx` lists locally saved comparisons, and `src/theme/colors.ts` holds the starting palette. Savly app icons and thumbnails are configured; see [asset notes and regeneration instructions](docs/app-icons.md).

Verified on 2026-09-29 with Node 26.0.0 and npm 11.14.1: TypeScript, Expo dependency compatibility, and production bundling for Android and iOS passed. No simulator or physical-device tests were run. npm audit reported 10 moderate advisories in the Expo tooling dependency tree (including transitive `uuid`/`xcode`); its suggested full fix downgrades Expo to SDK 46, so it was not applied. Revisit compatible upstream fixes before release.

Worked example: [USA vs Spain, stale FX, and an assumed 28% refund fee](specs/001-shopping-calculator/spain-worked-example.md), verified with automated tests.

## Calculation engine

`src/domain/calculator.ts` calculates VAT, before/after refund costs, and savings (with legacy card-fee support for historical compatibility) using decimal.js. `src/domain/refunds.ts` selects illustrative rules by country, currency, explicit residency, category, and price band. Both are pure on-device modules with no UI or network dependencies.

Pass normalized decimal strings (`"120"`, `"1.10"`, fee `"0.03"` for 3%) and explicit currency minor units. The form layer normalizes the locale decimal separator and whitespace; grouping separators are rejected rather than guessed. Domain inputs allow up to 18 digits on each side of the decimal point. Results contain formatted decimal strings and retained FX/refund provenance. Invalid input returns a field error; unavailable FX returns no totals. Null VAT leaves refund-dependent totals unavailable but compares the without-refund cost against the home price. Real mode rejects sample FX and disables sample refund rules.

Verified: 29 tests cover AC1–AC6 calculations/validation, AC7 provenance retention, AC8 unknown/zero refunds and same-currency conversion, AC11 rounding, the AC12 numeric example, and refund-rule boundaries/ambiguity. App and test TypeScript checks passed. UI behavior is now covered by browser tests; native device execution remains unverified.

## Reference-data client and cache

`src/data/reference-store.ts` shares one refresh cycle across consumers, validates both fxService responses, and saves one immutable snapshot for exactly four hours. `get()` reuses fresh data; `retry()` bypasses failure backoff. Failed refreshes retain the previous snapshot with internal cache `status: "stale"`. The UI separately warns when the FX source timestamp is more than 48 hours old. Keep `snapshot.mode` visible as well so stale sample data remains identifiable. A successful fetch does not change the source's own `asOf` timestamp.

Country membership comes directly from the snapshot. `selectedCountry()` returns null when a selection is no longer supported, allowing the screen to request a new selection while retaining old history. Refresh subscriptions provide new snapshots without modifying previously returned results.

`src/data/transport.ts` supplies asynchronous sample responses and an HTTP adapter for `/v1/rates` and `/v1/countries`. The HTTP adapter accepts a base URL and optional token callback, has a request timeout, and never falls back to sample data. The hosted development connection uses the existing Cognito session; release URLs are explicitly configured.

`src/data/mobile-reference-store.ts` selects and shares a guest-default or authenticated API store backed by [AsyncStorage](https://react-native-async-storage.github.io/2.0/Usage/) and a foreground/background adapter. The calculator mounts `activateReferenceData()` once, subscribes to refreshed snapshots, and cleans it up on unmount. Active sessions refresh at expiry and retry after 1, 5, then 15 minutes; background sessions do not poll. Authentication failures await an explicit retry after credentials are available.

Verified with `npm test`: 52 tests total, including 23 data-layer tests for exact TTL boundaries, request counts, concurrent refreshes, reconstructed stores using persisted storage, dynamic countries, offline recovery, malformed/partial responses, rollback, retries, timeouts, and immutable history data. TypeScript and Expo dependency compatibility also pass. Storage, clocks, HTTP responses, and lifecycle events use test doubles; native disk persistence, actual AppState events, and a deployed fxService connection have not been device-tested. FX orientation and calculator UI integration are implemented; reversed quotes retain their original rate for decimal calculations.

## Try the prototype

The app opens with a photo-led welcome screen. **Get started** opens Compare; **Sign in** opens Cognito sign-in (configuration requirements below).

See [the demonstration and verification record](docs/prototype-verification.md) for sample inputs, screenshots, passed checks, and remaining device checks. Home currency is set automatically from the selected country of residence using cached API metadata; there is no separate currency picker. Select your country of residence explicitly; it is never inferred from currency. Numeric VAT is treated as fully refundable for estimates, regardless of residence. Null VAT means no available refund estimate; the app still compares the converted overseas cost against the home price.

The calculator validates edits after 180 ms. **Calculate savings** opens a separate result page with a fixed snapshot and Save/Share actions; Back preserves the form. **Saved comparisons** reopens locally stored snapshots and supports deletion. Sample, manual, and stale estimates remain labeled. **Share savings** / **Share comparison** uses the native share sheet with the displayed result snapshot. It never fetches fresh rates or claims delivery. Sharing defaults to a labeled demo link; see `.env.example` for `EXPO_PUBLIC_SAVLY_APP_LINK`. A local demo landing page lives in `public/app/index.html`; no site or store listing is published.

To reproduce browser tests (Python 3 is used only to serve the static export):

```bash
npx playwright install chromium
NODE_ENV=production npm run export:web
npm run test:ui
```

The web build is written to ignored `dist-web/`; browser screenshots/results go to ignored `test-results/`. Current verification: 77 domain/data/integration/storage tests, fourteen browser tests, TypeScript, Expo compatibility, and Android/iOS/web bundling pass. Native device and WhatsApp delivery checks remain pending. Country names fall back to bundled English labels on engines without `Intl.DisplayNames`; a browser regression verifies startup and calculation with optional Intl APIs disabled.

## Premium access

Savly is a paid-access product with optional login for retained history. See [premium and history requirements](specs/002-premium-and-history/spec.md); monthly subscription and lifetime unlock use Google Play Billing / Apple App Store in-app purchases after free installation. Prices remain undecided.

## Backend API

The backend lives in the sibling [fxService repository](../fxService/README.md). Its [API contract](../fxService/specs/requirements/03-api-contract.md) and [country/VAT specification](../fxService/specs/requirements/06-country-vat.md) own the wire format. Read the app’s [integration notes](specs/001-shopping-calculator/api-contract.md) for caching, rate direction, and remaining integration gaps.

## Working assumptions

The owner selected travelers from any country and a polished prototype with sample rates as the first deliverable. The prototype dynamically loads supported countries, FX rates, and VAT metadata through mocks of the fxService endpoints, caches them for four hours, and calculates all savings on-device, with editable assumptions and clearly labeled sample rates. Calculator access does not require a Savly account. Cognito login is available; cloud history and prototype billing remain future work. Supported shopping countries and currencies come from the API dataset rather than a hardcoded list; it does not imply country-specific refund support. Refund rules are separate illustrative prototype fixtures, not an existing backend capability. Production guest access must be resolved with the backend’s Cognito requirement. USD/EUR examples are illustrative, not a market commitment.

## Development API and keyboard behavior

Development builds use `https://a2ckcxro8g.execute-api.us-east-1.amazonaws.com` on Android, iOS, and web. No local API server or port forwarding is needed. Sign in with Cognito to fetch rates and countries; requests use the in-memory access token. Guests keep clearly identified built-in defaults. API failures after sign-in remain unavailable/retryable or retain a validated cache, without substituting sample rates.

To change the server, put `EXPO_PUBLIC_FX_API_URL=https://your-api-host` in `.env.local` (omit `/v1`), then restart with `npm run start:dev`. The override also applies to release builds; unconfigured release builds keep defaults. Production-mode development previews can set `EXPO_PUBLIC_APP_ENV=development`. Web access requires the backend to allow the preview origin through CORS. Validated API data is cached for four hours, isolated by URL and from the old local sample cache. Changing the URL requires restarting Expo/rebuilding exported bundles.

Android uses keyboard resizing, explicit height avoidance, and focused-input scrolling; iOS form and picker layouts use padding avoidance. The lower calculator input was verified above the soft keyboard in Android Expo Go on 2026-10-03. Physical-device, iOS, enlarged-text, and savings-page keyboard checks remain pending. The focused-input fix applies on JavaScript reload; rebuild existing native binaries to apply Android configuration changes.

New calculator estimates exclude card/bank fees. Legacy fee preferences are ignored; saved comparisons keep their original totals. VAT refund provider fees are unchanged.

When saving an item, **Take photo** opens the camera and **Add photo** opens the library picker. One optional photo can be previewed, replaced, or removed before saving. Photos appear in Saved and reopened comparisons, stay on-device, and are deleted with the item. Existing text sharing does not attach photos. Native builds need rebuilding for the new Expo image-picker module and camera permission text; Expo Go must support the installed SDK. Browser previews use browser storage and device-dependent camera capture.

Photo verification: TypeScript, 83 unit/integration tests, the photo add/remove/save/reopen browser flow, and Android/iOS/web exports pass. The other browser cases passed across the full run and a targeted rerun of the updated corrupt-settings test. Physical camera capture and permission-denial checks remain pending.

The UI supports portrait and landscape, using two columns where screen width and text size allow. Rotation preserves the current comparison and draft photo. Rebuild existing native binaries to remove their portrait orientation lock; the device's rotation lock must also be off. Browser viewport checks are separate from physical-device rotation verification.

Startup uses available API reference data or clearly identified built-in defaults, without a “Sample prototype” badge. FX warnings appear only on Your savings after calculation, using the applied rate’s original source timestamp. They appear after 48 hours even when the data was just fetched. Bundled defaults retain their fixed date (2026-09-26), so loading them again cannot make them fresh. Four-hour cache refreshes remain unchanged. Production API authentication is still pending; unconfigured release builds use defaults.

Set your home country using the header's **Settings** button. The calculator automatically uses its currency and no longer offers an inline home-country selector. Your home country and flag stay visible in the header while scrolling. The selection is remembered across app launches; saved comparisons retain their original currencies and amounts.

Current refund policy: numeric VAT means an assumed refund of all VAT included in the price, with no provider fee. Null VAT leaves the refund unavailable but still compares the converted overseas price against the home price. This replaces the previous France/Spain residency rules for new comparisons. Saved estimates keep their original rules and totals. Refunds are labeled as assumptions, not verified eligibility.

## Cognito sign-in

Welcome and Settings offer browser sign-in using the development Cognito pool/client supplied by the owner. Sign-in uses authorization code + PKCE; errors show **Can't connect right now** with retry. Successful sign-in opens Calculate and displays the account in Settings. Get started still works without signing in. Sign out in Settings clears the app session and returns to the opening welcome screen; tokens stay in memory and are never written to local storage. Restart or token expiry requires signing in again. Saved comparisons remain on-device; this does not implement cloud history or billing.

Local/native development now defaults to the owner's issuer, client `35vicii2qq71r09bcd0val80lm`, managed-login domain `https://savly.auth.us-east-1.amazoncognito.com`, and registered callback `savly://auth/callback`.

- Rebuild the native development app to install the `savly` URL scheme and auth modules. Expo Go cannot complete this callback flow.
- For web development, register the actual localhost URL (for example `http://localhost:8081`) in Cognito, set `EXPO_PUBLIC_COGNITO_REDIRECT_URI` to that URL, and open that same origin. For a local production-mode export, set `EXPO_PUBLIC_APP_ENV=development` explicitly.
- Release builds require their own `EXPO_PUBLIC_COGNITO_AUTHORITY` and `EXPO_PUBLIC_COGNITO_CLIENT_ID`; configure their domain and callback as needed. Never put a client secret in the app. See `.env.example`.
- The app client must permit the authorization code grant and requested scopes, and have managed login enabled. Live endpoint recheck on 2026-10-04 returned HTTP 200 and the email/password sign-in form using Savly’s client, requested scopes, PKCE, and registered native callback. The previous “Login pages unavailable” error is resolved. No credentials were submitted; successful account authentication and return to the native app remain unverified.

The hosted reference API uses the current Cognito access token. Signing in switches from guest defaults to API data; signing out or token expiry returns to guest defaults. Sign-in does not change the four-hour cache duration or implement account history sync.

Run `npm run test:auth:ui` for isolated browser checks using a simulated Cognito provider. That command creates an ignored `dist-auth-web/` build with test-only configuration; never deploy it. Run normal Expo builds with `--clear` when switching environment configuration to avoid reusing cached values.

Implementation references: [Expo AuthSession](https://docs.expo.dev/versions/latest/sdk/auth-session/), [Expo authentication setup](https://docs.expo.dev/guides/authentication/), and [Cognito authorization endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html).

Sign-in verification: TypeScript, 98 unit/integration tests, six simulated-provider browser tests, all 20 existing browser tests, and Android/iOS/web exports passed. Expo’s bundled dependency compatibility check passed in offline mode. Real credentials, native browser return, and device sign-in were not tested.

### Testing sign-in on phones

Install and open the **Savly** development app, rather than opening the project inside Expo Go. The native app owns `savly://auth/callback`; Expo Go cannot receive that URL. Both Android and iOS use application identifier `com.savly.app` for local builds. The app now explains this setup requirement when opened in Expo Go, while actual connection errors still say **Can't connect right now**.

`npm run android` automatically finds an installed Java 17 (including Gradle's JDK cache) and the Android SDK. It sets their locations only for the build process, without changing your shell configuration. Android Studio's bundled Java 25 is not used because it fails this project's native compiler setup. If no Java 17 is available, install JDK 17 or point `JAVA_HOME` to it.

```bash
npm run android -- --check   # Check Java and Android SDK without building
npm run android             # Build and install on the emulator
```

For a physical Android phone, enable USB debugging, connect it, and append `-- --device`. For iPhone, use `npm run ios -- --device` with Xcode signing configured. These are local builds; no paid Expo build service is required. Rebuild after native dependencies or URL schemes change; ordinary TypeScript edits only need Metro reloads.

Native development verification (2026-10-04): Java 17 auto-detection passed; the Android debug APK built and installed on the Pixel_10_Pro emulator. Savly startup and opening the Cognito browser were observed. The first APK had a missing generated Expo log-box class; cleaning that module’s build artifacts and rebuilding repaired it. Full authenticated-account verification, physical-phone installation, and iOS builds remain unverified. TypeScript, nine auth unit tests, and six simulated browser sign-in tests passed after the development-client setup.

### iOS simulator startup

The iOS build enables `ios.enableSceneSupport` through `expo-build-properties` in `app.json`, following [Expo's SDK 57 scene lifecycle guidance](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md#staying-on-sdk-57-with-xcode-27). This fixes the immediate native startup crash on iOS 27 (`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). Keep the plugin configuration when regenerating native files.

After pulling this configuration change, run `npm ci`, `NODE_ENV=development npx expo prebuild --platform ios`, then `npm run ios`. This requires rebuilding the installed native app; a JavaScript reload alone cannot apply it. The hosted development API configuration remains in place.

Verification (2026-10-05): regenerated iOS configuration, successful Xcode simulator build/install, and visible Savly welcome screen on the iPhone 18 Pro simulator running iOS 27. TypeScript and offline Expo dependency compatibility checks passed. Physical iPhone and authenticated callback checks remain pending.
