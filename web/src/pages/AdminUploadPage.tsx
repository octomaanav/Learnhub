import { useState, useCallback, useEffect } from 'react';
import { apiUrl } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import type {
  CurriculumWithGrades,
  GradeEntity,
  SubjectEntity,
  ChapterInfo
} from '../types';
import { storeFile, clearAllFiles } from '../utils/fileStorage';

type Step = 'select' | 'upload' | 'uploading';

function AdminUploadPage() {
  const [step, setStep] = useState<Step>('select');
  const [curricula, setCurricula] = useState<CurriculumWithGrades[]>([]);
  const [subjects, setSubjects] = useState<SubjectEntity[]>([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState<CurriculumWithGrades | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<GradeEntity | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectEntity | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCurricula, setIsLoadingCurricula] = useState(true);

  const navigate = useNavigate();

  // Clear old files and fetch curricula/subjects on mount
  useEffect(() => {
    const initialize = async () => {
      // Clear any previously stored files to ensure fresh state
      await clearAllFiles();

      try {
        const [curriculaRes, subjectsRes] = await Promise.all([
          fetch(apiUrl('/api/curriculum')),
          fetch(apiUrl('/api/admin/subjects'), { credentials: 'include' })
        ]);


        if (!curriculaRes.ok) throw new Error('Failed to fetch curricula');
        if (!subjectsRes.ok) throw new Error('Failed to fetch subjects');

        const curriculaData = await curriculaRes.json();
        const subjectsData = await subjectsRes.json();

        setCurricula(curriculaData);
        setSubjects(subjectsData);
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setIsLoadingCurricula(false);
      }
    };
    initialize();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Please upload a PDF file');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile?.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please upload a PDF file');
    }
  };

  const canProceedToUpload = selectedCurriculum && selectedGrade && selectedSubject;

  const handleUpload = async () => {
    if (!file || !selectedGrade || !selectedSubject) return;

    setIsUploading(true);
    setStep('uploading');
    setError(null);

    try {
      // Clear any previously stored files first
      await clearAllFiles();

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(apiUrl('/api/parse/chapters'), {
        method: 'POST',
        body: formData,
        // Prevent caching
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse PDF');
      }

      const data = await response.json();
      const chapters: ChapterInfo[] = data.chapters;

      // Store file in IndexedDB (handles large files)
      await storeFile('adminUploadedPDF', file);

      // Navigate to admin review page with state (no session storage for chapters)
      navigate('/admin/review', {
        state: {
          chapters,
          fileName: file.name,
          classId: selectedGrade.id,
          subjectName: selectedSubject.name,
          subjectSlug: selectedSubject.slug,
          curriculumName: selectedCurriculum?.name || '',
          gradeName: selectedGrade.name,
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('upload');
      setIsUploading(false);
    }
  };

  if (isLoadingCurricula) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface-50 via-primary-50/30 to-secondary-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-surface-600">Loading curricula...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-primary-50/30 to-secondary-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-primary-100/50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-base font-bold">🔧</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-surface-800">
                  Admin: Content Upload
                </h1>
                <p className="text-sm text-surface-500">Populate subject chapters from textbook PDFs</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-800 hover:bg-surface-200 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Admin
              </button>
              <button
                onClick={() => navigate('/admin/editor')}
                className="px-4 py-2 bg-secondary-600 text-white rounded-lg text-sm font-medium hover:bg-secondary-700"
              >
                Manual Editor
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${step === 'select' ? 'bg-primary-600 text-white' : 'bg-surface-200 text-surface-600'}`}>
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">1</span>
            <span className="font-medium">Select Target</span>
          </div>
          <div className="w-8 h-0.5 bg-surface-300" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${step === 'upload' || step === 'uploading' ? 'bg-primary-600 text-white' : 'bg-surface-200 text-surface-600'}`}>
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">2</span>
            <span className="font-medium">Upload PDF</span>
          </div>
          <div className="w-8 h-0.5 bg-surface-300" />
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-200 text-surface-600">
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">3</span>
            <span className="font-medium">Review & Import</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-warning-50 border border-warning-200 rounded-xl text-warning-700">
            {error}
          </div>
        )}

        {/* Step 1: Select Curriculum, Grade, Subject */}
        {step === 'select' && (
          <div className="bg-white rounded-2xl border border-surface-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-surface-900 mb-6">
              Select Target for Content Import
            </h2>

            {/* Curriculum Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-surface-700 mb-3">
                1. Select Curriculum (Board)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {curricula.map((curriculum) => (
                  <button
                    key={curriculum.id}
                    onClick={() => {
                      setSelectedCurriculum(curriculum);
                      setSelectedGrade(null);
                    }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${selectedCurriculum?.id === curriculum.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50'
                      }`}
                  >
                    <p className="font-semibold text-surface-900">{curriculum.name}</p>
                    <p className="text-xs text-surface-500 mt-1">{curriculum.grades.length} grades</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Grade Selection */}
            {selectedCurriculum && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-surface-700 mb-3">
                  2. Select Grade
                </label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {selectedCurriculum.grades.map((grade) => (
                    <button
                      key={grade.id}
                      onClick={() => setSelectedGrade(grade)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${selectedGrade?.id === grade.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50'
                        }`}
                    >
                      <p className="font-semibold text-surface-900">{grade.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Subject Selection */}
            {selectedGrade && (
              <div className="mb-8">
                <label className="block text-sm font-semibold text-surface-700 mb-3">
                  3. Select Subject
                </label>
                {subjects.length === 0 ? (
                  <div className="p-4 bg-surface-50 rounded-xl border border-surface-200 text-center">
                    <p className="text-surface-500">No subjects found in database.</p>
                    <p className="text-sm text-surface-400 mt-1">Run the seed script to populate subjects.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {subjects.map((subject) => (
                      <button
                        key={subject.id}
                        onClick={() => setSelectedSubject(subject)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${selectedSubject?.id === subject.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50'
                          }`}
                      >
                        <p className="font-semibold text-surface-900">{subject.name}</p>
                        <p className="text-xs text-surface-500 mt-1">{subject.slug}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Summary & Next Button */}
            {canProceedToUpload && (
              <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-xl p-4 border border-primary-100 mb-6">
                <p className="text-sm font-medium text-surface-700">
                  You're about to import content for:
                </p>
                <p className="text-lg font-bold text-primary-700 mt-1">
                  {selectedCurriculum?.name} → {selectedGrade?.name} → {selectedSubject?.name}
                </p>
              </div>
            )}

            <button
              onClick={() => setStep('upload')}
              disabled={!canProceedToUpload}
              className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${canProceedToUpload
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-surface-200 text-surface-400 cursor-not-allowed'
                }`}
            >
              Continue to Upload
            </button>
          </div>
        )}

        {/* Step 2: Upload PDF */}
        {(step === 'upload' || step === 'uploading') && (
          <div className="bg-white rounded-2xl border border-surface-200 p-8 shadow-sm">
            {/* Target Summary */}
            <div className="bg-surface-50 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-500">Importing to:</p>
                <p className="font-semibold text-surface-900">
                  {selectedCurriculum?.name} → {selectedGrade?.name} → {selectedSubject?.name}
                </p>
              </div>
              <button
                onClick={() => setStep('select')}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                disabled={isUploading}
              >
                Change
              </button>
            </div>

            <h2 className="text-xl font-bold text-surface-900 mb-6">
              Upload Textbook PDF
            </h2>

            {/* Upload Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200
                ${isDragging
                  ? 'border-primary-500 bg-primary-50 scale-[1.02]'
                  : file
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-surface-300 bg-surface-50 hover:border-primary-400 hover:bg-primary-50/50'
                }
                ${isUploading ? 'pointer-events-none opacity-60' : ''}
              `}
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              {file ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto bg-primary-100 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-surface-900">{file.name}</p>
                    <p className="text-sm text-surface-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  {!isUploading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="text-sm text-surface-500 hover:text-surface-700 underline"
                    >
                      Choose a different file
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto bg-surface-100 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-surface-700">
                      Drop your PDF here or click to browse
                    </p>
                    <p className="text-sm text-surface-500 mt-1">
                      Supports PDF files up to 100MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <div className="mt-8">
              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className={`
                  w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-3
                  ${file && !isUploading
                    ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg'
                    : 'bg-surface-200 text-surface-400 cursor-not-allowed'
                  }
                `}
              >
                {isUploading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Extracting Chapters...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Extract & Review Chapters
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminUploadPage;
