/*
 * 주문 관리 허브 화면 (설정 > 주문 관리)
 * - 주문 관련 세부 설정으로 진입하는 목록. 추후 주문 관련 설정이 늘어나면
 *   이 화면에 항목을 추가한다.
 */
(function () {
  function render() {
    return (
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="om-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">주문 관리</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll">' +
        '<div class="settings-list-item" data-nav="minOrderAmount">' +
          '<div class="icon">💵</div><div class="label">최소 주문 금액 설정</div><div class="chevron">›</div>' +
        '</div>' +
        '<div class="settings-list-item" data-nav="orderChannelSettings">' +
          '<div class="icon">🧾</div><div class="label">주문 방식 관리</div><div class="chevron">›</div>' +
        '</div>' +
      '</div>'
    );
  }

  function mount(root) {
    root.querySelector('#om-back').addEventListener('click', function () {
      window.Router.back();
    });
    root.querySelectorAll('[data-nav]').forEach(function (row) {
      row.addEventListener('click', function () {
        window.Router.showScreen(row.getAttribute('data-nav'), {});
      });
    });
  }

  function unmount() {}

  window.Router.register('orderManagement', { render: render, mount: mount, unmount: unmount });
})();
