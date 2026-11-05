import { expect, type Locator, type Page } from '@playwright/test';

export const display = (owner: Locator | Page) =>
  owner.locator('packed-display');
export const surfaces = (owner: Locator | Page) => [
  display(owner).locator('aa-editorjs-html .editorjs-html'),
  display(owner).locator('article'),
];
export async function displayResult(owner: Locator | Page, status = 'success') {
  const fixture = display(owner);
  let headless: ReturnType<typeof JSON.parse>;
  // All three results can advance between reads, even with the same status.
  // Retry the complete comparison so the expected document advances with them.
  await expect(async () => {
    headless = JSON.parse(
      await fixture.getByLabel('Headless result').innerText(),
    );
    expect(headless.status).toBe(status);
    for (const name of ['Component result', 'Directive result']) {
      expect(JSON.parse(await fixture.getByLabel(name).innerText())).toEqual(
        headless,
      );
    }
  }).toPass({ timeout: 5_000 });
  return headless;
}
export async function displayText(owner: Locator | Page, text: string) {
  for (const surface of surfaces(owner)) await expect(surface).toHaveText(text);
  await displayResult(owner);
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
