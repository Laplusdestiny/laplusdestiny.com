/**
 * グラフのツールチップ。[data-chart] の中の [data-tip-value] 要素に
 * マウスを乗せるかキーボードでフォーカスすると、値とラベルを表示する。
 * 値はツールチップがなくても表や数値ラベルで読めるようにしてある。
 */
for (const chart of document.querySelectorAll<HTMLElement>('[data-chart]')) {
  const tip = chart.querySelector<HTMLElement>('.chart-tip');
  if (!tip) continue;

  const show = (target: HTMLElement) => {
    const anchor = target.querySelector<HTMLElement>('[data-tip-anchor]') ?? target;
    const value = document.createElement('strong');
    value.className = 'block font-semibold text-ink';
    value.textContent = target.dataset.tipValue ?? '';
    const label = document.createElement('span');
    label.className = 'block text-ink-3';
    label.textContent = target.dataset.tipLabel ?? '';
    tip.replaceChildren(value, label);

    tip.hidden = false;
    const box = chart.getBoundingClientRect();
    const rect = anchor.getBoundingClientRect();
    // 棒の中央に合わせつつ、グラフの左右からはみ出さないようにする
    const half = tip.offsetWidth / 2;
    const center = rect.left + rect.width / 2 - box.left;
    tip.style.left = `${Math.min(Math.max(center, half), Math.max(half, box.width - half))}px`;
    // 高さ 0 の棒（投稿 0 件）では列の下端に出る
    tip.style.top = `${rect.top - box.top}px`;
  };
  const hide = () => {
    tip.hidden = true;
  };

  for (const target of chart.querySelectorAll<HTMLElement>('[data-tip-value]')) {
    target.addEventListener('pointerenter', () => show(target));
    target.addEventListener('pointerleave', hide);
    target.addEventListener('focus', () => show(target));
    target.addEventListener('blur', hide);
  }
}
