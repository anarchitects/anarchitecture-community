"""Compatibility and runtime manifest tests for the host package."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from anarchitecture_dbt_governance.compatibility import (
    RuntimeManifestError,
    is_supported_node_version,
    load_runtime_manifest,
)


class CompatibilityTests(unittest.TestCase):
    """Verify runtime manifest loading and Node compatibility checks."""

    def test_load_runtime_manifest_reads_packaged_manifest(self) -> None:
        manifest = load_runtime_manifest()

        self.assertEqual(
            manifest.runtime_package,
            "@anarchitects/governance-runtime-dbt",
        )
        self.assertEqual(manifest.runtime_version, "0.0.1")
        self.assertEqual(manifest.node_range, ">=20 <25")
        self.assertEqual(manifest.contract_version, "1.0.0")

    def test_load_runtime_manifest_rejects_invalid_json(self) -> None:
        with TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "runtime_manifest.json"
            manifest_path.write_text("{not-json", encoding="utf-8")

            with self.assertRaises(RuntimeManifestError):
                load_runtime_manifest(manifest_path)

    def test_load_runtime_manifest_requires_all_fields(self) -> None:
        with TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "runtime_manifest.json"
            manifest_path.write_text(
                json.dumps(
                    {
                        "runtimePackage": "@anarchitects/governance-runtime-dbt",
                        "runtimeVersion": "0.0.1",
                        "nodeRange": ">=20 <25",
                    }
                ),
                encoding="utf-8",
            )

            with self.assertRaises(RuntimeManifestError):
                load_runtime_manifest(manifest_path)

    def test_node_20_is_supported(self) -> None:
        self.assertTrue(is_supported_node_version("v20.11.1", ">=20 <25"))

    def test_node_22_is_supported(self) -> None:
        self.assertTrue(is_supported_node_version("v22.3.0", ">=20 <25"))

    def test_node_24_is_supported(self) -> None:
        self.assertTrue(is_supported_node_version("v24.0.0", ">=20 <25"))

    def test_node_25_is_not_supported(self) -> None:
        self.assertFalse(is_supported_node_version("v25.0.0", ">=20 <25"))


if __name__ == "__main__":
    unittest.main()
