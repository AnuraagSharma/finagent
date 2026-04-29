import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    redis_url: str

    openai_model: str = "openai:gpt-5.4"


def get_settings() -> Settings:
    def _clean(v: str) -> str:
        v = (v or "").strip()
        if len(v) >= 2 and ((v[0] == v[-1] == "\"") or (v[0] == v[-1] == "'")):
            v = v[1:-1].strip()
        # If the user pasted a redis-cli helper command, extract the URL after "-u".
        # Example: "redis-cli --tls -u redis://default:...@host:6379"
        if "redis-cli" in v and " -u " in v:
            v = v.split(" -u ", 1)[1].strip()
        # Upstash TCP endpoints require TLS; encourage using rediss://
        if v.startswith("redis://") and ".upstash.io" in v:
            v = v.replace("redis://", "rediss://", 1)
        return v

    database_url = _clean(os.getenv("DATABASE_URL", ""))
    redis_url = _clean(os.getenv("REDIS_URL", "")) or "redis://redis:6379/0"

    if not database_url:
        raise RuntimeError("Missing DATABASE_URL environment variable")
    if not redis_url:
        raise RuntimeError("Missing REDIS_URL environment variable")

    openai_model = os.getenv("OPENAI_MODEL", "openai:gpt-5.4").strip() or "openai:gpt-5.4"

    return Settings(
        database_url=database_url,
        redis_url=redis_url,
        openai_model=openai_model,
    )

