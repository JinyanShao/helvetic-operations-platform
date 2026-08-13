import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, missingEnvironment, test } from './authenticated.fixture';

const outputDir = resolve(__dirname, '../../docs/images');
const dispatcherKeys = [
  'E2E_DETAIL_WORK_ORDER_ID',
  'E2E_EDIT_WORK_ORDER_ID',
  'E2E_TRANSITION_WORK_ORDER_ID',
  'E2E_CONFLICT_WORK_ORDER_ID',
  'E2E_CREATE_REFERENCE'
];
const dispatcherSkip = missingEnvironment('dispatcher', dispatcherKeys);

function outputPath(name: string): string {
  mkdirSync(outputDir, { recursive: true });
  return resolve(outputDir, name);
}

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: outputPath(name),
    fullPage: false
  });
}

test.describe('Authenticated Work Order screenshots', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(Boolean(dispatcherSkip), dispatcherSkip);

  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  test('captures Work Order list', async ({ authenticatedPage: page }) => {
    await page.goto('/work-orders');
    await expect(page.getByRole('heading', { name: 'Work order register' })).toBeVisible();
    await expect(page.locator('.list-row').nth(1)).toBeVisible();
    await capture(page, 'work-orders-list.png');
  });

  test('captures Work Order detail', async ({ authenticatedPage: page }) => {
    await page.goto(`/work-orders/${process.env['E2E_DETAIL_WORK_ORDER_ID']}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.facts')).toBeVisible();
    await capture(page, 'work-order-detail.png');
  });

  test('captures Work Order edit form', async ({ authenticatedPage: page }) => {
    await page.goto(`/work-orders/${process.env['E2E_EDIT_WORK_ORDER_ID']}`);
    await page.getByRole('button', { name: 'Edit work order' }).click();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
    await capture(page, 'work-order-edit.png');
  });

  test('captures status transition result', async ({ authenticatedPage: page }) => {
    await page.goto(`/work-orders/${process.env['E2E_TRANSITION_WORK_ORDER_ID']}`);
    const target = await page.getByLabel('Next status').inputValue();
    await page.getByRole('button', { name: 'Advance status' }).click();
    await expect(page.locator('.page-head .tag')).toHaveText(target);
    await capture(page, 'work-order-status-transition.png');
  });

  test('captures conflict recovery state', async ({ authenticatedPage: first }) => {
    const id = process.env['E2E_CONFLICT_WORK_ORDER_ID'];
    const second = await first.context().newPage();
    await second.setViewportSize({ width: 1440, height: 1000 });

    await first.goto(`/work-orders/${id}`);
    await second.goto(`/work-orders/${id}`);
    await first.getByRole('button', { name: 'Edit work order' }).click();
    await second.getByRole('button', { name: 'Edit work order' }).click();
    await first.getByLabel('Summary').fill('First concurrent Playwright update');
    await first.getByRole('button', { name: 'Save changes' }).click();
    await expect(first.getByRole('heading', { name: 'First concurrent Playwright update' })).toBeVisible();
    await second.getByLabel('Summary').fill('Stale concurrent Playwright update');
    await second.getByRole('button', { name: 'Save changes' }).click();
    await expect(second.getByRole('alert')).toContainText('changed elsewhere');
    await capture(second, 'work-order-conflict-state.png');
    await second.close();
  });
});
