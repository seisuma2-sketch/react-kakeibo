import React, { useState, useRef, useEffect } from 'react';
import { doc, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function MobileTransactionList({ transactions }) {
  // 🌟 スワイプ管理用State
  const [swipedTxId, setSwipedTxId] = useState(null);
  const touchStartRef = useRef({ x: 0, y: 0 });

  // 🌟 編集モーダル用State
  const [editingTx, setEditingTx] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // 画面のどこかをタップしたらスワイプを閉じる
  useEffect(() => {
    const handleGlobalClick = () => setSwipedTxId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // 🌟 スワイプ判定ロジック
  const handleTouchStart = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e, txId) => {
    const touch = e.touches ? e.touches[0] : e;
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;

    // 横移動が縦移動より大きい場合のみスワイプと判定
    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < -40) {
        setSwipedTxId(txId);
        if (navigator.vibrate) navigator.vibrate(15);
      } else if (diffX > 30) {
        setSwipedTxId(null);
      }
    }
  };

  // 🌟 削除実行
  const handleDelete = async (e, tx) => {
    e.stopPropagation();
    if (window.confirm(`⚠️ 以下の記録をシステムから完全に抹消しますか？\n\n対象: ${tx.category}\n金額: ¥${tx.amount.toLocaleString()}\n\n※この操作は取り消せません。`)) {
      try {
        await deleteDoc(doc(db, "transactions", tx.id));
        setSwipedTxId(null);
        if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
      } catch (error) {
        console.error("削除エラー:", error);
        alert("❌ データの抹消に失敗しました。");
      }
    }
  };

  // 🌟 編集モーダルを開く
  const openEditModal = (e, tx) => {
    e.stopPropagation();
    setSwipedTxId(null);
    setEditingTx(tx);
    setEditAmount(tx.amount.toString());
    setEditCategory(tx.category);
    setEditPaymentMethod(tx.paymentMethod);
    setEditMemo(tx.memo || '');
    
    // 日付を input type="datetime-local" 用のフォーマットに変換
    const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
    const tzOffset = txDate.getTimezoneOffset() * 60000;
    const localISOTime = new Date(txDate.getTime() - tzOffset).toISOString().slice(0, 16);
    setEditDate(localISOTime);
  };

  // 🌟 編集保存実行
  const saveEdit = async () => {
    if (!editAmount || Number(editAmount) <= 0) {
      alert("⚠️ 正しい金額を入力してください");
      return;
    }
    setIsUpdating(true);
    try {
      const txRef = doc(db, "transactions", editingTx.id);
      await updateDoc(txRef, {
        amount: Number(editAmount),
        category: editCategory,
        paymentMethod: editPaymentMethod,
        memo: editMemo,
        date: Timestamp.fromDate(new Date(editDate))
      });
      setEditingTx(null);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch (error) {
      console.error("更新エラー:", error);
      alert("❌ データの更新に失敗しました。");
    } finally {
      setIsUpdating(false);
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
      
      {/* 🌟 編集モーダル */}
      {editingTx && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#0a0c10', border: '1px solid #00bfff', borderRadius: '12px', width: '90%', maxWidth: '340px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 0 30px rgba(0, 191, 255, 0.3)' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              ⚙️ データ修正
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>発生日時</div>
                <input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>金額</div>
                <div style={{ display: 'flex', alignItems: 'center', background: '#1a1d24', border: '1px solid #555', borderRadius: '6px', padding: '0 10px' }}>
                  <span style={{ color: editingTx.type === 'income' ? '#00bfff' : '#ff3366', fontSize: '18px', fontWeight: 'bold' }}>¥</span>
                  <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} style={{ ...inputStyle, border: 'none', background: 'transparent', color: editingTx.type === 'income' ? '#00bfff' : '#ff3366', fontSize: '20px', fontWeight: 'bold', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>カテゴリ(入金先)</div>
                  <input type="text" value={editCategory} onChange={e => setEditCategory(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>決済元</div>
                  <input type="text" value={editPaymentMethod} onChange={e => setEditPaymentMethod(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>メモ</div>
                <input type="text" value={editMemo} onChange={e => setEditMemo(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => setEditingTx(null)} style={{ flex: 1, padding: '12px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '6px', fontWeight: 'bold' }}>キャンセル</button>
              <button onClick={saveEdit} disabled={isUpdating} style={{ flex: 1, padding: '12px', background: isUpdating ? '#555' : '#00bfff', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
                {isUpdating ? '更新中...' : '修正を保存'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          const isSwiped = swipedTxId === tx.id;

          return (
            <div key={tx.id} style={{ position: 'relative', overflow: 'hidden', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
              
              {/* 🌟 背面のスワイプアクションボタンエリア */}
              <div style={{ position: 'absolute', top: 0, right: 0, height: '100%', display: 'flex', zIndex: 0 }}>
                <button 
                  onClick={(e) => openEditModal(e, tx)}
                  style={{ background: '#00bfff', color: '#000', border: 'none', padding: '0 20px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  ⚙️ 編集
                </button>
                <button 
                  onClick={(e) => handleDelete(e, tx)}
                  style={{ background: '#ff3366', color: '#fff', border: 'none', padding: '0 20px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  🗑️ 削除
                </button>
              </div>

              {/* 🌟 前面の取引データ（左にスライドする） */}
              <div 
                onTouchStart={handleTouchStart} 
                onTouchMove={(e) => handleTouchMove(e, tx.id)} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  background: '#11141a', 
                  padding: '15px', 
                  borderLeft: `3px solid ${color}`,
                  transform: isSwiped ? 'translateX(-160px)' : 'translateX(0)',
                  transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  position: 'relative',
                  zIndex: 1
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

                {/* 右側：金額 */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <span style={{ color: color, fontWeight: 'bold', fontSize: '18px', fontFamily: 'monospace' }}>
                    {isExpense ? '-' : '+'}¥{Number(tx.amount).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '12px', background: '#1a1d24', color: '#fff', border: '1px solid #333', borderRadius: '6px', fontSize: '14px', outline: 'none' };