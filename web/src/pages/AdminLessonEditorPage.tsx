import { useState, useEffect } from 'react';
import { apiUrl } from '../utils/api';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  CurriculumWithGrades,
  SubjectWithChapters,
  LessonEntity,
  LessonContent,
  VideoContent,
  Quiz,
  ImageContent,
  NoteContent
} from '../types';
import { fetchCurricula, fetchSubjectsWithChapters } from '../data/curriculumData';

type EditorTab = 'content' | 'videos' | 'quizzes' | 'images' | 'notes';

// Helper to ensure all arrays are properly initialized
const normalizeLessonContent = (content: Partial<LessonContent> | undefined): LessonContent => ({
  introduction: content?.introduction || '',
  coreConcepts: content?.coreConcepts || [],
  summary: content?.summary || [],
  quickCheckQuestions: content?.quickCheckQuestions || [],
  videos: content?.videos || [],
  quizzes: content?.quizzes || [],
  images: content?.images || [],
  notes: content?.notes || []
});

function AdminLessonEditorPage() {
  const navigate = useNavigate();
  const { lessonId } = useParams<{ lessonId?: string }>();

  const [curricula, setCurricula] = useState<CurriculumWithGrades[]>([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [subjectsWithChapters, setSubjectsWithChapters] = useState<SubjectWithChapters[]>([]);

  const [lessons, setLessons] = useState<LessonEntity[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<LessonEntity | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>('content');

  const [lessonContent, setLessonContent] = useState<LessonContent>({
    introduction: '',
    coreConcepts: [],
    summary: [],
    quickCheckQuestions: [],
    videos: [],
    quizzes: [],
    images: [],
    notes: []
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingImageFor, setGeneratingImageFor] = useState<number | null>(null);

  // New chapter modal state
  const [showNewChapterModal, setShowNewChapterModal] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [newChapterDescription, setNewChapterDescription] = useState('');
  const [isCreatingChapter, setIsCreatingChapter] = useState(false);

  // Video upload state
  const [uploadingVideoFor, setUploadingVideoFor] = useState<string | null>(null);
  const [_uploadProgress, setUploadProgress] = useState<number>(0);

  // Fetch curricula on mount
  useEffect(() => {
    fetchCurricula()
      .then(setCurricula)
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  // Fetch subjects when class is selected
  useEffect(() => {
    if (selectedCurriculumId && selectedClassId) {
      fetchSubjectsWithChapters(selectedCurriculumId, selectedClassId)
        .then(setSubjectsWithChapters)
        .catch(err => setError(err.message));
    }
  }, [selectedCurriculumId, selectedClassId]);

  // Fetch lessons when chapter is selected
  useEffect(() => {
    if (selectedChapterId) {
      fetch(apiUrl(`/api/admin/lessons/${selectedChapterId}`), { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setError(data.error);
            setLessons([]);
          } else {
            setLessons(data);
          }
        })
        .catch(err => setError(err.message));
    }
  }, [selectedChapterId]);

  // Helper: convert DB content (legacy LessonContent or structured SectionEntity) to LessonContent
  const convertContentToLessonContent = (content: any): LessonContent => {
    if (!content) return normalizeLessonContent(undefined);

    // If already in legacy LessonContent shape
    if (typeof content === 'object' && ('introduction' in content || 'quickCheckQuestions' in content || 'coreConcepts' in content)) {
      return normalizeLessonContent(content as Partial<LessonContent>);
    }

    // If content is a Structured Section (has microsections)
    if (Array.isArray(content.microsections)) {
      // Try to find an article microsection for main lesson text
      const article = content.microsections.find((m: any) => m.type === 'article');
      const articleContent = article?.content || {};

      // Videos from microsections
      const videoMicrosections = content.microsections.filter((m: any) => m.type === 'video');
      const videos: VideoContent[] = videoMicrosections.map((m: any) => ({
        id: m.id || `video-${Date.now()}`,
        title: m.title || (m.content && m.content.title) || '',
        description: (m.content && m.content.description) || '',
        url: (m.content && m.content.url) || '',
        thumbnailUrl: (m.content && m.content.thumbnailUrl) || undefined,
        duration: (m.content && m.content.duration) || undefined,
      }));

      return {
        introduction: articleContent.introduction || content.description || '',
        coreConcepts: articleContent.coreConcepts || [],
        summary: articleContent.summary || [],
        quickCheckQuestions: articleContent.quickCheckQuestions || [],
        videos: videos.length ? videos : undefined,
        quizzes: articleContent.quizzes || [],
        images: articleContent.images || [],
        notes: articleContent.notes || [],
      };
    }

    // Fallback: try to coerce known properties
    return normalizeLessonContent(content as Partial<LessonContent>);
  };

  // Load lesson if lessonId is provided
  useEffect(() => {
    if (lessonId) {
      fetch(apiUrl(`/api/admin/lessons/lesson/${lessonId}`), { credentials: 'include' })
        .then(res => res.json())
        .then((lesson: LessonEntity) => {
          setSelectedLesson(lesson);
          setLessonContent(convertContentToLessonContent(lesson.content));
          setIsEditing(true);
        })
        .catch(err => setError(err.message));
    }
  }, [lessonId]);

  const handleSaveLesson = async () => {
    if (!selectedChapterId || !selectedLesson) {
      setError('Please select a chapter and lesson');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = selectedLesson.id
        ? apiUrl(`/api/admin/lessons/${selectedLesson.id}`)
        : apiUrl('/api/admin/lessons');

      const method = selectedLesson.id ? 'PUT' : 'POST';

      // If the original lesson content is a structured section (has microsections), update only the relevant microsections
      let newContent: any = selectedLesson.content;
      if (newContent && Array.isArray(newContent.microsections)) {
        // Find the article microsection and update its content fields
        newContent = {
          ...newContent,
          microsections: newContent.microsections.map((ms: any) => {
            if (ms.type === 'article') {
              return {
                ...ms,
                content: {
                  ...ms.content,
                  introduction: lessonContent.introduction,
                  coreConcepts: lessonContent.coreConcepts,
                  summary: lessonContent.summary,
                  quickCheckQuestions: lessonContent.quickCheckQuestions,
                  images: lessonContent.images,
                  notes: lessonContent.notes,
                }
              };
            }
            if (ms.type === 'video') {
              // Update video fields if present in lessonContent.videos
              const video = (lessonContent.videos || []).find(v => v.id === ms.id);
              if (video) {
                return {
                  ...ms,
                  title: video.title,
                  content: {
                    ...ms.content,
                    ...video
                  }
                };
              }
            }
            if (ms.type === 'quiz') {
              // Update quiz fields if present in lessonContent.quizzes
              const quiz = (lessonContent.quizzes || []).find(q => q.id === ms.id);
              if (quiz) {
                return {
                  ...ms,
                  title: quiz.title,
                  content: {
                    ...ms.content,
                    ...quiz
                  }
                };
              }
            }
            if (ms.type === 'practice') {
              // Update practice fields if present in lessonContent.quizzes (if practice editing is supported)
              // You can add similar logic for practice microsections if needed
            }
            return ms;
          })
        };
      } else {
        // Legacy/flat content: just update with lessonContent
        newContent = lessonContent;
      }

      const payload = selectedLesson.id
        ? { content: newContent }
        : {
          chapterId: selectedChapterId,
          slug: selectedLesson.slug || `lesson-${Date.now()}`,
          title: selectedLesson.title,
          content: newContent,
          sortOrder: selectedLesson.sortOrder || lessons.length + 1
        };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save lesson');
      }

      const savedLesson = await response.json();
      setSelectedLesson(savedLesson);
      setIsEditing(false);

      // Refresh lessons list
      if (selectedChapterId) {
        fetch(apiUrl(`/api/admin/lessons/${selectedChapterId}`), { credentials: 'include' }).then(res => res.json()).then(setLessons);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lesson');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewChapter = async () => {
    if (!newChapterName.trim()) {
      setError('Chapter name is required');
      return;
    }

    const selectedSubject = subjectsWithChapters.find(s => s.id === selectedSubjectId);
    if (!selectedSubject) {
      setError('Please select a subject first');
      return;
    }

    setIsCreatingChapter(true);
    setError(null);

    try {
      // Generate slug from name
      const slug = newChapterName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const response = await fetch(apiUrl('/api/admin/chapters'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gradeSubjectId: selectedSubject.gradeSubjectId,
          slug,
          name: newChapterName,
          description: newChapterDescription || newChapterName,
          sortOrder: selectedSubject.chapters.length + 1
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create chapter');
      }

      const newChapter = await response.json();

      // Update local state with new chapter
      setSubjectsWithChapters(prev =>
        prev.map(s =>
          s.id === selectedSubjectId
            ? { ...s, chapters: [...s.chapters, newChapter] }
            : s
        )
      );

      // Select the new chapter
      setSelectedChapterId(newChapter.id);
      setShowNewChapterModal(false);
      setNewChapterName('');
      setNewChapterDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chapter');
    } finally {
      setIsCreatingChapter(false);
    }
  };

  const handleCreateNewLesson = () => {
    setSelectedLesson({
      id: '',
      chapterId: selectedChapterId,
      slug: '',
      title: 'New Lesson',
      sortOrder: lessons.length + 1,
      content: {
        introduction: '',
        coreConcepts: [],
        summary: [],
        quickCheckQuestions: [],
        videos: [],
        quizzes: [],
        images: [],
        notes: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setLessonContent({
      introduction: '',
      coreConcepts: [],
      summary: [],
      quickCheckQuestions: [],
      videos: [],
      quizzes: [],
      images: [],
      notes: []
    });
    setIsEditing(true);
  };

  const addVideo = () => {
    const newVideo: VideoContent = {
      id: `video-${Date.now()}`,
      title: 'New Video',
      url: '',
      description: ''
    };
    setLessonContent(prev => ({
      ...prev,
      videos: [...(prev.videos || []), newVideo]
    }));
  };

  const updateVideo = (id: string, updates: Partial<VideoContent>) => {
    setLessonContent(prev => ({
      ...prev,
      videos: prev.videos?.map(v => v.id === id ? { ...v, ...updates } : v) || []
    }));
  };

  const deleteVideo = (id: string) => {
    setLessonContent(prev => ({
      ...prev,
      videos: prev.videos?.filter(v => v.id !== id) || []
    }));
  };

  const handleVideoUpload = async (videoId: string, file: File) => {
    if (!file) return;

    setUploadingVideoFor(videoId);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('lessonId', selectedLesson?.id || 'draft');

      const response = await fetch(apiUrl('/api/upload/video'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload video');
      }

      const result = await response.json();

      // Update video URL with the uploaded file URL
      updateVideo(videoId, { url: result.url });
      setUploadProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video');
    } finally {
      setUploadingVideoFor(null);
      setUploadProgress(0);
    }
  };

  const addQuiz = () => {
    const newQuiz: Quiz = {
      id: `quiz-${Date.now()}`,
      title: 'New Quiz',
      questions: []
    };
    setLessonContent(prev => ({
      ...prev,
      quizzes: [...(prev.quizzes || []), newQuiz]
    }));
  };

  const updateQuiz = (id: string, updates: Partial<Quiz>) => {
    setLessonContent(prev => ({
      ...prev,
      quizzes: prev.quizzes?.map(q => q.id === id ? { ...q, ...updates } : q) || []
    }));
  };

  const deleteQuiz = (id: string) => {
    setLessonContent(prev => ({
      ...prev,
      quizzes: prev.quizzes?.filter(q => q.id !== id) || []
    }));
  };

  const addImage = () => {
    const newImage: ImageContent = {
      id: `image-${Date.now()}`,
      url: '',
      title: 'New Image'
    };
    setLessonContent(prev => ({
      ...prev,
      images: [...(prev.images || []), newImage]
    }));
  };

  const updateImage = (id: string, updates: Partial<ImageContent>) => {
    setLessonContent(prev => ({
      ...prev,
      images: prev.images?.map(img => img.id === id ? { ...img, ...updates } : img) || []
    }));
  };

  const deleteImage = (id: string) => {
    setLessonContent(prev => ({
      ...prev,
      images: prev.images?.filter(img => img.id !== id) || []
    }));
  };

  const addNote = () => {
    const newNote: NoteContent = {
      id: `note-${Date.now()}`,
      title: 'New Note',
      content: ''
    };
    setLessonContent(prev => ({
      ...prev,
      notes: [...(prev.notes || []), newNote]
    }));
  };

  const updateNote = (id: string, updates: Partial<NoteContent>) => {
    setLessonContent(prev => ({
      ...prev,
      notes: prev.notes?.map(n => n.id === id ? { ...n, ...updates } : n) || []
    }));
  };

  const deleteNote = (id: string) => {
    setLessonContent(prev => ({
      ...prev,
      notes: prev.notes?.filter(n => n.id !== id) || []
    }));
  };

  const selectedCurriculum = curricula.find(c => c.id === selectedCurriculumId);
  const selectedSubject = subjectsWithChapters.find(s => s.id === selectedSubjectId);
  const selectedChapter = selectedSubject?.chapters.find(c => c.id === selectedChapterId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-slate-100 rounded-lg"
                title="Back to Admin"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Manual Lesson Editor</h1>
                <p className="text-sm text-slate-500">Create and edit lesson content manually</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Admin Home
              </button>
              {selectedLesson && (
                <button
                  onClick={handleSaveLesson}
                  disabled={isSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Lesson'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Selection */}
          <div className="col-span-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-24">
              <h2 className="text-sm font-bold text-slate-500 uppercase mb-4">Select Target</h2>

              {/* Curriculum */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-600 mb-2">Curriculum</label>
                <select
                  value={selectedCurriculumId}
                  onChange={(e) => {
                    setSelectedCurriculumId(e.target.value);
                    setSelectedClassId('');
                    setSelectedSubjectId('');
                    setSelectedChapterId('');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Select...</option>
                  {curricula.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Class */}
              {selectedCurriculum && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Class</label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      setSelectedSubjectId('');
                      setSelectedChapterId('');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Select...</option>
                    {selectedCurriculum.grades.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject */}
              {selectedClassId && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Subject</label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => {
                      setSelectedSubjectId(e.target.value);
                      setSelectedChapterId('');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Select...</option>
                    {subjectsWithChapters.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Chapter */}
              {selectedSubject && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-600">Chapter</label>
                    <button
                      onClick={() => setShowNewChapterModal(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + New Chapter
                    </button>
                  </div>
                  <select
                    value={selectedChapterId}
                    onChange={(e) => setSelectedChapterId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Select...</option>
                    {selectedSubject.chapters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Lessons List */}
              {selectedChapter && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-600 uppercase">Lessons</h3>
                    <button
                      onClick={handleCreateNewLesson}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + New
                    </button>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {lessons.map(lesson => (
                      <button
                        key={lesson.id}
                        onClick={() => {
                          setSelectedLesson(lesson);
                          setLessonContent(convertContentToLessonContent(lesson.content));
                          setIsEditing(true);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedLesson?.id === lesson.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'hover:bg-slate-50 text-slate-700'
                          }`}
                      >
                        {lesson.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Editor */}
          <div className="col-span-9">
            {!selectedLesson ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="text-5xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Select a Lesson</h3>
                <p className="text-slate-600 mb-6">
                  Choose a curriculum, class, subject, and chapter to start editing lessons
                </p>
                {selectedChapter && (
                  <button
                    onClick={handleCreateNewLesson}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                  >
                    Create New Lesson
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Lesson Header */}
                <div className="p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      {isEditing ? (
                        <input
                          type="text"
                          value={selectedLesson.title}
                          onChange={(e) => setSelectedLesson({ ...selectedLesson, title: e.target.value })}
                          className="text-2xl font-bold text-slate-900 border-b-2 border-blue-500 focus:outline-none"
                          placeholder="Lesson Title"
                        />
                      ) : (
                        <h2 className="text-2xl font-bold text-slate-900">{selectedLesson.title}</h2>
                      )}
                      {selectedChapter && (
                        <p className="text-sm text-slate-500 mt-1">
                          {selectedSubject?.name} → {selectedChapter.name}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
                    >
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 border-b border-slate-200">
                    {(['content', 'videos', 'quizzes', 'images', 'notes'] as EditorTab[]).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${activeTab === tab
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {activeTab === 'content' && (
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Introduction
                        </label>
                        <textarea
                          value={lessonContent.introduction}
                          onChange={(e) => setLessonContent({ ...lessonContent, introduction: e.target.value })}
                          rows={4}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Write the lesson introduction..."
                        />
                      </div>

                      {/* Core Concepts Section */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                              Core Concepts
                            </label>
                            <p className="text-xs text-slate-500">
                              Add key concepts covered in this lesson. Each concept includes a title, explanation, example, and diagram description.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              const newConcept = {
                                conceptTitle: 'New Concept',
                                explanation: '',
                                example: '',
                                diagramDescription: ''
                              };
                              setLessonContent({
                                ...lessonContent,
                                coreConcepts: [...(lessonContent.coreConcepts || []), newConcept]
                              });
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                          >
                            + Add Concept
                          </button>
                        </div>

                        <div className="space-y-4">
                          {lessonContent.coreConcepts?.map((concept, index) => (
                            <div key={index} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                              <div className="space-y-3">
                                <input
                                  type="text"
                                  value={concept.conceptTitle}
                                  onChange={(e) => {
                                    const updated = [...(lessonContent.coreConcepts || [])];
                                    updated[index] = { ...concept, conceptTitle: e.target.value };
                                    setLessonContent({ ...lessonContent, coreConcepts: updated });
                                  }}
                                  placeholder="Concept Title"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                                />
                                <div>
                                  <label className="block text-xs font-semibold text-slate-600 mb-1">Explanation</label>
                                  <textarea
                                    value={concept.explanation}
                                    onChange={(e) => {
                                      const updated = [...(lessonContent.coreConcepts || [])];
                                      updated[index] = { ...concept, explanation: e.target.value };
                                      setLessonContent({ ...lessonContent, coreConcepts: updated });
                                    }}
                                    placeholder="Detailed explanation of the concept..."
                                    rows={4}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-600 mb-1">Example</label>
                                  <textarea
                                    value={concept.example}
                                    onChange={(e) => {
                                      const updated = [...(lessonContent.coreConcepts || [])];
                                      updated[index] = { ...concept, example: e.target.value };
                                      setLessonContent({ ...lessonContent, coreConcepts: updated });
                                    }}
                                    placeholder="Worked example or real-world application..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-semibold text-slate-600">Diagram Description</label>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!concept.diagramDescription || concept.diagramDescription.trim().length === 0) {
                                          setError('Please enter a diagram description first');
                                          return;
                                        }

                                        try {
                                          setError(null);
                                          setGeneratingImageFor(index);
                                          const response = await fetch(apiUrl('/api/admin/generate-image'), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            credentials: 'include',
                                            body: JSON.stringify({
                                              prompt: concept.diagramDescription,
                                              numberOfImages: 1
                                            })
                                          });

                                          if (!response.ok) {
                                            const errorData = await response.json();
                                            throw new Error(errorData.error || 'Failed to generate image');
                                          }

                                          const data = await response.json();
                                          if (data.dataUrls && data.dataUrls.length > 0) {
                                            const updated = [...(lessonContent.coreConcepts || [])];
                                            updated[index] = {
                                              ...concept,
                                              diagramImageUrl: data.dataUrls[0]
                                            };
                                            setLessonContent({ ...lessonContent, coreConcepts: updated });
                                          }
                                        } catch (err) {
                                          setError(err instanceof Error ? err.message : 'Failed to generate image');
                                        } finally {
                                          setGeneratingImageFor(null);
                                        }
                                      }}
                                      disabled={!concept.diagramDescription || concept.diagramDescription.trim().length === 0 || generatingImageFor === index}
                                      className="px-3 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                    >
                                      {generatingImageFor === index ? (
                                        <>
                                          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                          Generating...
                                        </>
                                      ) : (
                                        <>🎨 Generate Image</>
                                      )}
                                    </button>
                                  </div>
                                  <textarea
                                    value={concept.diagramDescription}
                                    onChange={(e) => {
                                      const updated = [...(lessonContent.coreConcepts || [])];
                                      updated[index] = { ...concept, diagramDescription: e.target.value };
                                      setLessonContent({ ...lessonContent, coreConcepts: updated });
                                    }}
                                    placeholder="Description of any diagrams or visual aids..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                  />
                                  {concept.diagramImageUrl && (
                                    <div className="mt-2">
                                      <img
                                        src={concept.diagramImageUrl}
                                        alt={concept.conceptTitle}
                                        className="max-w-full h-auto rounded-lg border border-slate-300"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...(lessonContent.coreConcepts || [])];
                                          updated[index] = { ...concept, diagramImageUrl: undefined };
                                          setLessonContent({ ...lessonContent, coreConcepts: updated });
                                        }}
                                        className="mt-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                                      >
                                        Remove Image
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => {
                                      const updated = lessonContent.coreConcepts?.filter((_, i) => i !== index) || [];
                                      setLessonContent({ ...lessonContent, coreConcepts: updated });
                                    }}
                                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                                  >
                                    Delete Concept
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!lessonContent.coreConcepts || lessonContent.coreConcepts.length === 0) && (
                            <div className="text-center py-8 border-2 border-dashed border-slate-300 rounded-lg">
                              <p className="text-slate-500 mb-2">No concepts added yet</p>
                              <button
                                onClick={() => {
                                  const newConcept = {
                                    conceptTitle: 'New Concept',
                                    explanation: '',
                                    example: '',
                                    diagramDescription: ''
                                  };
                                  setLessonContent({
                                    ...lessonContent,
                                    coreConcepts: [newConcept]
                                  });
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                              >
                                + Add First Concept
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Summary Section */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Summary
                        </label>
                        <p className="text-xs text-slate-500 mb-2">
                          Add key takeaways as bullet points
                        </p>
                        <div className="space-y-2">
                          {lessonContent.summary?.map((item, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span className="text-slate-400">•</span>
                              <input
                                type="text"
                                value={item}
                                onChange={(e) => {
                                  const updated = [...(lessonContent.summary || [])];
                                  updated[index] = e.target.value;
                                  setLessonContent({ ...lessonContent, summary: updated });
                                }}
                                placeholder="Summary point..."
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                              />
                              <button
                                onClick={() => {
                                  const updated = lessonContent.summary?.filter((_, i) => i !== index) || [];
                                  setLessonContent({ ...lessonContent, summary: updated });
                                }}
                                className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              setLessonContent({
                                ...lessonContent,
                                summary: [...(lessonContent.summary || []), '']
                              });
                            }}
                            className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600"
                          >
                            + Add Summary Point
                          </button>
                        </div>
                      </div>

                      {/* Quick Check Questions Section */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                              Quick Check Questions
                            </label>
                            <p className="text-xs text-slate-500">
                              Add quick review questions with answers
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {lessonContent.quickCheckQuestions?.map((q, index) => (
                            <div key={index} className="p-3 border border-slate-200 rounded-lg">
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={q.question}
                                  onChange={(e) => {
                                    const updated = [...(lessonContent.quickCheckQuestions || [])];
                                    updated[index] = { ...q, question: e.target.value };
                                    setLessonContent({ ...lessonContent, quickCheckQuestions: updated });
                                  }}
                                  placeholder="Question"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                />
                                <input
                                  type="text"
                                  value={q.answer}
                                  onChange={(e) => {
                                    const updated = [...(lessonContent.quickCheckQuestions || [])];
                                    updated[index] = { ...q, answer: e.target.value };
                                    setLessonContent({ ...lessonContent, quickCheckQuestions: updated });
                                  }}
                                  placeholder="Answer"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                />
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => {
                                      const updated = lessonContent.quickCheckQuestions?.filter((_, i) => i !== index) || [];
                                      setLessonContent({ ...lessonContent, quickCheckQuestions: updated });
                                    }}
                                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              setLessonContent({
                                ...lessonContent,
                                quickCheckQuestions: [...(lessonContent.quickCheckQuestions || []), { question: '', answer: '' }]
                              });
                            }}
                            className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600"
                          >
                            + Add Question
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'videos' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">Videos</h3>
                        <button
                          onClick={addVideo}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                        >
                          + Add Video
                        </button>
                      </div>
                      {lessonContent.videos?.map(video => (
                        <div key={video.id} className="p-4 border border-slate-200 rounded-lg">
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={video.title || ''}
                              onChange={(e) => updateVideo(video.id, { title: e.target.value })}
                              placeholder="Video Title"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />

                            {/* Video URL or Upload */}
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-slate-700">Video Source</label>
                              <div className="flex gap-2">
                                <input
                                  type="url"
                                  value={video.url || ''}
                                  onChange={(e) => updateVideo(video.id, { url: e.target.value })}
                                  placeholder="Video URL (YouTube, Vimeo, or paste URL)"
                                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                                />
                                <span className="flex items-center text-slate-400">or</span>
                                <label className="relative cursor-pointer">
                                  <input
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleVideoUpload(video.id, file);
                                    }}
                                    className="hidden"
                                    disabled={uploadingVideoFor === video.id}
                                  />
                                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${uploadingVideoFor === video.id
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}>
                                    {uploadingVideoFor === video.id ? (
                                      <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Uploading...
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        Upload File
                                      </>
                                    )}
                                  </span>
                                </label>
                              </div>
                              {video.url && (
                                <p className="text-xs text-slate-500 truncate">
                                  Current: {video.url}
                                </p>
                              )}
                            </div>

                            <textarea
                              value={video.description || ''}
                              onChange={(e) => updateVideo(video.id, { description: e.target.value })}
                              placeholder="Description"
                              rows={2}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />

                            {/* Video Preview */}
                            {video.url && (
                              <div className="mt-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Preview</label>
                                {video.url.includes('youtube.com') || video.url.includes('youtu.be') ? (
                                  <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
                                    <iframe
                                      src={video.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                                      className="w-full h-full"
                                      allowFullScreen
                                    />
                                  </div>
                                ) : video.url.includes('vimeo.com') ? (
                                  <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
                                    <iframe
                                      src={video.url.replace('vimeo.com/', 'player.vimeo.com/video/')}
                                      className="w-full h-full"
                                      allowFullScreen
                                    />
                                  </div>
                                ) : (
                                  <video
                                    src={video.url}
                                    controls
                                    className="w-full max-h-64 rounded-lg bg-slate-900"
                                  />
                                )}
                              </div>
                            )}

                            <div className="flex justify-end">
                              <button
                                onClick={() => deleteVideo(video.id)}
                                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'quizzes' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">Quizzes</h3>
                        <button
                          onClick={addQuiz}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                        >
                          + Add Quiz
                        </button>
                      </div>
                      {lessonContent.quizzes?.map(quiz => (
                        <div key={quiz.id} className="p-4 border border-slate-200 rounded-lg">
                          <input
                            type="text"
                            value={quiz.title}
                            onChange={(e) => updateQuiz(quiz.id, { title: e.target.value })}
                            placeholder="Quiz Title"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-3 font-semibold"
                          />
                          <textarea
                            value={quiz.description || ''}
                            onChange={(e) => updateQuiz(quiz.id, { description: e.target.value })}
                            placeholder="Quiz Description"
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-3"
                          />
                          <div className="mb-3">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Time Limit (minutes)</label>
                            <input
                              type="number"
                              value={quiz.timeLimit || ''}
                              onChange={(e) => updateQuiz(quiz.id, { timeLimit: parseInt(e.target.value) || undefined })}
                              placeholder="Optional"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                          </div>
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-slate-700">
                                Questions ({quiz.questions?.length || 0})
                              </p>
                              <button
                                onClick={() => {
                                  const newQuestion = {
                                    id: `q-${Date.now()}`,
                                    question: '',
                                    type: 'multiple-choice' as const,
                                    options: ['', '', '', ''],
                                    correctAnswer: 0,
                                    points: 1
                                  };
                                  updateQuiz(quiz.id, {
                                    questions: [...(quiz.questions || []), newQuestion]
                                  });
                                }}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                              >
                                + Add Question
                              </button>
                            </div>
                            <div className="space-y-3">
                              {quiz.questions?.map((q, qIdx) => (
                                <div key={q.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={q.question}
                                      onChange={(e) => {
                                        const updated = [...(quiz.questions || [])];
                                        updated[qIdx] = { ...q, question: e.target.value };
                                        updateQuiz(quiz.id, { questions: updated });
                                      }}
                                      placeholder="Question text"
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                    />
                                    <select
                                      value={q.type}
                                      onChange={(e) => {
                                        const updated = [...(quiz.questions || [])];
                                        updated[qIdx] = { ...q, type: e.target.value as any };
                                        updateQuiz(quiz.id, { questions: updated });
                                      }}
                                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    >
                                      <option value="multiple-choice">Multiple Choice</option>
                                      <option value="true-false">True/False</option>
                                      <option value="short-answer">Short Answer</option>
                                      <option value="essay">Essay</option>
                                    </select>
                                    {q.type === 'multiple-choice' && (
                                      <div className="space-y-2">
                                        {q.options?.map((opt, optIdx) => (
                                          <div key={optIdx} className="flex items-center gap-2">
                                            <input
                                              type="radio"
                                              name={`correct-${q.id}`}
                                              checked={q.correctAnswer === optIdx}
                                              onChange={() => {
                                                const updated = [...(quiz.questions || [])];
                                                updated[qIdx] = { ...q, correctAnswer: optIdx };
                                                updateQuiz(quiz.id, { questions: updated });
                                              }}
                                            />
                                            <input
                                              type="text"
                                              value={opt}
                                              onChange={(e) => {
                                                const updated = [...(quiz.questions || [])];
                                                const newOptions = [...(q.options || [])];
                                                newOptions[optIdx] = e.target.value;
                                                updated[qIdx] = { ...q, options: newOptions };
                                                updateQuiz(quiz.id, { questions: updated });
                                              }}
                                              placeholder={`Option ${optIdx + 1}`}
                                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {(q.type === 'true-false' || q.type === 'short-answer' || q.type === 'essay') && (
                                      <input
                                        type="text"
                                        value={typeof q.correctAnswer === 'string' ? q.correctAnswer : ''}
                                        onChange={(e) => {
                                          const updated = [...(quiz.questions || [])];
                                          updated[qIdx] = { ...q, correctAnswer: e.target.value };
                                          updateQuiz(quiz.id, { questions: updated });
                                        }}
                                        placeholder="Correct answer"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                      />
                                    )}
                                    <div className="flex items-center justify-between">
                                      <input
                                        type="number"
                                        value={q.points || 1}
                                        onChange={(e) => {
                                          const updated = [...(quiz.questions || [])];
                                          updated[qIdx] = { ...q, points: parseInt(e.target.value) || 1 };
                                          updateQuiz(quiz.id, { questions: updated });
                                        }}
                                        placeholder="Points"
                                        className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm"
                                      />
                                      <button
                                        onClick={() => {
                                          const updated = (quiz.questions || []).filter((_, idx) => idx !== qIdx);
                                          updateQuiz(quiz.id, { questions: updated });
                                        }}
                                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => deleteQuiz(quiz.id)}
                              className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              Delete Quiz
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'images' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">Images</h3>
                        <button
                          onClick={addImage}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                        >
                          + Add Image
                        </button>
                      </div>
                      {lessonContent.images?.map(image => (
                        <div key={image.id} className="p-4 border border-slate-200 rounded-lg">
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={image.title || ''}
                              onChange={(e) => updateImage(image.id, { title: e.target.value })}
                              placeholder="Image Title"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                            <input
                              type="url"
                              value={image.url}
                              onChange={(e) => updateImage(image.id, { url: e.target.value })}
                              placeholder="Image URL"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                            <input
                              type="text"
                              value={image.alt || ''}
                              onChange={(e) => updateImage(image.id, { alt: e.target.value })}
                              placeholder="Alt Text"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                            <textarea
                              value={image.caption || ''}
                              onChange={(e) => updateImage(image.id, { caption: e.target.value })}
                              placeholder="Caption"
                              rows={2}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                            <div className="flex justify-end">
                              <button
                                onClick={() => deleteImage(image.id)}
                                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'notes' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">Notes</h3>
                        <button
                          onClick={addNote}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                        >
                          + Add Note
                        </button>
                      </div>
                      {lessonContent.notes?.map(note => (
                        <div key={note.id} className="p-4 border border-slate-200 rounded-lg">
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={note.title}
                              onChange={(e) => updateNote(note.id, { title: e.target.value })}
                              placeholder="Note Title"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                            />
                            <textarea
                              value={note.content}
                              onChange={(e) => updateNote(note.id, { content: e.target.value })}
                              placeholder="Note Content (supports markdown/HTML)"
                              rows={6}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                            />
                            <div className="flex justify-end">
                              <button
                                onClick={() => deleteNote(note.id)}
                                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Chapter Modal */}
      {showNewChapterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Create New Chapter</h3>
              <p className="text-sm text-slate-500 mt-1">
                Add a new chapter to {subjectsWithChapters.find(s => s.id === selectedSubjectId)?.name || 'the selected subject'}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Chapter Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newChapterName}
                  onChange={(e) => setNewChapterName(e.target.value)}
                  placeholder="e.g., Chapter 1: Introduction to Physics"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={newChapterDescription}
                  onChange={(e) => setNewChapterDescription(e.target.value)}
                  placeholder="A brief description of what this chapter covers..."
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewChapterModal(false);
                  setNewChapterName('');
                  setNewChapterDescription('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                disabled={isCreatingChapter}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewChapter}
                disabled={isCreatingChapter || !newChapterName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreatingChapter ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create Chapter'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminLessonEditorPage;
