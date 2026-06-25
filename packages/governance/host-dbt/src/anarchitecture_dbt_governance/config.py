"""governance.yml loading and init support for the dbt Governance host."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .dbt_project import HostDiagnostic

DEFAULT_CONFIG_FILE_NAME = "governance.yml"
DEFAULT_PROFILE_DOCUMENT = {"name": "dbt"}
DEFAULT_ADAPTER_OPTIONS = {"validationMode": "strict"}
SUPPORTED_ARTIFACT_MODES = frozenset(
    {
        "require-existing",
        "use-existing-only",
        "use-existing-or-parse",
    }
)
SUPPORTED_OUTPUT_MODES = frozenset({"human", "json"})


@dataclass(frozen=True)
class ProfileConfig:
    """Canonical governance profile configuration routed by the host."""

    path: str | None = None
    document_provided: bool = False
    document: dict[str, Any] = field(
        default_factory=lambda: dict(DEFAULT_PROFILE_DOCUMENT)
    )


@dataclass(frozen=True)
class AdapterPathsConfig:
    """Adapter path hints routed by the host to the runtime boundary."""

    project_dir: str | None = None
    dbt_project_path: str | None = None
    target_path: str | None = None
    manifest_path: str | None = None
    catalog_path: str | None = None
    run_results_path: str | None = None
    sources_path: str | None = None


@dataclass(frozen=True)
class AdapterConfig:
    """Adapter-owned configuration routed by the host."""

    paths: AdapterPathsConfig = field(default_factory=AdapterPathsConfig)
    options: dict[str, Any] = field(
        default_factory=lambda: dict(DEFAULT_ADAPTER_OPTIONS)
    )


@dataclass(frozen=True)
class ExtensionConfig:
    """Extension-owned configuration routed by the host."""

    options: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RuntimeConfig:
    """Runtime setup and invocation configuration routed by the host."""

    cache_dir: str | None = None
    report_path: str | None = None


@dataclass(frozen=True)
class HostCiConfig:
    """Host-owned CI behavior configuration."""

    fail_on_blocking_violations: bool = True


@dataclass(frozen=True)
class HostBehaviorConfig:
    """Host-owned UX, artifact lifecycle, and CI behavior."""

    artifact_mode: str = "require-existing"
    output: str = "human"
    ci: HostCiConfig = field(default_factory=HostCiConfig)


@dataclass(frozen=True)
class GovernanceHostConfig:
    """Fully validated host-local governance.yml content."""

    config_path: Path | None = None
    loaded_from_file: bool = False
    explicit_config: bool = False
    profile: ProfileConfig = field(default_factory=ProfileConfig)
    adapter: AdapterConfig = field(default_factory=AdapterConfig)
    extension: ExtensionConfig = field(default_factory=ExtensionConfig)
    runtime: RuntimeConfig = field(default_factory=RuntimeConfig)
    host: HostBehaviorConfig = field(default_factory=HostBehaviorConfig)


@dataclass(frozen=True)
class ConfigLoadResult:
    """Result of loading and validating governance.yml."""

    supported: bool
    diagnostics: list[HostDiagnostic]
    config: GovernanceHostConfig


@dataclass(frozen=True)
class ConfigInitResult:
    """Result of creating a starter governance.yml file."""

    supported: bool
    diagnostics: list[HostDiagnostic]
    config_path: Path | None = None
    overwritten: bool = False


def load_governance_config(
    *,
    explicit_path: str | None = None,
    project_dir: str | None = None,
    cwd: Path | None = None,
) -> ConfigLoadResult:
    """Load governance.yml from an explicit path or the project/current directory."""

    current_directory = (cwd or Path.cwd()).resolve()
    search_directory = _resolve_search_directory(project_dir, current_directory)
    explicit = explicit_path is not None

    if explicit:
        config_path = _resolve_path(explicit_path, current_directory)
        if not config_path.is_file():
            return _config_failure(
                config=_default_config(
                    config_path=config_path,
                    explicit_config=True,
                ),
                diagnostic=HostDiagnostic(
                    code="governance.host_dbt.config_file_not_found",
                    message="Explicit governance config file was not found.",
                    path=str(config_path),
                    recommendation=(
                        "Pass --config with an existing governance.yml path or "
                        "remove the flag to use host defaults."
                    ),
                ),
            )
    else:
        config_path = search_directory / DEFAULT_CONFIG_FILE_NAME
        if not config_path.is_file():
            return ConfigLoadResult(
                supported=True,
                diagnostics=[],
                config=_default_config(),
            )

    try:
        payload = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except OSError as error:
        return _config_failure(
            config=_default_config(
                config_path=config_path,
                explicit_config=explicit,
            ),
            diagnostic=HostDiagnostic(
                code="governance.host_dbt.config_file_not_found",
                message="governance.yml could not be read.",
                path=str(config_path),
                recommendation="Ensure the config file exists and is readable.",
                details={"reason": str(error)},
            ),
        )
    except yaml.YAMLError as error:
        return _config_failure(
            config=_default_config(
                config_path=config_path,
                explicit_config=explicit,
            ),
            diagnostic=HostDiagnostic(
                code="governance.host_dbt.invalid_config_yaml",
                message="governance.yml contains invalid YAML.",
                path=str(config_path),
                recommendation=(
                    "Fix the YAML syntax or regenerate the file with "
                    "dbt-governance init --force."
                ),
                details={"reason": str(error)},
            ),
        )

    if payload is None:
        payload = {}

    if not isinstance(payload, dict):
        return _config_failure(
            config=_default_config(
                config_path=config_path,
                explicit_config=explicit,
            ),
            diagnostic=HostDiagnostic(
                code="governance.host_dbt.invalid_config_shape",
                message="governance.yml must contain a top-level object.",
                path=str(config_path),
                recommendation=(
                    "Ensure governance.yml starts with the profile, adapter, "
                    "extension, runtime, and host sections."
                ),
            ),
        )

    validation = _build_validated_config(
        payload,
        config_path=config_path,
        explicit_config=explicit,
    )
    if validation.diagnostics:
        return ConfigLoadResult(
            supported=False,
            diagnostics=validation.diagnostics,
            config=validation.config,
        )

    return ConfigLoadResult(
        supported=True,
        diagnostics=[],
        config=validation.config,
    )


def init_governance_config(
    *,
    project_dir: str | None = None,
    explicit_path: str | None = None,
    force: bool = False,
    cwd: Path | None = None,
) -> ConfigInitResult:
    """Create a starter governance.yml file for the host."""

    current_directory = (cwd or Path.cwd()).resolve()
    target_path = _resolve_init_path(
        project_dir=project_dir,
        explicit_path=explicit_path,
        current_directory=current_directory,
    )
    if target_path is None:
        resolved_project_dir = _resolve_path(project_dir, current_directory)
        return ConfigInitResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.invalid_project_dir",
                    message=(
                        "dbt project directory does not exist or is not a directory."
                    ),
                    path=str(resolved_project_dir),
                    recommendation=(
                        "Pass --project-dir with an existing directory or run "
                        "dbt-governance init from the target directory."
                    ),
                )
            ],
        )

    if target_path.exists() and not force:
        return ConfigInitResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.config_already_exists",
                    message=(
                        "governance.yml already exists and will not be overwritten."
                    ),
                    path=str(target_path),
                    recommendation=(
                        "Rerun dbt-governance init with --force to overwrite the "
                        "existing config."
                    ),
                )
            ],
            config_path=target_path,
        )

    existed_before = target_path.exists()
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(_starter_config_text(), encoding="utf-8")
    except OSError as error:
        return ConfigInitResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.config_write_failed",
                    message="Writing governance.yml failed.",
                    path=str(target_path),
                    recommendation=(
                        "Ensure the target directory is writable and rerun "
                        "dbt-governance init."
                    ),
                    details={"reason": str(error)},
                )
            ],
            config_path=target_path,
        )

    return ConfigInitResult(
        supported=True,
        diagnostics=[],
        config_path=target_path,
        overwritten=force and existed_before,
    )


def resolve_config_relative_path(
    value: str | None,
    config: GovernanceHostConfig,
) -> str | None:
    """Resolve a config-relative path string to an absolute string."""

    if value is None:
        return None

    base_directory = config.config_path.parent if config.config_path else Path.cwd()
    candidate = Path(value).expanduser()
    if not candidate.is_absolute():
        candidate = base_directory / candidate

    return str(candidate.resolve())


@dataclass(frozen=True)
class _ConfigValidationResult:
    config: GovernanceHostConfig
    diagnostics: list[HostDiagnostic]


def _build_validated_config(
    payload: dict[str, Any],
    *,
    config_path: Path,
    explicit_config: bool,
) -> _ConfigValidationResult:
    diagnostics: list[HostDiagnostic] = []
    allowed_top_level = {"profile", "adapter", "extension", "runtime", "host"}
    _append_unknown_key_diagnostics(
        payload,
        allowed_top_level,
        diagnostics,
        "top-level config",
        config_path,
    )

    profile = _read_profile_section(payload.get("profile"), diagnostics, config_path)
    adapter = _read_adapter_section(payload.get("adapter"), diagnostics, config_path)
    extension = _read_extension_section(
        payload.get("extension"),
        diagnostics,
        config_path,
    )
    runtime = _read_runtime_section(payload.get("runtime"), diagnostics, config_path)
    host = _read_host_section(payload.get("host"), diagnostics, config_path)

    return _ConfigValidationResult(
        config=GovernanceHostConfig(
            config_path=config_path,
            loaded_from_file=True,
            explicit_config=explicit_config,
            profile=profile,
            adapter=adapter,
            extension=extension,
            runtime=runtime,
            host=host,
        ),
        diagnostics=diagnostics,
    )


def _read_profile_section(
    section: Any,
    diagnostics: list[HostDiagnostic],
    config_path: Path,
) -> ProfileConfig:
    if section is None:
        return ProfileConfig()
    if not isinstance(section, dict):
        diagnostics.append(_section_type_diagnostic("profile", config_path))
        return ProfileConfig()

    _append_unknown_key_diagnostics(
        section,
        {"path", "document"},
        diagnostics,
        "profile",
        config_path,
    )
    path_value = _read_optional_string(
        section.get("path"),
        "profile.path",
        diagnostics,
        config_path,
    )
    document = section.get("document")
    document_provided = "document" in section
    if document is None:
        document_value = dict(DEFAULT_PROFILE_DOCUMENT)
    elif isinstance(document, dict):
        document_value = document
    else:
        diagnostics.append(
            _type_diagnostic(
                code="governance.host_dbt.invalid_config_section",
                message="profile.document must be an object when provided.",
                config_path=config_path,
            )
        )
        document_value = dict(DEFAULT_PROFILE_DOCUMENT)

    return ProfileConfig(
        path=path_value,
        document_provided=document_provided,
        document=document_value,
    )


def _read_adapter_section(
    section: Any,
    diagnostics: list[HostDiagnostic],
    config_path: Path,
) -> AdapterConfig:
    if section is None:
        return AdapterConfig()
    if not isinstance(section, dict):
        diagnostics.append(_section_type_diagnostic("adapter", config_path))
        return AdapterConfig()

    _append_unknown_key_diagnostics(
        section,
        {"paths", "options"},
        diagnostics,
        "adapter",
        config_path,
    )
    paths_section = section.get("paths")
    paths = _read_adapter_paths_section(paths_section, diagnostics, config_path)
    options = section.get("options")
    if options is None:
        options_value = dict(DEFAULT_ADAPTER_OPTIONS)
    elif isinstance(options, dict):
        options_value = {**DEFAULT_ADAPTER_OPTIONS, **options}
    else:
        diagnostics.append(
            _type_diagnostic(
                code="governance.host_dbt.invalid_config_section",
                message="adapter.options must be an object when provided.",
                config_path=config_path,
            )
        )
        options_value = dict(DEFAULT_ADAPTER_OPTIONS)

    return AdapterConfig(paths=paths, options=options_value)


def _read_adapter_paths_section(
    section: Any,
    diagnostics: list[HostDiagnostic],
    config_path: Path,
) -> AdapterPathsConfig:
    if section is None:
        return AdapterPathsConfig()
    if not isinstance(section, dict):
        diagnostics.append(
            _type_diagnostic(
                code="governance.host_dbt.invalid_config_section",
                message="adapter.paths must be an object when provided.",
                config_path=config_path,
            )
        )
        return AdapterPathsConfig()

    _append_unknown_key_diagnostics(
        section,
        {
            "projectDir",
            "dbtProjectPath",
            "targetPath",
            "manifestPath",
            "catalogPath",
            "runResultsPath",
            "sourcesPath",
        },
        diagnostics,
        "adapter.paths",
        config_path,
    )
    return AdapterPathsConfig(
        project_dir=_read_optional_string(
            section.get("projectDir"),
            "adapter.paths.projectDir",
            diagnostics,
            config_path,
        ),
        dbt_project_path=_read_optional_string(
            section.get("dbtProjectPath"),
            "adapter.paths.dbtProjectPath",
            diagnostics,
            config_path,
        ),
        target_path=_read_optional_string(
            section.get("targetPath"),
            "adapter.paths.targetPath",
            diagnostics,
            config_path,
        ),
        manifest_path=_read_optional_string(
            section.get("manifestPath"),
            "adapter.paths.manifestPath",
            diagnostics,
            config_path,
        ),
        catalog_path=_read_optional_string(
            section.get("catalogPath"),
            "adapter.paths.catalogPath",
            diagnostics,
            config_path,
        ),
        run_results_path=_read_optional_string(
            section.get("runResultsPath"),
            "adapter.paths.runResultsPath",
            diagnostics,
            config_path,
        ),
        sources_path=_read_optional_string(
            section.get("sourcesPath"),
            "adapter.paths.sourcesPath",
            diagnostics,
            config_path,
        ),
    )


def _read_extension_section(
    section: Any,
    diagnostics: list[HostDiagnostic],
    config_path: Path,
) -> ExtensionConfig:
    if section is None:
        return ExtensionConfig()
    if not isinstance(section, dict):
        diagnostics.append(_section_type_diagnostic("extension", config_path))
        return ExtensionConfig()

    _append_unknown_key_diagnostics(
        section,
        {"options"},
        diagnostics,
        "extension",
        config_path,
    )
    options = section.get("options")
    if options is None:
        return ExtensionConfig()
    if not isinstance(options, dict):
        diagnostics.append(
            _type_diagnostic(
                code="governance.host_dbt.invalid_config_section",
                message="extension.options must be an object when provided.",
                config_path=config_path,
            )
        )
        return ExtensionConfig()

    return ExtensionConfig(options=options)


def _read_runtime_section(
    section: Any,
    diagnostics: list[HostDiagnostic],
    config_path: Path,
) -> RuntimeConfig:
    if section is None:
        return RuntimeConfig()
    if not isinstance(section, dict):
        diagnostics.append(_section_type_diagnostic("runtime", config_path))
        return RuntimeConfig()

    _append_unknown_key_diagnostics(
        section,
        {"cacheDir", "reportPath"},
        diagnostics,
        "runtime",
        config_path,
    )
    return RuntimeConfig(
        cache_dir=_read_optional_string(
            section.get("cacheDir"),
            "runtime.cacheDir",
            diagnostics,
            config_path,
            code="governance.host_dbt.invalid_runtime_cache_dir",
        ),
        report_path=_read_optional_string(
            section.get("reportPath"),
            "runtime.reportPath",
            diagnostics,
            config_path,
        ),
    )


def _read_host_section(
    section: Any,
    diagnostics: list[HostDiagnostic],
    config_path: Path,
) -> HostBehaviorConfig:
    if section is None:
        return HostBehaviorConfig()
    if not isinstance(section, dict):
        diagnostics.append(_section_type_diagnostic("host", config_path))
        return HostBehaviorConfig()

    _append_unknown_key_diagnostics(
        section,
        {"artifactMode", "output", "ci"},
        diagnostics,
        "host",
        config_path,
    )
    artifact_mode = section.get("artifactMode", "require-existing")
    if not isinstance(artifact_mode, str):
        diagnostics.append(
            _type_diagnostic(
                code="governance.host_dbt.unsupported_artifact_mode",
                message="host.artifactMode must be a string when provided.",
                config_path=config_path,
            )
        )
        artifact_mode = "require-existing"
    elif artifact_mode not in SUPPORTED_ARTIFACT_MODES:
        diagnostics.append(
            _type_diagnostic(
                code="governance.host_dbt.unsupported_artifact_mode",
                message=(
                    f'Unsupported host.artifactMode "{artifact_mode}". '
                    f"Supported values: {', '.join(sorted(SUPPORTED_ARTIFACT_MODES))}."
                ),
                config_path=config_path,
            )
        )
        artifact_mode = "require-existing"

    output = section.get("output", "human")
    if not isinstance(output, str):
        diagnostics.append(
            _type_diagnostic(
                code="governance.host_dbt.unsupported_output_mode",
                message="host.output must be a string when provided.",
                config_path=config_path,
            )
        )
        output = "human"
    elif output not in SUPPORTED_OUTPUT_MODES:
        diagnostics.append(
            _type_diagnostic(
                code="governance.host_dbt.unsupported_output_mode",
                message=(
                    f'Unsupported host.output "{output}". Supported values: '
                    f"{', '.join(sorted(SUPPORTED_OUTPUT_MODES))}."
                ),
                config_path=config_path,
            )
        )
        output = "human"

    ci = _read_ci_section(section.get("ci"), diagnostics, config_path)
    return HostBehaviorConfig(
        artifact_mode=artifact_mode,
        output=output,
        ci=ci,
    )


def _read_ci_section(
    section: Any,
    diagnostics: list[HostDiagnostic],
    config_path: Path,
) -> HostCiConfig:
    if section is None:
        return HostCiConfig()
    if not isinstance(section, dict):
        diagnostics.append(
            _type_diagnostic(
                code="governance.host_dbt.invalid_ci_config",
                message="host.ci must be an object when provided.",
                config_path=config_path,
            )
        )
        return HostCiConfig()

    _append_unknown_key_diagnostics(
        section,
        {"failOnBlockingViolations"},
        diagnostics,
        "host.ci",
        config_path,
    )
    fail_on_blocking = section.get("failOnBlockingViolations", True)
    if not isinstance(fail_on_blocking, bool):
        diagnostics.append(
            _type_diagnostic(
                code="governance.host_dbt.invalid_ci_config",
                message="host.ci.failOnBlockingViolations must be a boolean.",
                config_path=config_path,
            )
        )
        fail_on_blocking = True

    return HostCiConfig(fail_on_blocking_violations=fail_on_blocking)


def _resolve_search_directory(project_dir: str | None, current_directory: Path) -> Path:
    if project_dir is None:
        return current_directory

    return _resolve_path(project_dir, current_directory)


def _resolve_path(path_value: str, current_directory: Path) -> Path:
    candidate = Path(path_value).expanduser()
    if not candidate.is_absolute():
        candidate = current_directory / candidate
    return candidate.resolve()


def _resolve_init_path(
    *,
    project_dir: str | None,
    explicit_path: str | None,
    current_directory: Path,
) -> Path | None:
    if explicit_path is not None:
        return _resolve_path(explicit_path, current_directory)

    if project_dir is None:
        return current_directory / DEFAULT_CONFIG_FILE_NAME

    resolved_project_dir = _resolve_path(project_dir, current_directory)
    if not resolved_project_dir.exists() or not resolved_project_dir.is_dir():
        return None

    return resolved_project_dir / DEFAULT_CONFIG_FILE_NAME


def _default_config(
    *,
    config_path: Path | None = None,
    explicit_config: bool = False,
) -> GovernanceHostConfig:
    return GovernanceHostConfig(
        config_path=config_path,
        loaded_from_file=False,
        explicit_config=explicit_config,
    )


def _config_failure(
    *,
    config: GovernanceHostConfig,
    diagnostic: HostDiagnostic,
) -> ConfigLoadResult:
    return ConfigLoadResult(
        supported=False,
        diagnostics=[diagnostic],
        config=config,
    )


def _starter_config_text() -> str:
    return (
        "profile:\n"
        "  path: governance.profile.yml\n"
        "  document:\n"
        "    name: dbt\n"
        "\n"
        "adapter:\n"
        "  paths:\n"
        "    projectDir: .\n"
        "    manifestPath: target/manifest.json\n"
        "    catalogPath: target/catalog.json\n"
        "    runResultsPath: target/run_results.json\n"
        "    sourcesPath: target/sources.json\n"
        "  options:\n"
        "    validationMode: strict\n"
        "\n"
        "extension:\n"
        "  options:\n"
        "    signals: {}\n"
        "    metrics: {}\n"
        "\n"
        "runtime:\n"
        "  cacheDir: .anarchitecture/dbt-governance/runtime\n"
        "  reportPath: target/governance-report.json\n"
        "\n"
        "host:\n"
        "  artifactMode: use-existing-or-parse\n"
        "  output: human\n"
        "  ci:\n"
        "    failOnBlockingViolations: true\n"
    )


def _append_unknown_key_diagnostics(
    payload: dict[str, Any],
    allowed_keys: set[str],
    diagnostics: list[HostDiagnostic],
    section_name: str,
    config_path: Path,
) -> None:
    for key in payload:
        if key in allowed_keys:
            continue
        diagnostics.append(
            _type_diagnostic(
                code="governance.host_dbt.invalid_config_section",
                message=f'Unsupported field "{key}" in {section_name}.',
                config_path=config_path,
            )
        )


def _read_optional_string(
    value: Any,
    field_name: str,
    diagnostics: list[HostDiagnostic],
    config_path: Path,
    *,
    code: str = "governance.host_dbt.invalid_path_type",
) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    diagnostics.append(
        _type_diagnostic(
            code=code,
            message=f"{field_name} must be a string when provided.",
            config_path=config_path,
        )
    )
    return None


def _section_type_diagnostic(section_name: str, config_path: Path) -> HostDiagnostic:
    return _type_diagnostic(
        code="governance.host_dbt.invalid_config_section",
        message=f"{section_name} must be an object when provided.",
        config_path=config_path,
    )


def _type_diagnostic(
    *,
    code: str,
    message: str,
    config_path: Path,
) -> HostDiagnostic:
    return HostDiagnostic(
        code=code,
        message=message,
        path=str(config_path),
        recommendation="Fix governance.yml and rerun the command.",
    )
