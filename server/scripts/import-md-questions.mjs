import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;

const APP_STATE_KEY = "questions";
const QUESTIONS_LOCK_ID = 424242;
const SECOND_PARTIAL = "2do parcial";

function printUsage() {
  console.log(`
Uso:
  npm run import:md --workspace server -- [--apply] <archivo.md...>

Opciones:
  --apply      Escribe las preguntas faltantes en DATABASE_URL.
  --list       Muestra el listado de preguntas faltantes.

Sin --apply hace dry-run: parsea, compara contra DATABASE_URL si existe y no escribe.
`);
}

function parseArgs(argv) {
  const options = { apply: false, list: false, files: [] };
  for (const arg of argv) {
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--list") {
      options.list = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      options.files.push(arg);
    }
  }
  return options;
}

function normalizeText(value = "") {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function questionFingerprint(question) {
  return `${question.type}:${normalizeText(question.statement)}`;
}

function uniqueByFingerprint(questions) {
  const seen = new Set();
  return questions.filter((question) => {
    const fingerprint = questionFingerprint(question);
    if (seen.has(fingerprint)) {
      return false;
    }
    seen.add(fingerprint);
    return true;
  });
}

function makeId(question) {
  const hash = fnv1a(questionFingerprint(question)).toString(16).padStart(8, "0");
  return `md-${hash}`;
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function unique(values) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stripMarkdown(value = "") {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_{2,}/g, " ")
    .trim();
}

function cleanText(value = "") {
  return stripMarkdown(value)
    .replace(/✅/g, "")
    .replace(/\s*—\s*.+$/u, "")
    .replace(/\s*\*\([^)]*\)\*\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.:]\s*$/u, "");
}

function cleanOption(value = "") {
  return cleanText(value)
    .replace(/^[-*]\s*/u, "")
    .replace(/^[a-d]\.\s*/iu, "")
    .replace(/^\(?[a-d]\)?[\).:-]\s*/iu, "")
    .trim();
}

function cleanStatement(value = "") {
  return cleanText(value)
    .replace(/^\d+\.\s*/u, "")
    .trim();
}

function splitQuestionBlocks(markdown, sourceFile) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const headingMatch = line.match(/^\*\*(\d+)\.\s+(.+?)\*\*\s*$/u) ?? line.match(/^###\s+(\d+)\.\s+(.+?)\s*$/u);
    if (headingMatch) {
      if (current) {
        blocks.push(current);
      }
      current = {
        number: Number(headingMatch[1]),
        statement: cleanStatement(headingMatch[2]),
        lines: [],
        sourceFile
      };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

function isIgnoredLine(line) {
  const trimmed = line.trim();
  return (
    !trimmed ||
    trimmed === "---" ||
    trimmed.startsWith(">") ||
    trimmed.startsWith("*(") ||
    /^##\s+/u.test(trimmed)
  );
}

function tableRows(lines) {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .filter((line) => !/^\|\s*-+\s*\|/u.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cleanText(cell))
    )
    .filter((cells) => cells.length >= 2);
}

function arrowPairs(lines) {
  return lines
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/u.test(line) && line.includes("→"))
    .map((line) => line.replace(/^[-*]\s+/u, "").split("→").map((cell) => cleanText(cell)))
    .filter(([label, answer]) => label && answer)
    .map(([label, correctAnswer]) => ({ label, correctAnswer }));
}

function optionLines(lines) {
  return lines
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/u.test(line))
    .filter((line) => !line.includes("→"))
    .filter((line) => !/respuesta\s+(correcta\s*)?:/iu.test(line));
}

function parseAnswerLine(lines) {
  for (const line of lines) {
    const text = stripMarkdown(line.replace(/^[-*]\s*/u, "")).replace(/✅/g, "").trim();
    const match = text.match(/respuesta(?:\s+correcta)?\s*:\s*([^—\n]+)/iu);
    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }
  return "";
}

function parseMatchingQuestion(block) {
  const rows = tableRows(block.lines);
  const dataRows = rows.length > 0 && /concepto|m[eé]todo|algoritmo|relaci[oó]n|caracter/i.test(rows[0][0])
    ? rows.slice(1)
    : rows;
  const pairsFromTable = dataRows
    .map(([label, correctAnswer]) => ({ label: cleanText(label), correctAnswer: cleanText(correctAnswer) }))
    .filter((pair) => pair.label && pair.correctAnswer);
  const pairs = pairsFromTable.length > 0 ? pairsFromTable : arrowPairs(block.lines);

  if (pairs.length < 2) {
    return null;
  }

  return {
    id: makeId({ type: "matching_dropdown", statement: block.statement }),
    type: "matching_dropdown",
    statement: block.statement,
    pairs,
    options: unique(pairs.map((pair) => pair.correctAnswer)),
    partial: SECOND_PARTIAL,
    ocrText: sourceTrace(block)
  };
}

function parseNumericQuestion(block) {
  const correctAnswer = parseAnswerLine(block.lines);
  if (!correctAnswer) {
    return null;
  }

  return {
    id: makeId({ type: "numeric_answer", statement: block.statement }),
    type: "numeric_answer",
    statement: block.statement,
    correctAnswer,
    acceptedAnswers: [],
    partial: SECOND_PARTIAL,
    ocrText: sourceTrace(block)
  };
}

function parseMultipleChoiceQuestion(block) {
  const options = [];
  let correctAnswer = "";

  for (const line of optionLines(block.lines)) {
    const isCorrect = line.includes("✅");
    const option = cleanOption(line);
    if (!option) {
      continue;
    }
    options.push(option);
    if (isCorrect) {
      correctAnswer = option;
    }
  }

  if (options.length < 2 || !correctAnswer) {
    return null;
  }

  return {
    id: makeId({ type: "multiple_choice", statement: block.statement }),
    type: "multiple_choice",
    statement: block.statement,
    options: unique(options),
    correctAnswer,
    partial: SECOND_PARTIAL,
    ocrText: sourceTrace(block)
  };
}

function sourceTrace(block) {
  const usefulLines = block.lines.filter((line) => !isIgnoredLine(line)).join("\n").trim();
  return `${path.basename(block.sourceFile)} #${block.number}\n${usefulLines}`;
}

function parseBlock(block) {
  const maybeMatching = /relacion|relacione|relacionar/iu.test(block.statement) || block.lines.some((line) => line.includes("|") || line.includes("→"));
  if (maybeMatching) {
    const matching = parseMatchingQuestion(block);
    if (matching) {
      return matching;
    }
  }

  const numeric = parseNumericQuestion(block);
  if (numeric) {
    return numeric;
  }

  return parseMultipleChoiceQuestion(block);
}

async function parseMarkdownFiles(files) {
  const parsed = [];
  const skipped = [];

  for (const file of files) {
    const absolutePath = path.resolve(file);
    const markdown = await fs.readFile(absolutePath, "utf-8");
    const blocks = splitQuestionBlocks(markdown, absolutePath);
    for (const block of blocks) {
      const question = parseBlock(block);
      if (question) {
        parsed.push(question);
      } else {
        skipped.push({
          file: path.basename(file),
          number: block.number,
          statement: block.statement
        });
      }
    }
  }

  return { parsed, skipped };
}

function validateParsed(question) {
  if (!question.statement?.trim()) {
    return "statement vacio";
  }
  if (question.type === "multiple_choice") {
    if (question.options.length < 2) return "multiple_choice con menos de 2 opciones";
    if (!question.correctAnswer) return "multiple_choice sin respuesta correcta";
    if (!question.options.includes(question.correctAnswer)) return "respuesta correcta no incluida en opciones";
  }
  if (question.type === "matching_dropdown") {
    if (question.pairs.length < 2) return "matching con menos de 2 relaciones";
    if (question.options.length < 2) return "matching con menos de 2 opciones";
    for (const pair of question.pairs) {
      if (!question.options.includes(pair.correctAnswer)) return "respuesta de matching no incluida en opciones";
    }
  }
  if (question.type === "numeric_answer" && !question.correctAnswer) {
    return "numeric_answer sin respuesta";
  }
  return null;
}

function summarizeBy(values, keyFn) {
  return values.reduce((summary, value) => {
    const key = keyFn(value);
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});
}

function getPool() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return null;
  }
  return new Pool({
    connectionString: databaseUrl,
    ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? undefined : { rejectUnauthorized: false }
  });
}

async function readExistingQuestions(db) {
  const table = await db.query("SELECT to_regclass('public.app_state') AS table_name");
  if (!table.rows[0]?.table_name) {
    return [];
  }
  const result = await db.query("SELECT value FROM app_state WHERE key = $1", [APP_STATE_KEY]);
  return result.rows[0]?.value ?? [];
}

async function applyImport(db, parsed) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [QUESTIONS_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      `
        INSERT INTO app_state (key, value)
        VALUES ($1, '[]'::jsonb)
        ON CONFLICT (key) DO NOTHING
      `,
      [APP_STATE_KEY]
    );

    const result = await client.query("SELECT value FROM app_state WHERE key = $1 FOR UPDATE", [APP_STATE_KEY]);
    const existing = result.rows[0]?.value ?? [];
    const existingFingerprints = new Set(existing.map(questionFingerprint));
    const missing = uniqueByFingerprint(parsed).filter((question) => !existingFingerprints.has(questionFingerprint(question)));
    const nextQuestions = [...existing, ...missing];

    await client.query(
      `
        UPDATE app_state
        SET value = $2::jsonb, updated_at = now()
        WHERE key = $1
      `,
      [APP_STATE_KEY, JSON.stringify(nextQuestions)]
    );
    await client.query("COMMIT");
    return { existing, missing, nextQuestions };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function printSummary({ parsed, skipped, existing, missing, list }) {
  console.log(`Preguntas parseadas: ${parsed.length}`);
  console.log("Por tipo:", summarizeBy(parsed, (question) => question.type));
  if (existing) {
    console.log(`Ya estaban en DB: ${parsed.length - missing.length}`);
    console.log(`Faltantes: ${missing.length}`);
    console.log("Faltantes por tipo:", summarizeBy(missing, (question) => question.type));
  }
  if (skipped.length > 0) {
    console.log(`Bloques salteados: ${skipped.length}`);
    for (const item of skipped) {
      console.log(`  - ${item.file} #${item.number}: ${item.statement}`);
    }
  }
  if (list && missing?.length > 0) {
    console.log("\nFaltantes:");
    for (const question of missing) {
      console.log(`  - [${question.type}] ${question.statement}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.files.length === 0) {
    printUsage();
    process.exit(1);
  }

  const { parsed, skipped } = await parseMarkdownFiles(options.files);
  const invalid = parsed
    .map((question) => ({ question, error: validateParsed(question) }))
    .filter((item) => item.error);

  if (invalid.length > 0) {
    console.error("Hay preguntas parseadas invalidas:");
    for (const item of invalid) {
      console.error(`  - ${item.question.statement}: ${item.error}`);
    }
    process.exit(1);
  }

  const duplicatedInsideMarkdown = parsed.length - new Set(parsed.map(questionFingerprint)).size;
  if (duplicatedInsideMarkdown > 0) {
    console.warn(`Aviso: hay ${duplicatedInsideMarkdown} duplicadas dentro de los markdown; se mantienen para comparar pero no se duplicaran si ya existen.`);
  }

  const db = getPool();
  if (!db) {
    if (options.apply) {
      console.error("DATABASE_URL es obligatorio para usar --apply.");
      process.exit(1);
    }
    printSummary({ parsed, skipped, list: false });
    console.log("Sin DATABASE_URL: solo se parseo, no se comparo contra produccion.");
    return;
  }

  try {
    if (options.apply) {
      const result = await applyImport(db, parsed);
      printSummary({ parsed, skipped, existing: result.existing, missing: result.missing, list: options.list });
      console.log(`Importadas: ${result.missing.length}`);
      console.log(`Total final en DB: ${result.nextQuestions.length}`);
      return;
    }

    const existing = await readExistingQuestions(db);
    const existingFingerprints = new Set(existing.map(questionFingerprint));
    const missing = uniqueByFingerprint(parsed).filter((question) => !existingFingerprints.has(questionFingerprint(question)));
    printSummary({ parsed, skipped, existing, missing, list: options.list });
    console.log("Dry-run: no se escribio nada. Agrega --apply para importar las faltantes.");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
