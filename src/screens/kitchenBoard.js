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
          ' aria-pressed="' + (isPinned ? 'true' : 'false') + '" aria-label="' + esc(name) + (isPinned ? ' 고정 해제' : ' 맨 앞에 고정') + '">' +
          (isPinned ? '★' : '☆') +
        '</button>' +
        '<div class="kb-card-name">' + esc(name) + (isSoldOut ? ' <span class="badge badge-danger-soft">품절</span>' : '') + '</div>' +
        '<div class="kb-card-total">' + remaining + '<span class="unit">개</span></div>' +
        '<div class="kb-card-total-label">남은 주문' + (manual > 0 ? '<span class="kb-manual-note"> (조리완료 -' + manual + ')</span>' : '') + '</div>' +
        '<div class="kb-card-tags">' +
          '<span class="kb-tag kb-tag-total">합계 ' + total + '</span>' +
        '</div>' +
        // 차감량은 배지 없이 평문으로 둔다. 배지(흰 배경 + 파란 글자)는 진한 파랑 버튼 안에서
        // 대비를 두 번 꺾어 오히려 안 읽혔다 — 흰 글자를 그대로 쓰면 라벨과 같은 대비를 얻는다.
        '<button type="button" class="kb-deduct-btn" data-action="kb-manual-deduct" data-name="' + esc(name) + '"' + (remaining <= 0 ? ' disabled' : '') + '>' +
          '조리완료<span class="kb-deduct-num">▼1</span>' +
        '</button>' +
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

  // 사용법 말풍선. 조리 담당자는 주문이 밀리는 중에 이걸 여는 것이라, 읽는 데 시간이 드는
  // 문서는 아무도 안 읽는다. 꼭 필요한 5줄만 남긴다 — 두 화면의 차이 1줄, 숫자 2줄, 버튼 2줄.
  // 집계 세부 규칙(개점 기준 시각, 주문 단위 호출 차감 등)은 여기 넣지 않는다.
  function tipHtml() {
    const items = [
      { term: '남은 주문', desc: '<b>조리가 필요한 메뉴</b>의 개수에요. 손님을 호출하면 자동으로 차감돼요.' },
      { term: '합계', desc: '오늘 손님이 주문한 메뉴의 <b>총 수량</b>이에요.' },
      { term: '조리완료 버튼', chip: '<span class="kb-tip-chip blue">조리완료 ▼1</span>', desc: '남은 주문이 수동으로 차감돼요.' },
      { term: '고정', chip: '<span class="kb-tip-chip star">☆</span>', desc: '메뉴 카드를 맨 위에 고정해요.' },
    ];
    return '<div class="kb-tip" id="kb-tip" role="tooltip">' +
      items.map(function (it) {
        return '<div class="kb-tip-line">' +
          '<div class="kb-tip-head">' + it.term + (it.chip ? it.chip : '') + '</div>' +
          '<div class="kb-tip-desc">' + it.desc + '</div>' +
          '</div>';
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
        // 고정 버튼은 동그라미 안의 별. ☆(비고정) → ★(고정)로 형태가 바뀌므로 색만으로
        // 구분하지 않아도 되고, 원형 배경이 있어 카드 모서리에서 '누를 수 있는 것'으로 읽힌다.
        '.kb-pin-btn{position:absolute;top:7px;right:7px;width:24px;height:24px;padding:0;cursor:pointer;' +
          'display:flex;align-items:center;justify-content:center;border-radius:50%;' +
          // --color-disabled(#DCEAE7)는 파란 음영 카드 위에서 대비 1.08:1로 사실상 안 보였다.
          // 비고정 상태도 '누를 수 있는 것'으로 읽혀야 하므로 3:1을 넘기는 회색으로 올린다.
          'border:1.5px solid #7B8298;background:var(--color-white);' +
          'font-size:13px;line-height:1;color:var(--color-text-secondary);' +
          'transition:border-color .12s ease,background .12s ease,color .12s ease;}' +
        '.kb-pin-btn.on{border-color:var(--color-accent-amber);background:var(--color-accent-amber-bg);color:#a15c00;}' +
        '.kb-pin-btn:active{transform:scale(.92);}' +
        '@media (prefers-reduced-motion: reduce){.kb-pin-btn{transition:none;}.kb-pin-btn:active{transform:none;}}' +
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
        // 파란 음영(솔리드 파랑) — 카드 안에서 유일하게 누르는 요소라, 테두리만 있는 고스트
        // 버튼보다 채워진 버튼이 '여기를 누른다'를 먼저 알린다.
        '.kb-deduct-btn{display:flex;align-items:center;justify-content:center;gap:7px;' +
          'border:none;background:var(--color-accent-blue);color:var(--color-white);' +
          'font-size:12px;font-weight:800;height:34px;border-radius:10px;cursor:pointer;' +
          'box-shadow:0 2px 6px rgba(51,85,184,0.28);transition:filter .1s ease,transform .1s ease;}' +
        '.kb-deduct-btn:active{transform:scale(.97);filter:brightness(.94);}' +
        '.kb-deduct-btn:disabled{background:var(--color-disabled);color:var(--color-text-secondary);' +
          'box-shadow:none;cursor:not-allowed;}' +
        // 차감량은 라벨과 같은 크기·굵기의 흰 글자다. 별도 색이나 배경을 주지 않으므로
        // 비활성 상태에서도 버튼 색을 그대로 따라간다. 숫자만 폭이 흔들리지 않게 tabular-nums.
        '.kb-deduct-num{font-variant-numeric:tabular-nums;}' +
        '@media (prefers-reduced-motion: reduce){.kb-deduct-btn{transition:none;}.kb-deduct-btn:active{transform:none;}}' +
        '@keyframes kbFadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}' +
        // ---- 사용법 배지 + 말풍선 ----
        '.kb-help-wrap{position:relative;}' +
        '.kb-help-badge{flex-shrink:0;height:30px;padding:0 12px 0 8px;gap:5px;border-radius:var(--radius-pill);cursor:pointer;' +
          'border:1.5px solid var(--color-accent-blue);background:var(--color-accent-blue-bg);' +
          'color:var(--color-accent-blue-strong);font-size:var(--font-size-caption);font-weight:800;line-height:1;' +
          'display:flex;align-items:center;justify-content:center;white-space:nowrap;}' +
        '.kb-help-badge[aria-expanded="true"]{background:var(--color-accent-blue);color:var(--color-white);}' +
        // 물음표는 원형 안에 넣어 아이콘으로 읽히게 한다. 배지가 반전되면 원도 함께 반전된다.
        '.kb-help-q{display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
          'width:18px;height:18px;border-radius:50%;background:var(--color-accent-blue);' +
          'color:var(--color-white);font-size:12px;font-weight:800;line-height:1;padding-bottom:1px;}' +
        '.kb-help-badge[aria-expanded="true"] .kb-help-q{background:var(--color-white);color:var(--color-accent-blue-strong);}' +
        // 말풍선은 배지 바로 아래에 붙는다. 우측 정렬이라 폰 오른쪽 밖으로 새지 않는다.
        // 폰 폭(402px)에서 좌우 여백 16px씩만 남기고 최대로 넓힌다 — 한 줄에 담기는 글자가
        // 늘어나 줄바꿈이 줄고, 글꼴을 키워도 문장이 토막나지 않는다.
        '.kb-tip{position:absolute;top:calc(100% + 10px);right:-4px;z-index:40;width:340px;max-width:calc(100vw - 32px);' +
          'padding:12px 15px;border-radius:16px;background:#232232;color:#fff;text-align:left;' +
          'box-shadow:0 8px 22px rgba(30,29,43,0.28);}' +
        // 꼬리 — 배지를 가리키도록 우측 상단에 삼각형을 붙인다.
        '.kb-tip::after{content:"";position:absolute;top:-6px;right:16px;width:12px;height:12px;' +
          'background:#232232;transform:rotate(45deg);border-radius:2px;}' +
        // 용어와 설명을 위아래로 나눈다 — 한 줄에 이어 붙이면 어디까지가 용어인지 안 보인다.
        '.kb-tip-line{padding:8px 0;}' +
        '.kb-tip-line + .kb-tip-line{border-top:1px solid rgba(255,255,255,0.10);}' +
        '.kb-tip-head{display:flex;align-items:center;gap:6px;margin-bottom:3px;' +
          'font-size:var(--font-size-caption);font-weight:800;color:#fff;}' +
        '.kb-tip-desc{font-size:var(--font-size-caption);font-weight:500;color:rgba(255,255,255,0.75);' +
          'line-height:1.5;word-break:keep-all;}' +
        // 강조 단어만 흰색으로 올려, 설명 안에서 핵심이 먼저 걸리게 한다.
        '.kb-tip-desc b{font-weight:800;color:#fff;}' +
        // 실제 버튼 모양을 그대로 넣어, 화면에서 찾을 때 바로 알아보게 한다.
        '.kb-tip-chip{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;' +
          'padding:2px 7px;border-radius:5px;font-size:10.5px;font-weight:800;white-space:nowrap;}' +
        '.kb-tip-chip.blue{background:var(--color-accent-blue);color:var(--color-white);}' +
        '.kb-tip-chip.star{width:19px;height:19px;padding:0;border-radius:50%;' +
          'background:var(--color-accent-amber-bg);color:#a15c00;font-size:12px;}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="kb-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">KDS</div>' +
        '<div class="topbar-side kb-help-wrap" style="justify-content:flex-end;">' +
          // '?'는 이모지가 아닌 일반 문자라 OS 폰트에 의존하지 않는다. 원형 배경을 CSS로 그려
          // 아이콘처럼 보이게 하고, 라벨을 함께 둬서 무엇을 여는 버튼인지 글자로도 알린다.
          '<button type="button" class="kb-help-badge" id="kb-help" aria-expanded="false">' +
            '<span class="kb-help-q" aria-hidden="true">?</span>사용법' +
          '</button>' +
          '<div id="kb-tip-slot"></div>' +
        '</div>' +
      '</div>' +
      '<div class="screen-scroll"><div id="kb-content"></div></div>'
    );
  }

  var onOrdersChanged = null;
  // 말풍선이 document에 등록한 리스너를 화면을 떠날 때 반드시 걷어내야 한다.
  var closeTipOnUnmount = null;

  function mount(root) {
    var storeId = currentStoreId();

    function refresh() {
      root.querySelector('#kb-content').innerHTML = contentHtml(storeId);
    }

    root.querySelector('#kb-back').addEventListener('click', function () {
      window.Router.back();
    });

    // 말풍선은 모달이 아니라 화면에 얹히는 힌트다. 오버레이를 깔지 않으므로 바깥을 누르거나
    // Esc를 누르면 닫히게 직접 처리한다.
    var helpBadge = root.querySelector('#kb-help');
    var tipSlot = root.querySelector('#kb-tip-slot');

    function closeTip() {
      tipSlot.innerHTML = '';
      helpBadge.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', onDocClickForTip, true);
      document.removeEventListener('keydown', onKeyForTip);
    }

    function onDocClickForTip(e) {
      if (helpBadge.contains(e.target) || tipSlot.contains(e.target)) return;
      closeTip();
    }

    function onKeyForTip(e) {
      if (e.key === 'Escape') closeTip();
    }

    helpBadge.addEventListener('click', function () {
      if (helpBadge.getAttribute('aria-expanded') === 'true') { closeTip(); return; }
      tipSlot.innerHTML = tipHtml();
      helpBadge.setAttribute('aria-expanded', 'true');
      // 이 클릭이 그대로 document까지 올라가 바로 닫히지 않도록 캡처 단계 등록을 다음 틱으로 미룬다.
      setTimeout(function () { document.addEventListener('click', onDocClickForTip, true); }, 0);
      document.addEventListener('keydown', onKeyForTip);
    });

    closeTipOnUnmount = closeTip;

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
    if (closeTipOnUnmount) {
      closeTipOnUnmount();
      closeTipOnUnmount = null;
    }
  }

  window.Router.register('kitchenBoard', { render: render, mount: mount, unmount: unmount });
})();
