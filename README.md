# Savly

A mobile shopping companion that answers: **“What will this cost me in my home currency, and how much could I save?”**

Status: the calculator foundation and interactive sample prototype are implemented, including submitted estimates, automatic assumptions, remembered settings, local saved comparisons, and sharing. Automatic recent history, billing, complete eligibility/provider-fee data and production API access remain future work.

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

Use a Savly development build for sign-in: `npm run android` builds and installs it on an Android emulator; `npm run ios` does the same for an iOS simulator (Xcode required). Add `-- --device` to select a USB-connected phone; an iPhone also needs developer mode and configured Apple signing. After installing the build, use `npm run start:dev` for code reloads. A physical phone must be able to reach the development server. Expo Go can still preview the guest calculator via `npx expo start --go`, and can use in-app sign-in when its SDK includes SecureStore and Expo Crypto. For a browser preview, run `npm run web`.

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

Pass normalized decimal strings (`"120"`, `"1.10"`, fee `"0.03"` for 3%) and explicit currency minor units. The form layer normalizes the locale decimal separator and whitespace; numeric fields add thousands separators while typing and remove those display separators before calculation. The calculation parser itself accepts only ungrouped values. Domain inputs allow up to 18 digits on each side of the decimal point. Results contain formatted decimal strings and retained FX/refund provenance. Invalid input returns a field error; unavailable FX returns no totals. Null VAT leaves refund-dependent totals unavailable but compares the without-refund cost against the home price. Real mode rejects sample FX and disables sample refund rules.

Verified: 29 tests cover AC1–AC6 calculations/validation, AC7 provenance retention, AC8 unknown/zero refunds and same-currency conversion, AC11 rounding, the AC12 numeric example, and refund-rule boundaries/ambiguity. App and test TypeScript checks passed. UI behavior is now covered by browser tests; native device execution remains unverified.

## Reference-data client and cache

`src/data/reference-store.ts` shares one refresh cycle across consumers, validates both fxService responses, and saves one immutable snapshot for exactly four hours. `get()` reuses fresh data; `retry()` bypasses failure backoff. Failed refreshes retain the previous snapshot with internal cache `status: "stale"`. The UI separately warns when the FX source timestamp is more than 48 hours old. Keep `snapshot.mode` visible as well so stale sample data remains identifiable. A successful fetch does not change the source's own `asOf` timestamp.

Country membership comes directly from the snapshot. `selectedCountry()` returns null when a selection is no longer supported, allowing the screen to request a new selection while retaining old history. Refresh subscriptions provide new snapshots without modifying previously returned results.

`src/data/transport.ts` supplies asynchronous sample responses and an HTTP adapter for `/v1/rates` and `/v1/countries`. The HTTP adapter accepts a base URL and optional token callback, has a request timeout, and never falls back to sample data. The hosted development connection uses the existing Cognito session; release URLs are explicitly configured.

`src/data/mobile-reference-store.ts` selects and shares a guest-default or authenticated API store backed by [AsyncStorage](https://react-native-async-storage.github.io/2.0/Usage/) and a foreground/background adapter. The calculator mounts `activateReferenceData()` once, subscribes to refreshed snapshots, and cleans it up on unmount. Active sessions refresh at expiry and retry after 1, 5, then 15 minutes; background sessions do not poll. Authentication failures await an explicit retry after credentials are available.

Verified with `npm test`: 52 tests total, including 23 data-layer tests for exact TTL boundaries, request counts, concurrent refreshes, reconstructed stores using persisted storage, dynamic countries, offline recovery, malformed/partial responses, rollback, retries, timeouts, and immutable history data. TypeScript and Expo dependency compatibility also pass. Storage, clocks, HTTP responses, and lifecycle events use test doubles; native disk persistence, actual AppState events, and a deployed fxService connection have not been device-tested. FX orientation and calculator UI integration are implemented; reversed quotes retain their original rate for decimal calculations.

## Try the prototype

The app opens with a photo-led welcome screen. **Get started** opens Compare; **Sign in** opens the in-app account forms (configuration requirements below).

See [the demonstration and verification record](docs/prototype-verification.md) for sample inputs, screenshots, passed checks, and remaining device checks. Home currency is set automatically from the selected country of residence using cached API metadata; there is no separate currency picker. Select your country of residence explicitly; it is never inferred from currency. Current scheme availability and minimum purchases gate automatic refund estimates; passing the amount check does not verify personal eligibility. Null VAT means no available refund estimate; the app still compares the converted overseas cost against the home price.

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

The owner selected travelers from any country and a polished prototype with sample rates as the first deliverable. The prototype dynamically loads supported countries, FX rates, and VAT metadata through mocks of the fxService endpoints, caches them for four hours, and calculates all savings on-device, with automatic assumptions and clearly labeled sample rates. Calculator access does not require a Savly account. Cognito login is available; cloud history and prototype billing remain future work. Supported shopping countries and currencies come from the API dataset rather than a hardcoded list; it does not imply country-specific refund support. The backend now supplies tourist-refund scheme and threshold metadata; it does not supply personal eligibility or provider refund amounts. Production guest access must be resolved with the backend’s Cognito requirement. USD/EUR examples are illustrative, not a market commitment.

## Development API and keyboard behavior

Development builds use `https://a2ckcxro8g.execute-api.us-east-1.amazonaws.com` on Android, iOS, and web. No local API server or port forwarding is needed. Sign in with Cognito to fetch rates and countries; requests use the current access token. Guests keep clearly identified built-in defaults. API failures after sign-in remain unavailable/retryable or retain a validated cache, without substituting sample rates.

To change the server, put `EXPO_PUBLIC_FX_API_URL=https://your-api-host` in `.env.local` (omit `/v1`), then restart with `npm run start:dev`. The override also applies to release builds; unconfigured release builds keep defaults. Production-mode development previews can set `EXPO_PUBLIC_APP_ENV=development`. Web access requires the backend to allow the preview origin through CORS. Validated API data is cached for four hours, isolated by URL and from the old local sample cache. Changing the URL requires restarting Expo/rebuilding exported bundles.

Android uses keyboard resizing, explicit height avoidance, and focused-input scrolling; iOS form and picker layouts use padding avoidance. The lower calculator input was verified above the soft keyboard in Android Expo Go on 2026-10-03. Physical-device, iOS, enlarged-text, and savings-page keyboard checks remain pending. The focused-input fix applies on JavaScript reload; rebuild existing native binaries to apply Android configuration changes.

New calculator estimates exclude card/bank fees. Legacy fee preferences are ignored; saved comparisons keep their original totals. VAT refund provider fees are unchanged.

When saving an item, **Take photo** opens the camera and **Add photo** opens the library picker. One optional photo can be previewed, replaced, or removed before saving. Photos appear in Saved and reopened comparisons, stay on-device, and are deleted with the item. Existing text sharing does not attach photos. Native builds need rebuilding for the new Expo image-picker module and camera permission text; Expo Go must support the installed SDK. Browser previews use browser storage and device-dependent camera capture.

Photo verification: TypeScript, 83 unit/integration tests, the photo add/remove/save/reopen browser flow, and Android/iOS/web exports pass. The other browser cases passed across the full run and a targeted rerun of the updated corrupt-settings test. Physical camera capture and permission-denial checks remain pending.

The UI supports portrait and landscape, using two columns where screen width and text size allow. Rotation preserves the current comparison and draft photo. Rebuild existing native binaries to remove their portrait orientation lock; the device's rotation lock must also be off. Browser viewport checks are separate from physical-device rotation verification.

Startup uses available API reference data or clearly identified built-in defaults, without a “Sample prototype” badge. FX warnings appear only on Your savings after calculation, using the applied rate’s original source timestamp. They appear after 48 hours even when the data was just fetched. Bundled defaults retain their fixed date (2026-09-26), so loading them again cannot make them fresh. Four-hour cache refreshes remain unchanged. Production API authentication is still pending; unconfigured release builds use defaults.

Set your home country by tapping the home-country text, flag, or **Settings** cog in the main header. The calculator automatically uses its currency and no longer offers an inline home-country selector. Your home country and flag stay visible in the header while scrolling. The selection is remembered across app launches; saved comparisons retain their original currencies and amounts.

Current refund policy: [country refund thresholds](specs/001-shopping-calculator/tourist-refunds.md) gate automatic refunds using `/v1/countries` scheme status, strict/inclusive minimums, tax basis and research dates. Passing the value check enables a labeled included-VAT assumption less the standard 28% refund fee; it does not guarantee eligibility. Missing/overdue metadata or unconfirmed regional rules compare without a refund. **VAT refund rules** on Calculate and Your savings shows thresholds, grouping, notes, sources and review dates. Submitted/saved results retain their original metadata and totals.

## Cognito sign-in

Welcome and Settings open in-app forms for email/password sign-in, account creation, email verification (including resending codes), and password reset. SMS/authenticator verification and forced new-password prompts also stay inside Savly. No browser or callback registration is needed for new sign-ins. Guest access and device-local saved comparisons are unchanged; cloud history and billing remain separate future work.

The app uses the AWS Cognito identity SDK's SRP flow, already enabled in the sibling backend's infrastructure. Its cache is disabled: passwords and verification codes stay in memory, native session tokens use Expo SecureStore, and web sessions remain memory-only. Expo Crypto supplies secure random values for native SRP. GetUser validates identity before accepting a session. Native sessions renew with GetTokensFromRefreshToken, preserving rotated tokens and checking account identity; previously saved browser sessions retain their legacy renewal path. Temporary connection failures preserve saved credentials for retry. Sign out removes the local session and returns to Welcome.

Development uses the owner's existing public issuer and client `35vicii2qq71r09bcd0val80lm`. Release builds require `EXPO_PUBLIC_COGNITO_AUTHORITY` and `EXPO_PUBLIC_COGNITO_CLIENT_ID`; never add a client secret. Domain configuration is retained only for legacy browser-session renewal. See `.env.example`. No backend deployment is required by this implementation. Live pool settings and actual email delivery still need real-account verification.

Restart Metro with `npm run start:dev` after this update so it loads the new Cognito/Expo Crypto resolver. Native builds must include the existing SecureStore and Expo Crypto modules. Older builds missing SecureStore show an update message and allow guest use.

The backend infrastructure configures email self-registration and SRP. Optional custom authentication, MFA enrollment/selection, and email MFA are not part of this configuration; the app reports unsupported challenges safely. Add their forms before enabling those pool features.

TypeScript, 136 unit/integration tests, eight simulated-Cognito Chromium form tests, and Android/iOS/web exports pass. Expo dependency compatibility passed against the offline bundled map. Verification for the in-app forms is recorded in [tasks](specs/001-shopping-calculator/tasks.md). Real email delivery, real-account sign-in, native keyboards, force-quit/reopen, and device renewal must still be checked on Android/iOS before release.

Run `npm run test:auth:ui` for isolated form checks with a simulated Cognito provider. Its `dist-auth-web/` export contains test-only configuration; do not deploy it. Restart Expo with `--clear` when switching environment configuration.

### Testing sign-in on phones

Use the Savly development app for native checks. Both Android and iOS use application identifier `com.savly.app` for local builds. In-app account forms require SecureStore and Expo Crypto; no callback URL is needed.

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

Refund milestone verification (2026-10-07): TypeScript, all 110 unit/integration tests, two focused Chromium rules/navigation checks, and Android/iOS/web production exports pass. The focused browser command is `npx playwright test tests/ui/refund-rules.spec.ts`. Native navigation, source-link opening and accessibility were not device-tested; authenticated live responses were not exercised in this milestone.

## Calculation examples and build gate

All new refund estimates use reference data automatically and deduct an assumed **28% of the gross potential refund**. Calculate has no manual FX, refund or fee editing. Built-in defaults and validated cached/API data retain their provenance and stale-rate notices. Result details and sharing show the gross refund, fee and net refund; saved historical totals stay unchanged. Refund eligibility and actual provider fees remain unverified.

The [UK/Australia example](specs/001-shopping-calculator/spec.md#ukaustralia-regression-example) compares GBP 200 with tax-inclusive AUD 350 at the fixed example quote GBP/AUD 1.9004: GBP 16.74 gross refund, GBP 4.69 fee, **GBP 27.88 potential savings**. `tests/australia-example.test.ts` protects the totals, FX direction, manual fee, sharing and saving.

The Android/iOS build and mobile/web export npm commands automatically run TypeScript and all `tests/*.test.ts` tests before building, stopping on failure. Add future calculation examples to that directory. Use `npm run check:build` before invoking Expo/Gradle/Xcode directly, since those commands bypass npm hooks.

Refund-fee verification: TypeScript, all 113 unit/integration tests, two focused Chromium refund-rules tests and Android/iOS/web exports passed. Native builds and physical-device tests were not run for this change.

Guest defaults cover every home/shopping combination among the United States, United Kingdom, Australia, Japan, Spain and France (10 currency pairs). Six additional rates supplied by the owner on 2026-10-07 are static defaults with unknown quote dates, not CityIndex quotes; they retain stale-rate warnings. The four original dated rates and bundled VAT/refund metadata remain in use. Guest cache revision `guest-2` replaces the incomplete earlier defaults without changing the four-hour lifetime or authenticated API cache.

## Remembered device sign-in

Returning signed-in users see the splash page without buttons for three seconds, then go straight to Calculate. Session restoration can extend the wait if renewal is needed. Guests keep the normal welcome buttons, and interactive sign-in opens Calculate immediately.

Android/iOS now save sign-in in Expo SecureStore and restore it on launch. Run `npm install`, then rebuild with `npm run ios` or `npm run android` to include the native secure-storage module. Sign in once after this update; earlier versions discarded their sessions. Sign out deletes the saved session. Saved comparisons remain local.

If an older installation reports `Cannot find native module 'ExpoSecureStore'`, rebuild and reinstall it: use `npm run ios -- --device` for a connected iPhone, `npm run ios` for the simulator, or `npm run android -- --device` for Android. A Metro reload cannot add native modules. The app now checks for secure storage before importing it; older builds show an update message and allow guest use, while sign-in requires the rebuilt app.

Implementation follows [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) and [Cognito refresh tokens](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-refresh-token.html). Native force-quit/reopen and real-account renewal still need device verification.

Account implementation references: [Cognito SRP authentication](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow-methods.html) and [Cognito token renewal](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_GetTokensFromRefreshToken.html).
