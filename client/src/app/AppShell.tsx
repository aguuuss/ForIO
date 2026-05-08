import { ClipboardList, HelpCircle, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import type { SessionUser } from "@/types/questions";
import type { PublicRoute } from "@/lib/routes";

type AppShellProps = {
  authUser: SessionUser | null;
  route: PublicRoute;
  selectedSubjectName: string | null;
  selectedPracticePath: string | null;
  selectedExamPath: string | null;
  onNavigate: (path: string) => void;
  onLogout: () => Promise<void>;
  children: ReactNode;
  footer?: ReactNode;
};

export function AppShell({
  authUser,
  route,
  selectedSubjectName,
  selectedPracticePath,
  selectedExamPath,
  onNavigate,
  onLogout,
  children,
  footer
}: AppShellProps) {
  const topbarContext =
    selectedSubjectName && (route.kind === "practice" || route.kind === "exam")
      ? `${route.kind === "exam" ? "Examen" : "Práctica"}: ${selectedSubjectName}`
      : null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button className="brand" type="button" onClick={() => onNavigate("/")}>
            <ClipboardList size={22} />
            <span>ForIO</span>
          </button>
          {topbarContext ? <span className="topbar-context">{topbarContext}</span> : null}
        </div>

        <nav className="topbar-nav">
          <button className={route.kind === "home" ? "active" : ""} type="button" onClick={() => onNavigate("/")}>
            Catalogo
          </button>
          <button
            className={route.kind === "practice" ? "active" : ""}
            disabled={!selectedPracticePath}
            type="button"
            onClick={() => selectedPracticePath && onNavigate(selectedPracticePath)}
          >
            Practica
          </button>
          <button
            className={route.kind === "exam" ? "active" : ""}
            disabled={!selectedExamPath}
            type="button"
            onClick={() => selectedExamPath && onNavigate(selectedExamPath)}
          >
            Examen
          </button>
          <button className={route.kind === "admin" ? "active" : ""} type="button" onClick={() => onNavigate("/admin")}>
            Admin
          </button>
        </nav>

        <div className="topbar-actions">
          <button className="support-link" type="button">
            <HelpCircle size={18} />
            Support
          </button>
          {!authUser ? (
            <button className={`session-button ${route.kind === "auth" ? "active" : ""}`} type="button" onClick={() => onNavigate("/auth")}>
              Ingresar
            </button>
          ) : (
            <>
              <div className="session-pill">
                <span className="session-avatar">{authUser.displayName.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{authUser.displayName}</strong>
                  <span>
                    {authUser.role} · {authUser.status}
                  </span>
                </div>
              </div>
              <button className="support-link" type="button" onClick={onLogout}>
                <LogOut size={18} />
                Salir
              </button>
            </>
          )}
        </div>
      </header>

      {children}
      {footer}
    </div>
  );
}
