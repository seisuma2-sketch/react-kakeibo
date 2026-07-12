import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import MobileApp from './MobileApp.jsx'
import './index.css'

// 🌟 画面幅または端末情報（UserAgent）でスマホかどうかを自動判定する！
const isMobileDevice = 
  window.innerWidth <= 768 || 
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 魔法の分岐！スマホなら入力アプリ、PCならダッシュボードを起動！ */}
    {isMobileDevice ? <MobileApp /> : <App />}
  </React.StrictMode>,
)