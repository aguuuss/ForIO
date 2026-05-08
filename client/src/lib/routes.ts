import type { SubjectSummary } from "@/types/questions";

export type PublicRoute =
  | { kind: "home" }
  | { kind: "auth" }
  | { kind: "practice"; yearSlug: string; subjectSlug: string }
  | { kind: "exam"; yearSlug: string; subjectSlug: string }
  | { kind: "admin" }
  | { kind: "admin-import" };

export function yearLabel(yearNumber: number) {
  return `${yearNumber}to año`;
}

export function yearSlug(yearNumber: number) {
  return `${yearNumber}to`;
}

export function buildSubjectPath(subject: Pick<SubjectSummary, "slug" | "yearNumber">) {
  return `/${yearSlug(subject.yearNumber)}/${subject.slug}`;
}

export function parseYearSlug(raw: string) {
  const match = raw.trim().match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

export function parsePath(pathname: string): PublicRoute {
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
