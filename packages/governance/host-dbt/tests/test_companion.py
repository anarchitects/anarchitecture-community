"""Tests for the optional companion dbt package install helper."""

from __future__ import annotations

import subprocess
import sys
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from anarchitecture_dbt_governance.cli import main
from anarchitecture_dbt_governance.companion import (
    DEFAULT_COMPANION_GIT_URL,
    DEFAULT_COMPANION_REVISION,
    DEFAULT_COMPANION_SUBDIRECTORY,
    CompanionInstallOptions,
    build_companion_package_entry,
    handle_companion_install,
    render_packages_yml_fragment,
)


class CompanionInstallTests(unittest.TestCase):
    """Verify companion dbt package install helper behavior."""

    def test_print_only_renders_expected_yaml_fragment(self) -> None:
        entry = build_companion_package_entry(
            git=DEFAULT_COMPANION_GIT_URL,
            revision=DEFAULT_COMPANION_REVISION,
            subdirectory=DEFAULT_COMPANION_SUBDIRECTORY,
        )

        self.assertEqual(
            render_packages_yml_fragment(entry),
            (
                "packages:\n"
                '  - git: "https://github.com/anarchitects/anarchitecture-community.git"\n'
                '    revision: "governance-dbt-package@0.0.1"\n'
                '    subdirectory: "packages/governance/dbt-package"\n'
            ),
        )

    def test_companion_install_print_command_writes_stdout_only(self) -> None:
        output = StringIO()

        with redirect_stdout(output):
            exit_code = main(["companion", "install", "--print"])

        self.assertEqual(exit_code, 0)
        self.assertEqual(
            output.getvalue(),
            (
                "packages:\n"
                '  - git: "https://github.com/anarchitects/anarchitecture-community.git"\n'
                '    revision: "governance-dbt-package@0.0.1"\n'
                '    subdirectory: "packages/governance/dbt-package"\n\n'
            ),
        )

    def test_no_write_by_default(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"
            with redirect_stdout(output):
                exit_code = main(
                    [
                        "companion",
                        "install",
                        "--packages-file",
                        str(packages_file),
                    ]
                )

            self.assertFalse(packages_file.exists())

        self.assertEqual(exit_code, 0)
        self.assertIn("Dry run: no changes were written", output.getvalue())
        self.assertIn('revision: "governance-dbt-package@0.0.1"', output.getvalue())

    def test_write_creates_new_packages_file(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"
            with redirect_stdout(output):
                exit_code = main(
                    [
                        "companion",
                        "install",
                        "--write",
                        "--packages-file",
                        str(packages_file),
                    ]
                )

            payload = yaml.safe_load(packages_file.read_text(encoding="utf-8"))

        self.assertEqual(exit_code, 0)
        self.assertEqual(
            payload,
            {
                "packages": [
                    {
                        "git": DEFAULT_COMPANION_GIT_URL,
                        "revision": DEFAULT_COMPANION_REVISION,
                        "subdirectory": DEFAULT_COMPANION_SUBDIRECTORY,
                    }
                ]
            },
        )
        self.assertIn("Updated", output.getvalue())

    def test_write_appends_to_existing_packages_file(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"
            packages_file.write_text(
                "packages:\n  - package: dbt-labs/dbt_utils\n    version: 1.3.0\n",
                encoding="utf-8",
            )

            with redirect_stdout(output):
                exit_code = main(
                    [
                        "companion",
                        "install",
                        "--write",
                        "--packages-file",
                        str(packages_file),
                    ]
                )

            payload = yaml.safe_load(packages_file.read_text(encoding="utf-8"))

        self.assertEqual(exit_code, 0)
        self.assertEqual(
            payload["packages"][0],
            {"package": "dbt-labs/dbt_utils", "version": "1.3.0"},
        )
        self.assertEqual(payload["packages"][1]["git"], DEFAULT_COMPANION_GIT_URL)
        self.assertEqual(
            payload["packages"][1]["subdirectory"],
            DEFAULT_COMPANION_SUBDIRECTORY,
        )

    def test_write_avoids_duplicate_entry(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"
            packages_file.write_text(
                "packages:\n"
                '  - git: "https://github.com/anarchitects/anarchitecture-community.git"\n'
                '    revision: "governance-dbt-package@0.0.1"\n'
                '    subdirectory: "packages/governance/dbt-package"\n',
                encoding="utf-8",
            )

            with redirect_stdout(output):
                exit_code = main(
                    [
                        "companion",
                        "install",
                        "--write",
                        "--packages-file",
                        str(packages_file),
                    ]
                )

            payload = yaml.safe_load(packages_file.read_text(encoding="utf-8"))

        self.assertEqual(exit_code, 0)
        self.assertEqual(len(payload["packages"]), 1)
        self.assertIn("already exists", output.getvalue())
        self.assertIn("No package entry changes were required", output.getvalue())

    def test_write_preserves_multiple_existing_entries(self) -> None:
        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"
            packages_file.write_text(
                "packages:\n"
                "  - package: dbt-labs/dbt_utils\n"
                "    version: 1.3.0\n"
                "  - package: calogica/dbt_expectations\n"
                "    version: 0.10.3\n",
                encoding="utf-8",
            )

            exit_code = main(
                [
                    "companion",
                    "install",
                    "--write",
                    "--packages-file",
                    str(packages_file),
                ]
            )

            payload = yaml.safe_load(packages_file.read_text(encoding="utf-8"))

        self.assertEqual(exit_code, 0)
        self.assertEqual(len(payload["packages"]), 3)
        self.assertEqual(payload["packages"][0]["package"], "dbt-labs/dbt_utils")
        self.assertEqual(payload["packages"][1]["package"], "calogica/dbt_expectations")

    def test_invalid_yaml_is_reported_without_overwrite(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"
            original = "packages: [\n"
            packages_file.write_text(original, encoding="utf-8")

            with redirect_stdout(output):
                exit_code = main(
                    [
                        "companion",
                        "install",
                        "--write",
                        "--packages-file",
                        str(packages_file),
                    ]
                )

            self.assertEqual(packages_file.read_text(encoding="utf-8"), original)

        self.assertEqual(exit_code, 2)
        self.assertIn("invalid_packages_yaml", output.getvalue())
        self.assertIn("no changes were written", output.getvalue())

    def test_invalid_packages_shape_is_reported_without_overwrite(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"
            packages_file.write_text("packages:\n  version: 1\n", encoding="utf-8")

            with redirect_stdout(output):
                exit_code = main(
                    [
                        "companion",
                        "install",
                        "--write",
                        "--packages-file",
                        str(packages_file),
                    ]
                )

        self.assertEqual(exit_code, 2)
        self.assertIn("invalid_packages_shape", output.getvalue())

    def test_run_dbt_deps_requires_write(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"
            with redirect_stdout(output):
                exit_code = main(
                    [
                        "companion",
                        "install",
                        "--packages-file",
                        str(packages_file),
                        "--run-dbt-deps",
                    ]
                )

        self.assertEqual(exit_code, 2)
        self.assertIn("companion_requires_write", output.getvalue())

    @patch("anarchitecture_dbt_governance.companion.subprocess.run")
    def test_run_dbt_deps_only_runs_when_requested_after_write(self, run_mock) -> None:
        output = StringIO()
        run_mock.return_value = subprocess.CompletedProcess(
            args=["dbt", "deps"],
            returncode=0,
            stdout="deps ok\n",
            stderr="",
        )

        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"
            with redirect_stdout(output):
                exit_code = main(
                    [
                        "companion",
                        "install",
                        "--write",
                        "--packages-file",
                        str(packages_file),
                        "--run-dbt-deps",
                    ]
                )

        self.assertEqual(exit_code, 0)
        run_mock.assert_called_once()
        self.assertEqual(run_mock.call_args.kwargs["cwd"], packages_file.parent)
        self.assertIn("Ran dbt deps", output.getvalue())
        self.assertIn("deps ok", output.getvalue())

    @patch("anarchitecture_dbt_governance.companion.subprocess.run")
    def test_run_dbt_deps_is_not_called_for_print_or_dry_run(self, run_mock) -> None:
        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"

            exit_code = main(
                [
                    "companion",
                    "install",
                    "--print",
                    "--run-dbt-deps",
                ]
            )
            self.assertEqual(exit_code, 0)

            exit_code = main(
                [
                    "companion",
                    "install",
                    "--packages-file",
                    str(packages_file),
                ]
            )
            self.assertEqual(exit_code, 0)

        run_mock.assert_not_called()

    @patch("anarchitecture_dbt_governance.companion.subprocess.run")
    def test_run_dbt_deps_failure_is_reported_clearly(self, run_mock) -> None:
        output = StringIO()
        run_mock.return_value = subprocess.CompletedProcess(
            args=["dbt", "deps"],
            returncode=1,
            stdout="dbt deps stdout",
            stderr="dbt deps stderr",
        )

        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"
            with redirect_stdout(output):
                exit_code = main(
                    [
                        "companion",
                        "install",
                        "--write",
                        "--packages-file",
                        str(packages_file),
                        "--run-dbt-deps",
                    ]
                )

        self.assertEqual(exit_code, 2)
        self.assertIn("dbt_deps_failed", output.getvalue())
        self.assertIn("dbt stdout:", output.getvalue())
        self.assertIn("dbt stderr:", output.getvalue())

    def test_existing_entry_with_different_revision_is_not_duplicated(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"
            packages_file.write_text(
                "packages:\n"
                '  - git: "https://github.com/anarchitects/anarchitecture-community.git"\n'
                '    revision: "governance-dbt-package@0.0.9"\n'
                '    subdirectory: "packages/governance/dbt-package"\n',
                encoding="utf-8",
            )

            with redirect_stdout(output):
                exit_code = main(
                    [
                        "companion",
                        "install",
                        "--write",
                        "--packages-file",
                        str(packages_file),
                    ]
                )

            payload = yaml.safe_load(packages_file.read_text(encoding="utf-8"))

        self.assertEqual(exit_code, 0)
        self.assertEqual(len(payload["packages"]), 1)
        self.assertIn("different revision", output.getvalue())
        self.assertIn("governance-dbt-package@0.0.9", output.getvalue())

    def test_handle_companion_install_uses_safe_default_dry_run(self) -> None:
        with TemporaryDirectory() as temp_dir:
            packages_file = Path(temp_dir) / "packages.yml"
            result = handle_companion_install(
                CompanionInstallOptions(packages_file=str(packages_file)),
            )

        self.assertTrue(result.supported)
        self.assertFalse(result.wrote_file)
        self.assertFalse(packages_file.exists())
        self.assertIn("Dry run", result.output)


if __name__ == "__main__":
    unittest.main()
