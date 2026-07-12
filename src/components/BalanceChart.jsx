import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

// 🌟 ghostAccounts を受け取れるようにする！
export default function BalanceChart({ transactions, ghostAccounts = [] }) {
  const chartRef = useRef(null);

  // 1️⃣ 全取引データを使って、絶対に狂わない「真の残高（True Balance）」を計算する！
  const balances = {};
  transactions.forEach(tx => {
    const amount = Number(tx.amount) || 0;
    const method = tx.paymentMethod || '不明';
    const category = tx.category || '不明'; 

    if (!balances[method]) balances[method] = 0;

    if (tx.type === 'income') {
      balances[method] += amount;
    } else if (tx.type === 'expense') {
      balances[method] -= amount;
    } else if (tx.type === 'transfer') {
      if (!balances[category]) balances[category] = 0;
      balances[method] -= amount;
      balances[category] += amount;
    }
  });

  // 🌟 ここがキモ！「真の残高」を持ったまま、ゴースト口座のカードだけを消滅させる！
  const visibleBalances = Object.entries(balances)
    .filter(([name]) => !ghostAccounts.includes(name))
    .sort((a, b) => b[1] - a[1]);

  // グラフとパーセント計算用の「表示上の総資産（ゴースト口座を抜いた額）」
  const visibleTotalAssets = visibleBalances.reduce((sum, [, amount]) => sum + amount, 0);

  // 2️⃣ グラフ用の時系列データ計算
  const chronologicalTx = [...transactions].reverse();
  const runningBalances = {};
  const dateLabels = [];
  const balanceData = [];

  chronologicalTx.forEach(tx => {
    if (!tx.date) return;
    const dateStr = tx.date.toDate().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
    
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

    // 🌟 その時点での「表示可能な口座のみ」の合計を計算し直す
    let currentVisibleTotal = 0;
    for (const [accName, accBalance] of Object.entries(runningBalances)) {
      if (!ghostAccounts.includes(accName)) {
        currentVisibleTotal += accBalance;
      }
    }

    dateLabels.push(dateStr);
    balanceData.push(currentVisibleTotal);
  });

  useEffect(() => {
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
          return `${params[0].name}<br/>総資産: <span style="color:#00ff66;font-weight:bold;">¥${val}</span>`;
        }
      },
      grid: { left: '2%', right: '4%', bottom: '5%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: dateLabels, axisLine: { lineStyle: { color: 'rgba(0, 255, 102, 0.5)' } }, axisLabel: { color: '#aaa' } },
      yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }, axisLabel: { color: '#aaa' } },
      series: [
        {
          name: '総資産残高', type: 'line', smooth: true, data: balanceData,
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
  }, [transactions, ghostAccounts]); // 🌟 隠蔽設定が変わった時も再描画

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', height: '100%' }}>
      
      <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838' }}>
        <h2 style={{ fontSize: '18px', borderBottom: '1px solid #252838', paddingBottom: '10px', marginTop: 0, color: '#fff' }}>
          総合残高推移トレンド
        </h2>
        <div ref={chartRef} style={{ width: '100%', height: '300px', marginTop: '10px' }}></div>
      </div>

      <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838', flex: 1 }}>
        <h2 style={{ fontSize: '18px', borderBottom: '1px solid #252838', paddingBottom: '10px', marginTop: 0, color: '#fff', marginBottom: '20px' }}>
          接続済みデータカートリッジ (現在高)
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          {/* 🌟 フィルタリング済みの visibleBalances をマッピング */}
          {visibleBalances.map(([name, amount]) => {
            const percent = visibleTotalAssets > 0 ? Math.min(100, Math.max(0, (amount / visibleTotalAssets) * 100)) : 0;
            const isNegative = amount < 0;

            return (
              <div 
                key={name} 
                className="account-cartridge"
                style={{ 
                  background: '#0a0c10', 
                  border: '1px solid #252838', 
                  borderRadius: '6px', 
                  padding: '20px', 
                  position: 'relative', 
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ color: '#00bfff', fontSize: '14px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                  <span>💽 {name}</span>
                  <span style={{ color: '#555', fontSize: '12px' }}>{percent.toFixed(1)}%</span>
                </div>
                
                <div style={{ color: isNegative ? '#ff3366' : '#fff', fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right' }}>
                  ¥{amount.toLocaleString()}
                </div>

                <div style={{ position: 'absolute', bottom: 0, left: 0, height: '4px', width: '100%', background: '#1a1d24' }}>
                  <div className="energy-bar" style={{ 
                    height: '100%', 
                    width: `${percent}%`, 
                    background: isNegative ? '#ff3366' : '#00bfff',
                    boxShadow: isNegative ? '0 0 10px #ff3366' : '0 0 10px #00bfff'
                  }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .account-cartridge { transition: all 0.3s ease; }
        .account-cartridge:hover { transform: translateY(-5px); border-color: #00bfff !important; box-shadow: 0 5px 15px rgba(0, 191, 255, 0.2); }
        .energy-bar { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }
      `}</style>
    </div>
  );
}