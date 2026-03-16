/**
 * Tool/Function declarations for Gemini Live API
 */
import { Type, FunctionDeclaration } from '@google/genai';

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "navigate",
    description: "Navigate to a page in the application. Note: admin pages require administrative privileges.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        destination: {
          type: Type.STRING,
          description: "The page to navigate to: dashboard, home, setup, accessibility-guide, admin, admin-roadmap, admin-review"
        }
      },
      required: ["destination"]
    }
  },
  {
    name: "executeAction",
    description: "Execute a specific UI action or fill out a form on the current or target page. Use this for complex tasks like generating roadmaps.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        page: {
          type: Type.STRING,
          description: "The page context for the action (e.g., 'admin-roadmap')"
        },
        action: {
          type: Type.STRING,
          description: "The action to perform (e.g., 'fill_roadmap_form')"
        },
        data: {
          type: Type.OBJECT,
          description: "Key-value pairs of data for the action (e.g., { profile: 'student info', goal: 'algebra' })"
        }
      },
      required: ["page", "action", "data"]
    }
  },
  {
    name: "resumeLearning",
    description: "Continue where the user left off. Use this when the user says 'resume', 'continue', or 'let's get back to it'.",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: "openLesson",
    description: "Open a specific lesson by subject and optional chapter/lesson numbers. If numbers are omitted, the agent will autonomously start from the beginning of the subject or chapter.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        subject: {
          type: Type.STRING,
          description: "The subject name"
        },
        chapterNumber: {
          type: Type.NUMBER,
          description: "Optional: The chapter number starting from 1"
        },
        lessonNumber: {
          type: Type.NUMBER,
          description: "Optional: The lesson or section number within the chapter, starting from 1"
        },
        contentType: {
          type: Type.STRING,
          description: "Optional: The type of content to open: article, video, quiz, or practice"
        }
      },
      required: ["subject"]
    }
  },
  {
    name: "lessonControl",
    description: "Control lesson playback with actions: play, pause, resume, stop, next, or previous",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: "The playback control action: play, pause, resume, stop, next, or previous"
        }
      },
      required: ["action"]
    }
  },
  {
    name: "listSubjects",
    description: "List all available subjects for the user",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: "listChapters",
    description: "List all available chapters, optionally filtered by a specific subject",
    parameters: {
      type: Type.OBJECT,
      properties: {
        subject: {
          type: Type.STRING,
          description: "Optional subject name to filter chapters by"
        }
      }
    }
  },
  {
    name: "convertBraille",
    description: "Convert the current lesson or page content to Braille",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: "toggleFocusMode",
    description: "Activate Pulse mode — a full-screen immersive voice learning experience. Call this when the user says 'focus mode', 'zen mode', 'pulse mode', 'distraction-free', or 'let's start learning' from the main dashboard.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Optional: true to enable, false to disable. If omitted, toggles."
        }
      }
    }
  },
  {
    name: "openStoryMode",
    description: "Open story mode for the current topic/lesson",
    parameters: {
      type: Type.OBJECT,
    }
  },
  {
    name: "openBraille",
    description: "Open braille output for the current topic/lesson",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: "queryKnowledgeBase",
    description: "Autonomously query the textbook or knowledge base for information to synthesize before explaining a complex topic to the user.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: "The topic or concept to research"
        }
      },
      required: ["topic"]
    }
  },
  {
    name: "generateVisualCanvas",
    description: "Generate an educational visual aid (diagram or illustrative prompt) and push it to the user's blank screen to interleave visuals with your narration.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        description: {
          type: Type.STRING,
          description: "Description of what the visual should show"
        },
        type: {
          type: Type.STRING,
          description: "Type of visual: 'image_prompt' or 'mermaid_diagram'"
        },
        mermaidCode: {
          type: Type.STRING,
          description: "If type is mermaid_diagram, provide the exact mermaid.js syntax here. Leave blank if image_prompt."
        }
      },
      required: ["description", "type"]
    }
  },
  {
    name: "planLesson",
    description: "Structure a lesson session by defining a series of learning objectives or steps. This gives the user a roadmap of what you will teach in Pulse mode.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: "The main topic of the plan"
        },
        steps: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: "A list of 3-5 sub-topics or steps you will cover in this session"
        }
      },
      required: ["topic", "steps"]
    }
  },
  {
    name: "getCurrentLessonContent",
    description: "Get the text content of the lesson currently visible on the user's screen. Use this when the user asks you to 'read this', 'narrate the lesson', or 'summarize this page'.",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  }
];
