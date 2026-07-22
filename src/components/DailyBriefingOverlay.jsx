import React, { useState, useEffect, useRef } from 'react';

export default function DailyBriefingOverlay({ transactions, ghostAccounts, onComplete }) {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [isTyping, setIsTyping] = useState(true);
  
  // 🌟 音声設定の保存・読み込み
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => {
    return localStorage.getItem('briefingVoice') !== 'false'; // デフォルトはON
  });
  const speechTextRef = useRef('');

  // 音声を読み上げるハッカー関数
  const speakReport = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // 前の音声をリセット
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.15; // 少し早口でAIっぽく
    utterance.pitch = 0.95; // 少し低めの落ち着いた声
    window.speechSynthesis.speak(utterance);
  };

  // 途中でスキップされたら音声を止める
  const handleComplete = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    onComplete();
  };

  const toggleVoice = (e) => {
    e.stopPropagation(); // 画面タップ（スキップ）を防止
    const nextState = !isVoiceEnabled;
    setIsVoiceEnabled(nextState);
    localStorage.setItem('briefingVoice', nextState);
    
    if (nextState) {
      speakReport(speechTextRef.current);
    } else {
      window.speechSynthesis.cancel();
    }
  };

  useEffect(() => {
    // 🌟 1. データの事前計算（プロファイリング）
    const creditSettings = JSON.parse(localStorage.getItem('creditCardSettings') || '{}');
    let totalBank = 0;
    let monthlyOutflow = 0;
    let alerts = [];
    let speechAlerts = []; // 読み上げ用のテキスト

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    transactions.forEach(tx => {
      if (!tx.date) return;
      const txDate = tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
      const amount = Number(tx.amount) || 0;
      const method = tx.paymentMethod || '不明';

      if (!ghostAccounts.includes(method) && !creditSettings[method]) {
        if (tx.type === 'income') totalBank += amount;
        else if (tx.type === 'expense') totalBank -= amount;
      }

      if (tx.type === 'expense' && txDate >= thisMonthStart && !ghostAccounts.includes(method)) {
        monthlyOutflow += amount;
      }
    });

    Object.keys(creditSettings).forEach(card => {
      if (ghostAccounts.includes(card)) return;
      const data = creditSettings[card];
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
        speechAlerts.push(`警告。${card}の使用率が、${Math.round(ratio * 100)}パーセントを超過しています。`);
      }
    });

    if (alerts.length === 0) {
      alerts.push("システムに異常なし。クレジットカードのHPは安定しています。");
    }
    if (monthlyOutflow > 100000) {
      alerts.push("[NOTICE] 今月の流出ペースが激しいです。資金枯渇に注意してください。");
      speechAlerts.push("お知らせ。今月の資金流出ペースが警告レベルです。注意してください。");
    }

    const hour = now.getHours();
    let greeting = "GOOD MORNING";
    let jpGreeting = "おはようございます";
    if (hour >= 12 && hour < 18) { greeting = "GOOD AFTERNOON"; jpGreeting = "こんにちは"; }
    else if (hour >= 18) { greeting = "GOOD EVENING"; jpGreeting = "こんばんは"; }

    // 🌟 2. 読み上げ用スクリプトの構築（重要なところだけ抽出）
    const finalSpeech = `${jpGreeting}、オペレーター。現在の純資産は、${totalBank}円。今月の総流出額は、${monthlyOutflow}円です。${speechAlerts.join('。')}本日も、ミッションを遂行してください。`;
    speechTextRef.current = finalSpeech;

    // 音声がONなら喋らせる（※ブラウザの自動再生ブロック回避のため、テストボタンからの起動時は確実に鳴ります）
    if (isVoiceEnabled) {
      speakReport(finalSpeech);
    }

    // 🌟 3. ターミナルに表示するシナリオスクリプト
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

    // 🌟 4. タイプライター演出
    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < script.length) {
        setDisplayedLines(prev => [...prev, script[currentLine]]);
        currentLine++;
        if (navigator.vibrate) navigator.vibrate(10);
      } else {
        clearInterval(interval);
        setIsTyping(false);
        setTimeout(() => {
          handleComplete(); // 自動で閉じる
        }, 3000);
      }
    }, 400);

    return () => {
      clearInterval(interval);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <div 
      onClick={handleComplete} 
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: '#050608', color: '#00ff66', fontFamily: 'monospace',
        zIndex: 99999, padding: '30px', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer'
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,102,0.05) 2px, rgba(0,255,102,0.05) 4px)', pointerEvents: 'none' }} />
      
      {/* 🌟 音声トグルボタン */}
      <button 
        onClick={toggleVoice}
        style={{
          position: 'absolute', top: '20px', right: '20px', zIndex: 10,
          background: isVoiceEnabled ? 'rgba(0,255,102,0.1)' : 'rgba(0,0,0,0.5)',
          border: `1px solid ${isVoiceEnabled ? '#00ff66' : '#555'}`,
          color: isVoiceEnabled ? '#00ff66' : '#555',
          padding: '6px 12px', borderRadius: '4px', fontSize: '12px',
          fontWeight: 'bold', fontFamily: 'monospace', cursor: 'pointer',
          boxShadow: isVoiceEnabled ? '0 0 10px rgba(0,255,102,0.3)' : 'none',
          transition: 'all 0.2s'
        }}
      >
        {isVoiceEnabled ? '🔈 VOICE: ON' : '🔇 VOICE: OFF'}
      </button>

      <div style={{ textShadow: '0 0 8px rgba(0,255,102,0.6)', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', lineHeight: '1.4', marginTop: '40px' }}>
        {displayedLines.map((line, index) => (
          <div key={index} style={{ animation: 'fadeIn 0.2s ease-out' }}>
            {line === " " ? <br /> : `> ${line}`}
          </div>
        ))}
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