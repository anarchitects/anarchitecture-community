"""CLI unit tests for the dbt Governance host scaffold."""

from __future__ import annotations

import sys
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from anarchitecture_dbt_governance.cli import COMMANDS, build_parser, main


class CliTests(unittest.TestCase):
    """Verify the placeholder CLI surface."""

    def test_help_lists_placeholder_commands(self) -> None:
        help_text = build_parser().format_help()

        for command in COMMANDS:
            self.assertIn(command, help_text)

    def test_placeholder_command_exits_cleanly(self) -> None:
        output = StringIO()

        with redirect_stdout(output):
            exit_code = main(["check"])

        self.assertEqual(exit_code, 0)
        self.assertIn("dbt-governance check is not implemented yet.", output.getvalue())


if __name__ == "__main__":
    unittest.main()
