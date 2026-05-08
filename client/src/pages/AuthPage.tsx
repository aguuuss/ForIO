import { ArrowRight, LifeBuoy } from "lucide-react";
import { useState } from "react";
import { login, register } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SessionUser } from "@/types/questions";

export function AuthPage({
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
            <Button type="button" onClick={onGoAdmin}>
              Ir al admin
            </Button>
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
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
        ) : null}
        <label>
          Email
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label>
          Contraseña
          <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </label>
        {message ? <p className="form-message">{message}</p> : null}
        <Button disabled={busy} type="button" onClick={submit}>
          {mode === "login" ? "Ingresar" : "Crear cuenta"}
          <ArrowRight size={18} />
        </Button>
        <div className="auth-support">
          <LifeBuoy size={18} />
          <span>¿Necesitás ayuda? Contactar soporte</span>
        </div>
      </section>
    </main>
  );
}

export function PendingAccessPage() {
  return (
    <main className="main auth-page">
      <section className="quiz-card auth-card">
        <h1>Cuenta pendiente de aprobación</h1>
        <p>Ya tenés cuenta, pero todavía no podés cargar ni modificar contenido hasta que un admin la active.</p>
      </section>
    </main>
  );
}
