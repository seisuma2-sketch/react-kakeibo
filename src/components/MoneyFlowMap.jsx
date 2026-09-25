import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents, Marker, Tooltip } from 'react-leaflet';
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

// 🌟 桃鉄風の「駅（マス）」アイコン生成（ズーム倍率に応じたスタイル切り替え）
const getGameIcon = (cluster, zoomLevel = 6) => {
  // 出費があるかどうかでマスの色を決定
  const isExpense = cluster.txList.some(tx => tx.type === 'expense');
  const isHighAmount = cluster.totalAmount >= 30000;
  
  // 桃鉄風：高額は黄色（カード駅風）、出費は赤マス、入金のみは青マス
  let bg = isHighAmount ? '#ffd700' : (isExpense ? '#ef4444' : '#3b82f6');
  let textColor = isHighAmount ? '#000' : '#fff';
  let shadow = '0 4px 6px rgba(0,0,0,0.4)';

  let labelText = cluster.count > 1 ? cluster.count : '駅';
  let size = Math.min(48, 28 + cluster.count * 2);

  // 詳細ズーム(個別ピン)で単発の場合はピン型アイコン
  if (zoomLevel >= 15 && cluster.count === 1) {
    labelText = '📍';
    size = 32;
  }

  return L.divIcon({
    className: 'clear-custom-icon',
    html: `
      <div style="width: ${size}px; height: ${size}px; background: ${bg}; color: ${textColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: ${size > 35 ? '16px' : (labelText === '📍' ? '16px' : '13px')}; border: 3px solid #ffffff; box-shadow: ${shadow}; text-shadow: ${isHighAmount ? 'none' : '0 1px 2px rgba(0,0,0,0.5)'};">
        ${labelText}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

function MapController({ geoJsonData, viewLevel, selectedPref, onZoomChange, flyToTarget, onFlyCompleted }) {
  const map = useMap();

  useMapEvents({
    zoomend: () => {
      if (onZoomChange) onZoomChange(map.getZoom());
    }
  });

  useEffect(() => {
    const observer = new ResizeObserver(() => requestAnimationFrame(() => map.invalidateSize()));
    observer.observe(map.getContainer());
    const t1 = setTimeout(() => {
      map.invalidateSize();
      if (onZoomChange) onZoomChange(map.getZoom());
    }, 100);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => { observer.disconnect(); clearTimeout(t1); clearTimeout(t2); };
  }, [map, onZoomChange]);

  // プログラムによる位置・ズーム移動（ピンクリックや現在地ボタン）
  useEffect(() => {
    if (flyToTarget) {
      map.flyTo(flyToTarget.center, flyToTarget.zoom, { duration: 1.2 });
      if (onFlyCompleted) onFlyCompleted();
    }
  }, [flyToTarget, map, onFlyCompleted]);

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

  // 🌟 ズームレベル追従 & 現在地追従State
  const [currentZoom, setCurrentZoom] = useState(6);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

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

  // 🌟 ズーム倍率（拡大縮小）に応じた動的クラスタリング
  // 広域(zoom < 10): 都道府県まとめ
  // 中域(zoom 10〜14): 市区町村まとめ
  // 詳細(zoom >= 15): 正確な個別地点ピン
  const pinClusters = useMemo(() => {
    if (timeFilteredData.length === 0) return [];

    const clusters = {};

    timeFilteredData.forEach(tx => {
      let clusterKey = '';
      let clusterName = '';

      if (currentZoom < 10) {
        // ① 広域: 都道府県単位
        const pref = tx.prefecture || guessPrefecture(tx.lat, tx.lng) || '全国';
        clusterKey = `pref_${pref}`;
        clusterName = `${pref}`;
      } else if (currentZoom < 15) {
        // ② 中域: 市区町村単位
        const pref = tx.prefecture || '';
        const city = tx.city || '';
        const ward = tx.ward || '';
        if (city || ward) {
          clusterKey = `city_${pref}_${city}_${ward}`;
          clusterName = `${city}${ward}`;
        } else {
          const gridLat = tx.lat.toFixed(2);
          const gridLng = tx.lng.toFixed(2);
          clusterKey = `grid_${gridLat}_${gridLng}`;
          clusterName = `${pref || 'エリア'}`;
        }
      } else {
        // ③ 詳細 (>= 15): 完全な個別地点
        const exactLat = tx.lat.toFixed(5);
        const exactLng = tx.lng.toFixed(5);
        clusterKey = `exact_${exactLat}_${exactLng}`;
        const cleanCat = tx.category.startsWith('/') ? tx.category.slice(tx.category.indexOf(' ') + 1) : tx.category;
        clusterName = tx.memo || cleanCat || tx.city || '購入地点';
      }

      if (!clusters[clusterKey]) {
        clusters[clusterKey] = {
          key: clusterKey,
          name: clusterName,
          level: currentZoom < 10 ? 'pref' : (currentZoom < 15 ? 'city' : 'exact'),
          count: 0,
          totalAmount: 0,
          txList: [],
          latSum: 0,
          lngSum: 0,
          lat: tx.lat,
          lng: tx.lng
        };
      }

      clusters[clusterKey].count += 1;
      clusters[clusterKey].totalAmount += Number(tx.amount) || 0;
      clusters[clusterKey].txList.push(tx);
      clusters[clusterKey].latSum += tx.lat;
      clusters[clusterKey].lngSum += tx.lng;
    });

    return Object.values(clusters).map(c => ({
      ...c,
      lat: c.level === 'exact' ? c.lat : c.latSum / c.count,
      lng: c.level === 'exact' ? c.lng : c.lngSum / c.count
    }));
  }, [timeFilteredData, currentZoom]);

  // 🌟 ピン（駅）タップ時のハンドラー（広域・中域ならズームイン、詳細ならパネル表示）
  const handleClusterClick = (cluster) => {
    if (cluster.level === 'pref') {
      setFlyToTarget({ center: [cluster.lat, cluster.lng], zoom: 11 });
    } else if (cluster.level === 'city') {
      setFlyToTarget({ center: [cluster.lat, cluster.lng], zoom: 16 });
    }
    setSelectedCity({ name: cluster.name, stat: cluster });
  };

  // 🌟 現在地にジャンプするハンドラー
  const handleJumpToCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("端末のGPS機能が利用できません");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        setFlyToTarget({ center: [latitude, longitude], zoom: 16 });
      },
      (err) => {
        setIsLocating(false);
        alert("現在地を取得できませんでした: " + (err.message || 'GPS信号エラー'));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

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

  // 🌟 エリア別消費ランキング Top 5 の算出
  const topAreaRankings = useMemo(() => {
    const areaMap = {};
    timeFilteredData.forEach(tx => {
      if (tx.type && tx.type !== 'expense') return;
      const amt = Number(tx.amount) || 0;
      if (amt <= 0) return;

      const pref = tx.prefecture || guessPrefecture(tx.lat, tx.lng) || '';
      const city = tx.city ? `${tx.city}${tx.ward || ''}` : '';
      const areaName = city ? `${pref ? pref + ' ' : ''}${city}` : (pref || 'その他');

      if (!areaMap[areaName]) {
        areaMap[areaName] = {
          name: areaName,
          totalAmount: 0,
          count: 0,
          latSum: 0,
          lngSum: 0,
          txList: []
        };
      }
      areaMap[areaName].totalAmount += amt;
      areaMap[areaName].count += 1;
      areaMap[areaName].latSum += tx.lat;
      areaMap[areaName].lngSum += tx.lng;
      areaMap[areaName].txList.push(tx);
    });

    return Object.values(areaMap)
      .map(item => ({
        ...item,
        lat: item.latSum / item.count,
        lng: item.lngSum / item.count
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);
  }, [timeFilteredData]);

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
      <div className="game-scroll-area" style={{ position: 'absolute', top: '15px', left: '15px', right: '70px', zIndex: 1000, display: 'flex', gap: '10px', padding: '10px', overflowX: 'auto', paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
        <button onClick={() => setFilterPeriod('ALL')} className={`game-pill ${filterPeriod === 'ALL' ? 'active' : ''}`}>ぜんぶ</button>
        <button onClick={() => setFilterPeriod('MONTH')} className={`game-pill ${filterPeriod === 'MONTH' ? 'active' : ''}`}>今月</button>
        <div style={{ width: '2px', background: '#e2e8f0', margin: '0 5px', borderRadius: '2px' }} />
        {availableCategories.map(cat => (
          <button key={cat} onClick={() => setFilterCategory(cat)} className={`game-pill ${filterCategory === cat ? 'active' : ''}`}>
            {cat.startsWith('/') ? cat.slice(cat.indexOf(' ') + 1) : cat}
          </button>
        ))}
      </div>

      {/* 🌟 右上の現在地ジャンプボタン */}
      <button 
        onClick={handleJumpToCurrentLocation}
        title="現在地にジャンプ"
        style={{
          position: 'absolute',
          top: '25px',
          right: '15px',
          zIndex: 1001,
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: '#ffffff',
          border: '2px solid #cbd5e1',
          boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '20px',
          transition: 'all 0.2s',
          outline: 'none'
        }}
      >
        {isLocating ? '⏳' : '🎯'}
      </button>

      {/* 🌟 エリア別消費ランキング Top 5（タップでフライ移動） */}
      {topAreaRankings.length > 0 && (
        <div className="game-scroll-area" style={{ position: 'absolute', top: '72px', left: '15px', right: '15px', zIndex: 999, display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', padding: '4px 0' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.95)', border: '1.5px solid #cbd5e1', borderRadius: '20px', padding: '5px 12px', fontSize: '11px', fontWeight: '900', color: '#0f172a', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', flexShrink: 0 }}>
            🏆 エリア消費 Top5:
          </div>
          {topAreaRankings.map((area, index) => {
            const medals = ['🥇', '🥈', '🥉', '4位', '5位'];
            return (
              <button
                key={area.name}
                type="button"
                onClick={() => {
                  setFlyToTarget({ center: [area.lat, area.lng], zoom: 15 });
                  setSelectedCity({
                    name: area.name,
                    stat: {
                      ...area,
                      level: 'city'
                    }
                  });
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: index === 0 ? '2px solid #eab308' : '1.5px solid #cbd5e1',
                  borderRadius: '20px',
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#1e293b',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexShrink: 0,
                  transition: 'all 0.15s'
                }}
              >
                <span>{medals[index]}</span>
                <span style={{ fontWeight: '900' }}>{area.name}</span>
                <span style={{ color: '#ef4444', fontWeight: '900' }}>¥{area.totalAmount.toLocaleString()}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 🌟 現在のズーム階層ガイドバッジ */}
      <div style={{ position: 'absolute', top: topAreaRankings.length > 0 ? '116px' : '75px', left: '15px', zIndex: 998, background: 'rgba(255,255,255,0.92)', border: '1px solid #cbd5e1', borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: 'bold', color: '#475569', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', pointerEvents: 'none' }}>
        {currentZoom < 10 ? '🗾 全国（都道府県まとめ）' : (currentZoom < 15 ? '🏘️ 市区町村まとめ' : '📍 詳細地点（ピンポイント）')}
      </div>

      <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: '100%' }}>
        <MapContainer 
          center={center} zoom={6} minZoom={4} maxBounds={[[-90, -180], [90, 180]]} maxBoundsViscosity={1.0} scrollWheelZoom={true} 
          zoomControl={false} attributionControl={false} 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#bae6fd', zIndex: 1 }}
        >
          {/* 🌟 ノーマルで明るい標準マップ（フィルターなしで鮮やかに！） */}
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" noWrap={true} />
          
          <MapController 
            geoJsonData={nationalGeoJson} 
            viewLevel={viewLevel} 
            selectedPref={selectedPref} 
            onZoomChange={setCurrentZoom}
            flyToTarget={flyToTarget}
            onFlyCompleted={() => setFlyToTarget(null)}
          />

          {viewLevel === 'NATIONAL' && nationalGeoJson && (
            <GeoJSON data={nationalGeoJson} style={styleNational} onEachFeature={(feature, layer) => {
              layer.on({ click: () => { setSelectedPref(feature.properties.nam_ja); setSelectedCity(null); setViewLevel('PREF_DETAIL'); }});
            }} />
          )}

          {/* 🌟 現在地ピン（青いパルスエフェクト付き） */}
          {currentLocation && (
            <Marker 
              position={[currentLocation.lat, currentLocation.lng]}
              icon={L.divIcon({
                className: 'clear-custom-icon',
                html: `
                  <div style="position: relative; width: 24px; height: 24px;">
                    <div style="position: absolute; top: 1px; left: 1px; width: 22px; height: 22px; border-radius: 50%; background: #00bfff; border: 3px solid #ffffff; box-shadow: 0 0 10px #00bfff;"></div>
                    <div style="position: absolute; top: -6px; left: -6px; width: 36px; height: 36px; border-radius: 50%; background: rgba(0, 191, 255, 0.4); animation: pulseCurrentLoc 1.8s infinite ease-out;"></div>
                  </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })}
            >
              <Tooltip direction="top" offset={[0, -15]} opacity={1} className="game-tooltip">
                🎯 あなたの現在地
              </Tooltip>
            </Marker>
          )}

          {/* 🌟 桃鉄風の駅アイコンを配置（ズーム連動で都道府県→市区町村→詳細ピンへ自動変化） */}
          {(viewLevel === 'PIN' || viewLevel === 'NATIONAL') && pinClusters.map((cluster, idx) => (
            <Marker 
              key={`cluster-${cluster.key || idx}`} 
              position={[cluster.lat, cluster.lng]} 
              icon={getGameIcon(cluster, currentZoom)}
              eventHandlers={{ click: () => handleClusterClick(cluster) }}
            >
              <Tooltip direction="top" offset={[0, -20]} opacity={1} className="game-tooltip">
                {cluster.name} {cluster.totalAmount >= 30000 ? '⭐' : ''} {cluster.count > 1 ? `(${cluster.count}件)` : ''}
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
                  icon={getGameIcon(cluster, currentZoom)}
                  eventHandlers={{ click: () => handleClusterClick(cluster) }}
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
        <div className="game-panel" style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '92%', maxWidth: '390px', zIndex: 1000, padding: '18px', animation: 'slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', borderBottom: '2px dashed #cbd5e1', paddingBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>
                📍 {selectedCity.stat.txList[0]?.prefecture || selectedPref || 'エリア情報'}
                {selectedCity.stat.txList[0]?.city ? ` > ${selectedCity.stat.txList[0].city}` : ''}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                {selectedCity.name} {selectedCity.stat.level !== 'exact' ? '駅' : ''}
              </div>
            </div>
            <button onClick={() => setSelectedCity(null)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', fontSize: '18px', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '2px solid #e2e8f0', padding: '10px 14px', borderRadius: '12px' }}>
              <span style={{ color: '#475569', fontSize: '13px', fontWeight: 'bold' }}>💰 累計支出</span>
              <span style={{ color: '#ef4444', fontSize: '19px', fontWeight: '900' }}>¥{selectedCity.stat.totalAmount.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', fontWeight: 'bold' }}>📝 取引明細 ({selectedCity.stat.count}件)</div>
            <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {selectedCity.stat.txList.map(tx => (
                <div key={tx.id} style={{ background: '#ffffff', border: '2px solid #e2e8f0', borderLeft: `5px solid ${tx.type==='expense' ? '#ef4444' : '#3b82f6'}`, padding: '8px 10px', fontSize: '12px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{ color: '#334155', fontWeight: 'bold' }}>
                      {tx.date?.toDate ? `${tx.date.toDate().getMonth()+1}/${tx.date.toDate().getDate()}` : ''} · {tx.category.startsWith('/') ? tx.category.slice(tx.category.indexOf(' ')+1) : tx.category}
                    </span>
                    <span style={{ color: '#ef4444', fontWeight: '900', fontSize: '14px' }}>¥{Number(tx.amount).toLocaleString()}</span>
                  </div>
                  {tx.memo && (
                    <div style={{ color: '#475569', fontSize: '11px', marginBottom: '2px' }}>
                      💬 {tx.memo}
                    </div>
                  )}
                  {tx.fullAddress && (
                    <div style={{ color: '#64748b', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      📍 {tx.fullAddress}
                    </div>
                  )}
                  {tx.paymentMethod && (
                    <div style={{ marginTop: '4px' }}>
                      <span style={{ fontSize: '9px', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                        💳 {tx.paymentMethod.includes(' ') ? tx.paymentMethod.split(' ')[1] : tx.paymentMethod}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewLevel === 'PREF_DETAIL' && !selectedCity && (
        <button onClick={() => { setViewLevel('NATIONAL'); setSelectedPref(null); setSelectedCity(null); }} className="game-panel" style={{ position: 'absolute', top: '110px', left: '15px', zIndex: 1000, color: '#3b82f6', padding: '10px 16px', borderRadius: '30px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', border: '2px solid #3b82f6', background: '#fff' }}>
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
        
        @keyframes pulseCurrentLoc {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(2.0); opacity: 0; }
        }

        /* 純正UIの一掃 */
        .leaflet-control-container { display: none !important; }
        .leaflet-popup-content-wrapper { display: none !important; }
        
        /* 🌟 CSSフィルターを全削除し、本来の明るい地図をそのまま表示！ */
        .leaflet-tile-pane { filter: none !important; }
      `}</style>
    </div>
  );
}