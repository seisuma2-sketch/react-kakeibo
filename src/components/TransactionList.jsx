import { useState } from 'react';
import { doc, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase'; // 🌟 データベース接続をインポート

export default function TransactionList({ transactions, isStealthMode, isMobile }) {
  // 🌟 編集用のState
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', category: '', memo: '', paymentMethod: '', date: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  // 📝 項目がタップされた時に、編集画面を開く処理
  const openEdit = (tx) => {
    setEditingTx(tx);
    // 日付を input type="datetime-local" に合う形に変換
    let d = new Date();
    if (tx.date) d = tx.date.toDate();
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);

    setEditForm({
      amount: tx.amount,
      category: tx.category,
      memo: tx.memo || '',
      paymentMethod: tx.paymentMethod,
      date: localISOTime
    });
  };

  const closeEdit = () => setEditingTx(null);

  // 🗑️ 削除ボタンの処理
  const handleDelete = async () => {
    if (!window.confirm("この記録を完全に消去しますか？")) return;
    setIsUpdating(true);
    try {
      await deleteDoc(doc(db, "transactions", editingTx.id));
      closeEdit();
    } catch (error) {
      console.error("削除エラー:", error);
      alert("❌ 削除に失敗しました");
    } finally {
      setIsUpdating(false);
    }
  };

  // 💾 更新（上書き）ボタンの処理
  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "transactions", editingTx.id), {
        amount: Number(editForm.amount),
        category: editForm.category,
        memo: editForm.memo,
        paymentMethod: editForm.paymentMethod,
        date: Timestamp.fromDate(new Date(editForm.date))
      });
      closeEdit();
    } catch (error) {
      console.error("更新エラー:", error);
      alert("❌ 更新に失敗しました");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div style={{ background: '#11141a', padding: isMobile ? '15px' : '20px', borderRadius: '8px', border: '1px solid #252838', height: '100%', position: 'relative' }}>
      <h2 style={{ fontSize: '16px', borderBottom: '1px solid #252838', paddingBottom: '10px', marginTop: 0, color: '#fff' }}>
        直近の履歴 <span style={{fontSize: '12px', color: '#aaa', fontWeight: 'normal'}}>(タップで編集)</span>
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

            // 📱 【スマホ専用レイアウト】
            if (isMobile) {
              return (
                <li 
                  key={tx.id} 
                  onClick={() => openEdit(tx)}
                  style={listItemStyle}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: typeColor, fontSize: '11px', fontWeight: 'bold', border: `1px solid ${typeColor}`, padding: '2px 4px', borderRadius: '4px' }}>{typeLabel}</span>
                      <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{tx.category || 'その他'}</span>
                    </div>
                    <div style={{ color: typeColor, fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {amountStr}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ color: '#00bfff', fontSize: '12px' }}>💽 {tx.paymentMethod}</span>
                    <span style={{ color: '#aaa', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                      {tx.memo || '-'}
                    </span>
                  </div>
                </li>
              );
            }

            // 💻 【PC専用レイアウト】
            return (
              <li 
                key={tx.id} 
                onClick={() => openEdit(tx)}
                style={{ ...listItemStyle, display: 'grid', gridTemplateColumns: '70px 100px 1fr 120px 100px', alignItems: 'center', gap: '15px' }}
              >
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

      {/* 🌟 編集用モーダル（サイバーデザイン） */}
      {editingTx && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ marginTop: 0, color: '#00bfff', borderBottom: '1px solid #252838', paddingBottom: '10px' }}>
              ✏️ データの修正・削除
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={labelStyle}>金額</div>
                <input type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>カテゴリ</div>
                <input type="text" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>支払・入金元</div>
                <input type="text" value={editForm.paymentMethod} onChange={e => setEditForm({...editForm, paymentMethod: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>メモ</div>
                <input type="text" value={editForm.memo} onChange={e => setEditForm({...editForm, memo: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>発生日時</div>
                <input type="datetime-local" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} style={inputStyle} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={handleDelete} disabled={isUpdating} style={{ flex: 1, background: '#ff3366', color: '#fff', padding: '12px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', opacity: isUpdating ? 0.5 : 1 }}>
                  🗑️ 削除
                </button>
                <button onClick={handleUpdate} disabled={isUpdating} style={{ flex: 2, background: '#00bfff', color: '#fff', padding: '12px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', opacity: isUpdating ? 0.5 : 1 }}>
                  💾 修正して更新
                </button>
              </div>
              <button onClick={closeEdit} style={{ background: 'transparent', color: '#aaa', border: '1px solid #555', padding: '10px', borderRadius: '6px', cursor: 'pointer', marginTop: '5px' }}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 🌟 UIスタイル
const listItemStyle = {
  padding: '12px 10px', 
  borderBottom: '1px solid #252838', 
  cursor: 'pointer', 
  transition: 'background 0.2s',
  borderRadius: '4px'
};

const overlayStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, backdropFilter: 'blur(5px)' };
const modalStyle = { background: '#11141a', padding: '20px', borderRadius: '12px', border: '1px solid #00bfff', width: '90%', maxWidth: '350px', boxShadow: '0 0 30px rgba(0, 191, 255, 0.1)' };
const labelStyle = { color: '#aaa', fontSize: '12px', marginBottom: '4px', fontWeight: 'bold' };
const inputStyle = { width: '100%', padding: '10px', background: '#0a0c10', color: '#fff', border: '1px solid #252838', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box' };