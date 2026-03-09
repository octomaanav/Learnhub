import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { UserProfile, CurriculumWithGrades, SubjectWithChapters } from '../types';
import { fetchCurricula, fetchSubjectsWithChapters } from '../data/curriculumData';
import { useI18n } from '../components/i18n/useI18n';
import { useLanguage } from '../components/i18n/LanguageProvider';

function Dashboard() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { language } = useLanguage();

  const [selectedSubject, setSelectedSubject] = useState<SubjectWithChapters | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [subjectsWithChapters, setSubjectsWithChapters] = useState<SubjectWithChapters[]>([]);
  const [curricula, setCurricula] = useState<CurriculumWithGrades[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

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
  }, [user, language, selectedSubject]);

  // Get chapters for selected subject
  const chapters = selectedSubject?.chapters || [];

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

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-3xl border-2 border-surface-200 shadow-[0_6px_0_0_var(--color-surface-200)] max-w-md">
          <div className="text-6xl mb-6 transform hover:scale-110 transition-transform cursor-default">👋</div>
          <h2 className="text-3xl font-black font-display text-surface-900 mb-2">{t('dashboard.setupTitle')}</h2>
          <p className="text-surface-600 font-bold text-lg mb-8">{t('dashboard.setupSubtitle')}</p>
          <button
            onClick={() => navigate('/setup')}
            className="btn-3d btn-3d-primary w-full px-6 py-4 bg-primary-500 border-2 border-primary-600 text-white rounded-2xl hover:bg-primary-400 font-bold text-lg"
          >
            {t('dashboard.setupButton')}
          </button>
        </div>
      </div>
    );
  }

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

  // const totalChapters = subjectsWithChapters.reduce((sum, s) => sum + s.chapters.length, 0);

  return (
    <div className="min-h-screen bg-slate-50">
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
                  {getCurriculumName(userProfile.curriculumId)} • {getGradeName(userProfile.classId)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar - Subjects */}
          <aside className="w-72 shrink-0">
            <div className="bg-white rounded-3xl border-2 border-surface-200 shadow-[0_6px_0_0_var(--color-surface-200)] p-4 sticky top-24">
              <h2 className="text-sm font-bold text-surface-500 uppercase tracking-widest mb-4 px-2">
                My Subjects ({subjectsWithChapters.length})
              </h2>

              <nav className="space-y-3">
                {subjectsWithChapters.map(subject => (
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
                <div className="bg-primary-500 border-2 border-primary-600 shadow-[0_4px_0_0_var(--color-primary-600)] rounded-3xl p-8 text-white">
                  <div>
                    <h2 className="text-4xl font-black font-display mb-2">{selectedSubject.name}</h2>
                    <p className="text-primary-100 font-bold text-lg">
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
                        if (selectedSubject && userProfile) {
                          navigate(`/${userProfile.classId}/${selectedSubject.slug}/${chapter.slug}`);
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
  );
}

export default Dashboard;
