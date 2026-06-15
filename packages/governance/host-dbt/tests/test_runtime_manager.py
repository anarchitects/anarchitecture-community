"""Pinned runtime management tests for the host package."""

from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import tomllib

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from anarchitecture_dbt_governance.compatibility import load_runtime_manifest
from anarchitecture_dbt_governance.config import load_governance_config
from anarchitecture_dbt_governance.runtime_manager import (
    doctor_runtime_environment,
    resolve_runtime_cache_dir,
    setup_runtime_environment,
)

HOST_VERSION = tomllib.loads(
    (Path(__file__).resolve().parents[1] / "pyproject.toml").read_text(encoding="utf-8")
)["project"]["version"]


class RuntimeManagerTests(unittest.TestCase):
    """Verify pinned runtime setup and doctor behavior."""

    def test_cache_path_resolution_uses_controlled_layout(self) -> None:
        manifest = load_runtime_manifest()
        cache_root = Path("/tmp/runtime-cache-root")

        resolved = resolve_runtime_cache_dir(manifest, cache_root=cache_root)

        self.assertEqual(
            resolved,
            cache_root
            / "@anarchitects"
            / "governance-runtime-dbt"
            / manifest.runtime_version,
        )

    def test_setup_reports_missing_node(self) -> None:
        with TemporaryDirectory() as temp_dir:
            result = setup_runtime_environment(
                cache_root=Path(temp_dir),
                command_runner=missing_node_runner,
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.node_executable_missing",
            diagnostic_codes(result),
        )

    def test_setup_reports_unsupported_node(self) -> None:
        with TemporaryDirectory() as temp_dir:
            result = setup_runtime_environment(
                cache_root=Path(temp_dir),
                command_runner=unsupported_node_runner,
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.unsupported_node_version",
            diagnostic_codes(result),
        )

    def test_package_manager_missing_is_reported(self) -> None:
        with TemporaryDirectory() as temp_dir:
            result = setup_runtime_environment(
                cache_root=Path(temp_dir),
                command_runner=missing_package_manager_runner,
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.package_manager_missing",
            diagnostic_codes(result),
        )

    def test_setup_installs_exact_pinned_runtime_without_global_or_latest(
        self,
    ) -> None:
        manifest = load_runtime_manifest()
        install_calls: list[tuple[list[str], Path | None]] = []

        with TemporaryDirectory() as temp_dir:
            cache_root = Path(temp_dir) / "cache"

            def command_runner(
                args: list[str],
                *,
                cwd: Path | None = None,
            ) -> subprocess.CompletedProcess[str]:
                if args == ["node", "--version"]:
                    return completed(args, stdout="v20.11.1\n")
                if args == ["npm", "--version"]:
                    return completed(args, stdout="10.8.0\n")
                if args[:2] == ["npm", "install"]:
                    install_calls.append((args, cwd))
                    write_runtime_package(
                        cache_root
                        / "@anarchitects"
                        / "governance-runtime-dbt"
                        / manifest.runtime_version,
                        package_name=manifest.runtime_package,
                        package_version=manifest.runtime_version,
                        include_executable=True,
                    )
                    return completed(args, stdout="installed\n")
                raise AssertionError(f"Unexpected command: {args!r}")

            result = setup_runtime_environment(
                cache_root=cache_root,
                command_runner=command_runner,
            )

        self.assertTrue(result.supported)
        self.assertTrue(result.report.install_performed)
        self.assertEqual(len(install_calls), 1)
        install_args, install_cwd = install_calls[0]
        self.assertIn(
            f"{manifest.runtime_package}@{manifest.runtime_version}",
            install_args,
        )
        self.assertNotIn("latest", " ".join(install_args))
        self.assertNotIn("-g", install_args)
        self.assertNotIn("--global", install_args)
        self.assertIsNone(install_cwd)

    def test_package_name_mismatch_is_reported(self) -> None:
        manifest = load_runtime_manifest()
        with TemporaryDirectory() as temp_dir:
            cache_root = Path(temp_dir) / "cache"
            write_runtime_package(
                cache_root
                / "@anarchitects"
                / "governance-runtime-dbt"
                / manifest.runtime_version,
                package_name="@anarchitects/not-the-runtime",
                package_version=manifest.runtime_version,
                include_executable=True,
            )
            result = doctor_runtime_environment(
                cache_root=cache_root,
                command_runner=supported_environment_runner,
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.runtime_package_name_mismatch",
            diagnostic_codes(result),
        )

    def test_package_version_mismatch_is_reported(self) -> None:
        manifest = load_runtime_manifest()
        with TemporaryDirectory() as temp_dir:
            cache_root = Path(temp_dir) / "cache"
            write_runtime_package(
                cache_root
                / "@anarchitects"
                / "governance-runtime-dbt"
                / manifest.runtime_version,
                package_name=manifest.runtime_package,
                package_version="9.9.9",
                include_executable=True,
            )
            result = doctor_runtime_environment(
                cache_root=cache_root,
                command_runner=supported_environment_runner,
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.runtime_package_version_mismatch",
            diagnostic_codes(result),
        )

    def test_missing_runtime_executable_is_reported(self) -> None:
        manifest = load_runtime_manifest()
        with TemporaryDirectory() as temp_dir:
            cache_root = Path(temp_dir) / "cache"
            write_runtime_package(
                cache_root
                / "@anarchitects"
                / "governance-runtime-dbt"
                / manifest.runtime_version,
                package_name=manifest.runtime_package,
                package_version=manifest.runtime_version,
                include_executable=False,
            )
            result = doctor_runtime_environment(
                cache_root=cache_root,
                command_runner=supported_environment_runner,
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.runtime_executable_missing",
            diagnostic_codes(result),
        )

    def test_setup_failure_reports_install_failure(self) -> None:
        with TemporaryDirectory() as temp_dir:
            result = setup_runtime_environment(
                cache_root=Path(temp_dir) / "cache",
                command_runner=failing_install_runner,
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.runtime_install_failed",
            diagnostic_codes(result),
        )

    def test_setup_reports_runtime_cache_creation_failure(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            invalid_cache_root = root / "cache-root-file"
            invalid_cache_root.write_text("not-a-directory", encoding="utf-8")

            result = setup_runtime_environment(
                cache_root=invalid_cache_root,
                command_runner=supported_environment_runner,
            )

        self.assertFalse(result.supported)
        self.assertIn(
            "governance.host_dbt.runtime_cache_creation_failed",
            diagnostic_codes(result),
        )

    def test_doctor_reports_all_relevant_status_fields(self) -> None:
        manifest = load_runtime_manifest()
        with TemporaryDirectory() as temp_dir:
            cache_root = Path(temp_dir) / "cache"
            runtime_cache_dir = (
                cache_root
                / "@anarchitects"
                / "governance-runtime-dbt"
                / manifest.runtime_version
            )
            write_runtime_package(
                runtime_cache_dir,
                package_name=manifest.runtime_package,
                package_version=manifest.runtime_version,
                include_executable=True,
            )
            result = doctor_runtime_environment(
                cache_root=cache_root,
                command_runner=supported_environment_runner,
            )

        self.assertTrue(result.supported)
        self.assertEqual(result.report.host_version, HOST_VERSION)
        self.assertEqual(result.report.node_version, "v20.11.1")
        self.assertTrue(result.report.node_supported)
        self.assertEqual(result.report.package_manager.name, "npm")  # type: ignore[union-attr]
        self.assertEqual(
            result.report.package_manager.version,  # type: ignore[union-attr]
            "10.8.0",
        )
        self.assertEqual(
            result.report.manifest.runtime_package,
            "@anarchitects/governance-runtime-dbt",
        )
        self.assertEqual(
            result.report.runtime_resolution.package_name,
            manifest.runtime_package,
        )
        self.assertEqual(
            result.report.runtime_resolution.package_version,
            manifest.runtime_version,
        )
        self.assertTrue(result.report.runtime_compatible)

    def test_doctor_reports_loaded_config_status(self) -> None:
        manifest = load_runtime_manifest()
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            config_path = root / "governance.yml"
            cache_root = root / "configured-cache"
            runtime_cache_dir = (
                cache_root
                / "@anarchitects"
                / "governance-runtime-dbt"
                / manifest.runtime_version
            )
            config_path.write_text(
                "runtime:\n  cacheDir: configured-cache\n",
                encoding="utf-8",
            )
            write_runtime_package(
                runtime_cache_dir,
                package_name=manifest.runtime_package,
                package_version=manifest.runtime_version,
                include_executable=True,
            )
            config_result = load_governance_config(
                explicit_path=str(config_path),
                cwd=root,
            )

            result = doctor_runtime_environment(
                cache_root=cache_root,
                command_runner=supported_environment_runner,
                config_result=config_result,
            )

        self.assertTrue(result.supported)
        self.assertTrue(result.report.config_loaded)
        self.assertEqual(result.report.config_path, config_path.resolve())


def completed(
    args: list[str],
    *,
    stdout: str = "",
    stderr: str = "",
    returncode: int = 0,
) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(
        args=args,
        returncode=returncode,
        stdout=stdout,
        stderr=stderr,
    )


def diagnostic_codes(result) -> set[str]:  # type: ignore[no-untyped-def]
    return {diagnostic.code for diagnostic in result.diagnostics}


def missing_node_runner(
    args: list[str],
    *,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    del cwd
    if args == ["node", "--version"]:
        raise FileNotFoundError()
    if args == ["npm", "--version"]:
        return completed(args, stdout="10.8.0\n")
    if args == ["yarn", "--version"]:
        raise FileNotFoundError()
    raise AssertionError(f"Unexpected command: {args!r}")


def unsupported_node_runner(
    args: list[str],
    *,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    del cwd
    if args == ["node", "--version"]:
        return completed(args, stdout="v25.0.0\n")
    if args == ["npm", "--version"]:
        return completed(args, stdout="10.8.0\n")
    raise AssertionError(f"Unexpected command: {args!r}")


def missing_package_manager_runner(
    args: list[str],
    *,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    del cwd
    if args == ["node", "--version"]:
        return completed(args, stdout="v20.11.1\n")
    if args in (["npm", "--version"], ["yarn", "--version"]):
        raise FileNotFoundError()
    raise AssertionError(f"Unexpected command: {args!r}")


def supported_environment_runner(
    args: list[str],
    *,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    del cwd
    if args == ["node", "--version"]:
        return completed(args, stdout="v20.11.1\n")
    if args == ["npm", "--version"]:
        return completed(args, stdout="10.8.0\n")
    raise AssertionError(f"Unexpected command: {args!r}")


def failing_install_runner(
    args: list[str],
    *,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    del cwd
    if args == ["node", "--version"]:
        return completed(args, stdout="v20.11.1\n")
    if args == ["npm", "--version"]:
        return completed(args, stdout="10.8.0\n")
    if args[:2] == ["npm", "install"]:
        return completed(args, stderr="install failed\n", returncode=1)
    raise AssertionError(f"Unexpected command: {args!r}")


def write_runtime_package(
    cache_dir: Path,
    *,
    package_name: str,
    package_version: str,
    include_executable: bool,
) -> None:
    package_dir = (
        cache_dir / "node_modules" / "@anarchitects" / "governance-runtime-dbt"
    )
    package_dir.mkdir(parents=True, exist_ok=True)
    package_payload = {
        "name": package_name,
        "version": package_version,
        "bin": {
            "dbt-governance-runtime": "./dist/bin/dbt-governance-runtime.js"
        },
    }
    (package_dir / "package.json").write_text(
        json.dumps(package_payload) + "\n",
        encoding="utf-8",
    )
    if include_executable:
        executable_path = package_dir / "dist" / "bin" / "dbt-governance-runtime.js"
        executable_path.parent.mkdir(parents=True, exist_ok=True)
        executable_path.write_text(
            "#!/usr/bin/env node\nconsole.log('runtime');\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    unittest.main()
