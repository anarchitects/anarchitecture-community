"""Runtime process invocation and JSON handoff for the dbt host."""

from __future__ import annotations

import json
import subprocess
from collections.abc import Mapping
from dataclasses import dataclass
from json import JSONDecodeError
from pathlib import Path
from typing import Any
from uuid import uuid4

from .dbt_project import DbtProjectContext, HostDiagnostic

HOST_PACKAGE_NAME = "anarchitecture-dbt-governance"
DEFAULT_RUNTIME_TIMEOUT_SECONDS = 30


@dataclass(frozen=True)
class CheckCommandOptions:
    """Host-owned CLI options for the check command."""

    project_dir: str | None = None
    profiles_dir: str | None = None
    target: str | None = None
    target_path: str | None = None
    config: str | None = None
    use_existing_artifacts: bool = False
    parse: bool = False
    json_output: bool = False
    report_path: str | None = None


@dataclass(frozen=True)
class ReportCommandOptions:
    """Host-owned CLI options for the report command."""

    project_dir: str | None = None
    profiles_dir: str | None = None
    target: str | None = None
    target_path: str | None = None
    config: str | None = None
    use_existing_artifacts: bool = False
    parse: bool = False
    format: str | None = None
    report_path: str | None = None


@dataclass(frozen=True)
class InitCommandOptions:
    """Host-owned CLI options for the init command."""

    project_dir: str | None = None
    config: str | None = None
    force: bool = False


@dataclass(frozen=True)
class RuntimeInvocation:
    """Invocation model for host CLI commands."""

    command: str
    config_path: str | None = None
    check_options: CheckCommandOptions | None = None
    report_options: ReportCommandOptions | None = None
    init_options: InitCommandOptions | None = None


@dataclass(frozen=True)
class ResolvedRuntimeExecutable:
    """Validated runtime executable information from the setup layer."""

    runtime_package: str
    runtime_version: str
    contract_version: str
    executable_path: Path | None


@dataclass(frozen=True)
class RuntimeHandoffResult:
    """Result of invoking the runtime process through the JSON boundary."""

    supported: bool
    diagnostics: list[HostDiagnostic]
    runtime_input: dict[str, Any] | None = None
    runtime_result: dict[str, Any] | None = None
    stdout: str = ""
    stderr: str = ""
    request_id: str | None = None


def build_runtime_input(
    context: DbtProjectContext,
    *,
    host_version: str,
    profile_path: str | None = None,
    profile_document: Mapping[str, Any] | None = None,
    adapter_options: Mapping[str, Any] | None = None,
    extension_options: Mapping[str, Any] | None = None,
    working_directory: Path | None = None,
    request_id: str | None = None,
    runtime_metadata: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the JSON input payload for governance-runtime-dbt."""

    artifact_paths = context.artifact_paths
    resolved_request_id = request_id or f"dbt-governance-{uuid4().hex}"
    resolved_working_directory = (working_directory or Path.cwd()).resolve()
    adapter_paths: dict[str, str] = {
        "projectDir": str(context.project_dir),
        "dbtProjectPath": str(context.dbt_project_path),
        "manifestPath": str(artifact_paths.manifest_path),
    }
    if artifact_paths.catalog_path is not None:
        adapter_paths["catalogPath"] = str(artifact_paths.catalog_path)
    if artifact_paths.run_results_path is not None:
        adapter_paths["runResultsPath"] = str(artifact_paths.run_results_path)
    if artifact_paths.sources_path is not None:
        adapter_paths["sourcesPath"] = str(artifact_paths.sources_path)

    metadata: dict[str, Any] = {
        "hostPackage": HOST_PACKAGE_NAME,
        "hostVersion": host_version,
    }
    if runtime_metadata is not None:
        metadata.update(runtime_metadata)

    profile_payload: dict[str, Any] = {}
    if profile_path is not None:
        profile_payload["path"] = profile_path
        profile_payload["format"] = _infer_profile_format(profile_path)
    if profile_document is not None:
        profile_payload["document"] = dict(profile_document)

    resolved_adapter_options = {"validationMode": "strict"}
    if adapter_options is not None:
        resolved_adapter_options.update(adapter_options)

    return {
        "profile": profile_payload,
        "adapter": {
            "paths": adapter_paths,
            "options": resolved_adapter_options,
        },
        "extension": {
            "options": dict(extension_options or {}),
        },
        "runtime": {
            "requestId": resolved_request_id,
            "workingDirectory": str(resolved_working_directory),
            "metadata": metadata,
        },
    }


def invoke_runtime_handoff(
    context: DbtProjectContext,
    resolved_runtime: ResolvedRuntimeExecutable,
    *,
    host_version: str,
    profile_path: str | None = None,
    profile_document: Mapping[str, Any] | None = None,
    adapter_options: Mapping[str, Any] | None = None,
    extension_options: Mapping[str, Any] | None = None,
    working_directory: Path | None = None,
    request_id: str | None = None,
    timeout_seconds: int = DEFAULT_RUNTIME_TIMEOUT_SECONDS,
    runtime_metadata: Mapping[str, Any] | None = None,
    process_runner=None,
) -> RuntimeHandoffResult:
    """Invoke the runtime executable through the stdin/stdout JSON boundary."""

    diagnostics = _validate_runtime_handoff_context(context, resolved_runtime)
    resolved_working_directory = (working_directory or Path.cwd()).resolve()
    runtime_input = build_runtime_input(
        context,
        host_version=host_version,
        profile_path=profile_path,
        profile_document=profile_document,
        adapter_options=adapter_options,
        extension_options=extension_options,
        working_directory=resolved_working_directory,
        request_id=request_id,
        runtime_metadata=runtime_metadata,
    )
    resolved_request_id = runtime_input["runtime"]["requestId"]

    if diagnostics:
        return RuntimeHandoffResult(
            supported=False,
            diagnostics=diagnostics,
            runtime_input=runtime_input,
            request_id=resolved_request_id,
        )

    try:
        input_json = json.dumps(runtime_input)
    except (TypeError, ValueError) as error:
        return RuntimeHandoffResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.runtime_input_serialization_failed",
                    message="Serializing runtime input JSON failed.",
                    recommendation=(
                        "Ensure host-supplied runtime metadata only contains "
                        "JSON-serializable values."
                    ),
                    details={"reason": str(error)},
                )
            ],
            runtime_input=runtime_input,
            request_id=resolved_request_id,
        )

    runner = process_runner or _run_runtime_process
    executable_path = resolved_runtime.executable_path
    try:
        completed = runner(
            [str(executable_path)],
            cwd=resolved_working_directory,
            input=input_json,
            timeout=timeout_seconds,
        )
    except FileNotFoundError:
        return RuntimeHandoffResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.runtime_executable_missing",
                    message=(
                        "Runtime executable could not be found at the resolved "
                        "location."
                    ),
                    path=str(executable_path),
                    recommendation=(
                        "Run dbt-governance setup to verify the pinned runtime "
                        "installation."
                    ),
                )
            ],
            runtime_input=runtime_input,
            request_id=resolved_request_id,
        )
    except subprocess.TimeoutExpired as error:
        stderr = _coerce_timeout_stream(error.stderr)
        stdout = _coerce_timeout_stream(error.stdout)
        return RuntimeHandoffResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.runtime_process_timeout",
                    message=("Runtime process exceeded the allowed execution timeout."),
                    path=str(executable_path),
                    recommendation=(
                        "Inspect runtime stderr/stdout context and retry once the "
                        "runtime process can complete within the timeout."
                    ),
                    details={
                        "timeoutSeconds": timeout_seconds,
                        "stdout": stdout,
                        "stderr": stderr,
                    },
                )
            ],
            runtime_input=runtime_input,
            stdout=stdout,
            stderr=stderr,
            request_id=resolved_request_id,
        )

    stdout = completed.stdout
    stderr = completed.stderr
    warning_diagnostics: list[HostDiagnostic] = []
    if stderr.strip():
        warning_diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.runtime_stderr_output",
                message="Runtime process wrote diagnostics to stderr.",
                severity="warning",
                path=str(executable_path),
                details={"stderr": stderr},
            )
        )

    parsed_output, json_diagnostics = _parse_runtime_stdout(
        stdout,
        stderr,
        executable_path,
    )
    if json_diagnostics:
        diagnostics = warning_diagnostics + json_diagnostics
        if completed.returncode != 0:
            diagnostics = _with_runtime_process_failed_diagnostic(
                diagnostics,
                executable_path,
                completed.returncode,
                stdout,
                stderr,
            )
        return RuntimeHandoffResult(
            supported=False,
            diagnostics=diagnostics,
            runtime_input=runtime_input,
            stdout=stdout,
            stderr=stderr,
            request_id=resolved_request_id,
        )

    assert parsed_output is not None

    metadata_diagnostics = _validate_runtime_result_metadata(
        parsed_output,
        resolved_runtime,
    )
    if metadata_diagnostics:
        diagnostics = warning_diagnostics + metadata_diagnostics
        if completed.returncode != 0:
            diagnostics = _with_runtime_process_failed_diagnostic(
                diagnostics,
                executable_path,
                completed.returncode,
                stdout,
                stderr,
            )
        return RuntimeHandoffResult(
            supported=False,
            diagnostics=diagnostics,
            runtime_input=runtime_input,
            runtime_result=parsed_output,
            stdout=stdout,
            stderr=stderr,
            request_id=resolved_request_id,
        )

    if completed.returncode != 0:
        diagnostics = _with_runtime_process_failed_diagnostic(
            warning_diagnostics,
            executable_path,
            completed.returncode,
            stdout,
            stderr,
        )
        if parsed_output.get("ok") is False:
            diagnostics.append(
                _runtime_returned_error_diagnostic(
                    parsed_output,
                    executable_path,
                    stderr,
                )
            )
        return RuntimeHandoffResult(
            supported=False,
            diagnostics=diagnostics,
            runtime_input=runtime_input,
            runtime_result=parsed_output,
            stdout=stdout,
            stderr=stderr,
            request_id=resolved_request_id,
        )

    if parsed_output.get("ok") is False:
        return RuntimeHandoffResult(
            supported=False,
            diagnostics=warning_diagnostics
            + [
                _runtime_returned_error_diagnostic(
                    parsed_output,
                    executable_path,
                    stderr,
                )
            ],
            runtime_input=runtime_input,
            runtime_result=parsed_output,
            stdout=stdout,
            stderr=stderr,
            request_id=resolved_request_id,
        )

    return RuntimeHandoffResult(
        supported=True,
        diagnostics=warning_diagnostics,
        runtime_input=runtime_input,
        runtime_result=parsed_output,
        stdout=stdout,
        stderr=stderr,
        request_id=resolved_request_id,
    )


def _parse_runtime_stdout(
    stdout: str,
    stderr: str,
    executable_path: Path | None,
) -> tuple[dict[str, Any] | None, list[HostDiagnostic]]:
    try:
        parsed_output = json.loads(stdout)
    except JSONDecodeError as error:
        return (
            None,
            [
                HostDiagnostic(
                    code="governance.host_dbt.runtime_invalid_json_output",
                    message="Runtime process stdout did not contain valid JSON.",
                    path=str(executable_path),
                    recommendation=(
                        "Ensure the runtime executable writes exactly one JSON "
                        "document to stdout."
                    ),
                    details={
                        "reason": error.msg,
                        "stdout": stdout,
                        "stderr": stderr,
                    },
                )
            ],
        )

    if not isinstance(parsed_output, dict):
        return (
            None,
            [
                HostDiagnostic(
                    code="governance.host_dbt.runtime_invalid_json_output",
                    message="Runtime process stdout JSON must be an object.",
                    path=str(executable_path),
                    recommendation=(
                        "Ensure the runtime executable returns the structured "
                        "runtime result object."
                    ),
                    details={"stdout": stdout, "stderr": stderr},
                )
            ],
        )

    return parsed_output, []


def _with_runtime_process_failed_diagnostic(
    diagnostics: list[HostDiagnostic],
    executable_path: Path | None,
    returncode: int,
    stdout: str,
    stderr: str,
) -> list[HostDiagnostic]:
    return diagnostics + [
        HostDiagnostic(
            code="governance.host_dbt.runtime_process_failed",
            message="Runtime process exited with a non-zero status code.",
            path=str(executable_path),
            recommendation=(
                "Inspect runtime stdout/stderr context and resolve the runtime "
                "failure before rerunning dbt-governance check."
            ),
            details={
                "returncode": returncode,
                "stdout": stdout,
                "stderr": stderr,
            },
        )
    ]


def _runtime_returned_error_diagnostic(
    parsed_output: dict[str, Any],
    executable_path: Path | None,
    stderr: str,
) -> HostDiagnostic:
    error_payload = parsed_output.get("error")
    error_code = (
        error_payload.get("code")
        if isinstance(error_payload, dict)
        and isinstance(error_payload.get("code"), str)
        else "unknown"
    )
    return HostDiagnostic(
        code="governance.host_dbt.runtime_returned_error",
        message=(
            f'Runtime returned a structured error result (error code: "{error_code}").'
        ),
        path=str(executable_path),
        recommendation=(
            "Inspect the preserved runtime JSON result for the authoritative "
            "adapter/extension/runtime error details."
        ),
        details={"stderr": stderr},
    )


def _validate_runtime_handoff_context(
    context: DbtProjectContext,
    resolved_runtime: ResolvedRuntimeExecutable,
) -> list[HostDiagnostic]:
    diagnostics: list[HostDiagnostic] = []
    artifact_paths = context.artifact_paths
    has_project_hint = context.project_dir.exists() or context.dbt_project_path.exists()
    has_manifest_hint = artifact_paths.manifest_path.exists()

    if not has_project_hint or not has_manifest_hint:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.incomplete_runtime_context",
                message=(
                    "Runtime handoff requires project path hints plus manifestPath."
                ),
                recommendation=(
                    "Resolve dbt artifact path hints successfully before invoking "
                    "the runtime process."
                ),
            )
        )

    if (
        not resolved_runtime.runtime_package
        or not resolved_runtime.runtime_version
        or not resolved_runtime.contract_version
    ):
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.runtime_unresolved",
                message="Pinned runtime metadata was not resolved successfully.",
                recommendation=(
                    "Run dbt-governance doctor or setup to verify the pinned "
                    "runtime package metadata."
                ),
            )
        )

    if resolved_runtime.executable_path is None:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.runtime_executable_missing",
                message="Pinned runtime executable path was not resolved.",
                recommendation=(
                    "Run dbt-governance setup to install or verify the pinned "
                    "runtime executable."
                ),
            )
        )
    elif not resolved_runtime.executable_path.is_file():
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.runtime_executable_missing",
                message="Pinned runtime executable path does not point to a file.",
                path=str(resolved_runtime.executable_path),
                recommendation=(
                    "Reinstall the pinned runtime package through dbt-governance setup."
                ),
            )
        )

    return diagnostics


def _validate_runtime_result_metadata(
    runtime_result: dict[str, Any],
    resolved_runtime: ResolvedRuntimeExecutable,
) -> list[HostDiagnostic]:
    runtime_metadata = _read_runtime_metadata(runtime_result)
    package_name = runtime_metadata.get("packageName")
    package_version = runtime_metadata.get("version")
    if not isinstance(package_name, str) or not isinstance(package_version, str):
        return [
            HostDiagnostic(
                code="governance.host_dbt.incompatible_runtime_metadata",
                message=(
                    "Runtime JSON result did not expose the expected runtime "
                    "package metadata."
                ),
                recommendation=(
                    "Ensure the runtime executable returns packageName and version "
                    "metadata aligned with runtime_manifest.json."
                ),
            )
        ]

    diagnostics: list[HostDiagnostic] = []
    if package_name != resolved_runtime.runtime_package:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.incompatible_runtime_metadata",
                message=(
                    f'Runtime reported package "{package_name}" but expected '
                    f'"{resolved_runtime.runtime_package}".'
                ),
                recommendation=(
                    "Run dbt-governance setup to verify the installed runtime "
                    "package matches runtime_manifest.json."
                ),
            )
        )
    if package_version != resolved_runtime.runtime_version:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.incompatible_runtime_metadata",
                message=(
                    f'Runtime reported version "{package_version}" but expected '
                    f'"{resolved_runtime.runtime_version}".'
                ),
                recommendation=(
                    "Run dbt-governance setup to verify the installed runtime "
                    "version matches runtime_manifest.json."
                ),
            )
        )
    return diagnostics


def _read_runtime_metadata(runtime_result: dict[str, Any]) -> dict[str, Any]:
    metadata = runtime_result.get("metadata")
    if isinstance(metadata, dict):
        runtime_metadata = metadata.get("runtime")
        if isinstance(runtime_metadata, dict):
            return runtime_metadata

    runtime_section = runtime_result.get("runtime")
    if isinstance(runtime_section, dict):
        return runtime_section

    return {}


def _coerce_timeout_stream(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if value is None:
        return ""
    return str(value)


def _run_runtime_process(
    args: list[str],
    *,
    cwd: Path,
    input: str,
    timeout: int,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=str(cwd),
        input=input,
        capture_output=True,
        text=True,
        check=False,
        timeout=timeout,
    )


def _infer_profile_format(profile_path: str) -> str:
    path = Path(profile_path)
    if path.suffix in {".yaml", ".yml"}:
        return "yaml"
    return "json"
