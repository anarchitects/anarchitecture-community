import { formsUploadCases } from '../upload/forms-cases.js';
import { test, expect } from './fixture.js';
formsUploadCases('/forms-upload');
test('SSR Forms uploads cannot submit natively before hydration', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  try {
    const page = await context.newPage();
    const response = await page.goto('/forms-upload');
    expect(response?.status()).toBe(200);
    await expect(page.locator('form')).toHaveCount(0);
    await expect(
      page.locator('aa-forms-upload-editor').getByTestId('ready'),
    ).toHaveText(['waiting', 'waiting']);
    await expect(
      page.getByRole('button', { name: 'Submit', exact: true }).first(),
    ).toBeDisabled();
    await page
      .getByLabel('Title', { exact: true })
      .first()
      .fill('Private draft');
    await page.getByLabel('Title', { exact: true }).first().press('Enter');
    await page
      .getByRole('button', { name: 'Programmatic submit' })
      .first()
      .click();
    expect(page.url()).toBe(new URL('/forms-upload', baseURL).href);
    await expect(page.getByTestId('backend-calls')).toHaveText('0');
    await expect(page.locator('.codex-editor')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
