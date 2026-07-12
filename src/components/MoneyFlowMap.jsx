import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // 🌟 これがないと地図が崩れるので注意！

export default function MoneyFlowMap({ transactions }) {
  // 位置情報（lat, lng）を持っているデータだけを抽出
  const mappedTx = transactions.filter(tx => tx.lat && tx.lng);

  return (
    <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #ff3366', height: '600px', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ fontSize: '18px', borderBottom: '1px solid #252838', paddingBottom: '10px', marginTop: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
        📍 資金流出トラッカー (Money Flow Map)
      </h2>
      
      <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', border: '1px solid #252838' }}>
        {/* 神戸付近を初期の中心座標に設定 */}
        <MapContainer center={[34.6901, 135.1955]} zoom={11} style={{ height: '100%', width: '100%' }}>
          {/* 🌟 超クールなハッカー風ダークモード地図（CartoDB Dark Matter） */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          {mappedTx.map((tx) => {
            const isExpense = tx.type === 'expense';
            // 支出は赤、収入は緑の光るマーカー
            const color = isExpense ? '#ff3366' : '#00ff66';
            
            return (
              <CircleMarker
                key={tx.id}
                center={[tx.lat, tx.lng]}
                radius={8}
                pathOptions={{ 
                  color: color, 
                  fillColor: color, 
                  fillOpacity: 0.6,
                  weight: 2
                }}
              >
                <Popup>
                  <div style={{ color: '#000', fontWeight: 'bold' }}>
                    <div style={{ fontSize: '14px', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '4px' }}>
                      {tx.category}
                    </div>
                    <div style={{ color: color, fontSize: '16px' }}>
                      {isExpense ? '-' : '+'}¥{tx.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>
                      {tx.memo || 'メモなし'}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}