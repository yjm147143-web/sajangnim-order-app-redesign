/*
 * KDS(조리 현황판) 화면 (설정 화면 상단바의 🍳 버튼에서 진입)
 * - 메뉴판의 모든 메뉴를 항상 노출하되, 오늘 주문이 들어온 메뉴는 강조 처리 후 상단으로 올린다.
 * - 메뉴별 호출 완료 수량 / 남은 수량 / 오늘 누적 판매 수량을 카테고리별로 보여준다.
 *   누적 수량은 완료된 주문까지 모두 합산한, '오늘 하루 총 판매 수량'이다.
 * - 취소되지 않은 주문의 메뉴 라인을 메뉴명 기준으로 합산. '호출 완료'는 주문 단위 판정이라,
 *   한 주문에 여러 메뉴가 섞여 있으면 호출 시 그 주문에 속한 메뉴가 전부 같이 완료 처리된다.
 * - 신규 주문 발생(mock:orders-changed) 시 화면이 열려 있는 동안 자동으로 다시 집계한다.
 */
(function () {
  const esc = window.UI.escapeHtml;

  function currentStoreId() {
    var user = window.MockApi.getCurrentUser();
    return user && user.storeId;
  }

  // KDS의 누적/호출/수기차감은 모두 '오늘 최초 개점 시각' 이후 범위로 집계한다 — 마감 자체가
  // 아니라 그 다음 새로운 날의 개점 시점에 셋이 함께 초기화되는 것과 같은 기준선을 쓰기 위함이다.
  // (주문 기록 자체는 지우지 않는다 — 매출조회 등 다른 화면은 여전히 전체 이력을 본다.)
  function aggregateByMenu(storeId) {
    var store = window.MockApi.getStore(storeId);
    var cutoff = store.todayFirstOpenAt ? new Date(store.todayFirstOpenAt).getTime() : 0;
    var orders = window.MockApi.getOrders(storeId, {}).filter(function (o) {
      return !o.canceled && new Date(o.orderedAt).getTime() >= cutoff;
    });
    var stats = {};
    orders.forEach(function (o) {
      var isCalled = !!o.called;
      o.items.forEach(function (it) {
        if (!stats[it.menuName]) stats[it.menuName] = { total: 0, called: 0 };
        stats[it.menuName].total += it.quantity;
        if (isCalled) stats[it.menuName].called += it.quantity;
      });
    });
    var manualDeductions = window.MockApi.getKitchenManualDeductions(storeId);
    Object.keys(stats).forEach(function (name) {
      stats[name].manual = manualDeductions[name] || 0;
    });
    return stats;
  }

  // 가장 눈에 띄는 큰 숫자는 '남은 주문'(누적에서 호출·수기차감을 뺀 수량)이고, 호출/누적 수량은
  // 아래 배지로 보조 표시한다. 남은 주문이 있어야만(=아직 조리·호출할 게 남아야만) 파란 음영으로
  // 강조한다. 기본은 호출 버튼에 따른 자동 차감이고, "조리완료" 버튼은 카운터가 바빠 호출을 늦게
  // 눌러도 조리 담당자가 남은 수량에 미리 반영할 수 있게 하는 수기 차감 옵션이다 — 사용자가 직접
  // 남은 수량을 올릴 수는 없고 줄이기만 한다.
  function menuCardHtml(name, total, called, manual, idx, isSoldOut, isPinned) {
    var remaining = Math.max(0, total - called - manual);
    var hasRemaining = remaining > 0;
    return (
      '<div class="kb-card' + (hasRemaining ? ' active' : '') + (isPinned ? ' pinned' : '') + '" style="--i:' + idx + '">' +
        '<button type="button" class="kb-pin-btn' + (isPinned ? ' on' : '') + '" data-action="kb-toggle-pin" data-name="' + esc(name) + '"' +
          ' aria-pressed="' + (isPinned ? 'true' : 'false') + '" aria-label="' + esc(name) + (isPinned ? ' 고정 해제' : ' 맨 앞에 고정') + '">📌</button>' +
        '<div class="kb-card-name">' + esc(name) + (isSoldOut ? ' <span class="badge badge-danger-soft">품절</span>' : '') + '</div>' +
        '<div class="kb-card-total">' + remaining + '<span class="unit">개</span></div>' +
        '<div class="kb-card-total-label">남은 주문' + (manual > 0 ? '<span class="kb-manual-note"> (조리완료 -' + manual + ')</span>' : '') + '</div>' +
        '<div class="kb-card-tags">' +
          '<span class="kb-tag kb-tag-total">합계 ' + total + '</span>' +
        '</div>' +
        '<button type="button" class="kb-deduct-btn" data-action="kb-manual-deduct" data-name="' + esc(name) + '"' + (remaining <= 0 ? ' disabled' : '') + '>조리완료 −1</button>' +
      '</div>'
    );
  }

  // 고정한 메뉴가 항상 맨 앞이고, 그 안에서는 남은 수량이 많은 순이다. 고정을 정렬보다 위에
  // 두는 이유는, 고정의 목적이 '수량과 무관하게 자리를 지키는 것'이기 때문이다.
  function sortForBoard(names, stats, pinned) {
    function remainingOf(n) {
      var s = stats[n];
      return s ? s.total - s.called - s.manual : 0;
    }
    return names.slice().sort(function (a, b) {
      var ap = pinned.indexOf(a) !== -1 ? 1 : 0;
      var bp = pinned.indexOf(b) !== -1 ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return remainingOf(b) - remainingOf(a);
    });
  }

  // 카테고리로 나누지 않고 전체 메뉴를 한 그리드에 2열로 깐다. 조리 담당자는 '지금 뭐가 남았나'를
  // 보는데, 카테고리로 쪼개면 남은 수량이 많은 메뉴가 여러 섹션에 흩어져 한눈에 안 잡힌다.
  function contentHtml(storeId) {
    var stats = aggregateByMenu(storeId);
    var menuItems = window.MockApi.getMenuItems(storeId);
    var pinned = window.MockApi.getKdsPinnedMenus(storeId);
    // 품절 메뉴도 노출 메뉴판에는 그대로 남아있는 메뉴이므로 카드는 계속 보여주되, 품절 배지로 구분한다.
    var soldOutByName = {};
    menuItems.forEach(function (m) { soldOutByName[m.name] = !!m.soldOut; });

    if (!menuItems.length) {
      return '<div class="empty-state"><div class="empty-state-emoji">🍽️</div><div>판매 중인 메뉴가 없어요</div></div>';
    }

    // 카탈로그 메뉴 + 카탈로그에서 지워졌지만 오늘 주문에 남아있는 메뉴를 함께 보여준다.
    var names = menuItems.map(function (m) { return m.name; });
    Object.keys(stats).forEach(function (n) { if (names.indexOf(n) === -1) names.push(n); });

    var idx = 0;
    return '<div class="kb-grid">' +
      sortForBoard(names, stats, pinned).map(function (name) {
        var s = stats[name] || { total: 0, called: 0, manual: 0 };
        return menuCardHtml(name, s.total, s.called, s.manual, idx++, soldOutByName[name], pinned.indexOf(name) !== -1);
      }).join('') +
      '</div>';
  }

  function render() {
    return (
      '<style>' +
        '.kb-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 var(--space-5) var(--space-4);}' +
        '.kb-card{position:relative;background:var(--color-white);border:1px solid var(--color-divider);border-radius:16px;padding:13px 14px;' +
          'display:flex;flex-direction:column;gap:9px;' +
          'opacity:0;transform:translateY(8px);animation:kbFadeUp .4s ease forwards;animation-delay:calc(.05s + var(--i,0)*35ms);}' +
        '.kb-card.active{background:var(--color-accent-blue-bg);border-color:var(--color-accent-blue);}' +
        // 고정한 카드는 테두리를 굵게 해 스크롤 중에도 '이건 내가 붙여둔 것'이 구분되게 한다.
        '.kb-card.pinned{border-width:2px;border-color:var(--color-accent-purple);}' +
        '.kb-pin-btn{position:absolute;top:6px;right:6px;width:28px;height:28px;border:none;background:none;cursor:pointer;' +
          'font-size:13px;line-height:1;border-radius:8px;opacity:0.28;filter:grayscale(1);transition:opacity .12s ease,filter .12s ease;}' +
        '.kb-pin-btn:hover{opacity:0.6;}' +
        '.kb-pin-btn.on{opacity:1;filter:none;}' +
        // 핀 버튼이 메뉴명 위로 겹치지 않게 이름 쪽에 오른쪽 여백을 준다.
        '.kb-card-name{font-size:12.5px;font-weight:700;color:var(--color-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:24px;}' +
        '.kb-card-total{font-size:23px;font-weight:800;letter-spacing:-0.3px;font-variant-numeric:tabular-nums;}' +
        '.kb-card-total .unit{font-size:11px;font-weight:600;color:var(--color-text-secondary);margin-left:2px;}' +
        '.kb-card-total-label{font-size:10px;font-weight:700;color:var(--color-text-secondary);margin-top:-7px;}' +
        '.kb-card-tags{display:flex;gap:4px;flex-wrap:wrap;align-items:center;}' +
        '.kb-tag{display:inline-flex;align-items:center;gap:3px;padding:4px 10px;border-radius:var(--radius-pill);font-size:var(--font-size-caption);font-weight:700;white-space:nowrap;}' +
        '.kb-tag-called{background:var(--color-accent-green-bg);color:#0b6b5c;}' +
        '.kb-tag-total{background:var(--color-accent-amber-bg);color:#a15c00;}' +
        '.kb-manual-note{font-size:10px;font-weight:700;color:var(--color-accent-purple);margin-left:2px;}' +
        '.kb-deduct-btn{border:1.5px solid var(--color-accent-purple);background:var(--color-white);color:var(--color-accent-purple);' +
          'font-size:12px;font-weight:800;height:34px;border-radius:10px;cursor:pointer;}' +
        '.kb-deduct-btn:active{background:var(--color-accent-purple-bg);}' +
        '.kb-deduct-btn:disabled{opacity:0.35;cursor:not-allowed;}' +
        '@keyframes kbFadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="kb-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">KDS</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll"><div id="kb-content"></div></div>'
    );
  }

  var onOrdersChanged = null;

  function mount(root) {
    var storeId = currentStoreId();

    function refresh() {
      root.querySelector('#kb-content').innerHTML = contentHtml(storeId);
    }

    root.querySelector('#kb-back').addEventListener('click', function () {
      window.Router.back();
    });

    root.addEventListener('click', function (e) {
      var deductBtn = e.target.closest('[data-action="kb-manual-deduct"]');
      if (deductBtn) {
        window.MockApi.addKitchenManualDeduction(storeId, deductBtn.getAttribute('data-name'), 1);
        refresh();
        return;
      }
      var pinBtn = e.target.closest('[data-action="kb-toggle-pin"]');
      if (pinBtn) {
        var name = pinBtn.getAttribute('data-name');
        var next = window.MockApi.toggleKdsPinnedMenu(storeId, name);
        window.UI.toast(next.indexOf(name) !== -1 ? (name + ' 메뉴를 맨 앞에 고정했어요') : (name + ' 메뉴 고정을 해제했어요'));
        refresh();
      }
    });

    onOrdersChanged = refresh;
    window.addEventListener('mock:orders-changed', onOrdersChanged);

    refresh();
  }

  function unmount() {
    if (onOrdersChanged) {
      window.removeEventListener('mock:orders-changed', onOrdersChanged);
      onOrdersChanged = null;
    }
  }

  window.Router.register('kitchenBoard', { render: render, mount: mount, unmount: unmount });
})();
