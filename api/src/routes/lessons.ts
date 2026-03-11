import { Router } from "express";
import { db } from "../db/index.js";
import { chapters, lessons as lessonsTable, classes, curricula, gradeSubjects, subjects } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { Unit, UnitLessons, Book, StructuredChapter, StructuredCurriculum } from "../../types/index.js";
import { callGeminiJson, hasGeminiApiKey } from "../utils/gemini.js";
import { isAuthenticated } from "../middleware/auth.js";

const lessonsRouter = Router();

/**
 * Generate the lesson prompt for a given unit
 */
const getLessonPrompt = (unit: Unit): string => {
  return `You are an expert STEM educator and curriculum designer.

Task:
Generate **detailed lessons** for each section of a unit. Each lesson should be **long enough to fully explain the concept**, include **intuitive explanations, examples, and real-world applications**, and describe any **diagrams** verbally. **Formulas and equations** should be **embedded naturally in explanations** using **LaTeX**, no separate math section. Avoid overly short one-line explanations. Each lesson should be standalone so a student reading it understands the concept completely.

Input JSON:

${JSON.stringify({ unit })}

Output JSON:
{
  "unitTitle": "<unitTitle>",
  "unitDescription": "<unitDescription>",
  "lessons": [
    {
      "sectionId": "<sectionId>",
      "title": "<title>",
      "lessonContent": {
        "introduction": "<brief introduction, motivation for the topic>",
        "coreConcepts": [
          {
            "conceptTitle": "<concept name>",
            "explanation": "<detailed explanation covering the concept, embedding LaTeX for math naturally>",
            "example": "<worked example or real-world application>",
            "diagramDescription": "<description of diagram, if any>"
          },
          ...
        ],
        "summary": ["<key takeaways in bullet points>"],
        "quickCheckQuestions": [
          {"question": "<question>", "answer": "<answer>"},
          ...
        ]
      }
    },
    ...
  ]
}

Instructions:
- Generate a **separate JSON object for each section**, and combine them in a **JSON array**.
- Cover **all learning goals** listed for each section.
- Include multiple **core concepts** if the topic has subtopics.
- Provide **detailed explanations** (200–500 words per section).
- Use **LaTeX for all formulas**, embedded naturally in explanations.
- Include **real-world applications and examples** wherever possible.
- Describe **diagrams verbally** to aid understanding.
- List **common mistakes and misconceptions**.
- Provide **quick-check questions** with answers.
- Output strictly as JSON. Do **not** add any text outside the JSON array.


CRITICAL JSON RULES:
- Output MUST be valid strict JSON parsable by JSON.parse()
- Escape ALL backslashes in LaTeX using double backslashes (\\\\)
- Example: use "\\\\Delta x", "\\\\frac{a}{b}", "\\\\text{m/s}"
- Do NOT output raw LaTeX with single backslashes
- Do NOT include markdown code fences


Here is an example input and output for your reference:

Input JSON (example)
{
  "unitTitle": "Unit 1: Kinematics",
  "unitDescription": "Explore the fundamentals of motion by analyzing and applying multiple representations such as words, diagrams, graphs, and equations. Develop an understanding of objects moving with constant acceleration and common misconceptions about motion.",
  "sections": [
    {
      "sectionId": "1.1",
      "title": "Scalars and Vectors in One Dimension",
      "description": "Introduce scalar and vector quantities and their role in describing motion in one dimension.",
      "learningGoals": [
        "Explain scalars",
        "Explain vectors",
        "Differentiate between scalar and vector quantities",
        "Understand position, distance, and displacement",
        "Operations on vectors",
        "Calculate average speed and average velocity",
        "Understand the role of reference frames"
      ]
    },
    {
      "sectionId": "1.2",
      "title": "Visual Representations of Motion",
      "description": "Use diagrams and graphs to describe motion and extract physical meaning from them.",
      "learningGoals": [
        "Interpret position-time graphs",
        "Interpret velocity-time graphs",
        "Interpret acceleration-time graphs",
        "Find displacement from velocity graphs", 
        "Relate velocity and acceleration graphs"
      ]
    }
  ]
}

Expected Output JSON
{
  "unitTitle": "Unit 1: Kinematics",
  "unitDescription": "Explore the fundamentals of motion by analyzing and applying multiple representations such as words, diagrams, graphs, and equations. Develop an understanding of objects moving with constant acceleration and common misconceptions about motion.",
  "lessons": [
    {
      "sectionId": "1.1",
      "title": "Scalars and Vectors in One Dimension",
      "lessonContent": {
        "introduction": "In this lesson, you will learn about scalar and vector quantities, which are the foundation for describing motion in physics. Understanding these concepts is crucial because they allow us to analyze and predict how objects move in one dimension.",
        "coreConcepts": [
          {
            "conceptTitle": "Scalars",
            "explanation": "Scalars are quantities that are described completely by a magnitude alone. Common examples include distance, speed, mass, and temperature. For instance, if a car travels 50 meters, the distance is a scalar because only the magnitude matters, not the direction.",
            "example": "A runner covers 100 meters in 12 seconds. The speed of the runner is a scalar quantity: speed = distance/time = 100/12 ≈ 8.33 m/s.",
            "diagramDescription": "A straight line showing the distance traveled without indicating any direction."
          },
          {
            "conceptTitle": "Vectors",
            "explanation": "Vectors are quantities that have both magnitude and direction. Examples include displacement, velocity, and acceleration. Displacement is a vector, represented as \\\\( \\\\vec{d} \\\\), which points from the initial to the final position. Vector addition follows the triangle or parallelogram law. For motion in one dimension, vectors can be added algebraically, considering their signs for direction.",
            "example": "If a car moves 30 meters east and then 20 meters west, the displacement is \\\\( \\\\vec{d} = 30 - 20 = 10 \\\\) meters east.",
            "diagramDescription": "A straight line with arrows pointing in positive and negative directions representing displacement vectors."
          },
          {
            "conceptTitle": "Average Speed and Velocity",
            "explanation": "Average speed is a scalar given by total distance divided by total time: \\\\( v_{avg} = \\\\frac{d_{total}}{t_{total}} \\\\). Average velocity is a vector given by total displacement over total time: \\\\( \\\\vec{v}_{avg} = \\\\frac{\\\\vec{d}_{total}}{t_{total}} \\\\). Understanding the distinction is essential in kinematics problems.",
            "example": "A car travels 50 m east in 5 s and then 30 m west in 3 s. Average speed = (50+30)/(5+3) = 10 m/s. Average velocity = (50-30)/(5+3) = 2.5 m/s east.",
            "diagramDescription": "Arrow diagram showing displacement vectors in opposite directions and their net result."
          }
        ],
        "summary": [
          "Scalars have only magnitude; vectors have both magnitude and direction.",
          "Displacement differs from distance as it considers direction.",
          "Average speed and average velocity are distinct concepts."
        ],
        "quickCheckQuestions": [
          {
            "question": "Is speed a scalar or vector?",
            "answer": "Scalar"
          },
          {
            "question": "A person walks 10 m east and then 4 m west. What is the displacement?",
            "answer": "6 m east"
          },
          {
            "question": "What is the difference between distance and displacement?",
            "answer": "Distance is total path length (scalar), displacement is net change in position (vector)."
          }
        ]
      }
    },
    {
      "sectionId": "1.2",
      "title": "Visual Representations of Motion",
      "lessonContent": {
        "introduction": "Graphs and diagrams provide visual ways to understand motion. In this lesson, you will learn how to interpret position-time, velocity-time, and acceleration-time graphs to analyze motion effectively.",
        "coreConcepts": [
          {
            "conceptTitle": "Position-Time Graphs",
            "explanation": "A position-time graph shows how an object's position changes over time. The slope of the graph gives the velocity: \\\\( v = \\\\frac{\\\\Delta x}{\\\\Delta t} \\\\). A straight line indicates constant velocity; a curved line indicates acceleration.",
            "example": "If a car moves at constant velocity and its position-time graph is a straight line, the slope of the line represents the velocity.",
            "diagramDescription": "Graph with time on x-axis, position on y-axis, straight line with slope indicating velocity."
          },
          {
            "conceptTitle": "Velocity-Time Graphs",
            "explanation": "A velocity-time graph shows how velocity changes with time. The slope of the graph gives acceleration: \\\\( a = \\\\frac{\\\\Delta v}{\\\\Delta t} \\\\). The area under the curve represents displacement.",
            "example": "A car accelerating from 0 to 20 m/s in 10 s has a velocity-time graph with slope = 2 m/s².",
            "diagramDescription": "Graph with time on x-axis, velocity on y-axis, line sloping upwards for positive acceleration."
          },
          {
            "conceptTitle": "Acceleration-Time Graphs",
            "explanation": "An acceleration-time graph shows how acceleration changes with time. The area under the curve gives the change in velocity: \\\\( \\\\Delta v = \\\\int a \\\\, dt \\\\). Constant acceleration is shown as a horizontal line.",
            "example": "Free fall under gravity at 9.8 m/s² is represented by a horizontal line at a = 9.8 m/s².",
            "diagramDescription": "Graph with time on x-axis, acceleration on y-axis, horizontal line indicating constant acceleration."
          }
        ],
        "summary": [
          "Slope of position-time graph gives velocity.",
          "Slope of velocity-time graph gives acceleration.",
          "Area under velocity-time graph gives displacement.",
          "Area under acceleration-time graph gives change in velocity."
        ],
        "quickCheckQuestions": [
          {
            "question": "What does the slope of a position-time graph represent?",
            "answer": "Velocity"
          },
          {
            "question": "What does the area under a velocity-time graph represent?",
            "answer": "Displacement"
          },
          {
            "question": "How is constant acceleration shown in an acceleration-time graph?",
            "answer": "As a horizontal line"
          }
        ]
      }
    }
  ]
}`;
};

/**
 * Generate lessons for a single unit using Gemini
 */
const generateLessonForUnit = async (unit: Unit): Promise<UnitLessons | null> => {
  const prompt = getLessonPrompt(unit);
  const promptSize = new Blob([prompt]).size;
  console.log(`Prompt size for unit "${unit.unitTitle}": ${(promptSize / 1024).toFixed(2)} KB`);

  // Warn if prompt is very large (Gemini has token limits)
  if (promptSize > 100 * 1024) { // 100KB
    console.warn(`⚠️  Large prompt detected (${(promptSize / 1024).toFixed(2)} KB). This may exceed token limits.`);
  }

  return callGeminiJson<UnitLessons>(prompt);
};

/**
 * GET /api/lessons/chapter/:chapterId
 * Get all lessons for a specific chapter, formatted as UnitLessons
 */
lessonsRouter.get("/chapter/:chapterId", async (req, res) => {
  try {
    const { chapterId } = req.params;

    if (!chapterId) {
      return res.status(400).json({ error: "Chapter ID is required" });
    }

    // Fetch chapter with its content
    const [chapter] = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .limit(1);

    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    // Fetch all lessons for this chapter
    const lessonsList = await db
      .select()
      .from(lessonsTable)
      .where(eq(lessonsTable.chapterId, chapterId))
      .orderBy(lessonsTable.sortOrder);

    // Construct UnitLessons from individual lesson records
    if (lessonsList.length === 0) {
      return res.json([{
        unitTitle: chapter.name,
        unitDescription: chapter.description,
        lessons: []
      }]);
    }

    // Transform lessons to UnitLessons format
    const unitLessons: UnitLessons = {
      unitTitle: chapter.name,
      unitDescription: chapter.description,
      lessons: lessonsList.map(lesson => {
        // Extract sectionId from slug (format: "sectionId-title" or just use slug)
        // Try to extract sectionId pattern like "1.1" or "1-1" from the beginning of slug
        const slugParts = lesson.slug.split('-');
        let sectionId = lesson.slug;

        // Try to find a sectionId pattern (e.g., "1.1", "1-1", "1_1")
        if (slugParts.length > 0) {
          const firstPart = slugParts[0];
          // Check if it looks like a section ID (contains numbers and dots/dashes)
          if (/^[\d.]+$/.test(firstPart) || /^[\d-]+$/.test(firstPart)) {
            sectionId = firstPart.replace(/-/g, '.'); // Normalize to dot notation
          }
        }

        return {
          sectionId,
          title: lesson.title,
          lessonContent: lesson.content as any, // LessonContent type
        };
      })
    };

    res.json([unitLessons]);
  } catch (error) {
    console.error("Error fetching lessons for chapter:", error);
    res.status(500).json({
      error: "Failed to fetch lessons",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

lessonsRouter.post("/generate", isAuthenticated, async (req, res) => {
  try {
    console.log("=== Lesson Generation Request Received ===");

    if (!hasGeminiApiKey()) {
      console.error("Gemini API key not configured");
      return res.status(500).json({
        error: "Gemini API key is not configured. Please set GEMINI_API_KEY environment variable."
      });
    }

    const book = req.body as Book;

    if (!Array.isArray(book) || book.length === 0) {
      console.error("Invalid input: book is not an array or is empty", { bookType: typeof book, bookLength: Array.isArray(book) ? book.length : 'N/A' });
      return res.status(400).json({
        error: "Invalid input. Expected an array of units"
      });
    }

    console.log(`Processing ${book.length} units for lesson generation`);

    // Validate all units before processing
    for (let i = 0; i < book.length; i++) {
      const unit = book[i];
      if (!unit.unitTitle || !unit.sections || !Array.isArray(unit.sections)) {
        console.error(`Invalid unit at index ${i}:`, {
          hasTitle: !!unit.unitTitle,
          hasSections: !!unit.sections,
          sectionsIsArray: Array.isArray(unit.sections)
        });
        return res.status(400).json({
          error: `Invalid unit format at index ${i}. Each unit must have unitTitle and sections array.`
        });
      }
      if (unit.sections.length === 0) {
        console.error(`Unit "${unit.unitTitle}" has no sections`);
        return res.status(400).json({ error: `Unit "${unit.unitTitle}" has no sections` });
      }
    }

    const unitLessons: UnitLessons[] = [];

    for (let i = 0; i < book.length; i++) {
      const unit = book[i];
      console.log(`[${i + 1}/${book.length}] Generating lessons for unit: "${unit.unitTitle}" (${unit.sections.length} sections)...`);

      try {
        const startTime = Date.now();
        const lessons = await generateLessonForUnit(unit);
        const duration = Date.now() - startTime;

        if (!lessons) {
          console.error(`[${i + 1}/${book.length}] Failed to generate lessons for unit: "${unit.unitTitle}" - Gemini returned null`);
          return res.status(500).json({
            error: `Failed to generate lessons for unit: "${unit.unitTitle}". The AI model may have returned invalid JSON or encountered an error. Check server logs for details.`,
            failedUnit: unit.unitTitle,
            completedUnits: unitLessons.length,
            totalUnits: book.length
          });
        }

        // Validate the lessons structure
        if (!lessons.unitTitle || !Array.isArray(lessons.lessons)) {
          console.error(`[${i + 1}/${book.length}] Invalid lessons structure for unit: "${unit.unitTitle}"`, lessons);
          return res.status(500).json({
            error: `Invalid lesson structure returned for unit: "${unit.unitTitle}". Expected unitTitle and lessons array.`,
            failedUnit: unit.unitTitle,
            completedUnits: unitLessons.length,
            totalUnits: book.length
          });
        }

        console.log(`[${i + 1}/${book.length}] ✓ Successfully generated ${lessons.lessons.length} lessons for "${unit.unitTitle}" (took ${(duration / 1000).toFixed(1)}s)`);
        unitLessons.push(lessons);
      } catch (unitError) {
        console.error(`[${i + 1}/${book.length}] Error generating lessons for unit "${unit.unitTitle}":`, unitError);

        // Log full error details
        if (unitError instanceof Error) {
          console.error(`  Error message: ${unitError.message}`);
          console.error(`  Error stack: ${unitError.stack}`);
        }

        return res.status(500).json({
          error: `Failed to generate lessons for unit: "${unit.unitTitle}". ${unitError instanceof Error ? unitError.message : 'Unknown error'}`,
          failedUnit: unit.unitTitle,
          completedUnits: unitLessons.length,
          totalUnits: book.length,
          details: unitError instanceof Error ? unitError.message : String(unitError)
        });
      }
    }

    console.log(`=== Lesson Generation Complete: ${unitLessons.length} units processed successfully ===`);
    res.json(unitLessons);
  } catch (error) {
    console.error("=== Fatal Error in Lesson Generation ===", error);
    if (error instanceof Error) {
      console.error("  Error message:", error.message);
      console.error("  Error stack:", error.stack);
    }
    res.status(500).json({
      error: "Failed to generate lessons",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// =============================================================================
// STRUCTURED CURRICULUM GENERATION
// =============================================================================

/**
 * Generate the structured curriculum prompt for a given unit
 * This produces output in the StructuredChapter format with microsections
 */
const getStructuredPrompt = (unit: Unit): string => {
  return `You are an expert STEM educator and curriculum designer.

Task:
Generate a **structured chapter** with multiple **sections**, where each section contains multiple **microsections** (article, video placeholder, quiz, practice).

The structure should be:
- Chapter (the entire unit)
  - Section (a topic within the unit)
    - Microsection: Article (main content with concepts, examples, summary)
    - Microsection: Video (placeholder with title and description)
    - Microsection: Quiz (3-5 multiple choice/true-false questions)
    - Microsection: Practice (2-4 practice problems with explanations)

Input JSON:
${JSON.stringify({ unit })}

Output JSON (EXACTLY this structure):
{
  "chapterId": "<slugified-chapter-id>",
  "chapterTitle": "<unitTitle>",
  "chapterDescription": "<unitDescription>",
  "sections": [
    {
      "id": "<section-id>",
      "slug": "<section-slug>",
      "title": "<section title>",
      "description": "<brief section description>",
      "sortOrder": 1,
      "microsections": [
        {
          "id": "<unique-id>",
          "type": "article",
          "title": "<article title>",
          "sortOrder": 1,
          "estimatedMinutes": 10,
          "content": {
            "introduction": "<introduction text>",
            "coreConcepts": [
              {
                "conceptTitle": "<concept name>",
                "explanation": "<detailed explanation with LaTeX formulas>",
                "example": "<worked example>",
                "diagramDescription": "<description of visual aid>"
              }
            ],
            "summary": ["<key point 1>", "<key point 2>"],
            "quickCheckQuestions": [
              {"question": "<question>", "answer": "<answer>"}
            ]
          }
        },
        {
          "id": "<unique-id>",
          "type": "video",
          "title": "<video title>",
          "sortOrder": 2,
          "estimatedMinutes": 8,
          "content": {
            "id": "<video-id>",
            "title": "<video title>",
            "description": "<what this video would cover>",
            "url": "",
            "duration": 480
          }
        },
        {
          "id": "<unique-id>",
          "type": "quiz",
          "title": "<quiz title>",
          "sortOrder": 3,
          "estimatedMinutes": 5,
          "content": {
            "id": "<quiz-id>",
            "title": "<quiz title>",
            "description": "<quiz description>",
            "questions": [
              {
                "id": "<q-id>",
                "question": "<question text>",
                "type": "multiple-choice",
                "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
                "correctAnswer": 0,
                "explanation": "<why this is correct>",
                "points": 1
              },
              {
                "id": "<q-id>",
                "question": "<true/false question>",
                "type": "true-false",
                "correctAnswer": "true",
                "explanation": "<explanation>",
                "points": 1
              }
            ],
            "timeLimit": 5
          }
        },
        {
          "id": "<unique-id>",
          "type": "practice",
          "title": "<practice title>",
          "sortOrder": 4,
          "estimatedMinutes": 10,
          "content": {
            "id": "<practice-id>",
            "title": "<practice title>",
            "description": "<practice description>",
            "questions": [
              {
                "id": "<p-id>",
                "question": "<practice problem>",
                "type": "multiple-choice",
                "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
                "correctAnswer": 1,
                "explanation": "<detailed solution explanation>",
                "points": 2
              },
              {
                "id": "<p-id>",
                "question": "<short answer problem>",
                "type": "short-answer",
                "correctAnswer": "<expected answer>",
                "explanation": "<how to arrive at the answer>",
                "points": 2
              }
            ],
            "allowRetry": true,
            "showExplanations": true
          }
        }
      ]
    }
  ]
}

Instructions:
- Create one section for each input section in the unit
- Each section MUST have all 4 microsection types: article, video, quiz, practice
- Article microsection: Include 2-4 core concepts with detailed explanations (200-400 words each)
- Video microsection: Provide placeholder with relevant title and description
- Quiz microsection: Include 3-5 questions (mix of multiple-choice and true-false)
- Practice microsection: Include 2-4 harder problems with detailed explanations
- Use LaTeX for all formulas (double-escaped: \\\\frac{a}{b})
- Generate unique IDs for each element (e.g., "section-1", "1-1-article", "q1-1-1")
- Slugify section IDs (e.g., "what-is-physics", "scalars-and-vectors")
- Cover ALL learning goals from the input
- Make quiz questions test understanding, practice questions test application

CRITICAL JSON RULES:
- Output MUST be valid strict JSON parsable by JSON.parse()
- Escape ALL backslashes in LaTeX using double backslashes (\\\\)
- Example: use "\\\\Delta x", "\\\\frac{a}{b}", "\\\\text{m/s}"
- Do NOT output raw LaTeX with single backslashes
- Do NOT include markdown code fences`;
};

/**
 * Generate structured curriculum for a single unit using Gemini
 */
const generateStructuredForUnit = async (unit: Unit): Promise<StructuredChapter | null> => {
  const prompt = getStructuredPrompt(unit);
  const promptSize = new Blob([prompt]).size;
  console.log(`Structured prompt size for unit "${unit.unitTitle}": ${(promptSize / 1024).toFixed(2)} KB`);

  if (promptSize > 100 * 1024) {
    console.warn(`⚠️  Large prompt detected (${(promptSize / 1024).toFixed(2)} KB). This may exceed token limits.`);
  }

  return callGeminiJson<StructuredChapter>(prompt);
};

/**
 * POST /api/lessons/generate-structured
 * Generate structured curriculum with microsections from a book (array of units)
 */
lessonsRouter.post("/generate-structured", isAuthenticated, async (req, res) => {
  try {
    console.log("=== Structured Curriculum Generation Request Received ===");

    if (!hasGeminiApiKey()) {
      console.error("Gemini API key not configured");
      return res.status(500).json({
        error: "Gemini API key is not configured. Please set GEMINI_API_KEY environment variable."
      });
    }

    const book = req.body as Book;

    if (!Array.isArray(book) || book.length === 0) {
      console.error("Invalid input: book is not an array or is empty");
      return res.status(400).json({
        error: "Invalid input. Expected an array of units"
      });
    }

    console.log(`Processing ${book.length} units for structured curriculum generation`);

    // Validate all units before processing
    for (let i = 0; i < book.length; i++) {
      const unit = book[i];
      if (!unit.unitTitle || !unit.sections || !Array.isArray(unit.sections)) {
        return res.status(400).json({
          error: `Invalid unit format at index ${i}. Each unit must have unitTitle and sections array.`
        });
      }
      if (unit.sections.length === 0) {
        return res.status(400).json({ error: `Unit "${unit.unitTitle}" has no sections` });
      }
    }

    const structuredChapters: StructuredChapter[] = [];

    for (let i = 0; i < book.length; i++) {
      const unit = book[i];
      console.log(`[${i + 1}/${book.length}] Generating structured curriculum for: "${unit.unitTitle}"...`);

      try {
        const startTime = Date.now();
        const chapter = await generateStructuredForUnit(unit);
        const duration = Date.now() - startTime;

        if (!chapter) {
          console.error(`[${i + 1}/${book.length}] Failed to generate for unit: "${unit.unitTitle}"`);
          return res.status(500).json({
            error: `Failed to generate structured curriculum for unit: "${unit.unitTitle}"`,
            failedUnit: unit.unitTitle,
            completedUnits: structuredChapters.length,
            totalUnits: book.length
          });
        }

        // Validate structure
        if (!chapter.chapterId || !chapter.chapterTitle || !Array.isArray(chapter.sections)) {
          console.error(`[${i + 1}/${book.length}] Invalid chapter structure for: "${unit.unitTitle}"`);
          return res.status(500).json({
            error: `Invalid chapter structure returned for unit: "${unit.unitTitle}"`,
            failedUnit: unit.unitTitle,
            completedUnits: structuredChapters.length,
            totalUnits: book.length
          });
        }

        console.log(`[${i + 1}/${book.length}] ✓ Generated ${chapter.sections.length} sections for "${unit.unitTitle}" (took ${(duration / 1000).toFixed(1)}s)`);
        structuredChapters.push(chapter);
      } catch (unitError) {
        console.error(`[${i + 1}/${book.length}] Error generating for unit "${unit.unitTitle}":`, unitError);
        return res.status(500).json({
          error: `Failed to generate structured curriculum for unit: "${unit.unitTitle}"`,
          failedUnit: unit.unitTitle,
          completedUnits: structuredChapters.length,
          totalUnits: book.length,
          details: unitError instanceof Error ? unitError.message : String(unitError)
        });
      }
    }

    console.log(`=== Structured Curriculum Generation Complete: ${structuredChapters.length} chapters ===`);
    res.json(structuredChapters);
  } catch (error) {
    console.error("=== Fatal Error in Structured Curriculum Generation ===", error);
    res.status(500).json({
      error: "Failed to generate structured curriculum",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// =============================================================================
// STRUCTURED CURRICULUM ENDPOINTS
// =============================================================================

/**
 * GET /api/lessons/structured/:classId/:subjectId
 * Get all chapters for a subject in structured format
 */
lessonsRouter.get("/structured/:classId/:subjectId", async (req, res) => {
  try {
    const { classId, subjectId } = req.params;

    // Find all chapters for this class and subject
    // 1. Find gradeSubjectId for classId and subjectId
    let targetClassId = classId;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    if (!uuidRegex.test(classId)) {
      const [classRec] = await db.select().from(classes).where(eq(classes.slug, classId)).limit(1);
      if (!classRec) {
        return res.status(404).json({ error: `Class with slug '${classId}' not found` });
      }
      targetClassId = classRec.id;
    }

    let targetSubjectId = subjectId;
    if (!uuidRegex.test(subjectId)) {
      const [subjectRec] = await db.select().from(subjects).where(eq(subjects.slug, subjectId)).limit(1);
      if (!subjectRec) {
        return res.status(404).json({ error: `Subject with slug '${subjectId}' not found` });
      }
      targetSubjectId = subjectRec.id;
    }

    const [gradeSubject] = await db
      .select()
      .from(gradeSubjects)
      .where(and(
        eq(gradeSubjects.classId, targetClassId),
        eq(gradeSubjects.subjectId, targetSubjectId)
      ))
      .limit(1);

    if (!gradeSubject) {
      return res.status(404).json({ error: "GradeSubject not found for class and subject" });
    }

    // 2. Find chapters for this gradeSubjectId
    const chaptersList = await db
      .select()
      .from(chapters)
      .where(eq(chapters.gradeSubjectId, gradeSubject.id));

    // 3. For each chapter, find sections (lessons)
    const structuredChapters = await Promise.all(chaptersList.map(async (chapter) => {
      const lessonsList = await db
        .select()
        .from(lessonsTable)
        .where(eq(lessonsTable.chapterId, chapter.id));

      // Each lesson is a section with microsections in content
      return {
        chapterId: chapter.slug,
        chapterTitle: chapter.name,
        chapterDescription: chapter.description,
        sections: lessonsList.map(lesson => ({
          id: lesson.slug,
          slug: lesson.slug,
          title: lesson.title,
          description: (typeof lesson.content === 'object' && 'description' in lesson.content && typeof lesson.content.description === 'string')
            ? lesson.content.description
            : '',
          sortOrder: lesson.sortOrder,
          microsections: (typeof lesson.content === 'object' && 'microsections' in lesson.content && Array.isArray((lesson.content as any).microsections))
            ? (lesson.content as any).microsections
            : [],
        }))
      };
    }));

    res.json(structuredChapters);
  } catch (error) {
    console.error("Error loading structured curriculum data:", error);
    res.status(500).json({
      error: "Failed to load structured curriculum data",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/lessons/structured/:classId/:subjectId/:chapterSlug
 * Get a specific chapter in structured format
 */
lessonsRouter.get("/structured/:classId/:subjectId/:chapterSlug", async (req, res) => {
  try {
    const { classId, subjectId, chapterSlug } = req.params;

    // Look up subject UUID from slug
    const [subject] = await db
      .select()
      .from(subjects)
      .where(eq(subjects.slug, subjectId))
      .limit(1);

    if (!subject) {
      return res.status(404).json({ error: `Subject '${subjectId}' not found` });
    }

    // Find gradeSubjectId for classId and subjectId (UUID)
    // The classId param might be a UUID (for standard curriculum) or a slug (like 'all-levels' for Knowledge Hub)

    // First find the class either by ID or slug
    let targetClassId = classId;

    // Simple UUID regex
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    if (!uuidRegex.test(classId)) {
      // It's a slug, so look up the class UUID
      const [classRec] = await db.select().from(classes).where(eq(classes.slug, classId)).limit(1);
      if (!classRec) {
        return res.status(404).json({ error: `Class with slug '${classId}' not found` });
      }
      targetClassId = classRec.id;
    }

    const [gradeSubject] = await db
      .select()
      .from(gradeSubjects)
      .where(and(
        eq(gradeSubjects.classId, targetClassId),
        eq(gradeSubjects.subjectId, subject.id)
      ))
      .limit(1);

    if (!gradeSubject) {
      return res.status(404).json({ error: "GradeSubject not found for class and subject" });
    }

    // Find chapter by slug
    const [chapter] = await db
      .select()
      .from(chapters)
      .where(and(
        eq(chapters.gradeSubjectId, gradeSubject.id),
        eq(chapters.slug, chapterSlug)
      ))
      .limit(1);

    if (!chapter) {
      return res.status(404).json({ error: `Chapter '${chapterSlug}' not found` });
    }

    // Find lessons (sections) for this chapter
    const lessonsList = await db
      .select()
      .from(lessonsTable)
      .where(eq(lessonsTable.chapterId, chapter.id));

    const structuredChapter = {
      chapterId: chapter.slug,
      chapterTitle: chapter.name,
      chapterDescription: chapter.description,
      sections: lessonsList.map(lesson => ({
        id: lesson.slug,
        slug: lesson.slug,
        title: lesson.title,
        description: (typeof lesson.content === 'object' && 'description' in lesson.content && typeof lesson.content.description === 'string')
          ? lesson.content.description
          : '',
        sortOrder: lesson.sortOrder,
        microsections: (typeof lesson.content === 'object' && 'microsections' in lesson.content && Array.isArray((lesson.content as any).microsections))
          ? (lesson.content as any).microsections
          : [],
      }))
    };

    res.json(structuredChapter);
  } catch (error) {
    console.error("Error loading structured chapter:", error);
    res.status(500).json({
      error: "Failed to load structured chapter",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/lessons/structured/:classId/:subjectId/:chapterSlug/:sectionSlug/:microsectionId
 * Get a specific microsection in structured format
 */
lessonsRouter.get("/structured/:classId/:subjectId/:chapterSlug/:sectionSlug/:microsectionId", async (req, res) => {
  try {
    const { classId, subjectId, chapterSlug, sectionSlug, microsectionId } = req.params;

    // Look up subject UUID from slug
    const [subject] = await db
      .select()
      .from(subjects)
      .where(eq(subjects.slug, subjectId))
      .limit(1);

    if (!subject) {
      return res.status(404).json({ error: `Subject '${subjectId}' not found` });
    }

    // Find gradeSubjectId for classId and subjectId (UUID)
    let targetClassId = classId;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    if (!uuidRegex.test(classId)) {
      const [classRec] = await db.select().from(classes).where(eq(classes.slug, classId)).limit(1);
      if (!classRec) {
        return res.status(404).json({ error: `Class with slug '${classId}' not found` });
      }
      targetClassId = classRec.id;
    }

    const [gradeSubject] = await db
      .select()
      .from(gradeSubjects)
      .where(and(
        eq(gradeSubjects.classId, targetClassId),
        eq(gradeSubjects.subjectId, subject.id)
      ))
      .limit(1);

    if (!gradeSubject) {
      return res.status(404).json({ error: "GradeSubject not found for class and subject" });
    }

    // Find chapter by slug
    const [chapter] = await db
      .select()
      .from(chapters)
      .where(and(
        eq(chapters.gradeSubjectId, gradeSubject.id),
        eq(chapters.slug, chapterSlug)
      ))
      .limit(1);

    if (!chapter) {
      return res.status(404).json({ error: `Chapter '${chapterSlug}' not found` });
    }

    // Find lesson (section) by slug
    const [section] = await db
      .select()
      .from(lessonsTable)
      .where(and(
        eq(lessonsTable.chapterId, chapter.id),
        eq(lessonsTable.slug, sectionSlug)
      ))
      .limit(1);

    if (!section) {
      return res.status(404).json({ error: `Section '${sectionSlug}' not found` });
    }

    // Find microsection by id in section.content.microsections
    const microsections = (typeof section.content === 'object' && 'microsections' in section.content && Array.isArray((section.content as any).microsections))
      ? (section.content as any).microsections
      : [];
    const microsection = microsections.find((m: any) => m.id === microsectionId);
    if (!microsection) {
      return res.status(404).json({ error: `Microsection '${microsectionId}' not found` });
    }

    res.json({
      chapter: {
        chapterId: chapter.slug,
        chapterTitle: chapter.name,
      },
      section: {
        id: section.slug,
        slug: section.slug,
        title: section.title,
      },
      microsection,
      navigation: {
        sectionMicrosections: microsections.map((m: any) => ({
          id: m.id,
          type: m.type,
          title: m.title,
        })),
        currentIndex: microsections.findIndex((m: any) => m.id === microsectionId),
      }
    });
  } catch (error) {
    console.error("Error loading microsection:", error);
    res.status(500).json({
      error: "Failed to load microsection",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default lessonsRouter;