"""Command-line interface for the dbt Governance host scaffold."""

from __future__ import annotations

import argparse
from collections.abc import Sequence

from .exit_codes import ExitCode
from .runtime_invocation import RuntimeInvocation
from .runtime_manager import execute_invocation

COMMANDS = ("check", "setup", "doctor", "init", "report")


def build_parser() -> argparse.ArgumentParser:
    """Build the top-level CLI parser."""

    parser = argparse.ArgumentParser(
        prog="dbt-governance",
        description="dbt-native Governance host scaffold.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    for command in COMMANDS:
        subparser = subparsers.add_parser(
            command,
            help=f"{command} placeholder command",
        )
        subparser.set_defaults(command_name=command)
        subparser.add_argument(
            "args",
            nargs=argparse.REMAINDER,
            help="Arguments reserved for future implementation.",
        )

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the CLI and return a process exit code."""

    parser = build_parser()
    namespace = parser.parse_args(list(argv) if argv is not None else None)
    invocation = RuntimeInvocation(
        command=namespace.command_name,
        extra_args=list(namespace.args),
    )
    print(execute_invocation(invocation))
    return int(ExitCode.SUCCESS)


if __name__ == "__main__":
    raise SystemExit(main())
