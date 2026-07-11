import { useState } from 'react';

export default function CalendarView({ transactions }) {
  // 🌟 カレンダーの「今見ている年月」を記憶するState
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 月を切り替える関数（PREV, NEXTボタン用）
  const changeMonth = (offset) => {
    setCurrentDate(new Date(year, month + offset, 1));
  };

  // 📅 カレンダーの計算
  const firstDay = new Date(year, month, 1).getDay(); // 月の初日の曜日 (0:日 〜 6:土)
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // その月が何日まであるか

  const days = [];

  // 1️⃣ 1日の前の「空白のセル」を埋める
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} style={cellStyle}></div>);
  }

  // 2️⃣ 1日〜月末までのセルを作る
  for (let d = 1; d <= daysInMonth; d++) {
    let dayIncome = 0;
    let dayExpense = 0;

    // その日の取引データだけを抽出して足し算
    transactions.forEach(tx => {
      if (!tx.date) return;
      const txDate = tx.date.toDate();
      if (txDate.getFullYear() === year && txDate.getMonth() === month && txDate.getDate() === d) {
        if (tx.type === 'income') dayIncome += (tx.amount || 0);
        if (tx.type === 'expense') dayExpense += (tx.amount || 0);
      }
    });

    // 今日かどうか判定して、今日ならネオングリーンに光らせる！
    const isToday = new Date().getFullYear() === year && new Date().getMonth() === month && new Date().getDate() === d;

    days.push(
      <div key={`day-${d}`} style={{
        ...cellStyle, 
        borderColor: isToday ? '#00ff66' : '#252838', 
        boxShadow: isToday ? '0 0 15px rgba(0,255,102,0.3)' : 'none'
      }}>
        <div style={{ color: isToday ? '#00ff66' : '#fff', fontWeight: 'bold', marginBottom: '5px' }}>
          {d}
        </div>
        <div style={{ fontSize: '13px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
          {dayIncome > 0 && <div style={{ color: '#00bfff' }}>+{dayIncome.toLocaleString()}</div>}
          {dayExpense > 0 && <div style={{ color: '#ff3366' }}>-{dayExpense.toLocaleString()}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#11141a', padding: '30px', borderRadius: '8px', border: '1px solid #252838' }}>
      
      {/* 🎮 ヘッダー（月切り替えサイバーボタン） */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => changeMonth(-1)} style={btnStyle}>◀ PREV</button>
        <h2 style={{ color: '#00ff66', margin: 0, textShadow: '0 0 10px rgba(0,255,102,0.5)', fontSize: '24px' }}>
          {year}年 {month + 1}月
        </h2>
        <button onClick={() => changeMonth(1)} style={btnStyle}>NEXT ▶</button>
      </div>

      {/* 🗓️ 曜日ヘッダー */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginBottom: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
        <div style={{ color: '#ff3366' }}>SUN</div>
        <div style={{ color: '#aaa' }}>MON</div>
        <div style={{ color: '#aaa' }}>TUE</div>
        <div style={{ color: '#aaa' }}>WED</div>
        <div style={{ color: '#aaa' }}>THU</div>
        <div style={{ color: '#aaa' }}>FRI</div>
        <div style={{ color: '#00bfff' }}>SAT</div>
      </div>

      {/* 🟩 カレンダーグリッド本体（CSS Gridで自動整列！） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
        {days}
      </div>
    </div>
  );
}

// 🎨 パーツのスタイル設定
const cellStyle = {
  background: '#0a0c10',
  border: '1px solid #252838',
  borderRadius: '6px',
  minHeight: '100px',
  padding: '10px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  transition: 'all 0.3s ease'
};

const btnStyle = {
  background: 'transparent',
  color: '#00ff66',
  border: '1px solid #00ff66',
  padding: '8px 20px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontFamily: 'monospace',
  transition: 'all 0.2s',
};