import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const dataFile = path.resolve(repoRoot, "server/data/questions.json");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta DATABASE_URL para ejecutar el seed.");
}

const defaultSubject = {
  slug: process.env.DEFAULT_SUBJECT_SLUG?.trim() || "investigacion-operativa",
  name: process.env.DEFAULT_SUBJECT_NAME?.trim() || "Investigacion Operativa",
  careerName: process.env.DEFAULT_CAREER_NAME?.trim() || "Ingenieria en Sistemas",
  yearNumber: Number(process.env.DEFAULT_YEAR_NUMBER) || 4
};

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
`;

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mapQuestionToContent(question) {
  if (question.type === "multiple_choice") {
    return {
      options: question.options,
      correctAnswer: question.correctAnswer
    };
  }

  if (question.type === "drag_and_drop") {
    return {
      textParts: question.textParts,
      draggableOptions: question.draggableOptions,
      correctAnswers: question.correctAnswers
    };
  }

  return {
    table: question.table,
    draggableOptions: question.draggableOptions
  };
}

const pool = new Pool({ connectionString });
const questions = JSON.parse(await readFile(dataFile, "utf-8"));

const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query(schemaSql);

  const subjectResult = await client.query(
    `
      INSERT INTO subjects (id, slug, name, career_name, year_number, is_public)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      ON CONFLICT (slug) DO UPDATE
      SET
        name = EXCLUDED.name,
        career_name = EXCLUDED.career_name,
        year_number = EXCLUDED.year_number,
        updated_at = NOW()
      RETURNING id
    `,
    [makeId(), defaultSubject.slug, defaultSubject.name, defaultSubject.careerName, defaultSubject.yearNumber]
  );

  const subjectId = subjectResult.rows[0].id;
  let inserted = 0;

  for (const question of questions) {
    await client.query(
      `
        INSERT INTO questions (id, subject_id, type, statement, content, ocr_text)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        ON CONFLICT (id) DO UPDATE
        SET
          subject_id = EXCLUDED.subject_id,
          type = EXCLUDED.type,
          statement = EXCLUDED.statement,
          content = EXCLUDED.content,
          ocr_text = EXCLUDED.ocr_text,
          updated_at = NOW()
      `,
      [
        question.id || makeId(),
        subjectId,
        question.type,
        question.statement,
        JSON.stringify(mapQuestionToContent(question)),
        question.ocrText ?? null
      ]
    );
    inserted += 1;
  }

  await client.query("COMMIT");
  console.log(`Seed completado. Materia=${defaultSubject.name} preguntas=${inserted}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
