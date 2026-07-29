import React from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function MobileTransactionList({ transactions }) {
  
  // 🌟 Firebaseからデータを完全に削除するハッキング関数
  const handleDelete = async (tx) => {
    // 誤操作防止のサイバーな確認ダイアログ
    if (window.confirm(`⚠️ 以下の記録をシステムから完全に抹消しますか？\n\n対象: ${tx.category}\n金額: ¥${tx.amount.toLocaleString()}\n\n※この操作は取り消せません。`)) {
      try {
        await deleteDoc(doc(db, "transactions", tx.id));
        // 削除成功時にスマホをブルッと震わせる
        if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
      } catch (error) {
        console.error("削除エラー:", error);
        alert("❌ データの抹消に失敗しました。通信環境を確認してください。");
      }
    }
  };

  if (!transactions || transactions.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666', fontFamily: 'monospace' }}>
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
        NO TRANSACTION DATA FOUND.
      </div>
    );
  }

  return (
    <div style={{ padding: '5px', paddingBottom: '100px' }}>
      <div style={{ borderBottom: '1px solid #252838', paddingBottom: '10px', marginBottom: '15px' }}>
        <h2 style={{ margin: 0, fontSize: '16px', color: '#fff', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📜</span> INTERCEPT LOG // 通信傍受履歴
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {transactions.map(tx => {
          const isExpense = tx.type === 'expense' || tx.type === 'transfer';
          const color = isExpense ? '#ff3366' : '#00bfff';
          const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);

          return (
            <div 
              key={tx.id} 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                background: '#11141a', 
                padding: '15px', 
                borderRadius: '8px', 
                borderLeft: `3px solid ${color}`,
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
              }}
            >
              {/* 左側：日時・カテゴリ・決済元 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', color: '#888', fontFamily: 'monospace' }}>
                  {txDate.toLocaleDateString('ja-JP')} {txDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tx.type === 'transfer' ? `🔄 ${tx.paymentMethod} ▶ ${tx.category}` : tx.category}
                </span>
                <span style={{ fontSize: '11px', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tx.type === 'transfer' ? '資金ルーティング' : tx.paymentMethod} 
                  {tx.memo && <span style={{ color: '#666' }}> // {tx.memo}</span>}
                </span>
              </div>

              {/* 右側：金額 ＆ 削除ボタン */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexShrink: 0 }}>
                <span style={{ color: color, fontWeight: 'bold', fontSize: '18px', fontFamily: 'monospace' }}>
                  {isExpense ? '-' : '+'}¥{Number(tx.amount).toLocaleString()}
                </span>
                
                {/* 🌟 抹殺ボタン */}
                <button 
                  onClick={() => handleDelete(tx)}
                  style={{ 
                    background: 'rgba(255, 51, 102, 0.1)', 
                    border: '1px solid #ff3366', 
                    color: '#ff3366', 
                    borderRadius: '6px', 
                    padding: '8px 10px', 
                    cursor: 'pointer', 
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}