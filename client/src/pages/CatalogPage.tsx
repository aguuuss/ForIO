import { BarChart3, BookOpen, ChevronRight, ClipboardList, GraduationCap, Users } from "lucide-react";
import { buildSubjectPath, yearLabel } from "@/lib/routes";
import type { Question, SubjectSummary } from "@/types/questions";

export function CatalogPage({
  subjects,
  questions,
  navigate
}: {
  subjects: SubjectSummary[];
  questions: Question[];
  navigate: (path: string) => void;
}) {
  const subjectsByYear = subjects.reduce<Map<number, SubjectSummary[]>>((acc, subject) => {
    const current = acc.get(subject.yearNumber) ?? [];
    current.push(subject);
    acc.set(subject.yearNumber, current);
    return acc;
  }, new Map());

  const questionCountBySubject = questions.reduce<Record<string, number>>((acc, question) => {
    acc[question.subject.slug] = (acc[question.subject.slug] ?? 0) + 1;
    return acc;
  }, {});

  const orderedYears = Array.from(subjectsByYear.keys()).sort((a, b) => a - b);

  return (
    <main className="main catalog-page">
      <section className="catalog-hero">
        <span className="hero-eyebrow">
          <ClipboardList size={15} />
          Catalogo publico
        </span>
        <h1>Entrenamiento por año y materia</h1>
        <p>La app ya quedó lista para crecer como producto: elegís año, entrás a la materia y desde ahí practicás o rendís examen.</p>
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
                <strong>{questions.length}</strong>
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
                <strong>{orderedYears.length}</strong>
                <span>años con catálogo</span>
              </div>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
