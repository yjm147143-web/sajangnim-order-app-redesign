/*
 * 사장님 설정 메인 화면
 * - 영업상태 변경 (개점/일시중지/마감)
 * - 자동수락 여부 토글
 * - 메뉴관리 / 주문 관리 / 고객 대기 관리 / 매출조회 / 권한 잠금 설정 / QR메뉴판 진입
 * - 로그아웃
 */
(function () {
  function currentStoreId() {
    return window.MockApi.getContextStoreId();
  }

  function actionButtonsHtml(status) {
    if (status === 'CLOSED') {
      return '<button type="button" class="status-action-btn pastel-green" data-status-action="OPEN">개점</button>';
    }
    if (status === 'OPEN') {
      return (
        '<button type="button" class="status-action-btn pastel-amber" data-status-action="PAUSED">일시중지</button>' +
        '<button type="button" class="status-action-btn pastel-red" data-status-action="CLOSED">마감</button>'
      );
    }
    // PAUSED
    return (
      '<button type="button" class="status-action-btn pastel-green" data-status-action="OPEN">일시중지 해제</button>' +
      '<button type="button" class="status-action-btn pastel-red" data-status-action="CLOSED">마감</button>'
    );
  }

  function dateTimeLabel(iso) {
    var d = new Date(iso);
    var yy = String(d.getFullYear()).slice(2);
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mi = String(d.getMinutes()).padStart(2, '0');
    return yy + '.' + mm + '.' + dd + ' ' + hh + ':' + mi;
  }

  // 일시중지는 부제 표시에 변동을 주지 않는다 — 개점 부제는 오늘 최초 개점 시각을 그대로 유지한다
  function statusTimeSubtitle(store) {
    if (store.operatingStatus === 'CLOSED') {
      return store.statusChangedAt ? '(' + dateTimeLabel(store.statusChangedAt) + ' 마감)' : '';
    }
    var openTs = store.todayFirstOpenAt || store.statusChangedAt;
    return openTs ? '(' + dateTimeLabel(openTs) + ' 개점)' : '';
  }

  var NOTICE_URL = 'https://dev-admin.qrorder.ai.kr/home';

  function contentHtml(store) {
    var autoAcceptOn = !!store.autoAcceptOrders;
    return (
      '<div class="settings-list-item no-toggle-click status-list-item">' +
        '<div class="icon">🏪</div>' +
        '<div class="label-group">' +
          '<div class="label">영업 상태</div>' +
          '<div class="status-subtitle-row">' + window.UI.statusPillHtml(store.operatingStatus) +
            '<span class="status-time-sub">' + statusTimeSubtitle(store) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="status-action-row">' + actionButtonsHtml(store.operatingStatus) + '</div>' +

      '<div class="settings-list-item no-toggle-click">' +
        '<div class="icon">⚡</div>' +
        '<div class="label-group">' +
          '<div class="label">자동 수락</div>' +
          '<div class="label-sub">' + (autoAcceptOn ? '신규 주문이 대기 없이 바로 접수돼요' : '신규 주문은 미수락 목록에서 확인 후 접수해요') + '</div>' +
        '</div>' +
        '<button type="button" class="toggle' + (autoAcceptOn ? ' on' : '') + '" id="auto-accept-toggle"><span class="toggle-knob"></span></button>' +
      '</div>' +

      '<div class="divider-line"></div>' +

      '<div class="settings-list-item" data-nav="notificationSettings">' +
        '<div class="icon">🔔</div><div class="label">알림 설정</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="menuManagement">' +
        '<div class="icon">🍽️</div><div class="label">메뉴 추가 및 수정</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="orderManagement">' +
        '<div class="icon">📦</div><div class="label">주문 관리</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="customerGuideSettings">' +
        '<div class="icon">📢</div><div class="label">손님 대기 관리</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="qrMenu">' +
        '<div class="icon">📱</div><div class="label">QR 메뉴판 보기</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="sales">' +
        '<div class="icon">💰</div><div class="label">매출 조회</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="permissionLock">' +
        '<div class="icon">🔐</div><div class="label">권한 잠금 설정</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" id="notice-link-btn">' +
        '<div class="icon">📣</div><div class="label">공지사항</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item settings-logout" id="logout-btn">' +
        '<div class="icon">🚪</div><div class="label">로그아웃</div>' +
      '</div>' +

      '<div class="settings-footer-row">' +
        '<button type="button" class="settings-footer-link" id="terms-link-btn">약관 보기</button>' +
        '<span class="settings-footer-sep">·</span>' +
        '<button type="button" class="settings-footer-link" id="log-send-btn">로그 전송</button>' +
      '</div>'
    );
  }

  function render() {
    var actingStoreId = window.MockApi.getActingStoreId();
    var actingStore = actingStoreId ? window.MockApi.getStore(actingStoreId) : null;
    var titleText = actingStore ? actingStore.name + ' 설정' : '설정';
    return (
      '<style>' +
        '.settings-list-item .chevron{color:var(--color-text-secondary);flex-shrink:0;font-size:20px;margin-left:auto;}' +
        '.settings-logout .label{color:var(--color-accent-red);}' +
        '.settings-logout .icon{filter:none;}' +
        '.status-list-item{padding-bottom:var(--space-2);}' +
        '.status-subtitle-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}' +
        '.status-time-sub{font-size:var(--font-size-micro);color:var(--color-text-secondary);font-weight:600;}' +
        '.status-action-row{display:flex;gap:var(--space-2);padding:0 var(--space-5) var(--space-4);}' +
        '.status-action-btn{flex:1;height:48px;border:none;border-radius:var(--radius-button);' +
          'font-size:var(--font-size-body);font-weight:800;cursor:pointer;}' +
        '.status-action-btn.pastel-green{background:var(--color-accent-green-bg);color:var(--color-accent-green);}' +
        '.status-action-btn.pastel-amber{background:var(--color-accent-amber-bg);color:#a15c00;}' +
        '.status-action-btn.pastel-red{background:var(--color-accent-red-bg);color:var(--color-accent-red);}' +
        '.settings-footer-row{display:flex;align-items:center;justify-content:center;gap:8px;padding:24px var(--space-5) 32px;}' +
        '.settings-footer-link{background:none;border:none;padding:2px;font-size:11px;color:var(--color-text-secondary);opacity:0.6;cursor:pointer;}' +
        '.settings-footer-sep{font-size:11px;color:var(--color-text-secondary);opacity:0.4;}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="settings-back">←</button></div>' +
        '<div class="topbar-title">' + window.UI.escapeHtml(titleText) + '</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll"><div id="settings-list-wrap"></div></div>'
    );
  }

  function mount(root) {
    var storeId = currentStoreId();

    function bindListEvents(wrap) {
      wrap.querySelectorAll('[data-status-action]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var newStatus = btn.getAttribute('data-status-action');
          var storeBefore = window.MockApi.getStore(storeId);

          function applyStatusChange() {
            if (newStatus === 'CLOSED') {
              window.UI.confirmModal(
                '지금 영업을 마감할까요?',
                '영업을 마감하면, 대기 중이거나 처리하고 있던 주문도 모두 완료돼요.',
                '마감하기',
                function () {
                  var result = window.MockApi.closeStoreAndCompleteProcessing(storeId);
                  window.UI.toast(result.completedCount > 0
                    ? ('영업 상태가 변경되었어요 · 처리중 주문 ' + result.completedCount + '건이 완료 처리됐어요')
                    : '영업 상태가 변경되었어요');
                  refresh();
                },
                { danger: true, cancelLabel: '닫기' }
              );
              return;
            }
            // '개점'(마감→영업)일 때만 시작 확인 팝업을 보여준다 — 일시중지 해제는 계속 영업 중이었으므로 제외
            if (newStatus === 'OPEN' && storeBefore.operatingStatus === 'CLOSED') {
              window.UI.confirmModal(
                '지금 영업을 시작할까요?',
                '영업을 시작하면 손님이 주문을 할 수 있어요.',
                '시작하기',
                function () {
                  window.MockApi.updateOperatingStatus(storeId, newStatus);
                  window.UI.toast('영업 상태가 변경되었어요');
                  refresh();
                },
                { cancelLabel: '닫기' }
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
                '전환하면 지금 <strong>미수락 상태인 주문 ' + waitingCount + '건이 모두 자동 수락</strong>(처리중)되고, 앞으로 미수락 탭이 보이지 않아요.',
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

      var termsBtn = wrap.querySelector('#terms-link-btn');
      if (termsBtn) termsBtn.addEventListener('click', function () { window.open(NOTICE_URL, '_blank', 'noopener'); });
      var noticeBtn = wrap.querySelector('#notice-link-btn');
      if (noticeBtn) noticeBtn.addEventListener('click', function () { window.open(NOTICE_URL, '_blank', 'noopener'); });
      var logSendBtn = wrap.querySelector('#log-send-btn');
      if (logSendBtn) logSendBtn.addEventListener('click', function () { window.UI.toast('로그를 전송했어요'); });

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
          window.UI.confirmModal('로그아웃', '정말 로그아웃 하시겠어요?', '로그아웃하기', function () {
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
