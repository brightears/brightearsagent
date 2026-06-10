import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env.local first (Next.js convention — where real values live), .env as fallback.
config({ path: [".env.local", ".env"] });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
