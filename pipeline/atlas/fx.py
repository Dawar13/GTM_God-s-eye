"""Fixed FX table for converting announced amounts to USD (PHASE_1 §1.3.4).

Rates are by year: the IRS yearly average for 2021–2025, and the Federal
Reserve H.10 rate of 2026-10-23 for 2026. Years outside the table have no rate:
the amount keeps its original value and `size_usd` / `amount_usd` stays null,
rather than borrowing another year's rate.

INR crore: 1 Cr = 10,000,000 INR. Research cards record INR in rupees.
"""

IRS_URL = (
    "https://www.irs.gov/individuals/international-taxpayers/yearly-average-currency-exchange-rates"
)
FED_H10_URL = "https://www.federalreserve.gov/releases/h10/current/"

# Units of foreign currency per 1 USD, IRS yearly averages (page updated 2026-09-17).
_IRS_UNITS_PER_USD = {
    "EUR": {2025: 0.886, 2024: 0.924, 2023: 0.924, 2022: 0.951, 2021: 0.846},
    "INR": {2025: 87.133, 2024: 83.677, 2023: 82.572, 2022: 78.598, 2021: 73.936},
    "GBP": {2025: 0.759, 2024: 0.783, 2023: 0.804, 2022: 0.811, 2021: 0.727},
    "CAD": {2025: 1.398, 2024: 1.370, 2023: 1.350, 2022: 1.301, 2021: 1.254},
    "ILS": {2025: 3.451, 2024: 3.701, 2023: 3.687, 2022: 3.361, 2021: 3.232},
    "SGD": {2025: 1.307, 2024: 1.336, 2023: 1.343, 2022: 1.379, 2021: 1.344},
    "AUD": {2025: 1.551, 2024: 1.516, 2023: 1.506, 2022: 1.442, 2021: 1.332},
    "JPY": {2025: 149.632, 2024: 151.353, 2023: 140.511, 2022: 131.454, 2021: 109.817},
    "CNY": {2025: 7.129, 2024: 7.189, 2023: 7.075, 2022: 6.730, 2021: 6.452},
}

# Federal Reserve H.10, release of 2026-10-26, rates for 2026-10-23 (USD per unit).
_FED_2026_USD_PER_UNIT = {
    "EUR": 1.1199,
    "GBP": 1.3375,
    "AUD": 0.7037,
    "INR": 1 / 94.94,
    "CAD": 1 / 1.3993,
    "SGD": 1 / 1.2782,
    "JPY": 1 / 156.87,
    "CNY": 1 / 6.6702,
}


def rate_to_usd(currency: str, year: int | None) -> dict | None:
    """USD per unit of `currency` for `year`, as an FxUsed record; None if unknown."""
    currency = currency.upper()
    if currency == "USD" or year is None:
        return None
    if year == 2026 and currency in _FED_2026_USD_PER_UNIT:
        return {
            "rate_to_usd": _FED_2026_USD_PER_UNIT[currency],
            "rate_period": "2026-10-23",
            "source_url": FED_H10_URL,
        }
    per_usd = _IRS_UNITS_PER_USD.get(currency, {}).get(year)
    if per_usd is None:
        return None
    return {"rate_to_usd": 1 / per_usd, "rate_period": str(year), "source_url": IRS_URL}


def to_usd(
    amount: float | None, currency: str | None, year: int | None
) -> tuple[float | None, dict | None]:
    """(amount in USD, FxUsed or None). USD passes through; unknown rates give (None, None)."""
    if amount is None or currency is None:
        return None, None
    if currency.upper() == "USD":
        return amount, None
    fx = rate_to_usd(currency, year)
    if fx is None:
        return None, None
    return round(amount * fx["rate_to_usd"]), fx
