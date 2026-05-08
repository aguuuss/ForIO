import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Falta DATABASE_URL. Levanta Postgres y defini la variable de entorno.");
}

export const DEFAULT_SUBJECT = {
  slug: process.env.DEFAULT_SUBJECT_SLUG?.trim() || "investigacion-operativa",
  name: process.env.DEFAULT_SUBJECT_NAME?.trim() || "Investigacion Operativa",
  careerName: process.env.DEFAULT_CAREER_NAME?.trim() || "Ingenieria en Sistemas",
  yearNumber: Number(process.env.DEFAULT_YEAR_NUMBER) || 4
};

export const AUTH_COOKIE_NAME = "forio_session";
export const AUTH_COOKIE_SECRET = process.env.AUTH_COOKIE_SECRET?.trim() || "dev-forio-session-secret";
export const AUTH_SESSION_TTL_DAYS = Number(process.env.AUTH_SESSION_TTL_DAYS) || 30;
export const INITIAL_ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() || "";
export const INITIAL_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD?.trim() || "";
export const INITIAL_ADMIN_DISPLAY_NAME = process.env.INITIAL_ADMIN_DISPLAY_NAME?.trim() || "Administrador";

export const pool = new Pool({
  connectionString
});

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

  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    career_name TEXT NOT NULL,
    year_number INTEGER NOT NULL CHECK (year_number > 0),
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    type TEXT NOT NULL,
    statement TEXT NOT NULL,
    content JSONB NOT NULL,
    ocr_text TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE subjects ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE subjects ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE questions ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;

  CREATE INDEX IF NOT EXISTS idx_subjects_year_number ON subjects(year_number);
  CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON questions(subject_id);
  CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`;

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function initializeDatabase() {
  await pool.query(schemaSql);

  await pool.query(
    `
      INSERT INTO subjects (id, slug, name, career_name, year_number, is_public)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      ON CONFLICT (slug) DO UPDATE
      SET
        name = EXCLUDED.name,
        career_name = EXCLUDED.career_name,
        year_number = EXCLUDED.year_number,
        updated_at = NOW()
    `,
    [makeId(), DEFAULT_SUBJECT.slug, DEFAULT_SUBJECT.name, DEFAULT_SUBJECT.careerName, DEFAULT_SUBJECT.yearNumber]
  );

  await bootstrapInitialAdmin();
}

async function bootstrapInitialAdmin() {
  if (!INITIAL_ADMIN_EMAIL) {
    return;
  }

  const existing = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1 LIMIT 1", [INITIAL_ADMIN_EMAIL]);
  if (existing.rows[0]) {
    await pool.query(
      `
        UPDATE users
        SET role = 'admin', status = 'active', updated_at = NOW()
        WHERE email = $1
      `,
      [INITIAL_ADMIN_EMAIL]
    );
    return;
  }

  if (!INITIAL_ADMIN_PASSWORD) {
    return;
  }

  const argon2 = await import("argon2");
  const passwordHash = await argon2.hash(INITIAL_ADMIN_PASSWORD);
  await pool.query(
    `
      INSERT INTO users (id, email, password_hash, display_name, role, status)
      VALUES ($1, $2, $3, $4, 'admin', 'active')
      ON CONFLICT (email) DO NOTHING
    `,
    [makeId(), INITIAL_ADMIN_EMAIL, passwordHash, INITIAL_ADMIN_DISPLAY_NAME]
  );
}
