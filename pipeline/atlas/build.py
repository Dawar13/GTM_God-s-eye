"""Turn resolved investor groups and parsed source rows into schema records."""

from collections import Counter, defaultdict
from dataclasses import dataclass

from atlas import ids, names
from atlas.config import RESEARCH_SOURCE_ID
from atlas.geo import region_for_location
from atlas.ingest.goldman_pdf import SOURCE_ID as GOLDMAN_ID
from atlas.ingest.goldman_pdf import GoldmanFund
from atlas.ingest.seeds import LIST_RETRIEVED, LIST_SECTOR, LISTED, SeedRound
from atlas.model import (
    Store,
    add_source,
    cite,
    new_company,
    new_investor,
    new_round,
    user_source,
)
from atlas.resolve import Group, InvestorResolver

ROLE_RANK = {"lead": 0, "participant": 1, "unspecified": 2}
STAGE_RANK = {"undisclosed": 1}  # any named stage beats "undisclosed"


@dataclass
class RoundInput:
    round: SeedRound
    roles: list[tuple[str, Group]]  # (lead | participant | unspecified, investor group)


# Large lists that join firms already known: they never rename them (see
# Group.choose_display_name).
NAMED_LAST = frozenset(spec.source_id for spec in LISTED)


def assign_investor_ids(resolver: InvestorResolver) -> None:
    registry = ids.IdRegistry()
    for group in resolver.groups:
        group.display_name = group.choose_display_name(NAMED_LAST)
        group.investor_id = registry.claim(ids.investor_id(group.display_name))


def investor_from_group(group: Group, fund_regions: set[str]) -> dict:
    origins = {m.origin for m in group.members}
    sources = [user_source(GOLDMAN_ID)] if "fund_list" in origins else []
    for sid in group.source_ids:
        # Research names are not a user list: they cite their pages when research is applied.
        if sid not in (GOLDMAN_ID, RESEARCH_SOURCE_ID):
            sources.append(user_source(sid, retrieved_at=LIST_RETRIEVED.get(sid)))

    # A regional arm's own name is a location: "Accel (India)" -> india.
    arm_region = region_for_location(", ".join(names.region_words(group.display_name)))
    regions = fund_regions | group.region_hints | ({arm_region} if arm_region else set())
    # A list's street address only fills a gap; it never overrules or blanks another source.
    # A city on a large list fills only what is still empty after that.
    regions = regions or set(group.address_regions) or set(group.listed_regions)
    inv = new_investor(
        group.investor_id,
        group.display_name,
        sources=sources,
        confidence="medium" if "fund_list" in origins else "low",
        region=regions.pop() if len(regions) == 1 else None,
        type=group.type_guess,
    )
    inv["aliases"] = sorted(
        ({m.name for m in group.members} | group.extra_aliases) - {group.display_name}
    )
    inv["parent_brand"] = names.parent_brand(group.display_name)

    seed_ids = sorted({m.source_id for m in group.members if m.origin == "seed_list"})
    inv["seed_list_count"] = len(seed_ids)
    inv["seed_source_ids"] = seed_ids
    inv["seed_hints"] = group.seed_hints
    if group.user_tags:
        inv["user_tags"] = sorted(set(group.user_tags))
    # Frontier-lab backers are late-stage by default, unless the fund list shows
    # them running a fund of $200M or less.
    if group.on_frontier_list and "fund_list" not in origins:
        inv["flags"] = ["not_early_stage_target_by_default"]
    return inv


def fund_record(fund: GoldmanFund, investor_id: str, fund_id: str) -> dict:
    return {
        "id": fund_id,
        "investor_id": investor_id,
        "name": fund.fund_name,
        "number": fund.fund_number,
        "size_usd": fund.size_usd,
        "currency_original": "USD" if fund.size_usd is not None else None,
        "size_original": fund.size_usd,
        "fx": None,
        "close_date": fund.date_iso,
        "close_date_precision": fund.date_precision,
        "vintage_year": fund.year,
        "location": fund.location,
        "notes": fund.notes,
        "sources": [
            {
                **user_source(GOLDMAN_ID, fund.link),
                "title": f"{GOLDMAN_ID} row {fund.row_ref}",
            }
        ],
        "field_sources": {},
        "confidence": fund.confidence,
    }


def apply_listed_fields(store: Store, resolver: InvestorResolver) -> Counter:
    """A list's web address for a firm fills `website` / `linkedin`, and a list's stated
    investor type fills `type`, only where research left the field empty; the field
    cites that list. Returns how many links and types were filled."""
    filled: Counter = Counter()
    for group in resolver.groups:
        inv = store.investors.get(group.investor_id or "")
        if inv is None:
            continue
        listed = dict(group.listed_links)
        if group.listed_type:
            listed["type"] = group.listed_type
        for field_name, (value, source_id) in listed.items():
            if inv[field_name] is not None:
                continue
            src = user_source(source_id, retrieved_at=LIST_RETRIEVED.get(source_id))
            if field_name == "type":
                inv["type"] = value
                filled["types filled from a list"] += 1
            else:
                inv[field_name] = value.rstrip("/") if value.count("/") > 3 else value
                filled["links filled from a list"] += 1
            cite(inv, field_name, [add_source(inv, src)])
    return filled


def build_investors_and_funds(
    store: Store, resolver: InvestorResolver, goldman: list[tuple[GoldmanFund, Group]]
) -> None:
    # Region comes from fund locations; an investor whose funds disagree gets none.
    fund_regions: dict[int, set[str]] = defaultdict(set)
    for fund, group in goldman:
        region = region_for_location(fund.location)
        if region:
            fund_regions[id(group)].add(region)

    for group in resolver.groups:
        store.investors[group.investor_id] = investor_from_group(
            group, set(fund_regions[id(group)])
        )

    fund_ids = ids.IdRegistry()
    for fund, group in goldman:
        inv_id = group.investor_id
        fid = fund_ids.claim(ids.fund_id(ids.slug_of(inv_id), fund.fund_number, fund.year))
        store.funds[fid] = fund_record(fund, inv_id, fid)
        store.investors[inv_id]["funds"].append(fid)
        for a in fund.anomalies:
            store.add_anomaly(GOLDMAN_ID, a.row_ref, a.field, a.raw_value, a.reason, a.resolution)


def build_companies_and_rounds(store: Store, rounds: list[RoundInput]) -> int:
    """Companies and rounds from the seed round lists. Returns how many listings
    were merged into a round already seen (same company, year and amount)."""
    by_key: dict[tuple, dict] = {}
    roles_by_round: dict[str, dict[str, str]] = {}
    duplicates = 0

    for item in rounds:
        r = item.round
        co_id = ids.company_id(r.company)
        src = user_source(r.source_id)
        company = store.companies.get(co_id)
        if company is None:
            company = new_company(
                co_id,
                r.company,
                sources=[src],
                confidence="low",
                sector=LIST_SECTOR.get(r.source_id),
                sector_classified_by="source",
                description_short=r.description,
            )
            store.companies[co_id] = company
        else:
            add_source(company, src)
            if company["sector"] is None and LIST_SECTOR.get(r.source_id):
                company["sector"] = LIST_SECTOR[r.source_id]
                company["sector_classified_by"] = "source"
            company["description_short"] = company["description_short"] or r.description

        key = (co_id, "2026", r.amount_usd)
        record = by_key.get(key)
        if record is None:
            record = new_round("", co_id, stage=r.stage, sources=[src], confidence="low")
            record.update(
                date="2026",
                date_precision="year",
                stage_raw=r.stage_raw,
                amount_usd=r.amount_usd,
                amount_original=r.amount_usd,
                currency_original="USD" if r.amount_usd is not None else None,
            )
            by_key[key] = record
            roles_by_round[id(record)] = {}
            notes: list[str] = []
        else:
            duplicates += 1
            add_source(record, src)
            if STAGE_RANK.get(record["stage"], 0) > STAGE_RANK.get(r.stage, 0):
                record["stage"] = r.stage
            record["stage_raw"] = f"{record['stage_raw']} | {r.stage_raw}"
            notes = (record["notes"] or "").split("; ") if record["notes"] else []
            notes.append(f"also listed in {r.source_id}")
        notes.extend(n for n in r.notes if n not in notes)
        record["notes"] = "; ".join(notes) or None

        # An investor named as lead anywhere is a lead.
        roles = roles_by_round[id(record)]
        for role, group in item.roles:
            current = roles.get(group.investor_id)
            if current is None or ROLE_RANK[role] < ROLE_RANK[current]:
                roles[group.investor_id] = role

    round_ids = ids.IdRegistry()
    for record in by_key.values():
        roles = roles_by_round[id(record)]
        for inv_id, role in roles.items():
            record[f"{role}_investor_ids"].append(inv_id)
        for role in ROLE_RANK:
            record[f"{role}_investor_ids"].sort()
        co_slug = ids.slug_of(record["company_id"])
        record["id"] = round_ids.claim(ids.round_id(co_slug, record["date"], record["stage"]))
        store.rounds[record["id"]] = record
    return duplicates


def log_merges(store: Store, resolver: InvestorResolver) -> None:
    for group, member in resolver.merges():
        display_member = next(m for m in group.members if m.name == group.display_name)
        store.add_merge(
            group.investor_id,
            group.display_name,
            member.name,
            member.method or display_member.method or "normalised_name",
            member.score if member.method else display_member.score,
            sorted({m.source_id for m in group.members if m.name == member.name}),
        )


def build(
    store: Store,
    resolver: InvestorResolver,
    goldman: list[tuple[GoldmanFund, Group]],
    rounds: list[RoundInput],
) -> int:
    assign_investor_ids(resolver)
    build_investors_and_funds(store, resolver, goldman)
    duplicates = build_companies_and_rounds(store, rounds)
    log_merges(store, resolver)
    return duplicates


def region_counts(store: Store) -> Counter:
    return Counter(inv["region"] or "unknown" for inv in store.investors.values())
