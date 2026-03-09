import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ParsedUnit } from '../types';
import { clearAllFiles } from '../utils/fileStorage';

function ParseResultPage() {
  const [units, setUnits] = useState<ParsedUnit[]>(() => {
    const storedUnits = sessionStorage.getItem('parsedUnits');
    return storedUnits ? JSON.parse(storedUnits) : [];
  });
  const [expandedUnit, setExpandedUnit] = useState<number | null>(0);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (units.length === 0) {
      navigate('/parse');
    }
  }, [units, navigate]);

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(units, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'parsed-textbook.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleStartOver = async () => {
    // Clear IndexedDB
    await clearAllFiles();
    // Clear sessionStorage
    sessionStorage.removeItem('uploadedFileName');
    sessionStorage.removeItem('parsedChapters');
    sessionStorage.removeItem('parsedUnits');
    navigate('/parse');
  };

  const totalSections = units.reduce((acc, unit) => acc + unit.sections.length, 0);
  const totalGoals = units.reduce((acc, unit) =>
    acc + unit.sections.reduce((sAcc, section) => sAcc + section.learningGoals.length, 0), 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-primary-50/30 to-secondary-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-primary-100/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-surface-900">Parsing Complete!</h1>
                <p className="text-sm text-surface-500">
                  {units.length} units • {totalSections} sections • {totalGoals} learning goals
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleStartOver}
                className="px-4 py-2 text-surface-600 hover:bg-surface-100 font-medium rounded-lg transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleDownloadJSON}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download JSON
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b border-surface-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary-600">{units.length}</p>
              <p className="text-sm text-surface-500">Units/Chapters</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-secondary-600">{totalSections}</p>
              <p className="text-sm text-surface-500">Sections</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-accent-600">{totalGoals}</p>
              <p className="text-sm text-surface-500">Learning Goals</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {units.map((unit, unitIdx) => (
            <div
              key={unitIdx}
              className="bg-white rounded-xl border border-surface-200 overflow-hidden shadow-sm"
            >
              {/* Unit Header */}
              <div
                className="p-5 cursor-pointer hover:bg-surface-50 transition-colors"
                onClick={() => setExpandedUnit(expandedUnit === unitIdx ? null : unitIdx)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${unitIdx % 3 === 0 ? 'bg-gradient-to-br from-primary-500 to-primary-600' :
                        unitIdx % 3 === 1 ? 'bg-gradient-to-br from-secondary-500 to-secondary-600' :
                          'bg-gradient-to-br from-accent-500 to-accent-600'
                      }`}>
                      {unitIdx + 1}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-surface-900">{unit.unitTitle}</h2>
                      <p className="text-sm text-surface-600 mt-1">{unit.unitDescription}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-surface-500 bg-surface-100 px-2 py-1 rounded">
                          {unit.sections.length} sections
                        </span>
                        <span className="text-xs text-surface-500 bg-surface-100 px-2 py-1 rounded">
                          {unit.sections.reduce((acc, s) => acc + s.learningGoals.length, 0)} goals
                        </span>
                      </div>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-surface-400 transition-transform mt-1 ${expandedUnit === unitIdx ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Sections */}
              {expandedUnit === unitIdx && (
                <div className="border-t border-surface-200">
                  {unit.sections.map((section, sectionIdx) => {
                    const sectionKey = `${unitIdx}-${sectionIdx}`;
                    const isExpanded = expandedSection === sectionKey;

                    return (
                      <div
                        key={sectionIdx}
                        className="border-b border-surface-100 last:border-b-0"
                      >
                        {/* Section Header */}
                        <div
                          className="px-5 py-4 cursor-pointer hover:bg-surface-50 transition-colors flex items-center gap-4"
                          onClick={() => setExpandedSection(isExpanded ? null : sectionKey)}
                        >
                          <span className="text-sm font-mono font-semibold text-primary-600 w-12">
                            {section.sectionId}
                          </span>
                          <div className="flex-1">
                            <h3 className="font-semibold text-surface-900">{section.title}</h3>
                            <p className="text-sm text-surface-500 mt-0.5">{section.description}</p>
                          </div>
                          <span className="text-xs text-surface-400 bg-surface-100 px-2 py-1 rounded">
                            {section.learningGoals.length} goals
                          </span>
                          <svg
                            className={`w-4 h-4 text-surface-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {/* Learning Goals */}
                        {isExpanded && (
                          <div className="px-5 pb-4 pl-20">
                            <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg p-4 border border-primary-100">
                              <h4 className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-3">
                                Learning Goals
                              </h4>
                              <ul className="space-y-2">
                                {section.learningGoals.map((goal, goalIdx) => (
                                  <li key={goalIdx} className="flex items-start gap-2">
                                    <svg className="w-5 h-5 text-accent-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-sm text-surface-700">{goal}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* JSON Preview */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-surface-900">Raw JSON Output</h2>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(units, null, 2));
                alert('JSON copied to clipboard!');
              }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy to Clipboard
            </button>
          </div>
          <div className="bg-surface-900 rounded-xl p-6 overflow-auto max-h-96">
            <pre className="text-sm text-surface-100 font-mono whitespace-pre-wrap">
              {JSON.stringify(units, null, 2)}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ParseResultPage;
