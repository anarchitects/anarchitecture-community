import { fileURLToPath } from 'node:url';

import * as reportingPrimitives from './internal/reporting/render-primitives.js';
import { runAgovAssess, runAgovCheck } from './check.js';
import { runAgovDependencies } from './dependencies.js';
import { runAgovInspect } from './inspect.js';
import { runAgovMetrics } from './metrics.js';
import { runAgovProfileValidate } from './profile-validate.js';
import { runAgovRecommendations } from './recommendations.js';
import { runAgovSignals } from './signals.js';
import { runAgovViolations } from './violations.js';
import { runAgovWorkspaceValidate } from './workspace-validate.js';
import {
  renderAgovCheckJson,
  renderAgovCheckReport,
  renderAgovDependenciesJson,
  renderAgovDependenciesReport,
  renderAgovInspectJson,
  renderAgovInspectReport,
  renderAgovMetricsJson,
  renderAgovMetricsReport,
  renderAgovProfileValidateJson,
  renderAgovProfileValidateReport,
  renderAgovRecommendationsJson,
  renderAgovRecommendationsReport,
  renderAgovSignalsJson,
  renderAgovSignalsReport,
  renderAgovViolationsJson,
  renderAgovViolationsReport,
  renderAgovWorkspaceValidateJson,
  renderAgovWorkspaceValidateReport,
} from './render-report.js';

describe('agov command report rendering', () => {
  it('keeps check JSON output shape canonical-aware', async () => {
    const checkResult = await runAgovCheck({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    const rendered = renderAgovCheckJson(checkResult);
    const parsed = JSON.parse(rendered) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual([
      'command',
      'success',
      'assessment',
      'graph',
      'artifacts',
    ]);
    expect(parsed).toMatchObject({
      command: 'check',
      success: true,
      assessment: {
        workspace: {
          name: 'demo',
        },
      },
      graph: {
        nodes: expect.any(Array),
        relations: expect.any(Array),
      },
      artifacts: {
        capabilities: expect.any(Array),
        diagnostics: expect.any(Array),
        extensionDiagnostics: expect.any(Array),
      },
    });
  });

  it('keeps assess JSON output shape canonical-aware', async () => {
    const assessResult = await runAgovAssess({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    const rendered = renderAgovCheckJson(assessResult);
    const parsed = JSON.parse(rendered) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual([
      'command',
      'success',
      'assessment',
      'graph',
      'artifacts',
    ]);
    expect(parsed).toMatchObject({
      command: 'assess',
      success: true,
      assessment: {
        workspace: {
          name: 'demo',
        },
      },
      graph: {
        nodes: expect.any(Array),
        relations: expect.any(Array),
      },
      artifacts: {
        capabilities: expect.any(Array),
        diagnostics: expect.any(Array),
        extensionDiagnostics: expect.any(Array),
      },
    });
  });

  it('delegates low-level formatting to shared primitives', async () => {
    const checkResult = await runAgovCheck({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    const jsonSpy = vi.spyOn(reportingPrimitives, 'renderJsonValue');
    const textTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderTwoColumnTextTable',
    );
    const markdownTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderMarkdownTable',
    );

    renderAgovCheckReport(checkResult, 'json');
    renderAgovCheckReport(checkResult, 'table');
    renderAgovCheckReport(checkResult, 'markdown');

    expect(jsonSpy).toHaveBeenCalled();
    expect(textTableSpy).toHaveBeenCalled();
    expect(markdownTableSpy).toHaveBeenCalled();
  });

  it('keeps text and table aliases equivalent', async () => {
    const assessResult = await runAgovAssess({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    const textRendered = renderAgovCheckReport(assessResult, 'text');
    const tableRendered = renderAgovCheckReport(assessResult, 'table');

    expect(textRendered).toBe(tableRendered);
  });

  it('renders canonical diagnostics in JSON and text outputs', async () => {
    const assessResult = await runAgovAssess({
      workspaceAdapter: {
        id: 'test-adapter:diagnostics',
        loadWorkspace() {
          return {
            workspaceId: 'diagnostic-workspace',
            workspaceName: 'diagnostic-workspace',
            workspaceRoot: '.',
            projects: [],
            dependencies: [],
            diagnostics: [
              {
                code: 'governance.adapter.partial_extraction',
                message: 'Workspace extraction was partial.',
                severity: 'warning',
                kind: 'observation',
                category: 'adapter',
                details: {
                  status: 'partial',
                },
              },
            ],
          };
        },
      },
      workspaceAdapterInput: '.',
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    const parsed = JSON.parse(renderAgovCheckJson(assessResult)) as {
      artifacts: {
        diagnostics: Array<Record<string, unknown>>;
      };
    };
    const textRendered = renderAgovCheckReport(assessResult, 'text');

    expect(parsed.artifacts.diagnostics).toEqual([
      expect.objectContaining({
        code: 'governance.adapter.partial_extraction',
        severity: 'warning',
        details: {
          status: 'partial',
        },
      }),
    ]);
    expect(textRendered).toContain('Diagnostics');
    expect(textRendered).toContain('severity=warning');
    expect(textRendered).toContain('status=partial');
  });

  it('keeps profile validate JSON output shape stable', async () => {
    const profileValidateResult = await runAgovProfileValidate({
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    const rendered = renderAgovProfileValidateJson(profileValidateResult);
    const parsed = JSON.parse(rendered) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual([
      'command',
      'profile',
      'profilePath',
      'success',
      'summary',
    ]);
    expect(parsed).toMatchObject({
      command: 'profile validate',
      success: true,
      profilePath: expect.any(String),
      profile: {
        name: expect.any(String),
      },
      summary: {
        status: 'valid',
        errorCount: 0,
      },
    });
  });

  it('delegates profile validate rendering to shared primitives', async () => {
    const profileValidateResult = await runAgovProfileValidate({
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    const textTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderTwoColumnTextTable',
    );
    const markdownTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderMarkdownTable',
    );

    renderAgovProfileValidateReport(profileValidateResult, 'text');
    renderAgovProfileValidateReport(profileValidateResult, 'markdown');

    expect(textTableSpy).toHaveBeenCalled();
    expect(markdownTableSpy).toHaveBeenCalled();
  });

  it('keeps workspace validate JSON output shape stable', async () => {
    const workspaceValidateResult = await runAgovWorkspaceValidate({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
    });

    const rendered = renderAgovWorkspaceValidateJson(workspaceValidateResult);
    const parsed = JSON.parse(rendered) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual([
      'command',
      'success',
      'summary',
      'workspace',
      'workspacePath',
    ]);
    expect(parsed).toMatchObject({
      command: 'workspace validate',
      success: true,
      workspacePath: expect.any(String),
      workspace: {
        name: 'demo',
      },
      summary: {
        status: 'valid',
        projectCount: expect.any(Number),
        dependencyCount: expect.any(Number),
      },
    });
  });

  it('delegates workspace validate rendering to shared primitives', async () => {
    const workspaceValidateResult = await runAgovWorkspaceValidate({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
    });

    const textTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderTwoColumnTextTable',
    );
    const markdownTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderMarkdownTable',
    );

    renderAgovWorkspaceValidateReport(workspaceValidateResult, 'text');
    renderAgovWorkspaceValidateReport(workspaceValidateResult, 'markdown');

    expect(textTableSpy).toHaveBeenCalled();
    expect(markdownTableSpy).toHaveBeenCalled();
  });

  it('keeps dependencies JSON output shape stable', async () => {
    const dependenciesResult = await runAgovDependencies({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
    });

    const rendered = renderAgovDependenciesJson(dependenciesResult);
    const parsed = JSON.parse(rendered) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual([
      'command',
      'dependencies',
      'projects',
      'summary',
      'workspace',
    ]);
    expect(parsed).toMatchObject({
      command: 'dependencies',
      dependencies: expect.any(Array),
      projects: expect.any(Array),
      summary: {
        totalDependencies: expect.any(Number),
        byType: expect.any(Array),
      },
      workspace: {
        name: 'demo',
      },
    });
  });

  it('delegates dependencies rendering to shared primitives', async () => {
    const dependenciesResult = await runAgovDependencies({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
    });

    const textTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderTwoColumnTextTable',
    );
    const markdownTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderMarkdownTable',
    );

    renderAgovDependenciesReport(dependenciesResult, 'text');
    renderAgovDependenciesReport(dependenciesResult, 'markdown');

    expect(textTableSpy).toHaveBeenCalled();
    expect(markdownTableSpy).toHaveBeenCalled();
  });

  it('keeps inspect JSON output shape stable', async () => {
    const inspectResult = await runAgovInspect({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
    });

    const rendered = renderAgovInspectJson(inspectResult);
    const parsed = JSON.parse(rendered) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual([
      'adapter',
      'command',
      'dependencies',
      'projects',
      'summary',
      'workspace',
    ]);
    expect(parsed).toMatchObject({
      command: 'inspect',
      workspace: {
        name: 'demo',
      },
    });
  });

  it('delegates inspect rendering to shared primitives', async () => {
    const inspectResult = await runAgovInspect({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
    });

    const textTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderTwoColumnTextTable',
    );
    const markdownTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderMarkdownTable',
    );

    renderAgovInspectReport(inspectResult, 'text');
    renderAgovInspectReport(inspectResult, 'markdown');

    expect(textTableSpy).toHaveBeenCalled();
    expect(markdownTableSpy).toHaveBeenCalled();
  });

  it('keeps metrics JSON output shape stable', async () => {
    const metricsResult = await runAgovMetrics({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    const rendered = renderAgovMetricsJson(metricsResult);
    const parsed = JSON.parse(rendered) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual([
      'command',
      'health',
      'measurements',
      'metricBreakdown',
      'profile',
      'summary',
      'workspace',
    ]);
    expect(parsed).toMatchObject({
      command: 'metrics',
      health: {
        status: expect.any(String),
        grade: expect.any(String),
      },
      measurements: expect.any(Array),
      metricBreakdown: {
        families: expect.any(Array),
      },
    });
  });

  it('delegates metrics rendering to shared primitives', async () => {
    const metricsResult = await runAgovMetrics({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/passing-profile.json',
      ),
    });

    const textTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderTwoColumnTextTable',
    );
    const markdownTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderMarkdownTable',
    );

    renderAgovMetricsReport(metricsResult, 'text');
    renderAgovMetricsReport(metricsResult, 'markdown');

    expect(textTableSpy).toHaveBeenCalled();
    expect(markdownTableSpy).toHaveBeenCalled();
  });

  it('keeps recommendations JSON output shape stable', async () => {
    const recommendationsResult = await runAgovRecommendations({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/error-profile.json',
      ),
    });

    const rendered = renderAgovRecommendationsJson(recommendationsResult);
    const parsed = JSON.parse(rendered) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual([
      'command',
      'profile',
      'recommendations',
      'summary',
      'workspace',
    ]);
    expect(parsed).toMatchObject({
      command: 'recommendations',
      recommendations: expect.any(Array),
      summary: {
        total: expect.any(Number),
        byPriority: expect.any(Array),
      },
    });
  });

  it('delegates recommendations rendering to shared primitives', async () => {
    const recommendationsResult = await runAgovRecommendations({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/error-profile.json',
      ),
    });

    const textTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderTwoColumnTextTable',
    );
    const markdownTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderMarkdownTable',
    );

    renderAgovRecommendationsReport(recommendationsResult, 'text');
    renderAgovRecommendationsReport(recommendationsResult, 'markdown');

    expect(textTableSpy).toHaveBeenCalled();
    expect(markdownTableSpy).toHaveBeenCalled();
  });

  it('keeps signals JSON output shape stable', async () => {
    const signalsResult = await runAgovSignals({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/error-profile.json',
      ),
    });

    const rendered = renderAgovSignalsJson(signalsResult);
    const parsed = JSON.parse(rendered) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual([
      'command',
      'profile',
      'signalBreakdown',
      'signals',
      'summary',
      'workspace',
    ]);
    expect(parsed).toMatchObject({
      command: 'signals',
      signalBreakdown: {
        total: expect.any(Number),
        bySource: expect.any(Array),
        byType: expect.any(Array),
        bySeverity: expect.any(Array),
      },
      summary: {
        total: expect.any(Number),
        bySource: expect.any(Array),
        byType: expect.any(Array),
        bySeverity: expect.any(Array),
      },
      signals: expect.any(Array),
    });
  });

  it('delegates signals rendering to shared primitives', async () => {
    const signalsResult = await runAgovSignals({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/error-profile.json',
      ),
    });

    const textTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderTwoColumnTextTable',
    );
    const markdownTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderMarkdownTable',
    );

    renderAgovSignalsReport(signalsResult, 'text');
    renderAgovSignalsReport(signalsResult, 'markdown');

    expect(textTableSpy).toHaveBeenCalled();
    expect(markdownTableSpy).toHaveBeenCalled();
  });

  it('keeps violations JSON output shape stable', async () => {
    const violationsResult = await runAgovViolations({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/error-profile.json',
      ),
    });

    const rendered = renderAgovViolationsJson(violationsResult);
    const parsed = JSON.parse(rendered) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual([
      'command',
      'profile',
      'summary',
      'violations',
      'workspace',
    ]);
    expect(parsed).toMatchObject({
      command: 'violations',
      summary: {
        total: expect.any(Number),
        bySeverity: expect.any(Array),
      },
      violations: expect.any(Array),
    });
  });

  it('delegates violations rendering to shared primitives', async () => {
    const violationsResult = await runAgovViolations({
      workspacePath: fixturePath(
        '../tests/fixtures/manual-workspace/demo-workspace.json',
      ),
      profilePath: fixturePath(
        '../tests/fixtures/standalone-cli/error-profile.json',
      ),
    });

    const textTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderTwoColumnTextTable',
    );
    const markdownTableSpy = vi.spyOn(
      reportingPrimitives,
      'renderMarkdownTable',
    );

    renderAgovViolationsReport(violationsResult, 'text');
    renderAgovViolationsReport(violationsResult, 'markdown');

    expect(textTableSpy).toHaveBeenCalled();
    expect(markdownTableSpy).toHaveBeenCalled();
  });
});

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}
