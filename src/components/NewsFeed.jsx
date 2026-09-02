import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: null, iconUrl: null, shadowUrl: null });

const PREF_CODES = {
  "北海道":"01", "青森県":"02", "岩手県":"03", "宮城県":"04", "秋田県":"05", "山形県":"06", "福島県":"07", "茨城県":"08", "栃木県":"09", "群馬県":"10",
  "埼玉県":"11", "千葉県":"12", "東京都":"13", "神奈川県":"14", "新潟県":"15", "富山県":"16", "石川県":"17", "福井県":"18", "山梨県":"19", "長野県":"20",
  "岐阜県":"21", "静岡県":"22", "愛知県":"23", "三重県":"24", "滋賀県":"25", "京都府":"26", "大阪府":"27", "兵庫県":"28", "奈良県":"29", "和歌山県":"30",
  "鳥取県":"31", "島根県":"32", "岡山県":"33", "広島県":"34", "山口県":"35", "徳島県":"36", "香川県":"37", "愛媛県":"38", "高知県":"39", "福岡県":"40",
  "佐賀県":"41", "長崎県":"42", "熊本県":"43", "大分県":"44", "宮崎県":"45", "鹿児島県":"46", "沖縄県":"47"
};

const PREFECTURE_CENTERS = [
  { name: "北海道", lat: 43.0642, lng: 141.3469 }, { name: "青森県", lat: 40.8244, lng: 140.7400 }, { name: "岩手県", lat: 39.7036, lng: 141.1525 }, { name: "宮城県", lat: 38.2682, lng: 140.8694 },
  { name: "秋田県", lat: 39.7186, lng: 140.1025 }, { name: "山形県", lat: 38.2527, lng: 140.3396 }, { name: "東京都", lat: 35.6895, lng: 139.6917 }, { name: "大阪府", lat: 34.6937, lng: 135.5023 },
  { name: "京都府", lat: 35.0117, lng: 135.7681 }, { name: "兵庫県", lat: 34.6913, lng: 135.1830 }, { name: "福岡県", lat: 33.5902, lng: 130.4017 }, { name: "沖縄県", lat: 26.2124, lng: 127.6809 }
];

const guessPrefecture = (lat, lng) => {
  let closest = "Unknown";
  let minDist = Infinity;
  for (const pref of PREFECTURE_CENTERS) {
    const dist = Math.pow(pref.lat - lat, 2) + Math.pow(pref.lng - lng, 2);
    if (dist < minDist) { minDist = dist; closest = pref.name; }
  }
  return closest;
};

const guessLocationFromText = (text) => {
  if (!text) return null;
  for (const pref of PREFECTURE_CENTERS) {
    const shortName = pref.name.replace(/[都府県]$/, '');
    if (text.includes(pref.name) || text.includes(shortName)) return pref;
  }
  return null;
};

// --- カメラ操作コントローラー ---
function MapController({ geoJsonData, viewLevel, selectedPref }) {
  const map = useMap();
  useEffect(() => {
    if (viewLevel === 'NATIONAL' && geoJsonData) {
      map.flyToBounds([[31.2, 129.5], [45.4, 145.8]], { duration: 1.5, padding: [10, 10] });
    } else if (viewLevel === 'PREF_DETAIL' && geoJsonData && selectedPref) {
      const feature = geoJsonData.features.find(f => f.properties.nam_ja === selectedPref);
      if (feature) {
        const bounds = L.geoJSON(feature).getBounds();
        map.flyToBounds(bounds, { duration: 1.5, paddingBottomRight: [0, 250], paddingTopLeft: [20, 20] });
      }
    }
  }, [geoJsonData, viewLevel, selectedPref, map]);
  return null;
}

export default function MoneyFlowMap({ transactions = [] }) {
  const [viewLevel, setViewLevel] = useState('PIN'); 
  const [nationalGeoJson, setNationalGeoJson] = useState(null);
  const [selectedPref, setSelectedPref] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  // 🌟 1. ワンタップ・フィルター機能用 State
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterPeriod, setFilterPeriod] = useState('ALL');
  const [isFabOpen, setIsFabOpen] = useState(false); // 🌟 スマート収納ボタン用

  const [timelineIndex, setTimelineIndex] = useState(100); 
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimer = useRef(null);

  // カテゴリ一覧を抽出
  const availableCategories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category).filter(Boolean));
    return ['ALL', ...Array.from(cats)];
  }, [transactions]);

  // 全データの前処理
  const preProcessedTransactions = useMemo(() => {
    return transactions.map(tx => {
      let lat = tx.lat ? parseFloat(tx.lat) : null;
      let lng = tx.lng ? parseFloat(tx.lng) : null;
      let pref = tx.prefecture;
      let rawLoc = tx.location || tx.fullAddress || tx.memo || '';

      if (!lat && rawLoc && typeof rawLoc === 'string') {
        const match = rawLoc.match(/GEO-NODE \[([-\d.]+),\s*([-\d.]+)\]/);
        if (match) { lat = parseFloat(match[1]); lng = parseFloat(match[2]); }
      }
      if ((!lat || !lng) && typeof rawLoc === 'string') {
        const foundLoc = guessLocationFromText(rawLoc);
        if (foundLoc) { pref = foundLoc.name; lat = foundLoc.lat; lng = foundLoc.lng; }
      }

      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
        if (!pref || !PREF_CODES[pref]) pref = guessPrefecture(lat, lng);
        return { ...tx, lat, lng, time: txDate.getTime(), prefecture: pref };
      }
      return null;
    }).filter(Boolean);
  }, [transactions]);

  // 🌟 フィルター適用
  const filteredTransactions = useMemo(() => {
    return preProcessedTransactions.filter(tx => {
      if (filterCategory !== 'ALL' && tx.category !== filterCategory) return false;
      if (filterPeriod === 'MONTH') {
        const date = new Date(tx.time);
        const now = new Date();
        if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return false;
      }
      return true;
    }).sort((a, b) => a.time - b.time);
  }, [preProcessedTransactions, filterCategory, filterPeriod]);

  // タイムラインの絞り込み
  const timeFilteredData = useMemo(() => {
    if (filteredTransactions.length === 0) return [];
    if (timelineIndex === 100) return filteredTransactions;

    const minTime = filteredTransactions[0].time;
    const maxTime = filteredTransactions[filteredTransactions.length - 1].time;
    const targetTime = minTime + (maxTime - minTime) * (timelineIndex / 100);

    return filteredTransactions.filter(tx => tx.time <= targetTime);
  }, [filteredTransactions, timelineIndex]);

  // 🌟 2. ピンのクラスタリング（自動おまとめ機能）
  const pinClusters = useMemo(() => {
    const clusters = {};
    timeFilteredData.forEach(tx => {
      // 座標が同じものを一つにまとめる
      const key = `${tx.lat},${tx.lng}`;
      if (!clusters[key]) {
        clusters[key] = { lat: tx.lat, lng: tx.lng, count: 0, totalAmount: 0, txList: [], name: tx.city || 'ロケーション詳細' };
      }
      clusters[key].count += 1;
      clusters[key].totalAmount += Number(tx.amount) || 0;
      clusters[key].txList.push(tx);
    });
    return Object.values(clusters);
  }, [timeFilteredData]);

  // 制覇データの計算
  const nationalDomination = useMemo(() => {
    const data = {};
    timeFilteredData.forEach(tx => {
      const p = tx.prefecture;
      if (!p) return;
      if (!data[p]) data[p] = { count: 0, totalAmount: 0, cities: new Set() };
      data[p].count += 1;
      data[p].totalAmount += (Number(tx.amount) || 0);
      if (tx.city) data[p].cities.add(tx.city);
    });
    Object.keys(data).forEach(p => { data[p].isMastered = data[p].cities.size >= 3; });
    return data;
  }, [timeFilteredData]);

  const cityDomination = useMemo(() => {
    if (!selectedPref) return {};
    const data = {};
    timeFilteredData.filter(tx => tx.prefecture === selectedPref).forEach(tx => {
      const areaName = tx.city ? `${tx.city}${tx.ward || ''}` : '[手動入力エリア]'; 
      if (!data[areaName]) data[areaName] = { lat: tx.lat, lng: tx.lng, count: 0, totalAmount: 0, txList: [], name: areaName };
      data[areaName].count += 1;
      data[areaName].totalAmount += (Number(tx.amount) || 0);
      data[areaName].txList.push(tx);
    });
    return Object.values(data);
  }, [timeFilteredData, selectedPref]);

  useEffect(() => {
    if (isPlaying) {
      playTimer.current = setInterval(() => {
        setTimelineIndex(prev => {
          if (prev >= 100) { setIsPlaying(false); return 100; }
          return prev + 1.5;
        });
      }, 100);
    } else {
      clearInterval(playTimer.current);
    }
    return () => clearInterval(playTimer.current);
  }, [isPlaying]);

  useEffect(() => {
    if (viewLevel !== 'PIN' && !nationalGeoJson) {
      fetch('https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson')
        .then(res => res.json())
        .then(data => setNationalGeoJson(data))
        .catch(err => console.error(err));
    }
  }, [viewLevel, nationalGeoJson]);

  const styleNational = (feature) => {
    const prefName = feature.properties.nam_ja;
    const stat = nationalDomination[prefName];
    if (stat) {
      return stat.isMastered 
        ? { fillColor: '#ffeb3b', weight: 1.5, opacity: 1, color: '#ff9900', fillOpacity: 0.6 } 
        : { fillColor: '#00ff66', weight: 1.5, opacity: 1, color: '#00bfff', fillOpacity: 0.4 };
    }
    return { fillColor: '#11141a', weight: 1, opacity: 0.3, color: '#333', fillOpacity: 0.7 };
  };

  const center = filteredTransactions.length > 0 && viewLevel === 'PIN' ? [filteredTransactions[filteredTransactions.length - 1].lat, filteredTransactions[filteredTransactions.length - 1].lng] : [38.0, 137.0];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      
      {/* 🌟 4. ワンタップ・フィルター (スマートタグ) */}
      {/* NewsFeedのヘッダーが被らないよう top: 75px に配置 */}
      <div className="glass-panel filter-scroll-area" style={{ position: 'absolute', top: '75px', left: '15px', right: '15px', zIndex: 1000, display: 'flex', gap: '8px', padding: '10px', borderRadius: '30px', overflowX: 'auto' }}>
        <button onClick={() => setFilterPeriod('ALL')} className={`pill-btn ${filterPeriod === 'ALL' ? 'active' : ''}`}>全期間</button>
        <button onClick={() => setFilterPeriod('MONTH')} className={`pill-btn ${filterPeriod === 'MONTH' ? 'active' : ''}`}>今月</button>
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 5px' }} />
        {availableCategories.map(cat => (
          <button key={cat} onClick={() => setFilterCategory(cat)} className={`pill-btn ${filterCategory === cat ? 'active' : ''}`}>
            {cat.startsWith('/') ? cat.slice(cat.indexOf(' ') + 1) : cat}
          </button>
        ))}
      </div>

      <MapContainer 
        center={center} zoom={6} minZoom={4} maxBounds={[[-90, -180], [90, 180]]} maxBoundsViscosity={1.0} scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%', background: '#050608', zIndex: 1 }}
      >
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" noWrap={true} />
        <MapController geoJsonData={nationalGeoJson} viewLevel={viewLevel} selectedPref={selectedPref} />

        {viewLevel === 'NATIONAL' && nationalGeoJson && (
          <GeoJSON data={nationalGeoJson} style={styleNational} onEachFeature={(feature, layer) => {
            layer.on({ click: () => { setSelectedPref(feature.properties.nam_ja); setSelectedCity(null); setViewLevel('PREF_DETAIL'); }});
          }} />
        )}

        {/* 🌟 2. クラスタリング描画 (まとまって表示！) */}
        {(viewLevel === 'PIN' || viewLevel === 'NATIONAL') && pinClusters.map((cluster, idx) => {
          const isDanger = cluster.totalAmount >= 30000;
          const rankColor = isDanger ? '#ff0055' : (cluster.count >= 5 ? '#ffeb3b' : (cluster.count >= 3 ? '#00bfff' : '#00ff66'));
          const radiusSize = Math.min(24, 10 + cluster.count * 2); // 件数で大きくなる

          return (
            <React.Fragment key={`cluster-${idx}`}>
              <CircleMarker center={[cluster.lat, cluster.lng]} radius={radiusSize + 8} pathOptions={{ color: rankColor, fillColor: rankColor, fillOpacity: 0.15, weight: 1, dashArray: '4, 4' }} />
              <CircleMarker 
                center={[cluster.lat, cluster.lng]} radius={radiusSize} pathOptions={{ color: rankColor, fillColor: rankColor, fillOpacity: 0.8, weight: 2 }}
                eventHandlers={{ click: () => setSelectedCity({ name: cluster.name, stat: cluster }) }}
              >
                {/* 中心に件数を表示 (1件なら表示しない) */}
                {cluster.count > 1 && (
                  <Tooltip direction="center" permanent className="cluster-text">{cluster.count}</Tooltip>
                )}
              </CircleMarker>
            </React.Fragment>
          );
        })}

        {/* 市レベルの表示 */}
        {viewLevel === 'PREF_DETAIL' && nationalGeoJson && selectedPref && (
          <>
            <GeoJSON data={nationalGeoJson} filter={(f) => f.properties.nam_ja === selectedPref} style={{ fillColor: 'transparent', weight: 2, color: '#00bfff', fillOpacity: 0 }} />
            {cityDomination.map((cluster, idx) => {
              const isHighRisk = cluster.totalAmount >= 30000;
              const nodeColor = isHighRisk ? '#ff0055' : '#ff3366';
              const rSize = Math.min(24, 12 + cluster.count * 2);
              return (
                <CircleMarker 
                  key={`city-${idx}`} center={[cluster.lat, cluster.lng]} radius={rSize} pathOptions={{ color: nodeColor, fillColor: nodeColor, fillOpacity: 0.8, weight: 2 }}
                  eventHandlers={{ click: () => setSelectedCity({ name: cluster.name, stat: cluster }) }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent className="cyber-tooltip">
                    {cluster.name} {isHighRisk ? '🔥' : ''}
                  </Tooltip>
                  {cluster.count > 1 && <Tooltip direction="center" permanent className="cluster-text">{cluster.count}</Tooltip>}
                </CircleMarker>
              );
            })}
          </>
        )}
      </MapContainer>

      {/* 🌟 1. グラスモーフィズム詳細パネル (ボトムシート) */}
      {selectedCity && (
        <div className="glass-panel" style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '380px', zIndex: 1000, padding: '20px', animation: 'slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{selectedPref || 'LOCATION INFO'}</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>🔓 {selectedCity.name}</div>
            </div>
            <button onClick={() => setSelectedCity(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer', opacity: 0.6 }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>このエリアの資金</span>
              <span style={{ color: '#00ff66', fontSize: '18px', fontWeight: 'bold' }}>¥{selectedCity.stat.totalAmount.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#00bfff', marginTop: '5px', letterSpacing: '1px' }}>[ TRANSACTION LOGS ({selectedCity.stat.count}件) ]</div>
            <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedCity.stat.txList.map(tx => (
                <div key={tx.id} style={{ background: 'rgba(255,255,255,0.05)', borderLeft: `3px solid ${tx.type==='expense' ? '#ff3366' : '#00bfff'}`, padding: '8px 12px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '4px' }}>
                  <div style={{ color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                    {tx.date?.toDate ? tx.date.toDate().toLocaleDateString('ja-JP') : ''} // {tx.category.startsWith('/') ? tx.category.slice(tx.category.indexOf(' ')+1) : tx.category}
                  </div>
                  <div style={{ color: '#fff', fontWeight: 'bold', fontFamily: 'monospace' }}>¥{Number(tx.amount).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewLevel === 'PREF_DETAIL' && !selectedCity && (
        <button onClick={() => { setViewLevel('NATIONAL'); setSelectedPref(null); setSelectedCity(null); }} className="glass-panel" style={{ position: 'absolute', top: '130px', left: '15px', zIndex: 1000, color: '#00bfff', padding: '10px 15px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace', border: '1px solid #00bfff' }}>
          ◀ 全国マップに戻る
        </button>
      )}

      {/* 🌟 3. スマート収納 FAB (右下に浮くコントロールボタン) */}
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '15px' }}>
        
        {isFabOpen && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeInUp 0.2s ease-out', minWidth: '220px' }}>
            
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '4px' }}>
              <button onClick={() => setViewLevel('PIN')} style={{ flex: 1, background: viewLevel === 'PIN' ? '#00bfff' : 'transparent', color: viewLevel === 'PIN' ? '#000' : '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>📍 PIN</button>
              <button onClick={() => { setViewLevel('NATIONAL'); setSelectedPref(null); setSelectedCity(null); }} style={{ flex: 1, background: viewLevel !== 'PIN' ? '#ff3366' : 'transparent', color: viewLevel !== 'PIN' ? '#fff' : '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>🗾 制覇</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#888', fontWeight: 'bold' }}>TIMELINE REPLAY</span>
                <span style={{ fontSize: '12px', color: '#00ff66', fontFamily: 'monospace', fontWeight: 'bold' }}>{timelineIndex}%</span>
              </div>
              <input type="range" min="0" max="100" value={timelineIndex} onChange={(e) => { setIsPlaying(false); setTimelineIndex(Number(e.target.value)); }} style={{ width: '100%', accentColor: '#00ff66' }} />
              <button onClick={() => { if(timelineIndex>=100) setTimelineIndex(0); setIsPlaying(!isPlaying); setSelectedCity(null); }} style={{ background: isPlaying ? 'rgba(255,51,102,0.2)' : 'rgba(0,255,102,0.2)', color: isPlaying ? '#ff3366' : '#00ff66', border: `1px solid ${isPlaying ? '#ff3366' : '#00ff66'}`, padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', marginTop: '5px' }}>
                {isPlaying ? '⏸ PAUSE' : '▶ START REPLAY'}
              </button>
            </div>
          </div>
        )}

        <button 
          onClick={() => setIsFabOpen(!isFabOpen)} 
          style={{ width: '56px', height: '56px', borderRadius: '50%', background: isFabOpen ? '#1a1d24' : '#00ff66', color: isFabOpen ? '#fff' : '#000', border: isFabOpen ? '1px solid #333' : 'none', boxShadow: isFabOpen ? 'none' : '0 10px 20px rgba(0,255,102,0.4)', cursor: 'pointer', fontSize: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.3s', transform: isFabOpen ? 'rotate(90deg)' : 'rotate(0)' }}
        >
          {isFabOpen ? '✕' : '⚙️'}
        </button>
      </div>

      <style>{`
        /* 🌟 グラスモーフィズム共通クラス */
        .glass-panel {
          background: rgba(10, 12, 16, 0.65) !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-top: 1px solid rgba(255, 255, 255, 0.2) !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;
        }

        /* 🌟 ワンタップ・フィルターのタグボタン */
        .filter-scroll-area::-webkit-scrollbar { display: none; }
        .pill-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .pill-btn.active {
          background: #00bfff;
          color: #000;
          border-color: #00bfff;
          box-shadow: 0 0 15px rgba(0, 191, 255, 0.4);
        }

        /* 🌟 クラスタリング数字バッジ */
        .cluster-text {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #050608 !important;
          font-family: monospace;
          font-weight: bold;
          font-size: 14px;
          text-shadow: none;
        }

        /* アニメーション＆微調整 */
        @keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .leaflet-popup-content-wrapper { display: none !important; /* ボトムシートを使うので元の小さなPopupは非表示 */ }
        .leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(120%); }
        .cyber-tooltip { background: rgba(10,12,16,0.8) !important; border: 1px solid #ff3366 !important; color: #ff3366 !important; font-family: monospace; font-weight: bold; border-radius: 4px; box-shadow: 0 0 10px rgba(255,51,102,0.4); backdrop-filter: blur(5px); }
        .leaflet-tooltip-top:before { border-top-color: #ff3366 !important; }
      `}</style>
    </div>
  );
}