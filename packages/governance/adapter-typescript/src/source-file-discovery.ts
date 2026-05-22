import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import type { GovernanceProjectInput } from '@anarchitects/governance-core';

import type { TypeScriptSourceFileNode } from './types.js';

const SOURCE_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORED_DIRECTORY_NAMES = new Set([
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
]);

export function discoverTypeScriptSourceFiles(
  workspaceRoot: string,
  projects: readonly GovernanceProjectInput[],
): TypeScriptSourceFileNode[] {
  const files: TypeScriptSourceFileNode[] = [];
  const seenFiles = new Set<string>();

  const sortedProjects = [...projects].sort(
    (left, right) =>
      (left.root ?? '').localeCompare(right.root ?? '') ||
      (left.name ?? left.id).localeCompare(right.name ?? right.id),
  );

  for (const project of sortedProjects) {
    if (!project.root) {
      continue;
    }

    const projectRoot = path.resolve(workspaceRoot, project.root);
    if (!existsSync(projectRoot)) {
      continue;
    }

    walkProjectDirectory({
      workspaceRoot,
      currentDirectory: projectRoot,
      projectName: project.name ?? project.id,
      files,
      seenFiles,
    });
  }

  return files.sort((left, right) =>
    left.filePath.localeCompare(right.filePath),
  );
}

function walkProjectDirectory({
  workspaceRoot,
  currentDirectory,
  projectName,
  files,
  seenFiles,
}: {
  workspaceRoot: string;
  currentDirectory: string;
  projectName: string;
  files: TypeScriptSourceFileNode[];
  seenFiles: Set<string>;
}): void {
  const entries = readdirSync(currentDirectory, {
    withFileTypes: true,
  }).sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }

      walkProjectDirectory({
        workspaceRoot,
        currentDirectory: path.join(currentDirectory, entry.name),
        projectName,
        files,
        seenFiles,
      });
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!isSupportedSourceFile(entry.name)) {
      continue;
    }

    const absoluteFilePath = path.join(currentDirectory, entry.name);
    const relativeFilePath = normalizeRelativePath(
      workspaceRoot,
      absoluteFilePath,
    );

    if (seenFiles.has(relativeFilePath)) {
      continue;
    }

    seenFiles.add(relativeFilePath);
    files.push({
      filePath: relativeFilePath,
      projectName,
    });
  }
}

function isSupportedSourceFile(fileName: string): boolean {
  if (fileName.endsWith('.d.ts')) {
    return false;
  }

  return SOURCE_FILE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function normalizeRelativePath(
  workspaceRoot: string,
  absoluteFilePath: string,
): string {
  return path
    .relative(workspaceRoot, absoluteFilePath)
    .split(path.sep)
    .join('/');
}
