import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The app reads policy.json once a day to tell people, in the app, that the
// privacy policy or terms changed. It must name the newest "Last updated".
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

function lastUpdated(page) {
  const m = read(page).match(/Last updated (\d{1,2}) (\w+) (\d{4})/);
  assert.ok(m, `${page} has a Last updated date`);
  const month = String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0');
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
}

test('policy.json names the newest Last updated date and what changed', () => {
  const policy = JSON.parse(read('policy.json'));
  assert.match(policy.updated, /^\d{4}-\d{2}-\d{2}$/);
  const newest = [lastUpdated('privacy/index.html'), lastUpdated('terms/index.html')].sort().at(-1);
  assert.equal(policy.updated, newest);
  assert.equal(typeof policy.change, 'string');
  assert.ok(policy.change.trim().length > 0 && policy.change.length <= 300);
});
