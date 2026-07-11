import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 星翔のFirebaseプロジェクトの「鍵」
const firebaseConfig = {
  apiKey: "AIzaSyB5UE_wkcBoBsaGo0warU40csxJAWi73-I",
  authDomain: "hybrid-kakeibo.firebaseapp.com",
  projectId: "hybrid-kakeibo",
  storageBucket: "hybrid-kakeibo.firebasestorage.app",
  messagingSenderId: "172145728222",
  appId: "1:172145728222:web:bf5c35f9764b5152b0c04f",
  measurementId: "G-5SV54CHL1W"
};

// Firebaseのシステムを起動！
const app = initializeApp(firebaseConfig); 
const db = getFirestore(app); 
const auth = getAuth(app);

// 他のファイル（App.jsxなど）で db や auth を使えるようにエクスポート
export { db, auth };