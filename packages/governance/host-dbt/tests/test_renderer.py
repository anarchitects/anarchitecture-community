"""Renderer and exit-code tests for the dbt Governance host."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from anarchitecture_dbt_governance.artifact_manager import ArtifactResolutionResult
from anarchitecture_dbt_governance.dbt_project import (
    DbtArtifactPathHints,
    DbtProjectContext,
    HostDiagnostic,
)
from anarchitecture_dbt_governance.exit_codes import (
    ExitCode,
    exit_code_for_diagnostics,
    exit_code_for_runtime_result,
    exit_code_for_runtime_result_with_policy,
)
from anarchitecture_dbt_governance.renderer import (
    build_report_document,
    render_human_report,
    render_json_report,
    render_markdown_report,
)
from anarchitecture_dbt_governance.runtime_invocation import RuntimeHandoffResult


class RendererTests(unittest.TestCase):
    """Verify report rendering and exit-code mapping."""

    def test_exit_code_success_without_blocking_violations(self) -> None:
        self.assertEqual(
            exit_code_for_runtime_result(sample_runtime_result()),
            ExitCode.SUCCESS,
        )

    def test_exit_code_blocking_violations(self) -> None:
        self.assertEqual(
            exit_code_for_runtime_result(sample_runtime_result(blocking=True)),
            ExitCode.BLOCKING_VIOLATIONS,
        )

    def test_exit_code_blocking_violations_can_be_allowed_by_ci_policy(self) -> None:
        self.assertEqual(
            exit_code_for_runtime_result_with_policy(
                sample_runtime_result(blocking=True),
                fail_on_blocking_violations=False,
            ),
            ExitCode.SUCCESS,
        )

    def test_exit_code_runtime_error_defaults_to_invocation_failure(self) -> None:
        self.assertEqual(
            exit_code_for_runtime_result(
                {
                    "ok": False,
                    "error": {
                        "code": "governance.runtime.adapter_failed",
                        "stage": "adapter",
                        "message": "adapter failed",
                    },
                }
            ),
            ExitCode.INVOCATION_FAILURE,
        )

    def test_exit_code_incompatible_diagnostics(self) -> None:
        diagnostics = [
            HostDiagnostic(
                code="governance.host_dbt.incompatible_runtime_metadata",
                message="runtime metadata mismatch",
            )
        ]
        self.assertEqual(
            exit_code_for_diagnostics(diagnostics),
            ExitCode.INCOMPATIBLE_RUNTIME,
        )

    def test_exit_code_unknown_failure_defaults_to_invocation_failure(self) -> None:
        diagnostics = [
            HostDiagnostic(
                code="governance.host_dbt.runtime_process_failed",
                message="runtime failed",
            )
        ]
        self.assertEqual(
            exit_code_for_diagnostics(diagnostics),
            ExitCode.INVOCATION_FAILURE,
        )

    def test_json_report_preserves_runtime_result_shape(self) -> None:
        with TemporaryDirectory() as temp_dir:
            report = build_report_document(
                command="check",
                host_version="0.0.1",
                exit_code=ExitCode.SUCCESS,
                artifact_result=create_artifact_result(Path(temp_dir)),
                runtime_result=create_runtime_handoff(),
                diagnostics=[],
            )

        rendered = render_json_report(report)
        self.assertIn('"result"', rendered)
        self.assertIn('"assessment"', rendered)
        self.assertIn('"runtime"', rendered)

    def test_markdown_report_contains_summary_and_sections(self) -> None:
        with TemporaryDirectory() as temp_dir:
            report = build_report_document(
                command="report",
                host_version="0.0.1",
                exit_code=ExitCode.BLOCKING_VIOLATIONS,
                artifact_result=create_artifact_result(Path(temp_dir)),
                runtime_result=create_runtime_handoff(blocking=True),
                diagnostics=[
                    HostDiagnostic(
                        code="governance.host_dbt.runtime_stderr_output",
                        message="stderr warning",
                        severity="warning",
                    )
                ],
            )

        rendered = render_markdown_report(report)
        self.assertIn("# dbt Governance Report", rendered)
        self.assertIn("## Summary", rendered)
        self.assertIn("## Diagnostics", rendered)
        self.assertIn("## Violations", rendered)
        self.assertIn("## Recommendations", rendered)

    def test_human_report_contains_useful_summary_fields(self) -> None:
        with TemporaryDirectory() as temp_dir:
            report = build_report_document(
                command="check",
                host_version="0.0.1",
                exit_code=ExitCode.BLOCKING_VIOLATIONS,
                artifact_result=create_artifact_result(Path(temp_dir)),
                runtime_result=create_runtime_handoff(blocking=True),
                diagnostics=[],
                report_path=(Path(temp_dir) / "target" / "governance-report.json"),
            )

        rendered = render_human_report(report)
        self.assertIn("Project:", rendered)
        self.assertIn("Manifest:", rendered)
        self.assertIn("Runtime:", rendered)
        self.assertIn("Blocking violations: 1", rendered)
        self.assertIn("Report path:", rendered)


def create_artifact_result(project_dir: Path) -> ArtifactResolutionResult:
    dbt_project_path = project_dir / "dbt_project.yml"
    target_path = project_dir / "target"
    manifest_path = target_path / "manifest.json"
    context = DbtProjectContext(
        project_dir=project_dir,
        dbt_project_path=dbt_project_path,
        target_path=target_path,
        artifact_paths=DbtArtifactPathHints(
            project_dir=project_dir,
            dbt_project_path=dbt_project_path,
            target_path=target_path,
            manifest_path=manifest_path,
        ),
    )
    return ArtifactResolutionResult(
        supported=True,
        diagnostics=[],
        context=context,
        used_existing_artifacts=True,
        invoked_parse=False,
    )


def create_runtime_handoff(
    *,
    blocking: bool = False,
) -> RuntimeHandoffResult:
    return RuntimeHandoffResult(
        supported=True,
        diagnostics=[],
        runtime_result=sample_runtime_result(blocking=blocking),
    )


def sample_runtime_result(*, blocking: bool = False) -> dict[str, object]:
    violations = (
        [
            {
                "id": "violation-1",
                "ruleId": "ownership-presence",
                "severity": "error",
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
        "assessment": {
            "violations": violations,
            "warnings": ["warning"],
            "health": {
                "status": "warning" if blocking else "good",
                "score": 82 if blocking else 97,
                "grade": "B" if blocking else "A",
            },
            "topIssues": [{"message": "Fill in missing ownership metadata."}],
            "recommendations": [
                {
                    "title": "Add owners",
                    "reason": "Ownership metadata is required.",
                }
            ],
        },
        "violations": violations,
    }


if __name__ == "__main__":
    unittest.main()
