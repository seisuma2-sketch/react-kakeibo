import { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
// 🌟 変更点: signInWithEmailAndPassword を消し、signOut をインポート
import { signOut } from 'firebase/auth'; 
import { db, auth } from './firebase';

import MobileInputForm from './components/MobileInputForm';
import BalanceChart from './components/BalanceChart';
import NewsFeed from './components/NewsFeed';
import MobileTransactionList from './components/MobileTransactionList';
import NebulaCore3D from './components/NebulaCore3D';
import AuthScreen from './components/AuthScreen'; // 🌟 認証画面コンポーネント

const THEMES = {
  neon: { name: 'NEON GREEN', color: '#00ff66' },
  cyber: { name: 'CYBER BLUE', color: '#00bfff' },
  alert: { name: 'ALERT RED', color: '#ff3366' },
  void: { name: 'VOID PURPLE', color: '#b666ff' }
};

export default function MobileApp() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [currentTab, setCurrentTab] = useState('input'); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [uiMode, setUiMode] = useState(() => localStorage.getItem('mobileUiMode') || 'morph');
  useEffect(() => localStorage.setItem('mobileUiMode', uiMode), [uiMode]);
  
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem('mobileAppTheme') || 'neon');
  useEffect(() => localStorage.setItem('mobileAppTheme', appTheme), [appTheme]);
  const themeColor = THEMES[appTheme].color;

  const [isStealthActive, setIsStealthActive] = useState(() => {
    const saved = localStorage.getItem('stealthActiveMobile');
    return saved !== null ? saved === 'true' : true;
  });
  useEffect(() => localStorage.setItem('stealthActiveMobile', isStealthActive), [isStealthActive]);
  const [stealthAccounts, setStealthAccounts] = useState([]); 

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  const holdStartTimerRef = useRef(null); 
  const [isListening, setIsListening] = useState(false); 

  // 🌟 変更点: ログイン監視（自動ログインを廃止し、Firebaseの認証状態を監視）
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
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
      if (document.exists()) setStealthAccounts(document.data().stealthAccounts || []);
    });
    return () => { 
      unsubscribeTx(); 
      unsubscribeSettings(); 
      stopSnappingDetection(); 
    };
  }, [user]);

  // 🌟 新機能: ログアウト処理（システム切断）
  const handleLogout = async () => {
    if (window.confirm("システムから切断（ログアウト）しますか？")) {
      try {
        await signOut(auth);
        setIsMenuOpen(false); // メニューを閉じる
      } catch (error) {
        console.error("ログアウトエラー:", error);
        alert("システムの切断に失敗しました。");
      }
    }
  };

  const toggleStealth = () => {
    if (!isStealthActive) {
      setIsStealthActive(true); alert("🔒 ゴーストプロトコルを再起動しました");
    } else {
      const pw = prompt("パスコードを入力してください");
      if (pw === "0000") { setIsStealthActive(false); alert("🔓 ゴーストプロトコルを解除しました"); } 
      else if (pw !== null) { alert("❌ パスコードが違います"); }
    }
  };

  const triggerStealthUnlock = () => {
    setIsStealthActive(false);
    stopSnappingDetection();
    if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
    alert("🔓 SYSTEM ACCESS GRANTED (SNAP_DETECTION_CONFIRMED)");
  };

  // 指パッチン検出処理...
  const startSnappingDetection = async () => {
    if (isListening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256; 
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      microphoneRef.current = microphone;
      setIsListening(true);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let lastVolume = 0;

      const detect = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let total = 0;
        for (let i = 0; i < bufferLength; i++) total += dataArray[i];
        const volume = total / bufferLength;

        const highFreqStart = Math.floor(bufferLength * 0.5);
        let highFreqTotal = 0;
        for (let i = highFreqStart; i < bufferLength; i++) highFreqTotal += dataArray[i];
        const highFreqVolume = highFreqTotal / (bufferLength - highFreqStart);

        const volumeDiff = volume - lastVolume;

        if (volumeDiff > 35 && highFreqVolume > 55) {
          triggerStealthUnlock();
          return; 
        }

        lastVolume = volume;
        animationFrameRef.current = requestAnimationFrame(detect);
      };

      animationFrameRef.current = requestAnimationFrame(detect);
    } catch (err) {
      console.error("マイク接続エラー（ステルスロック維持）:", err);
    }
  };

  const stopSnappingDetection = () => {
    setIsListening(false);
    if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
    if (microphoneRef.current) { microphoneRef.current.disconnect(); microphoneRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
  };

  const handleStartHold = (e, tabLabel) => {
    if (!isStealthActive) return; 
    if (uiMode === '2d' && tabLabel !== '残高') return;
    if (uiMode !== '2d' && tabLabel !== '3D_CORE_HUD') return;
    holdStartTimerRef.current = setTimeout(() => { startSnappingDetection(); }, 3000);
  };

  const handleEndHold = () => {
    if (holdStartTimerRef.current) clearTimeout(holdStartTimerRef.current); 
    stopSnappingDetection(); 
  };

  const pointerStartRef = useRef({ x: 0, y: 0, time: 0 });
  const isDraggingRef = useRef(false);

  const handle3DPointerDown = (e) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    isDraggingRef.current = false;
    handleStartHold(e, '3D_CORE_HUD');
  };

  const handle3DPointerMove = (e) => {
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    if (dx > 10 || dy > 10) {
      isDraggingRef.current = true;
      handleEndHold(); 
    }
  };

  const handle3DPointerUp = (e) => {
    handleEndHold(); 
    const dx = e.clientX - pointerStartRef.current.x;
    const dt = Date.now() - pointerStartRef.current.time;
    const tabs = ['input', 'balance', 'history', 'feed'];
    const currentIndex = tabs.indexOf(currentTab);

    if (Math.abs(dx) > 50) {
      if (dx > 0) setCurrentTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
      else setCurrentTab(tabs[(currentIndex + 1) % tabs.length]);
    } else if (!isDraggingRef.current && dt < 500) {
      setCurrentTab(tabs[(currentIndex + 1) % tabs.length]);
    }
  };

  const safeTransactions = transactions.map(tx => {
    if (!isStealthActive) return tx;
    const isFromGhost = stealthAccounts.includes(tx.paymentMethod);
    const isToGhost = tx.type === 'transfer' && stealthAccounts.includes(tx.category);
    if (tx.type === 'transfer') {
      if (isFromGhost && !isToGhost) return { ...tx, type: 'income', paymentMethod: tx.category, category: '不明な入金', memo: '---' };
      if (!isFromGhost && isToGhost) return { ...tx, type: 'expense', category: '不明な出費', memo: '---' };
    }
    if (isFromGhost || isToGhost) return null;
    return tx;
  }).filter(Boolean);

  const ghostAccountsList = isStealthActive ? stealthAccounts : [];

  // 🌟 変更点: ユーザーが存在しない（未ログイン）場合は認証画面を表示する絶対防壁
  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0a0c10', color: '#fff', fontFamily: 'sans-serif', position: 'relative' }}>
      
      {/* 🚀 ヘッダーバー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', background: '#11141a', borderBottom: `1px solid ${themeColor}44`, zIndex: 10 }}>
        <div onClick={() => setIsMenuOpen(true)} style={{ fontSize: '24px', cursor: 'pointer', color: themeColor, textShadow: `0 0 10px ${themeColor}` }}>
          ☰
        </div>
        <div 
          onClick={() => {
            if (!isStealthActive) {
              setIsStealthActive(true); 
              if (navigator.vibrate) navigator.vibrate(200); 
              alert("🔒 ゴーストプロトコルを再起動しました");
            }
          }}
          style={{ 
            fontWeight: 'bold', letterSpacing: '3px', color: '#fff', fontSize: '14px', 
            cursor: !isStealthActive ? 'pointer' : 'default',
            animation: !isStealthActive ? 'pulse 1.5s infinite ease-in-out' : 'none'
          }}
        >
          M402 <span style={{ color: themeColor }}>家計簿</span>
        </div>
        <div style={{ width: '24px' }}></div>
      </div>

      {/* 🚀 サイドメニュー（コントロールパネル） */}
      {isMenuOpen && (
        <>
          <div onClick={() => setIsMenuOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 9998 }} />
          <div style={{ position: 'fixed', top: 0, left: 0, width: '80%', maxWidth: '300px', height: '100vh', background: '#0a0c10', borderRight: `1px solid ${themeColor}`, boxShadow: `5px 0 30px ${themeColor}33`, zIndex: 9999, padding: '30px 20px', display: 'flex', flexDirection: 'column', gap: '40px', animation: 'slideIn 0.3s ease-out' }}>
            <style>{`@keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
            
            <div><h2 style={{ margin: 0, fontSize: '18px', color: '#fff', borderBottom: `1px solid ${themeColor}44`, paddingBottom: '10px' }}>設定</h2></div>
            
            <div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', fontWeight: 'bold' }}>タブバ―モード変更</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => setUiMode('2d')} style={menuBtnStyle(uiMode === '2d', themeColor)}> 2Dモード</button>
                <button onClick={() => setUiMode('morph')} style={menuBtnStyle(uiMode === 'morph', themeColor)}> 3Dモード</button>
                <button onClick={() => setUiMode('particle')} style={menuBtnStyle(uiMode === 'particle', themeColor)}> 3D粒子モード</button>
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', fontWeight: 'bold' }}>テーマ変更</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {Object.keys(THEMES).map(key => (
                  <div key={key} onClick={() => setAppTheme(key)} style={{ border: `1px solid ${appTheme === key ? THEMES[key].color : '#333'}`, background: appTheme === key ? `${THEMES[key].color}22` : '#111', padding: '10px', borderRadius: '6px', textAlign: 'center', cursor: 'pointer', color: appTheme === key ? THEMES[key].color : '#666', fontWeight: 'bold', fontSize: '10px', transition: 'all 0.2s', boxShadow: appTheme === key ? `0 0 10px ${THEMES[key].color}44` : 'none' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: THEMES[key].color, margin: '0 auto 5px auto', boxShadow: `0 0 5px ${THEMES[key].color}` }} />
                    {key.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            {/* 🌟 変更点: ログアウトボタンをメニュー下部に追加 */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <button 
                onClick={handleLogout} 
                style={{ width: '100%', padding: '15px', background: 'rgba(255, 51, 102, 0.1)', color: '#ff3366', border: '1px solid #ff3366', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', textShadow: '0 0 5px #ff3366' }}
              >
                ログアウト
              </button>
              <button onClick={() => setIsMenuOpen(false)} style={{ width: '100%', padding: '15px', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer' }}>
                閉じる
               </button>
            </div>

          </div>
        </>
      )}

      {/* メインコンテンツ */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {currentTab === 'input' && <MobileInputForm />}
        {currentTab === 'balance' && (
          <div style={{ padding: '20px' }}>
            <div style={{ borderBottom: '1px solid #252838', paddingBottom: '10px', marginBottom: '15px', marginTop: 0 }}>
              <h2 onDoubleClick={toggleStealth} style={{ fontSize: '18px', margin: 0, userSelect: 'none', cursor: 'default' }}> 口座・決済手段別の現在高</h2>
            </div>
            <BalanceChart transactions={safeTransactions} ghostAccounts={ghostAccountsList} />
          </div>
        )}
        {currentTab === 'history' && <MobileTransactionList transactions={safeTransactions} />}
        {currentTab === 'feed' && <NewsFeed />}
      </div>

      {/* 🚀 ハイブリッド・タブバーエリア */}
      {uiMode === '2d' ? (
        <div style={{ background: '#11141a', borderTop: `1px solid ${themeColor}44`, display: 'flex', justifyContent: 'space-around', padding: '10px 0', paddingBottom: '20px', alignItems: 'center', position: 'relative' }}>
          <BottomTab icon="/S__32194589.jpg" label="入力" isActive={currentTab === 'input'} onClick={() => setCurrentTab('input')} themeColor={themeColor} />        
          <BottomTab 
            icon="/S__32194590.jpg" label="残高" 
            isActive={currentTab === 'balance'} 
            onClick={() => setCurrentTab('balance')} 
            themeColor={themeColor} 
            onPointerDown={(e) => handleStartHold(e, '残高')}
            onPointerUp={handleEndHold}
            onPointerLeave={handleEndHold}
          />
          <BottomTab icon="/S__32194591.jpg" label="履歴" isActive={currentTab === 'history'} onClick={() => setCurrentTab('history')} themeColor={themeColor} />
          <BottomTab icon="/S__32194592.jpg" label="情報" isActive={currentTab === 'feed'} onClick={() => setCurrentTab('feed')} themeColor={themeColor} />
        </div>
      ) : (
        <div style={{ background: '#11141a', borderTop: `1px solid ${themeColor}44`, paddingBottom: '20px', zIndex: 100, position: 'relative' }}>
          <div 
            onPointerDown={handle3DPointerDown}
            onPointerMove={handle3DPointerMove}
            onPointerUp={handle3DPointerUp}
            onPointerLeave={handleEndHold} 
            style={{ 
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
              zIndex: 10, cursor: 'pointer', 
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'none' 
            }}
          />
          <NebulaCore3D currentTab={currentTab} setCurrentTab={setCurrentTab} uiMode={uiMode} setUiMode={setUiMode} />
        </div>
      )}
      
    </div>
  );
}

const menuBtnStyle = (isActive, themeColor) => ({ background: isActive ? `${themeColor}22` : '#11141a', color: isActive ? themeColor : '#888', border: `1px solid ${isActive ? themeColor : '#333'}`, padding: '12px 15px', borderRadius: '8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', boxShadow: isActive ? `0 0 10px ${themeColor}33` : 'none' });

function BottomTab({ icon, label, isActive, onClick, themeColor, onPointerDown, onPointerUp, onPointerLeave }) {
  const isImage = icon.includes('.png') || icon.includes('.svg') || icon.includes('.jpg');

  return (
    <div 
      onClick={onClick} 
      onPointerDown={onPointerDown} 
      onPointerUp={onPointerUp} 
      onPointerLeave={onPointerLeave}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', opacity: isActive ? 1 : 0.4, transition: 'all 0.2s', width: '60px', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}>
      {isImage ? (
        <img src={icon} alt={label} style={{ width: '40px', height: '38px', objectFit: 'contain', marginBottom: '4px', filter: isActive ? `drop-shadow(0 0 8px ${themeColor})` : 'grayscale(100%) opacity(70%)', pointerEvents: 'none' }} />
      ) : (
        <div style={{ fontSize: '24px', marginBottom: '4px', pointerEvents: 'none' }}>{icon}</div>
      )}
      <div style={{ fontSize: '10px', color: isActive ? themeColor : '#666', fontWeight: 'bold', textShadow: isActive ? `0 0 5px ${themeColor}` : 'none', pointerEvents: 'none' }}>{label}</div>
    </div>
  );
}