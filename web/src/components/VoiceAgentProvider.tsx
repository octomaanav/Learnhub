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

export type AgentStatus = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

interface VoiceAgentContextType {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string | null;
  agentMode: AgentMode;
  agentStatus: AgentStatus;
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
  const stats = progressStats?.subjectStats?.map(s => `${s.name}:${s.percentage}%`).join(',') || 'none';
  const last = recentProgress?.found ? recentProgress.title : 'new';
  return `LearnHub voice agent. Student: ${userName}. Progress: ${stats}. Last: ${last}. Page: ${window.location.pathname}.
Rules: Be brief and helpful. Ask one clarifying question only if needed.
- "continue"→resumeLearning. "learn X"→openLesson(X). "read this"→getCurrentLessonContent then read it.
- "focus"/"zen"/"pulse"/"start learning"→say "Activating Pulse mode" then toggleFocusMode.
- Roadmap request→navigate(admin-roadmap) then executeAction(fill_roadmap_form,{profile,goal,trigger:true}).
- Story→openStoryMode. Braille→openBraille.
- You can teach ANY topic from your own knowledge. NEVER say a topic is unavailable.
- Speak in English by default. Only switch to another language when the student explicitly asks (e.g. "teach me in Hindi").`;
}

function getPulseSystemInstruction(userName: string, _currentTopic: string, progressStats?: ProgressStats, recentProgress?: RecentProgress): string {
  const stats = progressStats?.subjectStats?.map(s => `${s.name}:${s.percentage}%`).join(',') || 'none';
  const last = recentProgress?.title || 'none';
  return `LearnHub Pulse tutor. Student: ${userName}. Progress: ${stats}. Last: ${last}.
Rules:
- NEVER call navigate, openLesson, resumeLearning, or executeAction. Those tools are blocked in Pulse.
- Speak in short sentences. Be upbeat and encouraging.
- Greet by name, reference last topic, ask to continue or explore new.
- When teaching ANY topic, call generateVisualCanvas to show visuals while you explain. Use type='image_prompt' for pictures and type='mermaid_diagram' (with mermaidCode) for flowcharts. Generate a visual early, then every 2-3 sentences.
- You can teach ANY topic from your own knowledge. NEVER say a topic is unavailable. Just start teaching.
- Speak in English by default. Only switch language when the student explicitly asks.
`;
}

// =============================================================================
// WAKE WORD MATCHING
// =============================================================================

// Fuzzy wake word matcher — handles accent, background noise, and transcription
// drift (e.g. "lauren hub", "learn up", "learning hub", "hey lernhub").
// Strategy: require "hey" near the start + any phonetic variant of "learnhub".
function isWakeWord(text: string): boolean {
  const t = text.trim();

  // Must contain "hey" (or close — "a", "ey" are too short to be worth catching)
  if (!t.includes('hey') && !t.includes('hi ')) return false;

  // All known transcription variants of "learnhub"
  const learnVariants = [
    'learnhub', 'learn hub', 'learn up', 'learn help',
    'lauren hub', 'lauren up', 'lauren help', 'lauren',
    'lernhub', 'lern hub',
    'learning hub', 'learned hub',
    'learn hub', 'lurn hub',
    'lan hub', 'lanhub',
  ];

  return learnVariants.some(v => t.includes(v));
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
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null);
  const [recentProgress, setRecentProgress] = useState<RecentProgress | null>(null);

  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const hasGreetedRef = useRef<boolean>(false);
  const wakeWordRecRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  // Always holds the latest startListening without being a reactive dependency
  const startListeningRef = useRef<() => void>(() => {});
  // Stuck detection: if we sent a tool response but got no audio back, reconnect
  const stuckCheckRef = useRef<{ lastToolResponseAt: number; expectingAudio: boolean } | null>(null);
  const sessionStartTimeRef = useRef<number>(0);

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
    // Pulse mode: minimal tools (just visuals). Normal mode: navigation + KB query tools.
    const activeTools = agentMode === 'pulse'
      ? toolDeclarations.filter(t =>
        ['generateVisualCanvas', 'planLesson', 'queryKnowledgeBase'].includes(t.name || '')
      )
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
          // LOW so background noise doesn't interrupt the agent mid-explanation
          startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
          endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
          prefixPaddingMs: 200,
          silenceDurationMs: 800,
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

  // Tool call handler + status tracking via Gemini Live events
  useEffect(() => {
    const onToolCall = async (toolCall: any) => {
      console.log('[Voice Agent] 🤖 RECEIVED TOOL CALL:', toolCall);
      setAgentStatus('processing');

      const responses = await commandExecutor.executeToolCall(toolCall);

      if (responses.length > 0) {
        try {
          client.sendToolResponse({
            functionResponses: responses
          });
          stuckCheckRef.current = { lastToolResponseAt: Date.now(), expectingAudio: true };
        } catch (e) {
          console.error('[Voice Agent] sendToolResponse failed:', e);
        }
      }
    };

    const onError = (error: any) => {
      console.error('[Voice Agent] Error:', error?.message || error);
      setError(error.message || 'Gemini Live API error');
      setAgentStatus('error');
    };

    const onInterrupted = () => {
      setAgentStatus('listening');
    };

    const onAudioStatus = () => {
      setAgentStatus('speaking');
      if (stuckCheckRef.current) stuckCheckRef.current.expectingAudio = false;
    };

    const onTurnComplete = () => {
      if (isListeningRef.current) {
        setAgentStatus('listening');
      }
    };

    const onToolCallCancellation = (cancellation: any) => {
      console.warn('[Voice Agent] Tool call cancelled:', cancellation);
      stuckCheckRef.current = null;
      if (isListeningRef.current) setAgentStatus('listening');
    };

    client.on('toolcall', onToolCall);
    client.on('toolcallcancellation', onToolCallCancellation);
    client.on('error', onError);
    client.on('interrupted', onInterrupted);
    client.on('audio', onAudioStatus);
    client.on('turncomplete', onTurnComplete);

    return () => {
      client.off('toolcall', onToolCall);
      client.off('toolcallcancellation', onToolCallCancellation);
      client.off('error', onError);
      client.off('interrupted', onInterrupted);
      client.off('audio', onAudioStatus);
      client.off('turncomplete', onTurnComplete);
    };
  }, [client, commandExecutor]);

  // Stuck detection + periodic refresh in Pulse: reconnect if no audio after tool response, or every 4 min in Pulse
  useEffect(() => {
    const STUCK_MS = 12000;
    const PULSE_REFRESH_MS = 4 * 60 * 1000;
    const interval = setInterval(() => {
      if (!isListeningRef.current) return;

      // 1) Stuck: sent tool response but no audio back within 18s
      if (stuckCheckRef.current?.expectingAudio) {
        const elapsed = Date.now() - stuckCheckRef.current.lastToolResponseAt;
        if (elapsed >= STUCK_MS) {
          console.warn('[Voice Agent] No audio after tool response for', Math.round(elapsed / 1000), 's — reconnecting session');
          stuckCheckRef.current.expectingAudio = false;
          hasGreetedRef.current = false;
          sessionStartTimeRef.current = 0;
          audioRecorderRef.current?.stop();
          setAgentStatus('connecting');
          disconnect();
          setTimeout(() => startListeningRef.current(), 2500);
        }
        return;
      }

      // 2) Pulse: proactive refresh every 4 min to avoid long-lived session going stale
      if (agentMode === 'pulse' && sessionStartTimeRef.current > 0) {
        const sessionAge = Date.now() - sessionStartTimeRef.current;
        if (sessionAge >= PULSE_REFRESH_MS) {
          console.warn('[Voice Agent] Pulse session refresh after', Math.round(sessionAge / 1000), 's');
          sessionStartTimeRef.current = 0;
          hasGreetedRef.current = false;
          audioRecorderRef.current?.stop();
          setAgentStatus('connecting');
          disconnect();
          setTimeout(() => startListeningRef.current(), 2500);
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [disconnect, agentMode]);

  // Check browser support for audio
  const isSupported = typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  // Start/stop audio recording
  const startListening = useCallback(async () => {
    try {
      console.log('[Voice Agent] Starting listening...');
      setAgentStatus('connecting');

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

      await audioRecorderRef.current.start();
      sessionStartTimeRef.current = Date.now();
      setIsListening(true);
      setError(null);
      setAgentStatus('listening');

      // Send an initial greeting based on mode
      if (client.status === 'connected' && !hasGreetedRef.current) {
        hasGreetedRef.current = true;

        if (agentMode === 'pulse') {
          const topicContext = recentProgress?.found ? recentProgress.title : '';
          client.send([{ text: `Greet ${user?.name || 'the student'} warmly in English, in 1-2 short sentences.${topicContext ? ` Mention we were working on ${topicContext}.` : ''} Ask what they'd like to learn today — they can continue previous topics or explore anything new. Be enthusiastic and inviting.` }]);
        } else {
          client.send([{ text: `Greet ${user?.name || 'the student'} in one short sentence. You're their LearnHub voice assistant.` }]);
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to start listening';
      console.error('[Voice Agent] Start error:', errorMsg);
      setError(errorMsg);
      setIsListening(false);
      setAgentStatus('error');
    }
  }, [isConnected, connect, client, agentMode, recentProgress]);

  // Keep ref current so wake word handler always calls the latest version
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    audioRecorderRef.current?.stop();
    setIsListening(false);
    setTranscript('');
    setAgentStatus('idle');
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
  // startListening is intentionally accessed via ref to avoid restarting the recognizer
  // every time startListening's identity changes (which would break continuous detection).
  useEffect(() => {
    if (!user || !isSupported || isListening) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Wake Word] SpeechRecognition not supported in this browser.');
      return;
    }

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
        console.log('[Wake Word] Heard:', text);
        if (isWakeWord(text)) {
          console.log('[Wake Word] Triggered — starting Gemini session');
          active = false;
          startListeningRef.current();
        } else if (active) {
          setTimeout(startWakeWord, 100);
        }
      };

      rec.onerror = (e: any) => {
        // 'no-speech' is normal — just restart quietly
        if (active) setTimeout(startWakeWord, e?.error === 'no-speech' ? 100 : 1500);
      };

      rec.onend = () => {
        if (active) setTimeout(startWakeWord, 100);
      };

      try {
        rec.start();
      } catch (_) {}
    };

    console.log('[Wake Word] Listener armed — say "hey learnhub" to activate');
    startWakeWord();

    return () => {
      active = false;
      wakeWordRecRef.current?.abort();
      wakeWordRecRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isSupported, isListening]);

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
    agentStatus,
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
