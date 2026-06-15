"""dbt project placeholders for the scaffolded host package."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DbtProjectRef:
    """Reference to a dbt project root without any adapter logic."""

    root: Path
