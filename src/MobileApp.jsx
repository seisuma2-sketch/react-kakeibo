import { useEffect, useState, useRef, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore'; 
import { signOut } from 'firebase/auth'; 
import { db, auth } from './firebase';

import MobileInputForm from './components/MobileInputForm';
import BalanceChart from './components/BalanceChart';
import MoneyFlowMap from './components/MoneyFlowMap';
import MobileTransactionList from './components/MobileTransactionList';
import MobileCalendar from './components/MobileCalendar';
import NebulaCore3D from './components/NebulaCore3D';
import AuthScreen from './components/AuthScreen';
import DailyBriefingOverlay from './components/DailyBriefingOverlay';
import NfcSettingsModal from './components/NfcSettingsModal';
import { applyCloudSettingsToLocal, syncLocalSettingsToCloud } from './utils/cloudSync';
import { getStealthDisguisedTransactions } from './utils/stealthHelper';

const THEMES = {
  neon: { name: 'NEON GREEN', color: '#00ff66' },
  cyber: { name: 'CYBER BLUE', color: '#00bfff' },
  alert: { name: 'ALERT RED', color: '#ff3366' },
  void: { name: 'VOID PURPLE', color: '#b666ff' }
};

export default function MobileApp() {
  const [user, setUser] = useState(null);
  const [settingsVersion, setSettingsVersion] = useState(0);
  
  // 🌟 追加：デュアルコアシステムの核
  const [dbMode, setDbMode] = useState('personal'); // 'personal' or 'sync'
  const [familyId, setFamilyId] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [currentTab, setCurrentTab] = useState('input'); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [feedMode, setFeedMode] = useState('map');

  const [uiMode, setUiMode] = useState(() => localStorage.getItem('mobileUiMode') || '2d');
  useEffect(() => localStorage.setItem('mobileUiMode', uiMode), [uiMode]);
  
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem('mobileAppTheme') || 'neon');
  useEffect(() => localStorage.setItem('mobileAppTheme', appTheme), [appTheme]);

  // 🌟 共有モードの時は、テーマカラーを強制的に Family Sync と同じ「エメラルドグリーン」にする
  const activeThemeColor = dbMode === 'sync' ? '#00ff66' : THEMES[appTheme].color;

  const [timeTreeToken, setTimeTreeToken] = useState(() => localStorage.getItem('timeTreeToken') || '');
  const handleSaveToken = (val) => {
    setTimeTreeToken(val);
    localStorage.setItem('timeTreeToken', val);
  };

  const [isStealthActive, setIsStealthActive] = useState(() => {
    const saved = localStorage.getItem('stealthActiveMobile');
    return saved !== null ? saved === 'true' : true;
  });
  useEffect(() => localStorage.setItem('stealthActiveMobile', isStealthActive), [isStealthActive]);

  const updateStealthActive = async (newVal) => {
    setIsStealthActive(newVal);
    localStorage.setItem('stealthActiveMobile', newVal);
    if (user) {
      try {
        await setDoc(doc(db, "user_settings", user.uid), { isStealthActive: newVal }, { merge: true });
      } catch (err) {
        console.error("ステルス設定の同期に失敗:", err);
      }
    }
  };

  const [stealthAccounts, setStealthAccounts] = useState([]); 
  const [newGhostBank, setNewGhostBank] = useState('');

  const [sortKey, setSortKey] = useState(() => localStorage.getItem('sortKey') || 'amount');
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('sortOrder') || 'desc');
  useEffect(() => {
    localStorage.setItem('sortKey', sortKey);
    localStorage.setItem('sortOrder', sortOrder);
  }, [sortKey, sortOrder]);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  const holdStartTimerRef = useRef(null); 
  const [isListening, setIsListening] = useState(false); 

  const [showBriefing, setShowBriefing] = useState(false);
  const [pendingResetCard, setPendingResetCard] = useState(null);

  // 🌟 NFC / ディープリンク連携用State
  const [showNfcCyberUnlock, setShowNfcCyberUnlock] = useState(false);
  const [showNfcModal, setShowNfcModal] = useState(false);
  const [nfcToast, setNfcToast] = useState('');
  const [nfcAccount, setNfcAccount] = useState(null);
  const [nfcAutoKeypad, setNfcAutoKeypad] = useState(false);
  const [showNfcTapBanner, setShowNfcTapBanner] = useState(false);

  // 🌟 顔認証（Face ID / 生体認証）解除用State & Ref
  const [isFaceAuthModalOpen, setIsFaceAuthModalOpen] = useState(false);
  const [faceAuthStatus, setFaceAuthStatus] = useState('idle'); // 'scanning', 'camera', 'success', 'fallback', 'failed'
  const [faceAuthLog, setFaceAuthLog] = useState('');
  const [fallbackPassword, setFallbackPassword] = useState('');
  const faceVideoRef = useRef(null);
  const faceStreamRef = useRef(null);

  const balanceTapCountRef = useRef(0);
  const balanceTapTimerRef = useRef(null);

  // 🌟 NFCアクション共通実行ハンドラー
  const executeNfcAction = (actionStr) => {
    if (!actionStr) return false;
    
    // ① ゴースト口座アンロック
    if (actionStr.includes('unlock_ghost')) {
      updateStealthActive(false);
      setShowNfcCyberUnlock(true);
      setShowNfcTapBanner(false);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
      setTimeout(() => setShowNfcCyberUnlock(false), 3500);
      return true;
    }
    
    // ② クレジットカード手動精算
    if (actionStr.includes('reset_credit')) {
      const parts = actionStr.split(':');
      const card = parts.length > 1 ? parts[parts.length - 1].trim() : 'リクルートカード';
      setCurrentTab('balance');
      setPendingResetCard(card || 'リクルートカード');
      setShowNfcTapBanner(false);
      return true;
    }
    
    // ③ スマートリング即時決済入力
    if (actionStr.includes('quick_input')) {
      let account = 'EVERING';
      if (actionStr.includes('account=')) {
        const match = actionStr.match(/account=([^&]+)/);
        if (match && match[1]) account = decodeURIComponent(match[1]);
      } else {
        const parts = actionStr.split(':');
        if (parts.length > 1) account = parts[parts.length - 1].trim();
      }
      setCurrentTab('input');
      setNfcAccount(account || 'EVERING');
      setNfcAutoKeypad(true);
      setShowNfcTapBanner(false);
      return true;
    }

    // ②-2 クレジットカード精算（URL形式対応）
    if (actionStr.includes('reset_credit') && actionStr.includes('card=')) {
      const match = actionStr.match(/card=([^&]+)/);
      const card = match && match[1] ? decodeURIComponent(match[1]) : 'リクルートカード';
      setCurrentTab('balance');
      setPendingResetCard(card);
      setShowNfcTapBanner(false);
      return true;
    }
    
    return false;
  };

  // 🌟 クリップボードからNFCコードを検知して自動実行（iOSの「Appを開く」連携用）
  const checkClipboardForNfc = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && (text.startsWith('nfc:') || text.startsWith('action:') || text.includes('action='))) {
          const executed = executeNfcAction(text);
          if (executed) {
            // 実行後はクリップボードをクリアして重複起動を防止
            navigator.clipboard.writeText('');
            setShowNfcTapBanner(false);
            return;
          }
        }
      }
    } catch (e) {
      // 権限なしやバックグラウンド時は安全に無視
    }
  };

  // 🌟 バナータップ時の実行（ユーザーの直接タップなのでiOSの制限を100%パスする）
  const handleBannerNfcTrigger = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && (text.startsWith('nfc:') || text.startsWith('action:') || text.includes('action='))) {
          executeNfcAction(text);
          navigator.clipboard.writeText('');
          setShowNfcTapBanner(false);
          return;
        }
      }
    } catch (e) {
      // ignore
    }
    // クリップボードが空または読めない場合でもデフォルトでEVERING入力モードを起動
    executeNfcAction('quick_input:EVERING');
    setShowNfcTapBanner(false);
  };

  // 🌟 マウント時＆画面復帰（フォアグラウンド）時の検知
  useEffect(() => {
    // 1. URLパラメータの解析
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action) {
      if (action === 'unlock_ghost') {
        executeNfcAction('unlock_ghost');
      } else if (action === 'reset_credit') {
        const card = params.get('card') || 'リクルートカード';
        executeNfcAction(`reset_credit:${card}`);
      } else if (action === 'quick_input') {
        const account = params.get('account') || 'EVERING';
        executeNfcAction(`quick_input:${account}`);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // URLパラメータがない場合はクリップボードをチェック（PWA起動のタイミングを考慮して少し遅延）
      setTimeout(checkClipboardForNfc, 300);
    }

    // 2. ショートカットで復帰・フォーカスされた時の検知
    const handleCheck = () => {
      setTimeout(checkClipboardForNfc, 250);
    };

    const handleFocus = () => {
      handleCheck();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // ホーム画面に戻った時はNFCの一時状態とバナーを完全にリセット
        setNfcAutoKeypad(false);
        setNfcAccount(null);
        setShowNfcTapBanner(false);
      } else if (document.visibilityState === 'visible') {
        handleCheck();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // 初回タップ時にも念のためチェック
    const handleFirstTouch = () => {
      checkClipboardForNfc();
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('click', handleFirstTouch);
    };
    window.addEventListener('touchstart', handleFirstTouch, { passive: true });
    window.addEventListener('click', handleFirstTouch, { passive: true });

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('click', handleFirstTouch);
    };
  }, []);

  const triggerNfcToast = (msg) => {
    setNfcToast(msg);
    setTimeout(() => setNfcToast(''), 2500);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const todayStr = new Date().toLocaleDateString();
        const lastBriefing = localStorage.getItem('lastBriefingDate');
        if (lastBriefing !== todayStr) {
          setShowBriefing(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleBriefingComplete = () => {
    localStorage.setItem('lastBriefingDate', new Date().toLocaleDateString());
    setShowBriefing(false);
  };

  // 🌟 変更点①：ユーザー設定から familyId を取得する
  useEffect(() => {
    if (!user) return;
    const unsubscribeSettings = onSnapshot(doc(db, "user_settings", user.uid), (document) => {
      let currentFamilyId = user.uid;
      
      if (document.exists()) {
        const data = document.data();
        if (data.familyId) {
          currentFamilyId = data.familyId;
        } else {
          setDoc(doc(db, "user_settings", user.uid), { familyId: currentFamilyId }, { merge: true });
        }
        setStealthAccounts(data.stealthAccounts || []);
        if (data.isStealthActive !== undefined) {
          setIsStealthActive(data.isStealthActive);
          localStorage.setItem('stealthActiveMobile', data.isStealthActive);
        }

        // 🌟 クラウドの口座・クレカ設定をローカルへ同期
        const updated = applyCloudSettingsToLocal(data);
        if (updated) {
          setSettingsVersion(v => v + 1);
        }

        // 🌟 クラウド側にクレカ設定がまだ無く、ローカルにある場合は初回アップロード
        if (!data.creditCardSettings && localStorage.getItem('creditCardSettings')) {
          syncLocalSettingsToCloud(user.uid);
        }
      } else {
        setDoc(doc(db, "user_settings", user.uid), { familyId: currentFamilyId }, { merge: true });
        syncLocalSettingsToCloud(user.uid);
      }
      
      setFamilyId(currentFamilyId);
    });

    return () => { 
      unsubscribeSettings(); 
      stopSnappingDetection(); 
    };
  }, [user]);

  // 🌟 変更点②：デュアルコア・トランザクション取得（dbModeで取得先を切り替え）
  useEffect(() => {
    if (!user) return;
    
    let q;
    if (dbMode === 'sync') {
      if (!familyId) return;
      // 🔗 家族モード：familyIdの一致、かつ modeが'sync'のものだけを取得
      q = query(collection(db, "transactions"), where("familyId", "==", familyId), where("mode", "==", "sync"));
    } else {
      // 👤 個人モード：自分のIDのものだけを取得
      q = query(collection(db, "transactions"), where("userId", "==", user.uid));
    }

    const unsubscribeTx = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      
      // 個人モードの時は、SYNCで入力した相手のデータが混ざらないようにフィルタリング
      if (dbMode === 'personal') {
        data = data.filter(tx => tx.mode !== 'sync');
      }

      data.sort((a, b) => (b.date ? b.date.toMillis() : 0) - (a.date ? a.date.toMillis() : 0));
      setTransactions(data);
    });

    return () => unsubscribeTx();
  }, [user, familyId, dbMode]);

  const handleAddGhostBank = async () => {
    if (!newGhostBank.trim() || !user) return;
    const updated = [...stealthAccounts, newGhostBank.trim()];
    await setDoc(doc(db, "user_settings", user.uid), { stealthAccounts: updated }, { merge: true });
    setNewGhostBank('');
  };

  const handleRemoveGhostBank = async (bankToRemove) => {
    if (!user) return;
    const updated = stealthAccounts.filter(b => b !== bankToRemove);
    await setDoc(doc(db, "user_settings", user.uid), { stealthAccounts: updated }, { merge: true });
  };

  const handleLogout = async () => {
    if (window.confirm("システムから切断（ログアウト）しますか？")) {
      try {
        await signOut(auth);
        setIsMenuOpen(false); 
      } catch (error) {
        console.error("ログアウトエラー:", error);
        alert("システムの切断に失敗しました。");
      }
    }
  };

  const toggleStealth = () => {
    if (!isStealthActive) {
      updateStealthActive(true);
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    } else {
      const pw = prompt("パスコードを入力してください");
      if (pw === "0000" || pw === "cyber") {
        updateStealthActive(false);
      } else if (pw !== null) {
        alert("パスコードが違います");
      }
    }
  };

  // 🌟 誰にもバレない隠しタップハンドラー
  // 隠している時：4回タップで解除認証（Face ID）
  // 隠していない時：3回タップで即座に隠す（ステルス有効化＆パソコン連動）
  const handleBalanceQuadTap = () => {
    balanceTapCountRef.current += 1;
    if (navigator.vibrate) navigator.vibrate(20);

    if (balanceTapTimerRef.current) clearTimeout(balanceTapTimerRef.current);

    if (isStealthActive) {
      if (balanceTapCountRef.current >= 4) {
        balanceTapCountRef.current = 0;
        if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
        triggerFaceAuthSequence();
      } else {
        balanceTapTimerRef.current = setTimeout(() => {
          balanceTapCountRef.current = 0;
        }, 1200);
      }
    } else {
      if (balanceTapCountRef.current >= 3) {
        balanceTapCountRef.current = 0;
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
        updateStealthActive(true);
      } else {
        balanceTapTimerRef.current = setTimeout(() => {
          balanceTapCountRef.current = 0;
        }, 1000);
      }
    }
  };

  // 🌟 顔認証（Face ID / 生体認証）シーケンス実行
  const triggerFaceAuthSequence = async () => {
    setIsFaceAuthModalOpen(true);
    setFaceAuthStatus('scanning');
    setFaceAuthLog('[SYSTEM] INITIATING BIOMETRIC SECURITY PROTOCOL...');

    // 1. WebAuthn（端末ネイティブのFace ID / Touch ID）を試行
    if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          setFaceAuthLog('[SECURE_ENCLAVE] REQUESTING FACE ID BIOMETRIC CHALLENGE...');
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);

          let assertionSuccess = false;
          const storedCredId = localStorage.getItem('m402_ghost_face_id');

          if (storedCredId) {
            try {
              const rawId = Uint8Array.from(atob(storedCredId), c => c.charCodeAt(0));
              const assertion = await navigator.credentials.get({
                publicKey: {
                  challenge,
                  timeout: 30000,
                  allowCredentials: [{ id: rawId, type: 'public-key', transports: ['internal'] }],
                  userVerification: 'required'
                }
              });
              if (assertion) assertionSuccess = true;
            } catch (e) {
              // 取得失敗時は再作成プロンプトへ
            }
          }

          if (!assertionSuccess) {
            const credential = await navigator.credentials.create({
              publicKey: {
                challenge,
                timeout: 30000,
                rp: { name: 'M402 家計簿', id: window.location.hostname },
                user: { id: new Uint8Array([7, 7, 7, 7]), name: 'master_operator', displayName: 'Ghost Operator' },
                pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
                authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }
              }
            });
            if (credential) {
              const credStr = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
              localStorage.setItem('m402_ghost_face_id', credStr);
              assertionSuccess = true;
            }
          }

          if (assertionSuccess) {
            completeFaceAuthSuccess();
            return;
          }
        }
      } catch (err) {
        console.warn("Face ID cancelled or failed, falling back to camera:", err);
      }
    }

    // 2. WebAuthnが未対応またはキャンセルの場合はカメラによるサイバー顔スキャン演出へフォールバック
    startCameraFaceScan();
  };

  const startCameraFaceScan = async () => {
    setFaceAuthStatus('camera');
    setFaceAuthLog('[OPTICAL_FEED] STARTING NEURAL RETINA / FACE SCANNER...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } } 
      });
      faceStreamRef.current = stream;
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = stream;
        faceVideoRef.current.play();
      }
      setFaceAuthLog('[AI_VISION] TARGET LOCK // ANALYZING FACIAL CONTOURS...');
      
      // 1.8秒間のスキャン演出後に認証成功
      setTimeout(() => {
        completeFaceAuthSuccess();
      }, 1800);
    } catch (err) {
      // カメラが使えない場合はパスコードフォールバックへ
      setFaceAuthStatus('fallback');
      setFaceAuthLog('[ERROR] OPTICAL SENSOR UNAVAILABLE. OVERRIDE VIA MASTER PASSCODE.');
    }
  };

  const completeFaceAuthSuccess = () => {
    setFaceAuthStatus('success');
    setFaceAuthLog('>>> [BIOMETRIC MATCH CONFIRMED] [GHOST PROTOCOL: DISENGAGED] <<<');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    updateStealthActive(false);

    setTimeout(() => {
      closeFaceAuthModal();
    }, 1500);
  };

  const closeFaceAuthModal = () => {
    setIsFaceAuthModalOpen(false);
    setFaceAuthStatus('idle');
    setFaceAuthLog('');
    setFallbackPassword('');
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach(t => t.stop());
      faceStreamRef.current = null;
    }
  };

  const handleFallbackSubmit = (e) => {
    e?.preventDefault();
    if (fallbackPassword === "0000" || fallbackPassword === "cyber") {
      completeFaceAuthSuccess();
    } else {
      setFaceAuthLog('[ACCESS DENIED] INVALID PASSCODE.');
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  const triggerStealthUnlock = () => {
    updateStealthActive(false);
    stopSnappingDetection();
    if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
    alert("🔓 SYSTEM ACCESS GRANTED (SNAP_DETECTION_CONFIRMED)");
  };

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
    if (uiMode === '2d' && (tabLabel !== '残高' && tabLabel !== 'カレンダー')) return;
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
    const tabs = ['input', 'balance', 'calendar', 'history', 'feed'];
    const currentIndex = tabs.indexOf(currentTab);

    if (Math.abs(dx) > 50) {
      if (dx > 0) setCurrentTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
      else setCurrentTab(tabs[(currentIndex + 1) % tabs.length]);
    } else if (!isDraggingRef.current && dt < 500) {
      setCurrentTab(tabs[(currentIndex + 1) % tabs.length]);
    }
  };

  const handleFeedTabClick = () => {
    if (currentTab === 'feed') {
      setFeedMode(prev => prev === 'map' ? 'news' : 'map');
      if (navigator.vibrate) navigator.vibrate(20);
    } else {
      setCurrentTab('feed');
    }
  };

  const safeTransactions = useMemo(() => {
    return getStealthDisguisedTransactions(transactions, stealthAccounts, isStealthActive);
  }, [transactions, stealthAccounts, isStealthActive]);

  const ghostAccountsList = isStealthActive ? stealthAccounts : [];

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxHeight: '100dvh', overflow: 'hidden', backgroundColor: '#0a0c10', color: '#fff', fontFamily: 'sans-serif', position: 'relative' }}>
      
      {showBriefing && (
        <DailyBriefingOverlay 
          transactions={safeTransactions} 
          ghostAccounts={ghostAccountsList} 
          onComplete={handleBriefingComplete} 
          dbMode={dbMode}
          onOpenReset={(cardName) => {
            setCurrentTab('balance');
            setPendingResetCard(cardName);
          }}
        />
      )}

      {/* 🚀 ヘッダーバー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', background: '#11141a', borderBottom: `1px solid ${activeThemeColor}44`, zIndex: 10 }}>
        <div onClick={() => setIsMenuOpen(true)} style={{ fontSize: '24px', cursor: 'pointer', color: activeThemeColor, textShadow: `0 0 10px ${activeThemeColor}` }}>
          ☰
        </div>
        
        <div 
          onClick={handleBalanceQuadTap}
          style={{ 
            fontWeight: 'bold', letterSpacing: '3px', color: '#fff', fontSize: '14px', 
            cursor: 'default', userSelect: 'none'
          }}
        >
          M402 <span style={{ color: activeThemeColor }}>家計簿</span>
        </div>

        {/* 🌟 デュアルコア・切り替えスイッチ（スマホ版ヘッダー右側） */}
        <div style={{ display: 'flex', background: '#050608', borderRadius: '30px', padding: '3px', border: `1px solid ${activeThemeColor}`, boxShadow: `0 0 10px ${activeThemeColor}33` }}>
          <button 
            onClick={() => setDbMode('personal')}
            style={{ padding: '4px 10px', borderRadius: '26px', border: 'none', background: dbMode === 'personal' ? activeThemeColor : 'transparent', color: dbMode === 'personal' ? '#000' : '#888', fontWeight: 'bold', fontSize: '10px', cursor: 'pointer', transition: 'all 0.3s' }}
          >
            👤 個人
            [個人]
          </button>
          <button 
            onClick={() => setDbMode('sync')}
            style={{ padding: '4px 10px', borderRadius: '26px', border: 'none', background: dbMode === 'sync' ? '#00ff66' : 'transparent', color: dbMode === 'sync' ? '#000' : '#888', fontWeight: 'bold', fontSize: '10px', cursor: 'pointer', transition: 'all 0.3s' }}
          >
            [共有]
          </button>
        </div>
      </div>

      {/* 🚀 サイドメニュー */}
      {isMenuOpen && (
        <>
          <div onClick={() => setIsMenuOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 9998 }} />
          <div style={{ position: 'fixed', top: 0, left: 0, width: '80%', maxWidth: '300px', height: '100vh', background: '#0a0c10', borderRight: `1px solid ${activeThemeColor}`, boxShadow: `5px 0 30px ${activeThemeColor}33`, zIndex: 9999, padding: '30px 20px', display: 'flex', flexDirection: 'column', gap: '25px', overflowY: 'auto', animation: 'slideIn 0.3s ease-out' }}>
            <style>{`@keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }`}</style>
            
            <div><h2 style={{ margin: 0, fontSize: '18px', color: '#fff', borderBottom: `1px solid ${activeThemeColor}44`, paddingBottom: '10px' }}>設定</h2></div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
              <button 
                onClick={() => { setIsMenuOpen(false); setShowNfcModal(true); }} 
                style={{ width: '100%', padding: '10px', background: 'rgba(0, 191, 255, 0.12)', color: '#00bfff', border: '1px solid #00bfff', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', fontSize: '12px' }}
              >
                [NFC] 物理カード・リング連携
              </button>
              <button 
                onClick={() => { setIsMenuOpen(false); setShowBriefing(true); }} 
                style={{ width: '100%', padding: '10px', background: 'rgba(0, 255, 102, 0.1)', color: '#00ff66', border: '1px dashed #00ff66', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
              >
                [AI] 朝のAI報告をテスト起動
              </button>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>残高並び替え</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px', marginBottom: '10px' }}>
                <button onClick={() => setSortKey('amount')} style={menuBtnStyle(sortKey === 'amount', '#ff9900')}>金額順</button>
                <button onClick={() => setSortKey('name')} style={menuBtnStyle(sortKey === 'name', '#ff9900')}>名前順</button>
                <button onClick={() => setSortKey('usage')} style={menuBtnStyle(sortKey === 'usage', '#ff9900')}>使用頻度</button>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => setSortOrder('desc')} style={{ ...menuBtnStyle(sortOrder === 'desc', '#00bfff'), flex: 1 }}>▼ 降順</button>
                <button onClick={() => setSortOrder('asc')} style={{ ...menuBtnStyle(sortOrder === 'asc', '#00bfff'), flex: 1 }}>▲ 昇順</button>
              </div>
              <div style={{ fontSize: '9px', color: '#555', marginTop: '5px' }}>※残高画面で長押しすると手動配置になります</div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', fontWeight: 'bold' }}>タブバ―モード変更</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => setUiMode('2d')} style={menuBtnStyle(uiMode === '2d', activeThemeColor)}> 2Dモード</button>
                <button onClick={() => setUiMode('morph')} style={menuBtnStyle(uiMode === 'morph', activeThemeColor)}> 3Dモード</button>
                <button onClick={() => setUiMode('particle')} style={menuBtnStyle(uiMode === 'particle', activeThemeColor)}> 3D粒子モード</button>
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
      <div style={{ flex: 1, overflowY: currentTab === 'feed' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* 🌟 入力フォームに dbMode と familyId を渡して、保存先をコントロールします */}
        {currentTab === 'input' && (
          <MobileInputForm 
            key={dbMode}
            dbMode={dbMode} 
            familyId={familyId} 
            initialAccount={nfcAccount} 
            autoOpenKeypad={nfcAutoKeypad} 
            onKeypadConsumed={() => setNfcAutoKeypad(false)}
            transactions={safeTransactions}
          />
        )}
        {currentTab === 'balance' && (
          <div style={{ padding: '20px' }}>
            <div 
              onClick={handleBalanceQuadTap}
              style={{ borderBottom: '1px solid #252838', paddingBottom: '10px', marginBottom: '15px', marginTop: 0, cursor: 'pointer' }}
            >
              <h2 onDoubleClick={toggleStealth} style={{ fontSize: '18px', margin: 0, userSelect: 'none' }}> 口座・決済手段別の現在高</h2>
            </div>
            <BalanceChart 
              key={`${dbMode}_${settingsVersion}`}
              transactions={safeTransactions} 
              ghostAccounts={ghostAccountsList} 
              sortKey={sortKey} 
              sortOrder={sortOrder} 
              setSortKey={setSortKey} 
              dbMode={dbMode}
              initialResetCard={pendingResetCard ? { name: pendingResetCard } : null}
              onQuadTap={handleBalanceQuadTap}
            />
          </div>
        )}
        {currentTab === 'calendar' && <MobileCalendar transactions={safeTransactions} themeColor={activeThemeColor} />}
        {currentTab === 'history' && <MobileTransactionList transactions={safeTransactions} />}
        {currentTab === 'feed' && (
          <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
            <MoneyFlowMap transactions={safeTransactions} />
          </div>
        )}
      </div>

      {/* 🚀 ハイブリッド・タブバーエリア（グラスモフィズム＆セーフエリア対応） */}
      {uiMode === '2d' ? (
        <div style={{ 
          background: 'rgba(10, 12, 16, 0.88)', 
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: `1px solid rgba(255, 255, 255, 0.1)`, 
          boxShadow: '0 -8px 30px rgba(0, 0, 0, 0.6)',
          display: 'flex', 
          justifyContent: 'space-around', 
          padding: '8px 0 calc(env(safe-area-inset-bottom, 15px) + 8px) 0', 
          alignItems: 'center', 
          position: 'relative',
          zIndex: 100
        }}>
          <BottomTab icon="/S__32194589.jpg" label="入力" isActive={currentTab === 'input'} onClick={() => setCurrentTab('input')} themeColor={activeThemeColor} />        
          <BottomTab 
            icon="/S__32194590.jpg" label="残高" 
            isActive={currentTab === 'balance'} 
            onClick={() => {
              setCurrentTab('balance');
              handleBalanceQuadTap();
            }} 
            themeColor={activeThemeColor} 
            onPointerDown={(e) => handleStartHold(e, '残高')}
            onPointerUp={handleEndHold}
            onPointerLeave={handleEndHold}
          />
          <BottomTab 
            icon="/karenda-.jpg" label="暦" 
            isActive={currentTab === 'calendar'} 
            onClick={() => setCurrentTab('calendar')} 
            themeColor={activeThemeColor} 
            onPointerDown={(e) => handleStartHold(e, 'カレンダー')}
            onPointerUp={handleEndHold}
            onPointerLeave={handleEndHold}
          />
          <BottomTab icon="/S__32194591.jpg" label="履歴" isActive={currentTab === 'history'} onClick={() => setCurrentTab('history')} themeColor={activeThemeColor} />
          <BottomTab icon="/S__32194592.jpg" label="マップ" isActive={currentTab === 'feed'} onClick={() => setCurrentTab('feed')} themeColor={activeThemeColor} />
        </div>
      ) : (
        <div style={{ background: '#11141a', borderTop: `1px solid ${activeThemeColor}44`, paddingBottom: '20px', zIndex: 100, position: 'relative' }}>
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

      {/* 🌟 NFC設定モーダル（iOSショートカット設定ガイド付き） */}
      <NfcSettingsModal 
        isOpen={showNfcModal} 
        onClose={() => setShowNfcModal(false)} 
        onToast={triggerNfcToast} 
        themeColor={activeThemeColor} 
      />

      {/* 🌟 物理NFCカードタッチ解除サイバー演出オーバーレイ */}
      {showNfcCyberUnlock && (
        <div 
          onClick={() => setShowNfcCyberUnlock(false)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'radial-gradient(circle, rgba(0,25,12,0.96) 0%, rgba(2,6,10,0.98) 100%)',
            zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '24px', textAlign: 'center', cursor: 'pointer',
            boxShadow: 'inset 0 0 100px rgba(0, 255, 102, 0.3)'
          }}
        >
          {/* 走査線エフェクト */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))',
            backgroundSize: '100% 4px, 6px 100%', pointerEvents: 'none'
          }} />

          <div style={{ border: '2px solid #00ff66', padding: '24px', borderRadius: '12px', background: 'rgba(0, 20, 10, 0.85)', maxWidth: '380px', width: '90%', boxShadow: '0 0 40px rgba(0, 255, 102, 0.4)', position: 'relative' }}>
            <div style={{ fontSize: '11px', letterSpacing: '3px', color: '#00ff66', marginBottom: '8px', textShadow: '0 0 8px #00ff66', fontWeight: 'bold' }}>
              [ PHYSICAL KEYCARD DETECTED ]
            </div>

            <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff', letterSpacing: '2px', marginBottom: '14px', textShadow: '0 0 15px #00ff66' }}>
              ACCESS GRANTED
            </div>

            <div style={{ background: '#050a06', border: '1px solid #00ff6644', borderRadius: '6px', padding: '12px', textAlign: 'left', fontFamily: 'monospace', fontSize: '11px', color: '#00ff66', lineHeight: '1.6', marginBottom: '14px' }}>
              <div>&gt; NFC_SIGNATURE: VERIFIED</div>
              <div>&gt; DECRYPTING VAULT KEY... OK</div>
              <div>&gt; GHOST PROTOCOL: DISENGAGED</div>
              <div style={{ color: '#fff', marginTop: '6px', fontWeight: 'bold' }}>&gt;&gt; [OK] 隠し資産・口座が解放されました</div>
            </div>

            <div style={{ fontSize: '10px', color: '#888', letterSpacing: '1px' }}>
              [ タップで閉じる ]
            </div>
          </div>
        </div>
      )}

      {/* 🌟 顔認証（Face ID / 生体認証）サイバーHUDオーバーレイ */}
      {isFaceAuthModalOpen && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(2, 6, 12, 0.94)', backdropFilter: 'blur(8px)',
            zIndex: 999999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '20px', textAlign: 'center', animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {/* サイバー走査線 */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.5) 50%)',
            backgroundSize: '100% 4px', pointerEvents: 'none'
          }} />

          <div style={{
            border: `2px solid ${faceAuthStatus === 'success' ? '#00ff66' : (faceAuthStatus === 'failed' ? '#ff3366' : '#00bfff')}`,
            borderRadius: '16px', background: '#070a0f', maxWidth: '360px', width: '92%',
            padding: '24px', position: 'relative', boxShadow: `0 0 50px ${faceAuthStatus === 'success' ? 'rgba(0,255,102,0.3)' : 'rgba(0,191,255,0.2)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
          }}>
            {/* ヘッダーバッジ */}
            <div style={{
              fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold',
              color: faceAuthStatus === 'success' ? '#00ff66' : '#00bfff',
              letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <span style={{ fontSize: '14px' }}>🛡️</span>
              BIOMETRIC SECURITY // FACE ID
            </div>

            {/* スキャン画面 / カメラビュー / アニメーション */}
            <div style={{
              width: '180px', height: '180px', borderRadius: '12px',
              border: `2px dashed ${faceAuthStatus === 'success' ? '#00ff66' : '#00bfff'}`,
              position: 'relative', overflow: 'hidden', display: 'flex',
              alignItems: 'center', justifyContent: 'center', background: '#020408'
            }}>
              {/* カメラ映像（フォールバック時） */}
              <video 
                ref={faceVideoRef} 
                playsInline 
                muted 
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  display: faceAuthStatus === 'camera' ? 'block' : 'none',
                  transform: 'scaleX(-1)'
                }} 
              />

              {/* アイコン / アニメーション */}
              {faceAuthStatus !== 'camera' && (
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    fontSize: '48px',
                    filter: faceAuthStatus === 'success' ? 'drop-shadow(0 0 15px #00ff66)' : 'drop-shadow(0 0 10px #00bfff)',
                    animation: faceAuthStatus === 'scanning' ? 'pulse 1s infinite' : 'none'
                  }}>
                    {faceAuthStatus === 'success' ? '🔓' : '👤'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#888', marginTop: '8px', fontFamily: 'monospace' }}>
                    {faceAuthStatus === 'success' ? 'AUTHENTICATED' : 'SCANNING TARGET'}
                  </div>
                </div>
              )}

              {/* ターゲットHUD四隅のマーカー */}
              <div style={{ position: 'absolute', top: 6, left: 6, width: 14, height: 14, borderTop: '2px solid #00ff66', borderLeft: '2px solid #00ff66' }} />
              <div style={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderTop: '2px solid #00ff66', borderRight: '2px solid #00ff66' }} />
              <div style={{ position: 'absolute', bottom: 6, left: 6, width: 14, height: 14, borderBottom: '2px solid #00ff66', borderLeft: '2px solid #00ff66' }} />
              <div style={{ position: 'absolute', bottom: 6, right: 6, width: 14, height: 14, borderBottom: '2px solid #00ff66', borderRight: '2px solid #00ff66' }} />

              {/* レーザースキャンライン */}
              {faceAuthStatus !== 'success' && (
                <div style={{
                  position: 'absolute', left: 0, width: '100%', height: '2px',
                  background: 'linear-gradient(90deg, transparent, #00ff66, transparent)',
                  boxShadow: '0 0 8px #00ff66',
                  animation: 'scannerMove 2s infinite ease-in-out'
                }} />
              )}
            </div>

            {/* ログターミナル */}
            <div style={{
              width: '100%', background: '#020406', border: '1px solid #1a2230',
              borderRadius: '6px', padding: '10px 12px', textAlign: 'left',
              fontFamily: 'monospace', fontSize: '11px',
              color: faceAuthStatus === 'success' ? '#00ff66' : (faceAuthStatus === 'failed' ? '#ff3366' : '#00bfff'),
              minHeight: '44px', lineHeight: '1.4', wordBreak: 'break-all'
            }}>
              {faceAuthLog || '[SYSTEM] WAITING FOR BIOMETRIC SENSORS...'}
            </div>

            {/* パスコードフォールバック */}
            {faceAuthStatus === 'fallback' && (
              <form onSubmit={handleFallbackSubmit} style={{ width: '100%', display: 'flex', gap: '8px' }}>
                <input 
                  type="password" 
                  value={fallbackPassword} 
                  onChange={(e) => setFallbackPassword(e.target.value)} 
                  placeholder="Master Passcode (0000)" 
                  autoFocus
                  style={{
                    flex: 1, padding: '10px', background: '#11141a', color: '#fff',
                    border: '1px solid #333', borderRadius: '6px', fontSize: '12px',
                    fontFamily: 'monospace', outline: 'none'
                  }}
                />
                <button 
                  type="submit" 
                  style={{
                    padding: '0 16px', background: '#00bfff', color: '#000',
                    border: 'none', borderRadius: '6px', fontWeight: 'bold',
                    cursor: 'pointer', fontSize: '12px'
                  }}
                >
                  解除
                </button>
              </form>
            )}

            {/* 中止・閉じるボタン */}
            <button 
              onClick={closeFaceAuthModal}
              style={{
                background: 'transparent', border: '1px solid #444', color: '#888',
                padding: '8px 24px', borderRadius: '20px', fontSize: '11px',
                fontFamily: 'monospace', cursor: 'pointer'
              }}
            >
              ABORT (中止)
            </button>
          </div>
        </div>
      )}

      {/* 🌟 NFCワンタップ即時起動バナー（iOS制限対策・タップで100%確実にテンキー起動） */}
      {showNfcTapBanner && currentTab === 'input' && (
        <div 
          onClick={handleBannerNfcTrigger}
          style={{
            position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(5, 20, 10, 0.95)', border: '2px solid #00ff66', color: '#00ff66',
            padding: '12px 20px', borderRadius: '30px', fontSize: '12px', fontWeight: '900',
            boxShadow: '0 0 25px rgba(0, 255, 102, 0.6), inset 0 0 10px rgba(0, 255, 102, 0.3)',
            zIndex: 9999, cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap',
            animation: 'pulse 1.5s infinite ease-in-out', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <span style={{ fontSize: '14px' }}>[⚡]</span>
          <span>タップしてEVERING決済を開く</span>
        </div>
      )}

      {/* 🌟 自作トースト通知（Chrome標準alert不使用） */}
      {nfcToast && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#111822', border: `1px solid ${activeThemeColor}`, color: activeThemeColor,
          padding: '10px 18px', borderRadius: '30px', fontSize: '12px', fontWeight: 'bold',
          boxShadow: `0 0 20px ${activeThemeColor}44`, zIndex: 100000, pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}>
          {nfcToast}
        </div>
      )}
      
    </div>
  );
}

const menuBtnStyle = (isActive, color) => ({ background: isActive ? `${color}22` : '#11141a', color: isActive ? color : '#888', border: `1px solid ${isActive ? color : '#333'}`, padding: '10px', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px' });

function BottomTab({ icon, label, isActive, onClick, themeColor, onPointerDown, onPointerUp, onPointerLeave }) {
  const isImage = icon.includes('.png') || icon.includes('.svg') || icon.includes('.jpg');

  return (
    <div 
      onClick={() => {
        if (navigator.vibrate) navigator.vibrate(12);
        if (onClick) onClick();
      }} 
      onPointerDown={onPointerDown} 
      onPointerUp={onPointerUp} 
      onPointerLeave={onPointerLeave}
      className="clickable-item"
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        cursor: 'pointer', 
        opacity: isActive ? 1 : 0.45, 
        transform: isActive ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)', 
        width: '56px', 
        position: 'relative',
        WebkitTouchCallout: 'none', 
        WebkitUserSelect: 'none', 
        userSelect: 'none' 
      }}>
      {isImage ? (
        <img 
          src={icon} 
          alt={label} 
          style={{ 
            width: '36px', 
            height: '36px', 
            objectFit: 'contain', 
            marginBottom: '3px', 
            filter: isActive ? `drop-shadow(0 0 10px ${themeColor})` : 'grayscale(100%) opacity(60%)', 
            pointerEvents: 'none',
            transition: 'filter 0.2s ease'
          }} 
        />
      ) : (
        <div style={{ fontSize: '24px', marginBottom: '3px', pointerEvents: 'none', filter: isActive ? `drop-shadow(0 0 10px ${themeColor})` : 'none' }}>
          {icon}
        </div>
      )}
      <div style={{ 
        fontSize: '10px', 
        color: isActive ? themeColor : '#777', 
        fontWeight: 'bold', 
        textShadow: isActive ? `0 0 8px ${themeColor}66` : 'none', 
        pointerEvents: 'none',
        transition: 'color 0.2s ease'
      }}>
        {label}
      </div>

      {/* アクティブ時のインジケーターバー */}
      {isActive && (
        <div style={{
          position: 'absolute',
          bottom: '-6px',
          width: '16px',
          height: '2px',
          borderRadius: '2px',
          background: themeColor,
          boxShadow: `0 0 6px ${themeColor}`
        }} />
      )}
    </div>
  );                                                         
}