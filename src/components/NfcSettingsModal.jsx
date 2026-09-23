import React, { useState } from 'react';

/**
 * NFC設定モーダル（iOSショートカット / 物理カード / スマートリング連携用）
 * 絵文字は使わずテキストで統一、Chrome標準ダイアログは不使用
 * 「いつもの全画面PWA起動（完全一致webapp:// ＋ クリップボード連携）」に対応
 */
export default function NfcSettingsModal({ isOpen, onClose, onToast, themeColor = '#00ff66' }) {
  const [selectedCard, setSelectedCard] = useState('リクルートカード');
  const [customCard, setCustomCard] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('EVERING');
  const [customAccount, setCustomAccount] = useState('');

  if (!isOpen) return null;

  const origin = window.location.origin;
  const targetCard = customCard.trim() || selectedCard;
  const targetAccount = customAccount.trim() || selectedAccount;

  // ① 完全全画面PWA起動用URL（クエリなしのドメイン完全一致）
  const pwaLaunchUrl = origin.replace(/^https?:\/\//, 'webapp://');

  // ② アクションコード（クリップボード連携用）
  const ghostCode = 'nfc:unlock_ghost';
  const creditCode = `nfc:reset_credit:${targetCard}`;
  const quickInputCode = `nfc:quick_input:${targetAccount}`;

  const handleCopy = (val, label) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(val)
        .then(() => onToast(`[コピー完了] ${label} をコピーしました`))
        .catch(() => fallbackCopy(val, label));
    } else {
      fallbackCopy(val, label);
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
      onToast(`[コピー完了] ${label} をコピーしました`);
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
              [ NFC / PWA AUTOMATION ]
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '2px' }}>
              完全全画面PWA × NFC連携設定
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
          
          <div style={{ fontSize: '12px', color: '#aaa', lineHeight: '1.5', background: '#161b22', padding: '12px', borderRadius: '8px', borderLeft: `3px solid ${themeColor}` }}>
            ブラウザの枠（アドレスバーや×ボタン等）を出さず、<strong>いつもアプリアイコンをタップしたときと同じ完全な全画面</strong>で開く設定です。
          </div>

          {/* ステップA: アプリ起動URL */}
          <div style={{ background: '#111620', border: '1px solid #282f3d', borderRadius: '8px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontWeight: 'bold', color: themeColor, fontSize: '12px' }}>
                [STEP 1] 全画面アプリ起動用URL
              </div>
              <span style={{ fontSize: '10px', color: themeColor, background: '#000', padding: '2px 6px', borderRadius: '4px' }}>
                完全全画面
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
              クエリなしの完全一致URLを指定することで、他のPWAに誤認されずこの家計簿アプリだけを全画面で呼び出します。
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                readOnly
                value={pwaLaunchUrl}
                style={{
                  flex: 1, background: '#080a0f', border: '1px solid #333', color: '#7ee787',
                  padding: '8px 10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace'
                }}
              />
              <button
                type="button"
                onClick={() => handleCopy(pwaLaunchUrl, '起動用URL')}
                style={{
                  background: themeColor, color: '#000', border: 'none', padding: '0 14px',
                  borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                コピー
              </button>
            </div>
          </div>

          {/* ステップB: アクションコード */}
          <div style={{ background: '#111620', border: '1px solid #282f3d', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '12px', marginBottom: '6px' }}>
              [STEP 2] 連動させるアクションコードを選択
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px' }}>
              かざした時に実行したいアクションのコードをコピーします。
            </div>

            {/* ① ゴースト口座アンロック */}
            <div style={{ marginBottom: '12px', background: '#080a0f', padding: '10px', borderRadius: '6px', border: '1px solid #222' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: themeColor }}>[1] ゴースト口座アンロック</span>
                <button
                  type="button"
                  onClick={() => handleCopy(ghostCode, 'ゴースト解除コード')}
                  style={{
                    background: themeColor, color: '#000', border: 'none', padding: '4px 10px',
                    borderRadius: '4px', fontWeight: 'bold', fontSize: '10px', cursor: 'pointer'
                  }}
                >
                  コードをコピー
                </button>
              </div>
              <div style={{ fontSize: '10px', color: '#888' }}>
                カードをタッチした時にサイバー演出とともに隠し資産のロックを解除します。
              </div>
            </div>

            {/* ② クレジットカード精算ダイアログ直通 */}
            <div style={{ marginBottom: '12px', background: '#080a0f', padding: '10px', borderRadius: '6px', border: '1px solid #222' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#ff9900' }}>[2] クレカ手動リセット精算</span>
                <button
                  type="button"
                  onClick={() => handleCopy(creditCode, `${targetCard} 精算コード`)}
                  style={{
                    background: '#ff9900', color: '#000', border: 'none', padding: '4px 10px',
                    borderRadius: '4px', fontWeight: 'bold', fontSize: '10px', cursor: 'pointer'
                  }}
                >
                  コードをコピー
                </button>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', marginBottom: '6px' }}>
                <select
                  value={selectedCard}
                  onChange={(e) => { setSelectedCard(e.target.value); setCustomCard(''); }}
                  style={{ background: '#111620', border: '1px solid #333', color: '#fff', padding: '4px 6px', borderRadius: '4px', fontSize: '11px' }}
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
                  style={{ flex: 1, background: '#111620', border: '1px solid #333', color: '#fff', padding: '4px 6px', borderRadius: '4px', fontSize: '11px' }}
                />
              </div>
              <div style={{ fontSize: '10px', color: '#888' }}>
                カードタッチで直接そのカードの自作精算ダイアログを開きます。
              </div>
            </div>

            {/* ③ スマートリング即時決済入力 */}
            <div style={{ background: '#080a0f', padding: '10px', borderRadius: '6px', border: '1px solid #222' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#00bfff' }}>[3] スマートリング即時入力</span>
                <button
                  type="button"
                  onClick={() => handleCopy(quickInputCode, `${targetAccount} 入力コード`)}
                  style={{
                    background: '#00bfff', color: '#000', border: 'none', padding: '4px 10px',
                    borderRadius: '4px', fontWeight: 'bold', fontSize: '10px', cursor: 'pointer'
                  }}
                >
                  コードをコピー
                </button>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', marginBottom: '6px' }}>
                <select
                  value={selectedAccount}
                  onChange={(e) => { setSelectedAccount(e.target.value); setCustomAccount(''); }}
                  style={{ background: '#111620', border: '1px solid #333', color: '#fff', padding: '4px 6px', borderRadius: '4px', fontSize: '11px' }}
                >
                  <option value="EVERING">EVERING</option>
                  <option value="PayPay">PayPay</option>
                  <option value="現金">現金</option>
                </select>
                <input
                  placeholder="他の口座名を入力"
                  value={customAccount}
                  onChange={(e) => setCustomAccount(e.target.value)}
                  style={{ flex: 1, background: '#111620', border: '1px solid #333', color: '#fff', padding: '4px 6px', borderRadius: '4px', fontSize: '11px' }}
                />
              </div>
              <div style={{ fontSize: '10px', color: '#888' }}>
                リングタッチで支払い元を自動選択し、即座にテンキーを開きます。
              </div>
            </div>

          </div>

          {/* iPhoneでのショートカット設定手順ガイド */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
              [設定手順] 完全全画面で起動するオートメーション（1分）
            </div>
            
            <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#ccc', lineHeight: '1.9' }}>
              <li>iPhoneの「ショートカット」アプリ ＞ 下の「オートメーション」＞「＋」＞「NFC」を選択</li>
              <li>カードやリングをタッチして登録し、「すぐに実行」を選択して「次へ」</li>
              <li><strong>アクション①</strong>: 検索で「<strong>テキスト</strong>」を追加し、STEP 2でコピーした<strong>アクションコード</strong>（<code>{ghostCode}</code> 等）を貼り付け</li>
              <li><strong>アクション②</strong>: 検索で「<strong>クリップボードにコピー</strong>」を追加</li>
              <li><strong>アクション③</strong>: 検索で「<strong>URLを開く</strong>」を追加し、STEP 1でコピーした<strong>起動用URL</strong>（<code>{pwaLaunchUrl}</code>）を貼り付けて「完了」！</li>
            </ol>

            <div style={{ marginTop: '10px', padding: '8px 10px', background: '#0a0d14', borderRadius: '6px', fontSize: '10px', color: '#888', border: '1px dashed #00ff66', lineHeight: '1.5' }}>
              <div style={{ color: themeColor, fontWeight: 'bold', marginBottom: '2px' }}>[全画面になる秘密]</div>
              URLにクエリを付けない完全一致の <code>webapp://...</code> を開くことで、iOSが「登録済みのPWA」と完全一致させ、ブラウザの枠が一切ない「いつものアプリアイコンをタップした画面」で起動します。
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
