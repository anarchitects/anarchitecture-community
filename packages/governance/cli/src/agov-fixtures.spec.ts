import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AGOV_EXIT_GOVERNANCE_FAILURE,
  AGOV_EXIT_SUCCESS,
  runAgovCli,
} from './agov.js';

describe('agov check workspace-mode fixtures', () => {
  it('executes a YAML workspace fixture outside Nx', async () => {
    const io = createMemoryIo();

    expect(
      await runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('valid-yaml', 'governance.workspace.yaml'),
          '--profile',
          fixturePath('valid-yaml', 'profile.json'),
          '--format',
          'json',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(JSON.parse(io.out)).toMatchObject({
      success: true,
      assessment: {
        workspace: {
          id: 'fixture-valid-yaml',
          name: 'fixture-valid-yaml',
        },
      },
    });
    expect(io.err).toBe('');
  });

  it('executes a JSON workspace fixture outside Nx with text output', async () => {
    const io = createMemoryIo();

    expect(
      await runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('valid-json', 'governance.workspace.json'),
          '--profile',
          fixturePath('valid-json', 'profile.json'),
          '--format',
          'text',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(io.out).toContain('agov check');
    expect(io.out).toContain('Governance Check - fixture-valid-json');
    expect(io.err).toBe('');
  });

  it('returns a runtime failure for an invalid workspace document', async () => {
    const io = createMemoryIo();

    expect(
      await runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('invalid-workspace', 'governance.workspace.yaml'),
          '--profile',
          fixturePath('invalid-workspace', 'profile.json'),
          '--format',
          'json',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_RUNTIME_FAILURE);

    expect(JSON.parse(io.err)).toMatchObject({
      error: {
        code: 'agov.cli.invalid_workspace',
      },
    });
    expect(io.out).toBe('');
  });

  it('returns a runtime failure for an invalid profile document', async () => {
    const io = createMemoryIo();

    expect(
      await runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('invalid-profile', 'governance.workspace.yaml'),
          '--profile',
          fixturePath('invalid-profile', 'profile.json'),
          '--format',
          'json',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_RUNTIME_FAILURE);

    expect(JSON.parse(io.err)).toMatchObject({
      error: {
        code: 'agov.cli.invalid_profile',
      },
    });
    expect(io.out).toBe('');
  });

  it('returns a governance failure when blocking violations are found', async () => {
    const io = createMemoryIo();

    expect(
      await runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('failing-policy', 'governance.workspace.yaml'),
          '--profile',
          fixturePath('failing-policy', 'profile.json'),
          '--format',
          'json',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_GOVERNANCE_FAILURE);
    expect(JSON.parse(io.out)).toMatchObject({
      success: false,
      assessment: {
        profile: 'fixture-failing-policy',
      },
    });
  });

  it('keeps fixture execution free of Nx workspace files', () => {
    for (const directory of [
      'valid-yaml',
      'valid-json',
      'invalid-workspace',
      'invalid-profile',
      'failing-policy',
    ]) {
      expect(existsFixture(directory, 'nx.json')).toBe(false);
      expect(existsFixture(directory, 'project.json')).toBe(false);
    }
  });
});

const AGOV_EXIT_RUNTIME_FAILURE = 3;

function fixturePath(directory: string, fileName: string): string {
  return path.join(
    fileURLToPath(
      new URL('../tests/fixtures/standalone-cli/non-nx', import.meta.url),
    ),
    directory,
    fileName,
  );
}

function existsFixture(directory: string, fileName: string): boolean {
  try {
    readFileSync(fixturePath(directory, fileName), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function createMemoryIo(): {
  out: string;
  err: string;
  stdout(message: string): void;
  stderr(message: string): void;
} {
  return {
    out: '',
    err: '',
    stdout(message: string) {
      this.out = message;
    },
    stderr(message: string) {
      this.err = message;
    },
  };
}
