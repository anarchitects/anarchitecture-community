import {
  evaluateCoreBuiltInPolicyViolations,
  GovernanceProfile,
  GovernanceWorkspace,
  Violation,
} from '@anarchitects/governance-core';

export function evaluatePolicies(
  workspace: GovernanceWorkspace,
  profile: GovernanceProfile,
): Violation[] {
  return evaluateCoreBuiltInPolicyViolations({
    workspace,
    profile,
  });
}
