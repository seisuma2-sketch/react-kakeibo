// 口座・カード名の正規化・重複排除ユーティリティ

/**
 * 口座・カード名から先頭のアイコンパスを除去した純粋な名前を返す
 * 例: "/S__32391170.jpg リクルートカード" -> "リクルートカード"
 * 例: "リクルートカード" -> "リクルートカード"
 */
export function getCleanAccountName(str) {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (trimmed.startsWith('/')) {
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx !== -1) {
      return trimmed.slice(spaceIdx + 1).trim();
    }
  }
  return trimmed;
}

/**
 * 2つの口座・カード名が実質的に同一かどうか判定（アイコンパスの有無を無視）
 */
export function isSameAccount(a, b) {
  return getCleanAccountName(a) === getCleanAccountName(b);
}

/**
 * 口座名配列からクリーンネーム基準で重複を排除する
 */
export function deduplicateAccounts(accounts = []) {
  if (!Array.isArray(accounts)) return [];
  const seen = new Set();
  const result = [];
  accounts.forEach(acc => {
    const clean = getCleanAccountName(acc);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    result.push(acc);
  });
  return result;
}

/**
 * クレジットカード設定オブジェクトからクリーンネーム基準で重複キーを正規化する
 */
export function normalizeCreditCardSettings(settings = {}) {
  if (!settings || typeof settings !== 'object') return {};
  const normalized = {};
  Object.entries(settings).forEach(([rawKey, val]) => {
    const cleanKey = getCleanAccountName(rawKey);
    if (!cleanKey) return;
    if (!normalized[cleanKey]) {
      normalized[cleanKey] = val;
    } else {
      normalized[cleanKey] = {
        ...normalized[cleanKey],
        ...val,
        budget: val.budget || normalized[cleanKey].budget
      };
    }
  });
  return normalized;
}

/**
 * 対象の口座名がゴースト口座（隠し口座リスト）に含まれるかを柔軟・確実に判定
 * アイコンパス（/xxx.png）、余分な空白、大文字小文字、表記揺れ（部分一致）を吸収
 */
export function isGhostAccount(accountName, ghostAccounts = []) {
  if (!accountName || !Array.isArray(ghostAccounts) || ghostAccounts.length === 0) return false;
  const cleanTarget = getCleanAccountName(accountName).toLowerCase().replace(/\s+/g, '');
  if (!cleanTarget) return false;

  return ghostAccounts.some(g => {
    const cleanGhost = getCleanAccountName(g).toLowerCase().replace(/\s+/g, '');
    if (!cleanGhost) return false;
    // 完全一致、または相互部分一致（例: 「三井住友」と「三井住友銀行」）
    return cleanTarget === cleanGhost || cleanTarget.includes(cleanGhost) || cleanGhost.includes(cleanTarget);
  });
}
