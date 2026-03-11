import { pgTable, text, timestamp, boolean, uuid, jsonb, integer, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { UserProfile, LessonContentUnion, UnitLessons, StorySlide } from "../../types/index.js";

// =============================================================================
// USERS TABLE
// =============================================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password"),
  salt: text("salt"),

  // Profile data stored as JSONB for flexibility
  profile: jsonb("profile").$type<UserProfile>(),

  // Denormalized fields for quick access/filtering
  curriculumId: uuid("curriculum_id").references(() => curricula.id),
  classId: uuid("class_id").references(() => classes.id),

  isProfileComplete: boolean("is_profile_complete").default(false).notNull(),
  telegramChatId: text("telegram_chat_id").unique(),
  telegramLinkingCode: text("telegram_linking_code"),

  // Teaching/Proactive learning state
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  currentTopic: text("current_topic"),
  lessonProgress: integer("lesson_progress").default(0).notNull(),
  lessonState: text("lesson_state").default("idle").notNull(),
  lessonInProgress: boolean("lesson_in_progress").default(false).notNull(),
  recentHistory: jsonb("recent_history").$type<{ role: string, content: string }[]>().default([]).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// =============================================================================
// CURRICULA TABLE (Education Boards: CBSE, ICSE, IB, State)
// =============================================================================

export const curricula = pgTable("curricula", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // 'cbse', 'icse', 'ib', 'state'
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =============================================================================
// CLASSES TABLE (Class levels per curriculum)
// =============================================================================

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  curriculumId: uuid("curriculum_id").references(() => curricula.id, { onDelete: "cascade" }).notNull(),
  slug: text("slug").notNull(), // 'class-9', 'class-10', etc.
  name: text("name").notNull(),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSlugPerCurriculum: unique().on(table.curriculumId, table.slug),
}));

// =============================================================================
// SUBJECTS TABLE (All unique subjects)
// =============================================================================

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // 'physics', 'chemistry', etc.
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =============================================================================
// GRADE_SUBJECTS TABLE (Junction: which subjects are available for which grade)
// =============================================================================

export const gradeSubjects = pgTable("grade_subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(),
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
  description: text("description"), // Optional class-specific description
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSubjectPerClass: unique().on(table.classId, table.subjectId),
}));

// =============================================================================
// CHAPTERS TABLE (Chapters/Courses within a subject for a specific grade)
// =============================================================================

export const chapters = pgTable("chapters", {
  id: uuid("id").primaryKey().defaultRandom(),
  gradeSubjectId: uuid("grade_subject_id").references(() => gradeSubjects.id, { onDelete: "cascade" }).notNull(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSlugPerGradeSubject: unique().on(table.gradeSubjectId, table.slug),
}));

// =============================================================================
// LESSONS TABLE (Educational content for each chapter)
// =============================================================================

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "cascade" }).notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull(),

  // Rich content stored as JSONB - can be legacy LessonContent or StructuredSection
  content: jsonb("content").$type<LessonContentUnion>().notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSlugPerChapter: unique().on(table.chapterId, table.slug),
}));

// =============================================================================
// STORY ASSETS TABLE (Story mode slides + video placeholders)
// =============================================================================

export const storyAssets = pgTable("story_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyKey: text("story_key").notNull().unique(),
  classId: text("class_id").notNull(),
  subjectId: text("subject_id").notNull(),
  chapterSlug: text("chapter_slug").notNull(),
  sectionSlug: text("section_slug").notNull(),
  microsectionId: text("microsection_id"),
  status: text("status").notNull().default("pending"),
  renderType: text("render_type").notNull().default("slides"),
  slides: jsonb("slides").$type<StorySlide[]>().notNull(),
  videoUrl: text("video_url"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =============================================================================
// MICROSECTIONS (Stable content_key units)
// =============================================================================

export const microsections = pgTable("microsections", {
  id: uuid("id").primaryKey().defaultRandom(),
  chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  orderIndex: integer("order_index").notNull(),
  contentKey: text("content_key").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =============================================================================
// CONTENT VERSIONS (Deterministic canonical payloads)
// =============================================================================

export const contentVersions = pgTable("content_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentKey: text("content_key").notNull(),
  version: integer("version").notNull(),
  canonicalLocale: text("canonical_locale").notNull().default("en"),
  payloadJson: jsonb("payload_json").notNull(),
  payloadHash: text("payload_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueKeyVersion: unique().on(table.contentKey, table.version),
}));

export const contentTranslations = pgTable("content_translations", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentKey: text("content_key").notNull(),
  version: integer("version").notNull(),
  locale: text("locale").notNull(),
  translatedPayloadJson: jsonb("translated_payload_json").notNull(),
  translatedHash: text("translated_hash").notNull(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueContentLocale: unique().on(table.contentKey, table.version, table.locale),
}));

// =============================================================================
// STORY + BRAILLE ARTIFACTS
// =============================================================================

export const storyPlans = pgTable("story_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentKey: text("content_key").notNull(),
  version: integer("version").notNull(),
  locale: text("locale").notNull(),
  planJson: jsonb("plan_json").notNull(),
  planHash: text("plan_hash").notNull(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueKeyLocale: unique().on(table.contentKey, table.version, table.locale),
}));

export const storySlides = pgTable("story_slides", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentKey: text("content_key").notNull(),
  version: integer("version").notNull(),
  locale: text("locale").notNull(),
  slideIndex: integer("slide_index").notNull(),
  prompt: text("prompt").notNull(),
  promptHash: text("prompt_hash").notNull(),
  caption: text("caption").notNull(),
  captionHash: text("caption_hash").notNull(),
  imagePath: text("image_path"),
  imageMime: text("image_mime"),
  imageHash: text("image_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSlide: unique().on(table.contentKey, table.version, table.locale, table.slideIndex),
}));

export const storyAudio = pgTable("story_audio", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentKey: text("content_key").notNull(),
  version: integer("version").notNull(),
  locale: text("locale").notNull(),
  slideIndex: integer("slide_index").notNull(),
  voiceId: text("voice_id").notNull(),
  ttsProvider: text("tts_provider").notNull(),
  audioPath: text("audio_path"),
  audioMime: text("audio_mime"),
  audioHash: text("audio_hash"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAudio: unique().on(table.contentKey, table.version, table.locale, table.slideIndex, table.voiceId),
}));

export const brailleExports = pgTable("braille_exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentKey: text("content_key").notNull(),
  version: integer("version").notNull(),
  locale: text("locale").notNull(),
  scope: text("scope").notNull(),
  format: text("format").notNull(),
  brailleText: text("braille_text").notNull(),
  brailleHash: text("braille_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueBraille: unique().on(table.contentKey, table.version, table.locale, table.scope, table.format),
}));

export const generationJobs = pgTable("generation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobType: text("job_type").notNull(),
  contentKey: text("content_key").notNull(),
  version: integer("version").notNull(),
  locale: text("locale"),
  slideIndex: integer("slide_index"),
  scope: text("scope"),
  format: text("format"),
  status: text("status").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// =============================================================================
// STORY AUDIO ASSETS TABLE (Localized narration + captions)
// =============================================================================

export const storyAudioAssets = pgTable("story_audio_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id").references(() => storyAssets.id, { onDelete: "cascade" }).notNull(),
  locale: text("locale").notNull(),
  status: text("status").notNull().default("pending"),
  slides: jsonb("slides").$type<Array<Record<string, unknown>>>().notNull(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueStoryLocale: unique().on(table.storyId, table.locale),
}));

// =============================================================================
// USER_CHAPTERS TABLE (Which chapters a user has selected to study)
// =============================================================================

export const userChapters = pgTable("user_chapters", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueChapterPerUser: unique().on(table.userId, table.chapterId),
}));

// =============================================================================
// RELATIONS
// =============================================================================

export const curriculaRelations = relations(curricula, ({ many }) => ({
  classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  curriculum: one(curricula, {
    fields: [classes.curriculumId],
    references: [curricula.id],
  }),
  gradeSubjects: many(gradeSubjects),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  gradeSubjects: many(gradeSubjects),
}));

export const gradeSubjectsRelations = relations(gradeSubjects, ({ one, many }) => ({
  class: one(classes, {
    fields: [gradeSubjects.classId],
    references: [classes.id],
  }),
  subject: one(subjects, {
    fields: [gradeSubjects.subjectId],
    references: [subjects.id],
  }),
  chapters: many(chapters),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  gradeSubject: one(gradeSubjects, {
    fields: [chapters.gradeSubjectId],
    references: [gradeSubjects.id],
  }),
  lessons: many(lessons),
  userChapters: many(userChapters),
}));

export const lessonsRelations = relations(lessons, ({ one }) => ({
  chapter: one(chapters, {
    fields: [lessons.chapterId],
    references: [chapters.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  curriculum: one(curricula, {
    fields: [users.curriculumId],
    references: [curricula.id],
  }),
  class: one(classes, {
    fields: [users.classId],
    references: [classes.id],
  }),
  userChapters: many(userChapters),
  scheduledReviews: many(scheduledReviews),
}));

export const userChaptersRelations = relations(userChapters, ({ one }) => ({
  user: one(users, {
    fields: [userChapters.userId],
    references: [users.id],
  }),
  chapter: one(chapters, {
    fields: [userChapters.chapterId],
    references: [chapters.id],
  }),
}));

// =============================================================================
// BACKGROUND JOBS (Spaced Repetition & Proactive Teaching)
// =============================================================================

export const scheduledReviews = pgTable("scheduled_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  concept: text("concept").notNull(),
  dueDate: timestamp("due_date").notNull(),
  difficulty: integer("difficulty").notNull(),
  sent: boolean("sent").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scheduledReviewsRelations = relations(scheduledReviews, ({ one }) => ({
  student: one(users, {
    fields: [scheduledReviews.studentId],
    references: [users.id],
  }),
}));
