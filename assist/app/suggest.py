"""Listing suggestions: price band from comparables + optional VLM titles.

AI proposes, the human decides — every field is editable in the UI and
acceptance is tracked per field (the co-creation metric).
"""

import json
import os
import statistics

VLM_MODEL = "claude-opus-4-8"

CATEGORY_SLUGS = ["electronics", "fashion", "books", "home", "hobby", "other"]

SUGGESTION_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "Concise marketplace listing title, max 80 chars"},
        "description": {
            "type": "string",
            "description": "2-3 honest sentences: what it is, condition, notable details",
        },
        "category_slug": {"type": "string", "enum": CATEGORY_SLUGS},
        "search_terms": {
            "type": "string",
            "description": "3-6 words naming the product for price comparison",
        },
    },
    "required": ["title", "description", "category_slug", "search_terms"],
    "additionalProperties": False,
}


def price_band(prices: list[int]) -> tuple[int | None, int | None]:
    """25th-75th percentile of comparable sold prices, rounded to 100s."""
    if not prices:
        return None, None
    if len(prices) == 1:
        p = prices[0]
        return round(p * 0.8 / 100) * 100, round(p * 1.2 / 100) * 100
    qs = statistics.quantiles(sorted(prices), n=4)
    low, high = int(qs[0]), int(qs[2])
    return round(low / 100) * 100, round(high / 100) * 100


def or_query(query: str) -> str:
    """'Kindle Paperwhite 11th gen' → 'kindle | paperwhite | 11th | gen'.
    OR semantics: any word overlap counts, ts_rank orders by how many."""
    words = ["".join(ch for ch in w if ch.isalnum()) for w in query.lower().split()]
    return " | ".join(w for w in words if w)[:200]


def comparable_prices(conn, query: str, category_slug: str | None, limit: int = 12) -> list[int]:
    """FTS word-overlap match over the synthetic sold history."""
    q = or_query(query)
    if not q:
        return []
    rows = conn.execute(
        """SELECT price_minor,
                  ts_rank(search, to_tsquery('simple', %(q)s)) AS rank
           FROM assist.comparables
           WHERE search @@ to_tsquery('simple', %(q)s)
             AND (%(cat)s::text IS NULL OR category_slug = %(cat)s)
           ORDER BY rank DESC LIMIT %(limit)s""",
        {"q": q, "cat": category_slug, "limit": limit},
    ).fetchall()
    return [r[0] for r in rows]


def heuristic_suggestion(title_hint: str) -> dict:
    """No-API fallback: echo the hint into a tidy shape."""
    title = title_hint.strip()[:80] or "Untitled item"
    return {
        "title": title,
        "description": f"{title}. Good condition. See photo for details.",
        "category_slug": "other",
        "search_terms": title,
        "model": "heuristic",
    }


def vlm_suggestion(image_url: str, title_hint: str) -> dict | None:
    """Vision suggestion via the Anthropic API; None when unavailable."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    try:
        import anthropic

        client = anthropic.Anthropic()
        content: list[dict] = []
        if image_url:
            content.append({"type": "image", "source": {"type": "url", "url": image_url}})
        hint = f' The seller typed this hint: "{title_hint}".' if title_hint else ""
        content.append(
            {
                "type": "text",
                "text": "You are a C2C marketplace listing assistant. Look at the item photo "
                f"and draft a listing.{hint} Be specific and honest; do not invent "
                "condition details you cannot see.",
            }
        )
        resp = client.messages.create(
            model=VLM_MODEL,
            max_tokens=1024,
            output_config={"format": {"type": "json_schema", "schema": SUGGESTION_SCHEMA}},
            messages=[{"role": "user", "content": content}],
        )
        if resp.stop_reason == "refusal" or not resp.content:
            return None
        data = json.loads(resp.content[0].text)
        data["model"] = VLM_MODEL
        return data
    except Exception:
        return None  # graceful degradation to the heuristic path


def build_suggestion(conn, user_id: str, image_url: str, title_hint: str) -> dict:
    s = vlm_suggestion(image_url, title_hint) or heuristic_suggestion(title_hint)
    prices = comparable_prices(conn, s["search_terms"], s["category_slug"])
    if not prices:  # relax: drop the category filter
        prices = comparable_prices(conn, s["search_terms"], None)
    low, high = price_band(prices)
    row = conn.execute(
        """INSERT INTO assist.suggestions
             (user_id, model, input_title, input_image, title, description,
              category_slug, price_low, price_high)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
           RETURNING id""",
        (user_id, s["model"], title_hint, image_url, s["title"], s["description"],
         s["category_slug"], low, high),
    ).fetchone()
    return {
        "suggestion_id": str(row[0]),
        "title": s["title"],
        "description": s["description"],
        "category_slug": s["category_slug"],
        "price_low": low,
        "price_high": high,
        "model": s["model"],
    }
