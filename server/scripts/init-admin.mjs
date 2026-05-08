import argon2 from "argon2";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvFile = path.resolve(__dirname, "../../.env");

dotenv.config({ path: rootEnvFile, override: false });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL en el .env raíz.");
}

const email = process.argv[2] ?? process.env.INITIAL_ADMIN_EMAIL ?? "";
const password = process.argv[3] ?? process.env.INITIAL_ADMIN_PASSWORD ?? "";
const displayName = process.argv[4] ?? process.env.INITIAL_ADMIN_DISPLAY_NAME ?? "Administrador";

if (!email.trim()) {
  throw new Error("Tenés que pasar el email del admin por argumento o definir INITIAL_ADMIN_EMAIL.");
}

if (!password.trim()) {
  throw new Error("Tenés que pasar la contraseña del admin por argumento o definir INITIAL_ADMIN_PASSWORD.");
}

const normalizedEmail = email.trim().toLowerCase();
const normalizedDisplayName = displayName.trim() || "Administrador";

const pool = new Pool({ connectionString: databaseUrl });

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const schemaSql = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('editor', 'admin')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'active')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

try {
  await pool.query(schemaSql);

  const passwordHash = await argon2.hash(password);
  const existing = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [normalizedEmail]);

  if (existing.rows[0]) {
    await pool.query(
      `
        UPDATE users
        SET
          password_hash = $2,
          display_name = $3,
          role = 'admin',
          status = 'active',
          updated_at = NOW()
        WHERE email = $1
      `,
      [normalizedEmail, passwordHash, normalizedDisplayName]
    );

    console.log(`Admin actualizado: ${normalizedEmail}`);
  } else {
    await pool.query(
      `
        INSERT INTO users (id, email, password_hash, display_name, role, status)
        VALUES ($1, $2, $3, $4, 'admin', 'active')
      `,
      [makeId(), normalizedEmail, passwordHash, normalizedDisplayName]
    );

    console.log(`Admin creado: ${normalizedEmail}`);
  }
} finally {
  await pool.end();
}
