import { GraduationCap, Layers3 } from "lucide-react";
import type { SubjectSummary } from "@/types/questions";
import { yearLabel } from "@/lib/routes";

export function SubjectHero({
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
