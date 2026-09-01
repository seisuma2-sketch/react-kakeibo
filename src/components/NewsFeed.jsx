import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';

// 🌟 最新の最強マップを「外注」として呼び出します
import MoneyFlowMap from './MoneyFlowMap';

export default function NewsFeed({ feedMode = 'map', setFeedMode }) {
  // --- 🌟 ニュース用 State (元のまま一切削っていません！) ---
  const [news, setNews] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const RSS_URL = 'https://www.gizmodo.jp/index.xml';
  const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;

  // --- 🌟 マップ用 State & Ref (元のまま一切削っていません！) ---
  const [locations, setLocations] = useState([]);
  const [scanLines, setScanLines] = useState([]);
  
  // (※selectedNode等はMoneyFlowMap側で処理するため不要になりましたが、元の構造を尊重して残しています)
  const [selectedNode, setSelectedNode] = useState(null);

  // 🌟 1. ギズモードのニュースを取得 (元のまま！)
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();
        if (data.items) {
          setNews(data.items);
        }
      } catch (error) {
        console.error("通信傍受エラー:", error);
      } finally {
        setLoadingNews(false);
      }
    };
    fetchNews();
  }, [API_URL]);

  // 🌟 2. Firebaseから位置情報付き取引データを抽出 (元のまま！)
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "transactions"), where("userId", "==", auth.currentUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        // マップに渡すため、すべてのデータを取得
        data.push({ id: doc.id, ...d });
      });
      data.sort((a, b) => b.date.toMillis() - a.date.toMillis());
      setLocations(data);

      // 左下の「最新の検出ログ」用の抽出 (元のまま！)
      const locData = data.filter(d => d.lat && d.lng);
      setScanLines(locData.slice(0, 5).map(tx => {
        const typeStr = tx.type === 'expense' ? '出費' : '入金';
        const dateStr = tx.date?.toDate ? tx.date.toDate().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '';
        return `[${dateStr}] ${typeStr} ¥${tx.amount.toLocaleString()} - ${tx.category}`;
      }));
    });
    return () => unsub();
  }, []);

  // -------------------------------------------------------------------------
  // 🌟 3 & 4. 【行数が減った理由】
  // 以前ここに書かれていた「Leafletの直接描画」と「マーカー配置」の約50行のコードは、
  // すべて『MoneyFlowMap.jsx』の中にパワーアップして移動しました。
  // 機能が消えたわけではなく、別ファイルに「外注」してスッキリさせただけなので安心してください！
  // -------------------------------------------------------------------------


  // ━━━ 📰 ニュースモードのレンダリング (元のまま一切削っていません！) ━━━
  if (feedMode === 'news') {
    if (loadingNews) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '50vh', flexDirection: 'column' }}>
          <div style={{ position: 'relative', width: '60px', height: '60px' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', border: '2px dashed #00bfff', borderRadius: '50%', animation: 'spin 2s linear infinite' }}></div>
            <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px' }}>📡</div>
          </div>
          <div style={{ color: '#00bfff', marginTop: '15px', fontFamily: 'monospace', letterSpacing: '2px' }}>[ FETCHING INTEL... ]</div>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }

    return (
      <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838', minHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ borderBottom: '1px solid #252838', paddingBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '18px', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📰</span> ガジェット最新情報
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              onClick={() => setFeedMode('map')}
              style={{ background: '#00ff6622', color: '#00ff66', border: '1px solid #00ff66', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 0 10px rgba(0,255,102,0.2)' }}
            >
              <span>🌍</span> マップへ切替
            </button>
            <span style={{ color: '#00ff66', fontSize: '10px', fontFamily: 'monospace', border: '1px solid #00ff66', padding: '2px 6px', borderRadius: '4px' }}>SECURE</span>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#888', background: '#0a0c10', padding: '8px 12px', borderRadius: '4px', borderLeft: '3px solid #00bfff' }}>
          💡 ヒント: 下の「情報」タブをもう一度タップしても、マップとニュースをサクサク切り替えられます！
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginTop: '5px' }}>
          {news.map((item, index) => {
            const pubDate = new Date(item.pubDate);
            const dateStr = pubDate.toISOString().slice(0, 16).replace('T', ' ');

            return (
              <a 
                key={index} href={item.link} target="_blank" rel="noopener noreferrer" className="news-card"
                style={{ display: 'flex', flexDirection: 'column', background: '#0a0c10', border: '1px solid #1a1d24', borderRadius: '8px', overflow: 'hidden', textDecoration: 'none', transition: 'all 0.3s ease' }}
              >
                {item.thumbnail && (
                  <div style={{ width: '100%', height: '140px', overflow: 'hidden', position: 'relative' }}>
                    <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, transparent, #0a0c10)' }}></div>
                  </div>
                )}
                <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ color: '#00bfff', fontSize: '11px', fontFamily: 'monospace', marginBottom: '8px' }}>{dateStr}</div>
                  <h3 style={{ color: '#fff', fontSize: '14px', margin: '0 0 10px 0', lineHeight: '1.4', flex: 1 }}>{item.title}</h3>
                  <div style={{ color: '#ff3366', fontSize: '12px', textAlign: 'right', fontWeight: 'bold' }}>READ MORE &gt;&gt;</div>
                </div>
              </a>
            );
          })}
        </div>
        <style>{`
          .news-card:hover { border-color: #00bfff !important; box-shadow: 0 0 15px rgba(0, 191, 255, 0.2); transform: translateY(-3px); }
          .news-card:hover img { opacity: 1 !important; transform: scale(1.05); transition: all 0.3s ease; }
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // ━━━ 🌍 マップモードのレンダリング (UIはそのまま、地図だけ最強版にすり替え！) ━━━
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#050608', display: 'flex', flexDirection: 'column' }}>
      
      {/* 🌟 洗練された元のヘッダー＆切り替えボタン (完全復元！) */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 2000, background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)', padding: '20px', pointerEvents: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, color: '#00ff66', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', textShadow: '0 0 10px rgba(0,255,102,0.5)' }}>
            <span>🌍</span> 支出ロケーションマップ
          </h2>
          <div style={{ color: '#00bfff', fontSize: '11px', fontFamily: 'monospace', marginTop: '6px', letterSpacing: '1px' }}>
            SYSTEM ONLINE // {locations.length} 件のデータを検出
          </div>
        </div>
        <button 
          onClick={() => setFeedMode('news')}
          style={{ pointerEvents: 'auto', background: '#00bfff22', color: '#00bfff', border: '1px solid #00bfff', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 0 10px rgba(0,191,255,0.3)' }}
        >
          <span>📰</span> ニュースへ切替
        </button>
      </div>

      {/* 🌟 新しい最強マップをここに「外注」して全画面表示！ */}
      <div style={{ flex: 1, width: '100%', filter: 'contrast(1.1) brightness(1.2)', position: 'relative' }}>
        <MoneyFlowMap transactions={locations} />
      </div>

      {/* 🌟 洗練された元のログ画面 (完全復元！) */}
      {/* ※スマホの親指コックピットに被らないように、少しだけ位置(bottom)を上に調整しています */}
      <div style={{ position: 'absolute', bottom: '110px', left: '20px', zIndex: 2000, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0,0,0,0.7)', padding: '12px', borderRadius: '6px', borderLeft: '2px solid #00ff66', backdropFilter: 'blur(5px)' }}>
          <div style={{ color: '#00ff66', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '1px' }}>
            [ 最新の検出ログ ]
          </div>
          {scanLines.length > 0 ? scanLines.map((line, i) => (
            <div key={i} style={{ color: line.includes('出費') ? '#ff3366' : '#00bfff', fontSize: '10px', opacity: 1 - (i * 0.2) }}>
              {line}
            </div>
          )) : (
            <div style={{ color: '#888', fontSize: '10px' }}>位置情報データがありません</div>
          )}
        </div>
      </div>

      {/* 🌟 新しいマップのヘッダーが元のヘッダーと被らないように隠すCSS */}
      <style>{`
        .cyber-header { display: none !important; }
      `}</style>
      
    </div>
  );
}