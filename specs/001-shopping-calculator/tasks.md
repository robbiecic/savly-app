# Task checklist

- [x] Move item name, photo actions, and Save/Share ahead of a collapsed Expand details section on Your savings.

- [x] Replace the stale-rate badge on Your savings with “FX rates are stale. Login to get accurate rates.” and remove the duplicate warning.

- [x] Share the clickable home-country and Settings cog control across Your savings and the other main pages.

- [x] Show a currency symbol before savings/extra-cost amounts on Your savings, including before-refund summaries, while preserving localized digits and saved precision.

## Foundation

- [x] Write product brief and visual direction.
- [x] Confirm Savly branding and interpret the owner's inspiration board in docs/design-brief.md.
- [x] Define formulas, estimate assumptions, and acceptance examples.
- [x] Propose architecture and implementation milestones.
- [x] Locate backend ownership and align integration specs with sibling fxService contracts; record refund-data and guest-auth gaps.
- [x] Record owner preferences: travelers from any country; polished sample-rate prototype first.

## Milestone 1

- [x] Scaffold Expo + TypeScript with compatible dependencies (SDK 57; typecheck, dependency compatibility, and Android/iOS production exports passed 2026-09-29).
- [x] Implement all decimal calculations and refund-rule selection client-side (pure domain modules; 29 tests pass).
- [x] Verify dynamic countries, exact TTL boundary, offline cache, and request counts (23 data-layer tests with fake clocks, storage, and HTTP).
- [x] Implement reference-data API client, persistent four-hour cache, and asynchronous mock transport using api-contract.md (native storage/lifecycle adapters connected to the calculator; device validation remains).
- [x] Cover automatic rates, source labels and bank-fee defaults, overrides, and API states in AC12–AC18 (model integration and browser checks; native device verification remains).
- [x] Test calculation criteria AC1–AC8 and AC11 where applicable (domain behavior verified; AC7 rendered labels and other UI states remain in Milestone 2).
- [x] Document calculation test commands and domain input/output conventions in README.

## Milestone 2

- [x] Create Savly app icons, Android adaptive/themed layers, favicon, and thumbnail exports from the approved icon concept; native launcher verification remains.

- [x] Hide Scan navigation and its placeholder until scanning is implemented.

- [x] Remove the optional marker from the Home price label.

- [x] Add AC19 Spain/USA worked example with VAT-inclusive arithmetic, explicit assumed refund fee, stale reverse-quote FX, and result/share/save regression coverage.

- [x] Keep country selection above Calculate/Scan/Saved tabs; preserve the form across tabs and add a savings-page back arrow to Calculate. Scan is hidden until ready.

- [x] Match Save/Share to the board with equal outlined buttons, heart/share icons, and a filled-heart Saved state.

- [x] Move shopping-country selection to a rounded top dropdown before price entry, outside home settings.

- [x] Derive home currency from country of residence; remove currency selection, reconcile saved settings, and clear home amounts on currency changes.

- [x] Add flags beside country names in shopping and residence pickers, preserving search and accessible names.

- [x] Add the design-board-inspired welcome screen; Get started opens Compare and Sign in now opens Cognito.

- [x] Build shared visual styles and accessible controls.
- [x] Fix startup without Intl.DisplayNames using bundled English country names; verify missing-constructor regression in unit and browser tests.
- [x] Support missing NumberFormat.formatToParts during settings hydration/input parsing; handle unexpected asynchronous initialization failures with Retry.
- [x] Build calculator and separate result pages with Calculate savings, preserved form on Back, and Save/Share actions.
- [x] Implement native Share savings/comparison with local summary formatting (spec 003).
- [x] Verify sharing variants, cancellation, and no extra data requests.
- [x] Remember home/trip settings and present costs with and without refunds.
- [x] Verify all calculator states and rate/estimate labels.
- [x] Demonstrate prototype and record Android/iOS verification gaps.

Verification scope: model tests and Chromium browser checks passed. Native sharing, WhatsApp receipt, accessibility on devices, and Android/iOS lifecycle/storage checks remain unverified; see [prototype verification](../../docs/prototype-verification.md).

## Milestone 3 — History and mocked premium/account flows

- [x] Implement explicit local snapshots and Saved screen with reopening, deletion, confirmed clearing, and storage-error handling.
- [ ] Implement automatic recent history.
- [ ] Implement mock purchase/restore states from spec 002 (sign-in uses real Cognito).
- [ ] Verify guest isolation, history import, and simulated sync behavior.
- [x] Verify local saved-comparison persistence, deletion, duplicate-save behavior, and corrupt-storage handling.
- [ ] Verify account-specific history persistence when private account history is implemented.

## Later

- [x] Confirm monthly subscription and lifetime unlock via Google Play Billing / Apple App Store.
- [ ] Set monthly/lifetime prices and select login provider.
- [ ] Integrate production billing/entitlement validation and private cloud history.
- [ ] Verify premium/history criteria PH1–PH9 and account deletion/recovery.

- [ ] Integrate existing fxService endpoints; confirm deployment URL, CityIndex usage rights, pair coverage, and Cognito access for guests.
- [x] Consume the fxService tourist-refund scheme and minimum-purchase contract; complete personal eligibility/provider-fee modeling remains outside this milestone.
- [ ] Configure sharing domain, fallback page, live store links, and Universal/App Links.
- [ ] Verify WhatsApp text/link delivery and installed/uninstalled routing (SH1–SH6).
- [ ] Complete device testing and store preparation.

- [x] Replace the former local API connection with a configurable hosted development URL on every platform, existing Cognito bearer tokens, and isolated four-hour real-data caching. Guests retain labeled defaults; authenticated failures stay retryable. TypeScript and 100 tests pass; authenticated native-device verification remains pending.
- [x] Add Android keyboard resizing and iOS avoidance to calculator, savings details, and country search. Native keyboard verification remains pending.

- [x] Fix Android keyboard overlap with explicit height avoidance and focused-input scrolling; verify the lower item-name input with the soft keyboard in Android Expo Go.

- [x] Remove card/bank fees from new calculator estimates and ignore legacy fee preferences; retain original saved totals and VAT refund provider fees.

- [x] Add optional camera/library item photos with preview/removal, persistent local storage, Saved thumbnails, and cleanup on deletion.
- [ ] Verify camera capture and permission denial on physical Android/iOS devices.

- [x] Use circular item-photo previews with a tappable full-screen viewer and Close/Android Back dismissal.

- [x] Enable landscape and responsive welcome, calculator, result, Saved, country-picker, and photo-viewer layouts while preserving state on rotation.

- [x] Remove prototype startup badge, identify dated fallback defaults, and highlight FX source age beyond 48 hours independently of the four-hour cache TTL.

- [x] Match camera/library actions to Save/Share with outlined side-by-side icon buttons.

- [x] Remove the demo-link availability message from Your savings.

- [x] Move home-country selection to Settings, automatically apply its currency to calculations, and show a fixed home-country flag badge across app pages.

- [x] Remove the duplicate Saved comparisons heading from the Saved tab.

- [x] Remove item-name entry from Calculate and retain it on Your savings for saving.

- [x] Put the savings summary first and show an explicit missing-price/unknown-refund summary instead of silently hiding it.

- [x] Assume all included numeric VAT refundable for new calculations; with null VAT, show cheaper/same/more comparisons without a refund and preserve unavailable refund metadata.

- [x] Reuse the welcome wordmark and airplane in fixed top-left headers across app screens and app-owned modals.

- [x] Enable Cognito browser sign-in from Welcome/Settings with code + PKCE, session-only identity, sign-out, and the requested connection error.
- [x] Configure the owner-confirmed development Cognito domain and registered native callback.
- [x] Recheck the owner’s Cognito login-page fix: HTTP 200 with email/password form using the configured native authorization request.
- [ ] Register a web callback if needed and verify real account sign-in and return on Android/iOS and web.
- [x] Verify auth success/error/cancel/state/PKCE behavior with unit and simulated browser tests; retain passing calculator regressions and Android/iOS/web exports.

- [x] Add the Savly development client and native app identifiers for Cognito callback support; explain Expo Go’s limitation instead of reporting a network error.
- [x] Make the Android build command locate Java 17 and the Android SDK automatically, without changing shell settings.
- [x] Build and install the Android development app on the emulator; verify startup and Cognito browser opening after repairing generated Expo log-box artifacts.

- [x] Fix the iOS 27 simulator startup crash by enabling Expo scene lifecycle support in tracked build configuration; regenerate/build/install iOS and verify the welcome screen. TypeScript and offline dependency checks pass. Physical iPhone and authenticated callback verification remain pending.

- [x] Return to the opening welcome/splash screen when signing out from Settings, clearing the session and allowing guest re-entry. TypeScript and all six simulated-provider browser tests pass; native sign-out was not tested.

- [x] Make the main header’s home-country text, flag, and cog one Settings touch target.

- [x] Automatically group numeric inputs while typing, preserving locale decimals and exact calculation strings. TypeScript and all 103 unit/integration tests pass; native typing was not device-tested.

- [x] Automatically format Your savings amounts, percentages, and rate details with grouped digits and locale decimals while preserving saved precision. TypeScript, 103 tests, and formatting spot checks pass; native display was not device-tested.

- [x] Show Sign out in Settings only when signed in, and Sign in only when signed out. Sign-out returns to the welcome/splash screen; native interaction remains unverified.

- [x] Verify comma grouping during browser typing in all four numeric fields, decimal entry, deletion, and return from results. Prevent browser scrolling from interrupting focused input. Focused Chromium test, web export, and TypeScript pass; native typing remains unverified.

## Country refund milestone

- [x] Specify scheme/minimum-spend handling and country rules navigation in [tourist-refunds.md](tourist-refunds.md).
- [x] Validate and persist nested refund metadata without changing four-hour caching or API endpoints.
- [x] Gate automatic estimates on scheme status, exact gross/net thresholds and research review dates; preserve unknown versus zero and explicit manual overrides.
- [x] Add the rules screen from Calculate and Your savings with notes, grouping, regions, sources, research dates and preserved drafts.
- [x] Retain country rules and assessment in saved/shared comparisons without changing historic totals.
- [x] Verify TypeScript, all 110 unit/integration tests, two focused Chromium navigation tests, and Android/iOS/web production exports. Visually review the rules screen and result page. Native checks remain below.
- [ ] Verify native navigation, source-link opening and accessibility on Android/iOS devices.

## Refund fee and calculation regression milestone

- [x] Confirm the owner's UK/Australia example uses included GST: GBP 27.88 savings, GBP 16.74 gross refund and GBP 4.69 fee.
- [x] Deduct an assumed 28% from all new automatic/manual gross refund estimates, before computing savings; preserve legacy saved totals and sample-rule compatibility.
- [x] Label manual amounts before fees and retain the gross/fee/net breakdown in results, sharing and saved snapshots.
- [x] Add the UK/Australia regression, reverse-rate and manual-bound cases; update affected existing expectations and specs.
- [x] Gate standard Android/iOS build and mobile/web export npm commands on TypeScript and all unit/integration/example tests. Document the gate required before direct native-tool invocations.
- [x] Verify TypeScript, all 113 unit/integration tests, two focused Chromium refund-rules tests (including displayed 28% deduction), and Android/iOS/web JavaScript exports.
- [ ] Verify the revised fee presentation on physical Android/iOS devices.

- [x] Move Your savings’ VAT refund rules button inside Expand details. TypeScript, 113 unit/integration tests, web export and two focused browser navigation tests pass; native interaction was not tested.

- [x] Show the selected shopping country's flag inside Calculate’s VAT refund rules button, updating with the country selection. TypeScript checks pass; browser and native display were not tested for this change.
- [x] Show the country's flag beside its name in the refund rules popup title, including retained comparison rules. TypeScript checks pass; browser and native display were not tested for this change.

## Automatic assumptions only

- [x] Remove Edit assumptions, manual FX/refund fields and reset controls from Calculate; keep country-specific VAT rules available.
- [x] Clear legacy overrides before new UI calculations, restrict editable form fields and remove the result-page instruction to enter a manual refund. Preserve historical saved totals and provenance.
- [x] Update requirements and browser checks. TypeScript, all 113 unit/integration tests, web export and three focused Chromium tests pass. Native device checks were not run.

## Complete guest currency coverage

- [x] Bundle the six owner-supplied FX pairs alongside the four existing rates, covering every combination of US, GB, AU, JP, ES and FR.
- [x] Preserve unknown quote dates and owner provenance; keep stale-rate warnings and strict authenticated API validation. Version the guest cache so existing users receive complete defaults immediately.
- [x] Verify all 36 home/shopping combinations, direct/reverse rates, a GBP 100 → USD 132 example, retained refund metadata, cache restart and old-cache replacement. TypeScript and all 116 unit/integration tests pass; browser and native device checks were not run for this change.
