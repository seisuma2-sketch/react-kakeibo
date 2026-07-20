import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as echarts from 'echarts';

// 🌟 クレジットカードの更新日から今月の開始・終了日時を割り出すエンジン
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

export default function BalanceChart({ transactions = [], ghostAccounts = [] }) {
  const chartRef = useRef(null);
  const [now, setNow] = useState(new Date());

  // 1分ごとに時計を動かし、日付が変わった瞬間のリセットを検知する
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 🌟 名前と画像パスを自動で結びつける対応表（辞書）
  const iconMap = {
    '現金': '/icon-cash.png',
    '三井住友銀行': '/icon-smbc.png',
    '三菱UFJ銀行': '/icon-mufg.png',
    'ゆうちょ銀行': '/icon-yucho.png',
    'PayPay': '/icon-paypay.png',
    'EVERING': '/icon-evering.png',
    '食費': '/icon-food.png',
    'リクルートカード': '/icon-other.png'
  };

  // 🌟 核心：グラフ用の計算 ＆ クレジットカードのサイクル計算を一網打尽にするマルチエンジン
  const systemData = useMemo(() => {
    // ローカルから最新のカード設定を取得
    const creditSettings = JSON.parse(localStorage.getItem('creditCardSettings') || '{}');
    
    const cardData = {};
    Object.keys(creditSettings).forEach(name => {
      if (ghostAccounts.includes(name)) return;
      cardData[name] = { ...creditSettings[name], used: 0 };
    });

    const finalBalances = {};
    const chronologicalTx = [...transactions].reverse();
    const runningBalances = {};
    const dLabels = [];
    const bData = [];

    // 1️⃣ グラフ用の時系列データ と 最終残高の同時計算
    chronologicalTx.forEach(tx => {
      if (!tx.date) return;
      const txDate = tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
      const dateStr = txDate.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
      
      const amount = Number(tx.amount) || 0;
      const method = tx.paymentMethod || '不明';
      const category = tx.category || '不明';

      if (!runningBalances[method]) runningBalances[method] = 0;

      if (tx.type === 'income') {
        runningBalances[method] += amount;
      } else if (tx.type === 'expense') {
        runningBalances[method] -= amount;
      } else if (tx.type === 'transfer') {
        if (!runningBalances[category]) runningBalances[category] = 0;
        runningBalances[method] -= amount;
        runningBalances[category] += amount;
      }

      // グラフの縦軸（ゴースト口座を除外したその時点の総資産）
      let currentVisibleTotal = 0;
      for (const [accName, accBalance] of Object.entries(runningBalances)) {
        if (!ghostAccounts.includes(accName)) {
          currentVisibleTotal += accBalance;
        }
      }
      dLabels.push(dateStr);
      bData.push(currentVisibleTotal);
    });

    // 2️⃣ クレジットカードの「今サイクル内」の使用額を精密に計算
    transactions.forEach(tx => {
      if (!tx.date || tx.type !== 'expense') return;
      const txDate = tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
      const method = tx.paymentMethod || '不明';

      if (cardData[method]) {
        const bounds = getCycleBounds(cardData[method].resetDay, now);
        if (txDate >= bounds.startDate && txDate <= bounds.endDate) {
          cardData[method].used += Number(tx.amount) || 0;
        }
      }
    });

    // 3️⃣ 一般口座だけの残高を抽出（全期間の計算結果からカードとゴーストを除外）
    // 最終的な runningBalances（ループ終了時の一番最新の状態）を使用
    const bankData = {};
    let totalBank = 0;
    Object.entries(runningBalances).forEach(([name, bal]) => {
      if (ghostAccounts.includes(name)) return;
      if (cardData[name]) return; // クレジットカードは除外
      bankData[name] = bal;
      totalBank += bal;
    });

    return {
      cards: cardData,
      banks: bankData,
      totalBankBalance: totalBank,
      dateLabels: dLabels,
      balanceData: bData
    };
  }, [transactions, ghostAccounts, now]);

  // 🌟 EChartsグラフの描画処理（完全に復活）
  useEffect(() => {
    if (!chartRef.current) return;
    const chartInstance = echarts.init(chartRef.current);
    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: '#00ff66',
        textStyle: { color: '#fff' },
        formatter: function (params) {
          const val = params[0].value.toLocaleString();
          return `${params[0].name}<br/>表示総資産: <span style="color:#00ff66;font-weight:bold;">¥${val}</span>`;
        }
      },
      grid: { left: '2%', right: '4%', bottom: '5%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: systemData.dateLabels, axisLine: { lineStyle: { color: 'rgba(0, 255, 102, 0.5)' } }, axisLabel: { color: '#aaa' } },
      yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }, axisLabel: { color: '#aaa' } },
      series: [
        {
          name: '総資産残高', type: 'line', smooth: true, data: systemData.balanceData,
          itemStyle: { color: '#00ff66' },
          lineStyle: { width: 3, shadowColor: '#00ff66', shadowBlur: 10 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0, 255, 102, 0.4)' },
              { offset: 1, color: 'rgba(0, 255, 102, 0.0)' }
            ])
          }
        }
      ]
    };
    chartInstance.setOption(option);
    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chartInstance.dispose(); };
  }, [systemData]);

  const formatDate = (date) => `${date.getMonth() + 1}/${date.getDate()}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', height: '100%' }}>
      
      {/* 🚀 セクション1：グラフ（完全維持） */}
      <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838' }}>
        <h2 style={{ fontSize: '18px', borderBottom: '1px solid #252838', paddingBottom: '10px', marginTop: 0, color: '#fff', fontFamily: 'monospace', letterSpacing: '1px' }}>
          📈 📊 総合残高推移トレンド
        </h2>
        <div ref={chartRef} style={{ width: '100%', height: '240px', marginTop: '10px' }}></div>
      </div>

      {/* 🚀 セクション2：クレジットカード残枠（HPゲージ） */}
      {Object.keys(systemData.cards).length > 0 && (
        <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838' }}>
          <h2 style={{ fontSize: '16px', borderBottom: '1px solid #252838', paddingBottom: '10px', marginTop: 0, color: '#ff9900', marginBottom: '20px', fontFamily: 'monospace' }}>
            💳 CREDIT CARD HP // クレジット残枠
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            {Object.entries(systemData.cards).map(([name, data]) => {
              const bounds = getCycleBounds(data.resetDay, now);
              const remain = Math.max(0, data.budget - data.used);
              const isOver = data.used > data.budget;
              const percent = data.budget > 0 ? Math.max(0, Math.min(100, (remain / data.budget) * 100)) : 0;

              let barColor = '#00ff66';
              if (percent <= 20 || isOver) barColor = '#ff3366';
              else if (percent <= 50) barColor = '#ff9900';

              return (
                <div key={name} className="account-cartridge" style={{ background: '#0a0c10', border: '1px solid #252838', borderRadius: '6px', padding: '15px 20px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ color: '#ff9900', fontSize: '14px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {iconMap[name] ? <img src={iconMap[name]} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} /> : <span style={{ fontSize: '18px' }}>💳</span>}
                      <span>{name}</span>
                    </span>
                    <span style={{ color: '#666', fontSize: '10px', fontFamily: 'monospace' }}>
                      {formatDate(bounds.startDate)}-{formatDate(bounds.endDate)}
                    </span>
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

      {/* 🚀 セクション3：一般口座（データカートリッジ） */}
      <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #252838', paddingBottom: '10px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', marginTop: 0, color: '#00bfff', fontFamily: 'monospace' }}>
            🏦 BANK ACCOUNTS // 資金残高
          </h2>
          <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>TOTAL: ¥{systemData.totalBankBalance.toLocaleString()}</span>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          {Object.entries(systemData.banks).sort((a, b) => b[1] - a[1]).map(([name, amount]) => {
            const percent = systemData.totalBankBalance > 0 ? Math.min(100, Math.max(0, (amount / systemData.totalBankBalance) * 100)) : 0;
            const isNegative = amount < 0;

            return (
              <div key={name} className="account-cartridge" style={{ background: '#0a0c10', border: '1px solid #252838', borderRadius: '6px', padding: '20px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ color: '#00bfff', fontSize: '14px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {iconMap[name] ? <img src={iconMap[name]} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} /> : <span style={{ fontSize: '18px' }}>💽</span>}
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
        .account-cartridge { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .account-cartridge:hover { transform: translateY(-4px); border-color: #00bfff !important; box-shadow: 0 4px 20px rgba(0, 191, 255, 0.15); }
        .energy-bar { animation: pulse 2.5s infinite ease-in-out; transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
      `}</style>
    </div>
  );
}