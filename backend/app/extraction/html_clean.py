"""Strip a raw HTML page down to what an LLM extraction fallback needs:
meta tags (often carry price/title even when structured-data parsing
failed for some reason) plus visible text. Never send a raw page — this
caps input size and removes script/style noise that wastes tokens."""
from __future__ import annotations

from bs4 import BeautifulSoup

MAX_CHARS = 15_000


def clean_for_llm(html: str, max_chars: int = MAX_CHARS) -> str:
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "svg", "noscript", "iframe"]):
        tag.decompose()

    meta_lines: list[str] = []
    for meta in soup.find_all("meta"):
        name = meta.get("property") or meta.get("name")
        content = meta.get("content")
        if name and content:
            meta_lines.append(f'<meta {name}="{content}">')

    text = soup.get_text("\n", strip=True)
    cleaned = "\n".join(meta_lines) + "\n\n" + text
    return cleaned[:max_chars]
