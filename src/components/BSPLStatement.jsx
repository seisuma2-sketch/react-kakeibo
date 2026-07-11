export default function BSPLStatement({ transactions }) {
  // 🏦 口座ごとの残高を記憶する箱
  const balances = {};
  let totalIncome = 0;
  let totalExpense = 0;

  // 1️⃣ 全データを最初から計算し直す（Reactの超高速処理！）
  transactions.forEach(tx => {
    const amount = Number(tx.amount) || 0;
    const method = tx.paymentMethod || '不明'; // 支払い元（三井住友, PayPayなど）
    const category = tx.category || '不明';    // 振替の場合の移動先

    if (!balances[method]) balances[method] = 0;

    if (tx.type === 'income') {
      balances[method] += amount;
      totalIncome += amount;
    } else if (tx.type === 'expense') {
      balances[method] -= amount;
      totalExpense += amount;
    } else if (tx.type === 'transfer') {
      // 振替（口座間移動）の処理
      if (!balances[category]) balances[category] = 0;
      balances[method] -= amount;   // 移動元から引く
      balances[category] += amount; // 移動先に足す
    }
  });

  // 💰 総資産（各口座の合計）
  const totalAssets = Object.values(balances).reduce((acc, val) => acc + val, 0);

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      
      {/* 📊 左側：B/S（貸借対照表 ＝ 今いくら持ってるか） */}
      <div style={{ flex: 1, background: '#11141a', padding: '30px', borderRadius: '8px', border: '1px solid #252838' }}>
        <h2 style={{ fontSize: '20px', borderBottom: '2px solid #00bfff', paddingBottom: '10px', marginTop: 0, color: '#00bfff' }}>
          資産の部 (B/S)
        </h2>
        
        <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0' }}>
          {Object.entries(balances)
            .sort((a, b) => b[1] - a[1]) // 金額が多い順に並び替え
            .map(([name, amount]) => (
            <li key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px dashed #252838' }}>
              <span style={{ color: '#aaa', fontSize: '16px' }}>{name}</span>
              <span style={{ color: amount >= 0 ? '#00ff66' : '#ff3366', fontWeight: 'bold', fontSize: '18px', fontFamily: 'monospace' }}>
                ¥{amount.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', paddingTop: '15px', borderTop: '2px solid #252838' }}>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '18px' }}>総資産合計</span>
          <span style={{ color: '#00ff66', fontWeight: 'bold', fontSize: '24px', fontFamily: 'monospace' }}>
            ¥{totalAssets.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 📈 右側：P/L（損益計算書 ＝ 全期間でいくら稼いでいくら使ったか） */}
      <div style={{ flex: 1, background: '#11141a', padding: '30px', borderRadius: '8px', border: '1px solid #252838', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '20px', borderBottom: '2px solid #ff3366', paddingBottom: '10px', marginTop: 0, color: '#ff3366' }}>
          損益の部 (P/L)
        </h2>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '30px' }}>
          <div>
            <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '5px' }}>全期間の総収益 (Revenue)</div>
            <div style={{ color: '#00ff66', fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>
              ¥{totalIncome.toLocaleString()}
            </div>
          </div>
          
          <div>
            <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '5px' }}>全期間の総費用 (Expense)</div>
            <div style={{ color: '#ff3366', fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>
              ¥{totalExpense.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', paddingTop: '15px', borderTop: '2px solid #252838' }}>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '18px' }}>純利益 (Net Income)</span>
          <span style={{ color: (totalIncome - totalExpense) >= 0 ? '#00ff66' : '#ff3366', fontWeight: 'bold', fontSize: '24px', fontFamily: 'monospace' }}>
            ¥{(totalIncome - totalExpense).toLocaleString()}
          </span>
        </div>
      </div>

    </div>
  );
}