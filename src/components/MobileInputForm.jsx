import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function MobileInputForm() {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('🍔 食費');
  const [paymentMethod, setPaymentMethod] = useState('💵 現金');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false); 

  // 🌟 自作ポップアップ用のState
  const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '', type: 'success' });
  const [customPrompt, setCustomPrompt] = useState({ isOpen: false, title: '', target: '', text: '' });

  const fileInputRef = useRef(null);

  const [expenseCategories, setExpenseCategories] = useState(['🍔 食費', '🧻 日用品', '🚃 交通費', '🍻 交際費', '🎮 趣味', '🤖 自動取得(AI)', '📦 その他']);
  const [incomeCategories, setIncomeCategories] = useState(['💼 給与・報酬', '💰 お小遣い', '⚡ チャージ', '📦 その他']);
  const [accounts, setAccounts] = useState(['💵 現金', '🏦 三井住友銀行', '🏦 三菱UFJ銀行', '🏦 ゆうちょ銀行', '📱 PayPay', '💍 EVERING']);

  const now = new Date();
  const defaultDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [date, setDate] = useState(defaultDate);

  // 🌟 自作アラート関数
  const showAlert = (message, alertType = 'success') => {
    setCustomAlert({ isOpen: true, message, type: alertType });
    setTimeout(() => setCustomAlert({ isOpen: false, message: '', type: 'success' }), 3000);
  };

  const handleAmountChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setAmount(val);
  };

  // 🌟 ブラウザのprompt()ではなく、自作プロンプトを開く
  const handleAddCategory = () => setCustomPrompt({ isOpen: true, title: '新しいカテゴリ名を入力', target: 'category', text: '' });
  const handleAddAccount = () => setCustomPrompt({ isOpen: true, title: '新しい口座・決済手段を入力', target: 'account', text: '' });

  // 🌟 自作プロンプトの決定ボタン処理
  const handlePromptSubmit = () => {
    if (!customPrompt.text.trim()) {
      setCustomPrompt({ ...customPrompt, isOpen: false });
      return;
    }
    if (customPrompt.target === 'category') {
      const newItem = `✨ ${customPrompt.text}`;
      if (type === 'expense') setExpenseCategories([...expenseCategories, newItem]);
      else setIncomeCategories([...incomeCategories, newItem]);
      setCategory(newItem);
    } else if (customPrompt.target === 'account') {
      const newItem = ` ${customPrompt.text}`;
      setAccounts([...accounts, newItem]);
      setPaymentMethod(newItem);
    }
    setCustomPrompt({ isOpen: false, title: '', target: '', text: '' });
  };

  // 📸 レシート画像をAIで解析
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

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{ image: { content: base64Image }, features: [{ type: 'TEXT_DETECTION' }] }]
          })
        });

        const data = await response.json();
        
        if (data.error) {
          showAlert(`AIエラー: ${data.error.message}`, "error");
          setIsOcrProcessing(false);
          return;
        }

        const text = data.responses[0]?.textAnnotations[0]?.description;

        if (!text) {
          showAlert("文字が読み取れませんでした。明るい場所で再撮影してください。", "error");
          setIsOcrProcessing(false);
          return;
        }

        console.log("🤖 AI解析テキスト:\n", text);
        const lines = text.split('\n');
        
        if (lines.length > 0) setMemo(lines[0].trim());

        let foundAmount = "";
        for (let i = lines.length - 1; i >= 0; i--) {
          const match = lines[i].match(/(?:合計|合\s*計|小計|お買上額|支払|¥|￥)\s*[:：]?\s*[¥￥]?\s*([0-9,]+)/);
          if (match) {
            foundAmount = match[1].replace(/,/g, '');
            break;
          }
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
          showAlert("AIによる金額の抽出に成功しました！", "success");
        } else {
          showAlert("合計金額の特定に失敗しました。手動で入力してください。", "error");
        }
        setIsOcrProcessing(false); 
      };
    } catch (error) {
      console.error("OCRエラー: ", error);
      showAlert("画像の解析に失敗しました", "error");
      setIsOcrProcessing(false);
    } finally {
      e.target.value = ''; 
    }
  };

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) { showAlert("金額を入力してください！", "error"); return; }
    if (!auth.currentUser) { showAlert("ログインしていません！", "error"); return; }
    if (type === 'transfer' && paymentMethod === category) { showAlert("出金元と入金先が同じです！", "error"); return; }

    setIsSubmitting(true);
    try {
      const cleanCategory = category.replace(/^[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]\s?/g, '').trim();
      const cleanPaymentMethod = paymentMethod.replace(/^[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]\s?/g, '').trim();

      // 📍 GPS取得
      const getPosition = () => {
        return new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => resolve(null),
            { timeout: 3000 }
          );
        });
      };
      
      const pos = await getPosition();

      const txData = {
        userId: auth.currentUser.uid,
        type: type,
        amount: Number(amount),
        category: cleanCategory, 
        paymentMethod: cleanPaymentMethod,
        memo: memo,
        date: Timestamp.fromDate(new Date(date)),
        createdAt: Timestamp.now()
      };

      if (pos) {
        txData.lat = pos.lat;
        txData.lng = pos.lng;
      }

      await addDoc(collection(db, "transactions"), txData);

      setAmount(''); setMemo('');
      showAlert("記録が完了しました！", "success");
    } catch (error) {
      console.error("記録エラー: ", error); 
      showAlert("記録中にエラーが発生しました", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === 'expense') setCategory(expenseCategories[0]);
    if (newType === 'income') setCategory(incomeCategories[0]);
    if (newType === 'transfer') {
      setPaymentMethod(accounts[0]);
      setCategory(accounts[1] || accounts[0]);
    }
  };

  return (
    <div style={{ background: '#0a0c10', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', color: '#fff', fontFamily: 'sans-serif', paddingBottom: '30px', position: 'relative' }}>
      
      {/* 🌟 自作アラート（画面上部からフワッと） */}
      {customAlert.isOpen && (
        <div style={{
          position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: customAlert.type === 'success' ? 'rgba(0, 255, 102, 0.1)' : 'rgba(255, 51, 102, 0.1)',
          border: `1px solid ${customAlert.type === 'success' ? '#00ff66' : '#ff3366'}`,
          color: customAlert.type === 'success' ? '#00ff66' : '#ff3366',
          padding: '12px 24px', borderRadius: '30px', fontWeight: 'bold', fontSize: '14px',
          backdropFilter: 'blur(10px)', boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          zIndex: 10000, display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'fadeInOut 3s forwards'
        }}>
          {customAlert.type === 'success' ? '✅' : '⚠️'} {customAlert.message}
        </div>
      )}

      {/* 🌟 自作プロンプト（中央にポップアップ） */}
      {customPrompt.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
        }}>
          <div style={{ background: '#11141a', border: '1px solid #00bfff', borderRadius: '12px', padding: '20px', width: '80%', maxWidth: '320px', boxShadow: '0 0 30px rgba(0, 191, 255, 0.2)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '16px' }}>{customPrompt.title}</h3>
            <input 
              type="text" autoFocus value={customPrompt.text} 
              onChange={(e) => setCustomPrompt({...customPrompt, text: e.target.value})}
              onKeyDown={(e) => e.key === 'Enter' && handlePromptSubmit()}
              placeholder="入力してください..." style={{ ...inputStyle, marginBottom: '20px' }} 
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setCustomPrompt({ ...customPrompt, isOpen: false })} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#aaa', border: '1px solid #555', borderRadius: '6px' }}>キャンセル</button>
              <button onClick={handlePromptSubmit} style={{ flex: 1, padding: '10px', background: '#00bfff', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>追加</button>
            </div>
          </div>
        </div>
      )}

      {/* AIローディング画面 */}
      {isOcrProcessing && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(10, 12, 16, 0.9)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(5px)' }}>
          <style>
            {`
              @keyframes pulse { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.8; } }
              @keyframes fadeInOut { 0% { opacity: 0; transform: translate(-50%, -20px); } 10% { opacity: 1; transform: translate(-50%, 0); } 90% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -20px); } }
            `}
          </style>
          <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', border: '2px solid #00ff66', borderRadius: '50%', borderTopColor: 'transparent', animation: 'pulse 1.5s infinite linear' }}></div>
            <div style={{ fontSize: '40px', animation: 'pulse 2s infinite ease-in-out' }}>👁️</div>
          </div>
          <div style={{ color: '#00ff66', marginTop: '20px', fontWeight: 'bold', fontSize: '18px', letterSpacing: '2px', textShadow: '0 0 10px #00ff66' }}>AI ENGIN SCANNING...</div>
          <div style={{ color: '#00bfff', marginTop: '10px', fontSize: '14px' }}>レシートのデータを解析中</div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px 20px', borderBottom: '1px solid #1a1d24' }}>
        <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>💸 支出・収入クイック入力</h2>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#11141a', width: '100%', maxWidth: '400px', borderRadius: '12px', border: '1px solid #252838', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', background: '#0a0c10', borderRadius: '8px', padding: '4px', border: '1px solid #252838' }}>
            <button onClick={() => handleTypeChange('expense')} style={tabStyle(type === 'expense', '#ff3366', '#fff')}>支出</button>
            <button onClick={() => handleTypeChange('income')} style={tabStyle(type === 'income', '#00bfff', '#aaa')}>収入</button>
            <button onClick={() => handleTypeChange('transfer')} style={tabStyle(type === 'transfer', '#b666ff', '#aaa')}>振替</button>
          </div>

          <div>
            <div style={labelStyle}>発生日時</div>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <div style={labelStyle}>金額</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={processReceipt} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current.click()} style={{ ...iconBtnStyle, borderColor: '#00bfff' }}>📸</button>
              <div style={{ ...inputStyle, flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '24px', fontWeight: 'bold', background: '#0a0c10' }}>
                <span style={{ color: '#555' }}>¥</span>
                <input type="text" inputMode="numeric" value={amount ? Number(amount).toLocaleString() : ''} onChange={handleAmountChange} placeholder="0" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '28px', fontWeight: 'bold', textAlign: 'right', width: '100%', outline: 'none', fontFamily: 'monospace' }} />
              </div>
            </div>
          </div>

          {type === 'transfer' ? (
            <div style={{ padding: '15px', background: '#1a1d24', borderRadius: '8px', border: '1px dashed #b666ff' }}>
              <div style={{ marginBottom: '15px' }}>
                <div style={{...labelStyle, color: '#ff3366'}}>📤 出金元 (減る口座)</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ ...inputStyle, flex: 1, background: '#0a0c10' }}>
                    {accounts.map(acc => <option key={`from-${acc}`} value={acc}>{acc}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ textAlign: 'center', color: '#b666ff', fontSize: '20px', marginBottom: '15px' }}>⬇️</div>
              <div>
                <div style={{...labelStyle, color: '#00ff66'}}>📥 入金先 (増える口座)</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, flex: 1, background: '#0a0c10' }}>
                    {accounts.map(acc => <option key={`to-${acc}`} value={acc}>{acc}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <div style={labelStyle}>カテゴリ ({type === 'expense' ? '用途' : '収入源'})</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, flex: 1, appearance: 'none' }}>
                    {(type === 'expense' ? expenseCategories : incomeCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <button onClick={handleAddCategory} style={addBtnStyle}>+ 追加</button>
                </div>
              </div>

              <div>
                <div style={labelStyle}>支払い・入金先口座</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ ...inputStyle, flex: 1, appearance: 'none' }}>
                    {accounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                  </select>
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
    </div>
  );
}

const tabStyle = (isActive, activeColor, textColor) => ({ flex: 1, padding: '10px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', background: isActive ? activeColor : 'transparent', color: isActive ? (activeColor === '#ff3366' ? '#fff' : '#000') : textColor });
const labelStyle = { color: '#aaa', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' };
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '12px', background: '#1a1d24', color: '#fff', border: '1px solid #252838', borderRadius: '6px', fontSize: '16px', outline: 'none' };
const iconBtnStyle = { background: '#0a0c10', border: '1px solid', borderRadius: '6px', padding: '0 15px', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const addBtnStyle = { background: 'transparent', color: '#00bfff', border: '1px solid #00bfff', borderRadius: '6px', padding: '0 15px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' };