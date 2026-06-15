"""Invocation models for placeholder CLI commands."""

from __future__ import annotations

from dataclasses import dataclass


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


@dataclass(frozen=True)
class RuntimeInvocation:
    """Invocation model for scaffolded and implemented commands."""

    command: str
    check_options: CheckCommandOptions | None = None
