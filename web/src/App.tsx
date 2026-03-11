import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import Dashboard from './pages/Dashboard';
import CallPage from './pages/CallPage';
import UploadPage from './pages/UploadPage';
import ChapterReviewPage from './pages/ChapterReviewPage';
import ParseResultPage from './pages/ParseResultPage';
import UserSetupPage from './pages/UserSetupPage';
import { LessonPage } from './pages/LessonPage';
import { ChapterPage } from './pages/ChapterPage';
import { MicrosectionPage } from './pages/MicrosectionPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUploadPage from './pages/AdminUploadPage';
import AdminChapterReviewPage from './pages/AdminChapterReviewPage';
import AdminLessonEditorPage from './pages/AdminLessonEditorPage';
import AdminRoadmapPage from './pages/AdminRoadmapPage';
import { AdminRoute } from './components/AdminRoute';
import AccessibilityGuidePage from './pages/AccessibilityGuidePage';
import { AuthProvider } from './context/AuthContext';
import { VoiceAgentProvider } from './components/VoiceAgentProvider';
import { VoiceAgentControls } from './components/VoiceAgentControls';
import { AccessibilityProvider } from './components/accessibility/AccessibilityProvider';
import { LanguageProvider } from './components/i18n/LanguageProvider';

function AppInner() {
  const location = useLocation();
  const showVoiceControls = location.pathname !== '/call';

  return (
    <AccessibilityProvider>
      <AuthProvider>
        <LanguageProvider>
          <VoiceAgentProvider>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <main id="main-content">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/call" element={<CallPage />} />
                <Route path="/parse" element={<UploadPage />} />
                <Route path="/parse/review" element={<ChapterReviewPage />} />
                <Route path="/parse/result" element={<ParseResultPage />} />
                <Route
                  path="/setup"
                  element={
                    <ProtectedRoute>
                      <UserSetupPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute requireSetup={true}>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                {/* Chapter page - shows sections within a chapter (structured style) */}
                <Route
                  path="/:classId/:subjectId/:chapterSlug"
                  element={<ChapterPage />}
                />
                {/* Microsection page - individual content (article, video, quiz, practice) */}
                <Route
                  path="/:classId/:subjectId/:chapterSlug/:sectionSlug/:microsectionId"
                  element={<MicrosectionPage />}
                />
                {/* Legacy lesson page - fallback */}
                <Route
                  path="/:classId/:subjectId/:unit/lesson"
                  element={<LessonPage />}
                />
                {/* Admin Routes - Protected */}
                <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
                <Route path="/admin/upload" element={<AdminRoute><AdminUploadPage /></AdminRoute>} />
                <Route path="/admin/review" element={<AdminRoute><AdminChapterReviewPage /></AdminRoute>} />
                <Route path="/admin/editor" element={<AdminRoute><AdminLessonEditorPage /></AdminRoute>} />
                <Route path="/admin/editor/:lessonId" element={<AdminRoute><AdminLessonEditorPage /></AdminRoute>} />
                <Route path="/admin/roadmap" element={<AdminRoute><AdminRoadmapPage /></AdminRoute>} />
                <Route path="/accessibility-guide" element={<AccessibilityGuidePage />} />
              </Routes>
            </main>
            {showVoiceControls && <VoiceAgentControls />}
          </VoiceAgentProvider>
        </LanguageProvider>
      </AuthProvider>
    </AccessibilityProvider>
  );
}

function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}

export default App;
