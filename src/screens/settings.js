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

  // 영업 상태는 파스텔 배지(statusPillHtml) 대신 아이콘 + 평문으로 보여준다 — 바로 옆에 실제
  // 조작 버튼이 붙으면서, 배지까지 색 덩어리로 두면 무엇이 눌리는 건지 헷갈린다.
  function statusPlainHtml(status) {
    var meta = window.UI.operatingStatusMeta(status);
    return '<div class="status-plain ' + meta.cls + '">' + meta.dot + ' ' + meta.label + '</div>';
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
      // 영업 상태는 설정 화면에서 가장 자주 쓰는 조작이라 목록 행이 아니라 카드로 띄워 둔다.
      // 좌측은 아이콘 칩 + (라벨 / 상태 / 개점 시각), 우측은 상태 변경 버튼을 위아래 같은 열로 세운다.
      '<div class="status-card">' +
        '<div class="status-card-icon">' + window.Icons3D.iconLine('store', 24) + '</div>' +
        '<div class="status-card-body">' +
          '<div class="status-card-label">영업 상태</div>' +
          statusPlainHtml(store.operatingStatus) +
          '<div class="status-time-sub">' + statusTimeSubtitle(store) + '</div>' +
        '</div>' +
        '<div class="status-action-col">' + actionButtonsHtml(store.operatingStatus) + '</div>' +
      '</div>' +

      '<div class="settings-list-item no-toggle-click">' +
        '<div class="icon">' + window.Icons3D.iconLine('bolt', 24) + '</div>' +
        '<div class="label-group">' +
          '<div class="label">자동 수락</div>' +
          '<div class="label-sub">' + (autoAcceptOn ? '신규 주문이 대기 없이 바로 접수돼요' : '신규 주문은 미수락 목록에서 확인 후 접수해요') + '</div>' +
        '</div>' +
        '<button type="button" class="toggle' + (autoAcceptOn ? ' on' : '') + '" role="switch" aria-checked="' + (autoAcceptOn ? 'true' : 'false') + '" id="auto-accept-toggle"><span class="toggle-knob"></span></button>' +
      '</div>' +

      '<div class="divider-line"></div>' +

      '<div class="settings-group-title">바로가기</div>' +
      '<div class="settings-list-item settings-shortcut-item" data-nav="kitchenBoard">' +
        '<div class="icon">' + window.Icons3D.iconLine('dome', 24) + '</div><div class="label">KDS 보기</div><div class="chevron">›</div>' +
      '</div>' +

      // 카테고리 사이를 회색 선으로 끊는다. 그룹 제목만으로는 어디서 묶음이 바뀌는지 약해서,
      // 로그아웃 위에 쓰던 것과 같은 .divider-line을 매장 관리 / 매출 / 환경설정 앞에 둔다.
      '<div class="divider-line"></div>' +

      '<div class="settings-group-title">매장 관리</div>' +
      '<div class="settings-list-item" data-nav="menuManagement">' +
        '<div class="icon">' + window.Icons3D.iconLine('plate', 24) + '</div><div class="label">메뉴 관리</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="customerGuideSettings">' +
        '<div class="icon">' + window.Icons3D.iconLine('megaphone', 24) + '</div><div class="label">손님 대기 관리</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="orderManagement">' +
        '<div class="icon">' + window.Icons3D.iconLine('box', 24) + '</div><div class="label">주문 관리</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="qrMenu">' +
        // 휴대폰 아이콘은 'QR'보다 '휴대폰'으로 먼저 읽혀서, 주문 채널 배지와 같은 qr 아이콘을 쓴다.
        '<div class="icon">' + window.Icons3D.iconLine('qr', 24) + '</div><div class="label">QR 메뉴판 보기</div><div class="chevron">›</div>' +
      '</div>' +

      '<div class="divider-line"></div>' +

      '<div class="settings-group-title">매출</div>' +
      '<div class="settings-list-item" data-nav="sales">' +
        '<div class="icon">' + window.Icons3D.iconLine('coins', 24) + '</div><div class="label">매출 조회</div><div class="chevron">›</div>' +
      '</div>' +

      '<div class="divider-line"></div>' +

      '<div class="settings-group-title">환경설정</div>' +
      '<div class="settings-list-item" data-nav="notificationSettings">' +
        '<div class="icon">' + window.Icons3D.iconLine('bell', 24) + '</div><div class="label">알림 설정</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" data-nav="permissionLock">' +
        '<div class="icon">' + window.Icons3D.iconLine('lock', 24) + '</div><div class="label">권한 잠금 설정</div><div class="chevron">›</div>' +
      '</div>' +
      '<div class="settings-list-item" id="notice-link-btn">' +
        '<div class="icon">' + window.Icons3D.iconLine('notice', 24) + '</div><div class="label">공지사항</div><div class="chevron">›</div>' +
      '</div>' +

      '<div class="divider-line"></div>' +

      '<div class="settings-list-item settings-logout" id="logout-btn">' +
        '<div class="icon">' + window.Icons3D.iconLine('door', 24) + '</div><div class="label">로그아웃</div>' +
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
        // 카드 좌우 여백은 화면 기본 거터(20px)와 맞추고, 아래 목록과 붙지 않게 아래 여백을 둔다.
        // 높이가 다른 두 열(좌측 3줄 텍스트 / 우측 버튼 2단)은 center로 맞춰야 균형이 잡힌다.
        '.status-card{display:flex;align-items:center;gap:var(--space-3);' +
          'margin:var(--space-3) var(--space-5) var(--space-4);padding:var(--space-4);' +
          'background:var(--color-white);border-radius:var(--radius-card);box-shadow:var(--shadow-card);}' +
        // 이모지를 그냥 두면 좌측 정렬선이 흐트러지므로 고정 크기 칩에 담아 기준선을 만든다
        '.status-card-icon{width:38px;height:38px;border-radius:12px;background:var(--color-card-bg);' +
          'display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0;}' +
        '.status-card-body{flex:1;min-width:0;display:flex;flex-direction:column;}' +
        '.status-card-label{font-size:var(--font-size-micro);font-weight:700;color:var(--color-text-secondary);}' +
        // 배지가 아니라 평문 — 색으로 상태만 구분하고 배경은 두지 않는다
        '.status-plain{display:flex;align-items:center;gap:5px;margin-top:4px;' +
          'font-size:var(--font-size-subtitle);font-weight:800;line-height:1.25;}' +
        '.status-plain.open{color:#0b6b5c;}' +
        '.status-plain.paused{color:#a15c00;}' +
        '.status-plain.closed{color:var(--color-accent-red);}' +
        '.status-time-sub{margin-top:3px;font-size:var(--font-size-micro);color:var(--color-text-secondary);font-weight:600;}' +
        // 버튼은 같은 행 우측에서 위아래 같은 열로 세운다
        '.status-action-col{display:flex;flex-direction:column;gap:6px;flex-shrink:0;margin-left:auto;}' +
        '.status-action-btn{width:92px;height:36px;border:none;border-radius:12px;' +
          'font-size:var(--font-size-caption);font-weight:800;cursor:pointer;white-space:nowrap;' +
          'transition:filter .1s ease,transform .1s ease;}' +
        '.status-action-btn:active{transform:scale(.96);filter:brightness(.95);}' +
        '@media (prefers-reduced-motion: reduce){.status-action-btn{transition:none;}' +
          '.status-action-btn:active{transform:none;}}' +
        '.status-action-btn.pastel-green{background:var(--color-accent-green-bg);color:var(--color-accent-green);}' +
        '.status-action-btn.pastel-amber{background:var(--color-accent-amber-bg);color:#a15c00;}' +
        '.status-action-btn.pastel-red{background:var(--color-accent-red-bg);color:var(--color-accent-red);}' +
        '.settings-footer-row{display:flex;align-items:center;justify-content:center;gap:8px;padding:24px var(--space-5) 32px;}' +
        '.settings-footer-link{background:none;border:none;padding:2px;font-size:11px;color:var(--color-text-secondary);opacity:0.6;cursor:pointer;}' +
        '.settings-footer-sep{font-size:11px;color:var(--color-text-secondary);opacity:0.4;}' +
        '.settings-group-title{font-size:var(--font-size-micro);font-weight:700;color:var(--color-text-secondary);padding:var(--space-4) var(--space-5) var(--space-2);}' +
        // 좌우 여백은 화면 거터(20px)로 맞춘다 — 영업 상태 카드·섹션 제목·목록 행과 같은 정렬선을 쓴다
        '.settings-shortcut-item{margin:0 var(--space-5);border:1.5px solid var(--color-accent-blue);border-radius:var(--radius-button);}' +
        '.settings-shortcut-item .label{color:var(--color-accent-blue);font-weight:800;}' +
        '.settings-shortcut-item .chevron{color:var(--color-accent-blue);}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="settings-back" aria-label="뒤로가기">←</button></div>' +
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
                '미수락·처리중 주문 ' + window.MockApi.ordersClosedOnCloseCount(storeId) + '건이 모두 완료 처리돼요.',
                '마감',
                function () {
                  var result = window.MockApi.closeStoreAndCompleteProcessing(storeId);
                  window.UI.toast(result.completedCount > 0
                    ? ('영업 상태가 변경되었어요 · 남아있던 주문 ' + result.completedCount + '건이 완료 처리됐어요')
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
                '개점',
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

          // 일시중지/일시중지 해제는 보호 대상이 아니다 — 실제 '개점'(마감→영업)과 '마감'만 잠금으로 보호한다.
          var isRealOpen = newStatus === 'OPEN' && storeBefore.operatingStatus === 'CLOSED';
          var isClose = newStatus === 'CLOSED';
          if (isRealOpen || isClose) {
            window.UI.requirePasswordGate(storeId, 'statusChange', '영업상태 변경(개점·마감)', applyStatusChange);
          } else {
            applyStatusChange();
          }
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
                },
                { cancelLabel: '닫기' }
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
      if (logSendBtn) {
        logSendBtn.addEventListener('click', function () {
          window.MockApi.sendDiagnosticLog(storeId, 'MANUAL');
          window.UI.toast('로그를 전송했어요');
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
          window.UI.confirmModal('로그아웃', '정말 로그아웃 하시겠어요?', '로그아웃하기', function () {
            window.MockApi.logout();
            window.Router.resetTo('login');
          }, { danger: true, cancelLabel: '닫기' });
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
