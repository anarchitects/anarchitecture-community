"""governance.yml loading and init tests for the dbt host."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from anarchitecture_dbt_governance.config import (
    init_governance_config,
    load_governance_config,
)


class ConfigTests(unittest.TestCase):
    """Verify governance.yml loading, validation, and init behavior."""

    def test_no_config_file_uses_defaults(self) -> None:
        with TemporaryDirectory() as temp_dir:
            result = load_governance_config(cwd=Path(temp_dir))

        self.assertTrue(result.supported)
        self.assertFalse(result.config.loaded_from_file)
        self.assertEqual(result.config.host.artifact_mode, "require-existing")
        self.assertEqual(result.config.host.output, "human")
        self.assertFalse(result.config.profile.document_provided)
        self.assertEqual(result.config.profile.document["name"], "dbt")

    def test_explicit_config_file_loads(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            config_path = root / "custom.yml"
            write_fixture_file(
                config_path,
                (
                    "profile:\n"
                    "  path: governance.profile.yml\n"
                    "adapter:\n"
                    "  options:\n"
                    "    validationMode: relaxed\n"
                    "host:\n"
                    "  output: json\n"
                ),
            )

            result = load_governance_config(
                explicit_path=str(config_path),
                cwd=root,
            )

        self.assertTrue(result.supported)
        self.assertTrue(result.config.loaded_from_file)
        self.assertEqual(result.config.profile.path, "governance.profile.yml")
        self.assertFalse(result.config.profile.document_provided)
        self.assertEqual(result.config.adapter.options["validationMode"], "relaxed")
        self.assertEqual(result.config.host.output, "json")

    def test_explicit_profile_document_is_marked_as_provided(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            config_path = root / "governance.yml"
            write_fixture_file(
                config_path,
                "profile:\n  document:\n    name: dbt-demo\n",
            )

            result = load_governance_config(
                explicit_path=str(config_path),
                cwd=root,
            )

        self.assertTrue(result.supported)
        self.assertTrue(result.config.profile.document_provided)
        self.assertEqual(result.config.profile.document["name"], "dbt-demo")

    def test_default_governance_yml_loads_from_project_dir(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir) / "analytics"
            write_fixture_file(
                project_dir / "governance.yml",
                "runtime:\n  reportPath: target/governance-report.json\n",
            )

            result = load_governance_config(
                project_dir=str(project_dir),
                cwd=Path(temp_dir),
            )

        self.assertTrue(result.supported)
        self.assertTrue(result.config.loaded_from_file)
        self.assertEqual(
            result.config.runtime.report_path,
            "target/governance-report.json",
        )

    def test_explicit_missing_config_returns_diagnostic(self) -> None:
        with TemporaryDirectory() as temp_dir:
            result = load_governance_config(
                explicit_path="missing.yml",
                cwd=Path(temp_dir),
            )

        self.assertFalse(result.supported)
        self.assertEqual(
            result.diagnostics[0].code,
            "governance.host_dbt.config_file_not_found",
        )

    def test_invalid_yaml_returns_diagnostic(self) -> None:
        with TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "governance.yml"
            write_fixture_file(config_path, "profile: [\n")

            result = load_governance_config(
                explicit_path=str(config_path),
                cwd=Path(temp_dir),
            )

        self.assertFalse(result.supported)
        self.assertEqual(
            result.diagnostics[0].code,
            "governance.host_dbt.invalid_config_yaml",
        )

    def test_top_level_non_object_returns_diagnostic(self) -> None:
        with TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "governance.yml"
            write_fixture_file(config_path, "- not-an-object\n")

            result = load_governance_config(
                explicit_path=str(config_path),
                cwd=Path(temp_dir),
            )

        self.assertFalse(result.supported)
        self.assertEqual(
            result.diagnostics[0].code,
            "governance.host_dbt.invalid_config_shape",
        )

    def test_invalid_section_type_returns_diagnostic(self) -> None:
        with TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "governance.yml"
            write_fixture_file(config_path, "runtime: []\n")

            result = load_governance_config(
                explicit_path=str(config_path),
                cwd=Path(temp_dir),
            )

        self.assertFalse(result.supported)
        self.assertEqual(
            result.diagnostics[0].code,
            "governance.host_dbt.invalid_config_section",
        )

    def test_init_creates_valid_starter_config(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            result = init_governance_config(cwd=root)
            loaded = load_governance_config(cwd=root)
            config_exists = (root / "governance.yml").is_file()

            self.assertTrue(result.supported)
            self.assertTrue(config_exists)
            self.assertTrue(loaded.supported)
            self.assertTrue(loaded.config.loaded_from_file)
            self.assertEqual(loaded.config.profile.document["name"], "dbt")
            self.assertEqual(
                loaded.config.runtime.report_path,
                "target/governance-report.json",
            )
            self.assertEqual(
                loaded.config.host.artifact_mode,
                "use-existing-or-parse",
            )


def write_fixture_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
