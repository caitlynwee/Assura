"""extractor.py — HTML to clean text extraction using BeautifulSoup."""

from bs4 import BeautifulSoup

_REMOVE_TAGS = {"script", "style", "nav", "footer", "header", "noscript", "iframe", "svg"}


def extract_text(html: bytes) -> str:
    """Extract readable text from HTML, stripping noise elements."""
    soup = BeautifulSoup(html, "lxml")

    for tag in soup.find_all(_REMOVE_TAGS):
        tag.decompose()

    # Get text with reasonable separator
    text = soup.get_text(separator="\n", strip=True)

    # Collapse excessive blank lines
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)
