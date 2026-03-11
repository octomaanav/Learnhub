import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { CurriculumWithGrades, SubjectWithChapters } from '../types';
import { fetchCurricula, fetchSubjectsWithChapters, fetchCurriculumBySlug } from '../data/curriculumData';
import { useI18n } from '../components/i18n/useI18n';
import { useLanguage } from '../components/i18n/LanguageProvider';
import { useVoiceAgent } from '../components/VoiceAgentProvider';
import { apiUrl } from '../utils/api';

function Dashboard() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { language } = useLanguage();

  const [selectedSubject, setSelectedSubject] = useState<SubjectWithChapters | null>(null);
  const [subjectsWithChapters, setSubjectsWithChapters] = useState<SubjectWithChapters[]>([]);
  const [knowledgeHubSubjects, setKnowledgeHubSubjects] = useState<SubjectWithChapters[]>([]);
  const [curricula, setCurricula] = useState<CurriculumWithGrades[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isZenMode, setIsZenMode] = useState(false);
  const [viewMode, setViewMode] = useState<'curriculum' | 'knowledge_hub'>('curriculum');
  const [visualState, setVisualState] = useState<{ description: string, type: string, mermaidCode?: string } | null>(null);

  const { startListening, stopListening, setAgentMode } = useVoiceAgent();

  // Telegram Linking State
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  // Fetch curricula on mount
  useEffect(() => {
    fetchCurricula(language)
      .then(setCurricula)
      .catch(console.error);
  }, [language]);

  // Extract user profile and fetch subjects with chapters
  useEffect(() => {
    if (user && user.profile) {
      if (user.profile.curriculumId && user.profile.classId) {
        setIsLoadingData(true);
        fetchSubjectsWithChapters(user.profile.curriculumId, user.profile.classId, language)
          .then((allSubjects) => {
            // Filter chapters to only user's selected chapters
            const filteredSubjects = allSubjects
              .map(subject => ({
                ...subject,
                chapters: subject.chapters.filter(c =>
                  user.profile?.chapterIds.includes(c.id)
                )
              }))
              .filter(subject => subject.chapters.length > 0);

            setSubjectsWithChapters(filteredSubjects);
            // Auto-select first subject
            if (filteredSubjects.length > 0 && !selectedSubject) {
              setSelectedSubject(filteredSubjects[0]);
            }
          })
          .catch(console.error)
          .finally(() => setIsLoadingData(false));
      } else {
        setIsLoadingData(false);
      }
    } else {
      setIsLoadingData(false);
    }
  }, [user, language]);

  // Fetch Knowledge Hub data
  useEffect(() => {
    fetchCurriculumBySlug('knowledge-hub', language)
      .then(khCurriculum => {
        if (khCurriculum && khCurriculum.grades.length > 0) {
          const allLevelsId = khCurriculum.grades.find(g => g.slug === 'all-levels')?.id || khCurriculum.grades[0].id;
          return fetchSubjectsWithChapters(khCurriculum.id, allLevelsId, language);
        }
        return [];
      })
      .then(setKnowledgeHubSubjects)
      .catch(console.error);
  }, [language]);

  const activeSubjects = viewMode === 'curriculum' ? subjectsWithChapters : knowledgeHubSubjects;

  // Auto-select first subject based on active mode
  useEffect(() => {
    if (activeSubjects.length > 0 && (!selectedSubject || !activeSubjects.find(s => s.id === selectedSubject.id))) {
      setSelectedSubject(activeSubjects[0]);
    } else if (activeSubjects.length === 0) {
      setSelectedSubject(null);
    }
  }, [viewMode, activeSubjects]);

  // Get chapters for selected subject
  const chapters = selectedSubject?.chapters || [];

  // Listen for visual canvas updates from VoiceAgentProvider
  useEffect(() => {
    const handleVisualUpdate = (e: any) => {
      setVisualState(e.detail);
    };
    window.addEventListener('visual-canvas-update', handleVisualUpdate);
    return () => window.removeEventListener('visual-canvas-update', handleVisualUpdate);
  }, []);

  // Trigger voice agent on Zen Mode toggle
  useEffect(() => {
    if (isZenMode) {
      setAgentMode('zen');
      // Small delay so the config updates before we connect
      const timer = setTimeout(() => startListening(), 200);
      return () => clearTimeout(timer);
    } else {
      stopListening();
      setAgentMode('normal');
    }
  }, [isZenMode, startListening, stopListening, setAgentMode]);

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">{t('dashboard.loginPrompt')}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('dashboard.loginButton')}
          </button>
        </div>
      </div>
    );
  }



  // Removed hard block requiring setup so users can preview the dashboard
  // if (!userProfile) { ... }

  const getCurriculumName = (id: string) => {
    const curriculum = curricula.find(c => c.id === id);
    return curriculum?.name || id;
  };

  const getGradeName = (id: string) => {
    for (const curriculum of curricula) {
      const grade = curriculum.grades.find(g => g.id === id);
      if (grade) return grade.name;
    }
    return id;
  };

  const generateTelegramCode = async () => {
    setIsGeneratingCode(true);
    try {
      const { apiUrl } = await import('../utils/api');
      const response = await fetch(apiUrl('/users/telegram-link-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ userId: (user as any).id })
      });
      if (response.ok) {
        const data = await response.json();
        setTelegramCode(data.code);
      }
    } catch (e) {
      console.error("Failed to generate code", e);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden">
      <div className={`transition-all duration-1000 ease-in-out ${isZenMode ? 'blur-xl opacity-0 scale-95 -translate-y-4 pointer-events-none' : 'blur-none opacity-100 scale-100 translate-y-0'}`}>
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-500 border-2 border-primary-600 rounded-2xl flex items-center justify-center shadow-[0_4px_0_0_var(--color-primary-600)] transform -rotate-3 hover:rotate-0 transition-transform">
                  <span className="text-white text-xl font-bold font-display">L</span>
                </div>
                <div>
                  <h1 className="font-black text-2xl font-display text-surface-800">{t('app.name')}</h1>
                  <p className="text-xs font-bold text-surface-500 uppercase tracking-widest">
                    {user.profile ? `${getCurriculumName(user.profile.curriculumId)} • ${getGradeName(user.profile.classId)}` : 'Profile Incomplete'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsZenMode(!isZenMode)}
                  className={`p-3 rounded-xl border-2 transition-all font-bold font-display ${isZenMode ? 'bg-secondary-500 text-white border-secondary-600 shadow-sm transform -translate-y-0.5' : 'bg-surface-100 text-surface-600 border-surface-200 hover:bg-surface-200 hover:border-surface-300'}`}
                  title="Toggle Zen Mode"
                >
                  {isZenMode ? 'Exit Zen Mode' : 'Zen Mode 🧘‍♂️'}
                </button>
                <button
                  onClick={() => {
                    setIsTelegramModalOpen(true);
                    if (!telegramCode) generateTelegramCode();
                  }}
                  className="px-4 py-2 bg-[#069494]/10 text-[#069494] font-bold rounded-xl hover:bg-[#069494]/20 transition-colors hidden sm:flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" /></svg>
                  Connect Telegram
                </button>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-semibold text-sm">
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-medium text-slate-700">{user.name}</span>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Zen Mode Overlay */}
      <div
        className={`fixed inset-0 bg-white/95 backdrop-blur-sm z-50 transition-all duration-1000 ease-in-out overflow-y-auto ${isZenMode ? 'opacity-100 pointer-events-auto delay-300' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="min-h-full w-full flex flex-col items-center justify-center py-12">
          {isZenMode && (
            <div className="text-center w-full max-w-4xl px-8 flex flex-col items-center justify-center">
              {/* AI Listening Waveform Animation */}
              <div className="flex items-center justify-center gap-2 mb-12 h-24">
                <style>
                  {`
                  @keyframes waveform {
                    0% { transform: scaleY(0.3); opacity: 0.5; }
                    100% { transform: scaleY(1); opacity: 1; }
                  }
                  .wave-bar {
                    animation: waveform 0.8s ease-in-out infinite alternate;
                    transform-origin: bottom;
                  }
                `}
                </style>
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div
                    key={i}
                    className="w-4 bg-gradient-to-t from-secondary-400 to-tertiary-500 rounded-full wave-bar shadow-lg shadow-secondary-400/30"
                    style={{
                      height: '100%',
                      animationDelay: `${i * 0.15}s`,
                      animationDuration: `${0.6 + (i % 3) * 0.1}s`
                    }}
                  ></div>
                ))}
              </div>

              <h2 className="text-5xl font-black font-display text-surface-800 tracking-tight mb-4">
                I'm listening.
              </h2>
              <p className="text-xl font-bold text-surface-500 max-w-2xl text-center mb-16">
                Speak naturally. Ask to learn anything, explore the curriculum, or just say hello.
              </p>

              {/* This is the placeholder where visual elements (images/videos) generated by the agent will be injected */}
              <div className="w-full max-w-4xl min-h-[400px] bg-surface-100 rounded-3xl border-4 border-dashed border-surface-300 flex items-center justify-center relative overflow-hidden transition-all duration-500 group hover:border-secondary-300 backdrop-blur-sm shadow-2xl p-4">
                {visualState ? (
                  visualState.type === 'image_prompt' ? (
                    <img
                      src={apiUrl(`/api/story/diagram?q=${encodeURIComponent(visualState.description)}`)}
                      alt={visualState.description}
                      className="max-w-full max-h-[400px] object-contain animate-fade-in mix-blend-multiply"
                    />
                  ) : (
                    <div className="p-8 text-left bg-white/90 w-full h-full overflow-auto text-sm text-surface-700 font-mono animate-fade-in shadow-inner rounded-2xl">
                      <pre className="whitespace-pre-wrap">{visualState.mermaidCode || visualState.description}</pre>
                    </div>
                  )
                ) : (
                  <p className="text-surface-400 font-bold tracking-widest uppercase text-sm group-hover:text-secondary-400 transition-colors">Visual Canvas</p>
                )}
              </div>

              <button
                onClick={() => setIsZenMode(false)}
                className="mt-12 px-8 py-4 bg-surface-200 hover:bg-surface-300 text-surface-700 font-bold rounded-2xl transition-all"
              >
                Exit Zen Mode
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`transition-all duration-1000 ease-in-out origin-top ${isZenMode ? 'blur-xl opacity-0 scale-95 -translate-y-8' : 'blur-none opacity-100 scale-100 translate-y-0'}`}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Mode Toggle */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-8">
            <div className="flex bg-surface-200 p-1.5 rounded-2xl">
              <button
                onClick={() => setViewMode('curriculum')}
                className={`px-8 py-3 rounded-xl font-bold font-display transition-all ${viewMode === 'curriculum' ? 'bg-white text-primary-600 shadow-sm transform -translate-y-0.5' : 'text-surface-600 hover:text-surface-800'}`}
              >
                School Curriculum
              </button>
              <button
                onClick={() => setViewMode('knowledge_hub')}
                className={`px-8 py-3 rounded-xl font-bold font-display transition-all ${viewMode === 'knowledge_hub' ? 'bg-secondary-500 text-white shadow-sm transform -translate-y-0.5' : 'text-surface-600 hover:text-surface-800'}`}
              >
                Knowledge Hub (Learn Anything) 🌟
              </button>
            </div>

            {viewMode === 'knowledge_hub' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search anything... e.g. Quantum Physics"
                  className="px-4 py-3 rounded-xl border-2 border-surface-200 focus:border-secondary-500 bg-white shadow-sm font-medium w-full sm:w-72"
                />
                <button className="px-5 py-3 bg-secondary-500 text-white font-bold rounded-xl shadow-sm hover:bg-secondary-600 transform hover:-translate-y-0.5 transition-all">Go</button>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar - Subjects */}
            <aside className="w-72 shrink-0">
              <div className="bg-white rounded-3xl border-2 border-surface-200 shadow-[0_6px_0_0_var(--color-surface-200)] p-4 sticky top-24">
                <h2 className="text-sm font-bold text-surface-500 uppercase tracking-widest mb-4 px-2">
                  {viewMode === 'curriculum' ? 'My Subjects' : 'Featured Topics'} ({activeSubjects.length})
                </h2>

                <nav className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                  {activeSubjects.map(subject => (
                    <button
                      key={subject.id}
                      onClick={() => {
                        setSelectedSubject(subject);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${selectedSubject?.id === subject.id
                        ? 'bg-secondary-100 text-secondary-700 border-secondary-400 shadow-[0_4px_0_0_var(--color-secondary-400)] font-bold active:translate-y-1 active:shadow-none'
                        : 'text-surface-700 border-surface-200 hover:bg-surface-50 font-bold hover:border-surface-300'
                        }`}
                    >
                      <span>{subject.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${selectedSubject?.id === subject.id ? 'bg-secondary-200' : 'bg-surface-100'}`}>
                        {subject.chapters.length}
                      </span>
                    </button>
                  ))}
                </nav>

                <div className="mt-6 pt-4 border-t-2 border-surface-200">
                  <button
                    onClick={() => navigate('/setup')}
                    className="w-full p-3 text-sm font-bold text-surface-600 border-2 border-transparent hover:border-surface-200 hover:bg-surface-50 rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    <span className="text-lg">+</span> Edit Chapters
                  </button>
                  <button
                    onClick={() => navigate('/accessibility-guide')}
                    className="w-full mt-2 p-3 text-sm font-bold text-surface-600 border-2 border-transparent hover:border-surface-200 hover:bg-surface-50 rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    {t('dashboard.learningGuide')}
                  </button>
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0">
              {selectedSubject ? (
                <div className="space-y-6">
                  {/* Subject Header */}
                  <div className={`border-2 shadow-[0_4px_0_0_currentColor] rounded-3xl p-8 text-white ${viewMode === 'curriculum' ? 'bg-primary-500 border-primary-600 text-primary-600' : 'bg-secondary-500 border-secondary-600 text-secondary-600'}`}>
                    <div className="text-white">
                      <h2 className="text-4xl font-black font-display mb-2">{selectedSubject.name}</h2>
                      <p className={`font-bold text-lg ${viewMode === 'curriculum' ? 'text-primary-100' : 'text-secondary-100'}`}>
                        {selectedSubject.chapters.length} {t('dashboard.chaptersSelected')}
                      </p>
                    </div>
                  </div>

                  {/* Chapters Grid */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {chapters.map((chapter, index) => (
                      <button
                        key={chapter.id}
                        onClick={() => {
                          if (selectedSubject) {
                            const routeClassId = viewMode === 'knowledge_hub' ? 'all-levels' : (user.profile?.classId || 'default');
                            navigate(`/${routeClassId}/${selectedSubject.slug}/${chapter.slug}`);
                          }
                        }}
                        className="p-6 bg-white rounded-3xl border-2 border-surface-200 shadow-[0_6px_0_0_var(--color-surface-200)] text-left transition-transform hover:-translate-y-1 active:translate-y-1 active:shadow-none"
                      >
                        <div className="flex items-start gap-5">
                          <div className="w-14 h-14 bg-surface-100 border-2 border-surface-200 rounded-2xl flex items-center justify-center text-surface-600 font-black font-display text-xl shrink-0 space-x-0 tracking-tighter shadow-sm transform rotate-3">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold font-display text-surface-800 mb-2">{chapter.name}</h3>
                            <p className="text-sm font-bold text-surface-500 line-clamp-2 leading-relaxed">{chapter.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="text-sm text-slate-500">
                    {t('dashboard.selectChapter')}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <div className="text-5xl mb-4">👈</div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{t('dashboard.selectSubject')}</h3>
                  <p className="text-slate-600">
                    {t('dashboard.selectSubjectHint')}
                  </p>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      {/* Telegram Link Modal */}
      {isTelegramModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl shadow-xl border border-surface-200 max-w-md w-full p-8 relative overflow-hidden">
            <button
              onClick={() => setIsTelegramModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-100 hover:bg-surface-200 text-surface-500"
            >
              x
            </button>

            <div className="w-16 h-16 bg-[#069494]/10 text-[#069494] rounded-2xl flex items-center justify-center mb-6 shadow-inner mx-auto">
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" /></svg>
            </div>

            <h2 className="text-2xl font-black font-display text-center text-surface-900 mb-2">
              Connect LearnHub
            </h2>
            <p className="text-center text-surface-600 font-medium mb-8">
              Learn everywhere. Get lessons, ask questions, and take quizzes via voice note right in Telegram.
            </p>

            <div className="bg-surface-50 border-2 border-surface-200 rounded-2xl p-6 text-center mb-8">
              <p className="text-xs font-bold text-surface-500 tracking-wider uppercase mb-3 text-center">Your Linking Code</p>
              {isGeneratingCode ? (
                <div className="text-3xl font-black text-surface-400 font-mono tracking-[0.2em] animate-pulse">
                  •• •• ••
                </div>
              ) : (
                <div className="text-4xl font-black text-[#069494] font-mono tracking-[0.2em] selection:bg-[#069494]/20">
                  {telegramCode || "ERROR"}
                </div>
              )}
            </div>

            <ol className="space-y-4 mb-8 text-sm font-medium text-surface-700">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#069494] text-white flex items-center justify-center font-bold shrink-0">1</span>
                <span>Open the <a href="https://t.me/LearnHub010_Bot" target="_blank" rel="noreferrer" className="text-[#069494] font-bold hover:underline">@LearnHub010_Bot</a> on Telegram.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#069494] text-white flex items-center justify-center font-bold shrink-0">2</span>
                <span>Send the 6-character code above to the bot.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#069494] text-white flex items-center justify-center font-bold shrink-0">3</span>
                <span>Your account is instantly linked! Send a voice note to test it.</span>
              </li>
            </ol>

            <button
              onClick={() => setIsTelegramModalOpen(false)}
              className="w-full px-5 py-3.5 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-xl transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
