import type { AccessibilityPreferences } from '../types';

const STORAGE_KEY = 'accessibility-preferences';

export const loadAccessibilityPreferences = (): AccessibilityPreferences => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AccessibilityPreferences;
    // focusMode is session-only — never restore it from storage so it
    // always starts as false and can't get stuck hiding the UI permanently.
    const { focusMode: _ignored, ...rest } = parsed as any;
    return rest;
  } catch {
    return {};
  }
};

export const saveAccessibilityPreferences = (prefs: AccessibilityPreferences, emitEvent = true) => {
  if (typeof window === 'undefined') return;
  // Strip focusMode before persisting — it's session-only state.
  const { focusMode: _ignored, ...persistable } = prefs as any;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  if (emitEvent) {
    window.dispatchEvent(new CustomEvent('accessibility-preferences-updated'));
  }
};

export const syncAccessibilityFromProfile = (profile?: AccessibilityPreferences | null) => {
  if (!profile) return;

  const current = loadAccessibilityPreferences();
  const merged: AccessibilityPreferences = {
    ...current,
    ...profile,
  };

  saveAccessibilityPreferences(merged);
};
