#!/usr/bin/env node
/**
 * Capture real 409 conflict screenshot
 * User performs concurrent edit in two tabs, triggers conflict, we screenshot the result
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const IMAGES_DIR = path.join(__dirname, '../docs/images');

async function captureConflictScreenshot() {
  console.log('🎬 Conflict State Screenshot Capture\n');
  console.log('Instructions:');
  console.log('1. Open TWO browser tabs with the SAME Work Order URL');
  console.log('2. In Tab A: edit a field and SAVE');
  console.log('3. In Tab B: edit the SAME field and SAVE (with old version)');
  console.log('4. You should see a 409 Conflict error or reload guidance in Tab B');
  console.log('5. Take a screenshot of that error state manually');
  console.log('6. Press ENTER when done\n');

  // Wait for user to complete the conflict scenario
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });

  console.log('\n📸 Capture conflict screenshot and save as:');
  console.log(`   ${path.join(IMAGES_DIR, 'work-order-conflict-state.png')}\n`);

  console.log('Waiting for you to save the conflict screenshot...');
  console.log('Press ENTER again when saved\n');

  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });

  // Check if screenshot was saved
  const conflictPath = path.join(IMAGES_DIR, 'work-order-conflict-state.png');
  if (!fs.existsSync(conflictPath)) {
    console.error('❌ Screenshot file not found at:', conflictPath);
    console.error('Please save the screenshot to that location');
    return false;
  }

  const stats = fs.statSync(conflictPath);
  console.log(`\n✅ Screenshot captured: ${(stats.size / 1024).toFixed(1)} KB\n`);
  return true;
}

async function commitAndPush() {
  console.log('📝 Committing to git...');

  try {
    await execAsync(
      'git add docs/images/work-order-conflict-state.png',
      { cwd: path.join(__dirname, '..') }
    );

    await execAsync(
      'git commit -m "docs: replace conflict state screenshot with real 409 error"',
      { cwd: path.join(__dirname, '..') }
    );

    console.log('✅ Committed to git');

    console.log('📤 Pushing to GitHub...');
    await execAsync('git push origin main', { cwd: path.join(__dirname, '..') });
    console.log('✅ Pushed to GitHub\n');

  } catch (e) {
    console.error('❌ Error:', e.message);
    return false;
  }

  return true;
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  const success = await captureConflictScreenshot();

  if (success) {
    await commitAndPush();
    console.log('🎉 Conflict screenshot updated and pushed!\n');
  } else {
    console.error('\n⚠️  Screenshot capture failed');
    process.exit(1);
  }
}

main();
