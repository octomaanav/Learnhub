import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../utils/api';

interface RoadmapStep {
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
}

export default function AdminRoadmapPage() {
    const [profile, setProfile] = useState('High school student with basic math knowledge');
    const [goal, setGoal] = useState('Learn machine learning from scratch');
    const [isGenerating, setIsGenerating] = useState(false);
    const [roadmap, setRoadmap] = useState<RoadmapStep[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const generateRoadmap = async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const response = await fetch(apiUrl('/api/admin/generate-roadmap'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ profile, goal })
            });

            if (!response.ok) throw new Error('Failed to generate roadmap');

            const data = await response.json();

            if (Array.isArray(data.roadmap)) {
                setRoadmap(data.roadmap);
            } else if (typeof data.roadmap === 'string') {
                try {
                    setRoadmap(JSON.parse(data.roadmap));
                } catch (e) {
                    setRoadmap([{ title: "Generated Plan", description: data.roadmap, status: "pending" }]);
                }
            } else {
                setRoadmap([]);
            }

        } catch (err: any) {
            setError(err.message || 'Error generating roadmap');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStepChange = (index: number, field: keyof RoadmapStep, value: string) => {
        if (!roadmap) return;
        const newRoadmap = [...roadmap];
        newRoadmap[index] = { ...newRoadmap[index], [field]: value };
        setRoadmap(newRoadmap);
    };

    const addStep = () => {
        if (!roadmap) return;
        setRoadmap([...roadmap, { title: 'New Step', description: 'Description', status: 'pending' }]);
    };

    const deleteStep = (index: number) => {
        if (!roadmap) return;
        const newRoadmap = roadmap.filter((_, i) => i !== index);
        setRoadmap(newRoadmap);
    };

    const downloadPdf = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-slate-50 print:bg-white">
            {/* Header - hide when printing */}
            <header className="bg-white border-b border-slate-200 print:hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <Link to="/admin" className="text-indigo-600 hover:text-indigo-800">
                                ← Back to Dashboard
                            </Link>
                            <h1 className="text-xl font-bold text-slate-800 ml-4">AI Learning Roadmap Generator</h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:py-0 print:px-0 auto-page-break">
                {/* Inputs - hide when printing */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 my-4 print:hidden">
                    <h2 className="text-2xl font-bold mb-6">Generate New Roadmap</h2>
                    <div className="grid gap-6 mb-8">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Student Profile</label>
                            <textarea
                                value={profile}
                                onChange={(e) => setProfile(e.target.value)}
                                className="w-full h-24 p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                placeholder="e.g. 10th grade student struggling with algebra..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Learning Goal</label>
                            <textarea
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                className="w-full h-24 p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                placeholder="e.g. Master quadratic equations before final exams..."
                            />
                        </div>
                    </div>
                    <button
                        onClick={generateRoadmap}
                        disabled={isGenerating}
                        className={`px-8 py-3 rounded-xl font-bold text-white transition-all ${isGenerating ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md'}`}
                    >
                        {isGenerating ? 'Analyzing & Generating...' : 'Generate Interactive Roadmap'}
                    </button>
                    {error && <p className="text-red-500 mt-4">{error}</p>}
                </div>

                {roadmap && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-fade-in print:shadow-none print:border-none print:p-0">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-3xl font-black text-slate-800 tracking-tight">Interactive Learning Path</h3>
                                <p className="text-slate-500 mt-2 print:hidden">Click any step to edit. Drag to reorder. Download as PDF when ready.</p>
                            </div>
                            <div className="print:hidden">
                                <button
                                    onClick={downloadPdf}
                                    className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-md transition-all"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download PDF
                                </button>
                            </div>
                        </div>

                        {/* Printable Target Data */}
                        <div className="hidden print:block mb-8 pb-6 border-b-2 border-slate-900">
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Student Profile</h4>
                                    <p className="font-medium text-slate-800 text-lg">{profile}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Target Goal</h4>
                                    <p className="font-medium text-slate-800 text-lg">{goal}</p>
                                </div>
                            </div>
                        </div>

                        {/* Interactive List */}
                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-1 before:bg-gradient-to-b before:from-transparent before:via-indigo-200 before:to-transparent">
                            {roadmap.map((step, index) => (
                                <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-indigo-500 text-white font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 print:border-indigo-500 print:text-indigo-500 print:bg-white print:border-2">
                                        {index + 1}
                                    </div>
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow group-hover:border-indigo-300 print:shadow-none print:border-slate-300 relative group/card">

                                        <button onClick={() => deleteStep(index)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover/card:opacity-100 transition-opacity print:hidden">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>

                                        <input
                                            value={step.title}
                                            onChange={(e) => handleStepChange(index, 'title', e.target.value)}
                                            className="font-bold text-lg text-slate-800 w-[90%] outline-none border-b border-transparent focus:border-indigo-300 hover:border-slate-200 bg-transparent transition-colors print:border-transparent"
                                        />
                                        <textarea
                                            value={step.description}
                                            onChange={(e) => handleStepChange(index, 'description', e.target.value)}
                                            className="mt-2 text-slate-600 w-full outline-none resize-none border-b border-transparent focus:border-indigo-300 hover:border-slate-200 bg-transparent transition-colors print:border-transparent"
                                            rows={3}
                                        />
                                        <div className="mt-4 flex items-center gap-2 print:hidden">
                                            <select
                                                value={step.status || 'pending'}
                                                onChange={(e) => handleStepChange(index, 'status', e.target.value)}
                                                className="text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-600 rounded px-2 py-1 outline-none cursor-pointer"
                                            >
                                                <option value="pending">Upcoming</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 text-center print:hidden">
                            <button
                                onClick={addStep}
                                className="px-6 py-2 border-2 border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 rounded-xl font-medium transition-all"
                            >
                                + Add Custom Step
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
