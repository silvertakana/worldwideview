import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.wwvrc');

export interface WwvConfig {
  org?: string;
}

export function getConfig(): WwvConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export function saveConfig(config: WwvConfig): void {
  const current = getConfig();
  const next = { ...current, ...config };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
}
