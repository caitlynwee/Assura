import httpx

_client: httpx.AsyncClient | None = None

USER_AGENT = "Fineprint-Bot/0.1 (+https://fineprint.local; research only)"


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT},
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
        )
    return _client
