import { fileURLToPath } from 'node:url';

import * as reportingPrimitives from './internal/reporting/render-primitives.js';
import { runAgovAssess, runAgovCheck } from './check.js';
import { runAgovInspect } from './inspect.js';
import { runAgovMetrics } from './metrics.js';
import { runAgovViolations } from './violations.js';
import {
  renderAgovCheckJson,
  renderAgovCheckReport,
  renderAgovInspectJson,
  renderAgovInspectReport,
  renderAgovMetricsJson,
  renderAgovMetricsReport,
  renderAgovViolationsJson,
  renderAgovViolationsReport,
} from './render-report.js';

describe('agov command report rendering', () => {
  it('keeps check JSON output shape stable', async () => {
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

    expect(Object.keys(parsed)).toEqual(['command', 'success', 'assessment']);
    expect(parsed).toMatchObject({
      command: 'check',
      success: true,
      assessment: {
        workspace: {
          name: 'demo',
        },
      },
    });
  });

  it('keeps assess JSON output shape stable', async () => {
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

    expect(Object.keys(parsed)).toEqual(['command', 'success', 'assessment']);
    expect(parsed).toMatchObject({
      command: 'assess',
      success: true,
      assessment: {
        workspace: {
          name: 'demo',
        },
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
