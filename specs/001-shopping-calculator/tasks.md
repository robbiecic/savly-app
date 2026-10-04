# Task checklist

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

- [x] Add the design-board-inspired welcome screen; Get started opens Compare and Sign in is disabled.

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
- [ ] Implement mock purchase/restore and optional sign-in states from spec 002.
- [ ] Verify guest isolation, history import, and simulated sync behavior.
- [x] Verify local saved-comparison persistence, deletion, duplicate-save behavior, and corrupt-storage handling.
- [ ] Verify account-specific history persistence after mocked account flows are added.

## Later

- [x] Confirm monthly subscription and lifetime unlock via Google Play Billing / Apple App Store.
- [ ] Set monthly/lifetime prices and select login provider.
- [ ] Integrate production billing/entitlement validation and private cloud history.
- [ ] Verify premium/history criteria PH1–PH9 and account deletion/recovery.

- [ ] Integrate existing fxService endpoints; confirm deployment URL, CityIndex usage rights, pair coverage, and Cognito access for guests.
- [ ] Define launch markets and a real refund-data contract; current fxService provides VAT metadata only.
- [ ] Configure sharing domain, fallback page, live store links, and Universal/App Links.
- [ ] Verify WhatsApp text/link delivery and installed/uninstalled routing (SH1–SH6).
- [ ] Complete device testing and store preparation.

- [x] Select the local fxService API in native development with emulator-aware addresses, isolated cache, and labeled sample fallback when unavailable.
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
