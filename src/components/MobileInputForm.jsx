import { useState, useRef } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function MobileInputForm() {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('🍔 食費');
  const [paymentMethod, setPaymentMethod] = useState('💵 現金');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 🌟 AI処理中のステータス（ローディング画面用）
  const [isOcrProcessing, setIsOcrProcessing] = useState(false); 

  const fileInputRef = useRef(null);

  const [expenseCategories, setExpenseCategories] = useState(['🍔 食費', '🧻 日用品', '🚃 交通費', '🍻 交際費', '🎮 趣味', '🤖 自動取得(AI)', '📦 その他']);
  const [incomeCategories, setIncomeCategories] = useState(['💼 給与・報酬', '💰 お小遣い', '⚡ チャージ', '📦 その他']);
  const [accounts, setAccounts] = useState(['💵 現金', '🏦 三井住友銀行', '🏦 三菱UFJ銀行', '🏦 ゆうちょ銀行', '📱 PayPay', '💍 EVERING']);

  const now = new Date();
  const defaultDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [date, setDate] = useState(defaultDate);

  const handleAmountChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setAmount(val);
  };

  const handleAddCategory = () => {
    const newName = prompt('新しいカテゴリ名を入力してください:');
    if (!newName) return;
    const newItem = `✨ ${newName}`;
    if (type === 'expense') setExpenseCategories([...expenseCategories, newItem]);
    else setIncomeCategories([...incomeCategories, newItem]);
    setCategory(newItem);
  };

  const handleAddAccount = () => {
    const newName = prompt('新しい口座・決済手段を入力してください:');
    if (!newName) return;
    const newItem = `💽 ${newName}`;
    setAccounts([...accounts, newItem]);
    setPaymentMethod(newItem);
  };

  // 📸 レシート画像をAIで解析する最強の関数！！
  const processReceipt = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 🌟 ここでローディング画面を起動！
    setIsOcrProcessing(true);
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Image = reader.result.split(',')[1];

        // 🌟 星翔のホンモノのAPIキーをセット済み！
        const API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY;
        const url = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: base64Image },
              features: [{ type: 'TEXT_DETECTION' }]
            }]
          })
        });

        const data = await response.json();
        
        if (data.error) {
          alert(`⚠️ AIエラー: ${data.error.message}`);
          setIsOcrProcessing(false);
          return;
        }

        const text = data.responses[0]?.textAnnotations[0]?.description;

        if (!text) {
          alert("⚠️ 文字が読み取れませんでした。もう一度明るい場所で撮影してください。");
          setIsOcrProcessing(false);
          return;
        }

        console.log("🤖 AIが読み取った全テキスト:\n", text);
        const lines = text.split('\n');
        
        // ① レシートの一番上の行（店名）をメモに入れる
        if (lines.length > 0) {
          setMemo(lines[0].trim());
        }

        // ② 最強の金額抽出アルゴリズム
        let foundAmount = "";
        
        // パターンA: 「合計」「小計」「お買上」「¥」などのキーワードを探す（下から探すのがコツ）
        for (let i = lines.length - 1; i >= 0; i--) {
          const match = lines[i].match(/(?:合計|合\s*計|小計|お買上額|支払|¥|￥)\s*[:：]?\s*[¥￥]?\s*([0-9,]+)/);
          if (match) {
            foundAmount = match[1].replace(/,/g, '');
            break;
          }
        }

        // パターンB: もしキーワードが見つからなかったら、テキスト内の「一番デカい数字」を合計金額とみなす！
        if (!foundAmount) {
          const allNumbers = text.match(/[0-9,]+/g);
          if (allNumbers) {
            // カンマを抜いて数値化し、最大値を取得
            const maxNum = Math.max(...allNumbers.map(n => parseInt(n.replace(/,/g, ''), 10) || 0));
            if (maxNum > 0 && maxNum < 1000000) { // 異常な数字（電話番号など）を弾くため100万円未満に限定
              foundAmount = maxNum.toString();
            }
          }
        }

        if (foundAmount) {
          setAmount(foundAmount);
        } else {
          alert("⚠️ 文字は読めましたが、合計金額の特定に失敗しました。手動で入力してください。");
        }
        
        setIsOcrProcessing(false); // 処理完了でローディング画面を消す
      };
    } catch (error) {
      console.error("OCRエラー: ", error);
      alert("❌ 画像の解析に失敗しました");
      setIsOcrProcessing(false);
    } finally {
      e.target.value = ''; // 連続撮影できるようにリセット
    }
  };

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) { alert("⚠️ 金額を入力してください！"); return; }
    if (!auth.currentUser) { alert("⚠️ ログインしていません！"); return; }
    if (type === 'transfer' && paymentMethod === category) { alert("⚠️ 出金元と入金先が同じです！"); return; }

    setIsSubmitting(true);
    try {
      const cleanCategory = category.replace(/^[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]\s?/g, '').trim();
      const cleanPaymentMethod = paymentMethod.replace(/^[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]\s?/g, '').trim();

      await addDoc(collection(db, "transactions"), {
        userId: auth.currentUser.uid,
        type: type,
        amount: Number(amount),
        category: cleanCategory, 
        paymentMethod: cleanPaymentMethod,
        memo: memo,
        date: Timestamp.fromDate(new Date(date)),
        createdAt: Timestamp.now()
      });

      setAmount(''); setMemo('');
      alert("✅ 記録完了しました！");
    } catch (error) {
      console.error("記録エラー: ", error); alert("❌ エラーが発生しました");
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
    <div style={{ background: '#0a0c10', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', color: '#fff', fontFamily: 'sans-serif', paddingBottom: '30px' }}>
      
      {/* 🌟 AIスキャン中のサイバーローディング画面！！ */}
      {isOcrProcessing && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(10, 12, 16, 0.9)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(5px)' }}>
          <style>
            {`
              @keyframes scanline { 0% { transform: translateY(-50px); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateY(50px); opacity: 0; } }
              @keyframes pulse { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.8; } }
            `}
          </style>
          <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ position: 'absolute', width: '100%', height: '100%', border: '2px solid #00ff66', borderRadius: '50%', borderTopColor: 'transparent', animation: 'pulse 1.5s infinite linear' }}></div>
            <div style={{ fontSize: '40px', animation: 'pulse 2s infinite ease-in-out' }}>👁️</div>
          </div>
          <div style={{ color: '#00ff66', marginTop: '20px', fontWeight: 'bold', fontSize: '18px', letterSpacing: '2px', textShadow: '0 0 10px #00ff66' }}>
            AI ENGIN SCANNING...
          </div>
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
              
              <button onClick={() => fileInputRef.current.click()} style={{ ...iconBtnStyle, borderColor: '#00bfff' }}>
                📸
              </button>

              <div style={{ ...inputStyle, flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '24px', fontWeight: 'bold', background: '#0a0c10' }}>
                <span style={{ color: '#555' }}>¥</span>
                <input type="text" inputMode="numeric" value={amount ? Number(amount).toLocaleString() : ''} onChange={handleAmountChange} placeholder="0" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '28px', fontWeight: 'bold', textAlign: 'right', width: '100%', outline: 'none', fontFamily: 'monospace' }} />
              </div>
            </div>
          </div>

          {type === 'transfer' ? (
            <>
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
            </>
          ) : (
            <>
              <div>
                <div style={labelStyle}>カテゴリ ({type === 'expense' ? '用途' : '収入源'})</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, flex: 1, appearance: 'none' }}>
                    {(type === 'expense' ? expenseCategories : incomeCategories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button onClick={handleAddCategory} style={addBtnStyle}>+ 追加</button>
                </div>
              </div>

              <div>
                <div style={labelStyle}>支払い・入金先口座</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ ...inputStyle, flex: 1, appearance: 'none' }}>
                    {accounts.map(acc => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
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
const addBtnStyle = { background: 'transparent', color: '#00ff66', border: '1px solid #00ff66', borderRadius: '6px', padding: '0 15px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' };