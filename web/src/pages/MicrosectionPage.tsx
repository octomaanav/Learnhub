import { useState, useEffect, useMemo, useRef } from 'react';
import { apiUrl, API_BASE } from '../utils/api';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { MathText } from '../components/MathText';
import AccessibilityToolbar from '../components/AccessibilityToolbar';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { StoryPlayer } from '../components/StoryPlayer';
import type {
  Microsection,
  ArticleMicrosection,
  VideoMicrosection,
  QuizMicrosection,
  PracticeMicrosection,
  ArticleContent,
  StoryAsset,
  StoryAudioAsset
} from '../types';

// Helper to format text: bold **text** and convert newlines to <br/>
function formatText(text: string): string {
  if (!text) return '';
  const withBold = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Replace escaped newlines (\n) and literal /n with HTML line breaks
  return withBold.replace(/\\n/g, '<br/>').replace(/\/n/g, '<br/>');
}

// Helper to get all text components for speech/braille
function getAllContentText(microsection: Microsection): string {
  let text = `${microsection.title}. `;

  if (microsection.type === 'article') {
    const content = (microsection as ArticleMicrosection).content;
    if (content.introduction) text += `${content.introduction}\n`;

    content.coreConcepts.forEach(concept => {
      text += `${concept.conceptTitle}. ${concept.explanation}\n`;
      if (concept.example) text += `Example: ${concept.example}\n`;
    });

    if (content.summary.length > 0) {
      text += "Key Takeaways: " + content.summary.join('. ') + "\n";
    }

    if (content.quickCheckQuestions.length > 0) {
      text += "Quick Check Questions: ";
      content.quickCheckQuestions.forEach((q, i) => {
        text += `Question ${i + 1}: ${q.question}. `;
      });
    }
  } else if (microsection.type === 'quiz' || microsection.type === 'practice') {
    const content = (microsection as QuizMicrosection | PracticeMicrosection).content;
    if (content.description) text += `${content.description}\n`;
    content.questions.forEach((q, i) => {
      text += `Question ${i + 1}: ${q.question}. `;
      if (q.options) text += "Options: " + q.options.join(', ') + ". ";
    });
  } else if (microsection.type === 'video') {
    const content = (microsection as VideoMicrosection).content;
    if (content.description) text += `${content.description}\n`;
  }

  return text;
}
import { extractArticleRawText } from '../utils/textExtractor';
import { useLanguage } from '../components/i18n/LanguageProvider';
import { useI18n } from '../components/i18n/useI18n';

// Article Viewer Component
const ArticleViewer: React.FC<{ content: ArticleContent; t: (key: string) => string }> = ({ content, t }) => {
  return (
    <div className="prose prose-slate max-w-none">
      {/* Introduction */}
      {content.introduction && (
        <div className="text-lg text-slate-600 mb-8 leading-relaxed">
          <MathText text={formatText(content.introduction)} />
        </div>
      )}

      {/* Core Concepts */}
      {content.coreConcepts.map((concept, i) => (
        <div key={i} className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">{concept.conceptTitle}</h2>
          <div className="text-slate-700 mb-4 leading-relaxed">
            <MathText text={formatText(concept.explanation)} />
          </div>
          {concept.example && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-4">
              <p className="font-semibold text-blue-800 mb-1">{t('micro.example')}</p>
              <div className="text-blue-900">
                <MathText text={formatText(concept.example)} />
              </div>
            </div>
          )}
          {concept.diagramImageUrl && (
            <div className="my-4 rounded-xl overflow-hidden border border-slate-200">
              <img
                src={concept.diagramImageUrl}
                alt={concept.diagramDescription || `Diagram for ${concept.conceptTitle}`}
                className="w-full max-w-lg"
              />
              {concept.diagramDescription && (
                <p className="text-sm text-slate-500 p-3 bg-slate-50">{concept.diagramDescription}</p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Summary */}
      {content.summary.length > 0 && (
        <div className="bg-slate-100 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-bold text-slate-900 mb-3">{t('micro.keyTakeaways')}</h3>
          <ul className="space-y-2">
            {content.summary.map((point, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span className="text-slate-700"><MathText text={formatText(point)} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick Check Questions */}
      {content.quickCheckQuestions.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">{t('micro.quickCheck')}</h3>
          <div className="space-y-4">
            {content.quickCheckQuestions.map((q, i) => (
              <details key={i} className="group">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50">
                    <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium">
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium text-slate-800">
                      <MathText text={formatText(q.question)} />
                    </span>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </div>
                </summary>
                <div className="ml-9 pl-3 border-l-2 border-green-300 py-2 text-green-800">
                  <MathText text={formatText(q.answer)} />
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Video Viewer Component
const VideoViewer: React.FC<{
  content: VideoMicrosection['content'];
  story?: StoryAsset | null;
  onGenerateStory?: () => void;
  isStoryLoading?: boolean;
  audioSlides?: StoryAudioAsset['slides'];
  onRegenerateAudio?: () => void;
  isAudioLoading?: boolean;
  t: (key: string) => string;
}> = ({ content, story, onGenerateStory, isStoryLoading, audioSlides, onRegenerateAudio, isAudioLoading, t }) => {
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be')
        ? url.split('/').pop()
        : new URL(url).searchParams.get('v');
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('vimeo.com')) {
      const videoId = url.split('/').pop();
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  };

  if (!content.url && story?.status === 'ready') {
    return (
      <StoryPlayer
        story={story}
        autoPlay={false}
        audioSlides={audioSlides}
        onRegenerateAudio={onRegenerateAudio}
        isAudioLoading={isAudioLoading}
      />
    );
  }

  return (
    <div>
      <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden mb-6">
        {content.url ? (
          <iframe
            src={getEmbedUrl(content.url)}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={content.title}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
            <div className="text-center mb-4">
              <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>{t('micro.videoNotAvailable')}</p>
            </div>
            {onGenerateStory && (
              <button
                onClick={onGenerateStory}
                className="px-4 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100"
              >
                {isStoryLoading ? t('micro.generatingStory') : t('micro.generateStory')}
              </button>
            )}
          </div>
        )}
      </div>

      {content.description && (
        <div className="prose prose-slate max-w-none">
          <p className="text-slate-600">{content.description}</p>
        </div>
      )}

      {content.transcript && (
        <details className="mt-6 border border-slate-200 rounded-xl">
          <summary className="p-4 cursor-pointer font-medium text-slate-700 hover:bg-slate-50">
            📄 {t('micro.viewTranscript')}
          </summary>
          <div className="p-4 pt-0 text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
            {content.transcript}
          </div>
        </details>
      )}
    </div>
  );
};

// Quiz Viewer Component
const QuizViewer: React.FC<{ content: QuizMicrosection['content']; t: (key: string) => string }> = ({ content, t }) => {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleAnswer = (questionId: string, answer: string | number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setShowResults(true);
  };

  const score = useMemo(() => {
    if (!submitted) return 0;
    return content.questions.reduce((acc, q) => {
      return acc + (answers[q.id] === q.correctAnswer ? 1 : 0);
    }, 0);
  }, [submitted, content.questions, answers]);

  return (
    <div>
      {content.description && (
        <div className="text-slate-600 mb-6">
          <MathText text={content.description} />
        </div>
      )}

      {content.timeLimit && !submitted && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-center gap-2 text-amber-800">
          <span>⏱️</span>
          <span>{t('micro.timeLimit')}: {content.timeLimit} minutes</span>
        </div>
      )}

      {showResults && (
        <div className={`rounded-xl p-6 mb-6 ${score === content.questions.length ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
          <h3 className={`text-xl font-bold mb-2 ${score === content.questions.length ? 'text-green-800' : 'text-blue-800'}`}>
            {score === content.questions.length ? '🎉 Perfect Score!' : `You scored ${score}/${content.questions.length}`}
          </h3>
          <p className={score === content.questions.length ? 'text-green-700' : 'text-blue-700'}>
            {score === content.questions.length
              ? 'Great job! You got all questions correct.'
              : `Review the questions below to see the correct answers.`
            }
          </p>
        </div>
      )}

      <div className="space-y-6">
        {content.questions.map((question, qIndex) => {
          const isCorrect = submitted && answers[question.id] === question.correctAnswer;
          const isWrong = submitted && answers[question.id] !== undefined && answers[question.id] !== question.correctAnswer;

          return (
            <div
              key={question.id}
              className={`border rounded-xl p-5 ${isCorrect ? 'border-green-300 bg-green-50' : isWrong ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
            >
              <div className="flex items-start gap-3 mb-4">
                <span className="bg-slate-100 text-slate-600 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold">
                  {qIndex + 1}
                </span>
                <div className="flex-1">
                  <div className="font-medium text-slate-900">
                    <MathText text={question.question} />
                  </div>
                  {question.points && (
                    <span className="text-xs text-slate-400 mt-1">{question.points} points</span>
                  )}
                </div>
              </div>

              {question.type === 'multiple-choice' && question.options && (
                <div className="space-y-2 ml-10">
                  {question.options.map((option, optIndex) => {
                    const isSelected = answers[question.id] === optIndex;
                    const isCorrectOption = submitted && question.correctAnswer === optIndex;

                    return (
                      <button
                        key={optIndex}
                        onClick={() => handleAnswer(question.id, optIndex)}
                        disabled={submitted}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${isCorrectOption
                          ? 'border-green-500 bg-green-100 text-green-800'
                          : isSelected && isWrong
                            ? 'border-red-500 bg-red-100 text-red-800'
                            : isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          } ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <span className="font-medium mr-2">{String.fromCharCode(65 + optIndex)}.</span>
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {question.type === 'true-false' && (
                <div className="flex gap-3 ml-10">
                  {['True', 'False'].map((option) => {
                    const value = option.toLowerCase();
                    const isSelected = answers[question.id] === value;
                    const isCorrectOption = submitted && question.correctAnswer === value;

                    return (
                      <button
                        key={option}
                        onClick={() => handleAnswer(question.id, value)}
                        disabled={submitted}
                        className={`flex-1 p-3 rounded-lg border transition-all ${isCorrectOption
                          ? 'border-green-500 bg-green-100 text-green-800'
                          : isSelected && isWrong
                            ? 'border-red-500 bg-red-100 text-red-800'
                            : isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          } ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {submitted && question.explanation && (
                <div className="mt-3 ml-10 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <span className="font-medium">Explanation: </span>
                  {question.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={Object.keys(answers).length < content.questions.length}
          className={`mt-6 w-full py-3 rounded-xl font-semibold transition-all ${Object.keys(answers).length >= content.questions.length
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
        >
          Submit Quiz
        </button>
      )}
    </div>
  );
};

// Practice Viewer Component
const PracticeViewer: React.FC<{ content: PracticeMicrosection['content']; t: (key: string) => string }> = ({ content, t }) => {
  return <QuizViewer content={{ id: content.id, title: content.title, description: content.description, questions: content.questions }} t={t} />;
};

// API response type for microsection endpoint
interface MicrosectionApiResponse {
  chapter: {
    chapterId: string;
    chapterTitle: string;
  };
  section: {
    id: string;
    slug: string;
    title: string;
  };
  microsection: Microsection;
  navigation: {
    sectionMicrosections: {
      id: string;
      type: string;
      title: string;
    }[];
    currentIndex: number;
  };
}

export function MicrosectionPage() {
  const navigate = useNavigate();
  const { classId, subjectId, chapterSlug, sectionSlug, microsectionId } = useParams<{
    classId: string;
    subjectId: string;
    chapterSlug: string;
    sectionSlug: string;
    microsectionId: string;
  }>();

  useAuth(); // Still call to ensure authentication
  const [data, setData] = useState<MicrosectionApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Accessibility state
  // Accessibility state
  const { speak, stop } = useTextToSpeech();
  const [voiceOverEnabled, setVoiceOverEnabled] = useState(false);
  const [storyModeEnabled, setStoryModeEnabled] = useState(false);
  const [highContrastEnabled, setHighContrastEnabled] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [story, setStory] = useState<StoryAsset | null>(null);
  const [isStoryLoading, setIsStoryLoading] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyAudio, setStoryAudio] = useState<StoryAudioAsset | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [brailleResult, setBrailleResult] = useState<{ brf?: string; fullBraille?: string } | null>(null);
  const [brailleError, setBrailleError] = useState<string | null>(null);
  const [isBrailleOpen, setIsBrailleOpen] = useState(false);
  const [isBrailleLoading, setIsBrailleLoading] = useState(false);
  const { language } = useLanguage();
  const { t } = useI18n();

  useEffect(() => {
    const fetchMicrosection = async () => {
      if (!classId || !subjectId || !chapterSlug || !sectionSlug || !microsectionId) {
        setError('Missing required parameters');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          apiUrl(`/api/lessons/structured/${classId}/${subjectId}/${chapterSlug}/${sectionSlug}/${microsectionId}`)
        );

        if (!response.ok) {
          throw new Error('Content not found');
        }

        const responseData: MicrosectionApiResponse = await response.json();
        setData(responseData);
      } catch (err) {
        console.error('Error fetching microsection:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMicrosection();
  }, [classId, subjectId, chapterSlug, sectionSlug, microsectionId, language]);

  useEffect(() => {
    setStory(null);
    setStoryError(null);
    setStoryAudio(null);

    const preloadStory = async () => {
      if (!classId || !subjectId || !chapterSlug || !sectionSlug) return;
      try {
        const response = await fetch(
          `http://localhost:8000/api/story/${classId}/${subjectId}/${chapterSlug}/${sectionSlug}`
        );
        if (!response.ok) {
          return;
        }
        const storyData: StoryAsset = await response.json();
        if (storyData.status === 'ready') {
          setStory(storyData);
        }
      } catch (err) {
        console.warn('Story preload failed', err);
      }
    };

    preloadStory();
  }, [classId, subjectId, chapterSlug, sectionSlug]);

  // Voice Control Listener
  useEffect(() => {
    const handleVoiceControl = (event: CustomEvent) => {
      const { action } = event.detail;

      switch (action) {
        case 'play':
        case 'resume':
          if (data && !voiceOverEnabled) {
            setVoiceOverEnabled(true);
          }
          break;
        case 'pause':
        case 'stop':
          setVoiceOverEnabled(false);
          break;
        case 'next':
          if (data) {
            const { navigation, section } = data;
            const newIndex = navigation.currentIndex + 1;
            if (newIndex < navigation.sectionMicrosections.length) {
              const nextMicrosection = navigation.sectionMicrosections[newIndex];
              navigate(`/${classId}/${subjectId}/${chapterSlug}/${section.slug}/${nextMicrosection.id}`);
            }
          }
          break;
        case 'previous':
          if (data) {
            const { navigation, section } = data;
            const newIndex = navigation.currentIndex - 1;
            if (newIndex >= 0) {
              const prevMicrosection = navigation.sectionMicrosections[newIndex];
              navigate(`/${classId}/${subjectId}/${chapterSlug}/${section.slug}/${prevMicrosection.id}`);
            } else {
              navigate(`/${classId}/${subjectId}/${chapterSlug}`);
            }
          }
          break;
      }
    };

    // Braille Control Listener
    const handleBrailleControl = () => {
      // Logic for braille output moved directly into the event listener to avoid dependency issues.
      if (!data) return;

      setIsBrailleLoading(true);

      const lessonText = getAllContentText(data.microsection);

      fetch(apiUrl('/api/braille/convert'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lesson: lessonText,
          normalize: true
        }),
      }).then(r => r.json()).then(result => {
        if (result.success) {
          if (result.brf) {
            const blobBrf = new Blob([result.brf], { type: 'text/plain' });
            const urlBrf = window.URL.createObjectURL(blobBrf);
            const aBrf = document.createElement('a');
            aBrf.href = urlBrf;
            aBrf.download = `${data.microsection.title.replace(/\s+/g, '_')}.brf`;
            document.body.appendChild(aBrf);
            aBrf.click();
            window.URL.revokeObjectURL(urlBrf);
            document.body.removeChild(aBrf);
          }

          if (result.fullBraille) {
            const blobTxt = new Blob([result.fullBraille], { type: 'text/plain;charset=utf-8' });
            const urlTxt = window.URL.createObjectURL(blobTxt);
            const aTxt = document.createElement('a');
            aTxt.href = urlTxt;
            aTxt.download = `${data.microsection.title.replace(/\s+/g, '_')}_unicode.txt`;
            document.body.appendChild(aTxt);
            aTxt.click();
            window.URL.revokeObjectURL(urlTxt);
            document.body.removeChild(aTxt);
          }
        }
      }).catch(err => {
        console.error('Braille export error:', err);
        alert('Failed to generate Braille files. Please try again.');
      }).finally(() => {
        setIsBrailleLoading(false);
      });
    };

    window.addEventListener('lesson-control', handleVoiceControl as EventListener);
    window.addEventListener('braille-control', handleBrailleControl as EventListener);

    return () => {
      window.removeEventListener('lesson-control', handleVoiceControl as EventListener);
      window.removeEventListener('braille-control', handleBrailleControl as EventListener);
    };
  }, [data, voiceOverEnabled, classId, subjectId, chapterSlug, navigate]);

  // VoiceOver: read page when enabled
  useEffect(() => {
    if (!voiceOverEnabled) {
      stop();
      return;
    }

    if (!data) return;

    const textToRead = getAllContentText(data.microsection);
    speak(textToRead);

    return () => {
      stop();
    };
  }, [voiceOverEnabled, data, speak, stop]);

  // Braille Export Handler
  const handleBraille = async () => {
    if (!data) return;

    setIsBrailleLoading(true);
    try {
      const lessonText = getAllContentText(data.microsection);

      const response = await fetch(apiUrl('/api/braille/convert'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lesson: lessonText,
          normalize: true
        }),
      });

      if (!response.ok) throw new Error('Failed to convert to Braille');

      const result = await response.json();

      if (result.success) {
        // 1. Download BRF file
        if (result.brf) {
          const blobBrf = new Blob([result.brf], { type: 'text/plain' });
          const urlBrf = window.URL.createObjectURL(blobBrf);
          const aBrf = document.createElement('a');
          aBrf.href = urlBrf;
          aBrf.download = `${data.microsection.title.replace(/\s+/g, '_')}.brf`;
          document.body.appendChild(aBrf);
          aBrf.click();
          window.URL.revokeObjectURL(urlBrf);
          document.body.removeChild(aBrf);
        }

        // 2. Download Unicode Braille TXT file
        if (result.fullBraille) {
          const blobTxt = new Blob([result.fullBraille], { type: 'text/plain;charset=utf-8' });
          const urlTxt = window.URL.createObjectURL(blobTxt);
          const aTxt = document.createElement('a');
          aTxt.href = urlTxt;
          aTxt.download = `${data.microsection.title.replace(/\s+/g, '_')}_unicode.txt`;
          document.body.appendChild(aTxt);
          aTxt.click();
          window.URL.revokeObjectURL(urlTxt);
          document.body.removeChild(aTxt);
        }
      }
    } catch (err) {
      console.error('Braille export error:', err);
      alert('Failed to generate Braille files. Please try again.');
    } finally {
      setIsBrailleLoading(false);
    }
  };

  // Story mode: simple highlight sequence
  useEffect(() => {
    if (!storyModeEnabled || !contentRef.current) return;
    const root = contentRef.current;
    const items = Array.from(root.querySelectorAll('p, h2, h3, li, details')) as HTMLElement[];
    if (items.length === 0) return;
    let idx = 0;
    items.forEach(it => it.style.transition = 'background-color 0.25s ease');
    const iv = setInterval(() => {
      items.forEach(it => it.style.backgroundColor = '');
      const cur = items[idx];
      if (cur) cur.style.backgroundColor = 'rgba(255,255,0,0.15)';
      idx = (idx + 1) % items.length;
    }, 1800);
    return () => {
      clearInterval(iv);
      items.forEach(it => it.style.backgroundColor = '');
    };
  }, [storyModeEnabled, data]);

  // High contrast
  useEffect(() => {
    if (highContrastEnabled) document.documentElement.classList.add('high-contrast-mode');
    else document.documentElement.classList.remove('high-contrast-mode');
  }, [highContrastEnabled]);

  const fetchStory = async () => {
    if (!classId || !subjectId || !chapterSlug || !sectionSlug) return;
    setIsStoryLoading(true);
    setStoryError(null);
    try {
      const response = await fetch(`${API_BASE}/api/story/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          subjectId,
          chapterSlug,
          sectionSlug
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate story');
      }

      const storyData: StoryAsset = await response.json();
      setStory(storyData);
      setStoryAudio(null);
    } catch (err) {
      setStoryError(err instanceof Error ? err.message : 'Failed to generate story');
    } finally {
      setIsStoryLoading(false);
    }
  };


  const fetchStoryAudio = async (storyData?: StoryAsset, force = false) => {
    const targetStory = storyData || story;
    if (!targetStory) return;
    setIsAudioLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/story/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          subjectId,
          chapterSlug,
          sectionSlug,
          locale: language,
          force
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audio');
      }

      const audioData: { audio: StoryAudioAsset } = await response.json();
      setStoryAudio(audioData.audio);
    } catch (err) {
      setStoryError(err instanceof Error ? err.message : 'Failed to generate audio');
    } finally {
      setIsAudioLoading(false);
    }
  };

  useEffect(() => {
    if (story && language) {
      fetchStoryAudio(story);
    }
  }, [story, language, classId, subjectId, chapterSlug, sectionSlug]);

  const openBraille = async () => {
    if (!data || data.microsection.type !== 'article') {
      setBrailleError('Braille is currently available for article lessons.');
      setIsBrailleOpen(true);
      return;
    }

    setIsBrailleLoading(true);
    setBrailleError(null);
    setIsBrailleOpen(true);

    try {
      const article = data.microsection as ArticleMicrosection;
      const lessonText = extractArticleRawText(article.content);

      const response = await fetch('http://localhost:8000/api/braille/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson: lessonText })
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
  useEffect(() => {
    const openBrailleInline = async () => {
      if (!data || data.microsection.type !== 'article') {
        setBrailleError('Braille is currently available for article lessons.');
        setIsBrailleOpen(true);
        return;
      }

      setIsBrailleLoading(true);
      setBrailleError(null);
      setIsBrailleOpen(true);

      try {
        const article = data.microsection as ArticleMicrosection;
        const lessonText = extractArticleRawText(article.content);

        const response = await fetch('http://localhost:8000/api/braille/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lesson: lessonText })
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

    const fetchStoryInline = async () => {
      if (!classId || !subjectId || !chapterSlug || !sectionSlug) return;
      setIsStoryLoading(true);
      setStoryError(null);
      try {
        const response = await fetch(`${API_BASE}/api/story/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId,
            subjectId,
            chapterSlug,
            sectionSlug
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate story');
        }

        const storyData: StoryAsset = await response.json();
        setStory(storyData);
        setStoryAudio(null);
      } catch (err) {
        setStoryError(err instanceof Error ? err.message : 'Failed to generate story');
      } finally {
        setIsStoryLoading(false);
      }
    };

    const handleStoryOpen = () => {
      fetchStoryInline();
    };
    const handleBrailleOpen = () => {
      openBrailleInline();
    };

    window.addEventListener('story-open', handleStoryOpen as EventListener);
    window.addEventListener('braille-open', handleBrailleOpen as EventListener);
    return () => {
      window.removeEventListener('story-open', handleStoryOpen as EventListener);
      window.removeEventListener('braille-open', handleBrailleOpen as EventListener);
    };
  }, [data, classId, subjectId, chapterSlug, sectionSlug]);

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!data) return;

    const { navigation, section } = data;
    const newIndex = direction === 'prev'
      ? navigation.currentIndex - 1
      : navigation.currentIndex + 1;

    if (newIndex >= 0 && newIndex < navigation.sectionMicrosections.length) {
      const nextMicrosection = navigation.sectionMicrosections[newIndex];
      navigate(`/${classId}/${subjectId}/${chapterSlug}/${section.slug}/${nextMicrosection.id}`);
    } else if (direction === 'prev') {
      // Go back to chapter page
      navigate(`/${classId}/${subjectId}/${chapterSlug}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading content...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || t('micro.error')}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('micro.back')}
          </button>
        </div>
      </div>
    );
  }

  const { microsection, navigation, section } = data;

  const getTypeLabel = () => {
    switch (microsection.type) {
      case 'article': return t('micro.type.article');
      case 'video': return t('micro.type.story');
      case 'quiz': return t('micro.type.quiz');
      case 'practice': return t('micro.type.practice');
      default: return t('micro.type.article');
    }
  };

  const getTypeColor = () => {
    switch (microsection.type) {
      case 'article': return 'text-blue-600 bg-blue-50';
      case 'video': return 'text-purple-600 bg-purple-50';
      case 'quiz': return 'text-green-600 bg-green-50';
      case 'practice': return 'text-amber-600 bg-amber-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const hasPrev = navigation.currentIndex > 0;
  const hasNext = navigation.currentIndex < navigation.sectionMicrosections.length - 1;

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/${classId}/${subjectId}/${chapterSlug}`)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Back to chapter"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-0.5">{section.title}</p>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getTypeColor()}`}>
                  {getTypeLabel()}
                </span>
                {microsection.estimatedMinutes && (
                  <span className="text-xs text-slate-400">
                    {microsection.estimatedMinutes} min
                  </span>
                )}
              </div>
              <h1 className="font-bold text-lg text-slate-900">{microsection.title}</h1>
            </div>
            <div className="ml-auto">
              <AccessibilityToolbar
                voiceOverEnabled={voiceOverEnabled}
                onVoiceOverToggle={(enabled: boolean) => setVoiceOverEnabled(enabled)}
                onBraille={handleBraille}
                isBrailleLoading={isBrailleLoading}
                storyModeEnabled={storyModeEnabled}
                onStoryModeToggle={(enabled: boolean) => setStoryModeEnabled(enabled)}
                highContrastEnabled={highContrastEnabled}
                onHighContrastToggle={(enabled: boolean) => setHighContrastEnabled(enabled)}
                onIncreaseText={() => {
                  const cur = window.getComputedStyle(document.documentElement).fontSize;
                  const px = parseFloat(cur || '16');
                  document.documentElement.style.fontSize = `${Math.min(24, px + 1)}px`;
                }}
                onDecreaseText={() => {
                  const cur = window.getComputedStyle(document.documentElement).fontSize;
                  const px = parseFloat(cur || '16');
                  document.documentElement.style.fontSize = `${Math.max(12, px - 1)}px`;
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 focus-mode-surface">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <button
            onClick={fetchStory}
            className="px-4 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100 disabled:opacity-60"
            disabled={isStoryLoading}
          >
            {isStoryLoading ? t('micro.generatingStory') : t('micro.storyMode')}
          </button>
          {microsection.type === 'article' && !story && (
            <button
              onClick={openBraille}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-60"
              disabled={isBrailleLoading}
            >
              {t('micro.brailleOutput')}
            </button>
          )}
          {storyError && (
            <span className="text-sm text-red-600">{storyError}</span>
          )}
        </div>

        {isStoryLoading && (
          <div className="mb-8 p-4 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700">
            {t('micro.generatingStory')}
          </div>
        )}

        {isAudioLoading && (
          <div className="mb-8 p-4 rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
            {t('micro.generatingAudio')}
          </div>
        )}

        {story && story.status === 'ready' && microsection.type !== 'video' && (
          <div className="mb-10">
            <StoryPlayer
              story={story}
              autoPlay={false}
              audioSlides={storyAudio?.slides}
              onRegenerateAudio={() => fetchStoryAudio(story, true)}
              isAudioLoading={isAudioLoading}
            />
          </div>
        )}

        {microsection.type === 'article' && (
          <div ref={contentRef}>
            <ArticleViewer content={(microsection as ArticleMicrosection).content} t={t} />
          </div>
        )}
        {microsection.type === 'video' && (
          <VideoViewer
            content={(microsection as VideoMicrosection).content}
            story={story}
            onGenerateStory={fetchStory}
            isStoryLoading={isStoryLoading}
            audioSlides={storyAudio?.slides}
            onRegenerateAudio={() => fetchStoryAudio(story ?? undefined, true)}
            isAudioLoading={isAudioLoading}
            t={t}
          />
        )}
        {microsection.type === 'quiz' && (
          <QuizViewer content={(microsection as QuizMicrosection).content} t={t} />
        )}
        {microsection.type === 'practice' && (
          <PracticeViewer content={(microsection as PracticeMicrosection).content} t={t} />
        )}
      </main>

      {isBrailleOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white max-w-3xl w-full rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">{t('micro.brailleOutput')}</h3>
              <button
                onClick={() => setIsBrailleOpen(false)}
                className="text-slate-500 hover:text-slate-700"
                aria-label="Close braille output"
              >
                X
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-auto">
              {isBrailleLoading && (
                <div className="text-slate-600">{t('micro.generatingBraille')}</div>
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

      {/* Navigation Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => handleNavigate('prev')}
            className={`px-4 py-2 font-medium flex items-center gap-2 rounded-lg ${hasPrev
              ? 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
              : 'text-slate-300 cursor-not-allowed'
              }`}
            disabled={!hasPrev}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('micro.previous')}
          </button>

          {/* Progress indicator */}
          <div className="flex items-center gap-1">
            {navigation.sectionMicrosections.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full ${idx === navigation.currentIndex
                  ? 'bg-blue-600'
                  : idx < navigation.currentIndex
                    ? 'bg-green-500'
                    : 'bg-slate-200'
                  }`}
              />
            ))}
          </div>

          <button
            onClick={() => hasNext ? handleNavigate('next') : navigate(`/${classId}/${subjectId}/${chapterSlug}`)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2"
          >
            {hasNext ? t('micro.next') : t('micro.finish')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}

export default MicrosectionPage;
