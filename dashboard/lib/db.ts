import Database from "better-sqlite3";
import path from "node:path";
import { migrate } from "./schema";
import { PROJECT_ROOT } from "./paths";

// Store the DB in the dashboard/ subfolder of the project root
const DB_PATH = path.join(PROJECT_ROOT, "dashboard", "dashboard.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}
