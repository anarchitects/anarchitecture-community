import type {
  GovernanceRule,
  GovernanceRuleContext,
  GovernanceRuleExecutionResult,
  GovernanceRulePack,
} from './rules.js';

export async function evaluateRules<TOptions = unknown>(
  rules: GovernanceRule<TOptions>[],
  context: GovernanceRuleContext<TOptions>,
): Promise<GovernanceRuleExecutionResult> {
  const result = emptyGovernanceRuleExecutionResult();

  for (const rule of rules) {
    const ruleResult = await rule.evaluate(context);

    result.violations.push(...(ruleResult.violations ?? []));
    result.signals.push(...(ruleResult.signals ?? []));
    result.measurements.push(...(ruleResult.measurements ?? []));
  }

  return result;
}

export async function evaluateRulePack<TOptions = unknown>(
  rulePack: GovernanceRulePack<TOptions>,
  context: GovernanceRuleContext<TOptions>,
): Promise<GovernanceRuleExecutionResult> {
  return evaluateRules(rulePack.rules, context);
}

function emptyGovernanceRuleExecutionResult(): GovernanceRuleExecutionResult {
  return {
    violations: [],
    signals: [],
    measurements: [],
  };
}
