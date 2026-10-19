"""extractor.py — Content to clean text extraction.

Supports:
  - PDF bytes (pdfplumber) for product brochures
  - HTML bytes (BeautifulSoup) for product pages
"""

import io
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

_REMOVE_TAGS = {"script", "style", "nav", "footer", "header", "noscript", "iframe", "svg"}


def extract_text(content: bytes, source_type: str = "product_page") -> str:
    """Extract readable text from content bytes.

    For Jina-fetched sources (product_page, pdf): content is already clean
    markdown — just decode it.
    For mock sources: parse HTML with BeautifulSoup.
    """
    if source_type == "mock":
        return _extract_html(content)
    # Jina Reader returns clean UTF-8 markdown for both pages and PDFs
    return content.decode("utf-8", errors="replace")


def _extract_pdf(pdf_bytes: bytes) -> str:
    import pdfplumber  # lazy import — only installed when PDFs are used

    pages = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                pages.append(text.strip())
    return "\n\n".join(pages)


def _extract_html(html: bytes) -> str:
    soup = BeautifulSoup(html, "lxml")

    for tag in soup.find_all(_REMOVE_TAGS):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def find_pdf_links(html: bytes, base_url: str) -> list[str]:
    """Find all same-domain PDF links in a rendered HTML page."""
    soup = BeautifulSoup(html, "lxml")
    base_netloc = urlparse(base_url).netloc
    seen: set[str] = set()
    results: list[str] = []
    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        if ".pdf" not in href.lower():
            continue
        full = urljoin(base_url, href).split("?")[0]  # strip query params
        if urlparse(full).netloc != base_netloc:
            continue
        if full not in seen:
            seen.add(full)
            results.append(full)
    return results
