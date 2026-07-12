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

// 3️⃣ 【ここを修正】ルートURL（ / ）のときのスマホ判定
// 端末がAndroidかiPhoneかに関わらず、画面の横幅が768px以下（スマホサイズ）のときだけスマホ版にする
const isMobileDevice = window.innerWidth <= 768;

// 4️⃣ 条件に合わせて表示する画面を完全に分ける
let ScreenComponent;

if (isDashboardRoute) {
  ScreenComponent = <App />;
} else if (isMobileRoute) {
  ScreenComponent = <MobileApp />;
} else {
  // パスが何も無い（ / ）のときは、画面のサイズに合わせて自動で振り分ける
  ScreenComponent = isMobileDevice ? <MobileApp /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {ScreenComponent}
  </React.StrictMode>,
)