import React, { useState } from 'react';

/**
 * NFC設定モーダル（iOSショートカット / 物理カード / スマートリング連携用）
 * 絵文字は使わずテキストで統一、Chrome標準ダイアログは不使用
 * 「Appを開く方式（推奨・誤爆ゼロ）」と「URLを開く方式（ブラウザ）」の両方に対応
 */
export default function NfcSettingsModal({ isOpen, onClose, onToast, themeColor = '#00ff66' }) {
  const [selectedCard, setSelectedCard] = useState('リクルートカード');
  const [customCard, setCustomCard] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('EVERING');
  const [customAccount, setCustomAccount] = useState('');
  
  // モード: 'app' (Appを開く・推奨方式), 'browser' (ブラウザURL方式)
  const [launchMode, setLaunchMode] = useState('app');

  if (!isOpen) return null;

  const origin = window.location.origin;
  const targetCard = customCard.trim() || selectedCard;
  const targetAccount = customAccount.trim() || selectedAccount;

  // ① Appを開く方式用のアクションコード（クリップボード連携）
  const ghostCode = 'nfc:unlock_ghost';
  const creditCode = `nfc:reset_credit:${targetCard}`;
  const quickInputCode = `nfc:quick_input:${targetAccount}`;

  // ② 通常ブラウザ用URL
  const ghostBrowserUrl = `${origin}/?action=unlock_ghost`;
  const creditBrowserUrl = `${origin}/?action=reset_credit&card=${encodeURIComponent(targetCard)}`;
  const quickInputBrowserUrl = `${origin}/?action=quick_input&account=${encodeURIComponent(targetAccount)}`;

  // 現在のモードに応じた値
  const ghostVal = launchMode === 'app' ? ghostCode : ghostBrowserUrl;
  const creditVal = launchMode === 'app' ? creditCode : creditBrowserUrl;
  const quickInputVal = launchMode === 'app' ? quickInputCode : quickInputBrowserUrl;

  const handleCopy = (val, label) => {
    const isApp = launchMode === 'app';
    const msg = isApp ? `[コピー完了] ${label} 用コードをコピーしました` : `[コピー完了] ${label} 用URLをコピーしました`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(val)
        .then(() => onToast(msg))
        .catch(() => fallbackCopy(val, msg));
    } else {
      fallbackCopy(val, msg);
    }
  };

  const fallbackCopy = (text, successMsg) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      onToast(successMsg);
    } catch (e) {
      onToast(`[コピー失敗] 手動で選択してコピーしてください`);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(5px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999, padding: '15px'
    }}>
      <div style={{
        background: '#0d1117', border: `1px solid ${themeColor}`, borderRadius: '12px',
        width: '100%', maxWidth: '440px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: `0 0 30px ${themeColor}33`, color: '#fff', overflow: 'hidden'
      }}>
        {/* ヘッダー */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #222', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', background: '#111620'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: themeColor, fontWeight: 'bold', letterSpacing: '1px' }}>
              [ NFC / SHORTCUT AUTOMATION ]
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '2px' }}>
              NFCカード・リング連携設定
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid #444', color: '#888',
              borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px'
            }}
          >
            [閉じる]
          </button>
        </div>

        {/* スクロール領域 */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 起動先モード選択スイッチ */}
          <div style={{ background: '#111620', border: '1px solid #282f3d', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>
              [起動モードの選択]
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => setLaunchMode('app')}
                style={{
                  background: launchMode === 'app' ? `${themeColor}22` : '#080a0f',
                  border: `1px solid ${launchMode === 'app' ? themeColor : '#333'}`,
                  color: launchMode === 'app' ? themeColor : '#777',
                  padding: '8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                ホーム画面アプリ (推奨)
              </button>
              <button
                type="button"
                onClick={() => setLaunchMode('browser')}
                style={{
                  background: launchMode === 'browser' ? `${themeColor}22` : '#080a0f',
                  border: `1px solid ${launchMode === 'browser' ? themeColor : '#333'}`,
                  color: launchMode === 'browser' ? themeColor : '#777',
                  padding: '8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                ブラウザ起動 (Chrome等)
              </button>
            </div>
            <div style={{ fontSize: '10px', color: launchMode === 'app' ? themeColor : '#aaa', lineHeight: '1.4' }}>
              {launchMode === 'app'
                ? '【ホーム画面アプリ起動】「Appを開く」を使用し、ブラウザ枠なし・他のPWAへの誤爆ゼロでこの家計簿アプリのみを確実に起動します。'
                : '【通常ブラウザ起動】「URLを開く」を使用し、Chrome等のブラウザタブで開きます。'}
            </div>
          </div>

          {/* ① ゴースト口座アンロック */}
          <div style={{ background: '#111620', border: '1px solid #222', borderRadius: '8px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontWeight: 'bold', color: themeColor, fontSize: '13px' }}>
                [1] ゴースト口座アンロック
              </div>
              <span style={{ fontSize: '10px', color: '#888', background: '#000', padding: '2px 6px', borderRadius: '4px' }}>
                物理キーカード
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>
              社員証やSuicaなどのカードをかざすと、サイバー認証演出とともに隠し口座のロックを解除します。
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                readOnly
                value={ghostVal}
                style={{
                  flex: 1, background: '#080a0f', border: '1px solid #333', color: '#7ee787',
                  padding: '8px 10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace'
                }}
              />
              <button
                type="button"
                onClick={() => handleCopy(ghostVal, 'ゴースト解除')}
                style={{
                  background: themeColor, color: '#000', border: 'none', padding: '0 14px',
                  borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                コピー
              </button>
            </div>
          </div>

          {/* ② クレジットカード精算ダイアログ直通 */}
          <div style={{ background: '#111620', border: '1px solid #222', borderRadius: '8px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontWeight: 'bold', color: '#ff9900', fontSize: '13px' }}>
                [2] クレジットカード利用額精算
              </div>
              <span style={{ fontSize: '10px', color: '#888', background: '#000', padding: '2px 6px', borderRadius: '4px' }}>
                クレカタッチ
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
              お手元のクレジットカードをかざすと、そのカードの「手動リセット・銀行振替ダイアログ」が直接起動します。
            </div>
            
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <select
                value={selectedCard}
                onChange={(e) => { setSelectedCard(e.target.value); setCustomCard(''); }}
                style={{
                  background: '#080a0f', border: '1px solid #333', color: '#fff',
                  padding: '6px 8px', borderRadius: '4px', fontSize: '11px'
                }}
              >
                <option value="リクルートカード">リクルートカード</option>
                <option value="エポスカード">エポスカード</option>
                <option value="楽天カード">楽天カード</option>
                <option value="三井住友カード">三井住友カード</option>
              </select>
              <input
                placeholder="他のカード名を入力"
                value={customCard}
                onChange={(e) => setCustomCard(e.target.value)}
                style={{
                  flex: 1, background: '#080a0f', border: '1px solid #333', color: '#fff',
                  padding: '6px 8px', borderRadius: '4px', fontSize: '11px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                readOnly
                value={creditVal}
                style={{
                  flex: 1, background: '#080a0f', border: '1px solid #333', color: '#ffc107',
                  padding: '8px 10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace'
                }}
              />
              <button
                type="button"
                onClick={() => handleCopy(creditVal, `${targetCard} 精算`)}
                style={{
                  background: '#ff9900', color: '#000', border: 'none', padding: '0 14px',
                  borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                コピー
              </button>
            </div>
          </div>

          {/* ③ スマートリング即時決済入力 */}
          <div style={{ background: '#111620', border: '1px solid #222', borderRadius: '8px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontWeight: 'bold', color: '#00bfff', fontSize: '13px' }}>
                [3] スマートリング即時入力
              </div>
              <span style={{ fontSize: '10px', color: '#888', background: '#000', padding: '2px 6px', borderRadius: '4px' }}>
                リング / バンド
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
              EVERINGやスマートバンドをかざすと、支払い元をセットして直ちにテンキーを開きます。
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <select
                value={selectedAccount}
                onChange={(e) => { setSelectedAccount(e.target.value); setCustomAccount(''); }}
                style={{
                  background: '#080a0f', border: '1px solid #333', color: '#fff',
                  padding: '6px 8px', borderRadius: '4px', fontSize: '11px'
                }}
              >
                <option value="EVERING">EVERING</option>
                <option value="PayPay">PayPay</option>
                <option value="現金">現金</option>
              </select>
              <input
                placeholder="他の口座名を入力"
                value={customAccount}
                onChange={(e) => setCustomAccount(e.target.value)}
                style={{
                  flex: 1, background: '#080a0f', border: '1px solid #333', color: '#fff',
                  padding: '6px 8px', borderRadius: '4px', fontSize: '11px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                readOnly
                value={quickInputVal}
                style={{
                  flex: 1, background: '#080a0f', border: '1px solid #333', color: '#00bfff',
                  padding: '8px 10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace'
                }}
              />
              <button
                type="button"
                onClick={() => handleCopy(quickInputVal, `${targetAccount} 入力`)}
                style={{
                  background: '#00bfff', color: '#000', border: 'none', padding: '0 14px',
                  borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                コピー
              </button>
            </div>
          </div>

          {/* iPhoneでのショートカット設定手順ガイド */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
              {launchMode === 'app'
                ? '[推奨手順] ホーム画面アプリを100%確実に開く設定（1分）'
                : '[手順] ブラウザでURLを開く設定（1分）'}
            </div>
            
            {launchMode === 'app' ? (
              <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#ccc', lineHeight: '1.8' }}>
                <li>ショートカットアプリの「オートメーション」＞「＋」＞「NFC」でカード/リングを登録</li>
                <li>「すぐに実行」を選択して「次へ」</li>
                <li><strong>アクション①</strong>: 検索で「<strong>テキスト</strong>」を追加し、上記でコピーしたコード（<code>{ghostCode}</code> 等）を貼り付け</li>
                <li><strong>アクション②</strong>: 検索で「<strong>クリップボードにコピー</strong>」を追加</li>
                <li><strong>アクション③</strong>: 検索で「<strong>Appを開く</strong>」を追加し、ホーム画面の「<strong>家計簿</strong>」を選択して「完了」！</li>
              </ol>
            ) : (
              <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#ccc', lineHeight: '1.8' }}>
                <li>ショートカットアプリの「オートメーション」＞「＋」＞「NFC」でカード/リングを登録</li>
                <li>「すぐに実行」を選択して「次へ」</li>
                <li>アクションで「<strong>URLを開く</strong>」を追加し、上記でコピーしたURLを貼り付けて「完了」！</li>
              </ol>
            )}

            {launchMode === 'app' && (
              <div style={{ marginTop: '10px', padding: '8px 10px', background: '#0a0d14', borderRadius: '6px', fontSize: '10px', color: '#888', border: '1px dashed #00ff66', lineHeight: '1.5' }}>
                <div style={{ color: themeColor, fontWeight: 'bold', marginBottom: '2px' }}>[なぜこの設定が最強なのか？]</div>
                iOSが直接「家計簿」アプリを指定して起動するため、他のPWAやブラウザに誤認される事故が100%発生しません。全画面のまま目的のアクションが即座に立ち上がります。
              </div>
            )}
          </div>

        </div>

        {/* フッター */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #222', background: '#111620', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              background: '#222', color: '#fff', border: '1px solid #444',
              borderRadius: '6px', padding: '8px 18px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
