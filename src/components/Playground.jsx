import { useState } from 'react';

export default function Playground({ transactions, isStealthMode }) {
  // 1️⃣ 現在の本当の総資産を計算する
  let currentTotal = 0;
  transactions.forEach(tx => {
    if (tx.type === 'income') currentTotal += (tx.amount || 0);
    if (tx.type === 'expense') currentTotal -= (tx.amount || 0);
  });

  // 🌟 シミュレーションで使う「仮想の出費」を記憶するState
  const [simExpense, setSimExpense] = useState('');

  // 仮想の出費額（数字に変換）
  const expenseAmount = Number(simExpense) || 0;
  // 仮想購入後の残高
  const remainingAmount = currentTotal - expenseAmount;
  // 破産判定（0円未満になったら赤字！）
  const isBankrupt = remainingAmount < 0;

  // プリセットの欲しいものリスト
  const wishList = [
    { name: 'ガソリン満タン', price: 5000 },
    { name: '焼肉食べ放題', price: 8000 },
    { name: '新しいキーボード', price: 35000 },
    { name: 'ハイスペックPC', price: 250000 },
    { name: '中古のスポーツカー', price: 1500000 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', minHeight: '80vh' }}>
      
      {/* 🎮 シミュレーターメイン画面 */}
      <div style={{ background: '#11141a', padding: '40px', borderRadius: '8px', border: '1px solid #252838', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', color: '#00bfff', marginBottom: '10px' }}>💸 散財シミュレーター (危険)</h2>
        <p style={{ color: '#aaa', marginBottom: '30px' }}>現在の総資産から、もしこれを買ったらどうなるか？（※実際のデータは減りません）</p>

        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#0a0c10', padding: '30px', borderRadius: '8px', border: '1px solid #1a1d24' }}>
          
          {/* 現在の資産 */}
          <div>
            <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '10px' }}>現実の総資産</div>
            <div style={{ color: '#00ff66', fontSize: '32px', fontWeight: 'bold', fontFamily: 'monospace' }}>
              {isStealthMode ? '¥***' : `¥${currentTotal.toLocaleString()}`}
            </div>
          </div>

          <div style={{ fontSize: '30px', color: '#555' }}>➖</div>

          {/* 仮想の出費入力 */}
          <div>
            <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '10px' }}>仮想の出費額</div>
            <input 
              type="number" 
              value={simExpense}
              onChange={(e) => setSimExpense(e.target.value)}
              placeholder="金額を入力..."
              style={{
                background: 'transparent', color: '#ff3366', border: 'none', borderBottom: '2px solid #ff3366',
                fontSize: '32px', fontWeight: 'bold', fontFamily: 'monospace', width: '200px', textAlign: 'center', outline: 'none'
              }}
            />
          </div>

          <div style={{ fontSize: '30px', color: '#555' }}>🟰</div>

          {/* シミュレーション結果 */}
          <div>
            <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '10px' }}>購入後の残高</div>
            <div style={{ 
              color: isBankrupt ? '#ff3366' : '#00bfff', 
              fontSize: '36px', fontWeight: 'bold', fontFamily: 'monospace',
              textShadow: isBankrupt ? '0 0 15px rgba(255,51,102,0.5)' : 'none'
            }}>
              {isStealthMode ? '¥***' : `¥${remainingAmount.toLocaleString()}`}
            </div>
            {isBankrupt && !isStealthMode && (
              <div style={{ color: '#ff3366', fontSize: '16px', fontWeight: 'bold', marginTop: '10px', animation: 'blink 1s infinite' }}>
                🚨 破産しました 🚨
              </div>
            )}
          </div>
        </div>

        {/* リセットボタン */}
        <button 
          onClick={() => setSimExpense('')}
          style={{ marginTop: '30px', background: 'transparent', color: '#aaa', border: '1px solid #555', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer' }}
        >
          リセット
        </button>
      </div>

      {/* 🛍️ ワンクリック散財ボタン（プリセット） */}
      <div style={{ background: '#11141a', padding: '30px', borderRadius: '8px', border: '1px solid #252838' }}>
        <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '20px' }}>ワンクリック・シミュレーション</h3>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          {wishList.map(item => (
            <button
              key={item.name}
              onClick={() => setSimExpense(item.price)}
              style={{
                background: '#1a1d24', color: '#fff', border: '1px solid #252838', padding: '15px 20px', borderRadius: '8px',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center', transition: 'all 0.2s', flex: 1, minWidth: '150px'
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#ff3366'; e.currentTarget.style.boxShadow = '0 0 10px rgba(255,51,102,0.2)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = '#252838'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <span style={{ fontSize: '14px' }}>{item.name}</span>
              <span style={{ color: '#ff3366', fontWeight: 'bold', fontFamily: 'monospace' }}>¥{item.price.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}