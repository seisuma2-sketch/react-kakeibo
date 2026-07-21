import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as echarts from 'echarts';

const getCycleBounds = (resetDay, currentDate = new Date()) => {
  const rd = parseInt(resetDay, 10);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  let startDate, endDate;
  if (day > rd) {
    startDate = new Date(year, month, rd + 1, 0, 0, 0);
    endDate = new Date(year, month + 1, rd, 23, 59, 59);
  } else {
    startDate = new Date(year, month - 1, rd + 1, 0, 0, 0);
    endDate = new Date(year, month, rd, 23, 59, 59);
  }
  return { startDate, endDate };
};

export default function BalanceChart({ transactions = [], ghostAccounts = [], sortKey = 'amount', sortOrder = 'desc', setSortKey }) {
  const chartRef = useRef(null);
  const [now, setNow] = useState(new Date());

  // 🌟 ドラッグ＆ドロップ編集用のState
  const [reorderMode, setReorderMode] = useState(false);
  const [customOrder, setCustomOrder] = useState(() => JSON.parse(localStorage.getItem('customOrderConfig') || '[]'));
  const pressTimer = useRef(null);
  
  // 🌟 スワイプ移動用トラッカー（指に吸い付かせるためのOffset追加）
  const dragData = useRef({ active: false, startY: 0, currentIndex: -1, type: null });
  const [dragOffset, setDragOffset] = useState(0); 

  const [selectedAccHistory, setSelectedAccHistory] = useState(null); 

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const iconMap = {
    '現金': '/icon-cash.png', '三井住友銀行': '/icon-smbc.png', '三菱UFJ銀行': '/icon-mufg.png',
    'ゆうちょ銀行': '/icon-yucho.png', 'PayPay': '/icon-paypay.png', 'EVERING': '/icon-evering.png',
    '食費': '/icon-food.png', 'リクルートカード': '/icon-other.png'
  };

  const systemData = useMemo(() => {
    const creditSettings = JSON.parse(localStorage.getItem('creditCardSettings') || '{}');
    const cardData = {};
    Object.keys(creditSettings).forEach(name => {
      if (ghostAccounts.includes(name)) return;
      cardData[name] = { ...creditSettings[name], used: 0, usageCount: 0 };
    });

    const chronologicalTx = [...transactions].reverse();
    const runningBalances = {};
    const usageCounts = {}; 
    const dLabels = [];
    const bData = [];

    chronologicalTx.forEach(tx => {
      if (!tx.date) return;
      const txDate = tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
      const dateStr = txDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
      const amount = Number(tx.amount) || 0;
      const method = tx.paymentMethod || '不明';
      const category = tx.category || '不明';

      if (!runningBalances[method]) runningBalances[method] = 0;
      usageCounts[method] = (usageCounts[method] || 0) + 1;

      if (tx.type === 'income') {
        runningBalances[method] += amount;
      } else if (tx.type === 'expense') {
        runningBalances[method] -= amount;
      } else if (tx.type === 'transfer') {
        if (!runningBalances[category]) runningBalances[category] = 0;
        usageCounts[category] = (usageCounts[category] || 0) + 1;
        runningBalances[method] -= amount;
        runningBalances[category] += amount;
      }

      let currentVisibleTotal = 0;
      for (const [accName, accBalance] of Object.entries(runningBalances)) {
        if (!ghostAccounts.includes(accName)) currentVisibleTotal += accBalance;
      }
      dLabels.push(dateStr);
      bData.push(currentVisibleTotal);
    });

    transactions.forEach(tx => {
      if (!tx.date || tx.type !== 'expense') return;
      const txDate = tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
      const method = tx.paymentMethod || '不明';

      if (cardData[method]) {
        cardData[method].usageCount = usageCounts[method] || 0;
        const bounds = getCycleBounds(cardData[method].resetDay, now);
        if (txDate >= bounds.startDate && txDate <= bounds.endDate) {
          cardData[method].used += Number(tx.amount) || 0;
        }
      }
    });

    const bankData = {};
    let totalBank = 0;
    Object.entries(runningBalances).forEach(([name, bal]) => {
      if (ghostAccounts.includes(name)) return;
      if (cardData[name]) return; 
      bankData[name] = { balance: bal, usageCount: usageCounts[name] || 0 };
      totalBank += bal;
    });

    const applySort = (entriesArray) => {
      if (sortKey === 'custom') {
        return entriesArray.sort((a, b) => {
          let ia = customOrder.indexOf(a[0]); let ib = customOrder.indexOf(b[0]);
          if (ia === -1) ia = 999; if (ib === -1) ib = 999;
          return ia - ib;
        });
      }
      return entriesArray.sort((a, b) => {
        let valA, valB;
        if (sortKey === 'amount') {
          valA = a[1].budget !== undefined ? a[1].budget - a[1].used : a[1].balance;
          valB = b[1].budget !== undefined ? b[1].budget - b[1].used : b[1].balance;
        } else if (sortKey === 'name') {
          valA = a[0]; valB = b[0];
        } else if (sortKey === 'usage') {
          valA = a[1].usageCount; valB = b[1].usageCount;
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    };

    return {
      cards: applySort(Object.entries(cardData)),
      banks: applySort(Object.entries(bankData)),
      totalBankBalance: totalBank,
      dateLabels: dLabels,
      balanceData: bData
    };
  }, [transactions, ghostAccounts, now, sortKey, sortOrder, customOrder]);

  useEffect(() => {
    if (!chartRef.current) return;
    const chartInstance = echarts.init(chartRef.current);
    const option = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,0,0,0.8)', borderColor: '#00ff66', textStyle: { color: '#fff' }, formatter: function (params) { return `${params[0].name}<br/>表示総資産: <span style="color:#00ff66;font-weight:bold;">¥${params[0].value.toLocaleString()}</span>`; } },
      grid: { left: '2%', right: '4%', bottom: '5%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: systemData.dateLabels, axisLine: { lineStyle: { color: 'rgba(0, 255, 102, 0.5)' } }, axisLabel: { color: '#aaa' } },
      yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }, axisLabel: { color: '#aaa' } },
      series: [{ name: '総資産残高', type: 'line', smooth: true, data: systemData.balanceData, itemStyle: { color: '#00ff66' }, lineStyle: { width: 3, shadowColor: '#00ff66', shadowBlur: 10 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0, 255, 102, 0.4)' }, { offset: 1, color: 'rgba(0, 255, 102, 0.0)' }]) } }]
    };
    chartInstance.setOption(option);
    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chartInstance.dispose(); };
  }, [systemData]);

  // 🌟 長押し検知（編集モードへ切り替え）
  const handlePointerDown = () => {
    pressTimer.current = setTimeout(() => {
      setReorderMode(prev => !prev);
      setSortKey('custom'); 
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }, 600); // 800msから600msに短縮し、よりサクサク発動
  };
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  // 🌟 スライド移動処理のコアロジック（指に吸い付くように改良）
  const handleDragStart = (e, index, type) => {
    dragData.current = {
      active: true,
      startY: e.touches ? e.touches[0].clientY : e.clientY,
      currentIndex: index,
      type: type
    };
    setDragOffset(0);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const moveItem = (index, array, direction) => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= array.length) return;

    const itemA = array[index][0];
    const itemB = array[swapIndex][0];

    let newCustomOrder = [...customOrder];
    if (!newCustomOrder.includes(itemA)) newCustomOrder.push(itemA);
    if (!newCustomOrder.includes(itemB)) newCustomOrder.push(itemB);

    const idxA = newCustomOrder.indexOf(itemA);
    const idxB = newCustomOrder.indexOf(itemB);

    newCustomOrder[idxA] = itemB;
    newCustomOrder[idxB] = itemA;

    setCustomOrder(newCustomOrder);
    localStorage.setItem('customOrderConfig', JSON.stringify(newCustomOrder));
  };

  const handleDragMove = (e, array, type) => {
    if (!dragData.current.active || dragData.current.type !== type) return;
    
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const diff = currentY - dragData.current.startY;
    
    // 指の動きに合わせてオフセットを更新（吸い付き効果）
    setDragOffset(diff);

    const threshold = 70; // アイテムの高さに合わせて入れ替え判定を調整

    if (diff > threshold) {
      moveItem(dragData.current.currentIndex, array, 'down');
      dragData.current.startY += threshold;
      dragData.current.currentIndex += 1;
      setDragOffset(diff - threshold);
      if (navigator.vibrate) navigator.vibrate(20);
    } else if (diff < -threshold) {
      moveItem(dragData.current.currentIndex, array, 'up');
      dragData.current.startY -= threshold;
      dragData.current.currentIndex -= 1;
      setDragOffset(diff + threshold);
      if (navigator.vibrate) navigator.vibrate(20);
    }
  };

  const handleDragEnd = () => {
    dragData.current.active = false;
    dragData.current.currentIndex = -1;
    dragData.current.type = null;
    setDragOffset(0); // 指を離したら元の位置にスナップ
  };

  const getOneMonthHistory = (accName) => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    return transactions.filter(tx => {
      const isMatch = tx.paymentMethod === accName || tx.category === accName;
      const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
      return isMatch && txDate >= oneMonthAgo;
    }).sort((a, b) => b.date - a.date);
  };

  const formatDate = (date) => `${date.getMonth() + 1}/${date.getDate()}`;

  // 🌟 全体のスタイル：テキスト選択やコンテキストメニューの完全ブロック
  const containerStyle = {
    display: 'flex', flexDirection: 'column', gap: '25px', height: '100%', position: 'relative',
    WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' // 青い選択と長押しメニューを禁止
  };

  return (
    <div style={containerStyle} onContextMenu={(e) => e.preventDefault()}>
      
      {selectedAccHistory && (
        <div onClick={() => setSelectedAccHistory(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#0a0c10', border: '1px solid #00ff66', borderRadius: '12px', width: '90%', maxWidth: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 30px rgba(0,255,102,0.2)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #00ff6644', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#00ff66', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📡</span> [{selectedAccHistory}] 過去1ヶ月の通信ログ
              </h3>
              <button onClick={() => setSelectedAccHistory(null)} style={{ background: 'transparent', border: 'none', color: '#ff3366', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {getOneMonthHistory(selectedAccHistory).length === 0 ? (
                <div style={{ color: '#666', textAlign: 'center', fontFamily: 'monospace' }}>NO DATA FOUND IN RECENT 30 DAYS</div>
              ) : (
                getOneMonthHistory(selectedAccHistory).map(tx => {
                  const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
                  const isExpense = tx.type === 'expense' || (tx.type === 'transfer' && tx.paymentMethod === selectedAccHistory);
                  return (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#11141a', padding: '12px', borderRadius: '6px', borderLeft: `3px solid ${isExpense ? '#ff3366' : '#00bfff'}` }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#888', fontFamily: 'monospace' }}>{txDate.toLocaleDateString()}</div>
                        <div style={{ fontSize: '14px', color: '#ccc' }}>{tx.type === 'transfer' ? (isExpense ? `▶ ${tx.category}へ` : `◀ ${tx.paymentMethod}から`) : tx.category}</div>
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', color: isExpense ? '#ff3366' : '#00bfff' }}>
                        {isExpense ? '-' : '+'}¥{Number(tx.amount).toLocaleString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {reorderMode && (
        <div onClick={() => setReorderMode(false)} style={{ background: '#ff990022', border: '1px dashed #ff9900', color: '#ff9900', padding: '12px', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', animation: 'pulse 2s infinite', cursor: 'pointer' }}>
          ⚠️ CONFIG OVERRIDE MODE (指でスライドして配置変更) <br/><span style={{fontSize: '10px', color: '#fff'}}>※タップで終了</span>
        </div>
      )}

      <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838' }}>
        <h2 style={{ fontSize: '18px', borderBottom: '1px solid #252838', paddingBottom: '10px', marginTop: 0, color: '#fff', fontFamily: 'monospace', letterSpacing: '1px' }}>
          📈 📊 総合残高推移トレンド
        </h2>
        <div ref={chartRef} style={{ width: '100%', height: '240px', marginTop: '10px' }}></div>
      </div>

      {systemData.cards.length > 0 && (
        <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838' }}>
          <h2 style={{ fontSize: '16px', borderBottom: '1px solid #252838', paddingBottom: '10px', marginTop: 0, color: '#ff9900', marginBottom: '20px', fontFamily: 'monospace' }}>
            💳 CREDIT CARD HP // クレジット残枠
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {systemData.cards.map(([name, data], idx) => {
              const bounds = getCycleBounds(data.resetDay, now);
              const remain = Math.max(0, data.budget - data.used);
              const isOver = data.used > data.budget;
              const percent = data.budget > 0 ? Math.max(0, Math.min(100, (remain / data.budget) * 100)) : 0;
              let barColor = '#00ff66';
              if (percent <= 20 || isOver) barColor = '#ff3366';
              else if (percent <= 50) barColor = '#ff9900';

              const isDragging = reorderMode && dragData.current.currentIndex === idx && dragData.current.type === 'card';

              return (
                <div key={name} className={reorderMode && !isDragging ? 'shake' : 'account-cartridge'} 
                     onPointerDown={(e) => { if (!reorderMode) handlePointerDown(); }} 
                     onPointerUp={(e) => { if (!reorderMode) cancelPress(); else handleDragEnd(); }} 
                     onPointerLeave={(e) => { if (!reorderMode) cancelPress(); else handleDragEnd(); }}
                     
                     // 🌟 スライド検知用のタッチイベント
                     onTouchStart={(e) => { if (reorderMode) handleDragStart(e, idx, 'card'); }}
                     onTouchMove={(e) => { if (reorderMode) handleDragMove(e, systemData.cards, 'card'); }}
                     onTouchEnd={handleDragEnd}

                     onClick={() => !reorderMode && setSelectedAccHistory(name)}
                     style={{ 
                       background: '#0a0c10', border: '1px solid #252838', borderRadius: '6px', padding: '15px 20px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer',
                       touchAction: reorderMode ? 'none' : 'auto', // ドラッグ中はスクロール無効
                       // 🌟 指に追従させるトランスフォーム
                       transform: isDragging ? `translateY(${dragOffset}px) scale(1.05)` : 'none',
                       zIndex: isDragging ? 100 : 1,
                       boxShadow: isDragging ? '0 10px 30px rgba(255, 153, 0, 0.4)' : 'none',
                       transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' // 離した時にスムーズに戻る
                     }}>
                  
                  <div style={{ color: '#ff9900', fontSize: '14px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {iconMap[name] ? <img src={iconMap[name]} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain', pointerEvents: 'none' }} /> : <span>💳</span>}
                      <span>{name}</span>
                    </span>
                    <span style={{ color: '#666', fontSize: '10px', fontFamily: 'monospace' }}>{formatDate(bounds.startDate)}-{formatDate(bounds.endDate)}</span>
                  </div>

                  <div style={{ color: barColor, fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right', textShadow: `0 0 10px ${barColor}44` }}>
                    {isOver ? 'OVER!' : `¥${remain.toLocaleString()}`}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>
                    <span>LIMIT: ¥{data.budget.toLocaleString()}</span>
                    <span>{percent.toFixed(0)}% HP</span>
                  </div>

                  <div style={{ position: 'absolute', bottom: 0, left: 0, height: '5px', width: '100%', background: '#1a1d24' }}>
                    <div className="energy-bar" style={{ height: '100%', width: `${percent}%`, background: barColor, boxShadow: `0 0 10px ${barColor}` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #252838', paddingBottom: '10px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', marginTop: 0, color: '#00bfff', fontFamily: 'monospace' }}>🏦 BANK ACCOUNTS // 資金残高</h2>
          <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>TOTAL: ¥{systemData.totalBankBalance.toLocaleString()}</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {systemData.banks.map(([name, data], idx) => {
            const amount = data.balance;
            const percent = systemData.totalBankBalance > 0 ? Math.min(100, Math.max(0, (amount / systemData.totalBankBalance) * 100)) : 0;
            const isNegative = amount < 0;

            const isDragging = reorderMode && dragData.current.currentIndex === idx && dragData.current.type === 'bank';

            return (
              <div key={name} className={reorderMode && !isDragging ? 'shake' : 'account-cartridge'}
                   onPointerDown={(e) => { if (!reorderMode) handlePointerDown(); }} 
                   onPointerUp={(e) => { if (!reorderMode) cancelPress(); else handleDragEnd(); }} 
                   onPointerLeave={(e) => { if (!reorderMode) cancelPress(); else handleDragEnd(); }}
                   
                   onTouchStart={(e) => { if (reorderMode) handleDragStart(e, idx, 'bank'); }}
                   onTouchMove={(e) => { if (reorderMode) handleDragMove(e, systemData.banks, 'bank'); }}
                   onTouchEnd={handleDragEnd}

                   onClick={() => !reorderMode && setSelectedAccHistory(name)}
                   style={{ 
                     background: '#0a0c10', border: '1px solid #252838', borderRadius: '6px', padding: '20px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer',
                     touchAction: reorderMode ? 'none' : 'auto',
                     // 🌟 指に追従させるトランスフォーム
                     transform: isDragging ? `translateY(${dragOffset}px) scale(1.05)` : 'none',
                     zIndex: isDragging ? 100 : 1,
                     boxShadow: isDragging ? '0 10px 30px rgba(0, 191, 255, 0.4)' : 'none',
                     transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                   }}>
                
                <div style={{ color: '#00bfff', fontSize: '14px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {iconMap[name] ? <img src={iconMap[name]} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain', pointerEvents: 'none' }} /> : <span>💽</span>}
                    <span>{name}</span>
                  </span>    
                  <span style={{ color: '#555', fontSize: '12px' }}>{percent.toFixed(1)}%</span>
                </div>
                
                <div style={{ color: isNegative ? '#ff3366' : '#fff', fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right' }}>
                  ¥{amount.toLocaleString()}
                </div>

                <div style={{ position: 'absolute', bottom: 0, left: 0, height: '4px', width: '100%', background: '#1a1d24' }}>
                  <div className="energy-bar" style={{ height: '100%', width: `${percent}%`, background: isNegative ? '#ff3366' : '#00bfff', boxShadow: isNegative ? '0 0 10px #ff3366' : '0 0 10px #00bfff' }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .account-cartridge { transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s; }
        .account-cartridge:hover { transform: translateY(-4px); border-color: #00bfff !important; box-shadow: 0 4px 20px rgba(0, 191, 255, 0.15); }
        .energy-bar { animation: pulse 2.5s infinite ease-in-out; transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
        .shake { animation: tilt-shaking 0.5s infinite; border-color: #ff9900 !important; }
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
        @keyframes tilt-shaking {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(0.5deg); }
          50% { transform: rotate(0deg); }
          75% { transform: rotate(-0.5deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}