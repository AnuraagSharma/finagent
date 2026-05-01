"""In-memory TTL cache used by the analytics endpoints.

Each entry is keyed by a tuple of arguments and expires after `ttl` seconds.
Designed for read-heavy GET endpoints where a few seconds of staleness is
acceptable in exchange for a large latency drop on repeat loads (the
dashboard polls every 15s, and most filter changes happen in clusters).

Production notes
----------------
* **Thread safety** — cache reads are atomic via the GIL, but the
  read-modify-write pattern around eviction needs a lock or two concurrent
  requests can corrupt the bucket. We use a per-namespace `RLock`.
* **Mutability** — values are stored once and returned via `copy.deepcopy`
  so callers that mutate a result (FastAPI middleware, request hooks, future
  refactors) can't poison the cached entry for everyone else.
* **Process scope** — cache is in-memory per process. Behind multiple Uvicorn
  workers each will have its own copy; that's fine for ~8s TTL and a small
  set of admin users. Swap to Redis if you ever need cross-worker coherence.
"""
from __future__ import annotations

import copy
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from functools import wraps
from typing import Any, Hashable

# Maximum entries per namespace. Past this we drop the oldest entries by
# insertion order, which is what `OrderedDict` gives us for free.
_MAX_ENTRIES = 256


def ttl_cache(
    ttl: float,
    namespace: str | None = None,
    *,
    max_entries: int = _MAX_ENTRIES,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Memoise the wrapped function for `ttl` seconds.

    The cache key is the tuple of *positional* arguments plus a sorted tuple
    of keyword arguments. Keys with names that start with `_` (FastAPI
    `Depends`-injected sentinels like `_admin`) are stripped from the key
    so two callers with the same filters share an entry regardless of who
    they are.
    """

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        ns = namespace or fn.__qualname__
        bucket: OrderedDict[Hashable, tuple[float, Any]] = OrderedDict()
        lock = threading.RLock()

        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            cleaned_kwargs = {
                k: v for k, v in kwargs.items() if not k.startswith("_")
            }
            try:
                key: Hashable = (args, tuple(sorted(cleaned_kwargs.items())))
            except TypeError:
                # Unhashable arg slipped through — bypass the cache rather
                # than raise. The function still runs; we just don't memoise.
                return fn(*args, **kwargs)

            now = time.monotonic()

            # ---- Cache hit fast-path (read under lock) ----
            with lock:
                hit = bucket.get(key)
                if hit and hit[0] > now:
                    # Move to end so eviction prefers cold entries.
                    bucket.move_to_end(key)
                    return copy.deepcopy(hit[1])

            # ---- Miss: compute outside the lock so the DB call doesn't
            #            serialise concurrent requests through one mutex. ----
            value = fn(*args, **kwargs)

            with lock:
                bucket[key] = (now + ttl, value)
                bucket.move_to_end(key)
                # Evict oldest entries past the cap.
                while len(bucket) > max_entries:
                    bucket.popitem(last=False)
            return copy.deepcopy(value)

        def _clear() -> None:
            with lock:
                bucket.clear()

        wrapper.__cache_clear__ = _clear  # type: ignore[attr-defined]
        wrapper.__cache_namespace__ = ns  # type: ignore[attr-defined]
        return wrapper

    return decorator


def clear_all() -> None:
    """Test-only helper: wipe every cache decorated with `ttl_cache`. Walk
    every globally-tracked function manually if needed; simplest path is to
    keep references in the calling module and call `__cache_clear__()`.
    """
    # Intentionally a no-op at the module level — namespaces are owned by
    # individual decorators. Tests can call `_compute_summary.__cache_clear__()`
    # directly (it's exposed via the wrapper attribute).
