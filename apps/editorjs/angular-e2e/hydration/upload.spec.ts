import { uploadCases } from '../upload/cases.js';
import { test, expect } from './fixture.js';
uploadCases('/upload');
test('upload SSR stays inert until the browser activates each owner', async ({
  page,
}) => {
  const response = await page.request.get('/upload');
  const html = await response.text();
  expect(response.status()).toBe(200);
  expect(html).toContain('Independent uploads');
  expect(html).not.toMatch(/codex-editor|contenteditable|PRIVATE_/);
  await page.goto('/upload');
  await expect(page.getByTestId('backend-calls')).toHaveText('0');
  await expect(
    page.locator('aa-upload-editor').getByTestId('ready'),
  ).toHaveText(['ready', 'ready']);
});
