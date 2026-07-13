import path from "path";
import { fileURLToPath } from "url";

const configuredJwtSecret = process.env.JWT_SECRET;

if (!configuredJwtSecret || configuredJwtSecret.trim().length < 32) {
  throw new Error(
    "JWT_SECRET environment variable is required, must not be blank, and must contain at least 32 characters.",
  );
}

export const jwtSecret = configuredJwtSecret;

const configuredDatabasePath = process.env.DATABASE_PATH;
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

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = path.join(currentDir, "..", "database.sqlite");

export const databasePath = configuredDatabasePath || defaultDatabasePath;
export const asaasWebhookToken = configuredAsaasWebhookToken;
