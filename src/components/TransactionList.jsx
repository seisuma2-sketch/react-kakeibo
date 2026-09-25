import React, { useState } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

// アイコンとテキストを綺麗に表示するヘルパー
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
          <img src={iconPath} alt="" style={{ width: imgSize, height: imgSize, objectFit: 'contain' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </div>
      );
    }
  }
  if (item === 'リクルートカード' || (typeof item === 'string' && item.includes('リクルートカード'))) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <img src="/icon-recruit.svg" alt="" style={{ width: imgSize, height: imgSize, objectFit: 'contain' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item}</span>
      </div>
    );
  }
  if (item === 'みずほ銀行' || (typeof item === 'string' && item.includes('みずほ銀行'))) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <img src="/mizuho.jpg" alt="" style={{ width: imgSize, height: imgSize, objectFit: 'contain' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item}</span>
      </div>
    );
  }
  return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item}</span>;
}

export default function TransactionList({ transactions = [], isStealthMode, isMobile }) {
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, EXPENSE, INCOME, TRANSFER
  const [expandedId, setExpandedId] = useState(null); // クリックで展開する行のID
  const [searchQuery, setSearchQuery] = useState(''); // 検索バー用

  // ステルスモード時の偽装表示
  if (isStealthMode) {
    return (
      <div style={{ background: '#11141a', padding: '20px', borderRadius: '8px', border: '1px solid #252838', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#555', fontFamily: 'monospace' }}>
        [ SYSTEM HISTORY CLOAKED ]
      </div>
    );
  }

  // 1. タブでフィルタリング
  let filteredTx = transactions.filter(tx => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'EXPENSE') return tx.type === 'expense';
    if (activeTab === 'INCOME') return tx.type === 'income';
    if (activeTab === 'TRANSFER') return tx.type === 'transfer';
    return true;
  });

  // 2. 検索バーでフィルタリング
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredTx = filteredTx.filter(tx => 
      (tx.memo && tx.memo.toLowerCase().includes(query)) ||
      (tx.category && tx.category.toLowerCase().includes(query)) ||
      (tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(query)) ||
      (tx.location && tx.location.toLowerCase().includes(query))
    );
  }

  // 削除処理
  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('⚠️ このデータログをシステムから完全に物理削除しますか？')) {
      try {
        await deleteDoc(doc(db, "transactions", id));
      } catch (err) {
        alert("消去エラーが発生しました");
      }
    }
  };

  const tabs = [
    { id: 'ALL', label: '📥 INBOX', color: '#fff' },
    { id: 'EXPENSE', label: '💸 EXPENSE', color: '#ff3366' },
    { id: 'INCOME', label: '📈 INCOME', color: '#00ff66' },
    { id: 'TRANSFER', label: '🔁 TRANSFER', color: '#b666ff' }
  ];

  return (
    <div style={{ background: '#0a0c10', borderRadius: '8px', border: '1px solid #252838', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '400px', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      
      {/* 🌟 タブヘッダー (案3: タブ分類) */}
      <div style={{ display: 'flex', borderBottom: '1px solid #252838', background: '#11141a', overflowX: 'auto', flexShrink: 0 }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setExpandedId(null); }}
              style={{
                flex: 1, minWidth: 'max-content', padding: '15px 10px', background: 'transparent', border: 'none',
                borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                color: isActive ? tab.color : '#666', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 🌟 ツールバー領域 (案4: 検索バー) */}
      <div style={{ padding: '10px 15px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid #252838', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace' }}>
          TOTAL: {filteredTx.length} RECORDS
        </div>
        <div>
           <input 
             type="text" 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             placeholder="Search logs..." 
             style={{ background: '#050608', border: '1px solid #333', color: '#fff', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', outline: 'none', fontFamily: 'monospace', width: isMobile ? '120px' : '200px', transition: 'border-color 0.2s' }} 
             onFocus={(e) => e.target.style.borderColor = '#00bfff'}
             onBlur={(e) => e.target.style.borderColor = '#333'}
           />
        </div>
      </div>

      {/* 🌟 履歴リスト領域 (案1: Gmail風リスト) */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredTx.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: '60px 20px', fontFamily: 'monospace', fontSize: '12px' }}>NO DATA FOUND.</div>
        ) : (
          filteredTx.map((tx) => {
            const isExpanded = expandedId === tx.id;
            const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
            const dateStr = txDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
            const timeStr = txDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            
            // 24時間以内のデータは「新着（未読）」としてハイライト
            const isRecent = (new Date() - txDate) < 1000 * 60 * 60 * 24; 
            
            let typeColor = '#fff';
            let typeSign = '';
            if (tx.type === 'expense') { typeColor = '#ff3366'; typeSign = '-'; }
            if (tx.type === 'income') { typeColor = '#00ff66'; typeSign = '+'; }
            if (tx.type === 'transfer') { typeColor = '#b666ff'; typeSign = '±'; }

            return (
              <React.Fragment key={tx.id}>
                
                {/* === 1行のリスト部分 === */}
                <div 
                  className="tx-row"
                  onClick={() => setExpandedId(prev => prev === tx.id ? null : tx.id)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: isMobile ? '12px 15px' : '10px 20px',
                    borderBottom: '1px solid #1a1d24', background: isExpanded ? '#11141a' : (isRecent ? 'rgba(0, 191, 255, 0.03)' : 'transparent'),
                    cursor: 'pointer', transition: 'background 0.2s', position: 'relative'
                  }}
                >
                  {/* 新着インジケーター (青いライン) */}
                  {isRecent && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: '#00bfff' }} />}

                  {isMobile ? (
                    // モバイル用 2行レイアウト
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ccc', display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                          {tx.type === 'transfer' ? <span style={{color: '#b666ff'}}>🔁 振替</span> : renderIconOrText(tx.category, '16px')}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', color: typeColor, flexShrink: 0 }}>
                          {typeSign}¥{Number(tx.amount).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                          {tx.memo || (tx.type === 'transfer' ? `${cleanText(tx.paymentMethod)} ➔ ${cleanText(tx.category)}` : cleanText(tx.paymentMethod))}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>{dateStr}</div>
                      </div>
                    </div>
                  ) : (
                    // PC用 Gmail風 1行レイアウト
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '15px', minWidth: 0 }}>
                      <div style={{ width: '15px', color: isRecent ? '#00bfff' : '#444', fontSize: '10px' }}>{isRecent ? '●' : ''}</div>
                      
                      <div style={{ width: '130px', fontSize: '13px', color: '#ccc', fontWeight: isRecent ? 'bold' : 'normal', flexShrink: 0 }}>
                        {tx.type === 'transfer' ? <span style={{color: '#b666ff'}}>🔁 振替</span> : renderIconOrText(tx.category, '16px')}
                      </div>
                      
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span style={{ fontSize: '13px', color: '#fff', fontWeight: isRecent ? 'bold' : 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tx.memo || (tx.type === 'transfer' ? '資金のルーティング' : '(メモなし)')}
                        </span>
                        <span style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          - {tx.type === 'transfer' ? `${cleanText(tx.paymentMethod)} ➔ ${cleanText(tx.category)}` : cleanText(tx.paymentMethod)}
                        </span>
                      </div>

                      <div style={{ width: '100px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', color: typeColor, flexShrink: 0 }}>
                        {typeSign}¥{Number(tx.amount).toLocaleString()}
                      </div>
                      
                      <div className="tx-date" style={{ width: '50px', textAlign: 'right', fontSize: '12px', color: '#888', fontFamily: 'monospace', flexShrink: 0 }}>
                        {dateStr}
                      </div>

                      {/* ホバーアクション (PC時のみ、マウスを乗せると出現) */}
                      <div className="tx-actions" style={{ position: 'absolute', right: '15px', background: '#1a1d24', display: 'flex', gap: '8px', padding: '4px 8px', borderRadius: '4px', boxShadow: '0 0 10px rgba(0,0,0,0.5)', opacity: 0, transition: 'opacity 0.2s' }}>
                        <button onClick={(e) => { e.stopPropagation(); alert("編集機能はシステムアップデートで実装予定です"); }} style={{ background: 'transparent', border: 'none', color: '#00bfff', cursor: 'pointer', fontSize: '14px' }} title="編集">✏️</button>
                        <button onClick={(e) => handleDelete(e, tx.id)} style={{ background: 'transparent', border: 'none', color: '#ff3366', cursor: 'pointer', fontSize: '14px' }} title="削除">🗑️</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* === 展開時の詳細表示 (事細かい Forensic Data) === */}
                {isExpanded && (
                  <div style={{ background: '#050608', borderBottom: '1px solid #1a1d24', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', animation: 'slideDown 0.2s ease-out', boxShadow: 'inset 0 10px 10px -10px rgba(0,0,0,0.5)' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #333', paddingBottom: '10px' }}>
                      <span style={{ color: '#00bfff', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px' }}>FORENSIC DATA ANALYSIS //</span>
                      {isMobile && (
                        <button onClick={(e) => handleDelete(e, tx.id)} style={{ background: 'transparent', border: '1px solid #ff3366', color: '#ff3366', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontFamily: 'monospace' }}>🗑️ DELETE</button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px', fontFamily: 'monospace', fontSize: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex' }}><span style={{ color: '#666', width: '90px', flexShrink: 0 }}>TX_ID:</span> <span style={{ color: '#aaa', wordBreak: 'break-all' }}>{tx.id}</span></div>
                        <div style={{ display: 'flex' }}><span style={{ color: '#666', width: '90px', flexShrink: 0 }}>TIMESTAMP:</span> <span style={{ color: '#aaa' }}>{txDate.toLocaleDateString()} {timeStr}</span></div>
                        <div style={{ display: 'flex' }}><span style={{ color: '#666', width: '90px', flexShrink: 0 }}>STATUS:</span> <span style={{ color: '#00ff66' }}>VERIFIED</span></div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex' }}>
                          <span style={{ color: '#666', width: '90px', flexShrink: 0 }}>SOURCE:</span> 
                          <span style={{ color: '#ccc' }}>{cleanText(tx.paymentMethod)}</span>
                        </div>
                        <div style={{ display: 'flex' }}>
                          <span style={{ color: '#666', width: '90px', flexShrink: 0 }}>TARGET:</span> 
                          <span style={{ color: '#ccc' }}>{cleanText(tx.category)}</span>
                        </div>
                        <div style={{ display: 'flex' }}>
                          <span style={{ color: '#666', width: '90px', flexShrink: 0 }}>LOCATION:</span> 
                          <span style={{ color: tx.location ? '#00bfff' : '#aaa', wordBreak: 'break-all' }}>
                            {tx.location ? `📍 ${tx.location}` : 'UNKNOWN NODE (GPS OFFLINE)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#11141a', borderLeft: `3px solid ${typeColor}`, padding: '10px 15px', borderRadius: '4px' }}>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px', fontFamily: 'monospace' }}>MEMO / LOG:</div>
                      <div style={{ color: '#fff', fontSize: '14px', lineHeight: '1.4' }}>{tx.memo || 'NO MEMO PROVIDED.'}</div>
                    </div>

                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* アニメーションとホバー用CSS */}
      <style>{`
        /* PC用ホバー時：背景を明るくし、日付を隠してアクションボタンを出す */
        @media (min-width: 769px) {
          .tx-row:hover { background: rgba(255, 255, 255, 0.05) !important; }
          .tx-row:hover .tx-actions { opacity: 1 !important; z-index: 10; }
          .tx-row:hover .tx-date { opacity: 0; }
        }
        @keyframes slideDown { 
          from { opacity: 0; transform: translateY(-10px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
      `}</style>
    </div>
  );
}