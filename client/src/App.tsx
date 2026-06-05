import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  ClipboardList,
  FileImage,
  GraduationCap,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Wand2,
  XCircle
} from "lucide-react";
import {
  createQuestion,
  createQuestionsBulk,
  deleteQuestion,
  getQuestions,
  getOcrStatus,
  parseQuestionFromText,
  updateQuestion,
  uploadOcrImages
} from "./api";
import type { OcrUploadResult } from "./api";
import type { OcrStatus } from "./api";
import DragDropAnswer from "./components/DragDropAnswer";
import TableDragDropAnswer, { cellKey } from "./components/TableDragDropAnswer";
import type {
  DragAndDropQuestion,
  DragTable,
  MatchingDropdownQuestion,
  MatchingPair,
  MultipleChoiceQuestion,
  NumericAnswerQuestion,
  Question,
  QuestionInput,
  QuestionType,
  TableDragAndDropQuestion
} from "./types/questions";

const emptyMc: Omit<MultipleChoiceQuestion, "id"> = {
  type: "multiple_choice",
  statement: "",
  options: ["", ""],
  correctAnswer: ""
};

const emptyDnd: Omit<DragAndDropQuestion, "id"> = {
  type: "drag_and_drop",
  statement: "",
  textParts: ["", "__blank__", ""],
  draggableOptions: ["", "", ""],
  correctAnswers: [""]
};

const emptyTable: Omit<TableDragAndDropQuestion, "id"> = {
  type: "table_drag_and_drop",
  statement: "",
  table: makeEmptyTable(3, 3),
  draggableOptions: ["", "", ""]
};

const emptyMatching: Omit<MatchingDropdownQuestion, "id"> = {
  type: "matching_dropdown",
  statement: "",
  pairs: [
    { label: "", correctAnswer: "" },
    { label: "", correctAnswer: "" }
  ],
  options: ["", ""]
};

const emptyNumeric: Omit<NumericAnswerQuestion, "id"> = {
  type: "numeric_answer",
  statement: "",
  correctAnswer: "",
  acceptedAnswers: []
};

const OCR_TOKEN_STORAGE_KEY = "forio-ocr-token";
const SECOND_PARTIAL = "2do parcial";

function cleanList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function parseDragTextParts(rawValue: string) {
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

function makeEmptyTable(rows: number, columns: number): DragTable {
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

function tableBlankCells(table: DragTable) {
  return table.cells.filter((cell) => cell.isBlank);
}

function normalizeAnswer(value = "") {
  return value.trim().toLowerCase();
}

function isAcceptedTableAnswer(answer = "", correctAnswer = "", acceptedAnswers: string[] = []) {
  const normalizedAnswer = normalizeAnswer(answer);
  return [correctAnswer, ...acceptedAnswers].some((accepted) => normalizeAnswer(accepted) === normalizedAnswer);
}

function matchingKey(index: number) {
  return `match-${index}`;
}

function evaluateMatchingAnswers(question: MatchingDropdownQuestion, answers: Record<string, string>) {
  return Object.fromEntries(
    question.pairs.map((pair, index) => [matchingKey(index), normalizeAnswer(answers[matchingKey(index)]) === normalizeAnswer(pair.correctAnswer)])
  );
}

function matchingCorrectText(question: MatchingDropdownQuestion) {
  return question.pairs.map((pair) => `${pair.label}: ${pair.correctAnswer}`).join(" / ");
}

function isAcceptedTextAnswer(answer = "", correctAnswer = "", acceptedAnswers: string[] = []) {
  const normalizedAnswer = normalizeAnswer(answer);
  return [correctAnswer, ...acceptedAnswers].some((accepted) => normalizeAnswer(accepted) === normalizedAnswer);
}

function numericCorrectText(question: NumericAnswerQuestion) {
  return [question.correctAnswer, ...(question.acceptedAnswers ?? [])].filter(Boolean).join(" / ");
}

function examAnswerText(question: Question, answer: ExamAnswer | null, tableResults?: Record<string, boolean>) {
  if (!answer) {
    return "Sin respuesta";
  }
  if (answer.type === "multiple_choice") {
    return answer.selected;
  }
  if (answer.type === "drag_and_drop") {
    return answer.answers.join(" / ");
  }
  if (answer.type === "table_drag_and_drop" && question.type === "table_drag_and_drop") {
    return tableBlankCells(question.table)
      .map((cell) => {
        const key = cellKey(cell.row, cell.col);
        const val = answer.answers[key];
        const ok = tableResults?.[key];
        return `(${cell.row + 1},${cell.col + 1}) ${val ?? "—"}${ok !== undefined ? (ok ? " ✓" : " ✗") : ""}`;
      })
      .join(" / ");
  }
  if (answer.type === "matching_dropdown" && question.type === "matching_dropdown") {
    return question.pairs
      .map((pair, pairIndex) => {
        const key = matchingKey(pairIndex);
        const val = answer.answers[key];
        const ok = tableResults?.[key];
        return `${pair.label}: ${val ?? "—"}${ok !== undefined ? (ok ? " ✓" : " ✗") : ""}`;
      })
      .join(" / ");
  }
  if (answer.type === "numeric_answer") {
    return answer.answer;
  }
  return "Sin respuesta";
}

function normalizeQuestionInput(question: QuestionInput): QuestionInput {
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

function markQuestionAsSecondPartial(question: QuestionInput, enabled: boolean): QuestionInput {
  return enabled ? { ...question, partial: SECOND_PARTIAL } : question;
}

type ImportDraft = OcrUploadResult & {
  id: string;
};

type TableImportBuilder = {
  statement: string;
  table: DragTable;
  options: string[];
  detectedAnswers: Array<{
    primary: string;
    alternatives: string[];
  }>;
  nextAnswerIndex: number;
};

type LoadQuestionsOptions = {
  silent?: boolean;
};

export default function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [path, setPath] = useState(window.location.pathname);

  async function loadQuestions(options: LoadQuestionsOptions = {}) {
    if (!options.silent) {
      setLoading(true);
    }
    setError("");
    try {
      setQuestions(await getQuestionsWithRetry());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las preguntas.");
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }

  async function getQuestionsWithRetry() {
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await getQuestions();
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => window.setTimeout(resolve, 450 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextPath: string) {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigate("/")}>
          <ClipboardList size={22} />
          Quiz Simplex
        </button>
        <nav>
          <button className={path === "/" ? "active" : ""} type="button" onClick={() => navigate("/")}>
            Practica
          </button>
          <button className={`${path === "/exam" ? "active" : ""} exam-nav-btn`} type="button" onClick={() => navigate("/exam")}>
            <GraduationCap size={16} />
            Examen
          </button>
          <button className={path === "/admin" ? "active" : ""} type="button" onClick={() => navigate("/admin")}>
            Admin
          </button>
          <button className={path === "/admin/import" ? "active" : ""} type="button" onClick={() => navigate("/admin/import")}>
            Importar
          </button>
        </nav>
      </header>

      {loading ? <main className="main">Cargando preguntas...</main> : null}
      {error ? (
        <main className="main error-box">
          <h1>No pude cargar las preguntas</h1>
          <p>{error}</p>
          <button className="primary-button" type="button" onClick={() => loadQuestions()}>
            <RotateCcw size={18} />
            Reintentar
          </button>
        </main>
      ) : null}
      {!loading && !error && path === "/admin/import" ? (
        <ImportPage onSaved={() => loadQuestions({ silent: true })} />
      ) : null}
      {!loading && !error && path === "/admin" ? (
        <AdminPage questions={questions} onChange={() => loadQuestions({ silent: true })} />
      ) : null}
      {!loading && !error && path === "/exam" ? (
        <ExamPage questions={questions} />
      ) : null}
      {!loading && !error && path !== "/admin" && path !== "/admin/import" && path !== "/exam" ? <PracticePage questions={questions} /> : null}
    </div>
  );
}

const EXAM_QUESTION_COUNT = 50;

type ExamAnswer =
  | { type: "multiple_choice"; selected: string }
  | { type: "drag_and_drop"; answers: string[] }
  | { type: "table_drag_and_drop"; answers: Record<string, string> }
  | { type: "matching_dropdown"; answers: Record<string, string> }
  | { type: "numeric_answer"; answer: string };

type ExamQuestionResult = {
  question: Question;
  answer: ExamAnswer | null;
  isCorrect: boolean;
  tableResults?: Record<string, boolean>;
};

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function evaluateExamAnswer(question: Question, answer: ExamAnswer | null): { isCorrect: boolean; tableResults?: Record<string, boolean> } {
  if (!answer) {
    return { isCorrect: false };
  }
  if (question.type === "multiple_choice" && answer.type === "multiple_choice") {
    return { isCorrect: answer.selected === question.correctAnswer };
  }
  if (question.type === "drag_and_drop" && answer.type === "drag_and_drop") {
    return {
      isCorrect: question.correctAnswers.every((correctAnswer, i) => answer.answers[i] === correctAnswer)
    };
  }
  if (question.type === "table_drag_and_drop" && answer.type === "table_drag_and_drop") {
    const tableResults = Object.fromEntries(
      tableBlankCells(question.table).map((cell) => {
        const key = cellKey(cell.row, cell.col);
        return [key, isAcceptedTableAnswer(answer.answers[key], cell.correctAnswer, cell.acceptedAnswers)];
      })
    );
    return { isCorrect: Object.values(tableResults).every(Boolean), tableResults };
  }
  if (question.type === "matching_dropdown" && answer.type === "matching_dropdown") {
    const tableResults = evaluateMatchingAnswers(question, answer.answers);
    return { isCorrect: Object.values(tableResults).every(Boolean), tableResults };
  }
  if (question.type === "numeric_answer" && answer.type === "numeric_answer") {
    return { isCorrect: isAcceptedTextAnswer(answer.answer, question.correctAnswer, question.acceptedAnswers) };
  }
  return { isCorrect: false };
}

function ExamPage({ questions }: { questions: Question[] }) {
  const [examQuestions, setExamQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [collectedAnswers, setCollectedAnswers] = useState<(ExamAnswer | null)[]>([]);
  const [results, setResults] = useState<ExamQuestionResult[] | null>(null);

  const [selected, setSelected] = useState("");
  const [dndAnswers, setDndAnswers] = useState<string[]>([]);
  const [tableAnswers, setTableAnswers] = useState<Record<string, string>>({});
  const [matchingAnswers, setMatchingAnswers] = useState<Record<string, string>>({});
  const [numericAnswer, setNumericAnswer] = useState("");
  const [checked, setChecked] = useState<null | boolean>(null);
  const [currentTableResults, setCurrentTableResults] = useState<Record<string, boolean>>({});

  function resetCurrentAnswer() {
    setSelected("");
    setDndAnswers([]);
    setTableAnswers({});
    setMatchingAnswers({});
    setNumericAnswer("");
    setChecked(null);
    setCurrentTableResults({});
  }

  function startExam() {
    const shuffled = shuffleArray(questions);
    const picked = shuffled.slice(0, Math.min(EXAM_QUESTION_COUNT, shuffled.length));
    setExamQuestions(picked);
    setIndex(0);
    setCollectedAnswers([]);
    setResults(null);
    resetCurrentAnswer();
  }

  function goBack() {
    setExamQuestions(null);
    setResults(null);
    setIndex(0);
    setCollectedAnswers([]);
    resetCurrentAnswer();
  }

  function buildCurrentAnswer(question: Question): ExamAnswer | null {
    if (question.type === "multiple_choice") {
      return selected ? { type: "multiple_choice", selected } : null;
    }
    if (question.type === "drag_and_drop") {
      return dndAnswers.length > 0 ? { type: "drag_and_drop", answers: dndAnswers } : null;
    }
    if (question.type === "table_drag_and_drop") {
      return Object.keys(tableAnswers).length > 0 ? { type: "table_drag_and_drop", answers: tableAnswers } : null;
    }
    if (question.type === "matching_dropdown") {
      return Object.keys(matchingAnswers).length > 0 ? { type: "matching_dropdown", answers: matchingAnswers } : null;
    }
    return numericAnswer.trim() ? { type: "numeric_answer", answer: numericAnswer } : null;
  }

  function validate() {
    if (!examQuestions) return;
    const question = examQuestions[index];
    const answer = buildCurrentAnswer(question);
    const { isCorrect, tableResults } = evaluateExamAnswer(question, answer);
    setChecked(isCorrect);
    if (tableResults) {
      setCurrentTableResults(tableResults);
    }
    setCollectedAnswers((current) => {
      const next = [...current];
      next[index] = answer;
      return next;
    });
  }

  function next() {
    if (!examQuestions) return;
    if (index + 1 >= examQuestions.length) {
      const finalAnswers = collectedAnswers;
      const examResults: ExamQuestionResult[] = examQuestions.map((question, i) => {
        const ans = finalAnswers[i] ?? null;
        const { isCorrect, tableResults } = evaluateExamAnswer(question, ans);
        return { question, answer: ans, isCorrect, tableResults };
      });
      setResults(examResults);
    } else {
      setIndex((current) => current + 1);
      resetCurrentAnswer();
    }
  }

  if (questions.length === 0) {
    return (
      <main className="main empty-state">
        <h1>No hay preguntas cargadas</h1>
        <p>Entrá al admin para crear la primera.</p>
      </main>
    );
  }

  if (results) {
    const score = results.filter((r) => r.isCorrect).length;
    const total = results.length;
    const pct = Math.round((score / total) * 100);
    const passed = pct >= 60;

    return (
      <main className="main exam-results-page">
        <section className="exam-results-header">
          <div className={`exam-score-badge ${passed ? "passed" : "failed"}`}>
            <GraduationCap size={36} />
            <span className="exam-score-number">{score}/{total}</span>
            <span className="exam-score-pct">{pct}%</span>
            <span className="exam-score-label">{passed ? "Aprobado" : "Desaprobado"}</span>
          </div>
          <div className="exam-results-stats">
            <div className="exam-stat correct">
              <CheckCircle2 size={20} />
              <span><strong>{score}</strong> correctas</span>
            </div>
            <div className="exam-stat incorrect">
              <XCircle size={20} />
              <span><strong>{total - score}</strong> incorrectas</span>
            </div>
          </div>
          <div className="exam-results-actions">
            <button className="primary-button" type="button" onClick={startExam}>
              <RotateCcw size={18} />
              Nuevo examen
            </button>
            <button className="ghost-button" type="button" onClick={goBack}>
              Volver
            </button>
          </div>
        </section>

        <section className="exam-review-list">
          <h2>Revisión de respuestas</h2>
          {results.map((result, i) => (
            <ExamResultItem key={result.question.id} index={i} result={result} />
          ))}
        </section>
      </main>
    );
  }

  if (!examQuestions) {
    const count = Math.min(EXAM_QUESTION_COUNT, questions.length);
    return (
      <main className="main exam-landing">
        <section className="quiz-card exam-start-card">
          <div className="exam-start-icon">
            <GraduationCap size={48} />
          </div>
          <h1>Modo Examen</h1>
          <p className="exam-start-desc">
            Se seleccionarán <strong>{count} preguntas aleatorias</strong> del banco de{" "}
            <strong>{questions.length} preguntas</strong>.
          </p>
          <ul className="exam-rules">
            <li>Respondé cada pregunta y validá con <strong>Validar</strong></li>
            <li>Verás el resultado de cada respuesta antes de continuar</li>
            <li>Al terminar verás tu puntaje final y la revisión completa</li>
          </ul>
          <button className="primary-button exam-start-btn" type="button" onClick={startExam}>
            <GraduationCap size={20} />
            Iniciar examen
          </button>
        </section>
      </main>
    );
  }

  const question = examQuestions[index];
  const total = examQuestions.length;

  const canValidate =
    question.type === "multiple_choice"
      ? Boolean(selected)
      : question.type === "drag_and_drop"
        ? dndAnswers.filter(Boolean).length === question.correctAnswers.length
        : question.type === "table_drag_and_drop"
          ? tableBlankCells(question.table).every((cell) => Boolean(tableAnswers[cellKey(cell.row, cell.col)]))
          : question.type === "matching_dropdown"
            ? question.pairs.every((_, pairIndex) => Boolean(matchingAnswers[matchingKey(pairIndex)]))
            : Boolean(numericAnswer.trim());

  const progress = (index / total) * 100;

  return (
    <main className="main">
      <section className="quiz-card">
        <div className="exam-progress-bar">
          <div className="exam-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="quiz-meta">
          <span>
            Pregunta {index + 1} de {total}
          </span>
          <span className="exam-mode-badge">
            <GraduationCap size={14} />
            Modo Examen
          </span>
        </div>

        <h1>{question.statement}</h1>

        {question.type === "multiple_choice" ? (
          <div className="choices">
            {question.options.map((option) => (
              <button
                className={`choice ${selected === option ? "selected" : ""}`}
                disabled={checked !== null}
                key={option}
                type="button"
                onClick={() => setSelected(option)}
              >
                {option}
              </button>
            ))}
          </div>
        ) : question.type === "drag_and_drop" ? (
          <DragDropAnswer
            key={question.id}
            textParts={question.textParts}
            options={question.draggableOptions}
            disabled={checked !== null}
            onChange={setDndAnswers}
          />
        ) : question.type === "table_drag_and_drop" ? (
          <TableDragDropAnswer
            key={question.id}
            table={question.table}
            options={question.draggableOptions}
            disabled={checked !== null}
            results={checked !== null ? currentTableResults : undefined}
            onChange={setTableAnswers}
          />
        ) : question.type === "matching_dropdown" ? (
          <MatchingDropdownAnswer
            question={question}
            answers={matchingAnswers}
            disabled={checked !== null}
            results={checked !== null ? currentTableResults : undefined}
            onChange={setMatchingAnswers}
          />
        ) : (
          <NumericAnswerInput value={numericAnswer} disabled={checked !== null} onChange={setNumericAnswer} />
        )}

        {checked !== null ? <Feedback question={question} isCorrect={checked} /> : null}

        <div className="actions-row">
          {checked === null ? (
            <button className="primary-button" type="button" disabled={!canValidate} onClick={validate}>
              <CheckCircle2 size={18} />
              Validar
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={next}>
              {index + 1 === total ? "Ver resultados" : "Siguiente"}
            </button>
          )}
        </div>
      </section>
      <div className="practice-footer">
        <button className="ghost-button" type="button" onClick={goBack}>
          Abandonar examen
        </button>
      </div>
    </main>
  );
}

function ExamResultItem({ index, result }: { index: number; result: ExamQuestionResult }) {
  const { question, answer, isCorrect, tableResults } = result;

  const correctText =
    question.type === "multiple_choice"
      ? question.correctAnswer
      : question.type === "drag_and_drop"
        ? question.correctAnswers.join(" / ")
        : question.type === "table_drag_and_drop"
          ? tableBlankCells(question.table)
              .map((cell) => `(${cell.row + 1},${cell.col + 1}) ${[cell.correctAnswer, ...(cell.acceptedAnswers ?? [])].filter(Boolean).join(" o ")}`)
              .join(" / ")
          : question.type === "matching_dropdown"
            ? matchingCorrectText(question)
            : numericCorrectText(question);

  const userAnswerText = examAnswerText(question, answer, tableResults);

  return (
    <article className={`exam-review-item ${isCorrect ? "review-correct" : "review-incorrect"}`}>
      <div className="exam-review-header">
        <span className="exam-review-num">{index + 1}</span>
        <span className="exam-review-status">
          {isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          {isCorrect ? "Correcta" : "Incorrecta"}
        </span>
        <span className="type-pill">{questionTypeLabel(question.type)}</span>
      </div>
      <p className="exam-review-statement">{question.statement}</p>
      <div className="exam-review-answers">
        {!isCorrect && (
          <span className="exam-answer-row user-answer">
            <strong>Tu respuesta:</strong> {userAnswerText}
          </span>
        )}
        <span className="exam-answer-row correct-answer">
          <strong>Respuesta correcta:</strong> {correctText}
        </span>
      </div>
    </article>
  );
}

function PracticePage({ questions }: { questions: Question[] }) {
  const [practiceQuestions, setPracticeQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState("");
  const [dndAnswers, setDndAnswers] = useState<string[]>([]);
  const [tableAnswers, setTableAnswers] = useState<Record<string, string>>({});
  const [matchingAnswers, setMatchingAnswers] = useState<Record<string, string>>({});
  const [numericAnswer, setNumericAnswer] = useState("");
  const [tableResults, setTableResults] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState<null | boolean>(null);
  const activeQuestions = practiceQuestions ?? [];
  const question = activeQuestions[index];
  const isFinished = index >= activeQuestions.length;

  function resetAnswer() {
    setSelected("");
    setDndAnswers([]);
    setTableAnswers({});
    setMatchingAnswers({});
    setNumericAnswer("");
    setTableResults({});
    setChecked(null);
  }

  function restart() {
    setIndex(0);
    setScore(0);
    resetAnswer();
  }

  function startPractice(nextQuestions: Question[]) {
    setPracticeQuestions(nextQuestions);
    setIndex(0);
    setScore(0);
    resetAnswer();
  }

  function backToPicker() {
    setPracticeQuestions(null);
    setIndex(0);
    setScore(0);
    resetAnswer();
  }

  function validate() {
    if (!question) {
      return;
    }

    let isCorrect = false;
    if (question.type === "multiple_choice") {
      isCorrect = selected === question.correctAnswer;
    }
    if (question.type === "drag_and_drop") {
      isCorrect = question.correctAnswers.every((answer, answerIndex) => dndAnswers[answerIndex] === answer);
    }
    if (question.type === "table_drag_and_drop") {
      const results = Object.fromEntries(
        tableBlankCells(question.table).map((cell) => {
          const key = cellKey(cell.row, cell.col);
          return [key, isAcceptedTableAnswer(tableAnswers[key], cell.correctAnswer, cell.acceptedAnswers)];
        })
      );
      setTableResults(results);
      isCorrect = Object.values(results).every(Boolean);
    }
    if (question.type === "matching_dropdown") {
      const results = evaluateMatchingAnswers(question, matchingAnswers);
      setTableResults(results);
      isCorrect = Object.values(results).every(Boolean);
    }
    if (question.type === "numeric_answer") {
      isCorrect = isAcceptedTextAnswer(numericAnswer, question.correctAnswer, question.acceptedAnswers);
    }

    setChecked(isCorrect);
    if (isCorrect) {
      setScore((current) => current + 1);
    }
  }

  function next() {
    setIndex((current) => current + 1);
    resetAnswer();
  }

  if (questions.length === 0) {
    return (
      <main className="main empty-state">
        <h1>No hay preguntas cargadas</h1>
        <p>Entrá al admin para crear la primera.</p>
      </main>
    );
  }

  if (!practiceQuestions) {
    return <PracticePicker questions={questions} onStart={startPractice} />;
  }

  if (isFinished) {
    return (
      <main className="main result-panel">
        <h1>Resumen final</h1>
        <p className="score-big">
          {score}/{activeQuestions.length}
        </p>
        <p>Respondiste correctamente el {Math.round((score / activeQuestions.length) * 100)}%.</p>
        <button className="primary-button" type="button" onClick={restart}>
          <RotateCcw size={18} />
          Reiniciar quiz
        </button>
        <button className="ghost-button" type="button" onClick={backToPicker}>
          Elegir otras preguntas
        </button>
      </main>
    );
  }

  const canValidate =
    question.type === "multiple_choice"
      ? Boolean(selected)
      : question.type === "drag_and_drop"
        ? dndAnswers.filter(Boolean).length === question.correctAnswers.length
        : question.type === "table_drag_and_drop"
          ? tableBlankCells(question.table).every((cell) => Boolean(tableAnswers[cellKey(cell.row, cell.col)]))
          : question.type === "matching_dropdown"
            ? question.pairs.every((_, pairIndex) => Boolean(matchingAnswers[matchingKey(pairIndex)]))
            : Boolean(numericAnswer.trim());

  return (
    <main className="main">
      <section className="quiz-card">
        <div className="quiz-meta">
          <span>
            Pregunta {index + 1} de {activeQuestions.length}
          </span>
          <strong>Puntaje: {score}</strong>
        </div>

        <h1>{question.statement}</h1>

        {question.type === "multiple_choice" ? (
          <div className="choices">
            {question.options.map((option) => (
              <button
                className={`choice ${selected === option ? "selected" : ""}`}
                disabled={checked !== null}
                key={option}
                type="button"
                onClick={() => setSelected(option)}
              >
                {option}
              </button>
            ))}
          </div>
        ) : question.type === "drag_and_drop" ? (
          <DragDropAnswer
            key={question.id}
            textParts={question.textParts}
            options={question.draggableOptions}
            disabled={checked !== null}
            onChange={setDndAnswers}
          />
        ) : question.type === "table_drag_and_drop" ? (
          <TableDragDropAnswer
            key={question.id}
            table={question.table}
            options={question.draggableOptions}
            disabled={checked !== null}
            results={checked !== null ? tableResults : undefined}
            onChange={setTableAnswers}
          />
        ) : question.type === "matching_dropdown" ? (
          <MatchingDropdownAnswer
            question={question}
            answers={matchingAnswers}
            disabled={checked !== null}
            results={checked !== null ? tableResults : undefined}
            onChange={setMatchingAnswers}
          />
        ) : (
          <NumericAnswerInput value={numericAnswer} disabled={checked !== null} onChange={setNumericAnswer} />
        )}

        {checked !== null ? <Feedback question={question} isCorrect={checked} /> : null}

        <div className="actions-row">
          {checked === null ? (
            <button className="primary-button" type="button" disabled={!canValidate} onClick={validate}>
              <CheckCircle2 size={18} />
              Validar
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={next}>
              Siguiente
            </button>
          )}
        </div>
      </section>
      <div className="practice-footer">
        <button className="ghost-button" type="button" onClick={backToPicker}>
          Elegir preguntas
        </button>
      </div>
    </main>
  );
}

function MatchingDropdownAnswer({
  question,
  answers,
  disabled,
  results,
  onChange
}: {
  question: MatchingDropdownQuestion;
  answers: Record<string, string>;
  disabled?: boolean;
  results?: Record<string, boolean>;
  onChange: (answers: Record<string, string>) => void;
}) {
  function updateAnswer(pairIndex: number, answer: string) {
    onChange({
      ...answers,
      [matchingKey(pairIndex)]: answer
    });
  }

  return (
    <div className="matching-dropdown">
      {question.pairs.map((pair, pairIndex) => {
        const key = matchingKey(pairIndex);
        const result = results?.[key];
        return (
          <div className="matching-row" key={`${pair.label}-${pairIndex}`}>
            <span className="matching-label">{pair.label}</span>
            <select disabled={disabled} value={answers[key] ?? ""} onChange={(event) => updateAnswer(pairIndex, event.target.value)}>
              <option value="">Elegir...</option>
              {question.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {result === undefined ? null : result ? (
              <CheckCircle2 className="matching-result correct" size={22} />
            ) : (
              <XCircle className="matching-result incorrect" size={22} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function NumericAnswerInput({
  value,
  disabled,
  onChange
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="numeric-answer-field">
      Respuesta
      <input disabled={disabled} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Escribi la respuesta" />
    </label>
  );
}

function Feedback({ question, isCorrect }: { question: Question; isCorrect: boolean }) {
  const correctText =
    question.type === "multiple_choice"
      ? question.correctAnswer
      : question.type === "drag_and_drop"
        ? question.correctAnswers.join(" / ")
        : question.type === "table_drag_and_drop"
          ? tableBlankCells(question.table)
              .map((cell) => `(${cell.row + 1},${cell.col + 1}) ${[cell.correctAnswer, ...(cell.acceptedAnswers ?? [])].filter(Boolean).join(" o ")}`)
              .join(" / ")
          : question.type === "matching_dropdown"
            ? matchingCorrectText(question)
            : numericCorrectText(question);
  return (
    <div className={`feedback ${isCorrect ? "correct" : "incorrect"}`}>
      {isCorrect ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
      <div>
        <strong>{isCorrect ? "Correcto" : "Incorrecto"}</strong>
        <span>Respuesta correcta: {correctText}</span>
      </div>
    </div>
  );
}

function PracticePicker({ questions, onStart }: { questions: Question[]; onStart: (questions: Question[]) => void }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(questions.map((question) => question.id));
  const selectedQuestions = questions.filter((question) => selectedIds.includes(question.id));

  useEffect(() => {
    setSelectedIds(questions.map((question) => question.id));
  }, [questions]);

  function toggleQuestion(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectByType(type: QuestionType) {
    setSelectedIds(questions.filter((question) => question.type === type).map((question) => question.id));
  }

  function selectSecondPartial() {
    setSelectedIds(questions.filter((question) => question.partial === SECOND_PARTIAL).map((question) => question.id));
  }

  return (
    <main className="main practice-picker">
      <section className="quiz-card">
        <div className="section-title">
          <h1>Elegir práctica</h1>
          <strong>{selectedQuestions.length} seleccionada(s)</strong>
        </div>

        <div className="picker-actions">
          <button className="ghost-button" type="button" onClick={() => setSelectedIds(questions.map((question) => question.id))}>
            Todas
          </button>
          <button className="ghost-button" type="button" onClick={() => setSelectedIds(questions.slice(-5).map((question) => question.id))}>
            Últimas 5
          </button>
          <button className="ghost-button" type="button" onClick={() => setSelectedIds(questions.slice(30).map((question) => question.id))}>
            Sin unidad 1
          </button>
          <button className="ghost-button" type="button" onClick={() => setSelectedIds(questions.slice(60).map((question) => question.id))}>
            Sin unidades 1 y 2
          </button>
          <button className="ghost-button" type="button" onClick={selectSecondPartial}>
            2do parcial
          </button>
          <button className="ghost-button" type="button" onClick={() => selectByType("multiple_choice")}>
            Multiple choice
          </button>
          <button className="ghost-button" type="button" onClick={() => selectByType("drag_and_drop")}>
            Frases
          </button>
          <button className="ghost-button" type="button" onClick={() => selectByType("table_drag_and_drop")}>
            Tablas
          </button>
          <button className="ghost-button" type="button" onClick={() => selectByType("matching_dropdown")}>
            Dropdowns
          </button>
          <button className="ghost-button" type="button" onClick={() => selectByType("numeric_answer")}>
            Respuestas
          </button>
          <button className="ghost-button" type="button" onClick={() => setSelectedIds([])}>
            Ninguna
          </button>
        </div>

        <div className="picker-list">
          {questions.map((question, questionIndex) => (
            <label className="picker-item" key={question.id}>
              <input checked={selectedIds.includes(question.id)} type="checkbox" onChange={() => toggleQuestion(question.id)} />
              <span className="pill-group">
                <span className="type-pill">{questionTypeLabel(question.type)}</span>
                {partialLabel(question) ? <span className="partial-pill">{partialLabel(question)}</span> : null}
              </span>
              <strong>{questionIndex + 1}.</strong>
              <span>{question.statement}</span>
            </label>
          ))}
        </div>

        <div className="actions-row">
          <button className="primary-button" type="button" disabled={selectedQuestions.length === 0} onClick={() => onStart(selectedQuestions)}>
            Empezar práctica
          </button>
        </div>
      </section>
    </main>
  );
}

function ImportPage({ onSaved }: { onSaved: () => Promise<void> }) {
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus | null>(null);
  const [ocrToken, setOcrToken] = useState(() => localStorage.getItem(OCR_TOKEN_STORAGE_KEY) ?? "");
  const ocrTokenRef = useRef(ocrToken);
  const [markAsSecondPartial, setMarkAsSecondPartial] = useState(true);
  const [showTableBuilder, setShowTableBuilder] = useState(false);
  const [tableBuilder, setTableBuilder] = useState<TableImportBuilder>(() => ({
    statement: "",
    table: makeEmptyTable(4, 6),
    options: [],
    detectedAnswers: [],
    nextAnswerIndex: 0
  }));

  useEffect(() => {
    getOcrStatus()
      .then(setOcrStatus)
      .catch(() => setOcrStatus(null));
  }, []);

  useEffect(() => {
    ocrTokenRef.current = ocrToken;
    const token = ocrToken.trim();
    if (token) {
      localStorage.setItem(OCR_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(OCR_TOKEN_STORAGE_KEY);
    }
  }, [ocrToken]);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      uploadFiles(files, ocrTokenRef.current);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  async function uploadFiles(files: File[] | FileList | null, tokenOverride = ocrToken) {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setMessage("No encontre imagenes para importar.");
      return;
    }

    setBusy(true);
    setMessage("Procesando OCR...");
    try {
      const response = await uploadOcrImages(imageFiles, tokenOverride);
      const normalResults = response.results.filter((result) => result.parsedQuestion.type !== "table_drag_and_drop");
      const tableResults = response.results.filter((result) => result.parsedQuestion.type === "table_drag_and_drop");

      setDrafts((current) => [
        ...current,
        ...normalResults.map((result) => ({
          ...result,
          id: `${result.filename}-${Date.now()}-${Math.random().toString(16).slice(2)}`
        }))
      ]);

      for (const result of tableResults) {
        applyTableOcrResultToBuilder(result);
      }

      if (tableResults.length > 0) {
        setShowTableBuilder(true);
      }

      setMessage(
        `OCR listo. ${normalResults.length} captura(s) a revision normal y ${tableResults.length} captura(s) al constructor de tabla.`
      );
    } catch (uploadError) {
      setMessage(uploadError instanceof Error ? uploadError.message : "No se pudo procesar OCR.");
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    uploadFiles(event.dataTransfer.files);
  }

  async function reparse(index: number) {
    const draft = drafts[index];
    setBusy(true);
    setMessage("Interpretando texto OCR...");
    try {
      const parsedQuestion = await parseQuestionFromText(draft.text);
      updateDraft(index, { ...draft, parsedQuestion });
      setMessage("Sugerencia actualizada.");
    } catch (parseError) {
      setMessage(parseError instanceof Error ? parseError.message : "No se pudo interpretar el texto.");
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(index: number, nextDraft: ImportDraft) {
    setDrafts((current) => current.map((draft, draftIndex) => (draftIndex === index ? nextDraft : draft)));
  }

  function updateParsed(index: number, parsedQuestion: QuestionInput) {
    const draft = drafts[index];
    updateDraft(index, { ...draft, parsedQuestion: { ...parsedQuestion, ocrText: draft.text } });
  }

  async function saveAll() {
    setBusy(true);
    setMessage("");
    try {
      const draftQuestions = drafts.map((draft) =>
        markQuestionAsSecondPartial(normalizeQuestionInput({ ...draft.parsedQuestion, ocrText: draft.text }), markAsSecondPartial)
      );
      const questionsToSave = [...draftQuestions];
      if (showTableBuilder && tableBlankCells(tableBuilder.table).length > 0 && tableBuilder.statement.trim()) {
        questionsToSave.push(
          markQuestionAsSecondPartial(
            normalizeQuestionInput({
              type: "table_drag_and_drop",
              statement: tableBuilder.statement.trim(),
              table: tableBuilder.table,
              draggableOptions: tableBuilder.options
            }),
            markAsSecondPartial
          )
        );
      }
      await createQuestionsBulk(questionsToSave);
      await onSaved();
      setDrafts([]);
      resetTableBuilder();
      setMessage("Preguntas importadas al banco.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "No se pudieron guardar las preguntas.");
    } finally {
      setBusy(false);
    }
  }

  function resetTableBuilder() {
    setTableBuilder({
      statement: "",
      table: makeEmptyTable(4, 6),
      options: [],
      detectedAnswers: [],
      nextAnswerIndex: 0
    });
    setShowTableBuilder(false);
  }

  function applyTableOcrResultToBuilder(result: OcrUploadResult) {
    const lines = result.lines.length ? result.lines : result.text.split(/\r?\n/);
    const looksLikeAnswerCapture = /respuesta(s)? correcta(s)?/i.test(result.text) || lines.some((line) => line.includes("["));

    if (looksLikeAnswerCapture) {
      const answers = extractAnswerGroups(lines);
      setTableBuilder((current) => ({
        ...current,
        detectedAnswers: uniqueAnswerGroups([...current.detectedAnswers, ...answers]),
        options: uniqueList([...current.options, ...flattenAnswerGroups(answers)])
      }));
      return;
    }

    if (result.parsedQuestion.type === "table_drag_and_drop") {
      const tableQuestion = result.parsedQuestion as Omit<TableDragAndDropQuestion, "id">;
      setTableBuilder((current) => ({
        ...current,
        statement: tableQuestion.statement || current.statement,
        table: tableQuestion.table,
        options: uniqueList([...current.options, ...tableQuestion.draggableOptions])
      }));
      return;
    }

    const statement = firstStatementLine(lines, result.text);
    const options = extractShortOptionsFromLines(lines);
    setTableBuilder((current) => ({
      ...current,
      statement: statement || current.statement,
      options: uniqueList([...current.options, ...options])
    }));
  }

  function applyDraftAsEmptyTable(draft: ImportDraft) {
    const statement = firstStatementLine(draft.lines, draft.text);
    const options = extractShortOptionsFromLines(draft.lines.length ? draft.lines : draft.text.split(/\r?\n/));
    setTableBuilder((current) => ({
      ...current,
      statement: statement || current.statement,
      table: current.table.rows === 4 && current.table.columns === 6 ? current.table : makeEmptyTable(4, 6),
      options: uniqueList([...current.options, ...options])
    }));
    setShowTableBuilder(true);
    setMessage("Tabla vacia aplicada: revise filas, columnas, blanks y opciones.");
  }

  function applyDraftAsTableAnswers(draft: ImportDraft) {
    const answers = extractAnswerGroups(draft.lines.length ? draft.lines : draft.text.split(/\r?\n/));
    setTableBuilder((current) => ({
      ...current,
      detectedAnswers: uniqueAnswerGroups([...current.detectedAnswers, ...answers]),
      options: uniqueList([...current.options, ...flattenAnswerGroups(answers)])
    }));
    setShowTableBuilder(true);
    setMessage(`Respuestas detectadas: ${answers.length}. Ahora podes asignarlas a los blanks.`);
  }

  function assignAnswersInOrder() {
    setTableBuilder((current) => {
      const answers = current.detectedAnswers;
      let answerIndex = 0;
      const table = {
        ...current.table,
        cells: current.table.cells.map((cell) => {
          if (!cell.isBlank) {
            return cell;
          }
          const answer = answers[answerIndex];
          answerIndex += 1;
          return {
            ...cell,
            correctAnswer: answer?.primary ?? cell.correctAnswer ?? "",
            acceptedAnswers: uniqueList([...(cell.acceptedAnswers ?? []), ...(answer?.alternatives ?? [])])
          };
        })
      };
      return { ...current, table, nextAnswerIndex: answerIndex };
    });
  }

  function assignNextAnswerToCell(row: number, col: number) {
    setTableBuilder((current) => {
      const answer = current.detectedAnswers[current.nextAnswerIndex];
      if (!answer) {
        return current;
      }
      return {
        ...current,
        nextAnswerIndex: current.nextAnswerIndex + 1,
        table: {
          ...current.table,
          cells: current.table.cells.map((cell) =>
            cell.row === row && cell.col === col
              ? {
                  ...cell,
                  isBlank: true,
                  content: "",
                  correctAnswer: answer.primary,
                  acceptedAnswers: uniqueList([...(cell.acceptedAnswers ?? []), ...answer.alternatives])
                }
              : cell
          )
        }
      };
    });
  }

  async function saveTableOnly() {
    setBusy(true);
    setMessage("");
    try {
      await createQuestionsBulk([
        markQuestionAsSecondPartial(
          normalizeQuestionInput({
            type: "table_drag_and_drop",
            statement: tableBuilder.statement.trim(),
            table: tableBuilder.table,
            draggableOptions: tableBuilder.options
          }),
          markAsSecondPartial
        )
      ]);
      await onSaved();
      resetTableBuilder();
      setMessage("Tabla importada al banco.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "No se pudo guardar la tabla.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="main import-layout">
      <section
        className="editor-panel import-drop"
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="section-title">
          <h1>Importar desde capturas</h1>
          <div className="item-actions">
            {drafts.length > 0 ? (
              <button className="ghost-button" type="button" onClick={() => setDrafts([])}>
                Limpiar
              </button>
            ) : null}
            <FileImage size={28} />
          </div>
        </div>
        <label className={`file-picker ${isDragging ? "dragging" : ""}`}>
          <Upload size={24} />
          <span>Subir, pegar o arrastrar imagenes</span>
          <input accept="image/*" multiple type="file" onChange={(event) => uploadFiles(event.target.files)} />
        </label>
        <p className="helper-text">Recorta una captura y pegala con Ctrl+V aca. Tambien podes soltar archivos o elegirlos desde el explorador.</p>
        {ocrStatus ? (
          <p className={`provider-status ${ocrStatus.awsTextractReady ? "ready" : "warning"}`}>
            OCR activo: {ocrStatus.provider}
            {ocrStatus.fallbackToTesseract ? " con fallback a tesseract" : ""}
            {!ocrStatus.awsTextractReady ? `. Faltan: ${ocrStatus.missingAwsCredentials.join(", ")}` : ""}
            {ocrStatus.ocrAccessTokenRequired && !ocrStatus.ocrAccessTokenConfigured ? ". Falta OCR_ACCESS_TOKEN" : ""}
          </p>
        ) : null}
        <label className="ocr-token-field">
          Token OCR
          <input
            autoComplete="off"
            placeholder="Con token se habilita AWS Textract"
            type="password"
            value={ocrToken}
            onChange={(event) => setOcrToken(event.target.value)}
          />
          <small>Se guarda solo en este navegador y se envia al backend al procesar capturas.</small>
        </label>
        <label className="switch-row">
          <input checked={markAsSecondPartial} type="checkbox" onChange={(event) => setMarkAsSecondPartial(event.target.checked)} />
          <span>Marcar nuevas preguntas como 2do parcial</span>
        </label>
        <p className="helper-text">El OCR no intenta ser perfecto: lee la imagen, propone una pregunta y deja todo editable.</p>
        {message ? <p className="form-message">{message}</p> : null}
      </section>

      <section className="import-review">
        {drafts.map((draft, index) => (
          <ImportDraftEditor
            draft={draft}
            disabled={busy}
            index={index}
            key={draft.id}
            onChange={(parsedQuestion) => updateParsed(index, parsedQuestion)}
            onDraftTextChange={(text) => updateDraft(index, { ...draft, text })}
            onRemove={() => setDrafts((current) => current.filter((d) => d.id !== draft.id))}
            onReparse={() => reparse(index)}
            onUseAsTableAnswers={() => {
              applyDraftAsTableAnswers(draft);
              setDrafts((current) => current.filter((d) => d.id !== draft.id));
            }}
            onUseAsTableShell={() => {
              applyDraftAsEmptyTable(draft);
              setDrafts((current) => current.filter((d) => d.id !== draft.id));
            }}
          />
        ))}
      </section>

      {!showTableBuilder && drafts.length === 0 ? (
        <section className="editor-panel table-builder-cta">
          <div>
            <h1>Constructor de tablas</h1>
            <p className="helper-text">Usalo cuando tengas una captura de tabla vacía y otra con la respuesta correcta.</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => setShowTableBuilder(true)}>
            Abrir constructor
          </button>
        </section>
      ) : null}

      {showTableBuilder ? (
        <TableImportBuilderPanel
          builder={tableBuilder}
          onAssignAnswersInOrder={assignAnswersInOrder}
          onAssignNextAnswerToCell={assignNextAnswerToCell}
          onBuilderChange={setTableBuilder}
          onReset={resetTableBuilder}
          onSaveTableOnly={saveTableOnly}
        />
      ) : null}

      {drafts.length > 0 || (showTableBuilder && tableBlankCells(tableBuilder.table).length > 0) ? (
        <div className="sticky-save">
          <span>{drafts.length} pregunta(s){showTableBuilder ? " + constructor de tabla" : ""}</span>
          <button className="primary-button" disabled={busy} type="button" onClick={saveAll}>
            <Save size={18} />
            Guardar importacion
          </button>
        </div>
      ) : null}
    </main>
  );
}

function ImportDraftEditor({
  draft,
  disabled,
  index,
  onChange,
  onDraftTextChange,
  onRemove,
  onReparse,
  onUseAsTableAnswers,
  onUseAsTableShell
}: {
  draft: ImportDraft;
  disabled: boolean;
  index: number;
  onChange: (question: QuestionInput) => void;
  onDraftTextChange: (text: string) => void;
  onRemove: () => void;
  onReparse: () => void;
  onUseAsTableAnswers: () => void;
  onUseAsTableShell: () => void;
}) {
  const question = draft.parsedQuestion;
  const textPartsRaw = question.type === "drag_and_drop" ? question.textParts.join("") : "";
  const blankCount =
    question.type === "drag_and_drop" ? question.textParts.filter((part) => part === "__blank__").length : 0;

  function sourceOptions() {
    if (question.type === "multiple_choice") {
      return question.options;
    }
    if (question.type === "drag_and_drop" || question.type === "table_drag_and_drop") {
      return question.draggableOptions;
    }
    if (question.type === "matching_dropdown") {
      return question.options;
    }
    return [question.correctAnswer, ...(question.acceptedAnswers ?? [])].filter(Boolean);
  }

  function firstDetectedAnswer() {
    if (question.type === "multiple_choice") {
      return question.correctAnswer;
    }
    if (question.type === "drag_and_drop") {
      return question.correctAnswers[0] ?? "";
    }
    if (question.type === "table_drag_and_drop") {
      return tableBlankCells(question.table)[0]?.correctAnswer ?? "";
    }
    if (question.type === "matching_dropdown") {
      return question.pairs[0]?.correctAnswer ?? "";
    }
    return question.correctAnswer;
  }

  function setType(nextType: "multiple_choice" | "drag_and_drop" | "table_drag_and_drop") {
    if (nextType === question.type) {
      return;
    }

    if (nextType === "multiple_choice") {
      onChange({
        type: "multiple_choice",
        statement: question.statement,
        options: sourceOptions(),
        correctAnswer: firstDetectedAnswer(),
        ocrText: draft.text
      });
      return;
    }

    if (nextType === "table_drag_and_drop") {
      const options = sourceOptions();
      onChange({
        type: "table_drag_and_drop",
        statement: question.statement,
        table: makeEmptyTable(4, 4),
        draggableOptions: options.length > 0 ? options : ["By", "Vector Base", "costo de oportunidad", "valor marginal"],
        ocrText: draft.text
      });
      return;
    }

    const answer = firstDetectedAnswer();
    onChange({
      type: "drag_and_drop",
      statement: question.statement,
      textParts: [question.statement, "__blank__"],
      draggableOptions: sourceOptions(),
      correctAnswers: [answer],
      ocrText: draft.text
    });
  }



  function markBlank(option: string) {
    if (question.type !== "drag_and_drop" || !option.trim()) {
      return;
    }

    const phrase = question.textParts.join("");
    const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nextPhrase = phrase.replace(new RegExp(escaped, "i"), "__blank__");
    onChange({
      ...question,
      textParts: parseDragTextParts(nextPhrase),
      correctAnswers: cleanList([...question.correctAnswers, option]),
      ocrText: draft.text
    });
  }

  const selectableOptions = cleanList(question.type === "drag_and_drop" ? question.draggableOptions : []);

  return (
    <article className="editor-panel import-card">
      <div className="section-title">
        <h1>Captura {index + 1}</h1>
        <div className="item-actions">
          <button className="ghost-button" disabled={disabled} type="button" onClick={onReparse}>
            <Wand2 size={17} />
            Reinterpretar
          </button>
          <button className="ghost-button" disabled={disabled} type="button" onClick={onUseAsTableShell}>
            Tabla vacia
          </button>
          <button className="ghost-button" disabled={disabled} type="button" onClick={onUseAsTableAnswers}>
            Respuestas
          </button>
          <button className="icon-button danger" disabled={disabled} type="button" onClick={onRemove} aria-label="Quitar">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <label>
        Texto OCR original
        <textarea value={draft.text} onChange={(event) => onDraftTextChange(event.target.value)} />
        <small>
          Archivo: {draft.filename}. Proveedor: {draft.provider}
          {typeof draft.confidence === "number" ? `. Confianza: ${draft.confidence.toFixed(1)}%` : ""}
          {draft.lines?.length ? `. Lineas: ${draft.lines.length}` : ""}
          {draft.blocks?.length ? `. Bloques: ${draft.blocks.length}` : ""}
        </small>
      </label>

      {draft.lines?.length ? (
        <details className="ocr-details">
          <summary>Lineas detectadas</summary>
          <ol>
            {draft.lines.map((line, lineIndex) => (
              <li key={`${line}-${lineIndex}`}>{line}</li>
            ))}
          </ol>
        </details>
      ) : null}

      <div className="segmented">
        <button className={question.type === "multiple_choice" ? "active" : ""} type="button" onClick={() => setType("multiple_choice")}>
          Multiple choice
        </button>
        <button className={question.type === "drag_and_drop" ? "active" : ""} type="button" onClick={() => setType("drag_and_drop")}>
          Drag and drop
        </button>
        <button className={question.type === "table_drag_and_drop" ? "active" : ""} type="button" onClick={() => setType("table_drag_and_drop")}>
          Tabla
        </button>
      </div>

      <label>
        Enunciado
        <textarea value={question.statement} onChange={(event) => onChange({ ...question, statement: event.target.value, ocrText: draft.text })} />
      </label>

      {question.type === "multiple_choice" ? (
        <MultipleChoiceEditor
          options={question.options}
          correctAnswer={question.correctAnswer}
          onOptionsChange={(options) => onChange({ ...question, options, ocrText: draft.text })}
          onCorrectAnswerChange={(correctAnswer) => onChange({ ...question, correctAnswer, ocrText: draft.text })}
        />
      ) : question.type === "drag_and_drop" ? (
        <>
          <DragDropEditor
            textPartsRaw={textPartsRaw}
            draggableOptions={question.draggableOptions}
            correctAnswers={question.correctAnswers}
            blankCount={blankCount}
            onTextPartsRawChange={(value) =>
              onChange({
                ...question,
                textParts: parseDragTextParts(value),
                ocrText: draft.text
              })
            }
            onDraggableOptionsChange={(draggableOptions) => onChange({ ...question, draggableOptions, ocrText: draft.text })}
            onCorrectAnswersChange={(correctAnswers) => onChange({ ...question, correctAnswers, ocrText: draft.text })}
          />
          <div className="word-picker">
            <span>Marcar opcion como blank correcto</span>
            <div>
              {selectableOptions.length > 0 ? (
                selectableOptions.map((option) => (
                  <button className="chip" key={option} type="button" onClick={() => markBlank(option)}>
                    {option}
                  </button>
                ))
              ) : (
                <small>Agregá primero opciones arrastrables para marcarlas como correctas.</small>
              )}
            </div>
          </div>
          <DragPreview question={question} onChange={onChange} ocrText={draft.text} />
        </>
      ) : question.type === "table_drag_and_drop" ? (
        <TableQuestionEditor
          table={question.table}
          options={question.draggableOptions}
          onTableChange={(table) => onChange({ ...question, table, ocrText: draft.text })}
          onOptionsChange={(draggableOptions) => onChange({ ...question, draggableOptions, ocrText: draft.text })}
        />
      ) : null}
    </article>
  );
}

function TableImportBuilderPanel({
  builder,
  onAssignAnswersInOrder,
  onAssignNextAnswerToCell,
  onBuilderChange,
  onReset,
  onSaveTableOnly
}: {
  builder: TableImportBuilder;
  onAssignAnswersInOrder: () => void;
  onAssignNextAnswerToCell: (row: number, col: number) => void;
  onBuilderChange: (builder: TableImportBuilder) => void;
  onReset: () => void;
  onSaveTableOnly: () => void;
}) {
  const blankCount = tableBlankCells(builder.table).length;
  const nextAnswer = builder.detectedAnswers[builder.nextAnswerIndex];

  return (
    <section className="editor-panel import-card table-builder-panel">
      <div className="section-title">
        <h1>Constructor de tabla por partes</h1>
        <div className="item-actions">
          <button className="ghost-button" type="button" onClick={onReset}>
            Limpiar tabla
          </button>
          <button className="primary-button" type="button" onClick={onSaveTableOnly} disabled={!builder.statement.trim() || blankCount === 0}>
            <Save size={18} />
            Guardar tabla
          </button>
        </div>
      </div>

      <label>
        Enunciado de la tabla
        <textarea
          value={builder.statement}
          onChange={(event) => onBuilderChange({ ...builder, statement: event.target.value })}
          placeholder="Aplicá una captura como tabla vacía o escribí el enunciado..."
        />
      </label>

      <TableQuestionEditor
        table={builder.table}
        options={builder.options}
        onTableChange={(table) => onBuilderChange({ ...builder, table })}
        onOptionsChange={(options) => onBuilderChange({ ...builder, options })}
      />

      <div className="detected-answer-panel">
        <div className="section-title">
          <h2>Respuestas detectadas</h2>
          <button className="ghost-button" type="button" onClick={onAssignAnswersInOrder} disabled={builder.detectedAnswers.length === 0 || blankCount === 0}>
            Autocompletar en orden
          </button>
        </div>
        <p className="helper-text">
          Siguiente: {nextAnswer ? `${nextAnswer.primary}${nextAnswer.alternatives.length > 0 ? ` o ${nextAnswer.alternatives.join(" o ")}` : ""}` : "sin respuestas pendientes"}. Tambien podes tocar una celda en la grilla rápida para asignarla.
        </p>
        <div className="detected-answer-list">
          {builder.detectedAnswers.map((answer, index) => (
            <span className={index < builder.nextAnswerIndex ? "used-answer" : ""} key={`${answer.primary}-${index}`}>
              {index + 1}. {answer.primary}
              {answer.alternatives.length > 0 ? ` o ${answer.alternatives.join(" o ")}` : ""}
            </span>
          ))}
        </div>
      </div>

      <div className="quick-table-grid" style={{ gridTemplateColumns: `repeat(${builder.table.columns}, minmax(74px, 1fr))` }}>
        {builder.table.cells.map((cell) => (
          <button
            className={cell.isBlank ? "quick-cell blank-cell" : "quick-cell"}
            key={`${cell.row}-${cell.col}`}
            type="button"
            onClick={() => onAssignNextAnswerToCell(cell.row, cell.col)}
          >
            {cell.correctAnswer || cell.content || `${cell.row + 1},${cell.col + 1}`}
          </button>
        ))}
      </div>
    </section>
  );
}

function DragPreview({
  question,
  onChange,
  ocrText
}: {
  question: Omit<DragAndDropQuestion, "id">;
  onChange: (question: QuestionInput) => void;
  ocrText: string;
}) {
  function moveAnswer(index: number, direction: -1 | 1) {
    const next = [...question.correctAnswers];
    const target = index + direction;
    if (target < 0 || target >= next.length) {
      return;
    }
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...question, correctAnswers: next, ocrText });
  }

  return (
    <div className="preview-panel">
      <strong>Vista previa</strong>
      <p>
        {question.textParts.map((part, index) =>
          part === "__blank__" ? (
            <span className="inline-blank" key={index}>
              blank
            </span>
          ) : (
            <span key={`${part}-${index}`}>{part} </span>
          )
        )}
      </p>
      <div className="ordered-answers">
        {question.correctAnswers.map((answer, index) => (
          <div className="answer-order-row" key={`${answer}-${index}`}>
            <span>
              {index + 1}. {answer}
            </span>
            <button className="icon-button" type="button" onClick={() => moveAnswer(index, -1)} aria-label="Subir respuesta">
              <ArrowUp size={16} />
            </button>
            <button className="icon-button" type="button" onClick={() => moveAnswer(index, 1)} aria-label="Bajar respuesta">
              <ArrowDown size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function uniqueWords(text: string) {
  return Array.from(
    new Set(
      text
        .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ-]/g, " ")
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 3)
    )
  );
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function firstStatementLine(lines: string[], fallbackText: string) {
  return (
    lines.find((line) => line.length > 40 && /tabla|simplex|programaci/i.test(line)) ??
    fallbackText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 40) ??
    ""
  );
}

function extractAnswerGroups(lines: string[]) {
  const answers: Array<{ primary: string; alternatives: string[] }> = [];
  for (const line of lines) {
    const bracketed = Array.from(line.matchAll(/\[([^\]]+)\]?/g)).map((match) => match[1].trim()).filter(Boolean);
    if (bracketed.length > 0) {
      if (/\s+(?:o|ó)\s+/i.test(line) && bracketed.length > 1) {
        answers.push({ primary: bracketed[0], alternatives: bracketed.slice(1) });
      } else {
        answers.push(...bracketed.map((answer) => ({ primary: answer, alternatives: [] })));
      }
      continue;
    }
    const cleaned = line.replace(/^\d+\.\s*/, "").trim();
    if (cleaned.length >= 2 && cleaned.length <= 42 && !/[.:?]$/.test(cleaned) && !/^o$/i.test(cleaned)) {
      const alternatives = splitAlternativeAnswers(cleaned);
      answers.push({ primary: alternatives[0] ?? cleaned, alternatives: alternatives.slice(1) });
    }
  }
  return uniqueAnswerGroups(answers);
}

function splitAlternativeAnswers(value: string) {
  return value
    .split(/\s+(?:o|ó)\s+/i)
    .map((answer) => answer.trim())
    .filter(Boolean);
}

function flattenAnswerGroups(groups: Array<{ primary: string; alternatives: string[] }>) {
  return groups.flatMap((group) => [group.primary, ...group.alternatives]);
}

function uniqueAnswerGroups(groups: Array<{ primary: string; alternatives: string[] }>) {
  const seen = new Set<string>();
  const uniqueGroups: Array<{ primary: string; alternatives: string[] }> = [];
  for (const group of groups) {
    const key = [group.primary, ...group.alternatives].map(normalizeAnswer).join("|");
    if (!group.primary || seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueGroups.push({ primary: group.primary, alternatives: uniqueList(group.alternatives) });
  }
  return uniqueGroups;
}

function extractShortOptionsFromLines(lines: string[]) {
  return uniqueList(
    lines
      .map((line) => line.replace(/^\d+\.\s*/, "").trim())
      .filter((line) => line.length >= 2 && line.length <= 42)
      .filter((line) => !isImportUiNoise(line))
      .filter((line) => !/^o$/i.test(line))
      .filter((line) => !/respuesta correcta/i.test(line))
      .filter((line) => !line.includes("["))
      .filter((line) => !/[.:?]$/.test(line))
  );
}

function isImportUiNoise(line: string) {
  return /^(reinterpretar|tabla vacia|tabla vacía|respuestas|texto ocr original|lineas detectadas|líneas detectadas|multiple choice|drag and drop|tabla|enunciado|filas|columnas|blank|agregar|guardar importacion|guardar importación|constructor de tabla|opciones arrastrables y distractores)$/i.test(
    line.trim()
  );
}

function questionTypeLabel(type: QuestionType) {
  if (type === "multiple_choice") {
    return "Multiple choice";
  }
  if (type === "drag_and_drop") {
    return "Drag and drop";
  }
  if (type === "table_drag_and_drop") {
    return "Tabla drag";
  }
  if (type === "matching_dropdown") {
    return "Dropdown";
  }
  return "Respuesta";
}

function partialLabel(question: Question) {
  return question.partial === SECOND_PARTIAL ? SECOND_PARTIAL : null;
}

function questionSearchText(question: Question) {
  if (question.type === "multiple_choice") {
    return [question.statement, question.type, question.partial ?? "", ...question.options, question.correctAnswer].join(" ").toLowerCase();
  }
  if (question.type === "drag_and_drop") {
    return [question.statement, question.type, question.partial ?? "", ...question.textParts, ...question.draggableOptions, ...question.correctAnswers]
      .join(" ")
      .toLowerCase();
  }
  if (question.type === "matching_dropdown") {
    return [
      question.statement,
      question.type,
      question.partial ?? "",
      ...question.options,
      ...question.pairs.flatMap((pair) => [pair.label, pair.correctAnswer])
    ]
      .join(" ")
      .toLowerCase();
  }
  if (question.type === "numeric_answer") {
    return [question.statement, question.type, question.partial ?? "", question.correctAnswer, ...(question.acceptedAnswers ?? [])]
      .join(" ")
      .toLowerCase();
  }
  return [
    question.statement,
    question.type,
    question.partial ?? "",
    ...question.draggableOptions,
    ...question.table.cells.flatMap((cell) => [cell.content, cell.correctAnswer ?? "", ...(cell.acceptedAnswers ?? [])])
  ]
    .join(" ")
    .toLowerCase();
}

function AdminPage({ questions, onChange }: { questions: Question[]; onChange: () => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<QuestionType>("multiple_choice");
  const [statement, setStatement] = useState("");
  const [options, setOptions] = useState<string[]>(emptyMc.options);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [textPartsRaw, setTextPartsRaw] = useState("El __blank__ se visualiza en la linea de optimalidad");
  const [draggableOptions, setDraggableOptions] = useState<string[]>(emptyDnd.draggableOptions);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>(emptyDnd.correctAnswers);
  const [table, setTable] = useState<DragTable>(emptyTable.table);
  const [tableOptions, setTableOptions] = useState<string[]>(emptyTable.draggableOptions);
  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>(emptyMatching.pairs);
  const [matchingOptions, setMatchingOptions] = useState<string[]>(emptyMatching.options);
  const [numericCorrectAnswer, setNumericCorrectAnswer] = useState(emptyNumeric.correctAnswer);
  const [numericAcceptedAnswers, setNumericAcceptedAnswers] = useState<string[]>(emptyNumeric.acceptedAnswers ?? []);
  const [partial, setPartial] = useState<Question["partial"] | "">("");
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const blankCount = useMemo(
    () =>
      parseDragTextParts(textPartsRaw).filter((part) => part === "__blank__").length,
    [textPartsRaw]
  );
  const filteredQuestions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return questions;
    }
    return questions.filter((question) => questionSearchText(question).includes(term));
  }, [questions, searchTerm]);

  function resetForm(nextType: QuestionType = type) {
    setEditingId(null);
    setType(nextType);
    setStatement("");
    setPartial("");
    setMessage("");
    if (nextType === "multiple_choice") {
      setOptions(["", ""]);
      setCorrectAnswer("");
    } else if (nextType === "drag_and_drop") {
      setTextPartsRaw("El __blank__ se visualiza en la linea de optimalidad");
      setDraggableOptions(["", "", ""]);
      setCorrectAnswers([""]);
    } else if (nextType === "table_drag_and_drop") {
      setTable(makeEmptyTable(3, 3));
      setTableOptions(["", "", ""]);
    } else if (nextType === "matching_dropdown") {
      setMatchingPairs([
        { label: "", correctAnswer: "" },
        { label: "", correctAnswer: "" }
      ]);
      setMatchingOptions(["", ""]);
    } else {
      setNumericCorrectAnswer("");
      setNumericAcceptedAnswers([]);
    }
  }

  function edit(question: Question) {
    setEditingId(question.id);
    setType(question.type);
    setStatement(question.statement);
    setPartial(question.partial ?? "");
    setMessage("");
    if (question.type === "multiple_choice") {
      setOptions(question.options);
      setCorrectAnswer(question.correctAnswer);
    } else if (question.type === "drag_and_drop") {
      setTextPartsRaw(question.textParts.join(""));
      setDraggableOptions(question.draggableOptions);
      setCorrectAnswers(question.correctAnswers);
    } else if (question.type === "table_drag_and_drop") {
      setTable(question.table);
      setTableOptions(question.draggableOptions);
    } else if (question.type === "matching_dropdown") {
      setMatchingPairs(question.pairs);
      setMatchingOptions(question.options);
      setNumericCorrectAnswer("");
      setNumericAcceptedAnswers([]);
    } else {
      setNumericCorrectAnswer(question.correctAnswer);
      setNumericAcceptedAnswers(question.acceptedAnswers ?? []);
    }
  }

  async function save() {
    setMessage("");
    try {
      const payload: QuestionInput =
        type === "multiple_choice"
          ? {
              type,
              statement: statement.trim(),
              options: cleanList(options),
              correctAnswer: correctAnswer.trim(),
              ...(partial ? { partial } : {})
            }
          : type === "drag_and_drop"
            ? {
                type,
                statement: statement.trim(),
                textParts: parseDragTextParts(textPartsRaw),
                draggableOptions: cleanList(draggableOptions),
                correctAnswers: cleanList(correctAnswers),
                ...(partial ? { partial } : {})
              }
            : type === "table_drag_and_drop"
              ? {
                  type,
                  statement: statement.trim(),
                  table,
                  draggableOptions: cleanList([
                    ...tableOptions,
                    ...tableBlankCells(table).flatMap((cell) => [cell.correctAnswer ?? "", ...(cell.acceptedAnswers ?? [])])
                  ]),
                  ...(partial ? { partial } : {})
                }
              : type === "matching_dropdown"
                ? {
                    type,
                    statement: statement.trim(),
                    pairs: matchingPairs.map((pair) => ({
                      label: pair.label.trim(),
                      correctAnswer: pair.correctAnswer.trim()
                    })),
                    options: cleanList(matchingOptions),
                    ...(partial ? { partial } : {})
                  }
                : {
                  type,
                  statement: statement.trim(),
                  correctAnswer: numericCorrectAnswer.trim(),
                  acceptedAnswers: cleanList(numericAcceptedAnswers),
                  ...(partial ? { partial } : {})
                };

      if (editingId) {
        await updateQuestion(editingId, normalizeQuestionInput(payload));
      } else {
        await createQuestion(normalizeQuestionInput(payload));
      }

      await onChange();
      resetForm(type);
      setMessage("Pregunta guardada.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "No se pudo guardar.");
    }
  }

  async function remove(id: string) {
    await deleteQuestion(id);
    await onChange();
    if (editingId === id) {
      resetForm(type);
    }
  }

  return (
    <main className="main admin-grid">
      <section className="editor-panel">
        <div className="section-title">
          <h1>{editingId ? "Editar pregunta" : "Nueva pregunta"}</h1>
          <button className="ghost-button" type="button" onClick={() => resetForm(type)}>
            <Plus size={18} />
            Nueva
          </button>
        </div>

        <div className="segmented">
          <button className={type === "multiple_choice" ? "active" : ""} type="button" onClick={() => resetForm("multiple_choice")}>
            Multiple choice
          </button>
          <button className={type === "drag_and_drop" ? "active" : ""} type="button" onClick={() => resetForm("drag_and_drop")}>
            Drag and drop
          </button>
          <button className={type === "table_drag_and_drop" ? "active" : ""} type="button" onClick={() => resetForm("table_drag_and_drop")}>
            Tabla
          </button>
          <button className={type === "matching_dropdown" ? "active" : ""} type="button" onClick={() => resetForm("matching_dropdown")}>
            Dropdown
          </button>
          <button className={type === "numeric_answer" ? "active" : ""} type="button" onClick={() => resetForm("numeric_answer")}>
            Respuesta
          </button>
        </div>

        <label>
          Enunciado
          <textarea value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Escribi la consigna..." />
        </label>

        <label className="switch-row">
          <input checked={partial === SECOND_PARTIAL} type="checkbox" onChange={(event) => setPartial(event.target.checked ? SECOND_PARTIAL : "")} />
          <span>Marcar como 2do parcial</span>
        </label>

        {type === "multiple_choice" ? (
          <MultipleChoiceEditor
            options={options}
            correctAnswer={correctAnswer}
            onOptionsChange={setOptions}
            onCorrectAnswerChange={setCorrectAnswer}
          />
        ) : type === "drag_and_drop" ? (
          <DragDropEditor
            textPartsRaw={textPartsRaw}
            draggableOptions={draggableOptions}
            correctAnswers={correctAnswers}
            blankCount={blankCount}
            onTextPartsRawChange={setTextPartsRaw}
            onDraggableOptionsChange={setDraggableOptions}
            onCorrectAnswersChange={setCorrectAnswers}
          />
        ) : type === "table_drag_and_drop" ? (
          <TableQuestionEditor table={table} options={tableOptions} onTableChange={setTable} onOptionsChange={setTableOptions} />
        ) : type === "matching_dropdown" ? (
          <MatchingDropdownEditor
            pairs={matchingPairs}
            options={matchingOptions}
            onPairsChange={setMatchingPairs}
            onOptionsChange={setMatchingOptions}
          />
        ) : (
          <NumericAnswerEditor
            correctAnswer={numericCorrectAnswer}
            acceptedAnswers={numericAcceptedAnswers}
            onCorrectAnswerChange={setNumericCorrectAnswer}
            onAcceptedAnswersChange={setNumericAcceptedAnswers}
          />
        )}

        {message ? <p className="form-message">{message}</p> : null}
        <button className="primary-button" type="button" onClick={save}>
          <Save size={18} />
          Guardar pregunta
        </button>
      </section>

      <section className="list-panel">
        <div className="section-title">
          <h1>Preguntas cargadas</h1>
          <span className="list-count">{filteredQuestions.length}/{questions.length}</span>
        </div>
        <label className="search-box">
          Buscar
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Enunciado, tipo, opcion..." />
        </label>
        <div className="question-list">
          {filteredQuestions.map((question) => (
            <article className="question-item" key={question.id}>
              <div>
                <span className="type-pill">{questionTypeLabel(question.type)}</span>
                {partialLabel(question) ? <span className="partial-pill">{partialLabel(question)}</span> : null}
                <h2>{question.statement}</h2>
              </div>
              <div className="item-actions">
                <button className="icon-button" type="button" onClick={() => edit(question)} aria-label="Editar">
                  <Pencil size={18} />
                </button>
                <button className="icon-button danger" type="button" onClick={() => remove(question.id)} aria-label="Eliminar">
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}
          {filteredQuestions.length === 0 ? <p className="helper-text">No hay preguntas que coincidan con la busqueda.</p> : null}
        </div>
      </section>
    </main>
  );
}

function MultipleChoiceEditor({
  options,
  correctAnswer,
  onOptionsChange,
  onCorrectAnswerChange
}: {
  options: string[];
  correctAnswer: string;
  onOptionsChange: (options: string[]) => void;
  onCorrectAnswerChange: (answer: string) => void;
}) {
  const normalizedOptions = cleanList(options);
  const radioGroupId = useId();

  return (
    <>
      <ArrayEditor label="Opciones" values={options} minItems={2} onChange={onOptionsChange} />
      <div className="array-editor">
        <div className="array-header">
          <span>Respuesta correcta</span>
        </div>
        {normalizedOptions.length === 0 ? (
          <small>Agregá opciones para elegir la respuesta correcta.</small>
        ) : (
          <div className="mc-answer-list">
            {normalizedOptions.map((option, index) => (
              <label className="mc-answer-item" key={`${option}-${index}`}>
                <input
                  checked={correctAnswer === option}
                  name={`correct-answer-${radioGroupId}`}
                  type="radio"
                  onChange={() => onCorrectAnswerChange(option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function MatchingDropdownEditor({
  pairs,
  options,
  onPairsChange,
  onOptionsChange
}: {
  pairs: MatchingPair[];
  options: string[];
  onPairsChange: (pairs: MatchingPair[]) => void;
  onOptionsChange: (options: string[]) => void;
}) {
  const selectableOptions = cleanList(options);

  function updatePair(index: number, patch: Partial<MatchingPair>) {
    onPairsChange(pairs.map((pair, pairIndex) => (pairIndex === index ? { ...pair, ...patch } : pair)));
  }

  function addPair() {
    onPairsChange([...pairs, { label: "", correctAnswer: "" }]);
  }

  function removePair(index: number) {
    if (pairs.length <= 2) {
      updatePair(index, { label: "", correctAnswer: "" });
      return;
    }
    onPairsChange(pairs.filter((_, pairIndex) => pairIndex !== index));
  }

  return (
    <>
      <ArrayEditor label="Opciones del dropdown" values={options} minItems={2} onChange={onOptionsChange} />

      <div className="array-editor">
        <div className="array-header">
          <span>Relaciones</span>
          <button className="ghost-button" type="button" onClick={addPair}>
            <Plus size={16} />
            Agregar
          </button>
        </div>
        <div className="matching-editor-list">
          {pairs.map((pair, index) => {
            const selectOptions = pair.correctAnswer && !selectableOptions.includes(pair.correctAnswer)
              ? [...selectableOptions, pair.correctAnswer]
              : selectableOptions;
            return (
              <div className="matching-editor-row" key={index}>
                <input value={pair.label} onChange={(event) => updatePair(index, { label: event.target.value })} placeholder="Termino" />
                <select value={pair.correctAnswer} onChange={(event) => updatePair(index, { correctAnswer: event.target.value })}>
                  <option value="">Respuesta correcta...</option>
                  {selectOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button className="icon-button danger" type="button" onClick={() => removePair(index)} aria-label="Quitar relacion">
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
        </div>
        <small>Carga las opciones una vez y despues elegi la correcta para cada fila.</small>
      </div>
    </>
  );
}

function NumericAnswerEditor({
  correctAnswer,
  acceptedAnswers,
  onCorrectAnswerChange,
  onAcceptedAnswersChange
}: {
  correctAnswer: string;
  acceptedAnswers: string[];
  onCorrectAnswerChange: (answer: string) => void;
  onAcceptedAnswersChange: (answers: string[]) => void;
}) {
  return (
    <>
      <label>
        Respuesta correcta
        <input value={correctAnswer} onChange={(event) => onCorrectAnswerChange(event.target.value)} placeholder="Ej: 10, 703, optimo" />
      </label>
      <ArrayEditor
        label="Respuestas alternativas aceptadas"
        values={acceptedAnswers.length > 0 ? acceptedAnswers : [""]}
        minItems={1}
        clearWhenMinReached
        onChange={onAcceptedAnswersChange}
      />
      <small>La comparación ignora mayúsculas y espacios al inicio/final. Usá alternativas para aceptar formatos como 10, 10.0 o 10,00.</small>
    </>
  );
}

function DragDropEditor({
  textPartsRaw,
  draggableOptions,
  correctAnswers,
  blankCount,
  onTextPartsRawChange,
  onDraggableOptionsChange,
  onCorrectAnswersChange
}: {
  textPartsRaw: string;
  draggableOptions: string[];
  correctAnswers: string[];
  blankCount: number;
  onTextPartsRawChange: (value: string) => void;
  onDraggableOptionsChange: (values: string[]) => void;
  onCorrectAnswersChange: (values: string[]) => void;
}) {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  function insertBlank() {
    const token = "__blank__";
    const textarea = textAreaRef.current;
    const start = textarea?.selectionStart ?? textPartsRaw.length;
    const end = textarea?.selectionEnd ?? textPartsRaw.length;
    const before = textPartsRaw.slice(0, start);
    const after = textPartsRaw.slice(end);
    const spacerBefore = before.length > 0 && !/\s$/.test(before) ? " " : "";
    const spacerAfter = after.length > 0 && !/^\s/.test(after) ? " " : "";
    const insertion = `${spacerBefore}${token}${spacerAfter}`;
    const nextValue = `${before}${insertion}${after}`;
    const cursorPosition = before.length + insertion.length;

    onTextPartsRawChange(nextValue);

    requestAnimationFrame(() => {
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  function onTextAreaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "e") {
      event.preventDefault();
      insertBlank();
    }
  }

  return (
    <>
      <label>
        Frase con blanks
        <textarea
          ref={textAreaRef}
          value={textPartsRaw}
          onKeyDown={onTextAreaKeyDown}
          onChange={(event) => onTextPartsRawChange(event.target.value)}
        />
        <div className="dnd-phrase-actions">
          <button className="ghost-button" type="button" onClick={insertBlank}>
            Agregar blank
          </button>
          <small>Atajo en este campo: Ctrl/Cmd + E</small>
        </div>
        <small>Escribí la frase normal y usá __blank__ para cada hueco. También funciona el formato con |. Blanks detectados: {blankCount}</small>
      </label>
      <ArrayEditor label="Opciones arrastrables" values={draggableOptions} minItems={1} onChange={onDraggableOptionsChange} />
      <ArrayEditor
        label="Respuestas correctas en orden"
        values={correctAnswers}
        minItems={1}
        clearWhenMinReached
        onChange={onCorrectAnswersChange}
      />
    </>
  );
}

function TableQuestionEditor({
  table,
  options,
  onTableChange,
  onOptionsChange
}: {
  table: DragTable;
  options: string[];
  onTableChange: (table: DragTable) => void;
  onOptionsChange: (options: string[]) => void;
}) {
  function resize(rows: number, columns: number) {
    const safeRows = Math.max(1, rows);
    const safeColumns = Math.max(1, columns);
    const cells = Array.from({ length: safeRows * safeColumns }, (_, index) => {
      const row = Math.floor(index / safeColumns);
      const col = index % safeColumns;
      return (
        table.cells.find((cell) => cell.row === row && cell.col === col) ?? {
          row,
          col,
          content: "",
          isBlank: false,
          correctAnswer: ""
        }
      );
    });
    onTableChange({ rows: safeRows, columns: safeColumns, cells });
  }

  function updateCell(row: number, col: number, patch: Partial<DragTable["cells"][number]>) {
    onTableChange({
      ...table,
      cells: table.cells.map((cell) => (cell.row === row && cell.col === col ? { ...cell, ...patch } : cell))
    });
  }

  function markAllCellsAsBlank() {
    onTableChange({
      ...table,
      cells: table.cells.map((cell) => ({
        ...cell,
        content: "",
        isBlank: true,
        correctAnswer: cell.correctAnswer || cell.content
      }))
    });
  }

  function clearAllBlanks() {
    onTableChange({
      ...table,
      cells: table.cells.map((cell) => ({
        ...cell,
        content: cell.content || cell.correctAnswer || "",
        isBlank: false,
        correctAnswer: ""
      }))
    });
  }

  return (
    <>
      <div className="dimension-grid">
        <label>
          Filas
          <input min={1} type="number" value={table.rows} onChange={(event) => resize(Number(event.target.value), table.columns)} />
        </label>
        <label>
          Columnas
          <input min={1} type="number" value={table.columns} onChange={(event) => resize(table.rows, Number(event.target.value))} />
        </label>
      </div>

      <div className="table-editor-actions">
        <button className="ghost-button" type="button" onClick={markAllCellsAsBlank}>
          Hacer todas blank
        </button>
        <button className="ghost-button" type="button" onClick={clearAllBlanks}>
          Quitar blanks
        </button>
      </div>
      <p className="helper-text">Blank es una celda donde vas a soltar una opción. La respuesta correcta es el valor esperado para esa celda.</p>

      <div className="table-editor-wrap">
        <table className="table-editor">
          <tbody>
            {Array.from({ length: table.rows }, (_, row) => (
              <tr key={row}>
                {Array.from({ length: table.columns }, (_, col) => {
                  const cell = table.cells.find((item) => item.row === row && item.col === col)!;
                  return (
                    <td key={`${row}-${col}`}>
                      <label className="cell-toggle">
                        <input
                          checked={cell.isBlank}
                          type="checkbox"
                          onChange={(event) => updateCell(row, col, { isBlank: event.target.checked })}
                        />
                        Blank
                      </label>
                      {cell.isBlank ? (
                        <div className="cell-answer-fields">
                          <input
                            value={cell.correctAnswer ?? ""}
                            onChange={(event) => updateCell(row, col, { correctAnswer: event.target.value, content: "" })}
                            placeholder="Respuesta correcta"
                          />
                          <input
                            value={(cell.acceptedAnswers ?? []).join(" | ")}
                            onChange={(event) =>
                              updateCell(row, col, {
                                acceptedAnswers: event.target.value
                                  .split("|")
                                  .filter((answer) => answer.length > 0)
                              })
                            }
                            placeholder="Alternativas con |"
                          />
                        </div>
                      ) : (
                        <input
                          value={cell.content}
                          onChange={(event) => updateCell(row, col, { content: event.target.value, correctAnswer: "" })}
                          placeholder="Contenido fijo"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ArrayEditor label="Opciones arrastrables y distractores" values={options} minItems={1} onChange={onOptionsChange} />
      <TablePreview table={table} />
    </>
  );
}

function TablePreview({ table }: { table: DragTable }) {
  return (
    <div className="preview-panel">
      <strong>Vista previa de tabla</strong>
      <div className="study-table-wrap">
        <table className="study-table">
          <tbody>
            {Array.from({ length: table.rows }, (_, row) => (
              <tr key={row}>
                {Array.from({ length: table.columns }, (_, col) => {
                  const cell = table.cells.find((item) => item.row === row && item.col === col);
                  return (
                    <td className={cell?.isBlank ? "table-blank-cell" : ""} key={`${row}-${col}`}>
                      {cell?.isBlank ? (
                        <span className="blank-placeholder">
                          {[cell.correctAnswer, ...(cell.acceptedAnswers ?? [])].filter(Boolean).join(" o ") || "blank"}
                        </span>
                      ) : (
                        cell?.content
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ArrayEditor({
  label,
  values,
  minItems,
  clearWhenMinReached = false,
  onChange
}: {
  label: string;
  values: string[];
  minItems: number;
  clearWhenMinReached?: boolean;
  onChange: (values: string[]) => void;
}) {
  function update(index: number, value: string) {
    onChange(values.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function remove(index: number) {
    if (values.length <= minItems) {
      if (clearWhenMinReached) {
        update(index, "");
      }
      return;
    }
    onChange(values.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="array-editor">
      <div className="array-header">
        <span>{label}</span>
        <button className="ghost-button" type="button" onClick={() => onChange([...values, ""])}>
          <Plus size={16} />
          Agregar
        </button>
      </div>
      {values.map((value, index) => (
        <div className="array-row" key={index}>
          <textarea rows={2} value={value} onChange={(event) => update(index, event.target.value)} placeholder={`${label} ${index + 1}`} />
          <button className="icon-button" type="button" onClick={() => remove(index)} aria-label="Eliminar item">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
