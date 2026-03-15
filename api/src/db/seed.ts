import { db } from "./index.js";
import { curricula, classes, subjects, gradeSubjects, chapters } from "./schema.js";
import { eq, and } from "drizzle-orm";

// =============================================================================
// SUBJECT DATA
// =============================================================================

const subjectData = [
  // Science subjects
  { slug: "physics", name: "Physics", description: "Study of matter, energy, and their interactions" },
  { slug: "chemistry", name: "Chemistry", description: "Study of substances and their properties" },
  { slug: "biology", name: "Biology", description: "Study of living organisms" },
  { slug: "science", name: "Science", description: "Combined Physics, Chemistry, and Biology" },

  // Mathematics
  { slug: "mathematics", name: "Mathematics", description: "Study of numbers, quantities, and shapes" },

  // Languages
  { slug: "english", name: "English", description: "Language and Literature" },
  { slug: "hindi", name: "Hindi", description: "Language and Literature" },

  // Social Sciences
  { slug: "social-science", name: "Social Science", description: "History, Geography, Civics, Economics" },
  { slug: "history", name: "History", description: "World and Indian History" },
  { slug: "geography", name: "Geography", description: "Physical and Human Geography" },
  { slug: "political-science", name: "Political Science", description: "Government and Politics" },
  { slug: "economics", name: "Economics", description: "Micro and Macro Economics" },

  // Commerce
  { slug: "accountancy", name: "Accountancy", description: "Financial and Corporate Accounting" },
  { slug: "business-studies", name: "Business Studies", description: "Business Management and Organization" },

  // Other
  { slug: "computer-science", name: "Computer Science", description: "Programming, Data Structures" },
  { slug: "psychology", name: "Psychology", description: "Human Behavior and Mind" },
  { slug: "sociology", name: "Sociology", description: "Study of Society" },
];

// =============================================================================
// CURRICULUM DATA
// =============================================================================

const curriculumData = [
  {
    slug: "cbse",
    name: "CBSE",
    description: "Central Board of Secondary Education",
    grades: [
      { slug: "class-9", name: "Class 9", description: "Secondary School - Year 1", sortOrder: 1 },
      { slug: "class-10", name: "Class 10", description: "Secondary School - Year 2 (Board Exams)", sortOrder: 2 },
      { slug: "class-11", name: "Class 11", description: "Senior Secondary - Year 1", sortOrder: 3 },
      { slug: "class-12", name: "Class 12", description: "Senior Secondary - Year 2 (Board Exams)", sortOrder: 4 },
    ],
  },
  {
    slug: "icse",
    name: "ICSE/ISC",
    description: "Indian Certificate of Secondary Education",
    grades: [
      { slug: "class-9", name: "Class 9", description: "Secondary School - Year 1", sortOrder: 1 },
      { slug: "class-10", name: "Class 10", description: "ICSE Board Exams", sortOrder: 2 },
      { slug: "class-11", name: "Class 11", description: "ISC - Year 1", sortOrder: 3 },
      { slug: "class-12", name: "Class 12", description: "ISC Board Exams", sortOrder: 4 },
    ],
  },
  {
    slug: "state",
    name: "State Board",
    description: "Various State Education Boards",
    grades: [
      { slug: "class-9", name: "Class 9", description: "Secondary School - Year 1", sortOrder: 1 },
      { slug: "class-10", name: "Class 10", description: "SSC/SSLC Board Exams", sortOrder: 2 },
      { slug: "class-11", name: "Class 11", description: "Higher Secondary - Year 1", sortOrder: 3 },
      { slug: "class-12", name: "Class 12", description: "HSC Board Exams", sortOrder: 4 },
    ],
  },
  {
    slug: "ib",
    name: "IB",
    description: "International Baccalaureate",
    grades: [
      { slug: "myp-4", name: "MYP Year 4", description: "Middle Years Programme", sortOrder: 1 },
      { slug: "myp-5", name: "MYP Year 5", description: "Middle Years Programme", sortOrder: 2 },
      { slug: "dp-1", name: "DP Year 1", description: "Diploma Programme", sortOrder: 3 },
      { slug: "dp-2", name: "DP Year 2", description: "Diploma Programme", sortOrder: 4 },
    ],
  },
];

// =============================================================================
// GRADE-SUBJECT MAPPINGS
// =============================================================================

const class9_10Subjects = ["science", "mathematics", "social-science", "english", "hindi"];
const class11_12Subjects = [
  "physics", "chemistry", "biology", "mathematics", "computer-science", "english",
  "accountancy", "business-studies", "economics",
  "history", "geography", "political-science", "psychology", "sociology",
];

const gradeSubjectMappings: Record<string, Record<string, string[]>> = {
  "cbse": {
    "class-9": class9_10Subjects,
    "class-10": class9_10Subjects,
    "class-11": class11_12Subjects,
    "class-12": class11_12Subjects,
  },
  "icse": {
    "class-9": class9_10Subjects,
    "class-10": class9_10Subjects,
    "class-11": class11_12Subjects,
    "class-12": class11_12Subjects,
  },
  "state": {
    "class-9": class9_10Subjects,
    "class-10": class9_10Subjects,
    "class-11": class11_12Subjects,
    "class-12": class11_12Subjects,
  },
  "ib": {
    "myp-4": class9_10Subjects,
    "myp-5": class9_10Subjects,
    "dp-1": class11_12Subjects,
    "dp-2": class11_12Subjects,
  },
};

// =============================================================================
// CHAPTERS ARE NOW SEEDED FROM JSON FILES (see seedLessons.ts)
// =============================================================================
// Chapters are created from the JSON lesson files in data/lessons/
// This makes JSON files the single source of truth for educational content

// =============================================================================
// SEED FUNCTION
// =============================================================================

export async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // 1. Insert all subjects
    console.log("📚 Inserting subjects...");
    const insertedSubjects = await db
      .insert(subjects)
      .values(subjectData)
      .onConflictDoNothing()
      .returning();

    const subjectMap = new Map<string, string>();

    if (insertedSubjects.length === 0) {
      const existingSubjects = await db.select().from(subjects);
      existingSubjects.forEach(s => subjectMap.set(s.slug, s.id));
    } else {
      insertedSubjects.forEach(s => subjectMap.set(s.slug, s.id));
    }

    console.log(`✅ ${subjectMap.size} subjects ready`);

    // 2. Insert curricula and classes
    console.log("🏫 Inserting curricula and classes...");

    const classMap = new Map<string, string>();

    for (const curriculum of curriculumData) {
      const [insertedCurriculum] = await db
        .insert(curricula)
        .values({
          slug: curriculum.slug,
          name: curriculum.name,
          description: curriculum.description,
        })
        .onConflictDoNothing()
        .returning();

      let curriculumId = insertedCurriculum?.id;

      if (!curriculumId) {
        const [existing] = await db
          .select()
          .from(curricula)
          .where(eq(curricula.slug, curriculum.slug))
          .limit(1);
        curriculumId = existing?.id;
      }

      if (!curriculumId) {
        console.error(`Failed to get curriculum ID for ${curriculum.slug}`);
        continue;
      }

      for (const classItem of curriculum.grades) {
        const [insertedClass] = await db
          .insert(classes)
          .values({
            curriculumId,
            slug: classItem.slug,
            name: classItem.name,
            description: classItem.description,
            sortOrder: classItem.sortOrder,
          })
          .onConflictDoNothing()
          .returning();

        const classId = insertedClass?.id;
        if (classId) {
          classMap.set(`${curriculum.slug}-${classItem.slug}`, classId);
        }
      }
    }

    console.log(`✅ ${curriculumData.length} curricula with classes ready`);

    // Fetch existing classes if needed
    if (classMap.size === 0) {
      const existingClasses = await db
        .select({
          id: classes.id,
          slug: classes.slug,
          curriculumSlug: curricula.slug,
        })
        .from(classes)
        .innerJoin(curricula, eq(curricula.id, classes.curriculumId));

      existingClasses.forEach(c => {
        classMap.set(`${c.curriculumSlug}-${c.slug}`, c.id);
      });
    }

    // 3. Insert class-subject mappings and track gradeSubject IDs
    console.log("🔗 Inserting class-subject mappings...");

    const gradeSubjectMap = new Map<string, string>(); // "classId-subjectSlug" -> gradeSubjectId

    for (const [curriculumSlug, gradesMappings] of Object.entries(gradeSubjectMappings)) {
      for (const [gradeSlug, subjectSlugs] of Object.entries(gradesMappings)) {
        const classId = classMap.get(`${curriculumSlug}-${gradeSlug}`);
        if (!classId) {
          console.warn(`Class not found: ${curriculumSlug}-${gradeSlug}`);
          continue;
        }

        for (const subjectSlug of subjectSlugs) {
          const subjectId = subjectMap.get(subjectSlug);
          if (!subjectId) {
            console.warn(`Subject not found: ${subjectSlug}`);
            continue;
          }

          const [inserted] = await db
            .insert(gradeSubjects)
            .values({ classId, subjectId })
            .onConflictDoNothing()
            .returning();

          if (inserted) {
            gradeSubjectMap.set(`${classId}-${subjectSlug}`, inserted.id);
          }
        }
      }
    }

    // Fetch existing class-subjects if needed
    const existingGradeSubjects = await db
      .select({
        id: gradeSubjects.id,
        classId: gradeSubjects.classId,
        subjectSlug: subjects.slug,
      })
      .from(gradeSubjects)
      .innerJoin(subjects, eq(subjects.id, gradeSubjects.subjectId));

    existingGradeSubjects.forEach(gs => {
      gradeSubjectMap.set(`${gs.classId}-${gs.subjectSlug}`, gs.id);
    });

    console.log(`✅ ${gradeSubjectMap.size} class-subject mappings ready`);
    console.log("🎉 Structural seeding complete!");

    // 4. Seed chapters and lessons from JSON files
    console.log("\n📚 Seeding educational content (chapters + lessons)...");
    console.log("Note: Chapters are created from JSON files (single source of truth)");
    try {
      const { seedLessons } = await import("./seedLessons.js");
      await seedLessons();

      const { seedChessCourse } = await import("./seedChess.js");
      await seedChessCourse();

      console.log("🎉 Complete seeding finished!");
    } catch (error) {
      console.error("❌ Lesson seeding failed:", error);
      console.log("⚠️  Structural data seeded, but educational content (chapters/lessons) failed");
      console.log("💡 You can run seedLessons separately or check your JSON files");
    }

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
