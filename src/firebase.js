import { initializeApp } from "firebase/app";
// 👇 変更点: enableMultiTabIndexedDbPersistence を追加でインポート
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB5UE_wkcBoBsaGo0warU40csxJAWi73-I",
  authDomain: "hybrid-kakeibo.firebaseapp.com",
  projectId: "hybrid-kakeibo",
  storageBucket: "hybrid-kakeibo.firebasestorage.app",
  messagingSenderId: "172145728222",
  appId: "1:172145728222:web:bf5c35f9764b5152b0c04f",
  measurementId: "G-5SV54CHL1W"
};

const app = initializeApp(firebaseConfig); 
const db = getFirestore(app); 

// 👇 ここを追加！：データベースのオフラインキャッシュを有効化
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn('⚠️ オフライン同期エラー: 複数のタブが開かれています。');
  } else if (err.code == 'unimplemented') {
    console.warn('⚠️ このブラウザはオフライン機能をサポートしていません。');
  }
});

const auth = getAuth(app);

export { db, auth };