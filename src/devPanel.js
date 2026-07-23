/*
 * 개발자 테스트 패널 (QA/데모용, 실제 제품 화면이 아님)
 * 폰 목업(.device-frame) 바깥에 별도로 렌더링해, 주문을 추가해도 폰 화면 변화가
 * 항상 같이 보이도록 한다.
 * - 조건별 버튼(고객요청/주문유형/채널/주문번호유형/메뉴수/옵션)을 조합해 원하는
 *   형태의 주문을 원하는 개수만큼 즉시 생성
 * - 오프라인 시뮬레이션: window 'offline'/'online' 이벤트를 직접 발생시켜
 *   order.js의 기존 오프라인 배너/버튼 비활성화 로직을 그대로 재사용
 *   (오프라인 상태에서는 주문 추가 자체를 막는다 — 실제로도 네트워크가 끊기면
 *   신규 주문이 들어올 수 없기 때문)
 */
(function () {
  var STYLE = '' +
    '#dev-panel-host{width:402px;max-width:100vw;}' +
    '.dp-panel{width:402px;max-width:100vw;background:#15152b;border:2px dashed #7C2FF0;border-radius:16px;' +
    'padding:14px 16px;box-sizing:border-box;font-family:inherit;}' +
    '.dp-panel-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}' +
    '.dp-title{font-size:13px;font-weight:800;color:#c9baff;letter-spacing:0.3px;}' +
    '.dp-collapse-btn{background:none;border:none;color:#8b8bab;font-size:18px;line-height:1;cursor:pointer;padding:2px 4px;}' +
    '.dp-collapse-btn:active{color:#fff;}' +
    '.dp-groups{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin-bottom:12px;}' +
    '.dp-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}' +
    '.dp-group-label{font-size:11px;font-weight:700;color:#8b8bab;white-space:nowrap;}' +
    '.dp-pill-row{display:flex;gap:6px;flex-wrap:wrap;}' +
    '.dp-pill{background:#2a2a45;border:1px solid #45456b;color:#d8d8ea;font-size:12px;font-weight:700;' +
    'padding:6px 12px;border-radius:999px;cursor:pointer;}' +
    '.dp-pill.active{background:#7C2FF0;border-color:#7C2FF0;color:#fff;}' +
    '.dp-pill:disabled{opacity:0.35;cursor:not-allowed;}' +
    '.dp-actions-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}' +
    '.dp-add-btn{flex:1;min-width:160px;background:#7C2FF0;color:#fff;border:none;font-size:13px;font-weight:800;' +
    'padding:12px 14px;border-radius:12px;cursor:pointer;}' +
    '.dp-add-btn:active{opacity:0.85;}' +
    '.dp-add-btn:disabled{background:#3a3a52;color:#8b8bab;cursor:not-allowed;}' +
    '.dp-offline-btn{flex-shrink:0;}' +
    '.dp-offline-hint{font-size:11px;color:#ff9a9a;margin-top:8px;line-height:1.4;}' +
    '.dp-tab{width:402px;max-width:100vw;height:44px;border-radius:14px;background:#15152b;' +
    'border:2px dashed #7C2FF0;color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;' +
    'justify-content:center;gap:8px;cursor:pointer;box-sizing:border-box;}' +
    '.dp-tab:active{opacity:0.85;}';

  var devHasNote = false;
  var devIsReservation = false;
  var devChannel = 'QR';
  var devIdentifierType = 'PICKUP';
  var devMultiMenu = false;
  var devHasOption = false;
  var devReusable = false;
  var devPromoType = '';
  var devCount = 1;
  var devSimOffline = false;
  var panelOpen = false;
  var lastVisible = null;

  function isOffline() { return devSimOffline; }

  function currentOwnerContext() {
    var user = window.MockApi.getCurrentUser();
    if (!user || user.role !== 'OWNER') return null;
    return user;
  }

  function pillGroupHtml(label, options, current, action, disabledValues) {
    disabledValues = disabledValues || [];
    return '<div class="dp-group">' +
      '<span class="dp-group-label">' + label + '</span>' +
      '<div class="dp-pill-row">' +
      options.map(function (o) {
        var isDisabled = disabledValues.indexOf(o.v) !== -1;
        return '<button type="button" class="dp-pill' + (String(current) === o.v ? ' active' : '') + '" data-action="' + action + '" data-value="' + o.v + '"' + (isDisabled ? ' disabled' : '') + '>' + o.label + '</button>';
      }).join('') +
      '</div></div>';
  }

  // 매장의 '주문 방식 관리' 설정에 따라, 현재 dev 상태가 허용되지 않는 값이면 되돌린다.
  function clampDevState(channelSettings) {
    if (!channelSettings.acceptReservationOrders && devIsReservation) devIsReservation = false;
    if (!channelSettings.acceptSeatOrders && devIdentifierType === 'SEAT') devIdentifierType = 'PICKUP';
    if (!channelSettings.acceptCustomerNotes && devHasNote) devHasNote = false;
  }

  function tabHtml() {
    return '<button type="button" class="dp-tab" data-action="dp-toggle-panel" aria-label="테스트 주문 만들기 열기">🛠️ 테스트 주문 만들기 열기</button>';
  }

  function panelHtml(user) {
    var channelSettings = window.MockApi.getOrderChannelSettings(user.storeId);
    clampDevState(channelSettings);
    return '<div class="dp-panel">' +
      '<div class="dp-panel-header">' +
      '<span class="dp-title">🛠️ 테스트 주문 만들기</span>' +
      '<button type="button" class="dp-collapse-btn" data-action="dp-toggle-panel" aria-label="접기">✕</button>' +
      '</div>' +
      '<div class="dp-groups">' +
      pillGroupHtml('고객요청', [{ v: '0', label: '없음' }, { v: '1', label: '있음' }], devHasNote ? '1' : '0', 'dp-set-note',
        channelSettings.acceptCustomerNotes ? [] : ['1']) +
      pillGroupHtml('주문유형', [{ v: '0', label: '현장' }, { v: '1', label: '예약' }], devIsReservation ? '1' : '0', 'dp-set-reservation',
        channelSettings.acceptReservationOrders ? [] : ['1']) +
      pillGroupHtml('주문채널', [{ v: 'QR', label: 'QR오더' }, { v: 'TABLET', label: '태블릿오더' }], devChannel, 'dp-set-channel') +
      pillGroupHtml('주문번호', [{ v: 'PICKUP', label: '호출번호' }, { v: 'SEAT', label: '좌석번호' }], devIdentifierType, 'dp-set-identifier',
        channelSettings.acceptSeatOrders ? [] : ['SEAT']) +
      pillGroupHtml('메뉴수', [{ v: '0', label: '1개' }, { v: '1', label: '여러개' }], devMultiMenu ? '1' : '0', 'dp-set-multimenu') +
      pillGroupHtml('옵션', [{ v: '0', label: '없음' }, { v: '1', label: '있음' }], devHasOption ? '1' : '0', 'dp-set-option') +
      pillGroupHtml('다회용기', [{ v: '0', label: '없음' }, { v: '1', label: '제공' }], devReusable ? '1' : '0', 'dp-set-reusable') +
      pillGroupHtml('프로모션', [
        { v: '', label: '없음' },
        { v: 'GROUP_COUPON', label: '쿠폰(그룹)' },
        { v: 'STORE_COUPON', label: '쿠폰(매장)' },
        { v: 'HAPPY_HOUR', label: '해피아워' },
        { v: 'FIRST_COME', label: '선착순' },
      ], devPromoType, 'dp-set-promo') +
      pillGroupHtml('개수', [1, 3, 5, 10].map(function (n) { return { v: String(n), label: n + '개' }; }), String(devCount), 'dp-set-count') +
      '</div>' +
      '<div class="dp-actions-row">' +
      '<button type="button" class="dp-add-btn" data-action="dp-add-order"' + (devSimOffline ? ' disabled' : '') + '>+ 주문 ' + devCount + '건 추가</button>' +
      '<button type="button" class="dp-pill dp-offline-btn' + (devSimOffline ? ' active' : '') + '" data-action="dp-toggle-offline">' + (devSimOffline ? '🟢 온라인으로 복귀' : '📶 오프라인 시뮬레이션') + '</button>' +
      '</div>' +
      (devSimOffline ? '<div class="dp-offline-hint">오프라인 상태에서는 신규 주문이 들어올 수 없어요</div>' : '') +
      '</div>';
  }

  function render() {
    var host = document.getElementById('dev-panel-host');
    if (!host) return;
    var user = currentOwnerContext();
    if (!user) { host.innerHTML = ''; return; }
    host.innerHTML = panelOpen ? panelHtml(user) : tabHtml();
  }

  function addOrders() {
    if (devSimOffline) {
      window.UI.toast('오프라인 상태에서는 주문을 추가할 수 없어요');
      return;
    }
    var user = currentOwnerContext();
    if (!user) return;
    var created = 0;
    for (var i = 0; i < devCount; i++) {
      var order = window.MockApi.createCustomOrder(user.storeId, {
        hasNote: devHasNote,
        isReservation: devIsReservation,
        channel: devChannel,
        identifierType: devIdentifierType,
        multiMenu: devMultiMenu,
        hasOption: devHasOption,
        isReusableContainer: devReusable,
        promoType: devPromoType || null,
      });
      if (order) created += 1;
    }
    if (!created) { window.UI.toast('추가할 메뉴가 없어요'); return; }
    window.dispatchEvent(new CustomEvent('mock:orders-changed', { detail: { storeId: user.storeId } }));
    window.UI.toast('테스트 주문 ' + created + '건을 추가했어요');
  }

  function toggleOffline() {
    devSimOffline = !devSimOffline;
    window.dispatchEvent(new Event(devSimOffline ? 'offline' : 'online'));
    window.UI.toast(devSimOffline ? '오프라인 상태를 시뮬레이션해요' : '온라인 상태로 되돌렸어요');
    render();
  }

  function onClick(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.getAttribute('data-action');
    var value = target.getAttribute('data-value');
    if (action === 'dp-set-note') devHasNote = value === '1';
    else if (action === 'dp-set-reservation') devIsReservation = value === '1';
    else if (action === 'dp-set-channel') devChannel = value;
    else if (action === 'dp-set-identifier') devIdentifierType = value;
    else if (action === 'dp-set-multimenu') devMultiMenu = value === '1';
    else if (action === 'dp-set-option') devHasOption = value === '1';
    else if (action === 'dp-set-reusable') devReusable = value === '1';
    else if (action === 'dp-set-promo') devPromoType = value;
    else if (action === 'dp-set-count') devCount = Number(value);
    else if (action === 'dp-add-order') { addOrders(); return; }
    else if (action === 'dp-toggle-offline') { toggleOffline(); return; }
    else if (action === 'dp-toggle-panel') { panelOpen = !panelOpen; render(); return; }
    else return;
    render();
  }

  function checkVisibility() {
    var visible = !!currentOwnerContext();
    if (visible !== lastVisible) {
      lastVisible = visible;
      render();
    }
  }

  function init() {
    var style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    document.addEventListener('click', onClick);
    render();
    setInterval(checkVisibility, 800);
  }

  window.DevTools = { isOffline: isOffline };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
