import { expect, type Locator, type Page } from '@playwright/test';

export const display = (owner: Locator | Page) =>
  owner.locator('packed-display');
export const surfaces = (owner: Locator | Page) => [
  display(owner).locator('aa-editorjs-html .editorjs-html'),
  display(owner).locator('article'),
];
export async function displayResult(owner: Locator | Page, status = 'success') {
  const fixture = display(owner);
  await expect(fixture.getByLabel('Component result')).toContainText(
    `"status": "${status}"`,
  );
  const headless = JSON.parse(
    await fixture.getByLabel('Headless result').innerText(),
  );
  for (const name of ['Component result', 'Directive result']) {
    await expect
      .poll(async () => JSON.parse(await fixture.getByLabel(name).innerText()))
      .toEqual(headless);
  }
  return headless;
}
export async function displayText(owner: Locator | Page, text: string) {
  await displayResult(owner);
  for (const surface of surfaces(owner)) await expect(surface).toHaveText(text);
}
export async function persistDisplay(owner: Locator | Page) {
  const fixture = display(owner);
  await fixture
    .getByRole('button', { name: 'Persist snapshot', exact: true })
    .click();
  await expect(fixture.getByLabel('Display receipt')).toHaveText(
    'Snapshot stored; display not loaded',
  );
  await fixture
    .getByRole('button', { name: 'Load stored display', exact: true })
    .click();
  await expect(fixture.getByLabel('Display receipt')).toHaveText(
    'Stored snapshot loaded',
  );
}
