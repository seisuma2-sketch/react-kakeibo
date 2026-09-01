import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: null, iconUrl: null, shadowUrl: null });

const cyberIcon = L.divIcon({ className: 'custom-cyber-icon', html: `<div style="width: 16px; height: 16px; background: #00ff66; border-radius: 50%; box-shadow: 0 0 10px #00ff66, 0 0 20px #00ff66; border: 2px solid #0a0c10;"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
const expenseIcon = L.divIcon({ className: 'custom-cyber-icon-expense', html: `<div style="width: 16px; height: 16px; background: #ff3366; border-radius: 50%; box-shadow: 0 0 10px #ff3366, 0 0 20px #ff3366; border: 2px solid #0a0c10;"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });

function MapController({ geoJsonData, viewLevel, selectedPref }) {
  const map = useMap();
  useEffect(() => {
    if (viewLevel === 'NATIONAL' && geoJsonData) {
      map.flyToBounds([[31.2, 129.5], [45.4, 145.8]], { duration: 1.5, padding: [10, 10] });
    } else if (viewLevel === 'PREF_DETAIL' && geoJsonData && selectedPref) {
      const feature = geoJsonData.features.find(f => f.properties.nam_ja === selectedPref);
      if (feature) {
        const bounds = L.geoJSON(feature).getBounds();
        map.flyToBounds(bounds, { duration: 1.5, padding: [30, 30] });
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

  // 🌟 タイムライン再生用State
  const [timelineIndex, setTimelineIndex] = useState(100); // 0〜100%
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimer = useRef(null);

  // 1. 全トランザクションの座標抽出 ＆ 日付ソート
  const sortedTransactions = useMemo(() => {
    const list = transactions.map(tx => {
      let lat = tx.lat ? parseFloat(tx.lat) : null;
      let lng = tx.lng ? parseFloat(tx.lng) : null;
      if (!lat && tx.location && typeof tx.location === 'string') {
        const match = tx.location.match(/GEO-NODE \[([-\d.]+),\s*([-\d.]+)\]/);
        if (match) { lat = parseFloat(match[1]); lng = parseFloat(match[2]); }
      }
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
        return { ...tx, lat, lng, time: txDate.getTime() };
      }
      return null;
    }).filter(Boolean);

    // 古い順にソート（タイムライン再生のため）
    list.sort((a, b) => a.time - b.time);
    return list;
  }, [transactions]);

  // タイムラインの％に応じて絞り込まれたデータ
  const filteredMapData = useMemo(() => {
    if (sortedTransactions.length === 0) return [];
    if (timelineIndex === 100) return sortedTransactions;

    const minTime = sortedTransactions[0].time;
    const maxTime = sortedTransactions[sortedTransactions.length - 1].time;
    const targetTime = minTime + (maxTime - minTime) * (timelineIndex / 100);

    return sortedTransactions.filter(tx => tx.time <= targetTime);
  }, [sortedTransactions, timelineIndex]);

  // タイムライン自動再生の制御
  useEffect(() => {
    if (isPlaying) {
      playTimer.current = setInterval(() => {
        setTimelineIndex(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            clearInterval(playTimer.current);
            return 100;
          }
          return prev + 2;
        });
      }, 150);
    } else {
      clearInterval(playTimer.current);
    }
    return () => clearInterval(playTimer.current);
  }, [isPlaying]);

  // 2. 全国レベルの制覇データ（絞り込みデータ対応）
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
    Object.keys(data).forEach(p => {
      data[p].isMastered = data[p].cities.size >= 3; 
    });
    return data;
  }, [filteredMapData]);

  // 3. 市区町村レベルの制覇データ（絞り込みデータ対応）
  const cityDomination = useMemo(() => {
    if (!selectedPref) return {};
    const data = {};
    const prefTxs = filteredMapData.filter(tx => tx.prefecture === selectedPref);
    
    prefTxs.forEach(tx => {
      const areaName = `${tx.city || ''}${tx.ward || ''}`; 
      if (!areaName) return;
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
        ? { fillColor: '#ffeb3b', weight: 1, opacity: 1, color: '#ff9900', fillOpacity: 0.8 } 
        : { fillColor: '#00ff66', weight: 1, opacity: 1, color: '#00bfff', fillOpacity: 0.5 };
    }
    return { fillColor: '#11141a', weight: 1, opacity: 0.3, color: '#333', fillOpacity: 0.7 };
  };

  const onNationalClick = (feature, layer) => {
    layer.on({ click: () => diveIntoPrefecture(feature.properties.nam_ja) });
  };

  const defaultCenter = [38.0, 137.0];
  const center = filteredMapData.length > 0 && viewLevel === 'PIN' ? [filteredMapData[filteredMapData.length - 1].lat, filteredMapData[filteredMapData.length - 1].lng] : defaultCenter;

  return (
    <div style={{ background: '#0a0c10', borderRadius: '8px', border: `1px solid ${viewLevel === 'PIN' ? '#252838' : '#ff3366'}`, display: 'flex', flexDirection: 'column', height: '80vh', minHeight: '650px', overflow: 'hidden', position: 'relative' }}>
      
      {/* ヘッダー＆モード切替 */}
      <div style={{ padding: '15px 20px', borderBottom: '1px solid #252838', background: '#11141a', zIndex: 1000, position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🌍</span> 資金流出トラッカー
          </h2>
          <div style={{ fontSize: '11px', color: viewLevel === 'PIN' ? '#00bfff' : '#ff3366', marginTop: '5px', fontFamily: 'monospace' }}>
            {viewLevel === 'PIN' ? `SYSTEM ONLINE // ${filteredMapData.length} 件のデータ (TIME: ${timelineIndex}%)` : 
             viewLevel === 'NATIONAL' ? `DOMINATION MODE // ${Object.keys(nationalDomination).length} エリア解錠` : 
             `INFILTRATING: ${selectedPref}`}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#050608', borderRadius: '6px', border: '1px solid #333', padding: '2px' }}>
            <button onClick={() => setViewLevel('PIN')} style={{ background: viewLevel === 'PIN' ? '#00bfff22' : 'transparent', color: viewLevel === 'PIN' ? '#00bfff' : '#666', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace' }}>📍 PIN</button>
            <button onClick={() => { setViewLevel('NATIONAL'); setSelectedPref(null); setSelectedCity(null); }} style={{ background: viewLevel !== 'PIN' ? '#ff336622' : 'transparent', color: viewLevel !== 'PIN' ? '#ff3366' : '#666', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace' }}>🗾 制覇マップ</button>
          </div>
        </div>
      </div>

      <div style={{ height: 'calc(100% - 120px)', position: 'relative' }}>
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

          {/* 1. PINモード (タイムリンク＆レーダー＆ノードランク対応) */}
          {viewLevel === 'PIN' && filteredMapData.map(tx => {
            const isExpense = tx.type === 'expense';
            // 🌟 拠点レベル判定 (利用回数や金額に応じたランク分け)
            const count = sortedTransactions.filter(t => t.lat === tx.lat && t.lng === tx.lng).length;
            const totalAmt = sortedTransactions.filter(t => t.lat === tx.lat && t.lng === tx.lng).reduce((s, t) => s + t.amount, 0);
            
            // 🌟 警戒レベル判定 (累計3万円以上使っているエリアは危険な赤色に変化)
            const isDanger = totalAmt >= 30000;
            const rankColor = isDanger ? '#ff0055' : (count >= 5 ? '#ffeb3b' : (count >= 3 ? '#00bfff' : '#00ff66'));
            const radiusSize = Math.min(20, 8 + count * 2);

            return (
              <React.Fragment key={tx.id}>
                {/* レーダー脈動パルス波 */}
                <CircleMarker
                  center={[tx.lat, tx.lng]}
                  radius={radiusSize + 8}
                  pathOptions={{ color: rankColor, fillColor: rankColor, fillOpacity: 0.15, weight: 1, dashArray: '4, 4' }}
                />
                <CircleMarker 
                  center={[tx.lat, tx.lng]}
                  radius={radiusSize}
                  pathOptions={{ color: rankColor, fillColor: rankColor, fillOpacity: 0.7, weight: 2 }}
                >
                  <Popup className="cyber-popup">
                    <div style={{ fontFamily: 'monospace', color: '#fff', padding: '5px' }}>
                      <div style={{ fontSize: '10px', color: '#888' }}>{tx.date?.toDate().toLocaleDateString('ja-JP')}</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: isExpense ? '#ff3366' : '#00ff66', margin: '5px 0' }}>
                        {isExpense ? '-' : '+'}¥{Number(tx.amount).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{tx.category}</div>
                      <div style={{ fontSize: '10px', color: '#aaa', marginTop: '3px' }}>{tx.paymentMethod}</div>
                      {isDanger && <div style={{ fontSize: '9px', color: '#ff3366', fontWeight: 'bold', marginTop: '4px' }}>⚠️ DANGER ZONE (高額流出地点)</div>}
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            );
          })}

          {viewLevel === 'NATIONAL' && nationalGeoJson && (
            <GeoJSON data={nationalGeoJson} style={styleNational} onEachFeature={onNationalClick} />
          )}

          {viewLevel === 'PREF_DETAIL' && nationalGeoJson && selectedPref && (
            <>
              <GeoJSON 
                data={nationalGeoJson} 
                filter={(feature) => feature.properties.nam_ja === selectedPref}
                style={{ fillColor: '#11141a', weight: 2, color: '#00bfff', fillOpacity: 0.6 }} 
              />
              
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

        {viewLevel === 'PREF_DETAIL' && (
          <button onClick={() => { setViewLevel('NATIONAL'); setSelectedPref(null); setSelectedCity(null); }} style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1000, background: 'rgba(10, 12, 16, 0.9)', border: '1px solid #ff3366', color: '#ff3366', padding: '10px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace', backdropFilter: 'blur(5px)' }}>
            ◀ AREA ABORT (全国に戻る)
          </button>
        )}

        {selectedCity && (
          <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(10, 12, 16, 0.95)', border: `1px solid #ff3366`, borderRadius: '8px', padding: '15px', width: '90%', maxWidth: '360px', zIndex: 1000, backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', fontFamily: 'monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#888' }}>{selectedPref}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🔓 {selectedCity.name}
                </div>
              </div>
              <button onClick={() => setSelectedCity(null)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#11141a', padding: '8px', borderRadius: '4px' }}>
                <span style={{ color: '#888', fontSize: '12px' }}>このエリアの流出資金</span>
                <span style={{ color: '#ff3366', fontSize: '16px', fontWeight: 'bold' }}>¥{selectedCity.stat.totalAmount.toLocaleString()}</span>
              </div>
              
              <div style={{ fontSize: '10px', color: '#00bfff', marginTop: '5px' }}>[ TRANSACTION LOGS ]</div>
              <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '5px' }}>
                {selectedCity.stat.txList.map(tx => (
                  <div key={tx.id} style={{ background: '#050608', borderLeft: '2px solid #ff3366', padding: '6px 8px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

      {/* 🌟 タイムライン・コントロールバー (PINモード時のみ表示) */}
      {viewLevel === 'PIN' && (
        <div style={{ padding: '12px 20px', background: '#11141a', borderTop: '1px solid #252838', display: 'flex', alignItems: 'center', gap: '15px', zIndex: 1000, fontFamily: 'monospace' }}>
          <button 
            onClick={() => setIsPlaying(!isPlaying)} 
            style={{ background: isPlaying ? '#ff3366' : '#00ff66', color: '#000', border: 'none', padding: '6px 14px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', flexShrink: '0', boxShadow: `0 0 10px ${isPlaying ? 'rgba(255,51,102,0.4)' : 'rgba(0,255,102,0.4)'}` }}
          >
            {isPlaying ? '⏸ PAUSE' : '▶ REPLAY'}
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '10px', color: '#888' }}>TIMELINE:</span>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={timelineIndex} 
              onChange={(e) => { setIsPlaying(false); setTimelineIndex(Number(e.target.value)); }} 
              style={{ flex: 1, accentColor: '#00ff66', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '11px', color: '#00ff66', fontWeight: 'bold', width: '35px', textAlign: 'right' }}>{timelineIndex}%</span>
          </div>
        </div>
      )}

      <style>{`
        .leaflet-popup-content-wrapper { background: rgba(10, 12, 16, 0.95) !important; border: 1px solid #00bfff !important; border-radius: 6px !important; box-shadow: 0 0 15px rgba(0,191,255,0.3) !important; }
        .leaflet-popup-tip { background: #0a0c10 !important; border-top: 1px solid #00bfff !important; border-left: 1px solid #00bfff !important; }
        .leaflet-popup-close-button { color: #00bfff !important; }
        .leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(110%); }
        .cyber-tooltip { background: #11141a !important; border: 1px solid #ff3366 !important; color: #ff3366 !important; font-family: monospace; font-weight: bold; border-radius: 4px; box-shadow: 0 0 10px rgba(255,51,102,0.4); }
        .leaflet-tooltip-top:before { border-top-color: #ff3366 !important; }
        @keyframes radar-spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
      `}</style>
    </div>
  );
}