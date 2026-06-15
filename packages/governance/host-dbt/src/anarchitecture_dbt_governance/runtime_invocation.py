"""Invocation models for placeholder CLI commands."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class RuntimeInvocation:
    """Minimal invocation model for scaffolded commands."""

    command: str
    extra_args: list[str] = field(default_factory=list)
