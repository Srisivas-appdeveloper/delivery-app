import datetime

def utc_now() -> datetime.datetime:
    """Returns current timezone-aware UTC datetime."""
    return datetime.datetime.now(datetime.timezone.utc)

def utc_now_iso() -> str:
    """Returns current UTC datetime formatted as ISO 8601 string."""
    return utc_now().isoformat()

def ensure_utc(dt: datetime.datetime) -> datetime.datetime:
    """Ensures datetime is timezone-aware in UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc)
