/**
 * Server configuration.
 *
 * All secrets MUST come from environment variables. There are no
 * hardcoded credentials or connection strings in this file — a
 * deliberate security decision (see README "Security").
 */
const requiredInProd = ["MONGODB_URI", "JWT_SECRET"];

const missing = requiredInProd.filter((k) => !process.env[k]);
if (missing.length > 0) {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    throw new Error(
      `Missing required environment variables in production: ${missing.join(", ")}. ` +
        "Copy server/.env.example to server/.env and fill in real values."
    );
  }
  console.warn(
    `[config] Development fallbacks active — missing: ${missing.join(", ")}. ` +
      "Set them in server/.env (see server/.env.example)."
  );
}

// Comma-separated list of allowed CORS origins.
const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "http://localhost:8080")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export default {
  port: parseInt(process.env.PORT || "3001", 10),
  mongoUri:
    process.env.MONGODB_URI ||
    (process.env.NODE_ENV === "production" ? undefined : "mongodb://localhost:27017/agreement-trust"),
  jwtSecret:
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production" ? undefined : "dev-only-secret-do-not-use-in-production"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  corsOrigins,
  nodeEnv: process.env.NODE_ENV || "development",
};
