export default function TransactionList({ transactions, isStealthMode, isMobile }) {
  return (
    <div style={{ background: '#11141a', padding: isMobile ? '15px' : '20px', borderRadius: '8px', border: '1px solid #252838', height: '100%' }}>
      <h2 style={{ fontSize: '16px', borderBottom: '1px solid #252838', paddingBottom: '10px', marginTop: 0, color: '#fff' }}>
        直近の履歴
      </h2>
      
      {transactions.length === 0 ? (
        <p style={{ color: '#888', fontSize: '14px' }}>データがありません</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {transactions.slice(0, 7).map((tx) => {
            const typeColor = tx.type === 'income' ? '#00ff66' : tx.type === 'transfer' ? '#b666ff' : '#ff3366';
            const typeLabel = tx.type === 'income' ? '収入' : tx.type === 'transfer' ? '振替' : '支出';
            const prefix = tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '-';
            const amountStr = isStealthMode ? '¥***' : `${prefix}¥${tx.amount ? tx.amount.toLocaleString() : 0}`;

            // 📱 【スマホ専用レイアウト】 2行に分けてスッキリ表示！
            if (isMobile) {
              return (
                <li key={tx.id} style={{ padding: '12px 0', borderBottom: '1px solid #252838', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: typeColor, fontSize: '11px', fontWeight: 'bold', border: `1px solid ${typeColor}`, padding: '2px 4px', borderRadius: '4px' }}>{typeLabel}</span>
                      <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{tx.category || 'その他'}</span>
                    </div>
                    <div style={{ color: typeColor, fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {amountStr}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#00bfff', fontSize: '12px' }}>💽 {tx.paymentMethod}</span>
                    <span style={{ color: '#aaa', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                      {tx.memo || '-'}
                    </span>
                  </div>
                </li>
              );
            }

            // 💻 【PC専用レイアウト】 いつもの均等割り付け
            return (
              <li key={tx.id} style={{ display: 'grid', gridTemplateColumns: '70px 100px 1fr 120px 100px', alignItems: 'center', gap: '15px', padding: '12px 0', borderBottom: '1px solid #252838' }}>
                <div style={{ color: typeColor, fontWeight: 'bold', fontSize: '14px' }}>[{typeLabel}]</div>
                <div style={{ color: '#fff', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.category || 'その他'}</div>
                <div style={{ color: '#aaa', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.memo || '-'}</div>
                <div style={{ color: '#00bfff', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.paymentMethod}</div>
                <div style={{ color: typeColor, fontWeight: 'bold', textAlign: 'right', fontFamily: 'monospace', fontSize: '16px' }}>{amountStr}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}