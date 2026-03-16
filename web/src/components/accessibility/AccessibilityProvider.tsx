import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AccessibilityPreferences } from '../../types';
import { loadAccessibilityPreferences, saveAccessibilityPreferences } from '../../utils/accessibility';

interface AccessibilityContextValue extends AccessibilityPreferences {
  toggleFocusMode: () => void;
  toggleLargeText: () => void;
  toggleReduceMotion: () => void;
  toggleCaptions: () => void;
  toggleSigns: () => void;
  setFocusMode: (value: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

const applySettingsToDocument = (settings: AccessibilityPreferences) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.dataset.focusMode = settings.focusMode ? 'true' : 'false';
  root.dataset.textSize = settings.largeText ? 'large' : 'normal';
  root.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false';
  root.dataset.captions = settings.captionsOn ? 'true' : 'false';
};

export const AccessibilityProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<AccessibilityPreferences>(() => {
    const loaded = loadAccessibilityPreferences();
    // Always start with focusMode off — it's session-only and must never persist.
    return { ...loaded, focusMode: false };
  });

  useEffect(() => {
    applySettingsToDocument(settings);
    saveAccessibilityPreferences(settings, false);
  }, [settings]);

  useEffect(() => {
    const handler = () => {
      const latest = loadAccessibilityPreferences();
      setSettings(latest);
    };

    window.addEventListener('accessibility-preferences-updated', handler);
    window.addEventListener('storage', handler);

    return () => {
      window.removeEventListener('accessibility-preferences-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  useEffect(() => {
    const handleFocusToggle = (event: Event) => {
      const detail = (event as CustomEvent).detail as { value?: boolean } | undefined;
      if (detail?.value !== undefined) {
        setSettings((prev) => ({ ...prev, focusMode: detail.value }));
      } else {
        setSettings((prev) => ({ ...prev, focusMode: !prev.focusMode }));
      }
    };

    window.addEventListener('focus-mode-toggle', handleFocusToggle as EventListener);
    return () => {
      window.removeEventListener('focus-mode-toggle', handleFocusToggle as EventListener);
    };
  }, []);

  const value = useMemo<AccessibilityContextValue>(() => {
    return {
      focusMode: !!settings.focusMode,
      largeText: !!settings.largeText,
      reduceMotion: !!settings.reduceMotion,
      captionsOn: settings.captionsOn !== false,
      signsOn: settings.signsOn !== false,
      toggleFocusMode: () =>
        setSettings((prev) => ({ ...prev, focusMode: !prev.focusMode })),
      toggleLargeText: () =>
        setSettings((prev) => ({ ...prev, largeText: !prev.largeText })),
      toggleReduceMotion: () =>
        setSettings((prev) => ({ ...prev, reduceMotion: !prev.reduceMotion })),
      toggleCaptions: () =>
        setSettings((prev) => ({ ...prev, captionsOn: !prev.captionsOn })),
      toggleSigns: () =>
        setSettings((prev) => ({ ...prev, signsOn: !prev.signsOn })),
      setFocusMode: (value: boolean) => setSettings((prev) => ({ ...prev, focusMode: value })),
    };
  }, [settings]);

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};
