"""Runtime handoff tests for the dbt Governance host."""

from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from anarchitecture_dbt_governance.artifact_manager import resolve_artifacts
from anarchitecture_dbt_governance.dbt_project import (
    DbtArtifactPathHints,
    DbtProjectContext,
    resolve_dbt_path_hints,
)
from anarchitecture_dbt_governance.runtime_invocation import (
    ResolvedRuntimeExecutable,
    build_runtime_input,
    invoke_runtime_handoff,
)


class RuntimeInvocationTests(unittest.TestCase):
    """Verify the process/JSON runtime handoff boundary."""

    def test_runtime_input_contains_required_path_hints(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))

            payload = build_runtime_input(
                detection.context,  # type: ignore[arg-type]
                host_version="0.0.1",
                request_id="req-1",
            )

        adapter_paths = payload["adapter"]["paths"]
        self.assertEqual(adapter_paths["projectDir"], str(project_dir.resolve()))
        self.assertEqual(
            adapter_paths["dbtProjectPath"],
            str((project_dir / "dbt_project.yml").resolve()),
        )
        self.assertEqual(
            adapter_paths["manifestPath"],
            str((project_dir / "target" / "manifest.json").resolve()),
        )

    def test_optional_paths_are_omitted_when_unavailable(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            payload = build_runtime_input(
                detection.context,  # type: ignore[arg-type]
                host_version="0.0.1",
            )

        adapter_paths = payload["adapter"]["paths"]
        self.assertNotIn("catalogPath", adapter_paths)
        self.assertNotIn("runResultsPath", adapter_paths)
        self.assertNotIn("sourcesPath", adapter_paths)

    def test_optional_paths_are_included_when_available(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(
                Path(temp_dir),
                include_manifest=True,
                include_optional=True,
            )
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            resolved = resolve_artifacts(
                detection.context,  # type: ignore[arg-type]
                parse=False,
                use_existing_artifacts=False,
            )
            payload = build_runtime_input(
                resolved.context,  # type: ignore[arg-type]
                host_version="0.0.1",
            )

        adapter_paths = payload["adapter"]["paths"]
        self.assertEqual(
            adapter_paths["catalogPath"],
            str((project_dir / "target" / "catalog.json").resolve()),
        )
        self.assertEqual(
            adapter_paths["runResultsPath"],
            str((project_dir / "target" / "run_results.json").resolve()),
        )
        self.assertEqual(
            adapter_paths["sourcesPath"],
            str((project_dir / "target" / "sources.json").resolve()),
        )

    def test_successful_runtime_invocation_parses_json_output(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            executable_path = create_runtime_executable(Path(temp_dir))
            result = invoke_runtime_handoff(
                detection.context,  # type: ignore[arg-type]
                ResolvedRuntimeExecutable(
                    runtime_package="@anarchitects/governance-runtime-dbt",
                    runtime_version="0.0.1",
                    contract_version="1.0.0",
                    executable_path=executable_path,
                ),
                host_version="0.0.1",
                request_id="req-123",
                process_runner=successful_runtime_runner,
            )

        self.assertTrue(result.supported)
        self.assertEqual(result.runtime_result["ok"], True)
        self.assertEqual(result.request_id, "req-123")

    def test_runtime_stderr_is_captured_as_warning_context(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            executable_path = create_runtime_executable(Path(temp_dir))
            result = invoke_runtime_handoff(
                detection.context,  # type: ignore[arg-type]
                ResolvedRuntimeExecutable(
                    runtime_package="@anarchitects/governance-runtime-dbt",
                    runtime_version="0.0.1",
                    contract_version="1.0.0",
                    executable_path=executable_path,
                ),
                host_version="0.0.1",
                process_runner=stderr_runtime_runner,
            )

        self.assertTrue(result.supported)
        self.assertIn(
            "governance.host_dbt.runtime_stderr_output",
            diagnostic_codes(result),
        )

    def test_structured_runtime_error_is_preserved(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            executable_path = create_runtime_executable(Path(temp_dir))
            result = invoke_runtime_handoff(
                detection.context,  # type: ignore[arg-type]
                ResolvedRuntimeExecutable(
                    runtime_package="@anarchitects/governance-runtime-dbt",
                    runtime_version="0.0.1",
                    contract_version="1.0.0",
                    executable_path=executable_path,
                ),
                host_version="0.0.1",
                process_runner=structured_error_runtime_runner,
            )

        self.assertFalse(result.supported)
        self.assertEqual(result.runtime_result["ok"], False)
        self.assertIn(
            "governance.host_dbt.runtime_returned_error",
            diagnostic_codes(result),
        )

    def test_invalid_json_stdout_becomes_host_invocation_failure(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            executable_path = create_runtime_executable(Path(temp_dir))
            result = invoke_runtime_handoff(
                detection.context,  # type: ignore[arg-type]
                ResolvedRuntimeExecutable(
                    runtime_package="@anarchitects/governance-runtime-dbt",
                    runtime_version="0.0.1",
                    contract_version="1.0.0",
                    executable_path=executable_path,
                ),
                host_version="0.0.1",
                process_runner=invalid_json_runtime_runner,
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.runtime_invalid_json_output",
            diagnostic_codes(result),
        )

    def test_missing_executable_is_reported(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            result = invoke_runtime_handoff(
                detection.context,  # type: ignore[arg-type]
                ResolvedRuntimeExecutable(
                    runtime_package="@anarchitects/governance-runtime-dbt",
                    runtime_version="0.0.1",
                    contract_version="1.0.0",
                    executable_path=None,
                ),
                host_version="0.0.1",
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.runtime_executable_missing",
            diagnostic_codes(result),
        )

    def test_unresolved_runtime_is_reported(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            result = invoke_runtime_handoff(
                detection.context,  # type: ignore[arg-type]
                ResolvedRuntimeExecutable(
                    runtime_package="",
                    runtime_version="",
                    contract_version="",
                    executable_path=None,
                ),
                host_version="0.0.1",
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.runtime_unresolved",
            diagnostic_codes(result),
        )

    def test_timeout_is_reported(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            executable_path = create_runtime_executable(Path(temp_dir))
            result = invoke_runtime_handoff(
                detection.context,  # type: ignore[arg-type]
                ResolvedRuntimeExecutable(
                    runtime_package="@anarchitects/governance-runtime-dbt",
                    runtime_version="0.0.1",
                    contract_version="1.0.0",
                    executable_path=executable_path,
                ),
                host_version="0.0.1",
                process_runner=timeout_runtime_runner,
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.runtime_process_timeout",
            diagnostic_codes(result),
        )

    def test_non_zero_process_exit_is_reported(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            executable_path = create_runtime_executable(Path(temp_dir))
            result = invoke_runtime_handoff(
                detection.context,  # type: ignore[arg-type]
                ResolvedRuntimeExecutable(
                    runtime_package="@anarchitects/governance-runtime-dbt",
                    runtime_version="0.0.1",
                    contract_version="1.0.0",
                    executable_path=executable_path,
                ),
                host_version="0.0.1",
                process_runner=failing_runtime_runner,
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.runtime_process_failed",
            diagnostic_codes(result),
        )

    def test_incomplete_path_hints_are_reported(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            missing_manifest = (
                project_dir / "target" / "manifest-missing.json"
            ).resolve()
            context = DbtProjectContext(
                project_dir=project_dir.resolve(),
                dbt_project_path=(project_dir / "dbt_project.yml").resolve(),
                target_path=(project_dir / "target").resolve(),
                artifact_paths=DbtArtifactPathHints(
                    project_dir=project_dir.resolve(),
                    dbt_project_path=(project_dir / "dbt_project.yml").resolve(),
                    target_path=(project_dir / "target").resolve(),
                    manifest_path=missing_manifest,
                ),
            )
            executable_path = create_runtime_executable(Path(temp_dir))
            result = invoke_runtime_handoff(
                context,
                ResolvedRuntimeExecutable(
                    runtime_package="@anarchitects/governance-runtime-dbt",
                    runtime_version="0.0.1",
                    contract_version="1.0.0",
                    executable_path=executable_path,
                ),
                host_version="0.0.1",
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.incomplete_runtime_context",
            diagnostic_codes(result),
        )

    def test_runtime_metadata_mismatch_is_reported(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            executable_path = create_runtime_executable(Path(temp_dir))
            result = invoke_runtime_handoff(
                detection.context,  # type: ignore[arg-type]
                ResolvedRuntimeExecutable(
                    runtime_package="@anarchitects/governance-runtime-dbt",
                    runtime_version="0.0.1",
                    contract_version="1.0.0",
                    executable_path=executable_path,
                ),
                host_version="0.0.1",
                process_runner=metadata_mismatch_runtime_runner,
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.incompatible_runtime_metadata",
            diagnostic_codes(result),
        )

    def test_runtime_input_serialization_failure_is_reported(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=True)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            executable_path = create_runtime_executable(Path(temp_dir))
            result = invoke_runtime_handoff(
                detection.context,  # type: ignore[arg-type]
                ResolvedRuntimeExecutable(
                    runtime_package="@anarchitects/governance-runtime-dbt",
                    runtime_version="0.0.1",
                    contract_version="1.0.0",
                    executable_path=executable_path,
                ),
                host_version="0.0.1",
                runtime_metadata={"bad": object()},
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.runtime_input_serialization_failed",
            diagnostic_codes(result),
        )


def create_project_fixture(
    root: Path,
    *,
    include_manifest: bool,
    include_optional: bool = False,
) -> Path:
    project_dir = root / "analytics"
    write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
    if include_manifest:
        write_fixture_file(project_dir / "target" / "manifest.json", "{}")
    if include_optional:
        write_fixture_file(project_dir / "target" / "catalog.json", "{}")
        write_fixture_file(project_dir / "target" / "run_results.json", "{}")
        write_fixture_file(project_dir / "target" / "sources.json", "{}")
    return project_dir


def write_fixture_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def write_executable(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("#!/usr/bin/env node\n", encoding="utf-8")
    return path


def create_runtime_executable(root: Path) -> Path:
    return write_executable(root / "dbt-governance-runtime")


def successful_runtime_runner(
    args: list[str],
    *,
    cwd: Path,
    input: str,
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    del cwd, timeout
    payload = json.loads(input)
    return completed(
        args,
        stdout=json.dumps(
            {
                "ok": True,
                "runtime": {
                    "packageName": "@anarchitects/governance-runtime-dbt",
                    "version": "0.0.1",
                },
                "metadata": {
                    "runtime": {
                        "packageName": "@anarchitects/governance-runtime-dbt",
                        "version": "0.0.1",
                    }
                },
                "echo": payload["adapter"]["paths"],
            }
        ),
    )


def stderr_runtime_runner(
    args: list[str],
    *,
    cwd: Path,
    input: str,
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    del cwd, input, timeout
    return completed(
        args,
        stdout=json.dumps(
            {
                "ok": True,
                "runtime": {
                    "packageName": "@anarchitects/governance-runtime-dbt",
                    "version": "0.0.1",
                },
            }
        ),
        stderr="runtime warning\n",
    )


def structured_error_runtime_runner(
    args: list[str],
    *,
    cwd: Path,
    input: str,
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    del cwd, input, timeout
    return completed(
        args,
        stdout=json.dumps(
            {
                "ok": False,
                "runtime": {
                    "packageName": "@anarchitects/governance-runtime-dbt",
                    "version": "0.0.1",
                },
                "error": {
                    "code": "governance.runtime.invalid_input",
                    "message": "invalid",
                },
            }
        ),
    )


def invalid_json_runtime_runner(
    args: list[str],
    *,
    cwd: Path,
    input: str,
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    del cwd, input, timeout
    return completed(args, stdout="not-json")


def timeout_runtime_runner(
    args: list[str],
    *,
    cwd: Path,
    input: str,
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    del cwd, input
    raise subprocess.TimeoutExpired(
        cmd=args,
        timeout=timeout,
        output='{"ok":false}',
        stderr="timed out\n",
    )


def failing_runtime_runner(
    args: list[str],
    *,
    cwd: Path,
    input: str,
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    del cwd, input, timeout
    return completed(args, stdout='{"ok":false}', stderr="boom\n", returncode=2)


def metadata_mismatch_runtime_runner(
    args: list[str],
    *,
    cwd: Path,
    input: str,
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    del cwd, input, timeout
    return completed(
        args,
        stdout=json.dumps(
            {
                "ok": True,
                "runtime": {
                    "packageName": "@anarchitects/not-the-runtime",
                    "version": "9.9.9",
                },
            }
        ),
    )


def completed(
    args: list[str],
    *,
    stdout: str = "",
    stderr: str = "",
    returncode: int = 0,
) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(
        args=args,
        returncode=returncode,
        stdout=stdout,
        stderr=stderr,
    )


def diagnostic_codes(result) -> set[str]:  # type: ignore[no-untyped-def]
    return {diagnostic.code for diagnostic in result.diagnostics}


if __name__ == "__main__":
    unittest.main()
