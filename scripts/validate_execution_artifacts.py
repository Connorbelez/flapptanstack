#!/usr/bin/env python3
"""
Validate execution artifacts for linear-implement-v2.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


ROOT_REQUIRED = [
    "summary.md",
    "execution-checklist.md",
    "tasks.md",
    "status.md",
    "audit.md",
    "chunks/manifest.md",
]

OVERALL_STATUSES = {"planning", "in-progress", "complete", "partial", "blocked"}
CHUNK_STATUSES = {"pending", "in-progress", "complete", "partial", "blocked"}
AUDIT_VERDICTS = {"not-run", "ready", "not ready", "needs manual validation", "blocked by ambiguous spec"}


def read_text(path: Path) -> str:
    return path.read_text()


def find_todos(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if "TODO:" in line]


def extract_overall_status(status_text: str) -> str | None:
    match = re.search(r"^- Overall status:\s*(.+)$", status_text, re.MULTILINE)
    return match.group(1).strip() if match else None


def extract_audit_verdict(audit_text: str) -> str | None:
    match = re.search(r"^- Verdict:\s*(.+)$", audit_text, re.MULTILINE)
    return match.group(1).strip() if match else None


def manifest_chunk_rows(manifest_text: str) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    for line in manifest_text.splitlines():
        if not line.startswith("| chunk-"):
            continue
        parts = [part.strip() for part in line.strip("|").split("|")]
        if len(parts) < 4:
            continue
        rows.append((parts[0], parts[2]))
    return rows


def task_ids_present(text: str) -> bool:
    return bool(re.search(r"- \[[ x]\] T-\d{3}:", text))


def unchecked_boxes(text: str) -> list[str]:
    return re.findall(r"^- \[ \] .+$", text, re.MULTILINE)


def checklist_items_present(checklist_text: str) -> bool:
    return checklist_text.count("- [ ]") + checklist_text.count("- [x]") >= 2


def chunk_dirs(spec_dir: Path) -> list[Path]:
    chunks_root = spec_dir / "chunks"
    if not chunks_root.exists():
        return []
    return sorted(path for path in chunks_root.iterdir() if path.is_dir() and path.name.startswith("chunk-"))


def validate_exists(spec_dir: Path, errors: list[str]) -> None:
    for relative in ROOT_REQUIRED:
        path = spec_dir / relative
        if not path.exists():
            errors.append(f"Missing required artifact: {path}")


def validate_ready_to_edit(spec_dir: Path, errors: list[str]) -> None:
    summary = read_text(spec_dir / "summary.md")
    checklist = read_text(spec_dir / "execution-checklist.md")
    tasks = read_text(spec_dir / "tasks.md")
    status = read_text(spec_dir / "status.md")
    manifest = read_text(spec_dir / "chunks/manifest.md")

    files_to_check = [
        ("summary.md", summary),
        ("execution-checklist.md", checklist),
        ("tasks.md", tasks),
        ("status.md", status),
        ("chunks/manifest.md", manifest),
    ]
    for name, text in files_to_check:
        todos = find_todos(text)
        if todos:
            errors.append(f"{name} still contains TODO markers: {todos[0]}")

    if not checklist_items_present(checklist):
        errors.append("execution-checklist.md does not contain checklist items.")
    if not task_ids_present(tasks):
        errors.append("tasks.md does not contain concrete task IDs.")

    manifest_rows = manifest_chunk_rows(manifest)
    if not manifest_rows:
        errors.append("chunks/manifest.md does not contain any chunk rows.")
    for chunk_name, status_value in manifest_rows:
        if status_value not in CHUNK_STATUSES:
            errors.append(f"Chunk {chunk_name} has invalid status '{status_value}'.")

    overall_status = extract_overall_status(status)
    if overall_status not in OVERALL_STATUSES:
        errors.append("status.md is missing a valid overall status.")

    chunk_directories = chunk_dirs(spec_dir)
    if not chunk_directories:
        errors.append("No chunk directories exist under specs/<issue-key>/chunks.")
    for chunk_dir in chunk_directories:
        for filename in ("context.md", "tasks.md", "status.md"):
            path = chunk_dir / filename
            if not path.exists():
                errors.append(f"Missing chunk artifact: {path}")
                continue
            todos = find_todos(read_text(path))
            if todos:
                errors.append(f"{path.relative_to(spec_dir)} still contains TODO markers: {todos[0]}")

    manifest_chunk_names = {name for name, _ in manifest_rows}
    actual_chunk_names = {path.name for path in chunk_directories}
    missing_manifest = sorted(actual_chunk_names - manifest_chunk_names)
    if missing_manifest:
        errors.append(f"Chunk directories missing from manifest: {', '.join(missing_manifest)}")
    missing_dirs = sorted(manifest_chunk_names - actual_chunk_names)
    if missing_dirs:
        errors.append(f"Manifest chunks missing directories: {', '.join(missing_dirs)}")


def validate_final(spec_dir: Path, errors: list[str], require_audit: bool, require_all_tasks_closed: bool, require_all_checklist_closed: bool) -> None:
    validate_ready_to_edit(spec_dir, errors)

    audit = read_text(spec_dir / "audit.md")
    verdict = extract_audit_verdict(audit)
    if require_audit and verdict == "not-run":
        errors.append("audit.md still shows Verdict: not-run.")
    if verdict not in AUDIT_VERDICTS:
        errors.append("audit.md is missing a valid verdict.")
    if require_audit:
        todos = find_todos(audit)
        if todos:
            errors.append(f"audit.md still contains TODO markers: {todos[0]}")

    status = read_text(spec_dir / "status.md")
    overall_status = extract_overall_status(status)
    if overall_status not in {"complete", "partial", "blocked"}:
        errors.append("status.md overall status must be complete, partial, or blocked for final validation.")

    if require_all_tasks_closed:
        tasks_text = read_text(spec_dir / "tasks.md")
        open_tasks = unchecked_boxes(tasks_text)
        if open_tasks:
            errors.append(f"tasks.md still has open tasks: {open_tasks[0]}")
        for chunk_dir in chunk_dirs(spec_dir):
            open_chunk_tasks = unchecked_boxes(read_text(chunk_dir / "tasks.md"))
            if open_chunk_tasks:
                errors.append(f"{chunk_dir.name}/tasks.md still has open tasks: {open_chunk_tasks[0]}")

    if require_all_checklist_closed:
        checklist_text = read_text(spec_dir / "execution-checklist.md")
        open_items = unchecked_boxes(checklist_text)
        if open_items:
            errors.append(f"execution-checklist.md still has open items: {open_items[0]}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate specs/<issue-key>/ execution artifacts.")
    parser.add_argument("issue_key", help="Linear issue key, for example FAI-123")
    parser.add_argument("--repo-root", required=True, help="Repository root where specs/ lives")
    parser.add_argument(
        "--stage",
        choices=("scaffolded", "ready-to-edit", "final"),
        required=True,
        help="Validation stage",
    )
    parser.add_argument("--require-audit", action="store_true", help="Require audit.md to contain a real verdict.")
    parser.add_argument("--require-all-tasks-closed", action="store_true", help="Require all tasks to be checked off.")
    parser.add_argument(
        "--require-all-checklist-closed",
        action="store_true",
        help="Require all execution checklist items to be checked off.",
    )
    args = parser.parse_args()

    spec_dir = Path(args.repo_root).resolve() / "specs" / args.issue_key
    errors: list[str] = []

    if not spec_dir.exists():
        errors.append(f"Missing specs directory: {spec_dir}")
    else:
        validate_exists(spec_dir, errors)
        if not errors and args.stage == "ready-to-edit":
            validate_ready_to_edit(spec_dir, errors)
        elif not errors and args.stage == "final":
            validate_final(
                spec_dir,
                errors,
                require_audit=args.require_audit,
                require_all_tasks_closed=args.require_all_tasks_closed,
                require_all_checklist_closed=args.require_all_checklist_closed,
            )

    if errors:
        print("Execution artifact validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Execution artifacts valid for stage '{args.stage}': {spec_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
