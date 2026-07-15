import { useEffect, useState, useRef, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from './firebase';

import MobileInputForm from './components/MobileInputForm';
import BalanceChart from './components/BalanceChart';
import NewsFeed from './components/NewsFeed';
import MobileTransactionList from './components/MobileTransactionList';
import NebulaCore3D from './components/NebulaCore3D';

// 🎨 テーマカラー
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
  const [uiMode, setUiMode] = useState(() => localStorage.getItem('mobileUiMode') || 'morph'); // 3Dコアを初期に
  useEffect(() => localStorage.setItem('mobileUiMode', uiMode), [uiMode]);
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem('mobileAppTheme') || 'neon');
  useEffect(() => localStorage.setItem('mobileAppTheme', appTheme), [appTheme]);
  const themeColor = THEMES[appTheme].color;

  // 🌟 ステルスシステム State
  const [isStealthActive, setIsStealthActive] = useState(() => {
    const saved = localStorage.getItem('stealthActiveMobile');
    return saved !== null ? saved === 'true' : true;
  });
  useEffect(() => localStorage.setItem('stealthActiveMobile', isStealthActive), [isStealthActive]);
  const [stealthAccounts, setStealthAccounts] = useState([]); 

  // 🌟 🔐 生体認証ホールド用 State
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100
  const [isHolding, setIsHolding] = useState(false);  // 指が置かれているか
  const [isHoldCompleted, setIsHoldCompleted] = useState(false); // 100%溜まったか（指を離して認証呼び出し可能か）
  const [isBiometricVerifying, setIsBiometricVerifying] = useState(false); // 生体認証プロンプトが表示されているか
  
  // タイマー管理用Ref
  const holdTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 }); // タップ開始位置

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
      if (document.exists()) setStealthAccounts(document.data().stealthAccounts || []);
    });
    return () => { unsubscribeTx(); unsubscribeSettings(); };
  }, [user]);

  // 既存のダブルタップ切り替え（生体認証なし）
  const toggleStealth = () => {
    if (!isStealthActive) {
      setIsStealthActive(true); alert("🔒 ゴーストプロトコルを再起動しました");
    } else {
      const pw = prompt("パスコードを入力してください");
      if (pw === "0000") { setIsStealthActive(false); alert("🔓 ゴーストプロトコルを解除しました"); } 
      else if (pw !== null) { alert("❌ パスコードが違います"); }
    }
  };

  // 🌟 🔐 生体認証呼び出しロジック (WebAuthn API)
  const authenticateWithBiometrics = async () => {
    if (!navigator.credentials || !navigator.credentials.get) {
      alert("❌ このデバイスは生体認証に対応していません（またはHTTPS環境ではありません）");
      return;
    }

    try {
      setIsBiometricVerifying(true); // 検証中State

      // 🌟 WebAuthn API を直接呼び出す
      // スパイ感演出のためのローカル設定
      const publicKeyCredentialRequestOptions = {
        challenge: Uint8Array.from("ダミーのチャレンジ文字列 (Nebula OS Access)", c => c.charCodeAt(0)), 
        allowCredentials: [], // 空にすることで、デバイスに登録されているPasskey（生体認証）を要求する
        userVerification: "required", // 生体認証（Face IDなど）を必須にする
        timeout: 60000,
      };

      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      });

      if (credential) {
        // 🔓 認証成功！
        setIsStealthActive(false);
        
        // 🔊 ハッカー演出：バイブレーション（iPhoneはPasskey認証成功時にシステム標準の短い振動が鳴ります）
        // Vibration APIはSafariでは動作しない可能性があるが、システム標準が鳴るのでOK
        if (navigator.vibrate) {
          navigator.vibrate([100]); 
        }
        
        alert("🔓 ゴーストプロトコルを解除しました (FaceID)");
      }

    } catch (err) {
      console.error("生体認証エラー:", err);
      if (err.name === "NotAllowedError") {
        alert("❌ 認証がキャンセルされました");
      } else {
        alert(`❌ 認証中にエラーが発生しました: ${err.message}`);
      }
    } finally {
      setIsBiometricVerifying(false);
      setHoldProgress(0); // プログレスバーをリセット
    }
  };

  // 🌟 🔐 ホールド検知ロジック (ポインターイベント)
  const handleStartHold = (e, tabLabel) => {
    // ロック中、かつ3Dモードの時、または通常モードで「残高」タブのみ有効
    if (!isStealthActive) return;
    if (uiMode === '2d' && tabLabel !== '残高') return;

    // 3Dモードの時は、Canvas上の透明なオーバーレイで検知
    if (uiMode !== '2d') {
      // 3DモードではCanvasの右下のHUDスイッチを長押しする体験に
      if (tabLabel !== '3D_CORE_HUD') return;
    }

    setIsHolding(true);
    setHoldProgress(0);
    setIsHoldCompleted(false);

    // 1秒かけてプログレスバーを進めるタイマー
    holdTimerRef.current = setInterval(() => {
      setHoldProgress(prev => {
        const next = prev + 5; // 50msごとに5%増やす (1000msで100%)
        if (next >= 100) {
          clearInterval(holdTimerRef.current);
          setIsHoldCompleted(true); // 🌟 1秒経ったら指を離して認証呼び出し可能に
          return 100;
        }
        return next;
      });
    }, 50); // 50msごとに実行
  };

  const handleEndHold = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
    }
    
    // 🌟 指を離した瞬間、100%に達していたら生体認証を呼び出す（これならユーザーのジェスチャーとしてSafariが通す）
    if (isHoldCompleted) {
      setIsHoldCompleted(false);
      setIsHolding(false);
      authenticateWithBiometrics();
    } else {
      // 100%未満で離した場合はリセット
      setIsHolding(false);
      setHoldProgress(0);
      setIsHoldCompleted(false);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0a0c10', color: '#fff', fontFamily: 'sans-serif', position: 'relative' }}>
      
      {/* 🚀 ヘッダーバー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', background: '#11141a', borderBottom: `1px solid ${themeColor}44`, zIndex: 10 }}>
        <div onClick={() => setIsMenuOpen(true)} style={{ fontSize: '24px', cursor: 'pointer', color: themeColor, textShadow: `0 0 10px ${themeColor}` }}>
          ☰
        </div>
        <div style={{ fontWeight: 'bold', letterSpacing: '3px', color: '#fff', fontSize: '14px' }}>NEBULA <span style={{ color: themeColor }}>OS</span></div>
        <div style={{ width: '24px' }}></div>
      </div>

      {/* 🚀 サイドメニュー */}
      {isMenuOpen && (
        <>
          <div onClick={() => setIsMenuOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 9998 }} />
          <div style={{ position: 'fixed', top: 0, left: 0, width: '80%', maxWidth: '300px', height: '100vh', background: '#0a0c10', borderRight: `1px solid ${themeColor}`, boxShadow: `5px 0 30px ${themeColor}33`, zIndex: 9999, padding: '30px 20px', display: 'flex', flexDirection: 'column', gap: '40px', animation: 'slideIn 0.3s ease-out' }}>
            <style>{`@keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
            <div><h2 style={{ margin: 0, fontSize: '18px', color: '#fff', borderBottom: `1px solid ${themeColor}44`, paddingBottom: '10px' }}>⚙️ SYSTEM CONFIG</h2></div>
            <div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', fontWeight: 'bold' }}>UI NAVIGATION MODE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => setUiMode('2d')} style={menuBtnStyle(uiMode === '2d', themeColor)}>📱 2D CLASSIC</button>
                <button onClick={() => setUiMode('morph')} style={menuBtnStyle(uiMode === 'morph', themeColor)}>🧊 3D MORPHING</button>
                <button onClick={() => setUiMode('particle')} style={menuBtnStyle(uiMode === 'particle', themeColor)}>🌌 3D PARTICLE</button>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', fontWeight: 'bold' }}>SYSTEM THEME COLOR</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {Object.keys(THEMES).map(key => (
                  <div key={key} onClick={() => setAppTheme(key)} style={{ border: `1px solid ${appTheme === key ? THEMES[key].color : '#333'}`, background: appTheme === key ? `${THEMES[key].color}22` : '#111', padding: '10px', borderRadius: '6px', textAlign: 'center', cursor: 'pointer', color: appTheme === key ? THEMES[key].color : '#666', fontWeight: 'bold', fontSize: '10px', transition: 'all 0.2s', boxShadow: appTheme === key ? `0 0 10px ${THEMES[key].color}44` : 'none' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: THEMES[key].color, margin: '0 auto 5px auto', boxShadow: `0 0 5px ${THEMES[key].color}` }} />
                    {key.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 'auto' }}><button onClick={() => setIsMenuOpen(false)} style={{ width: '100%', padding: '15px', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer' }}>CLOSE</button></div>
          </div>
        </>
      )}

      {/* メインコンテンツ */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {currentTab === 'input' && <MobileInputForm />}
        {currentTab === 'balance' && (
          <div style={{ padding: '20px' }}>
            <div style={{ borderBottom: '1px solid #252838', paddingBottom: '10px', marginBottom: '15px', marginTop: 0 }}>
              <h2 onDoubleClick={toggleStealth} style={{ fontSize: '18px', margin: 0, userSelect: 'none', cursor: 'default' }}>🏦 口座・決済手段別の現在高</h2>
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
          
          {/* 🌟 🔐 通常2Dモードの「残高」タブにホールドイベントを装着！ */}
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
          
          {/* 🌟 🔐 3Dモードの時は、 Canvas全体の上に透明なオーバーレイを置いて長押し検知 */}
          {isStealthActive && (
            <div 
              onPointerDown={(e) => handleStartHold(e, '3D_CORE_HUD')}
              onPointerUp={handleEndHold}
              onPointerLeave={handleEndHold}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 110, cursor: 'pointer' }}
              title="HOLD TO ACTIVATE FaceID"
            />
          )}

          <NebulaCore3D currentTab={currentTab} setCurrentTab={setCurrentTab} uiMode={uiMode} setUiMode={setUiMode} />
        </div>
      )}

      {/* 🌟 🔐 生体認証オーバーレイ (長押し中・検証中) */}
      {(isHolding || isBiometricVerifying) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          zIndex: 99999, animation: 'fadeIn 0.2s forwards' // 最高のZIndexで表示
        }}>
          <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
          <style>{`@keyframes blink { 0% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }`}</style>
          
          <div style={{ position: 'relative', width: '140px', height: '140px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            
            {/* 🔮 円形のプログレスバー (SVG) */}
            <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#333" strokeWidth="2" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={themeColor} strokeWidth="2" strokeDasharray={`${holdProgress}, 100`}
                style={{ transition: 'stroke-dasharray 0.05s linear', strokeShadow: `0 0 10px ${themeColor}`, animation: isHoldCompleted ? 'blink 0.5s infinite ease-in-out' : 'none' }}
              />
            </svg>
            
            {/* 🔮 中央のアイコン・テキスト */}
            <div style={{ position: 'absolute', color: themeColor, fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'center', textShadow: `0 0 10px ${themeColor}` }}>
              {isBiometricVerifying ? (
                <div><span style={{ fontSize: '40px' }}>👁️</span><br/>[VERIFYING...]</div>
              ) : isHoldCompleted ? (
                <div style={{ animation: 'blink 0.5s infinite ease-in-out' }}><span style={{ fontSize: '40px' }}>离</span><br/>[RELEASE]</div>
              ) : (
                <div><span style={{ fontSize: '40px' }}>🔒</span><br/>{holdProgress}%<br/>[HOLD]</div>
              )}
            </div>
          </div>
          
          <div style={{ color: themeColor, marginTop: '20px', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', textShadow: `0 0 10px ${themeColor}`, animation: isHoldCompleted ? 'blink 0.5s infinite ease-in-out' : 'none' }}>
            AUTHENTICATING...
          </div>
          <div style={{ color: '#666', marginTop: '10px', fontSize: '12px' }}>
            {isHoldCompleted ? '指を離して生体認証を呼び出します' : '長押ししてFaceIDを起動'}
          </div>
        
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
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', opacity: isActive ? 1 : 0.4, transition: 'all 0.2s', width: '60px' }}>
      {isImage ? (
        <img src={icon} alt={label} style={{ width: '40px', height: '38px', objectFit: 'contain', marginBottom: '4px', filter: isActive ? `drop-shadow(0 0 8px ${themeColor})` : 'grayscale(100%) opacity(70%)' }} />
      ) : (
        <div style={{ fontSize: '24px', marginBottom: '4px' }}>{icon}</div>
      )}
      <div style={{ fontSize: '10px', color: isActive ? themeColor : '#666', fontWeight: 'bold', textShadow: isActive ? `0 0 5px ${themeColor}` : 'none' }}>{label}</div>
    </div>
  );
}