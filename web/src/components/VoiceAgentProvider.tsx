import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioRecorder } from '../utils/audioRecorder';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { useAuth } from '../hooks/useAuth';
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

function getNormalSystemInstruction(userName: string, subjects: string[]): string {
  return `You are a voice assistant for an educational platform called LearnHub. You can communicate in any language.
Your ONLY job is to help the student NAVIGATE the platform and RECITE lessons that are stored in the database.

Current Student Name: ${userName}
${subjects.length > 0 ? `Their subjects are: ${subjects.join(', ')}.` : ''}

RULES:
1. You are a NAVIGATOR and LESSON READER only. You do NOT teach new concepts from your own knowledge.
2. When the user asks to go to a page, use the 'navigate' or 'openLesson' tool.
3. When the user asks you to read or recite a lesson, use 'queryKnowledgeBase' to fetch the lesson article from the database and read it out loud to them word for word.
4. If the user wants to explore topics not in the database, suggest they switch to PULSE for a deeper learning experience.
5. Keep responses short and action-oriented. You are an assistant, not a teacher.

Available commands:
- Navigation: dashboard, home, setup, chapter, lesson
- Lesson Control: play, pause, resume, stop, next, previous
- Discovery: list_chapters, list_subjects, current_lesson, help
- Accessibility: focus_mode, braille, story_mode
- Database lookup: queryKnowledgeBase

Be concise, helpful, and action-oriented.`;
}

function getPulseSystemInstruction(userName: string, subjects: string[], currentTopic: string): string {
  return `You are a world-class autonomous AI tutor for an educational platform called LearnHub. You can communicate in any language.
You are operating in THE PULSE — a distraction-free, immersive learning environment where the interface has vanished. You are the heartbeat of the student's learning journey.

Current Student Name: ${userName}
${subjects.length > 0 ? `Their curriculum subjects are: ${subjects.join(', ')}.` : ''}
Current Topic in their learning path: ${currentTopic}

YOUR ROLE: You are a PROACTIVE LEARNING GUIDE and CREATIVE STORYTELLER.

CRITICAL BEHAVIOR:
1. When the session starts, PROACTIVELY welcome the student by name, mention their "Current Topic", and ASK: "Would you like to continue with [topic], or would you like to explore something new?" DO NOT start teaching immediately. Wait for their answer.

2. IF THE USER WANTS TO CONTINUE WITH THEIR CURRICULUM LESSON:
   - You MUST call 'queryKnowledgeBase' with the topic name to fetch the actual lesson article from the LearnHub database.
   - If the database returns content (found_in_db = true), you MUST read and teach from THAT content. Do NOT make up your own version. Explain it naturally and engagingly as a teacher would, but stay faithful to the source material.
   - Show relevant visuals using 'generateVisualCanvas' as you teach.

3. IF THE USER WANTS TO LEARN SOMETHING NEW (not in the curriculum):
   - Use your extensive world knowledge as Gemini to teach them.
   - Be a creative storyteller. Structure the lesson with an intro, core concepts, examples, and a summary.
   - Show relevant visuals using 'generateVisualCanvas' as you teach.

4. After finishing a topic, ask if they want to continue or switch topics.

5. PLANNING LOOP (ReAct): At the start of a teaching session (after the user agrees to a topic), you MUST call 'planLesson' to define your roadmap (3-5 steps). This helps the user follow your autonomous reasoning.

VISUAL AIDS: As you teach, autonomously decide when a visual aid is needed. Call 'generateVisualCanvas' FREQUENTLY (at least once per teaching block). CRITICAL: for 'image_prompt', provide a SHORT 1-2 word search query (e.g., 'black hole', 'mitochondria').

Be friendly, authoritative, and passionate about teaching. Speak naturally.
When you call a tool, do NOT tell the user you are calling it. Just execute the action and respond as if it happened naturally.`;
}

// =============================================================================
// PROVIDER
// =============================================================================

export const VoiceAgentProvider: React.FC<VoiceAgentProviderProps> = ({
  children,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectWithChapters[]>([]);
  const [agentMode, setAgentMode] = useState<AgentMode>('normal');

  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const hasGreetedRef = useRef<boolean>(false);

  // Load subjects when user profile is available
  useEffect(() => {
    if (user?.profile?.curriculumId && user?.profile?.classId) {

      fetchSubjectsWithChapters(user.profile.curriculumId, user.profile.classId)
        .then((subjects) => {
          setAvailableSubjects(subjects);
        })
        .catch((error) => {
          console.error('[Voice Agent] Failed to load subjects:', error);
          setAvailableSubjects([]);
        });
    } else {
      setAvailableSubjects([]);
    }
  }, [user?.profile?.curriculumId, user?.profile?.classId]);

  // Initialize command executor with dependencies
  const commandExecutor = useMemo(() => {
    return new CommandExecutor({
      navigate,
      user,
      availableSubjects,
    });
  }, [navigate, user, availableSubjects]);

  // Gemini Live API hook
  const {
    client,
    connected: isConnected,
    connect,
    disconnect,
    setConfig,
  } = useGeminiLive();

  // Build config based on agent mode
  useEffect(() => {
    const subjectNames = availableSubjects.map(s => s.name);
    const userName = user?.name || 'Student';
    const currentTopic = user?.currentTopic || 'Introduction and Onboarding';

    const systemInstruction = agentMode === 'pulse'
      ? getPulseSystemInstruction(userName, subjectNames, currentTopic)
      : getNormalSystemInstruction(userName, subjectNames);

    // Normal mode: only navigation + KB query tools. Pulse mode: full toolset.
    const activeTools = agentMode === 'pulse'
      ? toolDeclarations
      : toolDeclarations.filter(t =>
        ['navigate', 'openLesson', 'lessonControl', 'listSubjects', 'listChapters',
          'toggleFocusMode', 'openStoryMode', 'openBraille', 'convertBraille',
          'queryKnowledgeBase'].includes(t.name || '')
      );

    const config = {
      responseModalities: [Modality.AUDIO],
      systemInstruction,
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
          endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
          prefixPaddingMs: 100,
          silenceDurationMs: 2000,
        },
      },
      tools: [
        {
          functionDeclarations: activeTools
        }
      ]
    };

    setConfig(config);
  }, [setConfig, agentMode, availableSubjects, user]);

  // Tool call handler - Execute commands from Gemini using CommandExecutor
  useEffect(() => {
    const onToolCall = async (toolCall: any) => {

      // Execute commands using the command executor service
      const responses = await commandExecutor.executeToolCall(toolCall);

      // Send tool responses back to Gemini
      if (responses.length > 0) {
        client.sendToolResponse({
          functionResponses: responses
        });
      }
    };

    const onError = (error: ErrorEvent) => {
      setError(error.message || 'Gemini Live API error');
    };

    client.on('toolcall', onToolCall)
    client.on('error', onError);

    return () => {
      client.off('toolcall', onToolCall)
      client.off('error', onError);
    };
  }, [client, commandExecutor]);

  // Check browser support for audio
  const isSupported = typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  // Start/stop audio recording
  const startListening = useCallback(async () => {
    try {

      // First, ensure we're connected to Gemini Live API
      if (!isConnected || client.status !== 'connected') {
        await connect();
        // Wait for connection to be established (check status, not just isConnected state)
        let attempts = 0;
        while (client.status !== 'connected' && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (client.status !== 'connected') {
          throw new Error('Failed to connect to Gemini Live API - connection timeout');
        }
      }

      // Create a fresh audio recorder each time to avoid stale AudioContext/worklet issues
      audioRecorderRef.current = new AudioRecorder(16000);

      // Listen for audio data and send to Gemini Live API
      audioRecorderRef.current.on('data', (base64Audio: string) => {
        // Check connection status dynamically
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
        } else {
          console.warn('[Voice Agent] Not connected to Gemini Live API, cannot send audio');
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
          const topicContext = user?.currentTopic
            ? `We are currently discussing ${user.currentTopic}.`
            : "We haven't started a specific topic yet.";
          client.send([{ text: `Hi, I just entered Pulse. Give me a proactive welcome! ${topicContext} Greet me, tell me my topic, and ask if I want to continue with it or learn something new.` }]);
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
  }, [isConnected, connect, client, agentMode, user]);

  const stopListening = useCallback(() => {
    audioRecorderRef.current?.stop();
    setIsListening(false);
    setTranscript('');
    hasGreetedRef.current = false;
  }, []);

  // When agent mode changes while listening, disconnect and force a fresh session
  useEffect(() => {
    if (isListening) {
      // Mode changed while active — restart the session with new config
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
