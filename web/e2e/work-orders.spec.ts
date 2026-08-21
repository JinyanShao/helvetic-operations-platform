import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, missingEnvironment } from './authenticated.fixture';
import type { Browser, BrowserContext, Page } from '@playwright/test';

type Role = 'dispatcher' | 'manager';
type CreatedWorkOrder = { id: string; reference: string; site: string };
type RolePage = { context: BrowserContext; page: Page };

const requiredEnvironment = [
  missingEnvironment('dispatcher', []),
  missingEnvironment('manager', [])
].filter(Boolean).join(' ');

const runToken = (process.env['GITHUB_RUN_ID'] ?? Date.now().toString(36)).slice(-8).toUpperCase();
let counter = 0;

test.describe('Authenticated Work Order workflow', () => {
  test.skip(Boolean(requiredEnvironment), requiredEnvironment);

  test('opens the authenticated Work Order list', async ({ authenticatedPage: page, browser, baseURL }, testInfo) => {
    const created = await createWorkOrder(page, testInfo.title);
    try {
      await page.goto('/work-orders');
      await expect(page.getByRole('heading', { name: 'Work order register' })).toBeVisible();
      await expect(page.getByText(created.reference)).toBeVisible();
    } finally {
      await cleanupWorkOrders(browser, baseURL, [created]);
    }
  });

  test('filters Work Orders using provisioned data', async ({ authenticatedPage: page, browser, baseURL }, testInfo) => {
    const first = await createWorkOrder(page, `${testInfo.title} first`);
    const second = await createWorkOrder(page, `${testInfo.title} second`);
    try {
      await page.goto('/work-orders');
      await page.getByLabel('Status').selectOption('Planned');
      await page.getByLabel('Site').fill(first.site);
      await page.getByRole('button', { name: 'Apply filters' }).click();
      await expect(page).toHaveURL(/status=Planned/);
      await expect(page.getByText(first.reference)).toBeVisible();
      await expect(page.getByText(second.reference)).not.toBeVisible();
    } finally {
      await cleanupWorkOrders(browser, baseURL, [first, second]);
    }
  });

  test('navigates from the list to Work Order detail', async ({ authenticatedPage: page, browser, baseURL }, testInfo) => {
    const created = await createWorkOrder(page, testInfo.title);
    try {
      await page.goto(`/work-orders?site=${encodeURIComponent(created.site)}`);
      await page.getByText(created.reference).click();
      await expect(page).toHaveURL(new RegExp(`/work-orders/${created.id}$`, 'i'));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    } finally {
      await cleanupWorkOrders(browser, baseURL, [created]);
    }
  });

  test('creates a Work Order', async ({ authenticatedPage: page, browser, baseURL }, testInfo) => {
    const created = await createWorkOrder(page, testInfo.title);
    try {
      await expect(page).toHaveURL(new RegExp(`/work-orders/${created.id}$`, 'i'));
      await expect(page.getByText(created.reference)).toBeVisible();
    } finally {
      await cleanupWorkOrders(browser, baseURL, [created]);
    }
  });

  test('edits a Work Order', async ({ authenticatedPage: page, browser, baseURL }, testInfo) => {
    const created = await createWorkOrder(page, testInfo.title);
    try {
      await page.goto(`/work-orders/${created.id}`);
      await page.getByRole('button', { name: 'Edit work order' }).click();
      await page.getByLabel('Summary').fill(`E2E edited ${created.reference}`);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('heading', { name: `E2E edited ${created.reference}` })).toBeVisible();
    } finally {
      await cleanupWorkOrders(browser, baseURL, [created]);
    }
  });

  test('advances a Work Order status', async ({ authenticatedPage: page, browser, baseURL }, testInfo) => {
    const created = await createWorkOrder(page, testInfo.title);
    try {
      await page.goto(`/work-orders/${created.id}`);
      const target = await page.getByLabel('Next status').inputValue();
      await page.getByLabel('Assignee').fill('Playwright Dispatcher');
      await page.getByRole('button', { name: 'Advance status' }).click();
      await expect(page.locator('.page-head .tag')).toHaveText(target);
    } finally {
      await cleanupWorkOrders(browser, baseURL, [created]);
    }
  });

  test('shows conflict recovery after a stale update', async ({ authenticatedPage: first, browser, baseURL }, testInfo) => {
    const created = await createWorkOrder(first, testInfo.title);
    const second = await first.context().newPage();
    try {
      await first.goto(`/work-orders/${created.id}`);
      await second.goto(`/work-orders/${created.id}`);
      await first.getByRole('button', { name: 'Edit work order' }).click();
      await second.getByRole('button', { name: 'Edit work order' }).click();
      await first.getByLabel('Summary').fill(`First concurrent ${created.reference}`);
      await first.getByRole('button', { name: 'Save changes' }).click();
      await expect(first.getByRole('heading', { name: `First concurrent ${created.reference}` })).toBeVisible();
      await second.getByLabel('Summary').fill(`Stale concurrent ${created.reference}`);
      await second.getByRole('button', { name: 'Save changes' }).click();
      await expect(second.getByRole('alert')).toContainText('changed elsewhere');
      await second.getByRole('button', { name: 'Reload' }).click();
      await expect(second.getByRole('heading', { name: `First concurrent ${created.reference}` })).toBeVisible();
    } finally {
      await second.close();
      await cleanupWorkOrders(browser, baseURL, [created]);
    }
  });
});

test.describe('Manager cancellation', () => {
  test.skip(Boolean(requiredEnvironment), requiredEnvironment);

  test('cancels a provisioned Work Order with a required reason', async ({ browser, baseURL }) => {
    const manager = await newAuthenticatedPage(browser, baseURL, 'manager');
    const created = await createWorkOrder(manager.page, 'manager cancellation');
    try {
      await cancelWorkOrder(manager.page, created, 'Cancelled by authenticated Playwright verification');
      await expect(manager.page.locator('.page-head .tag')).toHaveText('Cancelled');
    } finally {
      await manager.context.close();
    }
  });
});

async function createWorkOrder(page: Page, label: string): Promise<CreatedWorkOrder> {
  const reference = nextReference();
  const site = `E2E Site ${reference}`;

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

  const manager = await newAuthenticatedPage(browser, baseURL, 'manager');
  try {
    for (const workOrder of workOrders) {
      await cancelWorkOrder(manager.page, workOrder, 'Cleaned up by authenticated Playwright verification');
    }
  } finally {
    await manager.context.close();
  }
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

function nextReference(): string {
  counter += 1;
  return `E2E-${runToken}-${counter.toString(36).toUpperCase()}`;
}
