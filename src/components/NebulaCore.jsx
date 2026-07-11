import { useState, useEffect } from 'react';

export default function NebulaCore({ netIncome, isStealthMode }) {
  // 収支がプラスなら「星雲（緑）」、マイナスなら「ブラックホール（赤）」
  const isSurplus = netIncome >= 0;
  
  return (
    <div style={{ background: '#11141a', padding: '30px', borderRadius: '8px', border: '1px solid #252838', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', height: '100%' }}>
      
      <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', zIndex: 10 }}>
        {isSurplus ? '✨ 資産星雲 (安定)' : '🌀 重力崩壊 (警告)'}
      </h3>

      {/* 🌌 天体アニメーションの本体 */}
      <div style={{ position: 'relative', width: '150px', height: '150px', marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* 回転するオーラ（外側） */}
        <div className="aura" style={{
          position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
          background: isSurplus 
            ? 'conic-gradient(from 0deg, transparent 0%, rgba(0, 255, 102, 0.1) 40%, rgba(0, 255, 102, 0.8) 50%, transparent 60%)'
            : 'conic-gradient(from 0deg, transparent 0%, rgba(255, 51, 102, 0.1) 40%, rgba(255, 51, 102, 0.8) 50%, transparent 60%)',
          animation: `spin ${isSurplus ? '4s' : '1.5s'} linear infinite`
        }}></div>

        {/* コア（中心） */}
        <div className="core" style={{
          position: 'absolute', width: '60%', height: '60%', borderRadius: '50%',
          background: '#0a0c10',
          boxShadow: isSurplus 
            ? '0 0 20px #00ff66, inset 0 0 20px #00ff66' 
            : '0 0 30px #ff3366, inset 0 0 30px #ff3366',
          animation: 'pulse 2s infinite alternate'
        }}></div>

        {/* 中心に表示する金額 */}
        <div style={{ position: 'relative', zIndex: 10, color: isSurplus ? '#00ff66' : '#ff3366', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '18px', textShadow: '0 0 10px #000' }}>
          {isStealthMode ? '¥***' : `${isSurplus ? '+' : '-'}¥${Math.abs(netIncome).toLocaleString()}`}
        </div>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(0.9); opacity: 0.8; } 100% { transform: scale(1.1); opacity: 1; } }
      `}</style>
    </div>
  );
}