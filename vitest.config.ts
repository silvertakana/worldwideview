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
            'src/hooks/**/*.{test,spec}.{js,ts,jsx,tsx}',
            'src/plugins/**/*.{test,spec}.{js,ts,jsx,tsx}',
            'src/components/**/*.{test,spec}.{js,ts,jsx,tsx}',
            'src/app/**/*.{test,spec}.{js,ts,jsx,tsx}',
            'packages/**/*.{test,spec}.{js,ts,jsx,tsx}',
            'tests/pact/**/*.{test,spec}.{js,ts,jsx,tsx}',
            'tests/ci/**/*.{test,spec}.{js,ts,jsx,tsx}',
        ],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.next/**',
            '**/.git/**',
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'json-summary', 'html'],
            // Regression floors, not aspirations. Measured at 43.58% functions / 42.2%
            // branches when this gate first became blocking; the target is 80/70. Raise
            // these as coverage improves, never lower them.
            thresholds: {
                functions: 42,
                branches: 41,
            },
        }
    },
});
