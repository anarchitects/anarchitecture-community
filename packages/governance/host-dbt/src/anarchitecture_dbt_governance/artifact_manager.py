"""Artifact lifecycle placeholders for the future dbt host."""

from __future__ import annotations

from dataclasses import dataclass

from .dbt_project import DbtProjectRef


@dataclass(frozen=True)
class ArtifactManager:
    """Placeholder manager for future dbt artifact orchestration."""

    project: DbtProjectRef

    def describe(self) -> str:
        """Describe the current scaffold state."""

        return (
            "Artifact management is not implemented yet. "
            "This scaffold does not load or normalize dbt artifacts."
        )
