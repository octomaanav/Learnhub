/**
 * Voice Agent Service
 * Central command orchestrator that executes voice commands
 */

import type { Command } from '../utils/voiceCommands';
import type { SubjectWithChapters, ChapterEntity } from '../types';
import { fetchSubjectsWithChapters } from '../data/curriculumData';

export interface VoiceAgentContext {
  currentRoute?: string;
  userProfile?: {
    curriculumId: string;
    classId: string;
    chapterIds: string[];
  };
  currentChapterId?: string;
  currentLessonIndex?: number;
  totalLessons?: number;
  availableSubjects?: SubjectWithChapters[];
}

export interface VoiceAgentCallbacks {
  navigate: (path: string, state?: unknown) => void;
  speak: (text: string) => void;
  pauseNarration: () => void;
  resumeNarration: () => void;
  stopNarration: () => void;
  startNarration: () => void;
  nextLesson: () => void;
  previousLesson: () => void;
  onError: (error: string) => void;
}

export class VoiceAgentService {
  private context: VoiceAgentContext = {};
  private callbacks: VoiceAgentCallbacks | null = null;
  private subjectsCache: SubjectWithChapters[] | null = null;

  /**
   * Initialize the voice agent with callbacks
   */
  initialize(callbacks: VoiceAgentCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Update the agent's context
   */
  updateContext(context: Partial<VoiceAgentContext>) {
    this.context = { ...this.context, ...context };
  }

  /**
   * Get current context
   */
  getContext(): VoiceAgentContext {
    return this.context;
  }

  /**
   * Execute a parsed command
   */
  async executeCommand(command: Command): Promise<boolean> {
    if (!this.callbacks) {
      console.error('Voice agent not initialized');
      return false;
    }

    try {
      switch (command.type) {
        case 'navigate':
          return await this.handleNavigation(command);

        case 'lesson_control':
          return this.handleLessonControl(command);

        case 'discovery':
          return await this.handleDiscovery(command);

        case 'unknown':
          this.callbacks.speak("I didn't understand that command. Try saying 'help' to see available commands, or 'go to dashboard' to navigate.");
          return false;

        default:
          return false;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      this.callbacks.onError(errorMessage);
      this.callbacks.speak(`Sorry, I encountered an error: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Handle navigation commands
   */
  private async handleNavigation(command: Command): Promise<boolean> {
    if (!this.callbacks) return false;

    const action = command.action as string;

    switch (action) {
      case 'dashboard':
        this.callbacks.navigate('/dashboard');
        this.callbacks.speak('Navigating to dashboard');
        return true;

      case 'home':
        this.callbacks.navigate('/');
        this.callbacks.speak('Navigating to home');
        return true;

      case 'setup':
        this.callbacks.navigate('/setup');
        this.callbacks.speak('Navigating to setup');
        return true;

      case 'chapter':
      case 'lesson':
        return await this.handleChapterNavigation(command);

      default:
        this.callbacks.speak("I didn't understand that navigation command.");
        return false;
    }
  }

  /**
   * Handle chapter/lesson navigation
   */
  private async handleChapterNavigation(command: Command): Promise<boolean> {
    if (!this.callbacks || !this.context.userProfile) {
      this.callbacks?.speak('Please log in to access lessons.');
      return false;
    }

    const { subject, chapterNumber } = command.params || {};
    const { curriculumId, classId } = this.context.userProfile;

    // Load subjects if not cached
    if (!this.subjectsCache) {
      try {
        this.subjectsCache = await fetchSubjectsWithChapters(curriculumId, classId);
      } catch (error) {
        this.callbacks?.speak('Failed to load your subjects. Please try again.');
        return false;
      }
    }

    // Find matching chapter
    let targetChapter: ChapterEntity | null = null;

    if (subject && chapterNumber) {
      // Find by subject name and chapter number
      const matchingSubject = this.subjectsCache.find(s =>
        s.name.toLowerCase().includes(subject.toLowerCase())
      );

      if (matchingSubject) {
        // Sort chapters by sortOrder and find by index (chapterNumber - 1)
        const sortedChapters = [...matchingSubject.chapters].sort((a, b) =>
          (a.sortOrder || 0) - (b.sortOrder || 0)
        );
        targetChapter = sortedChapters[chapterNumber - 1] || null;
      }
    } else if (chapterNumber && this.context.availableSubjects) {
      // Find by chapter number across all subjects
      const allChapters: ChapterEntity[] = [];
      this.context.availableSubjects.forEach(subject => {
        allChapters.push(...subject.chapters);
      });
      const sortedChapters = allChapters.sort((a, b) =>
        (a.sortOrder || 0) - (b.sortOrder || 0)
      );
      targetChapter = sortedChapters[chapterNumber - 1] || null;
    }

    if (!targetChapter) {
      const errorMsg = chapterNumber
        ? `I couldn't find ${subject ? subject + ' ' : ''}chapter ${chapterNumber}. Say 'what chapters do I have' to see your available chapters.`
        : `I couldn't find that chapter. Say 'what chapters do I have' to see your available chapters.`;
      this.callbacks?.speak(errorMsg);
      return false;
    }

    // Find the subject that contains this chapter
    const parentSubject = this.subjectsCache?.find(s =>
      s.chapters.some(c => c.id === targetChapter.id)
    );

    if (!parentSubject || !this.context.userProfile) {
      this.callbacks?.speak('Unable to determine the subject for this chapter.');
      return false;
    }

    // For now, use classId (we can optimize to use class slug later if needed)
    // Navigate using the new route format: /:classId/:subjectId/:unit
    const route = `/${this.context.userProfile.classId}/${parentSubject.slug}/${targetChapter.slug}`;
    this.callbacks.navigate(route);

    // If it's a "lesson" action, we'll auto-start narration after navigation
    // This will be handled by the LessonViewer component
    const actionText = command.action === 'lesson'
      ? `Opening ${targetChapter.name} and starting narration`
      : `Opening ${targetChapter.name}`;

    this.callbacks.speak(actionText);
    return true;
  }

  /**
   * Handle lesson control commands
   */
  private handleLessonControl(command: Command): boolean {
    if (!this.callbacks) return false;

    const action = command.action as string;
    const { currentLessonIndex, totalLessons } = this.context;

    switch (action) {
      case 'play':
        this.callbacks.startNarration();
        this.callbacks.speak('Starting lesson narration');
        return true;

      case 'pause':
        this.callbacks.pauseNarration();
        this.callbacks.speak('Narration paused');
        return true;

      case 'resume':
        this.callbacks.resumeNarration();
        this.callbacks.speak('Resuming narration');
        return true;

      case 'stop':
        this.callbacks.stopNarration();
        this.callbacks.speak('Narration stopped');
        return true;

      case 'next':
        if (currentLessonIndex !== undefined && totalLessons !== undefined) {
          if (currentLessonIndex < totalLessons - 1) {
            this.callbacks.nextLesson();
            this.callbacks.speak(`Moving to lesson ${currentLessonIndex + 2} of ${totalLessons}`);
          } else {
            this.callbacks.speak('You are already on the last lesson');
          }
        } else {
          this.callbacks.nextLesson();
          this.callbacks.speak('Moving to next lesson');
        }
        return true;

      case 'previous':
        if (currentLessonIndex !== undefined && totalLessons !== undefined) {
          if (currentLessonIndex > 0) {
            this.callbacks.previousLesson();
            this.callbacks.speak(`Moving to lesson ${currentLessonIndex} of ${totalLessons}`);
          } else {
            this.callbacks.speak('You are already on the first lesson');
          }
        } else {
          this.callbacks.previousLesson();
          this.callbacks.speak('Moving to previous lesson');
        }
        return true;

      default:
        return false;
    }
  }

  /**
   * Handle discovery commands
   */
  private async handleDiscovery(command: Command): Promise<boolean> {
    if (!this.callbacks) return false;

    const action = command.action as string;

    switch (action) {
      case 'list_chapters':
        return await this.listChapters();

      case 'list_subjects':
        return await this.listSubjects();

      case 'current_lesson':
        return this.announceCurrentLesson();

      case 'help':
        return this.showHelp();

      default:
        return false;
    }
  }

  /**
   * List available chapters
   */
  private async listChapters(): Promise<boolean> {
    if (!this.callbacks || !this.context.userProfile) {
      this.callbacks?.speak('Please log in to see your chapters.');
      return false;
    }

    const { curriculumId, classId } = this.context.userProfile;

    try {
      if (!this.subjectsCache) {
        this.subjectsCache = await fetchSubjectsWithChapters(curriculumId, classId);
      }

      if (this.subjectsCache.length === 0) {
        this.callbacks.speak('You have no chapters available.');
        return true;
      }

      const chapterList: string[] = [];
      this.subjectsCache.forEach(subject => {
        if (subject.chapters.length > 0) {
          chapterList.push(`${subject.name} has ${subject.chapters.length} chapters`);
        }
      });

      const message = chapterList.length > 0
        ? `You have ${this.subjectsCache.length} subjects. ${chapterList.join('. ')}.`
        : 'You have no chapters available.';

      this.callbacks.speak(message);
      return true;
    } catch (_error: unknown) {
      this.callbacks?.speak('Failed to load your chapters.');
      return false;
    }
  }

  /**
   * List available subjects
   */
  private async listSubjects(): Promise<boolean> {
    if (!this.callbacks || !this.context.userProfile) {
      this.callbacks?.speak('Please log in to see your subjects.');
      return false;
    }

    const { curriculumId, classId } = this.context.userProfile;

    try {
      if (!this.subjectsCache) {
        this.subjectsCache = await fetchSubjectsWithChapters(curriculumId, classId);
      }

      if (this.subjectsCache.length === 0) {
        this.callbacks.speak('You have no subjects available.');
        return true;
      }

      const subjectNames = this.subjectsCache.map(s => s.name).join(', ');
      this.callbacks.speak(`Your subjects are: ${subjectNames}`);
      return true;
    } catch (_error: unknown) {
      this.callbacks?.speak('Failed to load your subjects.');
      return false;
    }
  }

  /**
   * Announce current lesson
   */
  private announceCurrentLesson(): boolean {
    if (!this.callbacks) return false;

    const { currentLessonIndex, totalLessons } = this.context;

    if (currentLessonIndex === undefined || totalLessons === undefined) {
      this.callbacks.speak('You are not currently viewing a lesson.');
      return true;
    }

    const lessonNum = currentLessonIndex + 1;
    this.callbacks.speak(`You are on lesson ${lessonNum} of ${totalLessons}`);
    return true;
  }

  /**
   * Show help
   */
  private showHelp(): boolean {
    if (!this.callbacks) return false;

    const helpText = `Here are the commands you can use. 

Navigation commands: Go to dashboard. Open physics chapter 1. Start class 11 physics chapter 1 lesson.

Lesson control: Play lesson or start narrating. Pause. Resume or continue. Stop. Next lesson. Previous lesson.

Discovery: What chapters do I have? List my subjects. What lesson am I on? Help.

Say the wake word "Hey LearnHub" followed by any command.`;

    this.callbacks.speak(helpText);
    return true;
  }

  /**
   * Clear cached data
   */
  clearCache() {
    this.subjectsCache = null;
  }
}

// Singleton instance
export const voiceAgentService = new VoiceAgentService();
