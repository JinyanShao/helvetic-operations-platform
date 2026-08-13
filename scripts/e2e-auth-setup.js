#!/usr/bin/env node
/**
 * Pre-requisite: Authenticate and save session for e2e tests
 * This runs a Playwright test that logs in and saves the session to localStorage format
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '../web/node_modules/playwright'));

const WEB_DIR = path.join(__dirname, '../web');
const AUTH_DIR = path.join(WEB_DIR, '.auth');
const STORAGE_FILE = path.join(AUTH_DIR, 'dispatcher-storage.json');
const APP_URL = 'http://localhost:4200';

async function saveLocalStorageAsSessionFile(context) {
  // Get localStorage from the page
  const page = await context.newPage();
  await page.goto(APP_URL);

  const storage = await page.evaluate(() => {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      ls[key] = localStorage.getItem(key);
    }
    return ls;
  });

  await page.close();
  return storage;
}

async function authenticate() {
  console.log('🔐 Setting up E2E authentication...\n');
  console.log('Starting Playwright browser for login...');

  const browser = await chromium.launch({ headless: false });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('📱 Browser opened. Navigate to http://localhost:4200');
    console.log('   Sign in with your work account.');
    console.log('   The browser will close automatically after successful login.\n');

    // Navigate to app
    await page.goto(APP_URL);

    // Wait for successful login indicators
    // Either see the dashboard or the work-orders page
    try {
      await page.waitForURL(url => !url.includes('login.microsoftonline.com'), { timeout: 300000 });
      console.log('✅ Login detected, waiting for app to load...');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    } catch (e) {
      console.log('⚠️  Timeout waiting for login. Checking app state...');
    }

    // Check if authenticated (wait for authenticated content)
    try {
      await page.waitForSelector('app-root', { timeout: 5000 });
      console.log('✅ App loaded, extracting session...');
    } catch (e) {
      console.warn('⚠️  App selector not found');
    }

    // Extract and save localStorage
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const storage = await saveLocalStorageAsSessionFile(context);

    if (Object.keys(storage).length > 0) {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(storage, null, 2));
      console.log(`\n✅ Session saved to ${STORAGE_FILE}`);
      console.log(`   Stored ${Object.keys(storage).length} localStorage entries`);

      // Also save Playwright context for reference
      const authFile = path.join(AUTH_DIR, 'dispatcher.json');
      await context.storageState({ path: authFile });
      console.log(`✅ Context saved to ${authFile}`);

      await context.close();
      return true;
    } else {
      console.log('⚠️  No localStorage data found. Login may have failed.');
      await context.close();
      return false;
    }
  } catch (e) {
    console.error('❌ Error during authentication:', e.message);
    return false;
  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    const success = await authenticate();

    if (success) {
      console.log('\n✅ Authentication setup complete!');
      console.log('\nNext step: Run the screenshot generator');
      console.log('   node scripts/generate-e2e-screenshots.js');
      process.exit(0);
    } else {
      console.error('\n❌ Authentication failed. Please try again.');
      process.exit(1);
    }
  } catch (e) {
    console.error('\n❌ Fatal error:', e.message);
    process.exit(1);
  }
}

main();
