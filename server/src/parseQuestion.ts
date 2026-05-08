import type { QuestionInput } from "./types.js";

const optionPattern = /^(\(?[A-Da-d1-9]\)?[\).:-]\s+|[-*]\s+)/;
const optionMarkerPattern = /^[A-Da-d][\).]$/;
const correctPattern = /(la\s+)?respuesta(s)?\s+correcta(s)?\s*(es|son)?\s*[:=-]\s*(.+)$/i;
const correctHeaderPattern = /(la\s+)?respuesta(s)?\s+correcta(s)?\s*(es|son)?\s*:?\s*$/i;

function cleanLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stripSelectionMarks(value: string) {
  return value.replace(/^[*✓✔]\s*/, "").replace(/\s*[✓✔]\s*$/, "").replace(/\s+O\)?$/i, "").trim();
}

function splitCorrectSection(lines: string[]) {
  const markerIndex = lines.findIndex((line) => correctHeaderPattern.test(line) || correctPattern.test(line));
  if (markerIndex === -1) {
    return { promptLines: lines, correctLines: [] as string[] };
  }

  const markerLine = lines[markerIndex];
  const inlineCorrect = markerLine.match(correctPattern)?.[5]?.trim();
  return {
    promptLines: lines.slice(0, markerIndex),
    correctLines: [inlineCorrect, ...lines.slice(markerIndex + 1)].filter((line): line is string => Boolean(line))
  };
}

function extractBracketAnswers(lines: string[]) {
  return lines.flatMap((line) =>
    Array.from(line.matchAll(/\[([^\]]+)\]/g))
      .map((match) => cleanLine(match[1]))
      .filter(Boolean)
  );
}

function detectOptionLines(lines: string[]) {
  const options: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (optionPattern.test(line)) {
      options.push(stripSelectionMarks(line.replace(optionPattern, "")));
      continue;
    }

    if (optionMarkerPattern.test(line) && lines[index + 1]) {
      options.push(stripSelectionMarks(lines[index + 1]));
      index += 1;
    }
  }

  return options.filter(Boolean);
}

function detectInlineChoiceLines(lines: string[]) {
  const inlineChoicePattern = /\b([A-Da-d])[\).:-]\s+.+/;
  return lines.filter((line) => inlineChoicePattern.test(line));
}

function isOptionLine(line: string) {
  return optionPattern.test(line) || optionMarkerPattern.test(line);
}

function detectBankOptions(lines: string[]) {
  const labeledOptions = detectOptionLines(lines);
  const shortOptions = lines.filter(
    (line) =>
      !isOptionLine(line) &&
      !/^seleccione una:?$/i.test(line) &&
      !correctHeaderPattern.test(line) &&
      !correctPattern.test(line) &&
      !isUiNoise(line) &&
      !line.includes("[") &&
      line.length >= 2 &&
      line.length <= 42 &&
      !/[.:?]$/.test(line)
  );

  return unique([...labeledOptions, ...shortOptions]);
}

function isUiNoise(line: string) {
  return /^(reinterpretar|tabla vacia|tabla vacía|respuestas|texto ocr original|lineas detectadas|líneas detectadas|multiple choice|drag and drop|tabla|enunciado|filas|columnas|blank|agregar|guardar importacion|guardar importación|constructor de tabla|opciones arrastrables y distractores)$/i.test(
    line.trim()
  );
}

function detectCorrectAnswer(lines: string[], options: string[]) {
  const { correctLines } = splitCorrectSection(lines);
  if (correctLines.length > 0) {
    const correctText = stripSelectionMarks(correctLines.join(" "));
    const matchingOption = options.find((option) => correctText.includes(option) || option.includes(correctText));
    return matchingOption ?? correctText;
  }

  const explicit = lines.map((line) => line.match(correctPattern)?.[5]?.trim()).find(Boolean);
  if (explicit) {
    return stripSelectionMarks(explicit);
  }

  const marked = lines.find((line) => /^[*✓✔]/.test(line.trim()) || /[✓✔]\s*$|\sO\)?$/i.test(line.trim()));
  if (marked) {
    return stripSelectionMarks(marked.replace(optionPattern, ""));
  }

  return "";
}

function makeDragSuggestion(text: string, lines: string[]): QuestionInput {
  const { promptLines, correctLines } = splitCorrectSection(lines);
  const optionLines = detectBankOptions(promptLines);
  const optionValues = new Set(optionLines);
  const bracketAnswers = extractBracketAnswers(correctLines);
  const statement =
    promptLines.find((line) => /completar|complete|arrastr|blank|espacio|supuestos|palabras/i.test(line) && !optionValues.has(line)) ??
    promptLines.find((line) => line.length > 45 && !optionValues.has(line)) ??
    "Completar la frase:";
  const phraseLines = promptLines.filter((line) => !isOptionLine(line) && !optionValues.has(line));
  const phrase = phraseLines.join(" ") || text;
  const phraseBracketMatches = Array.from(phrase.matchAll(/\[([^\]]+)\]|\(([^)]+)\)|_{2,}/g));
  const phraseAnswers = phraseBracketMatches
    .map((match) => match[1] ?? match[2] ?? "")
    .filter((value) => value && !/_{2,}/.test(value));
  const correctAnswers = bracketAnswers.length > 0 ? bracketAnswers : phraseAnswers;

  let renderedPhrase = phrase;
  for (const answer of phraseAnswers) {
    renderedPhrase = renderedPhrase.replace(`[${answer}]`, "__blank__").replace(`(${answer})`, "__blank__");
  }

  const inferredBlankCount = correctAnswers.length > 0 ? correctAnswers.length : inferBlankCount(renderedPhrase, optionLines.length);
  if (!renderedPhrase.includes("__blank__")) {
    renderedPhrase = `${renderedPhrase} ${Array.from({ length: inferredBlankCount }, () => "__blank__").join(" ")}`;
  }

  const fallbackAnswers = correctAnswers.length > 0 ? correctAnswers : Array.from({ length: inferredBlankCount }, () => "");
  const draggableOptions = unique([...optionLines, ...fallbackAnswers]);

  return {
    type: "drag_and_drop",
    statement,
    textParts: renderedPhrase.split(/(__blank__)/).map(cleanLine).filter(Boolean),
    draggableOptions: draggableOptions.length > 0 ? draggableOptions : ["opcion correcta", "distractor"],
    correctAnswers: fallbackAnswers.length > 0 ? fallbackAnswers : [""],
    ocrText: text
  };
}

function inferBlankCount(phrase: string, optionCount: number) {
  const explicitBlanks = (phrase.match(/__blank__|_{2,}|\[\s*\]|\(\s*\)|□/g) ?? []).length;
  if (explicitBlanks > 0) {
    return explicitBlanks;
  }

  const commaGaps = (phrase.match(/,\s*,|:\s*,|,\s*\./g) ?? []).length;
  if (commaGaps > 0) {
    return Math.min(Math.max(commaGaps + 1, 1), Math.max(optionCount, 1));
  }

  if (optionCount >= 4) {
    return 4;
  }

  return Math.max(optionCount, 1);
}

function makeMultipleChoiceSuggestion(text: string, lines: string[]): QuestionInput {
  const { promptLines } = splitCorrectSection(lines);
  const options = unique(detectOptionLines(promptLines));
  const optionValues = new Set(options);
  const statementLines = promptLines.filter(
    (line) =>
      !isOptionLine(line) &&
      !optionValues.has(stripSelectionMarks(line)) &&
      !correctPattern.test(line) &&
      !/^seleccione una:?$/i.test(line)
  );
  const statement = statementLines[0] ?? promptLines[0] ?? lines[0] ?? "Pregunta importada";
  const correctAnswer = detectCorrectAnswer(lines, options);
  const safeOptions = unique([...options, correctAnswer]).filter(Boolean);

  return {
    type: "multiple_choice",
    statement,
    options: safeOptions.length >= 2 ? safeOptions : unique([correctAnswer, "opcion falsa 1", "opcion falsa 2"]),
    correctAnswer,
    ocrText: text
  };
}

function makeTableSuggestion(text: string, lines: string[]): QuestionInput {
  const { promptLines, correctLines } = splitCorrectSection(lines);
  const options = unique([...detectBankOptions(promptLines), ...extractBracketAnswers(correctLines)]).slice(0, 16);
  const baseOptions = options.length > 0 ? options : ["By", "Vector Base", "costo de oportunidad", "valor marginal"];
  const bracketRows = correctLines
    .map((line) => extractBracketAnswers([line]))
    .filter((answers) => answers.length > 0);

  if (bracketRows.length > 0) {
    const rows = bracketRows.length;
    const columns = Math.max(...bracketRows.map((row) => row.length), 1);
    const cells = Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const answer = bracketRows[row]?.[col] ?? "";
      return {
        row,
        col,
        content: answer ? "" : "",
        isBlank: Boolean(answer),
        correctAnswer: answer
      };
    });

    return {
      type: "table_drag_and_drop",
      statement: promptLines[0] ?? lines[0] ?? "Completar la tabla:",
      table: { rows, columns, cells },
      draggableOptions: baseOptions,
      ocrText: text
    };
  }

  const rows = 4;
  const columns = 4;
  const cells = Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const option = baseOptions[index] ?? "";
    const blankAnswer = baseOptions[col] ?? baseOptions[0] ?? "";
    return {
      row,
      col,
      content: index < columns ? option : "",
      isBlank: index >= columns && index < columns + Math.min(baseOptions.length, columns),
      correctAnswer: index >= columns && index < columns + Math.min(baseOptions.length, columns) ? blankAnswer : ""
    };
  });

  return {
    type: "table_drag_and_drop",
    statement: promptLines[0] ?? lines[0] ?? "Completar la tabla:",
    table: { rows, columns, cells },
    draggableOptions: baseOptions,
    ocrText: text
  };
}

function hasDenseTableSignals(lines: string[], text: string) {
  const joined = [text, ...lines].join(" ");
  const explicitTableWords = /tabla|celda|cuadro|fila|filas|columna|columnas/i.test(joined);
  const simplexStructureWords = /vector base|var\.?base|coeficientes de var\.?base|cj[-\s]?zj|zj[-\s]?cj|renglon|rengl[oó]n|restricci[oó]n\s*\d/i.test(joined);
  const bracketCount = (joined.match(/\[[^\]]+\]/g) ?? []).length;
  const numericGridLines = lines.filter((line) => /(\s{2,}|\t)/.test(line) && /\d/.test(line)).length;
  const manyShortTokensLines = lines.filter((line) => line.split(/\s+/).length >= 4 && line.split(/\s+/).every((token) => token.length <= 12)).length;

  return explicitTableWords || simplexStructureWords || bracketCount >= 2 || numericGridLines >= 2 || manyShortTokensLines >= 2;
}

function hasStrongMultipleChoiceSignals(promptLines: string[]) {
  const optionLines = detectOptionLines(promptLines);
  const inlineChoiceLines = detectInlineChoiceLines(promptLines);
  const selectionHeader = promptLines.some((line) => /^seleccione una:?$/i.test(line) || /^marque una:?$/i.test(line));
  return optionLines.length >= 2 || inlineChoiceLines.length >= 2 || (selectionHeader && (optionLines.length >= 1 || inlineChoiceLines.length >= 1));
}

export function parseQuestionFromOcr(text: string): QuestionInput {
  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const { promptLines, correctLines } = splitCorrectSection(lines);
  const bankOptions = detectBankOptions(promptLines);
  const hasManyBankOptions = bankOptions.length >= 4;
  const hasMultipleChoiceMarkers = hasStrongMultipleChoiceSignals(promptLines);
  const hasBracketedCorrectTable = correctLines.some((line) => /\[[^\]]+\]/.test(line));
  const strongTableSignals = hasDenseTableSignals(lines, text);
  const mentionsSimplexOnly = /simplex|slack|by\b/i.test(text);
  const shouldBeTable =
    (hasBracketedCorrectTable || strongTableSignals || (mentionsSimplexOnly && !hasMultipleChoiceMarkers && bankOptions.length <= 2)) &&
    !hasMultipleChoiceMarkers &&
    !/supuestos|proporcionalidad|aditividad|divisibilidad|certidumbre|no negatividad/i.test(promptLines.join(" "));
  const shouldBeDrag =
    (/__+|completar|complete|arrastr|drag|drop|blank|espacio|cajas|supuestos|palabras simples/i.test(text) || (hasManyBankOptions && !hasMultipleChoiceMarkers)) &&
    !hasMultipleChoiceMarkers;

  if (shouldBeTable) {
    return makeTableSuggestion(text, lines);
  }

  if (shouldBeDrag) {
    return makeDragSuggestion(text, lines);
  }

  return makeMultipleChoiceSuggestion(text, lines);
}
