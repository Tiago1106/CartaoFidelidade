import { createDatabase, type Database } from '../db/database';

// The only place that connects as `app_system`, the role that ignores row level security
// (golden rule 1, docs/DATA_MODEL.md section 9). Keep it small. Code that needs it is a short
// function in this folder, reviewed with care, that receives the id of who is acting and checks
// that the data belongs to that person. Nothing outside `src/system/` may import this file.

export type SystemDatabase = Database;

export function createSystemDatabase(url: string): SystemDatabase {
  return createDatabase(url);
}
