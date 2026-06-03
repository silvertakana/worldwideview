const DISABLED_KEY = "wwv-disabled-plugins";

export function getDisabledPluginIds(): Set<string> {
    try {
        const raw = localStorage.getItem(DISABLED_KEY);
        if (!raw) return new Set();
        return new Set<string>(JSON.parse(raw));
    } catch {
        return new Set();
    }
}

export function setPluginDisabled(pluginId: string, disabled: boolean): void {
    try {
        const ids = getDisabledPluginIds();
        if (disabled) {
            ids.add(pluginId);
        } else {
            ids.delete(pluginId);
        }
        localStorage.setItem(DISABLED_KEY, JSON.stringify([...ids]));
    } catch {
        // ignore storage errors
    }
}
