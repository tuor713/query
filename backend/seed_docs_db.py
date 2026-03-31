#!/usr/bin/env python3
"""
Seed docs.db from the docs/ folder.

Usage:
    python seed_docs_db.py [--docs-dir docs] [--db docs.db] [--search-yml docs/search.yml]

The script reads every file in --docs-dir, uses title and summaries from search.yml when
available, and upserts rows into the `document` table (path, title, summary, content).
"""

import argparse
import os

import duckdb
import yaml


def load_metadata(search_yml_path: str) -> dict[str, dict]:
    """Return {filename: {title, summary}} from search.yml, or empty dict if file missing."""
    if not os.path.isfile(search_yml_path):
        return {}
    with open(search_yml_path) as f:
        data = yaml.safe_load(f)
    metadata = {}
    for entry in data.get("results", []):
        doc_id = entry.get("id", "")
        if doc_id:
            metadata[doc_id] = {
                "title": entry.get("title", ""),
                "summary": entry.get("summary", ""),
            }
    return metadata


def seed(docs_dir: str, db_path: str, search_yml_path: str) -> None:
    metadata = load_metadata(search_yml_path)

    conn = duckdb.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS document (
            path    VARCHAR PRIMARY KEY,
            title   VARCHAR,
            summary VARCHAR,
            content VARCHAR
        )
    """)

    inserted = 0
    updated = 0

    search_yml_filename = os.path.basename(search_yml_path)

    for filename in sorted(os.listdir(docs_dir)):
        if filename == search_yml_filename:
            continue
        filepath = os.path.join(docs_dir, filename)
        if not os.path.isfile(filepath):
            continue

        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        meta = metadata.get(filename, {})
        title = meta.get("title", filename)
        summary = meta.get("summary", "")

        existing = conn.execute(
            "SELECT path FROM document WHERE path = ?", [filename]
        ).fetchone()

        if existing:
            conn.execute(
                "UPDATE document SET title = ?, summary = ?, content = ? WHERE path = ?",
                [title, summary, content, filename],
            )
            updated += 1
        else:
            conn.execute(
                "INSERT INTO document (path, title, summary, content) VALUES (?, ?, ?, ?)",
                [filename, title, summary, content],
            )
            inserted += 1

        print(f"  {'updated' if existing else 'inserted'}: {filename}")

    conn.close()
    print(f"\nDone. {inserted} inserted, {updated} updated → {db_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed docs.db from docs/ folder")
    parser.add_argument("--docs-dir", default="docs", help="Path to docs directory")
    parser.add_argument("--db", default="docs.db", help="Path to DuckDB database file")
    parser.add_argument(
        "--search-yml",
        default="docs/search.yml",
        help="Path to search.yml for summaries",
    )
    args = parser.parse_args()

    seed(args.docs_dir, args.db, args.search_yml)
