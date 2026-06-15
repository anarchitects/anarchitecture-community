"""Compatibility helpers and runtime manifest loading."""

from __future__ import annotations

import json
from dataclasses import dataclass
from importlib.resources import files


@dataclass(frozen=True)
class RuntimeManifest:
    """Runtime contract metadata for the future Node composition layer."""

    runtime_package: str
    runtime_version: str
    node_range: str
    contract_version: str


def load_runtime_manifest() -> RuntimeManifest:
    """Load the packaged runtime manifest."""

    manifest_path = files(__package__).joinpath("runtime_manifest.json")
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    return RuntimeManifest(
        runtime_package=payload["runtimePackage"],
        runtime_version=payload["runtimeVersion"],
        node_range=payload["nodeRange"],
        contract_version=payload["contractVersion"],
    )
