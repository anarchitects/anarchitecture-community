"""Configuration placeholders for the future dbt Governance host."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .compatibility import RuntimeManifest, load_runtime_manifest


@dataclass(frozen=True)
class HostConfig:
    """Host-owned configuration surface for future implementation."""

    profile: dict[str, Any] = field(default_factory=dict)
    adapter: dict[str, Any] = field(default_factory=dict)
    extension: dict[str, Any] = field(default_factory=dict)
    runtime: dict[str, Any] = field(default_factory=dict)
    manifest: RuntimeManifest = field(default_factory=load_runtime_manifest)
