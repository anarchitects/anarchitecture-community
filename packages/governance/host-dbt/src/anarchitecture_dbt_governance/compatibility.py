"""Compatibility helpers and runtime manifest loading."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from importlib.resources import files
from json import JSONDecodeError
from pathlib import Path


@dataclass(frozen=True)
class RuntimeManifest:
    """Runtime contract metadata for the future Node composition layer."""

    runtime_package: str
    runtime_version: str
    node_range: str
    contract_version: str


class RuntimeManifestError(ValueError):
    """Raised when the packaged runtime manifest is invalid."""


def load_runtime_manifest(manifest_path: Path | None = None) -> RuntimeManifest:
    """Load and validate the packaged runtime manifest."""

    resolved_manifest_path = manifest_path or Path(
        str(files(__package__).joinpath("runtime_manifest.json"))
    )
    try:
        payload = json.loads(resolved_manifest_path.read_text(encoding="utf-8"))
    except JSONDecodeError as error:
        raise RuntimeManifestError(
            f"runtime_manifest.json contains invalid JSON: {error.msg}."
        ) from error

    return RuntimeManifest(
        runtime_package=_require_manifest_value(payload, "runtimePackage"),
        runtime_version=_require_manifest_value(payload, "runtimeVersion"),
        node_range=_require_manifest_value(payload, "nodeRange"),
        contract_version=_require_manifest_value(payload, "contractVersion"),
    )


def parse_node_version(version_text: str) -> tuple[int, int, int]:
    """Parse `node --version` output into a semantic version tuple."""

    match = re.fullmatch(
        r"v?(?P<major>\d+)(?:\.(?P<minor>\d+))?(?:\.(?P<patch>\d+))?",
        version_text.strip(),
    )
    if match is None:
        raise ValueError(f"Unsupported Node.js version format: {version_text!r}")

    return (
        int(match.group("major")),
        int(match.group("minor") or 0),
        int(match.group("patch") or 0),
    )


def is_supported_node_version(version_text: str, node_range: str) -> bool:
    """Return whether the parsed Node.js version satisfies the manifest range."""

    major, _, _ = parse_node_version(version_text)
    lower_bound, upper_bound = _parse_major_node_range(node_range)
    return lower_bound <= major < upper_bound


def _parse_major_node_range(node_range: str) -> tuple[int, int]:
    match = re.fullmatch(r">=(?P<lower>\d+)\s+<(?P<upper>\d+)", node_range.strip())
    if match is None:
        raise ValueError(f"Unsupported Node.js range format: {node_range!r}")

    return int(match.group("lower")), int(match.group("upper"))


def _require_manifest_value(payload: object, field_name: str) -> str:
    if not isinstance(payload, dict):
        raise RuntimeManifestError("runtime_manifest.json must contain a JSON object.")

    value = payload.get(field_name)
    if not isinstance(value, str) or not value.strip():
        raise RuntimeManifestError(
            f'runtime_manifest.json must define a non-empty "{field_name}" string.'
        )

    return value
