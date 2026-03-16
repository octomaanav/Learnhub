import React, { useId } from 'react';

interface Props {
  /** Height of the circle mark in px. Text scales proportionally. */
  size?: number;
  /** Animate the waveform (scrolling sine wave). */
  animated?: boolean;
  /** Speed of the wave scroll in seconds per period. Lower = faster. */
  speed?: number;
  /** Show the "learnhub" wordmark next to the circle. */
  showText?: boolean;
  /** When true the wave amplitude grows — use while the agent is speaking. */
  active?: boolean;
  className?: string;
}

/**
 * Brand logo: a sine wave scrolling inside a circle, with the "learnhub" wordmark.
 * Entirely SVG/CSS — no image dependency, works on any background.
 *
 * The wave path is 4× the circle width and animated via SVG animateTransform so
 * the scroll loops seamlessly without any external CSS keyframes.
 */
export const LearnHubLogo: React.FC<Props> = ({
  size = 40,
  animated = false,
  speed = 2,
  showText = true,
  active = false,
  className = '',
}) => {
  // Unique IDs so multiple instances on the same page don't clash
  const uid = useId().replace(/:/g, '');
  const clipId = `lhl-clip-${uid}`;
  const glowId = `lhl-glow-${uid}`;

  // SVG coordinate space is always 100×100; we scale with width/height attrs
  const cx = 50;
  const cy = 50;
  const r = 43;

  // Wave amplitude — larger when active (agent is speaking)
  const amp = active ? 18 : 12;

  // Sine wave path using the optimal cubic bezier approximation.
  // CP offsets at 0.3642 × half-period give a near-perfect sinusoidal curve.
  const period = 50;
  const periods = 6;
  const startX = -period * 2;

  const buildWavePath = () => {
    const hp = period / 2;
    const k = 0.3642 * hp;
    const parts: string[] = [`M ${startX},${cy}`];
    for (let i = 0; i < periods; i++) {
      const x0 = startX + i * period;
      const xm = x0 + hp;
      const xe = x0 + period;
      parts.push(
        `C ${x0 + k},${cy - amp} ${xm - k},${cy - amp} ${xm},${cy}`,
        `C ${xm + k},${cy + amp} ${xe - k},${cy + amp} ${xe},${cy}`
      );
    }
    return parts.join(' ');
  };

  const wavePath = buildWavePath();

  const circleColor = '#3B82F6';   // blue-500
  const waveColor = '#3B82F6';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          {/* Clip to circle so wave doesn't bleed out */}
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={r - 1} />
          </clipPath>
          {/* Subtle glow filter */}
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={active ? '3' : '1.5'} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer circle ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={circleColor}
          strokeWidth={active ? '2' : '1.5'}
          opacity={active ? 0.9 : 0.7}
        />

        {/* Scrolling waveform clipped to circle */}
        <g clipPath={`url(#${clipId})`} filter={`url(#${glowId})`}>
          <path
            d={wavePath}
            stroke={waveColor}
            strokeWidth={active ? '3' : '2.5'}
            strokeLinecap="round"
            fill="none"
          >
            {animated && (
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0,0"
                to={`${-period},0`}
                dur={`${speed}s`}
                repeatCount="indefinite"
              />
            )}
          </path>
        </g>
      </svg>

      {showText && (
        <span
          className="font-black tracking-tight leading-none select-none"
          style={{ fontSize: size * 0.45 }}
        >
          <span className="text-surface-900 dark:text-white">learn</span>
          <span style={{ color: circleColor }}>hub</span>
        </span>
      )}
    </div>
  );
};

/**
 * Large animated waveform display for the Pulse page idle state.
 * A scrolling sine wave inside a circle — no wordmark, contained within its bounds.
 *
 * Uses the optimal cubic bezier approximation of a sine wave:
 * CP offsets at 0.3642 × half-period give a near-perfect sinusoidal shape.
 */
export const PulseWaveform: React.FC<{ active?: boolean }> = ({ active = false }) => {
  const uid = useId().replace(/:/g, '');
  const clipId = `pw-clip-${uid}`;
  const glowId = `pw-glow-${uid}`;

  // All coordinates are in the SVG's own 200×200 space
  const size = 160;   // rendered px — keeps it well inside any parent div
  const vb = 200;     // viewBox units
  const cx = 100;
  const cy = 100;
  const r = 88;       // circle radius in viewBox units

  const amp = active ? 26 : 16;
  const period = 80;  // one full sine period in viewBox units
  const periods = 6;
  const startX = -period * 2;
  const speed = active ? 1.2 : 2.2;

  // Optimal bezier approximation of a sine wave.
  // For each half-period, CP1 and CP2 sit at 0.3642 × half_period from each end.
  const buildWavePath = () => {
    const hp = period / 2;      // half period
    const k = 0.3642 * hp;      // bezier offset for sine approximation
    const parts: string[] = [`M ${startX},${cy}`];
    for (let i = 0; i < periods; i++) {
      const x0 = startX + i * period;
      const xm = x0 + hp;
      const xe = x0 + period;
      // Rising half (trough → peak)
      parts.push(`C ${x0 + k},${cy - amp} ${xm - k},${cy - amp} ${xm},${cy}`);
      // Falling half (peak → trough)
      parts.push(`C ${xm + k},${cy + amp} ${xe - k},${cy + amp} ${xe},${cy}`);
    }
    return parts.join(' ');
  };

  const wavePath = buildWavePath();
  const circleColor = '#3B82F6';

  return (
    <div className="flex items-center justify-center select-none">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Ambient glow behind the circle */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, rgba(59,130,246,${active ? 0.2 : 0.08}) 0%, transparent 70%)`,
            transform: 'scale(1.5)',
            animation: 'pulse 3s ease-in-out infinite',
          }}
        />

        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${vb} ${vb}`}
          fill="none"
          overflow="visible"
          style={{ display: 'block' }}
        >
          <defs>
            {/* Clip strictly to circle interior */}
            <clipPath id={clipId}>
              <circle cx={cx} cy={cy} r={r - 3} />
            </clipPath>
            {/* Soft glow on the wave stroke */}
            <filter id={glowId} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation={active ? '4' : '2'} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer circle ring */}
          <circle
            cx={cx} cy={cy} r={r}
            stroke={circleColor}
            strokeWidth={active ? '2' : '1.5'}
            opacity={active ? 0.95 : 0.65}
          />

          {/* Scrolling sine wave, clipped to circle */}
          <g clipPath={`url(#${clipId})`} filter={`url(#${glowId})`}>
            <path
              d={wavePath}
              stroke={circleColor}
              strokeWidth={active ? '3' : '2.5'}
              strokeLinecap="round"
              fill="none"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0,0"
                to={`${-period},0`}
                dur={`${speed}s`}
                repeatCount="indefinite"
              />
            </path>
          </g>
        </svg>
      </div>
    </div>
  );
};
