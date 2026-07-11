import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from './firebase';

import MobileInputForm from './components/MobileInputForm';
import BalanceChart from './components/BalanceChart';

export default function MobileApp() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [currentTab, setCurrentTab] = useState('input'); // 最初は必ず「入力」が開く！

  useEffect(() => {
    signInWithEmailAndPassword(auth, "seisuma2@gmail.com", "Seisuma2")
      .then((userCredential) => setUser(userCredential.user))
      .catch((error) => console.error("ログイン失敗:", error));
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "transactions"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.date ? b.date.toMillis() : 0) - (a.date ? a.date.toMillis() : 0));
      setTransactions(data);
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0a0c10', color: '#fff', fontFamily: 'sans-serif' }}>
      
      {/* 📱 メイン画面エリア（入力 か 残高 だけ！） */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        
        {/* 入力フォーム */}
        {currentTab === 'input' && <MobileInputForm />}
        
        {/* 残高一覧（PCのカートリッジ部品をそのまま流用！） */}
        {currentTab === 'balance' && (
          <div style={{ padding: '20px' }}>
            <h2 style={{ fontSize: '18px', borderBottom: '1px solid #252838', paddingBottom: '10px', marginTop: 0 }}>
              🏦 口座・決済手段別の現在高
            </h2>
            <BalanceChart transactions={transactions} isStealthMode={false} />
          </div>
        )}
      </div>

      {/* 📱 入力アプリ専用のシンプルなボトムナビゲーション */}
      <div style={{ background: '#11141a', borderTop: '1px solid #252838', display: 'flex', justifyContent: 'space-around', padding: '10px 0', paddingBottom: '20px' }}>
        <BottomTab icon="✏️" label="入力" isActive={currentTab === 'input'} onClick={() => setCurrentTab('input')} />
        <BottomTab icon="🏦" label="残高一覧" isActive={currentTab === 'balance'} onClick={() => setCurrentTab('balance')} />
      </div>

    </div>
  );
}

function BottomTab({ icon, label, isActive, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', color: isActive ? '#00ff66' : '#555', transition: 'color 0.2s', flex: 1 }}>
      <div style={{ fontSize: '24px', marginBottom: '4px', textShadow: isActive ? '0 0 10px #00ff66' : 'none' }}>{icon}</div>
      <div style={{ fontSize: '12px', fontWeight: isActive ? 'bold' : 'normal' }}>{label}</div>
    </div>
  );
}