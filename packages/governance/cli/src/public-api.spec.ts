import * as governanceCli from './index.js';

describe('Governance CLI public API', () => {
  it('exports standalone CLI parity helpers at the package root', () => {
    expect(typeof governanceCli.runAgovAssess).toBe('function');
    expect(typeof governanceCli.runAgovCheck).toBe('function');
    expect(typeof governanceCli.runAgovDependencies).toBe('function');
    expect(typeof governanceCli.runAgovInspect).toBe('function');
    expect(typeof governanceCli.runAgovMetrics).toBe('function');
    expect(typeof governanceCli.runAgovProfileValidate).toBe('function');
    expect(typeof governanceCli.runAgovRecommendations).toBe('function');
    expect(typeof governanceCli.runAgovSignals).toBe('function');
    expect(typeof governanceCli.runAgovViolations).toBe('function');
    expect(typeof governanceCli.runAgovCli).toBe('function');
    expect(typeof governanceCli.parseAgovCliArgs).toBe('function');
    expect(typeof governanceCli.resolveAgovAssessmentCommand).toBe('function');
    expect(typeof governanceCli.resolveAgovCheckCommand).toBe('function');
    expect(typeof governanceCli.resolveAgovAssessCommand).toBe('function');
    expect(typeof governanceCli.resolveAgovDependenciesCommand).toBe(
      'function',
    );
    expect(typeof governanceCli.resolveAgovInspectCommand).toBe('function');
    expect(typeof governanceCli.resolveAgovMetricsCommand).toBe('function');
    expect(typeof governanceCli.resolveAgovProfileValidateCommand).toBe(
      'function',
    );
    expect(typeof governanceCli.resolveAgovRecommendationsCommand).toBe(
      'function',
    );
    expect(typeof governanceCli.resolveAgovSignalsCommand).toBe('function');
    expect(typeof governanceCli.resolveAgovViolationsCommand).toBe('function');
    expect(typeof governanceCli.loadGenericWorkspace).toBe('function');
    expect(typeof governanceCli.loadStandaloneGovernanceProfile).toBe(
      'function',
    );
    expect(governanceCli.AGOV_EXIT_SUCCESS).toBe(0);
    expect(governanceCli.AGOV_EXIT_GOVERNANCE_FAILURE).toBe(1);
    expect(governanceCli.AGOV_EXIT_CONFIGURATION_FAILURE).toBe(2);
    expect(governanceCli.AGOV_EXIT_RUNTIME_FAILURE).toBe(3);
  });
});
