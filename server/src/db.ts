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

export const pool = new Pool({
  connectionString
});

const schemaSql = `
  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    career_name TEXT NOT NULL,
    year_number INTEGER NOT NULL CHECK (year_number > 0),
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_subjects_year_number ON subjects(year_number);
  CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON questions(subject_id);
  CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
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
}
