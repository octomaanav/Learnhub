import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  BookOpen,
  Settings,
  Plus,
  Rocket,
  Bookmark,
  BarChart3,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  LogOut
} from 'lucide-react';
import type { SubjectWithChapters } from '../types';
import { fetchSubjectsWithChapters, fetchCurriculumBySlug } from '../data/curriculumData';
import { useI18n } from '../components/i18n/useI18n';
import { useLanguage } from '../components/i18n/LanguageProvider';
import { apiUrl } from '../utils/api';

function Dashboard() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { language } = useLanguage();

  const [selectedSubject, setSelectedSubject] = useState<SubjectWithChapters | null>(null);
  const [subjectsWithChapters, setSubjectsWithChapters] = useState<SubjectWithChapters[]>([]);
  const [knowledgeHubSubjects, setKnowledgeHubSubjects] = useState<SubjectWithChapters[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [viewMode, setViewMode] = useState<'curriculum' | 'knowledge_hub'>('curriculum');
  const [activeTab, setActiveTab] = useState<'subjects' | 'progress' | 'bookmarks'>('subjects');

  // Stats and Bookmarks State
  const [progressStats, setProgressStats] = useState<{ completedCount: number, subjectStats?: any[] } | null>(null);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);

  const { toggleTheme, theme, logout } = useAuth();
  const profileRef = useRef<HTMLDivElement>(null);

  // Profile Dropdown State
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Responsive Sidebar State — default open on desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);

  // Telegram Linking State
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);



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

  const activeSubjects = viewMode === 'curriculum'
    ? subjectsWithChapters.filter(s => s.slug !== 'chess') // Basic filter for school subjects
    : knowledgeHubSubjects;

  // Auto-select first subject based on active mode
  useEffect(() => {
    if (activeSubjects.length > 0 && (!selectedSubject || !activeSubjects.find((s: SubjectWithChapters) => s.id === selectedSubject.id))) {
      setSelectedSubject(activeSubjects[0]);
    } else if (activeSubjects.length === 0) {
      setSelectedSubject(null);
    }
  }, [viewMode, activeSubjects]);

  // Fetch Stats/Bookmarks when tab changes, AND on mount for progress rings
  const fetchProgressStats = () => {
    setIsLoadingStats(true);
    fetch(apiUrl('/api/progress/stats'), {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(setProgressStats)
      .catch(console.error)
      .finally(() => setIsLoadingStats(false));
  };

  useEffect(() => {
    fetchProgressStats(); // Fetch once on mount for subject progress rings
  }, []);

  useEffect(() => {
    if (activeTab === 'progress') {
      fetchProgressStats();
    } else if (activeTab === 'bookmarks') {
      setIsLoadingBookmarks(true);
      fetch(apiUrl('/api/bookmarks'), {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(setBookmarks)
        .catch(console.error)
        .finally(() => setIsLoadingBookmarks(false));
    }
  }, [activeTab]);

  // Get chapters for selected subject directly in render
  // const chapters = selectedSubject?.chapters || []; // Removed unused local variable

  // Handle click outside profile dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-surface-700">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center transition-colors">
        <div className="text-center">
          <p className="text-surface-500 mb-4">{t('dashboard.loginPrompt')}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-all shadow-md"
          >
            {t('dashboard.loginButton')}
          </button>
        </div>
      </div>
    );
  }



  // Removed hard block requiring setup so users can preview the dashboard
  // if (!userProfile) { ... }

  // Removed helper functions and moved logic to Navbar or simplified below

  // Telegram Linking functionality
  const generateTelegramCode = async () => {
    setIsGeneratingCode(true);
    try {
      const response = await fetch(apiUrl('/users/telegram-link-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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

  const triggerTelegramModal = () => {
    setIsTelegramModalOpen(true);
    generateTelegramCode();
  };

  return (
    <div className="flex h-screen bg-surface-50 text-surface-900 transition-colors duration-300">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar toggle when closed: arrow on screen edge (all breakpoints) */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className={`fixed top-4 left-2 z-50 p-2 rounded-full bg-surface-100 border border-surface-200 text-surface-600 hover:text-surface-800 hover:bg-surface-200 shadow-sm transition-all focus-mode-hide ${isSidebarOpen ? 'hidden' : ''
          }`}
        aria-label="Open sidebar"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Sidebar — responds to isSidebarOpen on ALL screen sizes */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-surface-100 border-r border-surface-200 flex flex-col z-50 transform transition-transform duration-300 ease-in-out h-full overflow-hidden focus-mode-hide ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="p-6 flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-xl font-black text-surface-900 font-display transition-colors">LearnHub</span>
            </div>
            {/* Sidebar toggle when open: arrow in top-right of sidebar (all screens) */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-full bg-surface-100 border border-surface-200 text-surface-500 hover:text-surface-700 hover:bg-surface-200 shadow-sm"
              aria-label="Close sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
            {/* My Subjects */}
            <div>
              <h2 className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em] mb-4 px-2">
                My Subjects
              </h2>
              <nav className="space-y-1">
                {activeSubjects.map((subject: SubjectWithChapters) => {
                  const subjectProgress = progressStats?.subjectStats?.find((s: any) => s.id === subject.id || s.slug === subject.slug)?.percentage || 0;
                  const radius = 14;
                  const circumference = 2 * Math.PI * radius;
                  const offset = circumference - (subjectProgress / 100) * circumference;

                  return (
                    <button
                      key={subject.id}
                      onClick={() => {
                        setSelectedSubject(subject);
                        if (activeTab !== 'subjects') setActiveTab('subjects');
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${selectedSubject?.id === subject.id
                        ? 'bg-primary-50 dark:bg-primary-900/10 text-primary-600 dark:text-primary-400'
                        : 'text-surface-500 hover:bg-surface-200'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center relative ${selectedSubject?.id === subject.id ? 'bg-primary-500/10' : 'bg-surface-200'
                          }`}>
                          {/* Progress Ring */}
                          <svg className="w-8 h-8 -rotate-90 pointer-events-none absolute inset-0">
                            <circle
                              cx="16"
                              cy="16"
                              r={radius}
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="transparent"
                              className="text-surface-200 opacity-20"
                            />
                            <circle
                              cx="16"
                              cy="16"
                              r={radius}
                              stroke="currentColor"
                              strokeWidth="2.5"
                              fill="transparent"
                              strokeDasharray={circumference}
                              style={{ strokeDashoffset: offset }}
                              strokeLinecap="round"
                              className="text-primary-500 transition-all duration-1000 ease-in-out"
                            />
                          </svg>
                          <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${subjectProgress === 100 ? 'bg-green-500 shadow-lg shadow-green-500/40' : 'bg-primary-500/30'}`} />
                        </div>
                        <span className="text-sm font-bold">{subject.name}</span>
                      </div>
                      <span className="text-[10px] font-black bg-surface-200 px-2 py-0.5 rounded-full text-surface-400">
                        {subject.chapters.length}
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={() => navigate('/setup')}
                  className="w-full flex items-center gap-3 p-3 text-primary-500 font-bold text-sm hover:underline"
                >
                  <Plus className="w-4 h-4" />
                  Add Subject
                </button>
              </nav>
            </div>

            {/* Tools */}
            <div>
              <h2 className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em] mb-4 px-2">
                Tools
              </h2>
              <nav className="space-y-1">
                {[
                  { icon: BarChart3, label: 'Progress', onClick: () => { setActiveTab('progress'); setIsSidebarOpen(false); } },
                  { icon: Bookmark, label: 'Bookmarks', onClick: () => { setActiveTab('bookmarks'); setIsSidebarOpen(false); } },
                  { icon: BookOpen, label: 'My Subjects', onClick: () => { setActiveTab('subjects'); setIsSidebarOpen(false); } },
                  { icon: Rocket, label: 'Telegram', onClick: triggerTelegramModal },
                ].map((tool: any) => (
                  <button
                    key={tool.label}
                    onClick={tool.onClick}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${(tool.label === 'Progress' && activeTab === 'progress') ||
                      (tool.label === 'Bookmarks' && activeTab === 'bookmarks') ||
                      (tool.label === 'My Subjects' && activeTab === 'subjects')
                      ? 'bg-primary-50 dark:bg-primary-900/10 text-primary-600 dark:text-primary-400'
                      : 'text-surface-500 hover:bg-surface-200'
                      }`}
                  >
                    <tool.icon className={`w-5 h-5 ${(tool.label === 'Progress' && activeTab === 'progress') ||
                      (tool.label === 'Bookmarks' && activeTab === 'bookmarks') ||
                      (tool.label === 'My Subjects' && activeTab === 'subjects')
                      ? 'opacity-100'
                      : 'opacity-60'
                      }`} />
                    <span className="text-sm font-bold">{tool.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="mt-auto p-6 space-y-4 border-t border-surface-200 shrink-0 bg-surface-100">

          <div className="relative" ref={profileRef}>
            {isProfileOpen && (
              <div className="absolute bottom-full left-0 mb-4 w-full bg-surface-100 rounded-[1.5rem] shadow-2xl border border-surface-200 py-2 animate-in slide-in-from-bottom-2 duration-200 z-50">
                <button
                  onClick={() => { toggleTheme(); setIsProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-surface-700 hover:bg-surface-200 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-200 flex items-center justify-center">
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </div>
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </button>
                <div className="h-px bg-surface-200 my-1 mx-2"></div>
                <button
                  onClick={async () => { await logout(); navigate('/login'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    <LogOut className="w-4 h-4" />
                  </div>
                  Logout
                </button>
              </div>
            )}

            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={`w-full flex items-center gap-3 rounded-2xl transition-all ${isProfileOpen ? 'bg-surface-200 ring-2 ring-primary-500/20' : 'hover:bg-surface-200'}`}
            >
              <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-600 font-bold shrink-0 shadow-inner">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-surface-900 truncate">{user.name}</p>
                <p className="text-[10px] font-bold text-surface-500 uppercase">Student Profile</p>
              </div>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content — offset by sidebar width when open */}
      <main className={`flex-1 flex flex-col min-w-0 overflow-hidden bg-surface-50 transition-[margin] duration-300 ease-in-out ${isSidebarOpen ? 'ml-72' : 'ml-0'}`}>
        {/* Top Bar */}
        <header className="h-20 bg-surface-100/80 backdrop-blur-sm px-4 sm:px-8 flex items-center justify-between z-10 border-b border-surface-200">
          <div className="flex-1 flex justify-center lg:pl-32">
            <div className="bg-surface-200/80 p-1 rounded-2xl flex gap-1 transform scale-90 sm:scale-100">
              <button
                onClick={() => setViewMode('curriculum')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'curriculum' ? 'bg-surface-100 shadow-sm text-surface-900' : 'text-surface-500'
                  }`}
              >
                School Curriculum
              </button>
              <button
                onClick={() => setViewMode('knowledge_hub')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'knowledge_hub' ? 'bg-surface-100 shadow-sm text-surface-900' : 'text-surface-500'
                  }`}
              >
                Knowledge Hub 🌟
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/pulse')}
              className="px-4 sm:px-5 py-2 sm:py-2.5 bg-primary-500 text-white font-bold rounded-xl shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-all flex items-center gap-2 text-xs sm:text-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden xs:inline">Start Learning</span>
              <span className="xs:hidden">Start</span>
            </button>
            <button
              onClick={() => toggleTheme()}
              className="p-2.5 rounded-full bg-surface-200 text-surface-600 hover:bg-surface-300"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-8 bg-surface-50 transition-colors">
          {activeTab === 'subjects' && selectedSubject ? (
            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary-50 dark:bg-primary-900/10 rounded-2xl sm:rounded-3xl flex items-center justify-center text-primary-500 dark:text-primary-400 border border-primary-100 dark:border-primary-800">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-current rounded-full" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-4xl font-black text-surface-900 mb-1 sm:mb-2">{selectedSubject.name}</h1>
                    <p className="text-surface-500 font-bold text-sm sm:text-base">{selectedSubject.chapters.length} chapters</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/setup')}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-surface-100 border border-surface-200 rounded-2xl text-surface-700 font-bold text-sm hover:bg-surface-200 transition-all shadow-sm w-full sm:w-auto"
                >
                  <Settings className="w-4 h-4" />
                  Edit Chapters
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-2 gap-4 sm:gap-6">
                {selectedSubject.chapters.map((chapter: any, index: number) => (
                  <button
                    key={chapter.id}
                    onClick={() => {
                      const routeClassId = viewMode === 'knowledge_hub' ? 'all-levels' : (user.profile?.classId || 'default');
                      navigate(`/${routeClassId}/${selectedSubject.slug}/${chapter.slug}`);
                    }}
                    className="group bg-surface-100 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-surface-200 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300 text-left relative overflow-hidden"
                  >
                    <div className="flex items-start gap-4 sm:gap-6 relative z-10">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-surface-200 rounded-xl sm:rounded-2xl flex items-center justify-center text-surface-400 text-lg sm:text-xl font-bold group-hover:bg-primary-500 group-hover:text-white transition-colors shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 pr-6">
                        <h3 className="text-lg sm:text-xl font-bold text-surface-900 mb-1 sm:mb-2 group-hover:text-primary-600 transition-colors line-clamp-1">{chapter.name}</h3>
                        <p className="text-surface-500 text-xs sm:text-sm leading-relaxed line-clamp-2">
                          {chapter.description || `Explore the concepts of ${chapter.name} through interactive lessons and visual aids.`}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-surface-300 group-hover:text-primary-500 transition-colors mt-4 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : activeTab === 'progress' ? (
            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-20">
              <div className="w-24 h-24 bg-primary-500/10 rounded-[2rem] flex items-center justify-center text-primary-500 mx-auto mb-8 shadow-inner">
                <BarChart3 className={`w-12 h-12 ${isLoadingStats ? 'animate-pulse' : ''}`} />
              </div>
              <h1 className="text-4xl font-black text-surface-900 mb-4 tracking-tight">Your Learning Journey</h1>

              {isLoadingStats ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <div className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
                  <p className="text-surface-500 font-bold">Calculating your achievements...</p>
                </div>
              ) : (
                <>
                  <p className="text-surface-500 font-bold text-lg mb-12 max-w-lg mx-auto leading-relaxed">
                    You have completed <span className="text-primary-600 dark:text-primary-400">{progressStats?.completedCount || 0} lessons</span> so far. Keep pushing to master your curriculum!
                  </p>

                  <div className="bg-surface-100 border border-surface-200 rounded-[3rem] p-12 shadow-sm max-w-2xl mx-auto">
                    <div className="grid grid-cols-1 gap-12 text-left">
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-end">
                          <span className="text-xs font-black text-surface-400 uppercase tracking-widest">Overall Completion</span>
                          <span className="text-3xl font-black text-surface-900">{progressStats?.completedCount || 0} Units</span>
                        </div>
                        <div className="h-4 bg-surface-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 animate-in slide-in-from-left duration-1000 ease-out"
                            style={{ width: `${Math.min(100, (progressStats?.completedCount || 0) * 5)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : activeTab === 'bookmarks' ? (
            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-12 text-center lg:text-left">
                <h1 className="text-4xl font-black text-surface-900 mb-4 tracking-tight">Saved for Later</h1>
                <p className="text-surface-500 font-bold text-lg">Your curated list of important lessons and concepts.</p>
              </div>

              {isLoadingBookmarks ? (
                <div className="flex flex-col items-center gap-4 py-20 bg-surface-100 rounded-[3rem] border border-surface-200 border-dashed">
                  <div className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
                  <p className="text-surface-500 font-bold">Retrieving your bookmarks...</p>
                </div>
              ) : bookmarks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {bookmarks.map((bookmark) => (
                    <button
                      key={bookmark.id}
                      onClick={() => {
                        if (bookmark.lesson?.chapter) {
                          navigate(`/lesson/${bookmark.lesson.chapter.id}/${bookmark.lesson.chapter.slug}?lesson=${bookmark.lesson.id}`);
                        }
                      }}
                      className="bg-surface-100 border border-surface-200 p-8 rounded-[2.5rem] text-left hover:border-primary-500/50 hover:shadow-2xl transition-all relative overflow-hidden group"
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-500">
                          <Bookmark className="w-5 h-5 fill-current" />
                        </div>
                        <span className="text-[10px] font-black text-surface-400 uppercase tracking-widest">
                          {bookmark.lesson?.chapter?.gradeSubject?.subject?.name || 'Lesson'}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-surface-900 mb-2 leading-tight group-hover:text-primary-600 transition-colors uppercase tracking-tight">
                        {bookmark.lesson.title}
                      </h3>
                      <p className="text-surface-500 font-bold text-sm italic mb-6">
                        From: {bookmark.lesson?.chapter?.name || 'Unknown'}
                      </p>
                      <div className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                        <span className="text-xs font-black text-primary-500 uppercase tracking-widest">Revisit Lesson</span>
                        <ChevronRight className="w-4 h-4 text-primary-500" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-surface-100 rounded-[3rem] border border-surface-200 border-dashed">
                  <Bookmark className="w-16 h-16 text-surface-300 mx-auto mb-6 opacity-50" />
                  <h3 className="text-xl font-bold text-surface-700 mb-2">No bookmarks yet</h3>
                  <p className="text-surface-500 font-bold">Safe lessons while studying to see them here.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-5xl mx-auto py-20 text-center">
              <div className="w-20 h-20 bg-surface-200 rounded-[2rem] flex items-center justify-center text-surface-400 mx-auto mb-6">
                <BookOpen className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-surface-900 mb-2">Select a Subject</h2>
              <p className="text-surface-500 font-bold">Choose a subject from the sidebar to view your selected chapters.</p>
            </div>
          )}
        </div>

      </main>

      {/* Telegram Modal Logic remains functional behind the UI */}
      {isTelegramModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-surface-100 rounded-[2.5rem] shadow-2xl p-10 max-w-md w-full relative border border-surface-200 animate-in zoom-in duration-300">
            <button onClick={() => setIsTelegramModalOpen(false)} className="absolute top-6 right-6 text-surface-400 hover:text-surface-600">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
            <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center text-primary-600 mb-8">
              <Rocket className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-surface-950 mb-4 text-center">Connect Telegram</h2>
            <p className="text-surface-500 font-bold text-center mb-8 leading-relaxed">Learn on the go. Get voice summaries and tips right in your chat.</p>
            <div className="bg-surface-50 p-8 rounded-3xl text-center mb-8 border border-surface-200">
              <p className="text-xs font-bold text-surface-400 uppercase tracking-widest mb-3">Your Code</p>
              <p className="text-5xl font-mono font-black text-primary-500 tracking-[0.2em]">{isGeneratingCode ? '...' : (telegramCode || 'ERROR')}</p>
            </div>
            <button onClick={() => setIsTelegramModalOpen(false)} className="w-full py-4 bg-primary-500 text-white rounded-2xl font-bold text-lg hover:bg-primary-600 transition-all">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
