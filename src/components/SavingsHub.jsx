import React, { useState, useEffect, useMemo } from 'react';
import { saveSettingBoth } from '../utils/cloudSync';
import { useCountUp } from '../utils/animationUtils';

export default function SavingsHub({ transactions = [], cyclePeriod, user, isMobile, themeColor = '#00bfff', isStealthMode = false }) {
  // 🌟 1. 月間目標予算（デフォルト 120,000円）
  const [monthlyBudget, setMonthlyBudget] = useState(() => {
    const saved = localStorage.getItem('m402_monthly_budget');
    return saved ? Number(saved) : 120000;
  });

  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudgetInput, setTempBudgetInput] = useState(String(monthlyBudget));

  // 🌟 2. つもり貯金（我慢ログ）リスト
  const [tsumoriLogs, setTsumoriLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('m402_tsumori_logs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [showHistory, setShowHistory] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // トースト表示用タイマー
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // クラウド同期等によるlocalStorage更新を反映
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'm402_monthly_budget' && e.newValue) {
        setMonthlyBudget(Number(e.newValue));
      }
      if (e.key === 'm402_tsumori_logs' && e.newValue) {
        try {
          setTsumoriLogs(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // 目標予算の保存
  const handleSaveBudget = () => {
    const num = Number(tempBudgetInput);
    if (!isNaN(num) && num > 0) {
      setMonthlyBudget(num);
      saveSettingBoth(user?.uid, 'monthlyBudget', 'm402_monthly_budget', num);
    }
    setIsEditingBudget(false);
  };

  // 🌟 つもり貯金（我慢）を1タップ追加
  const handleAddTsumori = (title, amount) => {
    if (navigator.vibrate) navigator.vibrate(40);
    const newEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      amount: Number(amount),
      timestamp: new Date().toISOString(),
      cycleLabel: cyclePeriod?.label || ''
    };
    const updated = [newEntry, ...tsumoriLogs];
    setTsumoriLogs(updated);
    saveSettingBoth(user?.uid, 'savingsTsumoriLogs', 'm402_tsumori_logs', updated);
    setToastMessage(`買い控え成功: [${title}] ¥${Number(amount).toLocaleString()} を浮かせました`);
  };

  // カスタム我慢の保存
  const handleSaveCustomTsumori = (e) => {
    e.preventDefault();
    const num = Number(customAmount);
    if (!num || num <= 0) return;
    const t = customTitle.trim() || '買い控え';
    handleAddTsumori(t, num);
    setCustomTitle('');
    setCustomAmount('');
    setIsCustomModalOpen(false);
  };

  // 我慢ログの削除（取り消し）
  const handleDeleteTsumori = (id) => {
    const updated = tsumoriLogs.filter(log => log.id !== id);
    setTsumoriLogs(updated);
    saveSettingBoth(user?.uid, 'savingsTsumoriLogs', 'm402_tsumori_logs', updated);
  };

  // 🌟 今月の我慢集計
  const tsumoriStats = useMemo(() => {
    const now = new Date();
    const start = cyclePeriod?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const end = cyclePeriod?.endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let monthTotal = 0;
    let monthCount = 0;
    let allTotal = 0;

    tsumoriLogs.forEach(log => {
      const d = new Date(log.timestamp);
      allTotal += log.amount;
      if (d >= start && d <= end) {
        monthTotal += log.amount;
        monthCount += 1;
      }
    });

    return { monthTotal, monthCount, allTotal };
  }, [tsumoriLogs, cyclePeriod]);

  // 🌟 【デイリー・セーフ・スペンド】動的日割り計算ロジック
  const dailyMetrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const cycleStart = cyclePeriod?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const cycleEnd = cyclePeriod?.endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 今日を含む残り日数を算出
    const msPerDay = 1000 * 60 * 60 * 24;
    const remainingDays = Math.max(1, Math.ceil((cycleEnd.getTime() - startOfToday.getTime()) / msPerDay));
    const totalCycleDays = Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / msPerDay));

    let priorExpense = 0; // 昨日までの支出合計
    let todayExpense = 0; // 本日の支出合計

    transactions.forEach(tx => {
      if (tx.type !== 'expense') return;
      const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
      if (isNaN(txDate.getTime())) return;

      if (txDate >= cycleStart && txDate <= cycleEnd) {
        if (txDate >= startOfToday && txDate <= endOfToday) {
          todayExpense += Number(tx.amount) || 0;
        } else if (txDate < startOfToday) {
          priorExpense += Number(tx.amount) || 0;
        }
      }
    });

    const totalExpense = priorExpense + todayExpense;

    // 昨日までの実績を引いた「今日以降の残り枠」
    const remainingBudgetForFuture = Math.max(0, monthlyBudget - priorExpense);

    // 今日の基本割当枠（残り枠 ÷ 残り日数）
    const dailyQuota = Math.floor(remainingBudgetForFuture / remainingDays);

    // 「今日あといくら使えるか（Safe-to-Spend）」
    const safeToSpend = dailyQuota - todayExpense;

    // 進捗率
    const dailyUsagePercent = dailyQuota > 0 ? Math.min(100, Math.round((todayExpense / dailyQuota) * 100)) : 100;
    const monthlyUsagePercent = monthlyBudget > 0 ? Math.min(100, Math.round((totalExpense / monthlyBudget) * 100)) : 100;

    return {
      dailyQuota,
      todayExpense,
      safeToSpend,
      remainingDays,
      totalCycleDays,
      priorExpense,
      totalExpense,
      dailyUsagePercent,
      monthlyUsagePercent
    };
  }, [transactions, cyclePeriod, monthlyBudget]);

  if (isStealthMode) {
    return null;
  }

  const isSafePositive = dailyMetrics.safeToSpend >= 0;
  const animatedSafeToSpend = useCountUp(dailyMetrics.safeToSpend);
  const animatedTsumoriMonth = useCountUp(tsumoriStats.monthTotal);
  const animatedTsumoriAll = useCountUp(tsumoriStats.allTotal);

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px', marginBottom: '20px' }}>
      
      {/* 🌟 左カード：【デイリー・セーフ・スペンド】今日あといくら使えるかメーター */}
      <div className="glass-panel" style={{ flex: 1.2, borderRadius: '14px', padding: '18px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        <div>
          {/* ヘッダー */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.5px' }}>
                デイリー・セーフ・スペンド
              </span>
              <span style={{ fontSize: '11px', color: '#888', background: 'rgba(5, 6, 8, 0.6)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                日割り予算
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setTempBudgetInput(String(monthlyBudget));
                setIsEditingBudget(true);
              }}
              style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#aaa', borderRadius: '6px', padding: '3px 10px', fontSize: '11px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = themeColor; e.currentTarget.style.borderColor = themeColor; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }}
            >
              目標: ¥{monthlyBudget.toLocaleString()} ⚙
            </button>
          </div>

          {/* メイン数値表示：今日あと使える金額 */}
          <div style={{ background: 'rgba(5, 6, 8, 0.75)', border: `1px solid ${isSafePositive ? themeColor + '55' : '#ff336655'}`, borderRadius: '10px', padding: '14px', marginBottom: '12px', boxShadow: `inset 0 0 20px ${isSafePositive ? themeColor + '11' : 'rgba(255,51,102,0.1)'}` }}>
            <div style={{ fontSize: '11px', color: isSafePositive ? themeColor : '#ff3366', fontWeight: 'bold', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span>{isSafePositive ? '今日あと使える金額' : '本日の予算枠を超過中'}</span>
              <span>残り {dailyMetrics.remainingDays} 日</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '18px', color: isSafePositive ? '#888' : '#ff3366', fontWeight: 'bold' }}>¥</span>
              <span className="tabular-nums" style={{ fontSize: isMobile ? '32px' : '38px', fontWeight: 'bold', fontFamily: 'monospace', color: isSafePositive ? '#fff' : '#ff3366', letterSpacing: '1px' }}>
                {Math.abs(animatedSafeToSpend).toLocaleString()}
              </span>
              {!isSafePositive && (
                <span style={{ fontSize: '12px', color: '#ff3366', fontWeight: 'bold' }}>OVER</span>
              )}
            </div>

            {/* 本日の支出と割当枠の内訳 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(255, 255, 255, 0.08)', fontSize: '11px', color: '#aaa' }}>
              <div>
                本日の割当枠: <span className="tabular-nums" style={{ color: '#fff', fontWeight: 'bold' }}>¥{dailyMetrics.dailyQuota.toLocaleString()}</span>
              </div>
              <div>
                本日の出費: <span className="tabular-nums" style={{ color: dailyMetrics.todayExpense > dailyMetrics.dailyQuota ? '#ff3366' : '#fff', fontWeight: 'bold' }}>¥{dailyMetrics.todayExpense.toLocaleString()}</span>
              </div>
            </div>

            {/* 本日の枠消費ゲージ */}
            <div style={{ width: '100%', height: '6px', background: '#1a1d24', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, (dailyMetrics.todayExpense / (dailyMetrics.dailyQuota || 1)) * 100)}%`,
                  height: '100%',
                  background: dailyMetrics.todayExpense > dailyMetrics.dailyQuota ? '#ff3366' : themeColor,
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        </div>

        {/* 下部：動的更新の説明 */}
        <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
          * 本日使わなかった分は翌日以降の日割り枠に均等繰り越しされ、使いすぎた日は翌日以降が自動で引き締まります。
        </div>
      </div>

      {/* 🌟 右カード：【つもり貯金・我慢カウンター】買い控えを成果に変える */}
      <div className="glass-panel" style={{ flex: 1, borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        <div>
          {/* ヘッダー */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.5px' }}>
                つもり貯金 / 我慢カウンター
              </span>
              <span style={{ fontSize: '11px', color: '#ffb700', background: 'rgba(255, 183, 0, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255, 183, 0, 0.3)' }}>
                {tsumoriStats.monthCount}回達成
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {showHistory ? '閉じる' : '履歴'}
            </button>
          </div>

          {/* 成果サマリー表示 */}
          <div style={{ background: 'rgba(5, 6, 8, 0.75)', border: '1px solid rgba(255, 183, 0, 0.25)', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#ffb700', fontWeight: 'bold', marginBottom: '2px' }}>
              今月の買い控え節約成果
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '16px', color: '#ffb700', fontWeight: 'bold' }}>+¥</span>
              <span className="tabular-nums" style={{ fontSize: isMobile ? '26px' : '30px', fontWeight: 'bold', fontFamily: 'monospace', color: '#ffb700' }}>
                {animatedTsumoriMonth.toLocaleString()}
              </span>
              <span className="tabular-nums" style={{ fontSize: '11px', color: '#888', marginLeft: 'auto' }}>
                累計: ¥{animatedTsumoriAll.toLocaleString()}
              </span>
            </div>
          </div>

          {/* クイック我慢チップ群 */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#aaa', fontWeight: 'bold', marginBottom: '6px' }}>
              ワンタップ我慢記録:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              {[
                { title: 'コンビニ/間食', amount: 350 },
                { title: 'カフェ/ドリンク', amount: 500 },
                { title: '外食/飲み会', amount: 3000 },
                { title: 'タクシー/移動', amount: 1500 }
              ].map(item => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleAddTsumori(item.title, item.amount)}
                  style={{
                    background: '#1a1d24',
                    border: '1px solid #252838',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 10px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ffb700'; e.currentTarget.style.background = 'rgba(255, 183, 0, 0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#252838'; e.currentTarget.style.background = '#1a1d24'; }}
                >
                  <span style={{ color: '#ccc' }}>{item.title}</span>
                  <span style={{ color: '#ffb700', fontWeight: 'bold' }}>¥{item.amount.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 自由入力ボタン */}
        <button
          type="button"
          onClick={() => setIsCustomModalOpen(true)}
          style={{
            background: 'transparent',
            border: '1px dashed #333',
            color: '#888',
            borderRadius: '6px',
            padding: '7px',
            fontSize: '11px',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'center',
            marginTop: '4px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ffb700'; e.currentTarget.style.color = '#ffb700'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#888'; }}
        >
          + 金額を指定して我慢を記録
        </button>
      </div>

      {/* 🌟 トースト通知 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '25px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#0a0c10',
          border: '1px solid #ffb700',
          color: '#ffb700',
          padding: '10px 18px',
          borderRadius: '25px',
          fontSize: '12px',
          fontWeight: 'bold',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          zIndex: 11000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toastMessage}
        </div>
      )}

      {/* 🌟 目標予算編集モーダル */}
      {isEditingBudget && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 10500, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#11141a', border: `1px solid ${themeColor}`, borderRadius: '10px', padding: '22px', width: '100%', maxWidth: '340px', boxShadow: `0 0 30px ${themeColor}33` }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
              月間目標支出枠の変更
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
              今月この金額以内に抑えたい目標値を設定します。設定値から日割り枠が自動計算されます。
            </div>
            <div style={{ display: 'flex', alignItems: 'center', background: '#050608', border: '1px solid #333', borderRadius: '6px', padding: '0 12px', marginBottom: '16px' }}>
              <span style={{ color: themeColor, fontSize: '18px', fontWeight: 'bold' }}>¥</span>
              <input
                type="number"
                value={tempBudgetInput}
                onChange={(e) => setTempBudgetInput(e.target.value)}
                placeholder="120000"
                style={{ width: '100%', padding: '12px 8px', background: 'transparent', border: 'none', color: '#fff', fontSize: '18px', outline: 'none', fontFamily: 'monospace', fontWeight: 'bold' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsEditingBudget(false)}
                style={{ background: 'transparent', border: '1px solid #333', color: '#aaa', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveBudget}
                style={{ background: themeColor, border: 'none', color: '#000', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 自由我慢入力モーダル */}
      {isCustomModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 10500, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <form onSubmit={handleSaveCustomTsumori} style={{ background: '#11141a', border: '1px solid #ffb700', borderRadius: '10px', padding: '22px', width: '100%', maxWidth: '340px', boxShadow: '0 0 30px rgba(255, 183, 0, 0.2)' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#ffb700', marginBottom: '8px' }}>
              買い控え（つもり貯金）の記録
            </div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '14px' }}>
              購入を見送って節約できた品目と金額を入力してください。
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>品目・名目</div>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="例: ゲーム課金見送り / 衝動買い我慢"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px', background: '#050608', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>浮いた金額</div>
              <div style={{ display: 'flex', alignItems: 'center', background: '#050608', border: '1px solid #333', borderRadius: '6px', padding: '0 10px' }}>
                <span style={{ color: '#ffb700', fontSize: '16px', fontWeight: 'bold' }}>¥</span>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="3000"
                  style={{ width: '100%', padding: '10px 6px', background: 'transparent', border: 'none', color: '#fff', fontSize: '16px', outline: 'none', fontFamily: 'monospace', fontWeight: 'bold' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                style={{ background: 'transparent', border: '1px solid #333', color: '#aaa', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
              >
                キャンセル
              </button>
              <button
                type="submit"
                style={{ background: '#ffb700', border: 'none', color: '#000', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                成果を記録
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 🌟 我慢履歴モーダル */}
      {showHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 10500, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#11141a', border: '1px solid #252838', borderRadius: '10px', padding: '20px', width: '100%', maxWidth: '380px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #252838', paddingBottom: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>買い控え履歴</span>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '16px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tsumoriLogs.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#666', fontSize: '12px', padding: '20px' }}>
                  まだ我慢ログがありません
                </div>
              ) : (
                tsumoriLogs.map(log => {
                  const d = new Date(log.timestamp);
                  const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                  return (
                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#050608', padding: '8px 12px', borderRadius: '6px', border: '1px solid #252838' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>{log.title}</div>
                        <div style={{ fontSize: '10px', color: '#666' }}>{dateStr}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#ffb700', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '13px' }}>
                          +¥{log.amount.toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTsumori(log.id)}
                          style={{ background: 'transparent', border: 'none', color: '#ff3366', fontSize: '13px', cursor: 'pointer', padding: '0 4px' }}
                          title="削除"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
