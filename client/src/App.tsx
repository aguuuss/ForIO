import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ChevronRight,
  Clock3,
  FileImage,
  GraduationCap,
  HelpCircle,
  Layers3,
  LifeBuoy,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Users,
  Wand2,
  XCircle
} from "lucide-react";
import { AppFooter as AppFooterView } from "@/app/AppFooter";
import { AppShell } from "@/app/AppShell";
import { AuthPage as AuthPageView, PendingAccessPage as PendingAccessPageView } from "@/pages/AuthPage";
import { CatalogPage as CatalogPageView } from "@/pages/CatalogPage";
import {
  createQuestion,
  createQuestionsBulk,
  deleteQuestion,
  getAdminUsers,
  getCurrentUser,
  getQuestions,
  getOcrStatus,
  getSubjects,
  login,
  logout,
  parseQuestionFromText,
  register,
  updateAdminUserRole,
  updateAdminUserStatus,
  updateQuestion,
  uploadOcrImages
} from "./api";
import type { OcrUploadResult } from "./api";
import type { OcrStatus } from "./api";
import DragDropAnswer from "./components/DragDropAnswer";
import TableDragDropAnswer, { cellKey } from "./components/TableDragDropAnswer";
import type {
  AuthUser,
  DragAndDropQuestion,
  DragTable,
  MultipleChoiceQuestion,
  Question,
  QuestionInput,
  QuestionType,
  SessionUser,
  SubjectInput,
  SubjectSummary,
  TableDragAndDropQuestion,
  UserRole,
  UserStatus
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

type SubjectDraft = Required<Pick<SubjectInput, "subjectSlug" | "subjectName" | "careerName" | "yearNumber">>;

type PublicRoute =
  | { kind: "home" }
  | { kind: "auth" }
  | { kind: "practice"; yearSlug: string; subjectSlug: string }
  | { kind: "exam"; yearSlug: string; subjectSlug: string }
  | { kind: "admin" }
  | { kind: "admin-import" };

const defaultSubjectDraft: SubjectDraft = {
  subjectSlug: "investigacion-operativa",
  subjectName: "Investigacion Operativa",
  careerName: "Ingenieria en Sistemas",
  yearNumber: 4
};

function yearLabel(yearNumber: number) {
  return `${yearNumber}to año`;
}

function yearSlug(yearNumber: number) {
  return `${yearNumber}to`;
}

function buildSubjectPath(subject: Pick<SubjectSummary, "slug" | "yearNumber">) {
  return `/${yearSlug(subject.yearNumber)}/${subject.slug}`;
}

function parseYearSlug(raw: string) {
  const match = raw.trim().match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function parsePath(pathname: string): PublicRoute {
  if (pathname === "/admin") {
    return { kind: "admin" };
  }
  if (pathname === "/admin/import") {
    return { kind: "admin-import" };
  }
  if (pathname === "/auth") {
    return { kind: "auth" };
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    return { kind: "home" };
  }
  if (parts.length === 2) {
    return { kind: "practice", yearSlug: parts[0], subjectSlug: parts[1] };
  }
  if (parts.length === 3 && parts[2] === "exam") {
    return { kind: "exam", yearSlug: parts[0], subjectSlug: parts[1] };
  }
  return { kind: "home" };
}

function subjectDraftFromSubject(subject?: SubjectSummary | null): SubjectDraft {
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

export default function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [authUser, setAuthUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [path, setPath] = useState(window.location.pathname);
  const route = useMemo(() => parsePath(path), [path]);

  async function loadAppData() {
    setLoading(true);
    setError("");
    try {
      const [nextQuestions, nextSubjects, currentUser] = await Promise.all([
        getQuestionsWithRetry(),
        getSubjects(),
        getCurrentUser()
      ]);
      setQuestions(nextQuestions);
      setSubjects(nextSubjects);
      setAuthUser(currentUser.user);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las preguntas.");
    } finally {
      setLoading(false);
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
    loadAppData();
  }, []);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    if ((route.kind === "admin" || route.kind === "admin-import") && !authUser) {
      navigate("/auth");
    }
  }, [authUser, loading, route]);

  function navigate(nextPath: string) {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
  }

  const selectedSubject = useMemo(() => {
    if (route.kind !== "practice" && route.kind !== "exam") {
      return null;
    }

    const selectedYear = parseYearSlug(route.yearSlug);
    return (
      subjects.find((subject) => subject.slug === route.subjectSlug && subject.yearNumber === selectedYear) ?? null
    );
  }, [route, subjects]);

  const visibleQuestions = useMemo(() => {
    if (!selectedSubject) {
      return questions;
    }
    return questions.filter((question) => question.subject.slug === selectedSubject.slug);
  }, [questions, selectedSubject]);

  const adminSubjectDraft = selectedSubject ? subjectDraftFromSubject(selectedSubject) : subjectDraftFromSubject(subjects[0]);
  const canAccessEditor = authUser?.status === "active" && (authUser.role === "editor" || authUser.role === "admin");
  const selectedPracticePath = selectedSubject ? buildSubjectPath(selectedSubject) : null;
  const selectedExamPath = selectedSubject ? `${buildSubjectPath(selectedSubject)}/exam` : null;

  async function handleLogout() {
    await logout();
    setAuthUser(null);
    if (route.kind === "admin" || route.kind === "admin-import") {
      navigate("/");
    }
  }

  const showFooter = !loading && !error;

  return (
    <AppShell
      authUser={authUser}
      footer={showFooter ? <AppFooterView /> : undefined}
      onLogout={handleLogout}
      onNavigate={navigate}
      route={route}
      selectedExamPath={selectedExamPath}
      selectedPracticePath={selectedPracticePath}
      selectedSubjectName={selectedSubject?.name ?? null}
    >
      {loading ? <main className="main">Cargando preguntas...</main> : null}
      {error ? (
        <main className="main error-box">
          <h1>No pude cargar las preguntas</h1>
          <p>{error}</p>
          <button className="primary-button" type="button" onClick={loadAppData}>
            <RotateCcw size={18} />
            Reintentar
          </button>
        </main>
      ) : null}
      {!loading && !error && route.kind === "auth" ? (
        <AuthPageView
          currentUser={authUser}
          onAuthenticated={(user) => {
            setAuthUser(user);
            navigate("/admin");
          }}
          onGoAdmin={() => navigate("/admin")}
        />
      ) : null}
      {!loading && !error && route.kind === "admin-import" && canAccessEditor ? (
        <ImportPage onSaved={loadAppData} initialSubject={adminSubjectDraft} subjects={subjects} />
      ) : null}
      {!loading && !error && route.kind === "admin" && canAccessEditor ? (
        <AdminPage
          authUser={authUser}
          questions={questions}
          onChange={loadAppData}
          initialSubject={adminSubjectDraft}
          subjects={subjects}
        />
      ) : null}
      {!loading && !error && route.kind === "exam" && selectedSubject ? (
        <ExamPage questions={visibleQuestions} subject={selectedSubject} />
      ) : null}
      {!loading && !error && route.kind === "practice" && selectedSubject ? (
        <PracticePage questions={visibleQuestions} subject={selectedSubject} />
      ) : null}
      {!loading && !error && route.kind === "home" ? (
        <CatalogPageView navigate={navigate} questions={questions} subjects={subjects} />
      ) : null}
      {!loading && !error && (route.kind === "practice" || route.kind === "exam") && !selectedSubject ? (
        <main className="main empty-state">
          <h1>Materia no encontrada</h1>
          <p>La ruta pública no coincide con una materia cargada.</p>
          <button className="primary-button" type="button" onClick={() => navigate("/")}>
            Volver al catalogo
          </button>
        </main>
      ) : null}
      {!loading && !error && (route.kind === "admin" || route.kind === "admin-import") && authUser?.status === "pending" ? (
        <PendingAccessPageView />
      ) : null}
    </AppShell>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div>
          <strong>ForIO</strong>
          <p>© 2026 Universidad Tecnológica Nacional. Plataforma pública para práctica, examen y administración académica.</p>
        </div>
        <div className="app-footer-links">
          <span>Privacidad</span>
          <span>Términos de uso</span>
          <span>Soporte técnico</span>
          <span>UTN institucional</span>
        </div>
      </div>
    </footer>
  );
}

const EXAM_QUESTION_COUNT = 50;

type ExamAnswer =
  | { type: "multiple_choice"; selected: string }
  | { type: "drag_and_drop"; answers: string[] }
  | { type: "table_drag_and_drop"; answers: Record<string, string> };

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
  return { isCorrect: false };
}

function SubjectHero({
  subject,
  questionsCount,
  modeLabel
}: {
  subject: SubjectSummary;
  questionsCount: number;
  modeLabel: string;
}) {
  return (
    <section className="subject-hero">
      <div className="subject-hero-copy">
        <span className="hero-eyebrow">
          <Layers3 size={15} />
          {subject.careerName}
        </span>
        <h1>{subject.name}</h1>
        <p>
          {yearLabel(subject.yearNumber)} · {questionsCount} preguntas disponibles · {modeLabel}
        </p>
      </div>
      <div className="subject-hero-mark">
        <GraduationCap size={72} />
      </div>
    </section>
  );
}

function CatalogPage({
  subjects,
  questions,
  navigate
}: {
  subjects: SubjectSummary[];
  questions: Question[];
  navigate: (path: string) => void;
}) {
  const subjectsByYear = useMemo(() => {
    return subjects.reduce<Map<number, SubjectSummary[]>>((acc, subject) => {
      const current = acc.get(subject.yearNumber) ?? [];
      current.push(subject);
      acc.set(subject.yearNumber, current);
      return acc;
    }, new Map());
  }, [subjects]);

  const questionCountBySubject = useMemo(() => {
    return questions.reduce<Record<string, number>>((acc, question) => {
      acc[question.subject.slug] = (acc[question.subject.slug] ?? 0) + 1;
      return acc;
    }, {});
  }, [questions]);

  const orderedYears = Array.from(subjectsByYear.keys()).sort((a, b) => a - b);
  const totalYears = orderedYears.length;
  const totalQuestions = questions.length;

  return (
    <main className="main catalog-page">
      <section className="catalog-hero">
        <span className="hero-eyebrow">
          <ClipboardList size={15} />
          Catalogo publico
        </span>
        <h1>Entrenamiento por año y materia</h1>
        <p>
          La app ya quedó lista para crecer como producto: elegís año, entrás a la materia y desde ahí practicás o rendís examen.
        </p>
      </section>

      {orderedYears.length === 0 ? (
        <section className="empty-state">
          <h1>No hay materias cargadas</h1>
          <p>Entrá al admin para crear la primera materia pública.</p>
        </section>
      ) : (
        <>
          {orderedYears.map((year) => (
            <section className="catalog-year-block" key={year}>
              <div className="catalog-year-head">
                <div>
                  <span className="year-chip">{yearLabel(year)}</span>
                  <h2>Materias disponibles</h2>
                </div>
              </div>
              <div className="subject-grid">
                {(subjectsByYear.get(year) ?? []).map((subject) => {
                  const count = questionCountBySubject[subject.slug] ?? 0;
                  return (
                    <article className="subject-card" key={subject.id}>
                      <div className="subject-card-top">
                        <span className="type-pill">{subject.careerName}</span>
                        <strong>{count} preguntas</strong>
                      </div>
                      <h3>{subject.name}</h3>
                      <p>Ruta pública lista para compartir y seguir cargando contenido sin mezclar materias.</p>
                      <div className="subject-card-actions">
                        <button className="primary-button" type="button" onClick={() => navigate(buildSubjectPath(subject))}>
                          Practicar
                          <ChevronRight size={16} />
                        </button>
                        <button className="ghost-button" type="button" onClick={() => navigate(`${buildSubjectPath(subject)}/exam`)}>
                          <GraduationCap size={16} />
                          Examen
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="catalog-stats-grid">
            <article className="metric-card metric-card-dark">
              <BarChart3 size={28} />
              <div>
                <strong>{totalQuestions}</strong>
                <span>preguntas públicas</span>
              </div>
            </article>
            <article className="metric-card metric-card-light">
              <Users size={28} />
              <div>
                <strong>{subjects.length}</strong>
                <span>materias activas</span>
              </div>
            </article>
            <article className="metric-card metric-card-soft">
              <BookOpen size={28} />
              <div>
                <strong>{totalYears}</strong>
                <span>años con catálogo</span>
              </div>
            </article>
          </section>
        </>
      )}
    </main>
  );
}

function AuthPage({
  currentUser,
  onAuthenticated,
  onGoAdmin
}: {
  currentUser: SessionUser | null;
  onAuthenticated: (user: SessionUser) => void;
  onGoAdmin: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      if (mode === "register") {
        const response = await register({ displayName, email, password });
        setMode("login");
        setMessage(response.message);
      } else {
        const response = await login({ email, password });
        onAuthenticated(response.user);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la operación.");
    } finally {
      setBusy(false);
    }
  }

  if (currentUser) {
    return (
      <main className="main auth-page">
        <section className="quiz-card auth-card">
          <h1>Ya iniciaste sesión</h1>
          <p>
            Entraste como <strong>{currentUser.displayName}</strong> con rol <strong>{currentUser.role}</strong>.
          </p>
          <p>{currentUser.status === "pending" ? "Tu cuenta está pendiente de aprobación." : "Ya podés entrar al panel de administración."}</p>
          {currentUser.status === "active" ? (
            <button className="primary-button" type="button" onClick={onGoAdmin}>
              Ir al admin
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="main auth-page">
      <section className="quiz-card auth-card">
        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
            Ingresar
          </button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>
            Crear cuenta
          </button>
        </div>
        <h1>{mode === "login" ? "Ingresar al panel" : "Crear cuenta de edición"}</h1>
        <p className="helper-text">
          {mode === "login"
            ? "El catálogo sigue abierto para cualquiera. Ingresá solo si vas a cargar o editar contenido."
            : "La cuenta se crea como editora pendiente. Un admin tiene que aprobarla antes de darte acceso."}
        </p>
        {mode === "register" ? (
          <label>
            Nombre para mostrar
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
        ) : null}
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label>
          Contraseña
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </label>
        {message ? <p className="form-message">{message}</p> : null}
        <button className="primary-button" disabled={busy} type="button" onClick={submit}>
          {mode === "login" ? "Ingresar" : "Crear cuenta"}
          <ArrowRight size={18} />
        </button>
        <div className="auth-support">
          <LifeBuoy size={18} />
          <span>¿Necesitás ayuda? Contactar soporte</span>
        </div>
      </section>
    </main>
  );
}

function PendingAccessPage() {
  return (
    <main className="main auth-page">
      <section className="quiz-card auth-card">
        <h1>Cuenta pendiente de aprobación</h1>
        <p>Ya tenés cuenta, pero todavía no podés cargar ni modificar contenido hasta que un admin la active.</p>
      </section>
    </main>
  );
}

function ExamPage({ questions, subject }: { questions: Question[]; subject: SubjectSummary }) {
  const [examQuestions, setExamQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [collectedAnswers, setCollectedAnswers] = useState<(ExamAnswer | null)[]>([]);
  const [results, setResults] = useState<ExamQuestionResult[] | null>(null);

  const [selected, setSelected] = useState("");
  const [dndAnswers, setDndAnswers] = useState<string[]>([]);
  const [tableAnswers, setTableAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<null | boolean>(null);
  const [currentTableResults, setCurrentTableResults] = useState<Record<string, boolean>>({});

  function resetCurrentAnswer() {
    setSelected("");
    setDndAnswers([]);
    setTableAnswers({});
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
    return Object.keys(tableAnswers).length > 0 ? { type: "table_drag_and_drop", answers: tableAnswers } : null;
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
        <p>Esta materia todavía no tiene preguntas cargadas.</p>
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
        <SubjectHero modeLabel="Modo examen" questionsCount={questions.length} subject={subject} />
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
        <SubjectHero modeLabel="Modo examen" questionsCount={questions.length} subject={subject} />
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
        : tableBlankCells(question.table).every((cell) => Boolean(tableAnswers[cellKey(cell.row, cell.col)]));

  const progress = (index / total) * 100;

  return (
    <main className="main">
      <SubjectHero modeLabel="Modo examen" questionsCount={questions.length} subject={subject} />
      <section className="quiz-layout">
        <article className="quiz-card quiz-stage">
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
          ) : (
            <TableDragDropAnswer
              key={question.id}
              table={question.table}
              options={question.draggableOptions}
              disabled={checked !== null}
              results={checked !== null ? currentTableResults : undefined}
              onChange={setTableAnswers}
            />
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
        </article>

        <aside className="quiz-sidebar">
          <div className="summary-panel">
            <h2>Resumen</h2>
            <p>Mantené tu ritmo para completar la sesión.</p>
            <div className="summary-grid">
              {examQuestions.map((item, itemIndex) => (
                <button
                  className={`summary-step ${itemIndex === index ? "active" : collectedAnswers[itemIndex] ? "done" : ""}`}
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (collectedAnswers[itemIndex] || itemIndex === index) {
                      setIndex(itemIndex);
                      resetCurrentAnswer();
                    }
                  }}
                >
                  {itemIndex + 1}
                </button>
              ))}
            </div>
            <div className="summary-metric">
              <span>Precisión parcial</span>
              <strong>{index === 0 ? 0 : Math.round((collectedAnswers.filter(Boolean).length / index) * 100)}%</strong>
            </div>
          </div>
        </aside>
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
        : tableBlankCells(question.table)
            .map((cell) => `(${cell.row + 1},${cell.col + 1}) ${[cell.correctAnswer, ...(cell.acceptedAnswers ?? [])].filter(Boolean).join(" o ")}`)
            .join(" / ");

  const userAnswerText =
    answer === null
      ? "Sin respuesta"
      : answer.type === "multiple_choice"
        ? answer.selected
        : answer.type === "drag_and_drop"
          ? answer.answers.join(" / ")
          : tableBlankCells((question as TableDragAndDropQuestion).table)
              .map((cell) => {
                const key = cellKey(cell.row, cell.col);
                const val = (answer as { type: "table_drag_and_drop"; answers: Record<string, string> }).answers[key];
                const ok = tableResults?.[key];
                return `(${cell.row + 1},${cell.col + 1}) ${val ?? "—"}${ok !== undefined ? (ok ? " ✓" : " ✗") : ""}`;
              })
              .join(" / ");

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

function PracticePage({ questions, subject }: { questions: Question[]; subject: SubjectSummary }) {
  const [practiceQuestions, setPracticeQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState("");
  const [dndAnswers, setDndAnswers] = useState<string[]>([]);
  const [tableAnswers, setTableAnswers] = useState<Record<string, string>>({});
  const [tableResults, setTableResults] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState<null | boolean>(null);
  const activeQuestions = practiceQuestions ?? [];
  const question = activeQuestions[index];
  const isFinished = index >= activeQuestions.length;

  function resetAnswer() {
    setSelected("");
    setDndAnswers([]);
    setTableAnswers({});
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
        <p>Esta materia todavía no tiene preguntas cargadas.</p>
      </main>
    );
  }

  if (!practiceQuestions) {
    return <PracticePicker questions={questions} onStart={startPractice} subject={subject} />;
  }

  if (isFinished) {
  return (
    <main className="main result-panel">
        <h1>Resumen final</h1>
        <p className="score-big">
          {score}/{activeQuestions.length}
        </p>
        <p>Respondiste correctamente el {Math.round((score / activeQuestions.length) * 100)}%.</p>
        <div className="result-actions">
          <button className="primary-button" type="button" onClick={restart}>
            <RotateCcw size={18} />
            Reiniciar quiz
          </button>
          <button className="ghost-button" type="button" onClick={backToPicker}>
            Elegir otras preguntas
          </button>
        </div>
      </main>
    );
  }

  const canValidate =
    question.type === "multiple_choice"
      ? Boolean(selected)
      : question.type === "drag_and_drop"
        ? dndAnswers.filter(Boolean).length === question.correctAnswers.length
        : tableBlankCells(question.table).every((cell) => Boolean(tableAnswers[cellKey(cell.row, cell.col)]));

  return (
    <main className="main">
      <SubjectHero modeLabel="Modo practica" questionsCount={questions.length} subject={subject} />
      <section className="quiz-layout">
        <article className="quiz-card quiz-stage">
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
          ) : (
            <TableDragDropAnswer
              key={question.id}
              table={question.table}
              options={question.draggableOptions}
              disabled={checked !== null}
              results={checked !== null ? tableResults : undefined}
              onChange={setTableAnswers}
            />
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
        </article>

        <aside className="quiz-sidebar">
          <div className="summary-panel">
            <h2>Resumen</h2>
            <p>Seguimiento rápido de tu práctica actual.</p>
            <div className="summary-grid">
              {activeQuestions.map((item, itemIndex) => (
                <span className={`summary-step ${itemIndex === index ? "active" : itemIndex < index ? "done" : ""}`} key={item.id}>
                  {itemIndex + 1}
                </span>
              ))}
            </div>
            <div className="summary-progress-card">
              <div>
                <span>Precisión general</span>
                <strong>
                  {index === 0 ? 0 : Math.round((score / index) * 100)}%
                </strong>
              </div>
              <div className="summary-progress-bar">
                <span style={{ width: `${index === 0 ? 0 : Math.round((score / index) * 100)}%` }} />
              </div>
              <div className="summary-meta-row">
                <span>
                  <Clock3 size={16} />
                  sesión activa
                </span>
                <span>
                  <Sparkles size={16} />
                  nivel práctica
                </span>
              </div>
            </div>
          </div>
        </aside>
      </section>
      <div className="practice-footer">
        <button className="ghost-button" type="button" onClick={backToPicker}>
          Elegir preguntas
        </button>
      </div>
    </main>
  );
}

function Feedback({ question, isCorrect }: { question: Question; isCorrect: boolean }) {
  const correctText =
    question.type === "multiple_choice"
      ? question.correctAnswer
      : question.type === "drag_and_drop"
        ? question.correctAnswers.join(" / ")
        : tableBlankCells(question.table)
            .map((cell) => `(${cell.row + 1},${cell.col + 1}) ${[cell.correctAnswer, ...(cell.acceptedAnswers ?? [])].filter(Boolean).join(" o ")}`)
            .join(" / ");
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

function PracticePicker({
  questions,
  onStart,
  subject
}: {
  questions: Question[];
  onStart: (questions: Question[]) => void;
  subject: SubjectSummary;
}) {
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

  return (
    <main className="main practice-picker">
      <SubjectHero modeLabel="Modo practica" questionsCount={questions.length} subject={subject} />
      <section className="quiz-card picker-card">
        <div className="section-title">
          <h1>Elegir práctica</h1>
          <strong className="list-count">{selectedQuestions.length} seleccionada(s)</strong>
        </div>

        <div className="picker-actions">
          <button className="filter-chip active" type="button" onClick={() => setSelectedIds(questions.map((question) => question.id))}>
            Todas
          </button>
          <button className="filter-chip" type="button" onClick={() => setSelectedIds(questions.slice(-5).map((question) => question.id))}>
            Últimas 5
          </button>
          <button className="filter-chip" type="button" onClick={() => setSelectedIds(questions.slice(30).map((question) => question.id))}>
            Sin unidad 1
          </button>
          <button className="filter-chip" type="button" onClick={() => setSelectedIds(questions.slice(60).map((question) => question.id))}>
            Sin unidades 1 y 2
          </button>
          <button className="filter-chip" type="button" onClick={() => selectByType("multiple_choice")}>
            Multiple choice
          </button>
          <button className="filter-chip" type="button" onClick={() => selectByType("drag_and_drop")}>
            Frases
          </button>
          <button className="filter-chip" type="button" onClick={() => selectByType("table_drag_and_drop")}>
            Tablas
          </button>
          <button className="filter-chip" type="button" onClick={() => setSelectedIds([])}>
            Ninguna
          </button>
        </div>

        <div className="picker-list">
          {questions.map((question, questionIndex) => (
            <label className="picker-item" key={question.id}>
              <input checked={selectedIds.includes(question.id)} type="checkbox" onChange={() => toggleQuestion(question.id)} />
              <span className="type-pill">{questionTypeLabel(question.type)}</span>
              <strong>{questionIndex + 1}.</strong>
              <span>{question.statement}</span>
            </label>
          ))}
        </div>

        <div className="actions-row">
          <button className="primary-button" type="button" disabled={selectedQuestions.length === 0} onClick={() => onStart(selectedQuestions)}>
            Comenzar práctica
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </main>
  );
}

function ImportPage({
  onSaved,
  initialSubject,
  subjects
}: {
  onSaved: () => Promise<void>;
  initialSubject: SubjectDraft;
  subjects: SubjectSummary[];
}) {
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus | null>(null);
  const [subjectDraft, setSubjectDraft] = useState<SubjectDraft>(initialSubject);
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
    if (drafts.length === 0) {
      setSubjectDraft(initialSubject);
    }
  }, [drafts.length, initialSubject]);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      uploadFiles(files);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  async function uploadFiles(files: File[] | FileList | null) {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setMessage("No encontre imagenes para importar.");
      return;
    }

    setBusy(true);
    setMessage("Procesando OCR...");
    try {
      const response = await uploadOcrImages(imageFiles);
      setOcrStatus(response.providerStatus);
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
        normalizeQuestionInput({ ...draft.parsedQuestion, ocrText: draft.text, ...subjectDraft })
      );
      const questionsToSave = [...draftQuestions];
      if (showTableBuilder && tableBlankCells(tableBuilder.table).length > 0 && tableBuilder.statement.trim()) {
        questionsToSave.push(
          normalizeQuestionInput({
            type: "table_drag_and_drop",
            statement: tableBuilder.statement.trim(),
            table: tableBuilder.table,
            draggableOptions: tableBuilder.options,
            ...subjectDraft
          })
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
        normalizeQuestionInput({
          type: "table_drag_and_drop",
          statement: tableBuilder.statement.trim(),
          table: tableBuilder.table,
          draggableOptions: tableBuilder.options,
          ...subjectDraft
        })
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
        <SubjectFieldsEditor compact subject={subjectDraft} onChange={setSubjectDraft} subjects={subjects} />
        {ocrStatus ? (
          <p className={`provider-status ${ocrStatus.awsTextractReady ? "ready" : "warning"}`}>
            OCR activo: {ocrStatus.effectiveProvider}
            {ocrStatus.configuredProvider === "aws-textract" ? ` · provider global: ${ocrStatus.configuredProvider}` : ""}
            {ocrStatus.fallbackToTesseract ? " · fallback a tesseract habilitado" : ""}
            {!ocrStatus.canUseAwsTextract && ocrStatus.configuredProvider === "aws-textract"
              ? " · tu cuenta usa OCR estándar; Textract está reservado a administración"
              : ""}
            {!ocrStatus.awsTextractReady ? `. Faltan credenciales AWS: ${ocrStatus.missingAwsCredentials.join(", ")}` : ""}
          </p>
        ) : null}
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

  function setType(nextType: QuestionType) {
    if (nextType === question.type) {
      return;
    }

    if (nextType === "multiple_choice") {
      onChange({
        type: "multiple_choice",
        statement: question.statement,
        options: question.type === "multiple_choice" ? question.options : question.draggableOptions,
        correctAnswer:
          question.type === "multiple_choice"
            ? question.correctAnswer
            : question.type === "drag_and_drop"
              ? question.correctAnswers[0] ?? ""
              : tableBlankCells(question.table)[0]?.correctAnswer ?? "",
        ocrText: draft.text
      });
      return;
    }

    if (nextType === "table_drag_and_drop") {
      const sourceOptions = question.type === "multiple_choice" ? question.options : question.draggableOptions;
      onChange({
        type: "table_drag_and_drop",
        statement: question.statement,
        table: makeEmptyTable(4, 4),
        draggableOptions: sourceOptions.length > 0 ? sourceOptions : ["By", "Vector Base", "costo de oportunidad", "valor marginal"],
        ocrText: draft.text
      });
      return;
    }

    const answer =
      question.type === "multiple_choice"
        ? question.correctAnswer
        : question.type === "drag_and_drop"
          ? question.correctAnswers[0] ?? ""
          : tableBlankCells(question.table)[0]?.correctAnswer ?? "";
    onChange({
      type: "drag_and_drop",
      statement: question.statement,
      textParts: [question.statement, "__blank__"],
      draggableOptions: question.type === "multiple_choice" ? question.options : question.draggableOptions,
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
      ) : (
        <TableQuestionEditor
          table={question.table}
          options={question.draggableOptions}
          onTableChange={(table) => onChange({ ...question, table, ocrText: draft.text })}
          onOptionsChange={(draggableOptions) => onChange({ ...question, draggableOptions, ocrText: draft.text })}
        />
      )}
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
  return "Tabla drag";
}

function questionSearchText(question: Question) {
  if (question.type === "multiple_choice") {
    return [
      question.statement,
      question.type,
      question.subject.name,
      question.subject.careerName,
      String(question.subject.yearNumber),
      ...question.options,
      question.correctAnswer
    ]
      .join(" ")
      .toLowerCase();
  }
  if (question.type === "drag_and_drop") {
    return [
      question.statement,
      question.type,
      question.subject.name,
      question.subject.careerName,
      String(question.subject.yearNumber),
      ...question.textParts,
      ...question.draggableOptions,
      ...question.correctAnswers
    ]
      .join(" ")
      .toLowerCase();
  }
  return [
    question.statement,
    question.type,
    question.subject.name,
    question.subject.careerName,
    String(question.subject.yearNumber),
    ...question.draggableOptions,
    ...question.table.cells.flatMap((cell) => [cell.content, cell.correctAnswer ?? "", ...(cell.acceptedAnswers ?? [])])
  ]
    .join(" ")
    .toLowerCase();
}

function SubjectFieldsEditor({
  subject,
  onChange,
  subjects,
  compact = false
}: {
  subject: SubjectDraft;
  onChange: (subject: SubjectDraft) => void;
  subjects: SubjectSummary[];
  compact?: boolean;
}) {
  const knownMatch = subjects.find((item) => item.slug === subject.subjectSlug);

  return (
    <div className={`subject-fields ${compact ? "compact" : ""}`}>
      <div className="section-title">
        <h2>Contexto de materia</h2>
        {knownMatch ? <span className="type-pill">Materia existente</span> : <span className="type-pill">Nueva materia</span>}
      </div>
      <div className="dimension-grid">
        <label>
          Slug
          <input
            value={subject.subjectSlug}
            onChange={(event) => onChange({ ...subject, subjectSlug: event.target.value })}
            placeholder="investigacion-operativa"
          />
        </label>
        <label>
          Año
          <input
            min={1}
            type="number"
            value={subject.yearNumber}
            onChange={(event) => onChange({ ...subject, yearNumber: Number(event.target.value) || 1 })}
          />
        </label>
      </div>
      <label>
        Nombre de la materia
        <input value={subject.subjectName} onChange={(event) => onChange({ ...subject, subjectName: event.target.value })} />
      </label>
      <label>
        Carrera
        <input value={subject.careerName} onChange={(event) => onChange({ ...subject, careerName: event.target.value })} />
      </label>
      <small>
        Si el slug ya existe, se reutiliza esa materia. Si no existe, se crea con este nombre, carrera y año.
      </small>
    </div>
  );
}

function UsersAdminPanel({ currentUser }: { currentUser: SessionUser }) {
  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [message, setMessage] = useState("");

  const summary = useMemo(() => {
    const list = users ?? [];
    return {
      total: list.length,
      pending: list.filter((user) => user.status === "pending").length,
      active: list.filter((user) => user.status === "active").length,
      admins: list.filter((user) => user.role === "admin").length
    };
  }, [users]);

  async function loadUsers() {
    setUsers((current) => current);
    try {
      const response = await getAdminUsers();
      setUsers(response);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los usuarios.");
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function changeStatus(userId: string, status: UserStatus) {
    try {
      await updateAdminUserStatus(userId, status);
      await loadUsers();
      setMessage("Estado actualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el estado.");
    }
  }

  async function changeRole(userId: string, role: UserRole) {
    try {
      await updateAdminUserRole(userId, role);
      await loadUsers();
      setMessage("Rol actualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el rol.");
    }
  }

  return (
    <section className="list-panel users-panel">
      <div className="section-title">
        <h1>Usuarios</h1>
        <span className="list-count">{users?.length ?? 0}</span>
      </div>
      <div className="admin-user-summary">
        <article className="admin-user-stat">
          <Users size={20} />
          <div>
            <strong>{summary.total}</strong>
            <span>registrados</span>
          </div>
        </article>
        <article className="admin-user-stat">
          <Clock3 size={20} />
          <div>
            <strong>{summary.pending}</strong>
            <span>pendientes</span>
          </div>
        </article>
        <article className="admin-user-stat">
          <ShieldCheck size={20} />
          <div>
            <strong>{summary.admins}</strong>
            <span>admins</span>
          </div>
        </article>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
      <div className="question-list users-list">
        {(users ?? []).map((user) => (
          <article className="question-item user-card" key={user.id}>
            <div className="user-card-main">
              <div className="user-card-head">
                <span className="session-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
                <div>
                  <h2>{user.displayName}</h2>
                  <p className="question-subject-meta">{user.email}</p>
                </div>
              </div>
              <div className="user-card-meta">
                <span className={`status-badge ${user.status}`}>{user.status}</span>
                <span className="type-pill">{user.role}</span>
                <span className="user-meta-item">
                  <CalendarDays size={14} />
                  Alta {formatDateLabel(user.createdAt)}
                </span>
              </div>
            </div>
            <div className="admin-user-actions">
              <button
                className="ghost-button"
                disabled={user.id === currentUser.id}
                type="button"
                onClick={() => changeStatus(user.id, user.status === "active" ? "pending" : "active")}
              >
                {user.status === "active" ? "Pausar" : "Aprobar"}
              </button>
              <button
                className="ghost-button"
                disabled={user.id === currentUser.id}
                type="button"
                onClick={() => changeRole(user.id, user.role === "admin" ? "editor" : "admin")}
              >
                {user.role === "admin" ? "Bajar a editor" : "Subir a admin"}
              </button>
            </div>
          </article>
        ))}
        {users?.length === 0 ? <p className="helper-text">Todavía no hay usuarios registrados.</p> : null}
      </div>
    </section>
  );
}

function AdminPage({
  authUser,
  questions,
  onChange,
  initialSubject,
  subjects
}: {
  authUser: SessionUser | null;
  questions: Question[];
  onChange: () => Promise<void>;
  initialSubject: SubjectDraft;
  subjects: SubjectSummary[];
}) {
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
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectDraft, setSubjectDraft] = useState<SubjectDraft>(initialSubject);

  useEffect(() => {
    if (!editingId) {
      setSubjectDraft(initialSubject);
    }
  }, [initialSubject, editingId]);

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
    setMessage("");
    setSubjectDraft(initialSubject);
    if (nextType === "multiple_choice") {
      setOptions(["", ""]);
      setCorrectAnswer("");
    } else if (nextType === "drag_and_drop") {
      setTextPartsRaw("El __blank__ se visualiza en la linea de optimalidad");
      setDraggableOptions(["", "", ""]);
      setCorrectAnswers([""]);
    } else {
      setTable(makeEmptyTable(3, 3));
      setTableOptions(["", "", ""]);
    }
  }

  function edit(question: Question) {
    setEditingId(question.id);
    setType(question.type);
    setStatement(question.statement);
    setMessage("");
    setSubjectDraft(subjectDraftFromSubject(question.subject));
    if (question.type === "multiple_choice") {
      setOptions(question.options);
      setCorrectAnswer(question.correctAnswer);
    } else if (question.type === "drag_and_drop") {
      setTextPartsRaw(question.textParts.join(""));
      setDraggableOptions(question.draggableOptions);
      setCorrectAnswers(question.correctAnswers);
    } else {
      setTable(question.table);
      setTableOptions(question.draggableOptions);
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
              ...subjectDraft
            }
          : type === "drag_and_drop"
            ? {
                type,
                statement: statement.trim(),
                textParts: parseDragTextParts(textPartsRaw),
                draggableOptions: cleanList(draggableOptions),
                correctAnswers: cleanList(correctAnswers),
                ...subjectDraft
              }
            : {
                type,
                statement: statement.trim(),
                table,
                draggableOptions: cleanList([
                  ...tableOptions,
                  ...tableBlankCells(table).flatMap((cell) => [cell.correctAnswer ?? "", ...(cell.acceptedAnswers ?? [])])
                ]),
                ...subjectDraft
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
        </div>

        <SubjectFieldsEditor subject={subjectDraft} onChange={setSubjectDraft} subjects={subjects} />

        <label>
          Enunciado
          <textarea value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Escribi la consigna..." />
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
        ) : (
          <TableQuestionEditor table={table} options={tableOptions} onTableChange={setTable} onOptionsChange={setTableOptions} />
        )}

        {message ? <p className="form-message">{message}</p> : null}
        <button className="primary-button" type="button" onClick={save}>
          <Save size={18} />
          Guardar pregunta
        </button>
      </section>

      <div className="admin-side-stack">
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
                  <p className="question-subject-meta">
                    {yearLabel(question.subject.yearNumber)} · {question.subject.name}
                  </p>
                  <h2>{question.statement}</h2>
                </div>
                <div className="item-actions">
                  <button className="icon-button" type="button" onClick={() => edit(question)} aria-label="Editar">
                    <Pencil size={18} />
                  </button>
                  {authUser?.role === "admin" ? (
                    <button className="icon-button danger" type="button" onClick={() => remove(question.id)} aria-label="Eliminar">
                      <Trash2 size={18} />
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {filteredQuestions.length === 0 ? <p className="helper-text">No hay preguntas que coincidan con la busqueda.</p> : null}
          </div>
        </section>
        {authUser?.role === "admin" ? <UsersAdminPanel currentUser={authUser} /> : null}
      </div>
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
                  name="correct-answer"
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
