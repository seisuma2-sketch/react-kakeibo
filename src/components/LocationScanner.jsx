import React, { useState, useEffect } from 'react';

export default function LocationScanner({ onLocationFixed }) {
  // 状態管理: idle(待機) -> warning(警告) -> manual(手動入力) -> scanning(自動スキャン中) -> done(完了)
  const [step, setStep] = useState('idle');
  
  const [manualInput, setManualInput] = useState('');
  const [locationName, setLocationName] = useState('');
  
  // 履歴の読み込み（ローカルストレージから最大10件）
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('m402_location_history');
    return saved ? JSON.parse(saved) : [];
  });

  // 履歴が更新されたら保存する
  useEffect(() => {
    localStorage.setItem('m402_location_history', JSON.stringify(history));
  }, [history]);

  // 🌟 自動スキャン（GPS取得）の実行
  const executeAutoScan = () => {
    setStep('scanning');
    if (navigator.vibrate) navigator.vibrate([50, 100, 50]);

    if (!navigator.geolocation) {
      alert("❌ 端末のGPSモジュールが応答しません");
      setStep('warning');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // 成功時: 本来はここでGoogle Maps API等で逆ジオコーディングしますが、今回は座標をそれっぽく表示
        const lat = position.coords.latitude.toFixed(4);
        const lng = position.coords.longitude.toFixed(4);
        const autoLocName = `GEO-NODE [${lat}, ${lng}]`;
        
        setLocationName(autoLocName);
        setStep('done');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        if (onLocationFixed) onLocationFixed(autoLocName);
      },
      (error) => {
        // 拒否された場合やエラー
        alert("❌ アクセス拒否、または信号ロスト (ERROR_CODE: " + error.code + ")");
        setStep('warning');
      },
      { timeout: 10000 }
    );
  };

  // 🌟 手動入力の確定処理
  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;

    // 履歴の更新（最新のものを先頭に、重複は消す、最大10件）
    const newHistory = [manualInput, ...history.filter(h => h !== manualInput)].slice(0, 10);
    setHistory(newHistory);
    
    setLocationName(manualInput);
    setStep('done');
    if (navigator.vibrate) navigator.vibrate([50]);
    if (onLocationFixed) onLocationFixed(manualInput);
  };

  // UI描画
  return (
    <div style={{ background: '#0a0c10', border: '1px solid #252838', borderRadius: '8px', padding: '15px', fontFamily: 'monospace', color: '#fff' }}>
      
      {/* --- STEP 1: 初期待機状態 --- */}
      {step === 'idle' && (
        <button 
          onClick={() => setStep('warning')} 
          style={{ width: '100%', background: 'rgba(0, 191, 255, 0.1)', color: '#00bfff', border: '1px solid #00bfff', padding: '12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
        >
          <span>📍</span> ターゲット位置情報を取得
        </button>
      )}

      {/* --- STEP 2: 課金（コスト）警告アラート --- */}
      {step === 'warning' && (
        <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#ff336622', border: '1px dashed #ff3366', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
            <div style={{ color: '#ff3366', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="blink">⚠️</span> [SYSTEM WARNING]
            </div>
            <div style={{ color: '#ffaaaa', fontSize: '11px', lineHeight: '1.5' }}>
              自動トラッキング（GPSスキャン）はシステムクレジット（通信コスト）を消費します。実行しますか？
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep('manual')} style={{ flex: 1, padding: '10px', background: 'transparent', color: '#00ff66', border: '1px solid #00ff66', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              ⌨️ 手動オーバーライド
            </button>
            <button onClick={executeAutoScan} style={{ flex: 1, padding: '10px', background: '#ff3366', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 0 15px rgba(255,51,102,0.4)' }}>
              📡 AUTO SCAN (1 CR消費)
            </button>
          </div>
        </div>
      )}

      {/* --- STEP 3: 自動スキャン中アニメーション --- */}
      {step === 'scanning' && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#00bfff' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px', animation: 'spin 2s linear infinite' }}>📡</div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', animation: 'pulse 1s infinite' }}>SATELLITE UPLINK IN PROGRESS...</div>
        </div>
      )}

      {/* --- STEP 4: 手動入力 ＆ 履歴 --- */}
      {step === 'manual' && (
        <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ color: '#00ff66', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>⌨️ MANUAL INPUT // 指定座標の入力</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            <input 
              type="text" 
              placeholder="例: セブンイレブン 新宿店" 
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              style={{ flex: 1, background: '#11141a', border: '1px solid #00ff66', color: '#fff', padding: '10px', borderRadius: '4px', outline: 'none', fontFamily: 'monospace' }}
            />
            <button onClick={handleManualSubmit} style={{ background: '#00ff66', color: '#000', border: 'none', padding: '0 15px', borderRadius: '4px', fontWeight: 'bold' }}>DETERMINE</button>
          </div>

          <div style={{ borderTop: '1px dashed #333', paddingTop: '10px' }}>
            <div style={{ color: '#888', fontSize: '10px', marginBottom: '8px', letterSpacing: '1px' }}>[ LOCAL CACHE // 過去の取得履歴 ]</div>
            {history.length === 0 ? (
              <div style={{ color: '#555', fontSize: '11px', textAlign: 'center', padding: '10px 0' }}>NO DATA</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {history.map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => { setManualInput(item); }}
                    style={{ background: '#11141a', border: '1px solid #252838', padding: '8px 10px', borderRadius: '4px', fontSize: '11px', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    className="history-item"
                  >
                    <span style={{ color: '#00bfff' }}>▶</span> {item}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setStep('warning')} style={{ marginTop: '15px', width: '100%', padding: '8px', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: '4px', fontSize: '10px' }}>◀ 戻る</button>
        </div>
      )}

      {/* --- STEP 5: 完了（座標確定） --- */}
      {step === 'done' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 255, 102, 0.1)', border: '1px solid #00ff66', padding: '12px', borderRadius: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ color: '#00ff66', fontSize: '10px', fontWeight: 'bold' }}>LOCATION LOCKED 🔒</span>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{locationName}</span>
          </div>
          <button onClick={() => setStep('warning')} style={{ background: 'transparent', border: '1px solid #00ff66', color: '#00ff66', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>再取得</button>
        </div>
      )}

      <style>{`
        .blink { animation: blink 1s step-start infinite; }
        .history-item:hover { border-color: #00bfff !important; color: #00bfff !important; }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}