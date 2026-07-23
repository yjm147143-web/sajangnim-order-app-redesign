/*
 * 행사 담당자 — 홈 화면
 * 구성: 행사 정보 / 매출 요약 / 매장 운영 현황(요약+읽기전용 목록) / 매장 통제(전체 일괄 상태 변경)
 */
(function () {
  function formatDateRange(start, end) {
    return String(start || '').replace(/-/g, '.') + ' ~ ' + String(end || '').replace(/-/g, '.');
  }

  // 개점 시 개점시간(00시 00분) / 마감 시 마감시간(00시 00분) 표시
  function formatClockTime(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + '시 ' + String(d.getMinutes()).padStart(2, '0') + '분';
  }

  function statusTimeLabel(store) {
    if (!store.statusChangedAt) return null;
    if (store.operatingStatus === 'OPEN') return '개점 ' + formatClockTime(store.statusChangedAt);
    if (store.operatingStatus === 'CLOSED') return '마감 ' + formatClockTime(store.statusChangedAt);
    return null;
  }

  // 누적 주문건수는 mockApi에 필드가 없어, 오늘 매출 대비 누적 매출 비율로 근사치를 계산한다.
  function estimateTotalOrderCount(summary) {
    if (!summary.todayAmount || !summary.todayOrderCount) return summary.todayOrderCount || 0;
    return Math.max(summary.todayOrderCount, Math.round(summary.todayOrderCount * (summary.totalAmount / summary.todayAmount)));
  }

  function render(params) {
    const esc = window.UI.escapeHtml;
    const eventId = params.eventId;
    const event = window.MockApi.getEvent(eventId);
    const summary = window.MockApi.getEventDashboardSummary(eventId);
    const stores = window.MockApi.getStoresByEvent(eventId);
    const estTotalOrders = estimateTotalOrderCount(summary);

    const storeRowsHtml = stores.length
      ? stores.map(function (s) {
          const timeLabel = statusTimeLabel(s);
          return (
            '<div class="store-status-row">' +
              '<div class="store-status-left">' +
                '<span class="store-status-name">' + esc(s.name) + '</span>' +
                (timeLabel ? '<span class="store-status-time">' + esc(timeLabel) + '</span>' : '') +
              '</div>' +
              window.UI.statusPillHtml(s.operatingStatus) +
            '</div>'
          );
        }).join('')
      : '<div class="empty-state"><div class="empty-state-emoji">🏪</div><div>등록된 매장이 없어요</div></div>';

    return (
      '<style>' +
        '.info-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--color-divider);font-size:var(--font-size-body);}' +
        '.info-row:last-child{border-bottom:none;}' +
        '.info-row .info-label{color:var(--color-text-secondary);}' +
        '.info-row .info-value{font-weight:700;text-align:right;}' +
        '.store-status-row{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--color-divider);}' +
        '.store-status-row:last-child{border-bottom:none;}' +
        '.store-status-left{display:flex;flex-direction:column;gap:2px;}' +
        '.store-status-name{font-weight:700;font-size:var(--font-size-body);}' +
        '.store-status-time{font-size:var(--font-size-micro);color:var(--color-text-secondary);}' +
        '.card-flat{padding:0;overflow:hidden;}' +
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
        '<div class="section-caption">전체 매장의 영업 상태를 한번에 변경해요</div>' +
        '<div class="btn-row" style="padding:8px 20px 28px;">' +
          '<button type="button" class="btn btn-success" id="ctrl-open">개점</button>' +
          '<button type="button" class="btn btn-warning" id="ctrl-pause">일시중지</button>' +
          '<button type="button" class="btn btn-danger-solid" id="ctrl-close">마감</button>' +
        '</div>' +

      '</div>' +
      window.EventManagerShell.tabbarHtml('eventManagerHome')
    );
  }

  function bindControlButtons(root, eventId) {
    function handle(target, label, danger) {
      const stores = window.MockApi.getStoresByEvent(eventId);
      const ids = stores.map(function (s) { return s.id; });
      const alreadyCount = stores.filter(function (s) { return s.operatingStatus === target; }).length;
      let msg = '전체 매장(' + ids.length + '개)을 ' + label + ' 처리할까요?';
      if (alreadyCount > 0) msg += '<br/>이미 ' + label + ' 상태인 매장 ' + alreadyCount + '개는 제외돼요.';

      window.UI.confirmModal('전체 매장 ' + label, msg, label, function () {
        const result = window.MockApi.bulkUpdateStoreStatus(ids, target);
        const parts = ['성공 ' + result.success + '건'];
        if (result.skipped) parts.push('제외 ' + result.skipped + '건');
        if (result.failed) parts.push('실패 ' + result.failed + '건');
        window.UI.toast(parts.join(' · '));
        window.Router.showScreen('eventManagerHome', { eventId: eventId }, { replace: true });
      }, { danger: !!danger });
    }

    const openBtn = root.querySelector('#ctrl-open');
    const pauseBtn = root.querySelector('#ctrl-pause');
    const closeBtn = root.querySelector('#ctrl-close');
    if (openBtn) openBtn.addEventListener('click', function () { handle('OPEN', '개점', false); });
    if (pauseBtn) pauseBtn.addEventListener('click', function () { handle('PAUSED', '일시중지', false); });
    if (closeBtn) closeBtn.addEventListener('click', function () { handle('CLOSED', '마감', true); });
  }

  function mount(root, params) {
    window.EventManagerShell.attachTabbar(root, 'eventManagerHome', params.eventId);
    bindControlButtons(root, params.eventId);
  }

  function unmount() {}

  window.Router.register('eventManagerHome', { render: render, mount: mount, unmount: unmount });
})();
