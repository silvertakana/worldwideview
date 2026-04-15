import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        include: ['src/lib/**/*.{test,spec}.{js,ts,jsx,tsx}', 'src/core/**/*.{test,spec}.{js,ts,jsx,tsx}', 'src/plugins/**/*.{test,spec}.{js,ts,jsx,tsx}', 'packages/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    },
});
