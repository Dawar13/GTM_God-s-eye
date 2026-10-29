"""Turn resolved investor groups and parsed source rows into schema records."""

from collections import Counter, defaultdict

from atlas import ids, names
from atlas.geo import region_for_location
from atlas.ingest.goldman_pdf import SOURCE_ID as GOLDMAN_ID
from atlas.ingest.goldman_pdf import GoldmanFund
from atlas.model import Store, add_source, new_investor, user_source
from atlas.resolve import Group, InvestorResolver


def assign_investor_ids(resolver: InvestorResolver) -> None:
    registry = ids.IdRegistry()
    for group in resolver.groups:
        group.display_name = group.choose_display_name()
        group.investor_id = registry.claim(ids.investor_id(group.display_name))


def investor_from_group(group: Group, regions: set[str]) -> dict:
    origins = {m.origin for m in group.members}
    sources = []
    if "fund_list" in origins:
        sources.append(user_source(GOLDMAN_ID))
    for sid in group.source_ids:
        if sid != GOLDMAN_ID:
            sources.append(user_source(sid))
    inv = new_investor(
        group.investor_id,
        group.display_name,
        sources=sources,
        confidence="medium" if "fund_list" in origins else "low",
        region=regions.pop() if len(regions) == 1 else None,
    )
    inv["aliases"] = sorted(
        ({m.name for m in group.members} | group.extra_aliases) - {group.display_name}
    )
    inv["parent_brand"] = names.parent_brand(group.display_name)
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
        "confidence": fund.confidence,
    }


def build(
    store: Store, resolver: InvestorResolver, goldman: list[tuple[GoldmanFund, Group]]
) -> None:
    assign_investor_ids(resolver)

    # Region comes from fund locations; an investor whose funds disagree gets none.
    regions: dict[int, set[str]] = defaultdict(set)
    for fund, group in goldman:
        region = region_for_location(fund.location)
        if region:
            regions[id(group)].add(region)

    for group in resolver.groups:
        store.investors[group.investor_id] = investor_from_group(group, set(regions[id(group)]))

    fund_ids = ids.IdRegistry()
    for fund, group in goldman:
        inv_id = group.investor_id
        fid = fund_ids.claim(ids.fund_id(ids.slug_of(inv_id), fund.fund_number, fund.year))
        store.funds[fid] = fund_record(fund, inv_id, fid)
        store.investors[inv_id]["funds"].append(fid)
        for a in fund.anomalies:
            store.add_anomaly(GOLDMAN_ID, a.row_ref, a.field, a.raw_value, a.reason, a.resolution)

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


def investor_add_sources(investor: dict, source_ids: list[str]) -> None:
    for sid in source_ids:
        add_source(investor, user_source(sid))


def region_counts(store: Store) -> Counter:
    return Counter(inv["region"] or "unknown" for inv in store.investors.values())
