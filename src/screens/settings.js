/*
 * 사장님 설정 메인 화면
 * - 영업상태 변경 (개점/일시중지/마감)
 * - 자동수락 여부 토글
 * - 메뉴관리 / 주문 관리 / 고객 대기 관리 / 매출조회 / 권한 잠금 설정 / QR메뉴판 진입
 * - 로그아웃
 */
(function () {
  function currentStoreId() {
    var user = window.MockApi.getCurrentUser();
    return user && user.storeId;
  }

  function actionButtonsHtml(status) {
    if (status === 'CLOSED') {
      return '<button type="button" class="btn btn-sm btn-success" data-status-action="OPEN">개점</button>';
    }
    if (status === 'OPEN') {
      return (
        '<button type="button" class="btn btn-sm btn-warning" data-status-action="PAUSED">일시중지</button>' +
        '<button type="button" class="btn btn-sm btn-danger-solid" data-status-action="CLOSED">마감</button>'
      );
    }
    // PAUSED
    return (
      '<button type="button" class="btn btn-sm btn-success" data-status-action="OPEN">일시중지 해제</button>' +
      '<button type="button" class="btn btn-sm btn-danger-solid" data-status-action="CLOSED">마감</button>'
    );
  }

  function contentHtml(store) {
    var autoAcceptOn = !!store.autoAcceptOrders;
    var notificationOn = store.notificationEnabled !== false;
    var volume = store.notificationVolume != null ? store.notificationVolume : 70;
    return (
      '<div class="settings-list-item no-toggle-click">' +
        '<div class="icon">🏪</div>' +
        '<div class="label-group">' +
          '<div class="label">영업 상태</div>' +
          window.UI.statusPillHtml(store.operatingStatus) +
        '</div>' +
        '<div class="settings-inline-actions">' + actionButtonsHtml(store.operatingStatus) + '</div>' +
      '</div>' +

      '<div class="settings-list-item no-toggle-click">' +
        '<div class="icon">⚡</div>' +
        '<div class="label-group">' +
          '<div class="label">자동 수락</div>' +
          '<div class="label-sub">' + (autoAcceptOn ? '신규 주문이 대기 없이 바로 접수돼요' : '신규 주문은 미수락 목록에서 확인 후 접수해요') + '</div>' +
        '</div>' +
        '<button type="button" class="toggle' + (autoAcceptOn ? ' on' : '') + '" id="auto-accept-toggle"><span class="toggle-knob"></span></button>' +
      '</div>' +

      '<div class="settings-list-item no-toggle-click">' +
        '<div class="icon">🔔</div>' +
        '<div class="label-group">' +
          '<div class="label">알림 설정</div>' +
          '<div class="label-sub">' + (notificationOn ? '소리 · 푸시 · 진동으로 새 주문을 알려드려요' : '소리 · 푸시 알림이 꺼져 있어요') + '</div>' +
        '</div>' +
        '<button type="button" class="toggle' + (notificationOn ? ' on' : '') + '" id="notification-toggle"><span class="toggle-knob"></span></button>' +
      '</div>' +
      (notificationOn ?
        '<div class="notification-volume-row">' +
          '<span class="notification-volume-label">알림음 크기</span>' +
          '<input type="range" min="0" max="100" step="5" value="' + volume + '" id="notification-volume-slider" />' +
          '<span class="notification-volume-value" id="notification-volume-value">' + volume + '</span>' +
          '<button type="button" class="pill-btn" id="notification-preview-btn">🔊 미리듣기</button>' +
        '</div>' +
        (volume === 0 ? '<div class="notification-volume-hint">소리 크기가 0이라 진동으로만 알려드려요</div>' : '')
        : ''
      ) +

      '<div class="divider-line"></div>' +

      '<div class="settings-list-item" data-nav="menuManagement">' +
        '<div class="icon">🍽️</div><div class="label">메뉴 추가 및 수정</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="orderManagement">' +
        '<div class="icon">📦</div><div class="label">주문 관리</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="customerGuideSettings">' +
        '<div class="icon">📢</div><div class="label">고객 대기 관리</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="sales">' +
        '<div class="icon">💰</div><div class="label">매출 조회</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="permissionLock">' +
        '<div class="icon">🔐</div><div class="label">권한 잠금 설정</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="qrMenu">' +
        '<div class="icon">📱</div><div class="label">QR 메뉴판 보기</div><div class="chevron">›</div>' +
      '</div>' +

      '<div class="divider-line"></div>' +

      '<div class="settings-list-item settings-logout" id="logout-btn">' +
        '<div class="icon">🚪</div><div class="label">로그아웃</div>' +
      '</div>'
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
        '.settings-inline-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-left:auto;}' +
        '.settings-inline-actions .btn{height:32px;min-height:32px;padding:0 10px;font-size:12px;border-radius:10px;width:auto;white-space:nowrap;}' +
        '.settings-list-item .chevron{color:var(--color-text-secondary);flex-shrink:0;font-size:20px;margin-left:auto;}' +
        '.settings-logout .label{color:var(--color-accent-red);}' +
        '.settings-logout .icon{filter:none;}' +
        '.notification-volume-row{display:flex;align-items:center;gap:10px;padding:0 var(--space-5) var(--space-3) 48px;}' +
        '.notification-volume-label{font-size:var(--font-size-caption);color:var(--color-text-secondary);font-weight:600;flex-shrink:0;white-space:nowrap;}' +
        '.notification-volume-row input[type=range]{flex:1;accent-color:var(--color-text-primary);}' +
        '.notification-volume-value{font-size:var(--font-size-caption);font-weight:700;width:28px;text-align:right;flex-shrink:0;}' +
        '.notification-volume-row .pill-btn{flex-shrink:0;}' +
        '.notification-volume-hint{font-size:var(--font-size-micro);color:var(--color-text-secondary);padding:0 var(--space-5) var(--space-3) 48px;}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="settings-back">←</button></div>' +
        '<div class="topbar-title">설정</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll"><div id="settings-list-wrap"></div></div>'
    );
  }

  function mount(root) {
    var user = window.MockApi.getCurrentUser();
    var storeId = user.storeId;

    function bindListEvents(wrap) {
      wrap.querySelectorAll('[data-status-action]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var newStatus = btn.getAttribute('data-status-action');

          function applyStatusChange() {
            if (newStatus === 'CLOSED') {
              window.UI.confirmModal(
                '정말 마감하시겠습니까?',
                '마감을 진행하면 처리중에 있는 모든 주문건이 완료 처리됩니다.',
                '마감하기',
                function () {
                  var result = window.MockApi.closeStoreAndCompleteProcessing(storeId);
                  window.UI.toast(result.completedCount > 0
                    ? ('영업 상태가 변경되었어요 · 처리중 주문 ' + result.completedCount + '건이 완료 처리됐어요')
                    : '영업 상태가 변경되었어요');
                  refresh();
                },
                { danger: true }
              );
              return;
            }
            window.MockApi.updateOperatingStatus(storeId, newStatus);
            window.UI.toast('영업 상태가 변경되었어요');
            refresh();
          }

          window.UI.requirePasswordGate(storeId, 'statusChange', '영업상태 변경', applyStatusChange);
        });
      });

      var autoToggle = wrap.querySelector('#auto-accept-toggle');
      if (autoToggle) {
        autoToggle.addEventListener('click', function () {
          var store = window.MockApi.getStore(storeId);
          var next = !store.autoAcceptOrders;

          if (next) {
            var waitingCount = window.MockApi.getOrders(storeId, { status: 'WAITING' }).length;
            if (waitingCount > 0) {
              window.UI.confirmModal(
                '자동 수락으로 전환할까요?',
                '전환하면 지금 미수락 상태인 주문 ' + waitingCount + '건이 모두 자동 수락(처리중)되고, 앞으로 미수락 탭이 보이지 않아요.',
                '전환하기',
                function () {
                  var result = window.MockApi.updateAutoAccept(storeId, true);
                  window.UI.toast('자동 수락을 켰어요 · 미수락 상태였던 ' + result.autoAcceptedCount + '건을 자동 수락했어요');
                  refresh();
                }
              );
              return;
            }
          }
          window.MockApi.updateAutoAccept(storeId, next);
          window.UI.toast(next ? '자동 수락을 켰어요' : '자동 수락을 껐어요');
          refresh();
        });
      }

      var notificationToggle = wrap.querySelector('#notification-toggle');
      if (notificationToggle) {
        notificationToggle.addEventListener('click', function () {
          var store = window.MockApi.getStore(storeId);
          var next = !(store.notificationEnabled !== false);
          window.MockApi.updateNotificationSettings(storeId, { enabled: next });
          window.UI.toast(next ? '알림을 켰어요' : '알림을 껐어요');
          refresh();
        });
      }

      var volumeSlider = wrap.querySelector('#notification-volume-slider');
      var volumeValue = wrap.querySelector('#notification-volume-value');
      if (volumeSlider) {
        volumeSlider.addEventListener('input', function () {
          if (volumeValue) volumeValue.textContent = volumeSlider.value;
        });
        volumeSlider.addEventListener('change', function () {
          var vol = Number(volumeSlider.value);
          window.MockApi.updateNotificationSettings(storeId, { volume: vol });
          window.UI.playNotificationPreview(vol);
          refresh();
        });
      }
      var previewBtn = wrap.querySelector('#notification-preview-btn');
      if (previewBtn) {
        previewBtn.addEventListener('click', function () {
          var vol = volumeSlider ? Number(volumeSlider.value) : 0;
          window.UI.playNotificationPreview(vol);
        });
      }

      var GATED_NAV = { sales: { scopeKey: 'sales', label: '매출 조회' } };
      wrap.querySelectorAll('[data-nav]').forEach(function (row) {
        row.addEventListener('click', function () {
          var target = row.getAttribute('data-nav');
          function proceed() { window.Router.showScreen(target, {}); }
          var gate = GATED_NAV[target];
          if (gate) {
            window.UI.requirePasswordGate(storeId, gate.scopeKey, gate.label, proceed);
          } else {
            proceed();
          }
        });
      });

      var logoutBtn = wrap.querySelector('#logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
          window.UI.confirmModal('로그아웃', '정말 로그아웃 하시겠어요?', '로그아웃', function () {
            window.MockApi.logout();
            window.Router.resetTo('login');
          }, { danger: true });
        });
      }
    }

    function refresh() {
      var store = window.MockApi.getStore(storeId);
      var wrap = root.querySelector('#settings-list-wrap');
      wrap.innerHTML = contentHtml(store);
      bindListEvents(wrap);
    }

    root.querySelector('#settings-back').addEventListener('click', function () {
      window.Router.back();
    });

    refresh();
  }

  function unmount() {}

  window.Router.register('settings', { render: render, mount: mount, unmount: unmount });
})();
