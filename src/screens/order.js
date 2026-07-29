/*
 * 사장님 주문 접수 화면 (order)
 * 대기 / 처리중 / 완료 탭 기반의 주문 카드 보드.
 * '설정 > 권한 잠금 설정'에서 결제 취소 항목을 보호 중이면, 결제 취소 시 비밀번호 확인이 필요하다.
 */
(function () {
  const esc = window.UI.escapeHtml;

  // ---- 화면 상태 (mount 될 때마다 render()에서 초기화) ----
  let user = null;
  let storeId = null;
  let store = null;
  let tabs = [];          // [{status:'WAITING', label:'대기'}, ...]
  let currentIndex = 0;
  let sortDir = 'asc';    // 접수 시간 기준, 기본 오름차순(오래된순 — 새 주문이 아래로 쌓임)
  let searchQuery = '';
  let menuFilters = [];        // 선택된 메뉴명 배열 — 카테고리 내에서는 중복 선택(OR) 가능
  let orderTypeFilters = [];   // 'RESERVATION' | 'DELIVERY' 중 선택된 값 배열
  let calledFilter = 'ALL';    // 'ALL' | 'CALLED' | 'NOT_CALLED' — 주문 필터 시트의 '호출 여부' 카테고리에서 설정
  let callStatusPanelOpen = false; // 처리중 탭의 '호출 현황' 배지 펼침 상태
  let selectedIds = new Set();
  let cardOverrides = {};      // { [orderId:string]: boolean } 주문카드 단위 펼침 오버라이드 (기본값: 간단히 보기)
  let isOnline = true;
  let networkWeak = false; // 완전 단절은 아니지만 신호가 희미한 상태(개발자 도구 '간헐적 끊김' 시뮬레이션) — 주문 컨트롤은 막지 않고 캡션만 경고로 바꾼다
  let autoSoldoutNames = [];   // 자동 품절 배너에 노출 중인 메뉴명 목록 (X로 닫으면 비움)
  let root = null;

  const SCOPED_STYLE = '' +
    // 영업상태 배지-매장명-설정 버튼을 화면 좌우로 흩어놓지 않고, 하나의 그룹으로 묶어 가운데 정렬한다
    '.order-topbar-centered { justify-content: center; gap: var(--space-3); }' +
    '.order-topbar-centered .status-pill-btn, .order-topbar-centered .icon-btn { flex-shrink: 0; }' +
    '.topbar-title { position: static; transform: none; max-width: 45vw; display: flex; align-items: center; gap: 6px; overflow: visible; }' +
    '.order-title-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }' +
    '.reason-pill-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }' +
    '.reason-textarea { margin-top: 4px; }' +
    '.order-list.with-bulk-bar { padding-bottom: 88px; }' +
    '#bulk-bar-slot:empty { display: none; }' +
    '.filter-section { margin-bottom: 18px; }' +
    '.filter-section-title { font-size: var(--font-size-caption); font-weight: 800; color: var(--color-text-secondary); margin-bottom: 10px; }' +
    '.filter-chip-row { display: flex; gap: 8px; flex-wrap: wrap; }' +
    '.filter-chip { padding: 9px 14px; border: 1.5px solid var(--color-disabled); border-radius: var(--radius-pill);' +
      ' background: var(--color-white); font-size: var(--font-size-caption); font-weight: 700; color: var(--color-text-secondary); cursor: pointer; }' +
    '.filter-chip.on { border-color: var(--color-accent-blue); background: var(--color-accent-blue-bg); color: var(--color-accent-blue); }' +
    '.filter-sheet-actions { display: flex; gap: 8px; margin-top: 8px; }' +
    '.filter-sheet-actions .btn { height: 48px; }' +
    '.filter-sheet-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }' +
    '.filter-reset-link { background: none; border: none; padding: 4px; font-size: var(--font-size-caption); font-weight: 700; color: var(--color-text-secondary); cursor: pointer; }' +
    '.status-pill-btn { background: none; border: none; padding: 0; cursor: pointer; }' +
    '.order-network-caption { flex-shrink: 0; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: var(--radius-pill); white-space: nowrap; }' +
    '.order-network-caption.ok { background: var(--color-accent-green-bg); color: #0b6b5c; }' +
    '.order-network-caption.warn { background: var(--color-accent-red-bg); color: #b02850; }' +
    '.search-row { display: flex; align-items: center; gap: var(--space-2); padding: 0 var(--space-5) var(--space-3); }' +
    '.search-row .search-box { flex: 1; min-width: 0; }' +
    '.sort-pill { flex-shrink: 0; }' +
    '.order-toolbar-divider { height: 1px; background: #eef0f2; margin: 0 var(--space-5) var(--space-3); }' +
    '.toolbar-left-group { display: flex; align-items: center; gap: var(--space-2); }' +
    '.phone-btn-danger { background: var(--color-accent-red-bg); color: #b02850; }' +
    '.phone-btn-danger:active { background: var(--color-accent-red); color: var(--color-white); }' +
    '.contact-link-btn { background: none; border: none; padding: 0; margin: 0; font: inherit; font-weight: 700;' +
      ' color: var(--color-text-primary); text-decoration: underline; text-underline-offset: 2px; cursor: pointer;' +
      ' display: inline-flex; align-items: center; gap: 4px; }' +
    '.contact-link-btn .cl-arrow { text-decoration: none; font-size: 13px; font-weight: 800; color: var(--color-text-secondary); }' +
    '.contact-link-btn:active { color: #0b6b5c; }' +
    '.card-detail-toggle {' +
      ' width: 100%; border: none; background: transparent; border-top: 1px solid var(--color-divider);' +
      ' margin-top: var(--space-3); padding: 10px 0 0; font-family: inherit; cursor: pointer;' +
      ' display: flex; align-items: center; justify-content: space-between; text-align: left; }' +
    '.card-detail-toggle .cdt-label { font-size: 12.5px; color: var(--color-text-secondary); font-weight: 700; }' +
    '.card-detail-toggle .cdt-hint { font-weight: 600; opacity: 0.8; }' +
    '.card-detail-toggle .cdt-chev { font-size: 24px; font-weight: 800; color: var(--color-text-secondary); flex-shrink: 0; margin-left: 8px; line-height: 1; }' +
    '.card-detail-toggle:active .cdt-label { color: #0b6b5c; }' +
    '.top-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }' +
    '.elapsed-badge.reservation { background: var(--color-accent-blue-bg); color: #3355b8; border-color: rgba(92,130,232,0.35); }' +
    '.call-status-btn { background: var(--color-accent-blue); color: var(--color-white); flex-shrink: 0; }' +
    '.call-status-btn.active { background: #2a4fc7; }' +
    '.call-status-panel { margin: 0 var(--space-5) var(--space-3); padding: var(--space-4); background: var(--color-accent-blue-bg); border-radius: var(--radius-card); }' +
    '.call-status-summary { display: flex; gap: 8px; margin-bottom: 10px; }' +
    '.call-status-summary .cs-pill { font-size: 13px; padding: 7px 12px; }' +
    // 메뉴가 많아도 패널이 한없이 길어지지 않도록 자체 스크롤 영역으로 감싼다 — 펼쳐도 주문 카드가
    // 최소 하나는 화면에 걸쳐 보이도록 이 영역의 높이를 일부러 낮게 제한한다. 아직 안 불린 수량이
    // 많은 메뉴가 위로 정렬되므로(callStatusMenuBreakdown) 스크롤 없이도 가장 급한 메뉴부터 보인다.
    '.call-status-menu-list { max-height: 148px; overflow-y: auto; border-radius: 10px; background: var(--color-white); }' +
    '.cs-menu-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; font-size: 13px; border-bottom: 1px solid var(--color-divider); }' +
    '.cs-menu-row:last-child { border-bottom: none; }' +
    '.cs-menu-name { font-weight: 800; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; margin-right: 8px; }' +
    '.cs-menu-pills { display: flex; gap: 5px; flex-shrink: 0; }' +
    // 호출(완료)=민트, 미호출(대기)=앰버로 상태를 색으로 바로 구분한다. 0건은 회색으로 낮춰 시선을 뺏지 않는다.
    '.cs-pill { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: var(--radius-pill); font-size: 11px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; }' +
    '.cs-pill b { font-weight: 800; }' +
    '.cs-pill.called { background: var(--color-accent-green-bg); color: #0b6b5c; }' +
    '.cs-pill.notCalled { background: var(--color-accent-amber-bg); color: #a15c00; }' +
    '.cs-pill.zero { background: var(--color-card-bg); color: var(--color-text-secondary); }' +
    '.cancel-done-badge { width: 100%; justify-content: center; padding: 12px; font-size: var(--font-size-caption); font-weight: 700; }' +
    '.line-name.reusable { color: var(--color-accent-green); font-weight: 700; }' +
    '.order-card.selected { background: var(--color-accent-blue-bg); box-shadow: inset 0 0 0 1.5px var(--color-accent-blue); }' +
    '.refresh-btn { background: none; border: none; padding: 4px; cursor: pointer; font-size: 18px; line-height: 1; flex-shrink: 0; margin-left: auto; }' +
    '.order-title-text { font-size: 18px; }' +
    '.refresh-btn.spinning { animation: order-refresh-spin 0.6s linear; }' +
    '@keyframes order-refresh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' +
    // 미수락/처리중/완료 탭 — 따로 떨어진 배지형 버튼 대신, 하나의 캡슐 안에서 전환되는
    // 세그먼트 스타일로 변경(메뉴관리의 '1개만 선택/여러개 선택'과 같은 톤). 새로고침 버튼은
    // 이 캡슐 바깥에 그대로 분리해서 둔다.
    '.order-status-seg { display: flex; flex: 1; border: 1.5px solid var(--color-disabled); border-radius: var(--radius-pill); padding: 3px; background: var(--color-card-bg); }' +
    '.order-status-seg .segment-tab { flex: 1; background: transparent; }' +
    '.order-status-seg .segment-tab.active { background: var(--color-text-primary); color: var(--color-white); box-shadow: 0 1px 4px rgba(0,0,0,.15); }';

  // ---------------- 탭 구성 ----------------
  // 자동수락 ON이면 신규 주문이 대기 없이 바로 처리중으로 인입되므로 대기 탭 자체를 숨긴다.
  // OFF면 대기 탭을 포함한 3개 탭을 모두 노출한다.
  function computeTabs() {
    if (store.autoAcceptOrders) {
      return [{ status: 'PROCESSING', label: '처리중' }, { status: 'DONE', label: '완료' }];
    }
    return [{ status: 'WAITING', label: '미수락' }, { status: 'PROCESSING', label: '처리중' }, { status: 'DONE', label: '완료' }];
  }

  function currentStatus() { return tabs[currentIndex].status; }

  // ---------------- 데이터 조회 ----------------
  function fetchOrders() {
    return window.MockApi.getOrders(storeId, {
      status: currentStatus(),
      menuFilters: menuFilters,
      orderTypeFilters: orderTypeFilters,
      calledFilter: calledFilter,
      search: searchQuery || undefined,
      sortDir: sortDir,
    });
  }

  // 검색어뿐 아니라 주문 필터(메뉴/유형/호출여부)도 탭을 넘나들며 유지되므로, 탭 옆 건수 뱃지도
  // 현재 적용된 필터가 모두 반영된 값으로 보여준다 (fetchOrders와 동일한 조건, status만 다름)
  function tabCount(status) {
    return window.MockApi.getOrders(storeId, {
      status: status,
      menuFilters: menuFilters,
      orderTypeFilters: orderTypeFilters,
      calledFilter: calledFilter,
      search: searchQuery || undefined,
    }).length;
  }

  // ---------------- 펼침 상태 ----------------
  // 시간대 그룹 단위 간단히보기/펼쳐보기는 삭제하고, 카드마다 개별 화살표로만 펼침 상태를 다룬다 (기본값: 간단히 보기)
  function isCardExpanded(orderId) {
    if (Object.prototype.hasOwnProperty.call(cardOverrides, orderId)) return cardOverrides[orderId];
    return false;
  }

  function toggleCardExpand(orderId) {
    cardOverrides[orderId] = !isCardExpanded(orderId);
    updateList();
  }

  // 메뉴 수량·이름·옵션 전체 목록 — '간단히 보기' 상태에서도 항상 노출된다 (수량이 먼저, 메뉴명이 뒤에)
  // 다회용기 주문은 별도 뱃지 대신, 각 메뉴명 앞에 ♻️를 붙이고 메뉴명 글자를 초록색으로 강조한다
  // 선착순 배지는 주문 시점 값이 아니라 '지금' 그 메뉴에 선착순 가격이 설정돼 있는지를 보고 판단한다
  // (주문 카드 단위가 아니라 메뉴 줄 단위로 노출).
  function itemListHtml(order) {
    const isReusable = !!order.isReusableContainer;
    const menuItems = window.MockApi.getMenuItems(storeId);
    return (order.items || []).map(function (it) {
      const optHtml = (it.optionNames && it.optionNames.length)
        ? '<span class="line-option">' + it.optionNames.map(function (o) { return esc(o); }).join(', ') + '</span>'
        : '';
      const menu = menuItems.find(function (m) { return m.name === it.menuName; });
      const firstComeHtml = (menu && menu.firstComeEnabled) ? ' <span class="badge badge-warning-soft">선착순</span>' : '';
      return '<div class="order-card-menu-line">' +
        '<span class="line-qty">' + it.quantity + '개</span>' +
        '<span class="line-name' + (isReusable ? ' reusable' : '') + '">' + esc(it.menuName) + (isReusable ? ' ♻️' : '') + '</span>' +
        optHtml + firstComeHtml +
        '</div>';
    }).join('');
  }

  // ---------------- 렌더 조각들 ----------------
  function renderSegmentTabsHtml() {
    const tabBtns = tabs.map(function (t, i) {
      return '<button type="button" class="segment-tab' + (i === currentIndex ? ' active' : '') + '" data-action="switch-tab" data-tab-idx="' + i + '">' +
        esc(t.label) + ' <span class="count">' + tabCount(t.status) + '</span></button>';
    }).join('');
    return '<div class="order-status-seg">' + tabBtns + '</div>';
  }

  // ---------------- 호출 현황(처리중 탭 전용) ----------------
  // 조리 현황판 배지가 있던 자리를 대신한다. 조리 현황판 자체는 설정 > '조리 현황판 보기'로 이동했다.
  // 집계는 현재 적용된 메뉴/유형/검색 필터는 그대로 반영하되, 호출 여부 필터 자체는 무시하고 각각 강제로 계산한다.
  function callStatusCounts() {
    const base = { status: 'PROCESSING', menuFilters: menuFilters, orderTypeFilters: orderTypeFilters, search: searchQuery || undefined };
    const calledCount = window.MockApi.getOrders(storeId, Object.assign({}, base, { calledFilter: 'CALLED' })).length;
    const notCalledCount = window.MockApi.getOrders(storeId, Object.assign({}, base, { calledFilter: 'NOT_CALLED' })).length;
    return { calledCount: calledCount, notCalledCount: notCalledCount };
  }

  // 메뉴별로 호출/미호출 수량을 집계한다(조리 현황판과 같은 방식 — 호출은 주문 단위 판정이라
  // 한 주문에 여러 메뉴가 섞여 있으면 그 주문에 속한 메뉴 수량이 전부 같은 호출 상태로 잡힌다).
  // 아직 안 불린(미호출) 수량이 많은 메뉴가 가장 급하므로 그 순서로 앞에 오도록 정렬한다.
  function callStatusMenuBreakdown() {
    const base = { status: 'PROCESSING', menuFilters: menuFilters, orderTypeFilters: orderTypeFilters, search: searchQuery || undefined };
    const orders = window.MockApi.getOrders(storeId, base);
    const stats = {};
    const names = [];
    orders.forEach(function (o) {
      const isCalled = !!o.called;
      o.items.forEach(function (it) {
        if (!stats[it.menuName]) { stats[it.menuName] = { called: 0, notCalled: 0 }; names.push(it.menuName); }
        if (isCalled) stats[it.menuName].called += it.quantity;
        else stats[it.menuName].notCalled += it.quantity;
      });
    });
    return names
      .map(function (name) { return { name: name, called: stats[name].called, notCalled: stats[name].notCalled }; })
      .sort(function (a, b) { return b.notCalled - a.notCalled; });
  }

  function renderCallStatusButtonHtml() {
    if (currentStatus() !== 'PROCESSING') return '';
    return '<button type="button" class="pill-btn call-status-btn' + (callStatusPanelOpen ? ' active' : '') + '" data-action="toggle-call-status-panel">📣 호출 현황 ' + (callStatusPanelOpen ? '▴' : '▾') + '</button>';
  }

  // 호출/미호출 수를 회색 텍스트가 아니라 색이 있는 알약(호출=민트/완료, 미호출=앰버/대기)으로 보여줘
  // 한눈에 상태를 구분하기 쉽게 한다. 0건인 쪽은 톤을 낮춰(zero) 시선이 안 가게 한다.
  function csPillHtml(kind, count, unit) {
    const cls = count === 0 ? 'cs-pill zero' : 'cs-pill ' + kind;
    const icon = kind === 'called' ? '✓' : '⏳';
    const label = kind === 'called' ? '호출' : '미호출';
    return '<span class="' + cls + '">' + icon + ' ' + label + ' <b>' + count + '</b>' + unit + '</span>';
  }

  function renderCallStatusPanelHtml() {
    if (currentStatus() !== 'PROCESSING' || !callStatusPanelOpen) return '';
    const counts = callStatusCounts();
    const breakdown = callStatusMenuBreakdown();
    const menuListHtml = breakdown.length
      ? breakdown.map(function (row) {
          return '<div class="cs-menu-row"><span class="cs-menu-name">' + esc(row.name) + '</span>' +
            '<span class="cs-menu-pills">' + csPillHtml('called', row.called, '개') + csPillHtml('notCalled', row.notCalled, '개') + '</span></div>';
        }).join('')
      : '<div class="cs-menu-row"><span class="cs-menu-name">처리중인 메뉴가 없어요</span></div>';
    return '<div class="call-status-panel">' +
      '<div class="call-status-summary">' + csPillHtml('called', counts.calledCount, '건') + csPillHtml('notCalled', counts.notCalledCount, '건') + '</div>' +
      '<div class="call-status-menu-list">' + menuListHtml + '</div>' +
      '</div>';
  }

  function updateCallStatusUI() {
    if (!root) return;
    const btnSlot = root.querySelector('#call-status-btn-slot');
    if (btnSlot) btnSlot.innerHTML = renderCallStatusButtonHtml();
    const panelSlot = root.querySelector('#call-status-panel-slot');
    if (panelSlot) panelSlot.innerHTML = renderCallStatusPanelHtml();
  }

  function sortLabel() { return sortDir === 'desc' ? '최신순' : '오래된순'; }

  function offlineBannerHtml() {
    return '<div class="offline-banner">오프라인 상태에요. 기기 네트워크를 점검해 주세요.</div>';
  }

  // 여러 메뉴가 동시에 자동 품절돼도 '메뉴명 외 N개'로 뭉치지 않고, 메뉴마다 각각 별도의 배너로 띄운다.
  function autoSoldoutBannerHtml() {
    return autoSoldoutNames.map(function (n) {
      return '<div class="auto-soldout-banner">' +
        '<span>⚠️ ' + esc(n) + ' 메뉴가 자동 품절됐어요.</span>' +
        '<button type="button" class="auto-soldout-banner-close" data-action="dismiss-auto-soldout" data-name="' + esc(n) + '" aria-label="닫기">✕</button>' +
        '</div>';
    }).join('');
  }

  // 호출/완료 횟수는 0회일 때는 굳이 보여줄 필요가 없어 숨기고, 1회부터는 버튼 옆 작은 뱃지로 노출한다
  // 배지 대신 버튼 라벨 한 줄 안에 (n회)로 붙여서 두 줄로 줄바꿈되지 않게 한다.
  function countText(n) {
    return n > 0 ? ' (' + n + '회)' : '';
  }

  // 취소 계열 액션(주문 거절/결제 취소/반품)은 오조작 방지를 위해 액션 버튼 행에 두지 않고,
  // 펼쳐보기 했을 때만 메타 영역에 연락처와 같은 배지 양식(라벨 + 알약 버튼)으로 노출한다 — 모든 탭에서
  // 동일한 규칙. 드러난 뒤의 동작/로직은 기존과 동일하다. 실제 렌더는 cancelActionRowHtml()이 담당한다.
  function renderActionsHtml(order, tabStatus, disabled) {
    const dAttr = disabled ? ' disabled' : '';
    if (tabStatus === 'WAITING') {
      return '<div class="order-card-actions">' +
        '<button type="button" class="btn btn-primary" data-action="accept-order" data-id="' + order.id + '"' + dAttr + '>주문 수락</button>' +
        '</div>';
    }
    if (tabStatus === 'PROCESSING') {
      return '<div class="order-card-actions">' +
        '<button type="button" class="btn btn-outline" data-action="call-customer" data-id="' + order.id + '"' + dAttr + '>손님 호출' + countText(order.calledCount || 0) + '</button>' +
        '<button type="button" class="btn btn-primary" data-action="complete-order" data-id="' + order.id + '"' + dAttr + '>완료' + countText(order.completeCount || 0) + '</button>' +
        '</div>';
    }
    // 완료 탭에서 취소/반품 처리된 건은 되돌리기·결제취소 버튼 대신, 처리 완료 시각이 담긴 뱃지로 대체한다
    if (order.canceled) {
      const timeLabel = order.cancelledAt ? ' (' + window.UI.clockLabelWithSeconds(order.cancelledAt) + ')' : '';
      const doneLabel = order.cancelType === 'CANCEL' ? '주문 취소 완료' : '결제 취소 완료';
      return '<div class="order-card-actions"><span class="badge badge-neutral cancel-done-badge">' + doneLabel + timeLabel + '</span></div>';
    }
    // '반품'(결제 취소)은 액션 버튼이 아니라 펼쳐보기의 메타 영역에 연락처와 같은 배지 양식으로 노출한다
    return '<div class="order-card-actions">' +
      '<button type="button" class="btn btn-outline" data-action="revert-order" data-id="' + order.id + '"' + dAttr + '>되돌리기</button>' +
      '</div>';
  }

  // 미수락/처리중/완료(취소 안 된 건) 각 탭의 취소성 액션을, 연락처와 같은 메타 배지 양식으로 통일해서 만든다.
  function cancelActionRowHtml(order, tabStatus, disabled) {
    const dAttr = disabled ? ' disabled' : '';
    if (tabStatus === 'WAITING') {
      return '<div class="meta-row"><span class="meta-label">취소</span><span class="meta-value"><button type="button" class="phone-btn phone-btn-danger" data-action="cancel-order" data-id="' + order.id + '"' + dAttr + '>주문 거절</button></span></div>';
    }
    if (tabStatus === 'PROCESSING') {
      return '<div class="meta-row"><span class="meta-label">취소</span><span class="meta-value"><button type="button" class="phone-btn phone-btn-danger" data-action="cancel-payment" data-id="' + order.id + '"' + dAttr + '>결제 취소</button></span></div>';
    }
    if (tabStatus === 'DONE' && !order.canceled) {
      return '<div class="meta-row"><span class="meta-label">반품</span><span class="meta-value"><button type="button" class="phone-btn phone-btn-danger" data-action="return-order" data-id="' + order.id + '"' + dAttr + '>결제 취소</button></span></div>';
    }
    return '';
  }

  function topBadgesHtml(order) {
    if (order.isReservation) {
      const resTime = new Date(order.reservationTime || order.orderedAt).getTime();
      const overdueMins = Math.round((Date.now() - resTime) / 60000);
      const isOverdue = overdueMins > 0;
      const timeLabel = window.UI.clockLabel(order.reservationTime || order.orderedAt);
      const urgencyCls = isOverdue ? (overdueMins >= 10 ? ' urgent' : ' normal') : '';
      const overdueText = isOverdue ? ' · ' + overdueMins + '분 지남' : '';
      return '<span class="elapsed-badge reservation' + urgencyCls + '">📅 ' + timeLabel + ' 예약' + overdueText + '</span>';
    }
    const mins = window.UI.elapsedMinutes(order.orderedAt);
    const urgencyCls = mins >= 10 ? 'urgent' : 'normal';
    return '<span class="elapsed-badge ' + urgencyCls + '">● ' + window.UI.clockLabel(order.orderedAt) + ' · ' + window.UI.elapsedLabel(order.orderedAt) + '</span>';
  }

  function renderOrderCard(order, tabStatus, disabled) {
    const expanded = isCardExpanded(order.id);
    const cls = 'order-card' + (order.canceled ? ' canceled' : '') + (selectedIds.has(order.id) ? ' selected' : '');
    let html = '<div class="' + cls + '">';

    // 상단 상태 행: 경과시간/예약시간(좌) + 픽업번호(우) — 조리 우선순위와 픽업 정보를 한눈에
    html += '<div class="order-card-top-row">' +
      '<div class="top-badges">' + topBadgesHtml(order) + '</div>' +
      '<span class="pickup-inline"><span class="pickup-label">' + (order.identifierType === 'SEAT' ? '자리' : '픽업') + '</span><span class="pickup-value">' + esc(order.pickupNo) + '</span></span>' +
      '</div>';

    // 주문채널·배달·프로모션 배지는 한눈에 파악해야 할 핵심 정보라 '간단히 보기'에서도 항상 노출한다
    // 예약 여부는 상단의 [예약 HH:MM] 배지로 이미 표시되므로 헤더에 별도 예약 배지를 중복 노출하지 않는다
    // 선착순은 주문 건 단위가 아니라 메뉴별 배지(itemListHtml)로 표시하므로 헤더에서는 제외한다
    // 해피아워는 주문 카드에 배지로 표시하지 않는다 — 대신 해피아워가 시작되는 순간 팝업으로 알린다(handleHappyHourStarted)
    const channelHtml = window.UI.channelBadgeHtml(order.channel);
    const deliveryHtml = order.identifierType === 'SEAT' ? '<span class="badge badge-neutral">🛵 배달 주문</span>' : '';
    const promoHtml = (order.promoType === 'FIRST_COME' || order.promoType === 'HAPPY_HOUR') ? '' : window.UI.promoBadgeHtml(order.promoType);
    if (channelHtml || deliveryHtml || promoHtml) {
      html += '<div class="order-card-header-row">' + channelHtml + deliveryHtml + promoHtml + '</div>';
    }

    html += '<div class="order-card-items">' + itemListHtml(order) + '</div>';

    // 손님 요청(메모)은 조리 시 바로 확인해야 하는 정보라 '간단히 보기'에서도 항상 노출한다
    if (order.customerNote) {
      html += '<div class="order-card-note">💬 ' + esc(order.customerNote) + '</div>';
    }
    if (order.canceled) {
      const typeLabel = order.cancelType === 'RETURN' ? '결제 취소' : (order.cancelType === 'PAYMENT_CANCEL' ? '결제취소' : '주문거절');
      html += '<div class="order-card-cancel-reason">[' + typeLabel + '] ' + esc(order.cancelReason || '') + '</div>';
    }

    // 인라인 힌트 행 — 안에 뭐가 있는지 미리 알려주는 텍스트로 이 카드만 펼쳐보기/간단히보기를 개별 전환할 수 있다
    html += '<button type="button" class="card-detail-toggle" data-action="toggle-card-expand" data-order-id="' + order.id + '">' +
      '<span class="cdt-label">' + (expanded ? '접기' : '상세보기 <span class="cdt-hint">· 결제 취소·연락처·결제 금액 등</span>') + '</span>' +
      '<span class="cdt-chev">' + (expanded ? '▴' : '▾') + '</span>' +
      '</button>';

    // 연락처/결제수단/주문번호는 '펼쳐보기'에서만 노출한다 (접수·예약시각은 상단 배지로 이동)
    // 순서: 취소성 액션(배지) → 연락처(문구형 링크) → 주문 유형 → 결제정보 → 주문번호
    if (expanded) {
      // 현금 주문 생성(카운터 접수)은 손님 연락처를 안 남기고 접수할 수도 있으므로, 없으면 안내 문구를 둔다
      // 연락처는 더 이상 버튼형 배지가 아니라 문구형 링크로 노출한다 — 밑줄 + '›' 화살표로 연결된 동작(전화/메일)이
      // 있다는 것만 알려주고, 클릭 동작(open-contact) 자체는 기존과 동일하다.
      const contactHtml = order.customerContact
        ? (function () {
            const contact = window.UI.formatContact(order.customerContact);
            const isEmailContact = order.customerContact.indexOf('@') !== -1;
            const contactIcon = isEmailContact ? '✉️' : '📞';
            return '<button type="button" class="contact-link-btn" data-action="open-contact" data-contact="' + esc(order.customerContact) + '" data-is-email="' + (isEmailContact ? '1' : '0') + '">' + contactIcon + ' ' + esc(contact) + '<span class="cl-arrow">›</span></button>';
          })()
        : '연락처 없음(카운터 접수)';
      html += '<div class="order-card-meta">' +
        cancelActionRowHtml(order, tabStatus, disabled) +
        '<div class="meta-row"><span class="meta-label">연락처</span><span class="meta-value">' + contactHtml + '</span></div>' +
        '<div class="meta-row"><span class="meta-label">주문 유형</span><span class="meta-value">' + esc(window.UI.channelTypeLabel(order.channel)) + '</span></div>' +
        '<div class="meta-row"><span class="meta-label">결제정보</span><span class="meta-value">' + esc(order.paymentMethod) + ' · ' + window.UI.formatMoney(order.amount) + '</span></div>' +
        '<div class="meta-row"><span class="meta-label">주문번호</span><span class="meta-value">' + esc(order.paymentOrderNo) + '</span></div>' +
        '</div>';
    }

    // 주문취소/결제취소/반품 처리된 완료 탭 건은 되돌리기·반품 버튼을 비활성화한다
    const actionsDisabled = disabled || (tabStatus === 'DONE' && order.canceled);
    html += renderActionsHtml(order, tabStatus, actionsDisabled);
    html += '</div>';
    return html;
  }

  function renderBucketHeader(group, tabStatus, disabled) {
    const showCheckbox = tabStatus !== 'DONE';
    const allSelected = showCheckbox && group.orders.length > 0 && group.orders.every(function (o) { return selectedIds.has(o.id); });
    return '<div class="bucket-header">' +
      '<div class="bucket-header-left">' +
      (showCheckbox ? '<input type="checkbox" data-action="bucket-select-all" data-bucket="' + group.key + '"' + (allSelected ? ' checked' : '') + (disabled ? ' disabled' : '') + ' />' : '') +
      '<span class="bucket-label">' + group.label + '</span>' +
      '</div>' +
      '</div>';
  }

  function renderGroupsHtml(groups, allOrders, disabled) {
    const tabStatus = currentStatus();
    if (!allOrders.length) {
      if (searchQuery) return '<div class="empty-state"><div class="empty-state-emoji">🔎</div><div>검색 결과가 없어요</div></div>';
      return '<div class="empty-state"><div class="empty-state-emoji">📭</div><div>주문 내역이 없어요</div></div>';
    }
    return groups.map(function (g) {
      return renderBucketHeader(g, tabStatus, disabled) + g.orders.map(function (o) { return renderOrderCard(o, tabStatus, disabled); }).join('');
    }).join('');
  }

  function renderBulkBarHtml(disabled) {
    const tabStatus = currentStatus();
    if (tabStatus === 'DONE' || selectedIds.size === 0) return '';
    const n = selectedIds.size;
    const dAttr = disabled ? ' disabled' : '';
    if (tabStatus === 'WAITING') {
      return '<div class="bulk-action-bar"><button type="button" class="btn btn-primary" data-action="bulk-accept"' + dAttr + '>선택 ' + n + '건 주문 수락</button></div>';
    }
    return '<div class="bulk-action-bar">' +
      '<button type="button" class="btn btn-outline" data-action="bulk-call"' + dAttr + '>선택 ' + n + '건 손님 호출</button>' +
      '<button type="button" class="btn btn-primary" data-action="bulk-complete"' + dAttr + '>선택 ' + n + '건 완료</button>' +
      '</div>';
  }

  // 모든 주문 컨트롤(수락/취소/호출/완료/되돌리기/반품 등)은 오프라인이거나
  // 매장이 '개점' 상태가 아니면(일시중지/마감) 비활성화한다.
  function controlsDisabled() {
    return !isOnline || (store && store.operatingStatus !== 'OPEN');
  }

  // ---------------- 리스트 갱신 (부분 렌더 — 검색창 포커스 유지) ----------------
  function updateList() {
    if (!root) return;
    const disabled = controlsDisabled();
    const orders = fetchOrders();
    const groups = window.UI.groupByBucket(orders, sortDir);
    const wrap = root.querySelector('#order-list-wrap');
    const hasBulkBar = currentStatus() !== 'DONE' && selectedIds.size > 0;
    wrap.className = 'order-list' + (hasBulkBar ? ' with-bulk-bar' : '');
    wrap.innerHTML = renderGroupsHtml(groups, orders, disabled);
    const bulkSlot = root.querySelector('#bulk-bar-slot');
    if (bulkSlot) bulkSlot.innerHTML = renderBulkBarHtml(disabled);
    const tabsEl = root.querySelector('#segment-tabs');
    if (tabsEl) tabsEl.innerHTML = renderSegmentTabsHtml();
    updateCallStatusUI();
  }

  const ORDER_TYPE_LABELS = { RESERVATION: '예약 주문만', DELIVERY: '배달 주문만' };

  // 주문 방식 관리(설정)에서 꺼둔 유형은 필터 목록에서도 숨긴다 — 받지도 않는 유형을 필터로 보여주는 건 혼란스럽다
  function getOrderTypeOptions() {
    const settings = window.MockApi.getOrderChannelSettings(storeId);
    const opts = [];
    if (settings.acceptReservationOrders) opts.push({ v: 'RESERVATION', label: ORDER_TYPE_LABELS.RESERVATION });
    if (settings.acceptSeatOrders) opts.push({ v: 'DELIVERY', label: ORDER_TYPE_LABELS.DELIVERY });
    return opts;
  }

  const CALLED_STATUS_OPTIONS = [
    { v: 'CALLED', label: '호출 주문만' },
    { v: 'NOT_CALLED', label: '미호출 주문만' },
  ];
  const CALLED_STATUS_LABELS = { CALLED: '호출 주문만', NOT_CALLED: '미호출 주문만' };

  function filterBtnLabel() {
    const calledLabel = CALLED_STATUS_LABELS[calledFilter];
    const parts = (calledLabel ? [calledLabel] : []).concat(menuFilters).concat(orderTypeFilters.map(function (t) { return ORDER_TYPE_LABELS[t] || t; }));
    if (parts.length === 1) return parts[0];
    if (parts.length >= 2) return parts[0] + ' +' + (parts.length - 1);
    return '주문 필터';
  }

  function updateFilterBtnLabel() {
    const btn = root.querySelector('#order-filter-btn');
    if (!btn) return;
    btn.textContent = filterBtnLabel();
    btn.classList.toggle('active', menuFilters.length > 0 || orderTypeFilters.length > 0 || calledFilter !== 'ALL');
  }

  // 호출번호 검색은 미수락/처리중/완료 탭을 넘나들며 유지된다 — 탭을 옮겨도 검색어를 지우지 않는다
  function switchTab(idx) {
    if (idx < 0 || idx >= tabs.length) return;
    currentIndex = idx;
    selectedIds = new Set();
    menuFilters = [];
    orderTypeFilters = [];
    calledFilter = 'ALL';
    callStatusPanelOpen = false;
    updateFilterBtnLabel();
    updateList();
  }

  // ---------------- 주문 필터 바텀시트 (호출 여부 + 메뉴별 + 주문 유형별, 각 카테고리 내에서도 중복 선택 가능) ----------------
  // 두 카테고리를 서로 배타적인 탭으로 나누지 않고, 각각 다중 선택 가능한 칩으로 노출한 뒤
  // '적용'을 눌러야 실제로 반영되도록 해 다양한 조합(메뉴+메뉴, 유형+유형, 메뉴+유형)을 자유롭게 시도해볼 수 있게 한다.
  // 호출 여부는 성격상 단일 선택(호출 주문만 / 미호출 주문만 중 하나, 또는 둘 다 미선택=전체)이라 다른 카테고리와 달리 배타적으로 토글한다.
  function openOrderFilterSheet() {
    let draftMenus = menuFilters.slice();
    let draftTypes = orderTypeFilters.slice();
    let draftCalled = calledFilter;
    const showCalledSection = currentStatus() !== 'WAITING'; // 대기 탭은 아직 호출 개념이 없으므로 숨긴다
    const ordersInTab = window.MockApi.getOrders(storeId, { status: currentStatus() });
    const menuNames = [];
    ordersInTab.forEach(function (o) {
      o.items.forEach(function (it) {
        if (menuNames.indexOf(it.menuName) === -1) menuNames.push(it.menuName);
      });
    });

    function calledChipsHtml() {
      return CALLED_STATUS_OPTIONS.map(function (o) {
        return '<button type="button" class="filter-chip' + (draftCalled === o.v ? ' on' : '') + '" data-called-status="' + o.v + '">' + o.label + '</button>';
      }).join('');
    }

    function menuChipsHtml() {
      if (!menuNames.length) return '<div class="empty-state"><div>필터링할 메뉴가 없어요</div></div>';
      return menuNames.map(function (name) {
        return '<button type="button" class="filter-chip' + (draftMenus.indexOf(name) !== -1 ? ' on' : '') + '" data-menu="' + esc(name) + '">' + esc(name) + '</button>';
      }).join('');
    }

    function typeChipsHtml() {
      return getOrderTypeOptions().map(function (o) {
        return '<button type="button" class="filter-chip' + (draftTypes.indexOf(o.v) !== -1 ? ' on' : '') + '" data-order-type="' + o.v + '">' + o.label + '</button>';
      }).join('');
    }

    const bodyHtml =
      '<div class="filter-sheet-header">' +
        '<div class="sheet-title" style="margin:0;">주문 필터</div>' +
        '<button type="button" class="filter-reset-link" id="filter-reset-btn">🔄 초기화</button>' +
      '</div>' +
      (showCalledSection ?
        '<div class="filter-section">' +
          '<div class="filter-section-title">호출 여부</div>' +
          '<div class="filter-chip-row" id="called-chip-row">' + calledChipsHtml() + '</div>' +
        '</div>' : '') +
      '<div class="filter-section">' +
        '<div class="filter-section-title">메뉴 (중복 선택 가능)</div>' +
        '<div class="filter-chip-row" id="menu-chip-row">' + menuChipsHtml() + '</div>' +
      '</div>' +
      '<div class="filter-section">' +
        '<div class="filter-section-title">주문 유형 (중복 선택 가능)</div>' +
        '<div class="filter-chip-row" id="type-chip-row">' + typeChipsHtml() + '</div>' +
      '</div>' +
      '<div class="filter-sheet-actions">' +
        '<button type="button" class="btn btn-primary" id="filter-apply-btn">적용</button>' +
      '</div>';

    window.UI.showBottomSheet(bodyHtml, function (host) {
      const calledRow = host.querySelector('#called-chip-row');
      const menuRow = host.querySelector('#menu-chip-row');
      const typeRow = host.querySelector('#type-chip-row');

      function bindCalledChips() {
        if (!calledRow) return;
        calledRow.querySelectorAll('[data-called-status]').forEach(function (el) {
          el.addEventListener('click', function () {
            const v = el.getAttribute('data-called-status');
            draftCalled = (draftCalled === v) ? 'ALL' : v;
            calledRow.querySelectorAll('[data-called-status]').forEach(function (btn) {
              btn.classList.toggle('on', btn.getAttribute('data-called-status') === draftCalled);
            });
          });
        });
      }

      function bindMenuChips() {
        menuRow.querySelectorAll('[data-menu]').forEach(function (el) {
          el.addEventListener('click', function () {
            const name = el.getAttribute('data-menu');
            const idx = draftMenus.indexOf(name);
            if (idx === -1) draftMenus.push(name); else draftMenus.splice(idx, 1);
            el.classList.toggle('on', draftMenus.indexOf(name) !== -1);
          });
        });
      }

      function bindTypeChips() {
        typeRow.querySelectorAll('[data-order-type]').forEach(function (el) {
          el.addEventListener('click', function () {
            const v = el.getAttribute('data-order-type');
            const idx = draftTypes.indexOf(v);
            if (idx === -1) draftTypes.push(v); else draftTypes.splice(idx, 1);
            el.classList.toggle('on', draftTypes.indexOf(v) !== -1);
          });
        });
      }

      bindCalledChips();
      bindMenuChips();
      bindTypeChips();

      host.querySelector('#filter-reset-btn').addEventListener('click', function () {
        draftMenus = [];
        draftTypes = [];
        draftCalled = 'ALL';
        if (calledRow) calledRow.querySelectorAll('[data-called-status]').forEach(function (btn) { btn.classList.remove('on'); });
        menuRow.innerHTML = menuChipsHtml();
        typeRow.innerHTML = typeChipsHtml();
        bindMenuChips();
        bindTypeChips();
      });

      host.querySelector('#filter-apply-btn').addEventListener('click', function () {
        menuFilters = draftMenus;
        orderTypeFilters = draftTypes;
        calledFilter = draftCalled;
        window.UI.closeModal();
        updateFilterBtnLabel();
        updateList();
      });
    });
  }

  // ---------------- 취소/반품 사유 모달 ----------------
  function openReasonModal(onConfirm) {
    let selected = null;
    let customText = '';

    function computeReason() {
      if (selected === '직접 입력') return customText.trim();
      return selected;
    }

    function renderModal() {
      const options = ['재료 소진', '손님 요청', '영업 마감', '손님 미수령', '직접 입력'];
      let bodyHtml = '<div class="reason-pill-row">' + options.map(function (opt) {
        return '<button type="button" class="pill-btn reason-pill' + (selected === opt ? ' active' : '') + '" data-reason="' + opt + '">' + opt + '</button>';
      }).join('') + '</div>';
      if (selected === '직접 입력') {
        bodyHtml += '<textarea class="input-field reason-textarea" id="reason-textarea" placeholder="사유를 입력해 주세요">' + esc(customText) + '</textarea>';
      }
      const reasonValue = computeReason();
      const confirmDisabled = !reasonValue;

      window.UI.showModal({
        title: '취소 사유를 입력해 주세요.',
        bodyHtml: bodyHtml,
        buttons: [
          { label: '취소하기', variant: 'btn-primary', onClick: function () { if (!confirmDisabled) onConfirm(reasonValue); } },
          { label: '닫기', variant: 'btn-secondary' },
        ],
      });

      const host = document.getElementById('modal-host');
      const btns = host.querySelectorAll('.btn');
      if (confirmDisabled && btns[0]) btns[0].setAttribute('disabled', 'disabled');

      host.querySelectorAll('.reason-pill').forEach(function (btn) {
        btn.addEventListener('click', function () {
          selected = btn.getAttribute('data-reason');
          if (selected !== '직접 입력') customText = '';
          renderModal();
        });
      });
      const ta = document.getElementById('reason-textarea');
      if (ta) {
        ta.addEventListener('input', function () {
          customText = ta.value;
          const confirmBtn = host.querySelectorAll('.btn')[0];
          if (!confirmBtn) return;
          if (customText.trim()) confirmBtn.removeAttribute('disabled');
          else confirmBtn.setAttribute('disabled', 'disabled');
        });
        ta.focus();
      }
    }
    renderModal();
  }

  // ---------------- 주문 액션 ----------------
  function handleAccept(id) {
    const res = window.MockApi.acceptOrder(id);
    window.UI.toast('카카오 알림톡 발송: ' + res.notification);
    updateList();
  }

  // 키오스크 + VAN 결제건은 실물 카드가 있어야 취소·반품이 가능해 이 화면에서 처리할 수 없다
  function blockIfVanTabletPayment(order, proceed) {
    if (order && order.channel === 'TABLET' && order.paymentMethod === 'VAN') {
      window.UI.showModal({
        title: '실물 카드가 필요해요',
        message: "결제 취소에 '실물 카드'가 필요해요.<br/><strong>키오스크에서 취소</strong>해 주세요.",
        buttons: [{ label: '확인', variant: 'btn-primary' }],
      });
      return;
    }
    proceed();
  }

  function handleCancelOrder(id) {
    const order = window.MockApi.getOrder(id);
    blockIfVanTabletPayment(order, function () {
      openReasonModal(function (reason) {
        const res = window.MockApi.cancelOrder(id, reason);
        window.UI.toast('카카오 알림톡 발송: ' + res.notification);
        updateList();
      });
    });
  }

  function handleCallCustomer(id) {
    function proceed() {
      const res = window.MockApi.callCustomer(id);
      window.UI.toast('카카오 알림톡 발송: ' + res.notification);
      updateList();
    }
    const order = window.MockApi.getOrder(id);
    if (order && order.calledCount > 0) {
      window.UI.confirmModal(
        '다시 호출할까요?',
        '이미 호출한 주문건이에요. 다시 알림을 보낼까요?',
        '다시 호출하기',
        proceed
      );
      return;
    }
    proceed();
  }

  function handleComplete(id) {
    function proceed() {
      window.MockApi.completeOrder(id);
      updateList();
    }
    const order = window.MockApi.getOrder(id);
    if (order && !order.called) {
      window.UI.confirmModal(
        '호출 없이 완료할까요?',
        '아직 손님을 호출하지 않았어요. 호출 없이 주문을 완료 처리할까요?',
        '완료 처리하기',
        proceed
      );
      return;
    }
    proceed();
  }

  function handleCancelPayment(id) {
    const order = window.MockApi.getOrder(id);
    blockIfVanTabletPayment(order, function () {
      openReasonModal(function (reason) {
        const res = window.MockApi.cancelPayment(id, reason);
        window.UI.toast('카카오 알림톡 발송: ' + res.notification);
        updateList();
      });
    });
  }

  // 실수로 전화가 걸리거나 메일이 열리지 않도록, 이동 전에 한 번 확인한다
  function handleOpenContact(contact, isEmail) {
    if (!contact) return;
    window.UI.confirmModal(
      '손님 연락처로 이동하시겠어요?',
      contact,
      isEmail ? '메일 보내기' : '전화 걸기',
      function () { window.location.href = (isEmail ? 'mailto:' : 'tel:') + contact; },
      { cancelLabel: '닫기' }
    );
  }

  function handleRevert(id) {
    window.UI.confirmModal(
      '정말 주문을 되돌릴까요?',
      '주문이 처리중 상태로 돌아가요.',
      '되돌리기',
      function () {
        window.MockApi.revertOrder(id);
        updateList();
      },
      { cancelLabel: '닫기' }
    );
  }

  function handleReturn(id) {
    const order = window.MockApi.getOrder(id);
    function proceed() {
      openReasonModal(function (reason) {
        const res = window.MockApi.returnOrder(id, reason);
        window.UI.toast('카카오 알림톡 발송: ' + res.notification);
        updateList();
      });
    }
    blockIfVanTabletPayment(order, function () {
      window.UI.requirePasswordGate(storeId, 'paymentCancel', '결제 취소', proceed);
    });
  }

  function doBulkAccept() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    window.MockApi.bulkAction(ids, 'accept');
    window.UI.toast('카카오 알림톡 발송: 주문 완료 (' + ids.length + '건)');
    selectedIds = new Set();
    updateList();
  }

  function doBulkComplete() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    window.MockApi.bulkAction(ids, 'complete');
    selectedIds = new Set();
    updateList();
  }

  function doBulkCall() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    window.UI.confirmModal(
      '선택한 ' + ids.length + '건을 호출할까요?',
      '선택한 주문의 손님에게 픽업 안내 알림을 보내요.',
      '호출하기',
      function () {
        window.MockApi.bulkAction(ids, 'call');
        window.UI.toast('카카오 알림톡 발송: 픽업 안내 (' + ids.length + '건)');
        selectedIds = new Set();
        updateList();
      }
    );
  }

  // ---------------- 설정 / 오프라인 ----------------
  function onSettingsClick() {
    window.Router.showScreen('settings');
  }

  // 목록을 수동으로 다시 불러온다 — 회전 애니메이션으로 새로고침이 실행됐다는 걸 보여준다
  function handleRefresh(btn) {
    if (btn) {
      btn.classList.remove('spinning');
      void btn.offsetWidth;
      btn.classList.add('spinning');
    }
    updateList();
    window.UI.toast('주문 목록을 새로고침했어요');
  }

  // 영업중 ⇄ 일시중지 2단 순환. 잠금 설정이 되어 있으면 비밀번호 확인 후 변경한다.
  function handleToggleOperatingStatus() {
    const next = store.operatingStatus === 'OPEN' ? 'PAUSED' : 'OPEN';
    function apply() {
      store = window.MockApi.updateOperatingStatus(storeId, next);
      window.UI.toast(next === 'OPEN' ? '영업을 시작했어요' : '일시중지로 변경했어요');
      const pillBtn = root.querySelector('#status-pill-btn');
      if (pillBtn) pillBtn.innerHTML = window.UI.statusPillHtml(store.operatingStatus);
      updateList();
    }
    window.UI.requirePasswordGate(storeId, 'statusChange', '영업상태 변경', apply);
  }

  function refreshOfflineBanner() {
    const slot = root.querySelector('#offline-banner-slot');
    if (slot) slot.innerHTML = isOnline ? '' : offlineBannerHtml();
  }

  // 완전 단절(isOnline)과 희미한 신호(networkWeak) 중 하나라도 해당되면 경고 캡션을 보여준다.
  // 완전 단절이 아니면 주문 컨트롤은 그대로 두고 캡션 표시만 바꾼다.
  function refreshNetworkCaption() {
    const el = root.querySelector('#order-network-caption');
    if (!el) return;
    const warn = !isOnline || networkWeak;
    el.className = 'order-network-caption ' + (warn ? 'warn' : 'ok');
    el.textContent = warn ? '⚠️ 주의' : '원활';
  }

  function onNetworkQuality(e) {
    networkWeak = !!(e.detail && e.detail.weak);
    refreshNetworkCaption();
  }

  function refreshAutoSoldoutBanner() {
    const slot = root.querySelector('#auto-soldout-banner-slot');
    if (slot) slot.innerHTML = autoSoldoutBannerHtml();
  }

  // 해피아워는 주문 카드에 배지로 표시하지 않는 대신, 시작되는 순간 팝업으로 알린다(개발자 도구 시뮬레이션)
  function onHappyHourStarted(e) {
    const detail = e.detail || {};
    if (!detail.name) return;
    const timeRange = (detail.start && detail.end) ? (detail.start + '~' + detail.end) : '';
    const priceText = (detail.price != null) ? window.UI.formatMoney(detail.price) : '';
    const lines = [esc(detail.name) + ' 메뉴가 해피아워 할인가로 판매를 시작해요.'];
    if (priceText) lines.push('할인가 ' + priceText + (timeRange ? ' · ' + timeRange : ''));
    window.UI.showModal({
      title: '🔥 해피아워가 시작됐습니다',
      message: lines.join('<br/>'),
      buttons: [{ label: '확인', variant: 'btn-primary' }],
    });
  }

  // 주문 수락으로 준비량이 소진되어 자동 품절되면 하단 배너로 알린다
  function onAutoSoldout(e) {
    const names = (e.detail && e.detail.names) || [];
    if (!names.length) return;
    names.forEach(function (n) { if (autoSoldoutNames.indexOf(n) === -1) autoSoldoutNames.push(n); });
    refreshAutoSoldoutBanner();
  }

  function onOffline() { isOnline = false; refreshOfflineBanner(); refreshNetworkCaption(); updateList(); }
  function onOnline() { isOnline = true; refreshOfflineBanner(); refreshNetworkCaption(); updateList(); }
  // 폰 목업 바깥의 테스트 패널(devPanel.js)에서 주문을 추가했을 때 목록을 즉시 갱신한다.
  function onMockDataChanged() { updateList(); }

  // ---------------- 이벤트 위임 ----------------
  function onRootClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');
    if (action === 'open-settings') onSettingsClick();
    else if (action === 'refresh-orders') handleRefresh(target);
    else if (action === 'toggle-operating-status') handleToggleOperatingStatus();
    else if (action === 'dismiss-auto-soldout') {
      const dismissName = target.getAttribute('data-name');
      autoSoldoutNames = autoSoldoutNames.filter(function (n) { return n !== dismissName; });
      refreshAutoSoldoutBanner();
    }
    else if (action === 'open-contact') handleOpenContact(target.getAttribute('data-contact'), target.getAttribute('data-is-email') === '1');
    else if (action === 'switch-tab') switchTab(parseInt(target.getAttribute('data-tab-idx'), 10));
    else if (action === 'toggle-sort') toggleSort();
    else if (action === 'open-order-filter') openOrderFilterSheet();
    else if (action === 'toggle-call-status-panel') { callStatusPanelOpen = !callStatusPanelOpen; updateCallStatusUI(); }
    else if (action === 'toggle-card-expand') toggleCardExpand(target.getAttribute('data-order-id'));
    else if (action === 'accept-order') handleAccept(id);
    else if (action === 'cancel-order') handleCancelOrder(id);
    else if (action === 'call-customer') handleCallCustomer(id);
    else if (action === 'complete-order') handleComplete(id);
    else if (action === 'cancel-payment') handleCancelPayment(id);
    else if (action === 'revert-order') handleRevert(id);
    else if (action === 'return-order') handleReturn(id);
    else if (action === 'bulk-accept') doBulkAccept();
    else if (action === 'bulk-complete') doBulkComplete();
    else if (action === 'bulk-call') doBulkCall();
  }

  function toggleSort() {
    sortDir = sortDir === 'desc' ? 'asc' : 'desc';
    const btn = root.querySelector('#sort-btn');
    if (btn) btn.textContent = sortLabel() + ' ▾';
    updateList();
  }

  function onRootChange(e) {
    const target = e.target;
    if (!target || !target.matches) return;
    if (target.matches('input[data-action="bucket-select-all"]')) {
      const key = target.getAttribute('data-bucket');
      const orders = fetchOrders();
      const groups = window.UI.groupByBucket(orders, sortDir);
      const group = groups.find(function (g) { return String(g.key) === key; });
      if (group) {
        if (target.checked) group.orders.forEach(function (o) { selectedIds.add(o.id); });
        else group.orders.forEach(function (o) { selectedIds.delete(o.id); });
      }
      updateList();
    }
  }

  function onRootInput(e) {
    if (e.target && e.target.id === 'search-input') {
      searchQuery = e.target.value;
      updateList();
    }
  }

  // ---------------- render / mount ----------------
  function render(params) {
    user = window.MockApi.getCurrentUser();
    storeId = user.storeId;
    store = window.MockApi.getStore(storeId);

    tabs = computeTabs();
    currentIndex = 0;
    sortDir = 'desc';
    searchQuery = '';
    menuFilters = [];
    orderTypeFilters = [];
    calledFilter = 'ALL';
    callStatusPanelOpen = false;
    selectedIds = new Set();
    cardOverrides = {};
    autoSoldoutNames = [];
    isOnline = navigator.onLine && !(window.DevTools && window.DevTools.isOffline());
    networkWeak = false;

    const disabled = controlsDisabled();
    const orders = fetchOrders();
    const groups = window.UI.groupByBucket(orders, sortDir);

    return '' +
      '<style>' + SCOPED_STYLE + '</style>' +
      '<div class="topbar order-topbar-centered">' +
      '<button type="button" class="status-pill-btn" id="status-pill-btn" data-action="toggle-operating-status">' + window.UI.statusPillHtml(store.operatingStatus) + '</button>' +
      '<div class="topbar-title">' +
      '<span class="order-title-text">' + esc(store.name) + '</span>' +
      '<span class="order-network-caption ' + ((isOnline && !networkWeak) ? 'ok' : 'warn') + '" id="order-network-caption">' + ((isOnline && !networkWeak) ? '원활' : '⚠️ 주의') + '</span>' +
      '</div>' +
      '<button type="button" class="icon-btn" data-action="open-settings" aria-label="설정">⚙️</button>' +
      '</div>' +
      '<div id="offline-banner-slot">' + (isOnline ? '' : offlineBannerHtml()) + '</div>' +
      '<div id="auto-soldout-banner-slot">' + autoSoldoutBannerHtml() + '</div>' +
      '<div class="search-row">' +
      '<div class="search-box">' +
      '<span>🔍</span>' +
      '<input type="text" inputmode="numeric" id="search-input" placeholder="호출번호로 검색" value="' + esc(searchQuery) + '" />' +
      '</div>' +
      '<button type="button" class="refresh-btn" id="refresh-btn" data-action="refresh-orders" aria-label="주문 새로고침">🔄</button>' +
      '</div>' +
      '<div class="segment-tabs" id="segment-tabs">' + renderSegmentTabsHtml() + '</div>' +
      '<div class="order-toolbar-divider"></div>' +
      '<div class="toolbar">' +
      '<div class="toolbar-row">' +
      '<div class="toolbar-left-group">' +
      '<button type="button" class="pill-btn sort-pill" id="sort-btn" data-action="toggle-sort">' + sortLabel() + ' ▾</button>' +
      '<button type="button" class="pill-btn' + ((menuFilters.length || orderTypeFilters.length || calledFilter !== 'ALL') ? ' active' : '') + '" id="order-filter-btn" data-action="open-order-filter">' + filterBtnLabel() + '</button>' +
      '</div>' +
      '<div id="call-status-btn-slot">' + renderCallStatusButtonHtml() + '</div>' +
      '</div>' +
      '</div>' +
      '<div id="call-status-panel-slot">' + renderCallStatusPanelHtml() + '</div>' +
      '<div class="screen-scroll" id="order-scroll">' +
      '<div class="order-list" id="order-list-wrap">' + renderGroupsHtml(groups, orders, disabled) + '</div>' +
      '</div>' +
      '<div id="bulk-bar-slot">' + renderBulkBarHtml(disabled) + '</div>';
  }

  function mount(rootEl) {
    root = rootEl;
    root.addEventListener('click', onRootClick);
    root.addEventListener('change', onRootChange);
    root.addEventListener('input', onRootInput);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    window.addEventListener('mock:orders-changed', onMockDataChanged);
    window.addEventListener('mock:auto-soldout', onAutoSoldout);
    window.addEventListener('mock:network-quality', onNetworkQuality);
    window.addEventListener('mock:happy-hour-started', onHappyHourStarted);
  }

  function unmount() {
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('mock:orders-changed', onMockDataChanged);
    window.removeEventListener('mock:auto-soldout', onAutoSoldout);
    window.removeEventListener('mock:network-quality', onNetworkQuality);
    window.removeEventListener('mock:happy-hour-started', onHappyHourStarted);
    root = null;
  }

  window.Router.register('order', { render: render, mount: mount, unmount: unmount });
})();
