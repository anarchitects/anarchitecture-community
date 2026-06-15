"""CLI unit tests for the dbt Governance host scaffold."""

from __future__ import annotations

import json
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
from anarchitecture_dbt_governance.dbt_project import HostDiagnostic
from anarchitecture_dbt_governance.runtime_manager import (
    RuntimeEnvironmentReport,
    RuntimeEnvironmentResult,
    RuntimePackageResolution,
)


class CliTests(unittest.TestCase):
    """Verify the host CLI surface."""

    def test_help_lists_placeholder_commands(self) -> None:
        help_text = build_parser().format_help()
        check_help_text = capture_help_output(["check", "--help"])

        for command in COMMANDS:
            self.assertIn(command, help_text)
        self.assertIn("--project-dir", check_help_text)
        self.assertIn("--target-path", check_help_text)
        self.assertIn("--parse", check_help_text)
        self.assertIn("--json", check_help_text)
        self.assertIn("--config", check_help_text)
        report_help_text = capture_help_output(["report", "--help"])
        self.assertIn("--format", report_help_text)
        self.assertIn("--report-path", report_help_text)
        init_help_text = capture_help_output(["init", "--help"])
        self.assertIn("--force", init_help_text)

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
                        return_value=create_runtime_completed_process(
                            sample_runtime_result(),
                        ),
                    ),
                ):
                    exit_code = main(["check"])
            finally:
                os.chdir(previous_cwd)

        self.assertEqual(exit_code, 0)
        self.assertIn("Project:", output.getvalue())
        self.assertIn("Governance status:", output.getvalue())
        self.assertNotIn("Runtime JSON result:", output.getvalue())

    def test_check_command_reports_missing_manifest_without_parse(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")

            with redirect_stdout(output):
                exit_code = main(["check", "--project-dir", str(project_dir)])

        self.assertEqual(exit_code, 2)
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
            runtime_process_mock.return_value = create_runtime_completed_process(
                sample_runtime_result(),
            )

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
        self.assertIn("Artifact source: dbt parse", output.getvalue())
        self.assertIn("Blocking violations: 0", output.getvalue())

    def test_check_json_writes_machine_readable_output_only(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
            write_fixture_file(
                project_dir / "target" / "manifest.json",
                "this is not parsed as JSON",
            )
            executable_path = write_executable(project_dir / "dbt-governance-runtime")

            with (
                redirect_stdout(output),
                patch(
                    "anarchitecture_dbt_governance.runtime_manager.doctor_runtime_environment",
                    return_value=create_runtime_environment_result(executable_path),
                ),
                patch(
                    "anarchitecture_dbt_governance.runtime_invocation._run_runtime_process",
                    return_value=create_runtime_completed_process(
                        sample_runtime_result(),
                    ),
                ),
            ):
                exit_code = main(["check", "--project-dir", str(project_dir), "--json"])

        payload = json.loads(output.getvalue())
        self.assertEqual(exit_code, 0)
        self.assertEqual(payload["host"]["command"], "check")
        self.assertEqual(payload["result"]["ok"], True)
        self.assertNotIn("dbt-governance check", output.getvalue())

    def test_default_governance_yml_loads_when_present(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
            write_fixture_file(
                project_dir / "target" / "manifest.json",
                "this is not parsed as JSON",
            )
            write_fixture_file(
                project_dir / "governance.yml",
                (
                    "runtime:\n"
                    "  reportPath: target/from-config-report.json\n"
                    "host:\n"
                    "  output: json\n"
                ),
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
                        return_value=create_runtime_completed_process(
                            sample_runtime_result(),
                        ),
                    ),
                ):
                    exit_code = main(["check"])
            finally:
                os.chdir(previous_cwd)

            payload = json.loads(output.getvalue())
            written_report = json.loads(
                (project_dir / "target" / "from-config-report.json").read_text(
                    encoding="utf-8"
                )
            )

        self.assertEqual(exit_code, 0)
        self.assertEqual(payload["host"]["command"], "check")
        self.assertEqual(
            written_report["host"]["reportPath"],
            str((project_dir / "target" / "from-config-report.json").resolve()),
        )

    def test_config_adapter_project_dir_routes_to_check_flow(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            project_dir = root / "analytics"
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
            write_fixture_file(
                project_dir / "target" / "manifest.json",
                "this is not parsed as JSON",
            )
            write_fixture_file(
                root / "governance.yml",
                (
                    "adapter:\n"
                    "  paths:\n"
                    "    projectDir: analytics\n"
                    "host:\n"
                    "  output: json\n"
                ),
            )
            executable_path = write_executable(root / "dbt-governance-runtime")

            previous_cwd = Path.cwd()
            try:
                os.chdir(root)
                with (
                    redirect_stdout(output),
                    patch(
                        "anarchitecture_dbt_governance.runtime_manager.doctor_runtime_environment",
                        return_value=create_runtime_environment_result(executable_path),
                    ),
                    patch(
                        "anarchitecture_dbt_governance.runtime_invocation._run_runtime_process",
                        return_value=create_runtime_completed_process(
                            sample_runtime_result(),
                        ),
                    ),
                ):
                    exit_code = main(["check"])
            finally:
                os.chdir(previous_cwd)

        payload = json.loads(output.getvalue())
        self.assertEqual(exit_code, 0)
        self.assertEqual(payload["artifacts"]["projectDir"], str(project_dir.resolve()))

    def test_check_cli_flags_override_governance_yml(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            config_project = root / "configured"
            cli_project = root / "cli-project"
            write_fixture_file(config_project / "dbt_project.yml", "name: configured\n")
            write_fixture_file(
                config_project / "target" / "manifest.json",
                "configured-manifest",
            )
            write_fixture_file(cli_project / "dbt_project.yml", "name: cli\n")
            write_fixture_file(
                cli_project / "target" / "manifest.json",
                "cli-manifest",
            )
            write_fixture_file(
                root / "governance.yml",
                (
                    "adapter:\n"
                    "  paths:\n"
                    "    projectDir: configured\n"
                    "runtime:\n"
                    "  reportPath: configured-report.json\n"
                    "host:\n"
                    "  output: human\n"
                ),
            )
            cli_report_path = root / "cli-report.json"
            executable_path = write_executable(root / "dbt-governance-runtime")

            previous_cwd = Path.cwd()
            try:
                os.chdir(root)
                with (
                    redirect_stdout(output),
                    patch(
                        "anarchitecture_dbt_governance.runtime_manager.doctor_runtime_environment",
                        return_value=create_runtime_environment_result(executable_path),
                    ),
                    patch(
                        "anarchitecture_dbt_governance.runtime_invocation._run_runtime_process",
                        return_value=create_runtime_completed_process(
                            sample_runtime_result(),
                        ),
                    ),
                ):
                    exit_code = main(
                        [
                            "check",
                            "--project-dir",
                            str(cli_project),
                            "--report-path",
                            str(cli_report_path),
                        ]
                    )
            finally:
                os.chdir(previous_cwd)

            payload = json.loads(cli_report_path.read_text(encoding="utf-8"))

        self.assertEqual(exit_code, 0)
        self.assertEqual(
            payload["artifacts"]["projectDir"],
            str(cli_project.resolve()),
        )
        self.assertEqual(payload["host"]["reportPath"], str(cli_report_path.resolve()))

    def test_explicit_missing_config_returns_failure(self) -> None:
        output = StringIO()

        with TemporaryDirectory(), redirect_stdout(output):
            exit_code = main(["check", "--config", "missing-governance.yml"])

        self.assertEqual(exit_code, 2)
        self.assertIn("config_file_not_found", output.getvalue())

    def test_check_report_path_writes_json_report(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            report_path = project_dir / "target" / "governance-report.json"
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
            write_fixture_file(
                project_dir / "target" / "manifest.json",
                "this is not parsed as JSON",
            )
            executable_path = write_executable(project_dir / "dbt-governance-runtime")

            with (
                redirect_stdout(output),
                patch(
                    "anarchitecture_dbt_governance.runtime_manager.doctor_runtime_environment",
                    return_value=create_runtime_environment_result(executable_path),
                ),
                patch(
                    "anarchitecture_dbt_governance.runtime_invocation._run_runtime_process",
                    return_value=create_runtime_completed_process(
                        sample_runtime_result(),
                    ),
                ),
            ):
                exit_code = main(
                    [
                        "check",
                        "--project-dir",
                        str(project_dir),
                        "--report-path",
                        str(report_path),
                    ]
                )

            payload = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(exit_code, 0)
            self.assertEqual(payload["host"]["reportPath"], str(report_path.resolve()))
            self.assertEqual(payload["result"]["ok"], True)
            self.assertIn("Report path:", output.getvalue())

    def test_report_json_emits_json_report(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
            write_fixture_file(
                project_dir / "target" / "manifest.json",
                "this is not parsed as JSON",
            )
            executable_path = write_executable(project_dir / "dbt-governance-runtime")

            with (
                redirect_stdout(output),
                patch(
                    "anarchitecture_dbt_governance.runtime_manager.doctor_runtime_environment",
                    return_value=create_runtime_environment_result(executable_path),
                ),
                patch(
                    "anarchitecture_dbt_governance.runtime_invocation._run_runtime_process",
                    return_value=create_runtime_completed_process(
                        sample_runtime_result(),
                    ),
                ),
            ):
                exit_code = main(
                    [
                        "report",
                        "--project-dir",
                        str(project_dir),
                        "--format",
                        "json",
                    ]
                )

        payload = json.loads(output.getvalue())
        self.assertEqual(exit_code, 0)
        self.assertEqual(payload["host"]["command"], "report")
        self.assertEqual(payload["result"]["ok"], True)

    def test_report_markdown_emits_markdown_report(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
            write_fixture_file(
                project_dir / "target" / "manifest.json",
                "this is not parsed as JSON",
            )
            executable_path = write_executable(project_dir / "dbt-governance-runtime")

            with (
                redirect_stdout(output),
                patch(
                    "anarchitecture_dbt_governance.runtime_manager.doctor_runtime_environment",
                    return_value=create_runtime_environment_result(executable_path),
                ),
                patch(
                    "anarchitecture_dbt_governance.runtime_invocation._run_runtime_process",
                    return_value=create_runtime_completed_process(
                        sample_runtime_result(),
                    ),
                ),
            ):
                exit_code = main(
                    [
                        "report",
                        "--project-dir",
                        str(project_dir),
                        "--format",
                        "markdown",
                    ]
                )

        self.assertEqual(exit_code, 0)
        self.assertIn("# dbt Governance Report", output.getvalue())
        self.assertIn("## Summary", output.getvalue())

    def test_check_returns_blocking_violation_exit_code(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
            write_fixture_file(
                project_dir / "target" / "manifest.json",
                "this is not parsed as JSON",
            )
            executable_path = write_executable(project_dir / "dbt-governance-runtime")

            with (
                redirect_stdout(output),
                patch(
                    "anarchitecture_dbt_governance.runtime_manager.doctor_runtime_environment",
                    return_value=create_runtime_environment_result(executable_path),
                ),
                patch(
                    "anarchitecture_dbt_governance.runtime_invocation._run_runtime_process",
                    return_value=create_runtime_completed_process(
                        sample_runtime_result(blocking=True),
                    ),
                ),
            ):
                exit_code = main(["check", "--project-dir", str(project_dir)])

        self.assertEqual(exit_code, 1)
        self.assertIn("Blocking violations: 1", output.getvalue())

    def test_check_invalid_runtime_json_returns_invocation_failure(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
            write_fixture_file(
                project_dir / "target" / "manifest.json",
                "this is not parsed as JSON",
            )
            executable_path = write_executable(project_dir / "dbt-governance-runtime")

            with (
                redirect_stdout(output),
                patch(
                    "anarchitecture_dbt_governance.runtime_manager.doctor_runtime_environment",
                    return_value=create_runtime_environment_result(executable_path),
                ),
                patch(
                    "anarchitecture_dbt_governance.runtime_invocation._run_runtime_process",
                    return_value=create_runtime_completed_process(
                        "not-json",
                    ),
                ),
            ):
                exit_code = main(["check", "--project-dir", str(project_dir)])

        self.assertEqual(exit_code, 2)
        self.assertIn("runtime_invalid_json_output", output.getvalue())

    def test_check_incompatible_runtime_returns_exit_code_three(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
            write_fixture_file(
                project_dir / "target" / "manifest.json",
                "this is not parsed as JSON",
            )

            with (
                redirect_stdout(output),
                patch(
                    "anarchitecture_dbt_governance.runtime_manager.doctor_runtime_environment",
                    return_value=create_incompatible_runtime_environment_result(),
                ),
            ):
                exit_code = main(["check", "--project-dir", str(project_dir)])

        self.assertEqual(exit_code, 3)
        self.assertIn("unsupported_node_version", output.getvalue())

    def test_init_creates_governance_yml(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            with redirect_stdout(output):
                exit_code = main(["init", "--project-dir", str(project_dir)])

            config_text = (project_dir / "governance.yml").read_text(encoding="utf-8")

        self.assertEqual(exit_code, 0)
        self.assertIn("Created governance config:", output.getvalue())
        self.assertIn("profile:", config_text)
        self.assertIn("adapter:", config_text)
        self.assertIn("extension:", config_text)
        self.assertIn("runtime:", config_text)
        self.assertIn("host:", config_text)

    def test_init_refuses_to_overwrite_existing_config(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(
                project_dir / "governance.yml",
                "host:\n  output: json\n",
            )
            with redirect_stdout(output):
                exit_code = main(["init", "--project-dir", str(project_dir)])

        self.assertEqual(exit_code, 2)
        self.assertIn("config_already_exists", output.getvalue())

    def test_init_force_overwrites_existing_config(self) -> None:
        output = StringIO()

        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            config_path = project_dir / "governance.yml"
            write_fixture_file(config_path, "host:\n  output: json\n")
            with redirect_stdout(output):
                exit_code = main(
                    ["init", "--project-dir", str(project_dir), "--force"]
                )

            config_text = config_path.read_text(encoding="utf-8")

        self.assertEqual(exit_code, 0)
        self.assertIn("artifactMode: use-existing-or-parse", config_text)


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


def create_runtime_completed_process(  # type: ignore[no-untyped-def]
    payload,
):
    import subprocess

    stdout = payload if isinstance(payload, str) else json.dumps(payload)
    return subprocess.CompletedProcess(
        args=["dbt-governance-runtime"],
        returncode=0,
        stdout=stdout,
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


def create_incompatible_runtime_environment_result() -> RuntimeEnvironmentResult:
    resolution = RuntimePackageResolution(
        cache_dir=Path("/tmp/runtime-cache"),
        package_dir=Path("/tmp/runtime-cache"),
        package_name="@anarchitects/governance-runtime-dbt",
        package_version="0.0.1",
        executable_path=Path("/tmp/runtime-cache/dbt-governance-runtime"),
    )
    return RuntimeEnvironmentResult(
        supported=False,
        diagnostics=[
            HostDiagnostic(
                code="governance.host_dbt.unsupported_node_version",
                message='Node.js version "v25.0.0" is not supported.',
            )
        ],
        report=RuntimeEnvironmentReport(
            host_version="0.0.1",
            manifest=RuntimeManifest(
                runtime_package="@anarchitects/governance-runtime-dbt",
                runtime_version="0.0.1",
                node_range=">=20 <25",
                contract_version="1.0.0",
            ),
            repo_package_manager="yarn",
            node_version="v25.0.0",
            node_supported=False,
            package_manager=None,
            runtime_resolution=resolution,
            runtime_compatible=False,
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


def sample_runtime_result(*, blocking: bool = False) -> dict[str, object]:
    severity = "error" if blocking else "warning"
    violations = (
        [
            {
                "id": "violation-1",
                "ruleId": "ownership-presence",
                "severity": severity,
                "message": "Owner metadata is missing.",
            }
        ]
        if blocking
        else []
    )
    return {
        "ok": True,
        "runtime": {
            "packageName": "@anarchitects/governance-runtime-dbt",
            "version": "0.0.1",
        },
        "diagnostics": [
            {
                "code": "adapter.warning",
                "message": "Example warning.",
                "severity": "warning",
            }
        ],
        "assessment": {
            "violations": violations,
            "warnings": ["Example warning"],
            "health": {
                "status": "warning" if blocking else "good",
                "score": 82 if blocking else 97,
                "grade": "B" if blocking else "A",
            },
            "topIssues": [
                {"message": "Fill in missing ownership metadata."},
            ],
            "recommendations": [
                {
                    "title": "Add owners",
                    "reason": "Ownership metadata is required.",
                }
            ],
        },
        "violations": violations,
    }
