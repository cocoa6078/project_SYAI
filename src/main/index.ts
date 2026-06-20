// src/main/index.ts
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'

// データを保存するローカルJSONファイルのパス
const dataFilePath = join(app.getPath('userData'), 'nutrition_data.json');

// メインウィンドウの参照を保持
let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 拡張機能からデータを受け取るためのローカルサーバーを起動
function startLocalServer() {
  const server = express();
  server.use(cors());
  server.use(express.json());

  server.post('/api/collect', async (req, res) => {
    try {
      const newData = req.body;

      console.log(`[受信成功] 拡張機能からデータを受け取りました: ${newData.videoTitle}`);
      
      let currentData: any[] = [];

      // 既存のデータを読み込む
      try {
        const fileContent = await fs.readFile(dataFilePath, 'utf-8');
        currentData = JSON.parse(fileContent);
      } catch (e) {
        // ファイルが存在しない場合は空配列からスタート
      }

      // 新しいデータを追加して保存
      currentData.push({
        ...newData,
        timestamp: new Date().toISOString()
      });
      await fs.writeFile(dataFilePath, JSON.stringify(currentData, null, 2));

      // React側（UI）にデータが更新されたことを通知
      if (mainWindow) {
        mainWindow.webContents.send('data-updated', currentData.length);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('サーバーエラー:', error);
      res.status(500).json({ error: '保存に失敗しました' });
    }
  });

  server.listen(3000, () => {
    console.log('ローカルサーバーがポート3000で起動しました');
  });
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ウィンドウ作成とサーバー起動
  createWindow();
  startLocalServer();

  // React側からデータを要求された時の処理
  ipcMain.handle('get-collected-data', async () => {
    try {
      const fileContent = await fs.readFile(dataFilePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (e) {
      return [];
    }
  });

  // データをクリアする処理
  ipcMain.handle('clear-data', async () => {
    await fs.writeFile(dataFilePath, JSON.stringify([]));
    return true;
  });
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})