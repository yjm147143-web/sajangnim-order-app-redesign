/*
 * 개발자 도구 (QA/데모용, 실제 제품 화면이 아님)
 * 폰 목업(.device-frame) 바깥에 별도로 렌더링해, 주문을 추가해도 폰 화면 변화가
 * 항상 같이 보이도록 한다.
 * - 1. 테스트 주문 만들기: 조건별 필드를 조합해 원하는 형태의 주문을 원하는 개수만큼 즉시 생성
 * - 2. 현장 시뮬레이션 도구: 네트워크 단절 / 결제 방식(PG·VAN) / 메뉴 자동품절 트리거
 * 세로로 길어지지 않도록 각 섹션·서브섹션을 가로로 나란히 배치하고, 내용이 늘어나면
 * 패널 폭을 넓혀 옆으로 확장되게 한다(모바일 폭에서는 자연스럽게 줄바꿈됨).
 */
(function () {
  var STYLE = '' +
    '#dev-panel-host{width:100%;display:flex;justify-content:center;}' +
    '.dp-panel{width:min(880px, 96vw);background:#15152b;border:2px dashed #7C2FF0;border-radius:16px;' +
    'padding:14px 16px;box-sizing:border-box;font-family:inherit;}' +
    '.dp-panel-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}' +
    '.dp-title{font-size:13px;font-weight:800;color:#c9baff;letter-spacing:0.3px;}' +
    '.dp-collapse-btn{background:none;border:none;color:#8b8bab;font-size:18px;line-height:1;cursor:pointer;padding:2px 4px;}' +
    '.dp-collapse-btn:active{color:#fff;}' +
    '.dp-sections{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;}' +
    '.dp-section{flex:1 1 360px;min-width:280px;background:#1c1c34;border-radius:12px;padding:12px 14px;box-sizing:border-box;}' +
    '.dp-section-title{font-size:12.5px;font-weight:800;color:#fff;margin-bottom:10px;}' +
    '.dp-subsections{display:flex;gap:16px;flex-wrap:wrap;}' +
    '.dp-subsection{flex:1 1 165px;min-width:155px;display:flex;flex-direction:column;gap:9px;}' +
    '.dp-subsection-title{font-size:10.5px;font-weight:700;color:#8b8bab;}' +
    '.dp-group{display:flex;flex-direction:column;gap:5px;}' +
    '.dp-group-label{font-size:11px;font-weight:700;color:#8b8bab;white-space:nowrap;}' +
    '.dp-pill-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}' +
    '.dp-pill{background:#2a2a45;border:1px solid #45456b;color:#d8d8ea;font-size:12px;font-weight:700;' +
    'padding:6px 12px;border-radius:999px;cursor:pointer;white-space:nowrap;}' +
    '.dp-pill.active{background:#7C2FF0;border-color:#7C2FF0;color:#fff;}' +
    '.dp-pill:disabled{opacity:0.35;cursor:not-allowed;}' +
    '.dp-custom-input{width:56px;height:30px;border-radius:8px;border:1px solid #45456b;background:#2a2a45;' +
    'color:#fff;font-size:12px;font-weight:700;text-align:center;padding:0 4px;}' +
    '.dp-sim-row{display:flex;flex-direction:column;gap:9px;}' +
    '.dp-actions-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px;}' +
    '.dp-add-btn{flex:1;min-width:160px;background:#7C2FF0;color:#fff;border:none;font-size:13px;font-weight:800;' +
    'padding:12px 14px;border-radius:12px;cursor:pointer;}' +
    '.dp-add-btn:active{opacity:0.85;}' +
    '.dp-add-btn:disabled{background:#3a3a52;color:#8b8bab;cursor:not-allowed;}' +
    '.dp-offline-hint{font-size:11px;color:#ff9a9a;margin-top:8px;line-height:1.4;}' +
    '.dp-tab{width:min(880px, 96vw);height:44px;border-radius:14px;background:#15152b;' +
    'border:2px dashed #7C2FF0;color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;' +
    'justify-content:center;gap:8px;cursor:pointer;box-sizing:border-box;}' +
    '.dp-tab:active{opacity:0.85;}';

  var devChannel = 'QR';
  var devIdentifierType = 'PICKUP';
  var devContactType = 'PHONE';
  var devReusable = false;
  var devIsReservation = false;
  var devHappyHour = false;
  var devFirstCome = false;
  var devHasOption = false;
  var devMenuCountMode = '1';
  var devMenuCountCustom = 3;
  var devOrderCountMode = '1';
  var devOrderCountCustom = 3;
  var devSimOffline = false;
  var devPaymentMethod = 'PG';
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

  // ON/OFF 토글형 그룹: 각 항목이 서로 독립적으로 켜고 끌 수 있는 버튼(다회용기/예약/해피아워/선착순)
  function toggleGroupHtml(label, items, disabledKeys) {
    disabledKeys = disabledKeys || [];
    return '<div class="dp-group">' +
      '<span class="dp-group-label">' + label + '</span>' +
      '<div class="dp-pill-row">' +
      items.map(function (it) {
        var isDisabled = disabledKeys.indexOf(it.key) !== -1;
        return '<button type="button" class="dp-pill' + (it.on ? ' active' : '') + '" data-action="dp-toggle" data-key="' + it.key + '"' + (isDisabled ? ' disabled' : '') + '>' + it.label + '</button>';
      }).join('') +
      '</div></div>';
  }

  function countGroupHtml(label, mode, customValue, action, customAction) {
    var presets = [{ v: '1', label: '1개' }, { v: '5', label: '5개' }, { v: '10', label: '10개' }, { v: 'custom', label: '직접입력' }];
    return '<div class="dp-group">' +
      '<span class="dp-group-label">' + label + '</span>' +
      '<div class="dp-pill-row">' +
      presets.map(function (o) {
        return '<button type="button" class="dp-pill' + (mode === o.v ? ' active' : '') + '" data-action="' + action + '" data-value="' + o.v + '">' + o.label + '</button>';
      }).join('') +
      (mode === 'custom' ? '<input type="number" min="1" max="50" class="dp-custom-input" data-action="' + customAction + '" value="' + customValue + '" />' : '') +
      '</div></div>';
  }

  // 매장의 '주문 방식 관리' 설정에 따라, 현재 dev 상태가 허용되지 않는 값이면 되돌린다.
  function clampDevState(channelSettings) {
    if (!channelSettings.acceptReservationOrders && devIsReservation) devIsReservation = false;
    if (!channelSettings.acceptSeatOrders && devIdentifierType === 'SEAT') devIdentifierType = 'PICKUP';
  }

  function effectiveCount(mode, customValue) {
    if (mode === 'custom') return Math.min(50, Math.max(1, Number(customValue) || 1));
    return Number(mode);
  }

  function tabHtml() {
    return '<button type="button" class="dp-tab" data-action="dp-toggle-panel" aria-label="개발자 도구 열기">🛠️ 개발자 도구 열기</button>';
  }

  function orderTypeSectionHtml(channelSettings) {
    return (
      '<div class="dp-subsection">' +
        '<div class="dp-subsection-title">주문 유형 설정하기</div>' +
        pillGroupHtml('주문 채널', [{ v: 'QR', label: 'QR오더' }, { v: 'TABLET', label: '키오스크' }], devChannel, 'dp-set-channel') +
        pillGroupHtml('주문 방식', [{ v: 'PICKUP', label: '호출번호' }, { v: 'SEAT', label: '자리번호' }], devIdentifierType, 'dp-set-identifier',
          channelSettings.acceptSeatOrders ? [] : ['SEAT']) +
        pillGroupHtml('연락처', [{ v: 'PHONE', label: '핸드폰 번호' }, { v: 'EMAIL', label: '이메일' }], devContactType, 'dp-set-contact') +
        toggleGroupHtml('주문 유형', [
          { key: 'reusable', label: '다회용기', on: devReusable },
          { key: 'reservation', label: '예약', on: devIsReservation },
          { key: 'happyHour', label: '해피아워', on: devHappyHour },
          { key: 'firstCome', label: '선착순', on: devFirstCome },
        ], channelSettings.acceptReservationOrders ? [] : ['reservation']) +
      '</div>'
    );
  }

  function menuSettingSectionHtml() {
    return (
      '<div class="dp-subsection">' +
        '<div class="dp-subsection-title">메뉴 설정하기</div>' +
        pillGroupHtml('옵션', [{ v: '0', label: '없음' }, { v: '1', label: '있음' }], devHasOption ? '1' : '0', 'dp-set-option') +
        countGroupHtml('메뉴 수', devMenuCountMode, devMenuCountCustom, 'dp-set-menu-count', 'dp-set-menu-count-custom') +
        countGroupHtml('주문 건수', devOrderCountMode, devOrderCountCustom, 'dp-set-order-count', 'dp-set-order-count-custom') +
      '</div>'
    );
  }

  function simSectionHtml() {
    var orderCount = effectiveCount(devOrderCountMode, devOrderCountCustom);
    return (
      '<div class="dp-section">' +
        '<div class="dp-section-title">2. 현장 시뮬레이션 도구</div>' +
        '<div class="dp-sim-row">' +
          '<div class="dp-group">' +
            '<span class="dp-group-label">네트워크</span>' +
            '<div class="dp-pill-row">' +
              '<button type="button" class="dp-pill' + (devSimOffline ? ' active' : '') + '" data-action="dp-toggle-offline">' + (devSimOffline ? '🔴 오프라인(단절 중)' : '📶 네트워크 단절 시뮬레이션') + '</button>' +
            '</div>' +
          '</div>' +
          pillGroupHtml('결제 방식', [{ v: 'PG', label: 'PG 결제' }, { v: 'VAN', label: 'VAN 결제' }], devPaymentMethod, 'dp-set-payment') +
          '<div class="dp-group">' +
            '<span class="dp-group-label">재고</span>' +
            '<div class="dp-pill-row">' +
              '<button type="button" class="dp-pill" data-action="dp-trigger-soldout">🚫 메뉴 자동품절 발생</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        (devSimOffline ? '<div class="dp-offline-hint">오프라인 상태에서는 신규 주문이 들어올 수 없어요</div>' : '') +
      '</div>'
    );
  }

  function panelHtml(user) {
    var channelSettings = window.MockApi.getOrderChannelSettings(user.storeId);
    clampDevState(channelSettings);
    var orderCount = effectiveCount(devOrderCountMode, devOrderCountCustom);
    return '<div class="dp-panel">' +
      '<div class="dp-panel-header">' +
      '<span class="dp-title">🛠️ 개발자 도구</span>' +
      '<button type="button" class="dp-collapse-btn" data-action="dp-toggle-panel" aria-label="접기">✕</button>' +
      '</div>' +
      '<div class="dp-sections">' +
        '<div class="dp-section">' +
          '<div class="dp-section-title">1. 테스트 주문 만들기</div>' +
          '<div class="dp-subsections">' +
            orderTypeSectionHtml(channelSettings) +
            menuSettingSectionHtml() +
          '</div>' +
          '<div class="dp-actions-row">' +
          '<button type="button" class="dp-add-btn" data-action="dp-add-order"' + (devSimOffline ? ' disabled' : '') + '>+ 주문 ' + orderCount + '건 추가</button>' +
          '</div>' +
        '</div>' +
        simSectionHtml() +
      '</div>' +
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
    var lineCount = effectiveCount(devMenuCountMode, devMenuCountCustom);
    var orderCount = effectiveCount(devOrderCountMode, devOrderCountCustom);
    var created = 0;
    for (var i = 0; i < orderCount; i++) {
      var order = window.MockApi.createCustomOrder(user.storeId, {
        isReservation: devIsReservation,
        channel: devChannel,
        identifierType: devIdentifierType,
        contactType: devContactType,
        lineCount: lineCount,
        hasOption: devHasOption,
        isReusableContainer: devReusable,
        hasHappyHour: devHappyHour,
        hasFirstCome: devFirstCome,
        paymentMethod: devPaymentMethod,
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

  function triggerAutoSoldout() {
    var user = currentOwnerContext();
    if (!user) return;
    var name = window.MockApi.triggerRandomAutoSoldout(user.storeId);
    if (!name) { window.UI.toast('품절시킬 메뉴가 없어요'); return; }
    window.dispatchEvent(new CustomEvent('mock:orders-changed', { detail: { storeId: user.storeId } }));
    window.UI.toast(name + ' 메뉴를 자동품절 처리했어요');
  }

  function onToggle(key) {
    if (key === 'reusable') devReusable = !devReusable;
    else if (key === 'reservation') devIsReservation = !devIsReservation;
    else if (key === 'happyHour') devHappyHour = !devHappyHour;
    else if (key === 'firstCome') devFirstCome = !devFirstCome;
  }

  function onClick(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.getAttribute('data-action');
    var value = target.getAttribute('data-value');
    if (action === 'dp-set-channel') devChannel = value;
    else if (action === 'dp-set-identifier') devIdentifierType = value;
    else if (action === 'dp-set-contact') devContactType = value;
    else if (action === 'dp-set-option') devHasOption = value === '1';
    else if (action === 'dp-toggle') { onToggle(target.getAttribute('data-key')); }
    else if (action === 'dp-set-menu-count') devMenuCountMode = value;
    else if (action === 'dp-set-order-count') devOrderCountMode = value;
    else if (action === 'dp-set-payment') devPaymentMethod = value;
    else if (action === 'dp-add-order') { addOrders(); return; }
    else if (action === 'dp-toggle-offline') { toggleOffline(); return; }
    else if (action === 'dp-trigger-soldout') { triggerAutoSoldout(); return; }
    else if (action === 'dp-toggle-panel') { panelOpen = !panelOpen; render(); return; }
    else return;
    render();
  }

  function onInput(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.getAttribute('data-action');
    if (action === 'dp-set-menu-count-custom') devMenuCountCustom = Number(target.value) || 1;
    else if (action === 'dp-set-order-count-custom') devOrderCountCustom = Number(target.value) || 1;
    else return;
    // 입력 중 재렌더링해 버튼 라벨(+ 주문 N건 추가)을 즉시 반영하되, 포커스는 유지한다.
    var host = document.getElementById('dev-panel-host');
    var active = document.activeElement === target;
    render();
    if (active) {
      var again = host.querySelector('[data-action="' + action + '"]');
      if (again) { again.focus(); again.select(); }
    }
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
    document.addEventListener('input', onInput);
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
