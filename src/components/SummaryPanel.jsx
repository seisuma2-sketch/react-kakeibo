export default function SummaryPanel({ currentMonth, monthlyIncome, monthlyExpense, netIncome, isSurplus, isStealthMode, isMobile }) {
  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px' }}>
      
      {/* 📱 スマホなら収入と支出をギュッと横並びに、PCなら等間隔に配置 */}
      <div style={{ display: 'flex', gap: '15px', flexDirection: 'row', flex: 2 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>{currentMonth}月の総収入</div>
          <div style={{ color: '#00ff66', fontSize: isMobile ? '18px' : '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {isStealthMode ? '¥***' : `¥${monthlyIncome.toLocaleString()}`}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>{currentMonth}月の総支出</div>
          <div style={{ color: '#ff3366', fontSize: isMobile ? '18px' : '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {isStealthMode ? '¥***' : `¥${monthlyExpense.toLocaleString()}`}
          </div>
        </div>
      </div>

      {/* 収支バランスは常にデカく！ */}
      <div style={{ ...cardStyle, flex: 1, border: `1px solid ${isSurplus ? '#00ff66' : '#ff3366'}`, boxShadow: isSurplus ? '0 0 15px rgba(0,255,102,0.1)' : '0 0 15px rgba(255,51,102,0.1)' }}>
        <div style={labelStyle}>今月の収支バランス</div>
        <div style={{ color: isSurplus ? '#00ff66' : '#ff3366', fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', fontFamily: 'monospace' }}>
          {isStealthMode ? '¥***' : `${isSurplus ? '+' : ''}¥${netIncome.toLocaleString()}`}
        </div>
        <div style={{ fontSize: '11px', marginTop: '8px', color: isSurplus ? '#00ff66' : '#ff3366' }}>
          {isSurplus ? '🔥 黒字安全圏をキープ中！' : '🚨 警告：赤字転落！'}
        </div>
      </div>
      
    </div>
  );
}

const cardStyle = { flex: 1, background: '#11141a', padding: '15px', borderRadius: '8px', border: '1px solid #252838' };
const labelStyle = { color: '#aaa', fontSize: '12px', marginBottom: '5px' };