"""Renderer helpers for placeholder command output."""


def render_not_implemented(command: str) -> str:
    """Render a consistent placeholder message for a command."""

    return f"dbt-governance {command} is not implemented yet."
