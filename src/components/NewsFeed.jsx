import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function NewsFeed() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  
  const [locations, setLocations] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [scanLines, setScanLines] = useState([]);

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

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!isMapLoaded || !mapContainerRef.current) return;

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
          background: ${color}33;
          border: 1.5px solid ${color};
          border-radius: 50%;
          animation: map-pulse 2.5s infinite ease-out;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 15px ${color}88, inset 0 0 10px ${color}55;
        ">
          <div style="
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 4px; height: 4px; background: #fff; border-radius: 50%;
            box-shadow: 0 0 8px #fff;
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

  }, [isMapLoaded, locations]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#050608', display: 'flex', flexDirection: 'column' }}>
      
      {/* 🌟 洗練されたヘッダー */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1000, background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)', padding: '20px', pointerEvents: 'none' }}>
        <h2 style={{ margin: 0, color: '#00ff66', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', textShadow: '0 0 10px rgba(0,255,102,0.5)' }}>
          <span>🌍</span> 支出ロケーションマップ
        </h2>
        <div style={{ color: '#00bfff', fontSize: '11px', fontFamily: 'monospace', marginTop: '6px', letterSpacing: '1px' }}>
          SYSTEM ONLINE // {locations.length} 件のデータを検出
        </div>
      </div>

      <div ref={mapContainerRef} style={{ flex: 1, width: '100%', filter: 'contrast(1.1) brightness(1.2)' }} />

      {/* 🌟 洗練されたログ画面 */}
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

      {/* 🌟 洗練された詳細パネル */}
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
              <div style={{ background: '#11141a', padding: '8px', borderRadius: '6px', fontSize: '9px', color: '#555', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                LAT: {selectedNode.lat} <br/> LNG: {selectedNode.lng}
              </div>
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes map-pulse {
          0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .leaflet-container { background: #000 !important; }
      `}</style>
    </div>
  );
}