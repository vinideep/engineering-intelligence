"""Service module that uses helpers — exercises cross-file call resolution."""

from helpers import compute_total, Cache


def summarize(items):
    total = compute_total(items)
    return {"count": len(items), "total": total}


def build_cache():
    cache = Cache()
    return cache
