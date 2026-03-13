import { Router } from "express";
import { db } from "../db/index.js";
import { userBookmarks, lessons } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { isAuthenticated } from "../middleware/auth.js";

const router = Router();

// Get all bookmarks for the logged-in user
router.get("/", isAuthenticated, async (req, res) => {
    try {
        const userId = (req.user as any).id;
        const bookmarks = await db.query.userBookmarks.findMany({
            where: eq(userBookmarks.userId, userId),
            with: {
                lesson: {
                    with: {
                        chapter: {
                            with: {
                                gradeSubject: {
                                    with: {
                                        subject: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        res.json(bookmarks);
    } catch (error) {
        console.error("Error fetching bookmarks:", error);
        res.status(500).json({ error: "Failed to fetch bookmarks" });
    }
});

// Add a bookmark
router.post("/", isAuthenticated, async (req, res) => {
    try {
        const userId = (req.user as any).id;
        const { lessonId, microsectionId } = req.body;

        if (!lessonId) {
            return res.status(400).json({ error: "lessonId is required" });
        }

        await db.insert(userBookmarks).values({
            userId,
            lessonId,
            microsectionId: microsectionId || null,
        }).onConflictDoNothing();

        res.json({ success: true });
    } catch (error) {
        console.error("Error adding bookmark:", error);
        res.status(500).json({ error: "Failed to add bookmark" });
    }
});

// Remove a bookmark
const removeBookmark = async (req: any, res: any) => {
    try {
        const userId = (req.user as any).id;
        const { lessonId, microsectionId } = req.params;

        await db.delete(userBookmarks).where(
            and(
                eq(userBookmarks.userId, userId),
                eq(userBookmarks.lessonId, lessonId as string),
                microsectionId
                    ? eq(userBookmarks.microsectionId, microsectionId as string)
                    : eq(userBookmarks.microsectionId, null as any) // Use null for top-level bookmarks
            )
        );

        res.json({ success: true });
    } catch (error) {
        console.error("Error removing bookmark:", error);
        res.status(500).json({ error: "Failed to remove bookmark" });
    }
};

router.delete("/:lessonId", isAuthenticated, removeBookmark);
router.delete("/:lessonId/:microsectionId", isAuthenticated, removeBookmark);

export default router;
