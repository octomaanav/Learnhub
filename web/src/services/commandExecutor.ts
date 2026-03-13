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

          case 'generateVisualCanvas':
            success = this.generateVisualCanvas(call.args.description, call.args.type, call.args.mermaidCode);
            result = { success };
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

  private toggleFocusMode(enabled?: boolean): boolean {
    try {
      const event = new CustomEvent('focus-mode-toggle', { detail: { value: enabled } });
      window.dispatchEvent(event);
      return true;
    } catch (error) {
      console.error('[CommandExecutor] Failed to toggle focus mode:', error);
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
      };

      const normalizedDestination = destination?.toLowerCase().replace(/\s+/g, '-');
      const route = routes[destination] || routes[normalizedDestination];
      if (route) {
        this.deps.navigate(route);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[CommandExecutor] Navigation error:', error);
      return false;
    }
  }

  /**
   * Open a specific lesson by subject and chapter number
   */
  private async openLesson(subjectName: string, chapterNumber: number, lessonNumber?: number, contentType?: string): Promise<boolean> {
    try {
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

      // Find chapter by number (sorted by sortOrder)
      const sortedChapters = [...subject.chapters].sort((a, b) =>
        (a.sortOrder || 0) - (b.sortOrder || 0)
      );

      const chapter = sortedChapters[chapterNumber - 1];

      if (!chapter) {
        console.error('[CommandExecutor] Chapter not found at index:', chapterNumber - 1);
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
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
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
   * Update dependencies (useful when subjects/user change)
   */
  updateDependencies(dependencies: Partial<CommandExecutorDependencies>) {
    this.deps = { ...this.deps, ...dependencies };
    this.logDependencies();
  }
}
