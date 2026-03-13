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
    <div className="min-h-screen bg-surface-50 transition-colors">
      {/* Header */}
      <header className="bg-surface-100 border-b border-surface-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-500/20">
              L
            </div>
            <span className="font-bold text-xl text-surface-900 font-display">LearnHub</span>
          </div>
          <div className="text-sm text-surface-500">
            {t('setup.welcome')}, <span className="font-semibold text-surface-900">{user.name}</span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-surface-100/50 backdrop-blur-sm border-b border-surface-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${index < currentStepIndex
                    ? 'bg-green-500 text-white'
                    : index === currentStepIndex
                      ? 'bg-primary-500 text-white ring-4 ring-primary-500/20'
                      : 'bg-surface-200 text-surface-500'
                    }`}
                >
                  {index < currentStepIndex ? '✓' : index + 1}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-24 h-1 mx-2 rounded ${index < currentStepIndex ? 'bg-green-500' : 'bg-surface-200'
                    }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-surface-500">
            {STEPS.map(step => (
              <span key={step.id} className="w-8 text-center">{step.title}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-surface-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-surface-200 overflow-hidden">
          {/* Step Header */}
          <div className="bg-primary-500 px-8 py-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl animate-pulse" />
            <h1 className="text-2xl font-black mb-1 font-display relative z-10">{STEPS[currentStepIndex].title}</h1>
            <p className="text-primary-100 font-medium relative z-10">{STEPS[currentStepIndex].subtitle}</p>
          </div>

          {/* Step Content */}
          <div className="p-8">
            <div className="mb-8 rounded-xl border border-surface-200 bg-surface-50 p-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="text-sm font-bold text-surface-900 uppercase tracking-widest">{t('setup.preferences')}</div>
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
                  className="px-4 py-2 rounded-xl border border-surface-200 bg-surface-100 text-sm font-bold text-surface-900 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                >
                  <option value="en">US English 🇺🇸</option>
                  <option value="es">ES Espanol 🇪🇸</option>
                  <option value="hi">IN Hindi 🇮🇳</option>
                </select>
              </div>
            </div>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-500 font-bold text-sm text-center">{error}</p>
              </div>
            )}

            {/* Step 0: Path Selection */}
            {currentStep === ('path' as SetupStep) && (
              <div className="space-y-4">
                <p className="text-surface-600 mb-6 font-medium">
                  Select your preferred learning path.
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  <button
                    onClick={() => selectLearningPath('standard')}
                    className={`p-8 rounded-2xl border-2 text-left transition-all group ${learningPath === 'standard'
                      ? 'border-primary-500 bg-primary-50/30'
                      : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50'
                      }`}
                  >
                    <div className="w-12 h-12 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-600 mb-6 group-hover:scale-110 transition-transform">
                      📖
                    </div>
                    <h3 className="font-bold text-xl text-surface-900 mb-2">School Curriculum</h3>
                    <p className="text-sm text-surface-500 leading-relaxed">Follow your school board's curriculum (CBSE, ICSE, etc.) and master your academic subjects.</p>
                  </button>

                  <button
                    onClick={() => selectLearningPath('knowledge_hub')}
                    className={`p-8 rounded-2xl border-2 text-left transition-all group ${learningPath === 'knowledge_hub'
                      ? 'border-primary-500 bg-primary-50/30'
                      : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50'
                      }`}
                  >
                    <div className="w-12 h-12 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-600 mb-6 group-hover:scale-110 transition-transform">
                      🌟
                    </div>
                    <h3 className="font-bold text-xl text-surface-900 mb-2">Knowledge Hub</h3>
                    <p className="text-sm text-surface-500 leading-relaxed">Learn anything you desire. Explore custom courses like Chess, Coding, or generate your own path.</p>
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
                <div className="grid md:grid-cols-2 gap-4">
                  {curricula.filter(c => c.slug !== 'knowledge-hub').map((curriculum) => (
                    <button
                      key={curriculum.id}
                      onClick={() => selectCurriculum(curriculum.id)}
                      className={`p-6 rounded-xl border-2 text-left transition-all ${setupData.curriculumId === curriculum.id
                        ? 'border-primary-500 bg-primary-50/30'
                        : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50'
                        }`}
                    >
                      <h3 className="font-bold text-lg text-surface-900 mb-2">{curriculum.name}</h3>
                      <p className="text-sm text-surface-500">{curriculum.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Grade */}
            {currentStep === 'grade' && (
              <div className="space-y-4">
                <p className="text-surface-600 mb-6 font-medium">
                  {t('setup.gradeHint')}
                </p>
                {selectedCurriculum && (
                  <div className="mb-4 p-4 bg-primary-500/10 rounded-xl border border-primary-500/20">
                    <span className="font-bold text-primary-600 text-sm">{selectedCurriculum.name}</span>
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-4">
                  {availableGrades.map((grade) => (
                    <button
                      key={grade.id}
                      onClick={() => selectGrade(grade.id)}
                      className={`p-6 rounded-xl border-2 text-left transition-all ${setupData.classId === grade.id
                        ? 'border-primary-500 bg-primary-50/30 shadow-md'
                        : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50'
                        }`}
                    >
                      <h3 className="font-bold text-lg text-surface-900 mb-1">{grade.name}</h3>
                      <p className="text-sm text-surface-500">{grade.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Chapters (grouped by subject) */}
            {currentStep === 'chapters' && (
              <div className="space-y-4">
                <p className="text-surface-600 mb-6 font-medium">
                  {t('setup.chaptersHint')}
                </p>
                <div className="mb-4 p-4 bg-primary-500/10 rounded-xl border border-primary-500/20 flex items-center gap-2">
                  <span className="font-bold text-primary-600 text-sm">{selectedCurriculum?.name}</span>
                  <span className="text-surface-400">•</span>
                  <span className="font-bold text-primary-600 text-sm">
                    {availableGrades.find(g => g.id === setupData.classId)?.name}
                  </span>
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
                            className={`p-5 flex items-center justify-between cursor-pointer transition-all ${selectedCount > 0 ? 'bg-primary-500/5' : 'bg-surface-50 hover:bg-surface-200'
                              }`}
                            onClick={() => toggleSubjectExpanded(subject.id)}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                ▶
                              </span>
                              <div className="flex flex-col">
                                <h3 className="font-bold text-surface-900">{subject.name}</h3>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">{subject.chapters.length} chapters</span>
                                  {selectedCount > 0 && (
                                    <span className="text-[10px] font-black text-green-500 uppercase tracking-wider">
                                      {selectedCount} selected
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAllChaptersInSubject(subject);
                              }}
                              className={`px-4 py-2 text-xs font-black rounded-xl uppercase tracking-widest transition-all ${allSelected
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                                : 'bg-surface-200 text-surface-500 hover:bg-surface-300'
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
                  <div className="mt-8 p-6 bg-surface-50 rounded-2xl border border-surface-200">
                    <p className="text-[10px] font-black text-surface-400 uppercase tracking-[0.2em] mb-4">
                      Selected chapters ({setupData.chapterIds.length})
                    </p>
                    <div className="space-y-4">
                      {getSelectedChaptersBySubject().map(({ subject, chapters }) => (
                        <div key={subject.id} className="flex flex-wrap gap-2 items-center">
                          <span className="text-xs font-black text-surface-600 uppercase tracking-wider">{subject.name}:</span>
                          {chapters.map(c => (
                            <span key={c.id} className="px-3 py-1 bg-green-500/10 text-green-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-green-500/20">
                              {c.name}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="px-8 py-8 bg-surface-50 border-t border-surface-200 flex items-center justify-between">
            <button
              onClick={goToPrevStep}
              disabled={!canGoPrev}
              className={`px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all ${canGoPrev
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
                className={`px-10 py-4 rounded-xl font-black text-sm uppercase tracking-[0.1em] transition-all ${canGoNext && !isSubmitting
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
                className={`px-10 py-4 rounded-xl font-black text-sm uppercase tracking-[0.1em] transition-all ${canGoNext
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
