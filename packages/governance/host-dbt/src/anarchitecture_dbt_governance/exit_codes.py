"""Process exit codes for the dbt Governance host."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from enum import IntEnum
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .dbt_project import HostDiagnostic


class ExitCode(IntEnum):
    """Exit codes reserved for the host CLI."""

    SUCCESS = 0
    BLOCKING_VIOLATIONS = 1
    INVOCATION_FAILURE = 2
    INCOMPATIBLE_RUNTIME = 3


INCOMPATIBLE_DIAGNOSTIC_CODES = frozenset(
    {
        "governance.host_dbt.invalid_runtime_manifest",
        "governance.host_dbt.unsupported_node_version",
        "governance.host_dbt.runtime_package_name_mismatch",
        "governance.host_dbt.runtime_package_version_mismatch",
        "governance.host_dbt.incompatible_runtime_metadata",
    }
)


def exit_code_for_diagnostics(diagnostics: Sequence[HostDiagnostic]) -> ExitCode:
    """Map host diagnostics to a deterministic process exit code."""

    if any(
        diagnostic.code in INCOMPATIBLE_DIAGNOSTIC_CODES for diagnostic in diagnostics
    ):
        return ExitCode.INCOMPATIBLE_RUNTIME
    return ExitCode.INVOCATION_FAILURE


def exit_code_for_runtime_result(runtime_result: Mapping[str, Any]) -> ExitCode:
    """Map a structured runtime result to a deterministic process exit code."""

    return exit_code_for_runtime_result_with_policy(runtime_result)


def exit_code_for_runtime_result_with_policy(
    runtime_result: Mapping[str, Any],
    *,
    fail_on_blocking_violations: bool = True,
) -> ExitCode:
    """Map a structured runtime result using the host CI blocking policy."""

    if runtime_result.get("ok") is False:
        return ExitCode.INVOCATION_FAILURE

    if fail_on_blocking_violations and has_blocking_violations(runtime_result):
        return ExitCode.BLOCKING_VIOLATIONS

    return ExitCode.SUCCESS


def has_blocking_violations(runtime_result: Mapping[str, Any]) -> bool:
    """Determine whether the runtime result contains blocking violations."""

    for violation in _iter_violations(runtime_result):
        if not isinstance(violation, Mapping):
            continue
        if violation.get("blocking") is True:
            return True
        if violation.get("severity") == "error":
            return True

    return False


def count_blocking_violations(runtime_result: Mapping[str, Any]) -> int:
    """Count blocking violations from the preserved runtime result."""

    count = 0
    for violation in _iter_violations(runtime_result):
        if not isinstance(violation, Mapping):
            continue
        if violation.get("blocking") is True or violation.get("severity") == "error":
            count += 1

    return count


def _iter_violations(runtime_result: Mapping[str, Any]) -> list[Any]:
    assessment = runtime_result.get("assessment")
    if isinstance(assessment, Mapping):
        assessment_violations = assessment.get("violations")
        if isinstance(assessment_violations, list):
            return assessment_violations

    violations = runtime_result.get("violations")
    if isinstance(violations, list):
        return violations

    return []
