const test = require('node:test');
const assert = require('node:assert/strict');

class FakeLocalStorage {
  constructor() { this.store = {}; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; }
  setItem(key, value) { this.store[key] = String(value); }
  clear() { this.store = {}; }
}

global.localStorage = new FakeLocalStorage();
const {
  getProgress,
  saveProgress,
  updateProgress,
  getPendingReviewIds,
  getRevisionEntries,
  PROGRESS_KEY
} = require('./progress.js');

test.beforeEach(() => { global.localStorage.clear(); });

test('getProgress returns {} when nothing stored', () => {
  assert.deepEqual(getProgress(), {});
});

test('getProgress returns {} when stored value is corrupt JSON', () => {
  global.localStorage.setItem(PROGRESS_KEY, '{not-json');
  assert.deepEqual(getProgress(), {});
});

test('saveProgress persists and getProgress reads it back', () => {
  saveProgress({ '5': { failCount: 1, pendingReview: true } });
  assert.deepEqual(getProgress(), { '5': { failCount: 1, pendingReview: true } });
});

test('updateProgress on first failure creates entry with failCount 1', () => {
  const progress = updateProgress(3, false);
  assert.deepEqual(progress['3'], { failCount: 1, pendingReview: true });
});

test('updateProgress increments failCount on repeated failure', () => {
  updateProgress(3, false);
  const progress = updateProgress(3, false);
  assert.deepEqual(progress['3'], { failCount: 2, pendingReview: true });
});

test('updateProgress correct answer on pending question clears pendingReview but keeps failCount', () => {
  updateProgress(3, false);
  const progress = updateProgress(3, true);
  assert.deepEqual(progress['3'], { failCount: 1, pendingReview: false });
});

test('updateProgress correct answer on never-failed question creates no entry', () => {
  const progress = updateProgress(9, true);
  assert.equal(progress['9'], undefined);
});

test('updateProgress correct answer on already-cleared question is a no-op', () => {
  updateProgress(3, false);
  updateProgress(3, true);
  const before = JSON.stringify(getProgress());
  updateProgress(3, true);
  assert.equal(JSON.stringify(getProgress()), before);
});

test('getPendingReviewIds returns only ids with pendingReview true', () => {
  const progress = {
    '1': { failCount: 1, pendingReview: true },
    '2': { failCount: 2, pendingReview: false },
    '3': { failCount: 1, pendingReview: true }
  };
  assert.deepEqual(getPendingReviewIds(progress).sort(), [1, 3]);
});

test('getRevisionEntries returns all failed ids sorted by failCount desc', () => {
  const progress = {
    '1': { failCount: 1, pendingReview: false },
    '2': { failCount: 5, pendingReview: true },
    '3': { failCount: 3, pendingReview: false }
  };
  assert.deepEqual(getRevisionEntries(progress), [
    { id: 2, failCount: 5 },
    { id: 3, failCount: 3 },
    { id: 1, failCount: 1 }
  ]);
});
