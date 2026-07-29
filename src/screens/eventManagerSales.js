/*
 * 행사 담당자 — 매출 현황 화면
 * 사장님 보드의 매출 조회(sales.js)와 동일한 UI/UX: 실시간 매출현황 / 과거 매출현황 2탭 구조.
 * 실시간 탭은 오늘 하루 고정, 과거 탭은 전일/행사일/기간설정 필터로 날짜(구간)를 고른다.
 * 두 탭 모두 날짜를 탭하면 그 날짜 하나만의 매장별/메뉴별/시간대별/주문방식별/결제수단별
 * 매출을 5개 탭으로 볼 수 있는 '날짜별 매출 상세' 화면으로 들어간다.
 * 사장님 보드와 달리 매장이 여러 개라 '매장별' 탭이 추가되고, 사장님 사이트 링크 안내는
 * 행사 담당자 role과 맞지 않아 넣지 않는다.
 */
(function () {
  const SUB_TABS = [
    { key: 'store', label: '매장별' },
    { key: 'menu', label: '메뉴별' },
    { key: 'hour', label: '시간대별' },
    { key: 'channel', label: '주문방식별' },
    { key: 'payment', label: '결제수단별' },
  ];

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

  // ---------------- 5개 세부 항목별 본문 (날짜별 매출 상세 화면의 각 탭에서 재사용) ----------------
  // 매장별 매출은 사장님 보드에는 없는, 행사담당자 전용 항목이다(매장이 여럿이라 랭킹으로 비교).
  function storeDetailHtml(eventId, range, sortDir) {
    const raw = window.MockApi.getEventStoreSalesRanking(eventId, range);
    const data = raw.slice().sort(function (a, b) { return sortDir === 'asc' ? a.amount - b.amount : b.amount - a.amount; });
    const total = sumAmount(data);
    return (
      '<div class="section-caption">총 매출액 ' + window.UI.formatMoney(total) + '</div>' +
      sortToggleHtml('store', sortDir) +
      '<div class="chart-card">' + window.UI.rankListHtml(data) + '</div>'
    );
  }

  // 메뉴별 매출은 전체 메뉴를 순위(랭킹)로만 보여준다 — 사장님 보드와 동일하게 상위 N개로 자르지 않는다.
  function menuDetailHtml(eventId, range, sortDir) {
    const raw = window.MockApi.getEventSalesByMenu(eventId, range);
    const data = raw.slice().sort(function (a, b) { return sortDir === 'asc' ? a.amount - b.amount : b.amount - a.amount; });
    const total = sumAmount(data);
    return (
      '<div class="section-caption">총 매출액 ' + window.UI.formatMoney(total) + '</div>' +
      sortToggleHtml('menu', sortDir) +
      '<div class="chart-card">' + window.UI.rankListHtml(data) + '</div>'
    );
  }

  // 그래프는 시간 흐름을 보여줘야 하니 항상 시간순으로 고정하고, 정렬 토글은 아래 목록에만 적용한다.
  function hourDetailHtml(eventId, range, sortDir) {
    const data = window.MockApi.getEventSalesByHour(eventId, range);
    const total = sumAmount(data);
    let peakItem = null;
    data.forEach(function (d) { if (d.amount > 0 && (!peakItem || d.amount > peakItem.amount)) peakItem = d; });
    const sorted = data.slice().sort(function (a, b) { return sortDir === 'asc' ? a.amount - b.amount : b.amount - a.amount; });
    const rows = sorted.map(function (d) {
      const badge = (peakItem && d === peakItem) ? ' <span class="badge badge-warning-soft">피크</span>' : '';
      return listRowHtml(d.name, d.amount, null, null, '', badge);
    }).join('');
    return (
      '<div class="section-caption">총 매출액 ' + window.UI.formatMoney(total) + '</div>' +
      '<div class="chart-card">' + window.UI.salesChartHtml('hour', data) + '</div>' +
      sortToggleHtml('hour', sortDir) +
      '<div class="sales-list">' + rows + '</div>'
    );
  }

  function channelDetailHtml(eventId, range) {
    const data = window.MockApi.getEventSalesByChannel(eventId, range);
    const total = sumAmount(data);
    return (
      '<div class="section-caption">총 매출액 ' + window.UI.formatMoney(total) + '</div>' +
      '<div class="chart-card">' + window.UI.salesChartHtml('channel', data) + '</div>'
    );
  }

  function paymentDetailHtml(eventId, range) {
    const data = window.MockApi.getEventSalesByPayment(eventId, range);
    const total = sumAmount(data);
    return (
      '<div class="section-caption">총 매출액 ' + window.UI.formatMoney(total) + '</div>' +
      '<div class="chart-card">' + window.UI.salesChartHtml('payment', data) + '</div>'
    );
  }

  function subTabBodyHtml(key, eventId, range, sortDirByKey) {
    sortDirByKey = sortDirByKey || {};
    if (key === 'store') return storeDetailHtml(eventId, range, sortDirByKey.store || 'desc');
    if (key === 'menu') return menuDetailHtml(eventId, range, sortDirByKey.menu || 'desc');
    if (key === 'hour') return hourDetailHtml(eventId, range, sortDirByKey.hour || 'desc');
    if (key === 'payment') return paymentDetailHtml(eventId, range);
    return channelDetailHtml(eventId, range);
  }

  // ---------------- 기간 필터 (과거 매출현황 탭 전용) ----------------
  // 사장님 보드는 '전일/최근 한 달'이지만, 행사담당자는 '전일/행사일/기간설정'을 쓴다.
  // '행사일'은 행사 정보의 날짜 범위(시작일~오늘)를 뜻한다.
  function rangeButtonLabel(range) {
    if (range.preset === 'custom') return (range.start || '').slice(5).replace('-', '.') + ' ~ ' + (range.end || '').slice(5).replace('-', '.');
    return '기간 설정';
  }

  function rangeFilterHtml(range) {
    const presets = [{ key: 'yesterday', label: '전일' }, { key: 'eventPeriod', label: '행사일' }];
    return '<div class="date-range-bar" id="ems-range-filter">' +
      presets.map(function (p) {
        return '<button type="button" class="pill-btn' + (range.preset === p.key ? ' active' : '') + '" data-range-preset="' + p.key + '">' + p.label + '</button>';
      }).join('') +
      '<button type="button" class="pill-btn' + (range.preset === 'custom' ? ' active' : '') + '" id="ems-range-custom-btn">' + rangeButtonLabel(range) + '</button>' +
      '</div>';
  }

  // 사장님 매출조회와 동일하게 최근 30일 범위 안에서만 커스텀 기간을 고를 수 있다.
  function openCustomRangeSheet(onApply) {
    const bounds = window.MockApi.getSalesDateBounds();
    const bodyHtml =
      '<div class="sheet-title">기간 설정</div>' +
      '<div class="section-caption" style="padding:0 0 12px;">최근 한 달 이내에서만 선택할 수 있어요</div>' +
      '<div class="input-group"><div class="input-label">시작일</div><input class="input-field" type="date" id="ems-range-start-input" min="' + bounds.min + '" max="' + bounds.max + '" value="' + bounds.min + '" /></div>' +
      '<div class="input-group"><div class="input-label">종료일</div><input class="input-field" type="date" id="ems-range-end-input" min="' + bounds.min + '" max="' + bounds.max + '" value="' + bounds.max + '" /></div>' +
      '<div class="input-error" id="ems-range-error-text" style="display:none;"></div>' +
      '<button type="button" class="btn btn-primary" id="ems-range-apply-btn">적용</button>';
    window.UI.showBottomSheet(bodyHtml, function (host) {
      host.querySelector('#ems-range-apply-btn').addEventListener('click', function () {
        const start = host.querySelector('#ems-range-start-input').value;
        const end = host.querySelector('#ems-range-end-input').value;
        const errEl = host.querySelector('#ems-range-error-text');
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

  function liveTabHtml(eventId, liveSubTab, sortDirByKey) {
    const today = todayStr();
    const todayRange = { preset: 'today' };
    const summary = window.MockApi.getEventSalesSummary(eventId, todayRange);
    return (
      metricGridHtml(summary) +
      '<div class="sales-detail-date">' + today.replace(/-/g, '.') + '</div>' +
      subTabSwitchHtml(liveSubTab) +
      subTabBodyHtml(liveSubTab, eventId, todayRange, sortDirByKey)
    );
  }

  // 행사일(시작일~오늘) 필터는 범위가 매번 달라 사용자가 정확히 며칠치를 보고 있는지 헷갈릴 수 있어
  // '일자별 매출' 아래에 실제 날짜 범위를 작게 덧붙인다. 하루짜리 행사면 범위 표기 대신 그 하루만 표시.
  function eventPeriodRangeCaption(periodData) {
    if (!periodData.length) return '';
    const start = periodData[0].date, end = periodData[periodData.length - 1].date;
    const startFmt = start.replace(/-/g, '.'), endFmt = end.replace(/-/g, '.');
    if (start === end) return startFmt + '(일)';
    const dayCount = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
    return startFmt + '-' + endFmt + '(' + dayCount + '일)';
  }

  function pastTabHtml(eventId, range) {
    const summary = window.MockApi.getEventSalesSummary(eventId, range);
    const periodData = window.MockApi.getEventSalesByPeriod(eventId, range);
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
      '<div class="chart-card">' + window.UI.salesChartHtml('period', periodData) + '</div>' +
      '<div class="section-title">일자별 매출' + (showHighlight ? '<span class="sales-legend-hint"> · <span class="sales-amount-max">최고</span> / <span class="sales-amount-min">최저</span></span>' : '') + '</div>' +
      (range.preset === 'eventPeriod' ? '<div class="section-caption" style="padding-top:0;margin-top:-6px;">' + eventPeriodRangeCaption(periodData) + '</div>' : '') +
      '<div class="sales-list">' + rows + '</div>'
    );
  }

  function mainHtml(eventId, activeTab, pastRange, liveSubTab, sortDirByKey) {
    return (
      '<div class="topbar"><div class="topbar-side"></div><div class="topbar-title">매출 현황</div><div class="topbar-side"></div></div>' +
      tabSwitchHtml(activeTab) +
      '<div class="screen-scroll">' + (activeTab === 'live' ? liveTabHtml(eventId, liveSubTab, sortDirByKey) : pastTabHtml(eventId, pastRange)) + '</div>' +
      window.EventManagerShell.tabbarHtml('eventManagerSales')
    );
  }

  // ---------------- 날짜별 매출 상세 화면 (5탭) ----------------
  // 사장님 보드는 4개뿐이라 균등폭 세그먼트로 한 줄에 맞지만, 행사담당자는 '매장별'이 추가돼
  // 5개라 같은 방식으로는 4:1로 어색하게 두 줄이 된다. 그래서 이 화면만 폭을 콘텐츠에 맞추고
  // 가로 스크롤되는 탭 스트립으로 바꾼다(ems-subtab-row 한정 — 사장님 보드 4탭 스타일은 그대로 둔다).
  function subTabSwitchHtml(activeSub) {
    return '<div class="sales-subtab-row ems-subtab-row">' + SUB_TABS.map(function (t) {
      return '<button type="button" class="sales-subtab-btn' + (activeSub === t.key ? ' active' : '') + '" data-sales-subtab="' + t.key + '">' + t.label + '</button>';
    }).join('') + '</div>';
  }

  function dateDetailHtml(eventId, date, subKey, sortDirByKey) {
    const dayRange = { preset: 'custom', start: date, end: date };
    const summary = window.MockApi.getEventSalesSummary(eventId, dayRange);
    return (
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="ems-detail-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">날짜별 매출 상세</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll">' +
        '<div class="sales-detail-date">' + date.replace(/-/g, '.') + '</div>' +
        '<div class="sales-detail-sub">' + summary.totalOrderCount.toLocaleString('ko-KR') + '건 · ' + window.UI.formatMoney(summary.totalAmount) + '</div>' +
        subTabSwitchHtml(subKey) +
        subTabBodyHtml(subKey, eventId, dayRange, sortDirByKey) +
      '</div>'
    );
  }

  // #ems-view는 .screen(부모)의 flex-column 레이아웃을 그대로 이어받아야 안의 화면-스크롤
  // 영역만 늘어나고 하단 탭바가 뷰포트 바닥에 고정된다 — display/flex를 안 주면 콘텐츠 높이만큼만
  // 차지해서 탭바가 콘텐츠 뒤에 떠버리고(고정 안 됨), 짧은 화면에서는 중간에 붕 뜨게 된다.
  function render() {
    return '<div id="ems-view" style="display:flex;flex-direction:column;flex:1;min-height:0;"></div>';
  }

  function mount(root, params) {
    const view = root.querySelector('#ems-view');
    const eventId = params.eventId;

    let activeTab = 'live';
    let pastRange = { preset: 'yesterday' };
    let liveSubTab = 'store';
    let sortDirByKey = { store: 'desc', menu: 'desc', hour: 'desc' };
    let detailDate = null;
    let detailSubTab = 'store';

    function paintMain() {
      view.innerHTML = mainHtml(eventId, activeTab, pastRange, liveSubTab, sortDirByKey);
      bindMain();
    }

    function bindMain() {
      window.EventManagerShell.attachTabbar(view, 'eventManagerSales', eventId);

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
      const filterEl = view.querySelector('#ems-range-filter');
      if (!filterEl) return;
      filterEl.querySelectorAll('[data-range-preset]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          pastRange = { preset: btn.getAttribute('data-range-preset') };
          paintMain();
        });
      });
      const customBtn = filterEl.querySelector('#ems-range-custom-btn');
      if (customBtn) {
        customBtn.addEventListener('click', function () {
          openCustomRangeSheet(function (r) { pastRange = r; paintMain(); });
        });
      }
    }

    function openDetail(date) {
      detailDate = date;
      detailSubTab = 'store';
      paintDetail();
    }

    function paintDetail() {
      view.innerHTML = dateDetailHtml(eventId, detailDate, detailSubTab, sortDirByKey);
      bindDetail();
    }

    function bindDetail() {
      view.querySelector('#ems-detail-back').addEventListener('click', function () {
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

  window.Router.register('eventManagerSales', { render: render, mount: mount, unmount: unmount });
})();
