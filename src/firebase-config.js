// Big2 TW v0.4.0 Firebase 設定檔
//
// 使用方式：
// 1. 到 Firebase Console 建立 Web App。
// 2. 複製 Firebase SDK 設定物件。
// 3. 把下方 PASTE_ 開頭的值換成你的專案值。
// 4. 不要放 serviceAccountKey.json 或任何私鑰到 GitHub。

export const firebaseConfig = {
  apiKey: 'PASTE_YOUR_API_KEY',
  authDomain: 'PASTE_YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'PASTE_YOUR_PROJECT_ID',
  storageBucket: 'PASTE_YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'PASTE_YOUR_MESSAGING_SENDER_ID',
  appId: 'PASTE_YOUR_APP_ID'
};

export function hasFirebaseConfig() {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  return required.every((key) => {
    const value = String(firebaseConfig[key] || '').trim();
    return value && !value.startsWith('PASTE_') && !value.includes('YOUR_');
  });
}
