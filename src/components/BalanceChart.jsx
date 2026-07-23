import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as echarts from 'echarts';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

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

  const [isAIPredictionActive, setIsAIPredictionActive] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [customOrder, setCustomOrder] = useState(() => JSON.parse(localStorage.getItem('customOrderConfig') || '[]'));
  
  const [localUpdate, setLocalUpdate] = useState(0);
  const [deletedAccounts, setDeletedAccounts] = useState(() => JSON.parse(localStorage.getItem('deletedAccountsConfig') || '[]'));

  // 🌟 スワイプ管理用のState
  const [swipedAcc, setSwipedAcc] = useState(null); 
  const touchStartRef = useRef({ x: 0, y: 0 });

  const pressTimer = useRef(null);
  const dragData = useRef({ active: false, startY: 0, currentIndex: -1 });
  const [dragOffset, setDragOffset] = useState(0); 
  const [selectedAccHistory, setSelectedAccHistory] = useState(null); 

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const [routingMode, setRoutingMode] = useState(false);
  const [routingSource, setRoutingSource] = useState(null);
  const [routingTarget, setRoutingTarget] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const [editingAcc, setEditingAcc] = useState(null);
  const [editType, setEditType] = useState('bank');
  const [editBudget, setEditBudget] = useState('');
  const [editResetDay, setEditResetDay] = useState('1');
  const [editPayDay, setEditPayDay] = useState('27');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleGlobalClick = () => setSwipedAcc(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const iconMap = {
    '現金': '/icon-cash.png', '三井住友銀行': '/icon-smbc.png', '三菱UFJ銀行': '/icon-mufg.png',
    'ゆうちょ銀行': '/icon-yucho.png', 'PayPay': '/icon-paypay.png', 'EVERING': '/icon-evering.png',
    '食費': '/icon-food.png', 'リクルートカード': '/S__32391170.jpg'
  };

  const systemData = useMemo(() => {
    const creditSettings = JSON.parse(localStorage.getItem('creditCardSettings') || '{}');
    const cardData = {};
    Object.keys(creditSettings).forEach(name => {
      if (ghostAccounts.includes(name) || deletedAccounts.includes(name)) return;
      cardData[name] = { 
        budget: Number(creditSettings[name].budget) || 0,
        resetDay: Number(creditSettings[name].resetDay) || 1,
        paymentDay: Number(creditSettings[name].paymentDay) || 27,
        used: 0, usageCount: 0 
      };
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
        if (!ghostAccounts.includes(accName) && !deletedAccounts.includes(accName)) currentVisibleTotal += accBalance;
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
      if (ghostAccounts.includes(name) || deletedAccounts.includes(name)) return;
      if (cardData[name]) return; 
      bankData[name] = { balance: bal, usageCount: usageCounts[name] || 0 };
      totalBank += bal;
    });

    const combined = [];
    Object.entries(cardData).forEach(([name, data]) => {
      combined.push({ id: name, name, type: 'card', ...data });
    });
    Object.entries(bankData).forEach(([name, data]) => {
      combined.push({ id: name, name, type: 'bank', ...data });
    });

    const lastBalance = bData.length > 0 ? bData[bData.length - 1] : 0;
    const today = now;
    const past14Days = new Date(today);
    past14Days.setDate(past14Days.getDate() - 14);

    let oldBalance = lastBalance;
    let oldDate = today;

    for (let i = chronologicalTx.length - 1; i >= 0; i--) {
      const txDate = chronologicalTx[i].date?.toDate ? chronologicalTx[i].date.toDate() : new Date(chronologicalTx[i].date);
      if (txDate < past14Days) { oldBalance = bData[i]; oldDate = txDate; break; }
      if (i === 0) { oldBalance = bData[0]; oldDate = txDate; }
    }

    const diffDays = Math.max(1, (today.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyPace = (lastBalance - oldBalance) / diffDays;
    const predictionDays = 14;
    const pLabels = [];
    const pValues = [];
    let currentSimulatedDate = new Date(today);
    let currentSimulatedBalance = lastBalance;

    for (let i = 1; i <= predictionDays; i++) {
      currentSimulatedDate.setDate(currentSimulatedDate.getDate() + 1);
      currentSimulatedBalance += dailyPace;
      pLabels.push(currentSimulatedDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }));
      pValues.push(Math.round(currentSimulatedBalance));
    }

    if (sortKey === 'custom') {
      combined.sort((a, b) => {
        let ia = customOrder.indexOf(a.name); let ib = customOrder.indexOf(b.name);
        if (ia === -1) ia = 999; if (ib === -1) ib = 999;
        return ia - ib;
      });
    } else {
      combined.sort((a, b) => {
        let valA, valB;
        if (sortKey === 'amount') {
          valA = a.type === 'card' ? a.budget - a.used : a.balance;
          valB = b.type === 'card' ? b.budget - b.used : b.balance;
        } else if (sortKey === 'name') {
          valA = a.name; valB = b.name;
        } else if (sortKey === 'usage') {
          valA = a.usageCount; valB = b.usageCount;
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return {
      combined, totalBankBalance: totalBank, dateLabels: dLabels, balanceData: bData, pLabels, pValues
    };
  }, [transactions, ghostAccounts, deletedAccounts, now, sortKey, sortOrder, customOrder, localUpdate]);

  useEffect(() => {
    if (!chartRef.current) return;
    const chartInstance = echarts.init(chartRef.current);
    const xAxisData = isAIPredictionActive ? [...systemData.dateLabels, ...systemData.pLabels] : systemData.dateLabels;

    const series = [{
      name: '総資産残高', type: 'line', smooth: true, data: systemData.balanceData,
      itemStyle: { color: '#00ff66' }, lineStyle: { width: 3, shadowColor: '#00ff66', shadowBlur: 10 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0, 255, 102, 0.4)' }, { offset: 1, color: 'rgba(0, 255, 102, 0.0)' }]) }
    }];

    if (isAIPredictionActive && systemData.balanceData.length > 0) {
      const pad = Array(systemData.balanceData.length - 1).fill(null);
      const predictionStart = systemData.balanceData[systemData.balanceData.length - 1];
      const predictedData = [...pad, predictionStart, ...systemData.pValues];
      series.push({
        name: 'AI予測軌道', type: 'line', smooth: true, data: predictedData,
        itemStyle: { color: '#ffeb3b' }, lineStyle: { width: 2, type: 'dashed', shadowColor: '#ffeb3b', shadowBlur: 10 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(255, 235, 59, 0.2)' }, { offset: 1, color: 'rgba(255, 235, 59, 0.0)' }]) }
      });
    }

    const option = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,0,0,0.8)', borderColor: isAIPredictionActive ? '#ffeb3b' : '#00ff66', textStyle: { color: '#fff' }, formatter: function (params) { 
          let res = `${params[0].name}<br/>`;
          params.forEach(p => { const color = p.seriesName === 'AI予測軌道' ? '#ffeb3b' : '#00ff66'; res += `${p.seriesName}: <span style="color:${color};font-weight:bold;">¥${p.value?.toLocaleString()}</span><br/>`; });
          return res;
      }},
      grid: { left: '2%', right: '4%', bottom: '5%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: xAxisData, axisLine: { lineStyle: { color: 'rgba(0, 255, 102, 0.5)' } }, axisLabel: { color: '#aaa' } },
      yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }, axisLabel: { color: '#aaa', formatter: (val) => val >= 10000 ? `${val/10000}万` : val } },
      series: series
    };
    chartInstance.setOption(option);
    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chartInstance.dispose(); };
  }, [systemData, isAIPredictionActive]);

  const handlePointerDown = () => {
    pressTimer.current = setTimeout(() => {
      setReorderMode(prev => !prev); setSortKey('custom'); if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }, 600);
  };
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  // 🌟 タッチ開始：スワイプとドラッグを両立判定
  const handleTouchStart = (e, index) => {
    const touch = e.touches ? e.touches[0] : e;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    if (reorderMode) {
      dragData.current = { active: true, startY: touch.clientY, currentIndex: index };
      setDragOffset(0); if (navigator.vibrate) navigator.vibrate(20);
    }
  };

  const moveItem = (index, array, direction) => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= array.length) return;
    const itemA = array[index].name; const itemB = array[swapIndex].name;
    let newCustomOrder = [...customOrder];
    if (!newCustomOrder.includes(itemA)) newCustomOrder.push(itemA);
    if (!newCustomOrder.includes(itemB)) newCustomOrder.push(itemB);
    const idxA = newCustomOrder.indexOf(itemA); const idxB = newCustomOrder.indexOf(itemB);
    newCustomOrder[idxA] = itemB; newCustomOrder[idxB] = itemA;
    setCustomOrder(newCustomOrder); localStorage.setItem('customOrderConfig', JSON.stringify(newCustomOrder));
  };

  // 🌟 タッチ移動：横移動ならスワイプ判定、縦移動なら並び替え
  const handleTouchMove = (e, array, itemName) => {
    const touch = e.touches ? e.touches[0] : e;
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;

    // 通常時のスワイプ検知
    if (!reorderMode && !routingMode) {
      if (diffX < -40 && Math.abs(diffY) < 30) {
        setSwipedAcc(itemName);
        if (navigator.vibrate) navigator.vibrate(15);
      } else if (diffX > 30) {
        setSwipedAcc(null);
      }
      return;
    }

    // 並び替えモード時のドラッグ検知
    if (reorderMode && dragData.current.active) {
      const diff = diffY;
      setDragOffset(diff);
      const threshold = 70;
      if (diff > threshold) {
        moveItem(dragData.current.currentIndex, array, 'down');
        dragData.current.startY += threshold; dragData.current.currentIndex += 1;
        setDragOffset(diff - threshold); if (navigator.vibrate) navigator.vibrate(20);
      } else if (diff < -threshold) {
        moveItem(dragData.current.currentIndex, array, 'up');
        dragData.current.startY -= threshold; dragData.current.currentIndex -= 1;
        setDragOffset(diff + threshold); if (navigator.vibrate) navigator.vibrate(20);
      }
    }
  };

  const handleDragEnd = () => { dragData.current.active = false; dragData.current.currentIndex = -1; setDragOffset(0); };

  const getOneMonthHistory = (accName) => {
    const oneMonthAgo = new Date(); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return transactions.filter(tx => {
      const isMatch = tx.paymentMethod === accName || tx.category === accName;
      const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
      return isMatch && txDate >= oneMonthAgo;
    }).sort((a, b) => b.date - a.date);
  };

  useEffect(() => {
    if (selectedAccHistory) {
      setIsAnalyzing(true);
      const history = getOneMonthHistory(selectedAccHistory);
      let totalOutflow = 0; let totalInflow = 0; let maxHit = { amount: 0, category: 'N/A' }; const catCount = {};
      history.forEach(tx => {
        const amt = Number(tx.amount) || 0;
        const isExpense = tx.type === 'expense' || (tx.type === 'transfer' && tx.paymentMethod === selectedAccHistory);
        if (isExpense) {
          totalOutflow += amt;
          const catName = tx.type === 'transfer' ? `振替: ${tx.category}` : tx.category;
          catCount[catName] = (catCount[catName] || 0) + 1;
          if (amt > maxHit.amount) { maxHit = { amount: amt, category: catName }; }
        } else { totalInflow += amt; }
      });
      let freqTarget = 'N/A'; let maxCount = 0;
      for (const [c, count] of Object.entries(catCount)) { if (count > maxCount) { freqTarget = c; maxCount = count; } }
      setAnalysisResult({ totalOutflow, totalInflow, freqTarget, maxCount, maxHit });
      const timer = setTimeout(() => { setIsAnalyzing(false); if (navigator.vibrate) navigator.vibrate([20, 50, 20]); }, 800);
      return () => clearTimeout(timer);
    } else { setAnalysisResult(null); }
  }, [selectedAccHistory, transactions]);

  const handleCartridgeClick = (name) => {
    if (reorderMode || swipedAcc === name) return;
    if (routingMode) {
      if (!routingSource) { setRoutingSource(name); if (navigator.vibrate) navigator.vibrate([30]); } 
      else if (routingSource === name) { setRoutingSource(null); } 
      else { setRoutingTarget(name); if (navigator.vibrate) navigator.vibrate([30, 50, 30]); }
    } else {
      setSelectedAccHistory(name);
      if (navigator.vibrate) navigator.vibrate([15]);
    }
  };

  // 🌟 スワイプからの設定編集オープン
  const openEditFromSwipe = (e, item) => {
    e.stopPropagation(); 
    setSwipedAcc(null);
    setEditingAcc(item.name);
    setEditType(item.type);
    if (item.type === 'card') {
      setEditBudget(item.budget.toString());
      setEditResetDay(item.resetDay.toString());
      setEditPayDay(item.paymentDay.toString());
    } else {
      setEditBudget(''); setEditResetDay('1'); setEditPayDay('27');
    }
  };

  // 🌟 スワイプからの削除（非表示化）ダイレクト実行
  const deleteFromSwipe = (e, itemName) => {
    e.stopPropagation();
    if (window.confirm(`⚠️ [${itemName}] をシステムから削除(非表示)にしますか？\n※取引履歴は保持されます`)) {
      setSwipedAcc(null);
      const newDeleted = [...deletedAccounts, itemName];
      setDeletedAccounts(newDeleted);
      localStorage.setItem('deletedAccountsConfig', JSON.stringify(newDeleted));
      
      const currentSettings = JSON.parse(localStorage.getItem('creditCardSettings') || '{}');
      delete currentSettings[itemName];
      localStorage.setItem('creditCardSettings', JSON.stringify(currentSettings));
      
      setLocalUpdate(prev => prev + 1);
      if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
    }
  };

  const saveEdit = () => {
    const currentSettings = JSON.parse(localStorage.getItem('creditCardSettings') || '{}');
    if (editType === 'card') {
      currentSettings[editingAcc] = {
        budget: Number(editBudget) || 0,
        resetDay: Number(editResetDay) || 1,
        paymentDay: Number(editPayDay) || 27
      };
    } else {
      delete currentSettings[editingAcc];
    }
    localStorage.setItem('creditCardSettings', JSON.stringify(currentSettings));
    setEditingAcc(null);
    setLocalUpdate(prev => prev + 1); 
  };

  const executeTransfer = async () => {
    const numAmount = Number(transferAmount);
    if (!transferAmount || isNaN(numAmount) || numAmount <= 0) { alert("⚠️ 正しい金額を入力してください"); return; }
    setIsTransferring(true);
    try {
      const txData = { userId: auth.currentUser.uid, type: 'transfer', amount: numAmount, paymentMethod: routingSource, category: routingTarget, memo: 'システム・ルーティング (UI)', date: Timestamp.now(), createdAt: Timestamp.now() };
      await addDoc(collection(db, "transactions"), txData);
      setRoutingSource(null); setRoutingTarget(null); setTransferAmount(''); setRoutingMode(false);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch (e) { alert("❌ 通信エラーが発生しました"); console.error(e); } 
    finally { setIsTransferring(false); }
  };

  const formatDate = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
  const containerStyle = { display: 'flex', flexDirection: 'column', gap: '25px', height: '100%', position: 'relative', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' };

  return (
    <div style={containerStyle} onContextMenu={(e) => e.preventDefault()}>
      
      {/* 🌟 編集モーダル */}
      {editingAcc && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#0a0c10', border: '1px solid #00bfff', borderRadius: '12px', width: '90%', maxWidth: '340px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 0 30px rgba(0, 191, 255, 0.3)' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              ⚙️ [{editingAcc}] 設定
            </h3>
            
            <div style={{ display: 'flex', background: '#11141a', borderRadius: '6px', padding: '4px', border: '1px solid #333' }}>
              <button onClick={() => setEditType('bank')} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '4px', fontWeight: 'bold', background: editType === 'bank' ? '#00bfff' : 'transparent', color: editType === 'bank' ? '#000' : '#888' }}>🏦 一般口座</button>
              <button onClick={() => setEditType('card')} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '4px', fontWeight: 'bold', background: editType === 'card' ? '#ff9900' : 'transparent', color: editType === 'card' ? '#000' : '#888' }}>💳 クレジット</button>
            </div>

            {editType === 'card' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px' }}>予算上限 (HP)</div>
                  <input type="number" value={editBudget} onChange={e => setEditBudget(e.target.value)} style={{ width: '100%', padding: '10px', background: '#1a1d24', color: '#ff9900', border: '1px solid #555', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px' }}>更新日</div>
                    <input type="number" value={editResetDay} onChange={e => setEditResetDay(e.target.value)} min="1" max="31" style={{ width: '100%', padding: '10px', background: '#1a1d24', color: '#00ff66', border: '1px solid #555', borderRadius: '6px', fontSize: '16px', textAlign: 'center', outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px' }}>支払日</div>
                    <input type="number" value={editPayDay} onChange={e => setEditPayDay(e.target.value)} min="1" max="31" style={{ width: '100%', padding: '10px', background: '#1a1d24', color: '#ff3366', border: '1px solid #555', borderRadius: '6px', fontSize: '16px', textAlign: 'center', outline: 'none' }} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <button onClick={saveEdit} style={{ width: '100%', padding: '12px', background: '#00bfff', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '16px' }}>保存する</button>
              <button onClick={() => setEditingAcc(null)} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '6px', fontWeight: 'bold' }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* ルーティング・履歴・アラート等 */}
      {routingSource && routingTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#0a0c10', border: '1px solid #00bfff', borderRadius: '12px', width: '90%', maxWidth: '350px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 0 40px rgba(0, 191, 255, 0.3)' }}>
            <h3 style={{ margin: 0, color: '#00bfff', fontFamily: 'monospace', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}><span style={{ fontSize: '20px' }}>🔁</span> ROUTING INITIATED</h3>
            <div style={{ background: '#11141a', padding: '15px', borderRadius: '8px', border: '1px dashed #555' }}>
              <div style={{ color: '#ff3366', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>📤 出金元 (SOURCE)</div><div style={{ fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>{routingSource}</div>
              <div style={{ textAlign: 'center', color: '#666', fontSize: '20px', margin: '10px 0' }}>⬇</div>
              <div style={{ color: '#00bfff', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>📥 入金先 (TARGET)</div><div style={{ fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>{routingTarget}</div>
            </div>
            <div>
              <div style={{ color: '#aaa', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>転送金額を入力</div>
              <div style={{ display: 'flex', alignItems: 'center', background: '#1a1d24', border: '1px solid #00bfff', borderRadius: '6px', padding: '0 15px' }}>
                <span style={{ color: '#00bfff', fontSize: '20px', fontWeight: 'bold' }}>¥</span>
                <input type="number" autoFocus value={transferAmount} onChange={e => setTransferAmount(e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', fontWeight: 'bold', padding: '15px 10px', outline: 'none', fontFamily: 'monospace' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => { setRoutingTarget(null); setTransferAmount(''); }} style={{ flex: 1, padding: '15px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>CANCEL</button>
              <button onClick={executeTransfer} disabled={isTransferring} style={{ flex: 1, padding: '15px', background: isTransferring ? '#555' : '#00bfff', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isTransferring ? 'not-allowed' : 'pointer', boxShadow: isTransferring ? 'none' : '0 0 15px rgba(0, 191, 255, 0.4)' }}>{isTransferring ? '転送中...' : 'EXECUTE'}</button>
            </div>
          </div>
        </div>
      )}

      {selectedAccHistory && (
        <div onClick={() => setSelectedAccHistory(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#0a0c10', border: '1px solid #00ff66', borderRadius: '12px', width: '90%', maxWidth: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 30px rgba(0,255,102,0.2)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #00ff6644', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#00ff66', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '20px' }}>📡</span> [{selectedAccHistory}] DATA LOG</h3>
              <button onClick={() => setSelectedAccHistory(null)} style={{ background: 'transparent', border: 'none', color: '#ff3366', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {isAnalyzing ? (
                <div style={{ textAlign: 'center', color: '#00ff66', fontFamily: 'monospace', padding: '30px 0' }}>
                  <div style={{ marginTop: '15px', fontWeight: 'bold' }}>詳細プロファイリングを実行中...</div>
                  <div style={{ fontSize: '10px', color: '#555', marginTop: '5px' }}>取引記録を解読中</div>
                </div>
              ) : (
                analysisResult && (
                  <div style={{ background: '#11141a', border: '1px dashed #00bfff', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#00bfff', fontWeight: 'bold', letterSpacing: '1px' }}>[ 分析結果 ]</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontFamily: 'monospace' }}>
                      <div style={{ background: '#0a0c10', padding: '10px', borderRadius: '6px', borderLeft: '2px solid #ff3366' }}><div style={{ fontSize: '10px', color: '#888' }}>支出合計</div><div style={{ color: '#ff3366', fontSize: '16px', fontWeight: 'bold' }}>-¥{analysisResult.totalOutflow.toLocaleString()}</div></div>
                      <div style={{ background: '#0a0c10', padding: '10px', borderRadius: '6px', borderLeft: '2px solid #00ff66' }}><div style={{ fontSize: '10px', color: '#888' }}>収入合計</div><div style={{ color: '#00ff66', fontSize: '16px', fontWeight: 'bold' }}>+¥{analysisResult.totalInflow.toLocaleString()}</div></div>
                    </div>
                    <div style={{ background: '#0a0c10', padding: '10px', borderRadius: '6px', borderLeft: '2px solid #ff9900', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ color: '#ff9900', fontSize: '10px', fontWeight: 'bold' }}> 頻出: {analysisResult.freqTarget} ({analysisResult.maxCount}回)</div>
                      <div style={{ color: '#ff9900', fontSize: '10px', fontWeight: 'bold' }}>最大出費: {analysisResult.maxHit.category} (¥{analysisResult.maxHit.amount.toLocaleString()})</div>
                    </div>
                  </div>
                )
              )}
              {!isAnalyzing && (
                <>
                  <div style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', letterSpacing: '1px', borderBottom: '1px solid #333', paddingBottom: '5px' }}>[ RAW TRANSACTION DATA ]</div>
                  {getOneMonthHistory(selectedAccHistory).length === 0 ? (
                    <div style={{ color: '#666', textAlign: 'center', fontFamily: 'monospace', padding: '20px 0' }}>NO DATA FOUND</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {getOneMonthHistory(selectedAccHistory).map(tx => {
                        const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
                        const isExpense = tx.type === 'expense' || (tx.type === 'transfer' && tx.paymentMethod === selectedAccHistory);
                        return (
                          <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#11141a', padding: '12px', borderRadius: '6px', borderLeft: `3px solid ${isExpense ? '#ff3366' : '#00bfff'}` }}>
                            <div><div style={{ fontSize: '10px', color: '#888', fontFamily: 'monospace' }}>{txDate.toLocaleDateString()}</div><div style={{ fontSize: '14px', color: '#ccc' }}>{tx.type === 'transfer' ? (isExpense ? `▶ ${tx.category}へ` : `◀ ${tx.paymentMethod}から`) : tx.category}</div></div>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', color: isExpense ? '#ff3366' : '#00bfff' }}>{isExpense ? '-' : '+'}¥{Number(tx.amount).toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {reorderMode && (
        <div onClick={() => setReorderMode(false)} style={{ background: '#ff990022', border: '1px dashed #ff9900', color: '#ff9900', padding: '12px', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', animation: 'pulse 2s infinite', cursor: 'pointer' }}>
          スライドで配置変更 <br/><span style={{fontSize: '10px', color: '#fff'}}>※タップで終了</span>
        </div>
      )}
      {routingMode && (
        <div onClick={() => { setRoutingMode(false); setRoutingSource(null); }} style={{ background: '#00bfff22', border: '1px dashed #00bfff', color: '#00bfff', padding: '12px', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', animation: 'pulse 2s infinite', cursor: 'pointer' }}>
          振替機能実行中 <br/>
          <span style={{fontSize: '10px', color: '#fff'}}>{!routingSource ? '1. 出金元ノードをタップしてください' : '2. 入金先ノードをタップしてください'} (タップで解除)</span>
        </div>
      )}

      <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #252838', paddingBottom: '10px', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '16px', margin: 0, color: '#fff', fontFamily: 'monospace', letterSpacing: '1px' }}>総合残高推移</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setRoutingMode(!routingMode); setRoutingSource(null); setReorderMode(false); }} style={{ background: routingMode ? '#00bfff22' : 'transparent', color: routingMode ? '#00bfff' : '#666', border: `1px solid ${routingMode ? '#00bfff' : '#333'}`, padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', cursor: 'pointer', transition: 'all 0.2s', boxShadow: routingMode ? '0 0 10px rgba(0,191,255,0.3)' : 'none' }}>振替</button>
            <button onClick={() => setIsAIPredictionActive(!isAIPredictionActive)} style={{ background: isAIPredictionActive ? '#ffeb3b22' : 'transparent', color: isAIPredictionActive ? '#ffeb3b' : '#666', border: `1px solid ${isAIPredictionActive ? '#ffeb3b' : '#333'}`, padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', cursor: 'pointer', transition: 'all 0.2s', boxShadow: isAIPredictionActive ? '0 0 10px rgba(255,235,59,0.3)' : 'none' }}>AI予測</button>
          </div>
        </div>
        <div ref={chartRef} style={{ width: '100%', height: '240px' }}></div>
      </div>

      {/* 🌟 スワイプ対応・統合リストエリア */}
      <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #252838', paddingBottom: '10px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', marginTop: 0, color: '#fff', fontFamily: 'monospace' }}>資金残高</h2>
          <span style={{ fontSize: '11px', color: '#00bfff', fontFamily: 'monospace' }}>TOTAL: ¥{systemData.totalBankBalance.toLocaleString()}</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {systemData.combined.map((item, idx) => {
            const isCard = item.type === 'card';
            const isDragging = reorderMode && dragData.current.currentIndex === idx;
            const isRoutingSource = routingMode && routingSource === item.name;
            const isRoutingTarget = routingMode && routingSource && routingSource !== item.name;
            const isSwiped = swipedAcc === item.name;
            
            let amountText, mainColor, percent, remain, isOver, bounds;
            if (isCard) {
              bounds = getCycleBounds(item.resetDay, now);
              remain = Math.max(0, item.budget - item.used);
              isOver = item.used > item.budget;
              percent = item.budget > 0 ? Math.max(0, Math.min(100, (remain / item.budget) * 100)) : 0;
              mainColor = '#00ff66';
              if (percent <= 20 || isOver) mainColor = '#ff3366'; else if (percent <= 50) mainColor = '#ff9900';
              amountText = isOver ? 'OVER!' : `¥${remain.toLocaleString()}`;
            } else {
              const bal = item.balance;
              percent = systemData.totalBankBalance > 0 ? Math.min(100, Math.max(0, (bal / systemData.totalBankBalance) * 100)) : 0;
              const isNegative = bal < 0;
              mainColor = isNegative ? '#ff3366' : '#00bfff';
              amountText = `¥${bal.toLocaleString()}`;
            }

            return (
              <div key={item.name} style={{ position: 'relative', overflow: 'hidden', borderRadius: '6px' }}>
                
                {/* 🌟 背面のスワイプアクションボタンエリア */}
                <div style={{ position: 'absolute', top: 0, right: 0, height: '100%', display: 'flex', zIndex: 0 }}>
                  <button 
                    onClick={(e) => openEditFromSwipe(e, item)}
                    style={{ background: '#00bfff', color: '#000', border: 'none', padding: '0 20px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>⚙️</span> 編集
                  </button>
                  <button 
                    onClick={(e) => deleteFromSwipe(e, item.name)}
                    style={{ background: '#ff3366', color: '#fff', border: 'none', padding: '0 20px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>🗑️</span> 削除
                  </button>
                </div>

                {/* 🌟 前面のメインカートリッジ（左にスライドする） */}
                <div className={reorderMode && !isDragging ? 'shake' : 'account-cartridge'}
                     onPointerDown={(e) => { if (!reorderMode && !routingMode) handlePointerDown(); }} 
                     onPointerUp={(e) => { if (!reorderMode) cancelPress(); else handleDragEnd(); }} 
                     onPointerLeave={(e) => { if (!reorderMode) cancelPress(); else handleDragEnd(); }}
                     onTouchStart={(e) => handleTouchStart(e, idx)} 
                     onTouchMove={(e) => handleTouchMove(e, systemData.combined, item.name)} 
                     onTouchEnd={handleDragEnd}
                     onClick={() => handleCartridgeClick(item.name)}
                     style={{ 
                       background: isRoutingSource ? '#ff336611' : '#0a0c10', 
                       border: `1px solid ${isRoutingSource ? '#ff3366' : (isRoutingTarget ? '#00bfff55' : '#252838')}`, 
                       borderRadius: '6px', padding: '15px 20px', position: 'relative', display: 'flex', flexDirection: 'column', gap: isCard ? '8px' : '10px', cursor: 'pointer', 
                       touchAction: reorderMode ? 'none' : 'pan-y',
                       transform: isDragging ? `translateY(${dragOffset}px) scale(1.05)` : (isSwiped ? 'translateX(-150px)' : 'translateX(0)'), 
                       zIndex: isDragging ? 100 : 1, 
                       boxShadow: isDragging ? '0 10px 30px rgba(255, 255, 255, 0.2)' : (isRoutingSource ? '0 0 20px rgba(255,51,102,0.3)' : 'none'), 
                       transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.2s, background 0.2s',
                       opacity: (routingMode && routingSource && routingSource !== item.name) ? 0.7 : 1
                     }}>
                  
                  <div style={{ color: isCard ? '#ff9900' : '#00bfff', fontSize: '14px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {iconMap[item.name] ? <img src={iconMap[item.name]} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain', pointerEvents: 'none' }} /> : <span>{isCard ? '💳' : '💽'}</span>}
                      <span>{item.name}</span>
                    </span>    
                    {isCard && <span style={{ color: '#666', fontSize: '10px', fontFamily: 'monospace' }}>{formatDate(bounds.startDate)}-{formatDate(bounds.endDate)}</span>}
                  </div>
                  
                  <div style={{ color: mainColor, fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right', textShadow: isCard ? `0 0 10px ${mainColor}44` : 'none' }}>
                    {amountText}
                  </div>

                  {isCard ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>
                      <span>LIMIT: ¥{item.budget.toLocaleString()}</span><span>{percent.toFixed(0)}% HP</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '12px', color: '#555' }}>
                      {percent.toFixed(1)}%
                    </div>
                  )}

                  <div style={{ position: 'absolute', bottom: 0, left: 0, height: '4px', width: '100%', background: '#1a1d24' }}>
                    <div className="energy-bar" style={{ height: '100%', width: `${percent}%`, background: mainColor, boxShadow: `0 0 10px ${mainColor}` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        .account-cartridge:hover { border-color: #555 !important; }
        .energy-bar { animation: pulse 2.5s infinite ease-in-out; transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
        .shake { animation: tilt-shaking 0.5s infinite; border-color: #ff9900 !important; }
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
        @keyframes tilt-shaking { 0% { transform: rotate(0deg); } 25% { transform: rotate(0.5deg); } 50% { transform: rotate(0deg); } 75% { transform: rotate(-0.5deg); } 100% { transform: rotate(0deg); } }
      `}</style>
    </div>
  );
}