import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AGOV_EXIT_CONFIGURATION_FAILURE,
  AGOV_EXIT_GOVERNANCE_FAILURE,
  AGOV_EXIT_SUCCESS,
  runAgovCli,
} from './agov.js';

describe('agov check non-Nx fixture execution', () => {
  it('executes a YAML workspace fixture outside Nx', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
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
        profile: 'fixture-valid-yaml',
        violations: [],
      },
    });
    expect(io.err).toBe('');
  });

  it('executes a JSON workspace fixture outside Nx', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('valid-json', 'governance.workspace.json'),
          '--profile',
          fixturePath('valid-json', 'profile.json'),
          '--format',
          'markdown',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(io.out).toContain('# agov check');
    expect(io.out).toContain('- Workspace: fixture-valid-json');
    expect(io.out).toContain('## Metrics');
    expect(io.err).toBe('');
  });

  it('returns deterministic invalid workspace validation outside Nx', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
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
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

    expect(JSON.parse(io.err)).toMatchObject({
      error: {
        code: 'agov.cli.invalid_workspace',
        details: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: 'governance.workspace_schema.invalid_path',
              path: '/projects/0/root',
            }),
            expect.objectContaining({
              code: 'governance.workspace_schema.unknown_dependency_target',
              path: '/dependencies/0/target',
            }),
          ]),
        },
      },
    });
    expect(io.out).toBe('');
  });

  it('returns deterministic invalid profile validation outside Nx', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
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
    ).toBe(AGOV_EXIT_CONFIGURATION_FAILURE);

    expect(JSON.parse(io.err)).toMatchObject({
      error: {
        code: 'agov.cli.invalid_profile',
        details: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              code: 'governance.profile.invalid_enum_value',
              path: '/rules/project-name-convention/severity',
            }),
            expect.objectContaining({
              code: 'governance.profile.invalid_field_type',
              path: '/ownership/required',
            }),
          ]),
        },
      },
    });
    expect(io.out).toBe('');
  });

  it('produces deterministic JSON output for the same non-Nx fixture', () => {
    const first = createMemoryIo();
    const second = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('valid-yaml', 'governance.workspace.yaml'),
          '--profile',
          fixturePath('valid-yaml', 'profile.json'),
          '--format',
          'json',
        ],
        first,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('valid-yaml', 'governance.workspace.yaml'),
          '--profile',
          fixturePath('valid-yaml', 'profile.json'),
          '--format',
          'json',
        ],
        second,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(first.out).toBe(second.out);
  });

  it('produces deterministic Markdown output for the same non-Nx fixture', () => {
    const first = createMemoryIo();
    const second = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('valid-json', 'governance.workspace.json'),
          '--profile',
          fixturePath('valid-json', 'profile.json'),
          '--format',
          'markdown',
        ],
        first,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('valid-json', 'governance.workspace.json'),
          '--profile',
          fixturePath('valid-json', 'profile.json'),
          '--format',
          'markdown',
        ],
        second,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(first.out).toBe(second.out);
  });

  it('produces deterministic table output for the same non-Nx fixture', () => {
    const first = createMemoryIo();
    const second = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('valid-yaml', 'governance.workspace.yaml'),
          '--profile',
          fixturePath('valid-yaml', 'profile.json'),
          '--format',
          'table',
        ],
        first,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('valid-yaml', 'governance.workspace.yaml'),
          '--profile',
          fixturePath('valid-yaml', 'profile.json'),
          '--format',
          'table',
        ],
        second,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(first.out).toBe(second.out);
  });

  it('writes fixture output to stdout by default', () => {
    const io = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('valid-yaml', 'governance.workspace.yaml'),
          '--profile',
          fixturePath('valid-yaml', 'profile.json'),
          '--format',
          'table',
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(io.out).toContain('Governance Check - fixture-valid-yaml');
    expect(io.err).toBe('');
  });

  it('writes fixture output to a file when requested', () => {
    const io = createMemoryIo();
    const outputDir = mkdtempSync(path.join(tmpdir(), 'agov-fixture-output-'));
    const outputPath = path.join(outputDir, 'report.md');

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('valid-json', 'governance.workspace.json'),
          '--profile',
          fixturePath('valid-json', 'profile.json'),
          '--format',
          'markdown',
          '--output',
          outputPath,
        ],
        io,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);

    expect(io.out).toBe('');
    expect(io.err).toBe('');
    expect(readFileSync(outputPath, 'utf8')).toContain('# agov check');
  });

  it('applies fail-on behavior for a non-Nx failing fixture', () => {
    const failing = createMemoryIo();
    const ignored = createMemoryIo();

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('failing-policy', 'governance.workspace.yaml'),
          '--profile',
          fixturePath('failing-policy', 'profile.json'),
          '--format',
          'json',
          '--fail-on',
          'error',
        ],
        failing,
      ),
    ).toBe(AGOV_EXIT_GOVERNANCE_FAILURE);
    expect(JSON.parse(failing.out)).toMatchObject({
      success: false,
      assessment: {
        profile: 'fixture-failing-policy',
        violations: expect.arrayContaining([
          expect.objectContaining({
            severity: 'error',
          }),
        ]),
      },
    });

    expect(
      runAgovCli(
        [
          'check',
          '--workspace',
          fixturePath('failing-policy', 'governance.workspace.yaml'),
          '--profile',
          fixturePath('failing-policy', 'profile.json'),
          '--format',
          'json',
          '--fail-on',
          'none',
        ],
        ignored,
      ),
    ).toBe(AGOV_EXIT_SUCCESS);
    expect(JSON.parse(ignored.out)).toMatchObject({
      success: true,
    });
  });

  it('proves the fixture suite does not require Nx workspace files', () => {
    for (const directory of [
      'valid-yaml',
      'valid-json',
      'invalid-workspace',
      'invalid-profile',
      'failing-policy',
    ]) {
      expect(existsSync(fixturePath(directory, 'nx.json'))).toBe(false);
      expect(existsSync(fixturePath(directory, 'project.json'))).toBe(false);
    }
  });
});

function fixturePath(directory: string, fileName: string): string {
  return path.join(
    fileURLToPath(
      new URL('../tests/fixtures/standalone-cli/non-nx', import.meta.url),
    ),
    directory,
    fileName,
  );
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
