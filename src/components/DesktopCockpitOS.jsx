import React, { useState, useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function DesktopCockpitOS({ transactions = [], ghostAccounts = [], onSwitchMode }) {
  const [panels, setPanels] = useState(() => {
    const saved = localStorage.getItem('cockpitPanelsConfig');
    return saved ? JSON.parse(saved) : {
      chart: true,
      cartridges: true,
      radar: true,
      terminal: true,
      log: true
    };
  });

  const [maximizedPanel, setMaximizedPanel] = useState(null);

  const chartRef = useRef(null);
  const radarRef = useRef(null);

  useEffect(() => {
    localStorage.getItem('cockpitPanelsConfig', JSON.stringify(panels));
  }, [panels]);

  const togglePanel = (key) => {
    setPanels(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('cockpitPanelsConfig', JSON.stringify(next));
      return next;
    });
  };

  // --- データ計算ロジック ---
  const systemData = React.useMemo(() => {
    let totalIn = 0; let totalOut = 0; let totalBal = 0;
    const catOut = {}; const methodBal = {}; const dLabels = []; const bData = [];
    const now = new Date(); const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const chronologicalTx = [...transactions].reverse();
    chronologicalTx.forEach(tx => {
      const amt = Number(tx.amount) || 0; const method = tx.paymentMethod || '不明'; const cat = tx.category || '不明';
      if (!ghostAccounts.includes(method)) {
        if (!methodBal[method]) methodBal[method] = 0;
        if (tx.type === 'income') { 
          methodBal[method] += amt; 
          if (tx.date && (tx.date.toDate ? tx.date.toDate() : new Date(tx.date)) >= thisMonthStart) totalIn += amt; 
        } else if (tx.type === 'expense') { 
          methodBal[method] -= amt; 
          if (tx.date && (tx.date.toDate ? tx.date.toDate() : new Date(tx.date)) >= thisMonthStart) { 
            totalOut += amt; 
            catOut[cat] = (catOut[cat] || 0) + amt; 
          } 
        }
        let currentTot = 0; Object.values(methodBal).forEach(v => currentTot += v);
        if (tx.date) { 
          dLabels.push((tx.date.toDate ? tx.date.toDate() : new Date(tx.date)).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })); 
          bData.push(currentTot); 
        }
      }
    });
    Object.values(methodBal).forEach(v => totalBal += v);
    return { totalIn, totalOut, totalBal, catOut, methodBal, dLabels, bData };
  }, [transactions, ghostAccounts]);

  // --- ECharts メインチャート ---
  useEffect(() => {
    if (!panels.chart || !chartRef.current || (maximizedPanel && maximizedPanel !== 'chart')) return;
    const chart = echarts.init(chartRef.current);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(10, 12, 16, 0.95)', borderColor: '#00ff66', textStyle: { color: '#fff', fontSize: 12 } },
      grid: { left: '15px', right: '15px', bottom: '15px', top: '15px', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: systemData.dLabels, axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } }, axisLabel: { color: '#888', fontSize: 11 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.04)' } }, axisLabel: { color: '#888', fontSize: 11, formatter: (val) => val >= 10000 ? `${val/10000}万` : val } },
      series: [{ type: 'line', smooth: true, data: systemData.bData, itemStyle: { color: '#00ff66' }, lineStyle: { width: 3, shadowColor: 'rgba(0, 255, 102, 0.5)', shadowBlur: 10 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0, 255, 102, 0.3)' }, { offset: 1, color: 'rgba(0, 255, 102, 0.0)' }]) } }]
    });
    const resize = () => chart.resize(); window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); chart.dispose(); };
  }, [systemData, panels.chart, maximizedPanel]);

  // --- ECharts レーダーチャート ---
  useEffect(() => {
    if (!panels.radar || !radarRef.current || (maximizedPanel && maximizedPanel !== 'radar')) return;
    const chart = echarts.init(radarRef.current);
    const keys = Object.keys(systemData.catOut); 
    const maxVal = Math.max(...Object.values(systemData.catOut), 10000); 
    const indicator = keys.length > 0 ? keys.map(k => ({ name: k, max: maxVal })) : [{ name: 'N/A', max: 100 }]; 
    const values = keys.length > 0 ? keys.map(k => systemData.catOut[k]) : [0];
    
    chart.setOption({
      backgroundColor: 'transparent',
      radar: { indicator, radius: '65%', axisName: { color: '#00ff66', fontSize: 11 }, splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }, splitArea: { show: false } },
      series: [{ type: 'radar', data: [{ value: values, name: '支出比率', itemStyle: { color: '#00ff66' }, areaStyle: { color: 'rgba(0, 255, 102, 0.25)' }, lineStyle: { width: 2, color: '#00ff66' } }] }]
    });
    const resize = () => chart.resize(); window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); chart.dispose(); };
  }, [systemData, panels.radar, maximizedPanel]);

  const liveNet = systemData.totalIn - systemData.totalOut;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#050608', color: '#fff', fontFamily: 'sans-serif', overflow: 'hidden', boxSizing: 'border-box' }}>
      
      {/* 🌟 上部コントロールバー（高さ固定・完全整列） */}
      <div style={{ height: '60px', minHeight: '60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', background: '#0a0c10', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#00ff66', fontSize: '18px' }}>⚡</span>
            <span style={{ color: '#fff', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '16px', letterSpacing: '1px' }}>
              M402 <span style={{ color: '#00ff66' }}>COCKPIT OS</span>
            </span>
          </div>
          
          <div style={{ height: '20px', width: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />

          <div style={{ display: 'flex', gap: '6px', background: '#050608', padding: '4px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '11px', color: '#666', padding: '0 8px', display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>PANELS:</span>
            {['chart', 'cartridges', 'radar', 'terminal', 'log'].map(key => (
              <button key={key} onClick={() => togglePanel(key)} style={menuBtn(panels[key])}>{key.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#050608', padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#888' }}>THIS MONTH:</span>
            <span style={{ fontFamily: 'monospace', color: liveNet >= 0 ? '#00ff66' : '#ff3366', fontWeight: 'bold', fontSize: '15px' }}>
              {liveNet >= 0 ? '+' : ''}¥{liveNet.toLocaleString()}
            </span>
          </div>

          <button onClick={onSwitchMode} style={{ background: 'rgba(0, 191, 255, 0.1)', color: '#00bfff', border: '1px solid #00bfff', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🖥️</span> スタンダードビューに戻る
          </button>
        </div>
      </div>

      {/* 🌟 完全対称グリッド・ワークスペース */}
      <div style={{ flex: 1, padding: '20px', display: maximizedPanel ? 'block' : 'grid', gridTemplateColumns: '320px minmax(0, 1fr) 320px', gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', overflow: 'hidden', boxSizing: 'border-box' }}>
        
        {/* === [左カラム] 入力＆ログ（幅320px固定・上下均等分割） === */}
        {(!maximizedPanel || maximizedPanel === 'terminal' || maximizedPanel === 'log') && (
          <div style={{ gridRow: 'span 2', display: maximizedPanel ? 'block' : 'flex', flexDirection: 'column', gap: '16px', height: '100%', minHeight: 0 }}>
            {/* [左上] クイック入力 */}
            {panels.terminal && (!maximizedPanel || maximizedPanel === 'terminal') && (
              <HackerPanel title="QUICK INPUT // 入力" icon="⌨️" onMaximize={() => setMaximizedPanel(maximizedPanel ? null : 'terminal')} isMax={maximizedPanel === 'terminal'} onClose={() => togglePanel('terminal')} style={{ flex: 1 }}>
                {/* 🌟 エラー修正：justifyContent に直しました！ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input type="number" placeholder="金額 (例: 1500)" style={cleanInput} />
                    <input type="text" placeholder="カテゴリ (例: 食費)" style={cleanInput} />
                    <input type="text" placeholder="決済元 (例: PayPay)" style={cleanInput} />
                  </div>
                  <button style={actionBtn}>
                    ⚡ 即時記録する
                  </button>
                </div>
              </HackerPanel>
            )}
            {/* [左下] リアルタイムログ */}
            {panels.log && (!maximizedPanel || maximizedPanel === 'log') && (
              <HackerPanel title="TRANSACTIONS // 履歴" icon="📜" onMaximize={() => setMaximizedPanel(maximizedPanel ? null : 'log')} isMax={maximizedPanel === 'log'} onClose={() => togglePanel('log')} style={{ flex: 1 }}>
                <div style={{ overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                  {transactions.slice(0, 20).map(tx => {
                    const isEx = tx.type === 'expense';
                    return (
                      <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.02)', borderLeft: `3px solid ${isEx ? '#ff3366' : '#00bfff'}`, borderRadius: '4px', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{tx.category}</span>
                        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: isEx ? '#ff3366' : '#00bfff', fontWeight: 'bold' }}>{isEx ? '-' : '+'}¥{Number(tx.amount).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </HackerPanel>
            )}
          </div>
        )}

        {/* === [中央カラム] 総合残高トレンド（中央・広大スペース） === */}
        {panels.chart && (!maximizedPanel || maximizedPanel === 'chart') && (
          <HackerPanel title="TOTAL ASSET TREND // 総合残高推移トレンド" icon="📈" style={{ gridRow: maximizedPanel ? 'auto' : 'span 2', height: '100%', minHeight: 0 }} onMaximize={() => setMaximizedPanel(maximizedPanel ? null : 'chart')} isMax={maximizedPanel === 'chart'} onClose={() => togglePanel('chart')}>
            <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
          </HackerPanel>
        )}

        {/* === [右カラム] 口座残高＆比率（幅320px固定・上下均等分割） === */}
        {(!maximizedPanel || maximizedPanel === 'cartridges' || maximizedPanel === 'radar') && (
          <div style={{ gridRow: 'span 2', display: maximizedPanel ? 'block' : 'flex', flexDirection: 'column', gap: '16px', height: '100%', minHeight: 0 }}>
            {/* [右上] カートリッジ残高 */}
            {panels.cartridges && (!maximizedPanel || maximizedPanel === 'cartridges') && (
              <HackerPanel title="ACCOUNTS // 口座・クレジット" icon="💳" onMaximize={() => setMaximizedPanel(maximizedPanel ? null : 'cartridges')} isMax={maximizedPanel === 'cartridges'} onClose={() => togglePanel('cartridges')} style={{ flex: 1 }}>
                <div style={{ overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {Object.entries(systemData.methodBal).map(([name, bal]) => (
                    <div key={name} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '10px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', color: '#ccc', fontWeight: 'bold' }}>{name}</span>
                      <span style={{ fontSize: '14px', fontFamily: 'monospace', color: bal < 0 ? '#ff3366' : '#fff', fontWeight: 'bold' }}>¥{bal.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </HackerPanel>
            )}
            {/* [右下] カテゴリ比率（レーダーチャート） */}
            {panels.radar && (!maximizedPanel || maximizedPanel === 'radar') && (
              <HackerPanel title="CATEGORY // 支出比率" icon="🕸️" onMaximize={() => setMaximizedPanel(maximizedPanel ? null : 'radar')} isMax={maximizedPanel === 'radar'} onClose={() => togglePanel('radar')} style={{ flex: 1 }}>
                <div ref={radarRef} style={{ width: '100%', height: '100%' }} />
              </HackerPanel>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// --- 究極に整列されたパネルコンポーネント ---
function HackerPanel({ title, children, icon, onMaximize, isMax, onClose, style = {} }) {
  return (
    <div style={{ background: '#0a0c10', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.06)', boxSizing: 'border-box', ...style }}>
      {/* タイトルバー（高さ44px完全固定） */}
      <div style={{ height: '44px', minHeight: '44px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px', background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>{icon}</span>
          <span style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', letterSpacing: '0.5px' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={onMaximize} style={winBtn} title={isMax ? "元に戻す" : "最大化"}>{isMax ? '❐' : '□'}</button>
          <button onClick={onClose} style={{ ...winBtn, color: '#ff3366' }} title="閉じる">×</button>
        </div>
      </div>
      {/* コンテンツエリア */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '14px', position: 'relative', boxSizing: 'border-box' }}>
        {children}
      </div>
    </div>
  );
}

const menuBtn = (active) => ({ background: active ? 'rgba(0, 255, 102, 0.15)' : 'transparent', color: active ? '#00ff66' : '#666', border: `1px solid ${active ? 'rgba(0, 255, 102, 0.4)' : 'transparent'}`, padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.15s' });
const winBtn = { background: 'rgba(255, 255, 255, 0.05)', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '12px', width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' };
const cleanInput = { width: '100%', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', color: '#fff', padding: '10px 12px', borderRadius: '6px', outline: 'none', boxSizing: 'border-box', fontSize: '13px', transition: 'border-color 0.2s' };
const actionBtn = { width: '100%', background: '#00ff66', color: '#000', border: 'none', padding: '12px', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', transition: 'opacity 0.2s', boxShadow: '0 0 15px rgba(0, 255, 102, 0.2)' };