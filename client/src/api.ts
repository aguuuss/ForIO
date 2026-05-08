import type { AuthUser, Question, QuestionInput, SessionUser, SubjectSummary, UserRole, UserStatus } from "./types/questions";

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
    credentials: "include",
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

export function getCurrentUser() {
  return request<{ user: SessionUser | null }>("/api/auth/me");
}

export function register(payload: { email: string; password: string; displayName: string }) {
  return request<{ user: AuthUser; message: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function login(payload: { email: string; password: string }) {
  return request<{ user: SessionUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function logout() {
  return request<void>("/api/auth/logout", {
    method: "POST"
  });
}

export function getAdminUsers() {
  return request<AuthUser[]>("/api/admin/users");
}

export function updateAdminUserStatus(id: string, status: UserStatus) {
  return request<AuthUser>(`/api/admin/users/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function updateAdminUserRole(id: string, role: UserRole) {
  return request<AuthUser>(`/api/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role })
  });
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
    credentials: "include",
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
