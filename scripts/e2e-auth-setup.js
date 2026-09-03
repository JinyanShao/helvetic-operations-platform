#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '../web/node_modules/playwright'));

const ROLES = new Set(['dispatcher', 'manager']);
const REQUIRED_APP_ROLES = {
  dispatcher: 'Operations.Dispatcher',
  manager: 'Operations.Manager'
};
const WEB_DIR = path.join(__dirname, '../web');
const AUTH_DIR = path.join(WEB_DIR, '.auth');
const DEFAULT_APP_URL = 'http://localhost:4200';

function usage() {
  console.error('Usage: node scripts/e2e-auth-setup.js <dispatcher|manager> [app-url]');
  console.error('');
  console.error('Examples:');
  console.error('  node scripts/e2e-auth-setup.js dispatcher');
  console.error('  node scripts/e2e-auth-setup.js manager http://localhost:4200');
}

function parseArgs(argv) {
  const role = argv[2]?.toLowerCase();
  const appUrl = argv[3] ?? process.env.E2E_BASE_URL ?? DEFAULT_APP_URL;

  if (!role || !ROLES.has(role)) {
    usage();
    process.exitCode = 2;
    return undefined;
  }

  return { role, appUrl };
}

function outputPath(role) {
  return path.join(AUTH_DIR, `${role}-storage.json`);
}

async function extractLocalStorage(page, appUrl) {
  const origin = new URL(appUrl).origin;
  if (new URL(page.url()).origin !== origin) {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
  }

  return page.evaluate(() => {
    const entries = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key) entries[key] = localStorage.getItem(key);
    }
    return entries;
  });
}

function hasMsalSession(storage) {
  return Object.keys(storage).some(key => key.toLowerCase().includes('msal') && key.toLowerCase() !== 'msal.version');
}

function rolesFromStorage(storage) {
  const roles = new Set();
  for (const value of collectStrings(storage)) {
    if (!isJwt(value)) continue;
    const payload = parseJwtPayload(value);
    if (!payload || !Array.isArray(payload.roles)) continue;
    for (const role of payload.roles) {
      if (typeof role === 'string') roles.add(role);
    }
  }

  return roles;
}

function collectStrings(value, results = []) {
  if (typeof value === 'string') {
    results.push(value);
    try {
      collectStrings(JSON.parse(value), results);
    } catch {
      // Most localStorage values are opaque strings.
    }
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, results);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, results);
  }

  return results;
}

function isJwt(value) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function parseJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return undefined;
  }
}

async function waitForAuthenticatedApp(page, appUrl) {
  const origin = new URL(appUrl).origin;
  await page.goto(`${origin}/work-orders`, { waitUntil: 'domcontentloaded' });
  console.log(`Browser opened at ${appUrl}. Complete Microsoft Entra sign-in for this role.`);

  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    if (new URL(page.url()).origin === origin) {
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      const heading = page.getByRole('heading', { name: 'Work order register' });
      if (await heading.isVisible({ timeout: 1000 }).catch(() => false)) return;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error('Timed out waiting for the authenticated Work Orders page.');
}

async function authenticate({ role, appUrl }) {
  const destination = outputPath(role);
  const browser = await chromium.launch({ headless: false });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`Setting up ${role} E2E session.`);
    console.log('Use the real Microsoft Entra account assigned to this role.');
    console.log('No tokens, cookies, or localStorage values will be printed.');

    await waitForAuthenticatedApp(page, appUrl);
    const storage = await extractLocalStorage(page, appUrl);

    if (!hasMsalSession(storage)) {
      throw new Error('Authenticated MSAL localStorage entries were not found. The session was not saved.');
    }

    const requiredRole = REQUIRED_APP_ROLES[role];
    if (!rolesFromStorage(storage).has(requiredRole)) {
      throw new Error(`${capitalize(role)} session is missing required app role ${requiredRole}. Sign in with the correct test identity or update the Entra app role assignment.`);
    }

    fs.mkdirSync(AUTH_DIR, { recursive: true });
    fs.writeFileSync(destination, `${JSON.stringify(storage, null, 2)}\n`, { mode: 0o600 });

    console.log(`${capitalize(role)} session generated successfully.`);
    console.log(`Saved localStorage session map to ${destination}`);
    console.log('Keep this file local. It is ignored by Git and must not be committed.');

    await context.close();
  } finally {
    await browser.close();
  }
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args) return;

  try {
    await authenticate(args);
  } catch (error) {
    console.error(`Authentication setup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main();
