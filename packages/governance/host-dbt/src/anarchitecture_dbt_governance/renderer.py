"""Renderer helpers for host command output."""

from __future__ import annotations

from .artifact_manager import ArtifactResolutionResult
from .dbt_project import HostDiagnostic


def render_not_implemented(command: str) -> str:
    """Render a consistent placeholder message for a command."""

    return f"dbt-governance {command} is not implemented yet."


def render_diagnostics(diagnostics: list[HostDiagnostic]) -> str:
    """Render host diagnostics for human-facing CLI output."""

    lines: list[str] = []
    for diagnostic in diagnostics:
        lines.append(
            f"{diagnostic.severity.upper()} [{diagnostic.code}] "
            f"{diagnostic.message}"
        )
        if diagnostic.path:
            lines.append(f"Path: {diagnostic.path}")
        if diagnostic.recommendation:
            lines.append(f"Recommendation: {diagnostic.recommendation}")
        stdout = diagnostic.details.get("stdout")
        stderr = diagnostic.details.get("stderr")
        if stdout:
            lines.append(f"dbt stdout:\n{stdout}")
        if stderr:
            lines.append(f"dbt stderr:\n{stderr}")

    return "\n".join(lines)


def render_check_success(result: ArtifactResolutionResult) -> str:
    """Render a successful check result without invoking the runtime."""

    if result.context is None:
        return "dbt-governance check completed without a resolved dbt project."

    artifact_paths = result.context.artifact_paths
    lines = [
        f"Resolved dbt project: {result.context.project_dir}",
        f"Resolved dbt_project.yml: {result.context.dbt_project_path}",
        f"Resolved target path: {result.context.target_path}",
        f"Using manifest: {artifact_paths.manifest_path}",
    ]
    if result.invoked_parse:
        lines.append("dbt parse was invoked to generate manifest.json.")
    else:
        lines.append("Using existing manifest.json without invoking dbt.")
    if artifact_paths.catalog_path is not None:
        lines.append(f"Detected optional artifact: {artifact_paths.catalog_path}")
    if artifact_paths.run_results_path is not None:
        lines.append(
            f"Detected optional artifact: {artifact_paths.run_results_path}"
        )
    if artifact_paths.sources_path is not None:
        lines.append(f"Detected optional artifact: {artifact_paths.sources_path}")
    return "\n".join(lines)
