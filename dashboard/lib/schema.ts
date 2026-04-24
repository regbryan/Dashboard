// Schema migration is only used in local development with SQLite.
// Supabase migrations are managed via the Supabase dashboard.
export function migrate(): void {
  throw new Error("Schema migration is only available in local development");
}
