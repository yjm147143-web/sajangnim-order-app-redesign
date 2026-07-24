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
  let calledFilter = 'ALL';    // 'ALL' | 'CALLED' | 'NOT_CALLED' — 상단 필터 배지가 있던 자리에 노출
  let selectedIds = new Set();
  let cardOverrides = {};      // { [orderId:string]: boolean } 주문카드 단위 펼침 오버라이드 (기본값: 펼쳐짐)
  let isOnline = true;
  let autoSoldoutNames = [];   // 자동 품절 배너에 노출 중인 메뉴명 목록 (X로 닫으면 비움)
  let root = null;

  const SCOPED_STYLE = '' +
    '.topbar-title { max-width: 62%; display: flex; align-items: center; gap: 6px; overflow: visible; }' +
    '.order-title-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }' +
    '.order-card-actions.three { flex-wrap: wrap; }' +
    '.order-card-actions.three .btn { font-size: 11.5px; padding: 0 4px; flex: 1 1 30%;' +
      ' display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; white-space: nowrap; }' +
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
    '.search-row { display: flex; align-items: center; gap: var(--space-2); }' +
    '.search-row .search-box { flex: 1; min-width: 0; }' +
    '.sort-pill { flex-shrink: 0; }' +
    '.order-card-divider { position: relative; border-top: 1px dashed var(--color-disabled); margin-top: var(--space-3); height: 0; }' +
    '.card-expand-toggle {' +
      ' position: absolute; right: 0; top: -11px; width: 22px; height: 22px;' +
      ' border: 1.5px solid var(--color-disabled); border-radius: 50%; background: var(--color-white);' +
      ' color: var(--color-text-secondary); font-size: 10px; line-height: 1;' +
      ' display: flex; align-items: center; justify-content: center; padding: 0; cursor: pointer; }' +
    '.top-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }' +
    '.elapsed-badge.reservation { background: var(--color-accent-blue-bg); color: var(--color-accent-blue); border-color: rgba(92,130,232,0.35); }' +
    '.sort-kitchen-col { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }' +
    '.kitchen-board-btn { font-size: 11.5px; height: 30px; }' +
    '.called-filter-seg { display: flex; gap: 2px; background: var(--color-divider); border-radius: var(--radius-pill); padding: 3px; }' +
    '.called-filter-seg .segment-tab-sm { padding: 6px 10px; }' +
    '.called-filter-seg .segment-tab-sm.active { background: var(--color-white); color: var(--color-text-primary); box-shadow: 0 1px 3px rgba(30,29,43,0.12); }' +
    '.action-count-badge { padding: 1px 7px; font-size: 10px; }' +
    '.cancel-done-badge { width: 100%; justify-content: center; padding: 12px; font-size: var(--font-size-caption); font-weight: 700; }' +
    '.line-name.reusable { color: var(--color-accent-green); font-weight: 700; }' +
    '.order-card.selected { background: var(--color-accent-blue-bg); box-shadow: inset 0 0 0 1.5px var(--color-accent-blue); }' +
    '.refresh-btn { background: none; border: none; padding: 4px; cursor: pointer; font-size: 18px; line-height: 1; flex-shrink: 0; }' +
    '.refresh-btn.spinning { animation: order-refresh-spin 0.6s linear; }' +
    '@keyframes order-refresh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';

  // ---------------- 탭 구성 ----------------
  // 자동수락 ON이면 신규 주문이 대기 없이 바로 처리중으로 인입되므로 대기 탭 자체를 숨긴다.
  // OFF면 대기 탭을 포함한 3개 탭을 모두 노출한다.
  function computeTabs() {
    if (store.autoAcceptOrders) {
      return [{ status: 'PROCESSING', label: '처리중' }, { status: 'DONE', label: '완료' }];
    }
    return [{ status: 'WAITING', label: '미수락' }, { status: 'PROCESSING', label: '처리중' }, { status: 'DONE', label: '완료' }];
  }

  function indexOfStatus(status) {
    return tabs.findIndex(function (t) { return t.status === status; });
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

  // 호출번호 검색은 탭을 넘나들며 유지되므로, 탭 옆 건수 뱃지도 검색어가 반영된 값으로 보여준다
  function tabCount(status) {
    return window.MockApi.getOrders(storeId, { status: status, search: searchQuery || undefined }).length;
  }

  // ---------------- 펼침 상태 ----------------
  // 시간대 그룹 단위 간단히보기/펼쳐보기는 삭제하고, 카드마다 개별 화살표로만 펼침 상태를 다룬다 (기본값: 펼쳐짐)
  function isCardExpanded(orderId) {
    if (Object.prototype.hasOwnProperty.call(cardOverrides, orderId)) return cardOverrides[orderId];
    return true;
  }

  function toggleCardExpand(orderId) {
    cardOverrides[orderId] = !isCardExpanded(orderId);
    updateList();
  }

  // 메뉴 수량·이름·옵션 전체 목록 — '간단히 보기' 상태에서도 항상 노출된다 (수량이 먼저, 메뉴명이 뒤에)
  // 다회용기 주문은 별도 뱃지 대신, 각 메뉴명 앞에 ♻️를 붙이고 메뉴명 글자를 초록색으로 강조한다
  function itemListHtml(order) {
    const isReusable = !!order.isReusableContainer;
    return (order.items || []).map(function (it) {
      const optHtml = (it.optionNames && it.optionNames.length)
        ? '<span class="line-option">' + it.optionNames.map(function (o) { return esc(o); }).join(', ') + '</span>'
        : '';
      return '<div class="order-card-menu-line">' +
        '<span class="line-qty">' + it.quantity + '개</span>' +
        '<span class="line-name' + (isReusable ? ' reusable' : '') + '">' + (isReusable ? '♻️ ' : '') + esc(it.menuName) + '</span>' +
        optHtml +
        '</div>';
    }).join('');
  }

  // ---------------- 렌더 조각들 ----------------
  function renderSegmentTabsHtml() {
    return tabs.map(function (t, i) {
      return '<button type="button" class="segment-tab' + (i === currentIndex ? ' active' : '') + '" data-action="switch-tab" data-tab-idx="' + i + '">' +
        esc(t.label) + ' <span class="count">' + tabCount(t.status) + '</span></button>';
    }).join('');
  }

  function sortLabel() { return sortDir === 'desc' ? '최신순' : '오래된순'; }

  function offlineBannerHtml() {
    return '<div class="offline-banner">📶 오프라인 상태예요 · 네트워크가 연결되면 다시 사용할 수 있어요</div>';
  }

  function autoSoldoutBannerHtml() {
    if (!autoSoldoutNames.length) return '';
    const first = esc(autoSoldoutNames[0]);
    const label = autoSoldoutNames.length > 1 ? first + ' 외 ' + (autoSoldoutNames.length - 1) + '개 메뉴가' : first + ' 메뉴가';
    return '<div class="auto-soldout-banner">' +
      '<span>⚠️ ' + label + ' 자동 품절됐어요.</span>' +
      '<button type="button" class="auto-soldout-banner-close" data-action="dismiss-auto-soldout" aria-label="닫기">✕</button>' +
      '</div>';
  }

  // 호출/완료 횟수는 0회일 때는 굳이 보여줄 필요가 없어 숨기고, 1회부터는 버튼 옆 작은 뱃지로 노출한다
  function countBadgeHtml(n) {
    return n > 0 ? '<span class="badge badge-success-soft action-count-badge">' + n + '회</span>' : '';
  }

  function renderActionsHtml(order, tabStatus, disabled) {
    const dAttr = disabled ? ' disabled' : '';
    if (tabStatus === 'WAITING') {
      return '<div class="order-card-actions">' +
        '<button type="button" class="btn btn-outline" data-action="cancel-order" data-id="' + order.id + '"' + dAttr + '>주문 거절</button>' +
        '<button type="button" class="btn btn-primary" data-action="accept-order" data-id="' + order.id + '"' + dAttr + '>주문 수락</button>' +
        '</div>';
    }
    if (tabStatus === 'PROCESSING') {
      return '<div class="order-card-actions three">' +
        '<button type="button" class="btn btn-outline" data-action="call-customer" data-id="' + order.id + '"' + dAttr + '>손님 호출' + countBadgeHtml(order.calledCount || 0) + '</button>' +
        '<button type="button" class="btn btn-danger-solid" data-action="cancel-payment" data-id="' + order.id + '"' + dAttr + '>결제 취소</button>' +
        '<button type="button" class="btn btn-primary" data-action="complete-order" data-id="' + order.id + '"' + dAttr + '>완료' + countBadgeHtml(order.completeCount || 0) + '</button>' +
        '</div>';
    }
    // 완료 탭에서 취소/반품 처리된 건은 되돌리기·결제취소 버튼 대신, 처리 완료 시각이 담긴 뱃지로 대체한다
    if (order.canceled) {
      const timeLabel = order.cancelledAt ? ' (' + window.UI.clockLabelWithSeconds(order.cancelledAt) + ')' : '';
      const doneLabel = order.cancelType === 'CANCEL' ? '주문 취소 완료' : '결제 취소 완료';
      return '<div class="order-card-actions"><span class="badge badge-neutral cancel-done-badge">' + doneLabel + timeLabel + '</span></div>';
    }
    return '<div class="order-card-actions">' +
      '<button type="button" class="btn btn-outline" data-action="revert-order" data-id="' + order.id + '"' + dAttr + '>되돌리기</button>' +
      '<button type="button" class="btn btn-danger-solid" data-action="return-order" data-id="' + order.id + '"' + dAttr + '>결제 취소</button>' +
      '</div>';
  }

  function topBadgesHtml(order) {
    if (order.isReservation) {
      const resTime = new Date(order.reservationTime || order.orderedAt).getTime();
      const overdueMins = Math.round((Date.now() - resTime) / 60000);
      const isOverdue = overdueMins > 0;
      let html = '<span class="elapsed-badge reservation">📅 예약 ' + window.UI.clockLabel(order.reservationTime || order.orderedAt) + '</span>';
      if (isOverdue) {
        const urgencyCls = overdueMins >= 10 ? 'urgent' : 'normal';
        html += '<span class="elapsed-badge ' + urgencyCls + '">● ' + overdueMins + '분 지남</span>';
      }
      return html;
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
    const channelHtml = window.UI.channelBadgeHtml(order.channel);
    const deliveryHtml = order.identifierType === 'SEAT' ? '<span class="badge badge-neutral">🛵 배달 주문</span>' : '';
    const promoHtml = window.UI.promoBadgeHtml(order.promoType);
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

    // 점선 구분선 오른쪽 하단의 화살표로 이 카드만 펼쳐보기/간단히보기를 개별 전환할 수 있다
    html += '<div class="order-card-divider">' +
      '<button type="button" class="card-expand-toggle" data-action="toggle-card-expand" data-order-id="' + order.id + '">' + (expanded ? '▲' : '▼') + '</button>' +
      '</div>';

    // 연락처/결제수단/주문번호는 '펼쳐보기'에서만 노출한다 (접수·예약시각은 상단 배지로 이동)
    if (expanded) {
      const contact = window.UI.formatContact(order.customerContact);
      const isEmailContact = (order.customerContact || '').indexOf('@') !== -1;
      const contactIcon = isEmailContact ? '✉️' : '📞';
      const contactHtml = '<button type="button" class="phone-btn" data-action="open-contact" data-contact="' + esc(order.customerContact) + '" data-is-email="' + (isEmailContact ? '1' : '0') + '">' + contactIcon + ' ' + esc(contact) + '</button>';
      html += '<div class="order-card-meta">' +
        '<div class="meta-row"><span class="meta-label">연락처</span><span class="meta-value">' + contactHtml + '</span></div>' +
        '<div class="meta-row"><span class="meta-label">결제</span><span class="meta-value">' + esc(order.paymentMethod) + ' · ' + window.UI.formatMoney(order.amount) + '</span></div>' +
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
    const groups = window.UI.groupByBucket(orders);
    const wrap = root.querySelector('#order-list-wrap');
    const hasBulkBar = currentStatus() !== 'DONE' && selectedIds.size > 0;
    wrap.className = 'order-list' + (hasBulkBar ? ' with-bulk-bar' : '');
    wrap.innerHTML = renderGroupsHtml(groups, orders, disabled);
    const bulkSlot = root.querySelector('#bulk-bar-slot');
    if (bulkSlot) bulkSlot.innerHTML = renderBulkBarHtml(disabled);
    const tabsEl = root.querySelector('#segment-tabs');
    if (tabsEl) tabsEl.innerHTML = renderSegmentTabsHtml();
  }

  const ORDER_TYPE_LABELS = { RESERVATION: '예약 주문만', DELIVERY: '배달 주문' };

  // 주문 방식 관리(설정)에서 꺼둔 유형은 필터 목록에서도 숨긴다 — 받지도 않는 유형을 필터로 보여주는 건 혼란스럽다
  function getOrderTypeOptions() {
    const settings = window.MockApi.getOrderChannelSettings(storeId);
    const opts = [];
    if (settings.acceptReservationOrders) opts.push({ v: 'RESERVATION', label: ORDER_TYPE_LABELS.RESERVATION });
    if (settings.acceptSeatOrders) opts.push({ v: 'DELIVERY', label: ORDER_TYPE_LABELS.DELIVERY });
    return opts;
  }

  const CALLED_FILTER_OPTIONS = [
    { v: 'ALL', label: '전체' },
    { v: 'CALLED', label: '호출' },
    { v: 'NOT_CALLED', label: '미호출' },
  ];

  // 대기 탭은 아직 호출 개념이 없으므로 배지 자체를 숨긴다
  function calledFilterHtml() {
    if (currentStatus() === 'WAITING') return '';
    return '<div class="called-filter-seg" id="called-filter-seg">' +
      CALLED_FILTER_OPTIONS.map(function (o) {
        return '<button type="button" class="segment-tab-sm' + (calledFilter === o.v ? ' active' : '') + '" data-action="set-called-filter" data-called-filter="' + o.v + '">' + o.label + '</button>';
      }).join('') +
      '</div>';
  }

  function refreshCalledFilterBadge() {
    const slot = root.querySelector('#called-filter-slot');
    if (slot) slot.innerHTML = calledFilterHtml();
  }

  function filterBtnLabel() {
    const parts = menuFilters.concat(orderTypeFilters.map(function (t) { return ORDER_TYPE_LABELS[t] || t; }));
    if (parts.length === 1) return parts[0];
    if (parts.length >= 2) return parts[0] + ' +' + (parts.length - 1);
    return '주문 필터';
  }

  function updateFilterBtnLabel() {
    const btn = root.querySelector('#order-filter-btn');
    if (!btn) return;
    btn.textContent = filterBtnLabel();
    btn.classList.toggle('active', menuFilters.length > 0 || orderTypeFilters.length > 0);
  }

  // 호출번호 검색은 미수락/처리중/완료 탭을 넘나들며 유지된다 — 탭을 옮겨도 검색어를 지우지 않는다
  function switchTab(idx) {
    if (idx < 0 || idx >= tabs.length) return;
    currentIndex = idx;
    selectedIds = new Set();
    menuFilters = [];
    orderTypeFilters = [];
    calledFilter = 'ALL';
    updateFilterBtnLabel();
    refreshCalledFilterBadge();
    updateList();
  }

  // ---------------- 주문 필터 바텀시트 (메뉴별 + 주문 유형별, 각 카테고리 내에서도 중복 선택 가능) ----------------
  // 두 카테고리를 서로 배타적인 탭으로 나누지 않고, 각각 다중 선택 가능한 칩으로 노출한 뒤
  // '적용'을 눌러야 실제로 반영되도록 해 다양한 조합(메뉴+메뉴, 유형+유형, 메뉴+유형)을 자유롭게 시도해볼 수 있게 한다.
  function openOrderFilterSheet() {
    let draftMenus = menuFilters.slice();
    let draftTypes = orderTypeFilters.slice();
    const ordersInTab = window.MockApi.getOrders(storeId, { status: currentStatus() });
    const menuNames = [];
    ordersInTab.forEach(function (o) {
      o.items.forEach(function (it) {
        if (menuNames.indexOf(it.menuName) === -1) menuNames.push(it.menuName);
      });
    });

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
      const menuRow = host.querySelector('#menu-chip-row');
      const typeRow = host.querySelector('#type-chip-row');

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

      bindMenuChips();
      bindTypeChips();

      host.querySelector('#filter-reset-btn').addEventListener('click', function () {
        draftMenus = [];
        draftTypes = [];
        menuRow.innerHTML = menuChipsHtml();
        typeRow.innerHTML = typeChipsHtml();
        bindMenuChips();
        bindTypeChips();
      });

      host.querySelector('#filter-apply-btn').addEventListener('click', function () {
        menuFilters = draftMenus;
        orderTypeFilters = draftTypes;
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
    switchTab(indexOfStatus('PROCESSING'));
  }

  // 키오스크 + VAN 결제건은 실물 카드가 있어야 취소·반품이 가능해 이 화면에서 처리할 수 없다
  function blockIfVanTabletPayment(order, proceed) {
    if (order && order.channel === 'TABLET' && order.paymentMethod === 'VAN') {
      window.UI.showModal({
        title: '실물 카드가 필요해요',
        message: "결제 취소에 '실물 카드'가 필요해요. 키오스크에서 취소해 주세요.",
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
        switchTab(indexOfStatus('DONE'));
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
      switchTab(indexOfStatus('DONE'));
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
        switchTab(indexOfStatus('DONE'));
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
      '정말 되돌릴까요?',
      '처리중 상태로 되돌리면 완료 처리를 다시 해야 해요.',
      '되돌리기',
      function () {
        window.MockApi.revertOrder(id);
        switchTab(indexOfStatus('PROCESSING'));
      }
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
    switchTab(indexOfStatus('PROCESSING'));
  }

  function doBulkComplete() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    window.MockApi.bulkAction(ids, 'complete');
    switchTab(indexOfStatus('DONE'));
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

  function refreshAutoSoldoutBanner() {
    const slot = root.querySelector('#auto-soldout-banner-slot');
    if (slot) slot.innerHTML = autoSoldoutBannerHtml();
  }

  // 주문 수락으로 준비량이 소진되어 자동 품절되면 하단 배너로 알린다
  function onAutoSoldout(e) {
    const names = (e.detail && e.detail.names) || [];
    if (!names.length) return;
    names.forEach(function (n) { if (autoSoldoutNames.indexOf(n) === -1) autoSoldoutNames.push(n); });
    refreshAutoSoldoutBanner();
  }

  function onOffline() { isOnline = false; refreshOfflineBanner(); updateList(); }
  function onOnline() { isOnline = true; refreshOfflineBanner(); updateList(); }
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
    else if (action === 'dismiss-auto-soldout') { autoSoldoutNames = []; refreshAutoSoldoutBanner(); }
    else if (action === 'open-contact') handleOpenContact(target.getAttribute('data-contact'), target.getAttribute('data-is-email') === '1');
    else if (action === 'open-kitchen-board') window.Router.showScreen('kitchenBoard');
    else if (action === 'switch-tab') switchTab(parseInt(target.getAttribute('data-tab-idx'), 10));
    else if (action === 'toggle-sort') toggleSort();
    else if (action === 'open-order-filter') openOrderFilterSheet();
    else if (action === 'set-called-filter') { calledFilter = target.getAttribute('data-called-filter'); refreshCalledFilterBadge(); updateList(); }
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
      const groups = window.UI.groupByBucket(orders);
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
    selectedIds = new Set();
    cardOverrides = {};
    autoSoldoutNames = [];
    isOnline = navigator.onLine && !(window.DevTools && window.DevTools.isOffline());

    const disabled = controlsDisabled();
    const orders = fetchOrders();
    const groups = window.UI.groupByBucket(orders);

    return '' +
      '<style>' + SCOPED_STYLE + '</style>' +
      '<div class="topbar">' +
      '<div class="topbar-side">' +
      '<button type="button" class="status-pill-btn" id="status-pill-btn" data-action="toggle-operating-status">' + window.UI.statusPillHtml(store.operatingStatus) + '</button>' +
      '</div>' +
      '<div class="topbar-title">' +
      '<span class="order-title-text">' + esc(store.name) + '</span>' +
      '<button type="button" class="refresh-btn" id="refresh-btn" data-action="refresh-orders" aria-label="주문 새로고침">🔄</button>' +
      '</div>' +
      '<div class="topbar-side" style="justify-content:flex-end;">' +
      '<button type="button" class="icon-btn" data-action="open-settings" aria-label="설정">⚙️</button>' +
      '</div>' +
      '</div>' +
      '<div id="offline-banner-slot">' + (isOnline ? '' : offlineBannerHtml()) + '</div>' +
      '<div id="auto-soldout-banner-slot">' + autoSoldoutBannerHtml() + '</div>' +
      '<div class="segment-tabs" id="segment-tabs">' + renderSegmentTabsHtml() + '</div>' +
      '<div class="toolbar">' +
      '<div class="search-row">' +
      '<div class="search-box">' +
      '<span>🔍</span>' +
      '<input type="text" inputmode="numeric" id="search-input" placeholder="호출번호로 검색" value="' + esc(searchQuery) + '" />' +
      '</div>' +
      '<div class="sort-kitchen-col">' +
      '<button type="button" class="pill-btn sort-pill" id="sort-btn" data-action="toggle-sort">' + sortLabel() + ' ▾</button>' +
      '<button type="button" class="pill-btn kitchen-board-btn" data-action="open-kitchen-board">🍳 조리 현황판</button>' +
      '</div>' +
      '</div>' +
      '<div class="toolbar-row">' +
      '<button type="button" class="pill-btn' + ((menuFilters.length || orderTypeFilters.length) ? ' active' : '') + '" id="order-filter-btn" data-action="open-order-filter">' + filterBtnLabel() + '</button>' +
      '<div id="called-filter-slot">' + calledFilterHtml() + '</div>' +
      '</div>' +
      '</div>' +
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
  }

  function unmount() {
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('mock:orders-changed', onMockDataChanged);
    window.removeEventListener('mock:auto-soldout', onAutoSoldout);
    root = null;
  }

  window.Router.register('order', { render: render, mount: mount, unmount: unmount });
})();
