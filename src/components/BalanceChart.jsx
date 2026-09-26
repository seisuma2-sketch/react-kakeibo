import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as echarts from 'echarts';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { saveSettingBoth } from '../utils/cloudSync';
import { getCleanAccountName, isSameAccount, normalizeCreditCardSettings, deduplicateAccounts } from '../utils/accountUtils';

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

export default function BalanceChart({ transactions = [], ghostAccounts = [], sortKey = 'amount', sortOrder = 'desc', setSortKey, onOpenStealth, onQuadTap = null, dbMode = 'personal', initialResetCard = null }) {
  const chartRef = useRef(null);
  
  // モード別の保存先キーおよびクラウド同期フィールド
  const cardKey = dbMode === 'sync' ? 'creditCardSettings_sync' : 'creditCardSettings';
  const cardField = dbMode === 'sync' ? 'creditCardSettings_sync' : 'creditCardSettings';
  const accKey = dbMode === 'sync' ? 'm402_accounts_sync' : 'm402_accounts';
  const accField = dbMode === 'sync' ? 'accounts_sync' : 'accounts';
  const deletedKey = dbMode === 'sync' ? 'deletedAccountsConfig_sync' : 'deletedAccountsConfig';
  const deletedField = dbMode === 'sync' ? 'deletedAccounts_sync' : 'deletedAccounts';
  const recycledKey = dbMode === 'sync' ? 'recycledAccountsConfig_sync' : 'recycledAccountsConfig';
  const customOrderKey = dbMode === 'sync' ? 'customOrderConfig_sync' : 'customOrderConfig';
  const customOrderField = dbMode === 'sync' ? 'customOrder_sync' : 'customOrder';

  const [todayStr, setTodayStr] = useState(new Date().toDateString());
  const [tick, setTick] = useState(0); 

  const [isAIPredictionActive, setIsAIPredictionActive] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [customOrder, setCustomOrder] = useState(() => JSON.parse(localStorage.getItem(customOrderKey) || '[]'));
  
  const [localUpdate, setLocalUpdate] = useState(0);
  
  const [deletedAccounts, setDeletedAccounts] = useState(() => JSON.parse(localStorage.getItem(deletedKey) || '[]'));

  const [recycledAccounts, setRecycledAccounts] = useState(() => {
    const saved = localStorage.getItem(recycledKey);
    return saved ? JSON.parse(saved) : [];
  });

  const [isRecycleModalOpen, setIsRecycleModalOpen] = useState(false);

  const [isNodeManagerOpen, setIsNodeManagerOpen] = useState(false);
  const [m402Accounts, setM402Accounts] = useState([]);
  const [newNodeName, setNewNodeName] = useState('');
  const [newInitBalance, setNewInitBalance] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [isAddingNode, setIsAddingNode] = useState(false);

  // 🌟 クレジットカード手動リセット用State
  const [resetModalCard, setResetModalCard] = useState(initialResetCard);
  const [resetMethod, setResetMethod] = useState('bank'); // 'bank' or 'display_only'
  const [resetSourceBank, setResetSourceBank] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // 🌟 口座残高棚卸し（差額調整）用State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditAccName, setAuditAccName] = useState('');
  const [auditTargetBalance, setAuditTargetBalance] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);

  // 🌟 自作通知トースト用State (Chrome標準alert不使用)
  const [appToast, setAppToast] = useState({ show: false, message: '', type: 'info' });
  const showToast = (message, type = 'info') => {
    setAppToast({ show: true, message, type });
    setTimeout(() => setAppToast({ show: false, message: '', type: 'info' }), 3200);
  };

  // 🌟 自作確認モーダル用State (Chrome標準confirm不使用)
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  const [cardMode, setCardMode] = useState(() => localStorage.getItem('m402_card_mode') || 'remain');

  const majorBanks = ['現金', '三菱UFJ銀行', '三井住友銀行', 'みずほ銀行', 'ゆうちょ銀行', 'りそな銀行', '楽天銀行', '住信SBIネット銀行', 'PayPay銀行', 'ソニー銀行', 'イオン銀行', 'PayPay', 'au PAY', 'd払い'];
  const filteredBanks = majorBanks.filter(b => b.includes(newNodeName) && b !== newNodeName);

  const [swipedAcc, setSwipedAcc] = useState(null); 
  const touchStartRef = useRef({ x: 0, y: 0 });

  const pressTimer = useRef(null);
  const clickTimer = useRef(null);
  
  // 🌟 タイトル領域用ダブルタップタイマー
  const headerClickTimer = useRef(null);

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
  const [editWithdrawalSource, setEditWithdrawalSource] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1); 

      const currentStr = new Date().toDateString();
      setTodayStr(prev => prev !== currentStr ? currentStr : prev);

      setRecycledAccounts(prev => {
        if (prev.length === 0) return prev;
        const ONE_HOUR = 3600000;
        const valid = prev.filter(item => (Date.now() - item.deletedAt) < ONE_HOUR);
        if (valid.length !== prev.length) {
          localStorage.setItem(recycledKey, JSON.stringify(valid));
          return valid;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [recycledKey]);

  useEffect(() => {
    const handleGlobalClick = () => setSwipedAcc(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const iconMap = {
    '現金': '/icon-cash.png', '三井住友銀行': '/icon-smbc.png', '三菱UFJ銀行': '/icon-mufg.png',
    'みずほ銀行': '/mizuho.jpg',
    'ゆうちょ銀行': '/icon-yucho.png', 'PayPay': '/icon-paypay.png', 'EVERING': '/icon-evering.png',
    '食費': '/icon-food.png', 'リクルートカード': '/S__32391170.jpg', 'PayPayカード': '/icon-other.png'
  };

  // 口座・カード名から表示用のクリーンな名前とアイコンURLを安全に抽出
  const getAccountDisplay = (rawName) => {
    if (!rawName) return { icon: null, name: '' };
    let name = rawName;
    let icon = null;

    if (name.startsWith('/')) {
      const spaceIdx = name.indexOf(' ');
      if (spaceIdx !== -1) {
        icon = name.slice(0, spaceIdx);
        name = name.slice(spaceIdx + 1);
      }
    }

    if (name === 'リクルートカード' || name.includes('リクルート')) {
      icon = '/S__32391170.jpg';
    } else if (name === 'みずほ銀行' || name.includes('みずほ')) {
      icon = '/mizuho.jpg';
    } else if (iconMap[name]) {
      icon = iconMap[name];
    } else if (icon && icon === '/icon-other.png') {
      if (iconMap[name]) icon = iconMap[name];
    }

    return { icon, name };
  };

  const systemData = useMemo(() => {
    const now = new Date(); 
    const rawCreditSettings = JSON.parse(localStorage.getItem(cardKey) || '{}');
    const creditSettings = normalizeCreditCardSettings(rawCreditSettings);
    const cardData = {};
    Object.keys(creditSettings).forEach(rawName => {
      const cleanName = getCleanAccountName(rawName);
      if (ghostAccounts.some(g => isSameAccount(g, cleanName)) || deletedAccounts.some(d => isSameAccount(d, cleanName))) return;
      cardData[cleanName] = { 
        budget: Number(creditSettings[rawName].budget) || 0,
        resetDay: Number(creditSettings[rawName].resetDay) || 1,
        paymentDay: Number(creditSettings[rawName].paymentDay) || 27,
        withdrawalSource: creditSettings[rawName].withdrawalSource || '',
        lastResetDate: creditSettings[rawName].lastResetDate || null,
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
      const method = getCleanAccountName(tx.paymentMethod) || '不明';
      const category = getCleanAccountName(tx.category) || '不明';

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
        if (!ghostAccounts.some(g => isSameAccount(g, accName)) && !deletedAccounts.some(d => isSameAccount(d, accName))) {
          currentVisibleTotal += accBalance;
        }
      }
      dLabels.push(dateStr);
      bData.push(currentVisibleTotal);
    });

    transactions.forEach(tx => {
      if (!tx.date || tx.type !== 'expense') return;
      const txDate = tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
      const method = getCleanAccountName(tx.paymentMethod) || '不明';

      if (cardData[method]) {
        cardData[method].usageCount = (cardData[method].usageCount || 0) + 1;
        const bounds = getCycleBounds(cardData[method].resetDay, now);
        
        // 🌟 最終リセット日がある場合、それ以降の支出のみを集計（リセット機能の核）
        const lastReset = cardData[method].lastResetDate ? new Date(cardData[method].lastResetDate) : null;
        const isAfterReset = !lastReset || txDate > lastReset;

        if (txDate >= bounds.startDate && txDate <= bounds.endDate && isAfterReset) {
          cardData[method].used += Number(tx.amount) || 0;
        }
      }
    });

    const bankData = {};
    Object.entries(runningBalances).forEach(([name, bal]) => {
      const cleanName = getCleanAccountName(name);
      if (ghostAccounts.some(g => isSameAccount(g, cleanName)) || deletedAccounts.some(d => isSameAccount(d, cleanName))) return;
      // 🌟 クレジットカードとして既に存在する口座は絶対に銀行口座側に追加しない！
      if (cardData[cleanName]) return; 
      
      if (!bankData[cleanName]) {
        bankData[cleanName] = { balance: 0, usageCount: 0 };
      }
      bankData[cleanName].balance += bal;
      bankData[cleanName].usageCount += (usageCounts[name] || 0);
    });

    const combined = [];
    const addedCleanNames = new Set();
    Object.entries(cardData).forEach(([name, data]) => {
      const clean = getCleanAccountName(name);
      if (!addedCleanNames.has(clean)) {
        addedCleanNames.add(clean);
        combined.push({ id: clean, name: clean, type: 'card', ...data });
      }
    });
    Object.entries(bankData).forEach(([name, data]) => {
      const clean = getCleanAccountName(name);
      if (!addedCleanNames.has(clean)) {
        addedCleanNames.add(clean);
        combined.push({ id: clean, name: clean, type: 'bank', ...data });
      }
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
      combined, dateLabels: dLabels, balanceData: bData, pLabels, pValues
    };
  }, [transactions, ghostAccounts, deletedAccounts, todayStr, sortKey, sortOrder, customOrder, localUpdate]);

  const visibleTotalBank = useMemo(() => {
    return systemData.combined
      .filter(item => item.type === 'bank')
      .reduce((sum, item) => sum + item.balance, 0);
  }, [systemData.combined]);

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

  // 🌟 タイトル領域（ヘッダー）のダブルタップ検知（隠しコマンド）
  const handleHeaderDoubleTap = () => {
    if (headerClickTimer.current) {
      clearTimeout(headerClickTimer.current);
      headerClickTimer.current = null;
      if (onOpenStealth) {
        if (navigator.vibrate) navigator.vibrate([30, 100, 30]);
        onOpenStealth();
      }
    } else {
      headerClickTimer.current = setTimeout(() => {
        headerClickTimer.current = null;
      }, 300);
    }
  };

  const handlePointerDown = () => {
    pressTimer.current = setTimeout(() => {
      setReorderMode(prev => !prev); if (setSortKey) setSortKey('custom'); if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }, 600);
  };
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

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
    setCustomOrder(newCustomOrder);
    saveSettingBoth(auth.currentUser?.uid, customOrderField, customOrderKey, newCustomOrder);
  };

  const handleTouchMove = (e, array, itemName) => {
    const touch = e.touches ? e.touches[0] : e;
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;

    if (!reorderMode && !routingMode) {
      if (diffX < -40 && Math.abs(diffY) < 30) {
        setSwipedAcc(itemName);
        if (navigator.vibrate) navigator.vibrate(15);
      } else if (diffX > 30) {
        setSwipedAcc(null);
      }
      return;
    }

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

  const openNodeManager = () => {
    const accs = JSON.parse(localStorage.getItem(accKey) || '[]');
    setM402Accounts(accs);
    setNewNodeName('');
    setNewInitBalance('');
    setIsNodeManagerOpen(true);
  };

  const handleAddNewNode = async () => {
    if (!newNodeName.trim() || isAddingNode) return;
    setIsAddingNode(true);
    
    try {
      let currentAccs = JSON.parse(localStorage.getItem(accKey) || '[]');
      const cleanNewName = newNodeName.trim();
      const exists = currentAccs.some(a => (a.includes(' ') ? a.split(' ')[1] : a) === cleanNewName);
      
      if (!exists) {
        const iconMapLocal = {
          '現金': '/icon-cash.png', '三井住友銀行': '/icon-smbc.png', '三菱UFJ銀行': '/icon-mufg.png',
          'みずほ銀行': '/mizuho.jpg', 'ゆうちょ銀行': '/icon-yucho.png', 'PayPay': '/icon-paypay.png',
          'EVERING': '/icon-evering.png', 'リクルートカード': '/S__32391170.jpg'
        };
        const icon = iconMapLocal[cleanNewName] || '/icon-other.png';
        currentAccs.push(`${icon} ${cleanNewName}`);
        saveSettingBoth(auth.currentUser?.uid, accField, accKey, currentAccs);
        setM402Accounts(currentAccs);
      }

      const bal = Number(newInitBalance);
      if (bal > 0 && auth.currentUser) {
        const txData = {
          userId: auth.currentUser.uid,
          type: 'income',
          amount: bal,
          category: '初期設定 (INIT)',
          paymentMethod: cleanNewName,
          memo: 'SYSTEM NODE ADDED',
          date: Timestamp.now(),
          createdAt: Timestamp.now()
        };
        await addDoc(collection(db, "transactions"), txData);
        showToast(`[${cleanNewName}] を接続し、初期残高 ¥${bal.toLocaleString()} を設定しました`, 'success');
      } else {
        showToast(`[${cleanNewName}] を接続しました`, 'success');
      }

      if (deletedAccounts.includes(cleanNewName)) {
         const newDeleted = deletedAccounts.filter(a => a !== cleanNewName);
         setDeletedAccounts(newDeleted);
         saveSettingBoth(auth.currentUser?.uid, deletedField, deletedKey, newDeleted);
      }

      setNewNodeName('');
      setNewInitBalance('');
      setLocalUpdate(prev => prev + 1);
    } catch(e) {
      console.error(e);
      showToast("エラーが発生しました", "error");
    } finally {
      setIsAddingNode(false);
    }
  };

  const handleManagerDeleteNode = (rawAccName) => {
    const cleanName = rawAccName.includes(' ') ? rawAccName.split(' ')[1] : rawAccName;
    setConfirmModal({
      show: true,
      title: 'ノード切断の確認',
      message: `[${cleanName}] を切断（非表示）にしますか？\n※過去の取引履歴は保持されます。`,
      onConfirm: () => {
        const updatedAccs = m402Accounts.filter(a => a !== rawAccName);
        setM402Accounts(updatedAccs);
        saveSettingBoth(auth.currentUser?.uid, accField, accKey, updatedAccs);

        if (!deletedAccounts.includes(cleanName)) {
          const newDeleted = [...deletedAccounts, cleanName];
          setDeletedAccounts(newDeleted);
          saveSettingBoth(auth.currentUser?.uid, deletedField, deletedKey, newDeleted);
        }
        setLocalUpdate(prev => prev + 1);
        showToast(`[${cleanName}] を切断しました`, 'info');
      }
    });
  };

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

  const handleCartridgeClick = (e, name) => {
    e.stopPropagation();

    if (swipedAcc === name) {
      setSwipedAcc(null);
      return;
    }

    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      if (reorderMode || routingMode) return;
      setSwipedAcc(name);
      if (navigator.vibrate) navigator.vibrate([20, 50, 20]);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        if (reorderMode || swipedAcc === name) return;
        if (routingMode) {
          if (!routingSource) { setRoutingSource(name); if (navigator.vibrate) navigator.vibrate([30]); } 
          else if (routingSource === name) { setRoutingSource(null); } 
          else { setRoutingTarget(name); if (navigator.vibrate) navigator.vibrate([30, 50, 30]); }
        } else {
          setSelectedAccHistory(name);
          if (navigator.vibrate) navigator.vibrate([15]);
        }
      }, 200); 
    }
  };

  const openEditFromSwipe = (e, item) => {
    e.stopPropagation(); 
    setSwipedAcc(null);
    setEditingAcc(item.name);
    setEditType(item.type);
    if (item.type === 'card') {
      setEditBudget(item.budget.toString());
      setEditResetDay(item.resetDay.toString());
      setEditPayDay(item.paymentDay.toString());
      setEditWithdrawalSource(item.withdrawalSource || '');
    } else {
      setEditBudget(''); setEditResetDay('1'); setEditPayDay('27'); setEditWithdrawalSource('');
    }
  };

  const deleteFromSwipe = (e, item) => {
    e.stopPropagation();
    const itemName = typeof item === 'string' ? item : item.name;
    const itemType = typeof item === 'object' ? item.type : 'bank';

    setConfirmModal({
      show: true,
      title: '口座の非表示',
      message: `[${itemName}] を非表示にしますか？\n（1時間以内なら右上の「復元」から完全復元できます）`,
      onConfirm: () => {
        setSwipedAcc(null);
        
        const newDeleted = [...deletedAccounts, itemName];
        setDeletedAccounts(newDeleted);
        saveSettingBoth(auth.currentUser?.uid, deletedField, deletedKey, newDeleted);
        
        const currentSettings = JSON.parse(localStorage.getItem(cardKey) || '{}');
        const savedConfig = currentSettings[itemName] || null;

        const newRecycledItem = {
          name: itemName,
          type: itemType,
          deletedAt: Date.now(),
          config: savedConfig
        };
        
        const newRecycledList = [newRecycledItem, ...recycledAccounts.filter(r => r.name !== itemName)];
        setRecycledAccounts(newRecycledList);
        localStorage.setItem(recycledKey, JSON.stringify(newRecycledList));

        setLocalUpdate(prev => prev + 1);
        if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
        showToast(`[${itemName}] を一時退避しました`, 'info');
      }
    });
  };

  const restoreAccount = (item) => {
    const itemName = item.name;
    const newDeleted = deletedAccounts.filter(a => a !== itemName);
    setDeletedAccounts(newDeleted);
    saveSettingBoth(auth.currentUser?.uid, deletedField, deletedKey, newDeleted);

    if (item.config) {
      const currentSettings = JSON.parse(localStorage.getItem(cardKey) || '{}');
      currentSettings[itemName] = item.config;
      saveSettingBoth(auth.currentUser?.uid, cardField, cardKey, currentSettings);
    }

    const newRecycled = recycledAccounts.filter(r => r.name !== itemName);
    setRecycledAccounts(newRecycled);
    localStorage.setItem(recycledKey, JSON.stringify(newRecycled));

    setLocalUpdate(prev => prev + 1);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    showToast(`[${itemName}] を復元しました`, 'success');
  };

  const restoreAllAccounts = () => {
    setConfirmModal({
      show: true,
      title: '全口座の強制再表示',
      message: '非表示になっている全口座（PayPay等含む）をすべて再表示しますか？',
      onConfirm: () => {
        setDeletedAccounts([]);
        setRecycledAccounts([]);
        saveSettingBoth(auth.currentUser?.uid, deletedField, deletedKey, []);
        localStorage.removeItem(recycledKey);
        setLocalUpdate(prev => prev + 1);
        showToast('全口座を再表示しました', 'success');
      }
    });
  };

  const saveEdit = () => {
    const currentSettings = JSON.parse(localStorage.getItem(cardKey) || '{}');
    if (editType === 'card') {
      const existing = currentSettings[editingAcc] || {};
      currentSettings[editingAcc] = {
        ...existing,
        budget: Number(editBudget) || 0,
        resetDay: Number(editResetDay) || 1,
        paymentDay: Number(editPayDay) || 27,
        withdrawalSource: editWithdrawalSource || ''
      };
    } else {
      delete currentSettings[editingAcc];
    }
    saveSettingBoth(auth.currentUser?.uid, cardField, cardKey, currentSettings);
    setEditingAcc(null);
    setLocalUpdate(prev => prev + 1); 
    showToast(`[${editingAcc}] の設定を保存しました`, 'success');
  };

  // 🌟 クレジットカード利用額リセットモーダルを開く
  const handleOpenResetModal = (item) => {
    setResetModalCard(item);
    setResetMethod('bank');
    // 引き落とし元の初期設定
    setResetSourceBank(item.withdrawalSource || '三井住友銀行');
    setSwipedAcc(null);
  };

  // 🌟 クレジットカード手動リセットの実行
  const executeCardReset = async () => {
    if (!resetModalCard) return;
    setIsResetting(true);
    try {
      const cardName = resetModalCard.name;
      const usedAmount = resetModalCard.used || 0;

      // 銀行引き落とし連動の場合、振替トランザクションを作成
      if (resetMethod === 'bank' && usedAmount > 0 && resetSourceBank && auth.currentUser) {
        const txData = {
          userId: auth.currentUser.uid,
          type: 'transfer',
          amount: usedAmount,
          paymentMethod: resetSourceBank,
          category: cardName,
          memo: `カード利用額精算 (${cardName})`,
          date: Timestamp.now(),
          createdAt: Timestamp.now(),
          mode: dbMode === 'sync' ? 'sync' : 'personal'
        };
        await addDoc(collection(db, "transactions"), txData);
      }

      // カード設定に lastResetDate を記録（直前の利用分はリセットされる）
      const currentSettings = JSON.parse(localStorage.getItem(cardKey) || '{}');
      if (!currentSettings[cardName]) {
        currentSettings[cardName] = {
          budget: resetModalCard.budget || 0,
          resetDay: resetModalCard.resetDay || 1,
          paymentDay: resetModalCard.paymentDay || 27,
          withdrawalSource: resetSourceBank
        };
      }
      currentSettings[cardName].lastResetDate = new Date().toISOString();
      if (resetSourceBank) {
        currentSettings[cardName].withdrawalSource = resetSourceBank;
      }
      saveSettingBoth(auth.currentUser?.uid, cardField, cardKey, currentSettings);

      setResetModalCard(null);
      setLocalUpdate(prev => prev + 1);
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      showToast(
        resetMethod === 'bank' && usedAmount > 0
          ? `[${resetSourceBank}] から ¥${usedAmount.toLocaleString()} を引き落とし、[${cardName}] を精算リセットしました`
          : `[${cardName}] の利用額表示をリセットしました`,
        'success'
      );
    } catch (e) {
      console.error(e);
      showToast("リセット処理中にエラーが発生しました", "error");
    } finally {
      setIsResetting(false);
    }
  };

  // 🌟 直前のリセットを取り消す（UNDO）
  const handleUndoReset = (cardName) => {
    const currentSettings = JSON.parse(localStorage.getItem(cardKey) || '{}');
    if (currentSettings[cardName]) {
      delete currentSettings[cardName].lastResetDate;
      saveSettingBoth(auth.currentUser?.uid, cardField, cardKey, currentSettings);
      setLocalUpdate(prev => prev + 1);
      showToast(`[${cardName}] のリセットを取り消しました`, 'info');
    }
  };

  // 🌟 口座残高棚卸し（差額調整）モーダルを開く
  const openAuditModal = (accName) => {
    const bankItem = systemData.combined.find(i => i.name === accName && i.type === 'bank');
    const currentBal = bankItem ? bankItem.balance : 0;
    setAuditAccName(accName);
    setAuditTargetBalance(currentBal.toString());
    setIsAuditModalOpen(true);
  };

  // 🌟 口座残高棚卸し（差額調整）の実行
  const executeBalanceAudit = async () => {
    const target = Number(auditTargetBalance);
    if (isNaN(target) || !auditAccName || !auth.currentUser) {
      showToast("正しい金額を入力してください", "error");
      return;
    }
    const bankItem = systemData.combined.find(i => i.name === auditAccName && i.type === 'bank');
    const currentBal = bankItem ? bankItem.balance : 0;
    const diff = target - currentBal;

    if (diff === 0) {
      showToast("残高に差額はありません", "info");
      setIsAuditModalOpen(false);
      return;
    }

    setIsAuditing(true);
    try {
      const isIncrease = diff > 0;
      const txData = {
        userId: auth.currentUser.uid,
        type: isIncrease ? 'income' : 'expense',
        amount: Math.abs(diff),
        category: '残高調整(棚卸し)',
        paymentMethod: auditAccName,
        memo: `実残高との一致調整 (差額: ${diff > 0 ? '+' : ''}¥${diff.toLocaleString()})`,
        date: Timestamp.now(),
        createdAt: Timestamp.now(),
        mode: dbMode === 'sync' ? 'sync' : 'personal'
      };
      await addDoc(collection(db, "transactions"), txData);
      setIsAuditModalOpen(false);
      setLocalUpdate(prev => prev + 1);
      if (navigator.vibrate) navigator.vibrate([50, 100]);
      showToast(`[${auditAccName}] の残高を ¥${target.toLocaleString()} に調整しました`, 'success');
    } catch (e) {
      console.error(e);
      showToast("残高調整中にエラーが発生しました", "error");
    } finally {
      setIsAuditing(false);
    }
  };

  const executeTransfer = async () => {
    const numAmount = Number(transferAmount);
    if (!transferAmount || isNaN(numAmount) || numAmount <= 0) { showToast("正しい金額を入力してください", "error"); return; }
    setIsTransferring(true);
    try {
      const txData = { 
        userId: auth.currentUser.uid, 
        type: 'transfer', 
        amount: numAmount, 
        paymentMethod: routingSource, 
        category: routingTarget, 
        memo: 'システム・ルーティング (UI)', 
        date: Timestamp.now(), 
        createdAt: Timestamp.now(),
        mode: dbMode === 'sync' ? 'sync' : 'personal'
      };
      await addDoc(collection(db, "transactions"), txData);
      setRoutingSource(null); setRoutingTarget(null); setTransferAmount(''); setRoutingMode(false);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      showToast(`[${routingSource}] から [${routingTarget}] へ ¥${numAmount.toLocaleString()} を振替しました`, 'success');
    } catch (e) { showToast("通信エラーが発生しました", "error"); console.error(e); } 
    finally { setIsTransferring(false); }
  };

  const containerStyle = { display: 'flex', flexDirection: 'column', gap: '25px', height: '100%', position: 'relative', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' };

  const getRemainingTimeStr = (deletedAt) => {
    const elapsed = Date.now() - deletedAt;
    const remaining = Math.max(0, 3600000 - elapsed);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${mins}分${secs < 10 ? '0' : ''}${secs}秒`;
  };

  return (
    <div style={containerStyle} onContextMenu={(e) => e.preventDefault()}>
      
      {/* 🌟 自作確認モーダル (Chrome標準confirm不使用) */}
      {confirmModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#0a0c10', border: '1px solid #ff3366', borderRadius: '12px', width: '90%', maxWidth: '360px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 0 30px rgba(255,51,102,0.3)' }}>
            <h3 style={{ margin: 0, color: '#ff3366', fontSize: '16px', fontFamily: 'monospace' }}>
              [確認] {confirmModal.title}
            </h3>
            <div style={{ fontSize: '13px', color: '#ccc', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
              {confirmModal.message}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button 
                onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: null })}
                style={{ flex: 1, padding: '12px', background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button 
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ show: false, title: '', message: '', onConfirm: null });
                }}
                style={{ flex: 1, padding: '12px', background: '#ff3366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 0 15px rgba(255,51,102,0.4)' }}
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 自作通知トースト (Chrome標準alert不使用) */}
      {appToast.show && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: appToast.type === 'error' ? '#2b0a10' : (appToast.type === 'success' ? '#0a2b16' : '#0a1d2b'),
          border: `1px solid ${appToast.type === 'error' ? '#ff3366' : (appToast.type === 'success' ? '#00ff66' : '#00bfff')}`,
          color: appToast.type === 'error' ? '#ff3366' : (appToast.type === 'success' ? '#00ff66' : '#00bfff'),
          padding: '12px 24px', borderRadius: '30px', fontSize: '13px', fontWeight: 'bold',
          boxShadow: '0 5px 25px rgba(0,0,0,0.6)', zIndex: 9999999, pointerEvents: 'none',
          animation: 'fadeInDown 0.3s ease-out', maxWidth: '90%', textAlign: 'center'
        }}>
          {appToast.message}
        </div>
      )}

      {isRecycleModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#0a0c10', border: '1px solid #00ff66', borderRadius: '12px', width: '90%', maxWidth: '380px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 0 30px rgba(0,255,102,0.3)', maxHeight: '80vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#00ff66', fontSize: '16px', fontFamily: 'monospace' }}>
                [復元] RECOVERY BIN
              </h3>
              <button onClick={() => setIsRecycleModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ fontSize: '11px', color: '#aaa' }}>
              ※削除から1時間以内であれば、設定とデータを元の状態に完全復元できます。
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px' }}>
              {recycledAccounts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#555', padding: '20px 0', fontFamily: 'monospace', fontSize: '12px' }}>
                  現在、一時退避中の口座はありません
                </div>
              ) : (
                recycledAccounts.map(item => (
                  <div key={item.name} style={{ background: '#11141a', border: '1px solid #252838', borderRadius: '6px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{item.name}</div>
                      <div style={{ color: '#ff3366', fontSize: '10px', fontFamily: 'monospace', marginTop: '3px' }}>
                        抹消まであと {getRemainingTimeStr(item.deletedAt)}
                      </div>
                    </div>
                    <button onClick={() => restoreAccount(item)} style={{ background: '#00ff66', color: '#000', border: 'none', padding: '8px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', boxShadow: '0 0 10px rgba(0,255,102,0.3)' }}>
                      復元
                    </button>
                  </div>
                ))
              )}
            </div>
            <div style={{ borderTop: '1px solid #222', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={restoreAllAccounts} style={{ width: '100%', padding: '10px', background: 'rgba(0,191,255,0.1)', color: '#00bfff', border: '1px solid #00bfff', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                非表示の全口座を強制再表示
              </button>
              <button onClick={() => setIsRecycleModalOpen(false)} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '6px' }}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {isNodeManagerOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#0a0c10', border: '1px solid #00bfff', borderRadius: '12px', width: '90%', maxWidth: '420px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 0 40px rgba(0,191,255,0.3)', maxHeight: '90vh' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#00bfff', fontSize: '16px', fontFamily: 'monospace' }}>
                [管理] 口座管理マネージャー
              </h3>
              <button onClick={() => setIsNodeManagerOpen(false)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ background: '#11141a', padding: '15px', borderRadius: '8px', border: '1px dashed #00bfff' }}>
              <div style={{ fontSize: '12px', color: '#00bfff', marginBottom: '10px', fontWeight: 'bold' }}>[+] 新規口座の接続 (追加)</div>
              
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <input
                  type="text"
                  value={newNodeName}
                  onChange={e => setNewNodeName(e.target.value)}
                  onFocus={() => setShowSuggest(true)}
                  onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
                  placeholder="口座名 (例: 三菱UFJ銀行)"
                  style={{ width: '100%', padding: '10px', background: '#0a0c10', color: '#fff', border: '1px solid #333', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }}
                />
                {showSuggest && filteredBanks.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#1a1d24', border: '1px solid #00bfff', borderRadius: '4px', zIndex: 10, maxHeight: '120px', overflowY: 'auto', marginTop: '4px', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
                    {filteredBanks.map(b => (
                      <div 
                        key={b} 
                        onClick={() => { setNewNodeName(b); setShowSuggest(false); }}
                        style={{ padding: '8px', fontSize: '12px', color: '#fff', cursor: 'pointer', borderBottom: '1px solid #333' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#00bfff33'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {b}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', opacity: newNodeName ? 1 : 0.3, pointerEvents: newNodeName ? 'auto' : 'none', transition: 'all 0.3s' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#0a0c10', border: '1px solid #333', borderRadius: '6px', padding: '0 10px', flex: 2 }}>
                  <span style={{ color: '#ff9900', fontSize: '14px', fontWeight: 'bold' }}>¥</span>
                  <input
                    type="number"
                    value={newInitBalance}
                    onChange={e => setNewInitBalance(e.target.value)}
                    placeholder="初期残高 (任意)"
                    style={{ width: '100%', padding: '10px 5px', background: 'transparent', color: '#ff9900', border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}
                  />
                </div>
                <button 
                  onClick={handleAddNewNode} 
                  disabled={isAddingNode}
                  style={{ flex: 1, background: '#00bfff', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 10px rgba(0,191,255,0.3)' }}
                >
                  {isAddingNode ? '...' : '追加'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: '150px' }}>
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px', fontWeight: 'bold' }}>[-] 接続済み口座 (切断・削除)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {m402Accounts.length === 0 ? (
                  <div style={{ color: '#555', textAlign: 'center', fontSize: '12px', padding: '20px 0' }}>NO NODES FOUND</div>
                ) : (
                  m402Accounts.map(acc => {
                    const clean = acc.includes(' ') ? acc.split(' ')[1] : acc;
                    const isHidden = deletedAccounts.includes(clean);
                    return (
                      <div key={acc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#11141a', padding: '10px 12px', borderRadius: '6px', border: `1px solid ${isHidden ? '#ff336655' : '#252838'}`, opacity: isHidden ? 0.5 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ccc' }}>
                          {acc.startsWith('/') && <img src={acc.split(' ')[0]} alt="" style={{ width:'16px', height:'16px' }}/>}
                          <span>{clean}</span>
                        </div>
                        {!isHidden ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              onClick={() => openAuditModal(clean)}
                              style={{ background: 'transparent', color: '#00bfff', border: '1px solid #00bfff', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              残高棚卸
                            </button>
                            <button 
                              onClick={() => handleManagerDeleteNode(acc)}
                              style={{ background: 'transparent', color: '#ff3366', border: '1px solid #ff3366', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              切断
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#ff3366' }}>切断済</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button onClick={() => setIsNodeManagerOpen(false)} style={{ width: '100%', padding: '12px', background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {editingAcc && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#0a0c10', border: '1px solid #00bfff', borderRadius: '12px', width: '90%', maxWidth: '340px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 0 30px rgba(0, 191, 255, 0.3)' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              [設定] {editingAcc}
            </h3>
            
            <div style={{ display: 'flex', background: '#11141a', borderRadius: '6px', padding: '4px', border: '1px solid #333' }}>
              <button onClick={() => setEditType('bank')} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '4px', fontWeight: 'bold', background: editType === 'bank' ? '#00bfff' : 'transparent', color: editType === 'bank' ? '#000' : '#888' }}>銀行口座</button>
              <button onClick={() => setEditType('card')} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '4px', fontWeight: 'bold', background: editType === 'card' ? '#ff9900' : 'transparent', color: editType === 'card' ? '#000' : '#888' }}>クレジット</button>
            </div>

            {editType === 'card' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px' }}>利用上限枠 (予算)</div>
                  <input type="number" value={editBudget} onChange={e => setEditBudget(e.target.value)} style={{ width: '100%', padding: '10px', background: '#1a1d24', color: '#ff9900', border: '1px solid #555', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px' }}>締め日</div>
                    <input type="number" value={editResetDay} onChange={e => setEditResetDay(e.target.value)} min="1" max="31" style={{ width: '100%', padding: '10px', background: '#1a1d24', color: '#00ff66', border: '1px solid #555', borderRadius: '6px', fontSize: '16px', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px' }}>支払日 (引落)</div>
                    <input type="number" value={editPayDay} onChange={e => setEditPayDay(e.target.value)} min="1" max="31" style={{ width: '100%', padding: '10px', background: '#1a1d24', color: '#ff3366', border: '1px solid #555', borderRadius: '6px', fontSize: '16px', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px' }}>引き落とし元銀行</div>
                  <select 
                    value={editWithdrawalSource} 
                    onChange={e => setEditWithdrawalSource(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#1a1d24', color: '#00bfff', border: '1px solid #555', borderRadius: '6px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  >
                    <option value="">未設定</option>
                    {majorBanks.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                
                {/* 🌟 直前のリセット取り消し (UNDO) ボタン */}
                {(() => {
                  const currentSettings = JSON.parse(localStorage.getItem(cardKey) || '{}');
                  const hasReset = currentSettings[editingAcc]?.lastResetDate;
                  if (hasReset) {
                    return (
                      <div style={{ background: '#11141a', padding: '8px', borderRadius: '6px', border: '1px dashed #555', marginTop: '5px' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>前回の精算リセット: {new Date(hasReset).toLocaleDateString()}</div>
                        <button 
                          onClick={() => handleUndoReset(editingAcc)}
                          style={{ width: '100%', padding: '6px', background: 'transparent', color: '#ff9900', border: '1px solid #ff9900', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          前回の精算リセットを取り消す
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <button onClick={saveEdit} style={{ width: '100%', padding: '12px', background: '#00bfff', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>保存する</button>
              <button onClick={() => setEditingAcc(null)} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 クレジットカード利用額リセット・精算自作モーダル */}
      {resetModalCard && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#0a0c10', border: '1px solid #00ff66', borderRadius: '12px', width: '90%', maxWidth: '380px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 0 35px rgba(0,255,102,0.3)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#00ff66', fontSize: '16px', fontFamily: 'monospace' }}>
                [精算] クレジット利用額リセット
              </h3>
              <button onClick={() => setResetModalCard(null)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ background: '#11141a', padding: '15px', borderRadius: '8px', border: '1px solid #252838' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>対象カード</div>
              <div style={{ fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>{resetModalCard.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #333' }}>
                <span style={{ fontSize: '12px', color: '#aaa' }}>現在の利用額 (マイナス)</span>
                <span style={{ fontSize: '20px', color: '#ff3366', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  ¥{(resetModalCard.used || 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold' }}>精算方法を選択してください:</div>
              
              <div 
                onClick={() => setResetMethod('bank')}
                style={{ 
                  padding: '12px', borderRadius: '6px', cursor: 'pointer',
                  background: resetMethod === 'bank' ? 'rgba(0,255,102,0.1)' : '#11141a',
                  border: `1px solid ${resetMethod === 'bank' ? '#00ff66' : '#252838'}`,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="radio" checked={resetMethod === 'bank'} onChange={() => setResetMethod('bank')} />
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: resetMethod === 'bank' ? '#00ff66' : '#fff' }}>
                    銀行口座から引き落として精算 (推奨)
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '6px', marginLeft: '24px', lineHeight: '1.4' }}>
                  銀行から ¥{(resetModalCard.used || 0).toLocaleString()} を引き落とす振替記録を作成し、カードの利用額を ¥0 に戻します。
                </div>
                {resetMethod === 'bank' && (
                  <div style={{ marginTop: '10px', marginLeft: '24px' }}>
                    <div style={{ fontSize: '11px', color: '#00bfff', marginBottom: '4px' }}>引き落とし元口座:</div>
                    <select 
                      value={resetSourceBank} 
                      onChange={e => setResetSourceBank(e.target.value)}
                      style={{ width: '100%', padding: '8px', background: '#0a0c10', color: '#fff', border: '1px solid #00bfff', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                    >
                      {majorBanks.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div 
                onClick={() => setResetMethod('display_only')}
                style={{ 
                  padding: '12px', borderRadius: '6px', cursor: 'pointer',
                  background: resetMethod === 'display_only' ? 'rgba(0,191,255,0.1)' : '#11141a',
                  border: `1px solid ${resetMethod === 'display_only' ? '#00bfff' : '#252838'}`,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="radio" checked={resetMethod === 'display_only'} onChange={() => setResetMethod('display_only')} />
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: resetMethod === 'display_only' ? '#00bfff' : '#fff' }}>
                    表示のみリセット (記録作成なし)
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '6px', marginLeft: '24px', lineHeight: '1.4' }}>
                  カードの利用額を ¥0 に戻します。(銀行口座残高への影響はありません)
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <button 
                onClick={() => setResetModalCard(null)} 
                style={{ flex: 1, padding: '12px', background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button 
                onClick={executeCardReset} 
                disabled={isResetting}
                style={{ flex: 1, padding: '12px', background: '#00ff66', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: isResetting ? 'not-allowed' : 'pointer', boxShadow: '0 0 15px rgba(0,255,102,0.3)' }}
              >
                {isResetting ? '処理中...' : '精算を実行する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 口座残高棚卸し（差額調整）自作モーダル */}
      {isAuditModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#0a0c10', border: '1px solid #00bfff', borderRadius: '12px', width: '90%', maxWidth: '360px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 0 35px rgba(0,191,255,0.3)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#00bfff', fontSize: '16px', fontFamily: 'monospace' }}>
                [棚卸] 口座残高の補正・調整
              </h3>
              <button onClick={() => setIsAuditModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ background: '#11141a', padding: '15px', borderRadius: '8px', border: '1px solid #252838' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>対象口座</div>
              <div style={{ fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>{auditAccName}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #333' }}>
                <span style={{ fontSize: '12px', color: '#aaa' }}>現在のアプリ残高</span>
                <span style={{ fontSize: '16px', color: '#00bfff', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  ¥{(systemData.combined.find(i => i.name === auditAccName)?.balance || 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold', marginBottom: '6px' }}>実際の現在残高を入力:</div>
              <div style={{ display: 'flex', alignItems: 'center', background: '#1a1d24', border: '1px solid #00bfff', borderRadius: '6px', padding: '0 12px' }}>
                <span style={{ color: '#00bfff', fontSize: '18px', fontWeight: 'bold' }}>¥</span>
                <input 
                  type="number" 
                  autoFocus
                  value={auditTargetBalance} 
                  onChange={e => setAuditTargetBalance(e.target.value)} 
                  style={{ width: '100%', padding: '12px 8px', background: 'transparent', color: '#fff', border: 'none', outline: 'none', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}
                />
              </div>
              {(() => {
                const currentBal = systemData.combined.find(i => i.name === auditAccName)?.balance || 0;
                const target = Number(auditTargetBalance);
                if (!isNaN(target)) {
                  const diff = target - currentBal;
                  return (
                    <div style={{ fontSize: '11px', marginTop: '6px', color: diff === 0 ? '#888' : (diff > 0 ? '#00ff66' : '#ff3366'), fontFamily: 'monospace' }}>
                      差額調整: {diff >= 0 ? `+¥${diff.toLocaleString()} (収入調整)` : `-¥${Math.abs(diff).toLocaleString()} (支出調整)`}
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <button 
                onClick={() => setIsAuditModalOpen(false)} 
                style={{ flex: 1, padding: '12px', background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button 
                onClick={executeBalanceAudit} 
                disabled={isAuditing}
                style={{ flex: 1, padding: '12px', background: '#00bfff', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: isAuditing ? 'not-allowed' : 'pointer', boxShadow: '0 0 15px rgba(0,191,255,0.3)' }}
              >
                {isAuditing ? '調整中...' : '残高を合わせる'}
              </button>
            </div>
          </div>
        </div>
      )}

      {routingSource && routingTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#0a0c10', border: '1px solid #00bfff', borderRadius: '12px', width: '90%', maxWidth: '350px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 0 40px rgba(0, 191, 255, 0.3)' }}>
            <h3 style={{ margin: 0, color: '#00bfff', fontFamily: 'monospace', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>[振替] 資金ルーティング</h3>
            <div style={{ background: '#11141a', padding: '15px', borderRadius: '8px', border: '1px dashed #555' }}>
              <div style={{ color: '#ff3366', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>出金元</div><div style={{ fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>{routingSource}</div>
              <div style={{ textAlign: 'center', color: '#666', fontSize: '20px', margin: '10px 0' }}>↓</div>
              <div style={{ color: '#00bfff', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>入金先</div><div style={{ fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>{routingTarget}</div>
            </div>
            <div>
              <div style={{ color: '#aaa', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>転送金額を入力</div>
              <div style={{ display: 'flex', alignItems: 'center', background: '#1a1d24', border: '1px solid #00bfff', borderRadius: '6px', padding: '0 15px' }}>
                <span style={{ color: '#00bfff', fontSize: '20px', fontWeight: 'bold' }}>¥</span>
                <input type="number" autoFocus value={transferAmount} onChange={e => setTransferAmount(e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', fontWeight: 'bold', padding: '15px 10px', outline: 'none', fontFamily: 'monospace' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => { setRoutingTarget(null); setTransferAmount(''); }} style={{ flex: 1, padding: '15px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>キャンセル</button>
              <button onClick={executeTransfer} disabled={isTransferring} style={{ flex: 1, padding: '15px', background: isTransferring ? '#555' : '#00bfff', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isTransferring ? 'not-allowed' : 'pointer', boxShadow: isTransferring ? 'none' : '0 0 15px rgba(0, 191, 255, 0.4)' }}>{isTransferring ? '転送中...' : '実行'}</button>
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
          <h2 style={{ fontSize: '16px', margin: 0, color: '#fff', fontFamily: 'monospace', letterSpacing: '1px' }}>総合残高推移トレンド</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setRoutingMode(!routingMode); setRoutingSource(null); setReorderMode(false); }} style={{ background: routingMode ? '#00bfff22' : 'transparent', color: routingMode ? '#00bfff' : '#666', border: `1px solid ${routingMode ? '#00bfff' : '#333'}`, padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', cursor: 'pointer', transition: 'all 0.2s', boxShadow: routingMode ? '0 0 10px rgba(0,191,255,0.3)' : 'none' }}>振替</button>
            <button onClick={() => setIsAIPredictionActive(!isAIPredictionActive)} style={{ background: isAIPredictionActive ? '#ffeb3b22' : 'transparent', color: isAIPredictionActive ? '#ffeb3b' : '#666', border: `1px solid ${isAIPredictionActive ? '#ffeb3b' : '#333'}`, padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', cursor: 'pointer', transition: 'all 0.2s', boxShadow: isAIPredictionActive ? '0 0 10px rgba(255,235,59,0.3)' : 'none' }}>AI予測</button>
          </div>
        </div>
        <div ref={chartRef} style={{ width: '100%', height: '240px' }}></div>
      </div>

      <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838', flex: 1 }}>
        {/* 🌟 隠しコマンド（4回タップで顔認証 / ダブルタップ）の仕掛けをここに設置 */}
        <div 
          onClick={() => {
            if (onQuadTap) onQuadTap();
            handleHeaderDoubleTap();
          }}
          title="TAP 4 TIMES TO OVERRIDE"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #252838', paddingBottom: '10px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px', cursor: 'pointer' }}
        >
          <h2 style={{ fontSize: '16px', margin: 0, color: '#fff', fontFamily: 'monospace', pointerEvents: 'none' }}>接続済みデータカートリッジ(現在高)</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto' }}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const next = cardMode === 'remain' ? 'used' : 'remain';
                setCardMode(next);
                localStorage.setItem('m402_card_mode', next);
              }}
              style={{ background: '#11141a', color: cardMode === 'remain' ? '#00ff66' : '#ff3366', border: `1px solid ${cardMode === 'remain' ? '#00ff66' : '#ff3366'}`, padding: '5px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', boxShadow: cardMode === 'remain' ? '0 0 10px rgba(0,255,102,0.1)' : '0 0 10px rgba(255,51,102,0.1)' }}
            >
              {cardMode === 'remain' ? '枠表示' : '利用額表示'}
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); openNodeManager(); }}
              style={{ background: '#0a0c10', color: '#00bfff', border: '1px solid #00bfff', padding: '5px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 0 10px rgba(0,191,255,0.2)' }}
            >
              口座管理
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); setIsRecycleModalOpen(true); }}
              style={{ background: recycledAccounts.length > 0 ? '#00ff6622' : '#1a1d24', color: recycledAccounts.length > 0 ? '#00ff66' : '#888', border: `1px solid ${recycledAccounts.length > 0 ? '#00ff66' : '#333'}`, padding: '5px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', boxShadow: recycledAccounts.length > 0 ? '0 0 10px rgba(0,255,102,0.2)' : 'none' }}
            >
              復元 ({recycledAccounts.length})
            </button>
            <span style={{ fontSize: '11px', color: '#00bfff', fontFamily: 'monospace', pointerEvents: 'none' }}>TOTAL: ¥{visibleTotalBank.toLocaleString()}</span>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '15px' }}>
          {systemData.combined.map((item, idx) => {
            const isCard = item.type === 'card';
            const isDragging = reorderMode && dragData.current.currentIndex === idx;
            const isRoutingSource = routingMode && routingSource === item.name;
            const isRoutingTarget = routingMode && routingSource && routingSource !== item.name;
            const isSwiped = swipedAcc === item.name;
            
            let amountText, mainColor, percent, remain, isOver;
            if (isCard) {
              isOver = item.used > item.budget;
              if (cardMode === 'used') {
                amountText = `-¥${item.used.toLocaleString()}`;
                mainColor = '#ff3366';
                percent = item.budget > 0 ? Math.min(100, (item.used / item.budget) * 100) : (item.used > 0 ? 100 : 0);
              } else {
                remain = Math.max(0, item.budget - item.used);
                percent = item.budget > 0 ? Math.max(0, Math.min(100, (remain / item.budget) * 100)) : 0;
                mainColor = '#00ff66';
                if (percent <= 20 || isOver) mainColor = '#ff3366'; else if (percent <= 50) mainColor = '#ff9900';
                amountText = isOver ? 'OVER!' : `¥${remain.toLocaleString()}`;
              }
            } else {
              const bal = item.balance;
              percent = visibleTotalBank > 0 ? Math.min(100, Math.max(0, (bal / visibleTotalBank) * 100)) : 0;
              const isNegative = bal < 0;
              mainColor = isNegative ? '#ff3366' : '#00bfff';
              amountText = `¥${bal.toLocaleString()}`;
            }

            return (
              <div key={item.name} style={{ position: 'relative', overflow: 'hidden', borderRadius: '6px' }}>
                
                {/* 🌟 スワイプアクションボタン（文字化 & 精算/棚卸しボタン追加） */}
                <div style={{ position: 'absolute', top: 0, right: 0, height: '100%', display: 'flex', zIndex: 0 }}>
                  {isCard ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenResetModal(item); }} 
                      style={{ background: '#00ff66', color: '#000', border: 'none', padding: '0 10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      精算
                    </button>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); openAuditModal(item.name); }} 
                      style={{ background: '#00bfff', color: '#000', border: 'none', padding: '0 10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      棚卸
                    </button>
                  )}
                  <button 
                    onClick={(e) => openEditFromSwipe(e, item)} 
                    style={{ background: '#333', color: '#fff', border: 'none', padding: '0 10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    設定
                  </button>
                  <button 
                    onClick={(e) => deleteFromSwipe(e, item)} 
                    style={{ background: '#ff3366', color: '#fff', border: 'none', padding: '0 10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    削除
                  </button>
                </div>

                <div className={reorderMode && !isDragging ? 'shake' : 'account-cartridge'}
                     onPointerDown={(e) => { if (!reorderMode && !routingMode) handlePointerDown(); }} 
                     onPointerUp={(e) => { if (!reorderMode) cancelPress(); else handleDragEnd(); }} 
                     onPointerLeave={(e) => { if (!reorderMode) cancelPress(); else handleDragEnd(); }}
                     onTouchStart={(e) => handleTouchStart(e, idx)} 
                     onTouchMove={(e) => handleTouchMove(e, systemData.combined, item.name)} 
                     onTouchEnd={handleDragEnd}
                     onClick={(e) => handleCartridgeClick(e, item.name)}
                     style={{ background: isRoutingSource ? '#ff336611' : '#0a0c10', border: `1px solid ${isRoutingSource ? '#ff3366' : (isRoutingTarget ? '#00bfff55' : '#252838')}`, borderRadius: '6px', padding: '15px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '85px', cursor: 'pointer', touchAction: reorderMode ? 'none' : 'pan-y', transform: isDragging ? `translateY(${dragOffset}px) scale(1.05)` : (isSwiped ? 'translateX(-120px)' : 'translateX(0)'), zIndex: isDragging ? 100 : 1, boxShadow: isDragging ? '0 10px 30px rgba(255, 255, 255, 0.2)' : (isRoutingSource ? '0 0 20px rgba(255,51,102,0.3)' : 'none'), transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.2s, background 0.2s', opacity: (routingMode && routingSource && routingSource !== item.name) ? 0.7 : 1 }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    {(() => {
                      const { icon, name: cleanName } = getAccountDisplay(item.name);
                      return (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isCard ? '#ff9900' : '#00bfff', fontSize: '13px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {icon ? (
                            <img src={icon} alt="" style={{ width: '18px', height: '18px', objectFit: 'contain', pointerEvents: 'none', flexShrink: 0 }} />
                          ) : (
                            <span style={{ fontSize: '10px', padding: '2px 4px', borderRadius: '3px', background: isCard ? 'rgba(255,153,0,0.2)' : 'rgba(0,191,255,0.2)', color: isCard ? '#ff9900' : '#00bfff', fontFamily: 'monospace' }}>
                              {isCard ? 'CRD' : 'BNK'}
                            </span>
                          )}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanName}</span>
                        </span>
                      );
                    })()}
                    <span style={{ color: '#666', fontSize: '11px', fontFamily: 'monospace', flexShrink: 0 }}>
                      {percent.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div style={{ color: mainColor, fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right', textShadow: isCard ? `0 0 10px ${mainColor}44` : 'none', marginTop: 'auto', paddingBottom: '4px' }}>
                    {amountText}
                  </div>

                  <div style={{ position: 'absolute', bottom: 0, left: 0, height: '3px', width: '100%', background: '#1a1d24' }}>
                    <div className="energy-bar" style={{ height: '100%', width: `${percent}%`, background: mainColor, boxShadow: `0 0 8px ${mainColor}` }}></div>
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
        @keyframes fadeInDown { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
    </div>
  );
}