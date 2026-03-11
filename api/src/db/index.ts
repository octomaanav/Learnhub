import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL is not set. Database queries will fail until it is configured.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://placeholder:placeholder@localhost:5432/placeholder",
});

export const db = drizzle(pool, { schema });
