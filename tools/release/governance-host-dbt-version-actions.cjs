const path = require('node:path');
const {
  default: PythonVersionActions,
  afterAllProjectsVersioned,
} = require('@nxlv/python/release/version-actions');

const RUNTIME_PROJECT_NAME = 'governance-runtime-dbt';
const RUNTIME_PACKAGE_NAME = '@anarchitects/governance-runtime-dbt';
const RUNTIME_MANIFEST_RELATIVE_PATH = path.join(
  'src',
  'anarchitecture_dbt_governance',
  'runtime_manifest.json',
);
const RUNTIME_PACKAGE_JSON_PATH = path.join(
  'packages',
  'governance',
  'runtime-dbt',
  'package.json',
);

function readJsonFromTree(tree, filePath) {
  const content = tree.read(filePath);
  if (!content) {
    throw new Error(`Unable to read JSON file at ${filePath}`);
  }

  return JSON.parse(content.toString('utf8'));
}

function stripVersionPrefix(version) {
  return version.replace(/^[~^=]/, '');
}

function replaceProjectVersionInToml(source, newVersion) {
  const versionLinePattern = /^version\s*=\s*"([^"]*)"$/m;
  const currentVersionMatch = source.match(versionLinePattern);

  if (!currentVersionMatch) {
    throw new Error('Unable to locate project version in pyproject.toml');
  }

  if (currentVersionMatch[1] === newVersion) {
    return source;
  }

  const updated = source.replace(
    versionLinePattern,
    `version = "${newVersion}"`,
  );

  return updated;
}

class GovernanceHostDbtVersionActions extends PythonVersionActions {
  runtimeManifestPath() {
    return path.join(
      this.projectGraphNode.data.root,
      RUNTIME_MANIFEST_RELATIVE_PATH,
    );
  }

  async readDependencies(tree, projectGraph) {
    const dependencies = await super.readDependencies(tree, projectGraph);
    const runtimeManifest = readJsonFromTree(tree, this.runtimeManifestPath());

    if (
      runtimeManifest.runtimePackage !== RUNTIME_PACKAGE_NAME ||
      !projectGraph.nodes[RUNTIME_PROJECT_NAME]
    ) {
      return dependencies;
    }

    if (!dependencies.some((dependency) => dependency.target === RUNTIME_PROJECT_NAME)) {
      dependencies.push({
        source: this.projectGraphNode.name,
        target: RUNTIME_PROJECT_NAME,
        type: 'static',
      });
    }

    return dependencies;
  }

  async readCurrentVersionOfDependency(tree, projectGraph, dependencyProjectName) {
    if (dependencyProjectName === RUNTIME_PROJECT_NAME) {
      const runtimeManifest = readJsonFromTree(tree, this.runtimeManifestPath());

      return {
        currentVersion: runtimeManifest.runtimeVersion,
        dependencyCollection: 'dependencies',
      };
    }

    return super.readCurrentVersionOfDependency(
      tree,
      projectGraph,
      dependencyProjectName,
    );
  }

  resolveRuntimeVersion(tree, dependenciesToUpdate) {
    const bumpedRuntimeVersion = dependenciesToUpdate[RUNTIME_PROJECT_NAME];
    if (bumpedRuntimeVersion) {
      return stripVersionPrefix(bumpedRuntimeVersion);
    }

    const runtimePackageManifest = readJsonFromTree(tree, RUNTIME_PACKAGE_JSON_PATH);
    if (runtimePackageManifest.name !== RUNTIME_PACKAGE_NAME) {
      throw new Error(
        `Expected ${RUNTIME_PACKAGE_JSON_PATH} to define ${RUNTIME_PACKAGE_NAME}.`,
      );
    }

    return runtimePackageManifest.version;
  }

  async updateProjectDependencies(tree, projectGraph, dependenciesToUpdate) {
    const logMessages = await super.updateProjectDependencies(
      tree,
      projectGraph,
      dependenciesToUpdate,
    );
    const manifestPath = this.runtimeManifestPath();
    const runtimeManifest = readJsonFromTree(tree, manifestPath);
    const runtimeVersion = this.resolveRuntimeVersion(tree, dependenciesToUpdate);

    let updated = false;

    if (runtimeManifest.runtimePackage !== RUNTIME_PACKAGE_NAME) {
      runtimeManifest.runtimePackage = RUNTIME_PACKAGE_NAME;
      updated = true;
    }

    if (runtimeManifest.runtimeVersion !== runtimeVersion) {
      runtimeManifest.runtimeVersion = runtimeVersion;
      updated = true;
    }

    if (updated) {
      tree.write(manifestPath, `${JSON.stringify(runtimeManifest, null, 2)}\n`);
      logMessages.push(
        `✍️  Synced pinned runtime in ${manifestPath} to ${RUNTIME_PACKAGE_NAME}@${runtimeVersion}`,
      );
    }

    return logMessages;
  }

  async updateProjectVersion(tree, newVersion) {
    const manifestPath = path.join(this.projectGraphNode.data.root, 'pyproject.toml');
    const originalContent = tree.read(manifestPath)?.toString('utf8');
    const logMessages = await super.updateProjectVersion(tree, newVersion);

    if (originalContent) {
      tree.write(
        manifestPath,
        replaceProjectVersionInToml(originalContent, newVersion),
      );
    }

    return logMessages;
  }
}

module.exports = GovernanceHostDbtVersionActions;
module.exports.afterAllProjectsVersioned = afterAllProjectsVersioned;
