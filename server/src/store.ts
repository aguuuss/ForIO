import type { PoolClient } from "pg";
import { DEFAULT_SUBJECT, pool } from "./db.js";
import type { Question, QuestionInput, QuestionRecord, SubjectInput, SubjectSummary } from "./types.js";

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

async function findSubjectBySlug(client: PoolClient, slug: string) {
  const result = await client.query<{
    id: string;
    slug: string;
    name: string;
    career_name: string;
    year_number: number;
  }>(
    `
      SELECT id, slug, name, career_name, year_number
      FROM subjects
      WHERE slug = $1
      LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] ?? null;
}

function toSubjectSummary(row: {
  id: string;
  slug: string;
  name: string;
  career_name: string;
  year_number: number;
}): SubjectSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    careerName: row.career_name,
    yearNumber: row.year_number
  };
}

async function resolveSubject(client: PoolClient, input?: SubjectInput) {
  const slug = input?.subjectSlug?.trim() || DEFAULT_SUBJECT.slug;
  const existing = await findSubjectBySlug(client, slug);
  if (existing) {
    return existing;
  }

  const name = input?.subjectName?.trim() || DEFAULT_SUBJECT.name;
  const careerName = input?.careerName?.trim() || DEFAULT_SUBJECT.careerName;
  const yearNumber = input?.yearNumber || DEFAULT_SUBJECT.yearNumber;

  const inserted = await client.query<{
    id: string;
    slug: string;
    name: string;
    career_name: string;
    year_number: number;
  }>(
    `
      INSERT INTO subjects (id, slug, name, career_name, year_number, is_public)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      RETURNING id, slug, name, career_name, year_number
    `,
    [makeId(), slug, name, careerName, yearNumber]
  );

  return inserted.rows[0];
}

function serializeQuestionContent(input: QuestionInput) {
  if (input.type === "multiple_choice") {
    return {
      options: input.options,
      correctAnswer: input.correctAnswer
    };
  }

  if (input.type === "drag_and_drop") {
    return {
      textParts: input.textParts,
      draggableOptions: input.draggableOptions,
      correctAnswers: input.correctAnswers
    };
  }

  return {
    table: input.table,
    draggableOptions: input.draggableOptions
  };
}

function mapRowToQuestion(row: {
  id: string;
  type: Question["type"];
  statement: string;
  content: Record<string, unknown>;
  ocr_text: string | null;
  subject_id: string;
  subject_slug: string;
  subject_name: string;
  career_name: string;
  year_number: number;
}): QuestionRecord {
  return {
    id: row.id,
    type: row.type,
    statement: row.statement,
    ...(row.content as Omit<Question, "id" | "type" | "statement" | "ocrText">),
    ocrText: row.ocr_text ?? undefined,
    subject: {
      id: row.subject_id,
      slug: row.subject_slug,
      name: row.subject_name,
      careerName: row.career_name,
      yearNumber: row.year_number
    }
  } as QuestionRecord;
}

async function listQuestionsInternal(filters?: { subjectSlug?: string; yearNumber?: number }) {
  const values: Array<string | number> = [];
  const where: string[] = [];

  if (filters?.subjectSlug?.trim()) {
    values.push(filters.subjectSlug.trim());
    where.push(`subjects.slug = $${values.length}`);
  }

  if (typeof filters?.yearNumber === "number" && Number.isFinite(filters.yearNumber)) {
    values.push(filters.yearNumber);
    where.push(`subjects.year_number = $${values.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const result = await pool.query<{
    id: string;
    type: Question["type"];
    statement: string;
    content: Record<string, unknown>;
    ocr_text: string | null;
    subject_id: string;
    subject_slug: string;
    subject_name: string;
    career_name: string;
    year_number: number;
  }>(
    `
      SELECT
        questions.id,
        questions.type,
        questions.statement,
        questions.content,
        questions.ocr_text,
        subjects.id AS subject_id,
        subjects.slug AS subject_slug,
        subjects.name AS subject_name,
        subjects.career_name,
        subjects.year_number
      FROM questions
      INNER JOIN subjects ON subjects.id = questions.subject_id
      ${whereClause}
      ORDER BY subjects.year_number ASC, subjects.name ASC, questions.created_at ASC
    `,
    values
  );

  return result.rows.map(mapRowToQuestion);
}

export async function getQuestions(filters?: { subjectSlug?: string; yearNumber?: number }) {
  return listQuestionsInternal(filters);
}

export async function listSubjects() {
  const result = await pool.query<{
    id: string;
    slug: string;
    name: string;
    career_name: string;
    year_number: number;
  }>(
    `
      SELECT id, slug, name, career_name, year_number
      FROM subjects
      WHERE is_public = TRUE
      ORDER BY year_number ASC, name ASC
    `
  );

  return result.rows.map(toSubjectSummary);
}

export async function createQuestion(input: QuestionInput) {
  const validationError = validateQuestion(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const subject = await resolveSubject(client, input);
    const questionId = input.id?.trim() || makeId();
    const inserted = await client.query<{
      id: string;
      type: Question["type"];
      statement: string;
      content: Record<string, unknown>;
      ocr_text: string | null;
      subject_id: string;
      subject_slug: string;
      subject_name: string;
      career_name: string;
      year_number: number;
    }>(
      `
        INSERT INTO questions (id, subject_id, type, statement, content, ocr_text)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        RETURNING
          id,
          type,
          statement,
          content,
          ocr_text,
          $2 AS subject_id,
          $7 AS subject_slug,
          $8 AS subject_name,
          $9 AS career_name,
          $10 AS year_number
      `,
      [
        questionId,
        subject.id,
        input.type,
        input.statement,
        JSON.stringify(serializeQuestionContent(input)),
        input.ocrText ?? null,
        subject.slug,
        subject.name,
        subject.career_name,
        subject.year_number
      ]
    );
    await client.query("COMMIT");
    return mapRowToQuestion(inserted.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createQuestionsBulk(inputs: QuestionInput[]) {
  const client = await pool.connect();
  const created: QuestionRecord[] = [];

  try {
    await client.query("BEGIN");

    for (const input of inputs) {
      const validationError = validateQuestion(input);
      if (validationError) {
        throw new Error(validationError);
      }

      const subject = await resolveSubject(client, input);
      const inserted = await client.query<{
        id: string;
        type: Question["type"];
        statement: string;
        content: Record<string, unknown>;
        ocr_text: string | null;
        subject_id: string;
        subject_slug: string;
        subject_name: string;
        career_name: string;
        year_number: number;
      }>(
        `
          INSERT INTO questions (id, subject_id, type, statement, content, ocr_text)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6)
          RETURNING
            id,
            type,
            statement,
            content,
            ocr_text,
            $2 AS subject_id,
            $7 AS subject_slug,
            $8 AS subject_name,
            $9 AS career_name,
            $10 AS year_number
        `,
        [
          input.id?.trim() || makeId(),
          subject.id,
          input.type,
          input.statement,
          JSON.stringify(serializeQuestionContent(input)),
          input.ocrText ?? null,
          subject.slug,
          subject.name,
          subject.career_name,
          subject.year_number
        ]
      );

      created.push(mapRowToQuestion(inserted.rows[0]));
    }

    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateQuestion(id: string, input: QuestionInput) {
  const validationError = validateQuestion(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exists = await client.query<{ id: string }>("SELECT id FROM questions WHERE id = $1 LIMIT 1", [id]);
    if (!exists.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    const subject = await resolveSubject(client, input);
    const updated = await client.query<{
      id: string;
      type: Question["type"];
      statement: string;
      content: Record<string, unknown>;
      ocr_text: string | null;
      subject_id: string;
      subject_slug: string;
      subject_name: string;
      career_name: string;
      year_number: number;
    }>(
      `
        UPDATE questions
        SET
          subject_id = $2,
          type = $3,
          statement = $4,
          content = $5::jsonb,
          ocr_text = $6,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          type,
          statement,
          content,
          ocr_text,
          $2 AS subject_id,
          $7 AS subject_slug,
          $8 AS subject_name,
          $9 AS career_name,
          $10 AS year_number
      `,
      [
        id,
        subject.id,
        input.type,
        input.statement,
        JSON.stringify(serializeQuestionContent(input)),
        input.ocrText ?? null,
        subject.slug,
        subject.name,
        subject.career_name,
        subject.year_number
      ]
    );

    await client.query("COMMIT");
    return mapRowToQuestion(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteQuestion(id: string) {
  const result = await pool.query("DELETE FROM questions WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
