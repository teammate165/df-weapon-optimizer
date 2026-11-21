"""Render repository-relative progress summaries and optionally count their tokens."""

import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def render(report):
    links = ", ".join(f"[{label}]({path})" for label, path in report["artifacts"].items())
    return (
        f'- **{report["title"]}.** {report["outcome"]}. {report["proof"]}. '
        f'{report["timing"]}. Errors {report["errors"]}. {links}'
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="JSON array of report records")
    parser.add_argument("--check-links", action="store_true", help="Require local artifact files")
    parser.add_argument("--measure", action="store_true", help="Output token counts as JSON")
    args = parser.parse_args()
    raw = args.input.read_text(encoding="utf-8")
    reports = json.loads(raw)
    summaries = [render(report) for report in reports]

    if args.check_links:
        for report in reports:
            for path in report["artifacts"].values():
                if not (ROOT / path).is_file():
                    parser.error(f"Missing artifact: {path}")

    if not args.measure:
        print("\n".join(summaries))
        return

    import tiktoken

    encoding = tiktoken.get_encoding("o200k_base")
    rows = [
        {
            "kind": report["kind"],
            "before": len(encoding.encode_ordinary(report["baseline"])),
            "after": len(encoding.encode_ordinary(summary)),
        }
        for report, summary in zip(reports, summaries, strict=True)
    ]
    print(json.dumps({
        "encoding": encoding.name,
        "tiktoken": tiktoken.__version__,
        "input_sha256": hashlib.sha256(raw.encode("utf-8")).hexdigest(),
        "samples": rows,
        "total": {key: sum(row[key] for row in rows) for key in ("before", "after")},
    }, indent=2))


if __name__ == "__main__":
    main()
