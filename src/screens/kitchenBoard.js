/*
 * 조리 현황판 화면 (order 화면 상단바 🍳 버튼에서 진입)
 * - 메뉴판의 모든 메뉴를 항상 노출하되, 오늘 주문이 들어온 메뉴는 강조 처리 후 상단으로 올린다.
 * - 메뉴별 호출 완료 수량 / 남은 수량 / 오늘 누적 판매 수량을 카테고리별로 보여준다.
 *   누적 수량은 완료된 주문까지 모두 합산한, '오늘 하루 총 판매 수량'이다.
 * - 취소되지 않은 주문의 메뉴 라인을 메뉴명 기준으로 합산. '호출 완료'는 주문 단위 판정이라,
 *   한 주문에 여러 메뉴가 섞여 있으면 호출 시 그 주문에 속한 메뉴가 전부 같이 완료 처리된다.
 * - 신규 주문 발생(mock:orders-changed) 시 화면이 열려 있는 동안 자동으로 다시 집계한다.
 * - 화면 어디를 눌러도 뒤로 돌아간다.
 */
(function () {
  const esc = window.UI.escapeHtml;

  function currentStoreId() {
    var user = window.MockApi.getCurrentUser();
    return user && user.storeId;
  }

  function aggregateByMenu(storeId) {
    var orders = window.MockApi.getOrders(storeId, {}).filter(function (o) { return !o.canceled; });
    var stats = {};
    orders.forEach(function (o) {
      var isCalled = !!o.called;
      o.items.forEach(function (it) {
        if (!stats[it.menuName]) stats[it.menuName] = { total: 0, called: 0 };
        stats[it.menuName].total += it.quantity;
        if (isCalled) stats[it.menuName].called += it.quantity;
      });
    });
    return stats;
  }

  // 가장 눈에 띄는 큰 숫자는 '남은 주문'(아직 호출되지 않은 수량)이고, 호출/누적 수량은 아래
  // 배지 두 개로만 보조 표시한다. 남은 주문이 있어야만(=아직 조리·호출할 게 남아야만) 파란
  // 음영으로 강조한다 — 누적 수량이 있어도 이미 다 호출됐다면 더 이상 강조하지 않는다.
  function menuCardHtml(name, total, called, idx) {
    var remaining = total - called;
    var hasRemaining = remaining > 0;
    var calledPct = total ? Math.round((called / total) * 100) : 0;
    return (
      '<div class="kb-card' + (hasRemaining ? ' active' : '') + '" style="--i:' + idx + '">' +
        '<div class="kb-card-name">' + esc(name) + '</div>' +
        '<div class="kb-card-total">' + remaining + '<span class="unit">개</span></div>' +
        '<div class="kb-card-total-label">남은 주문</div>' +
        '<div class="kb-ratio-bar">' +
          '<div class="fill-called" style="width:' + calledPct + '%"></div>' +
          '<div class="fill-remaining" style="width:' + (100 - calledPct) + '%"></div>' +
        '</div>' +
        '<div class="kb-card-tags">' +
          '<span class="kb-tag kb-tag-called">호출 ' + called + '</span>' +
          '<span class="kb-tag kb-tag-total">누적 ' + total + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  // 아직 호출되지 않은(남은) 수량이 많은 메뉴를 카테고리 내에서 앞쪽으로 정렬한다
  function sortByActivity(names, stats) {
    return names.slice().sort(function (a, b) {
      var aRemaining = stats[a] ? stats[a].total - stats[a].called : 0;
      var bRemaining = stats[b] ? stats[b].total - stats[b].called : 0;
      return bRemaining - aRemaining;
    });
  }

  function contentHtml(storeId) {
    var stats = aggregateByMenu(storeId);
    var categories = window.MockApi.getCategories(storeId);
    var allMenuItems = window.MockApi.getMenuItems(storeId);
    // 조리 현황판은 지금 판매되고 있는(품절이 아닌) 메뉴만 대상으로 한다
    var menuItems = allMenuItems.filter(function (m) { return !m.soldOut; });

    if (!menuItems.length) {
      return '<div class="empty-state"><div class="empty-state-emoji">🍽️</div><div>판매 중인 메뉴가 없어요</div></div>';
    }

    var idx = 0;
    var html = '';
    categories.forEach(function (cat) {
      var itemsInCat = menuItems.filter(function (m) { return m.categoryId === cat.id; });
      if (!itemsInCat.length) return;
      var names = sortByActivity(itemsInCat.map(function (m) { return m.name; }), stats);
      html += '<div class="section-title">' + esc(cat.name) + '</div>';
      html += '<div class="kb-grid">' +
        names.map(function (name) {
          var s = stats[name] || { total: 0, called: 0 };
          return menuCardHtml(name, s.total, s.called, idx++);
        }).join('') +
        '</div>';
    });

    // '기타'(미분류) 후보는 카탈로그(품절 포함) 전체 기준으로 걸러낸다 — 품절 메뉴는 여기로도 새어
    // 들어오면 안 되므로, 카테고리가 없는 진짜 미분류 메뉴만 남긴다.
    var knownNames = allMenuItems.map(function (m) { return m.name; });
    var uncategorized = sortByActivity(Object.keys(stats).filter(function (name) { return knownNames.indexOf(name) === -1; }), stats);
    if (uncategorized.length) {
      html += '<div class="section-title">기타</div>';
      html += '<div class="kb-grid">' +
        uncategorized.map(function (name) { return menuCardHtml(name, stats[name].total, stats[name].called, idx++); }).join('') +
        '</div>';
    }

    return html;
  }

  function render() {
    return (
      '<style>' +
        '.kb-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 var(--space-5) var(--space-4);}' +
        '.kb-card{background:var(--color-white);border:1px solid var(--color-divider);border-radius:16px;padding:13px 14px;' +
          'display:flex;flex-direction:column;gap:9px;' +
          'opacity:0;transform:translateY(8px);animation:kbFadeUp .4s ease forwards;animation-delay:calc(.05s + var(--i,0)*35ms);}' +
        '.kb-card.active{background:var(--color-accent-blue-bg);border-color:var(--color-accent-blue);}' +
        '.kb-card-name{font-size:12.5px;font-weight:700;color:var(--color-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
        '.kb-card-total{font-size:23px;font-weight:800;letter-spacing:-0.3px;font-variant-numeric:tabular-nums;}' +
        '.kb-card-total .unit{font-size:11px;font-weight:600;color:var(--color-text-secondary);margin-left:2px;}' +
        '.kb-card-total-label{font-size:10px;font-weight:700;color:var(--color-text-secondary);margin-top:-7px;}' +
        '.kb-ratio-bar{height:6px;background:var(--color-disabled);border-radius:999px;overflow:hidden;display:flex;}' +
        '.kb-ratio-bar .fill-called{background:var(--color-accent-green);height:100%;}' +
        '.kb-ratio-bar .fill-remaining{background:var(--color-accent-amber);height:100%;}' +
        '.kb-card-tags{display:flex;gap:4px;flex-wrap:wrap;}' +
        '.kb-tag{display:inline-flex;align-items:center;gap:3px;padding:4px 10px;border-radius:var(--radius-pill);font-size:var(--font-size-caption);font-weight:700;white-space:nowrap;}' +
        '.kb-tag-called{background:var(--color-accent-green-bg);color:#0b6b5c;}' +
        '.kb-tag-total{background:var(--color-accent-amber-bg);color:#a15c00;}' +
        '@keyframes kbFadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="kb-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">조리 현황판</div>' +
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

    // 화면 어디를 눌러도 뒤로 돌아간다 (뒤로가기 버튼도 이 위임을 그대로 탄다)
    root.addEventListener('click', function () {
      window.Router.back();
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
