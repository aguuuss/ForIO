import type { DragTable, Question, QuestionInput, QuestionType, SubjectInput, SubjectSummary } from "@/types/questions";

export type SubjectDraft = Required<Pick<SubjectInput, "subjectSlug" | "subjectName" | "careerName" | "yearNumber">>;

export const defaultSubjectDraft: SubjectDraft = {
  subjectSlug: "investigacion-operativa",
  subjectName: "Investigacion Operativa",
  careerName: "Ingenieria en Sistemas",
  yearNumber: 4
};

export function cleanList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function parseDragTextParts(rawValue: string) {
  if (!rawValue.includes("|")) {
    return rawValue
      .split(/(__blank__)/)
      .map((part) => (part.trim() === "__blank__" ? "__blank__" : part))
      .filter((part) => part === "__blank__" || part.length > 0);
  }

  return rawValue
    .split("|")
    .map((part) => {
      const trimmed = part.trim();
      return trimmed === "__blank__" ? "__blank__" : part;
    })
    .filter((part) => part === "__blank__" || part.trim().length > 0);
}

export function makeEmptyTable(rows: number, columns: number): DragTable {
  return {
    rows,
    columns,
    cells: Array.from({ length: rows * columns }, (_, index) => ({
      row: Math.floor(index / columns),
      col: index % columns,
      content: "",
      isBlank: false,
      correctAnswer: ""
    }))
  };
}

export function tableBlankCells(table: DragTable) {
  return table.cells.filter((cell) => cell.isBlank);
}

function normalizeAnswer(value = "") {
  return value.trim().toLowerCase();
}

export function isAcceptedTableAnswer(answer = "", correctAnswer = "", acceptedAnswers: string[] = []) {
  const normalizedAnswer = normalizeAnswer(answer);
  return [correctAnswer, ...acceptedAnswers].some((accepted) => normalizeAnswer(accepted) === normalizedAnswer);
}

export function normalizeQuestionInput(question: QuestionInput): QuestionInput {
  if (question.type !== "table_drag_and_drop") {
    return question;
  }

  return {
    ...question,
    draggableOptions: cleanList([
      ...question.draggableOptions,
      ...tableBlankCells(question.table).flatMap((cell) => [cell.correctAnswer ?? "", ...(cell.acceptedAnswers ?? [])])
    ])
  };
}

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function subjectDraftFromSubject(subject?: SubjectSummary | null): SubjectDraft {
  if (!subject) {
    return defaultSubjectDraft;
  }

  return {
    subjectSlug: subject.slug,
    subjectName: subject.name,
    careerName: subject.careerName,
    yearNumber: subject.yearNumber
  };
}

export function uniqueWords(text: string) {
  const seen = new Set<string>();
  return text
    .split(/\s+/)
    .map((word) => word.trim().replace(/[.,;:!?()[\]{}]/g, ""))
    .filter((word) => word.length > 2)
    .filter((word) => {
      const lower = word.toLowerCase();
      if (seen.has(lower)) {
        return false;
      }
      seen.add(lower);
      return true;
    });
}

export function uniqueList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function firstStatementLine(lines: string[], fallbackText: string) {
  return lines.find((line) => /\w/.test(line) && !/^[a-d][).:-]/i.test(line.trim()))?.trim() || fallbackText.trim();
}

export function extractAnswerGroups(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[a-z0-9][).:-]\s*/i, ""))
    .filter(Boolean)
    .map((line) => {
      const [primary, ...rest] = line.split(/\s*\/\s*|\s+\bo\b\s+/i).map((part) => part.trim()).filter(Boolean);
      return {
        primary: primary ?? "",
        alternatives: rest
      };
    })
    .filter((group) => group.primary);
}

export function splitAlternativeAnswers(value: string) {
  return value
    .split(/\s*\/\s*|\s+\bo\b\s+/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function flattenAnswerGroups(groups: Array<{ primary: string; alternatives: string[] }>) {
  return groups.flatMap((group) => [group.primary, ...group.alternatives]);
}

export function uniqueAnswerGroups(groups: Array<{ primary: string; alternatives: string[] }>) {
  const seen = new Set<string>();
  return groups.filter((group) => {
    const key = [group.primary, ...group.alternatives].join("|").toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function extractShortOptionsFromLines(lines: string[]) {
  return uniqueList(
    lines
      .map((line) => line.trim())
      .filter((line) => /^[a-z0-9][).:-]\s+/i.test(line))
      .map((line) => line.replace(/^[a-z0-9][).:-]\s*/i, ""))
      .filter((line) => line.length <= 120)
  );
}

export function isImportUiNoise(line: string) {
  return /^(guardar|reprocesar|eliminar|importar|tabla|ocr|arrastrar|soltar|subir)$/i.test(line.trim());
}

export function questionTypeLabel(type: QuestionType) {
  if (type === "multiple_choice") {
    return "Multiple choice";
  }
  if (type === "drag_and_drop") {
    return "Frase";
  }
  return "Tabla";
}

export function questionSearchText(question: Question) {
  const base = [question.statement, question.subject.name, question.subject.careerName, questionTypeLabel(question.type)];
  if (question.type === "multiple_choice") {
    base.push(...question.options, question.correctAnswer);
  } else if (question.type === "drag_and_drop") {
    base.push(...question.textParts, ...question.draggableOptions, ...question.correctAnswers);
  } else {
    base.push(...question.draggableOptions, ...question.table.cells.map((cell) => cell.content), ...tableBlankCells(question.table).map((cell) => cell.correctAnswer ?? ""));
  }
  return base.join(" ").toLowerCase();
}
