"""extractor.py — Content to clean text extraction.

Supports:
  - PDF bytes (pdfplumber) for product brochures
  - HTML bytes (BeautifulSoup) for product pages
"""

import io

from bs4 import BeautifulSoup

_REMOVE_TAGS = {"script", "style", "nav", "footer", "header", "noscript", "iframe", "svg"}


def extract_text(content: bytes, source_type: str = "product_page") -> str:
    """Extract readable text from content bytes."""
    if source_type == "pdf":
        return _extract_pdf(content)
    return _extract_html(content)


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
