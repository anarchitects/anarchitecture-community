"""Process exit codes for the dbt Governance host scaffold."""

from enum import IntEnum


class ExitCode(IntEnum):
    """Exit codes reserved for the future host CLI."""

    SUCCESS = 0
    HOST_ERROR = 1
