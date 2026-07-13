import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const configuredJwtSecret = process.env.JWT_SECRET;

if (!configuredJwtSecret || configuredJwtSecret.trim().length < 32) {
  throw new Error(
    "JWT_SECRET environment variable is required, must not be blank, and must contain at least 32 characters.",
  );
}

export const jwtSecret = configuredJwtSecret;

const configuredDatabasePath = process.env.DATABASE_PATH;
const configuredUploadsDir = process.env.UPLOADS_DIR;
const isProduction = process.env.NODE_ENV === "production";
const configuredAsaasWebhookToken = process.env.ASAAS_WEBHOOK_TOKEN;

if (isProduction) {
  if (!configuredAsaasWebhookToken) {
    throw new Error("ASAAS_WEBHOOK_TOKEN environment variable is required in production.");
  }

  if (
    configuredAsaasWebhookToken.length < 32 ||
    configuredAsaasWebhookToken.length > 255 ||
    /\s/.test(configuredAsaasWebhookToken)
  ) {
    throw new Error(
      "ASAAS_WEBHOOK_TOKEN must contain between 32 and 255 non-whitespace characters in production.",
    );
  }
}

if (isProduction && !configuredDatabasePath?.trim()) {
  throw new Error("DATABASE_PATH environment variable is required in production.");
}

if (isProduction && !path.isAbsolute(configuredDatabasePath!)) {
  throw new Error("DATABASE_PATH must be an absolute path in production.");
}

if (isProduction && !configuredUploadsDir?.trim()) {
  throw new Error("UPLOADS_DIR environment variable is required in production.");
}

if (isProduction && !path.isAbsolute(configuredUploadsDir!.trim())) {
  throw new Error("UPLOADS_DIR must be an absolute path in production.");
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = path.join(currentDir, "..", "database.sqlite");
const defaultUploadsDir = path.join(currentDir, "..", "uploads");

export const databasePath = configuredDatabasePath || defaultDatabasePath;
export const asaasWebhookToken = configuredAsaasWebhookToken;
export const uploadsDir = configuredUploadsDir?.trim() || defaultUploadsDir;
export const publicUploadsDir = path.join(uploadsDir, "public");
export const privateUploadsDir = path.join(uploadsDir, "private");
export const privateDocumentsDir = path.join(privateUploadsDir, "documents");

fs.mkdirSync(publicUploadsDir, { recursive: true });
fs.mkdirSync(privateUploadsDir, { recursive: true });
fs.mkdirSync(privateDocumentsDir, { recursive: true });
