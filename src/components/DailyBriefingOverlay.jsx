import React, { useState, useEffect } from 'react';

export default function DailyBriefingOverlay({ transactions, ghostAccounts, onComplete }) {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    // 🌟 1. データの事前計算（プロファイリング）
    const creditSettings = JSON.parse(localStorage.getItem('creditCardSettings') || '{}');
    let totalBank = 0;
    let monthlyOutflow = 0;
    let alerts = [];

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 総資産と今月の出費を計算
    transactions.forEach(tx => {
      if (!tx.date) return;
      const txDate = tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
      const amount = Number(tx.amount) || 0;
      const method = tx.paymentMethod || '不明';

      if (!ghostAccounts.includes(method) && !creditSettings[method]) {
        if (tx.type === 'income') totalBank += amount;
        else if (tx.type === 'expense') totalBank -= amount;
        else if (tx.type === 'transfer' && !ghostAccounts.includes(tx.category)) {
          // 振替は総資産変動なし
        }
      }

      if (tx.type === 'expense' && txDate >= thisMonthStart && !ghostAccounts.includes(method)) {
        monthlyOutflow += amount;
      }
    });

    // クレジットカードの警告チェック
    Object.keys(creditSettings).forEach(card => {
      if (ghostAccounts.includes(card)) return;
      const data = creditSettings[card];
      // 簡易的な使用額計算（ここでは今月の出費でざっくり判定）
      let used = 0;
      transactions.forEach(tx => {
        if (tx.paymentMethod === card && tx.type === 'expense') {
          const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
          if (txDate >= thisMonthStart) used += (Number(tx.amount) || 0);
        }
      });
      const ratio = data.budget > 0 ? used / data.budget : 0;
      if (ratio > 0.8) {
        alerts.push(`[WARN] ${card} の使用率が${Math.round(ratio * 100)}%を超えています。`);
      }
    });

    if (alerts.length === 0) alerts.push("システムに異常なし。クレジットカードのHPは安定しています。");
    if (monthlyOutflow > 100000) alerts.push("[NOTICE] 今月の流出ペースが激しいです。資金枯渇に注意してください。");

    // 時間帯による挨拶の変更
    const hour = now.getHours();
    let greeting = "GOOD MORNING";
    if (hour >= 12 && hour < 18) greeting = "GOOD AFTERNOON";
    else if (hour >= 18) greeting = "GOOD EVENING";

    // 🌟 2. ターミナルに表示するシナリオスクリプト
    const script = [
      "SYSTEM BOOT SEQUENCE INITIATED...",
      "DECRYPTING MAINFRAME ENCRYPTION... [OK]",
      "CONNECTING TO NEBULA OS SATELLITE... [OK]",
      " ",
      `${greeting}, OPERATOR.`,
      `CURRENT TIME: ${now.toLocaleString('ja-JP')}`,
      " ",
      "--- [ FINANCIAL STATUS REPORT ] ---",
      `TOTAL ASSETS (純資産) : ¥${totalBank.toLocaleString()}`,
      `MONTHLY OUTFLOW (流出): -¥${monthlyOutflow.toLocaleString()}`,
      " ",
      "--- [ SYSTEM ANALYSIS ] ---",
      ...alerts,
      " ",
      "ALL SYSTEMS NOMINAL.",
      "HAVE A PRODUCTIVE DAY."
    ];

    // 🌟 3. タイプライター演出（時間をずらして行を表示）
    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < script.length) {
        setDisplayedLines(prev => [...prev, script[currentLine]]);
        currentLine++;
        if (navigator.vibrate) navigator.vibrate(10); // カタカタという触覚フィードバック
      } else {
        clearInterval(interval);
        setIsTyping(false);
        // 全て表示し終わったら3秒後に自動で閉じる
        setTimeout(() => {
          onComplete();
        }, 3000);
      }
    }, 400); // 1行あたり0.4秒の間隔

    return () => clearInterval(interval);
  }, [transactions, ghostAccounts, onComplete]);

  return (
    <div 
      onClick={onComplete} // タップでスキップ可能
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: '#050608', color: '#00ff66', fontFamily: 'monospace',
        zIndex: 99999, padding: '30px', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer'
      }}
    >
      {/* CRTモニターのスキャンライン演出 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,102,0.05) 2px, rgba(0,255,102,0.05) 4px)', pointerEvents: 'none' }} />
      
      {/* グロー効果付きのテキストコンテナ */}
      <div style={{ textShadow: '0 0 8px rgba(0,255,102,0.6)', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', lineHeight: '1.4' }}>
        {displayedLines.map((line, index) => (
          <div key={index} style={{ animation: 'fadeIn 0.2s ease-out' }}>
            {line === " " ? <br /> : `> ${line}`}
          </div>
        ))}
        {/* 点滅するカーソル */}
        {isTyping && <div style={{ animation: 'blink 1s step-end infinite' }}>_</div>}
      </div>

      <div style={{ position: 'absolute', bottom: '20px', left: '0', width: '100%', textAlign: 'center', color: '#00ff6655', fontSize: '10px', zIndex: 2 }}>
        [ TAP ANYWHERE TO SKIP ]
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}