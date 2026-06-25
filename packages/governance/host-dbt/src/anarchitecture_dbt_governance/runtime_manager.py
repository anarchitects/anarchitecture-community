"""Runtime coordination and pinned Node runtime management for the host."""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import tomllib

from .artifact_manager import ArtifactResolutionResult, resolve_artifacts
from .compatibility import (
    RuntimeManifest,
    RuntimeManifestError,
    is_supported_node_version,
    load_runtime_manifest,
)
from .config import (
    ConfigLoadResult,
    GovernanceHostConfig,
    init_governance_config,
    load_governance_config,
    resolve_config_relative_path,
)
from .dbt_project import HostDiagnostic, resolve_dbt_path_hints
from .exit_codes import (
    ExitCode,
    exit_code_for_diagnostics,
    exit_code_for_runtime_result_with_policy,
)
from .renderer import (
    build_report_document,
    render_diagnostics,
    render_human_report,
    render_json_report,
    render_markdown_report,
    render_not_implemented,
    render_runtime_environment,
)
from .runtime_invocation import (
    CheckCommandOptions,
    InitCommandOptions,
    ReportCommandOptions,
    ResolvedRuntimeExecutable,
    RuntimeHandoffResult,
    RuntimeInvocation,
    invoke_runtime_handoff,
)

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
    config_path: Path | None = None
    config_loaded: bool = False
    config_explicit: bool = False
    install_performed: bool = False


@dataclass(frozen=True)
class RuntimeEnvironmentResult:
    """Result of setup or doctor runtime management."""

    supported: bool
    diagnostics: list[HostDiagnostic]
    report: RuntimeEnvironmentReport


@dataclass(frozen=True)
class GovernanceCommandResult:
    """Intermediate runtime handoff result for check and report."""

    supported: bool
    exit_code: ExitCode
    diagnostics: list[HostDiagnostic]
    host_version: str
    artifact_result: ArtifactResolutionResult | None = None
    runtime_handoff: RuntimeHandoffResult | None = None


def execute_invocation(invocation: RuntimeInvocation) -> InvocationExecutionResult:
    """Execute a host command and hand off to the runtime when required."""

    if invocation.command == "check" and invocation.check_options is not None:
        config_result = load_governance_config(
            explicit_path=invocation.check_options.config,
            project_dir=invocation.check_options.project_dir,
        )
        if not config_result.supported:
            return InvocationExecutionResult(
                exit_code=exit_code_for_diagnostics(config_result.diagnostics),
                output=render_diagnostics(config_result.diagnostics),
            )

        result = _execute_governance_command(
            invocation.check_options,
            config_result,
        )
        report_path = _resolve_output_path(
            invocation.check_options.report_path
            or resolve_config_relative_path(
                config_result.config.runtime.report_path,
                config_result.config,
            )
        )
        report_document = build_report_document(
            command="check",
            host_version=result.host_version,
            exit_code=result.exit_code,
            artifact_result=result.artifact_result,
            runtime_result=result.runtime_handoff,
            diagnostics=result.diagnostics,
            report_path=report_path,
        )

        write_failure = _write_report_output(
            report_path,
            render_json_report(report_document),
        )
        if write_failure is not None:
            return InvocationExecutionResult(
                exit_code=exit_code_for_diagnostics([write_failure]),
                output=render_diagnostics([write_failure]),
            )

        return InvocationExecutionResult(
            exit_code=result.exit_code,
            output=(
                render_json_report(report_document)
                if (
                    invocation.check_options.json_output
                    or config_result.config.host.output == "json"
                )
                else render_human_report(report_document)
            ),
        )

    if invocation.command == "report" and invocation.report_options is not None:
        config_result = load_governance_config(
            explicit_path=invocation.report_options.config,
            project_dir=invocation.report_options.project_dir,
        )
        if not config_result.supported:
            return InvocationExecutionResult(
                exit_code=exit_code_for_diagnostics(config_result.diagnostics),
                output=render_diagnostics(config_result.diagnostics),
            )

        result = _execute_governance_command(
            invocation.report_options,
            config_result,
        )
        report_path = _resolve_output_path(
            invocation.report_options.report_path
            or resolve_config_relative_path(
                config_result.config.runtime.report_path,
                config_result.config,
            )
        )
        report_document = build_report_document(
            command="report",
            host_version=result.host_version,
            exit_code=result.exit_code,
            artifact_result=result.artifact_result,
            runtime_result=result.runtime_handoff,
            diagnostics=result.diagnostics,
            report_path=report_path,
        )
        report_format = invocation.report_options.format or (
            "json" if config_result.config.host.output == "json" else "markdown"
        )
        rendered_output = (
            render_json_report(report_document)
            if report_format == "json"
            else render_markdown_report(report_document)
        )
        write_failure = _write_report_output(report_path, rendered_output)
        if write_failure is not None:
            return InvocationExecutionResult(
                exit_code=exit_code_for_diagnostics([write_failure]),
                output=render_diagnostics([write_failure]),
            )

        return InvocationExecutionResult(
            exit_code=result.exit_code,
            output=rendered_output,
        )

    if invocation.command == "setup":
        config_result = load_governance_config(explicit_path=invocation.config_path)
        if not config_result.supported:
            return InvocationExecutionResult(
                exit_code=exit_code_for_diagnostics(config_result.diagnostics),
                output=render_diagnostics(config_result.diagnostics),
            )

        result = setup_runtime_environment(
            cache_root=_resolve_cache_root(config_result.config),
            config_result=config_result,
        )
        return InvocationExecutionResult(
            exit_code=(
                ExitCode.SUCCESS
                if result.supported
                else exit_code_for_diagnostics(result.diagnostics)
            ),
            output=render_runtime_environment("setup", result),
        )

    if invocation.command == "doctor":
        config_result = load_governance_config(explicit_path=invocation.config_path)
        if not config_result.supported:
            return InvocationExecutionResult(
                exit_code=exit_code_for_diagnostics(config_result.diagnostics),
                output=render_diagnostics(config_result.diagnostics),
            )

        result = doctor_runtime_environment(
            cache_root=_resolve_cache_root(config_result.config),
            config_result=config_result,
        )
        return InvocationExecutionResult(
            exit_code=(
                ExitCode.SUCCESS
                if result.supported
                else exit_code_for_diagnostics(result.diagnostics)
            ),
            output=render_runtime_environment("doctor", result),
        )

    if invocation.command == "init" and invocation.init_options is not None:
        result = _execute_init(invocation.init_options)
        return InvocationExecutionResult(
            exit_code=(
                ExitCode.SUCCESS
                if result.supported
                else exit_code_for_diagnostics(result.diagnostics)
            ),
            output=(
                f"Created governance config: {result.config_path}"
                if result.supported and result.config_path is not None
                else render_diagnostics(result.diagnostics)
            ),
        )

    return InvocationExecutionResult(
        exit_code=ExitCode.SUCCESS,
        output=render_not_implemented(invocation.command),
    )


def _execute_governance_command(
    options: CheckCommandOptions | ReportCommandOptions,
    config_result: ConfigLoadResult,
) -> GovernanceCommandResult:
    config = config_result.config
    detection = resolve_dbt_path_hints(
        project_dir=options.project_dir
        or resolve_config_relative_path(config.adapter.paths.project_dir, config),
        dbt_project_path=resolve_config_relative_path(
            config.adapter.paths.dbt_project_path,
            config,
        ),
        profiles_dir=options.profiles_dir,
        target=options.target,
        target_path=options.target_path or _resolve_target_path_from_config(config),
        manifest_path=resolve_config_relative_path(
            config.adapter.paths.manifest_path,
            config,
        ),
        catalog_path=resolve_config_relative_path(
            config.adapter.paths.catalog_path,
            config,
        ),
        run_results_path=resolve_config_relative_path(
            config.adapter.paths.run_results_path,
            config,
        ),
        sources_path=resolve_config_relative_path(
            config.adapter.paths.sources_path,
            config,
        ),
        config=config_result.config.config_path.as_posix()
        if config_result.config.config_path is not None
        else None,
    )
    if not detection.supported or detection.context is None:
        return GovernanceCommandResult(
            supported=False,
            exit_code=exit_code_for_diagnostics(detection.diagnostics),
            diagnostics=detection.diagnostics,
            host_version=_load_host_version(),
        )

    resolved = resolve_artifacts(
        detection.context,
        parse=_resolve_parse_mode(options, config),
        use_existing_artifacts=_resolve_use_existing_artifacts(options, config),
    )
    if not resolved.supported:
        return GovernanceCommandResult(
            supported=False,
            exit_code=exit_code_for_diagnostics(resolved.diagnostics),
            diagnostics=resolved.diagnostics,
            host_version=_load_host_version(),
            artifact_result=resolved,
        )

    runtime_environment = doctor_runtime_environment(
        cache_root=_resolve_cache_root(config),
        config_result=config_result,
    )
    if not runtime_environment.supported:
        return GovernanceCommandResult(
            supported=False,
            exit_code=exit_code_for_diagnostics(runtime_environment.diagnostics),
            diagnostics=runtime_environment.diagnostics,
            host_version=runtime_environment.report.host_version,
            artifact_result=resolved,
        )

    runtime_handoff = invoke_runtime_handoff(
        resolved.context,
        _resolved_runtime_executable(runtime_environment.report),
        host_version=runtime_environment.report.host_version,
        profile_path=resolve_config_relative_path(config.profile.path, config),
        profile_document=(
            config.profile.document if config.profile.document_provided else None
        ),
        adapter_options=config.adapter.options,
        extension_options=config.extension.options,
        working_directory=resolved.context.project_dir,
    )
    if not runtime_handoff.supported:
        return GovernanceCommandResult(
            supported=False,
            exit_code=exit_code_for_diagnostics(runtime_handoff.diagnostics),
            diagnostics=runtime_handoff.diagnostics,
            host_version=runtime_environment.report.host_version,
            artifact_result=resolved,
            runtime_handoff=runtime_handoff,
        )

    return GovernanceCommandResult(
        supported=True,
        exit_code=exit_code_for_runtime_result_with_policy(
            runtime_handoff.runtime_result or {},
            fail_on_blocking_violations=(config.host.ci.fail_on_blocking_violations),
        ),
        diagnostics=runtime_handoff.diagnostics,
        host_version=runtime_environment.report.host_version,
        artifact_result=resolved,
        runtime_handoff=runtime_handoff,
    )


def _resolve_output_path(output_path: str | None) -> Path | None:
    if output_path is None:
        return None

    candidate = Path(output_path).expanduser()
    if not candidate.is_absolute():
        candidate = Path.cwd() / candidate

    return candidate.resolve()


def _write_report_output(
    output_path: Path | None,
    output: str,
) -> HostDiagnostic | None:
    if output_path is None:
        return None

    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output, encoding="utf-8")
    except OSError as error:
        return HostDiagnostic(
            code="governance.host_dbt.report_write_failed",
            message="Writing the requested report output failed.",
            path=str(output_path),
            recommendation=(
                "Ensure the report output directory is writable and retry the command."
            ),
            details={"reason": str(error)},
        )

    return None


def _resolve_cache_root(config: GovernanceHostConfig) -> Path | None:
    resolved = resolve_config_relative_path(config.runtime.cache_dir, config)
    if resolved is None:
        return None

    return Path(resolved)


def _resolve_target_path_from_config(config: GovernanceHostConfig) -> str | None:
    if config.adapter.paths.target_path is not None:
        return resolve_config_relative_path(config.adapter.paths.target_path, config)

    manifest_path = resolve_config_relative_path(
        config.adapter.paths.manifest_path,
        config,
    )
    if manifest_path is not None:
        return str(Path(manifest_path).parent)

    for candidate in (
        config.adapter.paths.catalog_path,
        config.adapter.paths.run_results_path,
        config.adapter.paths.sources_path,
    ):
        resolved = resolve_config_relative_path(candidate, config)
        if resolved is not None:
            return str(Path(resolved).parent)

    return None


def _resolve_parse_mode(
    options: CheckCommandOptions | ReportCommandOptions,
    config: GovernanceHostConfig,
) -> bool:
    if options.use_existing_artifacts:
        return False
    if options.parse:
        return True

    return config.host.artifact_mode == "use-existing-or-parse"


def _resolve_use_existing_artifacts(
    options: CheckCommandOptions | ReportCommandOptions,
    config: GovernanceHostConfig,
) -> bool:
    if options.use_existing_artifacts:
        return True
    if options.parse:
        return False

    return config.host.artifact_mode == "use-existing-only"


def _config_path(config_result: ConfigLoadResult | None) -> Path | None:
    if config_result is None:
        return None
    return config_result.config.config_path


def _config_loaded(config_result: ConfigLoadResult | None) -> bool:
    if config_result is None:
        return False
    return config_result.config.loaded_from_file


def _config_explicit(config_result: ConfigLoadResult | None) -> bool:
    if config_result is None:
        return False
    return config_result.config.explicit_config


def _execute_init(options: InitCommandOptions):
    return init_governance_config(
        project_dir=options.project_dir,
        explicit_path=options.config,
        force=options.force,
    )


def setup_runtime_environment(
    *,
    cache_root: Path | None = None,
    manifest_path: Path | None = None,
    command_runner=None,
    config_result: ConfigLoadResult | None = None,
    workspace_root: Path | None = None,
) -> RuntimeEnvironmentResult:
    """Install or verify the pinned runtime package in the controlled cache."""

    return _manage_runtime_environment(
        install_if_missing=True,
        cache_root=cache_root,
        manifest_path=manifest_path,
        command_runner=command_runner or _run_command,
        config_result=config_result,
        workspace_root=workspace_root,
    )


def doctor_runtime_environment(
    *,
    cache_root: Path | None = None,
    manifest_path: Path | None = None,
    command_runner=None,
    config_result: ConfigLoadResult | None = None,
    workspace_root: Path | None = None,
) -> RuntimeEnvironmentResult:
    """Inspect the pinned runtime environment without installing packages."""

    return _manage_runtime_environment(
        install_if_missing=False,
        cache_root=cache_root,
        manifest_path=manifest_path,
        command_runner=command_runner or _run_command,
        config_result=config_result,
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
    config_result: ConfigLoadResult | None,
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
            config_path=_config_path(config_result),
            config_loaded=_config_loaded(config_result),
            config_explicit=_config_explicit(config_result),
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
                config_path=_config_path(config_result),
                config_loaded=_config_loaded(config_result),
                config_explicit=_config_explicit(config_result),
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
        config_path=_config_path(config_result),
        config_loaded=_config_loaded(config_result),
        config_explicit=_config_explicit(config_result),
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
                    "Reinstall the pinned runtime package through dbt-governance setup."
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
                    "Reinstall the pinned runtime package through dbt-governance setup."
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
    pinned_package_spec = f"{manifest.runtime_package}@{manifest.runtime_version}"
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
                message=("Creating the controlled runtime cache directory failed."),
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


def _resolved_runtime_executable(
    report: RuntimeEnvironmentReport,
) -> ResolvedRuntimeExecutable:
    return ResolvedRuntimeExecutable(
        runtime_package=report.manifest.runtime_package,
        runtime_version=report.manifest.runtime_version,
        contract_version=report.manifest.contract_version,
        executable_path=report.runtime_resolution.executable_path,
    )
