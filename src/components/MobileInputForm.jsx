import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

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
  const [isOcrProcessing, setIsOcrProcessing] = useState(false); 

  const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '', type: 'success' });
  const [customPrompt, setCustomPrompt] = useState({ isOpen: false, title: '', target: '', text: '' });

  // 🌟 💳 新規口座・カード追加用（クレジット設定強化版）
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [newAccType, setNewAccType] = useState('bank'); // 'bank' or 'credit'
  const [newAccName, setNewAccName] = useState('');
  const [newAccBudget, setNewAccBudget] = useState('');
  const [newAccResetDay, setNewAccResetDay] = useState('1'); // 更新日
  const [newAccPaymentDay, setNewAccPaymentDay] = useState('27'); // 支払日

  const fileInputRef = useRef(null);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [calcHistory, setCalcHistory] = useState([]);
  const [pinnedAmount, setPinnedAmount] = useState(null);

  const [expenseCategories, setExpenseCategories] = useState([
    '/icon-food.png 食費', '/icon-daily.png 日用品', '/icon-train.png 交通費', 
    '/icon-drink.png 交際費', '/icon-hobby.png 趣味', '/icon-ai.png 自動取得(AI)', '/icon-other.png その他'
  ]);
  const [incomeCategories, setIncomeCategories] = useState([
    '/icon-salary.png 給与・報酬', '/icon-money.png お小遣い', '/icon-charge.png チャージ', '/icon-other.png その他'
  ]);
  const [accounts, setAccounts] = useState([
    '/icon-cash.png 現金', '/icon-smbc.png 三井住友銀行', '/icon-mufg.png 三菱UFJ銀行', 
    '/icon-yucho.png ゆうちょ銀行', '/icon-paypay.png PayPay', '/icon-evering.png EVERING', '/icon-other.png リクルートカード'
  ]);

  const now = new Date();
  const defaultDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [date, setDate] = useState(defaultDate);

  const showAlert = (message, alertType = 'success') => {
    setCustomAlert({ isOpen: true, message, type: alertType });
    setTimeout(() => setCustomAlert({ isOpen: false, message: '', type: 'success' }), 3000);
  };

  const handleAddCategory = () => setCustomPrompt({ isOpen: true, title: '新しいカテゴリ名を入力', target: 'category', text: '' });
  
  const handleAddAccount = () => {
    setNewAccName('');
    setNewAccType('bank');
    setNewAccBudget('');
    setNewAccResetDay('1');
    setNewAccPaymentDay('27');
    setShowAccountPanel(true);
  };

  const handlePromptSubmit = () => {
    if (!customPrompt.text.trim()) { setCustomPrompt({ ...customPrompt, isOpen: false }); return; }
    const newItem = `✨ ${customPrompt.text}`;
    if (type === 'expense') setExpenseCategories([...expenseCategories, newItem]);
    else setIncomeCategories([...incomeCategories, newItem]);
    setCategory(newItem);
    setCustomPrompt({ isOpen: false, title: '', target: '', text: '' });
  };

  // 🌟 クレジットカードのフル設定を保存するロジック
  const handleSaveAccount = () => {
    if (!newAccName.trim()) { showAlert("名前を入力してください", "error"); return; }
    
    const iconPath = newAccType === 'credit' ? '/icon-other.png' : '/icon-cash.png';
    const newItem = `${iconPath} ${newAccName.trim()}`;
    
    if (!accounts.includes(newItem)) {
        setAccounts([...accounts, newItem]);
    }
    setPaymentMethod(newItem);

    if (newAccType === 'credit') {
      // データベース（ローカル）にカードの詳細設定をオブジェクトとして保存
      const currentSettings = JSON.parse(localStorage.getItem('creditCardSettings') || '{}');
      currentSettings[newAccName.trim()] = {
        budget: Number(newAccBudget) || 0,
        resetDay: Number(newAccResetDay) || 1,
        paymentDay: Number(newAccPaymentDay) || 27
      };
      localStorage.setItem('creditCardSettings', JSON.stringify(currentSettings));
      showAlert(`💳 ${newAccName.trim()} を残枠管理に登録しました！`, "success");
    } else {
      showAlert("口座を追加しました", "success");
    }
    
    setShowAccountPanel(false);
  };

  const processReceipt = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsOcrProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Image = reader.result.split(',')[1];
        const API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY;
        const url = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: [{ image: { content: base64Image }, features: [{ type: 'TEXT_DETECTION' }] }] }) });
        const data = await response.json();
        if (data.error) { showAlert(`AIエラー: ${data.error.message}`, "error"); setIsOcrProcessing(false); return; }
        const text = data.responses[0]?.textAnnotations[0]?.description;
        if (!text) { showAlert("文字が読めませんでした。", "error"); setIsOcrProcessing(false); return; }
        const lines = text.split('\n');
        if (lines.length > 0) setMemo(lines[0].trim());
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
          setAmount(foundAmount);
          setCalcStr(foundAmount);
          showAlert("金額抽出成功！", "success");
        } else {
          showAlert("合計が見つかりません", "error");
        }
        setIsOcrProcessing(false); 
      };
    } catch (error) { showAlert("解析失敗", "error"); setIsOcrProcessing(false); } finally { e.target.value = ''; }
  };

  const handleSubmit = async () => {
    const finalAmount = calcStr ? evaluateMath(calcStr) : amount;
    if (!finalAmount || Number(finalAmount) <= 0) { showAlert("金額を入力してください！", "error"); return; }
    if (!auth.currentUser) { showAlert("ログインしていません！", "error"); return; }
    if (type === 'transfer' && paymentMethod === category) { showAlert("出金元と入金先が同じです！", "error"); return; }

    setIsSubmitting(true);
    try {
      const getCleanName = (val) => val.startsWith('/') ? val.slice(val.indexOf(' ') + 1) : val.replace(/^[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]\s?/g, '').trim();
      const cleanCategory = getCleanName(category);
      const cleanPaymentMethod = getCleanName(paymentMethod);

      const pos = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null), { timeout: 3000 }
        );
      });

      const txData = {
        userId: auth.currentUser.uid, type: type, amount: Number(finalAmount),
        category: cleanCategory, paymentMethod: cleanPaymentMethod, memo: memo,
        date: Timestamp.fromDate(new Date(date)), createdAt: Timestamp.now()
      };
      if (pos) { txData.lat = pos.lat; txData.lng = pos.lng; }

      await addDoc(collection(db, "transactions"), txData);
      addToHistory(finalAmount);

      setAmount(''); setCalcStr(''); setMemo('');
      showAlert("記録完了！", "success");
    } catch (error) { showAlert("エラー発生", "error"); } finally { setIsSubmitting(false); }
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === 'expense') setCategory(expenseCategories[0]);
    if (newType === 'income') setCategory(incomeCategories[0]);
    if (newType === 'transfer') { setPaymentMethod(accounts[0]); setCategory(accounts[1] || accounts[0]); }
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
    <div style={{ background: '#0a0c10', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', color: '#fff', fontFamily: 'sans-serif', paddingBottom: '30px', position: 'relative' }}>
      
      {customAlert.isOpen && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: customAlert.type === 'success' ? 'rgba(0, 255, 102, 0.1)' : 'rgba(255, 51, 102, 0.1)', border: `1px solid ${customAlert.type === 'success' ? '#00ff66' : '#ff3366'}`, color: customAlert.type === 'success' ? '#00ff66' : '#ff3366', padding: '12px 24px', borderRadius: '30px', fontWeight: 'bold', fontSize: '14px', backdropFilter: 'blur(10px)', zIndex: 10000 }}>
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

      {/* 🌟 完全に書き直された決済追加パネル */}
      {showAccountPanel && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#0a0c10', border: '1px solid #00ff66', borderRadius: '12px', padding: '25px', width: '85%', maxWidth: '340px', boxShadow: '0 0 40px rgba(0, 255, 102, 0.2)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <h3 style={{ margin: 0, color: '#00ff66', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚙️</span> SYSTEM CONFIG // 決済追加
            </h3>

            <div style={{ display: 'flex', background: '#11141a', borderRadius: '6px', padding: '4px', border: '1px solid #252838' }}>
              <button onClick={() => setNewAccType('bank')} style={tabStyle(newAccType === 'bank', '#00bfff', '#aaa')}>🏦 一般口座</button>
              <button onClick={() => setNewAccType('credit')} style={tabStyle(newAccType === 'credit', '#ff9900', '#aaa')}>💳 クレジット</button>
            </div>

            <div>
              <div style={labelStyle}>[1] {newAccType === 'credit' ? 'クレジットカード名' : '口座名'}</div>
              <input type="text" value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder={newAccType === 'credit' ? "例：リクルートカード" : "例：PayPay銀行"} style={inputStyle} />
            </div>

            {/* 💳 クレジットカード専用のハッキング設定フォーム */}
            {newAccType === 'credit' && (
              <div style={{ background: '#11141a', padding: '15px', borderRadius: '8px', border: `1px solid #ff9900`, animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                
                <div>
                  <div style={{ ...labelStyle, color: '#ff9900' }}>[2] 今月の利用枠（予算上限）</div>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#0a0c10', border: '1px solid #ff990055', borderRadius: '6px', padding: '0 10px' }}>
                    <span style={{ color: '#ff9900', fontSize: '18px' }}>¥</span>
                    <input type="number" value={newAccBudget} onChange={e => setNewAccBudget(e.target.value)} placeholder="20000" style={{ ...inputStyle, border: 'none', background: 'transparent', color: '#ff9900', fontSize: '20px', fontWeight: 'bold' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...labelStyle, color: '#00ff66', fontSize: '10px' }}>[3] 更新日 (リセット)</div>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#0a0c10', border: '1px solid #00ff6655', borderRadius: '6px', padding: '0 10px' }}>
                      <span style={{ color: '#00ff66', fontSize: '12px' }}>毎月</span>
                      <input type="number" value={newAccResetDay} onChange={e => setNewAccResetDay(e.target.value)} min="1" max="31" style={{ ...inputStyle, border: 'none', background: 'transparent', color: '#00ff66', fontSize: '16px', fontWeight: 'bold', textAlign: 'center', padding: '12px 5px' }} />
                      <span style={{ color: '#00ff66', fontSize: '12px' }}>日</span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...labelStyle, color: '#ff3366', fontSize: '10px' }}>[4] 支払日 (引き落とし)</div>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#0a0c10', border: '1px solid #ff336655', borderRadius: '6px', padding: '0 10px' }}>
                      <span style={{ color: '#ff3366', fontSize: '12px' }}>毎月</span>
                      <input type="number" value={newAccPaymentDay} onChange={e => setNewAccPaymentDay(e.target.value)} min="1" max="31" style={{ ...inputStyle, border: 'none', background: 'transparent', color: '#ff3366', fontSize: '16px', fontWeight: 'bold', textAlign: 'center', padding: '12px 5px' }} />
                      <span style={{ color: '#ff3366', fontSize: '12px' }}>日</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => setShowAccountPanel(false)} style={{ flex: 1, padding: '12px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '6px', fontWeight: 'bold' }}>CANCEL</button>
              <button onClick={handleSaveAccount} style={{ flex: 1, padding: '12px', background: newAccType === 'credit' ? '#ff9900' : '#00ff66', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', boxShadow: `0 0 15px ${newAccType === 'credit' ? 'rgba(255,153,0,0.4)' : 'rgba(0,255,102,0.4)'}` }}>
                登録完了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px 20px', borderBottom: '1px solid #1a1d24' }}>
          <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/icon-input-title.png" alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            支出・収入クイック入力
          </h2>    
       </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#11141a', width: '100%', maxWidth: '400px', borderRadius: '12px', border: '1px solid #252838', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', background: '#0a0c10', borderRadius: '8px', padding: '4px', border: '1px solid #252838' }}>
            <button onClick={() => handleTypeChange('expense')} style={tabStyle(type === 'expense', '#ff3366', '#fff')}>支出</button>
            <button onClick={() => handleTypeChange('income')} style={tabStyle(type === 'income', '#00bfff', '#aaa')}>収入</button>
            <button onClick={() => handleTypeChange('transfer')} style={tabStyle(type === 'transfer', '#b666ff', '#aaa')}>振替</button>
          </div>

          <div style={{ boxSizing: 'border-box', width: '100%', overflow: 'hidden' }}>
            <div style={labelStyle}>発生日時</div>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }} />
          </div>

          <div>
            <div style={labelStyle}>金額 (数式入力可)</div>
            <div style={{ display: 'flex', gap: '10px' }}>
             <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={processReceipt} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current.click()} style={{ ...iconBtnStyle, borderColor: '#00bfff', padding: '0 10px' }}>
                <img src="/icon-camera.png" alt="scan" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
              </button>
              
              <div onClick={() => setIsKeypadOpen(true)} style={{ ...inputStyle, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', background: '#0a0c10', cursor: 'text', position: 'relative' }}>
                <div style={{ fontSize: '12px', color: '#888', height: '14px', fontFamily: 'monospace' }}>{calcStr || '0'}</div>
                <div style={{ color: '#fff', fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#555', marginRight: '4px', fontSize: '20px' }}>¥</span>
                  {livePreview ? Number(livePreview).toLocaleString() : '0'}
                </div>
              </div>
            </div>
          </div>

          {/* セレクトボックス群 */}
          {type === 'transfer' ? (
            <div style={{ padding: '15px', background: '#1a1d24', borderRadius: '8px', border: '1px dashed #b666ff' }}>
              <div style={{ marginBottom: '15px' }}>
                <div style={{...labelStyle, color: '#ff3366'}}>📤 出金元 (減る口座)</div>
                <div style={{ ...inputStyle, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
                  <div style={{ pointerEvents: 'none' }}>{renderIconOrText(paymentMethod, '24px')}</div>
                  <div style={{ color: '#666', fontSize: '12px', pointerEvents: 'none' }}>▼</div>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
                    {accounts.map(acc => <option key={`from-${acc}`} value={acc}>{acc.startsWith('/') ? acc.slice(acc.indexOf(' ') + 1) : acc}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ textAlign: 'center', color: '#b666ff', fontSize: '20px', marginBottom: '15px' }}>⬇️</div>
              <div>
                <div style={{...labelStyle, color: '#00ff66'}}>📥 入金先 (増える口座)</div>
                <div style={{ ...inputStyle, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
                  <div style={{ pointerEvents: 'none' }}>{renderIconOrText(category, '24px')}</div>
                  <div style={{ color: '#666', fontSize: '12px', pointerEvents: 'none' }}>▼</div>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
                    {accounts.map(acc => <option key={`to-${acc}`} value={acc}>{acc.startsWith('/') ? acc.slice(acc.indexOf(' ') + 1) : acc}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <div style={labelStyle}>カテゴリ</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ ...inputStyle, flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
                    <div style={{ pointerEvents: 'none' }}>{renderIconOrText(category, '24px')}</div>
                    <div style={{ color: '#666', fontSize: '12px', pointerEvents: 'none' }}>▼</div>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
                      {(type === 'expense' ? expenseCategories : incomeCategories).map(cat => <option key={cat} value={cat}>{cat.startsWith('/') ? cat.slice(cat.indexOf(' ') + 1) : cat}</option>)}
                    </select>
                  </div>
                  <button onClick={handleAddCategory} style={addBtnStyle}>+ 追加</button>
                </div>
              </div>
              <div>
                <div style={labelStyle}>支払い・入金先口座</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ ...inputStyle, flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
                    <div style={{ pointerEvents: 'none' }}>{renderIconOrText(paymentMethod, '24px')}</div>
                    <div style={{ color: '#666', fontSize: '12px', pointerEvents: 'none' }}>▼</div>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
                      {accounts.map(acc => <option key={acc} value={acc}>{acc.startsWith('/') ? acc.slice(acc.indexOf(' ') + 1) : acc}</option>)}
                    </select>
                  </div>
                  <button onClick={handleAddAccount} style={addBtnStyle}>+ 追加</button>
                </div>
              </div>
            </>
          )}

          <div>
            <div style={labelStyle}>メモ (任意)</div>
            <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={type === 'transfer' ? "口座間移動" : "コンビニコーヒー"} style={inputStyle} />
          </div>

          <button onClick={handleSubmit} disabled={isSubmitting} style={{ background: isSubmitting ? '#555' : '#00ff66', color: '#000', padding: '15px', borderRadius: '8px', border: 'none', fontSize: '18px', fontWeight: 'bold', marginTop: '10px', cursor: isSubmitting ? 'not-allowed' : 'pointer', boxShadow: isSubmitting ? 'none' : '0 0 15px rgba(0,255,102,0.3)', transition: 'all 0.2s' }}>
            {isSubmitting ? '記録中...' : '記録する'}
          </button>
        </div>
      </div>

      {/* 🌟 ハッカー仕様 カスタムキーパッド */}
      <div style={{ position: 'fixed', bottom: isKeypadOpen ? 0 : '-100%', left: 0, width: '100%', background: '#0a0c10', borderTop: '2px solid #00ff66', boxShadow: '0 -10px 30px rgba(0,255,102,0.1)', transition: 'bottom 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)', zIndex: 10000, padding: '15px 10px 30px 10px' }}>
        <div style={{ background: '#050608', border: '1px solid #00ff66', borderRadius: '8px', padding: '10px 15px', marginBottom: '15px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', boxShadow: 'inset 0 0 10px rgba(0,255,102,0.1)' }}>
          <div style={{ fontSize: '14px', color: '#00ff66', fontFamily: 'monospace', height: '16px', letterSpacing: '1px' }}>{calcStr || '0'}</div>
          <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold', fontFamily: 'monospace' }}><span style={{ color: '#555', marginRight: '5px' }}>¥</span>{livePreview ? Number(livePreview).toLocaleString() : '0'}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
          <button onClick={togglePin} style={{ ...memBtnStyle, borderColor: '#ff9900', color: '#ff9900' }}>📌 記憶 {pinnedAmount ? `(¥${Number(pinnedAmount).toLocaleString()})` : ''}</button>
          {pinnedAmount && <button onClick={() => setCalcStr(pinnedAmount)} style={{ ...memBtnStyle, background: '#ff990022' }}>呼出</button>}
          <div style={{ flex: 1, display: 'flex', gap: '5px' }}>{calcHistory.map((h, i) => <button key={i} onClick={() => setCalcStr(h)} style={histBtnStyle}>¥{Number(h).toLocaleString()}</button>)}</div>
          <button onClick={() => setIsKeypadOpen(false)} style={{ ...memBtnStyle, borderColor: '#ff3366', color: '#ff3366' }}>閉じる</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '00', '+', '='].map((key) => {
            const isOp = ['÷', '×', '-', '+'].includes(key); const isEq = key === '='; const val = key === '÷' ? '/' : key === '×' ? '*' : key;
            return <button key={key} onClick={() => handleKeypadPress(val)} style={{ ...keyBtnStyle, background: isEq ? '#00ff66' : isOp ? '#1a1d24' : '#11141a', color: isEq ? '#000' : isOp ? '#00bfff' : '#fff', border: `1px solid ${isEq ? '#00ff66' : '#252838'}`, gridRow: isEq ? 'span 2' : 'auto', height: isEq ? '100%' : '55px' }}>{key}</button>;
          })}
          <button onClick={() => handleKeypadPress('C')} style={{ ...keyBtnStyle, color: '#ff3366', background: '#11141a', border: '1px solid #252838', height: '55px' }}>C</button>
          <button onClick={() => handleKeypadPress('BS')} style={{ ...keyBtnStyle, color: '#ff9900', background: '#11141a', border: '1px solid #252838', height: '55px' }}>BS</button>
        </div>
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
const histBtnStyle = { background: '#1a1d24', border: '1px solid #00bfff44', color: '#00bfff', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' };