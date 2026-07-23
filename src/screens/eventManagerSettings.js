/*
 * 행사 담당자 — 설정 화면
 * 행사 정보(읽기전용) / 행사 전환(담당 행사 2개 이상일 때만 노출) / 로그아웃
 */
(function () {
  function formatDateRange(start, end) {
    return String(start || '').replace(/-/g, '.') + ' ~ ' + String(end || '').replace(/-/g, '.');
  }

  function render(params) {
    const esc = window.UI.escapeHtml;
    const eventId = params.eventId;
    const event = window.MockApi.getEvent(eventId);
    const user = window.MockApi.getCurrentUser();
    const showSwitch = !!(user && user.eventIds && user.eventIds.length > 1);

    return (
      '<style>' +
        '.info-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--color-divider);font-size:var(--font-size-body);}' +
        '.info-row:last-child{border-bottom:none;}' +
        '.info-row .info-label{color:var(--color-text-secondary);}' +
        '.info-row .info-value{font-weight:700;text-align:right;}' +
        '.card-flat{padding:0;overflow:hidden;}' +
      '</style>' +
      '<div class="topbar"><div class="topbar-side"></div><div class="topbar-title">설정</div><div class="topbar-side"></div></div>' +
      '<div class="screen-scroll">' +

        '<div class="section-title">행사 정보</div>' +
        '<div style="padding:0 20px 20px;">' +
          '<div class="card">' +
            '<div class="info-row"><span class="info-label">행사명</span><span class="info-value">' + esc(event.name) + '</span></div>' +
            '<div class="info-row"><span class="info-label">행사일</span><span class="info-value">' + formatDateRange(event.startDate, event.endDate) + '</span></div>' +
            '<div class="info-row"><span class="info-label">행사 장소</span><span class="info-value">' + esc(event.location || '') + '</span></div>' +
            '<div class="info-row"><span class="info-label">담당자</span><span class="info-value">' + esc(event.managerName || '') + '</span></div>' +
          '</div>' +
        '</div>' +

        '<div class="divider-line"></div>' +

        '<div class="card-flat" style="margin:0 20px;border:1px solid var(--color-divider);border-radius:var(--radius-card);">' +
          (showSwitch
            ? '<div class="settings-list-item" id="switch-event-btn"><span class="icon">🔁</span><span class="label">행사 전환</span><span style="color:var(--color-text-secondary);">›</span></div>'
            : '') +
          '<div class="settings-list-item" id="logout-btn"><span class="icon">🚪</span><span class="label" style="color:var(--color-accent-red);">로그아웃</span></div>' +
        '</div>' +

        '<div style="height:24px;"></div>' +

      '</div>' +
      window.EventManagerShell.tabbarHtml('eventManagerSettings')
    );
  }

  function mount(root, params) {
    window.EventManagerShell.attachTabbar(root, 'eventManagerSettings', params.eventId);

    const switchBtn = root.querySelector('#switch-event-btn');
    if (switchBtn) {
      switchBtn.addEventListener('click', function () {
        window.Router.showScreen('eventSelect');
      });
    }

    const logoutBtn = root.querySelector('#logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        window.UI.confirmModal('로그아웃', '정말 로그아웃 하시겠어요?', '로그아웃', function () {
          window.MockApi.logout();
          window.Router.resetTo('login');
        }, { danger: true });
      });
    }
  }

  function unmount() {}

  window.Router.register('eventManagerSettings', { render: render, mount: mount, unmount: unmount });
})();
