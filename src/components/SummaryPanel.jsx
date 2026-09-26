import { useCountUp } from '../utils/animationUtils';

export default function SummaryPanel({ currentMonth, monthlyIncome, monthlyExpense, netIncome, isSurplus, isStealthMode, isMobile }) {
  const animatedIncome = useCountUp(monthlyIncome);
  const animatedExpense = useCountUp(monthlyExpense);
  const animatedNet = useCountUp(netIncome);

  const displayIncome = isStealthMode ? '¥***,***' : `¥${animatedIncome.toLocaleString()}`;
  const displayExpense = isStealthMode ? '¥***,***' : `¥${animatedExpense.toLocaleString()}`;
  const displayNet = isStealthMode ? '¥***,***' : `${isSurplus ? '+' : ''}¥${animatedNet.toLocaleString()}`;

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px' }}>
      
      {/* 📱 スマホなら収入と支出をギュッと横並びに、PCなら等間隔に配置 */}
      <div style={{ display: 'flex', gap: '15px', flexDirection: 'row', flex: 2 }}>
        <div className="glass-panel" style={cardStyle}>
          <div style={labelStyle}>{currentMonth}月の総収入</div>
          <div className="tabular-nums" style={{ color: '#00ff66', fontSize: isMobile ? '18px' : '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {displayIncome}
          </div>
        </div>
        <div className="glass-panel" style={cardStyle}>
          <div style={labelStyle}>{currentMonth}月の総支出</div>
          <div className="tabular-nums" style={{ color: '#ff3366', fontSize: isMobile ? '18px' : '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>
            {displayExpense}
          </div>
        </div>
      </div>

      {/* 収支バランスは常にデカく！ */}
      <div className="glass-panel" style={{ ...cardStyle, flex: 1, border: `1px solid ${isSurplus ? '#00ff66' : '#ff3366'}`, boxShadow: isSurplus ? '0 0 20px rgba(0,255,102,0.15)' : '0 0 20px rgba(255,51,102,0.15)' }}>
        <div style={labelStyle}>今月の収支バランス</div>
        <div className="tabular-nums" style={{ color: isSurplus ? '#00ff66' : '#ff3366', fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', fontFamily: 'monospace' }}>
          {displayNet}
        </div>
        <div style={{ fontSize: '11px', marginTop: '8px', color: isSurplus ? '#00ff66' : '#ff3366', fontWeight: 'bold' }}>
          {isSurplus ? '黒字安全圏をキープ中' : '警告：赤字転落'}
        </div>
      </div>
      
    </div>
  );
}

const cardStyle = { flex: 1, padding: '16px', borderRadius: '12px' };
const labelStyle = { color: '#888', fontSize: '12px', marginBottom: '6px', fontWeight: 'bold' };