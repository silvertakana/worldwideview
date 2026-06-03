import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        clearMocks: true,
        setupFiles: ['./src/test/setup.ts'],
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        include: [
            'src/lib/**/*.{test,spec}.{js,ts,jsx,tsx}',
            'src/core/**/*.{test,spec}.{js,ts,jsx,tsx}',
            'src/plugins/**/*.{test,spec}.{js,ts,jsx,tsx}',
            'src/app/**/*.{test,spec}.{js,ts,jsx,tsx}',
            'packages/**/*.{test,spec}.{js,ts,jsx,tsx}',
        ],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.next/**',
            '**/.git/**',
        ],
        coverage: {
            thresholds: {
                branches: 80,
                functions: 80,
                statements: 80,
            }
        }
    },
});
