import React, { useState, useRef, useEffect } from 'react';
import { doc, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

// 🌟 アイコンとテキストを綺麗に表示するヘルパー
function cleanText(str) {
  if (!str || typeof str !== 'string') return '';
  if (str.startsWith('/')) {
    const spaceIdx = str.indexOf(' ');
    if (spaceIdx !== -1) return str.slice(spaceIdx + 1);
  }
  return str;
}

function renderIconOrText(item, imgSize = '16px') {
  if (!item) return '';
  if (typeof item === 'string' && item.startsWith('/')) {
    const spaceIndex = item.indexOf(' ');
    if (spaceIndex !== -1) {
      let iconPath = item.slice(0, spaceIndex);
      const name = item.slice(spaceIndex + 1);
      if (name === 'リクルートカード' || name.includes('リクルート')) {
        iconPath = '/icon-recruit.svg';
      } else if (name === 'みずほ銀行' || name.includes('みずほ')) {
        iconPath = '/mizuho.jpg';
      }
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <img src={iconPath} alt="" style={{ width: imgSize, height: imgSize, objectFit: 'contain', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </div>
      );
    }
  }
  if (item === 'リクルートカード' || (typeof item === 'string' && item.includes('リクルートカード'))) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <img src="/icon-recruit.svg" alt="" style={{ width: imgSize, height: imgSize, objectFit: 'contain', flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item}</span>
      </div>
    );
  }
  if (item === 'みずほ銀行' || (typeof item === 'string' && item.includes('みずほ銀行'))) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <img src="/mizuho.jpg" alt="" style={{ width: imgSize, height: imgSize, objectFit: 'contain', flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item}</span>
      </div>
    );
  }
  return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item}</span>;
}

export default function MobileTransactionList({ transactions = [] }) {
  // 🌟 UI・フィルタリング用State
  const [activeTab, setActiveTab] = useState('ALL'); 
  const [expandedId, setExpandedId] = useState(null); 
  const [searchQuery, setSearchQuery] = useState(''); 

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

  // 🌟 フィルタリング処理（タブ ＋ 検索）
  let filteredTx = transactions.filter(tx => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'EXPENSE') return tx.type === 'expense';
    if (activeTab === 'INCOME') return tx.type === 'income';
    if (activeTab === 'TRANSFER') return tx.type === 'transfer';
    return true;
  });

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredTx = filteredTx.filter(tx => 
      (tx.memo && tx.memo.toLowerCase().includes(query)) ||
      (tx.category && tx.category.toLowerCase().includes(query)) ||
      (tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(query)) ||
      (tx.location && tx.location.toLowerCase().includes(query))
    );
  }

  // 🌟 削除実行
  const handleDelete = async (e, tx) => {
    e.stopPropagation();
    if (window.confirm(`⚠️ 以下の記録をシステムから完全に抹消しますか？\n\n対象: ${tx.category.split(' ').pop()}\n金額: ¥${tx.amount.toLocaleString()}\n\n※この操作は取り消せません。`)) {
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
    setExpandedId(null); // 詳細も閉じる
    setEditingTx(tx);
    setEditAmount(tx.amount.toString());
    setEditCategory(tx.category);
    setEditPaymentMethod(tx.paymentMethod);
    setEditMemo(tx.memo || '');
    
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

  const tabs = [
    { id: 'ALL', label: '📥 INBOX', color: '#fff' },
    { id: 'EXPENSE', label: '💸 EXPENSE', color: '#ff3366' },
    { id: 'INCOME', label: '📈 INCOME', color: '#00ff66' },
    { id: 'TRANSFER', label: '🔁 TRANSFER', color: '#b666ff' }
  ];

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '12px', background: '#1a1d24', color: '#fff', border: '1px solid #333', borderRadius: '6px', fontSize: '14px', outline: 'none' };

  return (
    <div style={{ background: '#0a0c10', minHeight: '100vh', padding: '20px 15px 100px 15px', color: '#fff', fontFamily: 'sans-serif' }}>
      
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

      {/* 🌟 ヘッダー */}
      <h2 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #252838', paddingBottom: '10px' }}>
        <span>📜</span> INTERCEPT LOG <span style={{ color: '#00bfff', fontSize: '12px', fontFamily: 'monospace' }}>// 通信傍受履歴</span>
      </h2>

      {/* 🌟 タブヘッダー */}
      <div style={{ display: 'flex', borderBottom: '1px solid #252838', marginBottom: '15px', overflowX: 'auto', gap: '5px' }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setExpandedId(null); setSwipedTxId(null); }}
              style={{
                flex: 1, minWidth: 'max-content', padding: '10px 5px', background: 'transparent', border: 'none',
                borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                color: isActive ? tab.color : '#666', fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 🌟 検索バー */}
      <div style={{ marginBottom: '20px' }}>
         <input 
           type="text" 
           value={searchQuery}
           onChange={(e) => setSearchQuery(e.target.value)}
           placeholder="Search logs... (店舗名, メモ, 場所など)" 
           style={{ width: '100%', background: '#11141a', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '6px', fontSize: '14px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box', transition: 'border-color 0.2s' }} 
           onFocus={(e) => e.target.style.borderColor = '#00bfff'}
           onBlur={(e) => e.target.style.borderColor = '#333'}
         />
      </div>

      {/* 🌟 履歴リスト領域 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredTx.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: '60px 20px', fontFamily: 'monospace', fontSize: '14px' }}>NO DATA FOUND.</div>
        ) : (
          filteredTx.map((tx) => {
            const isExpanded = expandedId === tx.id;
            const isSwiped = swipedTxId === tx.id;
            const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
            const dateStr = txDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
            const timeStr = txDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            
            const isRecent = (new Date() - txDate) < 1000 * 60 * 60 * 24; 
            
            let typeColor = '#fff';
            let typeSign = '';
            if (tx.type === 'expense') { typeColor = '#ff3366'; typeSign = '-'; }
            if (tx.type === 'income') { typeColor = '#00ff66'; typeSign = '+'; }
            if (tx.type === 'transfer') { typeColor = '#b666ff'; typeSign = '±'; }

            return (
              <div 
                key={tx.id}
                style={{ 
                  position: 'relative', 
                  borderRadius: '8px', 
                  border: `1px solid ${isExpanded ? typeColor : '#252838'}`,
                  background: '#0a0c10',
                  overflow: 'hidden',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                  transition: 'border-color 0.2s'
                }}
              >
                {/* === 背面のスワイプアクションボタンエリア === */}
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

                {/* === 前面の取引データ（タップで詳細展開、スワイプで編集） === */}
                <div 
                  onTouchStart={handleTouchStart} 
                  onTouchMove={(e) => handleTouchMove(e, tx.id)} 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSwiped) {
                      setSwipedTxId(null);
                    } else {
                      setExpandedId(isExpanded ? null : tx.id);
                    }
                  }}
                  style={{ 
                    background: isExpanded ? '#11141a' : '#0a0c10', 
                    borderLeft: `4px solid ${typeColor}`, 
                    transform: isSwiped ? 'translateX(-170px)' : 'translateX(0)',
                    transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.2s',
                    position: 'relative',
                    zIndex: 1,
                    minHeight: '100%',
                    cursor: 'pointer'
                  }}
                >
                  {/* メイン行情報 */}
                  <div style={{ padding: '15px', position: 'relative' }}>
                    {isRecent && <div style={{ position: 'absolute', top: '10px', right: '10px', width: '6px', height: '6px', borderRadius: '50%', background: '#00bfff', boxShadow: '0 0 8px #00bfff' }} />}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>
                        {txDate.getFullYear()}/{txDate.getMonth() + 1}/{txDate.getDate()} {timeStr}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', color: typeColor }}>
                        {typeSign}¥{Number(tx.amount).toLocaleString()}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>
                      {tx.type === 'transfer' ? <span style={{color: '#b666ff'}}>🔁 振替</span> : renderIconOrText(tx.category, '18px')}
                    </div>
                    
                    <div style={{ fontSize: '12px', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tx.type === 'transfer' ? `${cleanText(tx.paymentMethod)} ➔ ${cleanText(tx.category)}` : cleanText(tx.paymentMethod)} {tx.memo ? `// ${tx.memo}` : ''}
                    </div>
                  </div>

                  {/* タップ展開時の詳細部分 (Forensic Data) */}
                  {isExpanded && (
                    <div onClick={(e) => e.stopPropagation()} style={{ background: '#050608', borderTop: '1px solid #1a1d24', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px', animation: 'slideDown 0.2s ease-out' }}>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #333', paddingBottom: '10px' }}>
                        <span style={{ color: '#00bfff', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px' }}>FORENSIC DATA //</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
                        <div style={{ display: 'flex' }}><span style={{ color: '#666', width: '80px', flexShrink: 0 }}>TX_ID:</span> <span style={{ color: '#555', wordBreak: 'break-all' }}>{tx.id}</span></div>
                        <div style={{ display: 'flex' }}>
                          <span style={{ color: '#666', width: '80px', flexShrink: 0 }}>SOURCE:</span> 
                          <span style={{ color: '#ccc' }}>{cleanText(tx.paymentMethod)}</span>
                        </div>
                        <div style={{ display: 'flex' }}>
                          <span style={{ color: '#666', width: '80px', flexShrink: 0 }}>TARGET:</span> 
                          <span style={{ color: '#ccc' }}>{cleanText(tx.category)}</span>
                        </div>
                        <div style={{ display: 'flex' }}>
                          <span style={{ color: '#666', width: '80px', flexShrink: 0 }}>LOCATION:</span> 
                          <span style={{ color: tx.location ? '#00bfff' : '#aaa', wordBreak: 'break-all' }}>
                            {tx.location ? `📍 ${tx.location}` : 'UNKNOWN NODE'}
                          </span>
                        </div>
                      </div>

                      <div style={{ background: '#11141a', borderLeft: `3px solid ${typeColor}`, padding: '10px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px', fontFamily: 'monospace' }}>MEMO / LOG:</div>
                        <div style={{ color: '#fff', fontSize: '13px', lineHeight: '1.4' }}>{tx.memo || 'NO MEMO PROVIDED.'}</div>
                      </div>

                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes slideDown { 
          from { opacity: 0; transform: translateY(-10px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
      `}</style>
    </div>
  );
}