// src/env.d.ts に追記
interface Window {
  electronAPI: {
    getCollectedData: () => Promise<any[]>;
    clearData: () => Promise<boolean>;
    onDataUpdated: (callback: (count: number) => void) => void;
    removeDataUpdatedListener: () => void;
  }
}