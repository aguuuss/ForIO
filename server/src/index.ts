import "./env.js";
import cors from "cors";
import express from "express";
import multer from "multer";
import { authCookieMiddleware, loadSessionUser, requireAdmin, requireEditor } from "./auth.js";
import { listUsers, loginUser, logoutSession, registerUser, updateUserRole, updateUserStatus } from "./authStore.js";
import { AUTH_COOKIE_NAME, AUTH_SESSION_TTL_DAYS, initializeDatabase } from "./db.js";
import { createOcrProvider, getOcrStatus } from "./ocrProvider.js";
import { parseQuestionFromOcr } from "./parseQuestion.js";
import { createQuestion, createQuestionsBulk, deleteQuestion, getQuestions, listSubjects, updateQuestion } from "./store.js";
import type { AuthenticatedRequest } from "./auth.js";
import type { UserRole, UserStatus } from "./types.js";

const app = express();
const port = Number(process.env.PORT) || 4000;
const isProduction = process.env.NODE_ENV === "production";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 8
  }
});

app.use(
  cors({
    credentials: true,
    origin: true
  })
);
app.use(authCookieMiddleware);
app.use(express.json({ limit: "2mb" }));
app.use(loadSessionUser);

function setSessionCookie(res: express.Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

function clearSessionCookie(res: express.Response) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/"
  });
}

app.get("/api/questions", async (req, res, next) => {
  try {
    const yearNumber = typeof req.query.yearNumber === "string" ? Number(req.query.yearNumber) : undefined;
    res.json(
      await getQuestions({
        subjectSlug: typeof req.query.subjectSlug === "string" ? req.query.subjectSlug : undefined,
        yearNumber: Number.isFinite(yearNumber) ? yearNumber : undefined
      })
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/subjects", async (_req, res, next) => {
  try {
    res.json(await listSubjects());
  } catch (error) {
    next(error);
  }
});

app.get("/api/ocr/status", (_req, res) => {
  res.json(getOcrStatus());
});

app.get("/api/auth/me", (req, res) => {
  const authReq = req as AuthenticatedRequest;
  res.json({ user: authReq.authUser });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const user = await registerUser(req.body);
    res.status(201).json({
      user,
      message: "Cuenta creada. Queda pendiente de aprobación por un administrador."
    });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudo registrar la cuenta." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { token, user } = await loginUser(req.body);
    setSessionCookie(res, token);
    res.json({ user });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudo iniciar sesión." });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (typeof token === "string" && token) {
      await logoutSession(token);
    }
    clearSessionCookie(res);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudo cerrar sesión." });
  }
});

app.get("/api/admin/users", requireAdmin, async (_req, res, next) => {
  try {
    res.json(await listUsers());
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/users/:id/status", requireAdmin, async (req, res) => {
  try {
    const status = req.body.status as UserStatus;
    if (status !== "pending" && status !== "active") {
      res.status(400).json({ message: "Estado inválido." });
      return;
    }
    const user = await updateUserStatus(req.params.id, status);
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado." });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudo actualizar el estado." });
  }
});

app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const role = req.body.role as UserRole;
    if (role !== "editor" && role !== "admin") {
      res.status(400).json({ message: "Rol inválido." });
      return;
    }
    const user = await updateUserRole(req.params.id, role);
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado." });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudo actualizar el rol." });
  }
});

app.post("/api/questions", requireEditor, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const question = await createQuestion({ ...req.body, actorUserId: authReq.authUser?.id });
    res.status(201).json(question);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudo crear la pregunta." });
  }
});

app.post("/api/questions/bulk", requireEditor, async (req, res) => {
  try {
    if (!Array.isArray(req.body.questions)) {
      res.status(400).json({ message: "El body debe tener questions como array." });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const questions = await createQuestionsBulk(req.body.questions.map((question: unknown) => ({
      ...(question as Record<string, unknown>),
      actorUserId: authReq.authUser?.id
    })));
    res.status(201).json(questions);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudieron guardar las preguntas." });
  }
});

app.post("/api/ocr/upload", requireEditor, upload.array("images"), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      res.status(400).json({ message: "Subi al menos una imagen." });
      return;
    }

    const provider = createOcrProvider();
    const results = await Promise.all(
      files.map(async (file) => {
        console.log(`[OCR] Procesando ${file.originalname} con provider=${getOcrStatus().provider}`);
        const ocr = await provider.recognize(file.buffer);
        console.log(
          `[OCR] ${file.originalname} listo provider=${ocr.provider} lineas=${ocr.lines.length} confidence=${ocr.confidence?.toFixed(1) ?? "n/a"}`
        );
        const parsedQuestion = parseQuestionFromOcr(ocr.text);
        return {
          filename: file.originalname,
          provider: ocr.provider,
          text: ocr.text,
          lines: ocr.lines,
          blocks: ocr.blocks,
          confidence: ocr.confidence,
          parsedQuestion
        };
      })
    );

    res.json({ results });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudo procesar OCR." });
  }
});

app.post("/api/ocr/parse-question", requireEditor, (req, res) => {
  try {
    if (typeof req.body.text !== "string" || !req.body.text.trim()) {
      res.status(400).json({ message: "Mandá text con el OCR original." });
      return;
    }

    res.json(parseQuestionFromOcr(req.body.text));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudo interpretar el texto OCR." });
  }
});

app.put("/api/questions/:id", requireEditor, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const question = await updateQuestion(req.params.id, { ...req.body, actorUserId: authReq.authUser?.id });
    if (!question) {
      res.status(404).json({ message: "Pregunta no encontrada." });
      return;
    }
    res.json(question);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudo actualizar la pregunta." });
  }
});

app.delete("/api/questions/:id", requireAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteQuestion(req.params.id);
    if (!deleted) {
      res.status(404).json({ message: "Pregunta no encontrada." });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ message: "Error interno del servidor." });
});

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`API lista en http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("No se pudo inicializar la base de datos.", error);
    process.exit(1);
  });
