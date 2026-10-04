# 002 — Premium access and optional account history

Status: monthly store billing and lifetime purchase confirmed; prices remain undecided. No billing or authentication implementation exists yet.

## Confirmed direction

Savly is a premium product with paid access. The owner requested a recurring subscription option or a lifetime purchase, and optional login to retain shopping and search history. Do not add a free functional tier. Monthly billing is confirmed. All purchases and renewals use Google Play Billing on Android and Apple App Store in-app purchases on iOS.

Payment and login are separate: a paying user can use the calculator without a Savly account. Login adds durable cloud history and recovery across devices. Store identity restores purchases; a Savly account restores personal history.

## Purchase flow

Use free installation followed by a required paid unlock: an automatically renewing monthly subscription or a one-time lifetime purchase. There is no free functional tier and no separate upfront download charge. The platform store handles checkout, payment details, recurring charges, and subscription management. Do not add a separate web checkout or custom recurring payment system.

Prices, launch currencies, and any trial are undecided. No trial is assumed. Both purchase options unlock the same features; lifetime access has no recurring Savly subscription charge. Real prices must come from store product metadata, not hardcoded UI values.

Use an auto-renewable monthly subscription and a non-consumable lifetime unlock on iOS; use a monthly auto-renewing subscription and a non-consumable one-time product on Google Play. Provide Restore purchases and subscription management. Savly must verify store transactions and keep access synchronized with renewals, expirations, refunds, and revocations through its backend. The store manages billing; Savly manages feature access based on verified purchase status. Optional Savly login must not be required to buy or restore access. Apple documents these product types in [In-App Purchase](https://developer.apple.com/in-app-purchase/); Google documents digital purchase billing in [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en). Reviewed 2026-09-26; verify again during store integration.

## Minimal account flow

After access is unlocked, offer “Continue without an account” and “Sign in to keep your history.” Keep sign-in available later in Settings and History without prompting on every calculation. No extra account fee is proposed.

Guest history stays on the device and may be lost after uninstall or device loss. Signed-in history syncs to the user's private account. Use a single concise prompt when first signing in to offer importing existing guest history; do not silently upload it or merge one person's history into another account.

## History behavior

Current prototype: the separate result page offers explicit Save and Share. Save requires a name and stores an immutable comparison on-device. Saved comparisons can be reopened, deleted, or cleared with confirmation; failures and corrupt data show a recoverable error. This implements local favorites only. Automatic recent history, billing, account isolation, and cloud sync remain future work.

- Shopping history records completed valid comparisons as immutable snapshots, with item label if provided, price, countries/currencies, reference dataset and override metadata, before/after refund costs, home price if supplied, and timestamp.
- Automatic recalculation must not create a record per keystroke. Upsert one draft comparison while editing; commit it when the user leaves its valid result or starts another item. Reopening a completed record does not rewrite it.
- Saved/favorite comparisons remain distinct from automatic recent history.
- Search history means submitted searches, not every keystroke. Product search does not exist in the current calculator scope. Add search-history capture when an actual search feature is specified; do not invent product search to satisfy this requirement.
- Signed-in offline changes queue for sync. Stable record IDs prevent duplication. Deletions must sync and must not resurrect from older devices.
- Provide delete-item and clear-history controls. Account deletion and retention handling must be specified before production authentication ships.
- Sign-out clears private account data from the device and returns to a separate guest space. Never expose one account's history to another user.

## Access states

Mock locked, active subscription, lifetime, expired, pending, canceled checkout, failed checkout, and restored states in the prototype. A canceled renewal remains active until its paid period ends; expiration or revocation removes premium calculation access without silently deleting history. Keep sign-in, restore, account/history management, and billing help reachable while locked. Define production offline entitlement/grace handling before billing integration.

Cross-platform purchase portability, subscription-to-lifetime upgrades, authentication provider, and exact history-retention duration remain open. Do not promise automatic cancellation of an existing store subscription when buying lifetime access.

## Acceptance criteria

- **PH1:** A user with valid paid access can calculate without creating or signing into a Savly account.
- **PH2:** The paywall offers a monthly auto-renewing subscription and a one-time lifetime purchase through the device’s platform store, showing store-provided localized price and renewal/one-time terms. Canceled, pending, or failed checkout does not grant access. Prototype purchases are explicitly simulated and never charge money.
- **PH3:** Restore recovers an eligible purchase independently of optional Savly login; restoring a purchase alone does not claim to restore cloud history.
- **PH4:** Guest history survives app restart. On sign-in, importing guest history is optional and does not duplicate records.
- **PH5:** Signed-in history returns on another signed-in device; edits while offline sync once reconnected. Mock demonstrations must be labeled simulated until a real backend is implemented and tested.
- **PH6:** Sign-out/account switching prevents history leakage. Deleting a record syncs its removal without resurrection.
- **PH7:** Repeated price edits produce one completed comparison, not a history entry for each local recalculation. Opening history does not modify its historical rate snapshot.
- **PH8:** Subscription expiration preserves history while disabling premium calculations; valid lifetime access remains unlocked without a renewal date.

- **PH9:** Subscription management opens the relevant store’s management flow. Store renewal, expiry, refund, and revocation events update verified access without requiring a Savly login. No custom recurring billing or external checkout is introduced.

## Delivery

Prototype: mocked purchase and account states, local history, and simulated sync behind adapters. Production: store products and transaction verification, authenticated private storage, account recovery/deletion, and real multi-device tests. Mock login is never represented as actual cloud retention.

## Optional item photo

Before saving a comparison, offer **Take photo** and **Add photo** beside the item name. Accept one still image, show a circular cropped preview, and let the user replace or remove it before Save. A photo is optional; canceling selection leaves the current photo and comparison intact. Request camera permission only when taking a photo; use the system library picker for selected-image access. Denial or selection errors show a recoverable message and still allow saving without a photo.

Resize large photos to at most 1000 pixels on the longest edge and encode as JPEG, capped at approximately 300 KB (400,000 base64 characters). Oversized images show an error without replacing the existing selection. Save the photo together with the named comparison. On native devices, copy image data into app document storage and persist a relative reference, never only a camera-cache path. Browser previews persist the bounded JPEG in browser storage. Show photos in Saved and on reopening; missing files show a photo-unavailable message without hiding the estimate. Existing records without photos remain valid.

Failed record writes roll back newly created photo files. Deleting an item or clearing saved items removes its local photo files after the record write succeeds; cleanup failure does not undo a committed record operation. Photos stay on-device and are not uploaded or included in the current text-only share action. Camera availability and capture behavior on web depend on the browser/device.

Tap a photo preview in the save form, Saved list, or reopened comparison to open a full-screen viewer. Fit the entire image without cropping against a dark background. Close returns to the same screen; Android Back also dismisses the viewer. The circular preview does not crop the stored photo.

Take photo and Add photo use the same outlined action style as Save and Share, side by side with camera and image-library icons beside their text. Labels may wrap on narrow screens while touch targets remain at least 48 points.
