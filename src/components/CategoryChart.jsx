import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { getCleanItemName, getCleanAccountName, isGhostAccount } from '../utils/accountUtils';

export default function CategoryChart({ transactions = [], ghostAccounts = [], cyclePeriod = null }) {
  // 💡 React公認の裏口（グラフを描画するキャンバスの場所を確保する魔法）
  const chartRef = useRef(null);

  useEffect(() => {
    // 1️⃣ 渡された履歴データから、カテゴリごとの「支出」だけを計算する（アイコンパスや表記揺れを完全正規化）
    // 🌟 隠し口座での支出、隠し口座への振替、偽装ブリッジ取引は100%完全に除外
    const categories = {};
    const startDate = cyclePeriod?.startDate || null;
    const endDate = cyclePeriod?.endDate || null;

    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;

      // 隠し口座関連の支出は完全排除
      const rawMethod = tx.paymentMethod || '';
      const cleanMethod = getCleanAccountName(rawMethod);
      const rawCat = tx.category || 'その他';
      const cleanCat = getCleanItemName(rawCat) || 'その他';

      if (isGhostAccount(rawMethod, ghostAccounts) || isGhostAccount(cleanMethod, ghostAccounts)) return;
      if (isGhostAccount(rawCat, ghostAccounts) || isGhostAccount(cleanCat, ghostAccounts)) return;
      if (tx.isGhostBridge) return;

      // 偽装カテゴリ（貯蓄・積立、内部振替等）の万が一の漏洩もガード
      if (cleanCat === '貯蓄・積立' || cleanCat === '内部振替' || cleanCat === '資金振替') return;

      // 現在のサイクル期間（当月）の絞り込み
      if (startDate && endDate && tx.date) {
        const txDate = tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
        if (txDate < startDate || txDate > endDate) return;
      }

      categories[cleanCat] = (categories[cleanCat] || 0) + (Number(tx.amount) || 0);
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

  }, [transactions, ghostAccounts, cyclePeriod]); // 👈 魔法のポイント：transactionsやステルス設定が変わるたびにグラフを自動で描き直す！

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