import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { ChapterInfo, TOCSection, ParsedUnit, UnitLessons } from '../types';
import { getFile, clearAllFiles } from '../utils/fileStorage';
import { apiUrl } from '../utils/api';

interface LocationState {
  chapters: ChapterInfo[];
  fileName: string;
  classId: string;
  subjectName: string;
  subjectSlug: string;
  curriculumName: string;
  gradeName: string;
}

type ImportStep = 'review' | 'parsing' | 'generating' | 'importing' | 'done';

interface ImportResult {
  success: boolean;
  subject: { id: string; name: string; slug: string };
  chapters: Array<{ chapter: { id: string; name: string }; lessonCount: number }>;
}

function AdminChapterReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [subjectName, setSubjectName] = useState<string>('');
  const [subjectSlug, setSubjectSlug] = useState<string>('');
  const [curriculumName, setCurriculumName] = useState<string>('');
  const [gradeName, setGradeName] = useState<string>('');

  const [expandedChapter, setExpandedChapter] = useState<number | null>(0);
  const [editingChapter, setEditingChapter] = useState<number | null>(null);
  const [editingSection, setEditingSection] = useState<{ chapterIdx: number; sectionIdx: number } | null>(null);

  const [step, setStep] = useState<ImportStep>('review');
  const [parseProgress, setParseProgress] = useState(0);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [parsedUnits, setParsedUnits] = useState<ParsedUnit[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    // Get data from navigation state
    if (!state || !state.chapters || !state.classId || !state.subjectName) {
      navigate('/admin/upload');
      return;
    }

    setChapters(state.chapters);
    setFileName(state.fileName || 'Unknown file');
    setClassId(state.classId);
    setSubjectName(state.subjectName);
    setSubjectSlug(state.subjectSlug || '');
    setCurriculumName(state.curriculumName || '');
    setGradeName(state.gradeName || '');
  }, [state, navigate]);

  const updateChapter = (index: number, updates: Partial<ChapterInfo>) => {
    setChapters(prev => prev.map((ch, i) => i === index ? { ...ch, ...updates } : ch));
  };

  const deleteChapter = (index: number) => {
    if (confirm('Are you sure you want to delete this chapter?')) {
      setChapters(prev => prev.filter((_, i) => i !== index));
    }
  };

  const addChapter = () => {
    const newChapter: ChapterInfo = {
      title: 'New Chapter',
      startPage: chapters.length > 0 ? chapters[chapters.length - 1].startPage + 10 : 1,
      tocSections: null
    };
    setChapters(prev => [...prev, newChapter]);
    setExpandedChapter(chapters.length);
    setEditingChapter(chapters.length);
  };

  const addSection = (chapterIndex: number) => {
    const chapter = chapters[chapterIndex];
    const sections = chapter.tocSections || [];
    const newSection: TOCSection = {
      sectionId: `${chapterIndex + 1}.${sections.length + 1}`,
      title: 'New Section',
      page: chapter.startPage
    };
    updateChapter(chapterIndex, {
      tocSections: [...sections, newSection]
    });
  };

  const updateSection = (chapterIndex: number, sectionIndex: number, updates: Partial<TOCSection>) => {
    const chapter = chapters[chapterIndex];
    if (!chapter.tocSections) return;

    const newSections = chapter.tocSections.map((sec, i) =>
      i === sectionIndex ? { ...sec, ...updates } : sec
    );
    updateChapter(chapterIndex, { tocSections: newSections });
  };

  const deleteSection = (chapterIndex: number, sectionIndex: number) => {
    const chapter = chapters[chapterIndex];
    if (!chapter.tocSections) return;

    const newSections = chapter.tocSections.filter((_, i) => i !== sectionIndex);
    updateChapter(chapterIndex, {
      tocSections: newSections.length > 0 ? newSections : null
    });
  };

  const handleStartParsing = async () => {
    setStep('parsing');
    setError(null);
    setParseProgress(0);

    try {
      // Get file from IndexedDB
      const file = await getFile('adminUploadedPDF');
      if (!file) {
        setError('File not found. Please upload again.');
        setStep('review');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('chapters', JSON.stringify(chapters));

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setParseProgress(prev => Math.min(prev + Math.random() * 8, 85));
      }, 1500);

      const parseResponse = await fetch(apiUrl('/api/parse/full'), {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setParseProgress(100);

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        throw new Error(errorData.error || 'Failed to parse content');
      }

      const data = await parseResponse.json();
      setParsedUnits(data.units);

      // Auto-proceed to lesson generation
      setTimeout(() => handleGenerateLessons(data.units), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during parsing');
      setStep('review');
    }
  };

  const handleGenerateLessons = async (units: ParsedUnit[]) => {
    setStep('generating');
    setGenerateProgress(0);

    try {
      // Convert ParsedUnit[] to Unit[] format expected by lessons/generate
      const book = units.map(unit => ({
        unitTitle: unit.unitTitle,
        unitDescription: unit.unitDescription,
        sections: unit.sections.map(section => ({
          sectionId: section.sectionId,
          title: section.title,
          description: section.description,
          learningGoals: section.learningGoals,
        })),
      }));

      console.log(`Starting lesson generation for ${book.length} units...`);

      // Simulate progress (lesson generation takes time)
      const progressInterval = setInterval(() => {
        setGenerateProgress(prev => Math.min(prev + Math.random() * 5, 85));
      }, 2000);

      // Create AbortController with 30 minute timeout (lesson generation can take a while)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 30 * 60 * 1000); // 30 minutes

      let response: Response;
      try {
        response = await fetch(apiUrl('/api/lessons/generate'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(book),
          signal: controller.signal,
        });
      } catch (fetchError: any) {
        clearInterval(progressInterval);
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out after 30 minutes. Lesson generation is taking too long. Please try with fewer units or check the server logs.');
        }

        if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
          throw new Error('Network error: Could not connect to the server. Please check if the server is running and try again.');
        }

        throw new Error(`Request failed: ${fetchError.message || 'Unknown error'}`);
      }

      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      setGenerateProgress(100);

      if (!response.ok) {
        let errorMessage = 'Failed to generate lessons';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('Generate endpoint error:', errorData);
        } catch (parseError) {
          // If we can't parse the error, try to get text
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
            console.error('Generate endpoint error (text):', errorText);
          } catch (textError) {
            console.error('Generate endpoint error (status):', response.status, response.statusText);
            errorMessage = `Server returned ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      let lessons: UnitLessons[];
      try {
        lessons = await response.json();
        console.log(`Successfully generated lessons for ${lessons.length} units`);
      } catch (parseError) {
        console.error('Failed to parse lessons response:', parseError);
        throw new Error('Server returned invalid response. The lesson generation may have partially completed. Check server logs for details.');
      }

      if (!Array.isArray(lessons) || lessons.length === 0) {
        throw new Error('No lessons were generated. Please check the server logs for details.');
      }

      // Auto-proceed to import
      setTimeout(() => handleImport(units, lessons), 500);
    } catch (err) {
      console.error('Error in handleGenerateLessons:', err);
      const errorMessage = err instanceof Error
        ? err.message
        : 'An error occurred during lesson generation. Please check the server logs.';
      setError(errorMessage);
      setStep('review');
    }
  };

  const handleImport = async (units: ParsedUnit[], lessons: UnitLessons[]) => {
    setStep('importing');
    setImportProgress(0);

    try {
      // Validate required fields
      if (!classId) {
        throw new Error('Class ID is missing. Please go back and select a class again.');
      }
      if (!subjectSlug || !subjectName) {
        throw new Error('Subject information is missing. Please go back and select a subject again.');
      }
      if (!units || units.length === 0) {
        throw new Error('No units to import. Please parse the textbook first.');
      }
      if (!lessons || lessons.length === 0) {
        throw new Error('No lessons to import. Please generate lessons first.');
      }

      console.log('Importing with:', {
        classId,
        subjectSlug,
        subjectName,
        unitsCount: units.length,
        lessonsCount: lessons.length,
      });

      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + Math.random() * 15, 90));
      }, 500);

      // Create AbortController with 10 minute timeout for import
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 10 * 60 * 1000); // 10 minutes

      let response: Response;
      try {
        response = await fetch(apiUrl('/api/admin/bulk-import'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            classId,
            subjectSlug,
            subjectName,
            units,
            lessons, // Include generated lessons
          }),
          signal: controller.signal,
        });
      } catch (fetchError: any) {
        clearInterval(progressInterval);
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          throw new Error('Import request timed out after 10 minutes. Please try again or check the server logs.');
        }

        if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
          throw new Error('Network error: Could not connect to the server. Please check if the server is running and try again.');
        }

        throw new Error(`Import request failed: ${fetchError.message || 'Unknown error'}`);
      }

      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      setImportProgress(100);

      if (!response.ok) {
        let errorMessage = 'Failed to import content';
        let hint = '';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          hint = errorData.hint ? `\n\n${errorData.hint}` : '';
          console.error('Bulk import error:', errorData);
        } catch (parseError) {
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
            console.error('Bulk import error (text):', errorText);
          } catch (textError) {
            console.error('Bulk import error (status):', response.status, response.statusText);
            errorMessage = `Server returned ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage + hint);
      }

      let result: ImportResult;
      try {
        result = await response.json();
        console.log('Import successful:', result);
      } catch (parseError) {
        console.error('Failed to parse import response:', parseError);
        throw new Error('Server returned invalid response. The import may have partially completed. Check server logs for details.');
      }

      setImportResult(result);
      setStep('done');

      // Clean up stored files
      await clearAllFiles();
    } catch (err) {
      console.error('Error in handleImport:', err);
      const errorMessage = err instanceof Error
        ? err.message
        : 'An error occurred during import. Please check the server logs.';
      setError(errorMessage);
      setStep('review');
    }
  };

  const handleStartOver = async () => {
    await clearAllFiles();
    navigate('/admin/upload');
  };

  // Success Screen
  if (step === 'done' && importResult) {
    const totalLessons = importResult.chapters.reduce((acc, c) => acc + c.lessonCount, 0);

    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center p-6">
        <div className="bg-surface-50 rounded-2xl border border-surface-200 p-8 max-w-lg w-full text-center shadow-lg">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary-400 to-primary-500 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-surface-900 mb-2">Import Successful!</h1>
          <p className="text-surface-600 mb-6">
            Content has been imported into the database.
          </p>

          <div className="bg-surface-50 rounded-xl p-4 mb-6 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-surface-500">Subject</p>
                <p className="font-semibold text-surface-900">{importResult.subject.name}</p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Location</p>
                <p className="font-semibold text-surface-900">{curriculumName} / {gradeName}</p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Chapters</p>
                <p className="font-semibold text-primary-600">{importResult.chapters.length}</p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Lessons</p>
                <p className="font-semibold text-secondary-600">{totalLessons}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleStartOver}
              className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
            >
              Import Another Textbook
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-surface-100 text-surface-700 font-semibold rounded-xl hover:bg-surface-200 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Progress Screen (Parsing, Generating, or Importing)
  if (step === 'parsing' || step === 'generating' || step === 'importing') {
    const progress = step === 'parsing'
      ? parseProgress
      : step === 'generating'
        ? generateProgress
        : importProgress;

    const title = step === 'parsing'
      ? 'Parsing Content...'
      : step === 'generating'
        ? 'Generating Lessons with AI...'
        : 'Importing to Database...';

    const description = step === 'parsing'
      ? 'Extracting learning goals and sections from each chapter...'
      : step === 'generating'
        ? 'Using Gemini AI to create detailed lesson content for each section...'
        : 'Creating subjects, chapters, and lessons in the database...';

    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center p-6">
        <div className="bg-surface-50 rounded-2xl border border-surface-200 p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 mx-auto mb-6">
            <svg className="w-16 h-16 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-surface-900 mb-2">{title}</h2>
          <p className="text-surface-600 mb-6">{description}</p>

          <div className="w-full bg-surface-200 rounded-full h-3 mb-2">
            <div
              className="h-3 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-surface-500">{Math.round(progress)}% complete</p>

          {step === 'parsing' && (
            <p className="mt-4 text-xs text-surface-400">
              Processing {chapters.length} chapters. This may take a few minutes...
            </p>
          )}
          {step === 'generating' && (
            <p className="mt-4 text-xs text-surface-400">
              Generating detailed lessons for {parsedUnits.length} units. This may take several minutes...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Review Screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-primary-50/30 to-secondary-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-primary-100/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/upload')}
                className="p-2 hover:bg-surface-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-surface-900">Review & Import</h1>
                <p className="text-sm text-surface-500">
                  {curriculumName} → {gradeName} → {subjectName} • {fileName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-800 hover:bg-surface-200 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Admin Home
              </button>
              <span className="text-sm text-surface-600">
                {chapters.length} chapters
              </span>
              <button
                onClick={addChapter}
                className="px-4 py-2 bg-surface-100 hover:bg-surface-200 text-surface-700 font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Chapter
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-warning-50 border border-warning-200 rounded-xl text-warning-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-warning-500 hover:text-warning-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Chapters List */}
        <div className="space-y-4">
          {chapters.map((chapter, chapterIdx) => (
            <div
              key={chapterIdx}
              className="bg-surface-50 rounded-xl border border-surface-200 overflow-hidden shadow-sm"
            >
              {/* Chapter Header */}
              <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-surface-50 transition-colors"
                onClick={() => setExpandedChapter(expandedChapter === chapterIdx ? null : chapterIdx)}
              >
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 font-bold">
                  {chapterIdx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  {editingChapter === chapterIdx ? (
                    <input
                      type="text"
                      value={chapter.title}
                      onChange={(e) => updateChapter(chapterIdx, { title: e.target.value })}
                      onBlur={() => setEditingChapter(null)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingChapter(null)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-3 py-1 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                  ) : (
                    <h3 className="font-semibold text-surface-900 truncate">{chapter.title}</h3>
                  )}
                  <p className="text-sm text-surface-500">
                    Page {chapter.startPage} • {chapter.tocSections?.length || 0} sections
                  </p>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    value={chapter.startPage}
                    onChange={(e) => updateChapter(chapterIdx, { startPage: parseInt(e.target.value) || 1 })}
                    className="w-20 px-2 py-1 text-sm border border-surface-300 rounded-lg text-center"
                    min={1}
                  />
                  <button
                    onClick={() => setEditingChapter(chapterIdx)}
                    className="p-2 hover:bg-surface-100 rounded-lg text-surface-500 hover:text-surface-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteChapter(chapterIdx)}
                    className="p-2 hover:bg-red-50 rounded-lg text-surface-500 hover:text-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <svg
                    className={`w-5 h-5 text-surface-400 transition-transform ${expandedChapter === chapterIdx ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Sections (Expanded) */}
              {expandedChapter === chapterIdx && (
                <div className="border-t border-surface-200 bg-surface-50 p-4">
                  {chapter.tocSections && chapter.tocSections.length > 0 ? (
                    <div className="space-y-2">
                      {chapter.tocSections.map((section, sectionIdx) => (
                        <div
                          key={sectionIdx}
                          className="flex items-center gap-3 p-3 bg-surface-50 rounded-lg border border-surface-200"
                        >
                          <span className="text-sm font-mono text-primary-600 w-12">
                            {section.sectionId}
                          </span>

                          {editingSection?.chapterIdx === chapterIdx && editingSection?.sectionIdx === sectionIdx ? (
                            <input
                              type="text"
                              value={section.title}
                              onChange={(e) => updateSection(chapterIdx, sectionIdx, { title: e.target.value })}
                              onBlur={() => setEditingSection(null)}
                              onKeyDown={(e) => e.key === 'Enter' && setEditingSection(null)}
                              className="flex-1 px-2 py-1 border border-primary-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                              autoFocus
                            />
                          ) : (
                            <span className="flex-1 text-sm text-surface-700">{section.title}</span>
                          )}

                          <input
                            type="number"
                            value={section.page || ''}
                            onChange={(e) => updateSection(chapterIdx, sectionIdx, { page: parseInt(e.target.value) || undefined })}
                            className="w-16 px-2 py-1 text-sm border border-surface-300 rounded text-center"
                            placeholder="Page"
                            min={1}
                          />

                          <button
                            onClick={() => setEditingSection({ chapterIdx, sectionIdx })}
                            className="p-1.5 hover:bg-surface-100 rounded text-surface-400 hover:text-surface-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteSection(chapterIdx, sectionIdx)}
                            className="p-1.5 hover:bg-red-50 rounded text-surface-400 hover:text-red-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-surface-500 text-center py-4">
                      No sections found in TOC. Sections will be auto-generated during parsing.
                    </p>
                  )}

                  <button
                    onClick={() => addSection(chapterIdx)}
                    className="mt-3 w-full py-2 border-2 border-dashed border-surface-300 rounded-lg text-sm text-surface-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                  >
                    + Add Section
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Import Button */}
        <div className="mt-10 flex flex-col items-center">
          <button
            onClick={handleStartParsing}
            disabled={chapters.length === 0}
            className={`
              px-10 py-4 rounded-xl font-semibold text-lg transition-all duration-200
              flex items-center gap-3
              ${chapters.length > 0
                ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white hover:from-primary-600 hover:to-secondary-600 shadow-lg hover:shadow-xl'
                : 'bg-surface-200 text-surface-400 cursor-not-allowed'
              }
            `}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Parse & Import to Database
          </button>
          <p className="mt-3 text-sm text-surface-500">
            This will parse all {chapters.length} chapters and save them to the database
          </p>
        </div>
      </main>
    </div>
  );
}

export default AdminChapterReviewPage;
