const configuredJwtSecret = process.env.JWT_SECRET;

if (!configuredJwtSecret || configuredJwtSecret.trim().length < 32) {
  throw new Error(
    "JWT_SECRET environment variable is required, must not be blank, and must contain at least 32 characters.",
  );
}

export const jwtSecret = configuredJwtSecret;
