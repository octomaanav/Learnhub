import { Router } from "express";
import { db } from "../db/index.js";
import {
  curricula,
  classes,
  subjects,
  gradeSubjects,
  chapters,
  lessons
} from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { ParsedUnit, UnitLessons } from "../../types/index.js";
import { isAdmin } from "../middleware/auth.js";

const adminRouter = Router();

// Protect all admin routes
adminRouter.use(isAdmin);

/**
 * POST /api/admin/subjects
 * Create a subject if it doesn't exist
 */
adminRouter.post("/subjects", async (req, res) => {
  try {
    const { slug, name, description } = req.body;

    if (!slug || !name) {
      return res.status(400).json({ error: "slug and name are required" });
    }

    // Check if subject ex ists
    const [existingSubject] = await db
      .select()
      .from(subjects)
      .where(eq(subjects.slug, slug))
      .limit(1);

    if (existingSubject) {
      return res.json(existingSubject);
    }

    // Create subject
    const [newSubject] = await db
      .insert(subjects)
      .values({
        slug,
        name,
        description: description || name,
      })
      .returning();

    res.status(201).json(newSubject);
  } catch (error) {
    console.error("Error creating subject:", error);
    res.status(500).json({ error: "Failed to create subject" });
  }
});

/**
 * POST /api/admin/grade-subjects
 * Link a subject to a grade (create grade_subject entry)
 */
adminRouter.post("/grade-subjects", async (req, res) => {
  try {
    const { classId, subjectId, description } = req.body;

    if (!classId || !subjectId) {
      return res.status(400).json({ error: "classId and subjectId are required" });
    }

    // Check if link exists
    const [existingLink] = await db
      .select()
      .from(gradeSubjects)
      .where(and(
        eq(gradeSubjects.classId, classId),
        eq(gradeSubjects.subjectId, subjectId)
      ))
      .limit(1);

    if (existingLink) {
      return res.json(existingLink);
    }

    // Create link
    const [newLink] = await db
      .insert(gradeSubjects)
      .values({
        classId,
        subjectId,
        description,
      })
      .returning();

    res.status(201).json(newLink);
  } catch (error) {
    console.error("Error creating class-subject link:", error);
    res.status(500).json({ error: "Failed to create class-subject link" });
  }
});

/**
 * POST /api/admin/chapters
 * Create a chapter for a grade-subject
 */
adminRouter.post("/chapters", async (req, res) => {
  try {
    const { gradeSubjectId, slug, name, description, sortOrder } = req.body;

    if (!gradeSubjectId || !slug || !name) {
      return res.status(400).json({ error: "gradeSubjectId, slug, and name are required" });
    }

    // Check if chapter exists
    const [existingChapter] = await db
      .select()
      .from(chapters)
      .where(and(
        eq(chapters.gradeSubjectId, gradeSubjectId),
        eq(chapters.slug, slug)
      ))
      .limit(1);

    if (existingChapter) {
      return res.json(existingChapter);
    }

    // Create chapter
    const [newChapter] = await db
      .insert(chapters)
      .values({
        gradeSubjectId,
        slug,
        name,
        description: description || name,
        sortOrder: sortOrder || 1,
      })
      .returning();

    res.status(201).json(newChapter);
  } catch (error) {
    console.error("Error creating chapter:", error);
    res.status(500).json({ error: "Failed to create chapter" });
  }
});

/**
 * POST /api/admin/bulk-import
 * Bulk import chapters and lessons from parsed textbook data
 * 
 * Body:
 * {
 *   classId: string,
 *   subjectSlug: string,
 *   subjectName: string,
 *   units: ParsedUnit[],    // from the parsing endpoint
 *   lessons?: UnitLessons[] // from the lessons/generate endpoint (optional)
 * }
 */
adminRouter.post("/bulk-import", async (req, res) => {
  try {
    console.log("=== Bulk Import Request Received ===");
    const { classId, subjectSlug, subjectName, units, lessons: generatedLessons } = req.body;

    console.log("Request body:", {
      classId,
      subjectSlug,
      subjectName,
      unitsCount: units?.length || 0,
      lessonsCount: generatedLessons?.length || 0,
    });

    if (!classId || !subjectSlug || !subjectName) {
      console.error("Missing required fields:", { classId: !!classId, subjectSlug: !!subjectSlug, subjectName: !!subjectName });
      return res.status(400).json({
        error: "classId, subjectSlug, and subjectName are required"
      });
    }

    if (!Array.isArray(units) || units.length === 0) {
      console.error("Invalid units array:", { isArray: Array.isArray(units), length: units?.length || 0 });
      return res.status(400).json({ error: "units array is required and must not be empty" });
    }

    if (!Array.isArray(generatedLessons) || generatedLessons.length === 0) {
      console.warn("No generated lessons provided - will create placeholder content");
    }

    // Verify class exists
    console.log(`Bulk import: Looking for class with ID: ${classId}`);
    const [classItem] = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);

    if (!classItem) {
      console.error(`Class not found with ID: ${classId}`);

      // Get list of available classes for debugging
      const allClasses = await db
        .select({
          id: classes.id,
          name: classes.name,
          slug: classes.slug,
        })
        .from(classes)
        .limit(10);

      console.log(`Available classes in database:`, allClasses);

      // Return 400 instead of 404 since the route exists, but the resource is invalid
      return res.status(400).json({
        error: `Class not found with ID: ${classId}. Please ensure the class exists in the database.`,
        availableClasses: allClasses,
        hint: "The class may have been deleted or the database was reset. Please go back and select a class again."
      });
    }

    console.log(`Found class: ${classItem.name} (${classItem.id})`);

    // 1. Create or get subject
    let [subject] = await db
      .select()
      .from(subjects)
      .where(eq(subjects.slug, subjectSlug))
      .limit(1);

    if (!subject) {
      [subject] = await db
        .insert(subjects)
        .values({
          slug: subjectSlug,
          name: subjectName,
          description: subjectName,
        })
        .returning();
    }

    // 2. Create or get class-subject link
    let [gradeSubject] = await db
      .select()
      .from(gradeSubjects)
      .where(and(
        eq(gradeSubjects.classId, classId),
        eq(gradeSubjects.subjectId, subject.id)
      ))
      .limit(1);

    if (!gradeSubject) {
      [gradeSubject] = await db
        .insert(gradeSubjects)
        .values({
          classId,
          subjectId: subject.id,
        })
        .returning();
    }

    // 3. Create chapters from units with full lesson content
    const createdChapters: Array<{ chapter: typeof chapters.$inferSelect; lessonCount: number }> = [];

    console.log(`Creating ${units.length} chapters...`);

    for (let i = 0; i < units.length; i++) {
      const unit = units[i] as ParsedUnit;
      const chapterSlug = unit.unitTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      console.log(`[${i + 1}/${units.length}] Processing chapter: "${unit.unitTitle}"`);

      // Find matching generated lessons for this unit (if available)
      const unitLessons = generatedLessons?.find(
        (ul: UnitLessons) => ul.unitTitle === unit.unitTitle
      );

      if (unitLessons) {
        console.log(`  ✓ Found generated lessons (${unitLessons.lessons?.length || 0} lessons)`);
      } else {
        console.log(`  ⚠ No generated lessons found - creating placeholder content`);
      }

      // If no generated lessons found, create placeholder content
      const chapterContent: UnitLessons = unitLessons || {
        unitTitle: unit.unitTitle,
        unitDescription: unit.unitDescription,
        lessons: unit.sections.map((section) => ({
          sectionId: section.sectionId,
          title: section.title,
          lessonContent: {
            introduction: section.description,
            coreConcepts: section.learningGoals.map((goal, idx) => ({
              conceptTitle: `Concept ${idx + 1}`,
              explanation: goal,
              example: "",
              diagramDescription: "",
            })),
            summary: section.learningGoals,
            quickCheckQuestions: [],
          },
        })),
      };

      try {
        // Check if chapter exists
        let [chapter] = await db
          .select()
          .from(chapters)
          .where(and(
            eq(chapters.gradeSubjectId, gradeSubject.id),
            eq(chapters.slug, chapterSlug)
          ))
          .limit(1);

        if (chapter) {
          console.log(`  → Updating existing chapter: ${chapter.id}`);
          // Update existing chapter
          [chapter] = await db
            .update(chapters)
            .set({
              name: unit.unitTitle,
              description: unit.unitDescription,
            })
            .where(eq(chapters.id, chapter.id))
            .returning();
        } else {
          console.log(`  → Creating new chapter`);
          // Create new chapter
          [chapter] = await db
            .insert(chapters)
            .values({
              gradeSubjectId: gradeSubject.id,
              slug: chapterSlug,
              name: unit.unitTitle,
              description: unit.unitDescription,
              sortOrder: i + 1,
            })
            .returning();
        }

        // 4. Create individual lesson records in the lessons table
        const lessonCount = chapterContent.lessons?.length || 0;
        let createdLessonsCount = 0;

        if (lessonCount > 0 && chapterContent.lessons) {
          console.log(`  → Creating ${lessonCount} lesson records...`);

          for (let j = 0; j < chapterContent.lessons.length; j++) {
            const lesson = chapterContent.lessons[j];

            // Generate slug from sectionId and title
            const lessonSlug = `${lesson.sectionId}-${lesson.title}`
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');

            try {
              // Check if lesson already exists
              const [existingLesson] = await db
                .select()
                .from(lessons)
                .where(and(
                  eq(lessons.chapterId, chapter.id),
                  eq(lessons.slug, lessonSlug)
                ))
                .limit(1);

              if (existingLesson) {
                // Update existing lesson
                await db
                  .update(lessons)
                  .set({
                    title: lesson.title,
                    content: lesson.lessonContent,
                    sortOrder: j + 1,
                  })
                  .where(eq(lessons.id, existingLesson.id));
                createdLessonsCount++;
              } else {
                // Create new lesson
                await db
                  .insert(lessons)
                  .values({
                    chapterId: chapter.id,
                    slug: lessonSlug,
                    title: lesson.title,
                    sortOrder: j + 1,
                    content: lesson.lessonContent,
                  });
                createdLessonsCount++;
              }
            } catch (lessonError) {
              console.error(`    ✗ Failed to save lesson "${lesson.title}":`, lessonError);
              // Continue with other lessons even if one fails
            }
          }

          console.log(`  ✓ Created ${createdLessonsCount} lesson records`);
        }

        createdChapters.push({ chapter, lessonCount: createdLessonsCount });
        console.log(`  ✓ Chapter "${unit.unitTitle}" saved with ${createdLessonsCount} lessons in database`);
      } catch (dbError) {
        console.error(`  ✗ Failed to save chapter "${unit.unitTitle}":`, dbError);
        throw new Error(`Failed to save chapter "${unit.unitTitle}": ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      }
    }

    console.log(`=== Bulk Import Complete: ${createdChapters.length} chapters created ===`);

    res.status(201).json({
      success: true,
      subject,
      gradeSubject,
      chapters: createdChapters,
    });
  } catch (error) {
    console.error("=== Error in Bulk Import ===", error);
    if (error instanceof Error) {
      console.error("  Error message:", error.message);
      console.error("  Error stack:", error.stack);
    }
    res.status(500).json({
      error: "Failed to bulk import data",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/admin/subjects
 * Get all subjects
 */
adminRouter.get("/subjects", async (req, res) => {
  try {
    const allSubjects = await db
      .select()
      .from(subjects)
      .orderBy(subjects.name);

    res.json(allSubjects);
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

/**
 * GET /api/admin/grade-subjects/:classId
 * Get all subjects for a class
 */
adminRouter.get("/grade-subjects/:classId", async (req, res) => {
  try {
    const { classId } = req.params;

    const gradeSubjectsList = await db
      .select({
        id: gradeSubjects.id,
        classId: gradeSubjects.classId,
        subjectId: gradeSubjects.subjectId,
        subjectSlug: subjects.slug,
        subjectName: subjects.name,
        subjectDescription: subjects.description,
      })
      .from(gradeSubjects)
      .innerJoin(subjects, eq(subjects.id, gradeSubjects.subjectId))
      .where(eq(gradeSubjects.classId, classId))
      .orderBy(subjects.name);

    res.json(gradeSubjectsList);
  } catch (error) {
    console.error("Error fetching class subjects:", error);
    res.status(500).json({ error: "Failed to fetch class subjects" });
  }
});

/**
 * GET /api/admin/lessons/:chapterId
 * Get all lessons for a chapter (for editing)
 */
adminRouter.get("/lessons/:chapterId", async (req, res) => {
  try {
    const { chapterId } = req.params;

    const lessonsList = await db
      .select()
      .from(lessons)
      .where(eq(lessons.chapterId, chapterId))
      .orderBy(lessons.sortOrder);

    res.json(lessonsList);
  } catch (error) {
    console.error("Error fetching lessons:", error);
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

/**
 * GET /api/admin/lessons/lesson/:lessonId
 * Get a single lesson by ID
 */
adminRouter.get("/lessons/lesson/:lessonId", async (req, res) => {
  try {
    const { lessonId } = req.params;

    const [lesson] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1);

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.json(lesson);
  } catch (error) {
    console.error("Error fetching lesson:", error);
    res.status(500).json({ error: "Failed to fetch lesson" });
  }
});

/**
 * POST /api/admin/lessons
 * Create a new lesson
 */
adminRouter.post("/lessons", async (req, res) => {
  try {
    const { chapterId, slug, title, content, sortOrder } = req.body;

    if (!chapterId || !slug || !title || !content) {
      return res.status(400).json({
        error: "chapterId, slug, title, and content are required"
      });
    }

    // Check if lesson with same slug exists in chapter
    const [existingLesson] = await db
      .select()
      .from(lessons)
      .where(and(
        eq(lessons.chapterId, chapterId),
        eq(lessons.slug, slug)
      ))
      .limit(1);

    if (existingLesson) {
      return res.status(400).json({
        error: "A lesson with this slug already exists in this chapter"
      });
    }

    // Get max sortOrder for this chapter
    const existingLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.chapterId, chapterId));

    const maxSortOrder = existingLessons.length > 0
      ? Math.max(...existingLessons.map(l => l.sortOrder))
      : 0;

    const [newLesson] = await db
      .insert(lessons)
      .values({
        chapterId,
        slug,
        title,
        content,
        sortOrder: sortOrder || maxSortOrder + 1,
      })
      .returning();

    res.status(201).json(newLesson);
  } catch (error) {
    console.error("Error creating lesson:", error);
    res.status(500).json({ error: "Failed to create lesson" });
  }
});

/**
 * PUT /api/admin/lessons/:lessonId
 * Update an existing lesson
 */
adminRouter.put("/lessons/:lessonId", async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { title, content, sortOrder, slug } = req.body;

    const [existingLesson] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1);

    if (!existingLesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // If slug is being changed, check for conflicts
    if (slug && slug !== existingLesson.slug) {
      const [conflictLesson] = await db
        .select()
        .from(lessons)
        .where(and(
          eq(lessons.chapterId, existingLesson.chapterId),
          eq(lessons.slug, slug),
          // Exclude current lesson
        ))
        .limit(1);

      if (conflictLesson && conflictLesson.id !== lessonId) {
        return res.status(400).json({
          error: "A lesson with this slug already exists in this chapter"
        });
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (slug !== undefined) updateData.slug = slug;

    const [updatedLesson] = await db
      .update(lessons)
      .set(updateData)
      .where(eq(lessons.id, lessonId))
      .returning();

    res.json(updatedLesson);
  } catch (error) {
    console.error("Error updating lesson:", error);
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

/**
 * DELETE /api/admin/lessons/:lessonId
 * Delete a lesson
 */
adminRouter.delete("/lessons/:lessonId", async (req, res) => {
  try {
    const { lessonId } = req.params;

    const [existingLesson] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1);

    if (!existingLesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    await db
      .delete(lessons)
      .where(eq(lessons.id, lessonId));

    res.json({ success: true, message: "Lesson deleted successfully" });
  } catch (error) {
    console.error("Error deleting lesson:", error);
    res.status(500).json({ error: "Failed to delete lesson" });
  }
});

/**
 * POST /api/admin/generate-image
 * Generate an image using Gemini's Imagen model
 * 
 * Body:
 * {
 *   prompt: string,        // Description of the image to generate
 *   numberOfImages?: number // Optional, 1-4 (default: 1)
 * }
 * 
 * Returns:
 * {
 *   success: boolean,
 *   images: string[],      // Array of base64-encoded image data
 *   dataUrls?: string[]    // Array of data URLs (data:image/png;base64,...)
 * }
 */
adminRouter.post("/generate-image", async (req, res) => {
  try {
    const { prompt, numberOfImages = 1 } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        error: "prompt is required and must be a non-empty string"
      });
    }

    if (numberOfImages < 1 || numberOfImages > 4) {
      return res.status(400).json({
        error: "numberOfImages must be between 1 and 4"
      });
    }

    const { generateImage } = await import("../utils/imageGen.js");
    const imageData = await generateImage(prompt.trim(), numberOfImages);

    // Convert to data URLs for easier use in frontend
    const dataUrls = imageData.map(img => `data:image/png;base64,${img}`);

    res.json({
      success: true,
      images: imageData,
      dataUrls: dataUrls,
      count: imageData.length
    });
  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate image"
    });
  }
});

/**
 * POST /api/admin/generate-roadmap
 * Generate a learning roadmap using Gemini
 * 
 * Body:
 * {
 *   profile: string,
 *   goal: string
 * }
 */
adminRouter.post("/generate-roadmap", async (req, res) => {
  try {
    const { profile, goal } = req.body;

    if (!profile || !goal) {
      return res.status(400).json({ error: "profile and goal are required" });
    }

    const { callGemini } = await import("../utils/gemini.js");

    const prompt = `You are an expert curriculum designer. 
Create a detailed Learning Roadmap for a student.
Student Profile: ${profile}
Learning Goal: ${goal}

You MUST respond with ONLY a raw JSON array of roadmap steps. Do not include markdown formatting (like \`\`\`json).
Format:
[
  { "title": "Phase 1: Basics", "description": "Learn the fundamentals of X and Y.", "status": "pending" },
  { "title": "Phase 2: Intermediate", "description": "Build projects using Z.", "status": "pending" }
]`;

    const rawContent = await callGemini(prompt);

    if (!rawContent) {
      return res.status(500).json({ error: "Failed to generate roadmap from AI" });
    }

    // Clean up potentially wrapped JSON
    let cleanedContent = rawContent.trim();
    if (cleanedContent.startsWith('\`\`\`json')) {
      cleanedContent = cleanedContent.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
    } else if (cleanedContent.startsWith('\`\`\`')) {
      cleanedContent = cleanedContent.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
    }

    let parsedRoadmap;
    try {
      parsedRoadmap = JSON.parse(cleanedContent);
    } catch (e) {
      console.warn("Failed to parse JSON, returning raw text", e);
      parsedRoadmap = [{ title: "Generated Roadmap", description: cleanedContent, status: "pending" }];
    }

    res.json({
      success: true,
      roadmap: parsedRoadmap
    });
  } catch (error) {
    console.error("Error generating roadmap:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate roadmap"
    });
  }
});

export default adminRouter;
