"""Host-local dbt path hint resolution for operational workflow control."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class HostDiagnostic:
    """Host-local diagnostic emitted during project or artifact resolution."""

    code: str
    message: str
    severity: str = "error"
    path: str | None = None
    recommendation: str | None = None
    details: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class DbtArtifactPathHints:
    """Host-local path hints carried forward to the runtime boundary."""

    project_dir: Path
    dbt_project_path: Path
    target_path: Path
    manifest_path: Path
    catalog_path: Path | None = None
    run_results_path: Path | None = None
    sources_path: Path | None = None


@dataclass(frozen=True)
class DbtProjectContext:
    """Resolved host-local path hints without semantic artifact loading."""

    project_dir: Path
    dbt_project_path: Path
    target_path: Path
    artifact_paths: DbtArtifactPathHints
    profiles_dir: Path | None = None
    target: str | None = None
    config_path: Path | None = None
    target_path_provided: bool = False


@dataclass(frozen=True)
class DbtProjectDetectionResult:
    """Result of host-local dbt path hint resolution."""

    supported: bool
    diagnostics: list[HostDiagnostic]
    context: DbtProjectContext | None = None


DBT_PROJECT_FILE_NAME = "dbt_project.yml"
DEFAULT_TARGET_DIR_NAME = "target"


def resolve_dbt_path_hints(
    *,
    project_dir: str | None = None,
    dbt_project_path: str | None = None,
    profiles_dir: str | None = None,
    target: str | None = None,
    target_path: str | None = None,
    manifest_path: str | None = None,
    catalog_path: str | None = None,
    run_results_path: str | None = None,
    sources_path: str | None = None,
    config: str | None = None,
    cwd: Path | None = None,
) -> DbtProjectDetectionResult:
    """Resolve host-local dbt path hints from CLI input or current directory."""

    diagnostics: list[HostDiagnostic] = []
    current_directory = (cwd or Path.cwd()).resolve()
    resolved_project_dir = _resolve_project_dir(
        project_dir,
        dbt_project_path,
        current_directory,
    )

    if not resolved_project_dir.exists() or not resolved_project_dir.is_dir():
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.invalid_project_dir",
                message=(
                    "dbt project directory does not exist or is not a directory."
                ),
                path=str(resolved_project_dir),
                recommendation=(
                    "Pass --project-dir with a valid dbt project directory or run "
                    "the command from a directory containing dbt_project.yml."
                ),
            )
        )
        return DbtProjectDetectionResult(supported=False, diagnostics=diagnostics)

    resolved_dbt_project_path = _resolve_dbt_project_path(
        resolved_project_dir,
        dbt_project_path,
        current_directory,
    )
    if not resolved_dbt_project_path.is_file():
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.missing_dbt_project_file",
                message=(
                    f'No dbt_project.yml file was found in "{resolved_project_dir}".'
                ),
                path=str(resolved_dbt_project_path),
                recommendation=(
                    "Ensure the project directory contains dbt_project.yml before "
                    "running dbt-governance check."
                ),
            )
        )
        return DbtProjectDetectionResult(supported=False, diagnostics=diagnostics)

    resolved_target_path = _resolve_target_path(
        resolved_project_dir,
        target_path,
        manifest_path,
        catalog_path,
        run_results_path,
        sources_path,
        current_directory,
    )
    if resolved_target_path.exists() and not resolved_target_path.is_dir():
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.invalid_target_path",
                message=(
                    f'Target path "{resolved_target_path}" must be a directory when '
                    "it already exists."
                ),
                path=str(resolved_target_path),
                recommendation=(
                    "Pass --target-path with a directory path or remove the "
                    "conflicting file."
                ),
            )
        )
        return DbtProjectDetectionResult(supported=False, diagnostics=diagnostics)

    artifact_paths = DbtArtifactPathHints(
        project_dir=resolved_project_dir,
        dbt_project_path=resolved_dbt_project_path,
        target_path=resolved_target_path,
        manifest_path=_resolve_artifact_path(
            manifest_path,
            resolved_project_dir,
            resolved_target_path / "manifest.json",
            current_directory,
        ),
        catalog_path=_resolve_optional_artifact_path(
            catalog_path,
            resolved_project_dir,
            current_directory,
        ),
        run_results_path=_resolve_optional_artifact_path(
            run_results_path,
            resolved_project_dir,
            current_directory,
        ),
        sources_path=_resolve_optional_artifact_path(
            sources_path,
            resolved_project_dir,
            current_directory,
        ),
    )
    context = DbtProjectContext(
        project_dir=resolved_project_dir,
        dbt_project_path=resolved_dbt_project_path,
        target_path=resolved_target_path,
        artifact_paths=artifact_paths,
        profiles_dir=_resolve_optional_cwd_path(
            profiles_dir,
            current_directory,
        ),
        target=target,
        config_path=_resolve_optional_cwd_path(config, current_directory),
        target_path_provided=target_path is not None,
    )
    return DbtProjectDetectionResult(
        supported=True,
        diagnostics=diagnostics,
        context=context,
    )


DbtArtifactPaths = DbtArtifactPathHints
detect_dbt_project = resolve_dbt_path_hints


def _resolve_project_dir(
    project_dir: str | None,
    dbt_project_path: str | None,
    current_directory: Path,
) -> Path:
    if project_dir is None and dbt_project_path is not None:
        return _resolve_path(dbt_project_path, current_directory).parent

    if project_dir is None:
        return current_directory

    return _resolve_path(project_dir, current_directory)


def _resolve_target_path(
    project_dir: Path,
    target_path: str | None,
    manifest_path: str | None,
    catalog_path: str | None,
    run_results_path: str | None,
    sources_path: str | None,
    current_directory: Path,
) -> Path:
    if target_path is not None:
        return _resolve_path_from_project(target_path, project_dir)

    for artifact_path in (
        manifest_path,
        catalog_path,
        run_results_path,
        sources_path,
    ):
        if artifact_path is not None:
            return _resolve_path(artifact_path, current_directory).parent

    if target_path is None:
        return (project_dir / DEFAULT_TARGET_DIR_NAME).resolve()

    return _resolve_path_from_project(target_path, project_dir)


def _resolve_dbt_project_path(
    project_dir: Path,
    dbt_project_path: str | None,
    current_directory: Path,
) -> Path:
    if dbt_project_path is None:
        return project_dir / DBT_PROJECT_FILE_NAME

    return _resolve_path(dbt_project_path, current_directory)


def _resolve_artifact_path(
    input_path: str | None,
    project_dir: Path,
    default_path: Path,
    current_directory: Path,
) -> Path:
    if input_path is None:
        return default_path.resolve()

    return _resolve_path_with_project(input_path, project_dir, current_directory)


def _resolve_optional_artifact_path(
    input_path: str | None,
    project_dir: Path,
    current_directory: Path,
) -> Path | None:
    if input_path is None:
        return None

    return _resolve_path_with_project(input_path, project_dir, current_directory)


def _resolve_optional_cwd_path(
    input_path: str | None,
    current_directory: Path,
) -> Path | None:
    if input_path is None:
        return None

    return _resolve_path(input_path, current_directory)


def _resolve_path_with_project(
    input_path: str,
    project_dir: Path,
    current_directory: Path,
) -> Path:
    candidate = Path(input_path).expanduser()
    if candidate.is_absolute():
        return candidate.resolve()
    if candidate.parts and candidate.parts[0] == ".":
        return (project_dir / candidate).resolve()
    return _resolve_path(input_path, current_directory)


def _resolve_path_from_project(input_path: str, project_dir: Path) -> Path:
    candidate = Path(input_path).expanduser()
    if not candidate.is_absolute():
        candidate = project_dir / candidate
    return candidate.resolve()


def _resolve_path(input_path: str, current_directory: Path) -> Path:
    candidate = Path(input_path).expanduser()
    if not candidate.is_absolute():
        candidate = current_directory / candidate
    return candidate.resolve()
