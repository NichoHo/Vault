"""Postgres pool + a tiny migration runner mirroring internal/pg (Go)."""

import os
from pathlib import Path

from psycopg_pool import ConnectionPool

DATABASE_URL = os.environ.get("DATABASE_URL", "postgres://vault:vault@localhost:5432/vault")

pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=5, open=False)

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def migrate() -> None:
    with pool.connection() as conn:
        conn.execute("CREATE SCHEMA IF NOT EXISTS assist")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS assist.schema_migrations
               (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"""
        )
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            done = conn.execute(
                "SELECT 1 FROM assist.schema_migrations WHERE name = %s", (path.name,)
            ).fetchone()
            if done:
                continue
            with conn.transaction():
                conn.execute("SET LOCAL search_path TO assist")
                conn.execute(path.read_text())
                conn.execute(
                    "INSERT INTO assist.schema_migrations (name) VALUES (%s)", (path.name,)
                )
        _seed_comparables(conn)


# synthetic sold-history: assist owns its own demo data, seeded once on boot
COMPARABLES = [
    ("Nikon FM2 35mm film camera body", "electronics", 45000),
    ("Nikon FE2 film camera with 50mm", "electronics", 38000),
    ("Canon AE-1 program film camera", "electronics", 32000),
    ("Sony WH-1000XM4 wireless headphones", "electronics", 21000),
    ("Sony WH-1000XM5 headphones", "electronics", 32000),
    ("Apple iPad 9th gen 64GB wifi", "electronics", 29000),
    ("Apple iPad air 5 256GB", "electronics", 62000),
    ("Kindle Paperwhite 11th generation", "electronics", 11000),
    ("Kindle Paperwhite 10th gen 8GB", "electronics", 8000),
    ("Nintendo Switch OLED console", "electronics", 28000),
    ("Uniqlo U crew neck tee", "fashion", 800),
    ("Uniqlo heattech long sleeve", "fashion", 600),
    ("Levis 501 jeans vintage", "fashion", 6500),
    ("Levis 511 slim jeans", "fashion", 4200),
    ("North face mountain parka", "fashion", 18000),
    ("Norwegian Wood Murakami paperback", "books", 700),
    ("Kafka on the Shore Murakami", "books", 900),
    ("Design of Everyday Things Norman", "books", 1500),
    ("Clean Code Robert Martin", "books", 2400),
    ("Balmuda kettle white", "home", 9500),
    ("Balmuda toaster", "home", 15000),
    ("Muji oak desk lamp LED", "home", 3500),
    ("Muji aroma diffuser", "home", 2800),
    ("Gundam RX-78-2 master grade kit", "hobby", 4800),
    ("Gundam Zaku II MG model kit", "hobby", 4200),
    ("Shimano 105 rear derailleur 11 speed", "hobby", 7000),
    ("Shimano ultegra crankset", "hobby", 14000),
    ("Seiko 5 automatic watch vintage", "hobby", 17000),
    ("Seiko presage automatic", "hobby", 42000),
    ("Yamaha acoustic guitar FG800", "hobby", 21000),
]


def _seed_comparables(conn) -> None:
    if conn.execute("SELECT count(*) FROM assist.comparables").fetchone()[0] > 0:
        return
    for title, cat, price in COMPARABLES:
        conn.execute(
            "INSERT INTO assist.comparables (title, category_slug, price_minor) VALUES (%s, %s, %s)",
            (title, cat, price),
        )
