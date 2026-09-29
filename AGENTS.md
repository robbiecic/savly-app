# Project working instructions

Savly is an Android/iOS shopping savings app. Read README.md and the relevant specs before implementation.

- Treat specs as the intended behavior. Update them when requirements change.
- Build one complete milestone at a time and keep tasks.md accurate.
- Explain outcomes in plain language for an owner who is learning to code.
- Keep calculations separate from UI and test financially meaningful examples.
- Never present sample FX as live, VAT included as an assured refund, or a conversion as savings without a home-price comparison.
- Preserve rate direction, provenance, and estimate assumptions.
- Avoid adding accounts, servers, paid services, or country rule engines without a feature need.
- Verify relevant checks and state what was actually run; do not claim unperformed device tests.

- The backend API and canonical wire contracts live in the sibling `../fxService` repository. Read its `README.md`, `specs/requirements/03-api-contract.md`, and `specs/requirements/06-country-vat.md` before API work. This app consumes that contract; do not invent endpoints or duplicate backend implementation here.
- Calculate all savings on-device. The current calculator API serves countries, VAT metadata, and CityIndex FX rates; it does not yet serve refund rules. Persist validated data for four hours. Keep history sync and billing verification separate.
