import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import LocationScanner from './LocationScanner';

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

export default function MobileInputForm() {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [calcStr, setCalcStr] = useState('');
  const [category, setCategory] = useState('/icon-food.png 食費');
  const [paymentMethod, setPaymentMethod] = useState('/icon-cash.png 現金');
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

  const fileInputRef = useRef(null);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [calcHistory, setCalcHistory] = useState([]);
  const [pinnedAmount, setPinnedAmount] = useState(null);

  // 🌟 不死身のデフォルトデータ（絶対に消えないベースデータ）
  const defaultExpense = ['/icon-food.png 食費', '/icon-daily.png 日用品', '/icon-train.png 交通費', '/icon-drink.png 交際費', '/icon-hobby.png 趣味', '/icon-ai.png 自動取得(AI)', '/icon-other.png その他'];
  const defaultIncome = ['/icon-salary.png 給与・報酬', '/icon-money.png お小遣い', '/icon-charge.png チャージ', '/icon-other.png その他'];
  const defaultAccounts = ['/icon-cash.png 現金', '/icon-smbc.png 三井住友銀行', '/icon-mufg.png 三菱UFJ銀行', '/icon-yucho.png ゆうちょ銀行', '/icon-paypay.png PayPay', '/icon-evering.png EVERING', '/icon-other.png リクルートカード'];

  // 🌟 セーブデータとデフォルトデータを自動合体させる処理
  const [expenseCategories, setExpenseCategories] = useState(() => {
    const saved = localStorage.getItem('m402_expense_cats');
    return Array.from(new Set([...defaultExpense, ...(saved ? JSON.parse(saved) : [])]));
  });
  
  const [incomeCategories, setIncomeCategories] = useState(() => {
    const saved = localStorage.getItem('m402_income_cats');
    return Array.from(new Set([...defaultIncome, ...(saved ? JSON.parse(saved) : [])]));
  });
  
  const [accounts, setAccounts] = useState(() => {
    const saved = localStorage.getItem('m402_accounts');
    return Array.from(new Set([...defaultAccounts, ...(saved ? JSON.parse(saved) : [])]));
  });

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
    const cards = JSON.parse(localStorage.getItem('creditCardSettings') || '{}');
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
    if (accountPanelMode === 'add') {
      if (!newAccName.trim()) { showAlert("名前を入力してください", "error"); return; }
      const iconPath = newAccType === 'credit' ? '/icon-other.png' : '/icon-cash.png';
      const newItem = `${iconPath} ${newAccName.trim()}`;
      
      if (!accounts.includes(newItem)) {
        const newAccounts = [...accounts, newItem];
        setAccounts(newAccounts);
        localStorage.setItem('m402_accounts', JSON.stringify(newAccounts));
      }
      setPaymentMethod(newItem);

      if (newAccType === 'credit') {
        const currentSettings = JSON.parse(localStorage.getItem('creditCardSettings') || '{}');
        currentSettings[newAccName.trim()] = { 
          budget: Number(newAccBudget) || 0, 
          resetDay: Number(newAccResetDay) || 1, 
          paymentDay: Number(newAccPaymentDay) || 27,
          withdrawalSource: newAccWithdrawalSource 
        };
        localStorage.setItem('creditCardSettings', JSON.stringify(currentSettings));
        showAlert(`💳 ${newAccName.trim()} を登録しました`, "success");
      } else {
        showAlert("口座を追加しました", "success");
      }
    } else {
      if (!editTargetCard) { showAlert("修正する項目を選択してください", "error"); return; }
      const currentSettings = JSON.parse(localStorage.getItem('creditCardSettings') || '{}');
      currentSettings[editTargetCard] = { 
        budget: Number(newAccBudget) || 0, 
        resetDay: Number(newAccResetDay) || 1, 
        paymentDay: Number(newAccPaymentDay) || 27,
        withdrawalSource: newAccWithdrawalSource
      };
      localStorage.setItem('creditCardSettings', JSON.stringify(currentSettings));
      showAlert(`💳 ${editTargetCard} の設定を更新しました！`, "success");
    }
    setShowAccountPanel(false);
  };

  const handlePromptSubmit = () => {
    if (!customPrompt.text.trim()) { setCustomPrompt({ ...customPrompt, isOpen: false }); return; }
    const newItem = `✨ ${customPrompt.text}`;
    
    if (type === 'expense') {
      const newCats = [...expenseCategories, newItem];
      setExpenseCategories(newCats);
      localStorage.setItem('m402_expense_cats', JSON.stringify(newCats));
    } else {
      const newCats = [...incomeCategories, newItem];
      setIncomeCategories(newCats);
      localStorage.setItem('m402_income_cats', JSON.stringify(newCats));
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
      showAlert("記録完了！", "success");
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
      if (result) { setAmount(result); setCalcStr(result); addToHistory(result); setIsKeypadOpen(false); }
    } else { setCalcStr(prev => prev + key); }
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
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: customAlert.type === 'success' ? 'rgba(0, 255, 102, 0.1)' : 'rgba(255, 51, 102, 0.1)', border: `1px solid ${customAlert.type === 'success' ? '#00ff66' : '#ff3366'}`, color: customAlert.type === 'success' ? '#00ff66' : '#ff3366', padding: '12px 24px', borderRadius: '30px', fontWeight: 'bold', fontSize: '14px', backdropFilter: 'blur(10px)', zIndex: 999999 }}>
          {customAlert.type === 'success' ? '✅' : '⚠️'} {customAlert.message}
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
              <span>⚙️</span> SYSTEM CONFIG
            </h3>
            <div style={{ display: 'flex', background: '#11141a', borderRadius: '6px', padding: '4px', border: '1px solid #252838' }}>
              <button onClick={() => setAccountPanelMode('add')} style={tabStyle(accountPanelMode === 'add', '#00ff66', '#aaa')}>✨ 新規登録</button>
              <button onClick={() => setAccountPanelMode('edit')} style={tabStyle(accountPanelMode === 'edit', '#ff9900', '#aaa')}>⚙️ 編集</button>
            </div>
            
            {accountPanelMode === 'add' ? (
              <>
                <div style={{ display: 'flex', background: '#1a1d24', borderRadius: '6px', padding: '4px', border: '1px solid #333' }}>
                  <button onClick={() => setNewAccType('bank')} style={tabStyle(newAccType === 'bank', '#00bfff', '#aaa')}>🏦 一般口座</button>
                  <button onClick={() => setNewAccType('credit')} style={tabStyle(newAccType === 'credit', '#ff9900', '#aaa')}>💳 クレジット</button>
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
              <button onClick={() => setShowAccountPanel(false)} style={{ flex: 1, padding: '12px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '6px', fontWeight: 'bold' }}>CANCEL</button>
              <button onClick={handleSaveAccount} style={{ flex: 1, padding: '12px', background: accountPanelMode === 'edit' ? '#ff9900' : '#00ff66', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>{accountPanelMode === 'edit' ? '修正を保存' : '登録完了'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px 20px', borderBottom: '1px solid #1a1d24' }}>
        <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/icon-input-title.png" alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          支出・収入クイック入力
        </h2>    
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

          <button onClick={handleSubmit} disabled={isSubmitting} style={{ background: isSubmitting ? '#555' : '#00ff66', color: '#000', padding: '15px', borderRadius: '8px', border: 'none', fontSize: '18px', fontWeight: 'bold', marginTop: '10px', cursor: isSubmitting ? 'not-allowed' : 'pointer', boxShadow: isSubmitting ? 'none' : '0 0 15px rgba(0,255,102,0.3)', transition: 'all 0.2s' }}>
            {isSubmitting ? '記録中...' : '記録する'}
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
        <button onClick={() => setIsKeypadOpen(false)} style={{ display: 'block', width: '100%', maxWidth: '600px', margin: '15px auto 0', ...memBtnStyle, borderColor: '#ff3366', color: '#ff3366', padding: '12px' }}>閉じる</button>
      </div>
      {isKeypadOpen && <div onClick={() => setIsKeypadOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 9999 }} />}
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

// 🌟 完全自作ドロップダウン用のスタイル
const customDropdownMenuStyle = { position: 'absolute', top: '100%', left: 0, width: '100%', background: '#11141a', border: '1px solid #b666ff', borderRadius: '6px', marginTop: '4px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.8)' };
const customDropdownItemStyle = { padding: '12px 15px', borderBottom: '1px solid #252838', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.2s' };