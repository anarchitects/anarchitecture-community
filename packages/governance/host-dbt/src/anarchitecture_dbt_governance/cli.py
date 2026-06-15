"""Command-line interface for the dbt Governance host."""

from __future__ import annotations

import argparse
from collections.abc import Sequence

from .runtime_invocation import (
    CheckCommandOptions,
    InitCommandOptions,
    ReportCommandOptions,
    RuntimeInvocation,
)
from .runtime_manager import execute_invocation

COMMANDS = ("check", "setup", "doctor", "init", "report")


def build_parser() -> argparse.ArgumentParser:
    """Build the top-level CLI parser."""

    parser = argparse.ArgumentParser(
        prog="dbt-governance",
        description="dbt-native Python CLI for running Governance checks.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    check_parser = subparsers.add_parser(
        "check",
        help="detect a dbt project and resolve dbt artifacts",
    )
    check_parser.set_defaults(command_name="check")
    check_parser.add_argument("--project-dir")
    check_parser.add_argument("--profiles-dir")
    check_parser.add_argument("--target")
    check_parser.add_argument("--target-path")
    check_parser.add_argument("--config")
    check_parser.add_argument(
        "--use-existing-artifacts",
        action="store_true",
        help=(
            "Use existing artifacts only and never invoke dbt parse when "
            "manifest.json is missing."
        ),
    )
    check_parser.add_argument(
        "--parse",
        action="store_true",
        help="Invoke dbt parse when manifest.json is missing.",
    )
    check_parser.add_argument(
        "--json",
        action="store_true",
        help="Write the machine-readable report JSON to stdout only.",
    )
    check_parser.add_argument(
        "--report-path",
        help="Write the machine-readable JSON report to a file.",
    )

    setup_parser = subparsers.add_parser(
        "setup",
        help="install or verify the pinned Node runtime package",
    )
    setup_parser.set_defaults(command_name="setup")
    setup_parser.add_argument("--config")

    doctor_parser = subparsers.add_parser(
        "doctor",
        help="report runtime compatibility and environment diagnostics",
    )
    doctor_parser.set_defaults(command_name="doctor")
    doctor_parser.add_argument("--config")

    init_parser = subparsers.add_parser(
        "init",
        help="create a starter governance.yml file",
    )
    init_parser.set_defaults(command_name="init")
    init_parser.add_argument("--project-dir")
    init_parser.add_argument("--config")
    init_parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite an existing governance.yml file.",
    )

    report_parser = subparsers.add_parser(
        "report",
        help="render a governance report from the runtime result",
    )
    report_parser.set_defaults(command_name="report")
    report_parser.add_argument("--project-dir")
    report_parser.add_argument("--profiles-dir")
    report_parser.add_argument("--target")
    report_parser.add_argument("--target-path")
    report_parser.add_argument("--config")
    report_parser.add_argument(
        "--use-existing-artifacts",
        action="store_true",
        help=(
            "Use existing artifacts only and never invoke dbt parse when "
            "manifest.json is missing."
        ),
    )
    report_parser.add_argument(
        "--parse",
        action="store_true",
        help="Invoke dbt parse when manifest.json is missing.",
    )
    report_parser.add_argument(
        "--format",
        choices=("json", "markdown"),
        help="Select the report output format.",
    )
    report_parser.add_argument(
        "--report-path",
        help="Write the rendered report output to a file.",
    )

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the CLI and return a process exit code."""

    parser = build_parser()
    namespace = parser.parse_args(list(argv) if argv is not None else None)

    if namespace.command_name == "check":
        invocation = RuntimeInvocation(
            command="check",
            check_options=CheckCommandOptions(
                project_dir=namespace.project_dir,
                profiles_dir=namespace.profiles_dir,
                target=namespace.target,
                target_path=namespace.target_path,
                config=namespace.config,
                use_existing_artifacts=namespace.use_existing_artifacts,
                parse=namespace.parse,
                json_output=namespace.json,
                report_path=namespace.report_path,
            ),
        )
        execution_result = execute_invocation(invocation)
        print(execution_result.output)
        return int(execution_result.exit_code)

    if namespace.command_name == "report":
        invocation = RuntimeInvocation(
            command="report",
            report_options=ReportCommandOptions(
                project_dir=namespace.project_dir,
                profiles_dir=namespace.profiles_dir,
                target=namespace.target,
                target_path=namespace.target_path,
                config=namespace.config,
                use_existing_artifacts=namespace.use_existing_artifacts,
                parse=namespace.parse,
                format=namespace.format,
                report_path=namespace.report_path,
            ),
        )
        execution_result = execute_invocation(invocation)
        print(execution_result.output)
        return int(execution_result.exit_code)

    if namespace.command_name == "init":
        invocation = RuntimeInvocation(
            command="init",
            init_options=InitCommandOptions(
                project_dir=namespace.project_dir,
                config=namespace.config,
                force=namespace.force,
            ),
        )
        execution_result = execute_invocation(invocation)
        print(execution_result.output)
        return int(execution_result.exit_code)

    invocation = RuntimeInvocation(
        command=namespace.command_name,
        config_path=getattr(namespace, "config", None),
    )
    execution_result = execute_invocation(invocation)
    print(execution_result.output)
    return int(execution_result.exit_code)


if __name__ == "__main__":
    raise SystemExit(main())
