import { test, expect, missingEnvironment } from './authenticated.fixture';

const dispatcherKeys = [
  'E2E_DETAIL_WORK_ORDER_ID',
  'E2E_EDIT_WORK_ORDER_ID',
  'E2E_TRANSITION_WORK_ORDER_ID',
  'E2E_CONFLICT_WORK_ORDER_ID',
  'E2E_CREATE_REFERENCE'
];
const dispatcherSkip = missingEnvironment('dispatcher', dispatcherKeys);

test.describe('Authenticated Work Order workflow', () => {
  test.skip(Boolean(dispatcherSkip), dispatcherSkip);

  test('opens the authenticated Work Order list', async ({ authenticatedPage: page }) => {
    await page.goto('/work-orders');
    await expect(page.getByRole('heading', { name: 'Work order register' })).toBeVisible();
    await expect(page.locator('.list-row').first()).toBeVisible();
  });

  test('filters and paginates through Work Orders', async ({ authenticatedPage: page }) => {
    await page.goto('/work-orders');
    await page.getByLabel('Status').selectOption('Planned');
    await page.getByLabel('Page size').selectOption('10');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/status=Planned/);
    await page.getByLabel('Status').selectOption('');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/page=2/);
  });

  test('navigates from the list to Work Order detail', async ({ authenticatedPage: page }) => {
    await page.goto('/work-orders');
    await page.locator('.list-row').first().click();
    await expect(page).toHaveURL(/\/work-orders\/[0-9a-f-]{36}$/i);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('creates a Work Order', async ({ authenticatedPage: page }) => {
    await page.goto('/work-orders/new');
    await page.getByLabel('Reference').fill(process.env['E2E_CREATE_REFERENCE']!);
    await page.getByLabel('Site').fill('E2E Zurich Operations');
    await page.getByLabel('Summary').fill('Deterministic Playwright creation flow');
    await page.getByLabel('Priority').selectOption('Standard');
    await page.getByLabel('Due at').fill('2030-06-15T10:00');
    await page.getByRole('button', { name: 'Create work order' }).click();
    await expect(page).toHaveURL(/\/work-orders\/[0-9a-f-]{36}$/i);
    await expect(page.getByText(process.env['E2E_CREATE_REFERENCE']!)).toBeVisible();
  });

  test('edits a Work Order', async ({ authenticatedPage: page }) => {
    await page.goto(`/work-orders/${process.env['E2E_EDIT_WORK_ORDER_ID']}`);
    await page.getByRole('button', { name: 'Edit work order' }).click();
    await page.getByLabel('Summary').fill('Deterministic Playwright edit');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: 'Deterministic Playwright edit' })).toBeVisible();
  });

  test('advances a Work Order status', async ({ authenticatedPage: page }) => {
    await page.goto(`/work-orders/${process.env['E2E_TRANSITION_WORK_ORDER_ID']}`);
    const target = await page.getByLabel('Next status').inputValue();
    await page.getByRole('button', { name: 'Advance status' }).click();
    await expect(page.locator('.page-head .tag')).toHaveText(target);
  });

  test('shows conflict recovery after a stale update', async ({ authenticatedPage: first }) => {
    const id = process.env['E2E_CONFLICT_WORK_ORDER_ID'];
    const second = await first.context().newPage();
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
    await second.getByRole('button', { name: 'Reload' }).click();
    await expect(second.getByRole('heading', { name: 'First concurrent Playwright update' })).toBeVisible();
  });
});

const managerSkip = missingEnvironment('manager', ['E2E_CANCEL_WORK_ORDER_ID']);
test.describe('Manager cancellation', () => {
  test.skip(Boolean(managerSkip), managerSkip);

  test('cancels a Work Order with a required reason', async ({ authenticatedPage: page }) => {
    await page.goto(`/work-orders/${process.env['E2E_CANCEL_WORK_ORDER_ID']}`);
    await page.getByLabel('Cancellation reason').fill('Cancelled by deterministic Playwright verification');
    await page.getByRole('button', { name: 'Cancel work order' }).click();
    await expect(page.locator('.page-head .tag')).toHaveText('Cancelled');
  });
});
