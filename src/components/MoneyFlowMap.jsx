import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: null, iconUrl: null, shadowUrl: null });

const cyberIcon = L.divIcon({ className: 'custom-cyber-icon', html: `<div style="width: 16px; height: 16px; background: #00ff66; border-radius: 50%; box-shadow: 0 0 10px #00ff66, 0 0 20px #00ff66; border: 2px solid #0a0c10;"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
const expenseIcon = L.divIcon({ className: 'custom-cyber-icon-expense', html: `<div style="width: 16px; height: 16px; background: #ff3366; border-radius: 50%; box-shadow: 0 0 10px #ff3366, 0 0 20px #ff3366; border: 2px solid #0a0c10;"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });

const PREF_CODES = {
  "北海道":"01", "青森県":"02", "岩手県":"03", "宮城県":"04", "秋田県":"05", "山形県":"06", "福島県":"07", "茨城県":"08", "栃木県":"09", "群馬県":"10",
  "埼玉県":"11", "千葉県":"12", "東京都":"13", "神奈川県":"14", "新潟県":"15", "富山県":"16", "石川県":"17", "福井県":"18", "山梨県":"19", "長野県":"20",
  "岐阜県":"21", "静岡県":"22", "愛知県":"23", "三重県":"24", "滋賀県":"25", "京都府":"26", "大阪府":"27", "兵庫県":"28", "奈良県":"29", "和歌山県":"30",
  "鳥取県":"31", "島根県":"32", "岡山県":"33", "広島県":"34", "山口県":"35", "徳島県":"36", "香川県":"37", "愛媛県":"38", "高知県":"39", "福岡県":"40",
  "佐賀県":"41", "長崎県":"42", "熊本県":"43", "大分県":"44", "宮崎県":"45", "鹿児島県":"46", "沖縄県":"47"
};

const PREFECTURE_CENTERS = [
  { name: "北海道", lat: 43.0642, lng: 141.3469 }, { name: "青森県", lat: 40.8244, lng: 140.7400 }, { name: "岩手県", lat: 39.7036, lng: 141.1525 }, { name: "宮城県", lat: 38.2682, lng: 140.8694 },
  { name: "秋田県", lat: 39.7186, lng: 140.1025 }, { name: "山形県", lat: 38.2527, lng: 140.3396 }, { name: "福島県", lat: 37.7608, lng: 140.4733 }, { name: "茨城県", lat: 36.3414, lng: 140.4468 },
  { name: "栃木県", lat: 36.3685, lng: 139.8831 }, { name: "群馬県", lat: 36.3911, lng: 139.0608 }, { name: "埼玉県", lat: 35.8569, lng: 139.6489 }, { name: "千葉県", lat: 35.6047, lng: 140.1233 },
  { name: "東京都", lat: 35.6895, lng: 139.6917 }, { name: "神奈川県", lat: 35.4478, lng: 139.6425 }, { name: "新潟県", lat: 37.9022, lng: 139.0236 }, { name: "富山県", lat: 36.6953, lng: 137.2113 },
  { name: "石川県", lat: 36.5944, lng: 136.6256 }, { name: "福井県", lat: 36.0641, lng: 136.2219 }, { name: "山梨県", lat: 35.6639, lng: 138.5683 }, { name: "長野県", lat: 36.6514, lng: 138.1811 },
  { name: "岐阜県", lat: 35.4233, lng: 136.7606 }, { name: "静岡県", lat: 34.9756, lng: 138.3825 }, { name: "愛知県", lat: 35.1815, lng: 136.9066 }, { name: "三重県", lat: 34.7303, lng: 136.5086 },
  { name: "滋賀県", lat: 35.0045, lng: 135.8686 }, { name: "京都府", lat: 35.0117, lng: 135.7681 }, { name: "大阪府", lat: 34.6937, lng: 135.5023 }, { name: "兵庫県", lat: 34.6913, lng: 135.1830 },
  { name: "奈良県", lat: 34.6851, lng: 135.8049 }, { name: "和歌山県", lat: 34.2261, lng: 135.1675 }, { name: "鳥取県", lat: 35.5011, lng: 134.2350 }, { name: "島根県", lat: 35.4722, lng: 133.0506 },
  { name: "岡山県", lat: 34.6617, lng: 133.9350 }, { name: "広島県", lat: 34.3853, lng: 132.4553 }, { name: "山口県", lat: 34.1858, lng: 131.4714 }, { name: "徳島県", lat: 34.0703, lng: 134.5547 },
  { name: "香川県", lat: 34.3403, lng: 134.0433 }, { name: "愛媛県", lat: 33.8392, lng: 132.7661 }, { name: "高知県", lat: 33.5597, lng: 133.5311 }, { name: "福岡県", lat: 33.5902, lng: 130.4017 },
  { name: "佐賀県", lat: 33.2633, lng: 130.3008 }, { name: "長崎県", lat: 32.7503, lng: 129.8778 }, { name: "熊本県", lat: 32.8031, lng: 130.7078 }, { name: "大分県", lat: 33.2381, lng: 131.6125 },
  { name: "宮崎県", lat: 31.9111, lng: 131.4239 }, { name: "鹿児島県", lat: 31.5969, lng: 130.5572 }, { name: "沖縄県", lat: 26.2124, lng: 127.6809 }
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

function MapController({ geoJsonData, viewLevel, selectedPref }) {
  const map = useMap();
  useEffect(() => {
    if (viewLevel === 'NATIONAL' && geoJsonData) {
      map.flyToBounds([[31.2, 129.5], [45.4, 145.8]], { duration: 1.5, padding: [10, 10] });
    } else if (viewLevel === 'PREF_DETAIL' && geoJsonData && selectedPref) {
      const feature = geoJsonData.features.find(f => f.properties.nam_ja === selectedPref);
      if (feature) {
        const bounds = L.geoJSON(feature).getBounds();
        // 🌟 スマホの時はボトムシートで下が隠れるため、上にオフセットしてズームする
        map.flyToBounds(bounds, { duration: 1.5, paddingBottomRight: [0, 200], paddingTopLeft: [20, 20] });
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

  const [timelineIndex, setTimelineIndex] = useState(100); 
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimer = useRef(null);

  const sortedTransactions = useMemo(() => {
    const list = transactions.map(tx => {
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
        if (foundLoc) {
          pref = foundLoc.name;
          lat = foundLoc.lat; 
          lng = foundLoc.lng;
        }
      }

      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
        if (!pref || !PREF_CODES[pref]) pref = guessPrefecture(lat, lng);
        return { ...tx, lat, lng, time: txDate.getTime(), prefecture: pref };
      }
      return null;
    }).filter(Boolean);

    list.sort((a, b) => a.time - b.time);
    return list;
  }, [transactions]);

  const filteredMapData = useMemo(() => {
    if (sortedTransactions.length === 0) return [];
    if (timelineIndex === 100) return sortedTransactions;

    const minTime = sortedTransactions[0].time;
    const maxTime = sortedTransactions[sortedTransactions.length - 1].time;
    const targetTime = minTime + (maxTime - minTime) * (timelineIndex / 100);

    return sortedTransactions.filter(tx => tx.time <= targetTime);
  }, [sortedTransactions, timelineIndex]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (timelineIndex >= 100) setTimelineIndex(0);
      setSelectedCity(null); // 再生時は邪魔にならないようパネルを消す
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      playTimer.current = setInterval(() => {
        setTimelineIndex(prev => {
          if (prev >= 100) { setIsPlaying(false); return 100; }
          return prev + 1;
        });
      }, 100);
    } else {
      clearInterval(playTimer.current);
    }
    return () => clearInterval(playTimer.current);
  }, [isPlaying]);

  const nationalDomination = useMemo(() => {
    const data = {};
    filteredMapData.forEach(tx => {
      const p = tx.prefecture;
      if (!p) return;
      if (!data[p]) data[p] = { count: 0, totalAmount: 0, cities: new Set() };
      data[p].count += 1;
      data[p].totalAmount += (Number(tx.amount) || 0);
      if (tx.city) data[p].cities.add(tx.city);
    });
    Object.keys(data).forEach(p => { data[p].isMastered = data[p].cities.size >= 3; });
    return data;
  }, [filteredMapData]);

  const cityDomination = useMemo(() => {
    if (!selectedPref) return {};
    const data = {};
    const prefTxs = filteredMapData.filter(tx => tx.prefecture === selectedPref);
    
    prefTxs.forEach(tx => {
      const areaName = tx.city ? `${tx.city}${tx.ward || ''}` : '[手動入力エリア]'; 
      if (!data[areaName]) data[areaName] = { count: 0, totalAmount: 0, txList: [] };
      data[areaName].count += 1;
      data[areaName].totalAmount += (Number(tx.amount) || 0);
      data[areaName].txList.push(tx);
    });
    return data;
  }, [filteredMapData, selectedPref]);

  useEffect(() => {
    if (viewLevel !== 'PIN' && !nationalGeoJson) {
      fetch('https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson')
        .then(res => res.json())
        .then(data => setNationalGeoJson(data))
        .catch(err => console.error("Map Load Error", err));
    }
  }, [viewLevel, nationalGeoJson]);

  const diveIntoPrefecture = (prefName) => {
    setSelectedPref(prefName);
    setSelectedCity(null);
    setViewLevel('PREF_DETAIL');
  };

  const styleNational = (feature) => {
    const prefName = feature.properties.nam_ja;
    const stat = nationalDomination[prefName];
    if (stat) {
      return stat.isMastered 
        ? { fillColor: '#ffeb3b', weight: 1.5, opacity: 1, color: '#ff9900', fillOpacity: 0.7 } 
        : { fillColor: '#00ff66', weight: 1.5, opacity: 1, color: '#00bfff', fillOpacity: 0.5 };
    }
    return { fillColor: '#11141a', weight: 1, opacity: 0.3, color: '#333', fillOpacity: 0.7 };
  };

  const onNationalClick = (feature, layer) => {
    layer.on({ click: () => diveIntoPrefecture(feature.properties.nam_ja) });
  };

  const defaultCenter = [38.0, 137.0];
  const center = filteredMapData.length > 0 && viewLevel === 'PIN' ? [filteredMapData[filteredMapData.length - 1].lat, filteredMapData[filteredMapData.length - 1].lng] : defaultCenter;

  return (
    <div className={`map-wrapper ${viewLevel === 'PIN' ? 'mode-pin' : 'mode-domination'}`}>
      
      {/* 🌟 1. ヘッダー (スマホでもスッキリ見せる) */}
      <div className="cyber-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🌍</span> 資金流出トラッカー
          </h2>
          <div style={{ fontSize: '11px', color: viewLevel === 'PIN' ? '#00bfff' : '#ff3366', marginTop: '5px', fontFamily: 'monospace' }}>
            {viewLevel === 'PIN' ? `SYSTEM ONLINE // ${filteredMapData.length} 件` : 
             viewLevel === 'NATIONAL' ? `DOMINATION // ${Object.keys(nationalDomination).length} エリア解錠` : 
             `INFILTRATING: ${selectedPref}`}
          </div>
        </div>
      </div>

      {/* 🌟 2. マップ表示エリア (スマホ時は全画面に広がる) */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapContainer 
          center={center} 
          zoom={6} 
          minZoom={4}
          maxBounds={[[-90, -180], [90, 180]]}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={true} 
          style={{ height: '100%', width: '100%', background: '#050608', zIndex: 1 }}
        >
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" noWrap={true} />

          <MapController geoJsonData={nationalGeoJson} viewLevel={viewLevel} selectedPref={selectedPref} />

          {viewLevel === 'NATIONAL' && nationalGeoJson && (
            <GeoJSON data={nationalGeoJson} style={styleNational} onEachFeature={onNationalClick} />
          )}

          {(viewLevel === 'PIN' || viewLevel === 'NATIONAL') && filteredMapData.map(tx => {
            const isExpense = tx.type === 'expense';
            const count = sortedTransactions.filter(t => t.lat === tx.lat && t.lng === tx.lng).length;
            const totalAmt = sortedTransactions.filter(t => t.lat === tx.lat && t.lng === tx.lng).reduce((s, t) => s + t.amount, 0);
            
            const isDanger = totalAmt >= 30000;
            const rankColor = isDanger ? '#ff0055' : (count >= 5 ? '#ffeb3b' : (count >= 3 ? '#00bfff' : '#00ff66'));
            const radiusSize = Math.min(20, 8 + count * 2);

            return (
              <React.Fragment key={tx.id}>
                <CircleMarker center={[tx.lat, tx.lng]} radius={radiusSize + 8} pathOptions={{ color: rankColor, fillColor: rankColor, fillOpacity: 0.15, weight: 1, dashArray: '4, 4' }} />
                <CircleMarker center={[tx.lat, tx.lng]} radius={radiusSize} pathOptions={{ color: rankColor, fillColor: rankColor, fillOpacity: 0.7, weight: 2 }}>
                  <Popup className="cyber-popup">
                    <div style={{ fontFamily: 'monospace', color: '#fff', padding: '5px' }}>
                      <div style={{ fontSize: '10px', color: '#888' }}>{tx.date?.toDate().toLocaleDateString('ja-JP')}</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: isExpense ? '#ff3366' : '#00ff66', margin: '5px 0' }}>{isExpense ? '-' : '+'}¥{Number(tx.amount).toLocaleString()}</div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{tx.category}</div>
                      <div style={{ fontSize: '10px', color: '#aaa', marginTop: '3px' }}>{tx.paymentMethod}</div>
                      {isDanger && <div style={{ fontSize: '9px', color: '#ff3366', fontWeight: 'bold', marginTop: '4px' }}>⚠️ DANGER ZONE (高額流出地点)</div>}
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            );
          })}

          {viewLevel === 'PREF_DETAIL' && nationalGeoJson && selectedPref && (
            <>
              <GeoJSON data={nationalGeoJson} filter={(feature) => feature.properties.nam_ja === selectedPref} style={{ fillColor: '#11141a', weight: 2, color: '#00bfff', fillOpacity: 0.6 }} />
              {Object.entries(cityDomination).map(([cityName, stat]) => {
                const anchorTx = stat.txList[0]; 
                const isHighRisk = stat.totalAmount >= 30000;
                const nodeColor = isHighRisk ? '#ff0055' : '#ff3366';
                return (
                  <CircleMarker 
                    key={cityName}
                    center={[anchorTx.lat, anchorTx.lng]}
                    radius={14}
                    pathOptions={{ color: nodeColor, fillColor: nodeColor, fillOpacity: 0.6, weight: 2 }}
                    eventHandlers={{ click: () => setSelectedCity({ name: cityName, stat }) }}
                  >
                    <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent className="cyber-tooltip">
                      {cityName} {isHighRisk ? '🔥' : ''}
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </>
          )}
        </MapContainer>
        
        {viewLevel === 'PIN' && <div style={{ position: 'absolute', top: '50%', left: '50%', width: '100vw', height: '100vw', background: 'conic-gradient(from 0deg, transparent 70%, rgba(0, 255, 102, 0.1) 100%)', borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', animation: 'radar-spin 4s linear infinite', zIndex: 400 }} />}

        {/* スマホで押しやすいように左上に固定した戻るボタン */}
        {viewLevel === 'PREF_DETAIL' && (
          <button onClick={() => { setViewLevel('NATIONAL'); setSelectedPref(null); setSelectedCity(null); }} className="abort-btn">
            ◀ 全国に戻る
          </button>
        )}

        {/* 🌟 3. ボトムシート (スマホの時は下からせり上がるサイバーパネル) */}
        {selectedCity && (
          <div className="cyber-bottom-sheet">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#888' }}>{selectedPref}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>🔓 {selectedCity.name}</div>
              </div>
              <button onClick={() => setSelectedCity(null)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer', padding: '0 10px' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#11141a', padding: '12px', borderRadius: '6px' }}>
                <span style={{ color: '#888', fontSize: '12px' }}>このエリアの流出資金</span>
                <span style={{ color: '#ff3366', fontSize: '16px', fontWeight: 'bold' }}>¥{selectedCity.stat.totalAmount.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#00bfff', marginTop: '5px' }}>[ TRANSACTION LOGS ]</div>
              <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '5px' }}>
                {selectedCity.stat.txList.map(tx => (
                  <div key={tx.id} style={{ background: '#050608', borderLeft: '2px solid #ff3366', padding: '8px 10px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 4px 4px 0' }}>
                    <div style={{ color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                      {tx.date?.toDate().toLocaleDateString('ja-JP')} // {tx.category}
                      <br/><span style={{ color: '#666', fontSize: '9px' }}>{tx.memo || tx.paymentMethod}</span>
                    </div>
                    <div style={{ color: '#ff3366', fontWeight: 'bold' }}>¥{Number(tx.amount).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🌟 4. 親指ハッキング用・サイバーコックピット (すべての操作を画面下部に集約) */}
      <div className="cyber-cockpit">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', background: '#050608', borderRadius: '6px', border: '1px solid #333', padding: '2px', flex: 1, maxWidth: '200px' }}>
            <button onClick={() => setViewLevel('PIN')} style={{ background: viewLevel === 'PIN' ? '#00bfff22' : 'transparent', color: viewLevel === 'PIN' ? '#00bfff' : '#666', border: 'none', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace', flex: 1 }}>📍 PIN</button>
            <button onClick={() => { setViewLevel('NATIONAL'); setSelectedPref(null); setSelectedCity(null); }} style={{ background: viewLevel !== 'PIN' ? '#ff336622' : 'transparent', color: viewLevel !== 'PIN' ? '#ff3366' : '#666', border: 'none', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace', flex: 1 }}>🗾 制覇</button>
          </div>
          
          <button onClick={handleTogglePlay} style={{ background: isPlaying ? '#ff3366' : '#00ff66', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', flexShrink: '0', boxShadow: `0 0 15px ${isPlaying ? 'rgba(255,51,102,0.4)' : 'rgba(0,255,102,0.4)'}` }}>
            {isPlaying ? '⏸ PAUSE' : '▶ REPLAY'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '10px', color: '#888' }}>TIME:</span>
          <input type="range" min="0" max="100" value={timelineIndex} onChange={(e) => { setIsPlaying(false); setTimelineIndex(Number(e.target.value)); }} style={{ flex: 1, accentColor: '#00ff66', cursor: 'pointer' }} />
          <span style={{ fontSize: '11px', color: '#00ff66', fontWeight: 'bold', width: '35px', textAlign: 'right' }}>{timelineIndex}%</span>
        </div>
      </div>

      <style>{`
        /* 🌟 ベースのPC向けスタイル */
        .map-wrapper { background: #0a0c10; border-radius: 8px; border: 1px solid #252838; display: flex; flex-direction: column; height: 80vh; min-height: 650px; overflow: hidden; position: relative; }
        .cyber-header { padding: 15px 20px; border-bottom: 1px solid #252838; background: #11141a; z-index: 1000; position: relative; }
        .cyber-cockpit { padding: 15px 20px; background: #11141a; border-top: 1px solid #252838; z-index: 1000; font-family: monospace; }
        .abort-btn { position: absolute; top: 20px; left: 20px; z-index: 1000; background: rgba(10, 12, 16, 0.9); border: 1px solid #ff3366; color: #ff3366; padding: 10px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; font-family: monospace; backdrop-filter: blur(5px); }
        .cyber-bottom-sheet { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(10, 12, 16, 0.95); border: 1px solid #ff3366; border-radius: 8px; padding: 15px; width: 90%; max-width: 360px; z-index: 1000; backdrop-filter: blur(10px); box-shadow: 0 10px 30px rgba(0,0,0,0.8); font-family: monospace; }
        
        .leaflet-popup-content-wrapper { background: rgba(10, 12, 16, 0.95) !important; border: 1px solid #00bfff !important; border-radius: 6px !important; box-shadow: 0 0 15px rgba(0,191,255,0.3) !important; }
        .leaflet-popup-tip { background: #0a0c10 !important; border-top: 1px solid #00bfff !important; border-left: 1px solid #00bfff !important; }
        .leaflet-popup-close-button { color: #00bfff !important; }
        .leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(110%); }
        .cyber-tooltip { background: #11141a !important; border: 1px solid #ff3366 !important; color: #ff3366 !important; font-family: monospace; font-weight: bold; border-radius: 4px; box-shadow: 0 0 10px rgba(255,51,102,0.4); }
        .leaflet-tooltip-top:before { border-top-color: #ff3366 !important; }

        @keyframes radar-spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }

        /* 📱 スマホ特化レイアウト (画面幅768px以下で発動) */
        @media (max-width: 768px) {
          .map-wrapper { height: calc(100vh - 80px) !important; min-height: 500px !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
          .cyber-header { padding: 10px 15px !important; }
          .cyber-cockpit { padding: 15px !important; padding-bottom: max(15px, env(safe-area-inset-bottom)) !important; }
          .abort-btn { top: 10px !important; left: 10px !important; padding: 8px 12px !important; font-size: 12px !important; }
          
          /* ボトムシート化（下からせり上がる） */
          .cyber-bottom-sheet {
            bottom: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 20px 20px 0 0 !important;
            border-bottom: none !important;
            padding-bottom: max(20px, env(safe-area-inset-bottom)) !important;
            animation: slideUpMobile 0.3s forwards cubic-bezier(0.2, 0.8, 0.2, 1) !important;
            transform: translateY(100%);
          }
        }
        @keyframes slideUpMobile { to { transform: translate(-50%, 0); } }
      `}</style>
    </div>
  );
}