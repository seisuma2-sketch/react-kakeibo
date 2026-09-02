import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Marker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth'; 
import { db, auth } from '../firebase';

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

// 🌟 桃鉄風の「駅（マス）」アイコン生成
const getGameIcon = (cluster) => {
  // 出費があるかどうかでマスの色を決定
  const isExpense = cluster.txList.some(tx => tx.type === 'expense');
  const isHighAmount = cluster.totalAmount >= 30000;
  
  // 桃鉄風：高額は黄色（カード駅風）、出費は赤マス、入金のみは青マス
  let bg = isHighAmount ? '#ffd700' : (isExpense ? '#ef4444' : '#3b82f6');
  let textColor = isHighAmount ? '#000' : '#fff';
  let shadow = '0 4px 6px rgba(0,0,0,0.4)';

  const size = Math.min(48, 28 + cluster.count * 2); 

  return L.divIcon({
    className: 'clear-custom-icon',
    html: `
      <div style="width: ${size}px; height: ${size}px; background: ${bg}; color: ${textColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: ${size > 35 ? '16px' : '14px'}; border: 4px solid #ffffff; box-shadow: ${shadow}; text-shadow: ${isHighAmount ? 'none' : '0 1px 2px rgba(0,0,0,0.5)'};">
        ${cluster.count > 1 ? cluster.count : '駅'}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

function MapController({ geoJsonData, viewLevel, selectedPref }) {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => requestAnimationFrame(() => map.invalidateSize()));
    observer.observe(map.getContainer());
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => { observer.disconnect(); clearTimeout(t1); clearTimeout(t2); };
  }, [map]);

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
  const [internalTx, setInternalTx] = useState([]);

  useEffect(() => {
    if (transactions && transactions.length > 0) {
      setInternalTx(transactions);
      return;
    }
    let unsubSnapshot = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(collection(db, "transactions"), where("userId", "==", user.uid));
        unsubSnapshot = onSnapshot(q, (snapshot) => {
          const data = [];
          snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
          setInternalTx(data);
        });
      } else { setInternalTx([]); }
    });
    return () => { unsubAuth(); if (unsubSnapshot) unsubSnapshot(); };
  }, [transactions]);

  const [viewLevel, setViewLevel] = useState('PIN'); 
  const [nationalGeoJson, setNationalGeoJson] = useState(null);
  const [selectedPref, setSelectedPref] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterPeriod, setFilterPeriod] = useState('ALL');
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [timelineIndex, setTimelineIndex] = useState(100); 

  const availableCategories = useMemo(() => {
    const cats = new Set(internalTx.map(t => t.category).filter(Boolean));
    return ['ALL', ...Array.from(cats)];
  }, [internalTx]);

  const preProcessedTransactions = useMemo(() => {
    return internalTx.map(tx => {
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
  }, [internalTx]);

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

  const timeFilteredData = useMemo(() => {
    if (filteredTransactions.length === 0) return [];
    if (timelineIndex === 100) return filteredTransactions;
    const minTime = filteredTransactions[0].time;
    const maxTime = filteredTransactions[filteredTransactions.length - 1].time;
    const targetTime = minTime + (maxTime - minTime) * (timelineIndex / 100);
    return filteredTransactions.filter(tx => tx.time <= targetTime);
  }, [filteredTransactions, timelineIndex]);

  const pinClusters = useMemo(() => {
    const clusters = {};
    timeFilteredData.forEach(tx => {
      const key = `${tx.lat},${tx.lng}`;
      if (!clusters[key]) {
        clusters[key] = { lat: tx.lat, lng: tx.lng, count: 0, totalAmount: 0, txList: [], name: tx.city || 'エリア詳細' };
      }
      clusters[key].count += 1;
      clusters[key].totalAmount += Number(tx.amount) || 0;
      clusters[key].txList.push(tx);
    });
    return Object.values(clusters);
  }, [timeFilteredData]);

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
      // 桃鉄の物件独占のような明るい色
      return stat.isMastered 
        ? { fillColor: '#4ade80', weight: 2, opacity: 1, color: '#16a34a', fillOpacity: 0.6 } // 明るい緑
        : { fillColor: '#fef08a', weight: 2, opacity: 1, color: '#eab308', fillOpacity: 0.6 }; // 明るい黄色
    }
    return { fillColor: '#ffffff', weight: 1.5, opacity: 0.8, color: '#94a3b8', fillOpacity: 0.4 };
  };

  const center = filteredTransactions.length > 0 && viewLevel === 'PIN' ? [filteredTransactions[filteredTransactions.length - 1].lat, filteredTransactions[filteredTransactions.length - 1].lng] : [38.0, 137.0];

  return (
    <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: '600px', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", sans-serif' }}>
      
      {/* 🌟 白くて丸い、ポップなフィルターバー */}
      <div className="game-scroll-area" style={{ position: 'absolute', top: '15px', left: '15px', right: '15px', zIndex: 1000, display: 'flex', gap: '10px', padding: '10px', overflowX: 'auto', paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
        <button onClick={() => setFilterPeriod('ALL')} className={`game-pill ${filterPeriod === 'ALL' ? 'active' : ''}`}>ぜんぶ</button>
        <button onClick={() => setFilterPeriod('MONTH')} className={`game-pill ${filterPeriod === 'MONTH' ? 'active' : ''}`}>今月</button>
        <div style={{ width: '2px', background: '#e2e8f0', margin: '0 5px', borderRadius: '2px' }} />
        {availableCategories.map(cat => (
          <button key={cat} onClick={() => setFilterCategory(cat)} className={`game-pill ${filterCategory === cat ? 'active' : ''}`}>
            {cat.startsWith('/') ? cat.slice(cat.indexOf(' ') + 1) : cat}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: '100%' }}>
        <MapContainer 
          center={center} zoom={6} minZoom={4} maxBounds={[[-90, -180], [90, 180]]} maxBoundsViscosity={1.0} scrollWheelZoom={true} 
          zoomControl={false} attributionControl={false} 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#bae6fd', zIndex: 1 }}
        >
          {/* 🌟 ノーマルで明るい標準マップ（フィルターなしで鮮やかに！） */}
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" noWrap={true} />
          
          <MapController geoJsonData={nationalGeoJson} viewLevel={viewLevel} selectedPref={selectedPref} />

          {viewLevel === 'NATIONAL' && nationalGeoJson && (
            <GeoJSON data={nationalGeoJson} style={styleNational} onEachFeature={(feature, layer) => {
              layer.on({ click: () => { setSelectedPref(feature.properties.nam_ja); setSelectedCity(null); setViewLevel('PREF_DETAIL'); }});
            }} />
          )}

          {/* 🌟 桃鉄風の駅アイコンを配置 */}
          {(viewLevel === 'PIN' || viewLevel === 'NATIONAL') && pinClusters.map((cluster, idx) => (
            <Marker 
              key={`cluster-${idx}`} 
              position={[cluster.lat, cluster.lng]} 
              icon={getGameIcon(cluster)}
              eventHandlers={{ click: () => setSelectedCity({ name: cluster.name, stat: cluster }) }}
            >
              <Tooltip direction="top" offset={[0, -20]} opacity={1} className="game-tooltip">
                {cluster.name} {cluster.totalAmount >= 30000 ? '⭐' : ''}
              </Tooltip>
            </Marker>
          ))}

          {viewLevel === 'PREF_DETAIL' && nationalGeoJson && selectedPref && (
            <>
              <GeoJSON data={nationalGeoJson} filter={(f) => f.properties.nam_ja === selectedPref} style={{ fillColor: 'transparent', weight: 3, color: '#3b82f6', fillOpacity: 0 }} />
              {cityDomination.map((cluster, idx) => (
                <Marker 
                  key={`city-${idx}`} 
                  position={[cluster.lat, cluster.lng]} 
                  icon={getGameIcon(cluster)}
                  eventHandlers={{ click: () => setSelectedCity({ name: cluster.name, stat: cluster }) }}
                >
                  <Tooltip direction="top" offset={[0, -20]} opacity={1} className="game-tooltip">
                    {cluster.name} {cluster.totalAmount >= 30000 ? '⭐' : ''}
                  </Tooltip>
                </Marker>
              ))}
            </>
          )}
        </MapContainer>
      </div>

      {/* 🌟 ボードゲーム風の白くて見やすい詳細パネル */}
      {selectedCity && (
        <div className="game-panel" style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '380px', zIndex: 1000, padding: '20px', animation: 'slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', borderBottom: '2px dashed #cbd5e1', paddingBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>📍 {selectedPref || 'エリア情報'}</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>{selectedCity.name} 駅</div>
            </div>
            <button onClick={() => setSelectedCity(null)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', fontSize: '20px', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '2px solid #e2e8f0', padding: '12px', borderRadius: '12px' }}>
              <span style={{ color: '#475569', fontSize: '14px', fontWeight: 'bold' }}>💰 累計金額</span>
              <span style={{ color: '#ef4444', fontSize: '20px', fontWeight: '900' }}>¥{selectedCity.stat.totalAmount.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '5px', fontWeight: 'bold' }}>📝 取引きろく ({selectedCity.stat.count}件)</div>
            <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px' }}>
              {selectedCity.stat.txList.map(tx => (
                <div key={tx.id} style={{ background: '#ffffff', border: '2px solid #e2e8f0', borderLeft: `6px solid ${tx.type==='expense' ? '#ef4444' : '#3b82f6'}`, padding: '10px 12px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '8px' }}>
                  <div style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%', fontWeight: 'bold' }}>
                    {tx.date?.toDate ? `${tx.date.toDate().getMonth()+1}/${tx.date.toDate().getDate()}` : ''} · {tx.category.startsWith('/') ? tx.category.slice(tx.category.indexOf(' ')+1) : tx.category}
                  </div>
                  <div style={{ color: '#334155', fontWeight: '900' }}>¥{Number(tx.amount).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewLevel === 'PREF_DETAIL' && !selectedCity && (
        <button onClick={() => { setViewLevel('NATIONAL'); setSelectedPref(null); setSelectedCity(null); }} className="game-panel" style={{ position: 'absolute', top: '75px', left: '15px', zIndex: 1000, color: '#3b82f6', padding: '12px 20px', borderRadius: '30px', fontSize: '14px', fontWeight: '900', cursor: 'pointer', border: '2px solid #3b82f6', background: '#fff' }}>
          ◀ 全国マップに戻る
        </button>
      )}

      {/* 🌟 右下のポップなメニューボタン */}
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '15px' }}>
        
        {isFabOpen && (
          <div className="game-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeInUp 0.2s ease-out', minWidth: '240px' }}>
            
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '12px', padding: '4px', border: '2px solid #e2e8f0' }}>
              <button onClick={() => setViewLevel('PIN')} style={{ flex: 1, background: viewLevel === 'PIN' ? '#3b82f6' : 'transparent', color: viewLevel === 'PIN' ? '#fff' : '#64748b', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s' }}>📍 ピン</button>
              <button onClick={() => { setViewLevel('NATIONAL'); setSelectedPref(null); setSelectedCity(null); }} style={{ flex: 1, background: viewLevel !== 'PIN' ? '#f59e0b' : 'transparent', color: viewLevel !== 'PIN' ? '#fff' : '#64748b', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '14px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s' }}>🗾 陣取り</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>🗓️ タイムライン</span>
                <span style={{ fontSize: '14px', color: '#3b82f6', fontWeight: '900' }}>{timelineIndex}%</span>
              </div>
              <input type="range" min="0" max="100" value={timelineIndex} onChange={(e) => setTimelineIndex(Number(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }} />
            </div>
          </div>
        )}

        <button 
          onClick={() => setIsFabOpen(!isFabOpen)} 
          style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#3b82f6', color: '#fff', border: '4px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer', fontSize: '28px', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s', transform: isFabOpen ? 'rotate(45deg)' : 'rotate(0)' }}
        >
          {isFabOpen ? '×' : '🎮'}
        </button>
      </div>

      <style>{`
        /* ボードゲーム風の白くて丸いパネル */
        .game-panel {
          background: #ffffff !important;
          border: 2px solid #e2e8f0 !important;
          border-radius: 20px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
        }

        /* ポップなフィルターボタン */
        .game-scroll-area::-webkit-scrollbar { display: none; }
        .game-pill {
          background: #ffffff;
          border: 2px solid #e2e8f0;
          color: #64748b;
          padding: 10px 20px;
          border-radius: 30px;
          font-size: 14px;
          font-weight: 900;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .game-pill.active {
          background: #3b82f6;
          color: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.4);
        }

        /* 吹き出し（ツールチップ）も丸くポップに */
        .game-tooltip { 
          background: #ffffff !important; 
          border: 2px solid #cbd5e1 !important; 
          color: #334155 !important; 
          font-weight: 900; 
          font-size: 14px;
          border-radius: 12px; 
          box-shadow: 0 4px 8px rgba(0,0,0,0.15); 
          padding: 6px 12px;
        }
        .leaflet-tooltip-top:before { border-top-color: #cbd5e1 !important; }

        .clear-custom-icon { background: none; border: none; }

        @keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        /* 純正UIの一掃 */
        .leaflet-control-container { display: none !important; }
        .leaflet-popup-content-wrapper { display: none !important; }
        
        /* 🌟 CSSフィルターを全削除し、本来の明るい地図をそのまま表示！ */
        .leaflet-tile-pane { filter: none !important; }
      `}</style>
    </div>
  );
}