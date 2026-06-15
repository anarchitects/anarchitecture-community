"""Boundary tests for the dbt Governance host scaffold."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from anarchitecture_dbt_governance.compatibility import load_runtime_manifest

FORBIDDEN_DEPENDENCIES = (
    "@anarchitects/governance-core",
    "@anarchitects/governance-adapter-dbt",
    "@anarchitects/governance-extension-dbt",
)

FORBIDDEN_IMPORT_TOKENS = (
    "governance_core",
    "governance_adapter_dbt",
    "governance_extension_dbt",
    "@anarchitects/governance-core",
    "@anarchitects/governance-adapter-dbt",
    "@anarchitects/governance-extension-dbt",
)


class BoundaryTests(unittest.TestCase):
    """Verify the scaffold respects the package boundary constraints."""

    def test_pyproject_has_no_forbidden_runtime_dependencies(self) -> None:
        pyproject_text = (
            Path(__file__).resolve().parents[1] / "pyproject.toml"
        ).read_text(encoding="utf-8")

        for dependency in FORBIDDEN_DEPENDENCIES:
            self.assertNotIn(dependency, pyproject_text)

    def test_source_has_no_forbidden_import_tokens(self) -> None:
        source_root = (
            Path(__file__).resolve().parents[1]
            / "src"
            / "anarchitecture_dbt_governance"
        )
        for source_file in source_root.rglob("*.py"):
            source_text = source_file.read_text(encoding="utf-8")
            for token in FORBIDDEN_IMPORT_TOKENS:
                self.assertNotIn(token, source_text, source_file.as_posix())

    def test_runtime_manifest_matches_requested_contract(self) -> None:
        manifest = load_runtime_manifest()

        self.assertEqual(
            manifest.runtime_package,
            "@anarchitects/governance-runtime-dbt",
        )
        self.assertEqual(manifest.runtime_version, "0.0.1")
        self.assertEqual(manifest.node_range, ">=20 <25")
        self.assertEqual(manifest.contract_version, "1.0.0")

    def test_cli_entrypoint_is_declared(self) -> None:
        pyproject_text = (
            Path(__file__).resolve().parents[1] / "pyproject.toml"
        ).read_text(encoding="utf-8")

        self.assertIn(
            'dbt-governance = "anarchitecture_dbt_governance.cli:main"',
            pyproject_text,
        )

    def test_runtime_manifest_file_is_packaged_json(self) -> None:
        manifest_path = (
            Path(__file__).resolve().parents[1]
            / "src"
            / "anarchitecture_dbt_governance"
            / "runtime_manifest.json"
        )
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))

        self.assertEqual(
            payload["runtimePackage"],
            "@anarchitects/governance-runtime-dbt",
        )


if __name__ == "__main__":
    unittest.main()
