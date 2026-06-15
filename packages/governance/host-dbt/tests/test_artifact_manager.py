"""dbt artifact lifecycle tests for the host package."""

from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from anarchitecture_dbt_governance.artifact_manager import resolve_artifacts
from anarchitecture_dbt_governance.dbt_project import resolve_dbt_path_hints


class ArtifactManagerTests(unittest.TestCase):
    """Verify artifact lookup and dbt parse orchestration."""

    @patch("anarchitecture_dbt_governance.artifact_manager.subprocess.run")
    def test_existing_manifest_is_used_without_dbt_invocation(self, run_mock) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(
                Path(temp_dir),
                include_manifest=True,
            )
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            result = resolve_artifacts(
                detection.context,  # type: ignore[arg-type]
                parse=True,
                use_existing_artifacts=False,
            )

        self.assertTrue(result.supported)
        self.assertTrue(result.used_existing_artifacts)
        self.assertFalse(result.invoked_parse)
        run_mock.assert_not_called()

    def test_detects_optional_artifacts_when_present(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(
                Path(temp_dir),
                include_manifest=True,
                include_optional=True,
            )
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            result = resolve_artifacts(
                detection.context,  # type: ignore[arg-type]
                parse=False,
                use_existing_artifacts=False,
            )

        self.assertEqual(
            result.context.artifact_paths.catalog_path.name,  # type: ignore[union-attr]
            "catalog.json",
        )
        self.assertEqual(
            result.context.artifact_paths.run_results_path.name,  # type: ignore[union-attr]
            "run_results.json",
        )
        self.assertEqual(
            result.context.artifact_paths.sources_path.name,  # type: ignore[union-attr]
            "sources.json",
        )

    def test_missing_manifest_without_parse_returns_diagnostic(self) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=False)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            result = resolve_artifacts(
                detection.context,  # type: ignore[arg-type]
                parse=False,
                use_existing_artifacts=False,
            )

        self.assertFalse(result.supported)
        self.assertEqual(
            result.diagnostics[0].code,
            "governance.host_dbt.missing_manifest",
        )

    @patch("anarchitecture_dbt_governance.artifact_manager.subprocess.run")
    def test_missing_manifest_with_parse_invokes_dbt_parse(self, run_mock) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=False)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))

            def fake_run(*args, **kwargs):  # type: ignore[no-untyped-def]
                write_fixture_file(
                    project_dir / "target" / "manifest.json",
                    '{"generated": true}',
                )
                return subprocess.CompletedProcess(
                    args=kwargs.get("args", ["dbt", "parse"]),
                    returncode=0,
                    stdout="parse ok",
                    stderr="",
                )

            run_mock.side_effect = fake_run
            result = resolve_artifacts(
                detection.context,  # type: ignore[arg-type]
                parse=True,
                use_existing_artifacts=False,
            )

        self.assertTrue(result.supported)
        self.assertTrue(result.invoked_parse)
        run_mock.assert_called_once()

    @patch("anarchitecture_dbt_governance.artifact_manager.subprocess.run")
    def test_use_existing_artifacts_never_invokes_dbt(self, run_mock) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=False)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            result = resolve_artifacts(
                detection.context,  # type: ignore[arg-type]
                parse=True,
                use_existing_artifacts=True,
            )

        self.assertFalse(result.supported)
        self.assertTrue(result.used_existing_artifacts)
        self.assertFalse(result.invoked_parse)
        self.assertEqual(
            result.diagnostics[0].code,
            "governance.host_dbt.missing_manifest",
        )
        run_mock.assert_not_called()

    @patch("anarchitecture_dbt_governance.artifact_manager.subprocess.run")
    def test_dbt_parse_failure_returns_diagnostic(self, run_mock) -> None:
        run_mock.return_value = subprocess.CompletedProcess(
            args=["dbt", "parse"],
            returncode=2,
            stdout="",
            stderr="parse failed",
        )
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=False)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            result = resolve_artifacts(
                detection.context,  # type: ignore[arg-type]
                parse=True,
                use_existing_artifacts=False,
            )

        self.assertFalse(result.supported)
        self.assertEqual(
            result.diagnostics[0].code,
            "governance.host_dbt.dbt_parse_failed",
        )
        self.assertEqual(result.diagnostics[0].details["stderr"], "parse failed")

    @patch("anarchitecture_dbt_governance.artifact_manager.subprocess.run")
    def test_profiles_target_and_target_path_are_passed_to_dbt_parse(
        self,
        run_mock,
    ) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            project_dir = create_project_fixture(root, include_manifest=False)
            profiles_dir = root / "profiles"
            profiles_dir.mkdir(parents=True, exist_ok=True)
            detection = resolve_dbt_path_hints(
                project_dir=str(project_dir),
                profiles_dir=str(profiles_dir),
                target="ci",
                target_path="build-target",
            )

            def fake_run(*args, **kwargs):  # type: ignore[no-untyped-def]
                write_fixture_file(
                    project_dir / "build-target" / "manifest.json",
                    '{"generated": true}',
                )
                return subprocess.CompletedProcess(
                    args=["dbt", "parse"],
                    returncode=0,
                    stdout="ok",
                    stderr="",
                )

            run_mock.side_effect = fake_run
            result = resolve_artifacts(
                detection.context,  # type: ignore[arg-type]
                parse=True,
                use_existing_artifacts=False,
            )

        self.assertTrue(result.supported)
        called_args = run_mock.call_args.kwargs["args"]
        self.assertIn("--profiles-dir", called_args)
        self.assertIn(str(profiles_dir.resolve()), called_args)
        self.assertIn("--target", called_args)
        self.assertIn("ci", called_args)
        self.assertIn("--target-path", called_args)
        self.assertIn(str((project_dir / "build-target").resolve()), called_args)

    @patch("anarchitecture_dbt_governance.artifact_manager.subprocess.run")
    def test_reports_missing_dbt_executable(self, run_mock) -> None:
        run_mock.side_effect = FileNotFoundError()
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(Path(temp_dir), include_manifest=False)
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            result = resolve_artifacts(
                detection.context,  # type: ignore[arg-type]
                parse=True,
                use_existing_artifacts=False,
            )

        self.assertFalse(result.supported)
        self.assertEqual(
            result.diagnostics[0].code,
            "governance.host_dbt.dbt_not_found",
        )

    @patch("anarchitecture_dbt_governance.artifact_manager.subprocess.run")
    def test_does_not_semantically_parse_or_normalize_manifest(self, run_mock) -> None:
        with TemporaryDirectory() as temp_dir:
            project_dir = create_project_fixture(
                Path(temp_dir),
                include_manifest=True,
                manifest_content="not valid json at all",
            )
            detection = resolve_dbt_path_hints(project_dir=str(project_dir))
            result = resolve_artifacts(
                detection.context,  # type: ignore[arg-type]
                parse=False,
                use_existing_artifacts=False,
            )

        self.assertTrue(result.supported)
        self.assertTrue(result.used_existing_artifacts)
        run_mock.assert_not_called()


def create_project_fixture(
    root: Path,
    *,
    include_manifest: bool,
    include_optional: bool = False,
    manifest_content: str = '{"metadata":{}}',
) -> Path:
    project_dir = root / "analytics"
    write_fixture_file(project_dir / "dbt_project.yml", "name: analytics\n")
    if include_manifest:
        write_fixture_file(project_dir / "target" / "manifest.json", manifest_content)
    if include_optional:
        write_fixture_file(project_dir / "target" / "catalog.json", "{}")
        write_fixture_file(project_dir / "target" / "run_results.json", "{}")
        write_fixture_file(project_dir / "target" / "sources.json", "{}")
    return project_dir


def write_fixture_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
