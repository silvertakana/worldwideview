const STORAGE_KEY = "wwv_approved_unverified_plugins";
const DENIED_STORAGE_KEY = "wwv_denied_unverified_plugins";

/** Get the set of plugin IDs the user has approved despite being unverified. */
export function getApprovedUnverifiedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/** Mark a plugin as user-approved (won't show the warning again). */
export function approveUnverifiedPlugin(pluginId: string): void {
  const approved = getApprovedUnverifiedIds();
  approved.add(pluginId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...approved]));

  // Approval wins over a prior permanent denial.
  const denied = getDeniedUnverifiedIds();
  if (denied.delete(pluginId)) {
    localStorage.setItem(DENIED_STORAGE_KEY, JSON.stringify([...denied]));
  }
}

/** Get the set of plugin IDs the user has permanently dismissed as unverified. */
export function getDeniedUnverifiedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DENIED_STORAGE_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/** Permanently dismiss an unverified plugin (won't show the warning again). */
export function denyUnverifiedPlugin(pluginId: string): void {
  const denied = getDeniedUnverifiedIds();
  denied.add(pluginId);
  localStorage.setItem(DENIED_STORAGE_KEY, JSON.stringify([...denied]));
}
