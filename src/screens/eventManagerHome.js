/*
 * 행사 담당자 — 홈 화면
 * 구성: 행사 정보 / 매출 요약 / 매장 운영 현황(체크박스로 매장을 골라 개별 통제 가능) / 매장 통제
 */
(function () {
  const esc = window.UI.escapeHtml;

  // 일괄 통제 대신, 체크한 매장에만 상태 변경을 적용한다 (화면을 나갔다 들어오면 초기화됨)
  let selectedIds = new Set();
  // '전체 선택' 버튼에서 참조할, 현재 화면에 나열된 매장 id 목록
  let currentStoreIds = [];

  function formatDateRange(start, end) {
    return String(start || '').replace(/-/g, '.') + ' ~ ' + String(end || '').replace(/-/g, '.');
  }

  // 개점 시 개점시간(00시 00분) / 마감 시 마감시간(00시 00분) 표시
  function formatClockTime(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + '시 ' + String(d.getMinutes()).padStart(2, '0') + '분';
  }

  // 마감 상태에서는 오늘 언제 열었다가 닫았는지 한눈에 보이도록 개점시간을 함께 보여준다
  function statusTimeLabel(store) {
    if (store.operatingStatus === 'CLOSED') {
      const parts = [];
      if (store.todayFirstOpenAt) parts.push('개점 ' + formatClockTime(store.todayFirstOpenAt));
      if (store.statusChangedAt) parts.push('마감 ' + formatClockTime(store.statusChangedAt));
      return parts.length ? parts.join(' · ') : null;
    }
    if (!store.statusChangedAt) return null;
    if (store.operatingStatus === 'OPEN') return '개점 ' + formatClockTime(store.statusChangedAt);
    return null;
  }

  // 온라인일 땐 아무 표시도 하지 않고, 네트워크 상태가 안 좋을 때만 빨간 경고 문구를 보여준다 —
  // 영업상태 배지(🟢영업 중)와 겹쳐 보여 헷갈리던 '🟢 온라인' 배지를 없앤 것.
  function networkWarningHtml(store) {
    if (store.networkStatus !== 'OFFLINE') return '';
    return '<span class="store-network-warning">⚠️ 네트워크 끊김</span>';
  }


  function storeRowHtml(s) {
    const timeLabel = statusTimeLabel(s);
    return (
      '<div class="store-status-row">' +
        '<input type="checkbox" class="store-select-cb" data-store-id="' + s.id + '"' + (selectedIds.has(s.id) ? ' checked' : '') + ' aria-label="' + esc(s.name) + ' 선택" />' +
        '<div class="store-status-left">' +
          '<span class="store-status-name">' + esc(s.name) + '</span>' +
          '<div class="store-status-meta">' +
            networkWarningHtml(s) +
            (timeLabel ? '<span class="store-status-time">' + esc(timeLabel) + '</span>' : '') +
          '</div>' +
        '</div>' +
        window.UI.statusPillHtml(s.operatingStatus) +
        '<button type="button" class="store-settings-btn" data-action="open-store-settings" data-store-id="' + s.id + '" aria-label="' + esc(s.name) + ' 설정">⚙️</button>' +
      '</div>'
    );
  }

  // 매장을 하나 이상 선택해야 개점/일시중지/마감 버튼이 나타난다
  function ctrlPanelHtml() {
    const n = selectedIds.size;
    if (!n) {
      return '<div class="section-caption">매장 운영 현황에서 매장을 체크하면, 선택한 매장에만 상태를 적용할 수 있어요</div>';
    }
    return (
      '<div class="section-caption">선택한 매장 ' + n + '개에 적용해요</div>' +
      '<div class="btn-row">' +
        '<button type="button" class="btn btn-success" id="ctrl-open">개점</button>' +
        '<button type="button" class="btn btn-warning" id="ctrl-pause">일시중지</button>' +
        '<button type="button" class="btn btn-danger-solid" id="ctrl-close">마감</button>' +
      '</div>'
    );
  }

  function render(params) {
    // 행사 홈으로 돌아왔다는 건 특정 매장 설정을 다 보고 나왔다는 뜻이므로, 다음에 헷갈리지 않도록 초기화한다
    window.MockApi.clearActingStoreId();
    const eventId = params.eventId;
    const event = window.MockApi.getEvent(eventId);
    const summary = window.MockApi.getEventDashboardSummary(eventId);
    const stores = window.MockApi.getStoresByEvent(eventId);
    selectedIds = new Set();
    currentStoreIds = stores.map(function (s) { return s.id; });

    const storeRowsHtml = stores.length
      ? stores.map(storeRowHtml).join('')
      : '<div class="empty-state"><div class="empty-state-emoji">🏪</div><div>등록된 매장이 없어요</div></div>';

    return (
      '<style>' +
        '.info-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--color-divider);font-size:var(--font-size-body);}' +
        '.info-row:last-child{border-bottom:none;}' +
        '.info-row .info-label{color:var(--color-text-secondary);}' +
        '.info-row .info-value{font-weight:700;text-align:right;}' +
        '.store-status-row{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid var(--color-divider);}' +
        '.store-status-row:last-child{border-bottom:none;}' +
        '.store-select-cb{width:20px;height:20px;flex-shrink:0;cursor:pointer;}' +
        '.store-status-left{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0;}' +
        '.store-status-name{font-weight:700;font-size:var(--font-size-body);}' +
        '.store-status-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:100%;}' +
        '.store-status-time{font-size:var(--font-size-micro);color:var(--color-text-secondary);}' +
        '.store-network-warning{font-size:var(--font-size-caption);font-weight:700;color:var(--color-accent-red);}' +
        '.card-flat{padding:0;overflow:hidden;}' +
        '.store-settings-btn{background:none;border:none;font-size:18px;padding:4px;cursor:pointer;flex-shrink:0;}' +
        '.store-ctrl-fixed{flex-shrink:0;background:var(--color-white);border-top:1px solid var(--color-divider);box-shadow:0 -4px 16px rgba(0,0,0,0.06);}' +
        '.section-title-row{display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-5) 0;}' +
        '.select-all-btn{background:none;border:none;padding:4px 0;font-size:var(--font-size-caption);font-weight:700;color:var(--color-accent-blue-strong);cursor:pointer;}' +
      '</style>' +
      '<div class="topbar"><div class="topbar-side"></div><div class="topbar-title">' + esc(event.name) + '</div><div class="topbar-side"></div></div>' +
      '<div class="section-caption">' + formatDateRange(event.startDate, event.endDate) + ' · ' + esc(event.managerName || '') + ' 담당</div>' +
      '<div class="screen-scroll">' +

        '<div class="section-title">행사 정보</div>' +
        '<div style="padding:0 20px 20px;">' +
          '<div class="card">' +
            '<div class="info-row"><span class="info-label">행사명</span><span class="info-value">' + esc(event.name) + '</span></div>' +
            '<div class="info-row"><span class="info-label">행사일</span><span class="info-value">' + formatDateRange(event.startDate, event.endDate) + '</span></div>' +
            '<div class="info-row"><span class="info-label">행사 장소</span><span class="info-value">' + esc(event.location || '') + '</span></div>' +
          '</div>' +
        '</div>' +

        '<div class="section-title">매출 요약</div>' +
        '<div class="summary-grid" style="padding-bottom:20px;">' +
          '<div class="summary-card"><span class="summary-label">오늘 매출</span><span class="summary-value">' + window.UI.formatMoney(summary.todayAmount) + '</span></div>' +
          '<div class="summary-card"><span class="summary-label">누적 매출</span><span class="summary-value">' + window.UI.formatMoney(summary.totalAmount) + '</span></div>' +
          '<div class="summary-card"><span class="summary-label">오늘 주문건수</span><span class="summary-value">' + summary.todayOrderCount.toLocaleString('ko-KR') + '건</span></div>' +
          '<div class="summary-card"><span class="summary-label">누적 주문건수</span><span class="summary-value">' + summary.totalOrderCount.toLocaleString('ko-KR') + '건</span></div>' +
        '</div>' +

        '<div class="section-title-row">' +
          '<div class="section-title" style="padding:0;">매장 운영 현황</div>' +
          (stores.length ? '<button type="button" class="select-all-btn" id="select-all-btn">전체 선택</button>' : '') +
        '</div>' +
        '<div class="section-caption">영업 중 ' + summary.open + '개소 · 일시중지 ' + summary.paused + '개소 · 마감 ' + summary.closed + '개소 (총 ' + summary.storeCount + '개)</div>' +
        '<div style="padding:8px 20px 20px;">' +
          '<div class="card card-flat">' + storeRowsHtml + '</div>' +
        '</div>' +

      '</div>' +

      // 스크롤 영역 밖(탭바 바로 위)에 고정해, 목록을 아무리 내려도 항상 눌러 통제할 수 있게 한다
      (stores.length ? (
        '<div class="store-ctrl-fixed">' +
          '<div class="section-title" style="padding:12px 20px 0;">매장 통제</div>' +
          '<div id="store-ctrl-panel" style="padding:8px 20px 12px;">' + ctrlPanelHtml() + '</div>' +
        '</div>'
      ) : '') +

      window.EventManagerShell.tabbarHtml('eventManagerHome')
    );
  }

  function bindEvents(root, eventId) {
    function refreshCtrlPanel() {
      const panel = root.querySelector('#store-ctrl-panel');
      if (panel) panel.innerHTML = ctrlPanelHtml();
      bindCtrlButtons();
    }

    function handle(target, label, danger) {
      const ids = Array.from(selectedIds);
      if (!ids.length) return;
      const msg = '선택한 매장(' + ids.length + '개)을 ' + label + ' 처리할까요?';
      window.UI.confirmModal('선택 매장 ' + label, msg, label + ' 처리하기', function () {
        const result = window.MockApi.bulkUpdateStoreStatus(ids, target);
        const parts = ['성공 ' + result.success + '건'];
        if (result.skipped) parts.push('제외 ' + result.skipped + '건');
        if (result.failed) parts.push('실패 ' + result.failed + '건');
        window.UI.toast(parts.join(' · '));
        selectedIds = new Set();
        window.Router.showScreen('eventManagerHome', { eventId: eventId }, { replace: true });
      }, { danger: !!danger });
    }

    function bindCtrlButtons() {
      const openBtn = root.querySelector('#ctrl-open');
      const pauseBtn = root.querySelector('#ctrl-pause');
      const closeBtn = root.querySelector('#ctrl-close');
      if (openBtn) openBtn.addEventListener('click', function () { handle('OPEN', '개점', false); });
      if (pauseBtn) pauseBtn.addEventListener('click', function () { handle('PAUSED', '일시중지', false); });
      if (closeBtn) closeBtn.addEventListener('click', function () { handle('CLOSED', '마감', true); });
    }

    function updateSelectAllLabel() {
      const btn = root.querySelector('#select-all-btn');
      if (!btn) return;
      const allSelected = currentStoreIds.length > 0 && selectedIds.size === currentStoreIds.length;
      btn.textContent = allSelected ? '전체 해제' : '전체 선택';
    }

    root.querySelectorAll('.store-select-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const id = cb.getAttribute('data-store-id');
        if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
        updateSelectAllLabel();
        refreshCtrlPanel();
      });
    });

    const selectAllBtn = root.querySelector('#select-all-btn');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', function () {
        const allSelected = currentStoreIds.length > 0 && selectedIds.size === currentStoreIds.length;
        selectedIds = allSelected ? new Set() : new Set(currentStoreIds);
        root.querySelectorAll('.store-select-cb').forEach(function (cb) {
          cb.checked = selectedIds.has(cb.getAttribute('data-store-id'));
        });
        updateSelectAllLabel();
        refreshCtrlPanel();
      });
    }

    // 매장 하나를 골라 그 매장인 것처럼 설정 화면으로 들어간다 — 뒤로가기를 반복하면 이 홈으로 돌아온다
    root.querySelectorAll('[data-action="open-store-settings"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.MockApi.setActingStoreId(btn.getAttribute('data-store-id'));
        window.Router.showScreen('settings', {});
      });
    });

    refreshCtrlPanel();
  }

  function mount(root, params) {
    window.EventManagerShell.attachTabbar(root, 'eventManagerHome', params.eventId);
    bindEvents(root, params.eventId);
  }

  function unmount() {}

  window.Router.register('eventManagerHome', { render: render, mount: mount, unmount: unmount });
})();
