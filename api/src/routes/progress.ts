import { Router } from "express";
import { db } from "../db/index.js";
import { lessonCompletions, lessons, chapters, gradeSubjects, subjects } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { isAuthenticated } from "../middleware/auth.js";

const router = Router();

// Get detailed progress stats for all subjects
router.get("/stats", isAuthenticated, async (req, res) => {
    try {
        const userId = (req.user as any).id;

        // Fetch all completions for this user
        const completions = await db.query.lessonCompletions.findMany({
            where: eq(lessonCompletions.userId, userId),
        });

        // 1. Get all subjects and their total lesson counts
        // To do this properly, we join from subjects -> grade_subjects -> chapters -> lessons
        const allSubjects = await db.select({
            id: subjects.id,
            name: subjects.name,
            slug: subjects.slug,
        }).from(subjects);

        const subjectStats = await Promise.all(allSubjects.map(async (subject) => {
            // Find all lessons (sections) belonging to this subject
            const subjectLessons = await db.select({
                id: lessons.id,
                content: lessons.content
            }).from(lessons)
                .innerJoin(chapters, eq(lessons.chapterId, chapters.id))
                .innerJoin(gradeSubjects, eq(chapters.gradeSubjectId, gradeSubjects.id))
                .where(eq(gradeSubjects.subjectId, subject.id));

            let totalMicrosections = 0;
            let completedMicrosections = 0;

            subjectLessons.forEach(lesson => {
                // Count microsections in this lesson (section)
                const microsections = (typeof lesson.content === 'object' && lesson.content !== null && 'microsections' in lesson.content && Array.isArray((lesson.content as any).microsections))
                    ? (lesson.content as any).microsections
                    : [];

                totalMicrosections += microsections.length;

                // Check how many of these microsections are completed
                microsections.forEach((ms: any) => {
                    const isCompleted = completions.some(c =>
                        c.lessonId === lesson.id && c.microsectionId === ms.id
                    );
                    if (isCompleted) completedMicrosections++;
                });
            });

            const percentage = totalMicrosections > 0 ? Math.round((completedMicrosections / totalMicrosections) * 100) : 0;

            return {
                id: subject.id,
                name: subject.name,
                slug: subject.slug,
                total: totalMicrosections,
                completed: completedMicrosections,
                percentage
            };
        }));

        res.json({
            completedCount: completions.length,
            subjectStats
        });
    } catch (error) {
        console.error("Error fetching progress stats:", error);
        res.status(500).json({ error: "Failed to fetch progress stats" });
    }
});

// Mark a lesson as complete
router.post("/complete", isAuthenticated, async (req, res) => {
    try {
        const userId = (req.user as any).id;
        const { lessonId, microsectionId } = req.body;

        if (!lessonId) {
            return res.status(400).json({ error: "lessonId is required" });
        }

        await db.insert(lessonCompletions).values({
            userId,
            lessonId,
            microsectionId: microsectionId || null,
        }).onConflictDoNothing();

        res.json({ success: true });
    } catch (error) {
        console.error("Error completing lesson:", error);
        res.status(500).json({ error: "Failed to complete lesson" });
    }
});

// Unmark a lesson as complete
const uncompleteLesson = async (req: any, res: any) => {
    try {
        const userId = (req.user as any).id;
        const { lessonId, microsectionId } = req.params;

        await db.delete(lessonCompletions).where(
            and(
                eq(lessonCompletions.userId, userId),
                eq(lessonCompletions.lessonId, lessonId as string),
                microsectionId
                    ? eq(lessonCompletions.microsectionId, microsectionId as string)
                    : eq(lessonCompletions.microsectionId, null as any)
            )
        );

        res.json({ success: true });
    } catch (error) {
        console.error("Error uncompleting lesson:", error);
        res.status(500).json({ error: "Failed to uncomplete lesson" });
    }
};

router.delete("/complete/:lessonId", isAuthenticated, uncompleteLesson);
router.delete("/complete/:lessonId/:microsectionId", isAuthenticated, uncompleteLesson);

export default router;
