/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Include Mastra UI components
    '../../packages/playground-ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Mastra theme colors
        'mastra-bg-1': '#0A0A0A',
        'mastra-bg-2': '#111111',
        'mastra-bg-3': '#1A1A1A',
        'mastra-el-1': '#222222',
        'mastra-el-2': '#2A2A2A',
        'mastra-el-3': '#333333',
        'mastra-el-4': '#3A3A3A',
        'mastra-el-5': '#444444',
        'mastra-el-border': '#2A2A2A',
        'mastra-el-text': '#E5E5E5',
        'mastra-el-text-hover': '#F5F5F5',
        'mastra-el-text-muted': '#A0A0A0',
        'mastra-el-accent': '#6366F1',
        'mastra-el-accent-hover': '#818CF8',
        'mastra-el-success': '#10B981',
        'mastra-el-warning': '#F59E0B',
        'mastra-el-error': '#EF4444',
        'mastra-el-connected': '#6366F1',
      },
    },
  },
  plugins: [],
};
