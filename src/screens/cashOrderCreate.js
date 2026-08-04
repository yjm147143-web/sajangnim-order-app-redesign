/*
 * 임의 주문 생성 화면 (설정 > 주문 관리 > 임의 주문 생성)
 * - 사장님이 카운터에서 손님 대신 메뉴를 골라 주문을 대신 등록하는 화면.
 * - 첨부된 기능명세서(현금주문생성_기능명세서.xlsx)의 5단계 중 '카테고리 선택' depth는
 *   사용자 요청으로 생략하고, 진입하면 바로 메뉴 선택 화면(카테고리 탭 포함)으로 시작한다.
 * - 흐름: 메뉴 선택 → 주문 확인(총액, 손님 연락처 필수 입력 — 기본은 010-1234-5678 형식 자동 포맷,
 *   '이메일로 보낼게요' 체크 시 이메일 입력으로 전환) → 금액 입력 → 거스름돈·완료
 * - 아직 정책 미확정인 항목(명세서 REVIEW)은 아래처럼 임시로 결정해서 구현했다:
 *   · 옵션 보유 메뉴 처리: 이번 화면에서는 옵션 없이 기본 가격으로만 담는다(옵션 팝업 없음)
 *   · 주문 확인 화면에서 수량 편집: 허용하지 않음(수정하려면 메뉴 선택으로 되돌아가야 함)
 *   · 결제수단: 이 흐름 전체에서 항상 '현금' 고정(중간 변경 없음)
 *   · 주문 완료 시 상태값: 이미 카운터에서 결제까지 끝난 뒤 접수하는 것이므로 미수락 단계 없이
 *     바로 '처리중'으로 등록(자동수락 설정과 무관)
 *   · 단계별 취소: 주문 완료를 누르기 전까지는 아무 것도 저장되지 않으므로, 뒤로가기만으로 취소가
 *     된다(별도 취소 로직 불필요)
 *   · 영수증 출력: 범위 밖(이 목업엔 출력 연동 자체가 없음)
 */
(function () {
  const esc = window.UI.escapeHtml;
  const money = window.UI.formatMoney;

  let storeId = null;
  let categories = [];
  let allMenuItems = [];
  let activeCategoryId = null; // null = 전체
  let cart = {}; // { [menuId]: quantity }
  let step = 'menu'; // 'menu' | 'confirm' | 'amount' | 'change'
  let receivedAmount = 0;
  let amountError = '';
  let contactMode = 'PHONE'; // 'PHONE' | 'EMAIL'
  let customerPhone = '';
  let customerEmail = '';
  let contactError = '';
  let root = null;
  let view = null;

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function formatPhoneDigits(digits) {
    digits = digits.slice(0, 11);
    if (digits.length < 4) return digits;
    if (digits.length < 8) return digits.slice(0, 3) + '-' + digits.slice(3);
    return digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7);
  }

  const SCOPED_STYLE = '' +
    '.coc-menu-list { padding: 0 var(--space-5) 16px; display: flex; flex-direction: column; gap: 10px; }' +
    '.coc-menu-card { display: flex; align-items: center; gap: 12px; background: var(--color-white); border: 1px solid var(--color-divider); border-radius: var(--radius-card); padding: 14px; }' +
    '.coc-menu-card.soldout { opacity: 0.5; }' +
    '.coc-menu-info { flex: 1; min-width: 0; }' +
    '.coc-menu-name { font-weight: 700; font-size: var(--font-size-body); display: flex; align-items: center; gap: 6px; }' +
    '.coc-menu-price { font-size: var(--font-size-caption); color: var(--color-text-secondary); margin-top: 2px; }' +
    '.coc-stepper { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }' +
    '.coc-stepper-btn { width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid var(--color-disabled); background: var(--color-white); font-size: 16px; font-weight: 800; color: var(--color-text-primary); cursor: pointer; display: flex; align-items: center; justify-content: center; }' +
    '.coc-stepper-btn:disabled { opacity: 0.35; cursor: not-allowed; }' +
    '.coc-stepper-value { min-width: 20px; text-align: center; font-weight: 800; font-variant-numeric: tabular-nums; }' +
    '.coc-summary-row { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; font-size: var(--font-size-caption); color: var(--color-text-secondary); }' +
    '.coc-summary-total { font-size: var(--font-size-subtitle); font-weight: 800; color: var(--color-text-primary); }' +
    '.coc-contact-group { padding: var(--space-4) var(--space-5) 0; margin-bottom: 10px; }' +
    '.coc-contact-error { color: var(--color-accent-red); font-size: var(--font-size-caption); font-weight: 700; margin-top: 4px; }' +
    '.coc-email-toggle-row { padding: 0 var(--space-5); margin-top: 8px; }' +
    '.coc-confirm-list { padding: 0 var(--space-5); display: flex; flex-direction: column; }' +
    '.coc-confirm-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--color-divider); gap: 10px; }' +
    '.coc-confirm-row:last-child { border-bottom: none; }' +
    '.coc-confirm-name { font-weight: 700; }' +
    '.coc-confirm-qty { font-size: var(--font-size-caption); color: var(--color-text-secondary); flex-shrink: 0; }' +
    '.coc-confirm-subtotal { font-weight: 700; flex-shrink: 0; }' +
    '.coc-total-row { display: flex; align-items: baseline; justify-content: space-between; padding: 0 var(--space-5) 14px; }' +
    '.coc-total-row .label { font-size: var(--font-size-body); color: var(--color-text-secondary); }' +
    '.coc-total-row .value { font-size: 26px; font-weight: 800; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }' +
    '.coc-amount-display { text-align: center; padding: 28px var(--space-5) 8px; }' +
    '.coc-amount-display .label { font-size: var(--font-size-caption); color: var(--color-text-secondary); margin-bottom: 6px; }' +
    '.coc-amount-display .value { font-size: 34px; font-weight: 800; font-variant-numeric: tabular-nums; }' +
    '.coc-amount-error { text-align: center; color: var(--color-accent-red); font-size: var(--font-size-caption); font-weight: 700; min-height: 18px; padding-bottom: 8px; }' +
    '.coc-quick-row { display: flex; gap: 8px; padding: 0 var(--space-5) 16px; }' +
    '.coc-quick-btn { flex: 1; height: 40px; border-radius: var(--radius-pill); border: none; background: var(--color-divider); color: var(--color-text-primary); font-size: var(--font-size-caption); font-weight: 700; cursor: pointer; }' +
    '.coc-quick-btn.exact { background: var(--color-accent-purple-bg); color: var(--color-accent-purple); }' +
    '.coc-keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 0 var(--space-5); }' +
    '.coc-key { height: 56px; border-radius: var(--radius-button); border: none; background: var(--color-white); border: 1.5px solid var(--color-divider); font-size: 20px; font-weight: 700; color: var(--color-text-primary); cursor: pointer; }' +
    '.coc-key:active { background: var(--color-divider); }' +
    '.coc-key.func { font-size: 13px; color: var(--color-text-secondary); }' +
    '.coc-change-card { margin: 24px var(--space-5) 0; padding: var(--space-5); background: var(--color-white); border: 1px solid var(--color-divider); border-radius: var(--radius-card); display: flex; flex-direction: column; gap: 14px; }' +
    '.coc-change-row { display: flex; align-items: baseline; justify-content: space-between; }' +
    '.coc-change-row .label { font-size: var(--font-size-body); color: var(--color-text-secondary); }' +
    '.coc-change-row .value { font-size: var(--font-size-subtitle); font-weight: 700; }' +
    '.coc-change-row.highlight { padding-top: 14px; border-top: 1px dashed var(--color-disabled); }' +
    '.coc-change-row.highlight .label { font-weight: 700; color: var(--color-text-primary); }' +
    '.coc-change-row.highlight .value { font-size: 30px; color: var(--color-accent-purple); }';

  function menuLineFromCart() {
    return Object.keys(cart)
      .filter(function (id) { return cart[id] > 0; })
      .map(function (id) {
        const menu = allMenuItems.find(function (m) { return m.id === id; });
        return { menuId: id, menuName: menu.name, price: menu.price, quantity: cart[id] };
      });
  }

  function cartTotal() {
    return menuLineFromCart().reduce(function (sum, l) { return sum + l.price * l.quantity; }, 0);
  }

  function cartCount() {
    return menuLineFromCart().reduce(function (sum, l) { return sum + l.quantity; }, 0);
  }

  // ---------------- 메뉴 선택 ----------------
  function categoryTabsHtml() {
    const allBtn = '<button type="button" class="segment-tab' + (activeCategoryId === null ? ' active' : '') + '" data-action="coc-set-category" data-category-id="">전체</button>';
    const catBtns = categories.map(function (c) {
      return '<button type="button" class="segment-tab' + (activeCategoryId === c.id ? ' active' : '') + '" data-action="coc-set-category" data-category-id="' + c.id + '">' + esc(c.name) + '</button>';
    }).join('');
    return allBtn + catBtns;
  }

  function menuCardHtml(m) {
    const qty = cart[m.id] || 0;
    const soldOut = !!m.soldOut;
    return (
      '<div class="coc-menu-card' + (soldOut ? ' soldout' : '') + '">' +
        '<div class="coc-menu-info">' +
          '<div class="coc-menu-name">' + esc(m.name) + (soldOut ? ' <span class="badge badge-danger-soft">품절</span>' : '') + '</div>' +
          '<div class="coc-menu-price">' + money(m.price) + '</div>' +
        '</div>' +
        '<div class="coc-stepper">' +
          '<button type="button" class="coc-stepper-btn" data-action="coc-qty-minus" data-menu-id="' + m.id + '"' + (soldOut || qty <= 0 ? ' disabled' : '') + '>−</button>' +
          '<span class="coc-stepper-value">' + qty + '</span>' +
          '<button type="button" class="coc-stepper-btn" data-action="coc-qty-plus" data-menu-id="' + m.id + '"' + (soldOut ? ' disabled' : '') + '>+</button>' +
        '</div>' +
      '</div>'
    );
  }

  function menuStepHtml() {
    const items = activeCategoryId ? allMenuItems.filter(function (m) { return m.categoryId === activeCategoryId; }) : allMenuItems;
    const listHtml = items.length
      ? items.map(menuCardHtml).join('')
      : '' + window.UI.emptyStateHtml('plate', '등록된 메뉴가 없어요') + '';
    const count = cartCount();
    return (
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" data-action="coc-exit" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title"><span class="order-title-text">임의 주문 생성</span></div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="segment-tabs" id="coc-category-tabs">' + categoryTabsHtml() + '</div>' +
      '<div class="screen-scroll"><div class="coc-menu-list">' + listHtml + '</div></div>' +
      '<div class="cta-fixed">' +
        '<div class="coc-summary-row"><span>선택 ' + count + '개</span><span class="coc-summary-total">' + money(cartTotal()) + '</span></div>' +
        '<button type="button" class="btn btn-primary" data-action="coc-go-confirm" id="coc-next-btn"' + (count === 0 ? ' disabled' : '') + '>다음</button>' +
      '</div>'
    );
  }

  // ---------------- 주문 확인(총액) ----------------
  function confirmStepHtml() {
    const lines = menuLineFromCart();
    const rows = lines.map(function (l) {
      return (
        '<div class="coc-confirm-row">' +
          '<span class="coc-confirm-name">' + esc(l.menuName) + '</span>' +
          '<span class="coc-confirm-qty">' + money(l.price) + ' · ' + l.quantity + '개</span>' +
          '<span class="coc-confirm-subtotal">' + money(l.price * l.quantity) + '</span>' +
        '</div>'
      );
    }).join('');
    return (
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" data-action="coc-back-to-menu" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title"><span class="order-title-text">주문 확인</span></div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll">' +
        '<div class="input-group coc-contact-group">' +
          '<label class="input-label" for="' + (contactMode === 'EMAIL' ? 'coc-email-input' : 'coc-phone-input') + '">손님 연락처 (필수)</label>' +
          (contactMode === 'EMAIL'
            ? '<input type="email" inputmode="email" class="input-field' + (contactError ? ' error' : '') + '" id="coc-email-input" placeholder="example@email.com" value="' + esc(customerEmail) + '" />'
            : '<input type="tel" inputmode="numeric" class="input-field' + (contactError ? ' error' : '') + '" id="coc-phone-input" placeholder="010-1234-5678" maxlength="13" value="' + esc(customerPhone) + '" />') +
          (contactError ? '<div class="coc-contact-error">' + esc(contactError) + '</div>' : '') +
          '<div class="input-checkbox-row coc-email-toggle-row">' +
            '<input type="checkbox" id="coc-email-toggle" data-action="coc-toggle-contact-mode"' + (contactMode === 'EMAIL' ? ' checked' : '') + ' />' +
            '<label for="coc-email-toggle">이메일로 보낼게요</label>' +
          '</div>' +
        '</div>' +
        '<div class="section-title">주문 항목</div>' +
        '<div class="coc-confirm-list">' + rows + '</div>' +
      '</div>' +
      '<div class="cta-fixed">' +
        '<div class="coc-total-row"><span class="label">총액</span><span class="value">' + money(cartTotal()) + '</span></div>' +
        '<button type="button" class="btn btn-primary" data-action="coc-go-amount" id="coc-pay-btn">주문 생성</button>' +
      '</div>'
    );
  }

  // ---------------- 금액 입력 ----------------
  function amountStepHtml() {
    return (
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" data-action="coc-back-to-confirm" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title"><span class="order-title-text">금액 입력</span></div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="coc-total-row" style="padding-top:14px;"><span class="label">결제 금액</span><span class="value">' + money(cartTotal()) + '</span></div>' +
      '<div class="screen-scroll">' +
        '<div class="coc-amount-display"><div class="label">받은 금액</div><div class="value">' + money(receivedAmount) + '</div></div>' +
        '<div class="coc-amount-error">' + esc(amountError) + '</div>' +
        '<div class="coc-quick-row">' +
          '<button type="button" class="coc-quick-btn" data-action="coc-quick-amount" data-amount="5000">+5,000</button>' +
          '<button type="button" class="coc-quick-btn" data-action="coc-quick-amount" data-amount="10000">+10,000</button>' +
          '<button type="button" class="coc-quick-btn" data-action="coc-quick-amount" data-amount="50000">+50,000</button>' +
          '<button type="button" class="coc-quick-btn exact" data-action="coc-quick-exact">정확히 받음</button>' +
        '</div>' +
        '<div class="coc-keypad">' +
          ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(function (d) {
            return '<button type="button" class="coc-key" data-action="coc-key-digit" data-digit="' + d + '">' + d + '</button>';
          }).join('') +
          '<button type="button" class="coc-key func" data-action="coc-key-clear">전체삭제</button>' +
          '<button type="button" class="coc-key" data-action="coc-key-digit" data-digit="0">0</button>' +
          '<button type="button" class="coc-key func" data-action="coc-key-backspace">⌫</button>' +
        '</div>' +
      '</div>' +
      '<div class="cta-fixed">' +
        '<button type="button" class="btn btn-primary" data-action="coc-check-amount" id="coc-confirm-amount-btn">확인</button>' +
      '</div>'
    );
  }

  // ---------------- 거스름돈·완료 ----------------
  function changeStepHtml() {
    const total = cartTotal();
    const change = receivedAmount - total;
    return (
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" data-action="coc-back-to-amount" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title"><span class="order-title-text">거스름돈</span></div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll">' +
        '<div class="coc-change-card">' +
          '<div class="coc-change-row"><span class="label">총액</span><span class="value">' + money(total) + '</span></div>' +
          '<div class="coc-change-row"><span class="label">받은 금액</span><span class="value">' + money(receivedAmount) + '</span></div>' +
          '<div class="coc-change-row highlight"><span class="label">거스름돈</span><span class="value">' + money(change) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="cta-fixed">' +
        '<button type="button" class="btn btn-primary" data-action="coc-complete" id="coc-complete-btn">주문 완료</button>' +
      '</div>'
    );
  }

  function render() {
    return '<style>' + SCOPED_STYLE + '</style><div id="coc-view" style="display:flex;flex-direction:column;flex:1;min-height:0;"></div>';
  }

  function paint() {
    let html;
    if (step === 'menu') html = menuStepHtml();
    else if (step === 'confirm') html = confirmStepHtml();
    else if (step === 'amount') html = amountStepHtml();
    else html = changeStepHtml();
    view.innerHTML = html;
  }

  function onClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.getAttribute('data-action');

    if (action === 'coc-exit') { window.Router.back(); return; }
    if (action === 'coc-back-to-menu') { step = 'menu'; paint(); return; }
    if (action === 'coc-back-to-confirm') { step = 'confirm'; paint(); return; }
    if (action === 'coc-back-to-amount') { step = 'amount'; paint(); return; }

    if (action === 'coc-set-category') {
      const cid = target.getAttribute('data-category-id');
      activeCategoryId = cid || null;
      paint();
      return;
    }
    if (action === 'coc-qty-plus') {
      const id = target.getAttribute('data-menu-id');
      cart[id] = (cart[id] || 0) + 1;
      paint();
      return;
    }
    if (action === 'coc-qty-minus') {
      const id = target.getAttribute('data-menu-id');
      cart[id] = Math.max(0, (cart[id] || 0) - 1);
      paint();
      return;
    }
    if (action === 'coc-go-confirm') {
      if (cartCount() === 0) return;
      step = 'confirm';
      paint();
      return;
    }
    if (action === 'coc-toggle-contact-mode') {
      contactMode = target.checked ? 'EMAIL' : 'PHONE';
      contactError = '';
      paint();
      return;
    }
    if (action === 'coc-go-amount') {
      if (contactMode === 'EMAIL') {
        if (!EMAIL_PATTERN.test(customerEmail.trim())) {
          contactError = '올바른 이메일 주소를 입력해 주세요';
          paint();
          return;
        }
      } else if (customerPhone.replace(/\D/g, '').length !== 11) {
        contactError = '핸드폰 번호 11자리를 입력해 주세요';
        paint();
        return;
      }
      step = 'amount';
      receivedAmount = 0;
      amountError = '';
      paint();
      return;
    }
    if (action === 'coc-key-digit') {
      const d = Number(target.getAttribute('data-digit'));
      receivedAmount = receivedAmount * 10 + d;
      amountError = '';
      paint();
      return;
    }
    if (action === 'coc-key-clear') { receivedAmount = 0; amountError = ''; paint(); return; }
    if (action === 'coc-key-backspace') { receivedAmount = Math.floor(receivedAmount / 10); amountError = ''; paint(); return; }
    if (action === 'coc-quick-amount') {
      receivedAmount += Number(target.getAttribute('data-amount'));
      amountError = '';
      paint();
      return;
    }
    if (action === 'coc-quick-exact') {
      receivedAmount = cartTotal();
      amountError = '';
      paint();
      return;
    }
    if (action === 'coc-check-amount') {
      if (receivedAmount < cartTotal()) {
        amountError = '받은 금액이 부족합니다';
        paint();
        return;
      }
      step = 'change';
      paint();
      return;
    }
    if (action === 'coc-complete') {
      const isEmail = contactMode === 'EMAIL';
      const contactValue = isEmail ? customerEmail.trim() : customerPhone;
      window.MockApi.createCashOrder(storeId, menuLineFromCart(), receivedAmount, contactValue, isEmail);
      window.UI.toast('임의 주문이 접수되었어요');
      cart = {};
      receivedAmount = 0;
      amountError = '';
      contactMode = 'PHONE';
      customerPhone = '';
      customerEmail = '';
      contactError = '';
      step = 'menu';
      paint();
      return;
    }
  }

  function clearContactErrorInline(inputEl) {
    if (!contactError) return;
    contactError = '';
    inputEl.classList.remove('error');
    const errEl = view.querySelector('.coc-contact-error');
    if (errEl) errEl.remove();
  }

  function onInput(e) {
    if (e.target.id === 'coc-phone-input') {
      const digits = e.target.value.replace(/\D/g, '');
      customerPhone = formatPhoneDigits(digits);
      e.target.value = customerPhone;
      clearContactErrorInline(e.target);
    } else if (e.target.id === 'coc-email-input') {
      customerEmail = e.target.value;
      clearContactErrorInline(e.target);
    }
  }

  function mount(rootEl) {
    root = rootEl;
    view = root.querySelector('#coc-view');
    storeId = window.MockApi.getContextStoreId();
    categories = window.MockApi.getCategories(storeId);
    allMenuItems = window.MockApi.getMenuItems(storeId);
    activeCategoryId = null;
    cart = {};
    step = 'menu';
    receivedAmount = 0;
    amountError = '';
    contactMode = 'PHONE';
    customerPhone = '';
    customerEmail = '';
    contactError = '';
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    paint();
  }

  function unmount() {
    if (root) {
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
    }
    root = null;
    view = null;
  }

  window.Router.register('cashOrderCreate', { render: render, mount: mount, unmount: unmount });
})();
