"""Artifact lifecycle orchestration for the future dbt host."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, replace
from pathlib import Path
from threading import Lock

from .dbt_project import DbtProjectContext, HostDiagnostic

_DBT_INVOCATION_LOCK = Lock()


@dataclass(frozen=True)
class DbtCommandResult:
    """Captured dbt process invocation result."""

    args: tuple[str, ...]
    returncode: int
    stdout: str
    stderr: str


@dataclass(frozen=True)
class ArtifactResolutionResult:
    """Host-local result of artifact discovery or dbt parse orchestration."""

    supported: bool
    diagnostics: list[HostDiagnostic]
    context: DbtProjectContext | None = None
    used_existing_artifacts: bool = False
    invoked_parse: bool = False
    command_result: DbtCommandResult | None = None


def resolve_artifacts(
    context: DbtProjectContext,
    *,
    parse: bool,
    use_existing_artifacts: bool,
) -> ArtifactResolutionResult:
    """Resolve manifest and optional artifact paths for the host."""

    diagnostics: list[HostDiagnostic] = []
    manifest_path = context.artifact_paths.manifest_path

    if _is_readable_file(manifest_path, diagnostics, "manifest.json"):
        enriched_context = _with_optional_artifacts(context, diagnostics)
        return _build_resolution_result(
            supported=True,
            diagnostics=diagnostics,
            context=enriched_context,
            used_existing_artifacts=True,
            invoked_parse=False,
        )

    if _has_artifact_path_failure(diagnostics):
        return _build_resolution_result(
            supported=False,
            diagnostics=diagnostics,
            context=context,
        )

    if use_existing_artifacts:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.missing_manifest",
                message=(f'Required manifest.json was not found at "{manifest_path}".'),
                path=str(manifest_path),
                recommendation=(
                    "Generate target/manifest.json before using "
                    "--use-existing-artifacts, or rerun with --parse."
                ),
            )
        )
        return _build_resolution_result(
            supported=False,
            diagnostics=diagnostics,
            context=context,
            used_existing_artifacts=True,
            invoked_parse=False,
        )

    if not parse:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.missing_manifest",
                message=(f'Required manifest.json was not found at "{manifest_path}".'),
                path=str(manifest_path),
                recommendation=(
                    "Generate target/manifest.json first or rerun with --parse to "
                    "invoke dbt parse."
                ),
            )
        )
        return _build_resolution_result(
            supported=False,
            diagnostics=diagnostics,
            context=context,
        )

    parse_result = invoke_dbt_parse(context)
    diagnostics.extend(parse_result.diagnostics)
    if not parse_result.supported or parse_result.context is None:
        return parse_result

    enriched_context = _with_optional_artifacts(parse_result.context, diagnostics)
    return _build_resolution_result(
        supported=True,
        diagnostics=diagnostics,
        context=enriched_context,
        used_existing_artifacts=False,
        invoked_parse=True,
        command_result=parse_result.command_result,
    )


def invoke_dbt_parse(context: DbtProjectContext) -> ArtifactResolutionResult:
    """Invoke dbt parse to generate artifacts when manifest.json is missing."""

    args = ["dbt", "parse", "--project-dir", str(context.project_dir)]
    if context.profiles_dir is not None:
        args.extend(["--profiles-dir", str(context.profiles_dir)])
    if context.target is not None:
        args.extend(["--target", context.target])
    if context.target_path_provided:
        args.extend(["--target-path", str(context.target_path)])

    try:
        with _DBT_INVOCATION_LOCK:
            completed = subprocess.run(
                args=args,
                cwd=str(context.project_dir),
                capture_output=True,
                text=True,
                check=False,
            )
    except FileNotFoundError:
        return ArtifactResolutionResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.dbt_not_found",
                    message="dbt executable was not found on PATH.",
                    recommendation=(
                        "Install dbt or ensure the dbt executable is available "
                        "before using --parse."
                    ),
                )
            ],
            context=context,
            invoked_parse=True,
        )

    command_result = DbtCommandResult(
        args=tuple(args),
        returncode=completed.returncode,
        stdout=completed.stdout,
        stderr=completed.stderr,
    )
    if completed.returncode != 0:
        return ArtifactResolutionResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.dbt_parse_failed",
                    message="dbt parse failed while generating manifest.json.",
                    path=str(context.artifact_paths.manifest_path),
                    recommendation=(
                        "Inspect the dbt parse stderr/stdout details and fix the "
                        "project or profile configuration."
                    ),
                    details={
                        "returncode": completed.returncode,
                        "stdout": completed.stdout,
                        "stderr": completed.stderr,
                        "args": args,
                    },
                )
            ],
            context=context,
            invoked_parse=True,
            command_result=command_result,
        )

    diagnostics: list[HostDiagnostic] = []
    if not _is_readable_file(
        context.artifact_paths.manifest_path,
        diagnostics,
        "manifest.json",
    ):
        if not diagnostics:
            diagnostics.append(
                HostDiagnostic(
                    code="governance.host_dbt.missing_manifest",
                    message=(
                        "dbt parse completed without producing manifest.json at the "
                        "resolved target path."
                    ),
                    path=str(context.artifact_paths.manifest_path),
                    recommendation=(
                        "Check the target path configuration and confirm dbt parse "
                        "writes manifest.json."
                    ),
                )
            )
        return ArtifactResolutionResult(
            supported=False,
            diagnostics=diagnostics,
            context=context,
            invoked_parse=True,
            command_result=command_result,
        )

    return ArtifactResolutionResult(
        supported=True,
        diagnostics=diagnostics,
        context=context,
        invoked_parse=True,
        command_result=command_result,
    )


def _with_optional_artifacts(
    context: DbtProjectContext,
    diagnostics: list[HostDiagnostic],
) -> DbtProjectContext:
    configured_paths = context.artifact_paths
    catalog_path = _resolve_optional_artifact(
        configured_paths.catalog_path or (context.target_path / "catalog.json"),
        diagnostics,
        "catalog.json",
    )
    run_results_path = _resolve_optional_artifact(
        configured_paths.run_results_path or (context.target_path / "run_results.json"),
        diagnostics,
        "run_results.json",
    )
    sources_path = _resolve_optional_artifact(
        configured_paths.sources_path or (context.target_path / "sources.json"),
        diagnostics,
        "sources.json",
    )

    return replace(
        context,
        artifact_paths=replace(
            context.artifact_paths,
            catalog_path=catalog_path,
            run_results_path=run_results_path,
            sources_path=sources_path,
        ),
    )


def _resolve_optional_artifact(
    artifact_path: Path,
    diagnostics: list[HostDiagnostic],
    artifact_name: str,
) -> Path | None:
    if not artifact_path.exists():
        return None

    if _is_readable_file(artifact_path, diagnostics, artifact_name):
        return artifact_path

    return None


def _is_readable_file(
    artifact_path: Path,
    diagnostics: list[HostDiagnostic],
    artifact_name: str,
) -> bool:
    if not artifact_path.exists():
        return False

    if not artifact_path.is_file():
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.invalid_target_path",
                message=f'Artifact path "{artifact_path}" must point to a file.',
                path=str(artifact_path),
                recommendation=(
                    f"Ensure {artifact_name} resolves to a readable file path."
                ),
            )
        )
        return False

    try:
        with artifact_path.open("rb"):
            return True
    except OSError as error:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.unreadable_artifact_file",
                message=f'Artifact file "{artifact_path}" could not be read.',
                path=str(artifact_path),
                recommendation=(
                    f"Fix file permissions or regenerate {artifact_name} before "
                    "running dbt-governance check."
                ),
                details={"reason": str(error)},
            )
        )
        return False


def _has_artifact_path_failure(diagnostics: list[HostDiagnostic]) -> bool:
    return any(
        diagnostic.code
        in {
            "governance.host_dbt.invalid_target_path",
            "governance.host_dbt.unreadable_artifact_file",
        }
        for diagnostic in diagnostics
    )


def _build_resolution_result(
    *,
    supported: bool,
    diagnostics: list[HostDiagnostic],
    context: DbtProjectContext | None,
    used_existing_artifacts: bool = False,
    invoked_parse: bool = False,
    command_result: DbtCommandResult | None = None,
) -> ArtifactResolutionResult:
    if supported and _has_artifact_path_failure(diagnostics):
        supported = False

    return ArtifactResolutionResult(
        supported=supported,
        diagnostics=diagnostics,
        context=context,
        used_existing_artifacts=used_existing_artifacts,
        invoked_parse=invoked_parse,
        command_result=command_result,
    )
