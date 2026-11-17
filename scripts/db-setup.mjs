// Applies db/schema.sql (tables and demo data) to DATABASE_URL; safe to run several times.
import postgres from "postgres";
import { readFileSync } from "node:fs";

const sql = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")).simple();
await sql.end();
console.log("Esquema listo.");
