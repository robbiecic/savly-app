"""Build the side-by-side Savly journey HTML from captured browser screenshots."""

from html import escape
from pathlib import Path


ROOT = Path(__file__).resolve().parent

JOURNEYS = [
    (
        "Guest calculation",
        "Try Savly and compare two prices",
        [
            ("01-welcome", "Open Savly", "Tap Try it out"),
            ("02-default-calculator", "Review defaults", "Open Calculate"),
            ("03-settings-home-country", "Open Settings", "Tap the cog"),
            ("04-home-country-picker", "Choose home country", "Select United States"),
            ("05-comparison-inputs", "Enter prices", "EUR 120 vs USD 150"),
            ("06-savings-summary", "See the result", "Masked savings preview"),
        ],
        "The home price makes a savings comparison possible. This example uses illustrative prices and bundled default FX and VAT data, clearly labeled in the app.",
    ),
    (
        "Understand a result",
        "Check the calculation and VAT assumptions",
        [
            ("06-savings-summary", "Read summary", "Open Your savings"),
            ("07-calculation-details", "Expand details", "Review costs and FX"),
            ("08-vat-rules", "Check VAT rules", "Read the eligibility notes"),
        ],
        "The estimate is calculated on-device. VAT included in a price is not an assured refund; eligibility, minimum spend, and provider fees still matter.",
    ),
    (
        "Save and revisit",
        "Keep a comparison on this device",
        [
            ("06-savings-summary", "Review result", "Start from the estimate"),
            ("09-saved-confirmation", "Save it", "Name Demo travel bag"),
            ("10-saved-list", "Open Saved", "Find the comparison"),
            ("11-reopened-result", "Revisit it", "Open the saved result"),
        ],
        "Saved calculations keep their original rate and assumptions. The result is shown with the viewer's current default-mode preview; this flow does not claim cloud sync.",
    ),
    (
        "Compare outcomes",
        "See when buying overseas costs more",
        [
            ("05-comparison-inputs", "Enter prices", "EUR 120 vs USD 150"),
            ("06-savings-summary", "See savings", "Higher home price"),
            ("12-extra-cost-summary", "Change home price", "USD 100: costs more"),
        ],
        "Changing the home price changes the comparison. In default mode, both savings and extra costs show only the first digit of the amount.",
    ),
    (
        "Create an account",
        "Verify email and continue into Savly",
        [
            ("13-sign-in", "Open account forms", "Tap Sign in"),
            ("14-create-account", "Create account", "Enter email and password"),
            ("15-email-verification", "Verify email", "Enter the six-digit code"),
            ("16-billing-fallback", "Review Premium", "Browser billing fallback"),
            ("17-signed-in-default-calculator", "Continue", "Use default calculator"),
        ],
        "The account provider was simulated for these browser captures; no real email was sent. Verification signs the user in without another login. Native plan choices and the Not right now button require an Android or iOS build; the browser fallback is shown here.",
    ),
    (
        "Sign out",
        "Check account status and leave the session",
        [
            ("17-signed-in-default-calculator", "Signed in", "Open Settings"),
            ("18-signed-in-settings", "View account", "Review status"),
            ("19-signed-out", "Sign out", "Return to Welcome"),
        ],
        "This example account has no active Premium access and uses bundled defaults. The Settings screen identifies the signed-in account before sign-out.",
    ),
]

CSS = """
@page { size: A3 landscape; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #12213a; background: #e8edf4; }
.page { width: 420mm; height: 297mm; padding: 17mm 15mm 14mm; page-break-after: always; break-after: page; overflow: hidden; background: #f7f9fc; position: relative; }
.top { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #cdd7e5; padding-bottom: 5mm; }
.brand { font-size: 17pt; font-weight: 800; color: #0e2550; }
.count { font-size: 10pt; color: #4f6b94; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
h1 { margin: 9mm 0 2mm; font-size: 27pt; line-height: 1.08; letter-spacing: -.7pt; }
.subtitle { margin: 0; font-size: 13pt; color: #435b7f; }
.flow { height: 196mm; display: flex; align-items: flex-start; justify-content: center; gap: 0; margin-top: 12mm; }
.card { flex: none; width: var(--card-width); text-align: center; position: relative; }
.number { display: inline-block; background: #194c8c; color: white; border-radius: 100%; width: 9mm; height: 9mm; line-height: 9mm; font-size: 11pt; font-weight: 800; margin-bottom: 3mm; }
.phone { width: 100%; aspect-ratio: 390 / 844; overflow: hidden; border: 1.2mm solid #182a49; border-radius: 5mm; background: white; box-shadow: 1mm 1.5mm 3mm #b7c5d6; }
.phone img { display: block; width: 100%; height: 100%; object-fit: fill; }
.card h2 { font-size: 12pt; line-height: 1.1; margin: 4mm 0 1mm; }
.card p { font-size: 10pt; line-height: 1.2; margin: 0; color: #435b7f; }
.arrow { flex: none; width: var(--arrow-width); padding-top: 70mm; text-align: center; color: #3072ba; font-size: 21pt; font-weight: bold; }
.note { position: absolute; left: 15mm; right: 15mm; bottom: 15mm; min-height: 22mm; padding: 5mm 7mm; border-left: 2mm solid #3476b9; border-radius: 2mm; background: #e8f0fa; display: flex; align-items: center; }
.note p { font-size: 11pt; line-height: 1.35; margin: 0; }
.page-footer { position: absolute; right: 15mm; bottom: 5mm; font-size: 8pt; color: #7a8ca4; }
@media screen { .page { margin: 18px auto; box-shadow: 0 4px 20px #aebbc9; } }
"""


def widths(count: int) -> tuple[str, str]:
    return {
        3: ("70mm", "15mm"),
        4: ("76mm", "11mm"),
        5: ("69mm", "9mm"),
        6: ("61mm", "4mm"),
    }[count]


parts = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Savly user journeys — side-by-side screens</title>',
    '<style>', CSS, '</style></head><body>',
]

for journey_number, (name, subtitle, steps, note) in enumerate(JOURNEYS, 1):
    card_width, arrow_width = widths(len(steps))
    parts.append(
        f'<section class="page" id="journey-{journey_number}" '
        f'style="--card-width:{card_width};--arrow-width:{arrow_width}">'
        '<div class="top"><div class="brand">Savly ✈</div>'
        f'<div class="count">Journey {journey_number:02d} / {len(JOURNEYS):02d}</div></div>'
        f'<h1>{escape(name)}</h1><p class="subtitle">{escape(subtitle)}</p>'
        '<div class="flow">'
    )
    for step_number, (image, title, action) in enumerate(steps, 1):
        if step_number > 1:
            parts.append('<div class="arrow" aria-hidden="true">→</div>')
        parts.append(
            f'<div class="card"><div class="number">{step_number}</div>'
            f'<div class="phone"><img src="screenshots/{escape(image)}.png" '
            f'alt="{escape(title)} screen"></div>'
            f'<h2>{escape(title)}</h2><p>{escape(action)}</p></div>'
        )
    parts.append(
        f'</div><div class="note"><p>{escape(note)}</p></div>'
        f'<div class="page-footer">Browser prototype · illustrative prices · {journey_number:02d}</div>'
        '</section>'
    )

parts.append('</body></html>')
(ROOT / 'Savly-user-journeys.html').write_text('\n'.join(parts), encoding='utf-8')
print(f'Built {len(JOURNEYS)} journeys in {ROOT / "Savly-user-journeys.html"}')
