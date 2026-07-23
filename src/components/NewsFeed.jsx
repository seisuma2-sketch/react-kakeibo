import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function NewsFeed({ feedMode = 'map', setFeedMode }) {
  // --- 🌟 ニュース用 State ---
  const [news, setNews] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const RSS_URL = 'https://www.gizmodo.jp/index.xml';
  const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;

  // --- 🌟 マップ用 State & Ref ---
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [locations, setLocations] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [scanLines, setScanLines] = useState([]);

  // 🌟 1. ギズモードのニュースを取得
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

  // 🌟 2. Firebaseから位置情報付き取引データを抽出
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "transactions"), where("userId", "==", auth.currentUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.lat && d.lng) {
          data.push({ id: doc.id, ...d });
        }
      });
      data.sort((a, b) => b.date.toMillis() - a.date.toMillis());
      setLocations(data);

      setScanLines(data.slice(0, 5).map(tx => {
        const typeStr = tx.type === 'expense' ? '出費' : '入金';
        const dateStr = tx.date?.toDate ? tx.date.toDate().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '';
        return `[${dateStr}] ${typeStr} ¥${tx.amount.toLocaleString()} - ${tx.category}`;
      }));
    });
    return () => unsub();
  }, []);

  // 🌟 3. Leaflet.js の読み込み
  useEffect(() => {
    if (feedMode !== 'map') return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setIsMapLoaded(true);
      document.head.appendChild(script);
    } else {
      setIsMapLoaded(true);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [feedMode]);

  // 🌟 4. マップ描画＆マーカー配置
  useEffect(() => {
    if (feedMode !== 'map' || !isMapLoaded || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([35.6812, 139.7671], 5);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;

      navigator.geolocation.getCurrentPosition(pos => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 13, { duration: 1.5 });
      }, () => {}, { timeout: 5000 });
    }

    const map = mapInstanceRef.current;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    locations.forEach(loc => {
      const isExpense = loc.type === 'expense' || loc.type === 'transfer';
      const color = isExpense ? '#ff3366' : '#00bfff';
      const size = Math.min(120, Math.max(30, (loc.amount / 5000) * 20 + 30));

      const icon = window.L.divIcon({
        className: 'custom-hologram-marker',
        html: `<div style="
          width: ${size}px; height: ${size}px;
          background: ${color}33; border: 1.5px solid ${color};
          border-radius: 50%; animation: map-pulse 2.5s infinite ease-out;
          transform: translate(-50%, -50%); box-shadow: 0 0 15px ${color}88, inset 0 0 10px ${color}55;
        ">
          <div style="
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 4px; height: 4px; background: #fff; border-radius: 50%; box-shadow: 0 0 8px #fff;
          "></div>
        </div>`,
        iconSize: [0, 0] 
      });

      const marker = window.L.marker([loc.lat, loc.lng], { icon }).addTo(map);
      marker.on('click', () => {
        if (navigator.vibrate) navigator.vibrate(20);
        setSelectedNode(loc);
        map.flyTo([loc.lat, loc.lng], 16, { duration: 0.6 });
      });
      markersRef.current.push(marker);
    });
  }, [feedMode, isMapLoaded, locations]);

  // ━━━ 📰 ニュースモードのレンダリング ━━━
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
        
        {/* ヘッダー＆切り替えボタン */}
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

        {/* ユーザーへのヒント */}
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

  // ━━━ 🌍 マップモードのレンダリング ━━━
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#050608', display: 'flex', flexDirection: 'column' }}>
      
      {/* 洗練されたヘッダー＆切り替えボタン */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1000, background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)', padding: '20px', pointerEvents: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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

      <div ref={mapContainerRef} style={{ flex: 1, width: '100%', filter: 'contrast(1.1) brightness(1.2)' }} />

      {/* 洗練されたログ画面 */}
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, pointerEvents: 'none' }}>
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

      {/* 詳細パネル */}
      {selectedNode && (
        <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000, animation: 'fadeInUp 0.3s ease-out' }}>
          <div style={{ background: '#0a0c10', border: `1px solid ${selectedNode.type === 'expense' ? '#ff3366' : '#00bfff'}`, borderRadius: '8px', padding: '20px', width: '240px', boxShadow: `0 0 30px ${selectedNode.type === 'expense' ? 'rgba(255,51,102,0.2)' : 'rgba(0,191,255,0.2)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #252838', paddingBottom: '10px', marginBottom: '15px' }}>
              <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>詳細データ</div>
              <button onClick={() => setSelectedNode(null)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px', padding: '0 5px' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ color: '#888', fontSize: '10px', marginBottom: '2px' }}>金額</div>
                <div style={{ color: selectedNode.type === 'expense' ? '#ff3366' : '#00bfff', fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {selectedNode.type === 'expense' ? '-' : '+'}¥{Number(selectedNode.amount).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ color: '#888', fontSize: '10px', marginBottom: '2px' }}>カテゴリ (対象)</div>
                  <div style={{ color: '#fff', fontSize: '13px' }}>{selectedNode.category}</div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: '10px', marginBottom: '2px' }}>決済元</div>
                  <div style={{ color: '#fff', fontSize: '13px' }}>{selectedNode.paymentMethod}</div>
                </div>
              </div>
              <div>
                <div style={{ color: '#888', fontSize: '10px', marginBottom: '2px' }}>発生日時</div>
                <div style={{ color: '#00ff66', fontSize: '12px', fontFamily: 'monospace' }}>
                  {selectedNode.date?.toDate ? selectedNode.date.toDate().toLocaleString('ja-JP') : new Date(selectedNode.date).toLocaleString('ja-JP')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes map-pulse { 0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .leaflet-container { background: #000 !important; }
      `}</style>
    </div>
  );
}