import { useState, useEffect, useMemo } from 'react';

export default function MobileCalendar({ transactions, themeColor }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  
  const [timeTreeEvents, setTimeTreeEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  const token = localStorage.getItem('timeTreeToken') || '';

  // 🌟 Firebaseのデータから日付ごとの「合計支出・収入」をリアルタイム集計
  const dailyTotals = useMemo(() => {
    const totals = {};
    transactions.forEach(tx => {
      if (!tx.date) return;
      const d = tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      if (!totals[dateStr]) totals[dateStr] = { expense: 0, income: 0 };
      
      if (tx.type === 'expense') {
        totals[dateStr].expense += tx.amount;
      } else if (tx.type === 'income') {
        totals[dateStr].income += tx.amount;
      }
    });
    return totals;
  }, [transactions]);

  // デモ用の相対日付ジェネレータ
  function getRelativeDateStr(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // カレンダー構築用ヘルパー
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayIndex }, (_, i) => null);
  const calendarCells = [...blanks, ...daysArray];

  // 選択された日のデータ抽出
  const selectedDayTxs = transactions.filter(tx => {
    if (!tx.date) return false;
    const d = tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return dateStr === selectedDateStr;
  });

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', background: '#0a0c10', height: '100%', boxSizing: 'border-box' }}>
      
      {/* 月移動ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${themeColor}33`, paddingBottom: '10px' }}>
        <button onClick={() => setCurrentDate(new Date(year, month - 1))} style={navBtnStyle(themeColor)}>◀</button>
        <h2 style={{ margin: 0, fontSize: '18px', fontFamily: 'monospace', color: '#fff', textShadow: `0 0 10px ${themeColor}` }}>
          {year} / {String(month + 1).padStart(2, '0')}
        </h2>
        <button onClick={() => setCurrentDate(new Date(year, month + 1))} style={navBtnStyle(themeColor)}>▶</button>
      </div>

      {/* 曜日インジケーター */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '11px', color: '#666', fontWeight: 'bold', fontFamily: 'monospace' }}>
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, i) => (
          <div key={day} style={{ color: i === 0 ? '#ff3366' : i === 6 ? '#00bfff' : '#666' }}>{day}</div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
        {calendarCells.map((day, idx) => {
          if (day === null) return <div key={`blank-${idx}`} />;
          
          const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = cellDateStr === selectedDateStr;
          const totals = dailyTotals[cellDateStr];
          const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

          return (
            <div 
              key={`day-${day}`}
              onClick={() => setSelectedDateStr(cellDateStr)}
              style={{
                position: 'relative', height: '52px', background: isSelected ? `${themeColor}15` : '#11141a',
                border: `1px solid ${isSelected ? themeColor : isToday ? `${themeColor}55` : '#222'}`,
                borderRadius: '6px', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                justifyContent: 'space-between', padding: '4px', boxSizing: 'border-box',
                transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', color: isToday ? themeColor : '#aaa' }}>{day}</span>
              {totals && (
                <div style={{ fontSize: '8px', fontFamily: 'monospace', fontWeight: 'bold', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {totals.expense > 0 && <span style={{ color: '#ff3366' }}>-{totals.expense >= 1000 ? `${Math.round(totals.expense / 1000)}k` : totals.expense}</span>}
                  {totals.income > 0 && <span style={{ color: '#00bfff' }}>+{totals.income >= 1000 ? `${Math.round(totals.income / 1000)}k` : totals.income}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 下部詳細パネル */}
      <div style={{ flex: 1, background: '#11141a', border: `1px solid ${themeColor}33`, borderRadius: '10px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' }}>
        <div style={{ fontSize: '11px', color: '#888', fontWeight: 'bold', fontFamily: 'monospace', borderBottom: '1px solid #222', paddingBottom: '5px' }}>
          📅 DETAILS // {selectedDateStr}
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#ff3366', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' }}>[DATABASE TRANSACTIONS]</div>
          {selectedDayTxs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedDayTxs.map(tx => (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', background: '#11141a', padding: '8px 12px', borderRadius: '6px', borderLeft: `3px solid ${tx.type === 'expense' ? '#ff3366' : '#00bfff'}`, fontFamily: 'monospace' }}>
                  <span>{tx.category} <span style={{ color: '#555', fontSize: '10px' }}>({tx.paymentMethod})</span></span>
                  <span style={{ fontWeight: 'bold', color: tx.type === 'expense' ? '#ff3366' : '#00bfff' }}>
                    {tx.type === 'expense' ? '-' : '+'}¥{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#555', fontFamily: 'monospace' }}>記録なし</div>
          )}
        </div>
      </div>
    </div>
  );
}

const navBtnStyle = (themeColor) => ({
  background: 'transparent', color: themeColor, border: `1px solid ${themeColor}33`,
  borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', transition: 'all 0.2s', textShadow: `0 0 5px ${themeColor}`
});