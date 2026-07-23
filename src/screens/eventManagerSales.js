/*
 * 행사 담당자 — 매출 현황 화면
 * 상단 요약 + 매장별 매출 랭킹 + 상세 매출(카드형 허브 → 상세, 사장님 앱 패턴 재현)
 */
(function () {
  const DETAIL_CARDS = [
    { key: 'store', icon: '🏪', label: '매장별 매출' },
    { key: 'period', icon: '📅', label: '기간별 매출' },
    { key: 'menu', icon: '🍽️', label: '메뉴별 매출' },
    { key: 'hour', icon: '🕒', label: '시간대별 매출' },
    { key: 'channel', icon: '🧾', label: '주문 방식별 매출' },
    { key: 'payment', icon: '💳', label: '결제수단별 매출' },
  ];

  const PERIOD_PRESETS = [{ key: 'today', label: '당일' }, { key: 'yesterday', label: '전일' }, { key: 'eventPeriod', label: '행사일' }];

  function computeChannelRatio(eventId) {
    const rows = window.MockApi.getEventSalesByChannel(eventId);
    const total = rows.reduce(function (s, r) { return s + r.amount; }, 0) || 1;
    return rows.map(function (r) { return { name: r.name, amount: r.amount, pct: Math.round((r.amount / total) * 100) }; });
  }

  function emptyHtml() {
    return '<div class="empty-state"><div class="empty-state-emoji">📭</div><div>데이터가 없어요</div></div>';
  }

  function listRowHtml(name, amount, extraClass) {
    return (
      '<div class="sales-list-row">' +
        '<div class="sales-list-name">' + window.UI.escapeHtml(name) + '</div>' +
        '<span class="sales-list-amount' + (extraClass ? ' ' + extraClass : '') + '">' + window.UI.formatMoney(amount) + '</span>' +
      '</div>'
    );
  }

  function periodFilterHtml(preset) {
    return '<div class="date-range-bar" id="detail-period-filter">' + PERIOD_PRESETS.map(function (o) {
      return '<button type="button" class="pill-btn' + (preset === o.key ? ' active' : '') + '" data-preset="' + o.key + '">' + o.label + '</button>';
    }).join('') + '</div>';
  }

  function storeRankingHtml(eventId) {
    const esc = window.UI.escapeHtml;
    const data = window.MockApi.getEventStoreSalesRanking(eventId);
    if (!data.length) return emptyHtml();
    const max = Math.max(1, Math.max.apply(null, data.map(function (d) { return d.amount; })));
    return '<div class="section-caption">오늘 매출 기준 · 높은 순</div><div class="rank-list">' + data.map(function (d, i) {
      const pct = Math.round((d.amount / max) * 100);
      return '<div class="rank-row">' +
        '<div class="rank-index">' + (i + 1) + '</div>' +
        '<div class="rank-body">' +
        '<div class="rank-name-row"><span>' + esc(d.name) + '</span><span>' + window.UI.formatMoney(d.amount) + '</span></div>' +
        '<div class="rank-bar-track"><div class="rank-bar-fill' + (i === 0 ? ' max' : '') + '" style="width:' + pct + '%"></div></div>' +
        (d.topMenuName ? '<div class="rank-sub">베스트 메뉴 · ' + esc(d.topMenuName) + (d.topMenuQty ? ' ' + d.topMenuQty + '개' : '') + '</div>' : '') +
        '</div></div>';
    }).join('') + '</div>';
  }

  function renderDetailBody(key, eventId, preset) {
    if (key === 'store') {
      return '<div class="chart-card">' + storeRankingHtml(eventId) + '</div>';
    }
    if (key === 'period') {
      const data = window.MockApi.getEventSalesByPeriod(eventId, preset);
      if (!data.length) return periodFilterHtml(preset) + '<div id="detail-chart-slot">' + emptyHtml() + '</div>';
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
        return listRowHtml(d.name, d.amount, cls);
      }).join('');
      return periodFilterHtml(preset) + '<div id="detail-chart-slot">' +
        '<div class="chart-card">' + window.UI.barChartHtml(data) + '</div>' +
        '<div class="section-title">일자별 매출<span class="sales-legend-hint"> · <span class="sales-amount-max">최고</span> / <span class="sales-amount-min">최저</span></span></div>' +
        '<div class="sales-list">' + rows + '</div>' +
      '</div>';
    }
    if (key === 'menu') {
      const data = window.MockApi.getEventSalesByMenu(eventId);
      return data.length ? '<div class="chart-card">' + window.UI.rankListHtml(data) + '</div>' : emptyHtml();
    }
    if (key === 'hour') {
      const data = window.MockApi.getEventSalesByHour(eventId);
      if (!data.length) return emptyHtml();
      const rows = data.map(function (d) { return listRowHtml(d.name, d.amount); }).join('');
      return '<div class="chart-card">' + window.UI.barChartHtml(data) + '</div>' +
        '<div class="section-title">시간대별 상세</div>' +
        '<div class="sales-list">' + rows + '</div>';
    }
    if (key === 'channel') {
      const data = window.MockApi.getEventSalesByChannel(eventId).slice().sort(function (a, b) { return b.amount - a.amount; });
      return data.length ? '<div class="chart-card">' + window.UI.donutChartHtml(data) + '</div>' : emptyHtml();
    }
    if (key === 'payment') {
      const data = window.MockApi.getEventSalesByPayment(eventId, preset).slice().sort(function (a, b) { return b.amount - a.amount; });
      return periodFilterHtml(preset) + '<div id="detail-chart-slot">' + (data.length ? '<div class="chart-card">' + window.UI.donutChartHtml(data) + '</div>' : emptyHtml()) + '</div>';
    }
    return '';
  }

  function render(params) {
    const esc = window.UI.escapeHtml;
    const eventId = params.eventId;
    const summary = window.MockApi.getEventDashboardSummary(eventId);
    const channelRatio = computeChannelRatio(eventId);

    const channelRatioText = channelRatio.map(function (c) { return esc(c.name) + ' ' + c.pct + '%'; }).join(' · ');

    const detailListHtml = DETAIL_CARDS.map(function (d) {
      return (
        '<div class="card-list-item" data-detail-key="' + d.key + '" data-detail-label="' + esc(d.label) + '">' +
          '<div class="label-group"><span class="label-title">' + d.icon + ' ' + esc(d.label) + '</span></div>' +
          '<span class="chevron">›</span>' +
        '</div>'
      );
    }).join('');

    return (
      '<style>' +
        '.sales-detail-overlay{position:absolute;inset:0;background:var(--color-bg);z-index:60;display:none;flex-direction:column;}' +
        '.sales-detail-overlay.show{display:flex;}' +
        '.channel-ratio-row{padding:0 20px 20px;font-size:var(--font-size-caption);color:var(--color-text-secondary);font-weight:700;}' +
        '.sales-list{padding:0 var(--space-5) var(--space-5);display:flex;flex-direction:column;}' +
        '.sales-list-row{display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) 0;border-bottom:1px solid var(--color-divider);}' +
        '.sales-list-row:last-child{border-bottom:none;}' +
        '.sales-list-name{font-size:var(--font-size-body);font-weight:600;}' +
        '.sales-list-amount{font-size:var(--font-size-body);font-weight:700;}' +
        '.sales-amount-max{color:var(--color-accent-green);}' +
        '.sales-amount-min{color:var(--color-accent-red);}' +
        '.sales-legend-hint{font-size:var(--font-size-caption);font-weight:600;}' +
      '</style>' +
      '<div class="topbar"><div class="topbar-side"></div><div class="topbar-title">매출 현황</div><div class="topbar-side"></div></div>' +
      '<div class="screen-scroll">' +

        '<div class="section-title">매출 요약</div>' +
        '<div class="summary-grid" style="padding-bottom:8px;">' +
          '<div class="summary-card"><span class="summary-label">누적 매출</span><span class="summary-value">' + window.UI.formatMoney(summary.totalAmount) + '</span></div>' +
          '<div class="summary-card"><span class="summary-label">오늘 매출</span><span class="summary-value">' + window.UI.formatMoney(summary.todayAmount) + '</span></div>' +
          '<div class="summary-card"><span class="summary-label">참여 매장 수</span><span class="summary-value">' + summary.storeCount + '개</span></div>' +
          '<div class="summary-card"><span class="summary-label">매장당 평균(오늘)</span><span class="summary-value">' + window.UI.formatMoney(summary.avgPerStoreToday) + '</span></div>' +
          '<div class="summary-card"><span class="summary-label">매장당 평균(누적)</span><span class="summary-value">' + window.UI.formatMoney(summary.avgPerStoreTotal) + '</span></div>' +
        '</div>' +
        '<div class="channel-ratio-row">주문경로 비중 · ' + channelRatioText + '</div>' +

        '<div class="section-title">상세 매출</div>' +
        '<div style="padding:0 20px 24px;display:flex;flex-direction:column;gap:12px;">' + detailListHtml + '</div>' +

      '</div>' +
      window.EventManagerShell.tabbarHtml('eventManagerSales') +

      '<div class="sales-detail-overlay" id="sales-detail-overlay">' +
        '<div class="topbar"><div class="topbar-side"><button type="button" class="icon-btn" id="detail-back">←</button></div><div class="topbar-title" id="detail-title"></div><div class="topbar-side"></div></div>' +
        '<div class="screen-scroll" id="detail-body"></div>' +
      '</div>'
    );
  }

  function mount(root, params) {
    const eventId = params.eventId;
    window.EventManagerShell.attachTabbar(root, 'eventManagerSales', eventId);

    const overlay = root.querySelector('#sales-detail-overlay');
    const backBtn = root.querySelector('#detail-back');
    const titleEl = root.querySelector('#detail-title');
    const bodyEl = root.querySelector('#detail-body');
    let currentPreset = 'today';

    function paintDetail(key, label) {
      bodyEl.innerHTML = renderDetailBody(key, eventId, currentPreset);
      const filterEl = bodyEl.querySelector('#detail-period-filter');
      if (filterEl) {
        filterEl.querySelectorAll('[data-preset]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            currentPreset = btn.getAttribute('data-preset');
            paintDetail(key, label);
          });
        });
      }
    }

    root.querySelectorAll('[data-detail-key]').forEach(function (el) {
      el.addEventListener('click', function () {
        const key = el.getAttribute('data-detail-key');
        const label = el.getAttribute('data-detail-label');
        currentPreset = 'today';
        titleEl.textContent = label;
        paintDetail(key, label);
        overlay.classList.add('show');
      });
    });

    if (backBtn) backBtn.addEventListener('click', function () { overlay.classList.remove('show'); });
  }

  function unmount() {}

  window.Router.register('eventManagerSales', { render: render, mount: mount, unmount: unmount });
})();
