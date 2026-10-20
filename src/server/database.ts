import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SessionState } from '../shared/types.js';

export class SessionStore {
  readonly database: DatabaseSync;

  constructor(databasePath: string) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  close(): void {
    this.database.close();
  }

  getSession(id: string): SessionState | null {
    const row = this.database.prepare('SELECT state_json FROM sessions WHERE id = ?').get(id) as
      | { state_json: string }
      | undefined;
    return row ? (JSON.parse(row.state_json) as SessionState) : null;
  }

  createSession(state: SessionState): void {
    const now = new Date().toISOString();
    this.database
      .prepare('INSERT INTO sessions (id, state_json, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(state.id, JSON.stringify(state), now, now);
  }

  saveSession(state: SessionState): void {
    const result = this.database
      .prepare('UPDATE sessions SET state_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(state), new Date().toISOString(), state.id);
    if (result.changes !== 1) throw new Error(`Session ${state.id} was not found.`);
  }

  mutateSession<T>(id: string, mutate: (state: SessionState) => T): T {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const state = this.getSession(id);
      if (!state) throw new Error('Session not found.');
      const result = mutate(state);
      this.saveSession(state);
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  getMetadata(key: string): string | null {
    const row = this.database.prepare('SELECT value FROM metadata WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  setMetadata(key: string, value: string): void {
    this.database
      .prepare(
        'INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, value);
  }
}
