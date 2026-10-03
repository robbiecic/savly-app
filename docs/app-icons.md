# Savly app icons and thumbnails

The owner chose Savly-branded artwork instead of the Expo placeholder originally at assets/icon.png. The visual reference is [images/Icon.png](../images/Icon.png). New artwork was created with built-in image generation, then mechanically resized and padded for platform exports.

![Icon export preview](../assets/branding/preview.png)

## Files

- [assets/icon.png](../assets/icon.png): opaque 1024 × 1024 full-square iOS/Expo app icon, configured in app.json. The operating system applies its own corner mask.
- Android: 1024 × 1024 foreground, pale-blue background, and monochrome alpha mask in assets/android-icon-*.png, configured in app.json. The monochrome export reuses the foreground alpha so the shapes align.
- [assets/google-play-icon.png](../assets/google-play-icon.png): 512 × 512 store artwork.
- [assets/favicon.png](../assets/favicon.png): 48 × 48 web favicon, configured in app.json.
- public/apple-touch-icon.png: 180 × 180; public/icon-192.png and public/icon-512.png: web-ready sizes. These files alone do not add PWA installation.
- assets/thumbnails/savly-{32,64,128,256,512,1024}.png: square brand thumbnails.
- assets/splash-icon.png: 512 × 512 transparent mark prepared for future native launch-screen configuration. The existing photo-led welcome screen is unchanged.
- assets/branding/icon-master.png and foreground-master.png: approved original generated artwork.
- [scripts/export-icons.cjs](../scripts/export-icons.cjs): reproducible exports, run with npm run export:icons.

The combined Android mark is padded into a circle of diameter 58% of its canvas, inside the [Android adaptive-icon safe zone](https://developer.android.com/codelabs/basic-android-kotlin-compose-training-change-app-icon). Expo uses the configured 1024px artwork to generate device-specific icons during native builds; see [Expo icon configuration](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/). Rebuild and reinstall a native app to see its launcher icon; a JavaScript reload does not replace an installed launcher icon.

## Generation prompts

### Light master

Create ONE production Savly app icon, square 1024x1024, inspired by the LARGE LIGHT icon in the reference board. Preserve its recognizable bold navy airplane angled northeast and a smooth cyan-to-blue swoosh curling behind its tail. Center the silhouette with comfortable 18% margins. Background is elegant very pale icy blue and white translucent flowing ribbons, subtle premium frosted finish, but simple enough to read at 32px. Full bleed perfectly square opaque artwork to all four edges: NO rounded outer corners, NO exterior shadow, NO mockup, NO phone, NO words, NO size labels, NO collage. Only one standalone light-background app icon, sharp readable navy silhouette. Reference text and devices are not part of the icon.

### Foreground master

Create an Android adaptive icon foreground PNG on a genuinely TRANSPARENT background. Preserve the exact navy northeast airplane and cyan-blue swoosh from this Savly icon. Remove every white/blue frosted background ribbon, background texture and any backdrop. Only the navy airplane plus its saturated blue curved swoosh remain. Square canvas. Make the entire combined airplane+swoosh centered and SMALL enough to fit inside a circle of diameter 58% of the full canvas (all nontransparent pixels within this central circle), leaving ample transparent padding around it. Do not put a circle, border, shadow, badge, text, or rounded tile behind it. Actual transparent alpha, not a checkerboard painting.

The exporter enforces output dimensions and safe-area padding deterministically. A separate generated monochrome draft was rejected for rough edges; the shipped monochrome icon is the approved foreground's alpha mask.

## Verification

Inspected the generated artwork and preview at thumbnail size. Checked dimensions, opaque main icon, transparent Android layers, and safe-area containment. Expo configuration and web production export were checked. Installed-device launcher rendering and store upload validation remain pending.
