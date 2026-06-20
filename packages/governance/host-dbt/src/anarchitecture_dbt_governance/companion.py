"""Helpers for installing the optional companion dbt package."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .dbt_project import HostDiagnostic

DEFAULT_COMPANION_GIT_URL = (
    "https://github.com/anarchitects/anarchitecture-community.git"
)
DEFAULT_COMPANION_REVISION = "governance-dbt-package@0.0.1"
DEFAULT_COMPANION_SUBDIRECTORY = "packages/governance/dbt-package"
DEFAULT_PACKAGES_FILE = "packages.yml"


@dataclass(frozen=True)
class CompanionInstallOptions:
    """Host-owned options for companion dbt package installation."""

    print_only: bool = False
    write: bool = False
    packages_file: str = DEFAULT_PACKAGES_FILE
    git: str = DEFAULT_COMPANION_GIT_URL
    revision: str = DEFAULT_COMPANION_REVISION
    subdirectory: str = DEFAULT_COMPANION_SUBDIRECTORY
    run_dbt_deps: bool = False


@dataclass(frozen=True)
class CompanionInstallResult:
    """Result of rendering or updating packages.yml for the companion package."""

    supported: bool
    output: str
    diagnostics: list[HostDiagnostic] = field(default_factory=list)
    packages_file_path: Path | None = None
    wrote_file: bool = False
    ran_dbt_deps: bool = False


def handle_companion_install(
    options: CompanionInstallOptions,
    *,
    cwd: Path | None = None,
) -> CompanionInstallResult:
    """Render or update packages.yml for the companion dbt package."""

    current_directory = (cwd or Path.cwd()).resolve()
    packages_file_path = _resolve_path(options.packages_file, current_directory)
    entry = build_companion_package_entry(
        git=options.git,
        revision=options.revision,
        subdirectory=options.subdirectory,
    )
    fragment = render_packages_yml_fragment(entry)

    if options.print_only:
        return CompanionInstallResult(
            supported=True,
            output=fragment,
            packages_file_path=packages_file_path,
        )

    if options.run_dbt_deps and not options.write:
        return CompanionInstallResult(
            supported=False,
            output="",
            packages_file_path=packages_file_path,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.companion_requires_write",
                    message="--run-dbt-deps requires --write.",
                    path=str(packages_file_path),
                    recommendation=(
                        "Re-run with --write to update packages.yml before "
                        "invoking dbt deps."
                    ),
                )
            ],
        )

    if not options.write:
        return CompanionInstallResult(
            supported=True,
            output=(
                f"Dry run: no changes were written to {packages_file_path}.\n"
                "Use --write to update packages.yml, or --print to print the "
                "YAML fragment.\n\n"
                f"{fragment}"
            ),
            packages_file_path=packages_file_path,
        )

    load_result = load_packages_file(packages_file_path)
    if not load_result.supported or load_result.document is None:
        return CompanionInstallResult(
            supported=False,
            output="",
            diagnostics=load_result.diagnostics,
            packages_file_path=packages_file_path,
        )

    updated_document, status, details = add_companion_package(
        load_result.document,
        entry,
    )

    if status == "exists-other-revision":
        existing_revision = details.get("revision")
        revision_note = (
            f' Existing revision: "{existing_revision}".'
            if isinstance(existing_revision, str) and existing_revision
            else ""
        )
        return CompanionInstallResult(
            supported=True,
            output=(
                f"Companion package entry already exists in "
                f"{packages_file_path} with a different revision."
                f"{revision_note}\n"
                "No changes were written. Update the revision manually if you "
                "want to switch versions."
            ),
            packages_file_path=packages_file_path,
        )

    wrote_file = False
    if status == "added":
        write_result = write_packages_file(packages_file_path, updated_document)
        if not write_result.supported:
            return CompanionInstallResult(
                supported=False,
                output="",
                diagnostics=write_result.diagnostics,
                packages_file_path=packages_file_path,
            )
        wrote_file = True

    output_lines = []
    if status == "added":
        output_lines.append(
            f"Updated {packages_file_path} with the companion package entry."
        )
    else:
        output_lines.append(
            f"Companion package entry already exists in {packages_file_path}."
        )
        output_lines.append("No package entry changes were required.")

    ran_dbt_deps = False
    if options.run_dbt_deps:
        deps_result = run_dbt_deps(packages_file_path)
        if not deps_result.supported:
            return CompanionInstallResult(
                supported=False,
                output="",
                diagnostics=deps_result.diagnostics,
                packages_file_path=packages_file_path,
                wrote_file=wrote_file,
            )
        ran_dbt_deps = True
        output_lines.append(f"Ran dbt deps in {packages_file_path.parent}.")
        if deps_result.stdout:
            output_lines.append(deps_result.stdout.rstrip())
        if deps_result.stderr:
            output_lines.append(deps_result.stderr.rstrip())

    return CompanionInstallResult(
        supported=True,
        output="\n".join(line for line in output_lines if line),
        packages_file_path=packages_file_path,
        wrote_file=wrote_file,
        ran_dbt_deps=ran_dbt_deps,
    )


def build_companion_package_entry(
    *,
    git: str,
    revision: str,
    subdirectory: str,
) -> dict[str, str]:
    """Build the canonical dbt packages.yml entry for the companion package."""

    return {
        "git": git,
        "revision": revision,
        "subdirectory": subdirectory,
    }


def render_packages_yml_fragment(entry: dict[str, str]) -> str:
    """Render an exact packages.yml fragment for printing."""

    git = _quote_yaml_string(entry["git"])
    revision = _quote_yaml_string(entry["revision"])
    subdirectory = _quote_yaml_string(entry["subdirectory"])
    return (
        "packages:\n"
        f"  - git: {git}\n"
        f"    revision: {revision}\n"
        f"    subdirectory: {subdirectory}\n"
    )


@dataclass(frozen=True)
class LoadPackagesFileResult:
    """Result of loading an existing or missing packages.yml file."""

    supported: bool
    diagnostics: list[HostDiagnostic]
    document: dict[str, Any] | None = None


def load_packages_file(path: Path) -> LoadPackagesFileResult:
    """Load and validate a packages.yml document."""

    if not path.exists():
        return LoadPackagesFileResult(
            supported=True,
            diagnostics=[],
            document={"packages": []},
        )

    try:
        payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    except OSError as error:
        return LoadPackagesFileResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.packages_file_not_readable",
                    message="packages.yml could not be read.",
                    path=str(path),
                    recommendation="Ensure the packages file exists and is readable.",
                    details={"reason": str(error)},
                )
            ],
        )
    except yaml.YAMLError as error:
        return LoadPackagesFileResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.invalid_packages_yaml",
                    message=(
                        "packages.yml contains invalid YAML; no changes were "
                        "written."
                    ),
                    path=str(path),
                    recommendation=(
                        "Fix the YAML syntax and retry the companion install "
                        "command."
                    ),
                    details={"reason": str(error)},
                )
            ],
        )

    if payload is None:
        payload = {}

    if not isinstance(payload, dict):
        return LoadPackagesFileResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.invalid_packages_shape",
                    message="packages.yml must contain a top-level object.",
                    path=str(path),
                    recommendation=(
                        'Ensure packages.yml uses a top-level "packages:" list '
                        "before retrying."
                    ),
                )
            ],
        )

    packages = payload.get("packages")
    if packages is None:
        payload["packages"] = []
    elif not isinstance(packages, list):
        return LoadPackagesFileResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.invalid_packages_shape",
                    message='packages.yml must define "packages" as a list.',
                    path=str(path),
                    recommendation=(
                        'Update packages.yml so the top-level "packages" key '
                        "contains a YAML list."
                    ),
                )
            ],
        )

    return LoadPackagesFileResult(
        supported=True,
        diagnostics=[],
        document=payload,
    )


def packages_entry_exists(
    packages_document: dict[str, Any],
    entry: dict[str, str],
) -> tuple[bool, dict[str, Any] | None]:
    """Determine whether the companion entry already exists."""

    packages = packages_document.get("packages")
    if not isinstance(packages, list):
        return False, None

    for existing_entry in packages:
        if not isinstance(existing_entry, dict):
            continue
        if (
            existing_entry.get("git") == entry["git"]
            and existing_entry.get("subdirectory") == entry["subdirectory"]
        ):
            return True, existing_entry

    return False, None


def add_companion_package(
    packages_document: dict[str, Any],
    entry: dict[str, str],
) -> tuple[dict[str, Any], str, dict[str, Any]]:
    """Append the companion entry when it is not already present."""

    updated_document = dict(packages_document)
    packages = list(updated_document.get("packages", []))
    exists, existing_entry = packages_entry_exists(updated_document, entry)

    if exists and isinstance(existing_entry, dict):
        existing_revision = existing_entry.get("revision")
        if existing_revision == entry["revision"]:
            return updated_document, "exists-same", {"revision": existing_revision}
        return (
            updated_document,
            "exists-other-revision",
            {"revision": existing_revision},
        )

    packages.append(dict(entry))
    updated_document["packages"] = packages
    return updated_document, "added", {}


@dataclass(frozen=True)
class WritePackagesFileResult:
    """Result of writing a packages.yml document."""

    supported: bool
    diagnostics: list[HostDiagnostic]


def write_packages_file(
    path: Path,
    packages_document: dict[str, Any],
) -> WritePackagesFileResult:
    """Write the updated packages.yml file after successful validation."""

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            yaml.safe_dump(
                packages_document,
                sort_keys=False,
                default_flow_style=False,
                allow_unicode=False,
            ),
            encoding="utf-8",
        )
    except OSError as error:
        return WritePackagesFileResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.packages_file_write_failed",
                    message="packages.yml could not be written.",
                    path=str(path),
                    recommendation=(
                        "Ensure the target directory is writable and retry the "
                        "companion install command."
                    ),
                    details={"reason": str(error)},
                )
            ],
        )

    return WritePackagesFileResult(supported=True, diagnostics=[])


@dataclass(frozen=True)
class RunDbtDepsResult:
    """Result of invoking dbt deps."""

    supported: bool
    diagnostics: list[HostDiagnostic]
    stdout: str = ""
    stderr: str = ""


def run_dbt_deps(path: Path) -> RunDbtDepsResult:
    """Run dbt deps in the packages.yml directory when explicitly requested."""

    if path.name != DEFAULT_PACKAGES_FILE:
        return RunDbtDepsResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.invalid_packages_file_for_dbt_deps",
                    message=(
                        "dbt deps can only be run automatically when the target "
                        "file is named packages.yml."
                    ),
                    path=str(path),
                    recommendation=(
                        "Use the default packages.yml path or run dbt deps "
                        "manually after writing the file."
                    ),
                )
            ],
        )

    try:
        completed = subprocess.run(
            ["dbt", "deps"],
            cwd=path.parent,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return RunDbtDepsResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.dbt_command_not_found",
                    message="dbt executable was not found.",
                    path=str(path.parent),
                    recommendation=(
                        "Install dbt separately and re-run the command, or omit "
                        "--run-dbt-deps."
                    ),
                )
            ],
        )

    if completed.returncode != 0:
        return RunDbtDepsResult(
            supported=False,
            diagnostics=[
                HostDiagnostic(
                    code="governance.host_dbt.dbt_deps_failed",
                    message="dbt deps failed.",
                    path=str(path.parent),
                    recommendation=(
                        "Inspect dbt stdout/stderr output, fix the packages.yml "
                        "or environment issue, and retry."
                    ),
                    details={
                        "stdout": completed.stdout,
                        "stderr": completed.stderr,
                        "returncode": completed.returncode,
                    },
                )
            ],
            stdout=completed.stdout,
            stderr=completed.stderr,
        )

    return RunDbtDepsResult(
        supported=True,
        diagnostics=[],
        stdout=completed.stdout,
        stderr=completed.stderr,
    )


def _resolve_path(value: str, current_directory: Path) -> Path:
    path = Path(value)
    return path if path.is_absolute() else (current_directory / path).resolve()


def _quote_yaml_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'
