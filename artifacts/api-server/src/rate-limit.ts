import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import { createHash } from "crypto";

const minutes = (value: number) => value * 60 * 1000;

const jsonLimitResponse = {
  message: "Muitas requisições. Aguarde alguns minutos e tente novamente.",
};

function createLimiter(windowMs: number, limit: number): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    statusCode: 429,
    message: jsonLimitResponse,
    // This deployment has one backend instance. Multiple instances need a shared store.
  });
}

/**
 * Registration limits must not use only the source IP. Behind a reverse proxy,
 * many legitimate visitors can otherwise be grouped under its address and one
 * visitor's attempts block another person's first registration. The e-mail is
 * normalized and hashed so it is neither retained nor exposed as a rate-limit
 * key. Requests without an e-mail retain the normal IP-based behavior.
 */
function registrationKey(req: Request): string {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email) return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown");
  return `registration:${createHash("sha256").update(email).digest("hex")}`;
}

function createRegistrationLimiter(windowMs: number, limit: number): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    statusCode: 429,
    message: jsonLimitResponse,
    keyGenerator: registrationKey,
    // This deployment has one backend instance. Multiple instances need a shared store.
  });
}

export const globalLimiter = rateLimit({
  windowMs: minutes(15),
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  statusCode: 429,
  message: jsonLimitResponse,
  skip: (req) =>
    req.path === "/healthz" || req.path === "/api/billing/webhook",
  // This deployment has one backend instance. Multiple instances need a shared store.
});

const loginLimiter = rateLimit({
  windowMs: minutes(15),
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  statusCode: 429,
  message: jsonLimitResponse,
  skipSuccessfulRequests: true,
  // This deployment has one backend instance. Multiple instances need a shared store.
});

const forgotPasswordLimiter = createLimiter(minutes(15), 5);
const resendVerificationLimiter = createLimiter(minutes(15), 5);
const resetPasswordLimiter = createLimiter(minutes(15), 10);
const verifyEmailLimiter = createLimiter(minutes(15), 10);
const clientRegistrationLimiter = createRegistrationLimiter(minutes(60), 10);
const desmancheRegistrationLimiter = createRegistrationLimiter(minutes(60), 3);
const guinchoRegistrationLimiter = createRegistrationLimiter(minutes(60), 3);
const cnpjValidationLimiter = createLimiter(minutes(10), 10);
const uploadLimiter = createLimiter(minutes(15), 20);

const loginPaths = new Set([
  "/api/auth/login",
  "/api/auth/login-desmanche",
  "/api/guinchos/login",
]);
const uploadPaths = new Set([
  "/api/upload",
  "/api/documents/upload",
  "/api/guinchos/me/photo",
]);

export function routeLimiters(
  req: Request,
  res: Parameters<RequestHandler>[1],
  next: Parameters<RequestHandler>[2],
) {
  const path = req.path;

  if (req.method === "POST" && loginPaths.has(path)) return loginLimiter(req, res, next);
  if (path === "/api/auth/forgot-password") return forgotPasswordLimiter(req, res, next);
  if (path === "/api/auth/resend-verification") return resendVerificationLimiter(req, res, next);
  if (path === "/api/auth/reset-password") return resetPasswordLimiter(req, res, next);
  if (path === "/api/auth/verify-email") return verifyEmailLimiter(req, res, next);
  if (req.method === "POST" && path === "/api/auth/register") return clientRegistrationLimiter(req, res, next);
  if (req.method === "POST" && path === "/api/auth/register-desmanche") return desmancheRegistrationLimiter(req, res, next);
  if (req.method === "POST" && path === "/api/guinchos/register") return guinchoRegistrationLimiter(req, res, next);
  if (req.method === "POST" && path === "/api/guinchos/validate-cnpj") return cnpjValidationLimiter(req, res, next);
  if (req.method === "POST" && (uploadPaths.has(path) || /^\/api\/orders\/[^/]+\/images$/.test(path))) return uploadLimiter(req, res, next);

  return next();
}
