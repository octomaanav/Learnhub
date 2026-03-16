import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;
function ensureMermaidInit() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
    });
    mermaidInitialized = true;
  }
}

interface MermaidDiagramProps {
  code: string;
  className?: string;
}

export function MermaidDiagram({ code, className = '' }: MermaidDiagramProps) {
  const id = useId().replace(/:/g, '-');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code?.trim()) {
      setSvg(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setError(null);
    ensureMermaidInit();

    const renderId = `mermaid-${id}-${Date.now()}`;
    mermaid
      .render(renderId, code.trim())
      .then(({ svg: rendered }) => {
        if (!cancelled) {
          setSvg(rendered);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to render diagram');
          setSvg(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <div className={`rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-400 text-sm ${className}`}>
        Could not render diagram: {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border border-white/10 bg-black/40 p-12 ${className}`}>
        <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
