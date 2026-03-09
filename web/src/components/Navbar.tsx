import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface StudentProfile {
  id: string;
  name: string;
  grade: string;
  preferences: {
    pace: 'slow' | 'medium' | 'fast';
    verbosity: 'concise' | 'moderate' | 'detailed';
  };
}

interface NavbarProps {
  currentProfile: StudentProfile;
  onProfileChange: (profile: StudentProfile) => void;
  studentProfiles: StudentProfile[];
}

export const Navbar = ({ currentProfile, onProfileChange, studentProfiles }: NavbarProps) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  console.log('Navbar render - user:', user);

  const handleProfileChange = (profileId: string) => {
    const profile = studentProfiles.find(p => p.id === profileId);
    if (profile) onProfileChange(profile);
  };

  const handleSettingsClick = () => {
    setIsUserMenuOpen(false);
  };

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-primary-100/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-500 border-2 border-primary-600 rounded-2xl flex items-center justify-center shadow-[0_4px_0_0_var(--color-primary-600)] transform -rotate-3 hover:rotate-0 transition-transform">
              <span className="text-white text-xl font-bold font-display">A</span>
            </div>
            <h1 className="text-2xl font-bold text-surface-800 font-display tracking-tight">
              Learn<span className="text-primary-500">Hub</span>
            </h1>
          </div>

          {/* Profile Info & Switcher */}
          <div className="flex items-center gap-4">
            <div className="text-right mr-4">
              <p className="text-sm font-semibold text-surface-900">{currentProfile.name}</p>
              <p className="text-xs text-surface-600">
                {currentProfile.grade} • Pace: {currentProfile.preferences.pace}
              </p>
            </div>

            <select
              aria-label="Switch Student Profile"
              value={currentProfile.id}
              onChange={(e) => handleProfileChange(e.target.value)}
              className="px-4 py-2 bg-white border-2 border-surface-200 rounded-2xl font-bold text-surface-700 cursor-pointer shadow-[0_4px_0_0_var(--color-surface-200)] hover:bg-surface-50 active:translate-y-1 active:shadow-none transition-all outline-none focus-visible:ring-2 focus-visible:ring-secondary-500"
            >
              {studentProfiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>

            {/* User Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
                className="btn-3d btn-3d-secondary flex items-center gap-3 px-5 py-2.5 bg-secondary-500 text-white rounded-2xl border-2 border-secondary-600 font-bold hover:bg-secondary-400"
              >
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-sm font-bold font-display">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
                </div>
                <span className="text-sm tracking-wide">{user?.name || 'User'}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-surface-200 py-2 z-50">
                  <button
                    onClick={() => {
                      navigate('/');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Homepage
                  </button>
                  <button
                    onClick={handleSettingsClick}
                    className="w-full text-left px-4 py-2 text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
