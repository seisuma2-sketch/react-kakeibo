import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

export default function BSPLStatement({ transactions, isStealthMode }) {
  const chartRef = useRef(null);

  // 🌟 ドリルダウン（展開）用のState
  const [isIncomeExpanded, setIsIncomeExpanded] = useState(false);
  const [isExpenseExpanded, setIsExpenseExpanded] = useState(false);

  // 1. 資産の部 (B/S) の計算
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

  const sortedBalances = Object.entries(balances)
    .filter(([, amount]) => amount !== 0)
    .sort((a, b) => b[1] - a[1]);

  // 2. 損益の部 (P/L) ＆ ドリルダウン用のカテゴリ別集計
  let totalIncome = 0;
  let totalExpense = 0;
  const incomeBreakdown = {};
  const expenseBreakdown = {};

  transactions.forEach(tx => {
    const amount = Number(tx.amount) || 0;
    const cat = tx.category || '不明';

    if (tx.type === 'income') {
      totalIncome += amount;
      incomeBreakdown[cat] = (incomeBreakdown[cat] || 0) + amount;
    } else if (tx.type === 'expense') {
      totalExpense += amount;
      expenseBreakdown[cat] = (expenseBreakdown[cat] || 0) + amount;
    }
  });

  const sortedIncomeBreakdown = Object.entries(incomeBreakdown).sort((a, b) => b[1] - a[1]);
  const sortedExpenseBreakdown = Object.entries(expenseBreakdown).sort((a, b) => b[1] - a[1]);

  const netIncome = totalIncome - totalExpense;

  // 3. 衛星レーダー型パーティクル・トラッカーの構築
  useEffect(() => {
    if (!chartRef.current || transactions.length === 0) return;

    const incomes = new Set();
    const accounts = new Set();
    const expenses = new Set();
    const nodeAmounts = {};
    const linesData = [];

    transactions.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      if (amount <= 0) return;

      const inId = `IN_${tx.category}`;
      const accId = `ACC_${tx.paymentMethod}`;
      const outId = `OUT_${tx.category}`;

      if (tx.type === 'income') {
        incomes.add(inId); accounts.add(accId);
        nodeAmounts[inId] = (nodeAmounts[inId] || 0) + amount;
        nodeAmounts[accId] = (nodeAmounts[accId] || 0) + amount;
      } else if (tx.type === 'expense') {
        accounts.add(accId); expenses.add(outId);
        nodeAmounts[accId] = (nodeAmounts[accId] || 0) + amount;
        nodeAmounts[outId] = (nodeAmounts[outId] || 0) + amount;
      }
    });

    const maxAmount = Math.max(...Object.values(nodeAmounts), 1);
    const nodes = [];
    const nodeCoords = {};

    const placeNodes = (idSet, xPos, color) => {
      const arr = Array.from(idSet);
      const step = 100 / (arr.length + 1);
      
      arr.forEach((id, index) => {
        const yPos = step * (index + 1);
        nodeCoords[id] = [xPos, yPos];
        const size = 15 + (nodeAmounts[id] / maxAmount) * 25; 

        nodes.push({
          name: id,
          value: [xPos, yPos],
          symbolSize: size,
          itemStyle: { color: color, shadowBlur: 20, shadowColor: color },
          label: {
            show: true,
            position: xPos === 10 ? 'right' : xPos === 90 ? 'left' : 'bottom',
            formatter: () => id.replace(/^(IN_|ACC_|OUT_)/, ''), 
            color: '#fff',
            fontSize: 11,
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: [2, 4],
            borderRadius: 4
          }
        });
      });
    };

    placeNodes(incomes, 10, '#00bfff');
    placeNodes(accounts, 50, '#00ff66');
    placeNodes(expenses, 90, '#ff3366');

    transactions.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      if (amount <= 0) return;

      let source, target, lineColor;
      if (tx.type === 'income') {
        source = `IN_${tx.category}`; target = `ACC_${tx.paymentMethod}`; lineColor = '#00bfff';
      } else if (tx.type === 'expense') {
        source = `ACC_${tx.paymentMethod}`; target = `OUT_${tx.category}`; lineColor = '#ff3366';
      }

      if (source && target && nodeCoords[source] && nodeCoords[target]) {
        const lineWidth = Math.max(1, (amount / maxAmount) * 8);
        linesData.push({
          coords: [ nodeCoords[source], nodeCoords[target] ],
          lineStyle: { color: lineColor, width: lineWidth, opacity: 0.15 },
          data: { sourceName: tx.category, targetName: tx.paymentMethod, amount: amount, type: tx.type }
        });
      }
    });

    const chartInstance = echarts.init(chartRef.current);
    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(10, 12, 16, 0.95)',
        borderColor: '#00ff66',
        textStyle: { color: '#fff' },
        formatter: (params) => {
          if (params.seriesType === 'lines') {
            const d = params.data.data;
            const prefix = d.type === 'income' ? '+' : '-';
            return `<div style="font-size:12px; color:#aaa;">軌道データ傍受</div>
                    <span style="color:#fff; font-weight:bold;">${d.sourceName} ➡️ ${d.targetName}</span><br/>
                    <span style="color:${d.type === 'income' ? '#00bfff' : '#ff3366'}; font-size:16px; font-weight:bold; font-family:monospace;">
                      ${prefix}¥${d.amount.toLocaleString()}
                    </span>`;
          }
          return `ノード通信量: ¥${nodeAmounts[params.data.name].toLocaleString()}`;
        }
      },
      xAxis: { type: 'value', show: false, min: 0, max: 100 },
      yAxis: { type: 'value', show: false, min: 0, max: 100, inverse: true }, 
      series: [
        { type: 'graph', coordinateSystem: 'cartesian2d', layout: 'none', z: 3, data: nodes },
        {
          type: 'lines', coordinateSystem: 'cartesian2d', z: 2,
          effect: { show: true, period: 4, trailLength: 0.5, symbol: 'arrow', symbolSize: 6, color: '#fff' },
          lineStyle: { curveness: 0.3 }, data: linesData
        }
      ]
    };

    chartInstance.setOption(option);
    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chartInstance.dispose(); };
  }, [transactions]);

  if (isStealthMode) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div style={{ color: '#ff3366', fontSize: '20px', letterSpacing: '5px' }}>[ CLASSIFIED DATA ]</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '30px', height: '100%' }}>
      
      {/* 🟦 左側：資産の部 (B/S) */}
      <div style={{ background: '#11141a', padding: '25px', borderRadius: '8px', border: '1px solid #252838', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#00bfff', borderBottom: '2px solid #00bfff', paddingBottom: '10px' }}>
          資産の部 (B/S)
        </h3>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sortedBalances.map(([name, amount]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px dashed #252838', fontSize: '14px' }}>
              <span style={{ color: '#aaa' }}>{name}</span>
              <span style={{ color: '#00ff66', fontFamily: 'monospace', fontWeight: 'bold' }}>
                ¥{amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '20px', borderTop: '2px solid #252838', marginTop: '10px' }}>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>総資産合計</span>
          <span style={{ color: '#00ff66', fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>
            ¥{totalAssets.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 🟥 右側：損益の部 (P/L) ＆ 衛星レーダー */}
      <div style={{ background: '#11141a', padding: '25px', borderRadius: '8px', border: '1px solid #252838', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#ff3366', borderBottom: '2px solid #ff3366', paddingBottom: '10px' }}>
          損益の部 (P/L) & 動的資金トラッカー
        </h3>
        
        <div style={{ display: 'flex', gap: '30px', marginBottom: '20px', alignItems: 'flex-start' }}>
          
          {/* 🌟 収益ブロック（クリックで展開！） */}
          <div style={{ flex: 1 }}>
            <div 
              onClick={() => setIsIncomeExpanded(!isIncomeExpanded)} 
              style={{ cursor: 'pointer', userSelect: 'none', padding: '10px', borderRadius: '6px', background: isIncomeExpanded ? '#00bfff11' : 'transparent', transition: 'all 0.2s', border: isIncomeExpanded ? '1px solid #00bfff55' : '1px solid transparent' }}
            >
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                全期間の総収益 (Revenue) <span style={{ color: '#00bfff', fontSize: '10px' }}>{isIncomeExpanded ? '▲' : '▼'} CLICK</span>
              </div>
              <div style={{ color: '#00bfff', fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                ¥{totalIncome.toLocaleString()}
              </div>
            </div>

            {/* 収益の内訳ツリー */}
            {isIncomeExpanded && (
              <div style={{ marginTop: '10px', padding: '15px', background: '#0a0c10', borderLeft: '2px solid #00bfff', borderRadius: '0 6px 6px 0', maxHeight: '150px', overflowY: 'auto' }}>
                <div style={{ fontSize: '10px', color: '#555', marginBottom: '10px', borderBottom: '1px dashed #252838', paddingBottom: '5px' }}>[ DATA DECRYPTED... ]</div>
                {sortedIncomeBreakdown.map(([cat, amt]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                    <span style={{ color: '#ccc' }}>└ {cat}</span>
                    <span style={{ color: '#00bfff', fontFamily: 'monospace' }}>¥{amt.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 🌟 費用ブロック（クリックで展開！） */}
          <div style={{ flex: 1 }}>
            <div 
              onClick={() => setIsExpenseExpanded(!isExpenseExpanded)} 
              style={{ cursor: 'pointer', userSelect: 'none', padding: '10px', borderRadius: '6px', background: isExpenseExpanded ? '#ff336611' : 'transparent', transition: 'all 0.2s', border: isExpenseExpanded ? '1px solid #ff336655' : '1px solid transparent' }}
            >
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                全期間の総費用 (Expense) <span style={{ color: '#ff3366', fontSize: '10px' }}>{isExpenseExpanded ? '▲' : '▼'} CLICK</span>
              </div>
              <div style={{ color: '#ff3366', fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                ¥{totalExpense.toLocaleString()}
              </div>
            </div>

            {/* 費用の内訳ツリー */}
            {isExpenseExpanded && (
              <div style={{ marginTop: '10px', padding: '15px', background: '#0a0c10', borderLeft: '2px solid #ff3366', borderRadius: '0 6px 6px 0', maxHeight: '150px', overflowY: 'auto' }}>
                <div style={{ fontSize: '10px', color: '#555', marginBottom: '10px', borderBottom: '1px dashed #252838', paddingBottom: '5px' }}>[ DATA DECRYPTED... ]</div>
                {sortedExpenseBreakdown.map(([cat, amt]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                    <span style={{ color: '#ccc' }}>└ {cat}</span>
                    <span style={{ color: '#ff3366', fontFamily: 'monospace' }}>¥{amt.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* 衛星レーダートラッカー */}
        <div style={{ flex: 1, position: 'relative', borderTop: '1px dashed #252838', paddingTop: '15px' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none', zIndex: 1 }}></div>
          <div style={{ color: '#00bfff', fontSize: '11px', position: 'absolute', top: '15px', left: '10%', transform: 'translateX(-50%)', fontWeight: 'bold', zIndex: 10 }}>[ INFLOW ]</div>
          <div style={{ color: '#00ff66', fontSize: '11px', position: 'absolute', top: '15px', left: '50%', transform: 'translateX(-50%)', fontWeight: 'bold', zIndex: 10 }}>[ CORE POOL ]</div>
          <div style={{ color: '#ff3366', fontSize: '11px', position: 'absolute', top: '15px', left: '90%', transform: 'translateX(-50%)', fontWeight: 'bold', zIndex: 10 }}>[ OUTFLOW ]</div>
          <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '250px', marginTop: '10px', zIndex: 5 }}></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '20px', borderTop: '2px solid #252838', marginTop: '10px' }}>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>純利益 (Net Income)</span>
          <span style={{ color: netIncome >= 0 ? '#00ff66' : '#ff3366', fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {netIncome >= 0 ? '+' : ''}¥{netIncome.toLocaleString()}
          </span>
        </div>
      </div>

    </div>
  );
}