/*
 * 행사 담당자 보드 — 하단 탭바 공용 헬퍼
 * Router 화면으로 등록하지 않고, Home/Sales/Settings 3개 화면이 공유하는
 * 순수 함수만 window.EventManagerShell 로 노출한다.
 */
(function () {
  const TABS = [
    { screen: 'eventManagerHome', icon: '🏠', label: '홈' },
    { screen: 'eventManagerSales', icon: '📊', label: '매출현황' },
    { screen: 'eventManagerSettings', icon: '⚙️', label: '설정' },
  ];

  function tabbarHtml(activeScreen) {
    return '<div class="tabbar">' + TABS.map(function (t) {
      return '<button type="button" class="tabbar-item' + (t.screen === activeScreen ? ' active' : '') + '" data-tab-screen="' + t.screen + '">' +
        '<span class="tabbar-icon">' + t.icon + '</span><span>' + t.label + '</span>' +
        '</button>';
    }).join('') + '</div>';
  }

  function attachTabbar(rootEl, activeScreen, eventId) {
    const items = rootEl.querySelectorAll('.tabbar-item');
    items.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const target = btn.getAttribute('data-tab-screen');
        if (target === activeScreen) return;
        window.Router.showScreen(target, { eventId: eventId }, { replace: true });
      });
    });
  }

  window.EventManagerShell = { tabbarHtml: tabbarHtml, attachTabbar: attachTabbar };
})();
