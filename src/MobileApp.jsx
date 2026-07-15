import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from './firebase';

import MobileInputForm from './components/MobileInputForm';
import BalanceChart from './components/BalanceChart';
import NewsFeed from './components/NewsFeed';
import MobileTransactionList from './components/MobileTransactionList'; // 👈 これを追加！
import NebulaCore3D from './components/NebulaCore3D';


export default function MobileApp() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [currentTab, setCurrentTab] = useState('input'); 

  // 🌟 ステルスシステム用のState
 const [isStealthActive, setIsStealthActive] = useState(() => {
    const saved = localStorage.getItem('stealthActiveMobile');
    return saved !== null ? saved === 'true' : true;
  });

  // 👇 そのすぐ下にこれを追加！
  useEffect(() => {
    localStorage.setItem('stealthActiveMobile', isStealthActive);
  }, [isStealthActive]);
  const [stealthAccounts, setStealthAccounts] = useState([]); 

  useEffect(() => {
    signInWithEmailAndPassword(auth, "seisuma2@gmail.com", "Seisuma2")
      .then((userCredential) => setUser(userCredential.user))
      .catch((error) => console.error("ログイン失敗:", error));
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, "transactions"), where("userId", "==", user.uid));
    const unsubscribeTx = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      data.sort((a, b) => (b.date ? b.date.toMillis() : 0) - (a.date ? a.date.toMillis() : 0));
      setTransactions(data);
    });

    const unsubscribeSettings = onSnapshot(doc(db, "user_settings", user.uid), (document) => {
      if (document.exists()) {
        setStealthAccounts(document.data().stealthAccounts || []);
      }
    });

    return () => { unsubscribeTx(); unsubscribeSettings(); };
  }, [user]);

  useEffect(() => {
    localStorage.setItem('stealthActiveMobile', isStealthActive);
  }, [isStealthActive]);

  // 🔓 【極秘】タイトルをダブルタップした時だけ発動する解除コマンド
  // 変更前：unlockStealth という関数でした
  // 変更後：ダブルタップでON/OFFを切り替えられるようにする
  const toggleStealth = () => {
    if (!isStealthActive) {
      // 🔓 すでに解除されているなら、パスワードなしで即ロックする！
      setIsStealthActive(true);
      alert("🔒 ゴーストプロトコルを再起動しました");
    } else {
      // 🔒 ロックされているならパスコード要求
      const pw = prompt("パスコードを入力してください");
      if (pw === "0000") { 
        setIsStealthActive(false);
        alert("🔓 ゴーストプロトコルを解除しました");
        // ※ 30秒で戻るタイマーは消しました
      } else if (pw !== null) {
        alert("❌ パスコードが違います");
      }
    }
  };

  const ghostList = isStealthActive ? stealthAccounts : [];
 const safeTransactions = transactions.map(tx => {
    if (!isStealthActive) return tx;

    const isFromGhost = stealthAccounts.includes(tx.paymentMethod);
    const isToGhost = tx.type === 'transfer' && stealthAccounts.includes(tx.category);

    if (tx.type === 'transfer') {
      if (isFromGhost && !isToGhost) {
        return { ...tx, type: 'income', paymentMethod: tx.category, category: '不明な入金', memo: '---' };
      }
      if (!isFromGhost && isToGhost) {
        return { ...tx, type: 'expense', category: '不明な出費', memo: '---' };
      }
    }

    if (isFromGhost || isToGhost) return null;

    return tx;
  }).filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0a0c10', color: '#fff', fontFamily: 'sans-serif' }}>
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {currentTab === 'input' && <MobileInputForm />}
        
        {currentTab === 'balance' && (
          <div style={{ padding: '20px' }}>
            <div style={{ borderBottom: '1px solid #252838', paddingBottom: '10px', marginBottom: '15px', marginTop: 0 }}>
              
              {/* 🌟 偽装UI: パッと見は普通のタイトルだが、ダブルクリックで解除画面が出る！ */}
              <h2 onDoubleClick={toggleStealth} style={{ fontSize: '18px', margin: 0, userSelect: 'none', cursor: 'default' }}>
                🏦 口座・決済手段別の現在高
              </h2>

            </div>
            
            {/* 🌟 BalanceChartには「全データ」と「隠蔽リスト」を渡す！ */}
            <BalanceChart transactions={safeTransactions} ghostAccounts={[]} />
          </div>
        )}
        {currentTab === 'history' && (
            <MobileTransactionList transactions={safeTransactions} />
          )}
        {currentTab === 'feed' && <NewsFeed />}
      </div>

          <div style={{ background: '#11141a', borderTop: '1px solid #252838', paddingBottom: '20px', zIndex: 100 }}>
        <NebulaCore3D currentTab={currentTab} setCurrentTab={setCurrentTab} />
      </div>
      
    </div>
  );
}

function BottomTab({ icon, label, isActive, onClick }) {
  // 渡されたのが画像(.pngや.svgなど)か、絵文字かを判定するセンサー
  const isImage = icon.includes('.png') || icon.includes('.svg') || icon.includes('.jpg');

  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', opacity: isActive ? 1 : 0.5, transition: 'opacity 0.2s' }}>
      
      {/* 画像なら <img> タグで表示、絵文字ならそのまま表示 */}
      {isImage ? (
        <img 
          src={icon} 
          alt={label} 
          style={{ 
            width: '40px',  // 🌟 少し大きくする（足りなければ32pxにしてもOK）
            height: '38px', // 🌟 幅と高さを合わせる
            objectFit: 'contain', // 🌟 これを追加！枠の中で綺麗に収まるようにする
            marginBottom: '4px',
            // 🌟 ハッカー演出：アクティブな時は画像をサイバーブルーに光らせる！
            filter: isActive ? 'drop-shadow(0 0 5px #00bfff)' : 'grayscale(100%) opacity(70%)'
          }} 
        />
      ) : (
        <div style={{ fontSize: '24px', marginBottom: '4px' }}>{icon}</div>
      )}
      
      <div style={{ fontSize: '10px', color: isActive ? '#00bfff' : '#666', fontWeight: 'bold' }}>{label}</div>
    </div>
  );
}