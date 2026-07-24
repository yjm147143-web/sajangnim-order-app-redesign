/*
 * 손님용 연락처 입력 화면 — 사장님 로그인과 무관하게, 결제 후 QR/링크로 열리는 화면이다.
 * (?contactOrder=주문ID 로 진입 — main.js에서 로그인 여부와 상관없이 이 화면으로 바로 보낸다)
 * 실제 서비스라면 손님 자신의 폰에서 열리는 별도 웹페이지지만, 이 목업에서는 같은 앱 안의
 * 화면으로 구현해 QR을 클릭하면 바로 확인할 수 있게 했다.
 */
(function () {
  const esc = window.UI.escapeHtml;

  function render(params) {
    const order = window.MockApi.getOrder(params.orderId);
    if (!order) {
      return (
        '<div class="screen-scroll" style="display:flex; align-items:center; justify-content:center; height:100%;">' +
          '<div class="empty-state"><div class="empty-state-emoji">🔎</div><div>주문을 찾을 수 없어요</div></div>' +
        '</div>'
      );
    }
    const store = window.MockApi.getStore(order.storeId);
    const already = !!order.customerContact;
    return (
      '<style>' +
        '.cc-wrap { padding: var(--space-8) var(--space-5); text-align: center; }' +
        '.cc-store { font-size: var(--font-size-caption); color: var(--color-text-secondary); margin-bottom: 4px; }' +
        '.cc-pickup { font-size: var(--font-size-display); font-weight: 800; color: var(--color-text-primary); margin-bottom: 20px; }' +
        '.cc-input { width: 100%; height: 52px; border: 1.5px solid var(--color-disabled); border-radius: var(--radius-button); padding: 0 16px; font-size: 17px; font-weight: 700; text-align: center; letter-spacing: 0.5px; margin-bottom: var(--space-3); }' +
        '.cc-hint { font-size: var(--font-size-caption); color: var(--color-text-secondary); margin-bottom: var(--space-5); }' +
        '.cc-done-emoji { font-size: 44px; margin-bottom: 12px; }' +
      '</style>' +
      '<div class="screen-scroll"><div class="cc-wrap" id="cc-content">' +
        '<div class="cc-store">' + esc(store ? store.name : '') + '</div>' +
        '<div class="cc-pickup">픽업번호 ' + esc(order.pickupNo) + '</div>' +
        (already
          ? '<div class="cc-done-emoji">✅</div><div style="font-weight:700; margin-bottom:6px;">이미 등록됐어요</div><div class="cc-hint">준비되면 알림 보내드릴게요</div>'
          : (
            '<input type="tel" inputmode="numeric" class="cc-input" id="cc-contact-input" placeholder="010-1234-5678" />' +
            '<div class="cc-hint">완료되면 이 번호로 알림을 보내드려요</div>' +
            '<button type="button" class="btn btn-primary" id="cc-submit-btn">연락처 남기기</button>'
          )
        ) +
      '</div></div>'
    );
  }

  function mount(root, params) {
    const submitBtn = root.querySelector('#cc-submit-btn');
    if (!submitBtn) return;
    submitBtn.addEventListener('click', function () {
      const input = root.querySelector('#cc-contact-input');
      const value = (input.value || '').trim();
      if (!value) { window.UI.toast('연락처를 입력해주세요'); return; }
      window.MockApi.setOrderContact(params.orderId, value);
      window.dispatchEvent(new Event('mock:orders-changed'));
      root.querySelector('#cc-content').innerHTML =
        '<div class="cc-done-emoji">✅</div><div style="font-weight:700; margin-bottom:6px;">등록됐어요</div><div class="cc-hint">준비되면 알림 보내드릴게요</div>';
    });
  }

  function unmount() {}

  window.Router.register('customerContact', { render: render, mount: mount, unmount: unmount });
})();
