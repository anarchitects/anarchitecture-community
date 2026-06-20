import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  detectDbtProject,
  loadDbtArtifacts,
  loadDbtManifest,
  loadDbtProjectConfig,
  normalizeDbtArtifacts,
} from './index.js';

const fixturesRoot = fileURLToPath(
  new URL('../tests/fixtures/artifacts/', import.meta.url),
);

describe('dbt fixture smoke coverage', () => {
  it('loads the representative valid fixture projects from disk', () => {
    for (const fixtureName of [
      'companion-convention',
      'simple-project',
      'layered-project',
      'metadata-rich',
      'valid-project',
      'unresolved-dependency',
    ]) {
      const projectDir = path.join(fixturesRoot, fixtureName);
      const detected = detectDbtProject({
        paths: {
          projectDir,
        },
      });

      expect(detected.supported).toBe(true);
      expect(detected.context).toBeDefined();
      if (!detected.context) {
        throw new Error(`Expected fixture "${fixtureName}" to resolve.`);
      }

      const loaded = loadDbtArtifacts(detected.context);
      expect(loaded.supported).toBe(true);
      expect(loaded.artifacts).toBeDefined();

      if (!loaded.artifacts) {
        throw new Error(`Expected fixture "${fixtureName}" to load artifacts.`);
      }

      const normalized = normalizeDbtArtifacts(
        detected.context,
        loaded.artifacts,
      );

      expect(normalized.workspaceName).toBe(
        loaded.artifacts.projectConfig.name,
      );
      expect(normalized.nodes?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('keeps optional future artifacts small and local-only where provided', () => {
    const metadataRichTarget = path.join(
      fixturesRoot,
      'metadata-rich',
      'target',
    );

    expect(existsSync(path.join(metadataRichTarget, 'catalog.json'))).toBe(
      true,
    );
    expect(existsSync(path.join(metadataRichTarget, 'run_results.json'))).toBe(
      true,
    );
    expect(existsSync(path.join(metadataRichTarget, 'sources.json'))).toBe(
      true,
    );
  });

  it('keeps invalid fixtures clearly consumable for negative-path tests', () => {
    expect(
      loadDbtManifest(
        path.join(fixturesRoot, 'missing-manifest', 'target', 'manifest.json'),
      ).supported,
    ).toBe(false);

    expect(
      loadDbtManifest(
        path.join(
          fixturesRoot,
          'malformed-manifest',
          'target',
          'manifest.json',
        ),
      ).supported,
    ).toBe(false);

    expect(
      loadDbtProjectConfig(
        path.join(fixturesRoot, 'malformed-project-config', 'dbt_project.yml'),
      ).supported,
    ).toBe(false);
  });
});
