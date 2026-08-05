const test = require('node:test');
const assert = require('node:assert/strict');

class FakeDoc {
  constructor(store, id) { this.store = store; this.id = id; }
  async get() {
    const data = this.store.get(this.id);
    return { exists: data !== undefined, data: () => data };
  }
  async set(data) { this.store.set(this.id, data); }
}

class FakeCollection {
  constructor() { this.docs = new Map(); }
  doc(id) { return new FakeDoc(this.docs, id); }
}

class FakeFirestore {
  constructor() { this.collections = new Map(); }
  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new FakeCollection());
    return this.collections.get(name);
  }
}

const { syncOnLogin, pushCloudProgress } = require('./cloud-sync.js');

test('syncOnLogin uploads local progress when no cloud doc exists yet', async () => {
  const db = new FakeFirestore();
  const local = { '1': { failCount: 1, pendingReview: true } };
  const result = await syncOnLogin(db, 'uid1', local);
  assert.deepEqual(result, local);
  const stored = await db.collection('users').doc('uid1').get();
  assert.deepEqual(stored.data().progress, local);
});

test('syncOnLogin downloads cloud progress when a doc already exists', async () => {
  const db = new FakeFirestore();
  const cloudProgress = { '5': { failCount: 3, pendingReview: false } };
  await db.collection('users').doc('uid1').set({ progress: cloudProgress });
  const local = { '1': { failCount: 1, pendingReview: true } };
  const result = await syncOnLogin(db, 'uid1', local);
  assert.deepEqual(result, cloudProgress);
});

test('pushCloudProgress writes the progress object under the user doc', async () => {
  const db = new FakeFirestore();
  await pushCloudProgress(db, 'uid1', { '2': { failCount: 1, pendingReview: true } });
  const stored = await db.collection('users').doc('uid1').get();
  assert.deepEqual(stored.data().progress, { '2': { failCount: 1, pendingReview: true } });
});
