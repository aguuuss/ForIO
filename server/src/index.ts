import "./env.js";
import cors from "cors";
import express from "express";
import multer from "multer";
import { initializeDatabase } from "./db.js";
import { createOcrProvider, getOcrStatus } from "./ocrProvider.js";
import { parseQuestionFromOcr } from "./parseQuestion.js";
import { createQuestion, createQuestionsBulk, deleteQuestion, getQuestions, listSubjects, updateQuestion } from "./store.js";

const app = express();
const port = Number(process.env.PORT) || 4000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 8
  }
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

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

app.post("/api/questions", async (req, res) => {
  try {
    const question = await createQuestion(req.body);
    res.status(201).json(question);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudo crear la pregunta." });
  }
});

app.post("/api/questions/bulk", async (req, res) => {
  try {
    if (!Array.isArray(req.body.questions)) {
      res.status(400).json({ message: "El body debe tener questions como array." });
      return;
    }

    const questions = await createQuestionsBulk(req.body.questions);
    res.status(201).json(questions);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudieron guardar las preguntas." });
  }
});

app.post("/api/ocr/upload", upload.array("images"), async (req, res) => {
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

app.post("/api/ocr/parse-question", (req, res) => {
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

app.put("/api/questions/:id", async (req, res) => {
  try {
    const question = await updateQuestion(req.params.id, req.body);
    if (!question) {
      res.status(404).json({ message: "Pregunta no encontrada." });
      return;
    }
    res.json(question);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "No se pudo actualizar la pregunta." });
  }
});

app.delete("/api/questions/:id", async (req, res, next) => {
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
