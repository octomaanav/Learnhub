import { useState, useEffect } from 'react';
import { apiUrl } from '../utils/api';
import { useNavigate, useParams } from 'react-router-dom';
import { LessonViewer } from "../components/LessonViewer";
import type { UnitLessons } from '../types';
import { useAuth } from '../hooks/useAuth';

export const LessonPage = () => {
  const navigate = useNavigate();
  const { classId, subjectId, unit: chapterSlug } = useParams<{
    classId: string;
    subjectId: string;
    unit: string;
  }>();

  const { user } = useAuth();

  const [book, setBook] = useState<UnitLessons[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);

  // Resolve chapter ID from slug
  useEffect(() => {
    const resolveChapterId = async () => {
      if (!classId || !subjectId || !chapterSlug) {
        setError('Missing route parameters.');
        setIsLoading(false);
        return;
      }

      if (!user?.profile?.curriculumId) {
        setError('User profile not available.');
        setIsLoading(false);
        return;
      }

      try {
        // Fetch subjects to find the chapter by slug
        // Note: classId in route might be a slug, so we need to resolve it
        // For now, try using it directly as ID, or we could look it up
        const response = await fetch(apiUrl(`/api/curriculum/${user.profile.curriculumId}/grades/${classId}/subjects`));
        if (!response.ok) {
          throw new Error('Failed to fetch subjects');
        }

        const subjects = await response.json();
        const subject = subjects.find((s: { slug: string; chapters: { slug: string; id: string }[] }) => s.slug === subjectId);

        if (!subject) {
          throw new Error('Subject not found');
        }

        const chapter = subject.chapters.find((c: { slug: string; id: string }) => c.slug === chapterSlug);

        if (!chapter) {
          throw new Error('Chapter not found');
        }

        setChapterId(chapter.id);
      } catch (err) {
        console.error('Error resolving chapter:', err);
        setError(err instanceof Error ? err.message : 'Failed to resolve chapter.');
        setIsLoading(false);
      }
    };

    resolveChapterId();
  }, [classId, subjectId, chapterSlug, user?.profile?.curriculumId]);

  useEffect(() => {
    const fetchLessons = async () => {
      if (!chapterId) {
        return; // Wait for chapter ID to be resolved
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(apiUrl(`/api/lessons/chapter/${chapterId}`));

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch lessons' }));
          throw new Error(errorData.error || `Server returned ${response.status}`);
        }

        const data: UnitLessons[] = await response.json();

        if (!data || data.length === 0) {
          setError('No lessons found for this chapter.');
          setIsLoading(false);
          return;
        }

        setBook(data);
      } catch (err) {
        console.error('Error fetching lessons:', err);
        setError(err instanceof Error ? err.message : 'Failed to load lessons. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLessons();
  }, [chapterId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface-50 via-primary-50/30 to-secondary-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-surface-600">Loading lessons...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface-50 via-primary-50/30 to-secondary-50/20 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">Error Loading Lessons</h2>
          <p className="text-surface-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 border-2 border-surface-200 text-surface-700 rounded-lg font-semibold hover:bg-surface-50 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (book.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface-50 via-primary-50/30 to-secondary-50/20 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-surface-200 p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">No Lessons Available</h2>
          <p className="text-surface-600 mb-6">This chapter doesn't have any lessons yet.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <LessonViewer book={book} autoStartNarration={false} />
    </div>
  );
};
