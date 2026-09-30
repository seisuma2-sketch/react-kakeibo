import { useState } from 'react';
import { useCountUp } from '../utils/animationUtils';

export default function SummaryPanel({ currentMonth, monthlyIncome, monthlyExpense, netIncome, isSurplus, isStealthMode, isMobile }) {
  const animatedIncome = useCountUp(monthlyIncome);
  const animatedExpense = useCountUp(monthlyExpense);
  const animatedNet = useCountUp(netIncome);

  // ユーザー自身が手動でマスク切り替えできるState（isStealthMode時は強制マスク）
  const [manualMask, setManualMask] = useState(false);
  const effectiveMask = isStealthMode || manualMask;

  const displayIncome = effectiveMask ? '¥ • • • • • •' : `¥${animatedIncome.toLocaleString()}`;
  const displayExpense = effectiveMask ? '¥ • • • • • •' : `¥${animatedExpense.toLocaleString()}`;
  const displayNet = effectiveMask ? '¥ • • • • • •' : `${isSurplus ? '+' : ''}¥${animatedNet.toLocaleString()}`;

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px' }}>
      
      {/* 📱 収入と支出 */}
      <div style={{ display: 'flex', gap: '15px', flexDirection: 'row', flex: 2 }}>
        <div 
          className="glass-panel" 
          style={{ ...cardStyle, cursor: 'pointer' }}
          onClick={() => setManualMask(prev => !prev)}
          title="クリックで金額の表示/非表示を切り替え"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={labelStyle}>{currentMonth}月の総収入</div>
            {effectiveMask && <span style={{ fontSize: '10px', color: '#888' }}>🔒 秘匿中</span>}
          </div>
          <div className="tabular-nums" style={{ color: '#00ff66', fontSize: isMobile ? '18px' : '28px', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: effectiveMask ? '3px' : 'normal' }}>
            {displayIncome}
          </div>
        </div>
        <div 
          className="glass-panel" 
          style={{ ...cardStyle, cursor: 'pointer' }}
          onClick={() => setManualMask(prev => !prev)}
          title="クリックで金額の表示/非表示を切り替え"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={labelStyle}>{currentMonth}月の総支出</div>
            {effectiveMask && <span style={{ fontSize: '10px', color: '#888' }}>🔒 秘匿中</span>}
          </div>
          <div className="tabular-nums" style={{ color: '#ff3366', fontSize: isMobile ? '18px' : '28px', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: effectiveMask ? '3px' : 'normal' }}>
            {displayExpense}
          </div>
        </div>
      </div>

      {/* 収支バランス */}
      <div 
        className="glass-panel" 
        style={{ ...cardStyle, flex: 1, border: `1px solid ${isSurplus ? '#00ff66' : '#ff3366'}`, boxShadow: isSurplus ? '0 0 20px rgba(0,255,102,0.15)' : '0 0 20px rgba(255,51,102,0.15)', cursor: 'pointer' }}
        onClick={() => setManualMask(prev => !prev)}
        title="クリックで金額の表示/非表示を切り替え"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={labelStyle}>今月の収支バランス</div>
          {effectiveMask && <span style={{ fontSize: '10px', color: '#888' }}>🔒 秘匿中</span>}
        </div>
        <div className="tabular-nums" style={{ color: isSurplus ? '#00ff66' : '#ff3366', fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: effectiveMask ? '3px' : 'normal' }}>
          {displayNet}
        </div>
        <div style={{ fontSize: '11px', marginTop: '8px', color: isSurplus ? '#00ff66' : '#ff3366', fontWeight: 'bold' }}>
          {effectiveMask ? 'プライベート保護中' : (isSurplus ? '黒字安全圏をキープ中' : '警告：赤字転落')}
        </div>
      </div>
      
    </div>
  );
}

const cardStyle = { flex: 1, padding: '16px', borderRadius: '12px' };
const labelStyle = { color: '#888', fontSize: '12px', marginBottom: 0, fontWeight: 'bold' };