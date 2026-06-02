// Big2 TW v0.4.0 Firebase 設定檔
//
// 使用方式：
// 1. 到 Firebase Console 建立 Web App。
// 2. 複製 Firebase SDK 設定物件。
// 3. 把下方 PASTE_ 開頭的值換成你的專案值。
// 4. 不要放 serviceAccountKey.json 或任何私鑰到 GitHub。

export const firebaseConfig = {
  apiKey: 'AIzaSyDy8sWFzjOdAtYJUcRuzn3dvyJ0q2swESA',
  authDomain: 'big2-tw.firebaseapp.com',
  projectId: 'big2-tw',
  storageBucket: 'big2-tw.firebasestorage.app',
  messagingSenderId: '487558943667',
  appId: '1:487558943667:web:2b916d4ec3561ad15031c6'
};

export function hasFirebaseConfig() {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  return required.every((key) => {
    const value = String(firebaseConfig[key] || '').trim();
    return value && !value.startsWith('PASTE_') && !value.includes('YOUR_');
  });
}
