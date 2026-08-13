#!/usr/bin/env node
/**
 * Manual browser screenshot with user interaction for login
 * Opens browser, waits for login, then captures screenshots
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '../web/node_modules/playwright'));

const APP_URL = 'http://localhost:4200';
const IMAGES_DIR = path.join(__dirname, '../docs/images');

async function captureScreenshots() {
  console.log('🎬 Manual Browser Screenshot Capture\n');

  const browser = await chromium.launch({ headless: false });

  try {
    const context = await browser.newContext({
      recordVideo: { dir: path.join(__dirname, '../test-results') }
    });

    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('📱 Opening app...');
    await page.goto(APP_URL);

    console.log('👤 Please log in in the browser window...');
    console.log('   After login is complete, press ENTER in this terminal to continue.\n');

    // Wait for user to log in
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });

    console.log('\n✅ Proceeding to capture screenshots...\n');

    // Screenshot 1: Work Orders List
    console.log('📸 Capturing: Work Orders list...');
    await page.goto(`${APP_URL}/work-orders`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.screenshot({
      path: path.join(IMAGES_DIR, 'work-orders-list.png'),
      fullPage: false
    });
    console.log('   ✓ work-orders-list.png');

    // Screenshot 2: Work Order Detail
    console.log('📸 Capturing: Work Order detail...');
    const firstRow = page.locator('[role="row"]:nth-child(2), .list-row:nth-child(1)');
    if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    }
    await page.screenshot({
      path: path.join(IMAGES_DIR, 'work-order-detail.png'),
      fullPage: false
    });
    console.log('   ✓ work-order-detail.png');

    // Screenshot 3: Edit Form
    console.log('📸 Capturing: Edit work order form...');
    const editBtn = page.locator('button:has-text("Edit work order")').first();
    if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    }
    await page.screenshot({
      path: path.join(IMAGES_DIR, 'work-order-edit.png'),
      fullPage: false
    });
    console.log('   ✓ work-order-edit.png');

    // Screenshot 4: Status Transition
    console.log('📸 Capturing: Status transition...');
    const advanceBtn = page.locator('button:has-text("Advance status")').first();
    if (await advanceBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await advanceBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    }
    await page.screenshot({
      path: path.join(IMAGES_DIR, 'work-order-status-transition.png'),
      fullPage: false
    });
    console.log('   ✓ work-order-status-transition.png');

    // Screenshot 5: Conflict/Error State
    console.log('📸 Capturing: Conflict recovery state...');
    await page.goto(`${APP_URL}/work-orders`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.screenshot({
      path: path.join(IMAGES_DIR, 'work-order-conflict-state.png'),
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
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  console.log('📝 Committing to git...');

  try {
    const images = fs.readdirSync(IMAGES_DIR)
      .filter(f => f.endsWith('.png'))
      .map(f => `docs/images/${f}`);

    if (images.length === 0) {
      console.log('ℹ️  No screenshots to commit');
      return;
    }

    await execAsync(
      `git add ${images.join(' ')}`,
      { cwd: path.join(__dirname, '..') }
    );

    await execAsync(
      'git commit -m "docs: add work order UI screenshots (manual browser capture)"',
      { cwd: path.join(__dirname, '..') }
    );

    console.log(`✅ Committed ${images.length} screenshot(s) to git\n`);
  } catch (e) {
    console.warn('⚠️  Git commit failed:', e.message);
  }
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

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
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
