import React, { useState, useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function DesktopCockpitOS({ transactions = [], ghostAccounts = [], onSwitchMode }) {
  // 🌟 パネルの表示/非表示ステート（自由配置OS機能）
  const [panels, setPanels] = useState(() => {
    const saved = localStorage.getItem('cockpitPanelsConfig');
    return saved ? JSON.parse(saved) : {
      chart: true,       // 中央：メインチャート
      cartridges: true,  // 右上：カートリッジ残高
      radar: true,       // 右下：カテゴリ比率
      terminal: true,    // 左上：クイック入力コンソール
      log: true          // 左下：リアルタイム通信ログ
    };
  });

  // 🌟 最大化しているパネル名（nullなら通常グリッド）
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

  // --- データ計算（既存のロジックを踏襲＆高密度化） ---
  const systemData = React.useMemo(() => {
    let totalIn = 0; let totalOut = 0; let totalBal = 0;
    const catOut = {};
    const methodBal = {};
    const dLabels = []; const bData = [];
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const chronologicalTx = [...transactions].reverse();
    chronologicalTx.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      const method = tx.paymentMethod || '不明';
      const cat = tx.category || '不明';

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
        let currentTot = 0;
        Object.values(methodBal).forEach(v => currentTot += v);
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
    if (!panels.chart || !chartRef.current || maximizedPanel && maximizedPanel !== 'chart') return;
    const chart = echarts.init(chartRef.current);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,0,0,0.8)', borderColor: '#00ff66', textStyle: { color: '#fff' } },
      grid: { left: '3%', right: '3%', bottom: '5%', top: '10%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: systemData.dLabels, axisLine: { lineStyle: { color: '#00ff6655' } }, axisLabel: { color: '#888', fontSize: 10 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#252838' } }, axisLabel: { color: '#888', fontSize: 10 } },
      series: [{ type: 'line', smooth: true, data: systemData.bData, itemStyle: { color: '#00ff66' }, lineStyle: { width: 2, shadowColor: '#00ff66', shadowBlur: 5 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0,255,102,0.3)' }, { offset: 1, color: 'rgba(0,255,102,0)' }]) } }]
    });
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); chart.dispose(); };
  }, [systemData, panels.chart, maximizedPanel]);

  // --- ECharts レーダーチャート ---
  useEffect(() => {
    if (!panels.radar || !radarRef.current || maximizedPanel && maximizedPanel !== 'radar') return;
    const chart = echarts.init(radarRef.current);
    const keys = Object.keys(systemData.catOut);
    const maxVal = Math.max(...Object.values(systemData.catOut), 10000);
    const indicator = keys.length > 0 ? keys.map(k => ({ name: k, max: maxVal })) : [{ name: 'データなし', max: 100 }];
    const values = keys.length > 0 ? keys.map(k => systemData.catOut[k]) : [0];

    chart.setOption({
      backgroundColor: 'transparent',
      radar: { indicator, axisName: { color: '#00ff66', fontSize: 10 }, splitLine: { lineStyle: { color: '#252838' } }, splitArea: { show: false } },
      series: [{ type: 'radar', data: [{ value: values, name: '支出比率', itemStyle: { color: '#00ff66' }, areaStyle: { color: 'rgba(0,255,102,0.2)' } }] }]
    });
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); chart.dispose(); };
  }, [systemData, panels.radar, maximizedPanel]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#050608', color: '#fff', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {/* 🌟 上部コントロールバー（OSメニュー） */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#0a0c10', borderBottom: '1px solid #00ff6644', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ color: '#00ff66', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '16px', letterSpacing: '1px' }}>
            ⚡ COCKPIT OS // 1画面統合コックピット
          </span>
          <div style={{ display: 'flex', gap: '6px', background: '#11141a', padding: '4px', borderRadius: '6px', border: '1px solid #252838' }}>
            <span style={{ fontSize: '11px', color: '#888', padding: '2px 6px', display: 'flex', alignItems: 'center' }}>表示パネル:</span>
            <button onClick={() => togglePanel('chart')} style={menuBtn(panels.chart)}>📈 チャート</button>
            <button onClick={() => togglePanel('cartridges')} style={menuBtn(panels.cartridges)}>💳 カートリッジ</button>
            <button onClick={() => togglePanel('radar')} style={menuBtn(panels.radar)}>🕸️ 比率</button>
            <button onClick={() => togglePanel('terminal')} style={menuBtn(panels.terminal)}>⌨️ 入力</button>
            <button onClick={() => togglePanel('log')} style={menuBtn(panels.log)}>📜 ログ</button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00bfff' }}>
            今月収支: <span style={{ color: systemData.totalIn - systemData.totalOut >= 0 ? '#00ff66' : '#ff3366', fontWeight: 'bold', fontSize: '14px' }}>
              {systemData.totalIn - systemData.totalOut >= 0 ? '+' : ''}¥{(systemData.totalIn - systemData.totalOut).toLocaleString()}
            </span>
          </div>
          {/* 🌟 標準ビューに戻るボタン */}
          <button onClick={onSwitchMode} style={{ background: 'rgba(0, 191, 255, 0.1)', color: '#00bfff', border: '1px solid #00bfff', padding: '6px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 10px rgba(0,191,255,0.2)' }}>
            🖥️ スタンダードビューに戻る
          </button>
        </div>
      </div>

      {/* 🌟 メイン・グリッド・ワークスペース（1画面統合配置） */}
      <div style={{ flex: 1, padding: '15px', display: maximizedPanel ? 'block' : 'grid', gridTemplateColumns: '320px 1fr 340px', gridTemplateRows: '1fr 1fr', gap: '15px', overflow: 'hidden' }}>
        
        {/* === 左列1: ターミナル入力ウィンドウ === */}
        {panels.terminal && (!maximizedPanel || maximizedPanel === 'terminal') && (
          <WindowPanel title="⌨️ TERMINAL // クイック入力" onMaximize={() => setMaximizedPanel(maximizedPanel ? null : 'terminal')} isMax={maximizedPanel === 'terminal'} onClose={() => togglePanel('terminal')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px', height: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}>
              <div style={{ fontSize: '11px', color: '#888' }}>&gt; COMMAND INPUT READY...</div>
              <input type="number" placeholder="金額 (例: 1500)" style={terminalInput} />
              <input type="text" placeholder="カテゴリ (例: 食費)" style={terminalInput} />
              <input type="text" placeholder="決済元 (例: PayPay)" style={terminalInput} />
              <button style={{ background: '#00ff66', color: '#000', border: 'none', padding: '10px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer', marginTop: 'auto', boxShadow: '0 0 10px rgba(0,255,102,0.3)' }}>
                ⚡ COMMAND EXECUTE (即時記録)
              </button>
            </div>
          </WindowPanel>
        )}

        {/* === 左列2: リアルタイムログウィンドウ === */}
        {panels.log && (!maximizedPanel || maximizedPanel === 'log') && (
          <WindowPanel title="📜 INTERCEPT LOG // リアルタイム通信" onMaximize={() => setMaximizedPanel(maximizedPanel ? null : 'log')} isMax={maximizedPanel === 'log'} onClose={() => togglePanel('log')}>
            <div style={{ overflowY: 'auto', height: '100%', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'monospace' }}>
              {transactions.slice(0, 15).map(tx => {
                const isEx = tx.type === 'expense';
                return (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '6px', background: '#050608', borderLeft: `2px solid ${isEx ? '#ff3366' : '#00bfff'}`, borderRadius: '2px' }}>
                    <span style={{ color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{tx.category} ({tx.paymentMethod})</span>
                    <span style={{ color: isEx ? '#ff3366' : '#00bfff', fontWeight: 'bold' }}>{isEx ? '-' : '+'}¥{Number(tx.amount).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </WindowPanel>
        )}

        {/* === 中央列: 総合残高推移メインチャート（縦2枠分を使う） === */}
        {panels.chart && (!maximizedPanel || maximizedPanel === 'chart') && (
          <WindowPanel title="📈 ASSET TRAJECTORY // 総合残高推移トレンド" onMaximize={() => setMaximizedPanel(maximizedPanel ? null : 'chart')} isMax={maximizedPanel === 'chart'} onClose={() => togglePanel('chart')} style={{ gridRow: 'span 2' }}>
            <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '300px' }} />
          </WindowPanel>
        )}

        {/* === 右列1: カートリッジ現在高 === */}
        {panels.cartridges && (!maximizedPanel || maximizedPanel === 'cartridges') && (
          <WindowPanel title="💳 DATA CARTRIDGES // 接続済み現在高" onMaximize={() => setMaximizedPanel(maximizedPanel ? null : 'cartridges')} isMax={maximizedPanel === 'cartridges'} onClose={() => togglePanel('cartridges')}>
            <div style={{ overflowY: 'auto', height: '100%', padding: '10px', display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {Object.entries(systemData.methodBal).map(([name, bal]) => (
                <div key={name} style={{ background: '#050608', border: '1px solid #252838', padding: '10px 12px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#ccc', fontWeight: 'bold' }}>{name}</span>
                  <span style={{ fontSize: '16px', fontFamily: 'monospace', color: bal < 0 ? '#ff3366' : '#fff', fontWeight: 'bold' }}>¥{bal.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </WindowPanel>
        )}

        {/* === 右列2: カテゴリ別支出比率レーダー === */}
        {panels.radar && (!maximizedPanel || maximizedPanel === 'radar') && (
          <WindowPanel title="🕸️ EXPENDITURE RADAR // カテゴリ別支出比率" onMaximize={() => setMaximizedPanel(maximizedPanel ? null : 'radar')} isMax={maximizedPanel === 'radar'} onClose={() => togglePanel('radar')}>
            <div ref={radarRef} style={{ width: '100%', height: '100%', minHeight: '180px' }} />
          </WindowPanel>
        )}

      </div>
    </div>
  );
}

// --- ウィンドウ・パネルのコンポーネント ---
function WindowPanel({ title, children, onMaximize, isMax, onClose, style = {} }) {
  return (
    <div style={{ background: '#0a0c10', border: '1px solid #252838', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all 0.2s', boxShadow: isMax ? '0 0 50px rgba(0,255,102,0.2)' : 'none', height: isMax ? 'calc(100vh - 80px)' : '100%', ...style }}>
      {/* ウィンドウ・タイトルバー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#11141a', borderBottom: '1px solid #252838', userSelect: 'none' }}>
        <span style={{ fontSize: '12px', color: '#00ff66', fontFamily: 'monospace', fontWeight: 'bold' }}>{title}</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onMaximize} style={winBtn}>{isMax ? '❐' : '□'}</button>
          <button onClick={onClose} style={{ ...winBtn, color: '#ff3366' }}>×</button>
        </div>
      </div>
      {/* ウィンドウ中身 */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

const menuBtn = (active) => ({ background: active ? 'rgba(0, 255, 102, 0.2)' : 'transparent', color: active ? '#00ff66' : '#666', border: `1px solid ${active ? '#00ff66' : 'transparent'}`, padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' });
const winBtn = { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '12px', padding: '0 4px' };
const terminalInput = { width: '100%', background: '#050608', border: '1px solid #252838', color: '#00ff66', padding: '10px', borderRadius: '4px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' };