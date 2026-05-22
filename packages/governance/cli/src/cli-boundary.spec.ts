import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Governance CLI boundary guardrail', () => {
  it('keeps the extracted CLI implementation free of Nx and plugin-owned imports', () => {
    const sourceRoot = fileURLToPath(new URL('.', import.meta.url));
    const forbiddenPatterns = [
      /from ['"]nx['"]/,
      /from ['"]@nx\//,
      /from ['"]\.\.\/nx-adapter(?:\/|['"])/,
      /from ['"]\.\.\/nx-host(?:\/|['"])/,
      /from ['"]\.\.\/plugin(?:\/|['"])/,
      /from ['"]\.\.\/executors(?:\/|['"])/,
      /from ['"]\.\.\/generators(?:\/|['"])/,
      /from ['"]@anarchitects\/governance-adapter-[^'"]+(?:\/|['"])/,
      /from ['"]@anarchitects\/governance-adapter-nx['"]/,
      /from ['"]@anarchitects\/nx-governance['"]/,
      /anarchitecture-plugins/,
      /@anarchitects\/governance-core\//,
      /tsconfig\.json/,
      /tsconfig\.base\.json/,
      /conventional source folders/,
      /package\.json declares a TypeScript dependency/,
    ];

    for (const filePath of collectImplementationFiles(sourceRoot)) {
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
      !entry.name.endsWith('.test.ts')
    ) {
      collected.push(resolved);
    }
  }

  return collected.sort((left, right) => left.localeCompare(right));
}
