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
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const { setLanguage } = useLanguage();
  const STEPS: SetupStepInfo[] = [
    { id: 'curriculum', title: t('setup.curriculum'), subtitle: t('setup.subtitle') },
    { id: 'grade', title: t('setup.grade'), subtitle: t('setup.subtitle') },
    { id: 'chapters', title: t('setup.chapters'), subtitle: t('setup.subtitle') },
  ];
  const [currentStep, setCurrentStep] = useState<SetupStep>('curriculum');
  const [setupData, setSetupData] = useState<SetupData>({
    curriculumId: '',
    classId: '',
    chapterIds: [],
    language: 'en'
  });
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
  const isStepComplete = (step: SetupStep): boolean => {
    switch (step) {
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

  // Handlers
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">{t('setup.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Please log in first</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              L
            </div>
            <span className="font-bold text-xl text-slate-800">LearnHub</span>
          </div>
          <div className="text-sm text-slate-600">
            {t('setup.welcome')}, <span className="font-semibold text-slate-800">{user.name}</span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${index < currentStepIndex
                      ? 'bg-green-500 text-white'
                      : index === currentStepIndex
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                >
                  {index < currentStepIndex ? '✓' : index + 1}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-24 h-1 mx-2 rounded ${index < currentStepIndex ? 'bg-green-500' : 'bg-slate-200'
                    }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            {STEPS.map(step => (
              <span key={step.id} className="w-8 text-center">{step.title}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Step Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-white">
            <h1 className="text-2xl font-bold mb-1">{STEPS[currentStepIndex].title}</h1>
            <p className="text-blue-100">{STEPS[currentStepIndex].subtitle}</p>
          </div>

          {/* Step Content */}
          <div className="p-8">
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-700 mb-3">{t('setup.preferences')}</div>
              <div className="flex flex-wrap gap-3 items-center">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t('controls.language')}</label>
                <select
                  value={setupData.language}
                  onChange={(event) => {
                    const next = event.target.value as 'en' | 'es' | 'hi';
                    setSetupData(prev => ({ ...prev, language: next }));
                    setLanguage(next);
                    saveLanguagePreference(next);
                  }}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                >
                  <option value="en">US English 🇺🇸</option>
                  <option value="es">ES Espanol 🇪🇸</option>
                  <option value="hi">IN Hindi 🇮🇳</option>
                </select>
              </div>
            </div>
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Step 1: Curriculum */}
            {currentStep === 'curriculum' && (
              <div className="space-y-4">
                <p className="text-slate-600 mb-6">
                  {t('setup.boardHint')}
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  {curricula.map((curriculum) => (
                    <button
                      key={curriculum.id}
                      onClick={() => selectCurriculum(curriculum.id)}
                      className={`p-6 rounded-xl border-2 text-left transition-all ${setupData.curriculumId === curriculum.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                        }`}
                    >
                      <h3 className="font-bold text-lg text-slate-900 mb-2">{curriculum.name}</h3>
                      <p className="text-sm text-slate-600">{curriculum.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Grade */}
            {currentStep === 'grade' && (
              <div className="space-y-4">
                <p className="text-slate-600 mb-6">
                  {t('setup.gradeHint')}
                </p>
                {selectedCurriculum && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <span className="font-medium text-blue-800">{selectedCurriculum.name}</span>
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-4">
                  {availableGrades.map((grade) => (
                    <button
                      key={grade.id}
                      onClick={() => selectGrade(grade.id)}
                      className={`p-6 rounded-xl border-2 text-left transition-all ${setupData.classId === grade.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                        }`}
                    >
                      <h3 className="font-bold text-lg text-slate-900 mb-1">{grade.name}</h3>
                      <p className="text-sm text-slate-600">{grade.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Chapters (grouped by subject) */}
            {currentStep === 'chapters' && (
              <div className="space-y-4">
                <p className="text-slate-600 mb-6">
                  {t('setup.chaptersHint')}
                </p>
                <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
                  <span className="font-medium text-blue-800">{selectedCurriculum?.name}</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-medium text-blue-800">
                    {availableGrades.find(g => g.id === setupData.classId)?.name}
                  </span>
                </div>

                {isLoadingSubjects ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-slate-500">{t('setup.loading')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {subjectsWithChapters.map((subject) => {
                      const isExpanded = expandedSubjects.has(subject.id);
                      const selectedCount = getSelectedCountForSubject(subject);
                      const allSelected = selectedCount === subject.chapters.length && subject.chapters.length > 0;

                      return (
                        <div key={subject.id} className="border-2 border-slate-200 rounded-xl overflow-hidden">
                          {/* Subject Header */}
                          <div
                            className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${selectedCount > 0 ? 'bg-green-50' : 'bg-slate-50 hover:bg-slate-100'
                              }`}
                            onClick={() => toggleSubjectExpanded(subject.id)}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                ▶
                              </span>
                              <div>
                                <h3 className="font-bold text-slate-900">{subject.name}</h3>
                                <p className="text-xs text-slate-500">
                                  {subject.chapters.length} chapters
                                  {selectedCount > 0 && (
                                    <span className="text-green-600 ml-2">
                                      ({selectedCount} selected)
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAllChaptersInSubject(subject);
                              }}
                              className={`px-3 py-1 text-sm rounded-lg transition-colors ${allSelected
                                  ? 'bg-green-500 text-white'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                            >
                              {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>

                          {/* Chapters List */}
                          {isExpanded && (
                            <div className="p-4 pt-0 grid gap-2">
                              {subject.chapters.map((chapter) => (
                                <button
                                  key={chapter.id}
                                  onClick={() => toggleChapter(chapter.id)}
                                  className={`p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${setupData.chapterIds.includes(chapter.id)
                                      ? 'border-green-500 bg-green-50'
                                      : 'border-slate-200 hover:border-green-300 hover:bg-slate-50'
                                    }`}
                                >
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${setupData.chapterIds.includes(chapter.id)
                                      ? 'border-green-500 bg-green-500 text-white'
                                      : 'border-slate-300'
                                    }`}>
                                    {setupData.chapterIds.includes(chapter.id) && '✓'}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium text-slate-900 text-sm">{chapter.name}</h4>
                                    <p className="text-xs text-slate-500">{chapter.description}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected Summary */}
                {setupData.chapterIds.length > 0 && (
                  <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-700 mb-3">
                      Selected chapters ({setupData.chapterIds.length}):
                    </p>
                    <div className="space-y-2">
                      {getSelectedChaptersBySubject().map(({ subject, chapters }) => (
                        <div key={subject.id} className="flex flex-wrap gap-2 items-center">
                          <span className="text-sm font-semibold text-slate-600">{subject.name}:</span>
                          {chapters.map(c => (
                            <span key={c.id} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
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
          <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={goToPrevStep}
              disabled={!canGoPrev}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${canGoPrev
                  ? 'text-slate-700 hover:bg-slate-200'
                  : 'text-slate-400 cursor-not-allowed'
                }`}
            >
              {t('setup.back')}
            </button>

            {isLastStep ? (
              <button
                onClick={handleSubmit}
                disabled={!canGoNext || isSubmitting}
                className={`px-8 py-3 rounded-lg font-semibold transition-all ${canGoNext && !isSubmitting
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
              >
                {isSubmitting ? t('setup.loading') : `${t('setup.finish')} ✓`}
              </button>
            ) : (
              <button
                onClick={goToNextStep}
                disabled={!canGoNext}
                className={`px-8 py-3 rounded-lg font-semibold transition-all ${canGoNext
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-lg'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
              >
                {t('setup.next')} →
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserSetupPage;
