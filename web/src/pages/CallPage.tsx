import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVoiceAgent } from '../components/VoiceAgentProvider';

const BAR_COUNT = 7;
const BAR_HEIGHTS = [32, 22, 58, 48, 68, 26, 52];

function VoiceNoteBars() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;
    const dpr = window.devicePixelRatio || 1;

    const W = 170;
    const H = 90;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const draw = () => {
      const t = frameRef.current * 0.04;
      frameRef.current++;
      ctx.clearRect(0, 0, W, H);

      const barWidth = 15;
      const gap = 7;
      const totalWidth = BAR_COUNT * barWidth + (BAR_COUNT - 1) * gap;
      const startX = (W - totalWidth) / 2;
      const baseY = H - 10;

      for (let i = 0; i < BAR_COUNT; i++) {
        const baseHeight = BAR_HEIGHTS[i];
        const animOffset = Math.sin(t + i * 0.7) * 8 + Math.sin(t * 1.3 + i * 0.5) * 4;
        const height = Math.max(15, baseHeight + animOffset);
        
        const x = startX + i * (barWidth + gap);
        const y = baseY - height;
        const radius = barWidth / 2;

        // Create gradient from yellow (top) to blue (bottom)
        const gradient = ctx.createLinearGradient(x, y, x, baseY);
        gradient.addColorStop(0, '#f5c842');
        gradient.addColorStop(0.4, '#e8d47a');
        gradient.addColorStop(0.7, '#9dd4e0');
        gradient.addColorStop(1, '#5cb8e8');

        // Draw shadow/glow
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(92, 184, 232, 0.25)';
        ctx.shadowOffsetY = 4;
        
        drawRoundedRect(x, y, barWidth, height, radius);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
      }

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
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col items-center justify-center px-4 select-none">
      {/* Voice Note Bars Animation */}
      <div className="relative mb-8">
        <div className="absolute inset-[-30px] bg-gradient-to-b from-amber-500/10 via-transparent to-cyan-500/15 blur-2xl rounded-full" />
        <VoiceNoteBars />
      </div>

      <h1 className="text-3xl font-bold tracking-tight mb-2">
        LearnHub Tutor
      </h1>
      <p className="text-slate-500 text-lg mb-10">
        Call in progress — speak anytime
      </p>

      <button
        onClick={handleEnd}
        className="group flex items-center gap-2 px-6 py-3 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-500 hover:text-red-600 text-base font-medium transition-all duration-200"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        End call
      </button>
    </div>
  );
};

export default CallPage;
