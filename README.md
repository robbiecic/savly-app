# Savly

A mobile shopping companion that answers: **“What will this cost me in my home currency, and how much could I save?”**

Status: Expo + TypeScript scaffold implemented with a Savly welcome screen. Calculator, reference-data integration, and billing are not implemented yet.

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

> Read the project specs and build milestone 1. Use the documented defaults for unresolved choices, implement and test the calculation engine, and tell me which acceptance criteria pass. Keep the task list current.

## Technology and local setup

Expo + React Native + TypeScript, using one project for Android and iOS. Expo supports both platforms: [official documentation](https://docs.expo.dev/). The scaffold uses the [official blank TypeScript starter](https://docs.expo.dev/more/create-expo/): Expo SDK 57, React 19.2, React Native 0.86, and strict TypeScript. Exact versions are locked in `package-lock.json`.

Use Node.js 24 LTS or newer and npm. Install and start from this directory:

```bash
npm ci
npm start
```

Open the project in an Expo Go version compatible with SDK 57. Press `i` for an installed iOS simulator (macOS with Xcode) or `a` for a configured Android emulator. You can also use `npm run ios` or `npm run android`. A physical phone must be able to reach the development server. No backend, account, or API credentials are needed for this welcome screen.

Checks:

```bash
npm run typecheck
npm run check:dependencies
NODE_ENV=production npm run export:mobile
```

The export command bundles Android and iOS JavaScript into ignored `dist/`; it does not produce installable store binaries. No automated calculator tests exist yet; those belong to the next foundation tasks.

`App.tsx` sets up safe areas and the status bar; `src/app/WelcomeScreen.tsx` contains the initial screen and `src/theme/colors.ts` holds the starting palette. The generated icons are Expo placeholders pending Savly artwork.

Verified on 2026-09-29 with Node 26.0.0 and npm 11.14.1: TypeScript, Expo dependency compatibility, and production bundling for Android and iOS passed. No simulator or physical-device tests were run. npm audit reported 10 moderate advisories in the Expo tooling dependency tree (including transitive `uuid`/`xcode`); its suggested full fix downgrades Expo to SDK 46, so it was not applied. Revisit compatible upstream fixes before release.

## Premium access

Savly is a paid-access product with optional login for retained history. See [premium and history requirements](specs/002-premium-and-history/spec.md); monthly subscription and lifetime unlock use Google Play Billing / Apple App Store in-app purchases after free installation. Prices remain undecided.

## Backend API

The backend lives in the sibling [fxService repository](../fxService/README.md). Its [API contract](../fxService/specs/requirements/03-api-contract.md) and [country/VAT specification](../fxService/specs/requirements/06-country-vat.md) own the wire format. Read the app’s [integration notes](specs/001-shopping-calculator/api-contract.md) for caching, rate direction, and remaining integration gaps.

## Working assumptions

The owner selected travelers from any country and a polished prototype with sample rates as the first deliverable. The prototype dynamically loads supported countries, FX rates, and VAT metadata through mocks of the fxService endpoints, caches them for four hours, and calculates all savings on-device, with editable assumptions and clearly labeled sample rates. Calculator access does not require a Savly account. Optional login will retain history in the cloud; prototype billing and account flows are mocked without a deployed backend. Supported shopping countries and currencies come from the API dataset rather than a hardcoded list; it does not imply country-specific refund support. Refund rules are separate illustrative prototype fixtures, not an existing backend capability. Production guest access must be resolved with the backend’s Cognito requirement. USD/EUR examples are illustrative, not a market commitment.
