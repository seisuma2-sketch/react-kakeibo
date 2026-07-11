import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function CategoryChart({ transactions }) {
  // 💡 React公認の裏口（グラフを描画するキャンバスの場所を確保する魔法）
  const chartRef = useRef(null);

  useEffect(() => {
    // 1️⃣ 渡された履歴データから、カテゴリごとの「支出」だけを計算する
    const categories = {};
    transactions.forEach(tx => {
      if (tx.type === 'expense') {
        const cat = tx.category || 'その他';
        categories[cat] = (categories[cat] || 0) + (tx.amount || 0);
      }
    });

    const catKeys = Object.keys(categories);
    const catValues = Object.values(categories);
    const maxVal = Math.max(...catValues, 1000); // 最大値の基準

    const radarIndicators = catKeys.length > 0 
      ? catKeys.map(k => ({ name: k, max: maxVal }))
      : [{ name: 'データなし', max: 100 }];

    // 2️⃣ EChartsをキャンバスに初期化
    const chartInstance = echarts.init(chartRef.current);

    // 3️⃣ サイバーデザインの設定
    const option = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', backgroundColor: 'rgba(0,0,0,0.8)', borderColor: '#00ff66', textStyle: { color: '#fff' } },
      radar: {
        indicator: radarIndicators,
        shape: 'polygon',
        axisName: { color: '#00ff66', fontWeight: 'bold' },
        splitLine: { lineStyle: { color: ['rgba(0, 255, 102, 0.1)', 'rgba(0, 255, 102, 0.4)'].reverse() } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: 'rgba(0, 255, 102, 0.5)' } }
      },
      series: [{
        name: 'カテゴリ内訳',
        type: 'radar',
        data: [{ value: catValues, name: '支出' }],
        itemStyle: { color: '#00ff66' },
        lineStyle: { width: 2, shadowColor: '#00ff66', shadowBlur: 10 },
        areaStyle: { color: 'rgba(0, 255, 102, 0.3)' }
      }]
    };

    chartInstance.setOption(option);

    // ウィンドウのサイズが変わったらグラフもリサイズする処理
    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);

    // 🧹 クリーンアップ処理（この部品が消えるときにグラフも綺麗に破壊する）
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.dispose();
    };

  }, [transactions]); // 👈 魔法のポイント：transactions（データ）が変わるたびにグラフを自動で描き直す！

  return (
    <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838', height: '100%' }}>
      <h2 style={{ fontSize: '18px', borderBottom: '1px solid #252838', paddingBottom: '10px', marginTop: 0, color: '#fff' }}>
        カテゴリ別支出比率
      </h2>
      {/* 👇 ここが useRef で確保したグラフ用のキャンバス！ */}
      <div ref={chartRef} style={{ width: '100%', height: '300px' }}></div>
    </div>
  );
}