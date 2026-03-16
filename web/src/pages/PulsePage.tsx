import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useVoiceAgent } from '../components/VoiceAgentProvider';
import { apiUrl } from '../utils/api';
import { LogOut } from 'lucide-react';
import { PulseWaveform } from '../components/LearnHubLogo';
import { MermaidDiagram } from '../components/MermaidDiagram';

interface RoadmapStep {
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export default function PulsePage() {
  const navigate = useNavigate();
  const { theme } = useAuth();
  const { startListening, stopListening, setAgentMode, isListening, agentStatus } = useVoiceAgent();

  const [visualState, setVisualState] = useState<{ description: string; type: string; mermaidCode?: string } | null>(null);

  // Inline roadmap state
  const [roadmap, setRoadmap] = useState<RoadmapStep[] | null>(null);
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);

  // Track which content arrived most recently so visuals can override roadmap
  const [activePanel, setActivePanel] = useState<'empty' | 'visual' | 'roadmap' | 'generating'>('empty');

  // Start pulse session on mount
  useEffect(() => {
    setAgentMode('pulse');
    const timer = setTimeout(() => startListening(), 300);
    return () => {
      clearTimeout(timer);
    };
  }, [setAgentMode, startListening]);

  // Cleanup on unmount — stop listening and reset to normal mode
  useEffect(() => {
    return () => {
      stopListening();
      setAgentMode('normal');
    };
  }, [stopListening, setAgentMode]);

  // Handle roadmap generation inline when agent triggers it
  const generateRoadmap = useCallback(async (profile: string, goal: string) => {
    setIsGeneratingRoadmap(true);
    setActivePanel('generating');
    try {
      const response = await fetch(apiUrl('/api/admin/generate-roadmap'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profile, goal }),
      });

      if (!response.ok) throw new Error('Failed to generate roadmap');
      const data = await response.json();

      let steps: RoadmapStep[];
      if (Array.isArray(data.roadmap)) {
        steps = data.roadmap;
      } else if (typeof data.roadmap === 'string') {
        try {
          steps = JSON.parse(data.roadmap);
        } catch {
          steps = [{ title: 'Generated Plan', description: data.roadmap, status: 'pending' }];
        }
      } else {
        steps = [];
      }

      setRoadmap(steps);
      setActivePanel('roadmap');
    } catch {
      setRoadmap(null);
    } finally {
      setIsGeneratingRoadmap(false);
    }
  }, []);

  // Listen for agent-triggered roadmap fill in Pulse
  useEffect(() => {
    const handleAgentAction = (e: any) => {
      const { page, action, data } = e.detail;
      if (page === 'admin-roadmap' && action === 'fill_roadmap_form') {
        generateRoadmap(data.profile || '', data.goal || '');
      }
    };
    window.addEventListener('page-action-triggered', handleAgentAction);
    return () => window.removeEventListener('page-action-triggered', handleAgentAction);
  }, [generateRoadmap]);

  // Listen for visual canvas events
  useEffect(() => {
    const handleVisualUpdate = (e: any) => {
      setVisualState(e.detail);
      setActivePanel('visual');
    };

    window.addEventListener('visual-canvas-update', handleVisualUpdate);
    return () => window.removeEventListener('visual-canvas-update', handleVisualUpdate);
  }, [generateRoadmap]);

  const statusConfig: Record<string, { label: string; color: string; dotColor: string; glow: string }> = {
    idle: { label: 'Idle', color: 'text-slate-400', dotColor: 'bg-slate-400', glow: '' },
    connecting: { label: 'Connecting...', color: 'text-amber-400', dotColor: 'bg-amber-400', glow: 'shadow-[0_0_8px_rgba(251,191,36,0.6)]' },
    listening: { label: 'Listening', color: 'text-green-400', dotColor: 'bg-green-500', glow: 'shadow-[0_0_8px_rgba(34,197,94,0.6)]' },
    processing: { label: 'Thinking...', color: 'text-blue-400', dotColor: 'bg-blue-500', glow: 'shadow-[0_0_8px_rgba(59,130,246,0.6)]' },
    speaking: { label: 'Speaking', color: 'text-purple-400', dotColor: 'bg-purple-500', glow: 'shadow-[0_0_8px_rgba(168,85,247,0.6)]' },
    error: { label: 'Error', color: 'text-red-400', dotColor: 'bg-red-500', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.6)]' },
  };
  const currentStatus = statusConfig[agentStatus] || statusConfig.idle;

  const handleExit = () => {
    stopListening();
    setAgentMode('normal');
    navigate('/dashboard');
  };

  // Determine what to show — most recently pushed content wins
  const showRoadmap = activePanel === 'roadmap' && roadmap && roadmap.length > 0;
  const showVisual = activePanel === 'visual' && visualState;
  const showGenerating = activePanel === 'generating' && isGeneratingRoadmap;
  const showEmpty = !showRoadmap && !showVisual && !showGenerating;

  return (
    <div className={`fixed inset-0 z-[100] flex ${theme === 'dark' ? 'bg-[#0B0F19]' : 'bg-slate-50'}`}>
      {/* Dynamic Backdrop */}
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${theme === 'dark' ? 'opacity-30' : 'opacity-20'}`}>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] blur-[150px] rounded-full animate-pulse ${theme === 'dark' ? 'bg-primary-500/20' : 'bg-primary-500/30'}`} />
        <div className={`absolute top-1/3 left-1/3 w-[600px] h-[600px] blur-[120px] rounded-full animate-float ${theme === 'dark' ? 'bg-blue-600/10' : 'bg-blue-600/20'}`} />
      </div>

      <div className="relative flex w-full h-full p-6 sm:p-12 z-10">
        {/* Main content: Visual Canvas & Status */}
        <div className="flex-1 flex flex-col h-full gap-8">
          {/* Header Status */}
          <div className="flex items-center justify-between animate-in slide-in-from-top duration-700">
            <div className="flex items-center gap-4">
              <div className="flex gap-1 h-6 items-center">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full bg-primary-500 ${isListening ? 'animate-bounce' : 'h-1 opacity-30'}`}
                    style={{
                      height: isListening ? `${20 + (i % 3) * 30}%` : '4px',
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
              <span className={`font-black text-sm uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Zen Mode Active
              </span>
            </div>

            <button
              onClick={handleExit}
              className={`p-4 backdrop-blur-2xl border rounded-2xl transition-all flex items-center gap-3 font-bold group shadow-xl ${theme === 'dark' ? 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:bg-black/60 hover:border-white/20' : 'bg-white/80 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white hover:border-slate-300'}`}
            >
              <span className="text-xs uppercase tracking-widest hidden sm:inline">Return to Dashboard</span>
              <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </button>
          </div>

          {/* Main Visual Board */}
          <div className={`flex-1 backdrop-blur-3xl border rounded-[3rem] shadow-[0_0_60px_rgba(0,0,0,0.5)] relative overflow-hidden group ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-white/80 border-slate-200 shadow-xl'}`}>
            {/* Tab switcher when both roadmap and visual exist */}
            {roadmap && roadmap.length > 0 && visualState && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex gap-1 p-1 rounded-xl bg-black/30 backdrop-blur-sm border border-white/10">
                <button
                  onClick={() => setActivePanel('visual')}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activePanel === 'visual' ? 'bg-primary-500 text-white' : 'text-white/60 hover:text-white'}`}
                >
                  Visual
                </button>
                <button
                  onClick={() => setActivePanel('roadmap')}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activePanel === 'roadmap' ? 'bg-primary-500 text-white' : 'text-white/60 hover:text-white'}`}
                >
                  Roadmap
                </button>
              </div>
            )}

            {/* Inline roadmap display */}
            {showRoadmap && (
              <div className="absolute inset-0 p-8 sm:p-12 flex flex-col animate-in zoom-in duration-500 overflow-y-auto thin-scrollbar">
                <div className="flex justify-between items-start mb-8">
                  <div className="px-5 py-2.5 bg-primary-500/15 border border-primary-500/30 rounded-xl">
                    <span className="text-[10px] font-black text-primary-400 uppercase tracking-[0.2em]">Learning Roadmap</span>
                  </div>
                  <button
                    onClick={() => setRoadmap(null)}
                    className={`text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
                  >
                    Clear
                  </button>
                </div>

                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary-500/40 before:via-primary-500/20 before:to-transparent">
                  {roadmap!.map((step, index) => (
                    <div key={index} className="relative flex items-start gap-4 pl-2">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 font-bold text-sm shrink-0 z-10 ${theme === 'dark' ? 'border-primary-500/50 bg-black/60 text-primary-400' : 'border-primary-500/50 bg-white text-primary-600'}`}>
                        {index + 1}
                      </div>
                      <div className={`flex-1 p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/60 border-slate-200 hover:bg-white/80'}`}>
                        <h4 className={`font-bold text-sm mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{step.title}</h4>
                        <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generating roadmap spinner */}
            {showGenerating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-6" />
                <h2 className={`text-2xl font-black mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Generating Roadmap...</h2>
                <p className={`font-bold text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Building your personalized learning path</p>
              </div>
            )}

            {/* Visual canvas content */}
            {showVisual && (
              <div className="absolute inset-0 p-8 sm:p-12 flex flex-col animate-in zoom-in duration-500">
                <div className="flex justify-between items-start mb-8">
                  <div className="px-5 py-2.5 bg-primary-500/15 border border-primary-500/30 rounded-xl shadow-[0_0_20px_rgba(88,204,2,0.1)]">
                    <span className="text-[10px] font-black text-primary-400 uppercase tracking-[0.2em]">Visual Synthesis</span>
                  </div>
                  <p className={`text-xs font-bold uppercase tracking-widest max-w-[250px] text-right leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {visualState!.description}
                  </p>
                </div>
                <div className="flex-1 flex items-center justify-center min-h-0 overflow-auto">
                  {visualState!.type === 'image_prompt' ? (
                    <img
                      src={apiUrl(`/api/story/diagram?q=${encodeURIComponent(visualState!.description)}`)}
                      className="max-w-full max-h-full object-contain rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in duration-700 border border-white/10"
                      alt={visualState!.description}
                    />
                  ) : visualState!.type === 'mermaid_diagram' && (visualState!.mermaidCode || visualState!.description) ? (
                    <div className="w-full max-w-2xl p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in duration-700 border border-white/10 bg-black/40">
                      <MermaidDiagram
                        code={visualState!.mermaidCode || visualState!.description}
                        className="min-h-[200px]"
                      />
                    </div>
                  ) : (
                    <pre className="text-left font-mono text-xs sm:text-sm text-primary-400 bg-black/80 p-10 rounded-[2.5rem] border border-primary-500/30 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] w-full h-full overflow-auto thin-scrollbar animate-in slide-in-from-bottom duration-700">
                      {visualState!.mermaidCode || visualState!.description}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Empty state — animated waveform logo */}
            {showEmpty && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                <PulseWaveform active={isListening} />

                <p className={`mt-10 font-bold text-sm max-w-sm mx-auto leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Diagrams, roadmaps, and visuals will appear here as we learn.
                </p>

                <div className={`mt-8 flex items-center gap-3 px-6 py-3 border rounded-full shadow-lg ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                  <div className={`w-2 h-2 rounded-full ${currentStatus.dotColor} ${currentStatus.glow} ${agentStatus === 'listening' || agentStatus === 'connecting' ? 'animate-pulse' : ''}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? currentStatus.color : 'text-slate-600'}`}>
                    {currentStatus.label}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Persistent status pill — always visible at bottom center */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110]">
        <div className={`flex items-center gap-3 px-5 py-2.5 border rounded-full backdrop-blur-2xl transition-all duration-300 ${theme === 'dark' ? 'bg-black/60 border-white/10' : 'bg-white/80 border-slate-200 shadow-lg'}`}>
          <div className={`w-2.5 h-2.5 rounded-full transition-colors ${currentStatus.dotColor} ${currentStatus.glow} ${agentStatus === 'listening' || agentStatus === 'connecting' || agentStatus === 'speaking' ? 'animate-pulse' : ''}`} />
          <span className={`text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${theme === 'dark' ? currentStatus.color : 'text-slate-700'}`}>
            {currentStatus.label}
          </span>
        </div>
      </div>
    </div>
  );
}
