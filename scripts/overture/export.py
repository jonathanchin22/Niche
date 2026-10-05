#!/usr/bin/env python3
"""Export coffee and bubble tea places in an area from Overture Maps.

Overture (https://overturemaps.org) publishes open place data built from Meta,
Microsoft, Foursquare and other sources. It lists far more cafés than
OpenStreetMap does, so a region can be bulk-imported from it; the app keeps
seeding everywhere else from OSM on demand.

    pip install duckdb
    python3 scripts/overture/export.py --release 2026-09-23.1 \
      --bbox=-118.13,33.38,-117.41,33.95 \
      --postcodes '^(92[67]\\d\\d|928(?!60|7[7-9]|8[0-3])\\d\\d|9062[0-4]|9063[0-3]|90680|9072[01]|9074[0-3])' \
      --out overture-oc.json

`--postcodes` (a regex) trims a bounding box to one county; places without a
postcode are dropped when it's given. Next: scripts/overture/prepare.mjs.
"""
import argparse
import json
import re

import duckdb

CATEGORIES = ["coffee_shop", "cafe", "coffee_roastery", "espresso_bar", "bubble_tea_shop", "tea_room"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--release", required=True, help="an Overture release, e.g. 2026-09-23.1")
    ap.add_argument("--bbox", required=True, help="minLng,minLat,maxLng,maxLat")
    ap.add_argument("--postcodes", help="regex a place's postcode must match")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    xmin, ymin, xmax, ymax = (float(v) for v in args.bbox.split(","))

    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    # The bucket is public: sign nothing.
    con.execute("CREATE OR REPLACE SECRET overture (TYPE S3, KEY_ID '', SECRET '', REGION 'us-west-2');")
    rows = con.execute(
        f"""
        SELECT id, names.primary AS name, taxonomy.primary AS category, taxonomy.alternates AS alternates,
               confidence, operating_status, bbox.xmin AS lng, bbox.ymin AS lat,
               addresses[1].freeform AS address, addresses[1].locality AS city,
               addresses[1].region AS state, addresses[1].postcode AS postcode,
               brand.names.primary AS brand, websites[1] AS website
        FROM read_parquet('s3://overturemaps-us-west-2/release/{args.release}/theme=places/type=place/*', hive_partitioning=1)
        WHERE bbox.xmin BETWEEN ? AND ? AND bbox.ymin BETWEEN ? AND ?
          AND (taxonomy.primary IN ({",".join("?" * len(CATEGORIES))})
               OR list_has_any(taxonomy.alternates, ['coffee_shop', 'cafe', 'coffee_roastery', 'bubble_tea_shop']))
        """,
        [xmin, xmax, ymin, ymax, *CATEGORIES],
    ).fetchall()
    cols = [d[0] for d in con.description]
    places = [dict(zip(cols, r)) for r in rows]

    if args.postcodes:
        keep = re.compile(args.postcodes)
        places = [p for p in places if p["postcode"] and keep.search(p["postcode"])]

    with open(args.out, "w") as f:
        json.dump(places, f, default=str)
    print(f"{len(places)} places → {args.out}")


if __name__ == "__main__":
    main()
