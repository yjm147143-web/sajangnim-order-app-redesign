(function () {
  function boot() {
    const user = window.MockApi.getCurrentUser();
    if (user) {
      routeToBoardFor(user);
      return;
    }
    Router.resetTo('login');
  }

  function routeToBoardFor(user) {
    if (user.role === 'EVENT_MANAGER') {
      Router.resetTo('eventSelect');
    } else {
      Router.resetTo('order');
    }
  }

  // 실제 오프라인이거나 개발자 도구로 네트워크 단절을 시뮬레이션 중이면, 화면(폰 목업) 전체 테두리를
  // 빨간색으로 강조해 어떤 화면에 있든 한눈에 알아볼 수 있게 한다. Router가 화면을 교체해도
  // .device-frame 자체는 그대로 유지되므로 여기 한 곳에서만 처리하면 된다.
  function updateNetworkFrame() {
    const offline = !navigator.onLine || (window.DevTools && window.DevTools.isOffline());
    const frame = document.querySelector('.device-frame');
    if (frame) frame.classList.toggle('network-offline', !!offline);
  }

  window.App = { boot: boot, routeToBoardFor: routeToBoardFor };

  window.addEventListener('offline', updateNetworkFrame);
  window.addEventListener('online', updateNetworkFrame);
  document.addEventListener('DOMContentLoaded', function () {
    boot();
    updateNetworkFrame();
  });
})();
