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
- [x] Implement reference-data API client, persistent four-hour cache, and asynchronous mock transport using api-contract.md (native storage/lifecycle adapters provided; calculator screen wiring and device validation remain).
- [ ] Cover automatic rates, source labels and bank-fee defaults, overrides, and API states in AC12–AC18.
- [x] Test calculation criteria AC1–AC8 and AC11 where applicable (domain behavior verified; AC7 rendered labels and other UI states remain in Milestone 2).
- [x] Document calculation test commands and domain input/output conventions in README.

## Milestone 2

- [ ] Build shared visual styles and accessible controls.
- [ ] Build price-first Compare and Result screens with automatic recalculation.
- [ ] Implement native Share savings/comparison with local summary formatting (spec 003).
- [ ] Verify sharing variants, cancellation, and no extra data requests.
- [ ] Remember home/trip settings and present costs with and without refunds.
- [ ] Verify all calculator states and rate/estimate labels.
- [ ] Demonstrate prototype and record Android/iOS verification gaps.

## Milestone 3 — History and mocked premium/account flows

- [ ] Implement local snapshots, recent history, and Saved screen.
- [ ] Implement mock purchase/restore and optional sign-in states from spec 002.
- [ ] Verify guest isolation, history import, and simulated sync behavior.
- [ ] Verify persistence, deletion, and corrupt-storage handling.

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
