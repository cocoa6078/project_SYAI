// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

// React側から呼び出せる安全なAPIを定義
const api = {
  // 収集された全データを取得
  getCollectedData: () => ipcRenderer.invoke('get-collected-data'),
  
  // データをリセット
  clearData: () => ipcRenderer.invoke('clear-data'),
  
  // データが追加された時のイベントリスナー
  onDataUpdated: (callback: (count: number) => void) => {
    ipcRenderer.on('data-updated', (_event, count) => callback(count));
  },
  
  // リスナーのクリーンアップ
  removeDataUpdatedListener: () => {
    ipcRenderer.removeAllListeners('data-updated');
  }
}

// コンテキストブリッジを通じてAPIを公開
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (isolated modules 用)
  window.electronAPI = api
}