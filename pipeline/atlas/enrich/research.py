"""Merge research files (data/research/) into the store (PHASE_1 §1.2, §5).

Two passes, because investor ids are only assigned once every name is known:

1. `register` feeds every researched investor name, and every co-investor named
   in a researched round, into the resolver.
2. `apply` (after build) writes facts, funds, partners, companies and rounds.

Confidence is derived from the pages behind each fact (PHASE_1 §1.3.3): any
primary page, or press pages from two different domains -> high; one press
page -> medium; database pages only -> low.
"""

import json
from dataclasses import dataclass, field
from datetime import date
from urllib.parse import urlparse

from jsonschema import Draft202012Validator
from rapidfuzz import fuzz

from atlas import fx, ids, names
from atlas.config import RESEARCH, RESEARCH_CACHE, RESEARCH_SOURCE_ID, SCHEMAS
from atlas.geo import region_for_country
from atlas.model import Store, add_source, cite, new_company, new_round
from atlas.resolve import Group, InvestorResolver

SOURCE_ID = RESEARCH_SOURCE_ID
COMPANY_MATCH_THRESHOLD = 92
SAME_ROUND_MAX_DAYS = 92
AMOUNT_TOLERANCE = 0.10
ROLE_RANK = {"lead": 0, "participant": 1, "unspecified": 2}

SCHEMA_BY_TYPE = {
    "investor": "research_investor",
    "competitor": "research_competitor",
    "round": "research_round",
}


class ResearchFileError(Exception):
    pass


@dataclass
class Loaded:
    investors: list[dict] = field(default_factory=list)
    competitors: list[dict] = field(default_factory=list)
    rounds: list[dict] = field(default_factory=list)
    benchmarks: list[dict] = field(default_factory=list)
    legal_notes: list[dict] = field(default_factory=list)
    # Filled by register(): research key -> resolver group.
    groups: dict[str, Group] = field(default_factory=dict)
    # Round index -> list of (role, group) for each researched round, per file key.
    round_roles: dict[tuple[str, int], list[tuple[str, Group]]] = field(default_factory=dict)


def _validator(name: str) -> Draft202012Validator:
    schema = json.loads((SCHEMAS / f"{name}.schema.json").read_text(encoding="utf-8"))
    return Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)


def _check(validator: Draft202012Validator, data, label: str) -> None:
    errors = list(validator.iter_errors(data))
    if errors:
        first = errors[0]
        where = "/".join(map(str, first.absolute_path))
        raise ResearchFileError(f"{label}: {where}: {first.message} (+{len(errors) - 1} more)")


def load() -> Loaded:
    out = Loaded()
    validators = {t: _validator(n) for t, n in SCHEMA_BY_TYPE.items()}
    if RESEARCH_CACHE.exists():
        for path in sorted(RESEARCH_CACHE.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            kind = data.get("entity_type")
            if kind not in validators:
                raise ResearchFileError(f"{path.name}: unknown entity_type {kind!r}")
            _check(validators[kind], data, path.name)
            if data["key"] != path.stem:
                raise ResearchFileError(f"{path.name}: key {data['key']!r} does not match file")
            getattr(out, f"{kind}s").append(data)
    for name in ("benchmarks", "legal_notes"):
        path = RESEARCH / f"{name}.json"
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            _check(_validator(f"research_{name}"), data, path.name)
            setattr(out, name, data)
    return out


# --- pages and confidence ------------------------------------------------------------------


def _domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def page_source(page: dict) -> dict:
    return {
        "url": page["url"],
        "title": page["title"],
        "publisher": page["publisher"],
        "retrieved_at": page["retrieved_at"],
        "kind": "primary" if page["kind"] == "primary" else "secondary",
    }


def confidence_for(pages: list[dict]) -> str:
    if any(p["kind"] == "primary" for p in pages):
        return "high"
    press = {_domain(p["url"]) for p in pages if p["kind"] == "press"}
    if len(press) >= 2:
        return "high"
    return "medium" if press else "low"


RANK = {"low": 0, "medium": 1, "high": 2}


def _attach(record: dict, file_pages: list[dict], indexes: list[int]) -> list[int]:
    """Add the given pages to a record's sources; return their source indexes."""
    return [add_source(record, page_source(file_pages[i])) for i in indexes]


# --- pass 1: names into the resolver -------------------------------------------------------


def register(resolver: InvestorResolver, loaded: Loaded) -> None:
    for f in loaded.investors:
        if f["status"] in ("not_found", "not_an_investor"):
            continue
        n = names.investing_name(f["name"])  # "NVentures (NVIDIA)" -> NVentures
        group = resolver.add(n.name, "research", SOURCE_ID, n.aliases)
        aliases = f["facts"].get("aliases", {}).get("value", [])
        group.extra_aliases.update(aliases)
        loaded.groups[f["key"]] = group
    for f in [*loaded.investors, *loaded.competitors]:
        for i, r in enumerate(f["rounds"]):
            loaded.round_roles[(f["key"], i)] = _round_roles(resolver, f, r, loaded)
    for f in loaded.rounds:
        if f["round"]:
            loaded.round_roles[(f["key"], 0)] = _round_roles(resolver, f, f["round"], loaded)


def _round_roles(resolver, file: dict, r: dict, loaded: Loaded) -> list[tuple[str, Group]]:
    roles = []
    own = loaded.groups.get(file["key"]) if file["entity_type"] == "investor" else None
    # The firm's own name or any sourced alias ("1.61 Ventures" for OneSixOne).
    own_names = [file["name"], *file["facts"].get("aliases", {}).get("value", [])] if own else []
    own_keys = {names.match_key(n) for n in own_names} | {
        names.match_key(names.investing_name(n).name) for n in own_names
    }
    for role, people in (
        ("lead", r["leads"]),
        ("participant", r["participants"]),
        ("unspecified", r["unspecified"]),
    ):
        for raw in people:
            n = names.investing_name(raw)
            if own is not None and {names.match_key(raw), names.match_key(n.name)} & own_keys:
                roles.append((role, own))
            else:
                roles.append((role, resolver.add(n.name, "round_list", SOURCE_ID, n.aliases)))
    return roles


# --- pass 2: facts into records --------------------------------------------------------------

INVESTOR_FIELDS = (
    "type",
    "website",
    "linkedin",
    "hq_city",
    "hq_country",
    "stages",
    "check_min_usd",
    "check_max_usd",
    "leads",
    "thesis_text",
    "application_url",
    "accepts_cold_inbound",
    "invests_in_indian_founders",
    "requires_us_entity",
    "portfolio_count_reported",
)


def apply(store: Store, loaded: Loaded, tiers: dict[str, str]) -> dict[str, int]:
    stats = {"research files": 0, "research rounds merged": 0, "research rounds new": 0}
    companies = CompanyIndex(store)
    for f in loaded.investors:
        stats["research files"] += 1
        group = loaded.groups.get(f["key"])
        if group is None:
            continue
        inv = store.investors[group.investor_id]
        _apply_investor(store, inv, f)
        if not inv["sources"]:  # no fact recorded: the identity pages still name it
            cite(inv, "name", _attach(inv, f["pages"], list(range(len(f["pages"])))))
        inv["tier"] = f["tier"]
        for i, r in enumerate(f["rounds"]):
            merged = _apply_round(store, companies, f, r, loaded.round_roles[(f["key"], i)])
            stats["research rounds merged" if merged else "research rounds new"] += 1
    for f in loaded.rounds:
        stats["research files"] += 1
        _apply_seed_round_check(store, companies, f, loaded.round_roles.get((f["key"], 0), []))
        _log_conflicts(store, f)
    for f in loaded.competitors:
        stats["research files"] += 1
        co = companies.competitor_from(f)
        _log_conflicts(store, f)
        for i, r in enumerate(f["rounds"]):
            merged = _apply_round(store, companies, f, r, loaded.round_roles[(f["key"], i)], co)
            stats["research rounds merged" if merged else "research rounds new"] += 1
    store.benchmarks = list(loaded.benchmarks)
    store.legal_notes = list(loaded.legal_notes)
    _total_raised(store)
    stats["unsourced names dropped"] = _drop_unsourced(store)
    return stats


def _source_named_investors(store: Store, roles, pages: list[dict], indexes: list[int]) -> None:
    """An investor known only from a researched round cites that round's pages."""
    for _, group in roles:
        inv = store.investors[group.investor_id]
        if not inv["sources"]:
            cite(inv, "name", _attach(inv, pages, indexes))


def _drop_unsourced(store: Store) -> int:
    """Names registered for a round that was never applied (e.g. a seed check whose
    company isn't on the list) have nothing to cite, so they are not exported."""
    referenced = {
        i for r in store.rounds.values() for role in ROLE_RANK for i in r[f"{role}_investor_ids"]
    }
    dropped = [i for i, inv in store.investors.items() if not inv["sources"]]
    if bad := [i for i in dropped if i in referenced]:
        raise ResearchFileError(f"investors in rounds without a source: {bad}")
    for i in dropped:
        del store.investors[i]
    return len(dropped)


def _apply_investor(store: Store, inv: dict, f: dict) -> None:
    pages = f["pages"]
    facts = f["facts"]
    best = "low"
    for name in INVESTOR_FIELDS:
        fact = facts.get(name)
        if fact is None:
            continue
        value = fact["value"]
        if name in ("website", "linkedin", "application_url"):
            value = value.rstrip("/") if value.count("/") > 3 else value
        inv[name] = value
        cite(inv, name, _attach(inv, pages, fact["pages"]))
        conf = confidence_for([pages[i] for i in fact["pages"]])
        best = conf if RANK[conf] > RANK[best] else best
    if "hq_country" in facts:
        region = region_for_country(facts["hq_country"]["value"])
        if region:
            inv["region"] = region
            inv["field_sources"]["region"] = inv["field_sources"]["hq_country"]
    # A check size stated in another currency is converted at the research year's rate.
    rng = facts.get("check_range")
    if rng and "check_min_usd" not in facts and "check_max_usd" not in facts:
        year = int(f["researched_at"][:4])
        idx = _attach(inv, pages, rng["pages"])
        for bound, field in (("min", "check_min_usd"), ("max", "check_max_usd")):
            usd, _ = fx.to_usd(rng["value"][bound], rng["value"]["currency"], year)
            if usd is not None:
                inv[field] = usd
                cite(inv, field, idx)
    if (
        inv["check_min_usd"]
        and inv["check_max_usd"]
        and inv["check_min_usd"] > inv["check_max_usd"]
    ):
        inv["check_min_usd"], inv["check_max_usd"] = inv["check_max_usd"], inv["check_min_usd"]
    stated = facts.get("stated_sectors")
    if stated:
        store.stated_sectors[inv["id"]] = stated["value"]
    # Research showing pre-seed or seed checks lifts the late-stage default flag.
    if {"pre_seed", "seed"} & set(inv["stages"]):
        inv["flags"] = [x for x in inv["flags"] if x != "not_early_stage_target_by_default"]
    if f["status"] == "inactive":
        store.add_anomaly(
            SOURCE_ID,
            f["key"],
            "status",
            "inactive",
            "research found the firm inactive",
            "kept; excluded from targets",
        )
    inv["confidence"] = best if RANK[best] >= RANK[inv["confidence"]] else inv["confidence"]
    _apply_funds(store, inv, f)
    _apply_partners(store, inv, f)
    _log_conflicts(store, f)


def _log_conflicts(store: Store, f: dict) -> None:
    """Every disagreement a research file records goes to anomalies (the conflicts list)."""
    for c in f["conflicts"]:
        store.add_anomaly(
            SOURCE_ID,
            f["key"],
            c["field"],
            " | ".join(c["values"]),
            f"sources disagree: {c['reason']}",
            f"chose {c['chosen']}",
        )


def _apply_funds(store: Store, inv: dict, f: dict) -> None:
    pages = f["pages"]
    existing = [store.funds[i] for i in inv["funds"]]
    registry = ids.IdRegistry()
    for fid in store.funds:
        registry.claim(fid)
    matched: set[str] = set()
    for rf in f["funds"]:
        year = int(rf["close_date"][:4]) if rf["close_date"] else None
        usd, fx_used = fx.to_usd(rf["size_original"], rf["currency_original"], year)
        candidates = [e for e in existing if e["id"] not in matched]
        match = _match_fund(candidates, rf, year, usd)
        if match is None:
            fid = registry.claim(ids.fund_id(ids.slug_of(inv["id"]), rf["number"], year))
            match = {
                "id": fid,
                "investor_id": inv["id"],
                "name": rf["name"],
                "number": rf["number"],
                "size_usd": None,
                "currency_original": None,
                "size_original": None,
                "fx": None,
                "close_date": None,
                "close_date_precision": None,
                "vintage_year": None,
                "location": None,
                "notes": None,
                "sources": [],
                "field_sources": {},
                "confidence": "low",
            }
            store.funds[fid] = match
            inv["funds"].append(fid)
            existing.append(match)
        matched.add(match["id"])
        idx = _attach(match, pages, rf["pages"])
        if rf["number"] and match["number"] not in (None, rf["number"]):
            store.add_anomaly(
                SOURCE_ID,
                f["key"],
                "fund.number",
                f"{match['number']} vs {rf['number']}",
                f"fund list numbers {match['name']} differently",
                f"research number {rf['number']} kept",
            )
        if rf["number"]:
            match["number"] = rf["number"]
        if rf["size_original"] is not None:
            if match["size_usd"] and usd and abs(match["size_usd"] - usd) / usd > AMOUNT_TOLERANCE:
                store.add_anomaly(
                    SOURCE_ID,
                    f["key"],
                    "fund.size",
                    f"{match['size_usd']} vs {usd}",
                    f"fund list and research disagree on {rf['name']}",
                    "research value kept",
                )
            match.update(
                size_usd=usd,
                size_original=rf["size_original"],
                currency_original=rf["currency_original"],
                fx=fx_used,
            )
            cite(match, "size_usd", idx)
        if rf["close_date"]:
            match.update(
                close_date=rf["close_date"],
                close_date_precision=rf["date_precision"],
                vintage_year=year,
            )
            cite(match, "close_date", idx)
        match["confidence"] = confidence_for([pages[i] for i in rf["pages"]])

    # A fund-list row left unmatched that carries the number of a researched fund
    # is a duplicate (e.g. the same Fund V listed twice): retire it and say so.
    researched_numbers = {store.funds[i]["number"] for i in matched if store.funds[i]["number"]}
    for e in list(existing):
        if e["id"] in matched or e["number"] not in researched_numbers:
            continue
        store.add_anomaly(
            SOURCE_ID,
            f["key"],
            "fund",
            e["id"],
            f"duplicate of researched Fund {e['number']}",
            "row removed",
        )
        del store.funds[e["id"]]
        inv["funds"].remove(e["id"])


def _match_fund(existing: list[dict], rf: dict, year: int | None, usd: float | None) -> dict | None:
    same_number = [e for e in existing if rf["number"] and e["number"] == rf["number"]]
    for e in same_number:
        if year is None or e["vintage_year"] in (None, year):
            return e
    if len(same_number) == 1 and year is None:
        return same_number[0]
    # Same year and size: the same fund numbered differently by the fund list.
    for e in existing:
        if year and e["vintage_year"] == year and _amounts_close(e["size_usd"], usd):
            return e
    for e in existing:
        if year and e["vintage_year"] == year and e["number"] in (None, rf["number"]):
            return e
    if len(same_number) == 1:
        return same_number[0]
    return None


def _apply_partners(store: Store, inv: dict, f: dict) -> None:
    for p in f["partners"]:
        pid = f"ptr_{ids.slug_of(inv['id'])}_{ids.slug(p['name'])}"
        if pid in store.partners:
            continue
        pages = [f["pages"][i] for i in p["pages"]]
        store.partners[pid] = {
            "id": pid,
            "investor_id": inv["id"],
            "name": p["name"],
            "title": p["title"],
            "focus_sectors": p["focus_sectors"],
            "linkedin_url": p["linkedin_url"],
            "sources": [page_source(pg) for pg in pages],
            "confidence": confidence_for(pages),
        }
        inv["partners"].append(pid)


# --- companies and rounds ----------------------------------------------------------------------


def _norm_domain(url: str | None) -> str | None:
    return _domain(url) if url else None


class CompanyIndex:
    """Find companies by website domain first, then by fuzzy name."""

    def __init__(self, store: Store) -> None:
        self.store = store

    def _all(self):
        yield from self.store.companies.values()
        yield from self.store.competitors.values()

    def find(self, name: str, website: str | None) -> dict | None:
        domain = _norm_domain(website)
        if domain:
            for c in self._all():
                if _norm_domain(c["website"]) == domain:
                    return c
        key = names.match_key(name)
        best, best_score = None, 0.0
        for c in self._all():
            score = fuzz.token_sort_ratio(key, names.match_key(c["name"]))
            if score >= COMPANY_MATCH_THRESHOLD and score > best_score:
                # A different domain means a different company, whatever the name.
                if domain and c["website"] and _norm_domain(c["website"]) != domain:
                    continue
                best, best_score = c, score
        return best

    def get_or_create(self, rc: dict, src_pages: list[dict], page_idx: list[int]) -> dict:
        co = self.find(rc["name"], rc["website"])
        if co is None:
            registry = ids.IdRegistry()
            for cid in [*self.store.companies, *self.store.competitors]:
                registry.claim(cid)
            cid = registry.claim(ids.company_id(rc["name"]))
            co = new_company(cid, rc["name"], sources=[], confidence="low")
            self.store.companies[cid] = co
        idx = _attach(co, src_pages, page_idx)
        for name in ("website", "description", "hq_country", "founded_year", "layer"):
            target = "description_short" if name == "description" else name
            if rc.get(name) is not None and co.get(target) is None:
                co[target] = rc[name]
                cite(co, target, idx)
        if rc["sector"] and co["sector"] is None:
            co["sector"] = rc["sector"]
            co["sector_classified_by"] = rc["sector_classified_by"] or "model"
            cite(co, "sector", idx)
        conf = confidence_for([src_pages[i] for i in page_idx])
        if RANK[conf] > RANK[co["confidence"]]:
            co["confidence"] = conf
        return co

    def competitor_from(self, f: dict) -> dict:
        rc = f["company"]
        existing = self.find(rc["name"], rc["website"])
        cid = existing["id"] if existing else ids.company_id(rc["name"])
        if existing and existing["id"] in self.store.companies:
            del self.store.companies[existing["id"]]
        pages = f["pages"]
        all_idx = list(range(len(pages)))
        co = {
            "id": cid,
            "name": rc["name"],
            "website": rc["website"],
            "hq_country": rc["hq_country"],
            "founded_year": rc["founded_year"],
            "sector": rc["sector"],
            "sector_classified_by": rc["sector_classified_by"],
            "layer": f["layer"],
            "description_short": rc["description"],
            "total_raised_usd": None,
            "is_competitor": True,
            "sources": (existing or {}).get("sources", []) + [],
            "field_sources": {},
            "confidence": "low",
            "category": f["category"],
            "layer_detail": f["layer_detail"],
            "size_class": None,
            "founders": f["founders"],
            "named_customers": f["named_customers"],
            "headcount_est": None,
            "revenue_usd": None,
            "revenue_basis": "none",
            "product_summary": f["product_summary"],
            "pricing": f["pricing"],
        }
        co["field_sources"] = {}
        idx = _attach(co, pages, all_idx)
        cite(co, "website", idx[:1])
        if f["headcount_est"]:
            h = f["headcount_est"]
            co["headcount_est"] = {"value": h["value"], "source": page_source(pages[h["pages"][0]])}
        if f["revenue_reported_usd"]:
            co["revenue_usd"] = f["revenue_reported_usd"]["value"]
            co["revenue_basis"] = "reported"
            cite(co, "revenue_usd", _attach(co, pages, f["revenue_reported_usd"]["pages"]))
        co["confidence"] = confidence_for(pages)
        self.store.competitors[cid] = co
        return co


def _parse_date(d: str | None, precision: str | None) -> date | None:
    if not d:
        return None
    y = int(d[:4])
    if precision == "quarter":
        return date(y, (int(d[-1]) - 1) * 3 + 2, 15)
    if precision == "year":
        return date(y, 7, 1)
    m = int(d[5:7])
    day = int(d[8:10]) if precision == "day" else 15
    return date(y, m, day)


def _same_round(existing: dict, r: dict) -> bool:
    if existing["stage"] != r["stage"] and "undisclosed" not in (existing["stage"], r["stage"]):
        return False
    a = _parse_date(existing["date"], existing["date_precision"])
    b = _parse_date(r["date"], r["date_precision"])
    if a is None or b is None:
        return False
    coarse = "year" in (existing["date_precision"], r["date_precision"])
    if coarse:
        if a.year != b.year:
            return False
        if "undisclosed" in (existing["stage"], r["stage"]):
            # Year-only and no stage: only the amount can tie them together.
            return _amounts_close(existing["amount_usd"], r.get("_amount_usd"))
        return True
    return abs((a - b).days) <= SAME_ROUND_MAX_DAYS


def _amounts_close(x: float | None, y: float | None) -> bool:
    if not x or not y:
        return False
    return abs(x - y) / max(x, y) <= AMOUNT_TOLERANCE


def _apply_round(
    store: Store,
    companies: CompanyIndex,
    f: dict,
    r: dict,
    roles: list[tuple[str, Group]],
    company: dict | None = None,
) -> bool:
    pages = f["pages"]
    co = company or companies.get_or_create(r["company"], pages, r["pages"])
    year = int(r["date"][:4]) if r["date"] else None
    usd, fx_used = fx.to_usd(r["amount_original"], r["currency_original"], year)
    post, _ = fx.to_usd(r["valuation_post_original"], r["currency_original"], year)
    r = {**r, "_amount_usd": usd}
    match = next(
        (x for x in store.rounds.values() if x["company_id"] == co["id"] and _same_round(x, r)),
        None,
    )
    merged = match is not None
    if match is None:
        match = new_round("", co["id"], stage=r["stage"], sources=[], confidence="low")
        match.update(
            date=r["date"],
            date_precision=r["date_precision"],
            stage_raw=r["stage_raw"],
            amount_usd=usd,
            amount_original=r["amount_original"],
            currency_original=r["currency_original"],
            fx=fx_used,
            valuation_post_usd=post,
        )
        registry = ids.IdRegistry()
        for rid in store.rounds:
            registry.claim(rid)
        match["id"] = registry.claim(ids.round_id(ids.slug_of(co["id"]), r["date"], r["stage"]))
        store.rounds[match["id"]] = match
    idx = _attach(match, pages, r["pages"])
    _merge_round_fields(store, f["key"], match, r, usd, fx_used, post, idx)
    cite(match, "investors", idx)
    _merge_roles(match, roles)
    _source_named_investors(store, roles, pages, r["pages"])
    conf = confidence_for([pages[i] for i in r["pages"]])
    if RANK[conf] > RANK[match["confidence"]]:
        match["confidence"] = conf
    return merged


def _merge_round_fields(store, key, match, r, usd, fx_used, post, idx) -> None:
    precise = {"day": 3, "month": 2, "quarter": 1, "year": 0}
    if match["stage"] == "undisclosed" and r["stage"] != "undisclosed":
        match["stage"] = r["stage"]
        match["stage_raw"] = r["stage_raw"] or match["stage_raw"]
    if r["date"] and precise.get(r["date_precision"], -1) > precise.get(
        match["date_precision"], -1
    ):
        match["date"], match["date_precision"] = r["date"], r["date_precision"]
        cite(match, "date", idx)
    if usd is not None:
        if match["amount_usd"] is not None and not _amounts_close(match["amount_usd"], usd):
            match["contested"] = True
            note = f"amounts differ: {match['amount_usd']:.0f} vs {usd:.0f} USD"
            match["notes"] = "; ".join(filter(None, [match["notes"], note]))
            store.add_anomaly(
                SOURCE_ID,
                key,
                "round.amount",
                note,
                f"sources disagree on {match['id']}",
                "kept first; marked contested",
            )
        elif match["amount_usd"] is None or match["confidence"] == "low":
            match.update(
                amount_usd=usd,
                amount_original=r["amount_original"],
                currency_original=r["currency_original"],
                fx=fx_used,
            )
        cite(match, "amount_usd", idx)
    if post is not None and match["valuation_post_usd"] is None:
        match["valuation_post_usd"] = post
        cite(match, "valuation_post_usd", idx)


def _merge_roles(match: dict, roles: list[tuple[str, Group]]) -> None:
    current = {}
    for role in ROLE_RANK:
        for inv_id in match[f"{role}_investor_ids"]:
            current[inv_id] = role
    for role, group in roles:
        prev = current.get(group.investor_id)
        if prev is None or ROLE_RANK[role] < ROLE_RANK[prev]:
            current[group.investor_id] = role
    for role in ROLE_RANK:
        match[f"{role}_investor_ids"] = sorted(i for i, r in current.items() if r == role)


def _apply_seed_round_check(store: Store, companies: CompanyIndex, f: dict, roles) -> None:
    target = names.match_key(f["seed_company"])
    seed = next(
        (
            r
            for r in store.rounds.values()
            if names.match_key(_company_name(store, r["company_id"])) == target
        ),
        None,
    )
    if seed is None:
        return
    if f["verdict"] == "not_found":
        seed["notes"] = "; ".join(
            filter(None, [seed["notes"], "no public source found in Phase 1"])
        )
        return
    if f["verdict"] == "contested":
        seed["contested"] = True
    r = f["round"]
    if r is None:
        return
    pages = f["pages"]
    co = store.companies.get(seed["company_id"]) or store.competitors.get(seed["company_id"])
    idx = _attach(co, pages, r["pages"])
    for name in ("website", "hq_country", "founded_year"):
        if r["company"].get(name) is not None and co.get(name) is None:
            co[name] = r["company"][name]
            cite(co, name, idx)
    year = int(r["date"][:4]) if r["date"] else None
    usd, fx_used = fx.to_usd(r["amount_original"], r["currency_original"], year)
    post, _ = fx.to_usd(r["valuation_post_original"], r["currency_original"], year)
    idx = _attach(seed, pages, r["pages"])
    seed.update(
        stage=r["stage"],
        stage_raw=r["stage_raw"],
        date=r["date"],
        date_precision=r["date_precision"],
    )
    cite(seed, "date", idx)
    if usd is not None:
        seed.update(
            amount_usd=usd,
            amount_original=r["amount_original"],
            currency_original=r["currency_original"],
            fx=fx_used,
        )
        cite(seed, "amount_usd", idx)
    if post is not None:
        seed["valuation_post_usd"] = post
    # Researched roles replace the list's roles, which were often unstated.
    for role in ROLE_RANK:
        seed[f"{role}_investor_ids"] = []
    _merge_roles(seed, roles)
    _source_named_investors(store, roles, pages, r["pages"])
    cite(seed, "investors", idx)
    seed["confidence"] = confidence_for([pages[i] for i in r["pages"]])


def _company_name(store: Store, cid: str) -> str:
    co = store.companies.get(cid) or store.competitors.get(cid)
    return co["name"] if co else ""


def _total_raised(store: Store) -> None:
    """Competitors: total raised = sum of their sourced rounds with amounts."""
    for co in store.competitors.values():
        rounds = [r for r in store.rounds.values() if r["company_id"] == co["id"]]
        amounts = [r["amount_usd"] for r in rounds if r["amount_usd"] is not None]
        if amounts:
            co["total_raised_usd"] = sum(amounts)
            co["size_class"] = _size_class(co["total_raised_usd"])


def _size_class(total: float) -> str:
    if total < 5e6:
        return "under_5m"
    if total < 25e6:
        return "from_5m_to_25m"
    if total < 100e6:
        return "from_25m_to_100m"
    if total < 1e9:
        return "from_100m_to_1b"
    return "over_1b"
