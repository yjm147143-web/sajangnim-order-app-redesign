/*
 * 주문 방식 관리 화면 (설정 > 주문 관리 > 주문 방식 관리)
 * - 예약 주문 / 딜리버리(좌석번호) 주문 / 고객 요청사항 수신 여부를 매장이 직접 켜고 끈다.
 * - 꺼진 항목은 개발자 테스트 패널에서도 해당 옵션이 비활성화되어, 실제로 그 유형의
 *   주문이 인입되지 않는 것처럼 시뮬레이션된다.
 * - 예약 주문 ON일 때는 예약 접수 시간(운영 시간과 동일 / 직접 설정)도 함께 관리한다.
 *   '운영 시간'이라는 개념이 앱 전체에 따로 없어, 이 화면에서 처음 정의한다.
 */
(function () {
  function currentStoreId() {
    var user = window.MockApi.getCurrentUser();
    return user && user.storeId;
  }

  function rowHtml(icon, id, label, sub, on) {
    return (
      '<div class="settings-list-item no-toggle-click">' +
        '<div class="icon">' + icon + '</div>' +
        '<div class="label-group">' +
          '<div class="label">' + label + '</div>' +
          '<div class="label-sub">' + sub + '</div>' +
        '</div>' +
        '<button type="button" class="toggle' + (on ? ' on' : '') + '" id="' + id + '"><span class="toggle-knob"></span></button>' +
      '</div>'
    );
  }

  function timeRangeHtml(idPrefix, start, end) {
    return (
      '<div class="ocs-time-row">' +
        '<input type="time" class="ocs-time-input" id="' + idPrefix + '-start" value="' + start + '" />' +
        '<span class="ocs-time-sep">~</span>' +
        '<input type="time" class="ocs-time-input" id="' + idPrefix + '-end" value="' + end + '" />' +
      '</div>'
    );
  }

  function reservationHoursHtml(settings) {
    if (!settings.acceptReservationOrders) return '';
    var isOperating = settings.reservationHoursMode !== 'CUSTOM';
    return (
      '<div class="ocs-subsection">' +
        '<div class="ocs-subsection-title">예약 접수 시간</div>' +
        '<div class="choice-pair" id="ocs-hours-mode">' +
          '<button type="button" class="' + (isOperating ? 'on' : '') + '" data-hours-mode="OPERATING">운영 시간과 동일하게 할게요</button>' +
          '<button type="button" class="' + (!isOperating ? 'on' : '') + '" data-hours-mode="CUSTOM">직접 설정</button>' +
        '</div>' +
        (isOperating
          ? timeRangeHtml('ocs-operating', settings.operatingHoursStart, settings.operatingHoursEnd) +
            '<div class="ocs-time-hint">여기서 설정한 시간이 매장 운영 시간이자 예약 접수 시간이에요</div>'
          : timeRangeHtml('ocs-custom', settings.reservationCustomStart, settings.reservationCustomEnd) +
            '<div class="ocs-time-hint">이 시간 동안만 예약 주문을 받아요</div>'
        ) +
      '</div>'
    );
  }

  function contentHtml(settings) {
    return (
      rowHtml('📅', 'ocs-reservation-toggle', '예약 주문',
        settings.acceptReservationOrders ? '예약 주문을 받고 있어요' : '예약 주문을 받지 않아요',
        settings.acceptReservationOrders) +
      reservationHoursHtml(settings) +
      '<div class="divider-line"></div>' +
      rowHtml('🛎️', 'ocs-seat-toggle', '딜리버리 주문',
        settings.acceptSeatOrders ? '켜면 좌석번호 주문도 함께 들어와요' : '꺼져 있으면 호출번호 주문만 들어와요',
        settings.acceptSeatOrders) +
      '<div class="divider-line"></div>' +
      rowHtml('💬', 'ocs-note-toggle', '고객 요청사항',
        settings.acceptCustomerNotes ? '주문 시 고객 요청사항을 받고 있어요' : '고객 요청사항을 받지 않아요',
        settings.acceptCustomerNotes)
    );
  }

  function render() {
    return (
      '<style>' +
        '.settings-list-item.no-toggle-click{cursor:default;flex-wrap:wrap;row-gap:8px;}' +
        '.settings-list-item.no-toggle-click:active{background:transparent;}' +
        '.settings-list-item .label-group{display:flex;flex-direction:column;gap:4px;flex:0 1 auto;min-width:0;}' +
        '.settings-list-item .label-group .label{flex:none;}' +
        '.settings-list-item .label-sub{font-size:var(--font-size-caption);color:var(--color-text-secondary);font-weight:500;}' +
        '.ocs-subsection{padding:0 var(--space-5) var(--space-4);}' +
        '.ocs-subsection-title{font-size:var(--font-size-caption);font-weight:700;color:var(--color-text-secondary);margin-bottom:8px;}' +
        '.choice-pair{display:flex;gap:8px;margin-bottom:10px;}' +
        '.choice-pair button{flex:1;padding:10px 8px;border:1.5px solid var(--color-disabled);border-radius:var(--radius-button);' +
          'background:var(--color-white);font-size:var(--font-size-caption);font-weight:700;color:var(--color-text-secondary);cursor:pointer;}' +
        '.choice-pair button.on{border-color:var(--color-text-primary);background:var(--color-text-primary);color:var(--color-white);}' +
        '.ocs-time-row{display:flex;align-items:center;gap:8px;}' +
        '.ocs-time-input{flex:1;height:44px;border:1.5px solid var(--color-disabled);border-radius:var(--radius-button);' +
          'padding:0 10px;font-size:var(--font-size-body);font-weight:700;color:var(--color-text-primary);}' +
        '.ocs-time-sep{color:var(--color-text-secondary);flex-shrink:0;}' +
        '.ocs-time-hint{font-size:var(--font-size-micro);color:var(--color-text-secondary);margin-top:8px;}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="ocs-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">주문 방식 관리</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll"><div id="ocs-content"></div></div>'
    );
  }

  function mount(root) {
    var storeId = currentStoreId();

    function refresh() {
      var settings = window.MockApi.getOrderChannelSettings(storeId);
      root.querySelector('#ocs-content').innerHTML = contentHtml(settings);
      bindEvents(settings);
    }

    function bindEvents(settings) {
      root.querySelector('#ocs-reservation-toggle').addEventListener('click', function () {
        var next = !settings.acceptReservationOrders;
        window.MockApi.updateOrderChannelSettings(storeId, { acceptReservationOrders: next });
        window.UI.toast(next ? '예약 주문을 받기 시작해요' : '예약 주문을 받지 않아요');
        refresh();
      });
      root.querySelector('#ocs-seat-toggle').addEventListener('click', function () {
        var next = !settings.acceptSeatOrders;
        window.MockApi.updateOrderChannelSettings(storeId, { acceptSeatOrders: next });
        window.UI.toast(next ? '딜리버리(좌석번호) 주문을 받기 시작해요' : '딜리버리 주문을 받지 않아요 · 호출번호 주문만 들어와요');
        refresh();
      });
      root.querySelector('#ocs-note-toggle').addEventListener('click', function () {
        var next = !settings.acceptCustomerNotes;
        window.MockApi.updateOrderChannelSettings(storeId, { acceptCustomerNotes: next });
        window.UI.toast(next ? '고객 요청사항을 받기 시작해요' : '고객 요청사항을 받지 않아요');
        refresh();
      });

      var hoursModeWrap = root.querySelector('#ocs-hours-mode');
      if (hoursModeWrap) {
        hoursModeWrap.querySelectorAll('[data-hours-mode]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var mode = btn.getAttribute('data-hours-mode');
            window.MockApi.updateOrderChannelSettings(storeId, { reservationHoursMode: mode });
            window.UI.toast(mode === 'OPERATING' ? '운영 시간과 동일하게 설정했어요' : '예약 접수 시간을 직접 설정해요');
            refresh();
          });
        });
      }
      var opStart = root.querySelector('#ocs-operating-start');
      var opEnd = root.querySelector('#ocs-operating-end');
      if (opStart && opEnd) {
        [opStart, opEnd].forEach(function (input) {
          input.addEventListener('change', function () {
            window.MockApi.updateOrderChannelSettings(storeId, {
              operatingHoursStart: opStart.value,
              operatingHoursEnd: opEnd.value,
            });
            window.UI.toast('운영 시간을 저장했어요');
          });
        });
      }
      var cuStart = root.querySelector('#ocs-custom-start');
      var cuEnd = root.querySelector('#ocs-custom-end');
      if (cuStart && cuEnd) {
        [cuStart, cuEnd].forEach(function (input) {
          input.addEventListener('change', function () {
            window.MockApi.updateOrderChannelSettings(storeId, {
              reservationCustomStart: cuStart.value,
              reservationCustomEnd: cuEnd.value,
            });
            window.UI.toast('예약 접수 시간을 저장했어요');
          });
        });
      }
    }

    root.querySelector('#ocs-back').addEventListener('click', function () {
      window.Router.back();
    });

    refresh();
  }

  function unmount() {}

  window.Router.register('orderChannelSettings', { render: render, mount: mount, unmount: unmount });
})();
