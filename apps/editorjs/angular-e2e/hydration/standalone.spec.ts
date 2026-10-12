import {
  test,
  expect,
  bootstrap,
  retained,
  card,
  paragraph,
  ready,
  arm,
  held,
  release,
  events,
} from './fixture.js';

for (const route of ['/standalone?marker=hydrated', '/sample/standalone']) {
  test(`retains SSR nodes and supports real editing and controls: ${route}`, async ({
    page,
  }) => {
    await bootstrap(page, route);
    await ready(page);
    await retained(page);
    await expect(paragraph(page)).toContainText(
      route.includes('sample') ? 'public-sample' : 'hydrated',
    );
    await expect(card(page).getByTestId('changes')).toHaveText('0');
    await paragraph(page).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' keyboard edit');
    await expect(card(page).getByTestId('last-change')).toContainText(
      'keyboard edit',
    );
    await card(page).getByRole('button', { name: 'save', exact: true }).click();
    await expect(card(page).getByTestId('saved')).toContainText(
      'keyboard edit',
    );
    await expect(card(page).getByTestId('saved')).not.toContainText(
      'consumer mutation',
    );
    await card(page)
      .getByRole('button', { name: 'render', exact: true })
      .click();
    await expect(paragraph(page)).toHaveText('A rendered');
    await card(page)
      .getByRole('button', { name: 'readonly', exact: true })
      .click();
    await expect(paragraph(page)).toHaveAttribute('contenteditable', 'false');
    await card(page)
      .getByRole('button', { name: 'readonly', exact: true })
      .click();
    await expect(paragraph(page)).toHaveAttribute('contenteditable', 'true');
    await card(page)
      .getByRole('button', { name: 'focus', exact: true })
      .click();
    await expect(paragraph(page)).toBeFocused();
    await card(page)
      .getByRole('button', { name: 'clear', exact: true })
      .click();
    await expect(paragraph(page)).toBeEmpty();
    await ready(page);
    expect((await events(page)).filter((e) => e === 'created')).toHaveLength(1);
    await page.getByRole('link', { name: 'Public', exact: true }).click();
    await expect.poll(() => events(page)).toContain('destroyed');
  });
}

for (const point of ['load', 'ready'] as const) {
  test(`latest input wins while ${point} is pending and after readiness`, async ({
    page,
  }) => {
    await bootstrap(page, '/standalone', [{ owner: 'A', point }]);
    await held(page, point);
    await retained(page);
    await card(page).getByRole('button', { name: 'Replace input' }).click();
    await card(page).getByRole('button', { name: 'Replace input' }).click();
    await release(page);
    await ready(page);
    await expect(paragraph(page)).toHaveText('A replacement 2');
    await card(page).getByRole('button', { name: 'Replace input' }).click();
    await expect(paragraph(page)).toHaveText('A replacement 3');
    await card(page).getByRole('button', { name: 'save', exact: true }).click();
    await expect(card(page).getByTestId('saved')).toContainText(
      'A replacement 3',
    );
    await expect(card(page).getByTestId('changes')).toHaveText('0');
    expect(
      (await events(page)).filter((e) => e === 'output-ready'),
    ).toHaveLength(1);
    expect((await events(page)).filter((e) => e === 'created')).toHaveLength(1);
  });

  for (const reject of [false, true]) {
    const settlement = reject ? 'rejection' : 'resolution';
    const finalEvent =
      point === 'ready' ? 'destroyed' : reject ? 'load-rejected' : 'loaded';
    test(`navigation before ${point} ${settlement} fences late work`, async ({
      page,
    }) => {
      await bootstrap(page, '/standalone', [
        { owner: 'A', point, fail: reject },
      ]);
      await held(page, point);
      await page.getByRole('link', { name: 'Public', exact: true }).click();
      await expect.poll(() => events(page)).toContain('owner-destroyed');
      await release(page);
      await expect.poll(() => events(page)).toContain(finalEvent);
      await page.getByRole('link', { name: 'Standalone', exact: true }).click();
      await ready(page);
      await expect(paragraph(page)).toContainText('public-default');
      const old = await events(page);
      expect(old.filter((e) => e.startsWith('output-'))).toEqual([]);
      expect(old.filter((e) => e === 'created')).toHaveLength(
        point === 'ready' ? 1 : 0,
      );
      expect(
        (await events(page, 1)).filter((e) => e === 'created'),
      ).toHaveLength(1);
    });
  }

  test(`${point} failure reports once and recreation recovers`, async ({
    page,
  }) => {
    await bootstrap(page, '/standalone', [{ owner: 'A', point, fail: true }]);
    await held(page, point);
    await release(page);
    await expect(card(page).getByTestId('error')).toHaveText(
      `${point}: operation-failed`,
    );
    expect(
      (await events(page)).filter((e) => e === 'output-error'),
    ).toHaveLength(1);
    await expect
      .poll(
        async () =>
          (await events(page)).filter((e) => e === 'destroyed').length,
      )
      .toBe(point === 'ready' ? 1 : 0);
    await page.getByRole('button', { name: 'Toggle A' }).click();
    await page.getByRole('button', { name: 'Toggle A' }).click();
    await ready(page);
    await expect(card(page).getByTestId('error')).toBeEmpty();
  });
}

test('replacement supersedes a captured save; independent owner and repeated remount stay isolated', async ({
  page,
}) => {
  await bootstrap(page, '/standalone?marker=original');
  await ready(page);
  await page.getByRole('button', { name: 'Toggle B' }).click();
  await ready(page, 'B');
  await arm(page, { owner: 'A', point: 'save' });
  await card(page).getByRole('button', { name: 'save', exact: true }).click();
  await held(page, 'save');
  await card(page).getByRole('button', { name: 'Replace input' }).click();
  await expect(card(page).getByTestId('bound-input')).toContainText(
    'A replacement 1',
  );
  await release(page);
  await expect(card(page).getByTestId('result')).toHaveText(
    'save rejected: superseded',
  );
  await expect(paragraph(page)).toHaveText('A replacement 1');
  await expect(paragraph(page, 'B')).toHaveText('B initial');
  for (const [cycle, index] of [0, 2, 3].entries()) {
    await arm(page, { owner: 'A', point: 'save' });
    await paragraph(page).click();
    await page.keyboard.type(' abandoned');
    await held(page, 'save', index);
    const before = (await events(page, index)).filter((e) =>
      e.startsWith('output-'),
    );
    await page.evaluate((i) => {
      const session = window.hydrationTest.sessions[i];
      session.detached =
        session.holder?.querySelector<HTMLElement>('.ce-paragraph') ??
        undefined;
      if (!session.detached)
        throw new Error('Expected the live Editor.js paragraph');
    }, index);
    await page.getByRole('button', { name: 'Toggle A' }).click();
    await expect.poll(() => events(page, index)).toContain('destroyed');
    await release(page, index);
    await expect.poll(() => events(page, index)).toContain('save-settled');
    // A retained upstream callback simulates detached DOM/editor work after disposal.
    await page.evaluate((i) => {
      const session = window.hydrationTest.sessions[i];
      if (!session.detached || session.detached.isConnected)
        throw new Error('Expected a detached paragraph');
      session.detached.textContent = 'detached DOM edit';
      session.detached.dispatchEvent(
        new InputEvent('input', { bubbles: true }),
      );
      session.notify?.();
    }, index);
    await paragraph(page, 'B').click();
    await page.keyboard.type(` live${cycle}`);
    await expect(card(page, 'B').getByTestId('last-change')).toContainText(
      `live${cycle}`,
    );
    expect(
      (await events(page, index)).filter((e) => e.startsWith('output-')),
    ).toEqual(before);
    await page.getByRole('button', { name: 'Toggle A' }).click();
    await ready(page);
    await expect(paragraph(page)).toContainText('original');
    await expect(card(page).getByTestId('changes')).toHaveText('0');
  }
  const holders = await page.evaluate(() => {
    const holders = window.hydrationTest.sessions.map((s) => s.holder);
    return { unique: new Set(holders).size, total: holders.length };
  });
  expect(holders.unique).toBe(holders.total);
  await page.getByRole('link', { name: 'Public', exact: true }).click();
  await expect
    .poll(async () =>
      page.evaluate(() =>
        window.hydrationTest.sessions.every(
          (s) =>
            s.events.filter((e) => e === 'created').length === 1 &&
            s.events.filter((e) => e === 'destroyed').length === 1,
        ),
      ),
    )
    .toBe(true);
});

for (const fail of [false, true]) {
  const settlement = fail ? 'rejected' : 'released';
  test(`navigation during a captured imperative save handles ${settlement} work after a new owner is ready`, async ({
    page,
  }) => {
    await bootstrap(page, '/standalone?marker=abandoned');
    await ready(page);
    await arm(page, { owner: 'A', point: 'save', fail });
    await card(page).getByRole('button', { name: 'save', exact: true }).click();
    await held(page, 'save');
    await page.getByRole('link', { name: 'Public', exact: true }).click();
    await expect.poll(() => events(page)).toContain('destroyed');
    const oldOutputs = (await events(page)).filter((e) =>
      e.startsWith('output-'),
    );
    await page.getByRole('link', { name: 'Standalone', exact: true }).click();
    await ready(page);
    await release(page);
    await expect.poll(() => events(page)).toContain(`save-${settlement}`);
    await card(page).getByRole('button', { name: 'save', exact: true }).click();
    await expect(card(page).getByTestId('saved')).toContainText(
      'public-default',
    );
    await expect(card(page).getByTestId('saved')).not.toContainText(
      'abandoned',
    );
    expect((await events(page)).filter((e) => e.startsWith('output-'))).toEqual(
      oldOutputs,
    );
    await expect(card(page).getByTestId('error')).toBeEmpty();
  });
}
