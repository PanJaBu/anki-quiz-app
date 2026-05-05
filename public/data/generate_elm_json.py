#!/usr/bin/env python3
import argparse
import concurrent.futures
import json
import re
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent


SYSTEM_WRAPPER = (
    "Zwroc wylacznie poprawny JSON. "
    "Nie uzywaj Markdown. "
    "Nie dodawaj komentarzy ani objasnien poza JSON. "
    "Jesli wynik ma byc tablica, zwroc sama tablice JSON. "
    "Zachowaj dokladnie strukture wymagana w tresci zadania."
)

ALLOWED_CORRECT = {
    "1 0 0 0",
    "0 1 0 0",
    "0 0 1 0",
    "0 0 0 1",
}

REQUIRED_KEYS = [
    "img",
    "question",
    "a.",
    "img_a",
    "b.",
    "img_b",
    "c.",
    "img_c",
    "d.",
    "img_d",
    "explanation",
    "correct",
]


@dataclass
class FileResult:
    source: str
    output: str
    status: str
    attempts: int
    items: int = 0
    error: str | None = None
    duration_sec: float = 0.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate validated JSON answers for ELM prompts."
    )
    parser.add_argument("--root", default=str(SCRIPT_DIR), help="ELM root directory")
    parser.add_argument("--model", default="openai/gpt-5.2", help="Model for opencode")
    parser.add_argument("--retries", type=int, default=3, help="Retries per file")
    parser.add_argument("--parallel", type=int, default=1, help="Parallel requests")
    parser.add_argument(
        "--mode",
        choices=["strict", "best-effort"],
        default="strict",
        help="Aggregation mode per directory",
    )
    parser.add_argument("--resume", action="store_true", help="Skip valid existing JSON files")
    parser.add_argument("--only-dir", help="Process a single prompt directory name")
    parser.add_argument("--only-file", help="Process a single source file path")
    parser.add_argument(
        "--rebuild-aggregate",
        action="store_true",
        help="Rebuild aggregate files from existing validated JSON files only",
    )
    parser.add_argument(
        "--report-dir",
        default=None,
        help="Directory for reports; defaults to <root>/_reports",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Base timeout in seconds for one model call",
    )
    parser.add_argument(
        "--timeout-per-question",
        type=int,
        default=5,
        help="Additional timeout seconds per expected question",
    )
    return parser.parse_args()


def clean_response(text: str) -> str:
    cleaned = text.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", cleaned, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        cleaned = fenced.group(1).strip()
    return cleaned


def load_json_text(file_path: Path) -> Any:
    return json.loads(file_path.read_text(encoding="utf-8"))


SECTION_BREAK_PREFIXES = (
    "Odpowiedz",
    "Kolejne pytania",
    "Pole correct",
    "Jesli pytanie",
    "Zawsze generuj",
    "Struktura JSON",
    'W przypadku gdy "a."',
    "###PYTANIA",
)

SECTION_HEADERS = (
    "Podstawowe wymagania programowe:",
    "Ponadpodstawowe wymagania programowe:",
)

CONTINUATION_PREFIXES = {
    "a",
    "i",
    "lub",
    "oraz",
    "w",
    "we",
    "z",
    "ze",
    "na",
    "nad",
    "pod",
    "do",
    "od",
    "po",
    "przy",
    "dla",
    "u",
}


def normalize_requirement_line(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip()).strip("- ")


def line_starts_new_requirement(line: str) -> bool:
    stripped = normalize_requirement_line(line)
    if not stripped:
        return False
    first_word = stripped.split()[0].lower()
    return first_word not in CONTINUATION_PREFIXES


def should_append_to_previous(requirements: list[str], raw_line: str) -> bool:
    if not requirements:
        return False
    previous = requirements[-1].rstrip()
    if previous.endswith((",", ";", ":", "(")):
        return True
    if raw_line[:1].isspace() and previous.endswith((",", "-")):
        return True
    return False


def expected_question_count(source_text: str) -> int | None:
    requirements: list[str] = []
    in_section = False

    for raw_line in source_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line in SECTION_HEADERS:
            in_section = True
            continue
        if not in_section:
            continue
        if line.startswith(SECTION_BREAK_PREFIXES):
            break
        if line.startswith("###"):
            break

        if raw_line.lstrip().startswith("-"):
            requirements.append(normalize_requirement_line(raw_line))
            continue

        if should_append_to_previous(requirements, raw_line):
            requirements[-1] = f"{requirements[-1]} {normalize_requirement_line(raw_line)}".strip()
        elif not requirements or line_starts_new_requirement(raw_line):
            requirements.append(normalize_requirement_line(raw_line))
        else:
            requirements[-1] = f"{requirements[-1]} {normalize_requirement_line(raw_line)}".strip()

    return len(requirements) * 5 if requirements else None


def validate_question(item: Any, source: Path, index: int) -> None:
    if not isinstance(item, dict):
        raise ValueError(f"{source}: item {index} is not an object")
    missing = [key for key in REQUIRED_KEYS if key not in item]
    if missing:
        raise ValueError(f"{source}: item {index} missing keys: {', '.join(missing)}")
    for key in REQUIRED_KEYS:
        if not isinstance(item[key], str):
            raise ValueError(f"{source}: item {index} field {key} must be a string")
    for key in ["question", "a.", "b.", "c.", "d.", "explanation"]:
        if not item[key].strip():
            raise ValueError(f"{source}: item {index} field {key} cannot be empty")
    if item["correct"] not in ALLOWED_CORRECT:
        raise ValueError(f"{source}: item {index} invalid correct value: {item['correct']}")


def validate_json_payload(
    payload: Any,
    source: Path,
    expected_items: int | None = None,
) -> list[dict[str, str]]:
    if not isinstance(payload, list):
        raise ValueError(f"{source}: top-level JSON must be an array")
    if not payload:
        raise ValueError(f"{source}: top-level array cannot be empty")
    if expected_items is not None and len(payload) != expected_items:
        raise ValueError(
            f"{source}: expected {expected_items} questions, got {len(payload)}"
        )
    for index, item in enumerate(payload, start=1):
        validate_question(item, source, index)
    return payload


def valid_existing_json(file_path: Path, source_file: Path | None = None) -> bool:
    try:
        payload = load_json_text(file_path)
        expected_items = None
        if source_file is not None and source_file.exists():
            expected_items = expected_question_count(source_file.read_text(encoding="utf-8"))
        validate_json_payload(payload, file_path, expected_items=expected_items)
        return True
    except Exception:
        return False


def build_prompt(source_text: str, expected_items: int | None = None) -> str:
    count_instruction = ""
    if expected_items is not None:
        count_instruction = (
            f"\nZwroc dokladnie {expected_items} obiektow pytan w tablicy JSON."
        )
    return f"{SYSTEM_WRAPPER}{count_instruction}\n\n{source_text.strip()}\n"


def run_opencode(prompt: str, model: str, timeout: int, workdir: Path) -> str:
    cmd = [
        "opencode",
        "run",
        "--model",
        model,
        "--format",
        "json",
        prompt,
    ]
    proc = subprocess.run(
        cmd,
        cwd=str(workdir),
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "opencode failed")
    texts: list[str] = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") == "text":
            part = event.get("part") or {}
            text = part.get("text")
            if isinstance(text, str):
                texts.append(text)
    if not texts:
        raise ValueError("No text response found in opencode output")
    return "\n".join(texts).strip()


def effective_timeout(base_timeout: int, expected_items: int | None, per_question: int) -> int:
    if expected_items is None:
        return base_timeout
    return max(base_timeout, expected_items * per_question)


def output_path_for(source: Path) -> Path:
    output_name = source.name.rstrip(".") + ".json"
    return source.with_name(output_name)


def collect_source_files(root: Path, only_dir: str | None = None) -> list[Path]:
    directories = sorted(
        p for p in root.iterdir() if p.is_dir() and p.name.endswith("_prompty")
    )
    if only_dir:
        directories = [p for p in directories if p.name == only_dir]
    files: list[Path] = []
    for directory in directories:
        files.extend(
            sorted(
                p
                for p in directory.iterdir()
                if p.is_file() and not p.name.endswith(".json")
            )
        )
    return files


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def process_file(source: Path, args: argparse.Namespace) -> FileResult:
    start = time.time()
    output = output_path_for(source)
    try:
        source_text = source.read_text(encoding="utf-8")
    except Exception as exc:
        return FileResult(
            source=str(source),
            output=str(output),
            status="failed",
            attempts=0,
            error=str(exc),
            duration_sec=time.time() - start,
        )
    expected_items = expected_question_count(source_text)
    if args.resume and output.exists() and valid_existing_json(output, source):
        payload = load_json_text(output)
        return FileResult(
            source=str(source),
            output=str(output),
            status="skipped",
            attempts=0,
            items=len(payload),
            duration_sec=time.time() - start,
        )

    prompt = build_prompt(source_text, expected_items=expected_items)
    last_error: str | None = None

    for attempt in range(1, args.retries + 1):
        try:
            timeout = effective_timeout(args.timeout, expected_items, args.timeout_per_question)
            raw = run_opencode(prompt, args.model, timeout, source.parent)
            cleaned = clean_response(raw)
            payload = json.loads(cleaned)
            payload = validate_json_payload(payload, source, expected_items=expected_items)
            output.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            return FileResult(
                source=str(source),
                output=str(output),
                status="ok",
                attempts=attempt,
                items=len(payload),
                duration_sec=time.time() - start,
            )
        except Exception as exc:
            last_error = str(exc)

    return FileResult(
        source=str(source),
        output=str(output),
        status="failed",
        attempts=args.retries,
        error=last_error,
        duration_sec=time.time() - start,
    )


def aggregate_directory(directory: Path, mode: str) -> dict[str, Any]:
    source_files = sorted(
        p for p in directory.iterdir() if p.is_file() and not p.name.endswith(".json")
    )
    failed_sources: list[str] = []
    combined: list[Any] = []

    for source in source_files:
        output = output_path_for(source)
        if not output.exists():
            failed_sources.append(source.name)
            continue
        try:
            payload = load_json_text(output)
            expected_items = expected_question_count(source.read_text(encoding="utf-8"))
            payload = validate_json_payload(payload, output, expected_items=expected_items)
            combined.extend(payload)
        except Exception:
            failed_sources.append(source.name)

    aggregate_path = directory.parent / f"{directory.name}.json"
    if failed_sources and mode == "strict":
        if aggregate_path.exists():
            aggregate_path.unlink()
        return {
            "directory": directory.name,
            "status": "failed",
            "aggregate": str(aggregate_path),
            "failed_sources": failed_sources,
            "items": 0,
        }

    aggregate_path.write_text(
        json.dumps(combined, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return {
        "directory": directory.name,
        "status": "ok" if not failed_sources else "partial",
        "aggregate": str(aggregate_path),
        "failed_sources": failed_sources,
        "items": len(combined),
    }


def write_report(report_dir: Path, data: dict[str, Any]) -> Path:
    ensure_dir(report_dir)
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    report_path = report_dir / f"report-{timestamp}.json"
    report_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    latest_path = report_dir / "report-latest.json"
    latest_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report_path


def build_report_data(
    root: Path,
    args: argparse.Namespace,
    file_results: list[FileResult],
    aggregates: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "root": str(root),
        "model": args.model,
        "mode": args.mode,
        "parallel": args.parallel,
        "retries": args.retries,
        "resume": args.resume,
        "files": [result.__dict__ for result in sorted(file_results, key=lambda x: x.source)],
        "aggregates": aggregates,
        "summary": {
            "ok": sum(1 for result in file_results if result.status == "ok"),
            "skipped": sum(1 for result in file_results if result.status == "skipped"),
            "failed": sum(1 for result in file_results if result.status == "failed"),
        },
    }


def rebuild_aggregates(
    root: Path,
    mode: str,
    only_dir: str | None = None,
    only_file: str | None = None,
) -> list[dict[str, Any]]:
    directories = sorted(p for p in root.iterdir() if p.is_dir() and p.name.endswith("_prompty"))
    if only_dir:
        directories = [p for p in directories if p.name == only_dir]
    if only_file:
        only_file_path = Path(only_file).expanduser().resolve()
        directories = [p for p in directories if p.resolve() == only_file_path.parent]
    return [aggregate_directory(directory, mode) for directory in directories]


def main() -> int:
    args = parse_args()
    root = Path(args.root).expanduser().resolve()
    report_dir = Path(args.report_dir).expanduser().resolve() if args.report_dir else root / "_reports"

    if not root.exists() or not root.is_dir():
        print(f"Root directory does not exist: {root}", file=sys.stderr)
        return 2

    if args.only_file:
        source = Path(args.only_file).expanduser().resolve()
        if not source.exists() or not source.is_file():
            print(f"Source file does not exist: {source}", file=sys.stderr)
            return 2
        files = [source]
    elif args.rebuild_aggregate:
        aggregates = rebuild_aggregates(root, args.mode, args.only_dir, args.only_file)
        report = {
            "root": str(root),
            "mode": args.mode,
            "rebuild_only": True,
            "aggregates": aggregates,
        }
        report_path = write_report(report_dir, report)
        failed = [item for item in aggregates if item["status"] == "failed"]
        print(f"Aggregate rebuild finished. Report: {report_path}")
        return 1 if failed else 0
    else:
        files = collect_source_files(root, args.only_dir)

    if not files:
        print("No source files found.")
        return 0

    file_results: list[FileResult] = []
    lock = threading.Lock()

    total_files = len(files)

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.parallel)) as executor:
        future_map = {executor.submit(process_file, source, args): source for source in files}
        for index, future in enumerate(concurrent.futures.as_completed(future_map), start=1):
            result = future.result()
            with lock:
                file_results.append(result)
                print(
                    f"[{index}/{total_files}] [{result.status}] {result.source} -> {result.output} "
                    f"(attempts={result.attempts}, items={result.items})"
                )
                if result.error:
                    print(f"  error: {result.error}")
                partial_report = build_report_data(root, args, file_results, [])
                write_report(report_dir, partial_report)

    directories_to_aggregate = sorted({str(Path(item.source).parent) for item in file_results})
    if args.only_file:
        directories_to_aggregate = [str(Path(args.only_file).expanduser().resolve().parent)]
    aggregates = [aggregate_directory(Path(directory), args.mode) for directory in directories_to_aggregate]

    report = build_report_data(root, args, file_results, aggregates)
    report_path = write_report(report_dir, report)
    print(f"Report written to {report_path}")

    failed_files = [result for result in file_results if result.status == "failed"]
    failed_aggregates = [item for item in aggregates if item["status"] == "failed"]
    return 1 if failed_files or failed_aggregates else 0


if __name__ == "__main__":
    raise SystemExit(main())
