import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from "../utils/api";
import type { StoryAsset, StorySlide, StoryAudioSlide } from '../types';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { useAccessibility } from './accessibility/AccessibilityProvider';
import { useI18n } from './i18n/useI18n';

interface StoryPlayerProps {
  story: StoryAsset;
  autoPlay?: boolean;
  audioSlides?: StoryAudioSlide[];
  onRegenerateAudio?: () => void;
  isAudioLoading?: boolean;
}

const estimateDurationMs = (text: string, rate: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const wordsPerMinute = 150 * rate;
  const minutes = words / Math.max(wordsPerMinute, 1);
  return Math.max(4500, minutes * 60 * 1000);
};

const slugifyKeyword = (keyword: string) => {
  return keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

export const StoryPlayer = ({
  story,
  autoPlay = false,
  audioSlides = [],
  onRegenerateAudio,
  isAudioLoading = false,
}: StoryPlayerProps) => {
  const { captionsOn, signsOn } = useAccessibility();
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const slides = story.slides || [];
  const currentSlide = slides[currentIndex];
  const audioBySlideId = useMemo(() => {
    const map = new Map<string, StoryAudioSlide>();
    audioSlides.forEach((slide) => {
      map.set(slide.slideId, slide);
    });
    return map;
  }, [audioSlides]);
  const currentAudio = currentSlide ? audioBySlideId.get(currentSlide.id) : undefined;

  const {
    speak,
    stop,
    pause,
    resume,
    isPlaying,
    isPaused,
    currentRate,
  } = useTextToSpeech({ rate: 1 });

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const playSlide = useCallback(
    (slide: StorySlide) => {
      clearTimer();
      const audio = audioBySlideId.get(slide.id);

      if (audio && audio.audioUrl) {
        if (audioRef.current) {
          const src = audio.audioUrl.startsWith('/media')
            ? `${API_BASE}${audio.audioUrl}`
            : audio.audioUrl;
          audioRef.current.src = src;
          audioRef.current.play().catch(() => { });
        }
        return;
      }

      speak(slide.narration);
      const duration = estimateDurationMs(slide.narration, currentRate);
      timerRef.current = window.setTimeout(() => {
        setCurrentIndex((prev) => {
          if (prev < slides.length - 1) return prev + 1;
          setIsAutoPlaying(false);
          return prev;
        });
      }, duration);
    },
    [audioBySlideId, currentRate, speak, slides.length]
  );

  useEffect(() => {
    if (isAutoPlaying && currentSlide) {
      playSlide(currentSlide);
    }

    return () => clearTimer();
  }, [isAutoPlaying, currentIndex, currentSlide, playSlide]);

  useEffect(() => {
    return () => {
      clearTimer();
      stop();
      audioRef.current?.pause();
    };
  }, [stop]);

  if (!currentSlide) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
        {t('micro.storyNotReady')}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      role="region"
      aria-label="Story mode player"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b-2 border-surface-200 bg-surface-50 gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-surface-500">{t('story.mode')}</p>
          <h3 className="text-xl font-bold font-display text-surface-800">{currentSlide.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onRegenerateAudio && (
            <button
              className="btn-3d px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-surface-200 bg-white text-surface-700 btn-3d-surface"
              onClick={onRegenerateAudio}
              disabled={isAudioLoading}
              aria-label="Regenerate narration audio"
            >
              {isAudioLoading ? t('story.regenLoading') : t('story.regen')}
            </button>
          )}
          <button
            className="btn-3d px-4 py-2 text-sm font-bold rounded-xl border-2 border-surface-200 bg-white text-surface-700 btn-3d-surface flex-1 sm:flex-none"
            onClick={() => {
              setIsAutoPlaying(false);
              clearTimer();
              pause();
              audioRef.current?.pause();
            }}
            aria-label="Pause narration"
          >
            {t('story.pause')}
          </button>
          <button
            className="btn-3d px-4 py-2 text-sm font-bold rounded-xl border-2 border-primary-600 bg-primary-500 text-white btn-3d-primary flex-1 sm:flex-none"
            onClick={() => {
              setIsAutoPlaying(true);
              if (isPaused) resume();
              if (audioRef.current && currentAudio?.audioUrl) {
                audioRef.current.play().catch(() => { });
              }
            }}
            aria-label="Play narration"
          >
            {t('story.play')}
          </button>
          <button
            className="btn-3d px-4 py-2 text-sm font-bold rounded-xl border-2 border-warning-600 bg-warning-500 text-white btn-3d-danger flex-1 sm:flex-none"
            onClick={() => {
              setIsAutoPlaying(false);
              clearTimer();
              stop();
              audioRef.current?.pause();
            }}
            aria-label="Stop narration"
          >
            {t('story.stop')}
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="aspect-[16/9] bg-slate-900 flex items-center justify-center">
          {currentSlide.imageUrl ? (
            <img
              src={
                currentSlide.imageUrl.startsWith('/media')
                  ? `${API_BASE}${currentSlide.imageUrl}`
                  : currentSlide.imageUrl
              }
              alt={currentSlide.caption}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-slate-400">{t('story.imageUnavailable')}</div>
          )}
        </div>

        {captionsOn && (
          <div
            className="absolute bottom-0 left-0 right-0 bg-black/70 text-white px-4 py-3 text-sm"
            aria-live="polite"
          >
            {currentAudio?.caption || currentSlide.caption}
          </div>
        )}
      </div>

      {signsOn && currentSlide.signKeywords && currentSlide.signKeywords.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 border-t border-slate-200 bg-slate-50">
          {currentSlide.signKeywords.map((keyword) => {
            const slug = slugifyKeyword(keyword);
            const src = `/signs/${slug}.png`;
            return (
              <div key={keyword} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <img
                  src={src}
                  alt={`Sign for ${keyword}`}
                  className="w-10 h-10 object-contain"
                  onError={(event) => {
                    const target = event.currentTarget;
                    target.style.display = 'none';
                  }}
                />
                <span className="text-sm text-slate-700">{keyword}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between p-4 border-t-2 border-surface-200 bg-white">
        <button
          className="btn-3d px-4 py-2 text-sm font-bold rounded-xl border-2 border-surface-200 bg-white text-surface-700 btn-3d-surface"
          onClick={() => {
            setIsAutoPlaying(false);
            clearTimer();
            stop();
            audioRef.current?.pause();
            setCurrentIndex((prev) => Math.max(prev - 1, 0));
          }}
          disabled={currentIndex === 0}
        >
          Previous
        </button>
        <div className="text-sm font-bold text-surface-400">
          {currentIndex + 1} / {slides.length}
        </div>
        <button
          className="btn-3d px-4 py-2 text-sm font-bold rounded-xl border-2 border-secondary-600 bg-secondary-500 text-white btn-3d-secondary"
          onClick={() => {
            setIsAutoPlaying(false);
            clearTimer();
            stop();
            audioRef.current?.pause();
            setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1));
          }}
          disabled={currentIndex >= slides.length - 1}
        >
          {t('story.next')}
        </button>
      </div>

      <div className="px-6 pb-6">
        <p className="text-slate-600 leading-relaxed">{currentAudio?.narration || currentSlide.narration}</p>
      </div>

      <div className="px-6 pb-6 text-xs text-slate-400">
        {isPlaying && !isPaused && isAutoPlaying ? t('story.statusAuto') : t('story.statusManual')}
      </div>

      <audio
        ref={audioRef}
        onEnded={() => {
          if (!isAutoPlaying) return;
          setCurrentIndex((prev) => {
            if (prev < slides.length - 1) return prev + 1;
            setIsAutoPlaying(false);
            return prev;
          });
        }}
      />
    </div>
  );
};
