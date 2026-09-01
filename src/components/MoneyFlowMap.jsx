import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 🌟 サイバーパンク風の光るカスタムピンを作成
const cyberIcon = L.divIcon({
  className: 'custom-cyber-icon',
  html: `<div style="width: 16px; height: 16px; background: #00ff66; border-radius: 50%; box-shadow: 0 0 10px #00ff66, 0 0 20px #00ff66; border: 2px solid #0a0c10;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const expenseIcon = L.divIcon({
  className: 'custom-cyber-icon-expense',
  html: `<div style="width: 16px; height: 16px; background: #ff3366; border-radius: 50%; box-shadow: 0 0 10px #ff3366, 0 0 20px #ff3366; border: 2px solid #0a0c10;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

export default function MoneyFlowMap({ transactions = [] }) {
  // 🌟 履歴データから「座標」が含まれているものだけを抽出・解析
  const mapData = useMemo(() => {
    return transactions.map(tx => {
      let lat, lng;
      
      // 1. スキャナーで取得した "GEO-NODE [緯度, 経度]" 形式の解析
      if (tx.location && typeof tx.location === 'string') {
        const match = tx.location.match(/GEO-NODE \[([-\d.]+),\s*([-\d.]+)\]/);
        if (match) {
          lat = parseFloat(match[1]);
          lng = parseFloat(match[2]);
        }
      }
      
      // 2. 過去のデータで直接 lat, lng が保存されている場合の互換性
      if (!lat && tx.lat && tx.lng) {
        lat = tx.lat;
        lng = tx.lng;
      }

      if (lat && lng) {
        return { ...tx, lat, lng };
      }
      return null;
    }).filter(Boolean);
  }, [transactions]);

  // デフォルトの中心位置（データがない場合は東京）
  const defaultCenter = [35.6895, 139.6917];
  // 最新の取引場所を中心にする
  const center = mapData.length > 0 ? [mapData[0].lat, mapData[0].lng] : defaultCenter;

  return (
    <div style={{ background: '#0a0c10', borderRadius: '8px', border: '1px solid #252838', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '600px', overflow: 'hidden' }}>
      
      <div style={{ padding: '15px 20px', borderBottom: '1px solid #252838', background: '#11141a', zIndex: 1000, position: 'relative' }}>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🌍</span> 支出ロケーションマップ
        </h2>
        <div style={{ fontSize: '11px', color: '#00bfff', marginTop: '5px', fontFamily: 'monospace' }}>
          SYSTEM ONLINE // {mapData.length} 件の座標データを検出
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer 
          center={center} 
          zoom={12} 
          scrollWheelZoom={true} 
          style={{ height: '100%', width: '100%', background: '#050608' }}
        >
          {/* 🌟 ここがサイバー感を出すダークテーマのマップタイル（CartoDB Dark Matter） */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* 抽出した座標にピンを立てる */}
          {mapData.map(tx => {
            const isExpense = tx.type === 'expense';
            const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
            const dateStr = txDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
            
            return (
              <Marker 
                key={tx.id} 
                position={[tx.lat, tx.lng]} 
                icon={isExpense ? expenseIcon : cyberIcon}
              >
                <Popup className="cyber-popup">
                  <div style={{ fontFamily: 'monospace', color: '#fff', padding: '5px' }}>
                    <div style={{ fontSize: '10px', color: '#888' }}>{dateStr}</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: isExpense ? '#ff3366' : '#00ff66', margin: '5px 0' }}>
                      {isExpense ? '-' : '+'}¥{Number(tx.amount).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{tx.category}</div>
                    <div style={{ fontSize: '10px', color: '#aaa', marginTop: '3px' }}>{tx.paymentMethod}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        
        {/* レーダーのスキャンエフェクト装飾（UI用） */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '100vw', height: '100vw', background: 'conic-gradient(from 0deg, transparent 70%, rgba(0, 255, 102, 0.1) 100%)', borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', animation: 'radar-spin 4s linear infinite', zIndex: 400 }} />
      </div>

      <style>{`
        /* LeafletのPopupデザインを強制的にサイバーパンク化 */
        .leaflet-popup-content-wrapper { background: rgba(10, 12, 16, 0.95) !important; border: 1px solid #00ff66 !important; border-radius: 6px !important; box-shadow: 0 0 15px rgba(0,255,102,0.3) !important; }
        .leaflet-popup-tip { background: #0a0c10 !important; border-top: 1px solid #00ff66 !important; border-left: 1px solid #00ff66 !important; }
        .leaflet-popup-close-button { color: #00ff66 !important; }
        @keyframes radar-spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
      `}</style>
    </div>
  );
}