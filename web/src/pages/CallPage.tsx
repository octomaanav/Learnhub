import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVoiceAgent } from '../components/VoiceAgentProvider';

const DOT_COUNT = 28;

function DNACanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;
    const dpr = window.devicePixelRatio || 1;

    const W = 320;
    const H = 60;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      const t = frameRef.current * 0.025;
      frameRef.current++;
      ctx.clearRect(0, 0, W, H);

      const cy = H / 2;
      const amp = 14;
      const pts1: { x: number; y: number; z: number }[] = [];
      const pts2: { x: number; y: number; z: number }[] = [];

      for (let i = 0; i < DOT_COUNT; i++) {
        const frac = i / (DOT_COUNT - 1);
        const x = 16 + frac * (W - 32);
        const twist = frac * Math.PI * 4 + t;
        const y1 = cy + Math.sin(twist) * amp;
        const z1 = Math.cos(twist);
        const y2 = cy + Math.sin(twist + Math.PI) * amp;
        const z2 = Math.cos(twist + Math.PI);
        pts1.push({ x, y: y1, z: z1 });
        pts2.push({ x, y: y2, z: z2 });
      }

      // Rungs
      for (let i = 0; i < DOT_COUNT; i += 2) {
        const midZ = (pts1[i].z + pts2[i].z) / 2;
        const a = 0.06 + 0.1 * ((midZ + 1) / 2);
        ctx.beginPath();
        ctx.moveTo(pts1[i].x, pts1[i].y);
        ctx.lineTo(pts2[i].x, pts2[i].y);
        ctx.strokeStyle = `hsla(260, 70%, 70%, ${a})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Strand helper
      const drawStrand = (pts: typeof pts1, hue: number) => {
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
          else ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.strokeStyle = `hsla(${hue}, 85%, 65%, 0.6)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        for (const p of pts) {
          const df = (p.z + 1) / 2;
          const r = 1 + df * 1.5;
          const a = 0.25 + df * 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${a})`;
          ctx.fill();
        }
      };

      drawStrand(pts1, 220);
      drawStrand(pts2, 290);

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} className="relative z-10" />;
}

const CallPage: React.FC = () => {
  const { isListening, startListening, stopListening } = useVoiceAgent();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isListening) {
      startListening();
    }
  }, [isListening, startListening]);

  const handleEnd = () => {
    stopListening();
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-50 flex flex-col items-center justify-center px-4 select-none">
      {/* Horizontal DNA strand */}
      <div className="relative mb-6">
        <div className="absolute inset-[-20px] bg-gradient-to-r from-blue-600/10 via-purple-500/10 to-cyan-400/10 blur-2xl rounded-full" />
        <DNACanvas />
      </div>

      <h1 className="text-xl font-semibold tracking-tight mb-1">
        LearnHub Tutor
      </h1>
      <p className="text-slate-400 text-sm mb-8">
        Call in progress — speak anytime
      </p>

      <button
        onClick={handleEnd}
        className="group flex items-center gap-2 px-6 py-3 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 text-sm font-medium transition-all duration-200"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        End call
      </button>
    </div>
  );
};

export default CallPage;
