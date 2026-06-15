"""Runtime coordination for the future dbt host."""

from __future__ import annotations

from dataclasses import dataclass

from .artifact_manager import resolve_artifacts
from .dbt_project import resolve_dbt_path_hints
from .exit_codes import ExitCode
from .renderer import render_check_success, render_diagnostics, render_not_implemented
from .runtime_invocation import RuntimeInvocation


@dataclass(frozen=True)
class InvocationExecutionResult:
    """Rendered command result and exit code."""

    exit_code: ExitCode
    output: str


def execute_invocation(invocation: RuntimeInvocation) -> InvocationExecutionResult:
    """Execute a host command without crossing into runtime composition yet."""

    if invocation.command == "check" and invocation.check_options is not None:
        detection = resolve_dbt_path_hints(
            project_dir=invocation.check_options.project_dir,
            profiles_dir=invocation.check_options.profiles_dir,
            target=invocation.check_options.target,
            target_path=invocation.check_options.target_path,
            config=invocation.check_options.config,
        )
        if not detection.supported or detection.context is None:
            return InvocationExecutionResult(
                exit_code=ExitCode.HOST_ERROR,
                output=render_diagnostics(detection.diagnostics),
            )

        resolved = resolve_artifacts(
            detection.context,
            parse=invocation.check_options.parse,
            use_existing_artifacts=invocation.check_options.use_existing_artifacts,
        )
        if not resolved.supported:
            return InvocationExecutionResult(
                exit_code=ExitCode.HOST_ERROR,
                output=render_diagnostics(resolved.diagnostics),
            )

        return InvocationExecutionResult(
            exit_code=ExitCode.SUCCESS,
            output=render_check_success(resolved),
        )

    return InvocationExecutionResult(
        exit_code=ExitCode.SUCCESS,
        output=render_not_implemented(invocation.command),
    )
