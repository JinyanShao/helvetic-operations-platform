#!/usr/bin/env node
/**
 * One-shot script: Run e2e screenshot tests with saved authentication
 * Prerequisites: Must have run e2e-auth-setup.js first
 * Usage: node scripts/generate-e2e-screenshots.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const WEB_DIR = path.join(__dirname, '../web');
const AUTH_DIR = path.join(WEB_DIR, '.auth');
const STORAGE_FILE = path.join(AUTH_DIR, 'dispatcher-storage.json');

async function checkAuth() {
  console.log('🔐 Checking authentication...');

  if (!fs.existsSync(STORAGE_FILE)) {
    console.error('\n❌ No saved authentication session found!');
    console.error('\nPlease run authentication setup first:');
    console.error('   node scripts/e2e-auth-setup.js\n');
    console.error('This will:');
    console.error('1. Open a browser');
    console.error('2. Let you sign in with your work account');
    console.error('3. Save the session for automated tests');
    process.exit(1);
  }

  try {
    const storage = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
    const hasMsalTokens = Object.keys(storage).some(k => k.includes('msal') && k.includes('token'));

    if (hasMsalTokens) {
      console.log('✅ Valid authentication session found');
      return true;
    } else {
      console.warn('⚠️  Session file exists but may not have valid tokens');
      console.warn('   Proceeding anyway...');
      return true;
    }
  } catch (e) {
    console.error('❌ Failed to read session:', e.message);
    process.exit(1);
  }
}

async function runScreenshots() {
  console.log('\n📸 Running e2e screenshot tests...');

  const env = {
    ...process.env,
    E2E_BASE_URL: 'http://localhost:4200',
    E2E_DISPATCHER_SESSION_STORAGE: STORAGE_FILE,
    E2E_MANAGER_SESSION_STORAGE: STORAGE_FILE,
  };

  try {
    console.log('   (this takes ~30 seconds)\n');
    const { stdout, stderr } = await execAsync(
      'npm run e2e:screenshots',
      { cwd: WEB_DIR, env, timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
    );

    console.log(stdout);
    if (stderr && !stderr.includes('Skipping')) {
      console.warn(stderr);
    }

    return true;
  } catch (e) {
    console.error('\n❌ Screenshot test failed');
    console.error('Error:', e.message);

    if (e.stderr && e.stderr.includes('Skipped')) {
      console.log('\n⚠️  Tests were skipped. This may mean:');
      console.log('1. Session authentication failed');
      console.log('2. Test data (work orders) not available');
      console.log('3. API not running (docker compose up)');
    }

    return false;
  }
}

async function commitScreenshots() {
  console.log('\n📝 Committing screenshots to git...');

  try {
    const imagePath = path.join(WEB_DIR, '../docs/images');
    if (!fs.existsSync(imagePath)) {
      console.log('ℹ️  No screenshots directory found');
      return;
    }

    const images = fs.readdirSync(imagePath)
      .filter(f => f.endsWith('.png'))
      .map(f => `docs/images/${f}`);

    if (images.length === 0) {
      console.log('ℹ️  No screenshots to commit');
      return;
    }

    // Check if git is available and we're in a repo
    await execAsync('git status', { cwd: path.join(WEB_DIR, '..') });

    // Check if images are already committed
    const { stdout: status } = await execAsync(
      `git status ${images.join(' ')}`,
      { cwd: path.join(WEB_DIR, '..') }
    );

    if (status.includes('nothing to commit')) {
      console.log('ℹ️  Screenshots already committed');
      return;
    }

    console.log(`📷 Adding ${images.length} screenshot(s) to git...`);
    await execAsync(
      `git add ${images.join(' ')}`,
      { cwd: path.join(WEB_DIR, '..') }
    );

    const { stdout: commitOutput } = await execAsync(
      'git commit -m "docs: add work order UI screenshots from e2e tests"',
      { cwd: path.join(WEB_DIR, '..') }
    );

    console.log('✅ Screenshots committed');
    console.log(commitOutput.trim());
  } catch (e) {
    if (e.message.includes('nothing to commit')) {
      console.log('ℹ️  Screenshots already up to date');
    } else {
      console.warn('⚠️  Could not commit to git:', e.message);
    }
  }
}

async function main() {
  console.log('🎬 E2E Screenshot Generation\n');

  try {
    const hasAuth = await checkAuth();
    if (!hasAuth) return;

    const success = await runScreenshots();

    if (success) {
      await commitScreenshots();
      console.log('\n✅ Complete!\n');
      console.log('Screenshots saved to:');
      console.log('  • docs/images/work-orders-list.png');
      console.log('  • docs/images/work-order-detail.png');
      console.log('  • docs/images/work-order-edit.png');
      console.log('  • docs/images/work-order-status-transition.png');
      console.log('  • docs/images/work-order-conflict-state.png\n');
    } else {
      console.log('\n⚠️  Screenshots generation incomplete.');
      console.log('\nTroubleshooting:');
      console.log('1. Make sure docker compose is running: docker compose ps');
      console.log('2. Check API is healthy: curl http://localhost:4200/api/health');
      console.log('3. Re-authenticate: node scripts/e2e-auth-setup.js');
    }
  } catch (e) {
    console.error('\n❌ Fatal error:', e.message);
    process.exit(1);
  }
}

main();
