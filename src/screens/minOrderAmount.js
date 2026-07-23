/*
 * 최소 주문 금액 설정 화면 (설정 > 주문 관리 > 최소 주문 금액 설정)
 * - 매장 전체 공통 1개 값. OFF면 금액 제한 없이 주문 가능.
 * - 손님 화면 미리보기/개발자 도구 연동 없이 설정 저장까지만 다룬다.
 */
(function () {
  var PRESETS = [5000, 10000, 15000, 20000];

  function contentHtml(state) {
    var enabled = state.enabled;
    var amount = state.amount;
    return (
      '<div class="settings-list-item no-toggle-click">' +
        '<div class="icon">💵</div>' +
        '<div class="label-group">' +
          '<div class="label">최소 주문 금액 사용</div>' +
          '<div class="label-sub">' + (enabled ? '설정한 금액 미만은 주문할 수 없어요' : '금액 제한 없이 주문할 수 있어요') + '</div>' +
        '</div>' +
        '<button type="button" class="toggle' + (enabled ? ' on' : '') + '" id="moa-toggle"><span class="toggle-knob"></span></button>' +
      '</div>' +

      (enabled ?
        '<div class="divider-line"></div>' +
        '<div class="section-title">최소 금액을 정해주세요</div>' +
        '<div class="moa-preset-row">' +
          PRESETS.map(function (p) {
            return '<button type="button" class="moa-preset-btn' + (amount === p ? ' on' : '') + '" data-preset="' + p + '">' + p.toLocaleString() + '원</button>';
          }).join('') +
        '</div>' +
        '<div class="moa-input-label">위 금액에 없다면 아래 칸에 직접 입력할 수 있어요</div>' +
        '<div class="moa-input-row">' +
          '<input type="number" min="0" step="100" id="moa-amount-input" class="moa-amount-input" placeholder="직접 입력" value="' + amount + '" />' +
          '<span class="moa-input-unit">원</span>' +
        '</div>' +
        '<div class="moa-hint" id="moa-hint"></div>'
        : ''
      ) +

      '<div class="info-memo">💡 매장 전체 주문에 공통으로 적용돼요.</div>'
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
        '.moa-preset-row{display:flex;flex-wrap:wrap;gap:8px;padding:0 var(--space-5) var(--space-4);}' +
        '.moa-preset-btn{flex:1 0 calc(50% - 4px);padding:12px 8px;border:1.5px solid var(--color-disabled);border-radius:var(--radius-button);' +
          'background:var(--color-white);font-size:var(--font-size-body);font-weight:700;color:var(--color-text-secondary);cursor:pointer;}' +
        '.moa-preset-btn.on{border-color:var(--color-text-primary);background:var(--color-text-primary);color:var(--color-white);}' +
        '.moa-input-label{font-size:var(--font-size-caption);color:var(--color-text-secondary);font-weight:600;padding:0 var(--space-5) 6px;}' +
        '.moa-input-row{display:flex;align-items:center;gap:8px;padding:0 var(--space-5) var(--space-2);}' +
        '.moa-amount-input{flex:1;height:48px;border:1.5px solid var(--color-disabled);border-radius:var(--radius-button);' +
          'padding:0 14px;font-size:18px;font-weight:800;text-align:right;-moz-appearance:textfield;}' +
        '.moa-amount-input::-webkit-outer-spin-button,.moa-amount-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}' +
        '.moa-input-unit{font-size:var(--font-size-body);font-weight:700;color:var(--color-text-secondary);flex-shrink:0;}' +
        '.moa-hint{font-size:var(--font-size-micro);color:var(--color-accent-red);padding:0 var(--space-5) var(--space-4);min-height:16px;}' +
        '.info-memo{font-size:var(--font-size-caption);color:var(--color-text-secondary);background:var(--color-divider);' +
          'border-left:3px solid var(--color-text-primary);border-radius:0 10px 10px 0;padding:10px 12px;line-height:1.55;margin:var(--space-2) var(--space-5) var(--space-4);}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="moa-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">최소 주문 금액 설정</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll"><div id="moa-content"></div></div>' +
      '<div class="cta-fixed"><button type="button" class="btn btn-primary" id="moa-save-btn">저장</button></div>'
    );
  }

  function mount(root) {
    var user = window.MockApi.getCurrentUser();
    var storeId = user.storeId;
    var settings = window.MockApi.getMinOrderSettings(storeId);
    var state = { enabled: settings.enabled, amount: settings.amount };

    function refresh() {
      var wrap = root.querySelector('#moa-content');
      wrap.innerHTML = contentHtml(state);
      bindContentEvents(wrap);
    }

    function bindContentEvents(wrap) {
      var toggle = wrap.querySelector('#moa-toggle');
      if (toggle) {
        toggle.addEventListener('click', function () {
          state.enabled = !state.enabled;
          refresh();
        });
      }

      wrap.querySelectorAll('[data-preset]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.amount = Number(btn.getAttribute('data-preset'));
          refresh();
        });
      });

      var input = wrap.querySelector('#moa-amount-input');
      if (input) {
        input.addEventListener('input', function () {
          state.amount = Number(input.value);
          var hint = wrap.querySelector('#moa-hint');
          if (hint) hint.textContent = (!state.amount || state.amount <= 0) ? '0원보다 큰 금액을 입력해주세요' : '';
          wrap.querySelectorAll('[data-preset]').forEach(function (btn) {
            btn.classList.toggle('on', Number(btn.getAttribute('data-preset')) === state.amount);
          });
        });
      }
    }

    root.querySelector('#moa-back').addEventListener('click', function () {
      window.Router.back();
    });

    root.querySelector('#moa-save-btn').addEventListener('click', function () {
      if (state.enabled && (!state.amount || state.amount <= 0)) {
        window.UI.toast('0원보다 큰 금액을 입력해주세요');
        return;
      }
      window.MockApi.updateMinOrderSettings(storeId, { enabled: state.enabled, amount: state.amount || 0 });
      window.UI.toast('최소 주문 금액 설정을 저장했어요');
    });

    refresh();
  }

  function unmount() {}

  window.Router.register('minOrderAmount', { render: render, mount: mount, unmount: unmount });
})();
