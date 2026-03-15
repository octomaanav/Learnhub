import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AudioRecorder } from '../utils/audioRecorder';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { useAuth } from '../hooks/useAuth';
import { apiUrl } from '../utils/api';
import { Modality, StartSensitivity, EndSensitivity } from '@google/genai';
import type { SubjectWithChapters } from '../types';
import { fetchSubjectsWithChapters } from '../data/curriculumData';
import { toolDeclarations } from '../utils/toolDeclarations';
import { CommandExecutor } from '../services/commandExecutor';

export type AgentMode = 'normal' | 'pulse';

interface VoiceAgentContextType {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string | null;
  agentMode: AgentMode;
  setAgentMode: (mode: AgentMode) => void;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

const VoiceAgentContext = createContext<VoiceAgentContextType | null>(null);

interface ProgressStats {
  subjectStats: Array<{ name: string; percentage: number }>;
}

interface RecentProgress {
  found: boolean;
  chapterSlug?: string;
  title?: string;
  foundInDb?: boolean;
}

export const useVoiceAgent = () => {
  const context = useContext(VoiceAgentContext);
  if (!context) {
    throw new Error('useVoiceAgent must be used within VoiceAgentProvider');
  }
  return context;
};

interface VoiceAgentProviderProps {
  children: React.ReactNode;
}

// =============================================================================
// SYSTEM INSTRUCTIONS
// =============================================================================

function getNormalSystemInstruction(userName: string, progressStats?: ProgressStats, recentProgress?: RecentProgress): string {
  const currentChapter = recentProgress?.chapterSlug ? `Chapter: ${recentProgress.chapterSlug}` : 'None';
  const statsString = progressStats?.subjectStats?.map(s => `${s.name}: ${s.percentage}%`).join(', ') || 'No progress yet';

  return `You are a highly intelligent, proactive voice assistant for LearnHub. You operate with a ReAct (Reasoning + Acting) loop.

Current Student: ${userName}
Memory/Progress: ${statsString}
Last Active: ${recentProgress?.found ? `${recentProgress.title} (${currentChapter})` : 'New student'}
Screen Visibility: ${window.location.pathname}

YOUR ROLE:
1. You are INDEPENDENT. If the user is vague, you make the best choice for them.
   - Example: "Let's learn Physics" -> Autonomously call 'openLesson' for Physics Chapter 1. Do NOT ask which lesson.
   - Example: "Continue" -> Call 'resumeLearning'.
2. You guide them through their curriculum.
3. You can recite database lessons word-for-word using 'queryKnowledgeBase'.

Available Commands: 
- Navigation: navigate, openLesson, resumeLearning
- Lesson Ops: lessonControl, queryKnowledgeBase, getCurrentLessonContent
- Discovery: listSubjects, listChapters
- Accessibility: toggleFocusMode (aka Zen Mode), openStoryMode, openBraille, convertBraille
- Complex Actions: executeAction (Use for roadmaps, forms, etc.)
- Narrate This: When the user says "read this", "narrate the lesson", or "what's on my screen?", you MUST call 'getCurrentLessonContent' to see the lesson text and then read it aloud.
- Zen Mode: When the user says "Zen Mode", "focus", or "distraction-free", call 'toggleFocusMode'.
- Roadmaps: When asked for a learning path or roadmap, FIRST call 'navigate' with destination 'admin-roadmap', THEN call 'executeAction' with page 'admin-roadmap', action 'fill_roadmap_form', and data { profile: '...', goal: '...', trigger: true }.

Be concise, authoritative, and act like a world-class AI agent. Make decisions for the student to keep the flow smooth.`;
}

function getPulseSystemInstruction(userName: string, currentTopic: string, progressStats?: ProgressStats, recentProgress?: RecentProgress): string {
  const statsString = progressStats?.subjectStats?.map(s => `${s.name}: ${s.percentage}%`).join(', ') || 'No progress yet';

  return `You are THE PULSE — a world-class autonomous AI tutor for LearnHub.
Current Student: ${userName}
Curriculum Stats: ${statsString}
Last Achievement: ${recentProgress?.title || 'None'}
Current Topic: ${currentTopic}

**CRITICAL RULE — NEVER NAVIGATE AWAY:**
You are on the Pulse page. This is a self-contained immersive learning environment.
- NEVER call 'navigate', 'openLesson', or 'resumeLearning'. They will be blocked.
- ALL content must be delivered through voice, the visual canvas ('generateVisualCanvas'), or inline actions ('executeAction').
- The student stays on this page until they manually click "Return to Dashboard."

AUTONOMOUS BEHAVIOR:
1. PROACTIVE WELCOME: Welcome the student by name. Reference their "Last Achievement" if they've made progress. Ask: "Would you like to continue with [topic], or explore something new?"
2. DISCOVERY: If they want to continue, call 'queryKnowledgeBase' for the topic and teach it vocally + visually.
3. STORYTELLING: If they want something new, teach from your internal Gemini knowledge.
4. INDEPENDENCE: Do not ask for permissions. Call 'planLesson' at the start of a session.

**CRITICAL — VISUALS:**
- You MUST call 'generateVisualCanvas' frequently while teaching. Every 2-3 sentences, push a relevant visual.
- For diagrams (flowcharts, concept maps, cycles), use type='mermaid_diagram' and provide valid Mermaid syntax in the mermaidCode field.
- For illustrations (anatomy, experiments, scenes, objects), use type='image_prompt' with a detailed description.
- NEVER just talk without pushing visuals. The student has a large canvas in front of them — USE IT.
- The canvas can show images, Mermaid diagrams, roadmaps, etc. Each new 'generateVisualCanvas' call replaces what was there before.

5. ROADMAPS: When asked for a learning path or roadmap, call 'executeAction' with page 'admin-roadmap', action 'fill_roadmap_form', and data { profile: '<student profile>', goal: '<their goal>', trigger: true }. The roadmap will be generated and displayed inline on this page. Do NOT navigate.
6. KNOWLEDGE: Use 'queryKnowledgeBase' to fetch lesson content and teach it. Use 'listSubjects' and 'listChapters' to discover available curriculum.

You are the heartbeat of their learning. Be passionate, proactive, and VISUAL.`;
}

// =============================================================================
// PROVIDER
// =============================================================================

export const VoiceAgentProvider: React.FC<VoiceAgentProviderProps> = ({
  children,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectWithChapters[]>([]);
  const [agentMode, setAgentMode] = useState<AgentMode>('normal');
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null);
  const [recentProgress, setRecentProgress] = useState<RecentProgress | null>(null);

  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const hasGreetedRef = useRef<boolean>(false);
  const wakeWordRecRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  // Keep ref in sync with isListening state (used inside wake-word closures)
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Load progress and subjects
  useEffect(() => {
    if (user?.profile?.curriculumId) {
      // Load subjects
      fetchSubjectsWithChapters(user.profile.curriculumId, user.profile.classId!)
        .then(setAvailableSubjects)
        .catch(err => console.error('[Voice Agent] Subjects fail:', err));

      // Load progress stats
      fetch(apiUrl('/api/progress/stats'), { credentials: 'include' })
        .then(r => r.json())
        .then(setProgressStats)
        .catch(err => console.error('[Voice Agent] Stats fail:', err));

      // Load recent progress
      fetch(apiUrl('/api/progress/recent'), { credentials: 'include' })
        .then(r => r.json())
        .then(setRecentProgress)
        .catch(err => console.error('[Voice Agent] Recent fail:', err));
    }
  }, [user]);

  // Initialize command executor with dependencies
  const commandExecutor = useMemo(() => {
    return new CommandExecutor({
      navigate,
      user,
      availableSubjects,
      isPulseMode: agentMode === 'pulse',
    });
  }, [navigate, user, availableSubjects, agentMode]);

  // Gemini Live API hook
  const {
    client,
    connected: isConnected,
    connect,
    disconnect,
    setConfig,
  } = useGeminiLive();

  const systemInstruction = useMemo(() => {
    const name = user?.name || 'Student';

    if (agentMode === 'pulse') {
      const currentTopic = 'Your Current Path'; // Could be dynamic based on recentProgress
      return getPulseSystemInstruction(name, currentTopic, progressStats || undefined, recentProgress || undefined);
    }

    return getNormalSystemInstruction(name, progressStats || undefined, recentProgress || undefined);
  }, [user, agentMode, progressStats, recentProgress, location]);

  // Build config based on agent mode
  useEffect(() => {
    // Normal mode: only navigation + KB query tools. Pulse mode: full toolset.
    const activeTools = agentMode === 'pulse'
      ? toolDeclarations
      : toolDeclarations.filter(t =>
        ['navigate', 'openLesson', 'lessonControl', 'listSubjects', 'listChapters',
          'toggleFocusMode', 'openStoryMode', 'openBraille', 'convertBraille',
          'queryKnowledgeBase', 'executeAction', 'resumeLearning', 'getCurrentLessonContent'].includes(t.name || '')
      );

    const config = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Sulafat'
          }
        }
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
          endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
          prefixPaddingMs: 300,
          silenceDurationMs: 2000,
        },
      },
      tools: [
        {
          functionDeclarations: activeTools as any
        }
      ]
    };

    setConfig(config);
  }, [setConfig, agentMode, systemInstruction]);

  // Tool call handler - Execute commands from Gemini using CommandExecutor
  useEffect(() => {
    const onToolCall = async (toolCall: any) => {
      console.log('[Voice Agent] 🤖 RECEIVED TOOL CALL:', toolCall);

      // Execute commands using the command executor service
      const responses = await commandExecutor.executeToolCall(toolCall);

      // Send tool responses back to Gemini
      if (responses.length > 0) {
        client.sendToolResponse({
          functionResponses: responses
        });
      }
    };

    const onError = (error: any) => {
      console.error('[Voice Agent] Error:', error?.message || error);
      setError(error.message || 'Gemini Live API error');
    };

    const onInterrupted = () => {
      // Audio playback interrupted by user speech — normal behavior
    };

    client.on('toolcall', onToolCall);
    client.on('error', onError);
    client.on('interrupted', onInterrupted);

    return () => {
      client.off('toolcall', onToolCall);
      client.off('error', onError);
      client.off('interrupted', onInterrupted);
    };
  }, [client, commandExecutor]);

  // Check browser support for audio
  const isSupported = typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  // Start/stop audio recording
  const startListening = useCallback(async () => {
    try {
      console.log('[Voice Agent] Starting listening...');

      // First, ensure we're connected to Gemini Live API
      if (!isConnected || client.status !== 'connected') {
        await connect();
        // Wait for connection to be established
        let attempts = 0;
        while (client.status !== 'connected' && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (client.status !== 'connected') {
          throw new Error('Failed to connect to Gemini Live API - connection timeout');
        }
      }

      // Create a fresh audio recorder each time
      audioRecorderRef.current = new AudioRecorder(16000);

      // Listen for audio data and send to Gemini Live API
      audioRecorderRef.current.on('data', (base64Audio: string) => {
        const currentlyConnected = client.status === 'connected' && client.session;
        if (currentlyConnected) {
          try {
            client.sendRealtimeInput([{
              mimeType: 'audio/pcm;rate=16000',
              data: base64Audio,
            }]);
          } catch (error) {
            console.error('[Voice Agent] Error sending audio:', error);
          }
        }
      });

      // Start audio recording
      await audioRecorderRef.current.start();
      setIsListening(true);
      setError(null);

      // Send an initial greeting based on mode
      if (client.status === 'connected' && !hasGreetedRef.current) {
        hasGreetedRef.current = true;

        if (agentMode === 'pulse') {
          const topicContext = recentProgress?.found
            ? `We were recently working on ${recentProgress.title}.`
            : "We haven't started a specific topic yet.";
          client.send([{ text: `Hi, I just entered Pulse. Give me a proactive welcome! ${topicContext} Greet me, tell me my status, and ask if I want to continue or explore something new.` }]);
        } else {
          client.send([{ text: `Hi! I need help navigating LearnHub. Let me know what you can do for me.` }]);
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to start listening';
      console.error('[Voice Agent] Start error:', errorMsg);
      setError(errorMsg);
      setIsListening(false);
    }
  }, [isConnected, connect, client, agentMode, recentProgress]);

  const stopListening = useCallback(() => {
    audioRecorderRef.current?.stop();
    setIsListening(false);
    setTranscript('');
  }, []);

  // Auto-reconnect when the Gemini session drops while the user is still in a session.
  // The useGeminiLive hook handles the WebSocket reconnect; this restarts the audio pipeline.
  useEffect(() => {
    if (!isListening) return;

    const checkConnection = setInterval(() => {
      if (isListeningRef.current && client.status !== 'connected') {
        console.warn('[Voice Agent] Connection lost while listening — restarting session...');
        audioRecorderRef.current?.stop();
        hasGreetedRef.current = false;
        setTimeout(() => {
          if (isListeningRef.current) {
            startListening();
          }
        }, 2000);
      }
    }, 3000);

    return () => clearInterval(checkConnection);
  }, [isListening, client, startListening]);

  // Wake word detection — passively listens for "hey learnhub" via SpeechRecognition.
  // Automatically pauses while the full Gemini session is active.
  useEffect(() => {
    if (!user || !isSupported || isListening) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let active = true;

    const startWakeWord = () => {
      if (!active || isListeningRef.current) return;

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      wakeWordRecRef.current = rec;

      rec.onresult = (event: any) => {
        const text = (event.results[0]?.[0]?.transcript ?? '').toLowerCase();
        if (text.includes('hey learnhub') || text.includes('hey learn hub')) {
          active = false;
          startListening();
        } else if (active) {
          setTimeout(startWakeWord, 100);
        }
      };

      rec.onerror = () => {
        if (active) setTimeout(startWakeWord, 1500);
      };

      rec.onend = () => {
        if (active) setTimeout(startWakeWord, 100);
      };

      try { rec.start(); } catch (_) {}
    };

    startWakeWord();

    return () => {
      active = false;
      wakeWordRecRef.current?.abort();
      wakeWordRecRef.current = null;
    };
  }, [user, isSupported, isListening, startListening]);

  // When agent mode changes while listening, stop and forcing a fresh session isn't strictly needed for config but helps clean state
  useEffect(() => {
    if (isListening) {
      stopListening();
      disconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentMode]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const value: VoiceAgentContextType = {
    isListening,
    isSupported,
    transcript,
    error,
    agentMode,
    setAgentMode,
    startListening,
    stopListening,
    toggleListening,
  };

  return (
    <VoiceAgentContext.Provider value={value}>
      {children}
    </VoiceAgentContext.Provider>
  );
};
