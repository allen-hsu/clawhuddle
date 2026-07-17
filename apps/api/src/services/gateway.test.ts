import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { reconcileAuthProfileStore } from './gateway.js';

/**
 * The failure this guards is silent: OpenClaw's importer skips a profile id it
 * already holds, so a key replaced in the UI never reaches the gateway and it
 * keeps serving the old credential with no error anywhere.
 */

const ORG = 'org-1';
const USER = 'user-1';
let dataDir: string;

const agentDir = () => path.join(dataDir, 'gateways', ORG, USER, 'agents', 'main', 'agent');
const storePath = () => path.join(agentDir(), 'openclaw-agent.sqlite');
const fingerprintPath = () => path.join(agentDir(), '.clawhuddle-auth-fingerprints.json');

/** Creates the agent database with the one table reconcile touches. */
function createStore(profiles: Record<string, unknown> | null): void {
  fs.mkdirSync(agentDir(), { recursive: true });
  const db = new Database(storePath());
  db.exec('CREATE TABLE auth_profile_store (store_key TEXT PRIMARY KEY, store_json TEXT)');
  if (profiles !== null) {
    db.prepare('INSERT INTO auth_profile_store (store_key, store_json) VALUES (?, ?)').run(
      'primary',
      JSON.stringify({ version: 1, profiles }),
    );
  }
  db.close();
}

/** Replaces the stored profiles, standing in for what the gateway itself wrote. */
function writeStore(profiles: Record<string, unknown>): void {
  const db = new Database(storePath());
  db.prepare("UPDATE auth_profile_store SET store_json = ? WHERE store_key = 'primary'").run(
    JSON.stringify({ version: 1, profiles }),
  );
  db.close();
}

function readStore(): Record<string, any> {
  const db = new Database(storePath());
  const row = db
    .prepare("SELECT store_json FROM auth_profile_store WHERE store_key = 'primary'")
    .get() as { store_json: string };
  db.close();
  return JSON.parse(row.store_json).profiles;
}

const oauth = (over: Record<string, unknown> = {}) => ({
  type: 'oauth',
  provider: 'openai',
  access: 'access-original',
  refresh: 'refresh-original',
  expires: 1784000000000,
  ...over,
});

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawhuddle-test-'));
  process.env.DATA_DIR = dataDir;
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  vi.restoreAllMocks();
});

describe('reconcileAuthProfileStore', () => {
  it('drops a profile whose source credential was replaced, so the importer re-adds it', () => {
    createStore({ 'openai:oauth': oauth() });
    // First reconcile only records what the importer already has.
    reconcileAuthProfileStore(ORG, USER, { 'openai:oauth': oauth() }, { 'openai:oauth': 'fp-a' });
    expect(readStore()['openai:oauth']).toBeDefined();

    // Operator pastes a new auth.json -> different fingerprint.
    reconcileAuthProfileStore(ORG, USER, { 'openai:oauth': oauth() }, { 'openai:oauth': 'fp-b' });

    expect(readStore()['openai:oauth']).toBeUndefined();
  });

  it('keeps a refreshed OAuth credential when the source key is unchanged', () => {
    // The gateway writes refreshed tokens back under the same id, and OpenAI
    // rotates the refresh token as it does — so the store being newer than our
    // file is normal, and re-importing would restore a dead token.
    createStore({ 'openai:oauth': oauth() });
    reconcileAuthProfileStore(ORG, USER, { 'openai:oauth': oauth() }, { 'openai:oauth': 'fp-a' });

    writeStore({ 'openai:oauth': oauth({ access: 'access-refreshed', refresh: 'refresh-rotated' }) });
    reconcileAuthProfileStore(ORG, USER, { 'openai:oauth': oauth() }, { 'openai:oauth': 'fp-a' });

    expect(readStore()['openai:oauth'].refresh).toBe('refresh-rotated');
  });

  it('keeps the credential when no fingerprint was ever recorded', () => {
    // First run after this shipped: we cannot tell a replaced key from a
    // refreshed one, so leave the gateway alone rather than risk a rewind.
    createStore({ 'openai:oauth': oauth({ refresh: 'refresh-rotated' }) });
    reconcileAuthProfileStore(ORG, USER, { 'openai:oauth': oauth() }, { 'openai:oauth': 'fp-a' });

    expect(readStore()['openai:oauth'].refresh).toBe('refresh-rotated');
    expect(JSON.parse(fs.readFileSync(fingerprintPath(), 'utf-8'))).toEqual({ 'openai:oauth': 'fp-a' });
  });

  it('leaves profiles it does not mint alone', () => {
    // e.g. one the user created themselves through the OpenClaw CLI.
    createStore({ 'copilot:cli-login': { type: 'api_key', provider: 'copilot', key: 'user-owned' } });
    reconcileAuthProfileStore(ORG, USER, {}, {});

    expect(readStore()['copilot:cli-login']).toBeDefined();
  });

  it('records fingerprints when there is no store yet', () => {
    reconcileAuthProfileStore(ORG, USER, { 'openai:oauth': oauth() }, { 'openai:oauth': 'fp-a' });
    expect(JSON.parse(fs.readFileSync(fingerprintPath(), 'utf-8'))).toEqual({ 'openai:oauth': 'fp-a' });
  });

  it('records nothing when the store could not be read', () => {
    // Claiming we handed these over would make the next reconcile read a real
    // key change as "unchanged" and skip it.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fs.mkdirSync(agentDir(), { recursive: true });
    fs.writeFileSync(storePath(), 'this is not a database');

    expect(() =>
      reconcileAuthProfileStore(ORG, USER, { 'openai:oauth': oauth() }, { 'openai:oauth': 'fp-a' }),
    ).not.toThrow();
    expect(fs.existsSync(fingerprintPath())).toBe(false);
  });
});
