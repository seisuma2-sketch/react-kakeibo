import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

// 🌟 isStealthMode などの怪しい受け取り口は削除。ただデータを受け取るだけ！
export default function BalanceChart({ transactions }) {
  const chartRef = useRef(null);

  const chronologicalTx = [...transactions].reverse();
  let currentTotalForChart = 0;
  const dateLabels = [];
  const balanceData = [];

  chronologicalTx.forEach(tx => {
    if (!tx.date) return;
    const dateStr = tx.date.toDate().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
    if (tx.type === 'income') currentTotalForChart += (tx.amount || 0);
    if (tx.type === 'expense') currentTotalForChart -= (tx.amount || 0);
    
    dateLabels.push(dateStr);
    balanceData.push(currentTotalForChart);
  });

  const balances = {};
  let totalAssets = 0;

  transactions.forEach(tx => {
    const amount = Number(tx.amount) || 0;
    const method = tx.paymentMethod || '不明';
    const category = tx.category || '不明'; 

    if (!balances[method]) balances[method] = 0;

    if (tx.type === 'income') {
      balances[method] += amount;
      totalAssets += amount;
    } else if (tx.type === 'expense') {
      balances[method] -= amount;
      totalAssets -= amount; 
    } else if (tx.type === 'transfer') {
      if (!balances[category]) balances[category] = 0;
      balances[method] -= amount;
      balances[category] += amount;
    }
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
  }, [transactions]);

  const sortedBalances = Object.entries(balances).sort((a, b) => b[1] - a[1]);

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
          {sortedBalances.map(([name, amount]) => {
            const percent = totalAssets > 0 ? Math.min(100, Math.max(0, (amount / totalAssets) * 100)) : 0;
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
                
                {/* 🌟 普通に金額を表示するだけ！ */}
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