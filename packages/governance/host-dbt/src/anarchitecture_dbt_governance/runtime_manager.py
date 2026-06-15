"""Runtime coordination placeholders for the future dbt host."""

from __future__ import annotations

from .renderer import render_not_implemented
from .runtime_invocation import RuntimeInvocation


def execute_invocation(invocation: RuntimeInvocation) -> str:
    """Return the current placeholder result for a command invocation."""

    return render_not_implemented(invocation.command)
