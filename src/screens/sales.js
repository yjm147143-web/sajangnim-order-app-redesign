/*
 * 매출 조회 화면 — 5개 카드형 허브 -> 상세 화면 구조
 * Router 화면 이름은 'sales' 하나만 등록하고, 내부적으로 상태(state)를 바꿔가며
 * 허브/상세 화면을 그린다. 뒤로가기: 상세 -> 허브, 허브 -> 'settings'
 */
(function () {
  const HUB_CARDS = [
    { key: 'channel', emoji: '🧾', title: '주문 방식별 매출', sub: 'QR오더 · 태블릿오더 · 현금' },
    { key: 'period', emoji: '📅', title: '기간별 매출', sub: '일자별 매출 추이' },
    { key: 'menu', emoji: '🍽️', title: '메뉴별 매출', sub: '메뉴 랭킹' },
    { key: 'hour', emoji: '🕒', title: '시간대별 매출', sub: '시간대별 매출 흐름' },
    { key: 'payment', emoji: '💳', title: '결제수단별 매출', sub: '카드 · 간편결제 · 쿠폰' },
  ];

  function sumAmount(data) { return data.reduce(function (s, d) { return s + d.amount; }, 0); }

  function summaryCardHtml(label, total) {
    return (
      '<div style="padding:0 var(--space-5) var(--space-4);">' +
        '<div class="summary-card">' +
          '<div class="summary-label">' + label + '</div>' +
          '<div class="summary-value">' + window.UI.formatMoney(total) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function listRowHtml(name, amount, count, extraClass) {
    return (
      '<div class="sales-list-row">' +
        '<div class="sales-list-name">' + window.UI.escapeHtml(name) + '</div>' +
        '<div class="sales-list-right">' +
          (count != null ? '<span class="sales-list-count">' + count + '건</span>' : '') +
          '<span class="sales-list-amount' + (extraClass ? ' ' + extraClass : '') + '">' + window.UI.formatMoney(amount) + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function channelDetailHtml(storeId, range) {
    const data = window.MockApi.getSalesByChannel(storeId, range);
    const total = sumAmount(data);
    const rows = data.map(function (d) { return listRowHtml(d.name, d.amount, d.count); }).join('');
    return (
      summaryCardHtml('합계 매출', total) +
      '<div class="chart-card">' + window.UI.salesChartHtml('channel', data) + '</div>' +
      '<div class="section-title">채널별 상세</div>' +
      '<div class="sales-list">' + rows + '</div>'
    );
  }

  function periodDetailHtml(storeId, range) {
    const data = window.MockApi.getSalesByPeriod(storeId, range);
    const total = sumAmount(data);
    let maxItem = null, minItem = null;
    data.forEach(function (d) {
      if (!maxItem || d.amount > maxItem.amount) maxItem = d;
      if (!minItem || d.amount < minItem.amount) minItem = d;
    });
    const showHighlight = data.length > 1 && maxItem !== minItem;
    const rows = data.map(function (d) {
      let cls = '';
      if (showHighlight && d === maxItem) cls = 'sales-amount-max';
      else if (showHighlight && d === minItem) cls = 'sales-amount-min';
      return listRowHtml(d.name, d.amount, null, cls);
    }).join('');
    return (
      summaryCardHtml('합계 매출', total) +
      '<div class="section-caption">이 화면은 최근 한 달 데이터만 조회할 수 있어요 · 더 자세한 매출 데이터는 사장님 사이트에서 확인해주세요</div>' +
      '<div class="chart-card">' + window.UI.salesChartHtml('period', data) + '</div>' +
      '<div class="section-title">일자별 매출<span class="sales-legend-hint"> · <span class="sales-amount-max">최고</span> / <span class="sales-amount-min">최저</span></span></div>' +
      '<div class="sales-list">' + rows + '</div>'
    );
  }

  function menuDetailHtml(storeId, range) {
    const data = window.MockApi.getSalesByMenu(storeId, range);
    const total = sumAmount(data);
    return (
      summaryCardHtml('합계 매출', total) +
      '<div class="section-title">메뉴별 매출 랭킹</div>' +
      '<div class="chart-card">' + window.UI.salesChartHtml('menu', data) + '</div>'
    );
  }

  function hourDetailHtml(storeId, range) {
    const data = window.MockApi.getSalesByHour(storeId, range);
    const total = sumAmount(data);
    const rows = data.map(function (d) { return listRowHtml(d.name, d.amount, null); }).join('');
    return (
      summaryCardHtml('합계 매출', total) +
      '<div class="chart-card">' + window.UI.salesChartHtml('hour', data) + '</div>' +
      '<div class="section-title">시간대별 상세</div>' +
      '<div class="sales-list">' + rows + '</div>'
    );
  }

  function paymentDetailHtml(storeId, range) {
    const data = window.MockApi.getSalesByPayment(storeId, range);
    const total = sumAmount(data);
    const rows = data.map(function (d) { return listRowHtml(d.name, d.amount, d.count); }).join('');
    return (
      summaryCardHtml('합계 매출', total) +
      '<div class="chart-card">' + window.UI.salesChartHtml('payment', data) + '</div>' +
      '<div class="section-title">결제수단별 상세</div>' +
      '<div class="sales-list">' + rows + '</div>'
    );
  }

  function rangeButtonLabel(range) {
    if (range.preset === 'custom') return (range.start || '').slice(5).replace('-', '.') + ' ~ ' + (range.end || '').slice(5).replace('-', '.');
    return '기간 설정';
  }

  function rangeFilterHtml(range) {
    const presets = [{ key: 'today', label: '당일' }, { key: 'yesterday', label: '전일' }, { key: 'last30', label: '최근 한 달' }];
    return '<div class="date-range-bar" id="sales-range-filter">' +
      presets.map(function (p) {
        return '<button type="button" class="pill-btn' + (range.preset === p.key ? ' active' : '') + '" data-range-preset="' + p.key + '">' + p.label + '</button>';
      }).join('') +
      '<button type="button" class="pill-btn' + (range.preset === 'custom' ? ' active' : '') + '" id="range-custom-btn">' + rangeButtonLabel(range) + '</button>' +
      '</div>';
  }

  function hubCardRowHtml(card) {
    return (
      '<div class="card-list-item" data-detail="' + card.key + '">' +
        '<div class="sales-hub-card-left">' +
          '<span class="sales-hub-emoji">' + card.emoji + '</span>' +
          '<div class="label-group">' +
            '<div class="label-title">' + card.title + '</div>' +
            '<div class="label-sub">' + card.sub + '</div>' +
          '</div>' +
        '</div>' +
        '<span class="chevron">›</span>' +
      '</div>'
    );
  }

  function hubHtml() {
    return (
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="sales-hub-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">매출 조회</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll">' +
        '<div class="section-title">매출 항목을 선택하세요</div>' +
        '<div class="sales-hub-list">' + HUB_CARDS.map(hubCardRowHtml).join('') + '</div>' +
      '</div>'
    );
  }

  function detailHtml(key, range) {
    const meta = HUB_CARDS.filter(function (c) { return c.key === key; })[0] || { title: '매출 조회' };
    const user = window.MockApi.getCurrentUser();
    const storeId = user.storeId;
    let body = '';
    if (key === 'channel') body = channelDetailHtml(storeId, range);
    else if (key === 'period') body = periodDetailHtml(storeId, range);
    else if (key === 'menu') body = menuDetailHtml(storeId, range);
    else if (key === 'hour') body = hourDetailHtml(storeId, range);
    else if (key === 'payment') body = paymentDetailHtml(storeId, range);
    return (
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="sales-detail-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">' + meta.title + '</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll">' + rangeFilterHtml(range) + body + '</div>'
    );
  }

  function openCustomRangeSheet(onApply) {
    const bounds = window.MockApi.getSalesDateBounds();
    const bodyHtml =
      '<div class="sheet-title">기간 설정</div>' +
      '<div class="section-caption" style="padding:0 0 12px;">최근 한 달 이내에서만 선택할 수 있어요</div>' +
      '<div class="input-group"><div class="input-label">시작일</div><input class="input-field" type="date" id="range-start-input" min="' + bounds.min + '" max="' + bounds.max + '" value="' + bounds.min + '" /></div>' +
      '<div class="input-group"><div class="input-label">종료일</div><input class="input-field" type="date" id="range-end-input" min="' + bounds.min + '" max="' + bounds.max + '" value="' + bounds.max + '" /></div>' +
      '<div class="input-error" id="range-error-text" style="display:none;"></div>' +
      '<button type="button" class="btn btn-primary" id="range-apply-btn">적용</button>';
    window.UI.showBottomSheet(bodyHtml, function (host) {
      host.querySelector('#range-apply-btn').addEventListener('click', function () {
        const start = host.querySelector('#range-start-input').value;
        const end = host.querySelector('#range-end-input').value;
        const errEl = host.querySelector('#range-error-text');
        if (!start || !end) { errEl.textContent = '시작일과 종료일을 모두 선택해주세요.'; errEl.style.display = 'block'; return; }
        if (start > end) { errEl.textContent = '시작일은 종료일보다 늦을 수 없어요.'; errEl.style.display = 'block'; return; }
        window.UI.closeModal();
        onApply({ preset: 'custom', start: start, end: end });
      });
    });
  }

  function render() {
    return (
      '<style>' +
      '.sales-hub-list{padding:0 var(--space-5) var(--space-5);display:flex;flex-direction:column;gap:var(--space-2);}' +
      '.sales-hub-card-left{display:flex;align-items:center;gap:12px;flex:1;min-width:0;}' +
      '.sales-hub-emoji{font-size:28px;flex-shrink:0;}' +
      '.sales-list{padding:0 var(--space-5) var(--space-5);display:flex;flex-direction:column;}' +
      '.sales-list-row{display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) 0;border-bottom:1px solid var(--color-divider);}' +
      '.sales-list-row:last-child{border-bottom:none;}' +
      '.sales-list-name{font-size:var(--font-size-body);font-weight:600;}' +
      '.sales-list-right{display:flex;align-items:center;gap:8px;}' +
      '.sales-list-count{font-size:var(--font-size-caption);color:var(--color-text-secondary);}' +
      '.sales-list-amount{font-size:var(--font-size-body);font-weight:700;}' +
      '.sales-amount-max{color:var(--color-accent-green);}' +
      '.sales-amount-min{color:var(--color-accent-red);}' +
      '.sales-legend-hint{font-size:var(--font-size-caption);font-weight:600;}' +
      '</style>' +
      '<div id="sales-view"></div>'
    );
  }

  function mount(root) {
    const view = root.querySelector('#sales-view');

    function bindHub() {
      view.querySelector('#sales-hub-back').addEventListener('click', function () {
        window.Router.back();
      });
      view.querySelectorAll('[data-detail]').forEach(function (el) {
        el.addEventListener('click', function () {
          paintDetail(el.getAttribute('data-detail'));
        });
      });
    }

    function paintHub() {
      view.innerHTML = hubHtml();
      bindHub();
    }

    function paintDetail(key) {
      let range = { preset: 'today' };

      function repaint() {
        view.innerHTML = detailHtml(key, range);
        bindDetail();
      }

      function bindDetail() {
        view.querySelector('#sales-detail-back').addEventListener('click', function () {
          paintHub();
        });
        const filterEl = view.querySelector('#sales-range-filter');
        if (!filterEl) return;
        filterEl.querySelectorAll('[data-range-preset]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            range = { preset: btn.getAttribute('data-range-preset') };
            repaint();
          });
        });
        const customBtn = filterEl.querySelector('#range-custom-btn');
        if (customBtn) {
          customBtn.addEventListener('click', function () {
            openCustomRangeSheet(function (r) { range = r; repaint(); });
          });
        }
      }

      repaint();
    }

    paintHub();
  }

  function unmount() {}

  window.Router.register('sales', { render: render, mount: mount, unmount: unmount });
})();
