"""CLI unit tests for the dbt Governance host scaffold."""

from __future__ import annotations

import os
import sys
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from anarchitecture_dbt_governance.cli import COMMANDS, build_parser, main
from anarchitecture_dbt_governance.compatibility import RuntimeManifest
from anarchitecture_dbt_governance.runtime_manager import (
    RuntimeEnvironmentReport,
    RuntimeEnvironmentResult,
    RuntimePackageResolution,
)


class CliTests(unittest.TestCase):
    """Verify the placeholder CLI surface."""

    def test_help_lists_placeholder_commands(self) -> None:
        help_text = build_parser().format_help()
        check_help_text = capture_help_output(["check", "--help"])

        for command in COMMANDS:
            self.assertIn(command, help_text)
        self.assertIn("--project-dir", check_help_text)
        self.assertIn("--target-path", check_help_text)
        self.assertIn("--parse", check_help_text)

    def test_check_command_resolves_project_from_current_directory(self) -> None:
        output = StringIO()
        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
            write_fixture_file(
                project_dir / "target" / "manifest.json",
                "this is not parsed as JSON",
            )
            executable_path = write_executable(project_dir / "dbt-governance-runtime")

            previous_cwd = Path.cwd()
            try:
                os.chdir(project_dir)
                with (
                    redirect_stdout(output),
                    patch(
                        "anarchitecture_dbt_governance.runtime_manager.doctor_runtime_environment",
                        return_value=create_runtime_environment_result(executable_path),
                    ),
                    patch(
                        "anarchitecture_dbt_governance.runtime_invocation._run_runtime_process",
                        return_value=create_runtime_completed_process(),
                    ),
                ):
                    exit_code = main(["check"])
            finally:
                os.chdir(previous_cwd)

        self.assertEqual(exit_code, 0)
        self.assertIn("Resolved dbt project:", output.getvalue())
        self.assertIn(
            "Runtime handoff completed via dbt-governance-runtime.",
            output.getvalue(),
        )

    def test_check_command_reports_missing_manifest_without_parse(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")

            with redirect_stdout(output):
                exit_code = main(["check", "--project-dir", str(project_dir)])

        self.assertEqual(exit_code, 1)
        self.assertIn(
            "governance.host_dbt.missing_manifest",
            output.getvalue(),
        )

    @patch("anarchitecture_dbt_governance.runtime_invocation._run_runtime_process")
    @patch("anarchitecture_dbt_governance.artifact_manager.subprocess.run")
    def test_check_command_invokes_dbt_parse_when_requested(
        self,
        artifact_run_mock,
        runtime_process_mock,
    ) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            target_dir = project_dir / "target"
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
            executable_path = write_executable(project_dir / "dbt-governance-runtime")

            def fake_run(*args, **kwargs):  # type: ignore[no-untyped-def]
                write_fixture_file(target_dir / "manifest.json", '{"metadata":{}}')
                return create_completed_process()

            artifact_run_mock.side_effect = fake_run
            runtime_process_mock.return_value = create_runtime_completed_process()

            with (
                redirect_stdout(output),
                patch(
                    "anarchitecture_dbt_governance.runtime_manager.doctor_runtime_environment",
                    return_value=create_runtime_environment_result(executable_path),
                ),
            ):
                exit_code = main(
                    [
                        "check",
                        "--project-dir",
                        str(project_dir),
                        "--parse",
                    ]
                )

        self.assertEqual(exit_code, 0)
        self.assertIn("dbt parse was invoked", output.getvalue())
        self.assertIn("Runtime JSON result:", output.getvalue())


if __name__ == "__main__":
    unittest.main()


def write_fixture_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def create_completed_process():  # type: ignore[no-untyped-def]
    import subprocess

    return subprocess.CompletedProcess(
        args=["dbt", "parse"],
        returncode=0,
        stdout="ok",
        stderr="",
    )


def create_runtime_completed_process():  # type: ignore[no-untyped-def]
    import subprocess

    return subprocess.CompletedProcess(
        args=["dbt-governance-runtime"],
        returncode=0,
        stdout=(
            '{"ok": true, "runtime": {"packageName": '
            '"@anarchitects/governance-runtime-dbt", "version": "0.0.1"}}'
        ),
        stderr="",
    )


def create_runtime_environment_result(
    executable_path: Path,
) -> RuntimeEnvironmentResult:
    return RuntimeEnvironmentResult(
        supported=True,
        diagnostics=[],
        report=RuntimeEnvironmentReport(
            host_version="0.0.1",
            manifest=RuntimeManifest(
                runtime_package="@anarchitects/governance-runtime-dbt",
                runtime_version="0.0.1",
                node_range=">=20 <25",
                contract_version="1.0.0",
            ),
            repo_package_manager="yarn",
            node_version="v20.11.1",
            node_supported=True,
            package_manager=None,
            runtime_resolution=RuntimePackageResolution(
                cache_dir=executable_path.parent,
                package_dir=executable_path.parent,
                package_name="@anarchitects/governance-runtime-dbt",
                package_version="0.0.1",
                executable_path=executable_path,
            ),
            runtime_compatible=True,
        ),
    )


def write_executable(path: Path) -> Path:
    path.write_text("#!/usr/bin/env node\n", encoding="utf-8")
    return path


def capture_help_output(argv: list[str]) -> str:
    output = StringIO()

    with redirect_stdout(output), unittest.TestCase().assertRaises(SystemExit):
        build_parser().parse_args(argv)

    return output.getvalue()
