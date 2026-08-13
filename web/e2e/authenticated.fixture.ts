import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

type Role = 'dispatcher' | 'manager';
type Fixtures = { authenticatedPage: Page };

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ browser, baseURL }, use, testInfo) => {
    const role: Role = testInfo.titlePath.includes('Manager cancellation') ? 'manager' : 'dispatcher';
    const statePath = process.env[role === 'manager'
      ? 'E2E_MANAGER_SESSION_STORAGE'
      : 'E2E_DISPATCHER_SESSION_STORAGE'];
    if (!statePath || !baseURL) throw new Error(`Missing ${role} Entra session storage or E2E_BASE_URL.`);

    const storage = JSON.parse(readFileSync(resolve(statePath), 'utf8')) as Record<string, string>;
    const origin = new URL(baseURL).origin;
    const context = await browser.newContext();
    await context.addInitScript(({ expectedOrigin, entries }) => {
      if (window.location.origin === expectedOrigin) {
        for (const [key, value] of Object.entries(entries)) window.localStorage.setItem(key, value);
      }
    }, { expectedOrigin: origin, entries: storage });

    const page = await context.newPage();
    await use(page);
    await context.close();
  }
});

export { expect };

export function missingEnvironment(role: Role, keys: string[]): string | undefined {
  const sessionKey = role === 'manager' ? 'E2E_MANAGER_SESSION_STORAGE' : 'E2E_DISPATCHER_SESSION_STORAGE';
  const missing = ['E2E_BASE_URL', sessionKey, ...keys].filter(key => !process.env[key]);
  return missing.length
    ? `Authenticated Entra E2E is skipped because these test-environment values are unavailable: ${missing.join(', ')}.`
    : undefined;
}
