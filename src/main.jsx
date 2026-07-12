import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import MobileApp from './MobileApp.jsx'
import './index.css'

// 1️⃣ 現在のURLのパス（後ろの部分）を取得する
const path = window.location.pathname;

// 2️⃣ URLによる強制切り替えフラグ
const isDashboardRoute = path === '/dashboard';
const isMobileRoute = path === '/mobile' || path === '/input';

// 3️⃣ ルートURL（ / ）のときのスマホ自動判定
const isMobileDevice = 
  window.innerWidth <= 768 || 
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// 4️⃣ 条件に合わせて表示する画面を完全に分ける
let ScreenComponent;

if (isDashboardRoute) {
  // 📱スマホからでも、URLが /dashboard なら絶対に「パソコン版」を開く！
  ScreenComponent = <App />;
} else if (isMobileRoute) {
  // URLが /mobile や /input なら絶対に「スマホ版」を開く
  ScreenComponent = <MobileApp />;
} else {
  // パスが何も無い（ / ）のときは、端末のサイズに合わせて自動で振り分ける
  ScreenComponent = isMobileDevice ? <MobileApp /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {ScreenComponent}
  </React.StrictMode>,
)