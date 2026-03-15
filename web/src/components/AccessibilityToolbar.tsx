import React from 'react';
import { Volume2, VolumeX, BookOpen, Eye, EyeOff, Minus, Plus, Loader2 } from 'lucide-react';

type Props = {
  onVoiceOverToggle: (enabled: boolean) => void;
  onBraille: () => void;
  onStoryModeToggle: (enabled: boolean) => void;
  onHighContrastToggle: (enabled: boolean) => void;
  onIncreaseText: () => void;
  onDecreaseText: () => void;
  voiceOverEnabled: boolean;
  storyModeEnabled: boolean;
  highContrastEnabled: boolean;
  isBrailleLoading?: boolean;
};

// 6-dot Braille cell icon
function BrailleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="4"  r="2.2" />
      <circle cx="15" cy="4"  r="2.2" />
      <circle cx="5" cy="12" r="2.2" />
      <circle cx="15" cy="12" r="2.2" />
      <circle cx="5" cy="20" r="2.2" opacity="0.3" />
      <circle cx="15" cy="20" r="2.2" opacity="0.3" />
    </svg>
  );
}

// Single toolbar pill-button
function ToolBtn({
  label,
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={[
        'group flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl',
        'text-[10px] font-bold uppercase tracking-wider transition-all select-none min-w-[52px]',
        'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        active
          ? 'bg-primary-500 border-primary-600 text-white shadow-md shadow-primary-500/30'
          : 'bg-surface-50 border-surface-200 text-surface-500 hover:bg-surface-100 hover:border-surface-300 hover:text-surface-700',
        disabled ? 'opacity-50 cursor-wait pointer-events-none' : 'cursor-pointer',
      ].join(' ')}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

const AccessibilityToolbar: React.FC<Props> = ({
  onVoiceOverToggle,
  onBraille,
  onStoryModeToggle,
  onHighContrastToggle,
  onIncreaseText,
  onDecreaseText,
  voiceOverEnabled,
  storyModeEnabled,
  highContrastEnabled,
  isBrailleLoading,
}) => {
  return (
    <div
      role="toolbar"
      aria-label="Accessibility toolbar"
      className="flex items-stretch gap-1.5 p-1.5 bg-surface-100 border border-surface-200 rounded-2xl shadow-sm"
    >
      {/* Voice Over */}
      <ToolBtn
        label={voiceOverEnabled ? 'Stop' : 'Voice'}
        title={voiceOverEnabled ? 'Stop VoiceOver' : 'Start VoiceOver'}
        active={voiceOverEnabled}
        onClick={() => onVoiceOverToggle(!voiceOverEnabled)}
      >
        {voiceOverEnabled
          ? <VolumeX className="w-4 h-4" />
          : <Volume2 className="w-4 h-4" />
        }
      </ToolBtn>

      {/* Braille */}
      <ToolBtn
        label={isBrailleLoading ? 'Loading' : 'Braille'}
        title="Convert to Braille"
        disabled={isBrailleLoading}
        onClick={onBraille}
      >
        {isBrailleLoading
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <BrailleIcon className="w-4 h-4" />
        }
      </ToolBtn>

      {/* Story Mode */}
      <ToolBtn
        label="Story"
        title="Toggle Story Mode"
        active={storyModeEnabled}
        onClick={() => onStoryModeToggle(!storyModeEnabled)}
      >
        <BookOpen className="w-4 h-4" />
      </ToolBtn>

      {/* High Contrast */}
      <ToolBtn
        label="Contrast"
        title="Toggle High Contrast"
        active={highContrastEnabled}
        onClick={() => onHighContrastToggle(!highContrastEnabled)}
      >
        {highContrastEnabled
          ? <EyeOff className="w-4 h-4" />
          : <Eye className="w-4 h-4" />
        }
      </ToolBtn>

      {/* Divider */}
      <div className="w-px bg-surface-200 self-stretch mx-0.5" aria-hidden="true" />

      {/* Text Size */}
      <div
        className="flex items-center bg-surface-50 border border-surface-200 rounded-xl overflow-hidden"
        role="group"
        aria-label="Text size"
      >
        <button
          type="button"
          onClick={onDecreaseText}
          title="Decrease text size"
          aria-label="Decrease text size"
          className="flex items-center justify-center w-9 h-full text-surface-500 hover:bg-surface-100 hover:text-surface-800 transition-colors border-r border-surface-200"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="px-2 text-[10px] font-black uppercase tracking-wider text-surface-500 select-none">
          Aa
        </span>
        <button
          type="button"
          onClick={onIncreaseText}
          title="Increase text size"
          aria-label="Increase text size"
          className="flex items-center justify-center w-9 h-full text-surface-500 hover:bg-surface-100 hover:text-surface-800 transition-colors border-l border-surface-200"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default AccessibilityToolbar;
