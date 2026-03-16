/**
 * Command Executor Service
 * Handles execution of all voice commands/tool calls from Gemini
 */
import { NavigateFunction } from 'react-router-dom';
import type { SubjectWithChapters, StructuredChapter, User } from '../types';
import { apiUrl } from '../utils/api';

export interface CommandExecutorDependencies {
  navigate: NavigateFunction;
  user: User | null;
  availableSubjects: SubjectWithChapters[];
  isPulseMode?: boolean;
}

export class CommandExecutor {
  private deps: CommandExecutorDependencies;

  constructor(dependencies: CommandExecutorDependencies) {
    this.deps = dependencies;
    this.logDependencies();
  }

  /**
   * Debug: Log current dependencies state
   */
  private logDependencies() {
    // console.log('[CommandExecutor] Dependencies updated:', {
    //   hasNavigate: !!this.deps.navigate,
    //   hasUser: !!this.deps.user,
    //   subjectsCount: this.deps.availableSubjects.length
    // });
  }

  /**
   * Execute a tool call from Gemini
   */
  async executeToolCall(toolCall: { functionCalls?: { name: string; args: Record<string, any>; id: string }[] }): Promise<Record<string, unknown>[]> {

    const calls = toolCall.functionCalls || [];
    const responses: Record<string, unknown>[] = [];

    for (const call of calls) {

      try {
        let success = false;
        let result: Record<string, unknown> = {};

        switch (call.name) {
          case 'navigate':
            success = await this.navigate(call.args.destination);
            result = { success, destination: call.args.destination };
            break;

          case 'resumeLearning':
            success = await this.resumeLearning();
            result = { success };
            break;

          case 'openLesson':
            success = await this.openLesson(call.args.subject, call.args.chapterNumber, call.args.lessonNumber, call.args.contentType);
            result = { success, subject: call.args.subject, chapterNumber: call.args.chapterNumber, lessonNumber: call.args.lessonNumber, contentType: call.args.contentType };
            break;

          case 'lessonControl':
            success = this.lessonControl(call.args.action);
            result = { success, action: call.args.action };
            break;

          case 'listSubjects':
            result = await this.listSubjects();
            success = true;
            break;

          case 'listChapters':
            result = await this.listChapters(call.args.subject);
            success = true;
            break;

          case 'convertBraille':
            success = this.convertBraille();
            result = { success };
            break;

          case 'toggleFocusMode':
            success = this.toggleFocusMode(call.args.enabled);
            result = { success, enabled: call.args.enabled };
            break;

          case 'openStoryMode':
            success = this.openStoryMode();
            result = { success };
            break;

          case 'openBraille':
            success = this.openBraille();
            result = { success };
            break;

          case 'queryKnowledgeBase':
            result = await this.queryKnowledgeBase(call.args.topic);
            success = true;
            break;

          case 'getCurrentLessonContent':
            result = await this.getCurrentLessonContent();
            success = true;
            break;

          case 'generateVisualCanvas':
            success = this.generateVisualCanvas(call.args.description, call.args.type, call.args.mermaidCode);
            result = { success };
            break;

          case 'executeAction':
            success = this.executeAction(call.args.page, call.args.action, call.args.data);
            result = { success, page: call.args.page, action: call.args.action };
            break;

          case 'planLesson':
            success = this.planLesson(call.args.topic, call.args.steps);
            result = { success };
            break;


          default:
            console.warn('[CommandExecutor] Unknown tool:', call.name);
            result = { success: false, error: 'Unknown tool' };
        }

        responses.push({
          id: call.id,
          name: call.name,
          response: result
        });

      } catch (error: unknown) {
        console.error('[CommandExecutor] Error executing tool:', call.name, error);
        responses.push({
          id: call.id,
          name: call.name,
          response: { success: false, error: error instanceof Error ? error.message : String(error) }
        });
      }
    }

    return responses;
  }

  private toggleFocusMode(_enabled?: boolean): boolean {
    try {
      // Navigate to the dedicated Pulse page — this IS focus/zen mode
      this.deps.navigate('/pulse');
      return true;
    } catch (error) {
      console.error('[CommandExecutor] Failed to activate Pulse mode:', error);
      return false;
    }
  }

  private openStoryMode(): boolean {
    try {
      const event = new CustomEvent('story-open');
      window.dispatchEvent(event);
      return true;
    } catch (error) {
      console.error('[CommandExecutor] Failed to open story mode:', error);
      return false;
    }
  }

  private openBraille(): boolean {
    try {
      const event = new CustomEvent('braille-open');
      window.dispatchEvent(event);
      return true;
    } catch (error) {
      console.error('[CommandExecutor] Failed to open braille:', error);
      return false;
    }
  }

  /**
   * Navigate to a page in the app
   */
  private async navigate(destination: string): Promise<boolean> {
    try {
      const routes: Record<string, string> = {
        dashboard: '/dashboard',
        home: '/',
        setup: '/setup',
        'accessibility-guide': '/accessibility-guide',
        admin: '/admin',
        'admin-roadmap': '/admin/roadmap',
        'admin-review': '/admin/review',
        'admin-upload': '/admin/upload',
        'admin-editor': '/admin/editor',
      };

      const normalizedDestination = destination?.toLowerCase().replace(/\s+/g, '-');
      const route = routes[destination] || routes[normalizedDestination];

      if (!route) return false;

      // In Pulse mode, block all navigation — content is rendered inline
      if (this.deps.isPulseMode) {
        console.log('[CommandExecutor] Pulse mode active — navigation blocked. Destination:', destination);
        return true;
      }

      // Authorization check for admin routes
      if (route.startsWith('/admin')) {
        try {
          const response = await fetch(apiUrl('/api/auth/admin-check'), {
            credentials: 'include',
          });
          const data = await response.json();

          if (!data.isAdmin) {
            console.warn('[CommandExecutor] Unauthorized admin access attempt');
            throw new Error('I tried navigating to the admin page but you are not authorized to view that page.');
          }
        } catch (e: any) {
          if (e.message.includes('authorized')) throw e;
          console.error('[CommandExecutor] Admin check failed:', e);
          throw new Error('I encountered an error verifying your admin access.');
        }
      }

      this.deps.navigate(route);
      return true;
    } catch (error) {
      console.error('[CommandExecutor] Navigation error:', error);
      throw error;
    }
  }

  /**
   * Open a specific lesson by subject and optional chapter/lesson numbers.
   * If numbers are omitted, defaults to the first chapter/lesson.
   */
  private async openLesson(subjectName: string, chapterNumber?: number, lessonNumber?: number, contentType?: string): Promise<boolean> {
    try {
      // In Pulse mode, don't navigate — teach from knowledge instead
      if (this.deps.isPulseMode) {
        console.log('[CommandExecutor] Pulse mode — openLesson blocked, use queryKnowledgeBase instead');
        return true;
      }

      if (!this.deps.user?.profile?.classId) {
        console.error('[CommandExecutor] No user profile');
        return false;
      }

      const classId = this.deps.user.profile.classId;

      // Find subject (case-insensitive partial match)
      const subject = this.deps.availableSubjects.find(s =>
        s.name.toLowerCase().includes(subjectName.toLowerCase())
      );

      if (!subject) {
        console.error('[CommandExecutor] Subject not found:', subjectName);
        return false;
      }

      // Default to chapter 1 if not specified
      const targetChapterIndex = (chapterNumber && chapterNumber > 0) ? chapterNumber - 1 : 0;

      // Find chapter by number (sorted by sortOrder)
      const sortedChapters = [...subject.chapters].sort((a, b) =>
        (a.sortOrder || 0) - (b.sortOrder || 0)
      );

      const chapter = sortedChapters[targetChapterIndex];

      if (!chapter) {
        console.error('[CommandExecutor] Chapter not found at index:', targetChapterIndex);
        return false;
      }

      // Try to deep link to the first microsection
      try {
        const response = await fetch(
          apiUrl(`/api/lessons/structured/${classId}/${subject.slug}/${chapter.slug}`)
        );

        if (response.ok) {
          const chapterData: StructuredChapter = await response.json();

          let targetSection;

          if (lessonNumber) {
            // Try to find specific section by index (1-based)
            if (lessonNumber > 0 && lessonNumber <= chapterData.sections.length) {
              targetSection = chapterData.sections[lessonNumber - 1];
            } else {
              console.warn('[CommandExecutor] Lesson number out of bounds:', lessonNumber);
            }
          }

          // Fallback to first section with content if no specific lesson requested or not found
          if (!targetSection) {
            targetSection = chapterData.sections.find(s => s.microsections.length > 0);
          }

          if (targetSection) {
            let targetMicrosection;

            // Filter by content type if requested (e.g., 'video', 'quiz')
            if (contentType) {
              const type = contentType.toLowerCase();
              targetMicrosection = targetSection.microsections.find(m => m.type === type);
            }

            // Fallback to first microsection if type not found or not specified
            if (!targetMicrosection) {
              targetMicrosection = targetSection.microsections[0];
            }

            if (targetMicrosection) {
              const route = `/${classId}/${subject.slug}/${chapter.slug}/${targetSection.slug}/${targetMicrosection.id}`;
              console.log('[CommandExecutor] Deep linking to:', route);
              this.deps.navigate(route);
              return true;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch chapter details for deep linking', e);
      }

      // Fallback to chapter page
      const route = `/${classId}/${subject.slug}/${chapter.slug}`;
      this.deps.navigate(route);

      return true;
    } catch (error) {
      console.error('[CommandExecutor] Open lesson error:', error);
      return false;
    }
  }

  /**
   * Resume learning where the user left off
   */
  private async resumeLearning(): Promise<boolean> {
    try {
      if (this.deps.isPulseMode) {
        console.log('[CommandExecutor] Pulse mode — resumeLearning blocked');
        return true;
      }

      console.log('[CommandExecutor] Resuming learning...');
      const response = await fetch(apiUrl('/api/progress/recent'), {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch recent progress');
      const data = await response.json();

      if (data.found) {
        const route = `/${data.classId}/${data.subjectSlug}/${data.chapterSlug}/${data.lessonSlug}${data.microsectionId ? '/' + data.microsectionId : ''}`;
        console.log('[CommandExecutor] Resuming to:', route);
        this.deps.navigate(route);
        return true;
      }

      // Fallback: start from the first subject found
      if (this.deps.availableSubjects.length > 0) {
        const firstSubject = this.deps.availableSubjects[0];
        return this.openLesson(firstSubject.name);
      }

      console.warn('[CommandExecutor] No progress found and no subjects available to resume.');
      return false;
    } catch (error) {
      console.error('[CommandExecutor] Resume learning error:', error);
      return false;
    }
  }

  /**
   * Control lesson playback via voice commands
   */
  private lessonControl(action: string): boolean {

    try {
      // Dispatch custom event that LessonViewer listens for
      const event = new CustomEvent('lesson-control', {
        detail: { action }
      });
      window.dispatchEvent(event);
      return true;
    } catch (error) {
      console.error('[CommandExecutor] Failed to dispatch event:', error);
      return false;
    }
  }

  /**
   * Convert content to Braille via voice command
   */
  private convertBraille(): boolean {
    try {
      const event = new CustomEvent('braille-control', {
        detail: { action: 'convert' }
      });
      window.dispatchEvent(event);
      return true;
    } catch (error) {
      console.error('[CommandExecutor] Failed to dispatch braille event:', error);
      return false;
    }
  }

  /**
   * List available subjects
   */
  private async listSubjects(): Promise<Record<string, unknown>> {
    try {

      if (this.deps.availableSubjects.length === 0) {
        console.warn('[CommandExecutor] No subjects loaded!');
        return {
          subjects: [],
          error: 'No subjects available. Please log in and complete setup.'
        };
      }

      const subjectNames = this.deps.availableSubjects.map(s => s.name);
      return { subjects: subjectNames };
    } catch (error) {
      console.error('[CommandExecutor] List subjects error:', error);
      return { subjects: [], error: 'Failed to load subjects' };
    }
  }

  /**
   * List available chapters
   */
  private async listChapters(subjectName?: string): Promise<Record<string, unknown>> {
    try {

      if (this.deps.availableSubjects.length === 0) {
        console.warn('[CommandExecutor] No subjects loaded!');
        return {
          chapters: [],
          error: 'No subjects available. Please log in and complete setup.'
        };
      }

      if (subjectName) {

        const subject = this.deps.availableSubjects.find(s =>
          s.name.toLowerCase().includes(subjectName.toLowerCase())
        );

        if (subject) {
          if (subject.chapters.length === 0) {
            console.warn('[CommandExecutor] Subject has no chapters!');
            return {
              chapters: [],
              subject: subject.name,
              error: `${subject.name} has no chapters yet`
            };
          }

          const chapterNames = subject.chapters.map(c => c.name);
          return { chapters: chapterNames, subject: subject.name };
        }

        console.error('[CommandExecutor] Subject not found:', subjectName);
        return {
          chapters: [],
          error: `Subject "${subjectName}" not found. Available: ${this.deps.availableSubjects.map(s => s.name).join(', ')}`
        };
      } else {
        // List all chapters across all subjects
        const allChapters: string[] = [];
        let totalChapters = 0;

        this.deps.availableSubjects.forEach(subject => {
          subject.chapters.forEach(chapter => {
            allChapters.push(`${subject.name}: ${chapter.name}`);
            totalChapters++;
          });
        });

        if (totalChapters === 0) {
          console.warn('[CommandExecutor] ⚠️ No chapters in any subject!');
          return {
            chapters: [],
            error: 'No chapters available. Database may need seeding.'
          };
        }

        return { chapters: allChapters };
      }
    } catch (error) {
      console.error('[CommandExecutor] List chapters error:', error);
      return { chapters: [], error: 'Failed to load chapters' };
    }
  }

  /**
   * Autonomously search for information
   */
  private async queryKnowledgeBase(topic: string): Promise<Record<string, unknown>> {
    try {
      console.log('[CommandExecutor] Autonomous agent is querying knowledge base for:', topic);

      const response = await fetch(apiUrl(`/api/lessons/knowledge-base/search?q=${encodeURIComponent(topic)}`), {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch from knowledge base');
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        console.log(`[CommandExecutor] Found ${data.results.length} matches in database for: ${topic}`);
        // Return the best match's content to Gemini so it can read it aloud
        const bestMatch = data.results[0];
        return {
          topic,
          found_in_db: true,
          source_title: bestMatch.title,
          content: bestMatch.content,
          instruction: "CRITICAL: I found this exact lesson in the LearnHub curriculum database! You MUST use the provided `content` to teach the user. Explain it naturally and engagingly as a teacher.",
        };
      }

      // If not found in our DB, instruct Gemini to use its own knowledge
      console.log(`[CommandExecutor] Topic not found in DB. Agent will use world knowledge for: ${topic}`);
      return {
        topic,
        found_in_db: false,
        instruction: "This topic is NOT in the LearnHub curriculum database. Since the user wants to 'learn anything', use your extensive internal knowledge as Gemini to synthesize a structured, highly educational answer about this topic. Be a creative storyteller."
      };
    } catch (error) {
      console.error('[CommandExecutor] queryKnowledgeBase error:', error);
      return {
        topic,
        error: 'Failed to query database. Fallback to using your own internal Gemini knowledge.'
      };
    }
  }

  /**
   * Push visual to the blank screen
   */
  private generateVisualCanvas(description: string, type: string, mermaidCode?: string): boolean {
    try {
      console.log('[CommandExecutor] Agent pushed a visual to the canvas:', description, type);
      const event = new CustomEvent('visual-canvas-update', {
        detail: { description, type, mermaidCode }
      });
      window.dispatchEvent(event);
      return true;
    } catch (error) {
      console.error('[CommandExecutor] Failed to push visual:', error);
      return false;
    }
  }

  /**
   * Execute a specific UI action or fill out a form
   */
  private executeAction(page: string, action: string, data: Record<string, any>): boolean {
    try {
      console.log('[CommandExecutor] Agent triggering action:', action, 'on page:', page, 'with data:', data);
      const event = new CustomEvent('page-action-triggered', {
        detail: { page, action, data }
      });
      window.dispatchEvent(event);
      return true;
    } catch (error) {
      console.error('[CommandExecutor] Failed to trigger action:', error);
      return false;
    }
  }

  /**
   * Plan a lesson session
   */
  private planLesson(topic: string, steps: string[]): boolean {
    try {
      console.log('[CommandExecutor] Agent planned a lesson:', topic, steps);
      const event = new CustomEvent('lesson-plan-update', {
        detail: { topic, steps }
      });
      window.dispatchEvent(event);
      return true;
    } catch (error) {
      console.error('[CommandExecutor] Failed to plan lesson:', error);
      return false;
    }
  }

  /**
   * Get content for the currently visible lesson (from URL)
   */
  private async getCurrentLessonContent(): Promise<Record<string, unknown>> {
    try {
      const path = window.location.pathname; // e.g. /classId/subject-slug/chapter-slug/section-slug/microsectionId
      const parts = path.split('/').filter(Boolean);

      // Pattern: /:classId/:subjectId/:chapterSlug/:sectionSlug/:microsectionId
      if (parts.length < 5) {
        return {
          error: "No lesson currently active on screen. I can only 'read' if you are on a lesson page.",
          current_path: path
        };
      }

      const [classId, subjectId, chapterSlug, sectionSlug, microsectionId] = parts;

      console.log(`[CommandExecutor] Fetching content for narration: ${path}`);

      const response = await fetch(
        apiUrl(`/api/lessons/structured/${classId}/${subjectId}/${chapterSlug}/${sectionSlug}/${microsectionId}`),
        { credentials: 'include' }
      );

      if (!response.ok) {
        return { error: "Failed to fetch lesson content from the server." };
      }

      const data = await response.json();
      const microsection = data.microsection;

      if (!microsection) {
        return { error: "Microsection content not found." };
      }

      // Build a readable string for Gemini
      let text = `Title: ${microsection.title}\n\n`;

      if (microsection.type === 'article') {
        const content = microsection.content;
        if (content.introduction) text += `Introduction: ${content.introduction}\n\n`;

        content.coreConcepts?.forEach((concept: any, i: number) => {
          text += `Concept ${i + 1}: ${concept.conceptTitle}\n${concept.explanation}\n`;
          if (concept.example) text += `Example: ${concept.example}\n`;
          text += '\n';
        });

        if (content.summary?.length > 0) {
          text += `Summary: ${content.summary.join('. ')}\n`;
        }
      } else if (microsection.type === 'quiz' || microsection.type === 'practice') {
        text += `This is a ${microsection.type}. Content: ${microsection.content?.description || 'N/A'}`;
      } else if (microsection.type === 'video') {
        text += `This is a video lesson. Description: ${microsection.content?.description || 'N/A'}`;
      }

      return {
        content: text,
        context: { classId, subjectId, chapterSlug, sectionSlug, microsectionId },
        instruction: "You have received the full text of the lesson currently on the user's screen. Narrate it naturally and engagingly as a world-class AI teacher. Do not just read it like a robot; bring the content to life!"
      };

    } catch (error) {
      console.error('[CommandExecutor] getCurrentLessonContent error:', error);
      return { error: "An error occurred while trying to read the screen content." };
    }
  }

  /**
   * Update dependencies (useful when subjects/user change)
   */
  updateDependencies(dependencies: Partial<CommandExecutorDependencies>) {
    this.deps = { ...this.deps, ...dependencies };
    this.logDependencies();
  }
}
