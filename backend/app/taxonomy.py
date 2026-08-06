"""Product taxonomy — the single source of truth for `products.category`.

Deliberately coarse. This exists to answer one question at onboarding ("what
sort of thing do you shop for?") and to filter a feed by the answer. It is not
a merchandising tree, and it should not grow into one: every category added
here is another bucket the classifier can be wrong about, and another checkbox
a new user has to read before they see a single price.

The first four slugs are exactly the categories used by scripts/seed_products.py
(25 demo products each), so the seeded catalog backfills cleanly with no
mapping table.

Kept in sync manually with frontend/src/taxonomy.ts. If you add a slug here,
add it there — the onboarding UI renders from that file, and a slug the UI
cannot label is a slug users can never select.
"""

from typing import Final

# slug -> human label. Order is display order in the onboarding step.
CATEGORIES: Final[dict[str, str]] = {
    "electronics": "Electronics",
    "kitchen": "Kitchen",
    "gaming": "Gaming",
    "home": "Home & garden",
    "fashion": "Clothing & shoes",
    "fitness": "Fitness & outdoors",
    "beauty": "Beauty & personal care",
    "tools": "Tools & DIY",
}

CATEGORY_SLUGS: Final[frozenset[str]] = frozenset(CATEGORIES)


def is_valid(slug: str | None) -> bool:
    return slug is not None and slug in CATEGORY_SLUGS


def normalize(slug: str | None) -> str | None:
    """Return the slug if we recognise it, else None.

    Used on both the classifier output and user-supplied preference payloads:
    an unrecognised category must degrade to "uncategorised" rather than be
    written through and quietly break the feed filter later.
    """
    if slug is None:
        return None
    cleaned = slug.strip().lower()
    return cleaned if cleaned in CATEGORY_SLUGS else None
