/*
 * 주문 관리 > 주문 생성 (현금/상품권 등, 사장님이 현장에서 직접 만드는 주문)
 * - 연락처는 사장님이 입력하지 않는다. 결제 완료 즉시 그 주문 전용 QR을 보여주고,
 *   손님이 자기 폰으로 스캔해 연락처를 직접 남기게 한다(후보 A: 결제 직후 팝업).
 * - 남기지 않고 넘어가도, 주문 화면 카드에서 같은 QR을 다시 열어볼 수 있다(후보 B: 카드 상시 아이콘).
 * - 이미 결제까지 끝난 주문이라 대기(수락) 단계 없이 바로 '처리중'으로 들어간다.
 */
(function () {
  const esc = window.UI.escapeHtml;
  const money = window.UI.formatMoney;

  function currentStoreId() {
    const user = window.MockApi.getCurrentUser();
    return user && user.storeId;
  }

  function contactUrlFor(orderId) {
    return window.location.origin + window.location.pathname + '?contactOrder=' + orderId;
  }

  // ---------------- 화면 상태 ----------------
  let storeId = null;
  let quantities = {};      // { [menuId]: number }
  let paymentMethod = '현금';
  let tendered = 0;
  let view = 'form';        // 'form' | 'qr'
  let createdOrder = null;
  let root = null;

  function resetState() {
    quantities = {};
    paymentMethod = '현금';
    tendered = 0;
    view = 'form';
    createdOrder = null;
  }

  function totalAmount() {
    const menuItems = window.MockApi.getMenuItems(storeId);
    return menuItems.reduce(function (sum, m) { return sum + (quantities[m.id] || 0) * m.price; }, 0);
  }

  function totalQty() {
    return Object.keys(quantities).reduce(function (sum, id) { return sum + (quantities[id] || 0); }, 0);
  }

  function menuRowHtml(item) {
    const qty = quantities[item.id] || 0;
    const disabled = item.soldOut;
    return (
      '<div class="oc-menu-row' + (disabled ? ' disabled' : '') + '">' +
        '<div class="oc-menu-row-info">' +
          '<div class="oc-menu-row-name">' + esc(item.name) + (disabled ? ' <span class="badge badge-danger-soft">품절</span>' : '') + '</div>' +
          '<div class="oc-menu-row-price">' + money(item.price) + '</div>' +
        '</div>' +
        '<div class="oc-stepper">' +
          '<button type="button" class="oc-stepper-btn" data-action="dec-qty" data-menu-id="' + item.id + '"' + (disabled ? ' disabled' : '') + '>−</button>' +
          '<span class="oc-stepper-val">' + qty + '</span>' +
          '<button type="button" class="oc-stepper-btn" data-action="inc-qty" data-menu-id="' + item.id + '"' + (disabled ? ' disabled' : '') + '>+</button>' +
        '</div>' +
      '</div>'
    );
  }

  function menuSectionHtml() {
    const categories = window.MockApi.getCategories(storeId);
    const menuItems = window.MockApi.getMenuItems(storeId);
    let html = '<div class="section-title">메뉴 선택</div>';
    categories.forEach(function (cat) {
      const items = menuItems.filter(function (m) { return m.categoryId === cat.id; });
      if (!items.length) return;
      html += '<div class="oc-cat-label">' + esc(cat.name) + '</div>';
      html += '<div class="oc-menu-list">' + items.map(menuRowHtml).join('') + '</div>';
    });
    return html;
  }

  function cashPanelHtml(amount) {
    const change = Math.max(0, tendered - amount);
    return (
      '<div class="oc-cash-panel">' +
        '<div class="oc-cash-row"><span>받은 금액</span><span class="oc-cash-tendered">' + money(tendered) + '</span></div>' +
        '<div class="oc-cash-chip-row">' +
          '<button type="button" class="oc-cash-chip" data-action="add-tender" data-value="1000">+1,000</button>' +
          '<button type="button" class="oc-cash-chip" data-action="add-tender" data-value="5000">+5,000</button>' +
          '<button type="button" class="oc-cash-chip" data-action="add-tender" data-value="10000">+10,000</button>' +
          '<button type="button" class="oc-cash-chip accent" data-action="tender-exact">딱 맞게</button>' +
        '</div>' +
        '<div class="oc-change-row"><span>거스름돈</span><span>' + money(change) + '</span></div>' +
      '</div>'
    );
  }

  function paymentSectionHtml() {
    const amount = totalAmount();
    return (
      '<div class="section-title">결제 수단</div>' +
      '<div class="oc-pay-chip-row">' +
        '<button type="button" class="oc-pay-chip' + (paymentMethod === '현금' ? ' active' : '') + '" data-action="set-payment" data-value="현금">현금</button>' +
        '<button type="button" class="oc-pay-chip' + (paymentMethod === '상품권' ? ' active' : '') + '" data-action="set-payment" data-value="상품권">상품권</button>' +
      '</div>' +
      (paymentMethod === '현금' ? cashPanelHtml(amount) : '')
    );
  }

  function formContentHtml() {
    const amount = totalAmount();
    const qty = totalQty();
    return (
      menuSectionHtml() +
      paymentSectionHtml() +
      (qty > 0
        ? '<div class="oc-summary-bar"><span>' + qty + '개 담음</span><span>' + money(amount) + '</span></div>'
        : '<div class="empty-state"><div class="empty-state-emoji">🧾</div><div>메뉴를 선택해주세요</div></div>')
    );
  }

  function qrContentHtml() {
    const url = contactUrlFor(createdOrder.id);
    const qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
    return (
      '<div class="oc-done-wrap">' +
        '<div class="oc-done-check">✓</div>' +
        '<div class="oc-done-title">' + money(createdOrder.amount) + ' 결제 완료</div>' +
        '<div class="oc-done-sub">픽업번호 ' + esc(createdOrder.pickupNo) + '</div>' +
        '<div class="oc-qr-divider"></div>' +
        '<img class="oc-qr-img" src="' + qrSrc + '" alt="연락처 입력 QR" id="oc-qr-img" />' +
        '<div class="oc-qr-title">완료되면 알림 받기</div>' +
        '<div class="oc-qr-sub">스캔해서 연락처만 남겨주세요 (선택)</div>' +
        '<button type="button" class="oc-qr-copy" id="oc-copy-link-btn">링크 복사</button>' +
      '</div>'
    );
  }

  function contentHtml() {
    return view === 'form' ? formContentHtml() : qrContentHtml();
  }

  function ctaHtml() {
    if (view === 'qr') return '<button type="button" class="btn btn-primary" id="oc-next-btn">다음 주문 만들기</button>';
    const amount = totalAmount();
    const disabled = amount <= 0;
    return '<button type="button" class="btn btn-primary" id="oc-complete-btn"' + (disabled ? ' disabled' : '') + '>' + (amount > 0 ? money(amount) + ' 결제 완료' : '메뉴를 먼저 선택해주세요') + '</button>';
  }

  function render() {
    return (
      '<style>' +
        '.oc-cat-label { padding: 0 var(--space-5); font-size: var(--font-size-caption); font-weight: 800; color: var(--color-text-secondary); margin: 4px 0 8px; }' +
        '.oc-menu-list { padding: 0 var(--space-5); margin-bottom: var(--space-4); }' +
        '.oc-menu-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: 10px 0; border-bottom: 1px solid var(--color-divider); }' +
        '.oc-menu-row:last-child { border-bottom: none; }' +
        '.oc-menu-row.disabled { opacity: 0.45; }' +
        '.oc-menu-row-name { font-size: var(--font-size-body); font-weight: 700; color: var(--color-text-primary); margin-bottom: 2px; }' +
        '.oc-menu-row-price { font-size: var(--font-size-caption); color: var(--color-text-secondary); }' +
        '.oc-stepper { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }' +
        '.oc-stepper-btn { width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid var(--color-disabled); background: var(--color-white); color: var(--color-text-primary); font-size: 15px; cursor: pointer; }' +
        '.oc-stepper-btn:disabled { opacity: 0.4; cursor: default; }' +
        '.oc-stepper-val { min-width: 18px; text-align: center; font-size: var(--font-size-body); font-weight: 700; }' +
        '.oc-pay-chip-row { display: flex; gap: 8px; padding: 0 var(--space-5); margin-bottom: var(--space-3); }' +
        '.oc-pay-chip { flex: 1; padding: 12px 0; border-radius: var(--radius-button); border: 1.5px solid var(--color-disabled); background: var(--color-white); color: var(--color-text-secondary); font-size: var(--font-size-body); font-weight: 700; cursor: pointer; }' +
        '.oc-pay-chip.active { background: var(--color-text-primary); border-color: var(--color-text-primary); color: var(--color-white); }' +
        '.oc-cash-panel { margin: 0 var(--space-5) var(--space-4); padding: var(--space-3) var(--space-4); background: var(--color-card-bg); border-radius: var(--radius-card); }' +
        '.oc-cash-row { display: flex; justify-content: space-between; font-size: var(--font-size-caption); color: var(--color-text-secondary); margin-bottom: 8px; }' +
        '.oc-cash-tendered { font-weight: 700; color: var(--color-text-primary); }' +
        '.oc-cash-chip-row { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }' +
        '.oc-cash-chip { padding: 6px 10px; border-radius: var(--radius-pill); border: none; background: var(--color-divider); color: var(--color-text-secondary); font-size: var(--font-size-micro); font-weight: 700; cursor: pointer; }' +
        '.oc-cash-chip.accent { background: var(--color-accent-blue-bg); color: var(--color-accent-blue); }' +
        '.oc-change-row { display: flex; justify-content: space-between; padding: 9px 10px; border-radius: 8px; background: var(--color-accent-green-bg); font-size: var(--font-size-caption); font-weight: 700; color: #04342C; }' +
        '.oc-summary-bar { position: sticky; bottom: 0; display: flex; justify-content: space-between; padding: 12px var(--space-5); background: var(--color-white); border-top: 1px solid var(--color-divider); font-weight: 700; }' +
        '.oc-done-wrap { padding: var(--space-6) var(--space-5); text-align: center; }' +
        '.oc-done-check { width: 56px; height: 56px; border-radius: 50%; background: var(--color-accent-green-bg); color: #04342C; font-size: 26px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; }' +
        '.oc-done-title { font-size: var(--font-size-subtitle); font-weight: 800; color: var(--color-text-primary); }' +
        '.oc-done-sub { font-size: var(--font-size-caption); color: var(--color-text-secondary); margin-top: 2px; }' +
        '.oc-qr-divider { border-top: 1px dashed var(--color-disabled); margin: var(--space-5) 0; }' +
        '.oc-qr-img { width: 180px; height: 180px; border-radius: 12px; }' +
        '.oc-qr-title { font-size: var(--font-size-body); font-weight: 700; color: var(--color-text-primary); margin-top: var(--space-3); }' +
        '.oc-qr-sub { font-size: var(--font-size-caption); color: var(--color-text-secondary); margin-top: 2px; margin-bottom: var(--space-4); }' +
        '.oc-qr-copy { border: none; background: none; color: var(--color-accent-blue); font-size: var(--font-size-caption); font-weight: 700; cursor: pointer; }' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="oc-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">주문 생성</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll"><div id="oc-content"></div></div>' +
      '<div class="cta-fixed" id="oc-cta"></div>'
    );
  }

  function refresh() {
    if (!root) return;
    root.querySelector('#oc-content').innerHTML = contentHtml();
    root.querySelector('#oc-cta').innerHTML = ctaHtml();
    bindContentEvents();
  }

  function bindContentEvents() {
    if (view === 'form') {
      root.querySelectorAll('[data-action="inc-qty"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const id = btn.getAttribute('data-menu-id');
          quantities[id] = (quantities[id] || 0) + 1;
          refresh();
        });
      });
      root.querySelectorAll('[data-action="dec-qty"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const id = btn.getAttribute('data-menu-id');
          quantities[id] = Math.max(0, (quantities[id] || 0) - 1);
          refresh();
        });
      });
      root.querySelectorAll('[data-action="set-payment"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          paymentMethod = btn.getAttribute('data-value');
          if (paymentMethod !== '현금') tendered = 0;
          refresh();
        });
      });
      root.querySelectorAll('[data-action="add-tender"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          tendered += Number(btn.getAttribute('data-value'));
          refresh();
        });
      });
      const exactBtn = root.querySelector('[data-action="tender-exact"]');
      if (exactBtn) exactBtn.addEventListener('click', function () { tendered = totalAmount(); refresh(); });

      const completeBtn = root.querySelector('#oc-complete-btn');
      if (completeBtn) completeBtn.addEventListener('click', handleComplete);
    } else {
      const nextBtn = root.querySelector('#oc-next-btn');
      if (nextBtn) nextBtn.addEventListener('click', function () { resetState(); refresh(); });
      const copyBtn = root.querySelector('#oc-copy-link-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          const url = contactUrlFor(createdOrder.id);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () { window.UI.toast('링크가 복사되었어요'); });
          } else {
            window.UI.toast('링크 복사에 실패했어요');
          }
        });
      }
      const qrImg = root.querySelector('#oc-qr-img');
      if (qrImg) qrImg.addEventListener('click', function () { window.open(contactUrlFor(createdOrder.id), '_blank'); });
    }
  }

  function handleComplete() {
    const menuItems = window.MockApi.getMenuItems(storeId);
    const items = menuItems
      .filter(function (m) { return (quantities[m.id] || 0) > 0; })
      .map(function (m) { return { menuName: m.name, price: m.price, quantity: quantities[m.id] }; });
    if (!items.length) return;
    const order = window.MockApi.createManualOrder(storeId, { items: items, paymentMethod: paymentMethod });
    if (!order) return;
    createdOrder = order;
    view = 'qr';
    window.dispatchEvent(new Event('mock:orders-changed'));
    refresh();
  }

  function mount(rootEl) {
    root = rootEl;
    storeId = currentStoreId();
    resetState();
    root.querySelector('#oc-back').addEventListener('click', function () { window.Router.back(); });
    refresh();
  }

  function unmount() { root = null; }

  window.Router.register('orderCreate', { render: render, mount: mount, unmount: unmount });
})();
