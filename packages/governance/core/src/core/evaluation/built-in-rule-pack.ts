import { coreBuiltInPolicyRules } from './built-in-rules.js';
import type { GovernanceRulePack } from './rules.js';

export const CORE_BUILT_IN_RULE_PACK_ID = 'core';

export const coreBuiltInRulePack: GovernanceRulePack = {
  id: CORE_BUILT_IN_RULE_PACK_ID,
  name: 'Governance Core Built-in Rules',
  rules: coreBuiltInPolicyRules,
};

export const coreBuiltInRulePacks: GovernanceRulePack[] = [coreBuiltInRulePack];
