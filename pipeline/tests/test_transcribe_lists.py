"""The 2026-11-12 investor lists: transcription from data/raw/sources into data/seed."""

import csv

import pytest

from atlas.config import SEED_DIR
from atlas.ingest import transcribe_lists as t


@pytest.mark.parametrize(
    "raw, kept",
    [
        ("Dave Eisenberg, dave@ziggcap.com", "Dave Eisenberg"),
        ("joshua@acronymvc.com", ""),
        (
            "www.645ventures.com (contact info on the website)",
            "www.645ventures.com (contact info on the website)",
        ),
        ("Co-Founder @ CEO at Kindred", "Co-Founder @ CEO at Kindred"),
    ],
)
def test_drop_emails(raw, kept):
    assert t.drop_emails(raw) == kept


@pytest.mark.parametrize(
    "raw, url",
    [
        ("www.645ventures.com (contact info on the website)", "https://www.645ventures.com"),
        ("afterwork.vc", "https://afterwork.vc"),
        ("https://one-ventures.com.au/", "https://one-ventures.com.au/"),
        ("joshua@acronymvc.com", ""),  # an email's domain is not the firm's site
        ("Dylan West", ""),
    ],
)
def test_url_in(raw, url):
    assert t.url_in(raw) == url


@pytest.mark.parametrize(
    "raw, kept",
    [
        ("Boston, Massachusetts, Uni…", "Boston, Massachusetts"),
        ("San Fra…", ""),
        ("Sydney", "Sydney"),
    ],
)
def test_whole_parts_of_a_cut_off_location(raw, kept):
    assert t.whole_parts(raw) == kept


def test_bare_linkedin():
    url = "https://www.linkedin.com/company/eleven-two-capital?trk=prof-exp-company-name"
    assert t.bare_linkedin(url) == "https://www.linkedin.com/company/eleven-two-capital"
    assert t.bare_linkedin("https://112capital.com") == ""
    assert t.bare_linkedin("linkedin.com/company/15199936") == (
        "https://linkedin.com/company/15199936"
    )


@pytest.mark.parametrize(
    "text, tags",
    [
        ("SaaS, Security, Media/Content, Female Founders", [t.FEMALE_TAG]),
        ("Minority Founders, E-Commerce, Gaming/Sports", [t.MINORITY_TAG]),
        ("women-led teams; Black founders", [t.FEMALE_TAG, t.MINORITY_TAG]),
        ("Women's health, FemTech", []),  # a sector, not a founder focus
        ("Diverse portfolio of SaaS", []),
    ],
)
def test_founder_tags_need_the_lists_own_words(text, tags):
    assert t.founder_tags(text) == tags


def test_renames_keep_the_listed_name():
    row = t.finish(t.ListedRow(name="Equation Angels | Southwestern …", note="x"))
    assert (row.name, row.name_as_listed) == ("Equation Angels", "Equation Angels | Southwestern …")
    assert row.note == "name cut off in the PDF print; x"


def test_seed_files_have_the_shared_layout_and_no_emails():
    for out_name in t.LISTS:
        with (SEED_DIR / out_name).open(encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh)
            assert reader.fieldnames == t.COLUMNS
            for row in reader:
                for value in row.values():
                    assert not t.EMAIL.search(value), (out_name, row["name"])
                # Links must pass the schema's URL check.
                for link in (row["website"], row["linkedin"]):
                    assert not link or link.startswith(("https://", "http://")), (out_name, link)


def test_transcription_matches_the_committed_seed_files(tmp_path):
    """The seed files are what the script writes from the originals: no hand edits."""
    t.main(seed=tmp_path)
    for out_name in t.LISTS:
        made = (tmp_path / out_name).read_text(encoding="utf-8")
        assert made == (SEED_DIR / out_name).read_text(encoding="utf-8"), out_name
