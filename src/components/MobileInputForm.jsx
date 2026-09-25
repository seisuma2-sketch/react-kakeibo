import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import LocationScanner from './LocationScanner';
import { saveSettingBoth } from '../utils/cloudSync';

function renderIconOrText(item, imgSize = '20px') {
  if (item && item.startsWith('/')) {
    const spaceIndex = item.indexOf(' ');
    const iconPath = item.slice(0, spaceIndex);
    const name = item.slice(spaceIndex + 1);
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <img src={iconPath} alt="" style={{ width: imgSize, height: imgSize, objectFit: 'contain' }} />
        <span>{name}</span>
      </div>
    );
  }
  return item;
}

const evaluateMath = (expr) => {
  try {
    const sanitized = expr.replace(/[^0-9+\-*/.]/g, '');
    if (!sanitized) return '';
    const result = new Function(`return ${sanitized}`)();
    if (!isFinite(result) || isNaN(result)) return '';
    return Math.floor(result).toString();
  } catch (e) {
    return '';
  }
};

export default function MobileInputForm({ 
  dbMode = 'personal', 
  familyId = null, 
  initialAccount = null, 
  autoOpenKeypad = false,
  onKeypadConsumed = null
}) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [calcStr, setCalcStr] = useState('');
  
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [openDropdown, setOpenDropdown] = useState(null); 
  const [scanLocation, setScanLocation] = useState(null);
  
  const [isArModalOpen, setIsArModalOpen] = useState(false);
  const [arImageSrc, setArImageSrc] = useState(null);
  const [arStatus, setArStatus] = useState('idle'); 
  const [arLog, setArLog] = useState('[SYSTEM] OPTICAL SENSOR ONLINE... READY.');
  const [arTargetData, setArTargetData] = useState({ amount: '', memo: '' });

  const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '', type: 'success' });
  const [customPrompt, setCustomPrompt] = useState({ isOpen: false, title: '', target: '', text: '' });

  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [accountPanelMode, setAccountPanelMode] = useState('add'); 
  const [newAccType, setNewAccType] = useState('bank');
  const [newAccName, setNewAccName] = useState('');
  const [newAccBudget, setNewAccBudget] = useState('');
  const [newAccResetDay, setNewAccResetDay] = useState('1');
  const [newAccPaymentDay, setNewAccPaymentDay] = useState('27');
  const [newAccWithdrawalSource, setNewAccWithdrawalSource] = useState('');
  
  const [savedCards, setSavedCards] = useState({});
  const [editTargetCard, setEditTargetCard] = useState('');

  // 🌟 固定費・サブスク用State
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringList, setRecurringList] = useState([]);
  const [newRecName, setNewRecName] = useState('');
  const [newRecAmount, setNewRecAmount] = useState('');
  const [newRecCategory, setNewRecCategory] = useState('');
  const [newRecPaymentMethod, setNewRecPaymentMethod] = useState('');
  const [isRegisteringRecurring, setIsRegisteringRecurring] = useState(false);

  // 🌟 自作確認モーダル用State (Chrome標準confirm不使用)
  const [customConfirm, setCustomConfirm] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const fileInputRef = useRef(null);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [calcHistory, setCalcHistory] = useState([]);
  const [pinnedAmount, setPinnedAmount] = useState(null);

  // 🌟 個人モード用の初期リスト
  const defaultExpense = ['/icon-food.png 食費', '/icon-daily.png 日用品', '/icon-train.png 交通費', '/icon-drink.png 交際費', '/icon-hobby.png 趣味', '/icon-ai.png 自動取得(AI)', '/icon-other.png その他'];
  const defaultIncome = ['/icon-salary.png 給与・報酬', '/icon-money.png お小遣い', '/icon-charge.png チャージ', '/icon-other.png その他'];
  const defaultAccounts = ['/icon-cash.png 現金', '/icon-smbc.png 三井住友銀行', '/icon-mufg.png 三菱UFJ銀行', '/icon-yucho.png ゆうちょ銀行', '/icon-paypay.png PayPay', '/icon-evering.png EVERING', '/icon-other.png リクルートカード'];

  // 🌟 共有モード用の初期リスト（個人とは完全に別データになります！）
  const defaultExpenseSync = ['/icon-food.png 共通食費', '/icon-daily.png 共通日用品', '/icon-other.png 家族のその他'];
  const defaultIncomeSync = ['/icon-money.png 家族への入金', '/icon-other.png その他'];
  const defaultAccountsSync = ['/icon-cash.png 共通財布', '/icon-other.png 家族用カード'];

  const defaultRecurring = [
    { id: '1', name: '家賃', amount: 70000, category: '/icon-other.png その他', paymentMethod: '/icon-smbc.png 三井住友銀行' },
    { id: '2', name: '通信費(Wi-Fi・スマホ)', amount: 6500, category: '/icon-other.png その他', paymentMethod: '/icon-other.png リクルートカード' },
    { id: '3', name: 'サブスク', amount: 1490, category: '/icon-hobby.png 趣味', paymentMethod: '/icon-other.png リクルートカード' }
  ];

  const [expenseCategories, setExpenseCategories] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // 🌟 モード（個人/共有）が切り替わった時に、読み込むリストを完全に切り替える
  useEffect(() => {
    const isSync = dbMode === 'sync';
    
    // 保存先の金庫の名前を分ける
    const expKey = isSync ? 'm402_expense_cats_sync' : 'm402_expense_cats';
    const incKey = isSync ? 'm402_income_cats_sync' : 'm402_income_cats';
    const accKey = isSync ? 'm402_accounts_sync' : 'm402_accounts';
    const cardKey = isSync ? 'creditCardSettings_sync' : 'creditCardSettings';
    const recKey = isSync ? 'm402_recurring_items_sync' : 'm402_recurring_items';

    // もし過去に保存されたリストがあればそれを使い、なければ専用の初期リストを使う
    const savedExp = localStorage.getItem(expKey);
    const newExpCats = savedExp ? JSON.parse(savedExp) : (isSync ? defaultExpenseSync : defaultExpense);
    
    const savedInc = localStorage.getItem(incKey);
    const newIncCats = savedInc ? JSON.parse(savedInc) : (isSync ? defaultIncomeSync : defaultIncome);
    
    const savedAcc = localStorage.getItem(accKey);
    const newAccs = savedAcc ? JSON.parse(savedAcc) : (isSync ? defaultAccountsSync : defaultAccounts);

    const savedCrd = localStorage.getItem(cardKey);
    setSavedCards(savedCrd ? JSON.parse(savedCrd) : {});

    const savedRec = localStorage.getItem(recKey);
    setRecurringList(savedRec ? JSON.parse(savedRec) : defaultRecurring);

    setExpenseCategories(newExpCats);
    setIncomeCategories(newIncCats);
    setAccounts(newAccs);

    // リストが切り替わったら、選択状態も新しいリストの一番上に合わせる（initialAccountがある場合は優先）
    setCategory(type === 'expense' ? newExpCats[0] : newIncCats[0]);
    if (initialAccount) {
      const matched = newAccs.find(acc => acc.includes(initialAccount));
      setPaymentMethod(matched || initialAccount);
    } else {
      setPaymentMethod(newAccs[0] || '');
    }
    setNewRecCategory(newExpCats[0] || '');
    setNewRecPaymentMethod(newAccs[0] || '');
  }, [dbMode, type]);

  // 🌟 NFCタッチ等で initialAccount が渡された場合の自動セット＆テンキー自動オープン
  useEffect(() => {
    if (initialAccount) {
      setType('expense');
      if (accounts.length > 0) {
        const matched = accounts.find(acc => acc.includes(initialAccount));
        setPaymentMethod(matched || initialAccount);
      } else {
        setPaymentMethod(initialAccount);
      }
      if (autoOpenKeypad) {
        setIsKeypadOpen(true);
        if (onKeypadConsumed) onKeypadConsumed();
      }
    }
  }, [initialAccount, autoOpenKeypad, accounts, onKeypadConsumed]);

  // 🌟 ホーム画面に戻った時（バックグラウンド移行時）は、次回起動のためにテンキーを閉じてリセットする
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setIsKeypadOpen(false);
        if (onKeypadConsumed) onKeypadConsumed();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [onKeypadConsumed]);

  const now = new Date();
  const defaultDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [date, setDate] = useState(defaultDate);

  const showAlert = (message, alertType = 'success') => {
    setCustomAlert({ isOpen: true, message, type: alertType });
    setTimeout(() => setCustomAlert({ isOpen: false, message: '', type: 'success' }), 3000);
  };

  const handleAddCategory = () => setCustomPrompt({ isOpen: true, title: '新しいカテゴリ名を入力', target: 'category', text: '' });
  
  const handleOpenAccountPanel = () => {
    setNewAccName(''); setNewAccType('bank'); setNewAccBudget(''); setNewAccResetDay('1'); setNewAccPaymentDay('27');
    setNewAccWithdrawalSource('');
    setAccountPanelMode('add'); setEditTargetCard('');
    const cardKey = dbMode === 'sync' ? 'creditCardSettings_sync' : 'creditCardSettings';
    const cards = JSON.parse(localStorage.getItem(cardKey) || '{}');
    setSavedCards(cards);
    setShowAccountPanel(true);
  };

  const handleSelectEditCard = (e) => {
    const cardName = e.target.value;
    setEditTargetCard(cardName);
    if (cardName && savedCards[cardName]) {
      setNewAccBudget(savedCards[cardName].budget);
      setNewAccResetDay(savedCards[cardName].resetDay);
      setNewAccPaymentDay(savedCards[cardName].paymentDay);
      setNewAccWithdrawalSource(savedCards[cardName].withdrawalSource || '');
    } else {
      setNewAccBudget(''); setNewAccResetDay('1'); setNewAccPaymentDay('27'); setNewAccWithdrawalSource('');
    }
  };

  const handleSaveAccount = () => {
    const accKey = dbMode === 'sync' ? 'm402_accounts_sync' : 'm402_accounts';
    const accField = dbMode === 'sync' ? 'accounts_sync' : 'accounts';
    const cardKey = dbMode === 'sync' ? 'creditCardSettings_sync' : 'creditCardSettings';
    const cardField = dbMode === 'sync' ? 'creditCardSettings_sync' : 'creditCardSettings';

    if (accountPanelMode === 'add') {
      if (!newAccName.trim()) { showAlert("名前を入力してください", "error"); return; }
      const iconPath = newAccType === 'credit' ? '/icon-other.png' : '/icon-cash.png';
      const newItem = `${iconPath} ${newAccName.trim()}`;
      
      if (!accounts.includes(newItem)) {
        const newAccounts = [...accounts, newItem];
        setAccounts(newAccounts);
        saveSettingBoth(auth.currentUser?.uid, accField, accKey, newAccounts);
      }
      setPaymentMethod(newItem);

        if (newAccType === 'credit') {
        const currentSettings = JSON.parse(localStorage.getItem(cardKey) || '{}');
        currentSettings[newAccName.trim()] = { 
          budget: Number(newAccBudget) || 0, 
          resetDay: Number(newAccResetDay) || 1, 
          paymentDay: Number(newAccPaymentDay) || 27,
          withdrawalSource: newAccWithdrawalSource 
        };
        saveSettingBoth(auth.currentUser?.uid, cardField, cardKey, currentSettings);
        showAlert(`[${newAccName.trim()}] を登録しました`, "success");
      } else {
        showAlert("口座を追加しました", "success");
      }
    } else {
      if (!editTargetCard) { showAlert("修正する項目を選択してください", "error"); return; }
      const currentSettings = JSON.parse(localStorage.getItem(cardKey) || '{}');
      const existing = currentSettings[editTargetCard] || {};
      currentSettings[editTargetCard] = { 
        ...existing,
        budget: Number(newAccBudget) || 0, 
        resetDay: Number(newAccResetDay) || 1, 
        paymentDay: Number(newAccPaymentDay) || 27,
        withdrawalSource: newAccWithdrawalSource
      };
      saveSettingBoth(auth.currentUser?.uid, cardField, cardKey, currentSettings);
      showAlert(`[${editTargetCard}] の設定を更新しました`, "success");
    }
    setShowAccountPanel(false);
  };

  // 🌟 削除機能（今のモードのリストからだけ完全に消去する・自作確認モーダル使用）
  const handleDeleteAccount = () => {
    if (!editTargetCard) { showAlert("削除する項目を選択してください", "error"); return; }
    setCustomConfirm({
      isOpen: true,
      title: '口座・カードの削除',
      message: `本当に [${editTargetCard}] を削除しますか？\n(※過去の取引履歴は保持されます)`,
      onConfirm: () => {
        const accKey = dbMode === 'sync' ? 'm402_accounts_sync' : 'm402_accounts';
        const accField = dbMode === 'sync' ? 'accounts_sync' : 'accounts';
        const cardKey = dbMode === 'sync' ? 'creditCardSettings_sync' : 'creditCardSettings';
        const cardField = dbMode === 'sync' ? 'creditCardSettings_sync' : 'creditCardSettings';

        const newAccounts = accounts.filter(acc => getCleanName(acc) !== editTargetCard);
        setAccounts(newAccounts);
        saveSettingBoth(auth.currentUser?.uid, accField, accKey, newAccounts);

        const currentSettings = JSON.parse(localStorage.getItem(cardKey) || '{}');
        if (currentSettings[editTargetCard]) {
          delete currentSettings[editTargetCard];
          saveSettingBoth(auth.currentUser?.uid, cardField, cardKey, currentSettings);
        }

        const deletedCard = editTargetCard;
        setEditTargetCard('');
        setAccountPanelMode('add');
        showAlert(`[${deletedCard}] を削除しました`, "success");

        if (getCleanName(paymentMethod) === deletedCard) {
          setPaymentMethod(newAccounts[0] || '');
        }
        setShowAccountPanel(false);
      }
    });
  };

  // 🌟 固定費・サブスクの操作ハンドラー
  const handleAddRecurring = () => {
    if (!newRecName.trim() || !newRecAmount) {
      showAlert("項目名と金額を入力してください", "error");
      return;
    }
    const recKey = dbMode === 'sync' ? 'm402_recurring_items_sync' : 'm402_recurring_items';
    const newItem = {
      id: Date.now().toString(),
      name: newRecName.trim(),
      amount: Number(newRecAmount) || 0,
      category: newRecCategory || expenseCategories[0] || 'その他',
      paymentMethod: newRecPaymentMethod || accounts[0] || '現金'
    };
    const updated = [...recurringList, newItem];
    setRecurringList(updated);
    localStorage.setItem(recKey, JSON.stringify(updated));
    setNewRecName('');
    setNewRecAmount('');
    showAlert(`固定費 [${newItem.name}] を追加しました`, "success");
  };

  const handleDeleteRecurring = (id) => {
    const recKey = dbMode === 'sync' ? 'm402_recurring_items_sync' : 'm402_recurring_items';
    const updated = recurringList.filter(item => item.id !== id);
    setRecurringList(updated);
    localStorage.setItem(recKey, JSON.stringify(updated));
    showAlert("固定費を削除しました", "info");
  };

  const handleSingleRegisterRecurring = async (item) => {
    if (!auth.currentUser) return;
    setIsRegisteringRecurring(true);
    try {
      const txData = {
        userId: auth.currentUser.uid,
        type: 'expense',
        amount: Number(item.amount) || 0,
        category: item.category,
        paymentMethod: item.paymentMethod,
        memo: `[固定費] ${item.name}`,
        date: Timestamp.now(),
        createdAt: Timestamp.now(),
        mode: dbMode === 'sync' ? 'sync' : 'personal'
      };
      if (dbMode === 'sync' && familyId) txData.familyId = familyId;
      await addDoc(collection(db, "transactions"), txData);
      showAlert(`[${item.name}] ¥${item.amount.toLocaleString()} を記録しました`, "success");
    } catch(e) {
      console.error(e);
      showAlert("記録中にエラーが発生しました", "error");
    } finally {
      setIsRegisteringRecurring(false);
    }
  };

  const handleBulkRegisterRecurring = () => {
    if (recurringList.length === 0) {
      showAlert("登録されている固定費がありません", "error");
      return;
    }
    const total = recurringList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    setCustomConfirm({
      isOpen: true,
      title: '固定費の一括登録',
      message: `登録済みの固定費全 ${recurringList.length} 件（合計 ¥${total.toLocaleString()}）を今月の支出として一括記録しますか？`,
      onConfirm: async () => {
        if (!auth.currentUser) return;
        setIsRegisteringRecurring(true);
        try {
          for (const item of recurringList) {
            const txData = {
              userId: auth.currentUser.uid,
              type: 'expense',
              amount: Number(item.amount) || 0,
              category: item.category,
              paymentMethod: item.paymentMethod,
              memo: `[固定費一括] ${item.name}`,
              date: Timestamp.now(),
              createdAt: Timestamp.now(),
              mode: dbMode === 'sync' ? 'sync' : 'personal'
            };
            if (dbMode === 'sync' && familyId) txData.familyId = familyId;
            await addDoc(collection(db, "transactions"), txData);
          }
          setShowRecurringModal(false);
          showAlert(`固定費 ${recurringList.length} 件（計 ¥${total.toLocaleString()}）を一括記録しました`, "success");
        } catch(e) {
          console.error(e);
          showAlert("一括記録中にエラーが発生しました", "error");
        } finally {
          setIsRegisteringRecurring(false);
        }
      }
    });
  };

  const handlePromptSubmit = () => {
    if (!customPrompt.text.trim()) { setCustomPrompt({ ...customPrompt, isOpen: false }); return; }
    const newItem = `✨ ${customPrompt.text}`;
    
    if (type === 'expense') {
      const expKey = dbMode === 'sync' ? 'm402_expense_cats_sync' : 'm402_expense_cats';
      const newCats = [...expenseCategories, newItem];
      setExpenseCategories(newCats);
      localStorage.setItem(expKey, JSON.stringify(newCats));
    } else {
      const incKey = dbMode === 'sync' ? 'm402_income_cats_sync' : 'm402_income_cats';
      const newCats = [...incomeCategories, newItem];
      setIncomeCategories(newCats);
      localStorage.setItem(incKey, JSON.stringify(newCats));
    }
    
    setCategory(newItem);
    setCustomPrompt({ isOpen: false, title: '', target: '', text: '' });
  };

  const getCleanName = (val) => val.startsWith('/') ? val.slice(val.indexOf(' ') + 1) : val.replace(/^[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]\s?/g, '').trim();

  const handleOpenArScanner = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArStatus('scanning');
    setArLog('[SYSTEM] INITIATING TARGETING SCAN...');
    setIsArModalOpen(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Data = reader.result;
      setArImageSrc(base64Data);
      
      const base64Image = base64Data.split(',')[1];
      const API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY;

      if (!API_KEY || API_KEY === 'undefined') {
        setTimeout(() => {
          setArStatus('error');
          setArLog('[WARN] VISION API KEY NOT FOUND. SWITCHING TO MANUAL TARGETING MODE.');
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }, 1500);
        return;
      }

      try {
        setArLog('[OCR] DECRYPTING OPTICAL DATA VIA NEBULA SATELLITE...');
        const url = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: [{ image: { content: base64Image }, features: [{ type: 'TEXT_DETECTION' }] }] }) });
        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);

        const text = data.responses[0]?.textAnnotations[0]?.description;
        if (!text) {
          setArStatus('error');
          setArLog('[ERROR] NO READABLE CHARACTERS DETECTED IN TARGET AREA.');
          return;
        }

        const lines = text.split('\n');
        let foundMemo = lines[0]?.trim() || 'スキャン店舗';
        let foundAmount = "";

        for (let i = lines.length - 1; i >= 0; i--) {
          const match = lines[i].match(/(?:合計|合\s*計|小計|お買上額|支払|¥|￥)\s*[:：]?\s*[¥￥]?\s*([0-9,]+)/);
          if (match) { foundAmount = match[1].replace(/,/g, ''); break; }
        }
        if (!foundAmount) {
          const allNumbers = text.match(/[0-9,]+/g);
          if (allNumbers) {
            const maxNum = Math.max(...allNumbers.map(n => parseInt(n.replace(/,/g, ''), 10) || 0));
            if (maxNum > 0 && maxNum < 1000000) foundAmount = maxNum.toString();
          }
        }

        if (foundAmount) {
          setArTargetData({ amount: foundAmount, memo: foundMemo });
          setArStatus('locked');
          setArLog(`[LOCKED] TARGET CAPTURED: ¥${Number(foundAmount).toLocaleString()} // READY TO TRANSFER.`);
          if (navigator.vibrate) navigator.vibrate([50, 50, 200]);
        } else {
          setArStatus('error');
          setArLog('[WARN] AMOUNT NOT DETECTED. PLEASE ENTER MANUAL TARGET.');
          if (navigator.vibrate) navigator.vibrate([80, 80]);
        }
      } catch (err) {
        setArStatus('error');
        setArLog('[ERROR] CONNECTION INTERRUPTED. MANUAL OVERRIDE REQUIRED.');
      }
    };
    e.target.value = '';
  };

  const handleApplyArTarget = () => {
    if (arTargetData.amount) {
      setAmount(arTargetData.amount);
      setCalcStr(arTargetData.amount);
    }
    if (arTargetData.memo) setMemo(arTargetData.memo);
    setIsArModalOpen(false);
    showAlert("⚡ TARGET DATA TRANSFERRED!", "success");
  };

  const handleSubmit = async () => {
    const finalAmount = calcStr ? evaluateMath(calcStr) : amount;
    if (!finalAmount || Number(finalAmount) <= 0) { showAlert("金額を入力してください！", "error"); return; }
    if (!auth.currentUser) { showAlert("ログインしていません！", "error"); return; }
    if (type === 'transfer' && paymentMethod === category) { showAlert("出金元と入金先が同じです！", "error"); return; }

    setIsSubmitting(true);
    try {
      const cleanCategory = getCleanName(category);
      const cleanPaymentMethod = getCleanName(paymentMethod);

      const txData = {
        userId: auth.currentUser.uid, 
        familyId: familyId || auth.currentUser.uid,
        mode: dbMode, 
        type: type, 
        amount: Number(finalAmount),
        category: cleanCategory, 
        paymentMethod: cleanPaymentMethod, 
        memo: memo,
        location: scanLocation ? scanLocation.raw : '',
        lat: scanLocation ? scanLocation.lat : null,
        lng: scanLocation ? scanLocation.lng : null,
        prefecture: scanLocation ? scanLocation.prefecture : '',
        city: scanLocation ? scanLocation.city : '',
        ward: scanLocation ? scanLocation.ward : '',
        fullAddress: scanLocation ? scanLocation.fullAddress : '',
        date: Timestamp.fromDate(new Date(date)), 
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, "transactions"), txData);
      addToHistory(finalAmount);
      setAmount(''); setCalcStr(''); setMemo(''); setScanLocation(null);
      
      const successMsg = dbMode === 'sync' ? "🔗 共有金庫に記録しました！" : "👤 個人記録完了！";
      showAlert(successMsg, "success");
    } catch (error) { 
      showAlert("エラー発生", "error"); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === 'expense') setCategory(expenseCategories[0]);
    if (newType === 'income') setCategory(incomeCategories[0]);
    if (newType === 'transfer') { setPaymentMethod(accounts[0]); setCategory(accounts[1] || accounts[0]); }
    setOpenDropdown(null); 
  };

  const handleKeypadPress = (key) => {
    if (key === 'C') { setCalcStr(''); setAmount(''); } 
    else if (key === 'BS') { setCalcStr(prev => prev.slice(0, -1)); } 
    else if (key === '=') {
      const result = evaluateMath(calcStr);
      if (result) { 
        setAmount(result); 
        setCalcStr(result); 
        addToHistory(result); 
        setIsKeypadOpen(false); 
        if (onKeypadConsumed) onKeypadConsumed();
      }
    } else { setCalcStr(prev => prev + key); }
  };

  const handleCloseKeypad = () => {
    setIsKeypadOpen(false);
    if (onKeypadConsumed) onKeypadConsumed();
  };

  const addToHistory = (val) => {
    if (!val) return;
    setCalcHistory(prev => [val, ...prev.filter(item => item !== val)].slice(0, 5));
  };

  const togglePin = () => {
    const currentVal = evaluateMath(calcStr) || amount;
    if (currentVal) setPinnedAmount(currentVal);
  };

  const livePreview = calcStr ? evaluateMath(calcStr) : amount;

  return (
    <div style={{ background: '#0a0c10', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', color: '#fff', fontFamily: 'sans-serif', paddingBottom: '30px', position: 'relative', WebkitUserSelect: 'none', userSelect: 'none' }}>
      
      {openDropdown && (
        <div onClick={() => setOpenDropdown(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 90 }} />
      )}

      {isArModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000', zIndex: 999999, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: 'linear-gradient(to bottom, rgba(0,255,102,0.2), transparent)', borderBottom: '1px solid #00ff6644', zIndex: 10 }}>
            <div style={{ color: '#00ff66', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', textShadow: '0 0 8px #00ff66' }}>
              <span style={{ fontSize: '18px' }}>👁️</span> TERMINATOR VISION // OPTICAL SCANNER
            </div>
            <button onClick={() => setIsArModalOpen(false)} style={{ background: 'transparent', border: '1px solid #ff3366', color: '#ff3366', padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold', fontFamily: 'monospace', cursor: 'pointer', boxShadow: '0 0 10px rgba(255,51,102,0.3)' }}>ABORT (中止)</button>
          </div>
          <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#05070a', overflow: 'hidden' }}>
            {arImageSrc ? <img src={arImageSrc} alt="Target" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: arStatus === 'scanning' ? 'contrast(1.5) brightness(0.7)' : 'contrast(1.1)', transition: 'all 0.3s' }} /> : <div style={{ color: '#555', fontFamily: 'monospace' }}>NO OPTICAL FEED</div>}
          </div>
          <div style={{ padding: '20px', background: '#0a0c10', borderTop: '1px solid #00ff6644', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 10 }}>
            <div style={{ background: '#050608', borderLeft: '3px solid #00ff66', padding: '8px 12px', fontFamily: 'monospace', fontSize: '11px', color: arStatus === 'error' ? '#ff3366' : '#00ff66' }}>{arLog}</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => fileInputRef.current.click()} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid #00bfff', color: '#00bfff', borderRadius: '6px', fontWeight: 'bold', fontFamily: 'monospace', cursor: 'pointer' }}>🔄 RE-SCAN</button>
              <button onClick={handleApplyArTarget} disabled={!arTargetData.amount} style={{ flex: 1.5, padding: '14px', background: arTargetData.amount ? '#00ff66' : '#333', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '15px', cursor: arTargetData.amount ? 'pointer' : 'not-allowed' }}>⚡ EXECUTE</button>
            </div>
          </div>
        </div>
      )}

      {customAlert.isOpen && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: customAlert.type === 'success' ? 'rgba(0, 255, 102, 0.15)' : 'rgba(255, 51, 102, 0.15)', border: `1px solid ${customAlert.type === 'success' ? '#00ff66' : '#ff3366'}`, color: customAlert.type === 'success' ? '#00ff66' : '#ff3366', padding: '12px 24px', borderRadius: '30px', fontWeight: 'bold', fontSize: '13px', backdropFilter: 'blur(10px)', zIndex: 999999, boxShadow: '0 5px 25px rgba(0,0,0,0.6)' }}>
          {customAlert.message}
        </div>
      )}

      {/* 🌟 自作確認モーダル (Chrome標準confirm不使用) */}
      {customConfirm.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#0a0c10', border: '1px solid #ff3366', borderRadius: '12px', width: '90%', maxWidth: '360px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 0 30px rgba(255,51,102,0.3)' }}>
            <h3 style={{ margin: 0, color: '#ff3366', fontSize: '16px', fontFamily: 'monospace' }}>
              [確認] {customConfirm.title}
            </h3>
            <div style={{ fontSize: '13px', color: '#ccc', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
              {customConfirm.message}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button 
                onClick={() => setCustomConfirm({ isOpen: false, title: '', message: '', onConfirm: null })}
                style={{ flex: 1, padding: '12px', background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button 
                onClick={() => {
                  if (customConfirm.onConfirm) customConfirm.onConfirm();
                  setCustomConfirm({ isOpen: false, title: '', message: '', onConfirm: null });
                }}
                style={{ flex: 1, padding: '12px', background: '#ff3366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 0 15px rgba(255,51,102,0.4)' }}
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 固定費・サブスク管理自作モーダル */}
      {showRecurringModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#0a0c10', border: '1px solid #00bfff', borderRadius: '12px', width: '92%', maxWidth: '420px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 0 40px rgba(0,191,255,0.3)', maxHeight: '90vh' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#00bfff', fontSize: '16px', fontFamily: 'monospace' }}>
                [固定費] サブスク・定期支出マネージャー
              </h3>
              <button onClick={() => setShowRecurringModal(false)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            {/* 一括登録バー */}
            {recurringList.length > 0 && (
              <div style={{ background: '#11141a', padding: '12px', borderRadius: '8px', border: '1px solid #252838', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#888' }}>今月分の一括記録 (全{recurringList.length}件)</div>
                  <div style={{ fontSize: '16px', color: '#00ff66', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    計 ¥{recurringList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={handleBulkRegisterRecurring}
                  disabled={isRegisteringRecurring}
                  style={{
                    background: '#00ff66',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: isRegisteringRecurring ? 'not-allowed' : 'pointer',
                    boxShadow: '0 0 10px rgba(0,255,102,0.3)'
                  }}
                >
                  {isRegisteringRecurring ? '記録中...' : '全件一括登録'}
                </button>
              </div>
            )}

            {/* 固定費一覧 */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px' }}>
              {recurringList.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#666', padding: '20px 0', fontSize: '12px' }}>
                  登録されている固定費はありません
                </div>
              ) : (
                recurringList.map(item => (
                  <div key={item.id} style={{ background: '#11141a', padding: '10px 12px', borderRadius: '6px', border: '1px solid #252838', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: '10px' }}>
                      <div style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ color: '#888', fontSize: '10px', marginTop: '2px' }}>
                        {getCleanName(item.paymentMethod)} / {getCleanName(item.category)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#ff9900', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        ¥{Number(item.amount).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleSingleRegisterRecurring(item)}
                        disabled={isRegisteringRecurring}
                        style={{ background: '#00bfff', color: '#000', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        登録
                      </button>
                      <button
                        onClick={() => handleDeleteRecurring(item.id)}
                        style={{ background: 'transparent', color: '#ff3366', border: '1px solid #ff3366', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer' }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 新規固定費の追加フォーム */}
            <div style={{ background: '#11141a', padding: '12px', borderRadius: '8px', border: '1px dashed #00bfff', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11px', color: '#00bfff', fontWeight: 'bold' }}>[+] 新規固定費・サブスクの追加</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="項目名 (例: Netflix)"
                  value={newRecName}
                  onChange={e => setNewRecName(e.target.value)}
                  style={{ ...inputStyle, flex: 2, padding: '8px' }}
                />
                <input
                  type="number"
                  placeholder="金額"
                  value={newRecAmount}
                  onChange={e => setNewRecAmount(e.target.value)}
                  style={{ ...inputStyle, flex: 1.5, padding: '8px', color: '#ff9900', fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={newRecCategory}
                  onChange={e => setNewRecCategory(e.target.value)}
                  style={{ ...inputStyle, flex: 1, padding: '8px', fontSize: '12px' }}
                >
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{getCleanName(cat)}</option>
                  ))}
                </select>
                <select
                  value={newRecPaymentMethod}
                  onChange={e => setNewRecPaymentMethod(e.target.value)}
                  style={{ ...inputStyle, flex: 1, padding: '8px', fontSize: '12px' }}
                >
                  {accounts.map(acc => (
                    <option key={acc} value={acc}>{getCleanName(acc)}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddRecurring}
                  style={{ background: '#00bfff', color: '#000', border: 'none', borderRadius: '6px', padding: '0 14px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                >
                  追加
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowRecurringModal(false)}
              style={{ width: '100%', padding: '10px', background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {customPrompt.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#11141a', border: '1px solid #00bfff', borderRadius: '12px', padding: '20px', width: '80%', maxWidth: '320px', boxShadow: '0 0 30px rgba(0, 191, 255, 0.2)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '16px' }}>{customPrompt.title}</h3>
            <input type="text" autoFocus value={customPrompt.text} onChange={(e) => setCustomPrompt({...customPrompt, text: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && handlePromptSubmit()} placeholder="入力してください..." style={{ ...inputStyle, marginBottom: '20px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setCustomPrompt({ ...customPrompt, isOpen: false })} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '6px' }}>キャンセル</button>
              <button onClick={handlePromptSubmit} style={{ flex: 1, padding: '10px', background: '#00bfff', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>追加</button>
            </div>
          </div>
        </div>
      )}

      {showAccountPanel && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#0a0c10', border: '1px solid #00ff66', borderRadius: '12px', padding: '25px', width: '85%', maxWidth: '340px', boxShadow: '0 0 40px rgba(0, 255, 102, 0.2)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ margin: 0, color: '#00ff66', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              [設定] 口座・カード設定
            </h3>
            <div style={{ display: 'flex', background: '#11141a', borderRadius: '6px', padding: '4px', border: '1px solid #252838' }}>
              <button onClick={() => setAccountPanelMode('add')} style={tabStyle(accountPanelMode === 'add', '#00ff66', '#aaa')}>新規登録</button>
              <button onClick={() => setAccountPanelMode('edit')} style={tabStyle(accountPanelMode === 'edit', '#ff9900', '#aaa')}>編集</button>
            </div>
            
            {accountPanelMode === 'add' ? (
              <>
                <div style={{ display: 'flex', background: '#1a1d24', borderRadius: '6px', padding: '4px', border: '1px solid #333' }}>
                  <button onClick={() => setNewAccType('bank')} style={tabStyle(newAccType === 'bank', '#00bfff', '#aaa')}>銀行口座</button>
                  <button onClick={() => setNewAccType('credit')} style={tabStyle(newAccType === 'credit', '#ff9900', '#aaa')}>クレジット</button>
                </div>
                <div>
                  <div style={labelStyle}>[1] {newAccType === 'credit' ? 'クレジットカード名' : '口座名'}</div>
                  <input type="text" value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder={newAccType === 'credit' ? "例：リクルートカード" : "例：PayPay銀行"} style={inputStyle} />
                </div>
              </>
            ) : (
              <div>
                <div style={{...labelStyle, color: '#ff9900'}}>[1] 修正する項目を選択</div>
                <div style={{ position: 'relative' }}>
                  <select value={editTargetCard} onChange={handleSelectEditCard} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                    <option value="">-- 選択してください --</option>
                    {accounts.map(acc => {
                      const cleanName = getCleanName(acc);
                      return <option key={cleanName} value={cleanName}>{cleanName}</option>;
                    })}
                  </select>
                  <div style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888' }}>▼</div>
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => setShowAccountPanel(false)} style={{ flex: 1, padding: '12px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '6px', fontWeight: 'bold' }}>キャンセル</button>
              {accountPanelMode === 'edit' && (
                <button onClick={handleDeleteAccount} style={{ flex: 1, padding: '12px', background: '#ff3366', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>削除</button>
              )}
              <button onClick={handleSaveAccount} style={{ flex: 1, padding: '12px', background: accountPanelMode === 'edit' ? '#ff9900' : '#00ff66', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>{accountPanelMode === 'edit' ? '修正を保存' : '登録完了'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', borderBottom: '1px solid #1a1d24' }}>
        <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/icon-input-title.png" alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          支出・収入入力
        </h2>    
        <button
          onClick={() => setShowRecurringModal(true)}
          style={{
            background: 'rgba(0, 191, 255, 0.15)',
            color: '#00bfff',
            border: '1px solid #00bfff',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(0,191,255,0.2)'
          }}
        >
          固定費・サブスク
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#11141a', width: '100%', maxWidth: '500px', borderRadius: '12px', border: '1px solid #252838', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', background: '#0a0c10', borderRadius: '8px', padding: '4px', border: '1px solid #252838' }}>
            <button onClick={() => handleTypeChange('expense')} style={tabStyle(type === 'expense', '#ff3366', '#fff')}>支出</button>
            <button onClick={() => handleTypeChange('income')} style={tabStyle(type === 'income', '#00bfff', '#aaa')}>収入</button>
            <button onClick={() => handleTypeChange('transfer')} style={tabStyle(type === 'transfer', '#b666ff', '#aaa')}>振替</button>
          </div>

          <div>
            <div style={labelStyle}>発生日時</div>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
          </div>

          <div>
            <div style={labelStyle}>金額 (数式入力可)</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleOpenArScanner} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current.click()} style={{ ...iconBtnStyle, borderColor: '#00ff66', padding: '0 12px', boxShadow: '0 0 10px rgba(0,255,102,0.2)' }}>
                <img src="/icon-camera.png" alt="scan" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
              </button>
              
              <div onClick={() => setIsKeypadOpen(true)} style={{ ...inputStyle, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', background: '#0a0c10', cursor: 'text' }}>
                <div style={{ fontSize: '12px', color: '#888', height: '14px', fontFamily: 'monospace' }}>{calcStr || '0'}</div>
                <div style={{ color: '#fff', fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#555', marginRight: '4px', fontSize: '20px' }}>¥</span>
                  {livePreview ? Number(livePreview).toLocaleString() : '0'}
                </div>
              </div>
            </div>
          </div>

          {type === 'transfer' ? (
            <div style={{ padding: '15px', background: '#1a1d24', borderRadius: '8px', border: '1px dashed #b666ff' }}>
              <div style={{ marginBottom: '15px' }}>
                <div style={{...labelStyle, color: '#ff3366'}}>📤 出金元 (減る口座)</div>
                <div style={{ position: 'relative', zIndex: openDropdown === 'transferFrom' ? 100 : 1 }}>
                  <div onClick={() => setOpenDropdown(openDropdown === 'transferFrom' ? null : 'transferFrom')} style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderColor: openDropdown === 'transferFrom' ? '#b666ff' : '#252838' }}>
                    <div>{renderIconOrText(paymentMethod, '24px')}</div>
                    <div style={{ color: openDropdown === 'transferFrom' ? '#b666ff' : '#666', fontSize: '12px' }}>{openDropdown === 'transferFrom' ? '▲' : '▼'}</div>
                  </div>
                  {openDropdown === 'transferFrom' && (
                    <div style={customDropdownMenuStyle}>
                      {accounts.map(acc => (
                        <div key={`from-${acc}`} onClick={() => { setPaymentMethod(acc); setOpenDropdown(null); }} style={customDropdownItemStyle} onMouseOver={(e) => e.currentTarget.style.background = '#1a1d24'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                          {renderIconOrText(acc, '20px')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'center', color: '#b666ff', fontSize: '20px', marginBottom: '15px' }}>⬇️</div>
              <div>
                <div style={{...labelStyle, color: '#00ff66'}}>📥 入金先 (増える口座)</div>
                <div style={{ position: 'relative', zIndex: openDropdown === 'transferTo' ? 100 : 1 }}>
                  <div onClick={() => setOpenDropdown(openDropdown === 'transferTo' ? null : 'transferTo')} style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderColor: openDropdown === 'transferTo' ? '#b666ff' : '#252838' }}>
                    <div>{renderIconOrText(category, '24px')}</div>
                    <div style={{ color: openDropdown === 'transferTo' ? '#b666ff' : '#666', fontSize: '12px' }}>{openDropdown === 'transferTo' ? '▲' : '▼'}</div>
                  </div>
                  {openDropdown === 'transferTo' && (
                    <div style={customDropdownMenuStyle}>
                      {accounts.map(acc => (
                        <div key={`to-${acc}`} onClick={() => { setCategory(acc); setOpenDropdown(null); }} style={customDropdownItemStyle} onMouseOver={(e) => e.currentTarget.style.background = '#1a1d24'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                          {renderIconOrText(acc, '20px')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <div style={labelStyle}>カテゴリ</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ position: 'relative', flex: 1, zIndex: openDropdown === 'category' ? 100 : 1 }}>
                    <div onClick={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')} style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderColor: openDropdown === 'category' ? '#00bfff' : '#252838' }}>
                      <div>{renderIconOrText(category, '24px')}</div>
                      <div style={{ color: openDropdown === 'category' ? '#00bfff' : '#666', fontSize: '12px' }}>{openDropdown === 'category' ? '▲' : '▼'}</div>
                    </div>
                    {openDropdown === 'category' && (
                      <div style={{ ...customDropdownMenuStyle, borderColor: '#00bfff' }}>
                        {(type === 'expense' ? expenseCategories : incomeCategories).map(cat => (
                          <div key={cat} onClick={() => { setCategory(cat); setOpenDropdown(null); }} style={customDropdownItemStyle} onMouseOver={(e) => e.currentTarget.style.background = '#1a1d24'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                            {renderIconOrText(cat, '20px')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={handleAddCategory} style={addBtnStyle}>+ 追加</button>
                </div>
              </div>
              <div>
                <div style={labelStyle}>支払い・入金先口座</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ position: 'relative', flex: 1, zIndex: openDropdown === 'payment' ? 100 : 1 }}>
                    <div onClick={() => setOpenDropdown(openDropdown === 'payment' ? null : 'payment')} style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderColor: openDropdown === 'payment' ? '#ff9900' : '#252838' }}>
                      <div>{renderIconOrText(paymentMethod, '24px')}</div>
                      <div style={{ color: openDropdown === 'payment' ? '#ff9900' : '#666', fontSize: '12px' }}>{openDropdown === 'payment' ? '▲' : '▼'}</div>
                    </div>
                    {openDropdown === 'payment' && (
                      <div style={{ ...customDropdownMenuStyle, borderColor: '#ff9900' }}>
                        {accounts.map(acc => (
                          <div key={acc} onClick={() => { setPaymentMethod(acc); setOpenDropdown(null); }} style={customDropdownItemStyle} onMouseOver={(e) => e.currentTarget.style.background = '#1a1d24'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                            {renderIconOrText(acc, '20px')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={handleOpenAccountPanel} style={addBtnStyle}>⚙️ 追加/編集</button>
                </div>
              </div>
            </>
          )}

          <div>
            <div style={labelStyle}>メモ (任意)</div>
            <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={type === 'transfer' ? "口座間移動" : "コンビニコーヒー"} style={{...inputStyle, padding: '12px'}} />
          </div>

          <div style={{ marginTop: '5px' }}>
            <LocationScanner onLocationFixed={(loc) => setScanLocation(loc)} />
          </div>

          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting} 
            style={{ 
              background: isSubmitting ? '#555' : (dbMode === 'sync' ? '#00ff66' : '#00bfff'), 
              color: '#000', 
              padding: '15px', 
              borderRadius: '8px', 
              border: 'none', 
              fontSize: '18px', 
              fontWeight: 'bold', 
              marginTop: '10px', 
              cursor: isSubmitting ? 'not-allowed' : 'pointer', 
              boxShadow: isSubmitting ? 'none' : `0 0 15px ${dbMode === 'sync' ? 'rgba(0,255,102,0.4)' : 'rgba(0,191,255,0.4)'}`, 
              transition: 'all 0.2s' 
            }}
          >
            {isSubmitting ? '記録中...' : (dbMode === 'sync' ? '🔗 共有金庫に記録する' : '👤 個人金庫に記録する')}
          </button>
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: isKeypadOpen ? 0 : '-100%', left: 0, width: '100%', background: '#0a0c10', borderTop: '2px solid #00ff66', boxShadow: '0 -10px 30px rgba(0,255,102,0.1)', transition: 'bottom 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)', zIndex: 10000, padding: '15px 10px 30px 10px' }}>
        <div style={{ background: '#050608', border: '1px solid #00ff66', borderRadius: '8px', padding: '10px 15px', marginBottom: '15px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', boxShadow: 'inset 0 0 10px rgba(0,255,102,0.1)' }}>
          <div style={{ fontSize: '14px', color: '#00ff66', fontFamily: 'monospace', height: '16px', letterSpacing: '1px' }}>{calcStr || '0'}</div>
          <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold', fontFamily: 'monospace' }}><span style={{ color: '#555', marginRight: '5px' }}>¥</span>{livePreview ? Number(livePreview).toLocaleString() : '0'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', maxWidth: '600px', margin: '0 auto' }}>
          {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '00', '+', '='].map((key) => {
            const isOp = ['÷', '×', '-', '+'].includes(key); const isEq = key === '='; const val = key === '÷' ? '/' : key === '×' ? '*' : key;
            return <button key={key} onClick={() => handleKeypadPress(val)} style={{ ...keyBtnStyle, background: isEq ? '#00ff66' : isOp ? '#1a1d24' : '#11141a', color: isEq ? '#000' : isOp ? '#00bfff' : '#fff', border: `1px solid ${isEq ? '#00ff66' : '#252838'}`, gridRow: isEq ? 'span 2' : 'auto', height: isEq ? '100%' : '55px' }}>{key}</button>;
          })}
          <button onClick={() => handleKeypadPress('C')} style={{ ...keyBtnStyle, color: '#ff3366', background: '#11141a', border: '1px solid #252838', height: '55px' }}>C</button>
          <button onClick={() => handleKeypadPress('BS')} style={{ ...keyBtnStyle, color: '#ff9900', background: '#11141a', border: '1px solid #252838', height: '55px' }}>BS</button>
        </div>
        <button onClick={handleCloseKeypad} style={{ display: 'block', width: '100%', maxWidth: '600px', margin: '15px auto 0', ...memBtnStyle, borderColor: '#ff3366', color: '#ff3366', padding: '12px' }}>閉じる</button>
      </div>
      {isKeypadOpen && <div onClick={handleCloseKeypad} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 9999 }} />}
    </div>
  );
}

const tabStyle = (isActive, activeColor, textColor) => ({ flex: 1, padding: '10px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', background: isActive ? activeColor : 'transparent', color: isActive ? (activeColor === '#ff3366' ? '#fff' : '#000') : textColor });
const labelStyle = { color: '#aaa', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '12px', background: '#1a1d24', color: '#fff', border: '1px solid #252838', borderRadius: '6px', fontSize: '16px', outline: 'none' };
const iconBtnStyle = { background: '#0a0c10', border: '1px solid', borderRadius: '6px', padding: '0 15px', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const addBtnStyle = { background: 'transparent', color: '#00bfff', border: '1px solid #00bfff', borderRadius: '6px', padding: '0 15px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' };
const keyBtnStyle = { borderRadius: '8px', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.1s active:scale-95' };
const memBtnStyle = { background: '#11141a', border: '1px solid #333', color: '#aaa', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' };

const customDropdownMenuStyle = { position: 'absolute', top: '100%', left: 0, width: '100%', background: '#11141a', border: '1px solid #b666ff', borderRadius: '6px', marginTop: '4px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.8)' };
const customDropdownItemStyle = { padding: '12px 15px', borderBottom: '1px solid #252838', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.2s' };