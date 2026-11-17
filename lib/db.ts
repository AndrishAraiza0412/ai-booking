import "server-only";
import postgres from "postgres";

// Reuse the pool across `next dev` reloads.
const g = globalThis as unknown as { sql?: postgres.Sql };
export const sql = (g.sql ??= postgres(process.env.DATABASE_URL!, { max: 5 }));
