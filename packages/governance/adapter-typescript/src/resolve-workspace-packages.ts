import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { minimatch } from 'minimatch';

const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.nx',
  '.yarn',
  'node_modules',
]);

export function resolveWorkspacePackages(
  workspaceRoot: string,
  patterns: readonly string[],
): string[] {
  const packageCandidates = collectPackageCandidates(workspaceRoot);
  const packageRoots: string[] = [];
  const seenPackageRoots = new Set<string>();

  for (const pattern of patterns) {
    for (const candidate of packageCandidates) {
      if (
        minimatch(candidate, pattern, {
          dot: true,
          nocase: false,
        }) &&
        !seenPackageRoots.has(candidate)
      ) {
        seenPackageRoots.add(candidate);
        packageRoots.push(candidate);
      }
    }
  }

  return packageRoots;
}

function collectPackageCandidates(workspaceRoot: string): string[] {
  const candidates: string[] = [];

  walkWorkspaceDirectories(workspaceRoot, workspaceRoot, candidates);

  return candidates.sort((left, right) => left.localeCompare(right));
}

function walkWorkspaceDirectories(
  workspaceRoot: string,
  currentDirectory: string,
  candidates: string[],
): void {
  if (existsSync(path.join(currentDirectory, 'package.json'))) {
    candidates.push(normalizeRelativePath(workspaceRoot, currentDirectory));
  }

  const entries = readdirSync(currentDirectory, {
    withFileTypes: true,
  }).sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORED_DIRECTORY_NAMES.has(entry.name)) {
      continue;
    }

    walkWorkspaceDirectories(
      workspaceRoot,
      path.join(currentDirectory, entry.name),
      candidates,
    );
  }
}

function normalizeRelativePath(
  workspaceRoot: string,
  targetDirectory: string,
): string {
  const relativePath = path.relative(workspaceRoot, targetDirectory);

  if (!relativePath) {
    return '.';
  }

  return relativePath.split(path.sep).join('/');
}
