import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function CategoryBreakdown({ transactions, isStealthMode }) {
  const chartRef = useRef(null);

  // 1️⃣ カテゴリごとの「支出」の合計と、全体の総支出を計算する
  const categoryData = {};
  let totalExpense = 0;

  transactions.forEach(tx => {
    if (tx.type === 'expense') {
      const cat = tx.category || 'その他';
      const amount = Number(tx.amount) || 0;
      categoryData[cat] = (categoryData[cat] || 0) + amount;
      totalExpense += amount;
    }
  });

  // 2️⃣ 金額が多い順（降順）に並び替える
  const sortedCategories = Object.entries(categoryData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // 3️⃣ 円グラフ（ECharts）の描画
  useEffect(() => {
    const chartInstance = echarts.init(chartRef.current);

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: '#00bfff',
        textStyle: { color: '#fff' },
        formatter: (params) => {
          // ステルスモード中はツールチップの金額も隠す！
          const amountStr = isStealthMode ? '¥***' : `¥${params.value.toLocaleString()}`;
          return `${params.name}<br/><span style="color:#ff3366;font-weight:bold;">${amountStr}</span> (${params.percent}%)`;
        }
      },
      series: [
        {
          name: 'カテゴリ別支出',
          type: 'pie',
          radius: ['45%', '75%'], // 真ん中をくり抜いてドーナツ型にする魔法
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#11141a',
            borderWidth: 3
          },
          label: {
            show: true,
            color: '#aaa',
            formatter: '{b}\n{d}%', // 名前とパーセンテージを表示
            fontSize: 12
          },
          labelLine: {
            lineStyle: { color: '#555' }
          },
          data: sortedCategories.length > 0 ? sortedCategories : [{ name: 'データなし', value: 0 }]
        }
      ],
      // サイバー感あふれるカラーパレット
      color: ['#00ff66', '#00bfff', '#ff3366', '#b666ff', '#ffff00', '#ff8c00', '#00ced1']
    };

    chartInstance.setOption(option);
    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.dispose();
    };
  }, [transactions, isStealthMode]); // ステルスモードが切り替わったらグラフも再描画！

  return (
    <div style={{ display: 'flex', gap: '25px', minHeight: '80vh' }}>
      
      {/* 📊 左側：ドーナツ型円グラフ */}
      <div style={{ flex: 1, background: '#11141a', padding: '30px', borderRadius: '8px', border: '1px solid #252838' }}>
        <h2 style={{ fontSize: '20px', borderBottom: '1px solid #252838', paddingBottom: '15px', marginTop: 0, color: '#fff' }}>
          支出カテゴリ分析
        </h2>
        <div ref={chartRef} style={{ width: '100%', height: '400px', marginTop: '20px' }}></div>
      </div>

      {/* 📋 右側：ランキング形式の詳細リスト */}
      <div style={{ flex: 1, background: '#11141a', padding: '30px', borderRadius: '8px', border: '1px solid #252838' }}>
        <h2 style={{ fontSize: '20px', borderBottom: '1px solid #252838', paddingBottom: '15px', marginTop: 0, color: '#fff' }}>
          カテゴリ別 ランキング
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0 0' }}>
          {sortedCategories.length === 0 ? (
            <li style={{ color: '#888' }}>データがありません</li>
          ) : (
            sortedCategories.map((cat, index) => (
              <li key={cat.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px dashed #252838' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ color: '#555', fontSize: '14px', fontWeight: 'bold', width: '20px' }}>{index + 1}</span>
                  <span style={{ color: '#fff', fontSize: '16px' }}>{cat.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <span style={{ color: '#aaa', fontSize: '14px' }}>
                    {((cat.value / totalExpense) * 100).toFixed(1)}%
                  </span>
                  <span style={{ color: '#ff3366', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '18px', width: '100px', textAlign: 'right' }}>
                    {isStealthMode ? '¥***' : `-¥${cat.value.toLocaleString()}`}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

    </div>
  );
}