import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// 🌟 クラウド (Firestore) と ローカル (localStorage) の同期キー一覧（一本化＆全設定リアルタイム同期）
const SYNC_KEYS = [
  { field: 'creditCardSettings', localKey: 'creditCardSettings' },
  { field: 'accounts', localKey: 'm402_accounts' },
  { field: 'deletedAccounts', localKey: 'deletedAccountsConfig' },
  { field: 'customOrder', localKey: 'customOrderConfig' },
  { field: 'monthlyBudget', localKey: 'm402_monthly_budget' },
  { field: 'savingsTsumoriLogs', localKey: 'm402_tsumori_logs' },
  { field: 'expenseCategories', localKey: 'm402_expense_cats' },
  { field: 'incomeCategories', localKey: 'm402_income_cats' },
  { field: 'recurringItems', localKey: 'm402_recurring_items' },
  { field: 'appTheme', localKey: 'm402_app_theme' },
  { field: 'cardMode', localKey: 'm402_card_mode' }
];

/**
 * クラウドから受信した設定データを localStorage に反映する
 */
export function applyCloudSettingsToLocal(cloudData) {
  if (!cloudData) return false;
  let updated = false;

  SYNC_KEYS.forEach(({ field, localKey }) => {
    if (cloudData[field] !== undefined && cloudData[field] !== null) {
      const cloudValStr = JSON.stringify(cloudData[field]);
      const currentLocal = localStorage.getItem(localKey);
      if (currentLocal !== cloudValStr) {
        localStorage.setItem(localKey, cloudValStr);
        updated = true;
      }
    }
  });

  return updated;
}

/**
 * ローカルの現在の設定をクラウドに一括バックアップ（初回マイグレーションまたは手動同期用）
 */
export async function syncLocalSettingsToCloud(userId, extraData = {}) {
  if (!userId) return;

  const payload = { ...extraData };

  SYNC_KEYS.forEach(({ field, localKey }) => {
    const localVal = localStorage.getItem(localKey);
    if (localVal) {
      try {
        payload[field] = JSON.parse(localVal);
      } catch (e) {
        // ignore parse error
      }
    }
  });

  try {
    await setDoc(doc(db, "user_settings", userId), payload, { merge: true });
  } catch (err) {
    console.error("設定クラウド同期エラー:", err);
  }
}

/**
 * 特定のキー（クレカ設定や口座など）をローカルとFirestoreに同時保存
 */
export async function saveSettingBoth(userId, fieldName, localKey, value) {
  localStorage.setItem(localKey, JSON.stringify(value));
  if (userId) {
    try {
      await setDoc(doc(db, "user_settings", userId), { [fieldName]: value }, { merge: true });
    } catch (err) {
      console.error(`設定保存エラー [${fieldName}]:`, err);
    }
  }
}
