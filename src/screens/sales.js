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
  const OWNER_SITE_URL = 'https://dev-admin.qrorder.ai.kr/home';

  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function sumAmount(data) { return data.reduce(function (s, d) { return s + d.amount; }, 0); }

  function listRowHtml(name, amount, count, dateAttr, extraClass, nameBadgeHtml) {
    return (
      '<div class="sales-list-row' + (dateAttr ? ' sales-date-row' : '') + '"' + (dateAttr ? ' data-open-date="' + dateAttr + '"' : '') + '>' +
        '<div class="sales-list-name">' + window.UI.escapeHtml(name) + (nameBadgeHtml || '') + '</div>' +
        '<div class="sales-list-right">' +
          (count != null ? '<span class="sales-list-count">' + count + '건</span>' : '') +
          '<span class="sales-list-amount' + (extraClass ? ' ' + extraClass : '') + '">' + window.UI.formatMoney(amount) + '</span>' +
          (dateAttr ? '<span class="chevron">›</span>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function sortToggleHtml(key, dir) {
    const label = dir === 'asc' ? '오름차순' : '내림차순';
    return '<div class="sales-sort-row"><button type="button" class="pill-btn" data-sales-sort-key="' + key + '">' + label + ' ▾</button></div>';
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

  // 메뉴별 매출은 전체 메뉴를 순위(랭킹)로만 보여준다 — rankListHtml 자체가 이미 전체 목록 +
  // 순번 + 막대이므로, 별도의 flat 리스트를 아래에 중복으로 두지 않는다.
  function menuDetailHtml(storeId, range, sortDir) {
    const raw = window.MockApi.getSalesByMenu(storeId, range);
    const data = raw.slice().sort(function (a, b) { return sortDir === 'asc' ? a.amount - b.amount : b.amount - a.amount; });
    const total = sumAmount(data);
    return (
      '<div class="section-caption">합계 매출 ' + window.UI.formatMoney(total) + '</div>' +
      sortToggleHtml('menu', sortDir) +
      '<div class="chart-card">' + window.UI.rankListHtml(data) + '</div>'
    );
  }

  // 그래프는 시간 흐름을 보여줘야 하니 항상 시간순으로 고정하고, 정렬 토글은 아래 목록에만 적용한다.
  // 매출이 가장 높은 시간대에는 '피크' 배지를 붙인다.
  function hourDetailHtml(storeId, range, sortDir) {
    const data = window.MockApi.getSalesByHour(storeId, range);
    const total = sumAmount(data);
    let peakItem = null;
    data.forEach(function (d) { if (d.amount > 0 && (!peakItem || d.amount > peakItem.amount)) peakItem = d; });
    const sorted = data.slice().sort(function (a, b) { return sortDir === 'asc' ? a.amount - b.amount : b.amount - a.amount; });
    const rows = sorted.map(function (d) {
      const badge = (peakItem && d === peakItem) ? ' <span class="badge badge-warning-soft">피크</span>' : '';
      return listRowHtml(d.name, d.amount, d.count, null, '', badge);
    }).join('');
    return (
      '<div class="section-caption">합계 매출 ' + window.UI.formatMoney(total) + '</div>' +
      '<div class="chart-card">' + window.UI.salesChartHtml('hour', data) + '</div>' +
      sortToggleHtml('hour', sortDir) +
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

  function subTabBodyHtml(key, storeId, range, sortDirByKey) {
    sortDirByKey = sortDirByKey || {};
    if (key === 'menu') return menuDetailHtml(storeId, range, sortDirByKey.menu || 'desc');
    if (key === 'hour') return hourDetailHtml(storeId, range, sortDirByKey.hour || 'desc');
    if (key === 'payment') return paymentDetailHtml(storeId, range);
    return channelDetailHtml(storeId, range);
  }

  // ---------------- 기간 필터 (과거 매출현황 탭 전용) ----------------
  function rangeButtonLabel(range) {
    if (range.preset === 'custom') return (range.start || '').slice(5).replace('-', '.') + ' ~ ' + (range.end || '').slice(5).replace('-', '.');
    return '기간 설정';
  }

  function rangeFilterHtml(range) {
    const presets = [{ key: 'yesterday', label: '전일' }, { key: 'last30', label: '최근 한 달' }];
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

  function liveTabHtml(storeId, liveSubTab, sortDirByKey) {
    const today = todayStr();
    const todayRange = { preset: 'today' };
    const summary = window.MockApi.getSalesSummary(storeId, todayRange);
    return (
      metricGridHtml(summary) +
      '<div class="sales-detail-date">' + today.replace(/-/g, '.') + '</div>' +
      subTabSwitchHtml(liveSubTab) +
      subTabBodyHtml(liveSubTab, storeId, todayRange, sortDirByKey)
    );
  }

  function pastTabHtml(storeId, range) {
    const summary = window.MockApi.getSalesSummary(storeId, range);
    const periodData = window.MockApi.getSalesByPeriod(storeId, range);
    let maxItem = null, minItem = null;
    periodData.forEach(function (d) {
      if (!maxItem || d.amount > maxItem.amount) maxItem = d;
      if (!minItem || d.amount < minItem.amount) minItem = d;
    });
    const showHighlight = periodData.length > 1 && maxItem !== minItem;
    const rows = periodData.length
      ? periodData.map(function (d) {
          let cls = '', badge = '';
          if (showHighlight && d === maxItem) { cls = 'sales-amount-max'; badge = ' <span class="badge badge-success-soft">최고</span>'; }
          else if (showHighlight && d === minItem) { cls = 'sales-amount-min'; badge = ' <span class="badge badge-danger-soft">최저</span>'; }
          return listRowHtml(d.name, d.amount, d.count, d.date, cls, badge);
        }).join('')
      : '<div class="empty-state"><div class="empty-state-emoji">📭</div><div>해당 기간의 매출이 없어요</div></div>';
    return (
      rangeFilterHtml(range) +
      metricGridHtml(summary) +
      '<div class="section-caption sales-site-caption">최근 한 달 데이터만 조회할 수 있어요.<br />더 자세한 매출 데이터는 사장님사이트에서 확인해 주세요. ' +
        '<a href="' + OWNER_SITE_URL + '" target="_blank" rel="noopener" class="sales-site-link">이동하기</a></div>' +
      '<div class="chart-card">' + window.UI.salesChartHtml('period', periodData) + '</div>' +
      '<div class="section-title">일자별 매출' + (showHighlight ? '<span class="sales-legend-hint"> · <span class="sales-amount-max">최고</span> / <span class="sales-amount-min">최저</span></span>' : '') + '</div>' +
      '<div class="sales-list">' + rows + '</div>'
    );
  }

  function mainHtml(activeTab, storeId, pastRange, liveSubTab, sortDirByKey) {
    return (
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="sales-main-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">매출 조회</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      tabSwitchHtml(activeTab) +
      '<div class="screen-scroll">' + (activeTab === 'live' ? liveTabHtml(storeId, liveSubTab, sortDirByKey) : pastTabHtml(storeId, pastRange)) + '</div>'
    );
  }

  // ---------------- 날짜별 매출 상세 화면 (4탭) ----------------
  function subTabSwitchHtml(activeSub) {
    return '<div class="sales-subtab-row">' + SUB_TABS.map(function (t) {
      return '<button type="button" class="sales-subtab-btn' + (activeSub === t.key ? ' active' : '') + '" data-sales-subtab="' + t.key + '">' + t.label + '</button>';
    }).join('') + '</div>';
  }

  function dateDetailHtml(date, subKey, storeId, sortDirByKey) {
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
        subTabBodyHtml(subKey, storeId, dayRange, sortDirByKey) +
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
      '.sales-metric-card{background:var(--color-card-bg);border-radius:var(--radius-card);padding:12px 8px;text-align:center;}' +
      '.sales-metric-label{font-size:12px;font-weight:700;color:var(--color-text-secondary);margin-bottom:5px;}' +
      '.sales-metric-value{font-size:20px;font-weight:800;color:var(--color-text-primary);word-break:keep-all;}' +
      '.sales-metric-value.accent{color:var(--color-accent-blue);}' +
      '.sales-list{padding:0 var(--space-5) var(--space-5);display:flex;flex-direction:column;}' +
      '.sales-list-row{display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) 0;border-bottom:1px solid var(--color-divider);}' +
      '.sales-list-row:last-child{border-bottom:none;}' +
      '.sales-date-row{cursor:pointer;}' +
      '.sales-list-name{font-size:var(--font-size-body);font-weight:600;}' +
      '.sales-list-right{display:flex;align-items:center;gap:8px;}' +
      '.sales-list-count{font-size:var(--font-size-caption);color:var(--color-text-secondary);}' +
      '.sales-list-amount{font-size:var(--font-size-body);font-weight:700;}' +
      '.sales-amount-max{color:var(--color-accent-green);}' +
      '.sales-amount-min{color:var(--color-accent-red);}' +
      '.sales-legend-hint{font-size:var(--font-size-caption);font-weight:600;}' +
      '.sales-detail-date{text-align:center;font-size:var(--font-size-subtitle);font-weight:800;color:var(--color-text-primary);padding:var(--space-4) var(--space-5) 2px;}' +
      '.sales-detail-sub{text-align:center;font-size:var(--font-size-caption);color:var(--color-text-secondary);padding-bottom:var(--space-4);}' +
      '.sales-subtab-row{display:flex;gap:5px;padding:0 var(--space-5) var(--space-4);flex-wrap:wrap;}' +
      '.sales-subtab-btn{flex:1;min-width:70px;text-align:center;padding:9px 0;border:none;border-radius:10px;background:var(--color-card-bg);' +
        'color:var(--color-text-secondary);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;}' +
      '.sales-subtab-btn.active{background:var(--color-text-primary);color:var(--color-white);}' +
      '.sales-sort-row{display:flex;justify-content:flex-end;padding:0 var(--space-5) var(--space-3);}' +
      '.sales-site-caption{line-height:1.6;}' +
      '.sales-site-link{color:var(--color-accent-blue);font-weight:700;}' +
      '</style>' +
      '<div id="sales-view"></div>'
    );
  }

  function mount(root) {
    const view = root.querySelector('#sales-view');
    const storeId = window.MockApi.getContextStoreId();

    let activeTab = 'live';
    let pastRange = { preset: 'yesterday' };
    let liveSubTab = 'channel';
    let sortDirByKey = { menu: 'desc', hour: 'desc' };
    let detailDate = null;
    let detailSubTab = 'channel';

    function paintMain() {
      view.innerHTML = mainHtml(activeTab, storeId, pastRange, liveSubTab, sortDirByKey);
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
      if (activeTab === 'live') {
        view.querySelectorAll('[data-sales-subtab]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            liveSubTab = btn.getAttribute('data-sales-subtab');
            paintMain();
          });
        });
        view.querySelectorAll('[data-sales-sort-key]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const k = btn.getAttribute('data-sales-sort-key');
            sortDirByKey[k] = sortDirByKey[k] === 'asc' ? 'desc' : 'asc';
            paintMain();
          });
        });
      }
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
      view.innerHTML = dateDetailHtml(detailDate, detailSubTab, storeId, sortDirByKey);
      bindDetail();
    }

    function bindDetail() {
      view.querySelector('#sales-detail-back').addEventListener('click', function () {
        paintMain();
      });
      view.querySelectorAll('[data-sales-sort-key]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const k = btn.getAttribute('data-sales-sort-key');
          sortDirByKey[k] = sortDirByKey[k] === 'asc' ? 'desc' : 'asc';
          paintDetail();
        });
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
