"""Runtime coordination and pinned Node runtime management for the host."""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import tomllib

from .artifact_manager import resolve_artifacts
from .compatibility import (
    RuntimeManifest,
    RuntimeManifestError,
    is_supported_node_version,
    load_runtime_manifest,
)
from .dbt_project import HostDiagnostic, resolve_dbt_path_hints
from .exit_codes import ExitCode
from .renderer import (
    render_check_success,
    render_diagnostics,
    render_not_implemented,
    render_runtime_environment,
)
from .runtime_invocation import RuntimeInvocation

RUNTIME_EXECUTABLE_NAME = "dbt-governance-runtime"


@dataclass(frozen=True)
class InvocationExecutionResult:
    """Rendered command result and exit code."""

    exit_code: ExitCode
    output: str


@dataclass(frozen=True)
class PackageManagerResolution:
    """Resolved package manager used for runtime installation."""

    name: str
    version: str


@dataclass(frozen=True)
class RuntimePackageResolution:
    """Resolved runtime package installation details."""

    cache_dir: Path
    package_dir: Path
    package_name: str | None = None
    package_version: str | None = None
    executable_path: Path | None = None


@dataclass(frozen=True)
class RuntimeEnvironmentReport:
    """Resolved runtime environment details for setup and doctor."""

    host_version: str
    manifest: RuntimeManifest
    repo_package_manager: str | None
    node_version: str | None
    node_supported: bool
    package_manager: PackageManagerResolution | None
    runtime_resolution: RuntimePackageResolution
    runtime_compatible: bool
    install_performed: bool = False


@dataclass(frozen=True)
class RuntimeEnvironmentResult:
    """Result of setup or doctor runtime management."""

    supported: bool
    diagnostics: list[HostDiagnostic]
    report: RuntimeEnvironmentReport


def execute_invocation(invocation: RuntimeInvocation) -> InvocationExecutionResult:
    """Execute a host command without crossing into runtime composition yet."""

    if invocation.command == "check" and invocation.check_options is not None:
        detection = resolve_dbt_path_hints(
            project_dir=invocation.check_options.project_dir,
            profiles_dir=invocation.check_options.profiles_dir,
            target=invocation.check_options.target,
            target_path=invocation.check_options.target_path,
            config=invocation.check_options.config,
        )
        if not detection.supported or detection.context is None:
            return InvocationExecutionResult(
                exit_code=ExitCode.HOST_ERROR,
                output=render_diagnostics(detection.diagnostics),
            )

        resolved = resolve_artifacts(
            detection.context,
            parse=invocation.check_options.parse,
            use_existing_artifacts=invocation.check_options.use_existing_artifacts,
        )
        if not resolved.supported:
            return InvocationExecutionResult(
                exit_code=ExitCode.HOST_ERROR,
                output=render_diagnostics(resolved.diagnostics),
            )

        return InvocationExecutionResult(
            exit_code=ExitCode.SUCCESS,
            output=render_check_success(resolved),
        )

    if invocation.command == "setup":
        result = setup_runtime_environment()
        return InvocationExecutionResult(
            exit_code=ExitCode.SUCCESS if result.supported else ExitCode.HOST_ERROR,
            output=render_runtime_environment("setup", result),
        )

    if invocation.command == "doctor":
        result = doctor_runtime_environment()
        return InvocationExecutionResult(
            exit_code=ExitCode.SUCCESS if result.supported else ExitCode.HOST_ERROR,
            output=render_runtime_environment("doctor", result),
        )

    return InvocationExecutionResult(
        exit_code=ExitCode.SUCCESS,
        output=render_not_implemented(invocation.command),
    )


def setup_runtime_environment(
    *,
    cache_root: Path | None = None,
    manifest_path: Path | None = None,
    command_runner=None,
    workspace_root: Path | None = None,
) -> RuntimeEnvironmentResult:
    """Install or verify the pinned runtime package in the controlled cache."""

    return _manage_runtime_environment(
        install_if_missing=True,
        cache_root=cache_root,
        manifest_path=manifest_path,
        command_runner=command_runner or _run_command,
        workspace_root=workspace_root,
    )


def doctor_runtime_environment(
    *,
    cache_root: Path | None = None,
    manifest_path: Path | None = None,
    command_runner=None,
    workspace_root: Path | None = None,
) -> RuntimeEnvironmentResult:
    """Inspect the pinned runtime environment without installing packages."""

    return _manage_runtime_environment(
        install_if_missing=False,
        cache_root=cache_root,
        manifest_path=manifest_path,
        command_runner=command_runner or _run_command,
        workspace_root=workspace_root,
    )


def resolve_runtime_cache_dir(
    manifest: RuntimeManifest,
    *,
    cache_root: Path | None = None,
) -> Path:
    """Resolve the controlled cache directory for the pinned runtime package."""

    base_dir = cache_root or (
        Path.home() / ".cache" / "anarchitecture" / "dbt-governance" / "runtimes"
    )
    return base_dir.joinpath(
        *manifest.runtime_package.split("/"),
        manifest.runtime_version,
    )


def _manage_runtime_environment(
    *,
    install_if_missing: bool,
    cache_root: Path | None,
    manifest_path: Path | None,
    command_runner,
    workspace_root: Path | None,
) -> RuntimeEnvironmentResult:
    host_version = _load_host_version()
    repo_package_manager = _load_repo_package_manager(workspace_root)

    try:
        manifest = load_runtime_manifest(manifest_path)
    except RuntimeManifestError as error:
        report = RuntimeEnvironmentReport(
            host_version=host_version,
            manifest=RuntimeManifest(
                runtime_package="unknown",
                runtime_version="unknown",
                node_range="unknown",
                contract_version="unknown",
            ),
            repo_package_manager=repo_package_manager,
            node_version=None,
            node_supported=False,
            package_manager=None,
            runtime_resolution=RuntimePackageResolution(
                cache_dir=(cache_root or Path.home()).resolve(),
                package_dir=(cache_root or Path.home()).resolve(),
            ),
            runtime_compatible=False,
        )
        return RuntimeEnvironmentResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.invalid_runtime_manifest",
                    message=str(error),
                    recommendation=(
                        "Fix runtime_manifest.json so it defines the pinned runtime "
                        "package, version, Node range, and contract version."
                    ),
                )
            ],
            report=report,
        )

    cache_dir = resolve_runtime_cache_dir(manifest, cache_root=cache_root)
    runtime_resolution = _empty_runtime_resolution(manifest, cache_dir)
    diagnostics: list[HostDiagnostic] = []

    node_version = _resolve_node_version(manifest, command_runner, diagnostics)
    node_supported = node_version is not None and is_supported_node_version(
        node_version,
        manifest.node_range,
    )
    package_manager = _resolve_package_manager(
        repo_package_manager,
        command_runner,
        diagnostics,
    )

    if (
        install_if_missing
        and node_supported
        and package_manager is not None
        and not _ensure_runtime_cache_project(cache_dir, diagnostics)
    ):
        return _runtime_environment_result(
            supported=False,
            diagnostics=diagnostics,
            report=RuntimeEnvironmentReport(
                host_version=host_version,
                manifest=manifest,
                repo_package_manager=repo_package_manager,
                node_version=node_version,
                node_supported=node_supported,
                package_manager=package_manager,
                runtime_resolution=runtime_resolution,
                runtime_compatible=False,
            ),
        )

    runtime_resolution, runtime_diagnostics = _inspect_runtime_package(
        manifest,
        cache_dir,
    )
    runtime_compatible = not runtime_diagnostics

    install_performed = False
    if (
        install_if_missing
        and node_supported
        and package_manager is not None
        and not runtime_compatible
    ):
        install_diagnostics, install_performed = _install_runtime_package(
            manifest,
            cache_dir,
            package_manager,
            command_runner,
        )
        diagnostics.extend(install_diagnostics)
        if not install_diagnostics:
            runtime_resolution, runtime_diagnostics = _inspect_runtime_package(
                manifest,
                cache_dir,
            )
            runtime_compatible = not runtime_diagnostics
        else:
            diagnostics.extend(runtime_diagnostics)
    else:
        diagnostics.extend(runtime_diagnostics)

    report = RuntimeEnvironmentReport(
        host_version=host_version,
        manifest=manifest,
        repo_package_manager=repo_package_manager,
        node_version=node_version,
        node_supported=node_supported,
        package_manager=package_manager,
        runtime_resolution=runtime_resolution,
        runtime_compatible=runtime_compatible,
        install_performed=install_performed,
    )
    supported = (
        node_supported
        and package_manager is not None
        and runtime_compatible
        and not diagnostics
    )
    return _runtime_environment_result(
        supported=supported,
        diagnostics=diagnostics,
        report=report,
    )


def _resolve_node_version(
    manifest: RuntimeManifest,
    command_runner,
    diagnostics: list[HostDiagnostic],
) -> str | None:
    try:
        completed = command_runner(["node", "--version"])
    except FileNotFoundError:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.node_executable_missing",
                message="Node.js executable was not found on PATH.",
                recommendation=(
                    f"Install Node.js {manifest.node_range} before running "
                    "dbt-governance setup or doctor."
                ),
            )
        )
        return None

    if completed.returncode != 0:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.node_executable_missing",
                message="Node.js executable could not be invoked successfully.",
                recommendation=(
                    "Ensure the node executable is available on PATH and can run "
                    "without shell profile interaction."
                ),
                details={
                    "stdout": completed.stdout,
                    "stderr": completed.stderr,
                    "returncode": completed.returncode,
                },
            )
        )
        return None

    node_version = completed.stdout.strip()
    try:
        is_supported = is_supported_node_version(node_version, manifest.node_range)
    except ValueError as error:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.unsupported_node_version",
                message=str(error),
                recommendation=(
                    "Ensure Node.js reports a semantic version and the runtime "
                    "manifest defines a supported major version range."
                ),
            )
        )
        return node_version

    if not is_supported:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.unsupported_node_version",
                message=(
                    f'Node.js version "{node_version}" is not supported; '
                    f'required range is "{manifest.node_range}".'
                ),
                recommendation=(
                    "Install a supported Node.js version before running "
                    "dbt-governance setup or doctor."
                ),
            )
        )
    return node_version


def _resolve_package_manager(
    repo_package_manager: str | None,
    command_runner,
    diagnostics: list[HostDiagnostic],
) -> PackageManagerResolution | None:
    candidate_names = ["npm"]
    if repo_package_manager is not None and repo_package_manager not in candidate_names:
        candidate_names.append(repo_package_manager)

    for candidate_name in candidate_names:
        try:
            completed = command_runner([candidate_name, "--version"])
        except FileNotFoundError:
            continue

        if completed.returncode == 0:
            return PackageManagerResolution(
                name=candidate_name,
                version=completed.stdout.strip(),
            )

    diagnostics.append(
        HostDiagnostic(
            code="governance.host_dbt.package_manager_missing",
            message=(
                "No supported package manager was found on PATH. "
                "dbt-governance requires npm or the repo-selected package manager."
            ),
            recommendation=(
                "Install npm, or ensure the repo-selected package manager is "
                "available on PATH before running dbt-governance setup."
            ),
        )
    )
    return None


def _inspect_runtime_package(
    manifest: RuntimeManifest,
    cache_dir: Path,
) -> tuple[RuntimePackageResolution, list[HostDiagnostic]]:
    package_dir = _runtime_package_dir(cache_dir, manifest)
    resolution = RuntimePackageResolution(
        cache_dir=cache_dir,
        package_dir=package_dir,
    )
    package_json_path = package_dir / "package.json"
    if not package_json_path.is_file():
        return (
            resolution,
            [
                HostDiagnostic(
                    code="governance.host_dbt.installed_runtime_missing",
                    message=(
                        "Pinned runtime package is not installed in the controlled "
                        "cache."
                    ),
                    path=str(package_dir),
                    recommendation=(
                        "Run dbt-governance setup to install the pinned runtime "
                        "package."
                    ),
                )
            ],
        )

    payload = json.loads(package_json_path.read_text(encoding="utf-8"))
    package_name = payload.get("name")
    package_version = payload.get("version")
    resolution = RuntimePackageResolution(
        cache_dir=cache_dir,
        package_dir=package_dir,
        package_name=package_name if isinstance(package_name, str) else None,
        package_version=package_version if isinstance(package_version, str) else None,
    )

    diagnostics: list[HostDiagnostic] = []
    if package_name != manifest.runtime_package:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.runtime_package_name_mismatch",
                message=(
                    f'Installed runtime package name "{package_name}" does not '
                    f'match expected "{manifest.runtime_package}".'
                ),
                path=str(package_json_path),
                recommendation=(
                    "Reinstall the pinned runtime package through "
                    "dbt-governance setup."
                ),
            )
        )
    if package_version != manifest.runtime_version:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.runtime_package_version_mismatch",
                message=(
                    f'Installed runtime package version "{package_version}" does '
                    f'not match expected "{manifest.runtime_version}".'
                ),
                path=str(package_json_path),
                recommendation=(
                    "Reinstall the pinned runtime package through "
                    "dbt-governance setup."
                ),
            )
        )

    executable_path = _resolve_runtime_executable_path(package_dir, payload)
    if executable_path is None or not executable_path.is_file():
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.runtime_executable_missing",
                message=(
                    f'Expected runtime executable "{RUNTIME_EXECUTABLE_NAME}" '
                    "is not available in the installed runtime package."
                ),
                path=str(package_dir),
                recommendation=(
                    "Install a runtime package version that exposes the "
                    "dbt-governance-runtime executable."
                ),
            )
        )
    else:
        resolution = RuntimePackageResolution(
            cache_dir=cache_dir,
            package_dir=package_dir,
            package_name=resolution.package_name,
            package_version=resolution.package_version,
            executable_path=executable_path,
        )

    return resolution, diagnostics


def _install_runtime_package(
    manifest: RuntimeManifest,
    cache_dir: Path,
    package_manager: PackageManagerResolution,
    command_runner,
) -> tuple[list[HostDiagnostic], bool]:
    pinned_package_spec = (
        f"{manifest.runtime_package}@{manifest.runtime_version}"
    )
    args, cwd = _build_install_command(
        package_manager,
        cache_dir,
        pinned_package_spec,
    )
    try:
        completed = command_runner(args, cwd=cwd)
    except FileNotFoundError:
        return (
            [
                HostDiagnostic(
                    code="governance.host_dbt.package_manager_missing",
                    message=(
                        f'Package manager "{package_manager.name}" was not found '
                        "while installing the pinned runtime package."
                    ),
                    recommendation=(
                        "Install the required package manager and rerun "
                        "dbt-governance setup."
                    ),
                )
            ],
            False,
        )

    if completed.returncode != 0:
        return (
            [
                HostDiagnostic(
                    code="governance.host_dbt.runtime_install_failed",
                    message=(
                        "Installing the pinned runtime package into the controlled "
                        "cache failed."
                    ),
                    path=str(cache_dir),
                    recommendation=(
                        "Inspect the package-manager output and fix the runtime "
                        "installation environment before rerunning setup."
                    ),
                    details={
                        "stdout": completed.stdout,
                        "stderr": completed.stderr,
                        "returncode": completed.returncode,
                        "args": args,
                    },
                )
            ],
            False,
        )

    return [], True


def _ensure_runtime_cache_project(
    cache_dir: Path,
    diagnostics: list[HostDiagnostic],
) -> bool:
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        package_json_path = cache_dir / "package.json"
        if not package_json_path.exists():
            package_json_path.write_text(
                json.dumps(
                    {
                        "name": "anarchitecture-dbt-governance-runtime-cache",
                        "private": True,
                    },
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
        return True
    except OSError as error:
        diagnostics.append(
            HostDiagnostic(
                code="governance.host_dbt.runtime_cache_creation_failed",
                message=(
                    "Creating the controlled runtime cache directory failed."
                ),
                path=str(cache_dir),
                recommendation=(
                    "Ensure the runtime cache path is writable before running "
                    "dbt-governance setup."
                ),
                details={"reason": str(error)},
            )
        )
        return False


def _load_host_version() -> str:
    pyproject_path = Path(__file__).resolve().parents[2] / "pyproject.toml"
    if not pyproject_path.is_file():
        return "unknown"

    payload = tomllib.loads(pyproject_path.read_text(encoding="utf-8"))
    version = payload.get("project", {}).get("version")
    return version if isinstance(version, str) else "unknown"


def _load_repo_package_manager(workspace_root: Path | None) -> str | None:
    package_json_path = _find_workspace_package_json(workspace_root)
    if package_json_path is None:
        return None

    payload = json.loads(package_json_path.read_text(encoding="utf-8"))
    package_manager = payload.get("packageManager")
    if not isinstance(package_manager, str) or "@" not in package_manager:
        return None

    return package_manager.split("@", 1)[0]


def _find_workspace_package_json(workspace_root: Path | None) -> Path | None:
    if workspace_root is not None:
        candidate = workspace_root / "package.json"
        return candidate if candidate.is_file() else None

    for parent in Path(__file__).resolve().parents:
        candidate = parent / "package.json"
        if candidate.is_file():
            return candidate

    return None


def _runtime_package_dir(cache_dir: Path, manifest: RuntimeManifest) -> Path:
    return cache_dir / "node_modules" / Path(*manifest.runtime_package.split("/"))


def _resolve_runtime_executable_path(
    package_dir: Path,
    payload: dict[str, object],
) -> Path | None:
    bin_payload = payload.get("bin")
    if isinstance(bin_payload, dict):
        executable = bin_payload.get(RUNTIME_EXECUTABLE_NAME)
        if isinstance(executable, str):
            return package_dir / executable

    if isinstance(bin_payload, str):
        return package_dir / bin_payload

    return None


def _empty_runtime_resolution(
    manifest: RuntimeManifest,
    cache_dir: Path,
) -> RuntimePackageResolution:
    return RuntimePackageResolution(
        cache_dir=cache_dir,
        package_dir=_runtime_package_dir(cache_dir, manifest),
    )


def _runtime_environment_result(
    *,
    supported: bool,
    diagnostics: list[HostDiagnostic],
    report: RuntimeEnvironmentReport,
) -> RuntimeEnvironmentResult:
    return RuntimeEnvironmentResult(
        supported=supported,
        diagnostics=diagnostics,
        report=report,
    )


def _build_install_command(
    package_manager: PackageManagerResolution,
    cache_dir: Path,
    pinned_package_spec: str,
) -> tuple[list[str], Path | None]:
    if package_manager.name == "yarn":
        return (
            [
                "yarn",
                "add",
                "--exact",
                pinned_package_spec,
            ],
            cache_dir,
        )

    return (
        [
            package_manager.name,
            "install",
            "--prefix",
            str(cache_dir),
            "--no-save",
            "--package-lock=false",
            pinned_package_spec,
        ],
        None,
    )


def _run_command(
    args: list[str],
    *,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=str(cwd) if cwd is not None else None,
        capture_output=True,
        text=True,
        check=False,
    )
