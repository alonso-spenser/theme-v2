import { randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CHARACTERS = LETTERS + '0123456789';
const run = promisify(execFile);

async function databaseContainsSalt(salt) {
  try {
    const { stdout } = await run('python3', [
      fileURLToPath(new URL('./salt-exists.py', import.meta.url)), salt
    ], { timeout: 20000 });
    const result = stdout.trim();
    if (result !== '0' && result !== '1') throw new Error('Invalid database response');
    return result === '1';
  } catch {
    // Fail closed. Never leak configuration, credentials, or subprocess output.
    throw new Error('Database salt check failed; no salt generated. Check MySQL and THEME_DB_CONFIG.');
  }
}

/** Component identifier, not a password or cryptographic salt.
 * Checks mall.theme_section using its own collation. The caller owns persistence;
 * an insert-time unique constraint is still required for concurrent writers.
 * isTaken is an asynchronous database adapter (injectable for tests).
 */
export async function generateSalt({ existing = new Set(), isTaken = databaseContainsSalt } = {}) {
  const local = new Set([...existing].map(value => value.toLowerCase()));
  for (let attempt = 0; attempt < 1000; attempt++) {
    let salt = LETTERS[randomInt(LETTERS.length)];
    for (let i = 1; i < 6; i++) salt += CHARACTERS[randomInt(CHARACTERS.length)];
    if (!local.has(salt.toLowerCase()) && !await isTaken(salt)) return salt;
  }
  throw new Error('Unable to generate an unused component salt after 1000 attempts.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rawCount = process.argv[2] ?? '1';
    const count = Number(rawCount);
    if (!/^\d+$/.test(rawCount) || !Number.isInteger(count) || count < 1 || count > 10000) {
      throw new Error('Usage: node tools/generate-salt.mjs [count: 1–10000]');
    }
    const catalog = JSON.parse(await readFile(new URL('../section/catalog.json', import.meta.url), 'utf8'));
    const existing = new Set(catalog.components.map(component => component.salt));
    const salts = [];
    for (let i = 0; i < count; i++) {
      const salt = await generateSalt({ existing });
      existing.add(salt);
      salts.push(salt);
    }
    console.log(salts.join('\n'));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
