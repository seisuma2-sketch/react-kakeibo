import { useEffect, useState, useRef } from 'react';
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
  const [uiMode, setUiMode] = useState(() => localStorage.getItem('mobileUiMode') || 'morph');
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

  // 🌟 🎙️ 指パッチン検知（Web Audio API）用 Ref & State
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  const holdStartTimerRef = useRef(null); // 3秒長押しでマイクを起動するためのタイマー
  const [isListening, setIsListening] = useState(false); // マイク起動状態の内部管理用（画面には一切出さない）

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
    return () => { 
      unsubscribeTx(); 
      unsubscribeSettings(); 
      stopSnappingDetection(); // クリーンアップ時に確実にマイクを解放
    };
  }, [user]);

  // 🔓 予備用の手動パスコード解除（ダブルタップ）
  const toggleStealth = () => {
    if (!isStealthActive) {
      setIsStealthActive(true); alert("🔒 ゴーストプロトコルを再起動しました");
    } else {
      const pw = prompt("パスコードを入力してください");
      if (pw === "0000") { setIsStealthActive(false); alert("🔓 ゴーストプロトコルを解除しました"); } 
      else if (pw !== null) { alert("❌ パスコードが違います"); }
    }
  };

  // 🌟 🔓 ロック解除実行（指パッチン成功時）
  const triggerStealthUnlock = () => {
    setIsStealthActive(false);
    stopSnappingDetection();
    
    // 🔊 ハッカー演出：iPhoneや端末を「ブルッ、ブルッ」と短く2回バイブレーションさせる
    if (navigator.vibrate) {
      navigator.vibrate([80, 50, 80]);
    }
    
    // システムログ風のアラートをコッソリ表示
    alert("🔓 SYSTEM ACCESS GRANTED (SNAP_DETECTION_CONFIRMED)");
  };

  // 🌟 🎙️ 音響解析・指パッチン検出処理（完全ステルス起動）
  const startSnappingDetection = async () => {
    if (isListening) return;

    try {
      // マイクのアクセスを要求してストリームを開始
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256; // リアルタイム性を高めるために小さめのバッファにする
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

        // 音量（全体の平均値）の算出
        let total = 0;
        for (let i = 0; i < bufferLength; i++) {
          total += dataArray[i];
        }
        const volume = total / bufferLength;

        // 高音域成分の算出（周波数帯域の後半部分を抽出）
        const highFreqStart = Math.floor(bufferLength * 0.5);
        let highFreqTotal = 0;
        for (let i = highFreqStart; i < bufferLength; i++) {
          highFreqTotal += dataArray[i];
        }
        const highFreqVolume = highFreqTotal / (bufferLength - highFreqStart);

        // 前のフレームからの「音量の立ち上がりの急激さ」を測定
        const volumeDiff = volume - lastVolume;

        // 🌟 指パッチン（スナップ）の特徴分析
        // 「急激に音が立ち上がり（音量の差分 > 35）」かつ「高音域の成分が異常に強い（高域音量 > 55）」を判定
        if (volumeDiff > 35 && highFreqVolume > 55) {
          triggerStealthUnlock();
          return; // 検出したらループを即終了
        }

        lastVolume = volume;
        animationFrameRef.current = requestAnimationFrame(detect);
      };

      animationFrameRef.current = requestAnimationFrame(detect);

    } catch (err) {
      console.error("マイク接続エラー（ステルスロック維持）:", err);
    }
  };

  // 🎙️ 音響解析の安全な停止処理
  const stopSnappingDetection = () => {
    setIsListening(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
      microphoneRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // 🌟 ⏱️ タップ・長押し（ホールド）開始処理
  const handleStartHold = (e, tabLabel) => {
    if (!isStealthActive) return; // 解除済みなら長押しイベントをスルー

    // 2Dモードなら「残高」タブ、3Dモードなら画面下の透明オーバーレイ全体を対象にする
    if (uiMode === '2d' && tabLabel !== '残高') return;
    if (uiMode !== '2d' && tabLabel !== '3D_CORE_HUD') return;

    // 3000ms（3秒）以上押し続けたタイミングで、裏マイクをコッソリ起動
    holdStartTimerRef.current = setTimeout(() => {
      startSnappingDetection();
    }, 3000);
  };

  // ⏱️ タップ終了（離した・離脱した）処理
  const handleEndHold = () => {
    if (holdStartTimerRef.current) {
      clearTimeout(holdStartTimerRef.current); // 3秒以内に離した場合はタイマーを即座に破棄
    }
    stopSnappingDetection(); // 指を離した時点でマイクも検知ループも安全にシャットダウン
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
          
          {/* 🌟 🔐 通常2Dモード：残高タブを3〜5秒長押ししている間に指パッチンを待ち受ける */}
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
          
          {/* 🌟 🔐 3Dモード：Canvasの上面を3〜5秒長押ししている間に指パッチンを待ち受ける透明レイヤー */}
          {isStealthActive && (
            <div 
              onPointerDown={(e) => handleStartHold(e, '3D_CORE_HUD')}
              onPointerUp={handleEndHold}
              onPointerLeave={handleEndHold}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 110, cursor: 'pointer' }}
            />
          )}

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
      style={{ 
        display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', 
        opacity: isActive ? 1 : 0.4, transition: 'all 0.2s', width: '60px',
        // 🌟 ハッキング：iPhoneの「長押しメニュー」と「テキスト選択」を完全に無効化する呪文
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}>
      {isImage ? (
        <img 
          src={icon} 
          alt={label} 
          style={{ 
            width: '40px', height: '38px', objectFit: 'contain', marginBottom: '4px', 
            filter: isActive ? `drop-shadow(0 0 8px ${themeColor})` : 'grayscale(100%) opacity(70%)',
            // 🌟 画像自体のドラッグやタップ判定を消し、親のdivに判定を全て任せる
            pointerEvents: 'none' 
          }} 
        />
      ) : (
        <div style={{ fontSize: '24px', marginBottom: '4px', pointerEvents: 'none' }}>{icon}</div>
      )}
      <div style={{ fontSize: '10px', color: isActive ? themeColor : '#666', fontWeight: 'bold', textShadow: isActive ? `0 0 5px ${themeColor}` : 'none', pointerEvents: 'none' }}>
        {label}
      </div>
    </div>
  );
}