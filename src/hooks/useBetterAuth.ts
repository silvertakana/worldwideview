/**
 * React hook for Better Auth session state.
 *
 * Wraps authClient.useSession() so all components import from a single
 * location. The underlying Better Auth hook auto-refetches on focus and
 * tab changes (default behavior).
 *
 * @returns {{ data, isPending, isRefetching, error, refetch }}
 *   - data: The session object with user and session fields, or null
 *   - isPending: True during the initial load
 *   - isRefetching: True during background refetches
 *   - error: BetterFetchError | null
 *   - refetch: Function to manually refetch the session
 *
 * @example
 * ```tsx
 * const { data, isPending } = useBetterAuth();
 * if (isPending) return <Loading />;
 * if (data?.user) return <div>Welcome {data.user.name}</div>;
 * return <div>Please sign in</div>;
 * ```
 */

import { authClient } from "@/lib/auth-client";

export function useBetterAuth() {
    return authClient.useSession();
}
