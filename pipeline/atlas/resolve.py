"""Investor entity resolution across sources.

Names from every source are fed in first; ids and records are built at the end
from each group's chosen display name, so ids don't depend on which source
happened to be read first.
"""

from dataclasses import dataclass, field

from rapidfuzz import fuzz, process

from atlas import names
from atlas.config import DO_NOT_MERGE, NAME_MATCH_THRESHOLD

# Known short forms. Keys and values are matching keys (see names.match_key).
ALIASES = {
    "a16z": "andreessen horowitz",
    "usv": "union square",
}

# Priority of where a name came from when picking the display name.
ORIGIN_RANK = {"seed_list": 0, "fund_list": 1, "round_list": 2}


@dataclass
class Member:
    name: str
    origin: str  # seed_list | fund_list | round_list
    source_id: str
    method: str | None  # how it joined the group; None for the founding name
    score: float | None


@dataclass
class Group:
    key: str
    members: list[Member] = field(default_factory=list)
    extra_aliases: set[str] = field(default_factory=set)
    investor_id: str | None = None
    display_name: str | None = None

    def choose_display_name(self) -> str:
        """Seed lists name firms, so they win. Otherwise the earliest-read name
        (the Goldman list runs newest first) without typos or vehicle words."""
        order = {id(m): i for i, m in enumerate(self.members)}

        def rank(m: Member) -> tuple:
            return (
                ORIGIN_RANK[m.origin],
                1 if names.typo_tokens(m.name) else 0,
                1 if names.has_vehicle_words(m.name) else 0,
                order[id(m)],
            )

        return min(self.members, key=rank).name

    def blocks(self, name: str) -> bool:
        """True if a member and `name` are listed as different firms."""
        lowered = name.lower()
        return any(frozenset({m.name.lower(), lowered}) in DO_NOT_MERGE for m in self.members)

    @property
    def source_ids(self) -> list[str]:
        return sorted({m.source_id for m in self.members})


class InvestorResolver:
    def __init__(self, threshold: int = NAME_MATCH_THRESHOLD) -> None:
        self.threshold = threshold
        self.groups: list[Group] = []
        self._by_key: dict[str, list[Group]] = {}

    def _first_open(self, key: str, name: str) -> Group | None:
        return next((g for g in self._by_key.get(key, []) if not g.blocks(name)), None)

    def _find(self, key: str, name: str) -> tuple[Group | None, str | None, float | None]:
        aliased = ALIASES.get(key)
        if aliased and (group := self._first_open(aliased, name)):
            return group, "alias", None
        if group := self._first_open(key, name):
            return group, "normalised_name", None
        for other_key in self._by_key:
            if ALIASES.get(other_key) == key and (group := self._first_open(other_key, name)):
                return group, "alias", None
        candidates = [k for k in self._by_key if k != key]
        for other_key, score, _ in process.extract(
            key, candidates, scorer=fuzz.token_sort_ratio, score_cutoff=self.threshold, limit=5
        ):
            if group := self._first_open(other_key, name):
                return group, "fuzzy", float(score)
        return None, None, None

    def add(self, name: str, origin: str, source_id: str, aliases: tuple[str, ...] = ()) -> Group:
        key = names.match_key(name)
        group, method, score = self._find(key, name)
        if group is None:
            group = Group(key=key)
            self.groups.append(group)
        group.members.append(Member(name, origin, source_id, method, score))
        group.extra_aliases.update(aliases)
        if group not in self._by_key.setdefault(key, []):
            self._by_key[key].append(group)
        return group

    def merges(self) -> list[tuple[Group, Member]]:
        """Members whose written name differs from the group's display name."""
        out = []
        for group in self.groups:
            seen = {group.display_name}
            for m in group.members:
                if m.name in seen:
                    continue
                seen.add(m.name)
                out.append((group, m))
        return out
