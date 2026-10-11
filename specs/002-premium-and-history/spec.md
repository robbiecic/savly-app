# 002 — Premium access and optional account history

Status: monthly store billing and lifetime purchase confirmed; prices remain undecided. In-app Cognito sign-in, registration, email confirmation, and recovery are implemented; real-account and device verification remain pending. RevenueCat Test Store purchase/restore integration is implemented; real store billing and native transaction verification remain pending.

## Confirmed direction

Savly is a premium product with paid access. The owner requested a recurring subscription option or a lifetime purchase, and optional login to retain shopping and search history. Default mode allows unlimited calculations using the limited bundled stale rates and countries. Monthly billing is confirmed. All purchases and renewals use Google Play Billing on Android and Apple App Store in-app purchases on iOS.

Payment and login are separate: a paying user can use the calculator without a Savly account. Login adds durable cloud history and recovery across devices. Store identity restores purchases; a Savly account restores personal history.

## Purchase flow

Use free installation with unlimited default-data calculations and an optional Premium upgrade: an automatically renewing monthly subscription or a one-time lifetime purchase. Premium enables API reference data when signed in; there is no separate upfront download charge. The platform store handles checkout, payment details, recurring charges, and subscription management. Do not add a separate web checkout or custom recurring payment system.

Prices, launch currencies, and any trial are undecided. No trial is assumed. Both purchase options unlock the same features; lifetime access has no recurring Savly subscription charge. Real prices must come from store product metadata, not hardcoded UI values.

Use an auto-renewable monthly subscription and a non-consumable lifetime unlock on iOS; use a monthly auto-renewing subscription and a non-consumable one-time product on Google Play. Provide Restore purchases and subscription management. Savly must verify store transactions and keep access synchronized with renewals, expirations, refunds, and revocations through its backend. The store manages billing; Savly manages feature access based on verified purchase status. Optional Savly login must not be required to buy or restore access. Apple documents these product types in [In-App Purchase](https://developer.apple.com/in-app-purchase/); Google documents digital purchase billing in [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en). Reviewed 2026-09-26; verify again during store integration.

## Minimal account flow

After access is unlocked, offer “Continue without an account” and “Sign in to keep your history.” Keep sign-in available later in Settings and History without prompting on every calculation. No extra account fee is proposed.

Guest history stays on the device and may be lost after uninstall or device loss. Signed-in history syncs to the user's private account. Use a single concise prompt when first signing in to offer importing existing guest history; do not silently upload it or merge one person's history into another account.

## History behavior

Current prototype: the separate result page offers explicit Save and Share. Save requires a name and stores an immutable comparison on-device. Saved comparisons can be reopened, deleted, or cleared with confirmation; failures and corrupt data show a recoverable error. This implements local favorites only. Automatic recent history, production billing, account isolation, and cloud sync remain future work.

- Shopping history records completed valid comparisons as immutable snapshots, with item label if provided, price, countries/currencies, reference dataset and override metadata, before/after refund costs, home price if supplied, and timestamp.
- Automatic recalculation must not create a record per keystroke. Upsert one draft comparison while editing; commit it when the user leaves its valid result or starts another item. Reopening a completed record does not rewrite it.
- Saved/favorite comparisons remain distinct from automatic recent history.
- Search history means submitted searches, not every keystroke. Product search does not exist in the current calculator scope. Add search-history capture when an actual search feature is specified; do not invent product search to satisfy this requirement.
- Signed-in offline changes queue for sync. Stable record IDs prevent duplication. Deletions must sync and must not resurrect from older devices.
- Provide delete-item and clear-history controls. Account deletion and retention handling must be specified before production authentication ships.
- Sign-out clears private account data from the device and returns to a separate guest space. Never expose one account's history to another user.

## Access states

Mock locked, active subscription, lifetime, expired, pending, canceled checkout, failed checkout, and restored states in the prototype. A canceled renewal remains active until its paid period ends; expiration or revocation removes API reference-data access for new calculations without silently deleting history. Keep sign-in, restore, account/history management, and billing help reachable while locked. Define production offline entitlement/grace handling before billing integration.

Cross-platform purchase portability, subscription-to-lifetime upgrades, and exact history-retention duration remain open. Cognito is the selected authentication provider. Do not promise automatic cancellation of an existing store subscription when buying lifetime access.

## Acceptance criteria

- **PH1:** A user with valid paid access can calculate without creating or signing into a Savly account.
- **PH2:** The paywall offers a monthly auto-renewing subscription and a one-time lifetime purchase through the device’s platform store, showing store-provided localized price and renewal/one-time terms. Canceled, pending, or failed checkout does not grant access. Prototype purchases are explicitly simulated and never charge money.
- **PH3:** Restore recovers an eligible purchase independently of optional Savly login; restoring a purchase alone does not claim to restore cloud history.
- **PH4:** Guest history survives app restart. On sign-in, importing guest history is optional and does not duplicate records.
- **PH5:** Signed-in history returns on another signed-in device; edits while offline sync once reconnected. Mock demonstrations must be labeled simulated until a real backend is implemented and tested.
- **PH6:** Sign-out/account switching prevents history leakage. Deleting a record syncs its removal without resurrection.
- **PH7:** Repeated price edits produce one completed comparison, not a history entry for each local recalculation. Opening history does not modify its historical rate snapshot.
- **PH8:** Subscription expiration preserves history while returning new calculations to bundled default data; valid lifetime access remains unlocked without a renewal date.

- **PH9:** Subscription management opens the relevant store’s management flow. Store renewal, expiry, refund, and revocation events update verified access without requiring a Savly login. No custom recurring billing or external checkout is introduced.

## Delivery

Prototype: mocked purchase states, real Cognito sign-in, local history, and future simulated sync behind adapters. Production: store products and transaction verification, authenticated private storage, account recovery/deletion, and real multi-device tests. Mock login is never represented as actual cloud retention.

## Optional item photo

Before saving a comparison, offer **Take photo** and **Add photo** beside the item name. Accept one still image, show a circular cropped preview, and let the user replace or remove it before Save. A photo is optional; canceling selection leaves the current photo and comparison intact. Request camera permission only when taking a photo; use the system library picker for selected-image access. Denial or selection errors show a recoverable message and still allow saving without a photo.

Resize large photos to at most 1000 pixels on the longest edge and encode as JPEG, capped at approximately 300 KB (400,000 base64 characters). Oversized images show an error without replacing the existing selection. Save the photo together with the named comparison. On native devices, copy image data into app document storage and persist a relative reference, never only a camera-cache path. Browser previews persist the bounded JPEG in browser storage. Show photos in Saved and on reopening; missing files show a photo-unavailable message without hiding the estimate. Existing records without photos remain valid.

Failed record writes roll back newly created photo files. Deleting an item or clearing saved items removes its local photo files after the record write succeeds; cleanup failure does not undo a committed record operation. Photos stay on-device and are not uploaded or included in the current text-only share action. Camera availability and capture behavior on web depend on the browser/device.

Tap a photo preview in the save form, Saved list, or reopened comparison to open a full-screen viewer. Fit the entire image without cropping against a dark background. Close returns to the same screen; Android Back also dismisses the viewer. The circular preview does not crop the stored photo.

Take photo and Add photo use the same outlined action style as Save and Share, side by side with camera and image-library icons beside their text. Labels may wrap on narrow screens while touch targets remain at least 48 points.

## Cognito sign-in milestone

Welcome and Settings offer real Cognito sign-in, separate from billing, calculator access, and future history sync. Try it out continues without an account. The sign-in sheet contains native email/password forms for Sign in, Create account, email verification/resend, and password recovery. On success, Welcome advances to Calculate and Settings shows the signed-in identity. Settings shows Sign out only while signed in, and Sign in only while signed out. These account actions are mutually exclusive. Sign out removes the securely saved session and clears the in-memory session and returns to the opening welcome/splash screen, with Try it out and Sign in available. Returning as a guest starts a fresh calculator draft and keeps saved comparisons and preferences. Saved comparisons remain device-local guest data; sign-in never uploads or reassigns them and does not claim cloud retention.

For local/development, use issuer `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_MncSdF1r0` and public app client `35vicii2qq71r09bcd0val80lm`. Use Cognito SRP (`USER_SRP_AUTH`), already enabled by fxService infrastructure, with the AWS Cognito identity SDK. No client secret belongs in the app. Release builds require explicit configuration and must not automatically use development IDs. Direct account requests go to Cognito, never to invented fxService endpoints. New sign-ins require no managed-login domain, callback registration, or browser. Keep existing OAuth renewal only for previously saved browser sessions.

Create account asks for email, password, and matching confirmation. Require at least eight characters, uppercase/lowercase letters, a digit, and a symbol; Cognito remains authoritative for stricter policies. Successful creation moves to email verification unless Cognito reports the account already confirmed. Confirmation returns to sign-in without granting a session. Allow resending codes and returning to sign-in to correct the email. Unconfirmed sign-in opens verification; a required password reset opens recovery. Recovery requests a code and submits it with a new confirmed password. Wrong/expired codes and credential errors provide actionable messages; rate limits ask the user to wait. Network/configuration failures show **Can't connect right now** and allow resubmission or returning to Savly. Never show raw provider errors.

Support SMS and authenticator MFA codes and forced new-password challenges, including required attributes, inside the app. Other optional challenge configurations (custom authentication, MFA enrollment/selection, email MFA) are not enabled by the current backend and must show an unsupported-method error instead of granting access. Add their UI before enabling them in Cognito.

Disable duplicate submissions, discard results after dismissing the form, and clear passwords/codes when changing steps or closing. Passwords and challenge sessions exist only in memory. The SDK uses a no-op cache; only the app's existing SessionStore persists tokens. Use Expo Crypto for native SRP randomness, bypassing the SDK's legacy native/debug fallback. Verify issued access tokens and identity through Cognito GetUser before accepting a session. Direct requests time out after ten seconds; SDK sign-in steps time out after twenty seconds. Preserve keyboard avoidance, scrolling, field labels, secure password inputs, and one-time-code autofill.

On Android and iOS, retain the validated session and refresh token in Expo SecureStore, scoped to the configured issuer, client and login domain. Closing or force-quitting the app must not sign the user out. Restore an unexpired session before showing the app; renew native sessions through Cognito GetTokensFromRefreshToken and verify the same identity through GetUser. Previously saved browser sessions retain their OAuth refresh/user-info path. Save rotated refresh tokens. Renew before expiry and when returning to the foreground. A temporary network/server failure preserves stored credentials and offers retry; a revoked/expired refresh token removes the session and requires sign-in again. Explicit Sign out must remove the saved session before reporting success, and late renewal results must not restore it. Storage failures remain visible and retryable. Browser previews remain memory-only. Do not put credentials in AsyncStorage/localStorage or logs. A new sign-in requires entering credentials after local sign-out. This adds no cloud history or billing behavior.

Use device-only keychain accessibility on iOS and SecureStore's encrypted Android storage with its backup exclusion. Rebuild native apps after adding SecureStore. Verify sign-in, force-quit/reopen, token renewal, offline retry and sign-out/reopen on physical devices before release.

Older native builds without ExpoSecureStore must not crash during startup. Check module availability before loading the storage package, show an app-update message, and allow guest use. Block sign-in until a compatible native build is installed; never silently fall back to insecure token storage or claim that sign-in was retained.

On launch, display the photo-led splash without Try it out or Sign in while restoring the saved session. Returning signed-in users go directly to Calculate after three seconds of splash display, waiting longer only if restoration/renewal is still pending. Do not briefly show welcome buttons before Calculate. Guests receive the normal welcome controls as soon as restoration finishes. Interactive sign-in does not add this launch delay.

## RevenueCat Test Store milestone (2026-10-10)

Use the owner's public Test Store SDK key and entitlement `savly_premium` (display name Savly Premium). Load the current/default offering's standard Monthly and Lifetime packages, retaining their RevenueCat product metadata and localized prices. Missing package types show a configuration/retry message rather than fabricated prices. This milestone supports native development builds only. Never configure the Test Store in a release build; release premium access stays locked until production billing is implemented; unlimited default-data calculations still work. Web remains an explicitly labeled calculator prototype with unlimited default-data calculations, without purchases or a claim of premium access.

Configure RevenueCat once with its anonymous customer identity. Cognito login/logout must not change billing identity or access. Try it out opens restricted mode with the calculator form, not a paywall. Settings offers Get Savly Premium; signed-out users start at Create account, can switch to Sign in, and continue to purchase options only after a validated sign-in. Existing signed-in users go directly to purchase options. Canceling account creation returns to Settings and cancels purchase continuation. Registration/verification alone never grants premium. Restore remains reachable without account creation; keep Settings, sign-in, Saved, restore and billing help reachable. Purchase cancellation, pending payment, errors or a completed purchase lacking the entitlement never grant access. A restored purchase does not restore cloud history. Existing saved estimates remain accessible after expiry.

Read customer information on startup/foreground and listen for SDK updates. Use SDK-cached customer information during temporary connection failures; do not add a separate local unlock flag. Monthly access ends at the supplied expiration time even offline; lifetime has no expiry. This is a test policy, not a completed production grace/revocation policy. Test purchase management/reset happens in the RevenueCat dashboard. Real store management, production keys, store notification wiring and production offline/grace decisions remain a separate milestone. RevenueCat handles test transaction status; fxService gains no billing endpoints.

Rebuild native binaries after installing react-native-purchases. Builds lacking its native module display an actionable message rather than crashing or silently unlocking. Device tests must cover monthly/lifetime purchases, cancellation, pending/failure, restoration/restart, expiry/revocation and Cognito sign-out independence before calling this end-to-end verified.

### Restricted entry and upgrade navigation

The owner confirmed unlimited free calculations; the restriction is the limited stale reference dataset, not a usage count. Users can browse countries, enter prices, view VAT information, and reopen Saved items without upgrading. Get Savly Premium is an explicit Settings action rather than an automatic paywall on entry. Purchased access remains tied to RevenueCat independently of Cognito; signing out does not remove a purchase. Browser previews use the same restricted entry, unlimited default-data calculations and account navigation, but purchases remain unavailable there.

There is no calculation quota, daily limit, counter persistence, or allowance storage dependency. Ignore counters saved by earlier builds, including exhausted or malformed values. Valid calculations continue after any number of submissions and across restarts. The same default-data behavior applies whenever the user is signed out OR lacks an active entitlement.

Free/restricted calculations always use the bundled static country/VAT/FX dataset, including after Cognito sign-in. Do not activate an authenticated API store or reuse its cached snapshot for free calculations. Reference API access requires both an active `savly_premium` entitlement and a valid Cognito session under the current backend contract. A signed-in upgrade switches to the API; losing premium switches new calculations back to bundled data. Previously submitted/saved estimates retain their original provenance. Account and RevenueCat requests are separate from the calculator reference API restriction.

Stale-rate messaging must not suggest that login alone upgrades free rates: use “FX rates are stale. Premium and sign-in enable API rates.” Do not promise the API source is live or accurate merely because it was fetched.

Welcome action hierarchy: show **Sign in** first as the filled primary button; show **Try it out** beneath it as the secondary action. Try it out opens unlimited default-data calculations without an account. Keep both actions hidden during session restoration as before.
