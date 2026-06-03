import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
    {
        ignores: [
            "node_modules/**",
            ".next/**",
            "out/**",
            "src/generated/**",
            "public/cesium/**",
            "public/plugins-local/**",
            "packages/*/dist/**",
            ".worktrees/**",
            "local-scripts/**",
            "local-plugins/**",
            "local-seeders/**",
            ".agents/**",
            ".claude/**",
            ".gemini/**",
            "*.cjs",
        ],
    },
    ...nextCoreWebVitals,
    ...nextTypeScript,
    {
        rules: {
            // ─── Demoted on first introduction ─────────────────────────────
            // The existing codebase has hundreds of violations across these
            // rules. To make the lint job runnable in CI without blocking on
            // pre-existing debt, every rule that currently fires errors is
            // demoted to `warn`. Promote back to `error` once the backlog
            // is addressed (recommended in this order: prefer-const,
            // no-unescaped-entities, ban-ts-comment, then the react-hooks
            // family once the team agrees on the React 19 hook-purity rules).

            // Pre-existing — flagged in the original code review (#96):
            "@typescript-eslint/no-explicit-any": "warn",
            "no-console": "off",

            // React 19 hook-purity rules from eslint-plugin-react-hooks 7+:
            // (These were previously hallucinated or require extra plugins)
            // Misc one-offs across the codebase:
            "@typescript-eslint/ban-ts-comment": "warn",
            "@next/next/no-assign-module-variable": "warn",
            "prefer-const": "warn",
        },
    },
];

export default config;
