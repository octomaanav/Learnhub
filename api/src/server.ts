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
import bookmarksRouter from "./routes/bookmarks.js";
import progressRouter from "./routes/progress.js";
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
  "https://learnhub-gemini.vercel.app",
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
app.use("/api/bookmarks", bookmarksRouter);
app.use("/api/progress", progressRouter);

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
  const PORT = Number(process.env.PORT) || 8000;

  // Start listening immediately so Cloud Run health checks pass
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`API endpoints available at http://0.0.0.0:${PORT}/api`);
  });

  const requiredEnvVars = [
    "DATABASE_URL",
    "GEMINI_API_KEY",
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (varName) => !process.env[varName] || process.env[varName]?.trim() === ""
  );

  if (missingEnvVars.length > 0) {
    console.error("⚠️ Missing required environment variables:", missingEnvVars.join(", "));
    return; // Don't crash, let health check pass but functionality might be limited
  }

  // Run initialization in background
  (async () => {
    try {
      console.log("Checking database connection...");
      await db.execute(sql`SELECT 1`);
      console.log("✅ Connected to database");

      // Auto-migrate in background
      // Note: In high-scale production, you'd do this via a deploy job, but for hackathons, background is fine.
      try {
        const { migrate } = await import("drizzle-orm/node-postgres/migrator");
        await migrate(db, { migrationsFolder: "drizzle" });
        console.log("✅ Migrations completed successfully");
      } catch (migErr) {
        console.error("❌ Migration failed:", migErr);
      }

      // Seed database
      try {
        console.log("Seeding database...");
        await seed();
        console.log("✅ Basic seed data created");
      } catch (seedErr) {
        console.error("❌ Seeding failed:", seedErr);
      }

      // Seed lessons
      try {
        console.log("Seeding lessons from JSON files...");
        await seedLessons();
        console.log("✅ Lesson seeding complete");
      } catch (lessonErr) {
        console.warn("⚠️ Lesson seeding failed/skipped:", lessonErr);
      }
    } catch (error) {
      console.error("❌ Background initialization failed:", error);
    }
  })();
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
