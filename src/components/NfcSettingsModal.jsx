import React, { useState } from 'react';

/**
 * NFC設定モーダル（iOSショートカット / 物理カード / スマートリング連携用）
 * 絵文字は使わずテキストで統一、Chrome標準ダイアログは不使用
 */
export default function NfcSettingsModal({ isOpen, onClose, onToast, themeColor = '#00ff66' }) {
  const [selectedCard, setSelectedCard] = useState('リクルートカード');
  const [customCard, setCustomCard] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('EVERING');
  const [customAccount, setCustomAccount] = useState('');
  const [usePwaMode, setUsePwaMode] = useState(true); // true: webapp:// (ホーム画面PWA起動), false: https://

  if (!isOpen) return null;

  const origin = window.location.origin;

  const targetCard = customCard.trim() || selectedCard;
  const targetAccount = customAccount.trim() || selectedAccount;

  // 生成URL
  const ghostUnlockUrl = `${origin}/?action=unlock_ghost`;
  const creditResetUrl = `${origin}/?action=reset_credit&card=${encodeURIComponent(targetCard)}`;
  const quickInputUrl = `${origin}/?action=quick_input&account=${encodeURIComponent(targetAccount)}`;
  // 生成URL（usePwaModeがONの場合は webapp:// スキームでホーム画面アプリを直接呼出）
  const getUrl = (pathWithQuery) => {
    const fullUrl = `${origin}${pathWithQuery}`;
    if (usePwaMode) {
      return fullUrl.replace(/^https?:\/\//, 'webapp://');
    }
    return fullUrl;
  };

  const ghostUnlockUrl = getUrl('/?action=unlock_ghost');
  const creditResetUrl = getUrl(`/?action=reset_credit&card=${encodeURIComponent(targetCard)}`);
  const quickInputUrl = getUrl(`/?action=quick_input&account=${encodeURIComponent(targetAccount)}`);

  const handleCopy = (url, label) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => {
          onToast(`[コピー完了] ${label} 用URLをコピーしました`);
        })
        .catch(() => {
          fallbackCopy(url, label);
        });
    } else {
      fallbackCopy(url, label);
    }
  };

  const fallbackCopy = (text, label) => {
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
      onToast(`[コピー完了] ${label} 用URLをコピーしました`);
    } catch (e) {
      onToast(`[コピー失敗] 手動でURLを選択してコピーしてください`);
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
        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ fontSize: '12px', color: '#aaa', lineHeight: '1.5', background: '#161b22', padding: '12px', borderRadius: '8px', borderLeft: `3px solid ${themeColor}` }}>
            iPhoneの「ショートカット」アプリに登録することで、カードやスマートリングをかざした瞬間にアプリが連動起動します。
          </div>

          {/* 起動先モード選択（ホーム画面PWA vs 通常ブラウザ） */}
          <div style={{ background: '#111620', border: '1px solid #282f3d', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>
              [起動先モード選択]
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => setUsePwaMode(true)}
                style={{
                  background: usePwaMode ? `${themeColor}22` : '#080a0f',
                  border: `1px solid ${usePwaMode ? themeColor : '#333'}`,
                  color: usePwaMode ? themeColor : '#777',
                  padding: '8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                ホーム画面アプリ用 (PWA)
              </button>
              <button
                type="button"
                onClick={() => setUsePwaMode(false)}
                style={{
                  background: !usePwaMode ? `${themeColor}22` : '#080a0f',
                  border: `1px solid ${!usePwaMode ? themeColor : '#333'}`,
                  color: !usePwaMode ? themeColor : '#777',
                  padding: '8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                通常ブラウザ用 (Chrome等)
              </button>
            </div>
            <div style={{ fontSize: '10px', color: usePwaMode ? themeColor : '#aaa', lineHeight: '1.4' }}>
              {usePwaMode
                ? '【ホーム画面アプリ起動】webapp:// スキームを使用し、Chrome等のブラウザ枠を出さずにホーム画面の全画面アプリを直接開きます。'
                : '【ブラウザ起動】https:// を使用し、Chrome等の通常のブラウザタブで開きます。'}
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
              社員証やSuicaなどの物理カードをかざすと、サイバー認証演出とともに隠し口座のロックを解除します。
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                readOnly
                value={ghostUnlockUrl}
                style={{
                  flex: 1, background: '#080a0f', border: '1px solid #333', color: '#7ee787',
                  padding: '8px 10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace'
                }}
              />
              <button
                onClick={() => handleCopy(ghostUnlockUrl, 'ゴースト解除')}
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
                value={creditResetUrl}
                style={{
                  flex: 1, background: '#080a0f', border: '1px solid #333', color: '#ffc107',
                  padding: '8px 10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace'
                }}
              />
              <button
                onClick={() => handleCopy(creditResetUrl, `${targetCard} 精算`)}
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
                value={quickInputUrl}
                style={{
                  flex: 1, background: '#080a0f', border: '1px solid #333', color: '#00bfff',
                  padding: '8px 10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace'
                }}
              />
              <button
                onClick={() => handleCopy(quickInputUrl, `${targetAccount} 入力`)}
                style={{
                  background: '#00bfff', color: '#000', border: 'none', padding: '0 14px',
                  borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                コピー
              </button>
            </div>
          </div>

          {/* iPhoneでの1分設定ガイド */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
              [設定手順] iOS ショートカットへの登録（1分）
            </div>
            <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#ccc', lineHeight: '1.8' }}>
              <li>iPhone標準の<strong>「ショートカット」</strong>アプリを開く</li>
              <li>画面下の<strong>「オートメーション」</strong>タブ ＞ 右上の<strong>「＋」</strong>をタップ</li>
              <li>一覧から<strong>「NFC」</strong>を選択</li>
              <li>「スキャン」を押し、登録したいカードまたはリングをiPhone上部背面にタッチして名前をつける</li>
              <li><strong>「すぐに実行」</strong>を選択（実行前通知はOFFがおすすめ）</li>
              <li>「次へ」＞ アクションで<strong>「URLを開く」</strong>を追加し、上記でコピーしたURLを貼り付けて「完了」！</li>
              <li>「次へ」＞ アクションで<strong>「URLを開く」</strong>を追加し、上記でコピーしたURL（<code>webapp://...</code>）を貼り付けて「完了」！</li>
            </ol>
            <div style={{ marginTop: '10px', padding: '8px 10px', background: '#0a0d14', borderRadius: '6px', fontSize: '10px', color: '#888', border: '1px dashed #444', lineHeight: '1.5' }}>
              <div style={{ color: themeColor, fontWeight: 'bold', marginBottom: '2px' }}>[POINT: Chromeではなくホーム画面アプリを開くには？]</div>
              URLの先頭を <code>webapp://</code> にすることで、iOSがブラウザではなくホーム画面の全画面PWAアプリを直接起動します。<br/>
              ※パラメータ連携が不要で単にアプリを開きたい場合は、アクション検索で<strong>「Appを開く」</strong>を選び、ホーム画面に追加した本アプリ名を指定することもできます。
            </div>
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

