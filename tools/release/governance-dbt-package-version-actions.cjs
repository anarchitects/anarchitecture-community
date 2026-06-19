const path = require('node:path');
const { VersionActions } = require('nx/release');

const DBT_PROJECT_FILENAME = 'dbt_project.yml';
const VERSION_LINE_PATTERN = /^version:\s*['"]?([^'"\n]+)['"]?\s*$/m;

function readText(tree, filePath) {
  const content = tree.read(filePath);
  if (!content) {
    throw new Error(`Unable to read file at ${filePath}`);
  }

  return content.toString('utf8');
}

function readVersion(text, filePath) {
  const match = text.match(VERSION_LINE_PATTERN);

  if (!match) {
    throw new Error(
      `Unable to determine the current version for the dbt package from ${filePath}.`,
    );
  }

  return match[1].trim();
}

function replaceVersion(text, newVersion, filePath) {
  if (!VERSION_LINE_PATTERN.test(text)) {
    throw new Error(`Unable to locate a version line in ${filePath}.`);
  }

  return text.replace(VERSION_LINE_PATTERN, `version: ${newVersion}`);
}

class GovernanceDbtPackageVersionActions extends VersionActions {
  validManifestFilenames = [DBT_PROJECT_FILENAME];

  async readCurrentVersionFromSourceManifest(tree) {
    const manifestPath = path.join(
      this.projectGraphNode.data.root,
      DBT_PROJECT_FILENAME,
    );
    const content = readText(tree, manifestPath);

    return {
      manifestPath,
      currentVersion: readVersion(content, manifestPath),
    };
  }

  async readCurrentVersionFromRegistry() {
    return null;
  }

  async readCurrentVersionOfDependency() {
    return {
      currentVersion: null,
      dependencyCollection: null,
    };
  }

  async updateProjectVersion(tree, newVersion) {
    const logMessages = [];

    for (const manifestToUpdate of this.manifestsToUpdate) {
      const content = readText(tree, manifestToUpdate.manifestPath);
      tree.write(
        manifestToUpdate.manifestPath,
        `${replaceVersion(content, newVersion, manifestToUpdate.manifestPath).replace(/\n?$/, '\n')}`,
      );
      logMessages.push(
        `✍️  New version ${newVersion} written to manifest: ${manifestToUpdate.manifestPath}`,
      );
    }

    return logMessages;
  }

  async updateProjectDependencies() {
    return [];
  }
}

module.exports = GovernanceDbtPackageVersionActions;
