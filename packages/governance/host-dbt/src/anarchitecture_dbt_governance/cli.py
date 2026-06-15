"""Command-line interface for the dbt Governance host scaffold."""

from __future__ import annotations

import argparse
from collections.abc import Sequence

from .runtime_invocation import CheckCommandOptions, RuntimeInvocation
from .runtime_manager import execute_invocation

COMMANDS = ("check", "setup", "doctor", "init", "report")


def build_parser() -> argparse.ArgumentParser:
    """Build the top-level CLI parser."""

    parser = argparse.ArgumentParser(
        prog="dbt-governance",
        description="dbt-native Governance host scaffold.",
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

    setup_parser = subparsers.add_parser(
        "setup",
        help="install or verify the pinned Node runtime package",
    )
    setup_parser.set_defaults(command_name="setup")

    doctor_parser = subparsers.add_parser(
        "doctor",
        help="report runtime compatibility and environment diagnostics",
    )
    doctor_parser.set_defaults(command_name="doctor")

    for command in ("init", "report"):
        subparser = subparsers.add_parser(
            command,
            help=f"{command} placeholder command",
        )
        subparser.set_defaults(command_name=command)

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
            ),
        )
        execution_result = execute_invocation(invocation)
        print(execution_result.output)
        return int(execution_result.exit_code)

    invocation = RuntimeInvocation(
        command=namespace.command_name,
    )
    execution_result = execute_invocation(invocation)
    print(execution_result.output)
    return int(execution_result.exit_code)


if __name__ == "__main__":
    raise SystemExit(main())
