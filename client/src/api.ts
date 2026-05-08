import type { Question, QuestionInput, SubjectSummary } from "./types/questions";

export type OcrUploadResult = {
  filename: string;
  provider: string;
  text: string;
  lines: string[];
  blocks?: Array<{
    id?: string;
    blockType?: string;
    text?: string;
    confidence?: number;
    page?: number;
  }>;
  confidence?: number;
  parsedQuestion: QuestionInput;
};

export type OcrStatus = {
  provider: string;
  fallbackToTesseract: boolean;
  awsTextractReady: boolean;
  missingAwsCredentials: string[];
};

export type QuestionFilters = {
  subjectSlug?: string;
  yearNumber?: number;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `Error HTTP ${response.status}.` }));
    throw new Error(error.message ?? "Error inesperado.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getQuestions(filters?: QuestionFilters) {
  const query = new URLSearchParams();
  if (filters?.subjectSlug) {
    query.set("subjectSlug", filters.subjectSlug);
  }
  if (typeof filters?.yearNumber === "number") {
    query.set("yearNumber", String(filters.yearNumber));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return request<Question[]>(`/api/questions${suffix}`);
}

export function getSubjects() {
  return request<SubjectSummary[]>("/api/subjects");
}

export function createQuestion(question: QuestionInput) {
  return request<Question>("/api/questions", {
    method: "POST",
    body: JSON.stringify(question)
  });
}

export function createQuestionsBulk(questions: QuestionInput[]) {
  return request<Question[]>("/api/questions/bulk", {
    method: "POST",
    body: JSON.stringify({ questions })
  });
}

export function updateQuestion(id: string, question: QuestionInput) {
  return request<Question>(`/api/questions/${id}`, {
    method: "PUT",
    body: JSON.stringify(question)
  });
}

export function deleteQuestion(id: string) {
  return request<void>(`/api/questions/${id}`, { method: "DELETE" });
}

export function getOcrStatus() {
  return request<OcrStatus>("/api/ocr/status");
}

export async function uploadOcrImages(files: File[]) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }

  const response = await fetch("/api/ocr/upload", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "No se pudo procesar OCR." }));
    throw new Error(error.message ?? "No se pudo procesar OCR.");
  }

  return response.json() as Promise<{ results: OcrUploadResult[] }>;
}

export function parseQuestionFromText(text: string) {
  return request<QuestionInput>("/api/ocr/parse-question", {
    method: "POST",
    body: JSON.stringify({ text })
  });
}
