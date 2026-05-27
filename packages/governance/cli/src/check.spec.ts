import { fileURLToPath } from 'node:url';

import * as governanceCore from '@anarchitects/governance-core';

import { runAgovAssess, runAgovCheck } from './check.js';

describe('agov check/assess assessment pipeline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runAgovAssess uses Core artifact assembly', async () => {
    const buildArtifactsSpy = vi.spyOn(
      governanceCore,
      'buildGovernanceAssessmentArtifacts',
    );

    const result = await runAgovAssess({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    expect(buildArtifactsSpy).toHaveBeenCalledTimes(1);
    expect(result.command).toBe('assess');
    expect(result.assessment.workspace.name).toBe('demo');
    expect(result.artifacts.assessment).toBe(result.assessment);
  });

  it('runAgovCheck reuses the assess/artifact pipeline', async () => {
    const buildArtifactsSpy = vi.spyOn(
      governanceCore,
      'buildGovernanceAssessmentArtifacts',
    );

    const result = await runAgovCheck({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    expect(buildArtifactsSpy).toHaveBeenCalledTimes(1);
    expect(result.command).toBe('check');
    expect(result.success).toBe(true);
  });

  it('check succeeds for warning-only assessments', async () => {
    const result = await runAgovCheck({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/warning-profile.json',
      ),
    });

    expect(result.success).toBe(true);
    expect(
      result.assessment.violations.some((v) => v.severity === 'warning'),
    ).toBe(true);
    expect(
      result.assessment.violations.some((v) => v.severity === 'error'),
    ).toBe(false);
  });

  it('check fails when error-severity violations exist', async () => {
    const result = await runAgovCheck({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/error-profile.json',
      ),
    });

    expect(result.success).toBe(false);
    expect(
      result.assessment.violations.some((v) => v.severity === 'error'),
    ).toBe(true);
  });
});

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}
