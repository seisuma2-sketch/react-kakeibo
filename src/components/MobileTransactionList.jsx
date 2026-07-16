import { useState } from 'react';

export default function MobileTransactionList({ transactions }) {
  // タップして詳細を開いている取引のIDを管理する状態
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (transactions.length === 0) {
    return (
      <div style={{ color: '#666', textAlign: 'center', padding: '40px 20px', fontFamily: 'monospace', fontSize: '13px' }}>
        [ NO TRANSACTION LOGS FOUND ]
      </div>
    );
  }

  return (
    <div style={{ background: '#11141a', padding: '15px', borderRadius: '8px', border: '1px solid #252838', minHeight: '80vh' }}>
      <div style={{ borderBottom: '1px solid #252838', paddingBottom: '10px', marginBottom: '15px' }}>
        <h2 style={{ fontSize: '18px', margin: 0, color: '#fff' }}> 決済履歴</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {transactions.map((tx) => {
          const isExpanded = expandedId === tx.id;
          const isExpense = tx.type === 'expense';
          const isTransfer = tx.type === 'transfer';
          
          // 金額の色定義
          let amountColor = '#00ff66'; // 収入
          if (isExpense) amountColor = '#ff3366'; // 支出
          if (isTransfer) amountColor = '#ff9900'; // 振替

          // 日付の整形
          const dateObj = tx.date?.seconds ? new Date(tx.date.seconds * 1000) : new Date(tx.date);
          const dateStr = dateObj.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });

          return (
            <div 
              key={tx.id}
              style={{
                background: '#0a0c10',
                border: `1px solid ${isExpanded ? '#00bfff' : '#1a1d24'}`,
                borderRadius: '6px',
                overflow: 'hidden',
                transition: 'all 0.2s ease'
              }}
            >
              {/* 🛑 タップできるメイン行（決済方法と金額だけをシンプルに表示） */}
              <div 
                onClick={() => toggleExpand(tx.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 15px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#666', fontSize: '11px', fontFamily: 'monospace' }}>{dateStr}</span>
                  <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
                    {isTransfer ? `${tx.paymentMethod} ➔ ${tx.category}` : tx.paymentMethod}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: amountColor, fontSize: '15px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {isExpense ? '-' : isTransfer ? '⇄ ' : '+'}${Number(tx.amount).toLocaleString()}
                  </span>
                  <span style={{ color: '#666', fontSize: '10px' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* 🔍 タップしたらシュッと展開する詳細エリア */}
              {isExpanded && (
                <div style={{ 
                  padding: '12px 15px', 
                  background: '#0d1117', 
                  borderTop: '1px solid #1a1d24',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#ccc'
                }}>
                  <div><span style={{ color: '#00bfff', fontFamily: 'monospace' }}>[TYPE]</span> {isTransfer ? '資金振替' : isExpense ? '支出' : '収入'}</div>
                  <div><span style={{ color: '#00bfff', fontFamily: 'monospace' }}>[CATEGORY]</span> {isTransfer ? '内部移動' : tx.category}</div>
                  <div><span style={{ color: '#00bfff', fontFamily: 'monospace' }}>[MEMO]</span> {tx.memo || '---'}</div>
                  {tx.gasToken && (
                    <div style={{ color: '#00ff66', fontSize: '10px', fontFamily: 'monospace', marginTop: '4px' }}>
                      🛰️ AUTO-INTERCEPTED VIA GMAIL (GAS)
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}