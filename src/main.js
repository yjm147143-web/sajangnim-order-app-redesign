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

  // ---- 마감 없이 앱을 종료했을 때 마감 요청 푸시 ----
  // 사장님이 마감을 누르지 않고 앱을 닫으면 매장은 계속 '영업중'이라, 손님에게는 주문이
  // 열려 있는데 받아줄 사람이 없는 상태가 된다. 앱을 벗어나는 시점을 잡아 푸시를 예약한다.
  //
  // 목업이라 실제 푸시 발송은 없다. 브라우저는 탭이 숨겨진 동안 UI를 그릴 수 없으므로,
  // 숨겨질 때 '보낼 알림'을 표시해두고 돌아왔을 때 그 알림을 재현해 보여준다.
  var PENDING_PUSH_KEY = 'pendingClosePush';

  function ownerStoreNeedingClose() {
    var user = window.MockApi.getCurrentUser();
    if (!user || user.role !== 'OWNER' || !user.storeId) return null;
    var store = window.MockApi.getStore(user.storeId);
    // 마감 상태면 할 일이 없다. 일시중지는 아직 영업일이 끝나지 않은 것이라 대상에 포함한다.
    if (!store || store.operatingStatus === 'CLOSED') return null;
    return store;
  }

  function onAppHidden() {
    var store = ownerStoreNeedingClose();
    if (!store) return;
    try { sessionStorage.setItem(PENDING_PUSH_KEY, store.id); } catch (e) { /* 저장 실패는 무시 */ }
  }

  // 실제 발송과 개발자 도구 시연이 같은 알림을 띄우므로 문구·동작을 한 곳에서 만든다.
  // 버튼은 마감을 바로 실행하지 않고 설정 화면으로 보낸다 — 마감은 진행 중 주문을 모두
  // 완료 처리하는 되돌릴 수 없는 동작이라, 확인 모달이 있는 설정 화면을 거치게 한다.
  function showClosePush() {
    window.UI.showPushNotification({
      title: '혹시 오늘 영업을 마치셨나요?',
      body: '아직 ‘영업 중’ 상태라서 주문이 들어올 수 있어요.\n영업이 끝났다면 마감 버튼을 눌러주세요.',
      actionLabel: '영업 마감하기',
      onClick: function () { Router.showScreen('settings', {}); },
    });
  }

  function showClosePushIfPending() {
    var pending = null;
    try { pending = sessionStorage.getItem(PENDING_PUSH_KEY); } catch (e) { pending = null; }
    if (!pending) return;
    try { sessionStorage.removeItem(PENDING_PUSH_KEY); } catch (e) { /* 무시 */ }
    // 앱을 벗어난 사이 다른 기기에서 마감했을 수도 있으니 띄우는 순간 다시 확인한다.
    if (!ownerStoreNeedingClose()) return;
    showClosePush();
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') onAppHidden();
    else showClosePushIfPending();
  }

  window.App = { boot: boot, routeToBoardFor: routeToBoardFor, showClosePushIfPending: showClosePushIfPending };

  window.addEventListener('offline', updateNetworkFrame);
  window.addEventListener('online', updateNetworkFrame);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onAppHidden);
  window.addEventListener('dev:show-close-push', function () {
    if (!ownerStoreNeedingClose()) {
      window.UI.toast('영업중 또는 일시중지 상태에서만 발송돼요');
      return;
    }
    showClosePush();
  });
  document.addEventListener('DOMContentLoaded', function () {
    boot();
    updateNetworkFrame();
    // 앱을 닫은 뒤 다시 열었을 때(새로고침 포함) 예약된 알림을 보여준다.
    showClosePushIfPending();
  });
})();
