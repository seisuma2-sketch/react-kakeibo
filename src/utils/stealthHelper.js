/**
 * 🌟 ステルス・ゴースト口座偽装エンジン
 * 隠している口座（ゴースト口座）が関わる資金移動について：
 * - 隠しているとき（isStealthActive = true）:
 *   中間の移動（過程）を消去し、最終的な結果の移動（A→B, A→支出, 収入→B）だけに偽装する
 * - 隠していないとき（isStealthActive = false）:
 *   中間の過程まですべて表示する
 */

export const cleanAccountName = (str) => {
  if (!str) return '';
  let s = String(str).trim();
  if (s.startsWith('/')) {
    const idx = s.indexOf(' ');
    if (idx !== -1) s = s.slice(idx + 1).trim();
  }
  return s.replace(/^[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]\s?/g, '').trim();
};

export function getStealthDisguisedTransactions(transactions = [], ghostAccounts = [], isStealthActive = true) {
  if (!isStealthActive) {
    return transactions;
  }

  const cleanGhosts = (ghostAccounts || []).map(cleanAccountName).filter(Boolean);
  if (cleanGhosts.length === 0) {
    return transactions;
  }

  // 古い順（昇順）にソートして資金の流れを時系列でシミュレーション
  const sortedTx = [...transactions].sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
    return dateA - dateB;
  });

  const normalTransactions = [];
  const ghostInflows = [];  // 隠し口座への流入プール
  const ghostOutflows = []; // 隠し口座からの流出プール

  sortedTx.forEach(tx => {
    const fromAcc = cleanAccountName(tx.paymentMethod);
    const toAcc = cleanAccountName(tx.category);
    const isFromGhost = cleanGhosts.includes(fromAcc);
    const isToGhost = tx.type === 'transfer' && cleanGhosts.includes(toAcc);

    // 隠し口座同士の振替は隠蔽状態では完全不可視化
    if (isFromGhost && isToGhost) {
      return;
    }

    // 隠し口座が一切関わらない取引はそのまま通常取引へ
    if (!isFromGhost && !isToGhost) {
      normalTransactions.push(tx);
      return;
    }

    // 隠し口座への流入（一般口座からの振替）
    if (isToGhost) {
      ghostInflows.push({
        origTx: tx,
        source: fromAcc,
        rawSource: tx.paymentMethod,
        isIncome: false,
        category: tx.category,
        amount: Number(tx.amount) || 0,
        date: tx.date,
        memo: tx.memo
      });
      return;
    }

    // 隠し口座からの流出（支出 or 一般口座への振替）
    if (isFromGhost) {
      if (tx.type === 'income') {
        // 隠し口座への直接入金（給与など）
        ghostInflows.push({
          origTx: tx,
          source: fromAcc,
          rawSource: tx.paymentMethod,
          isIncome: true,
          category: tx.category,
          amount: Number(tx.amount) || 0,
          date: tx.date,
          memo: tx.memo
        });
        return;
      }

      ghostOutflows.push({
        origTx: tx,
        destination: toAcc,
        rawDestination: tx.category,
        type: tx.type, // 'transfer' or 'expense'
        category: tx.category,
        amount: Number(tx.amount) || 0,
        date: tx.date,
        memo: tx.memo
      });
    }
  });

  const disguisedTransactions = [...normalTransactions];

  // 流入と流出をマッチングし、中間の隠し口座をバイパス（最終結果のみの移動に偽装）
  ghostOutflows.forEach(outflow => {
    if (outflow.amount <= 0) return;

    // 1. 同額マッチングを最優先
    let matchedInflow = ghostInflows.find(inf => inf.amount === outflow.amount);
    // 2. なければ残高がある最初の流入（FIFO）
    if (!matchedInflow) {
      matchedInflow = ghostInflows.find(inf => inf.amount > 0);
    }

    if (matchedInflow) {
      const matchAmt = Math.min(matchedInflow.amount, outflow.amount);
      matchedInflow.amount -= matchAmt;
      outflow.amount -= matchAmt;

      if (matchedInflow.isIncome) {
        // 収入 -> 隠し口座 -> 一般口座
        if (outflow.type === 'transfer') {
          disguisedTransactions.push({
            ...outflow.origTx,
            id: `disguised_${outflow.origTx.id || Math.random()}`,
            type: 'income',
            paymentMethod: outflow.rawDestination || outflow.destination,
            category: matchedInflow.category,
            amount: matchAmt,
            memo: outflow.memo || matchedInflow.memo || ''
          });
        }
      } else {
        // 一般口座A -> 隠し口座 -> 一般口座B / 支出
        if (outflow.type === 'transfer') {
          // 一般口座A -> 一般口座B への直接振替に偽装
          disguisedTransactions.push({
            ...outflow.origTx,
            id: `disguised_${outflow.origTx.id || Math.random()}`,
            type: 'transfer',
            paymentMethod: matchedInflow.rawSource || matchedInflow.source,
            category: outflow.rawDestination || outflow.destination,
            amount: matchAmt,
            memo: outflow.memo || matchedInflow.memo || '振替'
          });
        } else {
          // 一般口座A -> 支出 に偽装
          disguisedTransactions.push({
            ...outflow.origTx,
            id: `disguised_${outflow.origTx.id || Math.random()}`,
            type: 'expense',
            paymentMethod: matchedInflow.rawSource || matchedInflow.source,
            category: outflow.category,
            amount: matchAmt,
            memo: outflow.memo || matchedInflow.memo || ''
          });
        }
      }
    } else {
      // ペアとなる流入がない流出（隠し口座の元々あった残高から一般口座Bへ移動した場合）
      if (outflow.type === 'transfer' && outflow.amount > 0) {
        disguisedTransactions.push({
          ...outflow.origTx,
          id: `disguised_${outflow.origTx.id || Math.random()}`,
          type: 'income',
          paymentMethod: outflow.rawDestination || outflow.destination,
          category: '臨時収入',
          amount: outflow.amount,
          memo: '資金移動'
        });
      }
    }
  });

  // 未消費の流入（一般口座Aから隠し口座にお金を入れたまま出金されていない場合）
  ghostInflows.forEach(inflow => {
    if (inflow.amount > 0 && !inflow.isIncome) {
      disguisedTransactions.push({
        ...inflow.origTx,
        id: `disguised_${inflow.origTx.id || Math.random()}`,
        type: 'expense',
        paymentMethod: inflow.rawSource || inflow.source,
        category: '貯蓄・積立',
        amount: inflow.amount,
        memo: '内部振替'
      });
    }
  });

  // 最後に新しい順（降順）に戻して返す
  return disguisedTransactions.sort((a, b) => {
    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
    return dateB - dateA;
  });
}
