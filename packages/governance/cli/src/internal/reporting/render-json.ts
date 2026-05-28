import type { GovernanceAssessment } from '@anarchitects/governance-core';
import { renderJsonValue } from './render-primitives.js';

export function renderJsonReport(assessment: GovernanceAssessment): string {
  return renderJsonValue(assessment);
}
