import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Core boundary guardrail', () => {
  it('keeps extracted Core implementation free of Nx and plugin imports', () => {
    const coreRoot = fileURLToPath(new URL('.', import.meta.url));
    const forbiddenPatterns = [
      /from ['"]nx['"]/,
      /from ['"]@nx\//,
      /from ['"]@anarchitects\/governance-adapter-[^'"]+(?:\/|['"])/,
      /from ['"]@anarchitects\/governance-cli(?:\/|['"])/,
      /from ['"]@anarchitects\/nx-governance['"]/,
      /from ['"]\.\.\/plugin(?:\/|['"])/,
      /from ['"]\.\.\/executors(?:\/|['"])/,
      /from ['"]\.\.\/generators(?:\/|['"])/,
      /from ['"]\.\.\/standalone-cli(?:\/|['"])/,
      /from ['"]\.\.\/typescript-adapter(?:\/|['"])/,
      /from ['"]\.\.\/manual-workspace(?:\/|['"])/,
      /from ['"]\.\.\/nx-adapter(?:\/|['"])/,
      /from ['"]\.\.\/conformance-adapter(?:\/|['"])/,
      /anarchitecture-plugins/,
      /tsconfig\.json/,
      /tsconfig\.base\.json/,
    ];

    for (const filePath of collectImplementationFiles(coreRoot)) {
      const source = readFileSync(filePath, 'utf8');

      for (const pattern of forbiddenPatterns) {
        expect(source).not.toMatch(pattern);
      }
    }
  });
});

function collectImplementationFiles(directory: string): string[] {
  const collected: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const resolved = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      collected.push(...collectImplementationFiles(resolved));
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.fixtures.ts')
    ) {
      collected.push(resolved);
    }
  }

  return collected.sort((left, right) => left.localeCompare(right));
}
