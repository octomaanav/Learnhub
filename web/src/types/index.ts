// =============================================================================
// USER & AUTHENTICATION TYPES
// =============================================================================

export interface AccessibilityPreferences {
  focusMode?: boolean;
  largeText?: boolean;
  reduceMotion?: boolean;
  captionsOn?: boolean;
  signsOn?: boolean;
}

export interface UserProfile {
  curriculumId: string;
  classId: string;
  chapterIds: string[];
  accessibility?: AccessibilityPreferences;
  language?: string;
}

export interface User {
  user_id: string;
  email: string;
  name: string;
  profile?: UserProfile | null;
  classId?: string | null;
  currentTopic?: string | null;
  isProfileComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthData {
  user: User;
}

export interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// =============================================================================
// CURRICULUM & EDUCATION TYPES
// =============================================================================

export interface CurriculumEntity {
  id: string;
  slug: string;
  name: string;
  description: string;
  createdAt?: string;
}

export interface GradeEntity {
  id: string;
  curriculumId: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt?: string;
}

export interface SubjectEntity {
  id: string;
  slug: string;
  name: string;
  description: string;
  createdAt?: string;
}

export interface ChapterEntity {
  id: string;
  gradeSubjectId: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt?: string;
}

export interface LessonEntity {
  id: string;
  chapterId: string;
  slug: string;
  title: string;
  sortOrder: number;
  content: LessonContent;
  createdAt?: string;
  updatedAt?: string;
}

export interface CurriculumWithGrades extends CurriculumEntity {
  grades: GradeEntity[];
}

export interface GradeWithSubjects extends GradeEntity {
  subjects: SubjectEntity[];
}

export interface SubjectWithChapters extends SubjectEntity {
  gradeSubjectId: string;
  chapters: ChapterEntity[];
}

export interface ChapterWithLessons extends ChapterEntity {
  lessons: LessonEntity[];
}


// =============================================================================
// LESSON & CONTENT TYPES
// =============================================================================

// Microsection types - individual content pieces within a section
export type MicrosectionType = 'article' | 'video' | 'quiz' | 'practice';

export type MicrosectionStatus = 'not-started' | 'in-progress' | 'completed';

export interface BaseMicrosection {
  id: string;
  type: MicrosectionType;
  title: string;
  sortOrder: number;
  estimatedMinutes?: number;
}

export interface ArticleMicrosection extends BaseMicrosection {
  type: 'article';
  content: ArticleContent;
}

export interface VideoMicrosection extends BaseMicrosection {
  type: 'video';
  content: VideoContent;
}

export interface QuizMicrosection extends BaseMicrosection {
  type: 'quiz';
  content: Quiz;
}

export interface PracticeMicrosection extends BaseMicrosection {
  type: 'practice';
  content: PracticeContent;
}

export type Microsection = ArticleMicrosection | VideoMicrosection | QuizMicrosection | PracticeMicrosection;

// Article content - the main lesson/lecture content
export interface ArticleContent {
  introduction: string;
  coreConcepts: CoreConcept[];
  summary: string[];
  quickCheckQuestions: QuickCheckQuestion[];
  images?: ImageContent[];
  notes?: NoteContent[];
}

// Practice content - practice problems/exercises
export interface PracticeContent {
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  allowRetry?: boolean;
  showExplanations?: boolean;
}

export interface CoreConcept {
  conceptTitle: string;
  explanation: string;
  example: string;
  diagramDescription: string;
  diagramImageUrl?: string; // Base64 data URL or external URL for generated diagram
}

export interface QuickCheckQuestion {
  question: string;
  answer: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
  options?: string[];
  correctAnswer: string | number;
  explanation?: string;
  points?: number;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  timeLimit?: number;
}

export interface VideoContent {
  id: string;
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  transcript?: string;
}

export interface ImageContent {
  id: string;
  title?: string;
  url: string;
  alt?: string;
  caption?: string;
}

export interface NoteContent {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

// =============================================================================
// STORY MODE TYPES
// =============================================================================

export interface StorySlide {
  id: string;
  index: number;
  title: string;
  narration: string;
  caption: string;
  imagePrompt: string;
  imageUrl?: string;
  signKeywords?: string[];
}

export interface StoryAsset {
  id: string;
  storyKey: string;
  classId: string;
  subjectId: string;
  chapterSlug: string;
  sectionSlug: string;
  microsectionId?: string | null;
  status: "pending" | "ready" | "error";
  renderType: "slides" | "video";
  slides: StorySlide[];
  videoUrl?: string | null;
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoryAudioSlide {
  slideId: string;
  narration: string;
  caption: string;
  audioUrl: string;
}

export interface StoryAudioAsset {
  id: string;
  storyId: string;
  locale: string;
  status: "pending" | "ready" | "error";
  slides: StoryAudioSlide[];
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// LessonContent - legacy format for backward compatibility
export interface LessonContent {
  introduction: string;
  coreConcepts: CoreConcept[];
  summary: string[];
  quickCheckQuestions: QuickCheckQuestion[];
  // Manual content additions
  videos?: VideoContent[];
  quizzes?: Quiz[];
  images?: ImageContent[];
  notes?: NoteContent[];
}

// =============================================================================
// STRUCTURED CURRICULUM TYPES (New JSON Structure)
// =============================================================================

// Structured section - a part of a chapter containing microsections
export interface StructuredSection {
  id: string;
  slug: string;
  title: string;
  description?: string;
  sortOrder: number;
  microsections: Microsection[];
}

// Structured chapter - top-level structure from JSON
export interface StructuredChapter {
  chapterId: string;
  chapterTitle: string;
  chapterDescription: string;
  sections: StructuredSection[];
}

// Array of structured chapters (the full JSON file structure)
export type StructuredCurriculum = StructuredChapter[];

// Section (DB entity) - a part of a chapter containing microsections
export interface SectionEntity {
  id: string;
  chapterId: string;
  slug: string;
  title: string;
  description?: string;
  sortOrder: number;
  microsections: Microsection[];
  createdAt?: string;
  updatedAt?: string;
}

// Legacy Lesson interface for backward compatibility
export interface Lesson {
  sectionId: string;
  title: string;
  lessonContent: LessonContent;
}

// Unit with sections (structured style)
export interface UnitWithSections {
  unitTitle: string;
  unitDescription: string;
  sections: SectionEntity[];
}

// Legacy UnitLessons for backward compatibility
export interface UnitLessons {
  unitTitle: string;
  unitDescription: string;
  lessons: Lesson[];
}

// Chapter with sections (structured style) - DB entity extended
export interface ChapterWithSections extends ChapterEntity {
  sections: SectionEntity[];
}

// =============================================================================
// PARSING TYPES
// =============================================================================

export interface TOCSection {
  sectionId: string;
  title: string;
  page?: number;
}

export interface ChapterInfo {
  title: string;
  startPage: number;
  tocSections: TOCSection[] | null;
}

export interface Section {
  sectionId: string;
  title: string;
  description: string;
  learningGoals: string[];
}

export interface ParsedUnit {
  unitTitle: string;
  unitDescription: string;
  sections: Section[];
}

export interface ChaptersResponse {
  chapters: ChapterInfo[];
}

export interface FullParseResponse {
  success: boolean;
  totalUnits: number;
  units: ParsedUnit[];
}

// =============================================================================
// DASHBOARD TYPES
// =============================================================================

export interface Chapter {
  id: string;
  title: string;
  progress?: number;
}

// =============================================================================
// SETUP PAGE TYPES
// =============================================================================

export type SetupStep = 'curriculum' | 'grade' | 'chapters';

export interface SetupStepInfo {
  id: SetupStep;
  title: string;
  subtitle: string;
}

export interface UserSetupData {
  curriculumId: string;
  classId: string;
  chapterIds: string[];
  accessibility?: AccessibilityPreferences;
}
