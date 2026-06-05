import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { Question, QuestionInput } from "./types.js";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFile = path.resolve(__dirname, "../data/questions.json");
const appStateKey = "questions";
const questionsLockId = 424242;

let pool: pg.Pool | null | undefined;
let postgresReady = false;

function getPool() {
  if (pool !== undefined) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    pool = null;
    return pool;
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined
  });
  return pool;
}

function shouldUseSsl(databaseUrl: string) {
  return !/localhost|127\.0\.0\.1/.test(databaseUrl);
}

async function ensurePostgresStore(db: pg.Pool) {
  if (postgresReady) {
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const seedQuestions = await readQuestionsFromFile();
  await db.query(
    `
      INSERT INTO app_state (key, value)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (key) DO NOTHING
    `,
    [appStateKey, JSON.stringify(seedQuestions)]
  );

  postgresReady = true;
}

async function readQuestions(): Promise<Question[]> {
  const db = getPool();
  if (!db) {
    return readQuestionsFromFile();
  }

  await ensurePostgresStore(db);
  const result = await db.query<{ value: Question[] }>("SELECT value FROM app_state WHERE key = $1", [appStateKey]);
  return result.rows[0]?.value ?? [];
}

async function mutateQuestions(mutator: (questions: Question[]) => Question[] | Promise<Question[]>) {
  const db = getPool();
  if (!db) {
    const questions = await readQuestionsFromFile();
    const nextQuestions = await mutator(questions);
    await writeQuestionsToFile(nextQuestions);
    return nextQuestions;
  }

  await ensurePostgresStore(db);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [questionsLockId]);
    const result = await client.query<{ value: Question[] }>("SELECT value FROM app_state WHERE key = $1 FOR UPDATE", [appStateKey]);
    const questions = result.rows[0]?.value ?? [];
    const nextQuestions = await mutator(questions);
    await client.query(
      `
        UPDATE app_state
        SET value = $2::jsonb, updated_at = now()
        WHERE key = $1
      `,
      [appStateKey, JSON.stringify(nextQuestions)]
    );
    await client.query("COMMIT");
    return nextQuestions;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function readQuestionsFromFile(): Promise<Question[]> {
  try {
    const raw = await fs.readFile(dataFile, "utf-8");
    return JSON.parse(raw) as Question[];
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      await writeQuestionsToFile([]);
      return [];
    }
    throw new Error(`No se pudo leer server/data/questions.json. ${error instanceof Error ? error.message : ""}`);
  }
}

async function writeQuestionsToFile(questions: Question[]) {
  const backupsDir = path.resolve(__dirname, "../data/backups");
  try {
    await fs.mkdir(backupsDir, { recursive: true });
    try {
      const current = await fs.readFile(dataFile, "utf-8");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFile = path.resolve(backupsDir, `questions-${timestamp}.json`);
      await fs.writeFile(backupFile, current, "utf-8");

      const files = await fs.readdir(backupsDir);
      const backups = files.filter((f) => f.startsWith("questions-") && f.endsWith(".json")).sort();
      const keep = 10;
      if (backups.length > keep) {
        const toRemove = backups.slice(0, backups.length - keep);
        await Promise.all(toRemove.map((f) => fs.unlink(path.resolve(backupsDir, f))));
      }
    } catch (err) {
      if (!(isNodeError(err) && err.code === "ENOENT")) {
        throw err;
      }
    }
  } catch (err) {
    console.error("No se pudo crear backup de questions.json:", err instanceof Error ? err.message : err);
  }

  try {
    await fs.writeFile(dataFile, JSON.stringify(questions, null, 2), "utf-8");
  } catch (error) {
    if (isNodeError(error) && error.code === "EROFS") {
      throw new Error("El filesystem del deploy es de solo lectura. Configura DATABASE_URL para guardar preguntas en produccion.");
    }
    throw error;
  }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function validateQuestion(input: QuestionInput): string | null {
  if (!input.statement?.trim()) {
    return "El enunciado es obligatorio.";
  }

  if (input.type === "multiple_choice") {
    if (!Array.isArray(input.options) || input.options.length < 2) {
      return "Una pregunta multiple_choice necesita al menos 2 opciones.";
    }
    if (!input.correctAnswer?.trim()) {
      return "La respuesta correcta es obligatoria.";
    }
    if (!input.options.includes(input.correctAnswer)) {
      return "La respuesta correcta debe estar incluida en las opciones.";
    }
    return null;
  }

  if (input.type === "drag_and_drop") {
    const blankCount = input.textParts.filter((part) => part === "__blank__").length;
    if (blankCount === 0) {
      return "Una pregunta drag_and_drop necesita al menos un __blank__.";
    }
    if (blankCount !== input.correctAnswers.length) {
      return "La cantidad de __blank__ debe coincidir con correctAnswers.";
    }
    if (!Array.isArray(input.draggableOptions) || input.draggableOptions.length < input.correctAnswers.length) {
      return "Agregá opciones arrastrables suficientes.";
    }
    for (const answer of input.correctAnswers) {
      if (!input.draggableOptions.includes(answer)) {
        return "Cada respuesta correcta debe estar incluida en las opciones arrastrables.";
      }
    }
    return null;
  }

  if (input.type === "table_drag_and_drop") {
    if (!input.table || input.table.rows < 1 || input.table.columns < 1) {
      return "La tabla necesita al menos 1 fila y 1 columna.";
    }
    if (!Array.isArray(input.table.cells) || input.table.cells.length !== input.table.rows * input.table.columns) {
      return "La cantidad de celdas debe coincidir con filas por columnas.";
    }
    const blanks = input.table.cells.filter((cell) => cell.isBlank);
    if (blanks.length === 0) {
      return "La tabla necesita al menos una celda vacia.";
    }
    for (const cell of blanks) {
      if (!cell.correctAnswer?.trim()) {
        return "Cada celda vacia necesita una respuesta correcta.";
      }
    }
    if (!Array.isArray(input.draggableOptions) || input.draggableOptions.length < blanks.length) {
      return "Agrega opciones arrastrables suficientes para la tabla.";
    }
    for (const cell of blanks) {
      const acceptedAnswers = [cell.correctAnswer ?? "", ...(cell.acceptedAnswers ?? [])].filter(Boolean);
      if (!acceptedAnswers.some((answer) => input.draggableOptions.includes(answer))) {
        return "Cada respuesta correcta de tabla debe estar incluida en las opciones arrastrables.";
      }
    }
    return null;
  }

  return "Tipo de pregunta no soportado.";
}

export async function getQuestions() {
  return readQuestions();
}

export async function createQuestion(input: QuestionInput) {
  const validationError = validateQuestion(input);
  if (validationError) {
    throw new Error(validationError);
  }

  let createdQuestion: Question | null = null;
  await mutateQuestions((questions) => {
    createdQuestion = { ...input, id: input.id?.trim() || makeId() } as Question;
    return [...questions, createdQuestion];
  });

  if (!createdQuestion) {
    throw new Error("No se pudo crear la pregunta.");
  }

  return createdQuestion;
}

export async function createQuestionsBulk(inputs: QuestionInput[]) {
  for (const input of inputs) {
    const validationError = validateQuestion(input);
    if (validationError) {
      throw new Error(validationError);
    }
  }

  const created: Question[] = [];
  await mutateQuestions((questions) => {
    const nextQuestions = [...questions];
    for (const input of inputs) {
      const question = { ...input, id: input.id?.trim() || makeId() } as Question;
      nextQuestions.push(question);
      created.push(question);
    }
    return nextQuestions;
  });

  return created;
}

export async function updateQuestion(id: string, input: QuestionInput) {
  const validationError = validateQuestion(input);
  if (validationError) {
    throw new Error(validationError);
  }

  let updatedQuestion: Question | null = null;
  await mutateQuestions((questions) => {
    const index = questions.findIndex((question) => question.id === id);
    if (index === -1) {
      return questions;
    }

    const nextQuestions = [...questions];
    updatedQuestion = { ...input, id } as Question;
    nextQuestions[index] = updatedQuestion;
    return nextQuestions;
  });

  return updatedQuestion;
}

export async function deleteQuestion(id: string) {
  let deleted = false;
  await mutateQuestions((questions) => {
    const nextQuestions = questions.filter((question) => question.id !== id);
    deleted = nextQuestions.length !== questions.length;
    return nextQuestions;
  });

  return deleted;
}
