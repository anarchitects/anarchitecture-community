"""Renderer helpers for host command output."""

from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path
from typing import TYPE_CHECKING, Any

from .artifact_manager import ArtifactResolutionResult
from .dbt_project import HostDiagnostic
from .exit_codes import ExitCode, count_blocking_violations
from .runtime_invocation import HOST_PACKAGE_NAME

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


def build_report_document(
    *,
    command: str,
    host_version: str,
    exit_code: ExitCode,
    artifact_result: ArtifactResolutionResult | None = None,
    runtime_result: RuntimeHandoffResult | None = None,
    diagnostics: list[HostDiagnostic] | None = None,
    report_path: Path | None = None,
) -> dict[str, Any]:
    """Build the serializable host report envelope."""

    serialized_diagnostics = [
        _serialize_diagnostic(diagnostic) for diagnostic in (diagnostics or [])
    ]
    runtime_payload = (
        runtime_result.runtime_result if runtime_result is not None else None
    )
    runtime_metadata = _read_runtime_metadata(runtime_payload)

    payload: dict[str, Any] = {
        "host": {
            "package": HOST_PACKAGE_NAME,
            "version": host_version,
            "command": command,
            "exitCode": int(exit_code),
        },
        "diagnostics": serialized_diagnostics,
        "result": runtime_payload,
    }
    if runtime_metadata:
        payload["runtime"] = runtime_metadata

    artifact_payload = _serialize_artifact_result(artifact_result)
    if artifact_payload is not None:
        payload["artifacts"] = artifact_payload
    if report_path is not None:
        payload["host"]["reportPath"] = str(report_path)

    return payload


def render_human_report(report: Mapping[str, Any]) -> str:
    """Render a concise human-readable summary for check/report."""

    host = report.get("host")
    artifacts = report.get("artifacts")
    diagnostics = report.get("diagnostics")
    result = report.get("result")

    lines: list[str] = []
    command = _read_mapping_string(host, "command") or "check"
    exit_code = _read_mapping_int(host, "exitCode")
    project_dir = _read_mapping_string(artifacts, "projectDir")
    project_name = Path(project_dir).name if project_dir else None
    manifest_path = _read_mapping_string(artifacts, "manifestPath")
    runtime_package = _read_mapping_string(report.get("runtime"), "packageName")
    runtime_version = _read_mapping_string(report.get("runtime"), "version")
    report_path = _read_mapping_string(host, "reportPath")

    if command == "report":
        lines.append("dbt-governance report")
    else:
        lines.append("dbt-governance check")

    if project_dir:
        if project_name:
            lines.append(f"Project: {project_name} ({project_dir})")
        else:
            lines.append(f"Project: {project_dir}")
    if manifest_path:
        lines.append(f"Manifest: {manifest_path}")

    artifact_source = _read_mapping_string(artifacts, "artifactSource")
    if artifact_source:
        lines.append(f"Artifact source: {artifact_source}")

    if runtime_package and runtime_version:
        lines.append(f"Runtime: {runtime_package}@{runtime_version}")

    if isinstance(result, Mapping) and result.get("ok") is True:
        health = _read_health_summary(result)
        if health is not None:
            lines.append(f"Governance status: {health}")
        blocking_count = count_blocking_violations(result)
        lines.append(f"Blocking violations: {blocking_count}")
        warning_count = _count_warnings(result, diagnostics)
        lines.append(f"Warnings and diagnostics: {warning_count}")

        top_items = _read_top_items(result)
        if top_items:
            lines.append("Top issues:")
            lines.extend(f"- {item}" for item in top_items)
    elif isinstance(result, Mapping) and result.get("ok") is False:
        lines.append("Governance status: runtime returned a structured error.")
        runtime_error = result.get("error")
        if isinstance(runtime_error, Mapping):
            code = _read_mapping_string(runtime_error, "code")
            stage = _read_mapping_string(runtime_error, "stage")
            message = _read_mapping_string(runtime_error, "message")
            summary = "Runtime error"
            if code:
                summary = f"{summary} [{code}]"
            if stage:
                summary = f"{summary} stage={stage}"
            if message:
                summary = f"{summary}: {message}"
            lines.append(summary)

    if report_path:
        lines.append(f"Report path: {report_path}")

    if diagnostics:
        if lines:
            lines.append("")
        lines.append("Diagnostics:")
        lines.extend(_render_diagnostic_lines(diagnostics))

    if exit_code == int(ExitCode.BLOCKING_VIOLATIONS):
        lines.append("")
        lines.append("Result: blocking governance violations were detected.")
    elif exit_code == int(ExitCode.INCOMPATIBLE_RUNTIME):
        lines.append("")
        lines.append("Result: runtime or contract compatibility failed.")
    elif exit_code == int(ExitCode.INVOCATION_FAILURE):
        lines.append("")
        lines.append("Result: host, dbt, or runtime execution failed.")

    return "\n".join(lines)


def render_json_report(report: Mapping[str, Any]) -> str:
    """Render the machine-readable JSON report."""

    return _render_json(dict(report))


def render_markdown_report(report: Mapping[str, Any]) -> str:
    """Render a minimal markdown report."""

    host = report.get("host")
    artifacts = report.get("artifacts")
    diagnostics = report.get("diagnostics")
    result = report.get("result")

    lines = ["# dbt Governance Report", "", "## Summary"]
    command = _read_mapping_string(host, "command")
    if command:
        lines.append(f"- Command: `{command}`")
    project_dir = _read_mapping_string(artifacts, "projectDir")
    if project_dir:
        lines.append(f"- Project directory: `{project_dir}`")
    manifest_path = _read_mapping_string(artifacts, "manifestPath")
    if manifest_path:
        lines.append(f"- Manifest path: `{manifest_path}`")
    runtime_package = _read_mapping_string(report.get("runtime"), "packageName")
    runtime_version = _read_mapping_string(report.get("runtime"), "version")
    if runtime_package and runtime_version:
        lines.append(f"- Runtime: `{runtime_package}@{runtime_version}`")
    if isinstance(result, Mapping) and result.get("ok") is True:
        lines.append(f"- Blocking violations: `{count_blocking_violations(result)}`")
        health = _read_health_summary(result)
        if health is not None:
            lines.append(f"- Governance status: `{health}`")
    elif isinstance(result, Mapping) and result.get("ok") is False:
        runtime_error = result.get("error")
        message = _read_mapping_string(runtime_error, "message")
        lines.append(f"- Runtime status: `{message or 'structured error'}`")
    lines.append(f"- Exit code: `{_read_mapping_int(host, 'exitCode')}`")

    if diagnostics:
        lines.extend(["", "## Diagnostics"])
        lines.extend(_render_markdown_diagnostics(diagnostics))

    violations = _read_violations(result)
    if violations:
        lines.extend(["", "## Violations"])
        lines.extend(_render_markdown_violations(violations))

    advisory_findings = _read_advisory_findings(result)
    if advisory_findings:
        lines.extend(["", "## Advisory Findings"])
        lines.extend(_render_markdown_advisory_findings(advisory_findings))

    recommendations = _read_recommendations(result)
    if recommendations:
        lines.extend(["", "## Recommendations"])
        lines.extend(_render_markdown_recommendations(recommendations))

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
        (
            f"Config: {report.config_path} (loaded)"
            if report.config_loaded and report.config_path is not None
            else (
                f"Config: {report.config_path} (explicit path, not loaded)"
                if report.config_explicit and report.config_path is not None
                else "Config: defaults"
            )
        ),
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


def _serialize_diagnostic(diagnostic: HostDiagnostic) -> dict[str, Any]:
    return {
        "code": diagnostic.code,
        "message": diagnostic.message,
        "severity": diagnostic.severity,
        "path": diagnostic.path,
        "recommendation": diagnostic.recommendation,
        "details": diagnostic.details,
    }


def _serialize_artifact_result(
    artifact_result: ArtifactResolutionResult | None,
) -> dict[str, Any] | None:
    if artifact_result is None or artifact_result.context is None:
        return None

    artifact_paths = artifact_result.context.artifact_paths
    payload: dict[str, Any] = {
        "projectDir": str(artifact_result.context.project_dir),
        "dbtProjectPath": str(artifact_result.context.dbt_project_path),
        "targetPath": str(artifact_result.context.target_path),
        "manifestPath": str(artifact_paths.manifest_path),
        "usedExistingArtifacts": artifact_result.used_existing_artifacts,
        "invokedParse": artifact_result.invoked_parse,
        "artifactSource": (
            "dbt parse"
            if artifact_result.invoked_parse
            else "existing manifest.json"
        ),
    }
    if artifact_paths.catalog_path is not None:
        payload["catalogPath"] = str(artifact_paths.catalog_path)
    if artifact_paths.run_results_path is not None:
        payload["runResultsPath"] = str(artifact_paths.run_results_path)
    if artifact_paths.sources_path is not None:
        payload["sourcesPath"] = str(artifact_paths.sources_path)
    return payload


def _render_diagnostic_lines(
    diagnostics: Any,
) -> list[str]:
    lines: list[str] = []
    if not isinstance(diagnostics, list):
        return lines

    for diagnostic in diagnostics:
        if not isinstance(diagnostic, Mapping):
            continue
        code = _read_mapping_string(diagnostic, "code") or "unknown"
        severity = _read_mapping_string(diagnostic, "severity") or "error"
        message = _read_mapping_string(diagnostic, "message") or ""
        lines.append(f"{severity.upper()} [{code}] {message}".rstrip())
        path = _read_mapping_string(diagnostic, "path")
        if path:
            lines.append(f"Path: {path}")
        recommendation = _read_mapping_string(diagnostic, "recommendation")
        if recommendation:
            lines.append(f"Recommendation: {recommendation}")
    return lines


def _read_runtime_metadata(runtime_payload: Any) -> dict[str, Any]:
    if isinstance(runtime_payload, Mapping):
        metadata = runtime_payload.get("metadata")
        if isinstance(metadata, Mapping):
            runtime_metadata = metadata.get("runtime")
            if isinstance(runtime_metadata, Mapping):
                return dict(runtime_metadata)
        runtime = runtime_payload.get("runtime")
        if isinstance(runtime, Mapping):
            return dict(runtime)
    return {}


def _read_health_summary(result: Mapping[str, Any]) -> str | None:
    assessment = result.get("assessment")
    if not isinstance(assessment, Mapping):
        return None
    health = assessment.get("health")
    if not isinstance(health, Mapping):
        return None

    status = _read_mapping_string(health, "status")
    score = health.get("score")
    grade = _read_mapping_string(health, "grade")
    if status is None:
        return None

    segments = [status]
    if isinstance(score, (int, float)):
        segments.append(f"score={score}")
    if grade is not None:
        segments.append(f"grade={grade}")
    return ", ".join(segments)


def _count_warnings(result: Mapping[str, Any], diagnostics: Any) -> int:
    warning_count = 0
    for diagnostic in _read_runtime_diagnostics(result):
        if _read_mapping_string(diagnostic, "severity") == "warning":
            warning_count += 1

    assessment = result.get("assessment")
    if isinstance(assessment, Mapping):
        warnings = assessment.get("warnings")
        if isinstance(warnings, list):
            warning_count += len(warnings)

    if isinstance(diagnostics, list):
        for diagnostic in diagnostics:
            if (
                isinstance(diagnostic, Mapping)
                and diagnostic.get("severity") == "warning"
            ):
                warning_count += 1

    return warning_count


def _read_top_items(result: Mapping[str, Any]) -> list[str]:
    assessment = result.get("assessment")
    if not isinstance(assessment, Mapping):
        return []

    top_issues = assessment.get("topIssues")
    if isinstance(top_issues, list):
        issue_messages = [
            _read_mapping_string(issue, "message")
            for issue in top_issues[:3]
            if isinstance(issue, Mapping)
        ]
        return [message for message in issue_messages if message]

    recommendations = assessment.get("recommendations")
    if isinstance(recommendations, list):
        titles = [
            _read_mapping_string(recommendation, "title")
            for recommendation in recommendations[:3]
            if isinstance(recommendation, Mapping)
        ]
        return [title for title in titles if title]

    return []


def _read_runtime_diagnostics(result: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    diagnostics: list[Mapping[str, Any]] = []
    for key in ("diagnostics", "extensionDiagnostics"):
        payload = result.get(key)
        if isinstance(payload, list):
            diagnostics.extend(
                diagnostic
                for diagnostic in payload
                if isinstance(diagnostic, Mapping)
            )
    return diagnostics


def _read_violations(result: Any) -> list[Mapping[str, Any]]:
    if not isinstance(result, Mapping):
        return []

    assessment = result.get("assessment")
    if isinstance(assessment, Mapping) and isinstance(
        assessment.get("violations"), list
    ):
        return [
            violation
            for violation in assessment["violations"]
            if isinstance(violation, Mapping)
        ]

    violations = result.get("violations")
    if isinstance(violations, list):
        return [
            violation for violation in violations if isinstance(violation, Mapping)
        ]

    return []


def _read_recommendations(result: Any) -> list[Mapping[str, Any]]:
    if not isinstance(result, Mapping):
        return []

    assessment = result.get("assessment")
    if isinstance(assessment, Mapping) and isinstance(
        assessment.get("recommendations"), list
    ):
        return [
            recommendation
            for recommendation in assessment["recommendations"]
            if isinstance(recommendation, Mapping)
        ]

    return []


def _read_advisory_findings(result: Any) -> list[Mapping[str, Any]]:
    if not isinstance(result, Mapping):
        return []

    assessment = result.get("assessment")
    if isinstance(assessment, Mapping) and isinstance(
        assessment.get("topIssues"), list
    ):
        return [
            issue for issue in assessment["topIssues"] if isinstance(issue, Mapping)
        ]

    return []


def _render_markdown_diagnostics(diagnostics: Any) -> list[str]:
    lines: list[str] = []
    for diagnostic in diagnostics if isinstance(diagnostics, list) else []:
        if not isinstance(diagnostic, Mapping):
            continue
        code = _read_mapping_string(diagnostic, "code") or "unknown"
        message = _read_mapping_string(diagnostic, "message") or ""
        lines.append(f"- `{code}`: {message}".rstrip())
    return lines or ["- None"]


def _render_markdown_violations(violations: list[Mapping[str, Any]]) -> list[str]:
    lines: list[str] = []
    for violation in violations:
        rule_id = _read_mapping_string(violation, "ruleId") or "unknown-rule"
        severity = _read_mapping_string(violation, "severity") or "unknown"
        message = _read_mapping_string(violation, "message") or ""
        lines.append(f"- `{severity}` `{rule_id}`: {message}".rstrip())
    return lines or ["- None"]


def _render_markdown_advisory_findings(
    advisory_findings: list[Mapping[str, Any]],
) -> list[str]:
    lines: list[str] = []
    for issue in advisory_findings:
        message = _read_mapping_string(issue, "message") or "Advisory finding"
        details: list[str] = []

        issue_type = _read_mapping_string(issue, "type")
        if issue_type:
            details.append(f"type: `{issue_type}`")

        severity = _read_mapping_string(issue, "severity")
        if severity:
            details.append(f"severity: `{severity}`")

        code = _read_mapping_string(issue, "code")
        if code:
            details.append(f"code: `{code}`")

        rule_id = _read_mapping_string(issue, "ruleId")
        if rule_id:
            details.append(f"rule: `{rule_id}`")

        details.extend(
            _render_subject_context(_read_mapping_string_values(issue, "subjects"))
        )
        details.extend(
            _render_reference_context(
                reference=issue.get("reference"),
                metadata=issue.get("metadata"),
                node_id=_read_mapping_string(issue, "nodeId"),
                relation_id=_read_mapping_string(issue, "relationId"),
            )
        )

        lines.append(_append_markdown_details(f"- {message}", details))

    return lines or ["- None"]


def _render_markdown_recommendations(
    recommendations: list[Mapping[str, Any]],
) -> list[str]:
    lines: list[str] = []
    for recommendation in recommendations:
        title = (
            _read_mapping_string(recommendation, "title")
            or "Untitled recommendation"
        )
        reason = _read_mapping_string(recommendation, "reason")
        details = _render_reference_context(
            reference=recommendation.get("reference"),
            metadata=recommendation.get("metadata"),
        )
        if reason:
            lines.append(_append_markdown_details(f"- **{title}**: {reason}", details))
        else:
            lines.append(_append_markdown_details(f"- **{title}**", details))
    return lines or ["- None"]


def _render_reference_context(
    *,
    reference: Any,
    metadata: Any,
    node_id: str | None = None,
    relation_id: str | None = None,
) -> list[str]:
    details: list[str] = []
    reference_mapping = reference if isinstance(reference, Mapping) else None

    resolved_node_id = (
        _read_mapping_string(reference_mapping, "nodeId") if reference_mapping else None
    ) or node_id
    resolved_relation_id = (
        _read_mapping_string(reference_mapping, "relationId")
        if reference_mapping
        else None
    ) or relation_id
    related_node_ids = (
        _read_mapping_string_values(reference_mapping, "relatedNodeIds")
        if reference_mapping
        else []
    )

    if resolved_node_id:
        details.append(f"node: `{resolved_node_id}`")
    if resolved_relation_id:
        details.append(f"relation: `{resolved_relation_id}`")

    metadata_mapping = metadata if isinstance(metadata, Mapping) else None
    governance_node_id = _read_mapping_string(metadata_mapping, "governanceNodeId")
    if governance_node_id and governance_node_id != resolved_node_id:
        details.append(f"governance: `{governance_node_id}`")

    dbt_unique_id = _read_mapping_string(metadata_mapping, "dbtUniqueId")
    if dbt_unique_id and dbt_unique_id != resolved_node_id:
        details.append(f"dbt: `{dbt_unique_id}`")

    dependency_key = _read_mapping_string(metadata_mapping, "dependencyKey")
    if dependency_key:
        details.append(f"dependency: `{dependency_key}`")

    related_details = _render_related_node_context(
        related_node_ids,
        resolved_node_id=resolved_node_id,
        dbt_unique_id=dbt_unique_id,
    )
    if related_details:
        details.append(related_details)

    return details


def _render_related_node_context(
    related_node_ids: list[str],
    *,
    resolved_node_id: str | None,
    dbt_unique_id: str | None,
) -> str | None:
    deduped_related_node_ids = _dedupe_strings(related_node_ids)
    if not deduped_related_node_ids:
        return None

    has_test_reference = _is_generated_test_node_id(
        resolved_node_id
    ) or _is_generated_test_node_id(dbt_unique_id)
    if has_test_reference:
        non_test_related_node_ids = [
            node_id
            for node_id in deduped_related_node_ids
            if not _is_generated_test_node_id(node_id)
        ]
        if non_test_related_node_ids:
            deduped_related_node_ids = non_test_related_node_ids

    label = "affected" if has_test_reference else "related"
    rendered_related_node_ids = ", ".join(
        f"`{node_id}`" for node_id in deduped_related_node_ids
    )
    return f"{label}: {rendered_related_node_ids}"


def _render_subject_context(subjects: list[str]) -> list[str]:
    deduped_subjects = _dedupe_strings(subjects)
    if not deduped_subjects:
        return []
    rendered_subjects = ", ".join(f"`{subject}`" for subject in deduped_subjects)
    return [f"subjects: {rendered_subjects}"]


def _append_markdown_details(base: str, details: list[str]) -> str:
    if not details:
        return base
    return f"{base} | {' | '.join(details)}"


def _read_mapping_string_values(payload: Any, key: str) -> list[str]:
    if not isinstance(payload, Mapping):
        return []
    return _read_string_values(payload.get(key))


def _read_string_values(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    return []


def _dedupe_strings(values: list[str]) -> list[str]:
    deduped_values: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value and value not in seen:
            seen.add(value)
            deduped_values.append(value)
    return deduped_values


def _is_generated_test_node_id(value: str | None) -> bool:
    return isinstance(value, str) and value.startswith("test.")


def _read_mapping_string(payload: Any, key: str) -> str | None:
    if isinstance(payload, Mapping):
        value = payload.get(key)
        if isinstance(value, str):
            return value
    return None


def _read_mapping_int(payload: Any, key: str) -> int | None:
    if isinstance(payload, Mapping):
        value = payload.get(key)
        if isinstance(value, int):
            return value
    return None
