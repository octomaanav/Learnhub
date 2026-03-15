import { useState, useEffect } from 'react';
import { apiUrl } from '../utils/api';
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/api";
import { useAuth } from '../hooks/useAuth';
import type { StructuredChapter, StructuredSection, Microsection, MicrosectionType, ArticleMicrosection } from '../types';
import { extractArticleRawText } from '../utils/textExtractor';
import { useI18n } from '../components/i18n/useI18n';
import { useLanguage } from '../components/i18n/LanguageProvider';

// Icon components for different microsection types
const ArticleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const VideoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const QuizIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const PracticeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const getMicrosectionIcon = (type: MicrosectionType) => {
  switch (type) {
    case 'article': return <ArticleIcon />;
    case 'video': return <VideoIcon />;
    case 'quiz': return <QuizIcon />;
    case 'practice': return <PracticeIcon />;
    default: return <ArticleIcon />;
  }
};

const getMicrosectionColor = (type: MicrosectionType) => {
  switch (type) {
    case 'article': return {
      bg: 'bg-primary-50/50 dark:bg-primary-900/10',
      border: 'border-primary-100 dark:border-primary-800',
      icon: 'text-primary-600 dark:text-primary-400',
      hover: 'hover:bg-primary-100/50 dark:hover:bg-primary-900/20'
    };
    case 'video': return {
      bg: 'bg-purple-50/50 dark:bg-purple-900/10',
      border: 'border-purple-100 dark:border-purple-800',
      icon: 'text-purple-600 dark:text-purple-400',
      hover: 'hover:bg-purple-100/50 dark:hover:bg-purple-900/20'
    };
    case 'quiz': return {
      bg: 'bg-green-50/50 dark:bg-green-900/10',
      border: 'border-green-100 dark:border-green-800',
      icon: 'text-green-600 dark:text-green-400',
      hover: 'hover:bg-green-100/50 dark:hover:bg-green-900/20'
    };
    case 'practice': return {
      bg: 'bg-amber-50/50 dark:bg-amber-900/10',
      border: 'border-amber-100 dark:border-amber-800',
      icon: 'text-amber-600 dark:text-amber-400',
      hover: 'hover:bg-amber-100/50 dark:hover:bg-amber-900/20'
    };
    default: return {
      bg: 'bg-surface-50 dark:bg-surface-100/10',
      border: 'border-surface-200 dark:border-surface-800',
      icon: 'text-surface-600 dark:text-surface-400',
      hover: 'hover:bg-surface-200/50 dark:hover:bg-surface-100/20'
    };
  }
};

export function ChapterPage() {
  const navigate = useNavigate();
  const { classId, subjectId, chapterSlug } = useParams<{
    classId: string;
    subjectId: string;
    chapterSlug: string;
  }>();
  const { t } = useI18n();
  const { language } = useLanguage();

  const getMicrosectionLabel = (type: MicrosectionType) => {
    switch (type) {
      case 'article': return t('micro.type.article');
      case 'video': return t('micro.type.story');
      case 'quiz': return t('micro.type.quiz');
      case 'practice': return t('micro.type.practice');
      default: return t('micro.type.article');
    }
  };

  useAuth(); // Ensure user is authenticated
  const [chapter, setChapter] = useState<StructuredChapter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isBrailleOpen, setIsBrailleOpen] = useState(false);
  const [isBrailleLoading, setIsBrailleLoading] = useState(false);
  const [brailleError, setBrailleError] = useState<string | null>(null);
  const [brailleResult, setBrailleResult] = useState<{ brf?: string; fullBraille?: string } | null>(null);

  useEffect(() => {
    const fetchChapterData = async () => {
      if (!classId || !subjectId || !chapterSlug) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch the structured curriculum JSON data
        const response = await fetch(
          apiUrl(`/api/lessons/structured/${classId}/${subjectId}/${chapterSlug}?lang=${language}`)
        );

        if (!response.ok) throw new Error('Failed to fetch chapter data');

        const chapterData: StructuredChapter = await response.json();
        setChapter(chapterData);

        // Auto-expand first section
        if (chapterData.sections.length > 0) {
          setExpandedSections(new Set([chapterData.sections[0].id]));
        }

      } catch (err) {
        console.error('Error fetching chapter data:', err);
        setError(err instanceof Error ? err.message : t('chapter.error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchChapterData();
  }, [classId, subjectId, chapterSlug, language]);

  useEffect(() => {
    const handleBrailleOpen = () => {
      openBrailleGuide();
    };

    window.addEventListener('braille-open', handleBrailleOpen as EventListener);
    return () => {
      window.removeEventListener('braille-open', handleBrailleOpen as EventListener);
    };
  }, [chapter]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleMicrosectionClick = (section: StructuredSection, microsection: Microsection) => {
    navigate(`/${classId}/${subjectId}/${chapterSlug}/${section.slug}/${microsection.id}`);
  };

  const openBrailleGuide = async () => {
    if (!chapter) return;
    setIsBrailleOpen(true);
    setIsBrailleLoading(true);
    setBrailleError(null);

    try {
      const articleTexts = chapter.sections.flatMap((section) =>
        section.microsections
          .filter((micro) => micro.type === 'article')
          .map((micro) => extractArticleRawText((micro as ArticleMicrosection).content))
      );

      const combinedText = articleTexts.join('\n\n');
      if (!combinedText.trim()) {
        throw new Error('No article content available for braille conversion.');
      }

      const response = await fetch(`${API_BASE}/api/braille/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson: combinedText })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate braille');
      }

      const brailleData = await response.json();
      setBrailleResult({ brf: brailleData.brf, fullBraille: brailleData.fullBraille });
    } catch (err) {
      setBrailleError(err instanceof Error ? err.message : 'Failed to generate braille');
    } finally {
      setIsBrailleLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-surface-600 font-bold">{t('chapter.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-bold mb-4">{error || 'Chapter not found'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-primary-500 text-white rounded-xl shadow-lg hover:bg-primary-600 transition-all font-bold"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const sections = [...chapter.sections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-surface-100/80 backdrop-blur-sm border-b border-surface-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-surface-200 rounded-lg transition-colors text-surface-600"
              aria-label="Back to dashboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <p className="text-[10px] font-black text-surface-500 uppercase tracking-widest mb-0.5">
                {subjectId?.replace(/-/g, ' ')}
              </p>
              <h1 className="font-black text-lg text-surface-900 uppercase tracking-tight">{chapter.chapterTitle}</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8 focus-mode-surface">
        {/* Chapter Description */}
        <div className="bg-gradient-to-r from-primary-600 to-indigo-700 rounded-[2.5rem] p-8 mb-8 text-white shadow-xl shadow-primary-500/20">
          <h2 className="text-3xl font-black mb-3 tracking-tight">{chapter.chapterTitle}</h2>
          <p className="text-primary-100 font-bold leading-relaxed">{chapter.chapterDescription}</p>
          <div className="mt-6 flex items-center gap-4 text-xs font-black uppercase tracking-widest">
            <span className="bg-white/10 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full">
              {sections.length} sections
            </span>
            <span className="bg-white/10 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full">
              {sections.reduce((sum, s) => sum + s.microsections.length, 0)} lessons
            </span>
          </div>
          <div className="mt-6">
            <button
              onClick={openBrailleGuide}
              className="px-5 py-2.5 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 font-bold transition-all disabled:opacity-60"
              disabled={isBrailleLoading}
            >
              {t('chapter.brailleGuide')}
            </button>
          </div>
        </div>

        {/* Sections List */}
        <div className="space-y-4">
          {sections.map((section, sectionIndex) => {
            const isExpanded = expandedSections.has(section.id);

            return (
              <div key={section.id} className="bg-surface-100 rounded-[2rem] border border-surface-200 overflow-hidden shadow-sm transition-all hover:shadow-md">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-6 hover:bg-surface-200/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-surface-200 rounded-xl flex items-center justify-center text-surface-600 font-black text-sm">
                      {sectionIndex + 1}
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-surface-900 tracking-tight">{section.title}</h3>
                      {section.description && (
                        <p className="text-sm text-surface-500 font-bold mt-0.5">{section.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-surface-400 uppercase tracking-widest">
                      {section.microsections.length} items
                    </span>
                    <svg
                      className={`w-5 h-5 text-surface-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Microsections List */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-2">
                    {section.microsections.map((microsection) => {
                      const typeColors = getMicrosectionColor(microsection.type);

                      return (
                        <button
                          key={microsection.id}
                          onClick={() => handleMicrosectionClick(section, microsection)}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border ${typeColors.border} ${typeColors.bg} ${typeColors.hover} transition-all text-left`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeColors.icon} bg-surface-50 dark:bg-surface-200/50 shadow-sm`}>
                            {getMicrosectionIcon(microsection.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-surface-900 truncate tracking-tight">{microsection.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] uppercase tracking-widest ${typeColors.icon} font-black`}>
                                {getMicrosectionLabel(microsection.type)}
                              </span>
                              {microsection.estimatedMinutes && (
                                <span className="text-[10px] font-black text-surface-400 uppercase tracking-widest">
                                  • {microsection.estimatedMinutes} min
                                </span>
                              )}
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {isBrailleOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white max-w-3xl w-full rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">{t('chapter.brailleGuide')}</h3>
              <button
                onClick={() => setIsBrailleOpen(false)}
                className="text-slate-500 hover:text-slate-700"
                aria-label="Close braille guide"
              >
                X
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-auto">
              {isBrailleLoading && (
                <div className="text-slate-600">{t('chapter.generateBraille')}</div>
              )}
              {brailleError && (
                <div className="text-red-600">{brailleError}</div>
              )}
              {brailleResult?.fullBraille && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Full Braille</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap break-words overflow-auto max-w-full">
                    {brailleResult.fullBraille}
                  </div>
                </div>
              )}
              {brailleResult?.brf && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">BRF (Ready for embossing)</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap break-words overflow-auto max-w-full">
                    {brailleResult.brf}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChapterPage;
