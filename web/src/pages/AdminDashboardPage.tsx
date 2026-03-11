import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useVoiceAgent } from '../components/VoiceAgentProvider';
import { apiUrl } from '../utils/api';

interface AdminFeature {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  color: string;
}

const adminFeatures: AdminFeature[] = [
  {
    title: 'Upload & Parse',
    description: 'Upload textbook PDFs or documents and extract chapters and sections using AI-powered parsing.',
    path: '/admin/upload',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    color: 'from-blue-500 to-blue-600',
  },
  {
    title: 'Chapter Review',
    description: 'Review and edit parsed chapters, generate AI lessons, and import content to the database.',
    path: '/admin/review',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'from-purple-500 to-purple-600',
  },
  {
    title: 'Lesson Editor',
    description: 'Edit existing lessons, add videos, quizzes, images, and notes to enhance learning content.',
    path: '/admin/editor',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    color: 'from-green-500 to-green-600',
  },
  {
    title: 'Learning Roadmaps',
    description: 'Generate and visualize tailored learning roadmaps for students based on their profile and goals using AI.',
    path: '/admin/roadmap',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    color: 'from-amber-500 to-orange-600',
  },
];

const upcomingFeatures = [
  {
    title: 'Analytics Dashboard',
    description: 'View student progress, engagement metrics, and learning analytics.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: 'User Management',
    description: 'Manage teachers, students, and their permissions.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    title: 'Curriculum Builder',
    description: 'Create and organize curriculum structures, subjects, and learning paths.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    title: 'Assessment Creator',
    description: 'Create tests, assignments, and practice exercises.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

function AdminDashboardPage() {
  const [isZenMode, setIsZenMode] = useState(false);
  const { startListening, stopListening } = useVoiceAgent();
  const [visualState, setVisualState] = useState<{ description: string, type: string, mermaidCode?: string } | null>(null);

  useEffect(() => {
    const handleVisualUpdate = (e: any) => {
      setVisualState(e.detail);
    };
    window.addEventListener('visual-canvas-update', handleVisualUpdate);
    return () => window.removeEventListener('visual-canvas-update', handleVisualUpdate);
  }, []);

  useEffect(() => {
    if (isZenMode) {
      startListening();
    } else {
      stopListening();
    }
  }, [isZenMode, startListening, stopListening]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 overflow-hidden">
      <div className={`transition-all duration-1000 ease-in-out ${isZenMode ? 'blur-xl opacity-0 scale-95 -translate-y-4 pointer-events-none' : 'blur-none opacity-100 scale-100 translate-y-0'}`}>
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Admin Dashboard</h1>
                  <p className="text-xs text-slate-500">Manage content and settings</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsZenMode(!isZenMode)}
                  className={`p-3 rounded-xl border-2 transition-all font-bold font-display ${isZenMode ? 'bg-secondary-500 text-white border-secondary-600 shadow-sm transform -translate-y-0.5' : 'bg-surface-100 text-surface-600 border-surface-200 hover:bg-surface-200 hover:border-surface-300'}`}
                  title="Toggle Zen Mode"
                >
                  {isZenMode ? 'Exit Zen Mode' : 'Zen Mode 🧘‍♂️'}
                </button>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to App
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome, Teacher!</h2>
            <p className="text-slate-600">
              Create and manage educational content for your students. Select a tool below to get started.
            </p>
          </div>

          {/* Main Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {adminFeatures.map((feature) => (
              <Link
                key={feature.path}
                to={feature.path}
                className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-slate-200 hover:border-transparent"
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

                <div className="p-6">
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    {feature.icon}
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Arrow indicator */}
                  <div className="mt-4 flex items-center text-sm font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Get Started</span>
                    <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Coming Soon Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-800">Coming Soon</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              These features are currently in development and will be available soon.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {upcomingFeatures.map((feature, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 opacity-60"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 mb-3">
                    {feature.icon}
                  </div>
                  <h4 className="font-medium text-slate-700 text-sm mb-1">{feature.title}</h4>
                  <p className="text-xs text-slate-500">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats (placeholder) */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Lessons', value: '—', icon: '📚' },
              { label: 'Active Students', value: '—', icon: '👥' },
              { label: 'Subjects', value: '—', icon: '📖' },
              { label: 'Quizzes Created', value: '—', icon: '✅' },
            ].map((stat, index) => (
              <div key={index} className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{stat.icon}</span>
                  <span className="text-2xl font-bold text-slate-800">{stat.value}</span>
                </div>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Zen Mode Overlay */}
      <div
        className={`fixed inset-0 bg-white/95 backdrop-blur-sm z-50 transition-all duration-1000 ease-in-out overflow-y-auto ${isZenMode ? 'opacity-100 pointer-events-auto delay-300' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="min-h-full w-full flex flex-col items-center justify-center py-12">
          {isZenMode && (
            <div className="text-center w-full max-w-4xl px-8 flex flex-col items-center justify-center">
              <div className="flex items-center justify-center gap-2 mb-12 h-24">
                <style>
                  {`
                  @keyframes waveform {
                    0% { transform: scaleY(0.3); opacity: 0.5; }
                    100% { transform: scaleY(1); opacity: 1; }
                  }
                  .wave-bar {
                    animation: waveform 0.8s ease-in-out infinite alternate;
                    transform-origin: bottom;
                  }
                `}
                </style>
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div
                    key={i}
                    className="w-4 bg-gradient-to-t from-secondary-400 to-tertiary-500 rounded-full wave-bar shadow-lg shadow-secondary-400/30"
                    style={{
                      height: '100%',
                      animationDelay: `${i * 0.15}s`,
                      animationDuration: `${0.6 + (i % 3) * 0.1}s`
                    }}
                  ></div>
                ))}
              </div>

              <h2 className="text-5xl font-black font-display text-surface-800 tracking-tight mb-4">
                Admin Hands-Free Mode
              </h2>
              <p className="text-xl font-bold text-surface-500 max-w-2xl text-center mb-16">
                Speak to manage curriculum, review chapters, or generate learning roadmaps.
              </p>

              {/* Visual Canvas */}
              <div className="w-full max-w-4xl min-h-[400px] bg-surface-100 rounded-3xl border-4 border-dashed border-surface-300 flex items-center justify-center relative overflow-hidden transition-all duration-500 group hover:border-secondary-300 backdrop-blur-sm shadow-2xl p-4">
                {visualState ? (
                  visualState.type === 'image_prompt' ? (
                    <img
                      src={apiUrl(`/api/story/diagram?q=${encodeURIComponent(visualState.description)}`)}
                      alt={visualState.description}
                      className="max-w-full max-h-[400px] object-contain animate-fade-in mix-blend-multiply"
                    />
                  ) : (
                    <div className="p-8 text-left bg-white/90 w-full h-full overflow-auto text-sm text-surface-700 font-mono animate-fade-in shadow-inner rounded-2xl">
                      <pre className="whitespace-pre-wrap">{visualState.mermaidCode || visualState.description}</pre>
                    </div>
                  )
                ) : (
                  <p className="text-surface-400 font-bold tracking-widest uppercase text-sm group-hover:text-secondary-400 transition-colors">Visual Canvas</p>
                )}
              </div>

              <button
                onClick={() => setIsZenMode(false)}
                className="mt-12 px-8 py-4 bg-surface-200 hover:bg-surface-300 text-surface-700 font-bold rounded-2xl transition-all"
              >
                Exit Zen Mode
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
