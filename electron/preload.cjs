/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("enchuntedElectron", {
  git: {
    pickRepo: () => ipcRenderer.invoke("git:pick-repo"),
    detectRepo: (folderPath) =>
      ipcRenderer.invoke("git:detect-repo", folderPath),
    pullRepo: (folderPath) => ipcRenderer.invoke("git:pull-repo", folderPath),
    pushRepo: (folderPath, commitMessage) =>
      ipcRenderer.invoke("git:push-repo", folderPath, commitMessage),
  },
  fs: {
    listDirectory: (directoryPath) =>
      ipcRenderer.invoke("fs:list-directory", directoryPath),
    getFileHandle: (directoryPath, fileName, create) =>
      ipcRenderer.invoke("fs:get-file-handle", directoryPath, fileName, create),
    getDirectoryHandle: (directoryPath, directoryName, create) =>
      ipcRenderer.invoke(
        "fs:get-directory-handle",
        directoryPath,
        directoryName,
        create,
      ),
    readTextFile: (filePath) =>
      ipcRenderer.invoke("fs:read-text-file", filePath),
    writeTextFile: (filePath, content) =>
      ipcRenderer.invoke("fs:write-text-file", filePath, content),
    writeBinaryFile: (filePath, base64) =>
      ipcRenderer.invoke("fs:write-binary-file", filePath, base64),
    removeEntry: (directoryPath, entryName, recursive) =>
      ipcRenderer.invoke(
        "fs:remove-entry",
        directoryPath,
        entryName,
        recursive,
      ),
  },
});
