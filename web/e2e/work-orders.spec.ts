import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, missingEnvironment } from './authenticated.fixture';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';

type Role = 'dispatcher' | 'manager';
type CreatedWorkOrder = { id: string; reference: string; site: string };
type RolePage = { context: BrowserContext; page: Page };
type CreateOptions = { site?: string };

const requiredEnvironment = [
  missingEnvironment('dispatcher', []),
  missingEnvironment('manager', [])
].filter(Boolean).join(' ');

const runSegment = segment(process.env['GITHUB_RUN_ID'] ?? Date.now().toString(), 5);
const attemptSegment = segment(process.env['GITHUB_RUN_ATTEMPT'] ?? '0', 2);
let counter = 0;

test.describe('Authenticated Work Order workflow', () => {
  test.skip(Boolean(requiredEnvironment), requiredEnvironment);

  test('opens the authenticated Work Order list', async ({ authenticatedPage: page, browser, baseURL }, testInfo) => {
    const created: CreatedWorkOrder[] = [];
    try {
      created.push(await createWorkOrder(page, testInfo, testInfo.title));
      await page.goto('/work-orders');
      await expect(page.getByRole('heading', { name: 'Work order register' })).toBeVisible();
      await expect(page.getByText(created[0].reference)).toBeVisible();
    } finally {
      await cleanupWorkOrders(browser, baseURL, created);
    }
  });

  test('filters Work Orders using provisioned data', async ({ authenticatedPage: page, browser, baseURL }, testInfo) => {
    const created: CreatedWorkOrder[] = [];
    const pagedSite = `E2E Paging ${uniqueSuffix(testInfo)}`;
    try {
      for (let index = 0; index < 11; index += 1) {
        created.push(await createWorkOrder(page, testInfo, `${testInfo.title} ${index + 1}`, { site: pagedSite }));
      }

      await page.goto('/work-orders');
      await page.getByLabel('Status').selectOption('Planned');
      await page.getByLabel('Site').fill(pagedSite);
      await page.getByLabel('Page size').selectOption('10');
      await page.getByRole('button', { name: 'Apply filters' }).click();
      await expect(page).toHaveURL(/status=Planned/);
      await expect(page).toHaveURL(/pageSize=10/);
      await expect(page.locator('.list-row')).toHaveCount(10);
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page).toHaveURL(/page=2/);
      await expect(page.locator('.list-row')).toHaveCount(1);
    } finally {
      await cleanupWorkOrders(browser, baseURL, created);
    }
  });

  test('navigates from the list to Work Order detail', async ({ authenticatedPage: page, browser, baseURL }, testInfo) => {
    const created: CreatedWorkOrder[] = [];
    try {
      created.push(await createWorkOrder(page, testInfo, testInfo.title));
      await page.goto(`/work-orders?site=${encodeURIComponent(created[0].site)}`);
      await page.getByText(created[0].reference).click();
      await expect(page).toHaveURL(new RegExp(`/work-orders/${created[0].id}$`, 'i'));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    } finally {
      await cleanupWorkOrders(browser, baseURL, created);
    }
  });

  test('creates a Work Order', async ({ authenticatedPage: page, browser, baseURL }, testInfo) => {
    const created: CreatedWorkOrder[] = [];
    try {
      created.push(await createWorkOrder(page, testInfo, testInfo.title));
      await expect(page).toHaveURL(new RegExp(`/work-orders/${created[0].id}$`, 'i'));
      await expect(page.getByText(created[0].reference)).toBeVisible();
    } finally {
      await cleanupWorkOrders(browser, baseURL, created);
    }
  });

  test('edits a Work Order', async ({ authenticatedPage: page, browser, baseURL }, testInfo) => {
    const created: CreatedWorkOrder[] = [];
    try {
      created.push(await createWorkOrder(page, testInfo, testInfo.title));
      await page.goto(`/work-orders/${created[0].id}`);
      await page.getByRole('button', { name: 'Edit work order' }).click();
      await page.getByLabel('Summary').fill(`E2E edited ${created[0].reference}`);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('heading', { name: `E2E edited ${created[0].reference}` })).toBeVisible();
    } finally {
      await cleanupWorkOrders(browser, baseURL, created);
    }
  });

  test('advances a Work Order status', async ({ authenticatedPage: page, browser, baseURL }, testInfo) => {
    const created: CreatedWorkOrder[] = [];
    try {
      created.push(await createWorkOrder(page, testInfo, testInfo.title));
      await page.goto(`/work-orders/${created[0].id}`);
      const target = await page.getByLabel('Next status').inputValue();
      await page.getByLabel('Assignee').fill('Playwright Dispatcher');
      await page.getByRole('button', { name: 'Advance status' }).click();
      await expect(page.locator('.page-head .tag')).toHaveText(target);
    } finally {
      await cleanupWorkOrders(browser, baseURL, created);
    }
  });

  test('shows conflict recovery after a stale update', async ({ authenticatedPage: first, browser, baseURL }, testInfo) => {
    const created: CreatedWorkOrder[] = [];
    let second: RolePage | undefined;
    try {
      created.push(await createWorkOrder(first, testInfo, testInfo.title));
      second = await newAuthenticatedPage(browser, baseURL, 'dispatcher');
      await first.goto(`/work-orders/${created[0].id}`);
      await second.page.goto(`/work-orders/${created[0].id}`);
      await first.getByRole('button', { name: 'Edit work order' }).click();
      await second.page.getByRole('button', { name: 'Edit work order' }).click();
      await first.getByLabel('Summary').fill(`First concurrent ${created[0].reference}`);
      const firstSave = first.waitForResponse(response =>
        response.url().includes(`/api/work-orders/${created[0].id}`) && response.request().method() === 'PUT');
      await first.getByRole('button', { name: 'Save changes' }).click();
      expect((await firstSave).status()).toBe(200);
      await expect(first.getByRole('heading', { name: `First concurrent ${created[0].reference}` })).toBeVisible();
      await second.page.getByLabel('Summary').fill(`Stale concurrent ${created[0].reference}`);
      const staleSave = second.page.waitForResponse(response =>
        response.url().includes(`/api/work-orders/${created[0].id}`) && response.request().method() === 'PUT');
      await second.page.getByRole('button', { name: 'Save changes' }).click();
      expect((await staleSave).status()).toBe(409);
      await expect(second.page.getByRole('alert')).toContainText('changed elsewhere');
      await second.page.getByRole('button', { name: 'Reload' }).click();
      await expect(second.page.getByRole('heading', { name: `First concurrent ${created[0].reference}` })).toBeVisible();
    } finally {
      await closeRolePage(second);
      await cleanupWorkOrders(browser, baseURL, created);
    }
  });
});

test.describe('Manager cancellation', () => {
  test.skip(Boolean(requiredEnvironment), requiredEnvironment);

  test('cancels a provisioned Work Order with a required reason', async ({ browser, baseURL }, testInfo) => {
    const created: CreatedWorkOrder[] = [];
    let dispatcher: RolePage | undefined;
    let manager: RolePage | undefined;
    try {
      dispatcher = await newAuthenticatedPage(browser, baseURL, 'dispatcher');
      created.push(await createWorkOrder(dispatcher.page, testInfo, 'manager cancellation'));
      manager = await newAuthenticatedPage(browser, baseURL, 'manager');
      await cancelWorkOrder(manager.page, created[0], 'Cancelled by authenticated Playwright verification');
      await expect(manager.page.locator('.page-head .tag')).toHaveText('Cancelled');
    } finally {
      await closeRolePage(dispatcher);
      await closeRolePage(manager);
      await cleanupWorkOrders(browser, baseURL, created);
    }
  });
});

async function createWorkOrder(page: Page, testInfo: TestInfo, label: string, options: CreateOptions = {}): Promise<CreatedWorkOrder> {
  const reference = nextReference(testInfo);
  const site = options.site ?? `E2E Site ${reference}`;

  await page.goto('/work-orders/new');
  await page.getByLabel('Reference').fill(reference);
  await page.getByLabel('Site').fill(site);
  await page.getByLabel('Summary').fill(`Provisioned by authenticated E2E: ${label}`);
  await page.getByLabel('Priority').selectOption('Standard');
  await page.getByLabel('Due at').fill('2030-06-15T10:00');
  await page.getByRole('button', { name: 'Create work order' }).click();
  await expect(page).toHaveURL(/\/work-orders\/[0-9a-f-]{36}$/i);
  await expect(page.getByText(reference)).toBeVisible();

  const id = page.url().match(/\/work-orders\/([0-9a-f-]{36})$/i)?.[1];
  if (!id) throw new Error(`Unable to read created Work Order id from ${page.url()}.`);
  return { id, reference, site };
}

async function cleanupWorkOrders(browser: Browser, baseURL: string | undefined, workOrders: CreatedWorkOrder[]): Promise<void> {
  if (!workOrders.length) return;

  let manager: RolePage | undefined;
  try {
    manager = await newAuthenticatedPage(browser, baseURL, 'manager');
    for (const workOrder of workOrders) {
      await bestEffortCancelWorkOrder(manager.page, workOrder, 'Cleaned up by authenticated Playwright verification');
    }
  } catch (error) {
    console.warn(`Best-effort cleanup did not complete: ${message(error)}`);
  } finally {
    await closeRolePage(manager);
  }
}

async function bestEffortCancelWorkOrder(page: Page, workOrder: CreatedWorkOrder, reason: string): Promise<void> {
  try {
    await cancelWorkOrder(page, workOrder, reason);
  } catch (error) {
    console.warn(`Best-effort cleanup skipped ${workOrder.reference}: ${message(error)}`);
  }
}

async function closeRolePage(rolePage: RolePage | undefined): Promise<void> {
  try {
    await rolePage?.context.close();
  } catch (error) {
    console.warn(`Authenticated browser context cleanup failed: ${message(error)}`);
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function uniqueSuffix(testInfo: TestInfo): string {
  return createHash('sha256')
    .update(`${runSegment}-${attemptSegment}-${testInfo.workerIndex}-${testInfo.testId}-${randomBytes(3).toString('hex')}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
}

function nextReference(testInfo: TestInfo): string {
  counter += 1;
  const workerSegment = segment(String(testInfo.workerIndex), 2);
  const testSegment = createHash('sha256').update(testInfo.testId).digest('hex').slice(0, 3).toUpperCase();
  const counterSegment = segment(String(counter), 2);
  const randomSegment = randomBytes(3).toString('hex').toUpperCase();
  return `E2E-${runSegment}${attemptSegment}${workerSegment}${testSegment}${counterSegment}${randomSegment}`;
}

function segment(value: string, length: number): string {
  const numeric = Number(value);
  const compact = Number.isFinite(numeric)
    ? Math.abs(numeric).toString(36).toUpperCase()
    : value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return compact.slice(-length).padStart(length, '0');
}

async function cancelWorkOrder(page: Page, workOrder: CreatedWorkOrder, reason: string): Promise<void> {
  await page.goto(`/work-orders/${workOrder.id}`);
  const status = await page.locator('.page-head .tag').textContent();
  if (status === 'Cancelled' || status === 'Completed') return;

  await page.getByLabel('Cancellation reason').fill(reason);
  await page.getByRole('button', { name: 'Cancel work order' }).click();
  await expect(page.locator('.page-head .tag')).toHaveText('Cancelled');
}

async function newAuthenticatedPage(browser: Browser, baseURL: string | undefined, role: Role): Promise<RolePage> {
  if (!baseURL) throw new Error('Missing E2E_BASE_URL.');

  const statePath = process.env[role === 'manager'
    ? 'E2E_MANAGER_SESSION_STORAGE'
    : 'E2E_DISPATCHER_SESSION_STORAGE'];
  if (!statePath) throw new Error(`Missing ${role} Entra session storage.`);

  const storage = JSON.parse(readFileSync(resolve(statePath), 'utf8')) as Record<string, string>;
  const origin = new URL(baseURL).origin;
  const context = await browser.newContext();
  await context.addInitScript(({ expectedOrigin, entries }) => {
    if (window.location.origin === expectedOrigin) {
      for (const [key, value] of Object.entries(entries)) window.localStorage.setItem(key, value);
    }
  }, { expectedOrigin: origin, entries: storage });

  return { context, page: await context.newPage() };
}
