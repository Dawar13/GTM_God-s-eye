"""Record builders. Field order follows the Zod schemas so processed JSON reads
the same as docs/DATA_DICTIONARY.md."""

from dataclasses import dataclass, field

from atlas.config import USER_SOURCES_RECEIVED


def source(
    url: str,
    kind: str,
    title: str | None = None,
    publisher: str | None = None,
    retrieved_at: str = USER_SOURCES_RECEIVED,
) -> dict:
    return {
        "url": url,
        "title": title,
        "publisher": publisher,
        "retrieved_at": retrieved_at,
        "kind": kind,
    }


def user_source(source_id: str, link: str | None = None) -> dict:
    """A user-supplied list. With a link, the link is the URL; without, a pseudo-URL."""
    return source(link or f"user_supplied:{source_id}", "user_supplied", title=source_id)


def empty_category() -> dict:
    return {
        "freshness": None,
        "maturity": None,
        "is_early_stage": None,
        "is_generalist": None,
        "cluster_id": None,
        "industrial_affinity": None,
        "stage_earliness": None,
        "fit": None,
    }


def new_investor(
    id: str,
    name: str,
    *,
    sources: list[dict],
    confidence: str,
    region: str | None = None,
    type: str | None = None,
) -> dict:
    return {
        "id": id,
        "name": name,
        "aliases": [],
        "parent_brand": None,
        "type": type,
        "region": region,
        "hq_country": None,
        "hq_city": None,
        "stages": [],
        "check_min_usd": None,
        "check_max_usd": None,
        "leads": None,
        "thesis_text": None,
        "sector_weights": None,
        "website": None,
        "linkedin": None,
        "funds": [],
        "sources": sources,
        "confidence": confidence,
        "category": empty_category(),
        "seed_list_count": 0,
        "seed_source_ids": [],
        "seed_hints": [],
        "flags": [],
    }


def new_company(
    id: str,
    name: str,
    *,
    sources: list[dict],
    confidence: str,
    sector: str | None = None,
    description_short: str | None = None,
) -> dict:
    return {
        "id": id,
        "name": name,
        "hq_country": None,
        "founded_year": None,
        "sector": sector,
        "description_short": description_short,
        "total_raised_usd": None,
        "is_competitor": False,
        "sources": sources,
        "confidence": confidence,
    }


def add_source(record: dict, src: dict) -> None:
    """Append a source unless the same URL is already there."""
    if all(s["url"] != src["url"] for s in record["sources"]):
        record["sources"].append(src)


@dataclass
class Store:
    """Everything the pipeline will export, keyed by record id."""

    investors: dict[str, dict] = field(default_factory=dict)
    funds: dict[str, dict] = field(default_factory=dict)
    companies: dict[str, dict] = field(default_factory=dict)
    competitors: dict[str, dict] = field(default_factory=dict)
    rounds: dict[str, dict] = field(default_factory=dict)
    anomalies: list[dict] = field(default_factory=list)
    merges: list[dict] = field(default_factory=list)

    def add_anomaly(
        self,
        source_id: str,
        row_ref: str,
        field_name: str,
        raw_value: str | None,
        reason: str,
        resolution: str | None,
    ) -> None:
        self.anomalies.append(
            {
                "id": f"anom_{source_id}_{len(self.anomalies) + 1:04d}",
                "source_id": source_id,
                "row_ref": row_ref,
                "field": field_name,
                "raw_value": raw_value,
                "reason": reason,
                "resolution": resolution,
            }
        )

    def add_merge(
        self,
        investor_id: str,
        kept_name: str,
        merged_name: str,
        method: str,
        score: float | None,
        source_ids: list[str],
    ) -> None:
        self.merges.append(
            {
                "id": f"merge_{len(self.merges) + 1:04d}",
                "investor_id": investor_id,
                "kept_name": kept_name,
                "merged_name": merged_name,
                "method": method,
                "score": None if score is None else round(score, 1),
                "source_ids": source_ids,
            }
        )
