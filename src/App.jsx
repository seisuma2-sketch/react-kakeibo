import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from './firebase';

import Sidebar from './components/Sidebar';
import SummaryPanel from './components/SummaryPanel';
import TransactionList from './components/TransactionList';
import CategoryChart from './components/CategoryChart';
import CalendarView from './components/CalendarView';
import BalanceChart from './components/BalanceChart';
import BSPLStatement from './components/BSPLStatement';
import IncomeExpense from './components/IncomeExpense';
import CategoryBreakdown from './components/CategoryBreakdown';
import Playground from './components/Playground';
import NebulaCore from './components/NebulaCore';
import MobileInputForm from './components/MobileInputForm';
import MoneyFlowMap from './components/MoneyFlowMap';
import NewsFeed from './components/NewsFeed';
import TopNewsWidget from './components/TopNewsWidget';
import DesktopCockpitOS from './components/DesktopCockpitOS';

function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [currentTab, setCurrentTab] = useState('home');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [stealthPassword, setStealthPassword] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // 🌟 デスクトップモード管理
  const [desktopMode, setDesktopMode] = useState(() => {
    return localStorage.getItem('desktopDashMode') || 'standard';
  });

  const switchMode = (mode) => {
    setDesktopMode(mode);
    localStorage.setItem('desktopDashMode', mode);
  };

  // 🌟 アプリ全体の集計サイクル開始日管理（デフォルトは1日）
  const [cycleStartDay, setCycleStartDay] = useState(() => {
    return parseInt(localStorage.getItem('m402_cycle_start_day') || '1', 10);
  });
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [tempCycleDay, setTempCycleDay] = useState(cycleStartDay);

  const [stealthConfig, setStealthConfig] = useState(() => {
    const saved = localStorage.getItem('stealthConfig');
    return saved ? JSON.parse(saved) : {
      active: false, hideSummary: true, hideCartridges: true, hideHistory: true, ghostAccounts: [],
    };
  });
  useEffect(() => {
    localStorage.setItem('stealthConfig', JSON.stringify(stealthConfig));
  }, [stealthConfig]);
  const CORRECT_PASSWORD = 'cyber';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault(); setIsAuthModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAuth = () => {
    if (stealthPassword === CORRECT_PASSWORD) {
      setIsAuthModalOpen(false); setStealthPassword(''); setIsConfigModalOpen(true);
    } else {
      alert('❌ ACCESS DENIED'); setStealthPassword('');
    }
  };

  useEffect(() => {
    signInWithEmailAndPassword(auth, "seisuma2@gmail.com", "Seisuma2")
      .then((userCredential) => setUser(userCredential.user))
      .catch((error) => console.error("ログイン失敗:", error));
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "transactions"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      data.sort((a, b) => (b.date ? b.date.toMillis() : 0) - (a.date ? a.date.toMillis() : 0));
      setTransactions(data);
    });

    const unsubscribeSettings = onSnapshot(doc(db, "user_settings", user.uid), (document) => {
      if (document.exists()) {
        const data = document.data();
        setStealthConfig(prev => ({
          ...prev,
          ghostAccounts: data.stealthAccounts || []
        }));
      }
    });

    return () => { unsubscribe(); unsubscribeSettings(); };
  }, [user]);

  useEffect(() => {
    localStorage.setItem('stealthActive', stealthConfig.active);
  }, [stealthConfig.active]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleGhostAccount = async (account, isChecked) => {
    const newGhostAccounts = isChecked
      ? [...stealthConfig.ghostAccounts, account]
      : stealthConfig.ghostAccounts.filter(a => a !== account);

    setStealthConfig(prev => ({ ...prev, ghostAccounts: newGhostAccounts }));

    if (user) {
      try {
        await setDoc(doc(db, "user_settings", user.uid), {
          stealthAccounts: newGhostAccounts
        }, { merge: true }); 
      } catch (error) {
        console.error("設定保存エラー:", error);
      }
    }
  };

  // 🌟 検閲 兼 データ偽装処理
  const displayTransactions = transactions.map(tx => {
    if (!stealthConfig.active) return tx; 

    const isFromGhost = stealthConfig.ghostAccounts.includes(tx.paymentMethod);
    const isToGhost = tx.type === 'transfer' && stealthConfig.ghostAccounts.includes(tx.category);

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

  const uniqueAccounts = [...new Set(transactions.map(tx => tx.paymentMethod).filter(Boolean))];

  // 🌟 設定されたサイクルに基づく期間計算ロジック
  const cyclePeriod = useMemo(() => {
    const now = new Date();
    const sd = cycleStartDay;
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    let startDate, endDate;

    if (sd === 1) {
      startDate = new Date(year, month, 1, 0, 0, 0);
      endDate = new Date(year, month + 1, 0, 23, 59, 59);
    } else if (day >= sd) {
      startDate = new Date(year, month, sd, 0, 0, 0);
      endDate = new Date(year, month + 1, sd - 1, 23, 59, 59);
    } else {
      startDate = new Date(year, month - 1, sd, 0, 0, 0);
      endDate = new Date(year, month, sd - 1, 23, 59, 59);
    }

    let monthlyIncome = 0; 
    let monthlyExpense = 0;

    displayTransactions.forEach(tx => {
      if (!tx.date) return;
      const txDate = tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
      if (txDate >= startDate && txDate <= endDate) {
        if (tx.type === 'income') monthlyIncome += (tx.amount || 0);
        if (tx.type === 'expense') monthlyExpense += (tx.amount || 0);
      }
    });

    const netIncome = monthlyIncome - monthlyExpense;
    const isSurplus = netIncome >= 0;

    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    const label = `${fmt(startDate)} - ${fmt(endDate)}`;

    return { startDate, endDate, monthlyIncome, monthlyExpense, netIncome, isSurplus, label };
  }, [displayTransactions, cycleStartDay]);

  const tabTitles = {
    'home': '総合', 'calendar': 'カレンダー', 'balance': '総合残高', 'input': ' クイック入力',
    'income-expense': '収支確認', 'category': 'カテゴリ別', 'playground': '遊び場', 'bs-pl': 'BS / PL',
    'map': ' マップ','feed': ' 情報傍受'
  };

  const ghostList = stealthConfig.active ? stealthConfig.ghostAccounts : [];

  // コックピットOSモード時
  if (!isMobile && desktopMode === 'os') {
    return (
      <DesktopCockpitOS
        transactions={displayTransactions}
        ghostAccounts={ghostList}
        onSwitchMode={() => switchMode('standard')}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', backgroundColor: '#0a0c10', color: '#fff', fontFamily: 'sans-serif', overflow: 'hidden', position: 'relative' }}>
      
      {!isMobile && <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />}

      <div style={{ flex: 1, padding: isMobile ? '15px' : '30px', overflowY: 'auto', width: '100%', paddingBottom: isMobile ? '80px' : '30px' }}>
        
        {/* 🌟 サイクル変更可能な共通ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #252838', paddingBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', color: '#fff' }}>{tabTitles[currentTab] || '開発中...'}</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* 🌟 サイクル期間ボタン（タップで集計日変更） */}
            <button
              onClick={() => { setTempCycleDay(cycleStartDay); setIsCycleModalOpen(true); }}
              style={{
                background: 'rgba(0, 255, 102, 0.08)',
                border: '1px solid rgba(0, 255, 102, 0.3)',
                color: '#00ff66',
                padding: '5px 12px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '12px',
                fontFamily: 'monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                boxShadow: '0 0 10px rgba(0, 255, 102, 0.1)'
              }}
              title="集計期間を変更"
            >
              <span>🗓️</span> サイクル ({cyclePeriod.label})
            </button>

            {!isMobile && (
              <button
                onClick={() => switchMode('os')}
                style={{
                  background: 'linear-gradient(45deg, #00ff6622, #00bfff22)',
                  border: '1px solid #00ff66',
                  color: '#00ff66',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(0, 255, 102, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <span>🖥️</span> コックピットOSへ
              </button>
            )}

            <div style={{ fontSize: '12px', fontWeight: 'bold', border: `1px solid ${isOnline ? (user ? '#00bfff' : '#ff3366') : '#ff9900'}`, padding: '4px 8px', borderRadius: '4px', color: isOnline ? (user ? '#00bfff' : '#ff3366') : '#ff9900' }}>
              {isOnline ? (user ? '🟢 接続済 (SYNC)' : '🔴 切断') : '📡 オフライン (LOCAL)'}
            </div>
          </div>
        </div>

        <div>
          {currentTab === 'home' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '15px' : '25px' }}>
              {/* 🌟 サイクル計算済みの数値をSummaryPanelへ引き渡す */}
              <SummaryPanel 
                currentMonth={cyclePeriod.label} 
                monthlyIncome={cyclePeriod.monthlyIncome} 
                monthlyExpense={cyclePeriod.monthlyExpense} 
                netIncome={cyclePeriod.netIncome} 
                isSurplus={cyclePeriod.isSurplus} 
                isStealthMode={stealthConfig.active && stealthConfig.hideSummary} 
                isMobile={isMobile} 
              />
              
             <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '15px' : '25px' }}>
                <div style={{ flex: 2, minWidth: 0 }}>
                  <BalanceChart transactions={displayTransactions} ghostAccounts={[]} />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: isMobile ? '15px' : '25px' }}>
                  <CategoryChart transactions={displayTransactions} />
                  {!isMobile && <TopNewsWidget onClickViewAll={() => setCurrentTab('feed')} />}
                  <NebulaCore netIncome={cyclePeriod.netIncome} isStealthMode={stealthConfig.active && stealthConfig.hideSummary} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '15px' : '25px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '15px' }}>
                  <div onClick={() => setCurrentTab('input')} style={quickAccessStyle('#00ff66')}>
                    <div style={{ fontSize: isMobile ? '20px' : '30px', marginBottom: '5px' }}>✏️</div>
                    <div style={{ color: '#00ff66', fontWeight: 'bold', fontSize: isMobile ? '12px' : '16px' }}>入力フォーム</div>
                  </div>
                  <div onClick={() => setCurrentTab('balance')} style={quickAccessStyle('#ff9900')}>
                    <div style={{ fontSize: isMobile ? '20px' : '30px', marginBottom: '5px' }}>🔒</div>
                    <div style={{ color: '#ff9900', fontWeight: 'bold', fontSize: isMobile ? '12px' : '16px' }}>残高管理</div>
                  </div>
                  <div onClick={() => setCurrentTab('playground')} style={quickAccessStyle('#b666ff')}>
                    <div style={{ fontSize: isMobile ? '20px' : '30px', marginBottom: '5px' }}>🌌</div>
                    <div style={{ color: '#b666ff', fontWeight: 'bold', fontSize: isMobile ? '12px' : '16px' }}>遊び場</div>
                  </div>
                  <div onClick={() => setCurrentTab('map')} style={quickAccessStyle('#ff3366')}>
                   <div style={{ fontSize: isMobile ? '20px' : '30px', marginBottom: '5px' }}>📍</div>
                  <div style={{ color: '#ff3366', fontWeight: 'bold', fontSize: isMobile ? '12px' : '16px' }}>トラッカー</div>
                  </div>
                </div>
                
                <div style={{ flex: 2, minWidth: 0 }}>
                   <TransactionList transactions={displayTransactions} isStealthMode={stealthConfig.active && stealthConfig.hideHistory} isMobile={isMobile} />
                </div>
              </div>
            </div>
          )}

          {currentTab === 'input' && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '600px' }}>
              <div style={{ width: '100%', maxWidth: '400px', border: '1px solid #00ff66', borderRadius: '12px', boxShadow: '0 0 30px rgba(0,255,102,0.1)' }}>
                <MobileInputForm />
              </div>
            </div>
          )}

          {currentTab === 'calendar' && <CalendarView transactions={displayTransactions} />}
          {currentTab === 'balance' && <BalanceChart transactions={displayTransactions} ghostAccounts={[]} />}
          {currentTab === 'bs-pl' && <BSPLStatement transactions={displayTransactions} isStealthMode={stealthConfig.active && stealthConfig.hideSummary} />}
          {currentTab === 'income-expense' && <IncomeExpense transactions={displayTransactions} isStealthMode={stealthConfig.active && stealthConfig.hideHistory} />}
          {currentTab === 'category' && <CategoryBreakdown transactions={displayTransactions} isStealthMode={stealthConfig.active && stealthConfig.hideHistory} />}
          {currentTab === 'playground' && <Playground transactions={displayTransactions} isStealthMode={stealthConfig.active && stealthConfig.hideSummary} />}
          {currentTab === 'map' && <MoneyFlowMap transactions={displayTransactions} />}
          {currentTab === 'feed' && <NewsFeed />}
        </div>
      </div>

      {/* 🌟 共通サイクル設定モーダル */}
      {isCycleModalOpen && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, width: '320px', border: '1px solid #00ff66' }}>
            <h3 style={{ margin: 0, color: '#00ff66', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🗓️</span> 集計サイクル設定
            </h3>
            <p style={{ color: '#aaa', fontSize: '12px', lineHeight: '1.4', margin: '10px 0' }}>
              給料日などを基準に、1ヶ月の集計の区切り日を設定します。<br/>
              <span style={{ color: '#666' }}>(例: 25日設定 ➔ 毎月25日〜翌月24日)</span>
            </p>
            
            <div style={{ display: 'flex', alignItems: 'center', background: '#11141a', border: '1px solid #333', borderRadius: '6px', padding: '10px', margin: '15px 0' }}>
              <span style={{ color: '#888', fontSize: '14px', flex: 1 }}>毎月</span>
              <input 
                type="number" min="1" max="31" value={tempCycleDay} 
                onChange={(e) => setTempCycleDay(e.target.value)} 
                style={{ width: '80px', background: 'transparent', border: 'none', borderBottom: '2px solid #00ff66', color: '#00ff66', fontSize: '24px', fontWeight: 'bold', textAlign: 'center', outline: 'none', fontFamily: 'monospace' }} 
              />
              <span style={{ color: '#888', fontSize: '14px', paddingLeft: '8px' }}>日 開始</span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsCycleModalOpen(false)} style={{ ...btnStyle('#aaa'), flex: 1 }}>キャンセル</button>
              <button 
                onClick={() => {
                  const val = parseInt(tempCycleDay, 10);
                  if (val >= 1 && val <= 31) {
                    setCycleStartDay(val);
                    localStorage.setItem('m402_cycle_start_day', val);
                    setIsCycleModalOpen(false);
                  } else { alert("1〜31の数字を入力してください。"); }
                }} 
                style={{ ...btnStyle('#00ff66'), flex: 1, background: '#00ff66', color: '#000', fontWeight: 'bold' }}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', background: '#11141a', borderTop: '1px solid #252838', display: 'flex', justifyContent: 'space-around', padding: '10px 0', zIndex: 100, backdropFilter: 'blur(10px)' }}>
          <BottomTab icon="🏠" label="総合" isActive={currentTab === 'home'} onClick={() => setCurrentTab('home')} />
          <BottomTab icon="✏️" label="入力" isActive={currentTab === 'input'} onClick={() => setCurrentTab('input')} />
          <BottomTab icon="💰" label="収支" isActive={currentTab === 'income-expense'} onClick={() => setCurrentTab('income-expense')} />
          <BottomTab icon="📊" label="分析" isActive={currentTab === 'category'} onClick={() => setCurrentTab('category')} />
        </div>
      )}

      {isAuthModalOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ color: '#ff3366', marginTop: 0 }}>⚠️ SYSTEM OVERRIDE</h3>
            <p style={{ color: '#aaa', fontSize: '14px' }}>認証パスコード</p>
            <input type="password" autoFocus value={stealthPassword} onChange={(e) => setStealthPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAuth()} style={inputStyle} />
          </div>
        </div>
      )}
      {isConfigModalOpen && (
        <div style={overlayStyle}>
          <div style={{...modalStyle, maxHeight: '80vh', overflowY: 'auto', width: '90%', maxWidth: '400px'}}>
            <h3 style={{ color: '#00ff66', marginTop: 0 }}>🕶️ ステルス制御</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0' }}>
              <span style={{ color: stealthConfig.active ? '#00ff66' : '#aaa' }}>稼働状況</span>
              <button onClick={() => setStealthConfig(prev => ({ ...prev, active: !prev.active }))} style={toggleBtnStyle(stealthConfig.active, '#00ff66')}>{stealthConfig.active ? 'ON' : 'OFF'}</button>
            </div>
            <ConfigRow label="サマリー・コア" configKey="hideSummary" stealthConfig={stealthConfig} setStealthConfig={setStealthConfig} />
            <ConfigRow label="口座別残高" configKey="hideCartridges" stealthConfig={stealthConfig} setStealthConfig={setStealthConfig} />
            <ConfigRow label="履歴・カテゴリ" configKey="hideHistory" stealthConfig={stealthConfig} setStealthConfig={setStealthConfig} />
            <div style={{ marginTop: '20px', borderTop: '1px solid #ff3366', paddingTop: '10px' }}>
              <div style={{ color: '#ff3366', fontSize: '14px', marginBottom: '10px' }}>☠️ ゴースト口座</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {uniqueAccounts.map(account => (
                  <label key={account} style={{ fontSize: '12px', background: stealthConfig.ghostAccounts.includes(account) ? '#ff336622' : '#1a1d24', padding: '6px 10px', borderRadius: '4px', border: `1px solid ${stealthConfig.ghostAccounts.includes(account) ? '#ff3366' : '#252838'}` }}>
                    <input type="checkbox" checked={stealthConfig.ghostAccounts.includes(account)} onChange={(e) => toggleGhostAccount(account, e.target.checked)} style={{ display: 'none' }} />
                    {stealthConfig.ghostAccounts.includes(account) ? '' : ''} {account}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={() => setIsConfigModalOpen(false)} style={{ ...btnStyle('#00bfff'), width: '100%', marginTop: '20px' }}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}

const quickAccessStyle = (color) => ({ flex: 1, background: '#11141a', border: `1px solid ${color}`, borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', padding: '15px 0' });
const overlayStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(5px)' };
const modalStyle = { background: '#0a0c10', padding: '20px', borderRadius: '8px', border: '1px solid #ff3366' };
const inputStyle = { width: '100%', padding: '10px', background: '#11141a', color: '#ff3366', border: '1px solid #ff3366', borderRadius: '4px', textAlign: 'center', fontSize: '18px', letterSpacing: '2px' };
const btnStyle = (color) => ({ padding: '10px', background: 'transparent', color: color, border: `1px solid ${color}`, borderRadius: '4px', cursor: 'pointer' });
const toggleBtnStyle = (isActive, color) => ({ background: isActive ? color : 'transparent', color: isActive ? '#000' : '#aaa', border: `1px solid ${isActive ? color : '#555'}`, padding: '4px 12px', borderRadius: '4px' });

function ConfigRow({ label, configKey, stealthConfig, setStealthConfig }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '12px' }}>
      <span style={{ color: '#fff' }}>{label}</span>
      <input type="checkbox" checked={stealthConfig[configKey]} onChange={() => setStealthConfig(prev => ({ ...prev, [configKey]: !prev[configKey] }))} />
    </div>
  );
}

function BottomTab({ icon, label, isActive, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', fontStyle: 'normal', alignItems: 'center', cursor: 'pointer', color: isActive ? '#00ff66' : '#555', transition: 'color 0.2s' }}>
      <div style={{ fontSize: '20px', marginBottom: '2px', textShadow: isActive ? '0 0 10px #00ff66' : 'none' }}>{icon}</div>
      <div style={{ fontSize: '10px', fontWeight: isActive ? 'bold' : 'normal' }}>{label}</div>
    </div>
  );
}

export default App;