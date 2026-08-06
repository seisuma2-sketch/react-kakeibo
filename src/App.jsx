import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc, addDoc, Timestamp } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
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
  const [isTxLoaded, setIsTxLoaded] = useState(false); 
  const [currentTab, setCurrentTab] = useState('home');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [stealthPassword, setStealthPassword] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [authMode, setAuthMode] = useState('login'); 
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);

  const [userName, setUserName] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [tempUserName, setTempUserName] = useState('');

  // 🌟 初回起動ウィザード用の複数登録State
  const [hasSkippedBoot, setHasSkippedBoot] = useState(false);
  const [setupAccounts, setSetupAccounts] = useState([{ name: '', balance: '' }]);
  const [activeSuggestIndex, setActiveSuggestIndex] = useState(null);
  const [isBooting, setIsBooting] = useState(false);
  
  const majorBanks = ['現金', '三菱UFJ銀行', '三井住友銀行', 'みずほ銀行', 'ゆうちょ銀行', 'りそな銀行', '楽天銀行', '住信SBIネット銀行', 'PayPay銀行', 'ソニー銀行', 'イオン銀行', 'PayPay', 'au PAY', 'd払い'];

  const [desktopMode, setDesktopMode] = useState(() => {
    return localStorage.getItem('desktopDashMode') || 'standard';
  });

  const switchMode = (mode) => {
    setDesktopMode(mode);
    localStorage.setItem('desktopDashMode', mode);
  };

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsProcessingAuth(true);

    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      } else {
        await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
      }
    } catch (err) {
      if (authMode === 'login') {
        setLoginError('認証エラー：IDまたはパスワードが違います。');
      } else {
        setLoginError('登録エラー：パスワードが短いか、既に使われています。');
      }
      setIsProcessingAuth(false);
    }
  };

  const handleAuth = () => {
    if (stealthPassword === CORRECT_PASSWORD) {
      setIsAuthModalOpen(false); setStealthPassword(''); setIsConfigModalOpen(true);
    } else {
      alert('❌ ACCESS DENIED'); setStealthPassword('');
    }
  };

  const handleSaveProfile = async () => {
    setUserName(tempUserName);
    setIsProfileModalOpen(false);
    if (user) {
      await setDoc(doc(db, "user_settings", user.uid), { userName: tempUserName }, { merge: true });
    }
  };

  const handleCancelProfile = async () => {
    setIsProfileModalOpen(false);
    if (!userName && user) {
      await setDoc(doc(db, "user_settings", user.uid), { userName: "" }, { merge: true });
    }
  };

  // 🌟 初回ウィザード：複数口座を一気にデータベースへ送信する処理
  const handleBootSubmit = async () => {
    const validAccounts = setupAccounts.filter(acc => acc.name && acc.balance);
    if (validAccounts.length === 0 || !user) return;
    
    setIsBooting(true);
    try {
      const currentAccounts = JSON.parse(localStorage.getItem('m402_accounts') || '[]');
      let updatedAccounts = [...currentAccounts];

      const promises = validAccounts.map(acc => {
        const txData = {
          userId: user.uid,
          type: 'income',
          amount: Number(acc.balance),
          category: '初期設定 (INIT)',
          paymentMethod: acc.name,
          memo: 'INITIAL SYSTEM BOOT',
          date: Timestamp.now(),
          createdAt: Timestamp.now()
        };
        
        // フォームにも自動で追加
        if (!updatedAccounts.includes(acc.name) && !updatedAccounts.some(existing => existing.includes(acc.name))) {
          updatedAccounts.push(`/icon-other.png ${acc.name}`);
        }

        return addDoc(collection(db, "transactions"), txData);
      });

      await Promise.all(promises);
      localStorage.setItem('m402_accounts', JSON.stringify(updatedAccounts));
      setHasSkippedBoot(true);
    } catch (error) {
      console.error(error);
      alert("初期化エラーが発生しました。");
    } finally {
      setIsBooting(false);
    }
  };

  const handleSaveCycle = async () => {
    const val = parseInt(tempCycleDay, 10);
    if (val >= 1 && val <= 31) {
      setCycleStartDay(val);
      localStorage.setItem('m402_cycle_start_day', val);
      setIsCycleModalOpen(false);
      if (user) {
        await setDoc(doc(db, "user_settings", user.uid), { cycleStartDay: val }, { merge: true });
      }
    } else {
      alert("1〜31の数字を入力してください。");
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "transactions"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      data.sort((a, b) => (b.date ? b.date.toMillis() : 0) - (a.date ? a.date.toMillis() : 0));
      setTransactions(data);
      setIsTxLoaded(true); 
    });

    const unsubscribeSettings = onSnapshot(doc(db, "user_settings", user.uid), (document) => {
      if (document.exists()) {
        const data = document.data();
        setStealthConfig(prev => ({ ...prev, ghostAccounts: data.stealthAccounts || [] }));
        if (data.userName !== undefined) setUserName(data.userName);
        else setIsProfileModalOpen(true);
        if (data.cycleStartDay) {
          setCycleStartDay(data.cycleStartDay);
          localStorage.setItem('m402_cycle_start_day', data.cycleStartDay);
        }
      } else {
        setIsProfileModalOpen(true);
      }
    });

    return () => { unsubscribe(); unsubscribeSettings(); };
  }, [user]);

  useEffect(() => { localStorage.setItem('stealthActive', stealthConfig.active); }, [stealthConfig.active]);

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
      try { await setDoc(doc(db, "user_settings", user.uid), { stealthAccounts: newGhostAccounts }, { merge: true }); } 
      catch (error) { console.error("設定保存エラー:", error); }
    }
  };

  const displayTransactions = transactions.map(tx => {
    if (!stealthConfig.active) return tx; 
    const isFromGhost = stealthConfig.ghostAccounts.includes(tx.paymentMethod);
    const isToGhost = tx.type === 'transfer' && stealthConfig.ghostAccounts.includes(tx.category);

    if (tx.type === 'transfer') {
      if (isFromGhost && !isToGhost) return { ...tx, type: 'income', paymentMethod: tx.category, category: '不明な入金', memo: '---' };
      if (!isFromGhost && isToGhost) return { ...tx, type: 'expense', category: '不明な出費', memo: '---' };
    }
    if (isFromGhost || isToGhost) return null;
    return tx;
  }).filter(Boolean); 

  const uniqueAccounts = [...new Set(transactions.map(tx => tx.paymentMethod).filter(Boolean))];

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

    let monthlyIncome = 0; let monthlyExpense = 0;
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

  const showBootWizard = isTxLoaded && transactions.length === 0 && !hasSkippedBoot;

  if (isAuthChecking) {
    return (
      <div style={{ height: '100vh', background: '#050608', color: '#00ff66', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace', fontSize: '18px' }}>
        <div style={{ animation: 'pulse 1.5s infinite' }}>[SYSTEM] CHECKING AUTHENTICATION...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', background: '#050608', color: '#00ff66', fontFamily: 'monospace', overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ flex: 1.2, borderRight: '1px solid #00ff6644', background: 'radial-gradient(circle at center, #11141a 0%, #050608 100%)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '60px' }}>
            <div style={{ zIndex: 10 }}>
              <div style={{ fontSize: '14px', color: '#00bfff', letterSpacing: '2px', marginBottom: '10px' }}>SECURE ACCESS PROTOCOL ONLINE</div>
              <h1 style={{ fontSize: '48px', margin: '0 0 20px 0', textShadow: '0 0 20px rgba(0,255,102,0.5)', lineHeight: '1.1' }}>
                M402 // FINANCIAL <br/> COCKPIT OS
              </h1>
              <p style={{ color: '#aaa', fontSize: '14px', maxWidth: '400px', lineHeight: '1.6' }}>
                高度な暗号化と予測モジュールを備えた個人資産防衛システム。
                このターミナルを通じて、全資金の流動を監視・コントロールします。
                未登録のアクセスはプロトコルに従い遮断されます。
              </p>
            </div>
            <div style={{ marginTop: 'auto', zIndex: 10 }}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                <div style={{ padding: '10px 15px', border: '1px solid #00ff66', color: '#00ff66', borderRadius: '4px', fontSize: '12px' }}>STATUS: OPTIMAL</div>
                <div style={{ padding: '10px 15px', border: '1px solid #00bfff', color: '#00bfff', borderRadius: '4px', fontSize: '12px' }}>NODE: CONNECTED</div>
              </div>
              <div style={{ fontSize: '10px', color: '#555' }}>
                &gt; INITIALIZING ENCRYPTION ALGORITHMS... OK<br/>
                &gt; CONNECTING TO SATELLITE NETWORK... OK<br/>
                &gt; WAITING FOR USER AUTHENTICATION...
              </div>
            </div>
            <div style={{ position: 'absolute', right: '-10%', top: '-10%', width: '600px', height: '600px', border: '1px dashed rgba(0, 255, 102, 0.1)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', right: '5%', top: '5%', width: '400px', height: '400px', border: '1px dashed rgba(0, 191, 255, 0.1)', borderRadius: '50%', pointerEvents: 'none' }} />
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '30px', position: 'relative', background: '#0a0c10' }}>
          <form onSubmit={handleAuthSubmit} style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '25px', zIndex: 10 }}>
            {isMobile && (
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <h1 style={{ fontSize: '28px', margin: 0, textShadow: '0 0 15px rgba(0,255,102,0.5)' }}>M402 OS</h1>
                <div style={{ fontSize: '10px', color: '#00bfff', letterSpacing: '2px', marginTop: '5px' }}>SECURE ACCESS PROTOCOL</div>
              </div>
            )}

            <div style={{ display: 'flex', borderBottom: '2px solid #252838', marginBottom: '10px' }}>
              <button type="button" onClick={() => { setAuthMode('login'); setLoginError(''); }} style={{ flex: 1, background: 'transparent', border: 'none', color: authMode === 'login' ? '#00ff66' : '#666', padding: '15px 10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', borderBottom: authMode === 'login' ? '3px solid #00ff66' : 'none', transition: 'all 0.2s', fontFamily: 'monospace' }}>LOGIN</button>
              <button type="button" onClick={() => { setAuthMode('register'); setLoginError(''); }} style={{ flex: 1, background: 'transparent', border: 'none', color: authMode === 'register' ? '#00bfff' : '#666', padding: '15px 10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', borderBottom: authMode === 'register' ? '3px solid #00bfff' : 'none', transition: 'all 0.2s', fontFamily: 'monospace' }}>REGISTER</button>
            </div>

            {loginError && (
              <div style={{ color: '#ff3366', fontSize: '13px', background: 'rgba(255,51,102,0.1)', padding: '12px', border: '1px solid #ff3366', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ <span>{loginError}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa', fontWeight: 'bold' }}>[ IDENTITY ] E-MAIL ADDRESS</div>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="agent@m402.com" style={{ width: '100%', padding: '15px', background: '#11141a', border: `1px solid ${authMode === 'login' ? '#00ff6644' : '#00bfff44'}`, color: '#fff', borderRadius: '6px', outline: 'none', boxSizing: 'border-box', fontSize: '16px', transition: 'border-color 0.2s' }} required />
              </div>
              
              <div>
                <div style={{ fontSize: '12px', marginBottom: '8px', color: '#aaa', fontWeight: 'bold' }}>[ KEY ] SECURITY PASSWORD</div>
                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '15px', background: '#11141a', border: `1px solid ${authMode === 'login' ? '#00ff6644' : '#00bfff44'}`, color: '#fff', borderRadius: '6px', outline: 'none', boxSizing: 'border-box', fontSize: '16px', transition: 'border-color 0.2s', letterSpacing: '2px' }} required />
              </div>
            </div>

            <button type="submit" disabled={isProcessingAuth} style={{ padding: '18px', background: authMode === 'login' ? '#00ff66' : '#00bfff', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '18px', cursor: isProcessingAuth ? 'not-allowed' : 'pointer', marginTop: '10px', boxShadow: isProcessingAuth ? 'none' : `0 0 20px ${authMode === 'login' ? 'rgba(0,255,102,0.4)' : 'rgba(0,191,255,0.4)'}`, transition: 'all 0.2s', fontFamily: 'monospace' }}>
              {isProcessingAuth ? 'AUTHENTICATING...' : (authMode === 'login' ? '⚡ INITIATE LOGIN' : '✨ CREATE SYSTEM NODE')}
            </button>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#555', marginTop: '10px' }}>&copy; 2026 M402 CYBERNETIC FINANCE CORP.</div>
          </form>
        </div>
      </div>
    );
  }

  if (!isMobile && desktopMode === 'os') {
    return (
      <DesktopCockpitOS transactions={displayTransactions} ghostAccounts={ghostList} onSwitchMode={() => switchMode('standard')} />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', backgroundColor: '#0a0c10', color: '#fff', fontFamily: 'sans-serif', overflow: 'hidden', position: 'relative' }}>
      
      {!isMobile && (
        <Sidebar 
          currentTab={currentTab} 
          setCurrentTab={setCurrentTab} 
          userName={userName} 
          onOpenProfile={() => { setTempUserName(userName); setIsProfileModalOpen(true); }} 
        />
      )}

      <div style={{ flex: 1, padding: isMobile ? '15px' : '30px', overflowY: 'auto', width: '100%', paddingBottom: isMobile ? '80px' : '30px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #252838', paddingBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {tabTitles[currentTab] || '開発中...'}
              
              {isMobile && (
                <button 
                  onClick={() => { setTempUserName(userName); setIsProfileModalOpen(true); }} 
                  title="プロフィール設定"
                  style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', padding: 0, opacity: 0.6, transition: 'all 0.2s', filter: 'grayscale(100%) brightness(1.5)' }} 
                >
                  ⚙️
                </button>
              )}
            </h2>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => { setTempCycleDay(cycleStartDay); setIsCycleModalOpen(true); }} style={{ background: 'rgba(0, 255, 102, 0.08)', border: '1px solid rgba(0, 255, 102, 0.3)', color: '#00ff66', padding: '5px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', fontFamily: 'monospace', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', boxShadow: '0 0 10px rgba(0, 255, 102, 0.1)' }} title="集計期間を変更">
              <span>🗓️</span> サイクル ({cyclePeriod.label})
            </button>
            {!isMobile && (
              <button onClick={() => switchMode('os')} style={{ background: 'linear-gradient(45deg, #00ff6622, #00bfff22)', border: '1px solid #00ff66', color: '#00ff66', padding: '5px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', boxShadow: '0 0 10px rgba(0, 255, 102, 0.2)', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
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
              <SummaryPanel currentMonth={cyclePeriod.label} monthlyIncome={cyclePeriod.monthlyIncome} monthlyExpense={cyclePeriod.monthlyExpense} netIncome={cyclePeriod.netIncome} isSurplus={cyclePeriod.isSurplus} isStealthMode={stealthConfig.active && stealthConfig.hideSummary} isMobile={isMobile} />
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
                  <div onClick={() => setCurrentTab('input')} style={quickAccessStyle('#00ff66')}><div style={{ fontSize: isMobile ? '20px' : '30px', marginBottom: '5px' }}>✏️</div><div style={{ color: '#00ff66', fontWeight: 'bold', fontSize: isMobile ? '12px' : '16px' }}>入力フォーム</div></div>
                  <div onClick={() => setCurrentTab('balance')} style={quickAccessStyle('#ff9900')}><div style={{ fontSize: isMobile ? '20px' : '30px', marginBottom: '5px' }}>🔒</div><div style={{ color: '#ff9900', fontWeight: 'bold', fontSize: isMobile ? '12px' : '16px' }}>残高管理</div></div>
                  <div onClick={() => setCurrentTab('playground')} style={quickAccessStyle('#b666ff')}><div style={{ fontSize: isMobile ? '20px' : '30px', marginBottom: '5px' }}>🌌</div><div style={{ color: '#b666ff', fontWeight: 'bold', fontSize: isMobile ? '12px' : '16px' }}>遊び場</div></div>
                  <div onClick={() => setCurrentTab('map')} style={quickAccessStyle('#ff3366')}><div style={{ fontSize: isMobile ? '20px' : '30px', marginBottom: '5px' }}>📍</div><div style={{ color: '#ff3366', fontWeight: 'bold', fontSize: isMobile ? '12px' : '16px' }}>トラッカー</div></div>
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

      {/* 🌟 複数口座登録対応の INITIAL BOOT WIZARD */}
      {(!isProfileModalOpen && showBootWizard) && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, width: '420px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid #00ff66', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 0 40px rgba(0,255,102,0.3)' }}>
            <h3 style={{ margin: 0, color: '#00ff66', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace' }}>
              <span style={{ animation: 'spin 4s linear infinite' }}>⚙️</span> INITIAL BOOT PROTOCOL
            </h3>
            <div style={{ color: '#aaa', fontSize: '12px', lineHeight: '1.5', paddingBottom: '10px', borderBottom: '1px dashed #333' }}>
              システム内に資金データが存在しません。<br/>
              メインの資金ノード（銀行口座または現金）と、現在の初期残高を登録してください。複数登録可能です。
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {setupAccounts.map((acc, index) => {
                const filteredBanks = activeSuggestIndex === index && acc.name ? majorBanks.filter(b => b.includes(acc.name) && b !== acc.name) : [];
                return (
                  <div key={index} style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: '1px solid #252838', position: 'relative' }}>
                    
                    {setupAccounts.length > 1 && (
                      <button 
                        onClick={() => setSetupAccounts(setupAccounts.filter((_, i) => i !== index))} 
                        style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: '#ff3366', fontSize: '16px', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    )}
                    
                    <div style={{ position: 'relative', marginBottom: '15px' }}>
                      <div style={{ fontSize: '12px', color: '#00bfff', marginBottom: '5px', fontWeight: 'bold' }}>[{index + 1}] BANK NODE (口座・現金名)</div>
                      <input
                        type="text"
                        value={acc.name}
                        onChange={e => {
                          const newAccs = [...setupAccounts];
                          newAccs[index].name = e.target.value;
                          setSetupAccounts(newAccs);
                        }}
                        onFocus={() => setActiveSuggestIndex(index)}
                        onBlur={() => setTimeout(() => setActiveSuggestIndex(null), 200)}
                        placeholder="例: 三菱UFJ銀行 / 現金"
                        style={{ width: '100%', padding: '12px', background: '#11141a', color: '#fff', border: '1px solid #00bfff', borderRadius: '6px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
                      />
                      {activeSuggestIndex === index && filteredBanks.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#1a1d24', border: '1px solid #00bfff', borderRadius: '4px', zIndex: 10, maxHeight: '150px', overflowY: 'auto', marginTop: '4px', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
                          {filteredBanks.map(b => (
                            <div 
                              key={b} 
                              onClick={() => { 
                                const newAccs = [...setupAccounts];
                                newAccs[index].name = b;
                                setSetupAccounts(newAccs);
                                setActiveSuggestIndex(null); 
                              }}
                              style={{ padding: '10px', fontSize: '12px', color: '#fff', cursor: 'pointer', borderBottom: '1px solid #333' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#00bfff33'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              {b}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ opacity: acc.name ? 1 : 0.3, pointerEvents: acc.name ? 'auto' : 'none', transition: 'all 0.3s' }}>
                      <div style={{ fontSize: '12px', color: '#ff9900', marginBottom: '5px', fontWeight: 'bold' }}>INITIAL BALANCE (現在の残高)</div>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#11141a', border: '1px solid #ff9900', borderRadius: '6px', padding: '0 10px' }}>
                        <span style={{ color: '#ff9900', fontSize: '18px', fontWeight: 'bold' }}>¥</span>
                        <input
                          type="number"
                          value={acc.balance}
                          onChange={e => {
                            const newAccs = [...setupAccounts];
                            newAccs[index].balance = e.target.value;
                            setSetupAccounts(newAccs);
                          }}
                          placeholder="100000"
                          style={{ width: '100%', padding: '12px 10px', background: 'transparent', color: '#ff9900', border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: '20px', fontWeight: 'bold' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              onClick={() => setSetupAccounts([...setupAccounts, { name: '', balance: '' }])}
              style={{ width: '100%', padding: '10px', background: 'transparent', color: '#00bfff', border: '1px dashed #00bfff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', fontFamily: 'monospace' }}
            >
              + NODE追加 (口座をさらに登録)
            </button>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button 
                onClick={() => setHasSkippedBoot(true)} 
                style={{ padding: '12px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', flex: 1 }}
              >
                SKIP
              </button>
              <button 
                onClick={handleBootSubmit} 
                disabled={!setupAccounts.some(acc => acc.name && acc.balance) || isBooting}
                style={{ padding: '12px', background: (!setupAccounts.some(acc => acc.name && acc.balance) || isBooting) ? '#333' : '#00ff66', color: '#000', border: 'none', borderRadius: '6px', cursor: (!setupAccounts.some(acc => acc.name && acc.balance) || isBooting) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px', flex: 2, boxShadow: (!setupAccounts.some(acc => acc.name && acc.balance) || isBooting) ? 'none' : '0 0 15px rgba(0,255,102,0.4)', transition: 'all 0.3s' }}
              >
                {isBooting ? 'BOOTING...' : 'SYSTEM BOOT ⚡'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isProfileModalOpen && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, width: '320px', border: '1px solid #00bfff' }}>
            <h3 style={{ margin: 0, color: '#00bfff', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>👤</span> AGENT PROFILE // ユーザー設定
            </h3>
            <p style={{ color: '#aaa', fontSize: '12px', lineHeight: '1.4', margin: '10px 0 15px 0' }}>
              システム上で表示するエージェント名（ユーザーネーム）を設定してください。未入力でも稼働可能です。
            </p>
            <input
              type="text"
              value={tempUserName}
              onChange={(e) => setTempUserName(e.target.value)}
              placeholder="例: JOHN DOE"
              style={{ width: '100%', boxSizing: 'border-box', background: '#11141a', border: '1px solid #00bfff55', color: '#fff', padding: '12px', borderRadius: '6px', fontSize: '16px', outline: 'none', fontFamily: 'monospace', marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleCancelProfile} style={{ ...btnStyle('#aaa'), flex: 1 }}>キャンセル</button>
              <button onClick={handleSaveProfile} style={{ ...btnStyle('#00bfff'), flex: 1, background: '#00bfff', color: '#000', fontWeight: 'bold' }}>登録・保存</button>
            </div>
          </div>
        </div>
      )}

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
              <input type="number" min="1" max="31" value={tempCycleDay} onChange={(e) => setTempCycleDay(e.target.value)} style={{ width: '80px', background: 'transparent', border: 'none', borderBottom: '2px solid #00ff66', color: '#00ff66', fontSize: '24px', fontWeight: 'bold', textAlign: 'center', outline: 'none', fontFamily: 'monospace' }} />
              <span style={{ color: '#888', fontSize: '14px', paddingLeft: '8px' }}>日 開始</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsCycleModalOpen(false)} style={{ ...btnStyle('#aaa'), flex: 1 }}>キャンセル</button>
              <button onClick={handleSaveCycle} style={{ ...btnStyle('#00ff66'), flex: 1, background: '#00ff66', color: '#000', fontWeight: 'bold' }}>保存</button>
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
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
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