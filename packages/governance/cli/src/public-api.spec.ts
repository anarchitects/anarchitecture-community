import * as governanceCli from './index.js';

describe('Governance CLI public API', () => {
  it('exports standalone CLI parity helpers at the package root', () => {
    expect(typeof governanceCli.runAgovAssess).toBe('function');
    expect(typeof governanceCli.runAgovCheck).toBe('function');
    expect(typeof governanceCli.runAgovCli).toBe('function');
    expect(typeof governanceCli.parseAgovCliArgs).toBe('function');
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
