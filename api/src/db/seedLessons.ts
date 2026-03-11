import { db } from "./index.js";
import { chapters, lessons as lessonsTable, gradeSubjects, subjects, classes, curricula, microsections, contentVersions } from "./schema.js";
import { eq, and } from "drizzle-orm";
import { sha256Json } from "../utils/hash.js";
import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { StructuredChapter, UnitLessons } from "../../types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LESSONS_DATA_DIR = join(process.cwd(), "data/lessons");

// Type guard to check if data is in old format (UnitLessons[])
function isOldFormat(data: unknown[]): data is UnitLessons[] {
  if (data.length === 0) return false;
  const first = data[0] as Record<string, unknown>;
  return 'unitTitle' in first && 'lessons' in first;
}

// Type guard to check if data is in new structured format (StructuredChapter[])
function isStructuredFormat(data: unknown[]): data is StructuredChapter[] {
  if (data.length === 0) return false;
  const first = data[0] as Record<string, unknown>;
  return 'chapterId' in first && 'chapterTitle' in first && 'sections' in first;
}

export async function seedLessons() {
  try {
    let files: string[];
    try {
      files = await readdir(LESSONS_DATA_DIR);
    } catch (error) {
      console.log(`Lessons directory not found: ${LESSONS_DATA_DIR}`);
      return;
    }

    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.example.json'));

    if (jsonFiles.length === 0) {
      return;
    }

    console.log(`Found ${jsonFiles.length} JSON file(s)\n`);

    let processedFiles = 0;
    let processedChapters = 0;
    let processedSections = 0;
    let errorCount = 0;

    for (const filename of jsonFiles) {
      try {
        const filePath = join(LESSONS_DATA_DIR, filename);
        const fileContent = await readFile(filePath, 'utf-8');
        const dataArray: unknown[] = JSON.parse(fileContent);

        if (!Array.isArray(dataArray)) {
          errorCount++;
          continue;
        }

        if (dataArray.length === 0) {
          console.warn(`Empty array in ${filename}, skipping...`);
          continue;
        }

        const nameWithoutExt = filename.replace('.json', '');
        const parts = nameWithoutExt.split('_');

        if (parts.length < 3) {
          console.error(`Invalid filename format in ${filename}: expected format is {curriculum}_{class}_{subject}.json`);
          errorCount++;
          continue;
        }

        const curriculumSlug = parts[0];
        const classSlug = parts[1].replace('class', 'class-');
        const subjectSlug = parts.slice(2).join('-');

        const [foundClassWithCurriculum] = await db
          .select({
            classId: classes.id,
            curriculumId: curricula.id,
            curriculumSlug: curricula.slug,
            className: classes.name,
            classSlug: classes.slug,
          })
          .from(classes)
          .innerJoin(curricula, eq(curricula.id, classes.curriculumId))
          .where(and(
            eq(classes.slug, classSlug),
            eq(curricula.slug, curriculumSlug)
          ))
          .limit(1);

        if (!foundClassWithCurriculum) {
          console.error(`Class not found: ${curriculumSlug}/${classSlug}`);
          console.error(`Make sure this combination exists in seed.ts`);
          errorCount++;
          continue;
        }

        // Find subject
        const [subject] = await db
          .select()
          .from(subjects)
          .where(eq(subjects.slug, subjectSlug))
          .limit(1);

        if (!subject) {
          console.error(`Subject not found: ${subjectSlug}`);
          errorCount++;
          continue;
        }

        let [gradeSubject] = await db
          .select()
          .from(gradeSubjects)
          .where(and(
            eq(gradeSubjects.classId, foundClassWithCurriculum.classId),
            eq(gradeSubjects.subjectId, subject.id)
          ))
          .limit(1);

        if (!gradeSubject) {
          [gradeSubject] = await db
            .insert(gradeSubjects)
            .values({
              classId: foundClassWithCurriculum.classId,
              subjectId: subject.id,
            })
            .returning();
        }

        const curriculum = {
          id: foundClassWithCurriculum.curriculumId,
          slug: foundClassWithCurriculum.curriculumSlug,
        };
        const gradeValue = Number(foundClassWithCurriculum.classSlug.replace(/[^0-9]/g, "")) || 0;

        // Detect format and process accordingly
        if (isStructuredFormat(dataArray)) {
          // NEW STRUCTURED FORMAT (StructuredChapter[])
          console.log(`Processing ${filename} as STRUCTURED format...`);
          const chaptersArray = dataArray;

          for (let chapterIndex = 0; chapterIndex < chaptersArray.length; chapterIndex++) {
            const structuredChapter = chaptersArray[chapterIndex];

            // Validate chapter structure
            if (!structuredChapter.chapterTitle || !Array.isArray(structuredChapter.sections)) {
              continue;
            }

            // Generate chapter slug from chapterId or title
            const chapterSlug = structuredChapter.chapterId || structuredChapter.chapterTitle
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');

            // Find or create chapter
            let [chapter] = await db
              .select()
              .from(chapters)
              .where(and(
                eq(chapters.gradeSubjectId, gradeSubject.id),
                eq(chapters.slug, chapterSlug)
              ))
              .limit(1);

            if (!chapter) {
              [chapter] = await db
                .insert(chapters)
                .values({
                  gradeSubjectId: gradeSubject.id,
                  slug: chapterSlug,
                  name: structuredChapter.chapterTitle,
                  description: structuredChapter.chapterDescription || '',
                  sortOrder: chapterIndex + 1,
                })
                .returning();
              console.log(`Created chapter: "${structuredChapter.chapterTitle}"`);
            } else {
              [chapter] = await db
                .update(chapters)
                .set({
                  name: structuredChapter.chapterTitle,
                  description: structuredChapter.chapterDescription || chapter.description,
                  sortOrder: chapterIndex + 1,
                })
                .where(eq(chapters.id, chapter.id))
                .returning();
              console.log(`Updated chapter: "${structuredChapter.chapterTitle}"`);
            }
            processedChapters++;

            // Process sections within the chapter
            for (let sectionIndex = 0; sectionIndex < structuredChapter.sections.length; sectionIndex++) {
              const section = structuredChapter.sections[sectionIndex];

              const lessonSlug = section.slug || `${section.id}-${section.title}`
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

              // Store the entire section (with microsections) as the lesson content
              const sectionContent = section;

              const [existingLesson] = await db
                .select()
                .from(lessonsTable)
                .where(and(
                  eq(lessonsTable.chapterId, chapter.id),
                  eq(lessonsTable.slug, lessonSlug)
                ))
                .limit(1);

              if (existingLesson) {
                await db
                  .update(lessonsTable)
                  .set({
                    title: section.title,
                    content: sectionContent as any,
                    sortOrder: section.sortOrder || sectionIndex + 1,
                    updatedAt: new Date(),
                  })
                  .where(eq(lessonsTable.id, existingLesson.id));
              } else {
                await db
                  .insert(lessonsTable)
                  .values({
                    chapterId: chapter.id,
                    slug: lessonSlug,
                    title: section.title,
                    sortOrder: section.sortOrder || sectionIndex + 1,
                    content: sectionContent as any,
                  });
              }
              processedSections++;

              // Create microsections + content versions for deterministic engine
              const microsectionsList = section.microsections || [];
              for (let i = 0; i < microsectionsList.length; i++) {
                const micro = microsectionsList[i];
                const normalizedType = micro.type === "video" ? "story" : micro.type;
                const contentKey = `curr:${curriculum.slug}:${curriculum.id}:grade${gradeValue}:${subject.slug}:ch${String(chapterIndex + 1).padStart(2, "0")}:ms${String(sectionIndex + 1).padStart(2, "0")}${String(i + 1).padStart(2, "0")}`;
                await db
                  .insert(microsections)
                  .values({
                    chapterId: chapter.id,
                    type: normalizedType,
                    title: micro.title,
                    orderIndex: i + 1,
                    contentKey,
                  })
                  .onConflictDoNothing();

                const payload = {
                  meta: {
                    title: micro.title,
                    type: normalizedType,
                    grade: gradeValue,
                    subject: subject.name,
                    chapter: structuredChapter.chapterTitle,
                    estimatedMinutes: micro.estimatedMinutes || 5,
                  },
                  learningObjectives: (micro as any).learningObjectives || [],
                  keyTerms: (micro as any).keyTerms || [],
                  content: (micro as any).content || {},
                  practice: (micro as any).practice || (micro as any).quiz || {},
                };

                const payloadHash = sha256Json(payload);
                await db
                  .insert(contentVersions)
                  .values({
                    contentKey,
                    version: 1,
                    canonicalLocale: "en",
                    payloadJson: payload,
                    payloadHash,
                  })
                  .onConflictDoNothing();
              }
            }
          }
        } else if (isOldFormat(dataArray)) {
          // OLD FORMAT (UnitLessons[])
          console.log(`Processing ${filename} as OLD format...`);
          const unitsArray = dataArray;

          for (let unitIndex = 0; unitIndex < unitsArray.length; unitIndex++) {
            const unitLessons = unitsArray[unitIndex];

            // Validate unit structure
            if (!unitLessons.unitTitle || !Array.isArray(unitLessons.lessons)) {
              continue;
            }

            // Generate chapter slug from unit title
            const chapterSlug = unitLessons.unitTitle
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');

            // Find or create chapter
            let [chapter] = await db
              .select()
              .from(chapters)
              .where(and(
                eq(chapters.gradeSubjectId, gradeSubject.id),
                eq(chapters.slug, chapterSlug)
              ))
              .limit(1);

            if (!chapter) {
              [chapter] = await db
                .insert(chapters)
                .values({
                  gradeSubjectId: gradeSubject.id,
                  slug: chapterSlug,
                  name: unitLessons.unitTitle,
                  description: unitLessons.unitDescription || '',
                  sortOrder: unitIndex + 1,
                })
                .returning();
              console.log(`Created chapter: "${unitLessons.unitTitle}"`);
            } else {
              [chapter] = await db
                .update(chapters)
                .set({
                  name: unitLessons.unitTitle,
                  description: unitLessons.unitDescription || chapter.description,
                  sortOrder: unitIndex + 1,
                })
                .where(eq(chapters.id, chapter.id))
                .returning();
              console.log(`Updated chapter: "${unitLessons.unitTitle}"`);
            }
            processedChapters++;

            // Process lessons within the unit
            for (let j = 0; j < unitLessons.lessons.length; j++) {
              const lesson = unitLessons.lessons[j];

              const lessonSlug = `${lesson.sectionId}-${lesson.title}`
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

              const [existingLesson] = await db
                .select()
                .from(lessonsTable)
                .where(and(
                  eq(lessonsTable.chapterId, chapter.id),
                  eq(lessonsTable.slug, lessonSlug)
                ))
                .limit(1);

              if (existingLesson) {
                await db
                  .update(lessonsTable)
                  .set({
                    title: lesson.title,
                    content: lesson.lessonContent as any,
                    sortOrder: j + 1,
                    updatedAt: new Date(),
                  })
                  .where(eq(lessonsTable.id, existingLesson.id));
              } else {
                await db
                  .insert(lessonsTable)
                  .values({
                    chapterId: chapter.id,
                    slug: lessonSlug,
                    title: lesson.title,
                    sortOrder: j + 1,
                    content: lesson.lessonContent as any,
                  });
              }
              processedSections++;

              const contentKey = `curr:${curriculum.slug}:${curriculum.id}:grade${gradeValue}:${subject.slug}:ch${String(unitIndex + 1).padStart(2, "0")}:ms${String(j + 1).padStart(3, "0")}`;
              await db
                .insert(microsections)
                .values({
                  chapterId: chapter.id,
                  type: "article",
                  title: lesson.title,
                  orderIndex: j + 1,
                  contentKey,
                })
                .onConflictDoNothing();

              const payload = {
                meta: {
                  title: lesson.title,
                  type: "article",
                  grade: gradeValue,
                  subject: subject.name,
                  chapter: unitLessons.unitTitle,
                  estimatedMinutes: 5,
                },
                learningObjectives: [],
                keyTerms: [],
                content: lesson.lessonContent || {},
                practice: {},
              };

              const payloadHash = sha256Json(payload);
              await db
                .insert(contentVersions)
                .values({
                  contentKey,
                  version: 1,
                  canonicalLocale: "en",
                  payloadJson: payload,
                  payloadHash,
                })
                .onConflictDoNothing();
            }
          }
        } else {
          console.error(`Unknown format in ${filename}, skipping...`);
          errorCount++;
          continue;
        }

        processedFiles++;
      } catch (error) {
        console.error(`\n   ❌ Error processing ${filename}:`);
        if (error instanceof Error) {
          console.error(`      ${error.message}`);
        }
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 Educational content seeding complete!");
    console.log(`📄 Files processed: ${processedFiles}/${jsonFiles.length}`);
    console.log(`📖 Chapters created/updated: ${processedChapters}`);
    console.log(`📝 Sections/Lessons created/updated: ${processedSections}`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount}`);
    }
    console.log("=".repeat(60));
  } catch (error) {
    console.error("Lesson seeding failed:", error);
    throw error;
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  seedLessons()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
