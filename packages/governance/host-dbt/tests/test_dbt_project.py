"""dbt project detection tests for the host package."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from anarchitecture_dbt_governance.dbt_project import resolve_dbt_path_hints


class DbtProjectDetectionTests(unittest.TestCase):
    """Verify host-local dbt path hint resolution rules."""

    def test_detects_project_from_current_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")

            result = resolve_dbt_path_hints(cwd=project_dir)

        self.assertTrue(result.supported)
        self.assertEqual(result.diagnostics, [])
        self.assertEqual(result.context.project_dir, project_dir.resolve())  # type: ignore[union-attr]

    def test_detects_project_from_explicit_project_dir(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir) / "analytics"
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")

            result = resolve_dbt_path_hints(
                project_dir=str(project_dir),
                cwd=Path(temp_dir),
            )

        self.assertTrue(result.supported)
        self.assertEqual(
            result.context.dbt_project_path,  # type: ignore[union-attr]
            project_dir.resolve() / "dbt_project.yml",
        )

    def test_reports_missing_dbt_project_yml(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            result = resolve_dbt_path_hints(cwd=project_dir)

        self.assertFalse(result.supported)
        self.assertEqual(
            result.diagnostics[0].code,
            "governance.host_dbt.missing_dbt_project_file",
        )

    def test_resolves_default_target_path(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")

            result = resolve_dbt_path_hints(cwd=project_dir)

        self.assertEqual(
            result.context.target_path,  # type: ignore[union-attr]
            (project_dir / "target").resolve(),
        )

    def test_resolves_custom_target_path(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")

            result = resolve_dbt_path_hints(
                cwd=project_dir,
                target_path="build-artifacts",
            )

        self.assertEqual(
            result.context.target_path,  # type: ignore[union-attr]
            (project_dir / "build-artifacts").resolve(),
        )

    def test_reports_invalid_target_path(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = Path(temp_dir)
            write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
            write_fixture_file(project_dir / "broken-target", "not a directory")

            result = resolve_dbt_path_hints(
                cwd=project_dir,
                target_path="broken-target",
            )

        self.assertFalse(result.supported)
        self.assertEqual(
            result.diagnostics[0].code,
            "governance.host_dbt.invalid_target_path",
        )


def write_fixture_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
