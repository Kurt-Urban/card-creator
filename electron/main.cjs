/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');

let mainWindow;

app.setName('Card Creator');

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    title: 'Card Creator',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription) => {
      dialog.showErrorBox(
        'Card Creator – Load Error',
        `The app failed to load (${errorCode}: ${errorDescription}).`,
      );
    },
  );

  if (process.env.ELECTRON_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(createWindow)
  .catch((error) => {
    dialog.showErrorBox(
      'Card Creator – Startup Error',
      String(error.message ?? error),
    );
    app.quit();
  });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => {
      console.error(error);
      app.quit();
    });
  }
});
