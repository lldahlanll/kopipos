import re


def sanitize_text(value: str, max_length: int = 500) -> str:
    if not isinstance(value, str):
        return value
    value = value.strip()
    value = re.sub(r'<[^>]*>', '', value)
    value = value[:max_length]
    return value


def sanitize_email(value: str) -> str:
    if not isinstance(value, str):
        return value
    return value.strip().lower()
