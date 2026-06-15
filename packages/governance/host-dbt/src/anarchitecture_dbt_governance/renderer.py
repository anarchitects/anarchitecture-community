"""Renderer helpers for host command output."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from .artifact_manager import ArtifactResolutionResult
from .dbt_project import HostDiagnostic

if TYPE_CHECKING:
    from .runtime_invocation import RuntimeHandoffResult
    from .runtime_manager import RuntimeEnvironmentResult


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


def render_check_success(
    artifact_result: ArtifactResolutionResult,
    runtime_result: RuntimeHandoffResult,
) -> str:
    """Render a successful check result after runtime handoff."""

    if artifact_result.context is None:
        return "dbt-governance check completed without a resolved dbt project."

    artifact_paths = artifact_result.context.artifact_paths
    lines = [
        f"Resolved dbt project: {artifact_result.context.project_dir}",
        f"Resolved dbt_project.yml: {artifact_result.context.dbt_project_path}",
        f"Resolved target path: {artifact_result.context.target_path}",
        f"Using manifest: {artifact_paths.manifest_path}",
    ]
    if artifact_result.invoked_parse:
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
    lines.append("Runtime handoff completed via dbt-governance-runtime.")
    if runtime_result.diagnostics:
        lines.append("")
        lines.append("Invocation diagnostics:")
        lines.append(render_diagnostics(runtime_result.diagnostics))
    if runtime_result.runtime_result is not None:
        lines.append("")
        lines.append("Runtime JSON result:")
        lines.append(_render_json(runtime_result.runtime_result))
    return "\n".join(lines)


def render_check_failure(result: RuntimeHandoffResult) -> str:
    """Render a failed runtime handoff while preserving the JSON result."""

    lines: list[str] = []
    if result.diagnostics:
        lines.append(render_diagnostics(result.diagnostics))
    if result.runtime_result is not None:
        if lines:
            lines.append("")
        lines.append("Runtime JSON result:")
        lines.append(_render_json(result.runtime_result))

    return "\n".join(lines)


def render_runtime_environment(
    command: str,
    result: RuntimeEnvironmentResult,
) -> str:
    """Render setup or doctor runtime environment details."""

    report = result.report
    runtime_resolution = report.runtime_resolution
    if command == "doctor":
        runtime_action = "Runtime action: inspected runtime environment"
    elif report.install_performed:
        runtime_action = "Runtime action: installed pinned runtime package"
    elif report.runtime_compatible:
        runtime_action = "Runtime action: verified existing pinned runtime package"
    else:
        runtime_action = "Runtime action: no runtime installation was performed"

    lines = [
        f"dbt-governance {command}",
        f"Host version: {report.host_version}",
        f"Manifest runtime package: {report.manifest.runtime_package}",
        f"Manifest runtime version: {report.manifest.runtime_version}",
        f"Manifest Node range: {report.manifest.node_range}",
        f"Manifest contract version: {report.manifest.contract_version}",
        f"Repo package manager: {report.repo_package_manager or 'unavailable'}",
        (
            f"Node.js: {report.node_version} "
            f"({'compatible' if report.node_supported else 'incompatible'})"
            if report.node_version is not None
            else "Node.js: unavailable"
        ),
        (
            f"Selected package manager: {report.package_manager.name} "
            f"{report.package_manager.version}"
            if report.package_manager is not None
            else "Selected package manager: unavailable"
        ),
        f"Runtime cache: {runtime_resolution.cache_dir}",
        f"Runtime package path: {runtime_resolution.package_dir}",
        (
            "Runtime package resolved: "
            f"{runtime_resolution.package_name}@{runtime_resolution.package_version}"
            if runtime_resolution.package_name and runtime_resolution.package_version
            else "Runtime package resolved: unavailable"
        ),
        (
            f"Runtime executable: {runtime_resolution.executable_path}"
            if runtime_resolution.executable_path is not None
            else "Runtime executable: unavailable"
        ),
        runtime_action,
        (
            "Runtime compatibility: compatible"
            if report.runtime_compatible
            else "Runtime compatibility: incompatible"
        ),
    ]
    if result.diagnostics:
        lines.append("")
        lines.append("Diagnostics:")
        lines.append(render_diagnostics(result.diagnostics))

    return "\n".join(lines)


def _render_json(payload: dict[str, object]) -> str:
    return json.dumps(payload, indent=2, sort_keys=True)
