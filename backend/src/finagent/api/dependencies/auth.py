from __future__ import annotations

from fastapi import Header, HTTPException


def get_user_id_from_headers(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> str:
    # Demo auth: require explicit user id until JWT integration is added.
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header (demo auth)")
    return x_user_id

