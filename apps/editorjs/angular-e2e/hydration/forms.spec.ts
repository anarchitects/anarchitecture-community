import type { Page } from '@playwright/test';
import {
  test,
  expect,
  bootstrap,
  retained,
  held,
  release,
  arm,
  events,
} from './fixture.js';

const form = (page: Page, owner = 'A') =>
  page.locator(`aa-forms-editor[data-owner="${owner}"]`);
const state = (page: Page, owner = 'A') =>
  form(page, owner).getByTestId('form-state');
const paragraph = (page: Page, owner = 'A') =>
  form(page, owner).locator('.ce-paragraph');
const button = (page: Page, name: string, owner = 'A') =>
  form(page, owner).getByRole('button', { name, exact: true });
async function ready(page: Page, owner = 'A') {
  await expect(form(page, owner).getByTestId('ready-count')).toHaveText('1');
}

for (const mode of ['', '&disabled=true', '&readonly=true']) {
  test(`non-null native form hydrates pristine with schema availability ${mode || 'editable'}`, async ({
    page,
  }) => {
    await bootstrap(page, `/forms?marker=forms-initial${mode}`);
    await ready(page);
    await retained(page);
    await expect(paragraph(page)).toContainText('forms-initial');
    await expect(state(page)).toHaveAttribute(
      'data-disabled',
      String(mode.includes('disabled')),
    );
    await expect(state(page)).toHaveAttribute(
      'data-readonly',
      String(mode.includes('readonly')),
    );
    for (const flag of ['dirty', 'touched', 'pending', 'invalid', 'submitting'])
      await expect(state(page)).toHaveAttribute(`data-${flag}`, 'false');
    await expect(form(page).getByTestId('changes')).toHaveText('0');
    await expect(form(page).getByTestId('touches')).toHaveText('0');
    await expect(paragraph(page)).toHaveAttribute(
      'contenteditable',
      mode ? 'false' : 'true',
    );
    expect((await events(page)).filter((e) => e === 'created')).toHaveLength(1);
  });
}

test('held bootstrap prevents native click/Enter submission and successful-control serialization', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.method() === 'POST')
      requests.push(request.url());
  });
  await bootstrap(page, '/forms?marker=preactivation', [], 1, async () => {
    await expect(form(page).locator('fieldset')).toHaveAttribute(
      'disabled',
      '',
    );
    await expect(form(page).getByRole('textbox')).toBeDisabled();
    await expect(button(page, 'Submit fixture')).toBeDisabled();
    expect(
      await form(page)
        .locator('form')
        .evaluate((node) => [
          ...new FormData(node as HTMLFormElement).entries(),
        ]),
    ).toEqual([]);
    const box = await button(page, 'Submit fixture').boundingBox();
    if (!box) throw new Error('Expected SSR submit button');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.hydrationTest.sessions)).toEqual(
      [],
    );
  });
  await ready(page);
  await expect(page).toHaveURL(/\/forms\?marker=preactivation$/);
  await expect(form(page).getByTestId('submissions')).toHaveText('0');
  expect(requests).toEqual([]);
});

test('JavaScript-disabled form stays inert and never submits its private note', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest()) requests.push(request.url());
  });
  try {
    await page.goto('/forms?marker=nojs');
    await expect(button(page, 'Submit fixture')).toBeDisabled();
    await expect(form(page).getByRole('textbox')).toBeDisabled();
    const box = await button(page, 'Submit fixture').boundingBox();
    if (!box) throw new Error('Expected SSR submit button');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.press('Enter');
    await expect(page.locator('aa-editorjs > div')).toBeEmpty();
    await expect(page).toHaveURL(/\/forms\?marker=nojs$/);
    expect(requests).toHaveLength(1);
  } finally {
    await context.close();
  }
});

test('prerendered Signal Forms retains nodes and its public sample', async ({
  page,
}) => {
  await bootstrap(page, '/sample/forms');
  await ready(page);
  await retained(page);
  await expect(paragraph(page)).toContainText('public-sample');
  await expect(state(page)).toHaveAttribute('data-dirty', 'false');
  await expect(form(page).getByTestId('changes')).toHaveText('0');
});

for (const point of ['load', 'ready'] as const) {
  test(`native writes and resets overtake held ${point} without dirty/touch`, async ({
    page,
  }) => {
    await bootstrap(page, '/forms', [{ owner: 'A', point }]);
    await held(page, point);
    await button(page, 'External write').click();
    await expect(form(page).getByTestId('value')).toContainText(
      'External replacement',
    );
    await button(page, 'Reset document').click();
    await button(page, 'Toggle disabled').click();
    await button(page, 'Toggle readonly').click();
    await release(page);
    await ready(page);
    await expect(paragraph(page)).toHaveText('Native reset');
    await expect(paragraph(page)).toHaveAttribute('contenteditable', 'false');
    await expect(state(page)).toHaveAttribute('data-dirty', 'false');
    await expect(state(page)).toHaveAttribute('data-touched', 'false');
    await expect(form(page).getByTestId('changes')).toHaveText('0');
    await button(page, 'Toggle disabled').click();
    await button(page, 'Toggle readonly').click();
    await expect(paragraph(page)).toHaveAttribute('contenteditable', 'true');
  });
}

test('keyboard edits, composite focus, native validation and explicit snapshot submission', async ({
  page,
}) => {
  await bootstrap(page, '/forms');
  await ready(page);
  await button(page, 'Focus editor').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' keyboard edit');
  await expect(form(page).getByTestId('value')).toContainText('keyboard edit');
  await expect(state(page)).toHaveAttribute('data-dirty', 'true');
  await expect(state(page)).toHaveAttribute('data-touched', 'false');
  // A second block remains inside the composite control.
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second block');
  await expect(state(page)).toHaveAttribute('data-touched', 'false');
  await form(page)
    .getByRole('textbox', { name: 'Private fixture note', exact: true })
    .click();
  await expect(state(page)).toHaveAttribute('data-touched', 'true');
  await expect(form(page).getByTestId('touches')).toHaveText('1');
  await button(page, 'Reset empty').click();
  await expect(state(page)).toHaveAttribute('data-invalid', 'true');
  await button(page, 'Submit fixture').click();
  await expect(form(page).getByTestId('submissions')).toHaveText('0');
  await button(page, 'Reset document').click();
  await button(page, 'Start validation').click();
  await expect(state(page)).toHaveAttribute('data-pending', 'true');
  await button(page, 'Submit fixture').click();
  await expect(form(page).getByTestId('submissions')).toHaveText('0');
  await button(page, 'Reject validation').click();
  await expect(state(page)).toHaveAttribute('data-invalid', 'true');
  await expect(form(page).getByTestId('errors')).toContainText(
    'Document needs review',
  );
  await button(page, 'Reset document').click();
  await expect(state(page)).toHaveAttribute('data-pending', 'false');
  await expect(state(page)).toHaveAttribute('data-invalid', 'false');
  // Hold automatic capture: the model demonstrably lags the real editor DOM.
  await arm(page, { owner: 'A', point: 'save' });
  await paragraph(page).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' fresh submission');
  await held(page, 'save');
  await expect(form(page).getByTestId('value')).not.toContainText(
    'fresh submission',
  );
  await button(page, 'Submit fixture').click();
  await expect(state(page)).toHaveAttribute('data-submitting', 'true');
  await release(page);
  await expect(form(page).getByTestId('captured')).toContainText(
    'fresh submission',
  );
  await expect(form(page).getByTestId('submissions')).toHaveText('1');
  await expect(button(page, 'Submit fixture')).toBeDisabled();
  await form(page).locator('form').dispatchEvent('submit');
  await button(page, 'Complete submission').click();
  await expect(form(page).getByTestId('result')).toHaveText('Submitted');
  await expect(state(page)).toHaveAttribute('data-submitting', 'false');
  await expect(form(page).getByTestId('submissions')).toHaveText('1');
});

for (const operation of ['automatic', 'explicit', 'submit'] as const) {
  test(`same-value native reset fences held ${operation} save`, async ({
    page,
  }) => {
    await bootstrap(page, '/forms');
    await ready(page);
    await arm(page, { owner: 'A', point: 'save' });
    if (operation === 'automatic') {
      await paragraph(page).click();
      await page.keyboard.press('End');
      await page.keyboard.type(' stale edit');
    } else
      await button(
        page,
        operation === 'explicit' ? 'Capture snapshot' : 'Submit fixture',
      ).click();
    await held(page, 'save');
    const value = await form(page).getByTestId('value').textContent();
    await button(page, 'Reset same value').click();
    await release(page);
    await expect.poll(() => events(page)).toContain('save-settled');
    await expect(state(page)).toHaveAttribute('data-submitting', 'false');
    await expect(state(page)).toHaveAttribute('data-dirty', 'false');
    await expect(state(page)).toHaveAttribute('data-touched', 'false');
    await expect(form(page).getByTestId('value')).toHaveText(value!);
    await expect(form(page).getByTestId('changes')).toHaveText('0');
    await expect(form(page).getByTestId('captured')).toBeEmpty();
    await expect(form(page).getByTestId('submissions')).toHaveText('0');
    if (operation !== 'automatic')
      await expect
        .poll(() => events(page))
        .toContain('output-error-superseded');
    await expect(paragraph(page)).not.toContainText('stale edit');
  });
}

test('availability changes preserve native flags and a second owner remains independent', async ({
  page,
}) => {
  await bootstrap(page, '/forms');
  await ready(page);
  await page.getByRole('button', { name: 'Toggle B', exact: true }).click();
  await ready(page, 'B');
  await button(page, 'Toggle disabled').click();
  await expect(form(page).locator('aa-editorjs-control')).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(form(page).locator('aa-editorjs-control > div')).toHaveAttribute(
    'inert',
    '',
  );
  await expect(paragraph(page, 'B')).toHaveAttribute('contenteditable', 'true');
  await paragraph(page, 'B').click();
  await page.keyboard.type(' independent B');
  await expect(form(page, 'B').getByTestId('value')).toContainText(
    'independent B',
  );
  await button(page, 'Toggle disabled').click();
  await button(page, 'Toggle readonly').click();
  await button(page, 'Focus editor').click();
  await expect(form(page).locator('aa-editorjs-control')).toBeFocused();
  await expect(paragraph(page)).toHaveAttribute('contenteditable', 'false');
  await expect(state(page)).toHaveAttribute('data-dirty', 'false');
  await button(page, 'Reset document').click();
  await button(page, 'Toggle readonly').click();
  await expect(paragraph(page)).toHaveText('Native reset');
  await expect(state(page)).toHaveAttribute('data-touched', 'false');
  await expect(state(page, 'B')).toHaveAttribute('data-dirty', 'true');
  await page.getByRole('button', { name: 'Toggle A', exact: true }).click();
  await expect.poll(() => events(page)).toContain('destroyed');
  await expect(form(page, 'B').getByTestId('value')).toContainText(
    'independent B',
  );
});

for (const point of ['load', 'ready', 'save'] as const) {
  for (const fail of [false, true]) {
    test(`destroy/recreate fences pending ${point} ${fail ? 'rejection' : 'resolution'} and all old owner outputs`, async ({
      page,
    }) => {
      await bootstrap(
        page,
        '/forms',
        point === 'save' ? [] : [{ owner: 'A', point, fail }],
      );
      if (point === 'save') {
        await ready(page);
        await arm(page, { owner: 'A', point, fail });
        await button(page, 'Capture snapshot').click();
      }
      await held(page, point);
      await page.getByRole('button', { name: 'Toggle A', exact: true }).click();
      const oldOutputs = (await events(page)).filter((e) =>
        e.startsWith('output-'),
      );
      await page.getByRole('button', { name: 'Toggle A', exact: true }).click();
      await ready(page);
      await release(page);
      await expect
        .poll(() => events(page))
        .toContain(`${point}-${fail ? 'rejected' : 'released'}`);
      if (point !== 'load')
        await expect.poll(() => events(page)).toContain('destroyed');
      if (point === 'load' && !fail)
        await expect.poll(() => events(page)).toContain('loaded');
      expect(
        (await events(page)).filter((e) => e.startsWith('output-')),
      ).toEqual(oldOutputs);
      await expect(form(page).getByTestId('changes')).toHaveText('0');
      await expect(form(page).getByTestId('captured')).toBeEmpty();
      await expect(state(page)).toHaveAttribute('data-dirty', 'false');
      expect(
        (await events(page, 1)).filter((e) => e === 'created'),
      ).toHaveLength(1);
    });
  }
}

test('reset and destruction abandon pending host submission and validation', async ({
  page,
}) => {
  await bootstrap(page, '/forms');
  await ready(page);
  await button(page, 'Submit fixture').click();
  await expect(form(page).getByTestId('result')).toHaveText('Submitting');
  await button(page, 'Reset document').click();
  await button(page, 'Complete submission').click();
  await expect(state(page)).toHaveAttribute('data-submitting', 'false');
  await expect(form(page).getByTestId('result')).toHaveText('Reset');
  await expect(form(page).getByTestId('captured')).toBeEmpty();
  await button(page, 'Start validation').click();
  await expect(state(page)).toHaveAttribute('data-pending', 'true');
  await page.getByRole('button', { name: 'Toggle A', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle A', exact: true }).click();
  await ready(page);
  await expect(state(page)).toHaveAttribute('data-pending', 'false');
  await expect.poll(() => events(page)).toContain('validation-aborted');
  await expect.poll(() => events(page)).toContain('validation-settled');
  await button(page, 'Submit fixture').click();
  await expect(form(page).getByTestId('result')).toHaveText('Submitting');
  await page.getByRole('button', { name: 'Toggle A', exact: true }).click();
  await expect.poll(() => events(page, 1)).toContain('destroyed');
  await page.getByRole('button', { name: 'Toggle A', exact: true }).click();
  await ready(page);
  await expect(form(page).getByTestId('submissions')).toHaveText('0');
  await expect(state(page)).toHaveAttribute('data-touched', 'false');
  await expect(state(page)).toHaveAttribute('data-submitting', 'false');
});

test('host submission errors stay native and reset permits a fresh explicit attempt', async ({
  page,
}) => {
  await bootstrap(page, '/forms');
  await ready(page);
  await button(page, 'Submit fixture').click();
  await expect(form(page).getByTestId('result')).toHaveText('Submitting');
  await button(page, 'Reject submission').click();
  await expect(form(page).getByTestId('result')).toHaveText(
    'Submission rejected',
  );
  await expect(state(page)).toHaveAttribute('data-submitting', 'false');
  await expect(state(page)).toHaveAttribute('data-invalid', 'true');
  await expect(form(page).getByTestId('errors')).toContainText('Save failed');
  await button(page, 'Reset document').click();
  await expect(state(page)).toHaveAttribute('data-invalid', 'false');
  await expect(state(page)).toHaveAttribute('data-dirty', 'false');
  await expect(state(page)).toHaveAttribute('data-touched', 'false');
  await button(page, 'Submit fixture').click();
  await expect(form(page).getByTestId('captured')).toContainText(
    'Native reset',
  );
  await expect(form(page).getByTestId('submissions')).toHaveText('2');
  await button(page, 'Complete submission').click();
  await expect(form(page).getByTestId('result')).toHaveText('Submitted');
});
