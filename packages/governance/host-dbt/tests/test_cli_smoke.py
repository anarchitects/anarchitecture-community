"""Smoke tests for direct CLI execution."""

from __future__ import annotations

import os
import subprocess
import sys
import unittest
from pathlib import Path


class CliSmokeTests(unittest.TestCase):
    """Exercise the module entrypoint from a subprocess."""

    def test_module_help_succeeds(self) -> None:
        package_root = Path(__file__).resolve().parents[1]
        env = os.environ.copy()
        existing_pythonpath = env.get("PYTHONPATH")
        src_path = str(package_root / "src")
        env["PYTHONPATH"] = (
            src_path if not existing_pythonpath else f"{src_path}:{existing_pythonpath}"
        )
        completed = subprocess.run(
            [sys.executable, "-m", "anarchitecture_dbt_governance.cli", "--help"],
            cwd=package_root,
            capture_output=True,
            text=True,
            check=False,
            env=env,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn("dbt-governance", completed.stdout)
        self.assertIn("check", completed.stdout)
        self.assertIn("report", completed.stdout)


if __name__ == "__main__":
    unittest.main()
