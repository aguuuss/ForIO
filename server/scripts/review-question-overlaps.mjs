import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;

const APP_STATE_KEY = "questions";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultQuestionsFile = path.resolve(__dirname, "../data/questions.json");

const stopWords = new Set([
  "aca",
  "actividades",
  "afirmacion",
  "afirmaciones",
  "alguna",
  "algunas",
  "alguno",
  "algunos",
  "como",
  "con",
  "concepto",
  "consiste",
  "cual",
  "cuales",
  "cuando",
  "debe",
  "del",
  "desde",
  "determina",
  "describe",
  "donde",
  "el",
  "en",
  "entre",
  "es",
  "esta",
  "estan",
  "este",
  "estos",
  "forma",
  "indica",
  "las",
  "los",
  "mas",
  "mejor",
  "para",
  "por",
  "pregunta",
  "que",
  "relacione",
  "relacionar",
  "se",
  "serie",
  "siguientes",
  "sirve",
  "son",
  "teoria",
  "tiene",
  "tipo",
  "una",
  "unidad",
  "usa",
  "usado",
  "utiliza",
  "utilizado"
]);

function printUsage() {
  console.log(`
Uso:
  npm run review:questions --workspace server -- [opciones]

Opciones:
  --threshold <n>  Similitud minima para "parecidas". Default: 0.82.
  --limit <n>      Maximo de parecidas a mostrar. Default: 80.
  --type <tipo>    Filtra por tipo: multiple_choice, matching_dropdown, numeric_answer, etc.
  --file <path>    Lee un JSON local en vez de DATABASE_URL.

Si DATABASE_URL existe, revisa la base. Si no existe, revisa server/data/questions.json.
No escribe ni modifica nada.
`);
}

function parseArgs(argv) {
  const options = {
    threshold: 0.82,
    limit: 80,
    type: "",
    file: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--threshold") {
      options.threshold = Number(argv[++index]);
    } else if (arg === "--limit") {
      options.limit = Number(argv[++index]);
    } else if (arg === "--type") {
      options.type = argv[++index] ?? "";
    } else if (arg === "--file") {
      options.file = argv[++index] ?? "";
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Opcion no soportada: ${arg}`);
    }
  }

  if (!Number.isFinite(options.threshold) || options.threshold <= 0 || options.threshold > 1) {
    throw new Error("--threshold debe ser un numero entre 0 y 1.");
  }
  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error("--limit debe ser un entero mayor a 0.");
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

function tokens(value = "") {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function unique(values) {
  return Array.from(new Set(values));
}

function questionKey(question) {
  return `${question.type}:${normalizeText(question.statement)}`;
}

function fullQuestionKey(question) {
  return `${questionKey(question)}:${normalizeText(answerText(question))}`;
}

function answerText(question) {
  if (question.type === "multiple_choice") {
    return [question.correctAnswer, ...(question.options ?? [])].join(" ");
  }
  if (question.type === "drag_and_drop") {
    return [...(question.correctAnswers ?? []), ...(question.draggableOptions ?? [])].join(" ");
  }
  if (question.type === "table_drag_and_drop") {
    return [
      ...(question.draggableOptions ?? []),
      ...((question.table?.cells ?? []).flatMap((cell) => [cell.correctAnswer ?? "", ...(cell.acceptedAnswers ?? [])]))
    ].join(" ");
  }
  if (question.type === "matching_dropdown") {
    return [...(question.options ?? []), ...((question.pairs ?? []).flatMap((pair) => [pair.label, pair.correctAnswer]))].join(" ");
  }
  if (question.type === "numeric_answer") {
    return [question.correctAnswer, ...(question.acceptedAnswers ?? [])].join(" ");
  }
  return "";
}

function diceSimilarity(leftValues, rightValues) {
  const left = new Set(leftValues);
  const right = new Set(rightValues);
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }

  return (2 * intersection) / (left.size + right.size);
}

function compactQuestion(question, index) {
  const statementTokens = unique(tokens(question.statement));
  const answerTokens = unique(tokens(answerText(question)));
  return {
    index,
    id: question.id ?? "",
    type: question.type ?? "unknown",
    statement: question.statement ?? "",
    normalizedStatement: normalizeText(question.statement),
    statementKey: questionKey(question),
    exactKey: fullQuestionKey(question),
    statementTokens,
    answerTokens
  };
}

function questionLabel(question) {
  const id = question.id ? ` id=${question.id}` : "";
  return `#${question.index + 1}${id} [${question.type}] ${question.statement}`;
}

function groupExactDuplicates(questions) {
  const groups = new Map();
  for (const question of questions) {
    const list = groups.get(question.exactKey) ?? [];
    list.push(question);
    groups.set(question.exactKey, list);
  }
  return Array.from(groups.values()).filter((group) => group.length > 1);
}

function findSimilarPairs(questions, threshold) {
  const pairs = [];
  for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
      const left = questions[leftIndex];
      const right = questions[rightIndex];
      if (left.type !== right.type || left.exactKey === right.exactKey) {
        continue;
      }
      if (left.statementTokens.length < 2 || right.statementTokens.length < 2) {
        continue;
      }

      const statementScore = diceSimilarity(left.statementTokens, right.statementTokens);
      if (statementScore < threshold) {
        continue;
      }

      const answerScore = diceSimilarity(left.answerTokens, right.answerTokens);
      pairs.push({
        left,
        right,
        statementScore,
        answerScore
      });
    }
  }

  return pairs.sort((a, b) => b.statementScore - a.statementScore || b.answerScore - a.answerScore);
}

function summarizeByType(questions) {
  return questions.reduce((summary, question) => {
    summary[question.type] = (summary[question.type] ?? 0) + 1;
    return summary;
  }, {});
}

async function readQuestionsFromFile(file) {
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw);
}

async function readQuestionsFromDatabase() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return null;
  }

  const db = new Pool({
    connectionString: databaseUrl,
    ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? undefined : { rejectUnauthorized: false }
  });

  try {
    const result = await db.query("SELECT value FROM app_state WHERE key = $1", [APP_STATE_KEY]);
    return result.rows[0]?.value ?? [];
  } finally {
    await db.end();
  }
}

function printExactDuplicates(groups) {
  console.log(`\nDuplicadas exactas: ${groups.length} grupo(s)`);
  for (const [groupIndex, group] of groups.entries()) {
    console.log(`\nExacta ${groupIndex + 1}:`);
    for (const question of group) {
      console.log(`  - ${questionLabel(question)}`);
    }
  }
}

function printSimilarPairs(pairs, limit) {
  const shown = pairs.slice(0, limit);
  console.log(`\nParecidas: ${pairs.length} par(es). Mostrando ${shown.length}.`);
  for (const [index, pair] of shown.entries()) {
    console.log(`\nParecida ${index + 1}: statement=${pair.statementScore.toFixed(2)} answers=${pair.answerScore.toFixed(2)}`);
    console.log(`  A: ${questionLabel(pair.left)}`);
    console.log(`  B: ${questionLabel(pair.right)}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const source = options.file ? path.resolve(options.file) : "";
  const fromDb = source ? null : await readQuestionsFromDatabase();
  const rawQuestions = fromDb ?? (await readQuestionsFromFile(source || defaultQuestionsFile));
  const filteredQuestions = options.type ? rawQuestions.filter((question) => question.type === options.type) : rawQuestions;
  const questions = filteredQuestions.map(compactQuestion);
  const exactGroups = groupExactDuplicates(questions);
  const similarPairs = findSimilarPairs(questions, options.threshold);

  console.log(`Fuente: ${fromDb ? "DATABASE_URL" : source || defaultQuestionsFile}`);
  console.log(`Preguntas revisadas: ${questions.length}`);
  console.log("Por tipo:", summarizeByType(questions));
  console.log(`Threshold parecidas: ${options.threshold}`);

  printExactDuplicates(exactGroups);
  printSimilarPairs(similarPairs, options.limit);

  if (exactGroups.length === 0 && similarPairs.length === 0) {
    console.log("\nNo encontre coincidencias con esos criterios.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
