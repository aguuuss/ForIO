import crypto from "node:crypto";
import argon2 from "argon2";
import { AUTH_COOKIE_SECRET, AUTH_SESSION_TTL_DAYS, pool } from "./db.js";
import type { AuthUser, SessionUser, UserRole, UserStatus } from "./types.js";

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hashSessionToken(token: string) {
  return crypto.createHmac("sha256", AUTH_COOKIE_SECRET).update(token).digest("hex");
}

function makeSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function sessionExpiryDate() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + AUTH_SESSION_TTL_DAYS);
  return expiry;
}

function mapUser(row: {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function registerUser(input: { email: string; password: string; displayName: string }) {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const password = input.password;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Ingresá un email válido.");
  }
  if (!displayName) {
    throw new Error("El nombre para mostrar es obligatorio.");
  }
  if (password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const exists = await pool.query("SELECT 1 FROM users WHERE email = $1 LIMIT 1", [email]);
  if (exists.rows[0]) {
    throw new Error("Ya existe una cuenta con ese email.");
  }

  const passwordHash = await argon2.hash(password);
  const inserted = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    role: UserRole;
    status: UserStatus;
    created_at: Date;
    updated_at: Date;
  }>(
    `
      INSERT INTO users (id, email, password_hash, display_name, role, status)
      VALUES ($1, $2, $3, $4, 'editor', 'pending')
      RETURNING id, email, display_name, role, status, created_at, updated_at
    `,
    [makeId(), email, passwordHash, displayName]
  );

  return mapUser(inserted.rows[0]);
}

export async function loginUser(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const result = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    password_hash: string;
    role: UserRole;
    status: UserStatus;
    created_at: Date;
    updated_at: Date;
  }>(
    `
      SELECT id, email, display_name, password_hash, role, status, created_at, updated_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Email o contraseña inválidos.");
  }

  const valid = await argon2.verify(row.password_hash, input.password);
  if (!valid) {
    throw new Error("Email o contraseña inválidos.");
  }

  const token = makeSessionToken();
  const expiry = sessionExpiryDate();
  await pool.query(
    `
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [makeId(), row.id, hashSessionToken(token), expiry]
  );

  return {
    token,
    user: {
      ...mapUser(row),
      sessionExpiresAt: expiry.toISOString()
    } satisfies SessionUser
  };
}

export async function logoutSession(token: string) {
  await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashSessionToken(token)]);
}

export async function getSessionUserByToken(token: string): Promise<SessionUser | null> {
  const result = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    role: UserRole;
    status: UserStatus;
    created_at: Date;
    updated_at: Date;
    expires_at: Date;
  }>(
    `
      SELECT
        users.id,
        users.email,
        users.display_name,
        users.role,
        users.status,
        users.created_at,
        users.updated_at,
        sessions.expires_at
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = $1
        AND sessions.expires_at > NOW()
      LIMIT 1
    `,
    [hashSessionToken(token)]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    ...mapUser(row),
    sessionExpiresAt: row.expires_at.toISOString()
  };
}

export async function listUsers() {
  const result = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    role: UserRole;
    status: UserStatus;
    created_at: Date;
    updated_at: Date;
  }>(
    `
      SELECT id, email, display_name, role, status, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `
  );

  return result.rows.map(mapUser);
}

export async function updateUserStatus(userId: string, status: UserStatus) {
  const result = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    role: UserRole;
    status: UserStatus;
    created_at: Date;
    updated_at: Date;
  }>(
    `
      UPDATE users
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, display_name, role, status, created_at, updated_at
    `,
    [userId, status]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function updateUserRole(userId: string, role: UserRole) {
  const result = await pool.query<{
    id: string;
    email: string;
    display_name: string;
    role: UserRole;
    status: UserStatus;
    created_at: Date;
    updated_at: Date;
  }>(
    `
      UPDATE users
      SET role = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, display_name, role, status, created_at, updated_at
    `,
    [userId, role]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}
