import { useState } from 'react';

export default function IncomeExpense({ transactions, isStealthMode }) {
  // 🌟 絞り込み用のState（最初は 'all' ＝ 全て表示）
  const [filter, setFilter] = useState('all');

  // 選んだフィルターに合わせてデータを絞り込む
  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.type === filter;
  });

  return (
    <div style={{ background: '#11141a', padding: '30px', borderRadius: '8px', border: '1px solid #252838', minHeight: '80vh' }}>
      
      {/* ヘッダーとフィルターボタン */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #252838', paddingBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', margin: 0, color: '#fff' }}>収支詳細マスターレコード</h2>
        
        {/* 🔘 絞り込みボタン群 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setFilter('all')} style={btnStyle(filter === 'all', '#00bfff')}>全て</button>
          <button onClick={() => setFilter('income')} style={btnStyle(filter === 'income', '#00ff66')}>収入のみ</button>
          <button onClick={() => setFilter('expense')} style={btnStyle(filter === 'expense', '#ff3366')}>支出のみ</button>
          <button onClick={() => setFilter('transfer')} style={btnStyle(filter === 'transfer', '#b666ff')}>振替のみ</button>
        </div>
      </div>

      {/* 📊 詳細データテーブル（表） */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #252838', color: '#aaa', fontSize: '14px' }}>
              <th style={{ padding: '15px 10px' }}>日時</th>
              <th style={{ padding: '15px 10px' }}>タイプ</th>
              <th style={{ padding: '15px 10px' }}>カテゴリ</th>
              <th style={{ padding: '15px 10px' }}>口座 / 決済</th>
              <th style={{ padding: '15px 10px' }}>メモ</th>
              <th style={{ padding: '15px 10px', textAlign: 'right' }}>金額</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(tx => {
              // 日付を綺麗にフォーマット
              const dateStr = tx.date 
                ? tx.date.toDate().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                : '不明';
              
              const isInc = tx.type === 'income';
              const isExp = tx.type === 'expense';
              const typeColor = isInc ? '#00ff66' : isExp ? '#ff3366' : '#b666ff';
              const typeLabel = isInc ? '収入' : isExp ? '支出' : '振替';
              const amountPrefix = isInc ? '+' : isExp ? '-' : '';

              return (
                <tr key={tx.id} style={{ borderBottom: '1px solid #1a1d24', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#161922'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '15px 10px', color: '#ccc', fontSize: '14px' }}>{dateStr}</td>
                  <td style={{ padding: '15px 10px', color: typeColor, fontWeight: 'bold', fontSize: '14px' }}>[{typeLabel}]</td>
                  <td style={{ padding: '15px 10px', color: '#fff', fontSize: '14px' }}>{tx.category || 'その他'}</td>
                  <td style={{ padding: '15px 10px', color: '#00bfff', fontSize: '14px' }}>{tx.paymentMethod}</td>
                  <td style={{ padding: '15px 10px', color: '#888', fontSize: '14px' }}>{tx.memo || '-'}</td>
                  <td style={{ padding: '15px 10px', color: typeColor, fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace', fontSize: '16px' }}>
                    {isStealthMode ? '¥***' : `${amountPrefix}¥${tx.amount ? tx.amount.toLocaleString() : 0}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {filteredTransactions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px', color: '#555' }}>データがありません</div>
        )}
      </div>
    </div>
  );
}

// 🎨 ボタンのデザインを動的に変える関数
const btnStyle = (isActive, color) => ({
  background: isActive ? `${color}22` : 'transparent',
  color: isActive ? color : '#aaa',
  border: `1px solid ${isActive ? color : '#252838'}`,
  padding: '8px 20px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold',
  transition: 'all 0.2s'
});