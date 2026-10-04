# Historical AC19 — USA home price versus a purchase in Spain

The current calculator assumes full included-VAT refund with no provider fee: USD 87.88 refund, USD 418.48 net cost, USD 81.52 savings (16.3%). The 28%-fee worked example below is retained for historical saved-calculation regression tests.

Confirmed by the owner: **EUR 450 includes VAT**. This is an illustrative, on-device estimate, not a current exchange-rate quote, provider fee quote, or determination of refund eligibility.

## Inputs and assumptions

| Input | Value |
| --- | --- |
| Home country / currency | United States / USD |
| Home price, including applicable taxes | USD 500.00 |
| Shopping country / currency | Spain / EUR |
| Overseas price, including VAT | EUR 450.00 |
| VAT rate assumed for this example | 21% |
| Original FX quote | 1 USD = 0.8887 EUR |
| Quote status | Stale; show **Rates out of date** |
| Additional card/bank fee | 0% |
| Gross eligible refund assumption | All VAT included in this purchase, before provider fees |
| Assumed refund-provider fee | 28% of that gross VAT refund |
| Settlement assumption | Purchase and refund use the same FX quote |
| Exclusions | Customs duties, import taxes, and travel costs |

The 21% VAT metadata matches the Spain entry in fxService's country contract. Refund eligibility and the 28% fee are separate **local sample assumptions**, not values supplied by that API. Actual refund eligibility and provider deductions vary: the [Spanish Tax Agency describes refunding the VAT paid, less the applicable commission when using a collaborating entity](https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Viajeros_Desplazados/DIVA/FAQfebr24eng.pdf). The 28% value here is not sourced from that guidance.

## Calculation

The supplied quote is EUR per USD. Convert EUR to USD by **dividing by 0.8887**, retaining the original quote instead of using a rounded reciprocal.

For a VAT-inclusive price, extract VAT with **21 / 121**, not 21 / 100.

| Step | Formula, evaluated without intermediate rounding | Display |
| --- | --- | --- |
| Converted overseas price | 450 / 0.8887 = 506.357600990210… | USD 506.36 |
| Price difference before refund | 500 − 450 / 0.8887 = −6.357600990210… | USD −6.36 |
| Included VAT in EUR | 450 × 0.21 / 1.21 = 78.099173553719… | EUR 78.10 |
| Gross VAT refund before fee, assumed eligible | (450 × 0.21 / 1.21) / 0.8887 = 87.880244799953… | USD 87.88 |
| Provider fee | Gross refund × 0.28 = 24.606468543987… | USD −24.61 |
| Net expected refund | Gross refund × 0.72 = 63.273776255966… | USD 63.27 |
| Final estimated overseas cost | 450 / 0.8887 − net refund = 443.083824734243… | USD 443.08 |
| Final potential savings | 500 − final overseas cost = 56.916175265756… | **USD 56.92** |
| Savings percentage | Savings / 500 × 100 = 11.383235053151… | **11.4%** |

Equivalently:

```text
500 − (450 / 0.8887)
    + ((450 × 0.21 / 1.21) / 0.8887)
    − (((450 × 0.21 / 1.21) / 0.8887) × 0.28)
= 56.916175265756… USD
→ USD 56.92
```

Each display value is rounded half-up at the end. Adding the already rounded component labels (−6.36 + 87.88 − 24.61) yields 56.91; this one-cent discrepancy is expected under the existing round-once policy. Do not change the final result to reconcile individually rounded intermediate labels. The displayed final cost and savings still reconcile: 443.08 + 56.92 = 500.00.

## Correction to the originally proposed numbers

The initial proposal gave USD 106.33 gross refund, USD 29.77 fee, and USD 70.21 savings. It treated approximately 21% of the **VAT-inclusive** converted purchase price as included VAT, overstating the refundable tax. In addition, the listed expression −6.36 + 106.33 − 29.77 equals 70.20, not 70.21. These figures are recorded for traceability, not acceptance targets.

## App behavior and verification

- The local Spain/US sample refund fixture explicitly models a 28% fee on included VAT, rather than treating VAT itself as an assured refund.
- The standard prototype FX fixture remains unchanged. This exact example injects a stale cached USDEUR quote of 0.8887 in the regression tests; it must not be represented as live.
- Result details show price difference, estimated gross refund, assumed fee, net refund, final cost, and savings. Share includes the same breakdown and stale/sample labels.
- Manual refund entry is already a **net amount**; replacing this fixture with a manual refund removes the fee breakdown and does not deduct 28% again.
- Unknown or unsupported refund eligibility remains unavailable; this local sample rule is never used in real-data mode.
- Save preserves the displayed breakdown, source quote, source timestamp, stale flag, and assumptions without recalculating them after restart.

Coverage: `tests/spain-example.test.ts` checks arithmetic, quote orientation, rounding, manual overrides, fee bounds, sample-only behavior, and saved snapshots. The AC19 browser test in `tests/ui/comparison.spec.ts` renders the example from an expired cached dataset whose refresh fails.
