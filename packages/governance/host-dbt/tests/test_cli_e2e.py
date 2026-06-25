"""Fixture-based end-to-end tests for the dbt Governance host CLI."""

from __future__ import annotations

import json
import os
import shutil
import stat
import subprocess
import sys
import textwrap
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import tomllib

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from anarchitecture_dbt_governance.compatibility import load_runtime_manifest

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PACKAGE_ROOT.parents[2]
ADAPTER_FIXTURES_ROOT = (
    WORKSPACE_ROOT
    / "packages"
    / "governance"
    / "adapter-dbt"
    / "tests"
    / "fixtures"
    / "artifacts"
)
HOST_FIXTURES_ROOT = PACKAGE_ROOT / "tests" / "fixtures" / "e2e"
RUNTIME_MANIFEST = load_runtime_manifest()
HOST_VERSION = tomllib.loads(
    (PACKAGE_ROOT / "pyproject.toml").read_text(encoding="utf-8")
)["project"]["version"]


class CliE2ETests(unittest.TestCase):
    """Exercise the real CLI flow through fixtures and fake toolchains."""

    def test_check_success_with_existing_manifest_uses_runtime_boundary(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "metadata-rich",
                temp_root / "project",
            )
            write_governance_config(project_dir)
            create_runtime_cache_package(project_dir / "runtime-cache")

            env = create_fake_environment(temp_root)
            capture_path = temp_root / "runtime-input.json"
            env["FAKE_RUNTIME_CAPTURE"] = str(capture_path)

            completed = run_cli(["check"], cwd=project_dir, env=env)

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIn("dbt-governance check", completed.stdout)
            self.assertIn("Project:", completed.stdout)
            self.assertIn("Blocking violations: 0", completed.stdout)

            runtime_input = json.loads(capture_path.read_text(encoding="utf-8"))
            self.assertEqual(runtime_input["profile"], {})
            self.assertEqual(
                sorted(runtime_input["adapter"].keys()),
                ["options", "paths"],
            )
            self.assertEqual(
                runtime_input["adapter"]["paths"]["projectDir"],
                str(project_dir.resolve()),
            )
            self.assertEqual(
                runtime_input["adapter"]["paths"]["manifestPath"],
                str((project_dir / "target" / "manifest.json").resolve()),
            )
            self.assertIn("catalogPath", runtime_input["adapter"]["paths"])
            self.assertIn("runResultsPath", runtime_input["adapter"]["paths"])
            self.assertIn("sourcesPath", runtime_input["adapter"]["paths"])
            self.assertEqual(
                runtime_input["runtime"]["metadata"]["hostPackage"],
                "anarchitecture-dbt-governance",
            )

    def test_check_resolves_profile_path_relative_to_governance_yml(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "simple-project",
                temp_root / "project",
            )
            write_governance_config(
                project_dir,
                profile_path="profiles/governance.profile.yml",
            )
            write_fixture_file(
                project_dir / "profiles" / "governance.profile.yml",
                "name: dbt-demo\n",
            )
            create_runtime_cache_package(project_dir / "runtime-cache")

            env = create_fake_environment(temp_root)
            capture_path = temp_root / "runtime-input.json"
            env["FAKE_RUNTIME_CAPTURE"] = str(capture_path)

            completed = run_cli(["check"], cwd=project_dir, env=env)

            self.assertEqual(completed.returncode, 0, completed.stderr)

            runtime_input = json.loads(capture_path.read_text(encoding="utf-8"))
            self.assertEqual(
                runtime_input["profile"]["path"],
                str(
                    (
                        project_dir / "profiles" / "governance.profile.yml"
                    ).resolve()
                ),
            )
            self.assertEqual(runtime_input["profile"]["format"], "yaml")
            self.assertNotIn("document", runtime_input["profile"])

    def test_check_returns_exit_code_one_for_blocking_violations(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "simple-project",
                temp_root / "project",
            )
            write_governance_config(project_dir)
            create_runtime_cache_package(project_dir / "runtime-cache")

            env = create_fake_environment(temp_root)
            env["FAKE_RUNTIME_BEHAVIOR"] = "blocking"

            completed = run_cli(["check"], cwd=project_dir, env=env)

            self.assertEqual(completed.returncode, 1, completed.stderr)
            self.assertIn("Blocking violations: 1", completed.stdout)
            self.assertIn(
                "Result: blocking governance violations were detected.",
                completed.stdout,
            )

    def test_check_allows_blocking_violations_when_ci_policy_disables_failure(
        self,
    ) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "simple-project",
                temp_root / "project",
            )
            report_path = project_dir / "target" / "governance-report.json"
            write_governance_config(
                project_dir,
                fail_on_blocking_violations=False,
            )
            create_runtime_cache_package(project_dir / "runtime-cache")

            env = create_fake_environment(temp_root)
            env["FAKE_RUNTIME_BEHAVIOR"] = "blocking"

            completed = run_cli(
                ["check", "--report-path", str(report_path)],
                cwd=project_dir,
                env=env,
            )

            payload = json.loads(report_path.read_text(encoding="utf-8"))

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIn("Blocking violations: 1", completed.stdout)
            self.assertEqual(payload["host"]["exitCode"], 0)
            self.assertEqual(payload["result"]["violations"][0]["severity"], "error")

    def test_missing_manifest_without_parse_returns_host_failure(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "missing-manifest",
                temp_root / "project",
            )
            write_governance_config(project_dir)
            create_runtime_cache_package(project_dir / "runtime-cache")

            env = create_fake_environment(temp_root)
            capture_path = temp_root / "runtime-input.json"
            env["FAKE_RUNTIME_CAPTURE"] = str(capture_path)

            completed = run_cli(["check"], cwd=project_dir, env=env)

            self.assertEqual(completed.returncode, 2, completed.stderr)
            self.assertIn("governance.host_dbt.missing_manifest", completed.stdout)
            self.assertFalse(capture_path.exists())

    def test_parse_mode_generates_manifest_and_invokes_runtime(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                HOST_FIXTURES_ROOT / "parseable-project",
                temp_root / "project",
            )
            write_governance_config(project_dir)
            create_runtime_cache_package(project_dir / "runtime-cache")

            env = create_fake_environment(temp_root)
            capture_path = temp_root / "runtime-input.json"
            dbt_log_path = temp_root / "dbt-args.json"
            env["FAKE_RUNTIME_CAPTURE"] = str(capture_path)
            env["FAKE_DBT_LOG"] = str(dbt_log_path)

            completed = run_cli(["check", "--parse"], cwd=project_dir, env=env)

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertTrue((project_dir / "target" / "manifest.json").is_file())
            self.assertTrue(capture_path.exists())
            self.assertIn("Artifact source: dbt parse", completed.stdout)

            dbt_args = json.loads(dbt_log_path.read_text(encoding="utf-8"))
            self.assertEqual(dbt_args[:2], ["parse", "--project-dir"])
            self.assertEqual(Path(dbt_args[2]).resolve(), project_dir.resolve())

    def test_parse_failure_returns_exit_code_two_and_skips_runtime(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                HOST_FIXTURES_ROOT / "parseable-project",
                temp_root / "project",
            )
            write_governance_config(project_dir)
            create_runtime_cache_package(project_dir / "runtime-cache")

            env = create_fake_environment(temp_root)
            capture_path = temp_root / "runtime-input.json"
            env["FAKE_RUNTIME_CAPTURE"] = str(capture_path)
            env["FAKE_DBT_MODE"] = "fail"

            completed = run_cli(["check", "--parse"], cwd=project_dir, env=env)

            self.assertEqual(completed.returncode, 2, completed.stderr)
            self.assertIn("governance.host_dbt.dbt_parse_failed", completed.stdout)
            self.assertFalse(capture_path.exists())

    def test_check_json_writes_machine_readable_stdout_only(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "simple-project",
                temp_root / "project",
            )
            write_governance_config(project_dir)
            create_runtime_cache_package(project_dir / "runtime-cache")

            env = create_fake_environment(temp_root)
            completed = run_cli(["check", "--json"], cwd=project_dir, env=env)

            self.assertEqual(completed.returncode, 0, completed.stderr)
            payload = json.loads(completed.stdout)
            self.assertEqual(payload["host"]["command"], "check")
            self.assertEqual(payload["host"]["exitCode"], 0)
            self.assertTrue(payload["result"]["ok"])
            self.assertNotIn("dbt-governance check", completed.stdout)

    def test_check_report_path_writes_json_report(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "simple-project",
                temp_root / "project",
            )
            write_governance_config(project_dir)
            create_runtime_cache_package(project_dir / "runtime-cache")

            env = create_fake_environment(temp_root)
            report_path = project_dir / "target" / "governance-report.json"
            completed = run_cli(
                ["check", "--report-path", str(report_path)],
                cwd=project_dir,
                env=env,
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertTrue(report_path.is_file())
            payload = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["host"]["command"], "check")
            self.assertEqual(
                payload["host"]["reportPath"],
                str(report_path.resolve()),
            )
            self.assertTrue(payload["result"]["ok"])
            self.assertIn("Report path:", completed.stdout)

    def test_report_markdown_renders_sections(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "simple-project",
                temp_root / "project",
            )
            write_governance_config(project_dir)
            create_runtime_cache_package(project_dir / "runtime-cache")

            env = create_fake_environment(temp_root)
            completed = run_cli(
                ["report", "--format", "markdown"],
                cwd=project_dir,
                env=env,
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIn("# dbt Governance Report", completed.stdout)
            self.assertIn("## Summary", completed.stdout)
            self.assertIn("## Recommendations", completed.stdout)

    def test_check_reports_missing_runtime_as_setup_failure(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "simple-project",
                temp_root / "project",
            )
            write_governance_config(project_dir)

            env = create_fake_environment(temp_root)
            completed = run_cli(["check"], cwd=project_dir, env=env)

            self.assertEqual(completed.returncode, 2, completed.stderr)
            self.assertIn(
                "governance.host_dbt.installed_runtime_missing",
                completed.stdout,
            )

    def test_check_reports_incompatible_runtime_metadata(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "simple-project",
                temp_root / "project",
            )
            write_governance_config(project_dir)
            create_runtime_cache_package(
                project_dir / "runtime-cache",
                package_version="9.9.9",
            )

            env = create_fake_environment(temp_root)
            completed = run_cli(["check"], cwd=project_dir, env=env)

            self.assertEqual(completed.returncode, 3, completed.stderr)
            self.assertIn(
                "governance.host_dbt.runtime_package_version_mismatch",
                completed.stdout,
            )

    def test_invalid_governance_config_returns_exit_code_two(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "simple-project",
                temp_root / "project",
            )
            (project_dir / "governance.yml").write_text(
                "runtime: [unterminated\n",
                encoding="utf-8",
            )

            env = create_fake_environment(temp_root)
            completed = run_cli(["check"], cwd=project_dir, env=env)

            self.assertEqual(completed.returncode, 2, completed.stderr)
            self.assertIn(
                "governance.host_dbt.invalid_config_yaml",
                completed.stdout,
            )

    def test_doctor_reports_runtime_environment_status(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "simple-project",
                temp_root / "project",
            )
            config_path = write_governance_config(project_dir)
            create_runtime_cache_package(project_dir / "runtime-cache")

            env = create_fake_environment(temp_root)
            completed = run_cli(
                ["doctor", "--config", str(config_path)],
                cwd=project_dir,
                env=env,
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIn("dbt-governance doctor", completed.stdout)
            self.assertIn(f"Host version: {HOST_VERSION}", completed.stdout)
            self.assertIn(
                "Manifest runtime package: @anarchitects/governance-runtime-dbt",
                completed.stdout,
            )
            self.assertIn("Node.js: v20.11.1 (compatible)", completed.stdout)
            self.assertIn(
                "Selected package manager: npm 10.8.0",
                completed.stdout,
            )
            self.assertIn("Runtime compatibility: compatible", completed.stdout)
            self.assertIn("(loaded)", completed.stdout)

    def test_setup_installs_pinned_runtime_into_controlled_cache(self) -> None:
        with TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            project_dir = copy_fixture(
                ADAPTER_FIXTURES_ROOT / "simple-project",
                temp_root / "project",
            )
            config_path = write_governance_config(project_dir)

            env = create_fake_environment(temp_root)
            npm_log_path = temp_root / "npm-install.json"
            env["FAKE_NPM_LOG"] = str(npm_log_path)

            completed = run_cli(
                ["setup", "--config", str(config_path)],
                cwd=project_dir,
                env=env,
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertIn(
                "Runtime action: installed pinned runtime package",
                completed.stdout,
            )

            runtime_package_json = runtime_package_json_path(
                project_dir / "runtime-cache",
            )
            self.assertTrue(runtime_package_json.is_file())

            npm_args = json.loads(npm_log_path.read_text(encoding="utf-8"))
            self.assertIn(
                f"{RUNTIME_MANIFEST.runtime_package}@"
                f"{RUNTIME_MANIFEST.runtime_version}",
                npm_args,
            )
            self.assertNotIn("latest", " ".join(npm_args))
            self.assertNotIn("-g", npm_args)
            self.assertNotIn("--global", npm_args)


def run_cli(
    args: list[str],
    *,
    cwd: Path,
    env: dict[str, str],
) -> subprocess.CompletedProcess[str]:
    """Run the host CLI through its real Python module entrypoint."""

    cli_env = os.environ.copy()
    cli_env.update(env)
    existing_pythonpath = cli_env.get("PYTHONPATH")
    src_path = str(PACKAGE_ROOT / "src")
    cli_env["PYTHONPATH"] = (
        src_path
        if not existing_pythonpath
        else f"{src_path}{os.pathsep}{existing_pythonpath}"
    )
    return subprocess.run(
        [sys.executable, "-m", "anarchitecture_dbt_governance.cli", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
        env=cli_env,
    )


def copy_fixture(source: Path, destination: Path) -> Path:
    """Copy a fixture tree into an isolated temporary directory."""

    shutil.copytree(source, destination)
    return destination


def write_fixture_file(path: Path, content: str) -> None:
    """Write a fixture file and create any missing parent directories."""

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def write_governance_config(
    project_dir: Path,
    *,
    fail_on_blocking_violations: bool = True,
    profile_path: str | None = None,
    profile_document: dict[str, object] | None = None,
) -> Path:
    """Write the minimal config required for hermetic runtime resolution."""

    config_path = project_dir / "governance.yml"
    blocking_policy = str(fail_on_blocking_violations).lower()
    lines: list[str] = []
    if profile_path is not None or profile_document is not None:
        lines.append("profile:")
        if profile_path is not None:
            lines.append(f"  path: {profile_path}")
        if profile_document is not None:
            lines.append("  document:")
            for key, value in profile_document.items():
                lines.append(f"    {key}: {json.dumps(value)}")
    lines.extend(
        [
            "runtime:",
            "  cacheDir: runtime-cache",
            "host:",
            "  ci:",
            f"    failOnBlockingViolations: {blocking_policy}",
        ]
    )
    config_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return config_path


def create_fake_environment(temp_root: Path) -> dict[str, str]:
    """Create fake node, npm, and dbt executables for hermetic CLI e2e tests."""

    fake_bin_dir = temp_root / "fake-bin"
    fake_bin_dir.mkdir(parents=True, exist_ok=True)

    runtime_script = runtime_executable_script()
    write_executable(fake_bin_dir / "node", node_script_text())
    write_executable(fake_bin_dir / "npm", npm_script_text(runtime_script))
    write_executable(fake_bin_dir / "dbt", dbt_script_text())

    env = {
        "HOME": str((temp_root / "home").resolve()),
        "PATH": f"{fake_bin_dir}{os.pathsep}{os.environ.get('PATH', '')}",
        "FAKE_NODE_VERSION": "v20.11.1",
        "FAKE_NPM_VERSION": "10.8.0",
        "FAKE_RUNTIME_PACKAGE_NAME": RUNTIME_MANIFEST.runtime_package,
        "FAKE_RUNTIME_PACKAGE_VERSION": RUNTIME_MANIFEST.runtime_version,
        "FAKE_RUNTIME_METADATA_PACKAGE": RUNTIME_MANIFEST.runtime_package,
        "FAKE_RUNTIME_METADATA_VERSION": RUNTIME_MANIFEST.runtime_version,
        "FAKE_RUNTIME_BEHAVIOR": "success",
        "FAKE_RUNTIME_STDERR": "",
        "FAKE_DBT_MODE": "success",
    }
    Path(env["HOME"]).mkdir(parents=True, exist_ok=True)
    return env


def create_runtime_cache_package(
    cache_root: Path,
    *,
    package_name: str = RUNTIME_MANIFEST.runtime_package,
    package_version: str = RUNTIME_MANIFEST.runtime_version,
) -> Path:
    """Create a pinned runtime package in the host-controlled cache layout."""

    package_dir = runtime_package_dir(cache_root)
    executable_path = package_dir / "dist" / "bin" / "dbt-governance-runtime.js"
    executable_path.parent.mkdir(parents=True, exist_ok=True)
    write_executable(executable_path, runtime_executable_script())
    (package_dir / "package.json").write_text(
        json.dumps(
            {
                "name": package_name,
                "version": package_version,
                "bin": {
                    "dbt-governance-runtime": "./dist/bin/dbt-governance-runtime.js"
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return package_dir


def runtime_package_dir(cache_root: Path) -> Path:
    """Resolve the installed runtime package directory under a cache root."""

    install_root = cache_root.joinpath(
        *RUNTIME_MANIFEST.runtime_package.split("/"),
        RUNTIME_MANIFEST.runtime_version,
    )
    return (
        install_root
        / "node_modules"
        / Path(*RUNTIME_MANIFEST.runtime_package.split("/"))
    )


def runtime_package_json_path(cache_root: Path) -> Path:
    """Resolve the installed runtime package.json path."""

    return runtime_package_dir(cache_root) / "package.json"


def write_executable(path: Path, contents: str) -> None:
    """Write a small executable script to disk."""

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents, encoding="utf-8")
    path.chmod(
        stat.S_IRUSR
        | stat.S_IWUSR
        | stat.S_IXUSR
        | stat.S_IRGRP
        | stat.S_IXGRP
        | stat.S_IROTH
        | stat.S_IXOTH
    )


def runtime_executable_script() -> str:
    """Build the fake runtime executable used by installed runtime packages."""

    return textwrap.dedent(
        f"""\
        #!/usr/bin/env python3
        import json
        import os
        import sys
        import time
        from pathlib import Path

        DEFAULT_PACKAGE = {RUNTIME_MANIFEST.runtime_package!r}
        DEFAULT_VERSION = {RUNTIME_MANIFEST.runtime_version!r}


        def build_payload():
            package_name = os.environ.get(
                "FAKE_RUNTIME_METADATA_PACKAGE",
                DEFAULT_PACKAGE,
            )
            package_version = os.environ.get(
                "FAKE_RUNTIME_METADATA_VERSION",
                DEFAULT_VERSION,
            )
            behavior = os.environ.get("FAKE_RUNTIME_BEHAVIOR", "success")
            runtime = {{
                "packageName": package_name,
                "version": package_version,
            }}
            if behavior == "blocking":
                violations = [{{
                    "id": "owner-missing",
                    "severity": "error",
                    "message": "Owner metadata is missing.",
                }}]
                return {{
                    "ok": True,
                    "runtime": runtime,
                    "assessment": {{
                        "violations": violations,
                        "warnings": [],
                        "health": {{"status": "warning"}},
                        "topIssues": [{{
                            "message": "Add ownership metadata.",
                        }}],
                        "recommendations": [{{
                            "title": "Add owners",
                            "reason": "Ownership metadata is required.",
                        }}],
                    }},
                    "violations": violations,
                }}
            if behavior == "error":
                return {{
                    "ok": False,
                    "runtime": runtime,
                    "error": {{
                        "code": "governance.runtime.adapter_failed",
                        "stage": "adapter",
                        "message": "adapter failed",
                    }},
                }}
            return {{
                "ok": True,
                "runtime": runtime,
                "assessment": {{
                    "violations": [],
                    "warnings": [],
                    "health": {{"status": "good"}},
                    "topIssues": [{{
                        "message": "No top issues detected.",
                    }}],
                    "recommendations": [{{
                        "title": "Keep checks running",
                        "reason": "The runtime completed successfully.",
                    }}],
                }},
                "violations": [],
            }}


        def main():
            raw_input = sys.stdin.read()
            capture_path = os.environ.get("FAKE_RUNTIME_CAPTURE")
            if capture_path:
                Path(capture_path).write_text(raw_input, encoding="utf-8")

            stderr_output = os.environ.get("FAKE_RUNTIME_STDERR", "")
            if stderr_output:
                sys.stderr.write(stderr_output)

            behavior = os.environ.get("FAKE_RUNTIME_BEHAVIOR", "success")
            if behavior == "timeout":
                time.sleep(35)
                return 0
            if behavior == "invalid-json":
                sys.stdout.write("this is not json")
                return 0
            if behavior == "process-failure":
                sys.stdout.write(json.dumps(build_payload()))
                return 2

            sys.stdout.write(json.dumps(build_payload()))
            return 0


        if __name__ == "__main__":
            raise SystemExit(main())
        """
    )


def node_script_text() -> str:
    """Build the fake node executable."""

    return textwrap.dedent(
        """\
        #!/usr/bin/env python3
        import os
        import sys


        def main() -> int:
            if sys.argv[1:] == ["--version"]:
                sys.stdout.write(os.environ.get("FAKE_NODE_VERSION", "v20.11.1"))
                return 0
            sys.stderr.write("unexpected fake node invocation")
            return 1


        if __name__ == "__main__":
            raise SystemExit(main())
        """
    )


def npm_script_text(runtime_script: str) -> str:
    """Build the fake npm executable used by setup tests."""

    return textwrap.dedent(
        f"""\
        #!/usr/bin/env python3
        import json
        import os
        import stat
        import sys
        from pathlib import Path

        RUNTIME_SCRIPT = {runtime_script!r}


        def write_executable(path: Path, contents: str) -> None:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(contents, encoding="utf-8")
            path.chmod(
                stat.S_IRUSR
                | stat.S_IWUSR
                | stat.S_IXUSR
                | stat.S_IRGRP
                | stat.S_IXGRP
                | stat.S_IROTH
                | stat.S_IXOTH
            )


        def main() -> int:
            args = sys.argv[1:]
            log_path = os.environ.get("FAKE_NPM_LOG")
            if log_path:
                Path(log_path).write_text(json.dumps(args), encoding="utf-8")

            if args == ["--version"]:
                sys.stdout.write(os.environ.get("FAKE_NPM_VERSION", "10.8.0"))
                return 0

            if not args or args[0] != "install":
                sys.stderr.write("unexpected fake npm invocation")
                return 1

            if os.environ.get("FAKE_NPM_FAIL") == "1":
                sys.stderr.write("fake npm install failure")
                return 2

            try:
                prefix_index = args.index("--prefix")
                prefix = Path(args[prefix_index + 1])
            except (ValueError, IndexError):
                sys.stderr.write("missing --prefix argument")
                return 1

            package_spec = args[-1]
            package_name, package_version = package_spec.rsplit("@", 1)
            installed_name = os.environ.get(
                "FAKE_RUNTIME_PACKAGE_NAME",
                package_name,
            )
            installed_version = os.environ.get(
                "FAKE_RUNTIME_PACKAGE_VERSION",
                package_version,
            )
            package_dir = prefix / "node_modules" / Path(
                *installed_name.split("/")
            )
            executable_path = (
                package_dir / "dist" / "bin" / "dbt-governance-runtime.js"
            )
            executable_path.parent.mkdir(parents=True, exist_ok=True)
            write_executable(executable_path, RUNTIME_SCRIPT)
            (package_dir / "package.json").write_text(
                json.dumps(
                    {{
                        "name": installed_name,
                        "version": installed_version,
                        "bin": {{
                            "dbt-governance-runtime": "./dist/bin/"
                            "dbt-governance-runtime.js"
                        }},
                    }},
                    indent=2,
                )
                + "\\n",
                encoding="utf-8",
            )
            sys.stdout.write("installed")
            return 0


        if __name__ == "__main__":
            raise SystemExit(main())
        """
    )


def dbt_script_text() -> str:
    """Build the fake dbt executable for parse-mode tests."""

    return textwrap.dedent(
        """\
        #!/usr/bin/env python3
        import json
        import os
        import sys
        from pathlib import Path


        def resolved_target_path(args):
            if "--target-path" not in args:
                return Path.cwd() / "target"
            index = args.index("--target-path")
            target_value = Path(args[index + 1])
            if target_value.is_absolute():
                return target_value
            return (Path.cwd() / target_value).resolve()


        def main():
            args = sys.argv[1:]
            log_path = os.environ.get("FAKE_DBT_LOG")
            if log_path:
                Path(log_path).write_text(json.dumps(args), encoding="utf-8")

            if not args or args[0] != "parse":
                sys.stderr.write("unexpected fake dbt invocation")
                return 1

            if os.environ.get("FAKE_DBT_MODE") == "fail":
                sys.stderr.write("fake dbt parse failure")
                return 2

            target_dir = resolved_target_path(args)
            target_dir.mkdir(parents=True, exist_ok=True)
            (target_dir / "manifest.json").write_text(
                json.dumps({"metadata": {"generatedBy": "fake-dbt"}}),
                encoding="utf-8",
            )
            sys.stdout.write("dbt parse completed")
            return 0


        if __name__ == "__main__":
            raise SystemExit(main())
        """
    )


if __name__ == "__main__":
    unittest.main()
