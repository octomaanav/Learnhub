import { useState, useEffect } from 'react';
import { apiUrl } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  fetchCurricula,
  fetchSubjectsWithChapters,
} from '../data/curriculumData';
import { saveLanguagePreference } from '../utils/language';
import { useI18n } from '../components/i18n/useI18n';
import { useLanguage } from '../components/i18n/LanguageProvider';
import type {
  SetupStep,
  SetupStepInfo,
  CurriculumWithGrades,
  GradeEntity,
  SubjectWithChapters,
  ChapterEntity,
} from '../types';

interface SetupData {
  curriculumId: string;
  classId: string;
  chapterIds: string[];
  language: 'en' | 'es' | 'hi';
}

export const UserSetupPage = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, refetch } = useAuth();
  const { t } = useI18n();
  const { setLanguage } = useLanguage();
  const STEPS: SetupStepInfo[] = [
    { id: 'path', title: 'Learning Path', subtitle: 'Choose how you want to learn today.' },
    { id: 'curriculum', title: t('setup.curriculum'), subtitle: t('setup.subtitle') },
    { id: 'grade', title: t('setup.grade'), subtitle: t('setup.subtitle') },
    { id: 'chapters', title: t('setup.chapters'), subtitle: t('setup.subtitle') },
  ];
  const [currentStep, setCurrentStep] = useState<SetupStep>('path');
  const [setupData, setSetupData] = useState<SetupData>({
    curriculumId: '',
    classId: '',
    chapterIds: [],
    language: 'en'
  });
  const [learningPath, setLearningPath] = useState<'standard' | 'knowledge_hub' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data from API
  const [curricula, setCurricula] = useState<CurriculumWithGrades[]>([]);
  const [subjectsWithChapters, setSubjectsWithChapters] = useState<SubjectWithChapters[]>([]);
  const [isLoadingCurricula, setIsLoadingCurricula] = useState(true);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

  // UI state for expanded subjects
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());


  useEffect(() => {
    if (user?.profile?.language) {
      setSetupData(prev => ({
        ...prev,
        language: (user.profile?.language as 'en' | 'es' | 'hi') || 'en'
      }));
    }
    // Only update when auth resolves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch curricula on mount
  useEffect(() => {
    fetchCurricula(setupData.language)
      .then(setCurricula)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoadingCurricula(false));
  }, [setupData.language]);

  // Fetch subjects with chapters when class changes
  useEffect(() => {
    if (setupData.curriculumId && setupData.classId) {
      setIsLoadingSubjects(true);
      fetchSubjectsWithChapters(setupData.curriculumId, setupData.classId, setupData.language)
        .then((data) => {
          setSubjectsWithChapters(data);
          // Auto-expand first subject
          if (data.length > 0) {
            setExpandedSubjects(new Set([data[0].id]));
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setIsLoadingSubjects(false));
    } else {
      setSubjectsWithChapters([]);
    }
  }, [setupData.curriculumId, setupData.classId]);

  // Get current step index
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  // Get selected curriculum and its grades
  const selectedCurriculum = curricula.find(c => c.id === setupData.curriculumId);
  const availableGrades: GradeEntity[] = selectedCurriculum?.grades || [];

  // Check if current step is complete
  const isStepComplete = (step: SetupStep | 'path'): boolean => {
    switch (step) {
      case 'path':
        return learningPath !== null;
      case 'curriculum':
        return setupData.curriculumId !== '';
      case 'grade':
        return setupData.classId !== '';
      case 'chapters':
        return setupData.chapterIds.length > 0;
      default:
        return false;
    }
  };

  // Navigation
  const canGoNext = isStepComplete(currentStep);
  const canGoPrev = currentStepIndex > 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const goToNextStep = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1].id);
    }
  };

  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  };

  const selectLearningPath = (path: 'standard' | 'knowledge_hub') => {
    setLearningPath(path);
    if (path === 'knowledge_hub') {
      const khCurri = curricula.find(c => c.slug === 'knowledge-hub');
      if (khCurri) {
        setSetupData(prev => ({
          ...prev,
          curriculumId: khCurri.id,
          classId: khCurri.grades.find(g => g.slug === 'all-levels')?.id || khCurri.grades[0].id,
          chapterIds: []
        }));
        setCurrentStep('chapters');
      } else {
        // If curricula not loaded yet, just set path and wait
        setLearningPath(path);
      }
    } else {
      goToNextStep();
    }
  };

  const selectCurriculum = (id: string) => {
    setSetupData(prev => ({
      ...prev,
      curriculumId: id,
      classId: '',
      chapterIds: []
    }));
  };

  const selectGrade = (id: string) => {
    setSetupData(prev => ({
      ...prev,
      classId: id,
      chapterIds: []
    }));
  };

  useEffect(() => {
    const handleAgentAction = (e: any) => {
      const { page, action, data } = e.detail;
      if (page !== 'setup') return;

      switch (action) {
        case 'set_learning_path':
          if (data.path) selectLearningPath(data.path);
          break;
        case 'select_curriculum':
          if (data.id) {
            selectCurriculum(data.id);
            setTimeout(() => goToNextStep(), 500);
          } else if (data.name) {
            const found = curricula.find(c => c.name.toLowerCase().includes(data.name.toLowerCase()));
            if (found) {
              selectCurriculum(found.id);
              setTimeout(() => goToNextStep(), 500);
            }
          }
          break;
        case 'select_grade':
          if (data.id) {
            selectGrade(data.id);
            setTimeout(() => goToNextStep(), 500);
          } else if (data.name) {
            const found = availableGrades.find(g => g.name.toLowerCase().includes(data.name.toLowerCase()));
            if (found) {
              selectGrade(found.id);
              setTimeout(() => goToNextStep(), 500);
            }
          }
          break;
        case 'toggle_subject':
          if (data.id) toggleSubjectExpanded(data.id);
          else if (data.name) {
            const found = subjectsWithChapters.find(s => s.name.toLowerCase().includes(data.name.toLowerCase()));
            if (found) toggleSubjectExpanded(found.id);
          }
          break;
        case 'select_chapters':
          if (data.subject_name) {
            const subject = subjectsWithChapters.find(s => s.name.toLowerCase().includes(data.subject_name.toLowerCase()));
            if (subject) toggleAllChaptersInSubject(subject);
          } else if (data.chapter_ids) {
            data.chapter_ids.forEach((id: string) => toggleChapter(id));
          }
          break;
        case 'next_step':
          goToNextStep();
          break;
        case 'submit_setup':
          handleSubmit();
          break;
      }
    };

    window.addEventListener('page-action-triggered', handleAgentAction);
    return () => window.removeEventListener('page-action-triggered', handleAgentAction);
  }, [curricula, availableGrades, subjectsWithChapters, currentStepIndex]);

  const toggleSubjectExpanded = (subjectId: string) => {
    setExpandedSubjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subjectId)) {
        newSet.delete(subjectId);
      } else {
        newSet.add(subjectId);
      }
      return newSet;
    });
  };

  const toggleChapter = (chapterId: string) => {
    setSetupData(prev => ({
      ...prev,
      chapterIds: prev.chapterIds.includes(chapterId)
        ? prev.chapterIds.filter(id => id !== chapterId)
        : [...prev.chapterIds, chapterId]
    }));
  };


  const toggleAllChaptersInSubject = (subject: SubjectWithChapters) => {
    const subjectChapterIds = subject.chapters.map(c => c.id);
    const allSelected = subjectChapterIds.every(id => setupData.chapterIds.includes(id));

    setSetupData(prev => ({
      ...prev,
      chapterIds: allSelected
        ? prev.chapterIds.filter(id => !subjectChapterIds.includes(id))
        : [...new Set([...prev.chapterIds, ...subjectChapterIds])]
    }));
  };

  // Submit
  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(apiUrl('/api/auth/me'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile: {
            curriculumId: setupData.curriculumId,
            classId: setupData.classId,
            chapterIds: setupData.chapterIds,
            language: setupData.language
          },
          curriculumId: setupData.curriculumId,
          classId: setupData.classId
        })
      });

      const data = await response.json();

      if (response.ok && data.user?.isProfileComplete) {
        saveLanguagePreference(setupData.language);
        await refetch();
        navigate('/dashboard');
      } else {
        setError(data.error || 'Failed to save profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get selected chapters grouped by subject for display
  const getSelectedChaptersBySubject = () => {
    const result: { subject: SubjectWithChapters; chapters: ChapterEntity[] }[] = [];
    for (const subject of subjectsWithChapters) {
      const selectedChapters = subject.chapters.filter(c => setupData.chapterIds.includes(c.id));
      if (selectedChapters.length > 0) {
        result.push({ subject, chapters: selectedChapters });
      }
    }
    return result;
  };

  // Count selected chapters per subject
  const getSelectedCountForSubject = (subject: SubjectWithChapters) => {
    return subject.chapters.filter(c => setupData.chapterIds.includes(c.id)).length;
  };

  if (authLoading || isLoadingCurricula) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-surface-600">{t('setup.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center transition-colors">
        <div className="text-center">
          <p className="text-surface-600 mb-4">Please log in first</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-all font-bold shadow-lg shadow-primary-500/20"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface-50 transition-colors overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-surface-100 border-b border-surface-200 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-primary-500/20">
              L
            </div>
            <span className="font-bold text-lg text-surface-900 font-display">LearnHub</span>
          </div>
          <div className="text-sm text-surface-500">
            {t('setup.welcome')}, <span className="font-semibold text-surface-900">{user.name}</span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="shrink-0 bg-surface-100/50 backdrop-blur-sm border-b border-surface-200 px-6 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-1.5">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs transition-all ${index < currentStepIndex
                    ? 'bg-green-500 text-white'
                    : index === currentStepIndex
                      ? 'bg-primary-500 text-white ring-4 ring-primary-500/20'
                      : 'bg-surface-200 text-surface-500'
                    }`}
                >
                  {index < currentStepIndex ? '✓' : index + 1}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-24 h-1 mx-2 rounded ${index < currentStepIndex ? 'bg-green-500' : 'bg-surface-200'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-surface-500">
            {STEPS.map(step => (
              <span key={step.id} className="w-7 text-center">{step.title}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content — fills remaining height, card scrolls internally */}
      <main className="flex-1 min-h-0 flex items-stretch justify-center px-6 py-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
        <div className="w-full max-w-5xl flex flex-col bg-white dark:bg-surface-100 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-surface-200 overflow-hidden">
          {/* Step Header */}
          <div className="shrink-0 bg-linear-to-br from-primary-500 to-primary-600 px-8 py-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[60px]" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black mb-1 font-display tracking-tight">{STEPS[currentStepIndex].title}</h1>
                <p className="text-primary-100 font-bold text-sm opacity-90">{STEPS[currentStepIndex].subtitle}</p>
              </div>
              <div className="hidden sm:flex w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl items-center justify-center text-2xl shadow-inner border border-white/20">
                {currentStep === 'path' ? '🚀' : currentStep === 'curriculum' ? '🏫' : currentStep === 'grade' ? '🎓' : '📚'}
              </div>
            </div>
          </div>

          {/* Step Content — scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="mb-6 rounded-2xl border border-surface-200 bg-surface-50 px-5 py-3 flex flex-wrap gap-4 items-center justify-between shadow-inner">
              <div className="flex items-center gap-3">
                <span className="text-base">🌐</span>
                <div className="text-xs font-black text-surface-900 uppercase tracking-widest">{t('setup.preferences')}</div>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <label className="text-xs font-bold text-surface-400 uppercase tracking-widest">{t('controls.language')}</label>
                <select
                  value={setupData.language}
                  onChange={(event) => {
                    const next = event.target.value as 'en' | 'es' | 'hi';
                    setSetupData(prev => ({ ...prev, language: next }));
                    setLanguage(next);
                    saveLanguagePreference(next);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-surface-200 bg-surface-100 text-sm font-bold text-surface-900 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                >
                  <option value="en">US English 🇺🇸</option>
                  <option value="es">ES Espanol 🇪🇸</option>
                  <option value="hi">IN Hindi 🇮🇳</option>
                </select>
              </div>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-500 font-bold text-sm text-center">{error}</p>
              </div>
            )}

            {/* Step 0: Path Selection */}
            {currentStep === ('path' as SetupStep) && (
              <div className="space-y-3">
                <p className="text-surface-600 mb-4 font-medium text-sm">
                  Select your preferred learning path.
                </p>
                <div className="grid md:grid-cols-2 gap-5">
                  <button
                    onClick={() => selectLearningPath('standard')}
                    className={`p-6 rounded-3xl border-4 text-left transition-all group relative overflow-hidden btn-3d ${learningPath === 'standard'
                      ? 'border-primary-500 bg-primary-50/50 shadow-[0_8px_0_0_rgba(88,204,2,0.3)]'
                      : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50 shadow-[0_8px_0_0_rgba(226,232,240,1)]'
                      }`}
                  >
                    <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform shadow-inner">
                      📖
                    </div>
                    <h3 className="font-black text-xl text-surface-900 mb-2 tracking-tight">School Curriculum</h3>
                    <p className="text-sm text-surface-500 font-bold leading-relaxed">Follow your school board's curriculum (CBSE, ICSE, etc.) and master your academic subjects.</p>
                  </button>

                  <button
                    onClick={() => selectLearningPath('knowledge_hub')}
                    className={`p-6 rounded-3xl border-4 text-left transition-all group relative overflow-hidden btn-3d ${learningPath === 'knowledge_hub'
                      ? 'border-primary-500 bg-primary-50/50 shadow-[0_8px_0_0_rgba(88,204,2,0.3)]'
                      : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50 shadow-[0_8px_0_0_rgba(226,232,240,1)]'
                      }`}
                  >
                    <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform shadow-inner">
                      🌟
                    </div>
                    <h3 className="font-black text-xl text-surface-900 mb-2 tracking-tight">Knowledge Hub</h3>
                    <p className="text-sm text-surface-500 font-bold leading-relaxed">Learn anything you desire. Explore custom courses like Chess, Coding, or generate your own path.</p>
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Curriculum */}
            {currentStep === 'curriculum' && (
              <div className="space-y-4">
                <p className="text-surface-600 mb-6">
                  {t('setup.boardHint')}
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  {curricula.filter(c => c.slug !== 'knowledge-hub').map((curriculum) => {
                    const isAvailable = curriculum.slug === 'cbse';
                    return (
                      <button
                        key={curriculum.id}
                        onClick={() => isAvailable && selectCurriculum(curriculum.id)}
                        disabled={!isAvailable}
                        className={`p-8 rounded-[2rem] border-4 text-left transition-all relative overflow-hidden ${
                          !isAvailable
                            ? 'border-surface-200 bg-surface-50 opacity-60 cursor-not-allowed'
                            : setupData.curriculumId === curriculum.id
                              ? 'border-primary-500 bg-primary-50/50 shadow-[0_8px_0_0_rgba(88,204,2,0.3)] btn-3d'
                              : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50 shadow-[0_8px_0_0_rgba(226,232,240,1)] btn-3d'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-12 h-12 bg-white dark:bg-surface-800 rounded-xl flex items-center justify-center shadow-inner text-xl">
                            🏫
                          </div>
                          {!isAvailable ? (
                            <span className="text-[10px] font-black uppercase tracking-widest bg-surface-200 text-surface-500 px-2 py-1 rounded-full">
                              Coming Soon
                            </span>
                          ) : setupData.curriculumId === curriculum.id && (
                            <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center text-white text-[10px] shadow-lg animate-in zoom-in">
                              ✓
                            </div>
                          )}
                        </div>
                        <h3 className="font-black text-xl text-surface-900 mb-2 tracking-tight">{curriculum.name}</h3>
                        <p className="text-sm text-surface-500 font-bold leading-relaxed">{curriculum.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Grade */}
            {currentStep === 'grade' && (
              <div className="space-y-4">
                <div className="mb-6 p-6 bg-primary-500/10 rounded-2xl border-2 border-primary-500/20 flex items-center gap-4 animate-in slide-in-from-left duration-500">
                  <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <span className="text-sm font-black">#</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest leading-none mb-1">Current Board</p>
                    <span className="font-bold text-surface-900 text-lg">{selectedCurriculum?.name}</span>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  {availableGrades.map((grade) => {
                    const isAvailable = grade.slug === 'class-11';
                    return (
                      <button
                        key={grade.id}
                        onClick={() => isAvailable && selectGrade(grade.id)}
                        disabled={!isAvailable}
                        className={`p-8 rounded-[2rem] border-4 text-left transition-all relative overflow-hidden ${
                          !isAvailable
                            ? 'border-surface-200 bg-surface-50 opacity-60 cursor-not-allowed'
                            : setupData.classId === grade.id
                              ? 'border-primary-500 bg-primary-50/50 shadow-[0_8px_0_0_rgba(88,204,2,0.3)] btn-3d'
                              : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50 shadow-[0_8px_0_0_rgba(226,232,240,1)] btn-3d'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-12 h-12 bg-white dark:bg-surface-800 rounded-xl flex items-center justify-center shadow-inner text-xl">
                            🎓
                          </div>
                          {!isAvailable ? (
                            <span className="text-[10px] font-black uppercase tracking-widest bg-surface-200 text-surface-500 px-2 py-1 rounded-full">
                              Coming Soon
                            </span>
                          ) : setupData.classId === grade.id && (
                            <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center text-white text-[10px] shadow-lg animate-in zoom-in">
                              ✓
                            </div>
                          )}
                        </div>
                        <h3 className="font-black text-xl text-surface-900 mb-1 tracking-tight">{grade.name}</h3>
                        <p className="text-sm text-surface-500 font-bold">{grade.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Chapters (grouped by subject) */}
            {currentStep === 'chapters' && (
              <div className="space-y-4">
                <p className="text-surface-600 mb-6 font-medium">
                  {t('setup.chaptersHint')}
                </p>
                <div className="mb-8 p-6 bg-primary-500/10 rounded-[2rem] border-2 border-primary-500/20 flex flex-wrap items-center gap-6 animate-in slide-in-from-left duration-500">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-lg">B</div>
                    <span className="font-bold text-surface-900">{selectedCurriculum?.name}</span>
                  </div>
                  <div className="hidden sm:block w-px h-6 bg-surface-200" />
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-lg">G</div>
                    <span className="font-bold text-surface-900">
                      {availableGrades.find(g => g.id === setupData.classId)?.name}
                    </span>
                  </div>
                </div>

                {isLoadingSubjects ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto mb-4"></div>
                    <p className="text-surface-500 font-bold uppercase tracking-widest text-xs">{t('setup.loading')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {subjectsWithChapters.map((subject) => {
                      const isExpanded = expandedSubjects.has(subject.id);
                      const selectedCount = getSelectedCountForSubject(subject);
                      const allSelected = selectedCount === subject.chapters.length && subject.chapters.length > 0;

                      return (
                        <div key={subject.id} className="border border-surface-200 rounded-2xl overflow-hidden mb-4">
                          {/* Subject Header */}
                          <div
                            className={`p-6 flex items-center justify-between cursor-pointer transition-all ${selectedCount > 0 ? 'bg-primary-500/[0.03]' : 'bg-surface-50 hover:bg-surface-100'
                              }`}
                            onClick={() => toggleSubjectExpanded(subject.id)}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isExpanded ? 'bg-surface-200 rotate-90' : 'bg-surface-100'}`}>
                                <span className="text-[10px]">▶</span>
                              </div>
                              <div className="flex flex-col">
                                <h3 className="font-black text-surface-900 tracking-tight">{subject.name}</h3>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em]">{subject.chapters.length} chapters</span>
                                  {selectedCount > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                      <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">
                                        {selectedCount} selected
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAllChaptersInSubject(subject);
                              }}
                              className={`px-6 py-2.5 text-[10px] font-black rounded-2xl uppercase tracking-[0.2em] transition-all btn-3d ${allSelected
                                ? 'bg-green-500 text-white shadow-[0_4px_0_0_rgba(34,197,94,0.3)]'
                                : 'bg-surface-200 text-surface-500 hover:bg-surface-300 shadow-[0_4px_0_0_rgba(226,232,240,1)]'
                                }`}
                            >
                              {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>

                          {/* Chapters List */}
                          <div className="p-4 pt-0 grid sm:grid-cols-2 gap-3">
                            {subject.chapters.map((chapter) => (
                              <button
                                key={chapter.id}
                                onClick={() => toggleChapter(chapter.id)}
                                className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${setupData.chapterIds.includes(chapter.id)
                                  ? 'border-green-500 bg-green-500/5 shadow-md'
                                  : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                                  }`}
                              >
                                <div className={`w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center text-xs transition-all ${setupData.chapterIds.includes(chapter.id)
                                  ? 'border-green-500 bg-green-500 text-white shadow-lg shadow-green-500/20'
                                  : 'border-surface-300 pointer-events-none'
                                  }`}>
                                  {setupData.chapterIds.includes(chapter.id) && '✓'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-surface-900 text-sm truncate">{chapter.name}</h4>
                                  <p className="text-xs text-surface-500 line-clamp-1">{chapter.description}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected Summary */}
                {setupData.chapterIds.length > 0 && (
                  <div className="mt-12 p-8 bg-surface-50 rounded-[2.5rem] border-4 border-surface-200 shadow-inner">
                    <p className="text-[10px] font-black text-surface-400 uppercase tracking-[0.3em] mb-6 text-center">
                      Onboarding Summary
                    </p>
                    <div className="space-y-6">
                      {getSelectedChaptersBySubject().map(({ subject, chapters }) => (
                        <div key={subject.id} className="flex flex-col gap-3">
                          <span className="text-[10px] font-black text-surface-400 uppercase tracking-widest">{subject.name}</span>
                          <div className="flex flex-wrap gap-2">
                            {chapters.map(c => (
                              <span key={c.id} className="px-5 py-2 bg-green-500/10 text-green-600 rounded-2xl text-[10px] font-black uppercase tracking-wider border-2 border-green-500/10 shadow-sm animate-in zoom-in">
                                {c.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="shrink-0 px-6 py-4 bg-surface-50 border-t border-surface-200 flex items-center justify-between">
            <button
              onClick={goToPrevStep}
              disabled={!canGoPrev}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all ${canGoPrev
                ? 'text-surface-500 hover:bg-surface-200'
                : 'text-surface-300 cursor-not-allowed'
                }`}
            >
              {t('setup.back')}
            </button>

            {isLastStep ? (
              <button
                onClick={handleSubmit}
                disabled={!canGoNext || isSubmitting}
                className={`px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${canGoNext && !isSubmitting
                  ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/20 active:scale-95'
                  : 'bg-surface-300 text-surface-500 cursor-not-allowed'
                  }`}
              >
                {isSubmitting ? 'Saving...' : 'Finish Setup ✓'}
              </button>
            ) : (
              <button
                onClick={goToNextStep}
                disabled={!canGoNext}
                className={`px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${canGoNext
                  ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/20 active:scale-95'
                  : 'bg-surface-300 text-surface-500 cursor-not-allowed'
                  }`}
              >
                {t('setup.next')}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserSetupPage;
