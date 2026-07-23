/*
 * 권한 잠금 설정 화면 (설정 > 권한 잠금 설정)
 * - 사장님 계정 하나를 여러 사람이 함께 쓸 때, 매출 조회/영업상태 변경/결제 취소 중
 *   원하는 기능만 골라 비밀번호로 보호한다 (역할 구분 없이, 이 계정을 쓰는 누구에게나 적용).
 * - 화면 진입 자체는 게이트가 없다. 잠금 해제·비밀번호 변경·보호 항목 변경처럼
 *   설정 자체를 바꾸는 동작만 현재 비밀번호 재확인(UI.requireLockReauth)을 거친다.
 */
(function () {
  var SCOPE_DEFS = [
    { key: 'sales', label: '매출 조회' },
    { key: 'statusChange', label: '영업상태 변경' },
    { key: 'paymentCancel', label: '결제 취소' },
  ];

  var STYLE = '' +
    '.pl-actions{display:flex;flex-direction:column;gap:10px;padding:var(--space-2) var(--space-5) var(--space-5);}' +
    '.pl-scope-title{font-size:var(--font-size-caption);color:var(--color-text-secondary);font-weight:600;margin:14px 0 8px;}' +
    '.pl-scope-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;}' +
    '.pl-scope-label{font-size:var(--font-size-body);font-weight:600;}' +
    '.settings-list-item.no-toggle-click{cursor:default;flex-wrap:wrap;row-gap:8px;}' +
    '.settings-list-item.no-toggle-click:active{background:transparent;}' +
    '.settings-list-item .label-group{display:flex;flex-direction:column;gap:4px;flex:0 1 auto;min-width:0;}' +
    '.settings-list-item .label-group .label{flex:none;}' +
    '.settings-list-item .label-sub{font-size:var(--font-size-caption);color:var(--color-text-secondary);font-weight:500;}' +
    '.info-memo{font-size:var(--font-size-caption);color:var(--color-text-secondary);background:var(--color-divider);' +
      'border-left:3px solid var(--color-text-primary);border-radius:0 10px 10px 0;padding:10px 12px;line-height:1.55;margin:0 var(--space-5) var(--space-2);}';

  function currentStoreId() {
    var user = window.MockApi.getCurrentUser();
    return user && user.storeId;
  }

  function scopesSummary(scopes) {
    var active = SCOPE_DEFS.filter(function (s) { return scopes[s.key]; }).map(function (s) { return s.label; });
    if (!active.length) return '선택된 보호 항목이 없어요';
    return active.join(', ') + ' 보호 중';
  }

  function scopeChecklistHtml(scopes) {
    return SCOPE_DEFS.map(function (s) {
      var on = !!scopes[s.key];
      return (
        '<div class="pl-scope-row">' +
          '<span class="pl-scope-label">' + s.label + '</span>' +
          '<button type="button" class="toggle' + (on ? ' on' : '') + '" data-scope="' + s.key + '"><span class="toggle-knob"></span></button>' +
        '</div>'
      );
    }).join('');
  }

  function statusCardHtml(status) {
    return (
      '<div class="settings-list-item no-toggle-click">' +
        '<div class="icon">🔐</div>' +
        '<div class="label-group">' +
          '<div class="label">권한 잠금</div>' +
          '<div class="label-sub">' + (status.isSet
            ? scopesSummary(status.scopes)
            : '비밀번호가 설정되지 않았어요 · 모든 기능을 제한 없이 쓸 수 있어요') + '</div>' +
        '</div>' +
        '<span class="badge ' + (status.isSet ? 'badge-danger-soft' : 'badge-neutral') + '">' + (status.isSet ? '설정됨' : '미설정') + '</span>' +
      '</div>'
    );
  }

  function actionsHtml(status) {
    if (!status.isSet) {
      return '<div class="pl-actions"><button type="button" class="btn btn-primary" id="pl-setup-btn">비밀번호 설정</button></div>';
    }
    return (
      '<div class="pl-actions">' +
        '<button type="button" class="btn btn-outline" id="pl-scopes-btn">보호 항목 변경</button>' +
        '<button type="button" class="btn btn-outline" id="pl-change-btn">비밀번호 변경</button>' +
        '<button type="button" class="btn btn-danger-solid" id="pl-unlock-btn">잠금 해제</button>' +
      '</div>'
    );
  }

  function contentHtml(status) {
    return (
      statusCardHtml(status) +
      '<div class="divider-line"></div>' +
      '<div class="info-memo">💡 비밀번호를 설정하고 항목을 선택하면, 이 계정을 쓰는 누구든 선택한 기능을 사용할 때마다 비밀번호를 입력해야 해요.</div>' +
      actionsHtml(status)
    );
  }

  function render() {
    return (
      '<style>' + STYLE + '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="pl-back-btn" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">권한 잠금 설정</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll"><div id="pl-content"></div></div>'
    );
  }

  // 비밀번호 설정(최초)/변경 공용 모달 — 비밀번호 입력 + 보호 항목 체크리스트를 한 번에 저장한다.
  function openSetupModal(storeId, isChange, currentScopes, onDone) {
    var scopes = Object.assign({ sales: true, statusChange: true, paymentCancel: true }, currentScopes || {});
    var host = document.getElementById('modal-host');
    host.innerHTML =
      '<div class="modal-overlay" id="pl-setup-modal">' +
        '<div class="modal-card">' +
          '<div style="font-size:28px;text-align:center;margin-bottom:6px;">🔐</div>' +
          '<div class="modal-title">' + (isChange ? '비밀번호 변경' : '비밀번호 설정') + '</div>' +
          '<input type="password" class="input-field" id="pl-setup-input" maxlength="12" placeholder="새 비밀번호" style="text-align:center;letter-spacing:4px;margin-bottom:6px;" />' +
          '<div class="input-error" id="pl-setup-error" style="min-height:16px;"></div>' +
          '<div class="pl-scope-title">이 비밀번호로 보호할 기능을 선택해주세요</div>' +
          '<div id="pl-scope-list">' + scopeChecklistHtml(scopes) + '</div>' +
          '<div class="btn-row" style="flex-direction:column;gap:8px;margin-top:12px;">' +
            '<button type="button" class="btn btn-primary" id="pl-setup-save">저장</button>' +
            '<button type="button" class="btn btn-secondary" id="pl-setup-cancel">취소</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    requestAnimationFrame(function () { document.getElementById('pl-setup-modal').classList.add('show'); });
    var input = document.getElementById('pl-setup-input');
    input.focus();

    function close() { host.innerHTML = ''; }
    document.getElementById('pl-setup-cancel').addEventListener('click', close);
    document.getElementById('pl-setup-modal').addEventListener('click', function (e) {
      if (e.target.id === 'pl-setup-modal') close();
    });
    document.querySelectorAll('#pl-scope-list [data-scope]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-scope');
        scopes[key] = !scopes[key];
        btn.classList.toggle('on', scopes[key]);
      });
    });
    input.addEventListener('input', function () {
      input.classList.remove('error');
      document.getElementById('pl-setup-error').textContent = '';
    });
    document.getElementById('pl-setup-save').addEventListener('click', function () {
      var val = input.value.trim();
      if (!val) {
        input.classList.add('error');
        document.getElementById('pl-setup-error').textContent = '비밀번호를 입력해주세요.';
        return;
      }
      window.MockApi.setPermissionLockPassword(storeId, val, scopes);
      close();
      window.UI.toast(isChange ? '비밀번호를 변경했어요' : '권한 잠금을 설정했어요');
      onDone();
    });
  }

  // 보호 항목만 변경 (비밀번호는 그대로 유지)
  function openScopesOnlyModal(storeId, currentScopes, onDone) {
    var scopes = Object.assign({}, currentScopes);
    var host = document.getElementById('modal-host');
    host.innerHTML =
      '<div class="modal-overlay" id="pl-scopes-modal">' +
        '<div class="modal-card">' +
          '<div style="font-size:28px;text-align:center;margin-bottom:6px;">🔐</div>' +
          '<div class="modal-title">보호 항목 변경</div>' +
          '<div class="pl-scope-title">비밀번호로 보호할 기능을 선택해주세요</div>' +
          '<div id="pl-scope-list">' + scopeChecklistHtml(scopes) + '</div>' +
          '<div class="btn-row" style="flex-direction:column;gap:8px;margin-top:12px;">' +
            '<button type="button" class="btn btn-primary" id="pl-scopes-save">저장</button>' +
            '<button type="button" class="btn btn-secondary" id="pl-scopes-cancel">취소</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    requestAnimationFrame(function () { document.getElementById('pl-scopes-modal').classList.add('show'); });

    function close() { host.innerHTML = ''; }
    document.getElementById('pl-scopes-cancel').addEventListener('click', close);
    document.getElementById('pl-scopes-modal').addEventListener('click', function (e) {
      if (e.target.id === 'pl-scopes-modal') close();
    });
    document.querySelectorAll('#pl-scope-list [data-scope]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-scope');
        scopes[key] = !scopes[key];
        btn.classList.toggle('on', scopes[key]);
      });
    });
    document.getElementById('pl-scopes-save').addEventListener('click', function () {
      window.MockApi.updatePermissionLockScopes(storeId, scopes);
      close();
      window.UI.toast('보호 항목을 변경했어요');
      onDone();
    });
  }

  function mount(root) {
    var storeId = currentStoreId();

    function refresh() {
      var status = window.MockApi.getPermissionLockStatus(storeId);
      var wrap = root.querySelector('#pl-content');
      wrap.innerHTML = contentHtml(status);
      bindActions(status);
    }

    function bindActions(status) {
      var setupBtn = root.querySelector('#pl-setup-btn');
      if (setupBtn) {
        setupBtn.addEventListener('click', function () {
          openSetupModal(storeId, false, null, refresh);
        });
      }
      var scopesBtn = root.querySelector('#pl-scopes-btn');
      if (scopesBtn) {
        scopesBtn.addEventListener('click', function () {
          window.UI.requireLockReauth(storeId, '보호 항목 변경', function () {
            openScopesOnlyModal(storeId, status.scopes, refresh);
          });
        });
      }
      var changeBtn = root.querySelector('#pl-change-btn');
      if (changeBtn) {
        changeBtn.addEventListener('click', function () {
          window.UI.requireLockReauth(storeId, '비밀번호 변경', function () {
            openSetupModal(storeId, true, status.scopes, refresh);
          });
        });
      }
      var unlockBtn = root.querySelector('#pl-unlock-btn');
      if (unlockBtn) {
        unlockBtn.addEventListener('click', function () {
          window.UI.requireLockReauth(storeId, '잠금 해제', function () {
            window.UI.confirmModal(
              '잠금을 해제할까요?',
              '해제하면 이 계정을 쓰는 누구나 비밀번호 없이 매출 조회 · 영업상태 변경 · 결제 취소를 바로 할 수 있어요.',
              '해제하기',
              function () {
                window.MockApi.clearPermissionLockPassword(storeId);
                window.UI.toast('권한 잠금을 해제했어요');
                refresh();
              },
              { danger: true }
            );
          });
        });
      }
    }

    root.querySelector('#pl-back-btn').addEventListener('click', function () {
      window.Router.back();
    });

    refresh();
  }

  function unmount() {}

  window.Router.register('permissionLock', { render: render, mount: mount, unmount: unmount });
})();
