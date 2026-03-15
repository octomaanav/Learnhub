import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Flame, Zap, BookOpen, Trophy, Target, ArrowRight, CheckCircle2, Sparkles, Moon, Sun } from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Bite-sized Lessons",
    description: "Master complex topics through short, focused sessions that fit into your day.",
  },
  {
    icon: Flame,
    title: "Streak System",
    description: "Build consistency with daily streaks and never break the chain of learning.",
  },
  {
    icon: Zap,
    title: "Earn XP & Level Up",
    description: "Gain experience points for every lesson and watch your skills grow visibly.",
  },
  {
    icon: BookOpen,
    title: "6+ Subjects",
    description: "From science to coding — explore a rich library of curated courses.",
  },
];

const journeySteps = [
  {
    text: "Right now, 1.3 billion people live with a visual impairment.",
    subtext: "They can't see this beautiful dashboard you just saw.",
  },
  {
    text: "285 million people can't use a mouse or tap a screen.",
    subtext: "Every button is a wall. Every menu, a locked door.",
  },
  {
    text: "The biggest barrier to software isn't cost. It isn't speed. It's the interface itself.",
    subtext: "UI was designed for the able. We're designing for everyone.",
  },
  {
    text: "What if software could speak to you? Listen to you? Understand you?",
    subtext: "No screens. No clicks. No barriers.",
  },
  {
    text: "Welcome to voice-first learning.",
    subtext: "This is LearnHub. And the interface just disappeared.",
  },
];

const waveformHeights = [18, 34, 52, 30, 20];

function HomePage() {
  const navigate = useNavigate();

  const { theme, toggleTheme } = useAuth();
  const [isHeroVisible, setIsHeroVisible] = useState(false);

  // Void Mode States
  const [isDissolving, setIsDissolving] = useState(false); // Triggers the Thanos snap animation
  const [isVoidMode, setIsVoidMode] = useState(false); // Triggers the actual audio UI and locks screen

  // Controls the evolving narrative inside Void Mode
  const [voidSequenceStep, setVoidSequenceStep] = useState(0);

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Trigger the staggered dissolve before entering Void Mode
  const initiateVoidSequence = () => {
    setIsDissolving(true);
    // Wait for the longest staggered animation (hero: 1200ms) + 600ms buffer to finish before snapping to full void UI
    setTimeout(() => {
      setIsVoidMode(true);
    }, 1800);
  };

  // Stagger the text appearance after the UI dissolves to simulate a voice agent
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Safe wrapper for TTS
    const speakText = (text: string) => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop any ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95; // Slightly slower, more deliberate pacing
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    };

    if (isVoidMode) {
      // Blur and waveform pulse happen at step 0 implicitly when isVoidMode becomes true

      timers.push(setTimeout(() => {
        setVoidSequenceStep(1);
        speakText(journeySteps[0].text + " " + journeySteps[0].subtext);
      }, 1500));

      timers.push(setTimeout(() => {
        setVoidSequenceStep(2);
        speakText(journeySteps[1].text + " " + journeySteps[1].subtext);
      }, 7000));

      timers.push(setTimeout(() => {
        setVoidSequenceStep(3);
        speakText(journeySteps[2].text + " " + journeySteps[2].subtext);
      }, 12500));

      timers.push(setTimeout(() => {
        setVoidSequenceStep(4);
        speakText(journeySteps[3].text + " " + journeySteps[3].subtext);
      }, 19000));

      timers.push(setTimeout(() => {
        setVoidSequenceStep(5);
        speakText(journeySteps[4].text + " " + journeySteps[4].subtext);
      }, 25000));

    } else {
      // Clean up TTS when exiting
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }

    return () => {
      timers.forEach(clearTimeout);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isVoidMode]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setIsHeroVisible(true);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div className={`${theme} min-h-screen font-sans selection:bg-[#069494]/30 selection:text-[#069494] overflow-x-hidden relative transition-colors duration-500 bg-surface-50 text-surface-900`}>

      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${isDissolving || isVoidMode ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
          }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
          <div className="flex items-center justify-between rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-100/85 backdrop-blur-md shadow-sm px-4 sm:px-5 py-3">
            <button
              onClick={() => navigate('/')}
              className="font-display text-xl font-black tracking-tight text-surface-900 dark:text-white"
            >
              LearnHub
            </button>

            <nav className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={scrollToFeatures}
                className="px-3 py-2 rounded-lg text-sm font-bold text-surface-600 dark:text-surface-300 hover:text-[#069494] dark:hover:text-[#069494] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                About Me
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-3 py-2 rounded-lg text-sm font-bold text-surface-600 dark:text-surface-300 hover:text-[#069494] dark:hover:text-[#069494] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="px-3 py-2 rounded-lg text-sm font-bold text-surface-600 dark:text-surface-300 hover:text-[#069494] dark:hover:text-[#069494] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                Sign Up
              </button>
              <button
                onClick={() => toggleTheme()}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#069494] text-white hover:bg-[#047c7c] transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* =========================================
          STANDARD UI LAYER (Fades out via Thanos Snap)
          ========================================= */}
      <div
        className={`relative z-10 ${isVoidMode ? 'hidden' : 'block'}`}
      >

        {/* Hero Section */}
        <section
          className={`min-h-screen pt-24 pb-10 md:pb-16 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(6,148,148,0.1),_transparent_55%)] transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDissolving ? 'opacity-0 blur-xl scale-95 translate-y-8 delay-[1200ms]' : 'opacity-100 blur-0 scale-100 translate-y-0 delay-0'
            }`}
        >

          <div className="w-full max-w-5xl px-6 text-center flex flex-col items-center">

            <div className={`inline-flex items-center gap-2 bg-[#069494]/10 text-[#069494] font-semibold text-sm px-4 py-1.5 rounded-full mb-10 ring-1 ring-[#069494]/30 dark:ring-[#069494]/20 transition-all duration-700 ease-out ${isHeroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <Sparkles className="w-4 h-4" />
              The future of learning
            </div>

            {/* Decreased font weight from font-black to font-bold and size from 6xl to 5xl */}
            <h1
              className={`text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1] font-display mb-8 max-w-4xl mx-auto text-surface-900 dark:text-white transition-all duration-700 delay-150 ease-out ${isHeroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              Every button, every menu, every click <span className="text-[#069494]">is a barrier someone can't cross.</span>
            </h1>

            <p className={`text-lg md:text-xl text-surface-700 font-medium max-w-3xl mx-auto leading-relaxed mb-14 transition-all duration-700 delay-300 ease-out ${isHeroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              A major limitation to software usage across the entire globe is UI. So LearnHub asks: what if we get rid of the UI entirely?
            </p>

            <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 delay-500 ease-out ${isHeroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <button
                onClick={initiateVoidSequence}
                disabled={isDissolving}
                className="group relative px-5 py-3 bg-[#069494] text-white rounded-xl font-bold text-sm md:text-base overflow-hidden transition-transform active:scale-95 hover:shadow-2xl hover:shadow-[#069494]/20 w-full sm:w-auto flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#047c7c] to-[#035f5f] translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300"></div>
                <span className="relative flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                  </svg>
                  Enter the next gen of software
                </span>
              </button>

              <button
                onClick={() => navigate("/signup")}
                disabled={isDissolving}
                className="px-5 py-3 text-sm md:text-base font-bold text-surface-600 dark:text-surface-400 border-2 border-surface-200 dark:border-surface-800 rounded-xl hover:border-surface-300 dark:hover:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-900 hover:text-surface-900 dark:hover:text-white transition-all w-full sm:w-auto flex justify-center disabled:opacity-50 disabled:pointer-events-none"
              >
                Try Standard Platform
              </button>
            </div>
          </div>

        </section>

        <section
          className={`px-6 pb-20 md:pb-24 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDissolving ? 'opacity-0 blur-xl scale-95 translate-y-8 delay-[900ms]' : 'opacity-100 blur-0 scale-100 translate-y-0 delay-0'
            }`}
        >
          <div className="w-full max-w-5xl mx-auto mb-12">
            <div className={`bg-surface-100 rounded-[2rem] shadow-xl dark:shadow-2xl border border-surface-200 dark:border-surface-700 p-8 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDissolving ? 'opacity-0 blur-xl scale-95 translate-y-8 delay-[900ms]' : 'opacity-100 blur-0 scale-100 translate-y-0 delay-0'
              }`}>
              {/* Daily Stats */}
              <div className="flex items-center gap-8 border-b border-surface-100 dark:border-[#1E293B] pb-6 mb-8">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔥</span>
                  <span className="font-bold text-surface-900 dark:text-white text-sm">12 day streak</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <span className="font-bold text-surface-900 dark:text-white text-sm">2,450 XP</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏆</span>
                  <span className="font-bold text-surface-900 dark:text-white text-sm">Level 8</span>
                </div>
                <div className="ml-auto w-48 h-3 bg-surface-100 dark:bg-[#0B0F19] rounded-full overflow-hidden border border-surface-200 dark:border-[#1E293B]">
                  <div className="h-full bg-[#069494] rounded-full w-[80%]"></div>
                </div>
              </div>

              {/* Course Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { title: "Biology 101", icon: "📖", color: "bg-surface-100 dark:bg-[#1E293B] text-surface-900 dark:text-white", progress: "72%", progressColor: "bg-[#069494]" },
                  { title: "Spanish", icon: "🌐", color: "bg-surface-100 dark:bg-[#1E293B] text-surface-900 dark:text-white", progress: "45%", progressColor: "bg-[#069494]" },
                  { title: "Calculus", icon: "📈", color: "bg-surface-100 dark:bg-[#1E293B] text-surface-900 dark:text-white", progress: "30%", progressColor: "bg-[#069494]" },
                  { title: "Python", icon: "⚙️", color: "bg-surface-100 dark:bg-[#1E293B] text-surface-900 dark:text-white", progress: "88%", progressColor: "bg-[#069494]" },
                  { title: "Art History", icon: "⭐", color: "bg-surface-100 dark:bg-[#1E293B] text-surface-900 dark:text-white", progress: "15%", progressColor: "bg-surface-300 dark:bg-surface-600" },
                  { title: "Physics", icon: "📊", color: "bg-surface-100 dark:bg-[#1E293B] text-surface-900 dark:text-white", progress: "60%", progressColor: "bg-[#069494]" },
                ].map((course, idx) => (
                  <div key={idx} className="bg-surface-50 border border-surface-200 rounded-2xl p-5 hover:bg-surface-200 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-8 h-8 ${course.color} rounded-lg flex items-center justify-center text-sm`}>
                        {course.icon}
                      </div>
                      <h4 className="font-bold text-surface-900 dark:text-white leading-none">{course.title}</h4>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-surface-500 dark:text-surface-400 mb-2">{course.progress}</div>
                        <div className="h-1.5 w-full bg-surface-200 dark:bg-[#1E293B] rounded-full overflow-hidden">
                          <div className={`h-full ${course.progressColor} rounded-full`} style={{ width: course.progress }}></div>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full border border-surface-200 dark:border-surface-700 flex items-center justify-center text-surface-400 dark:text-surface-500 group-hover:text-[#069494] group-hover:border-[#069494] transition-colors bg-white dark:bg-[#131B2C]">
                        <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-surface-100 dark:border-[#1E293B] text-xs font-medium text-surface-500">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Today: 23 min
                </div>
                <div>6 active courses · 14 lessons remaining</div>
              </div>
            </div>
          </div>

          <div className={`text-center px-6 max-w-2xl mx-auto flex flex-col items-center transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDissolving ? 'opacity-0 blur-xl scale-95 translate-y-8 delay-[900ms]' : 'opacity-100 blur-0 scale-100 translate-y-0 delay-0'
            }`}>
          </div>
        </section>

        {/* Features */}
        <section id="features" className={`px-6 py-20 md:py-28 max-w-5xl mx-auto transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDissolving ? 'opacity-0 blur-xl scale-95 translate-y-8 delay-[300ms]' : 'opacity-100 blur-0 scale-100 translate-y-0 delay-0'
          }`}>
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-display font-black text-[#069494] mb-3 tracking-tight">
              Why learners love LearnHub
            </h2>
            <p className="text-base font-medium text-surface-600 dark:text-surface-400 max-w-xl mx-auto">
              We combined the best of gamification with serious educational design.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group p-8 rounded-3xl bg-surface-100 shadow-sm border border-surface-200 hover:border-[#069494]/50 hover:-translate-y-1 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#069494]/10 flex items-center justify-center mb-6 group-hover:bg-[#069494]/20 transition-colors">
                  <f.icon className="w-6 h-6 text-[#069494]" />
                </div>
                <h3 className="text-xl font-display font-bold text-surface-900 dark:text-white mb-3">{f.title}</h3>
                <p className="text-sm font-medium text-surface-600 dark:text-surface-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className={`px-6 py-20 bg-surface-50 border-y border-surface-200 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDissolving ? 'opacity-0 blur-xl scale-95 translate-y-8 delay-[300ms]' : 'opacity-100 blur-0 scale-100 translate-y-0 delay-0'
          }`}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-display font-black text-surface-900 dark:text-white mb-3 tracking-tight">
                Start in 3 simple steps
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: "01", title: "Pick a subject", desc: "Choose from science, math, art, coding, and more." },
                { step: "02", title: "Learn & play", desc: "Complete bite-sized lessons and earn XP as you go." },
                { step: "03", title: "Track progress", desc: "Watch your streaks grow and unlock new levels." },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="w-14 h-14 rounded-full bg-[#069494]/10 flex items-center justify-center mx-auto mb-4 border border-[#069494]/20">
                    <span className="text-lg font-display font-black text-[#069494]">{s.step}</span>
                  </div>
                  <h3 className="text-xl font-display font-bold text-surface-900 dark:text-white mb-2">{s.title}</h3>
                  <p className="text-sm font-medium text-surface-600 dark:text-surface-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className={`px-6 py-12 md:py-24 max-w-4xl mx-auto transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDissolving ? 'opacity-0 blur-xl scale-95 translate-y-8 delay-[0ms]' : 'opacity-100 blur-0 scale-100 translate-y-0 delay-0'
          }`}>
          <div className="text-center bg-surface-100 rounded-[2.5rem] shadow-xl dark:shadow-2xl border border-surface-200 p-12 md:p-16 flex flex-col items-center">
            <Trophy className="w-12 h-12 text-[#069494] mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-display font-black text-surface-900 dark:text-white mb-4 tracking-tight">
              Ready to experience the future?
            </h2>
            <p className="text-base font-medium text-surface-600 dark:text-surface-400 mb-10 max-w-md mx-auto">
              Join thousands of learners who are leveling up their skills every day.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
              <button
                onClick={initiateVoidSequence}
                disabled={isDissolving}
                className="bg-[#069494] text-white px-5 py-2.5 rounded-lg font-bold text-base flex items-center justify-center gap-2 hover:bg-[#047c7c] hover:-translate-y-0.5 transition-all shadow-sm order-1 sm:order-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                </svg>
                Try Void Mode
              </button>
              <button
                onClick={() => navigate("/signup")}
                disabled={isDissolving}
                className="bg-white dark:bg-[#1E293B] text-surface-800 dark:text-white border border-surface-200 dark:border-surface-700 px-5 py-2.5 rounded-lg font-bold text-base flex items-center justify-center gap-2 hover:bg-surface-50 dark:hover:bg-[#334155] hover:-translate-y-0.5 transition-all shadow-sm order-2 sm:order-1 disabled:opacity-50 disabled:pointer-events-none"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-5 mt-8 text-xs font-medium text-surface-500">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#069494]" /> No credit card</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#069494]" /> Free forever</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#069494]" /> Fully accessible</span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className={`px-6 py-8 border-t border-surface-200 dark:border-[#1E293B] transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDissolving ? 'opacity-0 blur-xl scale-95 translate-y-8 delay-[0ms]' : 'opacity-100 blur-0 scale-100 translate-y-0 delay-0'
          }`}>
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-display font-bold text-surface-900 dark:text-white text-lg">LearnHub</p>
            <p className="text-xs font-medium text-surface-500 dark:text-surface-600">© 2026 LearnHub. All rights reserved.</p>
          </div>
        </footer>
      </div>

      {/* =========================================
          VOID MODE LAYER (Appears after UI dissolves)
          ========================================= */}
      <div
        className={`fixed inset-0 z-50 bg-surface-50 flex flex-col items-center justify-center transition-opacity duration-1000 ease-in-out ${isVoidMode ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      >
        {/* Soft Blue Outer Glow Effect */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-[2000ms] delay-500"
          style={{
            boxShadow: 'inset 0 0 100px 30px rgba(59, 130, 246, 0.15)', // Blue glow exactly like Lovable shot
            opacity: isVoidMode ? 1 : 0
          }}
        />

        {/* Minimalist Audio Waveform Array */}
        <div className="relative flex items-center justify-center h-48 mb-8">
          {isVoidMode && (
            <div className="flex items-center justify-center gap-1.5 h-16">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-[3px] bg-slate-400 dark:bg-surface-600 rounded-full animate-pulse shadow-sm"
                  style={{
                    height: `${waveformHeights[i]}px`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: '1s'
                  }}
                ></div>
              ))}
            </div>
          )}
        </div>

        {/* Audio Journey Sequence Text */}
        <div className="absolute bottom-24 text-center px-6 max-w-xl w-full">
          <div className="h-24 relative w-full flex items-center justify-center">

            {journeySteps.map((step, idx) => (
              <div
                key={idx}
                className={`absolute w-full transition-all duration-700 ${voidSequenceStep === idx + 1 ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
                  }`}
              >
                <p className="text-xl font-display font-black text-surface-900 mb-3 tracking-tight">
                  "{step.text}"
                </p>
                <p className="text-base font-medium text-surface-500">
                  {step.subtext}
                </p>
              </div>
            ))}

          </div>
        </div>

        {/* Small tracked-out status text */}
        <div
          className={`absolute bottom-8 text-center transition-all duration-[1000ms] transform ease-out px-6 ${voidSequenceStep >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
        >
          <p className="text-[11px] text-surface-400 font-bold uppercase tracking-[0.2em]">
            VOICE-ONLY MODE ACTIVE.
          </p>
        </div>

        {/* Exit mechanism hidden in the top right to escape without breaking aesthetic */}
        <button
          onClick={() => {
            setIsVoidMode(false);
            setIsDissolving(false);
          }}
          className={`absolute top-6 right-6 text-xs font-semibold text-surface-400 hover:text-surface-900 transition-all duration-[1000ms] bg-surface-100 border border-surface-200 px-4 py-2 rounded shadow-sm flex items-center gap-2 ${voidSequenceStep >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
        >
          Exit Void
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

    </div>
  );
}

export default HomePage;