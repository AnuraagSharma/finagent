from __future__ import annotations

from fastapi import Depends, HTTPException

from finagent.api.dependencies.auth import get_user_id_from_headers
from finagent.infra.config.settings import get_settings


def require_admin(user_id: str = Depends(get_user_id_from_headers)) -> str:
    """Allow-list gate for admin-only routes (analytics, knowledge base).

    Behavior:
    - If `ADMIN_USER_IDS` is unset / empty in env, **everyone** with a valid `X-User-Id`
      passes. This is the demo default — same UI, same APIs, no friction.
    - If `ADMIN_USER_IDS` is set (CSV), only matching user ids pass; everyone else gets
      a 403. Flipping demo → production access control is just an env var change.
    """
    admin_ids = get_settings().admin_user_ids
    if admin_ids and user_id not in admin_ids:
        raise HTTPException(status_code=403, detail="admin only")
    return user_id
