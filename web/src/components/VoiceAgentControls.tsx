import React, { useEffect, useState } from 'react';
import { useVoiceAgent } from './VoiceAgentProvider';

export const VoiceAgentControls: React.FC = () => {
  const {
    isListening,
    isSupported,
    transcript,
    error,
    agentStatus,
    toggleListening,
  } = useVoiceAgent();

  const statusLabels: Record<string, { text: string; color: string }> = {
    idle: { text: '', color: '' },
    connecting: { text: 'Connecting...', color: 'text-amber-400' },
    listening: { text: 'Listening', color: 'text-green-400' },
    processing: { text: 'Thinking...', color: 'text-blue-400' },
    speaking: { text: 'Speaking', color: 'text-purple-400' },
    error: { text: 'Error', color: 'text-red-400' },
  };
  const status = statusLabels[agentStatus] || statusLabels.idle;

  const [visualizerHeight, setVisualizerHeight] = useState<number[]>([]);

  // Simple waveform visualization effect
  useEffect(() => {
    if (isListening) {
      const interval = setInterval(() => {
        const newHeights = Array.from({ length: 5 }, () => Math.random() * 20 + 10);
        setVisualizerHeight(newHeights);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setVisualizerHeight([]);
    }
  }, [isListening]);

  if (!isSupported) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">

        {/* Transcript Bubble */}
        {isListening && transcript && (
          <div className="bg-white/90 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl p-4 max-w-xs text-slate-700 text-sm font-medium animate-in slide-in-from-bottom-5 duration-300">
            {transcript}
          </div>
        )}

        {/* Error Bubble */}
        {error && (
          <div className="bg-red-50/90 backdrop-blur-md border border-red-200 shadow-xl rounded-2xl p-4 max-w-xs text-red-700 text-sm font-medium animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto">
            {error}
          </div>
        )}

        {/* Main Agent Orb */}
        <button
          onClick={toggleListening}
          className={`pointer-events-auto relative group transition-all duration-300 ${isListening ? 'scale-110' : 'hover:scale-105'
            }`}
          aria-label={isListening ? "Stop Listening" : "Start Voice Agent"}
        >
          {/* Glowing Aura Effect */}
          <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 ${isListening
              ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-60 animate-pulse'
              : 'bg-blue-500/0'
            }`} />

          {/* Main Button Container */}
          <div className={`relative h-16 w-16 rounded-full overflow-hidden shadow-2xl transition-all duration-300 border border-white/20 ${isListening
              ? 'bg-slate-900'
              : 'bg-gradient-to-br from-slate-800 to-slate-900'
            }`}>

            {/* Inner Content */}
            <div className="absolute inset-0 flex items-center justify-center">
              {isListening ? (
                // Waveform Visualization
                <div className="flex items-center justify-center gap-1 h-8">
                  {visualizerHeight.map((h, i) => (
                    <div
                      key={i}
                      className="w-1 bg-gradient-to-t from-blue-400 to-purple-400 rounded-full transition-all duration-100 ease-in-out"
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </div>
              ) : (
                // Passive Icon
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-400 to-purple-400 blur-lg opacity-40"></div>
                  <svg
                    className="w-8 h-8 text-white relative z-10 drop-shadow-lg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Siri-like Gradient Overlay */}
            {isListening && (
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-purple-500/20 to-pink-500/20 animate-spin-slow pointer-events-none" />
            )}
          </div>
        </button>

        {/* Status label */}
        {status.text && (
          <div className="pointer-events-none flex justify-end">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${status.color} bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full`}>
              {status.text}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </>
  );
};
