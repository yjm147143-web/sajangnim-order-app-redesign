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
  let sortDir = 'desc';   // 접수 시간 기준, 기본 내림차순(최신 위)
  let searchQuery = '';
  let menuFilter = null;
  let orderTypeFilter = null;  // null | 'RESERVATION' | 'DELIVERY' | 'CALLED' | 'NOT_CALLED'
  let selectedIds = new Set();
  let expandedAll = true;      // 전체 펼쳐보기 기본값
  let bucketOverrides = {};    // { [bucketKey:string]: boolean } 시간대 그룹 단위 펼침 오버라이드
  let isOnline = true;
  let root = null;

  const SCOPED_STYLE = '' +
    '.topbar-title { max-width: 56%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
    '.order-card-actions.three { flex-wrap: wrap; }' +
    '.order-card-actions.three .btn { font-size: 11.5px; padding: 0 4px; flex: 1 1 30%; }' +
    '.reason-pill-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }' +
    '.reason-textarea { margin-top: 4px; }' +
    '.order-list.with-bulk-bar { padding-bottom: 88px; }' +
    '#bulk-bar-slot:empty { display: none; }' +
    '.kitchen-board-pill { background: var(--color-accent-amber-bg); color: #a15c00; font-weight: 800; }' +
    '.filter-section { margin-bottom: 18px; }' +
    '.filter-section-title { font-size: var(--font-size-caption); font-weight: 800; color: var(--color-text-secondary); margin-bottom: 10px; }' +
    '.filter-chip-row { display: flex; gap: 8px; flex-wrap: wrap; }' +
    '.filter-chip { padding: 9px 14px; border: 1.5px solid var(--color-disabled); border-radius: var(--radius-pill);' +
      ' background: var(--color-white); font-size: var(--font-size-caption); font-weight: 700; color: var(--color-text-secondary); cursor: pointer; }' +
    '.filter-chip.on { border-color: var(--color-accent-blue); background: var(--color-accent-blue-bg); color: var(--color-accent-blue); }' +
    '.filter-sheet-actions { display: flex; gap: 8px; margin-top: 8px; }' +
    '.filter-sheet-actions .btn { height: 48px; }';

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
      menuFilter: menuFilter || undefined,
      orderTypeFilter: orderTypeFilter || undefined,
      search: searchQuery || undefined,
      sortDir: sortDir,
    });
  }

  function tabCount(status) {
    return window.MockApi.getOrders(storeId, { status: status }).length;
  }

  // ---------------- 펼침 상태 ----------------
  function isBucketExpanded(key) {
    const k = String(key);
    if (Object.prototype.hasOwnProperty.call(bucketOverrides, k)) return bucketOverrides[k];
    return expandedAll;
  }

  function toggleBucketExpand(key) {
    const k = String(key);
    bucketOverrides[k] = !isBucketExpanded(k);
    updateList();
  }

  function toggleExpandAll() {
    expandedAll = !expandedAll;
    bucketOverrides = {};
    const label = root.querySelector('#expand-all-toggle');
    if (label) label.textContent = expandedAll ? '간단히 보기' : '펼쳐보기';
    updateList();
  }

  // 메뉴 수량·이름·옵션 전체 목록 — '간단히 보기' 상태에서도 항상 노출된다 (수량이 먼저, 메뉴명이 뒤에)
  function itemListHtml(order) {
    return (order.items || []).map(function (it) {
      const optHtml = (it.optionNames && it.optionNames.length)
        ? '<span class="line-option">' + it.optionNames.map(function (o) { return esc(o); }).join(', ') + '</span>'
        : '';
      return '<div class="order-card-menu-line">' +
        '<span class="line-qty">' + it.quantity + '개</span>' +
        '<span class="line-name">' + esc(it.menuName) + '</span>' +
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

  function renderCheckboxHtml(order, tabStatus, disabled) {
    if (tabStatus === 'DONE') return '';
    const checked = selectedIds.has(order.id) ? ' checked' : '';
    return '<label class="order-checkbox-label"><input type="checkbox" data-action="card-select" data-id="' + order.id + '"' + checked + (disabled ? ' disabled' : '') + ' /></label>';
  }

  function renderActionsHtml(order, tabStatus, disabled) {
    const dAttr = disabled ? ' disabled' : '';
    if (tabStatus === 'WAITING') {
      return '<div class="order-card-actions">' +
        '<button type="button" class="btn btn-outline" data-action="cancel-order" data-id="' + order.id + '"' + dAttr + '>주문 취소</button>' +
        '<button type="button" class="btn btn-primary" data-action="accept-order" data-id="' + order.id + '"' + dAttr + '>주문 수락</button>' +
        '</div>';
    }
    if (tabStatus === 'PROCESSING') {
      return '<div class="order-card-actions three">' +
        '<button type="button" class="btn btn-outline" data-action="call-customer" data-id="' + order.id + '"' + dAttr + '>고객 호출 (' + (order.calledCount || 0) + '회)</button>' +
        '<button type="button" class="btn btn-danger-solid" data-action="cancel-payment" data-id="' + order.id + '"' + dAttr + '>결제 취소</button>' +
        '<button type="button" class="btn btn-primary" data-action="complete-order" data-id="' + order.id + '"' + dAttr + '>완료 (' + (order.completeCount || 0) + '회)</button>' +
        '</div>';
    }
    return '<div class="order-card-actions">' +
      '<button type="button" class="btn btn-outline" data-action="revert-order" data-id="' + order.id + '"' + dAttr + '>되돌리기</button>' +
      '<button type="button" class="btn btn-danger-solid" data-action="return-order" data-id="' + order.id + '"' + dAttr + '>결제 취소</button>' +
      '</div>';
  }

  function renderOrderCard(order, tabStatus, disabled) {
    const bucketKey = order.isReservation ? 'RESERVED' : window.UI.bucketKeyOf(order.orderedAt);
    const expanded = isBucketExpanded(bucketKey);
    const cls = 'order-card' + (order.canceled ? ' canceled' : '');
    let html = '<div class="' + cls + '">';

    // 상단 상태 행: 경과시간(좌, 오래될수록 강조색) + 픽업번호(우) — 조리 우선순위와 픽업 정보를 한눈에
    const mins = window.UI.elapsedMinutes(order.orderedAt);
    const urgencyCls = mins >= 10 ? 'urgent' : 'normal';
    html += '<div class="order-card-top-row">' +
      '<span class="elapsed-badge ' + urgencyCls + '">● ' + window.UI.elapsedLabel(order.orderedAt) + '</span>' +
      '<span class="pickup-inline"><span class="pickup-label">' + (order.identifierType === 'SEAT' ? '좌석' : '픽업') + '</span><span class="pickup-value">' + esc(order.pickupNo) + '</span></span>' +
      '</div>';

    const checkboxHtml = renderCheckboxHtml(order, tabStatus, disabled);
    // 주문채널·프로모션 뱃지는 한눈에 파악해야 할 핵심 정보라 '간단히 보기'에서도 항상 노출한다
    const channelHtml = window.UI.channelBadgeHtml(order.channel);
    const promoHtml = window.UI.promoBadgeHtml(order.promoType);
    const reservationHtml = (expanded && order.isReservation) ? window.UI.reservationBadgeHtml() : '';
    const reusableHtml = (expanded && order.isReusableContainer) ? window.UI.reusableContainerBadgeHtml() : '';
    if (checkboxHtml || channelHtml || reservationHtml || reusableHtml || promoHtml) {
      html += '<div class="order-card-header-row">' + checkboxHtml + channelHtml + reservationHtml + reusableHtml + promoHtml + '</div>';
    }

    html += '<div class="order-card-items">' + itemListHtml(order) + '</div>';

    // 고객 요청(메모)은 조리 시 바로 확인해야 하는 정보라 '간단히 보기'에서도 항상 노출한다
    if (order.customerNote) {
      html += '<div class="order-card-note">💬 ' + esc(order.customerNote) + '</div>';
    }
    if (order.canceled) {
      const typeLabel = order.cancelType === 'RETURN' ? '결제 취소' : (order.cancelType === 'PAYMENT_CANCEL' ? '결제취소' : '주문취소');
      html += '<div class="order-card-cancel-reason">[' + typeLabel + '] ' + esc(order.cancelReason || '') + '</div>';
    }

    // 접수시간 등 상세 정보는 key-value 리스트로 정리. 연락처/결제수단/주문번호는 '펼쳐보기'에서만 노출한다
    html += '<div class="order-card-meta">';
    if (order.isReservation) {
      html += '<div class="meta-row"><span class="meta-label">예약</span><span class="meta-value reservation">' + window.UI.clockLabel(order.reservationTime || order.orderedAt) + ' 수령</span></div>';
    }
    html += '<div class="meta-row"><span class="meta-label">접수</span><span class="meta-value">' + window.UI.clockLabel(order.orderedAt) + '</span></div>';
    if (expanded) {
      const contact = window.UI.formatContact(order.customerContact);
      const isEmailContact = (order.customerContact || '').indexOf('@') !== -1;
      const contactHtml = isEmailContact ? esc(contact) : ('<a href="tel:' + esc(order.customerContact) + '" class="phone-btn">📞 ' + esc(contact) + '</a>');
      html += '<div class="meta-row"><span class="meta-label">연락처</span><span class="meta-value">' + contactHtml + '</span></div>' +
        '<div class="meta-row"><span class="meta-label">결제</span><span class="meta-value">' + esc(order.paymentMethod) + ' · ' + window.UI.formatMoney(order.amount) + '</span></div>' +
        '<div class="meta-row"><span class="meta-label">주문번호</span><span class="meta-value">' + esc(order.paymentOrderNo) + '</span></div>';
    }
    html += '</div>';

    // 주문취소/결제취소/반품 처리된 완료 탭 건은 되돌리기·반품 버튼을 비활성화한다
    const actionsDisabled = disabled || (tabStatus === 'DONE' && order.canceled);
    html += renderActionsHtml(order, tabStatus, actionsDisabled);
    html += '</div>';
    return html;
  }

  function renderBucketHeader(group, tabStatus, disabled) {
    const showCheckbox = tabStatus !== 'DONE';
    const allSelected = showCheckbox && group.orders.length > 0 && group.orders.every(function (o) { return selectedIds.has(o.id); });
    const expanded = isBucketExpanded(group.key);
    return '<div class="bucket-header">' +
      '<div class="bucket-header-left">' +
      (showCheckbox ? '<input type="checkbox" data-action="bucket-select-all" data-bucket="' + group.key + '"' + (allSelected ? ' checked' : '') + (disabled ? ' disabled' : '') + ' />' : '') +
      '<span class="bucket-label">' + group.label + (group.isReservationGroup ? '' : ' (5분 단위)') + '</span>' +
      '</div>' +
      '<div class="bucket-toggle-label" data-action="toggle-bucket-expand" data-bucket="' + group.key + '">' + (expanded ? '간단히 보기' : '펼쳐보기') + '</div>' +
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
      '<button type="button" class="btn btn-outline" data-action="bulk-call"' + dAttr + '>선택 ' + n + '건 고객 호출</button>' +
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

  const ORDER_TYPE_OPTIONS = [
    { v: '', label: '전체' },
    { v: 'RESERVATION', label: '예약 주문만' },
    { v: 'DELIVERY', label: '배달 주문' },
    { v: 'CALLED', label: '호출' },
    { v: 'NOT_CALLED', label: '미호출' },
  ];
  const ORDER_TYPE_LABELS = { RESERVATION: '예약 주문만', DELIVERY: '배달 주문', CALLED: '호출', NOT_CALLED: '미호출' };

  function updateFilterBtnLabel() {
    const btn = root.querySelector('#order-filter-btn');
    if (!btn) return;
    const parts = [];
    if (menuFilter) parts.push(menuFilter);
    if (orderTypeFilter) parts.push(ORDER_TYPE_LABELS[orderTypeFilter] || '');
    let label = '주문 필터';
    if (parts.length === 1) label = parts[0];
    else if (parts.length >= 2) label = parts[0] + ' +' + (parts.length - 1);
    btn.textContent = label;
    btn.classList.toggle('active', parts.length > 0);
  }

  function switchTab(idx) {
    if (idx < 0 || idx >= tabs.length) return;
    currentIndex = idx;
    selectedIds = new Set();
    searchQuery = '';
    menuFilter = null;
    orderTypeFilter = null;
    const input = root.querySelector('#search-input');
    if (input) input.value = '';
    updateFilterBtnLabel();
    updateList();
  }

  // ---------------- 주문 필터 바텀시트 (메뉴별 필터 + 주문 유형별 필터를 동시에 적용 가능) ----------------
  // 두 필터를 서로 배타적인 탭으로 나누지 않고, 한 화면에서 각자 독립적으로 고르게 한 뒤
  // '적용'을 눌러야 실제로 반영되도록 해 두 조건을 자유롭게 조합해볼 수 있게 한다.
  function openOrderFilterSheet() {
    let draftMenu = menuFilter;
    let draftType = orderTypeFilter;
    const ordersInTab = window.MockApi.getOrders(storeId, { status: currentStatus() });
    const menuNames = [];
    ordersInTab.forEach(function (o) {
      o.items.forEach(function (it) {
        if (menuNames.indexOf(it.menuName) === -1) menuNames.push(it.menuName);
      });
    });

    function menuChipsHtml() {
      const allChip = '<button type="button" class="filter-chip' + (!draftMenu ? ' on' : '') + '" data-menu="">전체</button>';
      if (!menuNames.length) return allChip;
      return allChip + menuNames.map(function (name) {
        return '<button type="button" class="filter-chip' + (draftMenu === name ? ' on' : '') + '" data-menu="' + esc(name) + '">' + esc(name) + '</button>';
      }).join('');
    }

    function typeChipsHtml() {
      return ORDER_TYPE_OPTIONS.map(function (o) {
        return '<button type="button" class="filter-chip' + ((draftType || '') === o.v ? ' on' : '') + '" data-order-type="' + o.v + '">' + o.label + '</button>';
      }).join('');
    }

    const bodyHtml =
      '<div class="sheet-title">주문 필터</div>' +
      '<div class="filter-section">' +
        '<div class="filter-section-title">메뉴</div>' +
        '<div class="filter-chip-row" id="menu-chip-row">' + menuChipsHtml() + '</div>' +
      '</div>' +
      '<div class="filter-section">' +
        '<div class="filter-section-title">주문 유형</div>' +
        '<div class="filter-chip-row" id="type-chip-row">' + typeChipsHtml() + '</div>' +
      '</div>' +
      '<div class="filter-sheet-actions">' +
        '<button type="button" class="btn btn-outline" id="filter-reset-btn">초기화</button>' +
        '<button type="button" class="btn btn-primary" id="filter-apply-btn">적용</button>' +
      '</div>';

    window.UI.showBottomSheet(bodyHtml, function (host) {
      const menuRow = host.querySelector('#menu-chip-row');
      const typeRow = host.querySelector('#type-chip-row');

      function bindMenuChips() {
        menuRow.querySelectorAll('[data-menu]').forEach(function (el) {
          el.addEventListener('click', function () {
            draftMenu = el.getAttribute('data-menu') || null;
            menuRow.querySelectorAll('[data-menu]').forEach(function (b) {
              b.classList.toggle('on', (b.getAttribute('data-menu') || null) === draftMenu);
            });
          });
        });
      }

      function bindTypeChips() {
        typeRow.querySelectorAll('[data-order-type]').forEach(function (el) {
          el.addEventListener('click', function () {
            draftType = el.getAttribute('data-order-type') || null;
            typeRow.querySelectorAll('[data-order-type]').forEach(function (b) {
              b.classList.toggle('on', (b.getAttribute('data-order-type') || null) === draftType);
            });
          });
        });
      }

      bindMenuChips();
      bindTypeChips();

      host.querySelector('#filter-reset-btn').addEventListener('click', function () {
        draftMenu = null;
        draftType = null;
        menuRow.innerHTML = menuChipsHtml();
        typeRow.innerHTML = typeChipsHtml();
        bindMenuChips();
        bindTypeChips();
      });

      host.querySelector('#filter-apply-btn').addEventListener('click', function () {
        menuFilter = draftMenu;
        orderTypeFilter = draftType;
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
      const options = ['재료 소진', '고객 요청', '영업 마감', '고객 미수령', '직접 입력'];
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
          { label: '확인', variant: 'btn-primary', onClick: function () { if (!confirmDisabled) onConfirm(reasonValue); } },
          { label: '취소', variant: 'btn-secondary' },
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

  function handleCancelOrder(id) {
    openReasonModal(function (reason) {
      const res = window.MockApi.cancelOrder(id, reason);
      window.UI.toast('카카오 알림톡 발송: ' + res.notification);
      switchTab(indexOfStatus('DONE'));
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
        '이미 호출한 주문건입니다. 다시 알림을 보낼까요?',
        '다시 호출',
        proceed
      );
      return;
    }
    proceed();
  }

  function handleComplete(id) {
    window.MockApi.completeOrder(id);
    switchTab(indexOfStatus('DONE'));
  }

  function handleCancelPayment(id) {
    openReasonModal(function (reason) {
      const res = window.MockApi.cancelPayment(id, reason);
      window.UI.toast('카카오 알림톡 발송: ' + res.notification);
      switchTab(indexOfStatus('DONE'));
    });
  }

  function handleRevert(id) {
    window.MockApi.revertOrder(id);
    switchTab(indexOfStatus('PROCESSING'));
  }

  function handleReturn(id) {
    function proceed() {
      openReasonModal(function (reason) {
        const res = window.MockApi.returnOrder(id, reason);
        window.UI.toast('카카오 알림톡 발송: ' + res.notification);
        updateList();
      });
    }
    window.UI.requirePasswordGate(storeId, 'paymentCancel', '결제 취소', proceed);
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
    window.MockApi.bulkAction(ids, 'call');
    window.UI.toast('카카오 알림톡 발송: 픽업 안내 (' + ids.length + '건)');
    selectedIds = new Set();
    updateList();
  }

  // ---------------- 설정 / 오프라인 ----------------
  function onSettingsClick() {
    window.Router.showScreen('settings');
  }

  function refreshOfflineBanner() {
    const slot = root.querySelector('#offline-banner-slot');
    if (slot) slot.innerHTML = isOnline ? '' : offlineBannerHtml();
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
    else if (action === 'open-kitchen-board') window.Router.showScreen('kitchenBoard');
    else if (action === 'switch-tab') switchTab(parseInt(target.getAttribute('data-tab-idx'), 10));
    else if (action === 'toggle-sort') toggleSort();
    else if (action === 'open-order-filter') openOrderFilterSheet();
    else if (action === 'toggle-expand-all') toggleExpandAll();
    else if (action === 'toggle-bucket-expand') toggleBucketExpand(target.getAttribute('data-bucket'));
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
    if (target.matches('input[data-action="card-select"]')) {
      const id = target.getAttribute('data-id');
      if (target.checked) selectedIds.add(id); else selectedIds.delete(id);
      updateList();
    } else if (target.matches('input[data-action="bucket-select-all"]')) {
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
    menuFilter = null;
    orderTypeFilter = null;
    selectedIds = new Set();
    expandedAll = true;
    bucketOverrides = {};
    isOnline = navigator.onLine && !(window.DevTools && window.DevTools.isOffline());

    const disabled = controlsDisabled();
    const orders = fetchOrders();
    const groups = window.UI.groupByBucket(orders);

    return '' +
      '<style>' + SCOPED_STYLE + '</style>' +
      '<div class="topbar">' +
      '<div class="topbar-side">' + window.UI.statusPillHtml(store.operatingStatus) + '</div>' +
      '<div class="topbar-title">' + esc(store.name) + '</div>' +
      '<div class="topbar-side" style="justify-content:flex-end;">' +
      '<button type="button" class="icon-btn" data-action="open-settings" aria-label="설정">⚙️</button>' +
      '</div>' +
      '</div>' +
      '<div id="offline-banner-slot">' + (isOnline ? '' : offlineBannerHtml()) + '</div>' +
      '<div class="segment-tabs" id="segment-tabs">' + renderSegmentTabsHtml() + '</div>' +
      '<div class="toolbar">' +
      '<div class="search-box">' +
      '<span>🔍</span>' +
      '<input type="text" inputmode="numeric" id="search-input" placeholder="호출번호로 검색" value="' + esc(searchQuery) + '" />' +
      '</div>' +
      '<div class="toolbar-row">' +
      '<div style="display:flex; gap:8px;">' +
      '<button type="button" class="pill-btn" id="sort-btn" data-action="toggle-sort">' + sortLabel() + ' ▾</button>' +
      '<button type="button" class="pill-btn' + ((menuFilter || orderTypeFilter) ? ' active' : '') + '" id="order-filter-btn" data-action="open-order-filter">' + (menuFilter ? '메뉴 · ' + esc(menuFilter) : (orderTypeFilter ? esc(ORDER_TYPE_LABELS[orderTypeFilter] || '주문 필터') : '주문 필터')) + '</button>' +
      '<button type="button" class="pill-btn" id="expand-all-toggle" data-action="toggle-expand-all">' + (expandedAll ? '간단히 보기' : '펼쳐보기') + '</button>' +
      '<button type="button" class="pill-btn kitchen-board-pill" data-action="open-kitchen-board">🍳 조리 현황판</button>' +
      '</div>' +
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
  }

  function unmount() {
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('mock:orders-changed', onMockDataChanged);
    root = null;
  }

  window.Router.register('order', { render: render, mount: mount, unmount: unmount });
})();
