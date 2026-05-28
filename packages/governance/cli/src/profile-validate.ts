import type { GovernanceProfile } from '@anarchitects/governance-core';

import {
  StandaloneGovernanceProfileValidationError,
  type StandaloneGovernanceProfileValidationIssue,
  loadStandaloneGovernanceProfile,
} from './internal/profile/load-standalone-profile.js';

export interface AgovProfileValidateOptions {
  profilePath: string;
}

export interface AgovProfileValidateSummary {
  status: 'valid' | 'invalid';
  profileName?: string;
  errorCount: number;
  warningCount: number;
}

export interface AgovProfileValidateResult {
  command: 'profile validate';
  success: boolean;
  profilePath: string;
  summary: AgovProfileValidateSummary;
  profile?: GovernanceProfile;
  errors?: StandaloneGovernanceProfileValidationIssue[];
}

export async function runAgovProfileValidate(
  options: AgovProfileValidateOptions,
): Promise<AgovProfileValidateResult> {
  try {
    const loaded = loadStandaloneGovernanceProfile(options.profilePath);

    return {
      command: 'profile validate',
      success: true,
      profilePath: loaded.filePath,
      profile: loaded.profile,
      summary: {
        status: 'valid',
        profileName: loaded.profile.name,
        errorCount: 0,
        warningCount: 0,
      },
    };
  } catch (error) {
    if (error instanceof StandaloneGovernanceProfileValidationError) {
      return {
        command: 'profile validate',
        success: false,
        profilePath: error.filePath,
        errors: [...error.issues],
        summary: {
          status: 'invalid',
          errorCount: error.issues.length,
          warningCount: 0,
        },
      };
    }

    throw error;
  }
}
