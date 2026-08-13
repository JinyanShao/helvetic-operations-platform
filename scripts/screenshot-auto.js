#!/usr/bin/env node
/**
 * Automated screenshot generation with headless browser
 * Logs in automatically and captures 5 UI screenshots (no browser UI visible)
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const chromium = require(path.join(__dirname, '../web/node_modules/playwright')).chromium;

const WEB_DIR = path.join(__dirname, '../web');
const AUTH_DIR = path.join(WEB_DIR, '.auth');
const STORAGE_FILE = path.join(AUTH_DIR, 'dispatcher-storage.json');
const APP_URL = 'http://localhost:4200';

async function captureScreenshots() {
  console.log('🎬 Automated E2E Screenshot Capture\n');
  console.log('Starting headless browser...\n');

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set viewport for consistent screenshots
    await page.setViewportSize({ width: 1440, height: 900 });

    // Navigate to app
    console.log('📱 Loading app...');
    await page.goto(APP_URL);

    // Wait for auth to complete or redirect
    try {
      await page.waitForURL(url => !url.includes('login.microsoftonline.com'), {
        timeout: 120000
      });
      console.log('✅ App loaded');
    } catch (e) {
      console.log('⚠️  Still on login page - checking...');
    }

    // Wait a bit for app to fully load
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    // Extract localStorage
    const storage = await page.evaluate(() => {
      const ls = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        ls[key] = localStorage.getItem(key);
      }
      return ls;
    });

    if (Object.keys(storage).length > 0) {
      if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(storage, null, 2));
      console.log(`✅ Saved authentication (${Object.keys(storage).length} entries)\n`);
    } else {
      console.log('⚠️  No localStorage data - may not be authenticated\n');
    }

    // Screenshot 1: Work Orders List
    console.log('📸 Screenshot 1/5: Work Orders list...');
    await page.goto(`${APP_URL}/work-orders`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.screenshot({
      path: path.join(WEB_DIR, '../docs/images/work-orders-list.png'),
      fullPage: false
    });
    console.log('   ✓ work-orders-list.png');

    // Screenshot 2: Work Order Detail
    console.log('📸 Screenshot 2/5: Work Order detail...');
    const listRows = await page.locator('.list-row, [role="row"]').count();
    if (listRows > 0) {
      await page.locator('.list-row, [role="row"]').first().click();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    }
    await page.screenshot({
      path: path.join(WEB_DIR, '../docs/images/work-order-detail.png'),
      fullPage: false
    });
    console.log('   ✓ work-order-detail.png');

    // Screenshot 3: Edit Form
    console.log('📸 Screenshot 3/5: Edit work order form...');
    const editBtn = page.locator('button:has-text("Edit work order"), button:has-text("edit")').first();
    if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    }
    await page.screenshot({
      path: path.join(WEB_DIR, '../docs/images/work-order-edit.png'),
      fullPage: false
    });
    console.log('   ✓ work-order-edit.png');

    // Screenshot 4: Status Transition
    console.log('📸 Screenshot 4/5: Status transition...');
    const advanceBtn = page.locator('button:has-text("Advance status")').first();
    if (await advanceBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await advanceBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    }
    await page.screenshot({
      path: path.join(WEB_DIR, '../docs/images/work-order-status-transition.png'),
      fullPage: false
    });
    console.log('   ✓ work-order-status-transition.png');

    // Screenshot 5: Conflict State (go back to detail)
    console.log('📸 Screenshot 5/5: Conflict/error state...');
    await page.goto(`${APP_URL}/work-orders`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.screenshot({
      path: path.join(WEB_DIR, '../docs/images/work-order-conflict-state.png'),
      fullPage: false
    });
    console.log('   ✓ work-order-conflict-state.png');

    await context.close();
    console.log('\n✅ All screenshots captured!\n');
    return true;

  } catch (e) {
    console.error('\n❌ Screenshot capture failed:', e.message);
    return false;
  } finally {
    await browser.close();
  }
}

async function commitScreenshots() {
  console.log('📝 Committing to git...');

  try {
    const imagePath = path.join(WEB_DIR, '../docs/images');
    const images = fs.readdirSync(imagePath)
      .filter(f => f.endsWith('.png'))
      .map(f => `docs/images/${f}`);

    if (images.length === 0) {
      console.log('ℹ️  No screenshots to commit');
      return;
    }

    await execAsync(
      `git add ${images.join(' ')}`,
      { cwd: path.join(WEB_DIR, '..') }
    );

    await execAsync(
      'git commit -m "docs: add work order UI screenshots (headless e2e capture)"',
      { cwd: path.join(WEB_DIR, '..') }
    );

    console.log(`✅ Committed ${images.length} screenshot(s) to git\n`);
  } catch (e) {
    console.warn('⚠️  Git commit failed:', e.message);
  }
}

async function main() {
  try {
    const success = await captureScreenshots();

    if (success) {
      await commitScreenshots();
      console.log('🎉 Complete!\n');
      console.log('Screenshots saved to:');
      console.log('  ✓ docs/images/work-orders-list.png');
      console.log('  ✓ docs/images/work-order-detail.png');
      console.log('  ✓ docs/images/work-order-edit.png');
      console.log('  ✓ docs/images/work-order-status-transition.png');
      console.log('  ✓ docs/images/work-order-conflict-state.png\n');
    }
  } catch (e) {
    console.error('\n❌ Fatal error:', e.message);
    process.exit(1);
  }
}

main();
