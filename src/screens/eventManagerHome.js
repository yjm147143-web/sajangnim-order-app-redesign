/*
 * 행사 담당자 — 홈 화면
 * 구성: 행사 정보 / 매출 요약 / 매장 운영 현황(체크박스로 매장을 골라 개별 통제 가능) / 매장 통제
 */
(function () {
  const esc = window.UI.escapeHtml;

  // 일괄 통제 대신, 체크한 매장에만 상태 변경을 적용한다 (화면을 나갔다 들어오면 초기화됨)
  let selectedIds = new Set();

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

  function networkBadgeHtml(store) {
    const online = store.networkStatus !== 'OFFLINE';
    return '<span class="network-badge ' + (online ? 'online' : 'offline') + '">' + (online ? '🟢 온라인' : '🔴 오프라인') + '</span>';
  }

  // 누적 주문건수는 mockApi에 필드가 없어, 오늘 매출 대비 누적 매출 비율로 근사치를 계산한다.
  function estimateTotalOrderCount(summary) {
    if (!summary.todayAmount || !summary.todayOrderCount) return summary.todayOrderCount || 0;
    return Math.max(summary.todayOrderCount, Math.round(summary.todayOrderCount * (summary.totalAmount / summary.todayAmount)));
  }

  function storeRowHtml(s) {
    const timeLabel = statusTimeLabel(s);
    return (
      '<div class="store-status-row">' +
        '<input type="checkbox" class="store-select-cb" data-store-id="' + s.id + '"' + (selectedIds.has(s.id) ? ' checked' : '') + ' aria-label="' + esc(s.name) + ' 선택" />' +
        '<div class="store-status-left">' +
          '<span class="store-status-name">' + esc(s.name) + '</span>' +
          '<div class="store-status-meta">' +
            networkBadgeHtml(s) +
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
    const estTotalOrders = estimateTotalOrderCount(summary);
    selectedIds = new Set();

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
        '.store-status-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}' +
        '.store-status-time{font-size:var(--font-size-micro);color:var(--color-text-secondary);}' +
        '.network-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:var(--radius-pill);font-size:var(--font-size-micro);font-weight:700;white-space:nowrap;}' +
        '.network-badge.online{background:var(--color-accent-green-bg);color:#0b6b5c;}' +
        '.network-badge.offline{background:var(--color-accent-red-bg);color:#b02850;}' +
        '.card-flat{padding:0;overflow:hidden;}' +
        '.store-settings-btn{background:none;border:none;font-size:18px;padding:4px;cursor:pointer;flex-shrink:0;}' +
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
          '<div class="summary-card"><span class="summary-label">누적 주문건수</span><span class="summary-value">' + estTotalOrders.toLocaleString('ko-KR') + '건</span></div>' +
        '</div>' +

        '<div class="section-title">매장 운영 현황</div>' +
        '<div class="section-caption">영업중 ' + summary.open + '개소 · 일시중지 ' + summary.paused + '개소 · 마감 ' + summary.closed + '개소 (총 ' + summary.storeCount + '개)</div>' +
        '<div style="padding:8px 20px 20px;">' +
          '<div class="card card-flat">' + storeRowsHtml + '</div>' +
        '</div>' +

        '<div class="section-title">매장 통제</div>' +
        '<div id="store-ctrl-panel" style="padding:8px 20px 28px;">' + ctrlPanelHtml() + '</div>' +

      '</div>' +
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

    root.querySelectorAll('.store-select-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const id = cb.getAttribute('data-store-id');
        if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
        refreshCtrlPanel();
      });
    });

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
