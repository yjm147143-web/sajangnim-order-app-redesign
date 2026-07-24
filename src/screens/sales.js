/*
 * 매출 조회 화면 — 실시간 매출현황 / 과거 매출현황 2탭 구조.
 * 두 탭 모두 날짜(또는 오늘)를 탭하면 그 날짜 하나만의 주문방식별/메뉴별/시간대별/결제수단별
 * 매출을 4개 탭으로 볼 수 있는 '날짜별 매출 상세' 화면으로 들어간다.
 * Router 화면 이름은 'sales' 하나만 등록하고, 내부적으로 상태(state)를 바꿔가며
 * 메인(탭)/상세 화면을 그린다. 뒤로가기: 상세 -> 메인, 메인 -> 'settings'
 */
(function () {
  const SUB_TABS = [
    { key: 'channel', label: '주문방식별' },
    { key: 'menu', label: '메뉴별' },
    { key: 'hour', label: '시간대별' },
    { key: 'payment', label: '결제수단별' },
  ];

  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function sumAmount(data) { return data.reduce(function (s, d) { return s + d.amount; }, 0); }

  function listRowHtml(name, amount, count, dateAttr) {
    return (
      '<div class="sales-list-row' + (dateAttr ? ' sales-date-row' : '') + '"' + (dateAttr ? ' data-open-date="' + dateAttr + '"' : '') + '>' +
        '<div class="sales-list-name">' + window.UI.escapeHtml(name) + '</div>' +
        '<div class="sales-list-right">' +
          (count != null ? '<span class="sales-list-count">' + count + '건</span>' : '') +
          '<span class="sales-list-amount">' + window.UI.formatMoney(amount) + '</span>' +
          (dateAttr ? '<span class="chevron">›</span>' : '') +
        '</div>' +
      '</div>'
    );
  }

  // ---------------- 4개 세부 항목별 본문 (날짜별 매출 상세 화면의 각 탭에서 재사용) ----------------
  function channelDetailHtml(storeId, range) {
    const data = window.MockApi.getSalesByChannel(storeId, range);
    const total = sumAmount(data);
    const rows = data.map(function (d) { return listRowHtml(d.name, d.amount, d.count); }).join('');
    return (
      '<div class="section-caption">합계 매출 ' + window.UI.formatMoney(total) + '</div>' +
      '<div class="chart-card">' + window.UI.salesChartHtml('channel', data) + '</div>' +
      '<div class="sales-list">' + rows + '</div>'
    );
  }

  function menuDetailHtml(storeId, range) {
    const data = window.MockApi.getSalesByMenu(storeId, range);
    const total = sumAmount(data);
    const rows = data.map(function (d) { return listRowHtml(d.name, d.amount, d.qty); }).join('');
    return (
      '<div class="section-caption">합계 매출 ' + window.UI.formatMoney(total) + '</div>' +
      '<div class="chart-card">' + window.UI.salesChartHtml('menu', data) + '</div>' +
      '<div class="sales-list">' + rows + '</div>'
    );
  }

  function hourDetailHtml(storeId, range) {
    const data = window.MockApi.getSalesByHour(storeId, range);
    const total = sumAmount(data);
    const rows = data.map(function (d) { return listRowHtml(d.name, d.amount, d.count); }).join('');
    return (
      '<div class="section-caption">합계 매출 ' + window.UI.formatMoney(total) + '</div>' +
      '<div class="chart-card">' + window.UI.salesChartHtml('hour', data) + '</div>' +
      '<div class="sales-list">' + rows + '</div>'
    );
  }

  function paymentDetailHtml(storeId, range) {
    const data = window.MockApi.getSalesByPayment(storeId, range);
    const total = sumAmount(data);
    const rows = data.map(function (d) { return listRowHtml(d.name, d.amount, d.count); }).join('');
    return (
      '<div class="section-caption">합계 매출 ' + window.UI.formatMoney(total) + '</div>' +
      '<div class="chart-card">' + window.UI.salesChartHtml('payment', data) + '</div>' +
      '<div class="sales-list">' + rows + '</div>'
    );
  }

  function subTabBodyHtml(key, storeId, range) {
    if (key === 'menu') return menuDetailHtml(storeId, range);
    if (key === 'hour') return hourDetailHtml(storeId, range);
    if (key === 'payment') return paymentDetailHtml(storeId, range);
    return channelDetailHtml(storeId, range);
  }

  // ---------------- 기간 필터 (과거 매출현황 탭 전용) ----------------
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

  // ---------------- 상단 3개 요약 지표 (실시간/과거 탭 공용) ----------------
  function metricGridHtml(summary) {
    return (
      '<div class="sales-metric-grid">' +
        '<div class="sales-metric-card"><div class="sales-metric-label">총 주문건수</div><div class="sales-metric-value">' + summary.totalOrderCount.toLocaleString('ko-KR') + '건</div></div>' +
        '<div class="sales-metric-card"><div class="sales-metric-label">총 매출액</div><div class="sales-metric-value accent">' + window.UI.formatMoney(summary.totalAmount) + '</div></div>' +
        '<div class="sales-metric-card"><div class="sales-metric-label">주문단가</div><div class="sales-metric-value">' + window.UI.formatMoney(summary.avgOrderValue) + '</div></div>' +
      '</div>'
    );
  }

  // ---------------- 메인 화면: 실시간 매출현황 / 과거 매출현황 2탭 ----------------
  function tabSwitchHtml(activeTab) {
    return (
      '<div class="sales-tab-switch">' +
        '<button type="button" class="sales-tab-btn' + (activeTab === 'live' ? ' active' : '') + '" data-sales-tab="live">실시간 매출현황</button>' +
        '<button type="button" class="sales-tab-btn' + (activeTab === 'past' ? ' active' : '') + '" data-sales-tab="past">과거 매출현황</button>' +
      '</div>'
    );
  }

  function liveTabHtml(storeId) {
    const today = todayStr();
    const summary = window.MockApi.getSalesSummary(storeId, { preset: 'today' });
    return (
      metricGridHtml(summary) +
      '<div class="sales-today-row sales-date-row" data-open-date="' + today + '">' +
        '<span>오늘 (' + today.slice(5).replace('-', '.') + ') 상세 보기</span><span class="chevron">›</span>' +
      '</div>'
    );
  }

  function pastTabHtml(storeId, range) {
    const summary = window.MockApi.getSalesSummary(storeId, range);
    const periodData = window.MockApi.getSalesByPeriod(storeId, range);
    const rows = periodData.length
      ? periodData.map(function (d) { return listRowHtml(d.name, d.amount, d.count, d.date); }).join('')
      : '<div class="empty-state"><div class="empty-state-emoji">📭</div><div>해당 기간의 매출이 없어요</div></div>';
    return (
      rangeFilterHtml(range) +
      metricGridHtml(summary) +
      '<div class="section-caption">이 화면은 최근 한 달 데이터만 조회할 수 있어요 · 더 자세한 매출 데이터는 사장님사이트에서 확인해주세요</div>' +
      '<div class="chart-card">' + window.UI.salesChartHtml('period', periodData) + '</div>' +
      '<div class="section-title">일자별 매출</div>' +
      '<div class="sales-list">' + rows + '</div>'
    );
  }

  function mainHtml(activeTab, storeId, pastRange) {
    return (
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="sales-main-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">매출 조회</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      tabSwitchHtml(activeTab) +
      '<div class="screen-scroll">' + (activeTab === 'live' ? liveTabHtml(storeId) : pastTabHtml(storeId, pastRange)) + '</div>'
    );
  }

  // ---------------- 날짜별 매출 상세 화면 (4탭) ----------------
  function subTabSwitchHtml(activeSub) {
    return '<div class="sales-subtab-row">' + SUB_TABS.map(function (t) {
      return '<button type="button" class="sales-subtab-btn' + (activeSub === t.key ? ' active' : '') + '" data-sales-subtab="' + t.key + '">' + t.label + '</button>';
    }).join('') + '</div>';
  }

  function dateDetailHtml(date, subKey, storeId) {
    const dayRange = { preset: 'custom', start: date, end: date };
    const summary = window.MockApi.getSalesSummary(storeId, dayRange);
    return (
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="sales-detail-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">날짜별 매출 상세</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll">' +
        '<div class="sales-detail-date">' + date.replace(/-/g, '.') + '</div>' +
        '<div class="sales-detail-sub">' + summary.totalOrderCount.toLocaleString('ko-KR') + '건 · ' + window.UI.formatMoney(summary.totalAmount) + '</div>' +
        subTabSwitchHtml(subKey) +
        subTabBodyHtml(subKey, storeId, dayRange) +
      '</div>'
    );
  }

  function render() {
    return (
      '<style>' +
      '.sales-tab-switch{display:flex;padding:0 var(--space-5);margin-bottom:var(--space-3);}' +
      '.sales-tab-btn{flex:1;text-align:center;padding:12px 0;background:none;border:none;border-bottom:2.5px solid var(--color-divider);' +
        'font-size:var(--font-size-caption);font-weight:700;color:var(--color-text-secondary);cursor:pointer;}' +
      '.sales-tab-btn.active{border-bottom-color:var(--color-text-primary);color:var(--color-text-primary);}' +
      '.sales-metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 var(--space-5) var(--space-4);}' +
      '.sales-metric-card{background:var(--color-card-bg);border-radius:var(--radius-card);padding:10px 8px;}' +
      '.sales-metric-label{font-size:var(--font-size-micro);font-weight:700;color:var(--color-text-secondary);margin-bottom:4px;}' +
      '.sales-metric-value{font-size:14px;font-weight:800;color:var(--color-text-primary);word-break:keep-all;}' +
      '.sales-metric-value.accent{color:var(--color-accent-blue);}' +
      '.sales-today-row{display:flex;align-items:center;justify-content:space-between;margin:0 var(--space-5) var(--space-4);' +
        'padding:14px;border-radius:var(--radius-card);background:var(--color-card-bg);font-size:var(--font-size-body);font-weight:700;color:var(--color-accent-blue);cursor:pointer;}' +
      '.sales-list{padding:0 var(--space-5) var(--space-5);display:flex;flex-direction:column;}' +
      '.sales-list-row{display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) 0;border-bottom:1px solid var(--color-divider);}' +
      '.sales-list-row:last-child{border-bottom:none;}' +
      '.sales-date-row{cursor:pointer;}' +
      '.sales-list-name{font-size:var(--font-size-body);font-weight:600;}' +
      '.sales-list-right{display:flex;align-items:center;gap:8px;}' +
      '.sales-list-count{font-size:var(--font-size-caption);color:var(--color-text-secondary);}' +
      '.sales-list-amount{font-size:var(--font-size-body);font-weight:700;}' +
      '.sales-detail-date{text-align:center;font-size:var(--font-size-subtitle);font-weight:800;color:var(--color-text-primary);padding:var(--space-4) var(--space-5) 2px;}' +
      '.sales-detail-sub{text-align:center;font-size:var(--font-size-caption);color:var(--color-text-secondary);padding-bottom:var(--space-4);}' +
      '.sales-subtab-row{display:flex;gap:5px;padding:0 var(--space-5) var(--space-4);flex-wrap:wrap;}' +
      '.sales-subtab-btn{flex:1;min-width:70px;text-align:center;padding:9px 0;border:none;border-radius:10px;background:var(--color-card-bg);' +
        'color:var(--color-text-secondary);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;}' +
      '.sales-subtab-btn.active{background:var(--color-text-primary);color:var(--color-white);}' +
      '</style>' +
      '<div id="sales-view"></div>'
    );
  }

  function mount(root) {
    const view = root.querySelector('#sales-view');
    const user = window.MockApi.getCurrentUser();
    const storeId = user.storeId;

    let activeTab = 'live';
    let pastRange = { preset: 'today' };
    let detailDate = null;
    let detailSubTab = 'channel';

    function paintMain() {
      view.innerHTML = mainHtml(activeTab, storeId, pastRange);
      bindMain();
    }

    function bindMain() {
      view.querySelector('#sales-main-back').addEventListener('click', function () {
        window.Router.back();
      });
      view.querySelectorAll('[data-sales-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          activeTab = btn.getAttribute('data-sales-tab');
          paintMain();
        });
      });
      view.querySelectorAll('[data-open-date]').forEach(function (el) {
        el.addEventListener('click', function () {
          openDetail(el.getAttribute('data-open-date'));
        });
      });
      const filterEl = view.querySelector('#sales-range-filter');
      if (!filterEl) return;
      filterEl.querySelectorAll('[data-range-preset]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          pastRange = { preset: btn.getAttribute('data-range-preset') };
          paintMain();
        });
      });
      const customBtn = filterEl.querySelector('#range-custom-btn');
      if (customBtn) {
        customBtn.addEventListener('click', function () {
          openCustomRangeSheet(function (r) { pastRange = r; paintMain(); });
        });
      }
    }

    function openDetail(date) {
      detailDate = date;
      detailSubTab = 'channel';
      paintDetail();
    }

    function paintDetail() {
      view.innerHTML = dateDetailHtml(detailDate, detailSubTab, storeId);
      bindDetail();
    }

    function bindDetail() {
      view.querySelector('#sales-detail-back').addEventListener('click', function () {
        paintMain();
      });
      view.querySelectorAll('[data-sales-subtab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          detailSubTab = btn.getAttribute('data-sales-subtab');
          paintDetail();
        });
      });
    }

    paintMain();
  }

  function unmount() {}

  window.Router.register('sales', { render: render, mount: mount, unmount: unmount });
})();
