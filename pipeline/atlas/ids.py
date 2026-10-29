"""Stable record ids.

inv_<slug>                          investor
fund_<inv-slug>_<number or year>    fund (number lower-case Roman: fund_root-ventures_iv)
co_<slug>                           company
rnd_<co-slug>_<yyyy-mm or yyyy>_<stage>
"""

from slugify import slugify


def slug(text: str) -> str:
    s = slugify(text, lowercase=True)
    if not s:
        raise ValueError(f"cannot slugify {text!r}")
    return s


def investor_id(name: str) -> str:
    return f"inv_{slug(name)}"


def fund_id(investor_slug: str, number: str | None, year: int | None) -> str:
    tail = number.lower() if number else (str(year) if year else "undated")
    return f"fund_{investor_slug}_{tail}"


def company_id(name: str) -> str:
    return f"co_{slug(name)}"


def round_id(company_slug: str, date: str | None, stage: str) -> str:
    when = date[:7] if date else "undated"
    return f"rnd_{company_slug}_{when}_{stage}"


def slug_of(record_id: str) -> str:
    """The slug part of inv_/co_ ids."""
    return record_id.split("_", 1)[1]


class IdRegistry:
    """Hands out ids, suffixing -2, -3 … when two records would collide."""

    def __init__(self) -> None:
        self._taken: set[str] = set()

    def claim(self, base: str) -> str:
        candidate, n = base, 2
        while candidate in self._taken:
            candidate, n = f"{base}-{n}", n + 1
        self._taken.add(candidate)
        return candidate
