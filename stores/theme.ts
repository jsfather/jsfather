import type { Theme } from '@/types/theme';

export const useThemeStore = defineStore('themeStore', {
  state: () => ({
    themes: [
      { name: 'jupiter', color: 'amber-800' },
      { name: 'javascript', color: 'yellow-300' },
    ] as Theme[],
    selectedTheme: { name: 'javascript', color: 'yellow-300' } as
      | Theme
      | undefined,
  }),
  actions: {
    setSelectedTheme(name: string) {
      this.selectedTheme = this.themes.find((item) => item.name === name);
    },
  },
});