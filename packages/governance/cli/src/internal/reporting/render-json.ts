import type { GovernanceAssessment } from '@anarchitects/governance-core';

export function renderJsonReport(assessment: GovernanceAssessment): string {
  return JSON.stringify(assessment, null, 2);
}
