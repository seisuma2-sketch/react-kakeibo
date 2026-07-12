import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // アプリのアップデートがあったら自動でバックグラウンド更新する設定
      registerType: 'autoUpdate',
      
      // index.htmlにService Workerを登録するスクリプトを自動注入
      injectRegister: 'inline',
      
      // キャッシュ（オフライン対応）するアセットの対象
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],

        maximumFileSizeToCacheInBytes: 5000000
      },
      
      // すでに用意されているpublic/manifest.jsonの内容をここに統合すると確実です
      manifest: {
        short_name: "サイバー家計簿",
        name: "負け犬の家計簿 - Cyber Edition",
        start_url: "/mobile",
        display: "standalone",
        background_color: "#0a0c10",
        theme_color: "#0a0c10",
        orientation: "portrait",
        icons: [
          {
            src: "icon-192.png",
            type: "image/png",
            sizes: "192x192",
            purpose: "any maskable" // スマホのアイコン枠に綺麗にフィットさせる魔法の属性
          },
          {
            src: "icon-512.png",
            type: "image/png",
            sizes: "512x512",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
})