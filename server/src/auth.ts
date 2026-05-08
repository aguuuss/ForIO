import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE_NAME } from "./db.js";
import { getSessionUserByToken } from "./authStore.js";
import type { SessionUser } from "./types.js";

export type AuthenticatedRequest = Request & {
  authUser: SessionUser | null;
};

export const authCookieMiddleware = cookieParser();

export async function loadSessionUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    authReq.authUser = token ? await getSessionUserByToken(token) : null;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.authUser) {
    res.status(401).json({ message: "Necesitás iniciar sesión." });
    return;
  }
  next();
}

export function requireActiveUser(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.authUser) {
    res.status(401).json({ message: "Necesitás iniciar sesión." });
    return;
  }
  if (authReq.authUser.status !== "active") {
    res.status(403).json({ message: "Tu cuenta está pendiente de aprobación." });
    return;
  }
  next();
}

export function requireEditor(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.authUser) {
    res.status(401).json({ message: "Necesitás iniciar sesión." });
    return;
  }
  if (authReq.authUser.status !== "active") {
    res.status(403).json({ message: "Tu cuenta está pendiente de aprobación." });
    return;
  }
  if (authReq.authUser.role !== "editor" && authReq.authUser.role !== "admin") {
    res.status(403).json({ message: "No tenés permisos suficientes." });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.authUser) {
    res.status(401).json({ message: "Necesitás iniciar sesión." });
    return;
  }
  if (authReq.authUser.status !== "active" || authReq.authUser.role !== "admin") {
    res.status(403).json({ message: "Necesitás permisos de administrador." });
    return;
  }
  next();
}
