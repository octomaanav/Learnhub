import "dotenv/config";
import express from "express";
import session from "express-session";
import passport from "passport";
import cors from "cors";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { seed } from "./db/seed.js";
import { seedLessons } from "./db/seedLessons.js";
import usersRouter from "./routes/users.js";
import accountsRouter from "./routes/accounts.js";
import parseSourceRouter from "./routes/parse_source.js";
import brailleRouter from "./routes/braille.js";
import lessonsRouter from "./routes/lessons.js";
import curriculumRouter from "./routes/curriculum.js";
import adminRouter from "./routes/admin.js";
import uploadRouter from "./routes/upload.js";
import storyRouter from "./routes/story.js";
import { storageConfig } from "./utils/storage.js";
import { startWorkerLoop } from "./worker/index.js";
import { startScheduler } from "./scheduler/index.js";
import contentRouter from "./routes/content.js";
import storyV2Router from "./routes/story_v2.js";
import brailleV2Router from "./routes/braille_v2.js";
import webhooksRouter from "./routes/webhooks.js";
import { sendProactiveNudges } from "./services/telegramService.js";

const app = express();
app.set("trust proxy", 1); // Trust first proxy (Render load balancer)
app.set("etag", false);

// Health Check Endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((req, res, next) => {
  const start = Date.now();
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    const ms = Date.now() - start;
    console.log(`[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`, body);
    return originalJson(body);
  };
  res.on("finish", () => {
    if (res.headersSent && res.statusCode !== 200) {
      console.log(`[api] ${req.method} ${req.originalUrl} ${res.statusCode}`);
    }
  });
  next();
});
// CORS configuration - allow multiple origins
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:5173",
  "https://gemini-hack-puce.vercel.app",
].map(url => url.replace(/\/$/, '')); // Normalize by removing trailing slashes

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      } else {
        console.log(`CORS blocked: Origin ${origin} not in allowed list: ${allowedOrigins.join(', ')}`);
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve generated media (story slides, video assets)
if (storageConfig.provider === "local") {
  app.use("/media", express.static(storageConfig.localRoot));
}

// Add debug endpoint for cookies
app.get("/api/auth/debug", (req, res) => {
  res.json({
    sessionID: req.sessionID,
    user: req.user,
    cookies: req.headers.cookie,
    env: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL
  });
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "learnlens-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);


app.use(passport.initialize());
app.use(passport.session());

app.use("/users", usersRouter);
app.use("/api/auth", accountsRouter);
app.use("/api/parse", parseSourceRouter);
app.use("/api/braille", brailleRouter);
app.use("/api/lessons", lessonsRouter);
app.use("/api/curriculum", curriculumRouter);
app.use("/api/admin", adminRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/story", storyRouter);
app.use("/api/content", contentRouter);
app.use("/api/story_v2", storyV2Router);
app.use("/api/braille_v2", brailleV2Router);
app.use("/api/webhooks", webhooksRouter);

// Demo endpoint to trigger Telegram Nudge
app.post("/api/telegram/nudge", async (req, res) => {
  try {
    await sendProactiveNudges();
    res.json({ success: true, message: "Nudges triggered successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start DB-backed worker loop in this process (no Redis)
startWorkerLoop().catch((err) => {
  console.error("[worker] failed to start", err);
});

startScheduler();

async function startServer() {
  const PORT = process.env.PORT || 8000;

  const requiredEnvVars = [
    "DATABASE_URL",
    "GEMINI_API_KEY",
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (varName) => !process.env[varName] || process.env[varName]?.trim() === ""
  );

  if (missingEnvVars.length > 0) {
    console.error("Missing required environment variables!");
    console.error(
      `The following environment variables are not set: ${missingEnvVars.join(", ")}`
    );
    console.error(
      "Please set these variables in your .env file or environment."
    );
    process.exit(1);
  }

  console.log("All required environment variables are set");

  // Database connection check
  try {
    await db.execute(sql`SELECT 1`);
    console.log("Connected to database");
  } catch (error) {
    console.error("Database connection error:", error);
    console.error("Could not connect to database. Did you run docker compose up?");
    process.exit(1);
  }

  // Seed database with default data (curricula, classes, subjects, chapters)
  try {
    console.log("Seeding database...");
    await seed();
    console.log("Basic seed data created");
  } catch (error) {
    console.error("Error creating default seed data!");
    console.error(error);
    process.exit(1);
  }

  // Seed lessons from JSON files
  try {
    console.log("Seeding lessons from JSON files...");
    await seedLessons();
    console.log("Lesson seeding complete");
  } catch (error) {
    console.warn("Lesson seeding failed or skipped (this is optional):", error);
    // Don't exit - lesson seeding is optional
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
