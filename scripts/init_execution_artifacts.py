#!/usr/bin/env python3
"""
Scaffold execution artifacts for linear-implement-v2.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from textwrap import dedent


def write_if_missing(path: Path, content: str) -> tuple[str, Path]:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return "preserved", path
    path.write_text(content)
    return "created", path


def summary_template(issue_key: str, title: str, issue_url: str, plan_url: str, supporting_docs: list[str]) -> str:
    supporting_block = "\n".join(f"- {doc}" for doc in supporting_docs) or "- TODO: add any directly relevant supporting docs"
    return dedent(
        f"""\
        # Summary: {issue_key} - {title}

        - Source issue: {issue_url or issue_key}
        - Primary plan: {plan_url or "TODO: add Notion implementation plan URL"}
        - Supporting docs:
        {supporting_block}

        ## Scope
        - TODO: summarize in-scope deliverables from the Linear issue and implementation plan

        ## Constraints
        - TODO: list the architectural, business, auth, and rollout constraints that must not be violated

        ## Open questions
        - TODO: list only unresolved questions that materially affect implementation, or replace with "none"
        """
    )


def checklist_template(issue_key: str, title: str) -> str:
    return dedent(
        f"""\
        # Execution Checklist: {issue_key} - {title}

        ## Requirements From Linear
        - [ ] TODO: copy the first explicit requirement from the Linear issue

        ## Definition Of Done From Linear
        - [ ] TODO: copy the first definition-of-done item from the Linear issue

        ## Agent Instructions
        - Keep this file current as work progresses.
        - Do not mark an item complete unless code, tests, and validation support it.
        - If an item is blocked or inapplicable, note the reason directly under the item.

        ## Test Coverage Expectations
        - [ ] TODO: confirm required unit test work
        - [ ] TODO: confirm required e2e test work
        - [ ] TODO: confirm required Storybook work or record why it is not applicable

        ## Final Validation
        - [ ] TODO: all requirements are satisfied
        - [ ] TODO: all definition-of-done items are satisfied
        - [ ] TODO: required quality gates passed
        - [ ] TODO: final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded
        """
    )


def tasks_template(issue_key: str, title: str) -> str:
    return dedent(
        f"""\
        # Tasks: {issue_key} - {title}

        ## Status Rules
        - Keep task IDs stable.
        - Add new tasks before editing newly discovered scope.
        - Do not silently drop tasks; mark them complete or note the blocker.

        ## Phase 1: Planning
        - [ ] T-001: TODO finalize implementation task list and chunk plan

        ## Phase 2: Implementation
        - [ ] T-010: TODO add the first concrete implementation task

        ## Phase 9: Audit
        - [ ] T-910: TODO run `$linear-pr-spec-audit`
        - [ ] T-920: TODO resolve audit findings or record blockers
        """
    )


def status_template(issue_key: str, title: str) -> str:
    return dedent(
        f"""\
        # Execution Status: {issue_key} - {title}

        - Overall status: planning
        - Current phase: context-gathering
        - Current chunk: none
        - Last updated: TODO: replace with a timestamp

        ## Active focus
        - TODO: describe the current focus

        ## Blockers
        - none

        ## Notes
        - TODO: capture important implementation state
        """
    )


def audit_template(issue_key: str, title: str) -> str:
    return dedent(
        f"""\
        # Spec Audit: {issue_key} - {title}

        - Audit skill: `$linear-pr-spec-audit`
        - Review target: TODO: add PR URL, PR number, or branch diff description
        - Last run: TODO: replace with a timestamp
        - Verdict: not-run

        ## Findings
        - TODO: summarize the top finding or replace with "none" after the audit runs

        ## Unresolved items
        - TODO: list any unresolved gaps or replace with "none"

        ## Next action
        - TODO: add the next fix or rerun step
        """
    )


def manifest_template(issue_key: str, title: str) -> str:
    return dedent(
        f"""\
        # Chunk Manifest: {issue_key} - {title}

        | Chunk | Tasks | Status | Notes |
        | ----- | ----- | ------ | ----- |
        | TODO | TODO | pending | define chunks before editing code |
        """
    )


def chunk_context_template(chunk_name: str) -> str:
    return dedent(
        f"""\
        # Chunk Context: {chunk_name}

        ## Goal
        - TODO: describe what this chunk delivers

        ## Relevant plan excerpts
        - TODO: copy the exact excerpts that matter

        ## Implementation notes
        - TODO: summarize the architecture notes needed for this chunk

        ## Existing code touchpoints
        - TODO: list files, symbols, or GitNexus findings

        ## Validation
        - TODO: list the checks or tests that should pass for this chunk
        """
    )


def chunk_tasks_template(chunk_name: str) -> str:
    return dedent(
        f"""\
        # Chunk: {chunk_name}

        - [ ] TODO: add the chunk's first concrete task ID and description
        """
    )


def chunk_status_template(chunk_name: str) -> str:
    return dedent(
        f"""\
        # Status: {chunk_name}

        - Result: pending
        - Last updated: TODO: replace with a timestamp

        ## Completed tasks
        - none

        ## Validation
        - TODO: add `<command>: pass|fail|not-run`

        ## Notes
        - TODO: add blockers, follow-ups, or scope changes
        """
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Scaffold specs/<issue-key>/ execution artifacts.")
    parser.add_argument("issue_key", help="Linear issue key, for example FAI-123")
    parser.add_argument("--title", required=True, help="Issue title")
    parser.add_argument("--repo-root", required=True, help="Repository root where specs/ lives")
    parser.add_argument("--issue-url", default="", help="Linear issue URL")
    parser.add_argument("--plan-url", default="", help="Primary Notion plan URL")
    parser.add_argument(
        "--supporting-doc",
        action="append",
        default=[],
        help="Supporting doc URL or identifier. Repeat for multiple docs.",
    )
    parser.add_argument(
        "--chunk",
        action="append",
        default=[],
        help="Chunk name like chunk-01-schema. Repeat to create multiple chunk directories.",
    )
    args = parser.parse_args()

    spec_dir = Path(args.repo_root).resolve() / "specs" / args.issue_key
    chunks_dir = spec_dir / "chunks"

    operations: list[tuple[str, Path]] = []
    operations.append(
        write_if_missing(
            spec_dir / "summary.md",
            summary_template(args.issue_key, args.title, args.issue_url, args.plan_url, args.supporting_doc),
        )
    )
    operations.append(write_if_missing(spec_dir / "execution-checklist.md", checklist_template(args.issue_key, args.title)))
    operations.append(write_if_missing(spec_dir / "tasks.md", tasks_template(args.issue_key, args.title)))
    operations.append(write_if_missing(spec_dir / "status.md", status_template(args.issue_key, args.title)))
    operations.append(write_if_missing(spec_dir / "audit.md", audit_template(args.issue_key, args.title)))
    operations.append(write_if_missing(chunks_dir / "manifest.md", manifest_template(args.issue_key, args.title)))

    for chunk_name in args.chunk:
        chunk_dir = chunks_dir / chunk_name
        operations.append(write_if_missing(chunk_dir / "context.md", chunk_context_template(chunk_name)))
        operations.append(write_if_missing(chunk_dir / "tasks.md", chunk_tasks_template(chunk_name)))
        operations.append(write_if_missing(chunk_dir / "status.md", chunk_status_template(chunk_name)))

    print(f"Scaffolded execution artifacts at {spec_dir}")
    for action, path in operations:
        print(f"{action}: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
