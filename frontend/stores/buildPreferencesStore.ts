import { create } from 'zustand';
import {
  DEFAULT_PIPE_COLOR_MODE,
  normalizePipeColorMode,
  type PipeColorMode,
} from '../systems/PipeColorSystem';

const BUILD_PREFERENCES_STORAGE_KEY = 'kid_climber_build_preferences';

interface PersistedBuildPreferences {
  pipeColorMode?: PipeColorMode;
}

interface BuildPreferencesState {
  pipeColorMode: PipeColorMode;
  setPipeColorMode: (mode: PipeColorMode) => void;
  hydrateFromLocalStorage: () => void;
}

const readPersistedPreferences = (): PersistedBuildPreferences => {
  if (typeof localStorage === 'undefined') return {};

  try {
    const raw = localStorage.getItem(BUILD_PREFERENCES_STORAGE_KEY);
    return raw ? JSON.parse(raw) as PersistedBuildPreferences : {};
  } catch {
    return {};
  }
};

const writePersistedPreferences = (preferences: PersistedBuildPreferences) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(BUILD_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
};

export const useBuildPreferencesStore = create<BuildPreferencesState>((set, get) => ({
  pipeColorMode: normalizePipeColorMode(readPersistedPreferences().pipeColorMode),

  setPipeColorMode: (mode) => {
    const pipeColorMode = normalizePipeColorMode(mode);
    set({ pipeColorMode });
    writePersistedPreferences({
      ...readPersistedPreferences(),
      pipeColorMode,
    });
  },

  hydrateFromLocalStorage: () => {
    const pipeColorMode = normalizePipeColorMode(readPersistedPreferences().pipeColorMode);
    if (get().pipeColorMode !== pipeColorMode) {
      set({ pipeColorMode });
    }
  },
}));

export { BUILD_PREFERENCES_STORAGE_KEY, DEFAULT_PIPE_COLOR_MODE };
