import React, { useEffect, useState, useMemo } from 'react';

export default function DailyBriefingOverlay({ transactions = [], ghostAccounts = [], onComplete }) {
  const [displayedText, setDisplayedText] = useState([]);
  const [isTypingDone, setIsTypingDone] = useState(false);

  // 🌟 分析ロジック：昨日・今月・引き落としアラートの解析
  const briefingData = useMemo(() => {
    const now = new Date();
    
    // 1. 昨日の日付範囲（00:00:00 〜 23:59:59）
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);

    let yesterdayTotal = 0;
    const yesterdayCats = {};

    // 2. 今月の集計用
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = Math.max(1, daysInMonth - now.getDate() + 1);
    let thisMonthExpense = 0;

    transactions.forEach(tx => {
      if (!tx.date) return;
      const txDate = tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
      const amt = Number(tx.amount) || 0;
      const method = tx.paymentMethod || '';

      if (ghostAccounts.includes(method)) return;

      // 昨日の支出
      if (txDate >= yesterdayStart && txDate <= yesterdayEnd && tx.type === 'expense') {
        yesterdayTotal += amt;
        const cat = tx.category || 'その他';
        yesterdayCats[cat] = (yesterdayCats[cat] || 0) + amt;
      }

      // 今月の支出
      if (txDate >= thisMonthStart && tx.type === 'expense') {
        thisMonthExpense += amt;
      }
    });

    // 昨日の最多支出カテゴリ
    let topCat = 'なし';
    let maxCatAmt = 0;
    Object.entries(yesterdayCats).forEach(([cat, amt]) => {
      if (amt > maxCatAmt) {
        maxCatAmt = amt;
        topCat = cat;
      }
    });

    // 今日の推奨使用可能リミット（今月予算目安: 90,000円から逆算、または残り日数割）
    const monthlyTarget = 90000;
    const remainingBudget = Math.max(0, monthlyTarget - thisMonthExpense);
    const todayLimit = Math.round(remainingBudget / remainingDays);

    // 引き落とし・警告アラートの検知
    const creditSettings = JSON.parse(localStorage.getItem('creditCardSettings') || '{}');
    const threats = [];
    const todayDate = now.getDate();

    Object.entries(creditSettings).forEach(([cardName, config]) => {
      const payDay = Number(config.paymentDay) || 27;
      const diff = payDay - todayDate;
      if (diff >= 0 && diff <= 4) {
        threats.push(`💳 ${cardName}の引き落とし（${payDay}日）まであと ${diff === 0 ? '本日です！' : diff + ' 日'} `);
      }
    });

    return {
      yesterdayTotal,
      topCat,
      todayLimit,
      threats,
      thisMonthExpense
    };
  }, [transactions, ghostAccounts]);

  // 🌟 タイプライター演出の組み立て
  useEffect(() => {
    const lines = [
      { text: "🤖 SYSTEM BRIEFING // J.A.R.V.I.S. PROTOCOL ONLINE", color: "#00ff66", type: "header" },
      { text: `[1/4 YESTERDAY'S LOG]`, color: "#00bfff", type: "title" },
      briefingData.yesterdayTotal > 0 
        ? { text: `昨日の資金流出: ¥${briefingData.yesterdayTotal.toLocaleString()} （主出費: ${briefingData.topCat}）`, color: "#ff3366", type: "body" }
        : { text: "昨日の資金流出: ¥0 （見事な防衛戦でした。流出ゼロを維持）", color: "#00ff66", type: "body" },
      
      { text: `[2/4 TODAY'S MISSION]`, color: "#00bfff", type: "title" },
      { text: `残日数から算出した本日の推奨使用上限: ¥${briefingData.todayLimit.toLocaleString()}`, color: "#ff9900", type: "body" },

      { text: `[3/4 THREAT DETECTION]`, color: "#00bfff", type: "title" },
      ...(briefingData.threats.length > 0 
        ? briefingData.threats.map(t => ({ text: `⚠️ WARNING: ${t}`, color: "#ff3366", type: "body" }))
        : [{ text: "現在、直近で差し迫った口座引き落とし・異常流出は検出されていません。", color: "#888", type: "body" }]
      ),

      { text: `[4/4 SYSTEM STATUS]`, color: "#00bfff", type: "title" },
      { text: "全セキュリティプロトコル稼働中。本日も良い一日を。", color: "#00ff66", type: "body" }
    ];

    let lineIndex = 0;
    const interval = setInterval(() => {
      if (lineIndex < lines.length) {
        const nextLine = lines[lineIndex];
        setDisplayedText(prev => [...prev, nextLine]);
        lineIndex++;
      } else {
        setIsTypingDone(true);
        clearInterval(interval);
      }
    }, 400); // 0.4秒ごとに行が追加される

    return () => clearInterval(interval);
  }, [briefingData]);

  const handleAcknowledge = () => {
    if (navigator.vibrate) navigator.vibrate([50, 50]);
    onComplete();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 6, 8, 0.95)',
      backdropFilter: 'blur(10px)',
      zIndex: 999999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      boxSizing: 'border-box',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        background: '#0a0c10',
        border: '1px solid #00ff66',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '420px',
        padding: '25px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        boxShadow: '0 0 40px rgba(0,255,102,0.25)',
        fontFamily: 'monospace'
      }}>
        {/* ヘッダー・インジケーター */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #00ff6644', paddingBottom: '10px' }}>
          <div style={{ color: '#00ff66', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
            DAILY BRIEFING LOG
          </div>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ff66', boxShadow: '0 0 8px #00ff66', animation: 'pulse 1.5s infinite' }} />
        </div>

        {/* ターミナル表示ログテキスト */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '260px', overflowY: 'auto' }}>
          {displayedText.map((item, idx) => (
            <div 
              key={idx} 
              style={{ 
                color: item.color, 
                fontSize: item.type === 'header' ? '13px' : (item.type === 'title' ? '11px' : '13px'),
                fontWeight: item.type === 'body' ? 'bold' : 'normal',
                marginTop: item.type === 'title' ? '6px' : '0px',
                lineHeight: '1.4',
                animation: 'slideInText 0.2s ease-out'
              }}
            >
              {item.type === 'body' && <span style={{ opacity: 0.5, marginRight: '6px' }}>&gt;</span>}
              {item.text}
            </div>
          ))}
        </div>

        {/* 承認（閉じる）ボタン */}
        <button
          onClick={handleAcknowledge}
          disabled={!isTypingDone}
          style={{
            marginTop: '10px',
            padding: '14px',
            background: isTypingDone ? '#00ff66' : '#222',
            color: isTypingDone ? '#000' : '#666',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '14px',
            fontFamily: 'monospace',
            cursor: isTypingDone ? 'pointer' : 'not-allowed',
            boxShadow: isTypingDone ? '0 0 20px rgba(0,255,102,0.4)' : 'none',
            transition: 'all 0.3s'
          }}
        >
          {isTypingDone ? '⚡ [ ACKNOWLEDGE // 了解 ]' : 'ANALYZING...'}
        </button>
      </div>

      <style>{`
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        @keyframes slideInText { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}