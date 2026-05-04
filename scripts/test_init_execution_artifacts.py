#!/usr/bin/env python3
"""
Smoke checks for init_execution_artifacts.py path validation.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("init_execution_artifacts.py")


class InitExecutionArtifactsSmokeTest(unittest.TestCase):
    def run_init(self, repo_root: Path, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                *args,
                "--title",
                "Smoke Test",
                "--repo-root",
                str(repo_root),
            ],
            check=False,
            stderr=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
        )

    def test_valid_issue_and_chunk_scaffold_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            repo_root = Path(temp_dir)

            result = self.run_init(repo_root, "ENG-999", "--chunk", "chunk-01-ui")

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((repo_root / "specs" / "ENG-999" / "summary.md").exists())
            self.assertTrue(
                (
                    repo_root
                    / "specs"
                    / "ENG-999"
                    / "chunks"
                    / "chunk-01-ui"
                    / "context.md"
                ).exists()
            )

    def test_invalid_issue_key_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            repo_root = Path(temp_dir)

            result = self.run_init(repo_root, "../ENG-999")

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Invalid issue key", result.stderr)
            self.assertFalse((repo_root.parent / "ENG-999").exists())

    def test_invalid_chunk_name_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            repo_root = Path(temp_dir)

            result = self.run_init(repo_root, "ENG-999", "--chunk", "../chunk-01-ui")

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Invalid chunk name", result.stderr)
            self.assertFalse((repo_root / "specs" / "ENG-999").exists())

    def test_resolved_specs_symlink_cannot_escape_repo_root(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            repo_root = temp_root / "repo"
            outside_root = temp_root / "outside"
            repo_root.mkdir()
            outside_root.mkdir()
            (repo_root / "specs").symlink_to(outside_root, target_is_directory=True)

            result = self.run_init(repo_root, "ENG-999")

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("escapes repository root", result.stderr)
            self.assertFalse((outside_root / "ENG-999").exists())


if __name__ == "__main__":
    unittest.main()
