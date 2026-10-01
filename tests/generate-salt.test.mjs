import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSalt } from '../tools/generate-salt.mjs';

test('generates six-character identifiers with an alphabetic first character', async () => {
  const existing = new Set(['YVrMNb', 'qYz22e', 'j6EFJ3']);
  for (let i = 0; i < 10000; i++) {
    const salt = await generateSalt({ existing, isTaken: async () => false });
    assert.match(salt, /^[A-Za-z][A-Za-z0-9]{5}$/);
    assert.equal(existing.has(salt), false);
    existing.add(salt);
  }
});

test('retries a database collision without modifying the caller collection', async () => {
  let checks = 0;
  const existing = new Set();
  assert.match(await generateSalt({ existing, isTaken: async () => ++checks < 3 }), /^[A-Za-z][A-Za-z0-9]{5}$/);
  assert.equal(checks, 3);
  assert.equal(existing.size, 0);
});

test('fails after bounded retries instead of looping indefinitely', async () => {
  let checks = 0;
  await assert.rejects(generateSalt({ isTaken: async () => { checks++; return true; } }), /1000 attempts/);
  assert.equal(checks, 1000);
});

test('does not return an unchecked salt when the database is unavailable', async () => {
  await assert.rejects(generateSalt({ isTaken: async () => { throw new Error('offline'); } }), /offline/);
});
