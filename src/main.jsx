import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import MobileApp from './MobileApp.jsx' // 🌟 新しい入力専用アプリを読み込む！
import './index.css'

// 🌟 現在のURLのパス（後ろの部分）を取得する
const path = window.location.pathname;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 魔法の分岐！URLが「/mobile」なら入力アプリ、それ以外ならPCダッシュボードを起動！ */}
    {path === '/mobile' ? <MobileApp /> : <App />}
  </React.StrictMode>,
)