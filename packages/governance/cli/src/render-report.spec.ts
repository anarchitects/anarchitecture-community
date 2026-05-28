import { fileURLToPath } from 'node:url';

import * as reportingPrimitives from './internal/reporting/render-primitives.js';
import { runAgovAssess, runAgovCheck } from './check.js';
import { renderAgovCheckJson, renderAgovCheckReport } from './render-report.js';

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
});

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}
