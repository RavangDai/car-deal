"""Run the real extraction pipeline against live product URLs and report what
happens, URL by URL.

Deliberately NOT a pytest test. A network-dependent test that goes red when a
retailer has a bad afternoon teaches everyone to ignore red CI. This is a
diagnostic you run on demand.

Needs no infrastructure — `extract_product` touches neither Postgres nor
Redis, so this runs against the venv with nothing else up:

    cd backend
    .venv/Scripts/python.exe -m scripts.probe_urls

Each fetched page is saved to tests/fixtures/live/ alongside a JSON sidecar of
what was extracted. THE SIDECAR IS A DRAFT: it records what the parser
produced, which is the very thing under test. Check each one against the real
page before committing it, or a wrong extraction becomes the expected result.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import asdict, dataclass
from decimal import Decimal
from pathlib import Path

from app.extraction import pipeline
from app.extraction.fetch import FetchError, SsrfBlockedError
from app.extraction.pipeline import ExtractionFailedError, extract_product
from app.urlnorm import domain_of, normalize_url, url_hash

FIXTURE_DIR = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "live"
DEFAULT_URL_LIST = Path(__file__).resolve().parent / "probe_urls.txt"


@dataclass(frozen=True)
class ProbeRow:
    url: str
    outcome: str
    strategy: str | None = None
    title: str | None = None
    price: Decimal | None = None
    currency: str | None = None
    elapsed_ms: int = 0
    detail: str = ""


def probe_one(url: str) -> ProbeRow:
    """Run the true extraction path for one URL. Never raises — every failure
    mode becomes an outcome code so a 20-URL run can't die on URL 3."""
    captured: dict[str, object] = {}
    real_fetch = pipeline.safe_fetch

    def recording_fetch(*args, **kwargs):
        result = real_fetch(*args, **kwargs)
        captured["result"] = result
        return result

    pipeline.safe_fetch = recording_fetch  # type: ignore[assignment]
    started = time.monotonic()
    try:
        result = extract_product(url)
        return _row(
            url,
            "ok",
            started,
            strategy=result.strategy,
            title=result.product.title,
            price=result.product.price,
            currency=result.product.currency,
        )

    # SsrfBlockedError subclasses ValueError — it must be caught first.
    except SsrfBlockedError as exc:
        return _row(url, "ssrf_blocked", started, detail=str(exc))

    except FetchError as exc:
        if exc.status_code is not None:
            return _row(
                url, "http_error", started, detail=f"HTTP {exc.status_code}"
            )
        return _row(url, "fetch_failed", started, detail=str(exc))

    except ExtractionFailedError as exc:
        # Reuse the pipeline's own judgment rather than string-matching its
        # message, so the probe can't drift from the code it's measuring.
        fetched = captured.get("result")
        walled = fetched is not None and pipeline._looks_bot_walled(fetched.html)
        return _row(
            url, "bot_wall" if walled else "no_product", started, detail=str(exc)
        )

    except ValueError as exc:
        return _row(url, "validation_failed", started, detail=str(exc))

    except Exception as exc:  # noqa: BLE001 — the whole point is to not escape
        return _row(url, "error", started, detail=f"{type(exc).__name__}: {exc}")

    finally:
        pipeline.safe_fetch = real_fetch  # type: ignore[assignment]
        page = captured.get("result")
        if page is not None:
            _last_html[url] = page.html


# Captured page bodies, keyed by URL, so main() can write fixtures without
# probe_one needing to return them.
_last_html: dict[str, str] = {}


def _row(url: str, outcome: str, started: float, **fields) -> ProbeRow:
    elapsed_ms = int((time.monotonic() - started) * 1000)
    return ProbeRow(url=url, outcome=outcome, elapsed_ms=elapsed_ms, **fields)


def read_url_list(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return [
        stripped
        for line in lines
        if (stripped := line.strip()) and not stripped.startswith("#")
    ]


def save_fixture(url: str, html: str, row: ProbeRow) -> Path:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    normalized = normalize_url(url)
    stem = f"{domain_of(normalized)}-{url_hash(normalized)[:8]}"
    (FIXTURE_DIR / f"{stem}.html").write_text(html, encoding="utf-8")
    sidecar = {
        "url": url,
        "expected_outcome": row.outcome,
        "expected_strategy": row.strategy,
        "expected_title": row.title,
        "expected_price": str(row.price) if row.price is not None else None,
        "expected_currency": row.currency,
        "reviewed": False,
    }
    (FIXTURE_DIR / f"{stem}.json").write_text(
        json.dumps(sidecar, indent=2) + "\n", encoding="utf-8"
    )
    return FIXTURE_DIR / f"{stem}.html"


def render_table(rows: list[ProbeRow]) -> str:
    headers = ("OUTCOME", "STRATEGY", "PRICE", "MS", "URL / DETAIL")
    body = [
        (
            row.outcome,
            row.strategy or "-",
            f"{row.currency or ''} {row.price}".strip() if row.price else "-",
            str(row.elapsed_ms),
            row.url if row.outcome == "ok" else f"{row.url}  ({row.detail})",
        )
        for row in rows
    ]
    widths = [
        max(len(headers[i]), *(len(r[i]) for r in body)) if body else len(headers[i])
        for i in range(len(headers))
    ]
    lines = ["  ".join(h.ljust(widths[i]) for i, h in enumerate(headers))]
    lines.append("  ".join("-" * widths[i] for i in range(len(headers))))
    lines += ["  ".join(c.ljust(widths[i]) for i, c in enumerate(r)) for r in body]
    return "\n".join(lines)


def render_tally(rows: list[ProbeRow]) -> str:
    counts: dict[str, int] = {}
    for row in rows:
        counts[row.outcome] = counts.get(row.outcome, 0) + 1
    ordered = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return "\n".join(f"  {outcome:<18} {count}" for outcome, count in ordered)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--urls", type=Path, default=DEFAULT_URL_LIST)
    parser.add_argument("--json", type=Path, default=None)
    parser.add_argument("--no-save-fixtures", action="store_true")
    args = parser.parse_args(argv)

    if not args.urls.exists():
        print(f"URL list not found: {args.urls}", file=sys.stderr)
        return 2

    urls = read_url_list(args.urls)
    if not urls:
        print(f"No URLs in {args.urls}", file=sys.stderr)
        return 2

    print(f"Probing {len(urls)} URL(s)...\n", file=sys.stderr)
    rows: list[ProbeRow] = []
    for url in urls:
        row = probe_one(url)
        rows.append(row)
        print(f"  {row.outcome:<18} {url}", file=sys.stderr)
        html = _last_html.pop(url, None)
        if html and not args.no_save_fixtures:
            save_fixture(url, html, row)

    print("\n" + render_table(rows))
    print("\nTally:")
    print(render_tally(rows))

    if not args.no_save_fixtures:
        print(f"\nFixtures written to {FIXTURE_DIR}")
        print("Review each sidecar against the live page before committing.")

    if args.json:
        payload = [
            {**asdict(r), "price": str(r.price) if r.price is not None else None}
            for r in rows
        ]
        args.json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"JSON results written to {args.json}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
