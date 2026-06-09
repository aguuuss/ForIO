import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const DEFAULT_API_URL = "https://for-io-server.vercel.app";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function printUsage() {
  console.log(`
Uso:
  npm run dedupe:exact --workspace server -- [opciones]

Opciones:
  --apply            Borra duplicadas exactas. Sin esto solo hace dry-run.
  --type <tipo>      Filtra por tipo. Ej: multiple_choice.
  --api-url <url>    Backend API. Default: ${DEFAULT_API_URL}
  --file <path>      Lee un JSON local para revisar. No se puede usar con --apply.

Criterio exacto:
  mismo tipo + mismo enunciado normalizado + mismas respuestas/opciones normalizadas.

Siempre conserva la primera aparicion y marca las demas para borrar.
`);
}

function parseArgs(argv) {
  const options = {
    apply: false,
    type: "",
    apiUrl: process.env.API_URL?.trim() || DEFAULT_API_URL,
    file: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--type") {
      options.type = argv[++index] ?? "";
    } else if (arg === "--api-url") {
      options.apiUrl = argv[++index] ?? "";
    } else if (arg === "--file") {
      options.file = argv[++index] ?? "";
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Opcion no soportada: ${arg}`);
    }
  }

  if (options.apply && options.file) {
    throw new Error("--apply no se puede usar con --file porque no hay API donde borrar.");
  }

  return options;
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
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

function exactKey(question) {
  return `${question.type}:${normalizeText(question.statement)}:${normalizeText(answerText(question))}`;
}

function groupExactDuplicates(questions) {
  const groups = new Map();
  for (const [index, question] of questions.entries()) {
    const key = exactKey(question);
    const group = groups.get(key) ?? [];
    group.push({ index, question });
    groups.set(key, group);
  }
  return Array.from(groups.values()).filter((group) => group.length > 1);
}

function summarizeByType(questions) {
  return questions.reduce((summary, question) => {
    summary[question.type] = (summary[question.type] ?? 0) + 1;
    return summary;
  }, {});
}

function questionLabel(item) {
  const { index, question } = item;
  return `#${index + 1} id=${question.id} [${question.type}] ${question.statement}`;
}

async function readQuestions(options) {
  if (options.file) {
    const file = path.resolve(options.file);
    const raw = await fs.readFile(file, "utf-8");
    return { source: file, questions: JSON.parse(raw) };
  }

  const endpoint = `${options.apiUrl.replace(/\/$/u, "")}/api/questions`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`No se pudo leer ${endpoint}. HTTP ${response.status}`);
  }
  return { source: endpoint, questions: await response.json() };
}

async function writeBackup(questions, apiUrl) {
  const backupsDir = path.resolve(__dirname, "../data/backups");
  await fs.mkdir(backupsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.resolve(backupsDir, `prod-questions-before-dedupe-${timestamp}.json`);
  await fs.writeFile(
    backupFile,
    JSON.stringify(
      {
        apiUrl,
        createdAt: new Date().toISOString(),
        questions
      },
      null,
      2
    ),
    "utf-8"
  );
  return backupFile;
}

async function deleteQuestion(apiUrl, id) {
  const endpoint = `${apiUrl.replace(/\/$/u, "")}/api/questions/${encodeURIComponent(id)}`;
  const response = await fetch(endpoint, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`No se pudo borrar ${id}. HTTP ${response.status} ${text}`);
  }
}

function printPlan(groups) {
  console.log(`Duplicadas exactas: ${groups.length} grupo(s)`);
  for (const [groupIndex, group] of groups.entries()) {
    const [kept, ...toDelete] = group;
    console.log(`\nGrupo ${groupIndex + 1}:`);
    console.log(`  CONSERVAR: ${questionLabel(kept)}`);
    for (const item of toDelete) {
      console.log(`  BORRAR:    ${questionLabel(item)}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { source, questions } = await readQuestions(options);
  if (!Array.isArray(questions)) {
    throw new Error(`La fuente no devolvio un array de preguntas: ${source}`);
  }

  const scopedQuestions = options.type ? questions.filter((question) => question.type === options.type) : questions;
  const groups = groupExactDuplicates(scopedQuestions);
  const toDelete = groups.flatMap((group) => group.slice(1));

  console.log(`Fuente: ${source}`);
  console.log(`Preguntas revisadas: ${scopedQuestions.length}`);
  console.log("Por tipo:", summarizeByType(scopedQuestions));
  printPlan(groups);
  console.log(`\nTotal a borrar: ${toDelete.length}`);

  if (!options.apply) {
    console.log("\nDry-run: no se borro nada. Agrega --apply para ejecutar.");
    return;
  }

  if (toDelete.length === 0) {
    console.log("No hay duplicadas exactas para borrar.");
    return;
  }

  const backupFile = await writeBackup(questions, options.apiUrl);
  console.log(`Backup escrito en: ${backupFile}`);

  for (const item of toDelete) {
    await deleteQuestion(options.apiUrl, item.question.id);
    console.log(`Borrada: ${item.question.id}`);
  }

  console.log(`Listo. Borradas: ${toDelete.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
