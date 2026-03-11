import { db } from "./index.js";
import { curricula, classes, subjects, gradeSubjects, chapters, lessons } from "./schema.js";
import { eq } from "drizzle-orm";

export async function seedChessCourse() {
    console.log("Seeding Knowledge Hub - Chess Course...");

    try {
        // 1. Create a "Knowledge Hub" global curriculum
        const [khCurriculum] = await db.insert(curricula).values({
            slug: 'knowledge-hub',
            name: 'Knowledge Hub',
            description: 'Learn anything, anytime.',
        }).onConflictDoNothing().returning();

        let targetCurri = khCurriculum;
        if (!targetCurri) {
            targetCurri = (await db.query.curricula.findFirst({ where: (c, { eq }) => eq(c.slug, 'knowledge-hub') }))!;
        }

        // 2. Create a generic "All Levels" class
        const [allLevelsClass] = await db.insert(classes).values({
            curriculumId: targetCurri.id,
            slug: 'all-levels',
            name: 'All Levels',
            description: 'Topics suitable for any age or level.',
            sortOrder: 1
        }).onConflictDoNothing().returning();

        let targetClass = allLevelsClass;
        if (!targetClass) {
            targetClass = (await db.query.classes.findFirst({ where: (c, { and, eq }) => and(eq(c.slug, 'all-levels'), eq(c.curriculumId, targetCurri.id)) }))!;
        }

        // 3. Create "Chess" Subject
        const [chessSubject] = await db.insert(subjects).values({
            slug: 'chess',
            name: 'Chess Strategy & Fundamentals',
            description: 'Master the board. Learn openings, tactics, and endgames.',
        }).onConflictDoNothing().returning();

        let targetSubject = chessSubject;
        if (!targetSubject) {
            targetSubject = (await db.query.subjects.findFirst({ where: (s, { eq }) => eq(s.slug, 'chess') }))!;
        }

        // 4. Link Subject to Class
        const [gs] = await db.insert(gradeSubjects).values({
            classId: targetClass.id,
            subjectId: targetSubject.id,
            description: 'Chess fundamentals for all levels'
        }).onConflictDoNothing().returning();

        let targetGs = gs;
        if (!targetGs) {
            targetGs = (await db.query.gradeSubjects.findFirst({ where: (gs, { and, eq }) => and(eq(gs.classId, targetClass.id), eq(gs.subjectId, targetSubject.id)) }))!;
        }

        // 5. Create a Chapter: The Opening Principles
        const [openingChapter] = await db.insert(chapters).values({
            gradeSubjectId: targetGs.id,
            slug: 'opening-principles',
            name: 'The Opening Principles',
            description: 'Control the center, develop your pieces, and get your king to safety.',
            sortOrder: 1
        }).onConflictDoNothing().returning();

        let targetChapter = openingChapter;
        if (!targetChapter) {
            targetChapter = (await db.query.chapters.findFirst({ where: (c, { and, eq }) => and(eq(c.slug, 'opening-principles'), eq(c.gradeSubjectId, targetGs.id)) }))!;
        }

        // Delete existing lessons for this chapter to ensure clean seed
        await db.delete(lessons).where(
            eq(lessons.chapterId, targetChapter.id)
        );

        await db.insert(lessons).values([
            {
                chapterId: targetChapter.id,
                slug: 'controlling-the-center',
                title: 'Controlling the Center',
                sortOrder: 1,
                content: {
                    description: "Learn why the center of the board is crucial for victory.",
                    microsections: [
                        {
                            id: "ctrl-center-article",
                            type: "article",
                            title: "The Importance of the Center",
                            sortOrder: 1,
                            estimatedMinutes: 5,
                            content: {
                                introduction: "In chess, the four central squares (d4, e4, d5, e5) are the most important real estate on the board. Controlling them gives your pieces maximum mobility.",
                                coreConcepts: [
                                    {
                                        conceptTitle: "Center Control",
                                        explanation: "Pieces in the center control more squares than pieces on the edge. A knight in the center attacks 8 squares; on the edge, it attacks only 4.",
                                        example: "Playing 1.e4 or 1.d4 immediately fights for the center and opens lines for your bishops and queen."
                                    }
                                ],
                                summary: ["Always fight for the center in the opening.", "Develop pieces toward the center."],
                                quickCheckQuestions: [
                                    { question: "Which squares are the center?", answer: "d4, e4, d5, e5" }
                                ]
                            }
                        }
                    ]
                }
            },
            {
                chapterId: targetChapter.id,
                slug: 'piece-development',
                title: 'Developing Minor Pieces',
                sortOrder: 2,
                content: {
                    description: "Get your pieces off their starting squares to prepare for an attack.",
                    microsections: [
                        {
                            id: "dev-pieces-article",
                            type: "article",
                            title: "Knights Before Bishops",
                            sortOrder: 1,
                            estimatedMinutes: 5,
                            content: {
                                introduction: "Developing your pieces quickly and efficiently is the key to a successful opening.",
                                coreConcepts: [
                                    {
                                        conceptTitle: "Development Priorities",
                                        explanation: "Move your center pawns, then develop knights, then bishops. Do not move the same piece twice in the opening if you can avoid it.",
                                        example: "A standard development sequence: 1.e4 e5 2.Nf3 Nc6 3.Bc4."
                                    }
                                ],
                                summary: ["Develop knights before bishops.", "Don't move the queen too early."],
                                quickCheckQuestions: [
                                    { question: "Why develop knights first?", answer: "They take longer to reach the action than long-range bishops." }
                                ]
                            }
                        }
                    ]
                }
            },
            {
                chapterId: targetChapter.id,
                slug: 'king-safety',
                title: 'King Safety & Castling',
                sortOrder: 3,
                content: {
                    description: "Protect your most important piece.",
                    microsections: [
                        {
                            id: "king-safety-article",
                            type: "article",
                            title: "Castling to Safety",
                            sortOrder: 1,
                            estimatedMinutes: 5,
                            content: {
                                introduction: "A king in the center is highly vulnerable to attacks. Castling solves this problem while activating a rook.",
                                coreConcepts: [
                                    {
                                        conceptTitle: "Castling",
                                        explanation: "Castling is the only move where you move two pieces (King and Rook) at once. It tucks the King behind a wall of pawns.",
                                        example: "Kingside castling (O-O) is faster than Queenside castling (O-O-O)."
                                    }
                                ],
                                summary: ["Castle early in the game.", "Keep the pawns in front of your castled king intact."],
                                quickCheckQuestions: [
                                    { question: "What two pieces move when you castle?", answer: "King and Rook" }
                                ]
                            }
                        }
                    ]
                }
            }
        ] as any[]);

        console.log("Chess course seeded successfully.");

    } catch (e) {
        console.error("Error seeding chess course:", e);
    }
}

import * as url from 'url';

// Allow running directly
if (import.meta.url) {
    const currentFile = url.fileURLToPath(import.meta.url);
    if (process.argv[1] === currentFile) {
        seedChessCourse().then(() => process.exit(0)).catch((e) => {
            console.error(e);
            process.exit(1);
        });
    }
}
