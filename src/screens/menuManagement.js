/*
 * 메뉴 관리 화면 (목록 + 추가/수정 폼)
 * - 'menuManagement' : 카테고리 탭 + 메뉴 목록 (품절 토글 / 순서 변경)
 * - 'menuEdit'       : 메뉴 추가/수정 폼 (옵션그룹 편집 + 실시간 미리보기)
 *
 * 참고: 명세서에는 카테고리 자체를 관리하는 화면이 없어, 메뉴 폼에서 "새 카테고리 추가"를
 * 선택하면 이 화면 모듈 내부의 세션 한정 배열(extraCategories)에 임시로 등록해 탭/셀렉트에 반영한다.
 * mockApi.js에는 카테고리 생성 API가 없어 DB에 영구 저장하지 않으며, 대신 메뉴 아이템에는
 * categoryName 필드를 함께 저장해 새로고침 후에도 메뉴 목록에는 카테고리명이 표시되도록 한다.
 */
(function () {
  function esc(s) { return window.UI.escapeHtml(s); }
  function money(n) { return window.UI.formatMoney(n); }

  // 삭제류 버튼에 공통으로 쓰는 휴지통 아이콘 — 이모지(🗑️)는 기기별 렌더링 편차가 커서 대신 라인 SVG를 쓴다.
  var TRASH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
    '<line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

  function currentStoreId() {
    return window.MockApi.getContextStoreId();
  }

  // 세션 한정(새로고침 시 소실) 임시 카테고리 목록 — "새 카테고리 추가" 시 사용
  var extraCategories = [];

  function getAllCategories(storeId) {
    var registered = window.MockApi.getCategories(storeId);
    var extra = extraCategories.filter(function (c) { return c.storeId === storeId; });
    return registered.concat(extra);
  }

  /* =========================================================
   * 1) 메뉴 목록 화면 ('menuManagement')
   * ========================================================= */

  function tabsHtml(categories, selectedCategoryId) {
    if (!categories.length) return '';
    var html = '<div class="segment-tabs">';
    html += '<button type="button" class="segment-tab' + (selectedCategoryId === null ? ' active' : '') + '" data-cat="">전체</button>';
    categories.forEach(function (c) {
      html += '<button type="button" class="segment-tab' + (selectedCategoryId === c.id ? ' active' : '') + '" data-cat="' + c.id + '">' + esc(c.name) + '</button>';
    });
    html += '</div>';
    return html;
  }

  function menuRowHtml(item, categories, isSpecific, orderNum) {
    var cat = categories.find(function (c) { return c.id === item.categoryId; });
    var catName = cat ? cat.name : (item.categoryName || '미분류');
    return (
      '<div class="menu-row" data-menu-id="' + item.id + '">' +
        (isSpecific ?
          '<div class="menu-row-drag">' +
            '<span class="menu-row-drag-handle">⠿</span>' +
            '<span class="menu-row-order-num">' + orderNum + '</span>' +
          '</div>' : ''
        ) +
        '<div class="menu-row-thumb">' + (item.imageUrl ? '<img src="' + esc(item.imageUrl) + '" alt="" />' :
          '<span class="thumb-placeholder">' + window.Icons3D.iconLine('camera', 18) + '</span>') + '</div>' +
        '<div class="menu-row-body">' +
          '<div class="menu-row-name">' + esc(item.name) +
            (item.soldOut ? ' <span class="badge badge-danger-soft">품절</span>' : '') +
            (item.exposed === false ? ' <span class="badge badge-neutral">숨김</span>' : '') +
            (item.happyHourEnabled ? ' ' + window.UI.promoBadgeHtml('HAPPY_HOUR') : '') +
            (item.firstComeEnabled ? ' ' + window.UI.promoBadgeHtml('FIRST_COME') : '') +
          '</div>' +
          '<div class="menu-row-sub">' + esc(catName) + (item.description ? ' · ' + esc(item.description) : '') + '</div>' +
          '<div class="menu-row-price">' +
            money(item.price) +
            ' · 준비량 ' + (item.stockQuantity != null ? item.stockQuantity + '개' : '-') +
          '</div>' +
        '</div>' +
        '<div class="menu-row-side">' +
          '<div class="menu-row-soldout-toggle">' +
            '<span class="menu-row-toggle-label">품절</span>' +
            '<button type="button" class="toggle' + (item.soldOut ? ' on' : '') + '" role="switch" aria-checked="' + (item.soldOut ? 'true' : 'false') + '" data-action="toggle-soldout" data-menu-id="' + item.id + '"><span class="toggle-knob"></span></button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function listBodyHtml(items, categories, isSpecific) {
    if (!items.length) {
      return '' + window.UI.emptyStateHtml('plate', '등록된 메뉴가 없어요') + '';
    }
    return '<div class="menu-list">' + items.map(function (item, idx) { return menuRowHtml(item, categories, isSpecific, idx + 1); }).join('') + '</div>';
  }

  // 옵션 그룹 카드 — 옵션 목록 탭(라이브러리)과 메뉴 수정 > 옵션 탭에서 동일한 UI/UX로 공유해서 쓴다.
  // identifierAttr로 각 컨텍스트의 식별자(data-group-id vs data-group-idx)를, actionPrefix로 각자의
  // 이벤트 위임 스코프(lib-* vs 접두어 없음)를 주입해 마크업만 통일하고 동작은 기존 그대로 유지한다.
  function optionGroupCardHtml(g, identifierAttr, actionPrefix, showUsage, hideRemoveGroupBtn) {
    var usageNames = showUsage ? window.MockApi.getOptionGroupUsageNames(g.id) : null;
    var maxSelect = Math.max(1, Number(g.maxSelect) || 1);
    var optionsHtml = (g.options || []).map(function (o, oi) {
      var isSoldOut = !!o.soldOut;
      return (
        '<div class="option-row">' +
          '<input class="input-field option-name-input" type="text" placeholder="옵션명" value="' + esc(o.name) + '" data-field="' + actionPrefix + 'opt-name" ' + identifierAttr + ' data-opt-idx="' + oi + '" />' +
          '<input class="input-field option-price-input" type="number" placeholder="금액" value="' + (o.price || 0) + '" data-field="' + actionPrefix + 'opt-price" ' + identifierAttr + ' data-opt-idx="' + oi + '" />' +
          '<div class="option-soldout-toggle">' +
            '<span class="option-soldout-toggle-label">' + (isSoldOut ? '품절' : '판매중') + '</span>' +
            '<button type="button" class="toggle' + (isSoldOut ? ' on' : '') + '" role="switch" aria-checked="' + (isSoldOut ? 'true' : 'false') + '" data-action="' + actionPrefix + 'toggle-option-soldout" ' + identifierAttr + ' data-opt-idx="' + oi + '"><span class="toggle-knob"></span></button>' +
          '</div>' +
          '<button type="button" class="icon-btn icon-btn-sm" data-action="' + actionPrefix + 'remove-option" ' + identifierAttr + ' data-opt-idx="' + oi + '" aria-label="옵션 삭제">' + TRASH_ICON + '</button>' +
        '</div>'
      );
    }).join('');
    return (
      '<div class="option-group-card">' +
        '<div class="option-group-head">' +
          '<input class="input-field" type="text" style="flex:1;height:44px;" placeholder="옵션 그룹명 (예: 사이즈)" value="' + esc(g.name) + '" data-field="' + actionPrefix + 'group-name" ' + identifierAttr + ' />' +
          (hideRemoveGroupBtn ? '' : '<button type="button" class="icon-btn icon-btn-sm" data-action="' + actionPrefix + 'remove-group" ' + identifierAttr + ' style="margin-left:8px;" aria-label="옵션 그룹 삭제">' + TRASH_ICON + '</button>') +
        '</div>' +
        (showUsage ? '<div class="option-group-usage">' + (usageNames.length ? esc(usageNames.join(', ')) + '에서 사용 중' : '사용 중인 메뉴 없음') + '</div>' : '') +
        optionsHtml +
        '<button type="button" class="btn btn-secondary btn-sm" data-action="' + actionPrefix + 'add-option" ' + identifierAttr + '>+ 옵션 추가</button>' +
      '</div>' +
      '<div class="option-group-card">' +
        '<div class="option-groups-subtitle" style="margin-top:0;">손님 선택 방식 설정</div>' +
        '<div class="option-select-settings">' +
          '<div class="option-setting-row">' +
            '<span class="option-setting-label">이 옵션 그룹은 필수 선택이에요</span>' +
            '<button type="button" class="toggle' + (g.required ? ' on' : '') + '" role="switch" aria-checked="' + (g.required ? 'true' : 'false') + '" data-action="' + actionPrefix + 'toggle-required" ' + identifierAttr + '><span class="toggle-knob"></span></button>' +
          '</div>' +
          '<div class="option-setting-row">' +
            '<span class="option-setting-label">주문할 때 최대 몇 개를 선택할까요?</span>' +
            '<div class="option-maxselect-stepper">' +
              '<button type="button" class="stepper-btn" data-action="' + actionPrefix + 'maxselect-minus" ' + identifierAttr + (maxSelect <= 1 ? ' disabled' : '') + ' aria-label="감소">−</button>' +
              '<div class="stepper-value"><span>' + maxSelect + '</span><span class="unit">개</span></div>' +
              '<button type="button" class="stepper-btn" data-action="' + actionPrefix + 'maxselect-plus" ' + identifierAttr + (maxSelect >= 20 ? ' disabled' : '') + ' aria-label="증가">+</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // 메뉴 목록과 동일하게, 옵션 목록도 요약 행만 보여주고 행을 누르면 수정 화면으로 이동한다
  // (편집은 그 화면에서만 이루어지고, 목록에는 더 이상 입력창/토글이 노출되지 않는다).
  function optionGroupRowHtml(g) {
    var usage = window.MockApi.getOptionGroupUsageCount(g.id);
    var modeLabel = (g.maxSelect > 1) ? ('최대 ' + g.maxSelect + '개 선택') : '1개만 선택';
    return (
      '<div class="menu-row option-group-row" data-group-id="' + g.id + '">' +
        '<div class="menu-row-body">' +
          '<div class="menu-row-name">' + esc(g.name || '(이름 없음)') + (g.required ? ' <span class="badge badge-neutral">필수</span>' : '') + '</div>' +
          '<div class="menu-row-sub">옵션 ' + (g.options || []).length + '개 · ' + modeLabel + '</div>' +
        '</div>' +
        '<div class="menu-row-side">' +
          '<div class="option-group-usage-inline">' + (usage > 0 ? usage + '개 메뉴 사용' : '미사용') + '</div>' +
          '<button type="button" class="icon-btn icon-btn-sm" data-action="delete-option-group" data-group-id="' + g.id + '" aria-label="옵션 그룹 삭제">' + TRASH_ICON + '</button>' +
        '</div>' +
      '</div>'
    );
  }

  // 사용 중이든 아니든 항상 확인 팝업(삭제/취소)을 띄운 뒤에만 삭제한다.
  // 목록 행의 삭제 버튼과 수정 화면의 🗑️ 버튼이 이 로직을 그대로 공유한다.
  function deleteOptionGroupWithConfirm(groupId, onDeleted) {
    var usageNames = window.MockApi.getOptionGroupUsageNames(groupId);
    var title = usageNames.length ? '이 옵션 그룹을 사용하고 있는 메뉴가 있어요' : '옵션 그룹을 삭제할까요?';
    var body = usageNames.length
      ? esc(usageNames.join(', ')) + '에서 사용하고 있는 옵션 그룹이에요. 정말 삭제하시나요?'
      : '삭제하면 되돌릴 수 없어요. 정말 삭제하시나요?';
    window.UI.confirmModal(
      title,
      body,
      '삭제',
      function () {
        window.MockApi.deleteOptionGroup(groupId, true);
        window.UI.toast('옵션 그룹을 삭제했어요');
        onDeleted();
      },
      { danger: true }
    );
  }

  // 옵션 그룹을 저장하기 직전에 이름/가격을 다듬고 빈 옵션을 걸러낸다 — 메뉴 폼에서 그룹을 새로
  // 만들 때(doSave)와 옵션 그룹 수정 화면에서 저장할 때가 서로 다르게 동작하지 않도록 통일한다.
  function cleanOptionGroupPayload(g) {
    return {
      name: (g.name || '').trim(),
      required: !!g.required,
      maxSelect: Math.max(1, Number(g.maxSelect) || 1),
      options: (g.options || [])
        .filter(function (o) { return o.name && o.name.trim(); })
        .map(function (o) { return { name: o.name.trim(), price: Number(o.price) || 0, soldOut: !!o.soldOut }; }),
    };
  }

  // 그룹명과 옵션 1개 이상을 요구한다 — 위반 시 에러 메시지를 반환하고, 문제 없으면 null.
  function validateOptionGroupPayload(cleaned) {
    if (!cleaned.name) return '옵션 그룹명을 입력해주세요';
    if (!cleaned.options.length) return '옵션을 1개 이상 입력해주세요';
    return null;
  }

  function optionLibraryHtml(groups) {
    var listHtml = !groups.length
      ? '' + window.UI.emptyStateHtml('puzzle', '등록된 옵션 그룹이 없어요') + ''
      : '<div class="menu-list">' + groups.map(optionGroupRowHtml).join('') + '</div>';
    return '<div class="option-library-list">' + listHtml +
      '<button type="button" class="menu-add-btn" id="add-option-group-btn">+ 옵션 그룹 추가</button>' +
      '</div>';
  }

  function renderMenuList() {
    return (
      '<style>' +
        '.menu-list{padding-bottom:24px;}' +
        '.menu-row-soldout-toggle{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;}' +
        '.menu-row-toggle-label{font-size:var(--font-size-micro);color:var(--color-text-secondary);font-weight:700;}' +
        '.menu-add-btn{display:inline-flex;align-items:center;gap:4px;height:36px;padding:0 14px;border:none;border-radius:var(--radius-pill);' +
          'background:var(--color-accent-blue-bg);font-size:var(--font-size-caption);font-weight:800;color:var(--color-accent-blue);cursor:pointer;white-space:nowrap;}' +
        '.main-tab-row{display:flex;gap:8px;padding:0 var(--space-5) var(--space-3);}' +
        '.main-tab{border:none;cursor:pointer;border-radius:var(--radius-button);font-weight:800;' +
          'background:var(--color-divider);color:var(--color-text-secondary);height:44px;}' +
        '.main-tab.active{background:var(--color-text-primary);color:var(--color-white);}' +
        '.main-tab-menu{flex:2;font-size:var(--font-size-body);}' +
        '.main-tab-option{flex:1;font-size:var(--font-size-caption);}' +
        '.option-library-list{padding-bottom:24px;}' +
        '.option-library-list #add-option-group-btn{margin:8px var(--space-5) 0;}' +
        '.option-group-usage-inline{font-size:var(--font-size-caption);font-weight:700;color:var(--color-text-secondary);white-space:nowrap;}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="menu-back">←</button></div>' +
        '<div class="topbar-title">메뉴 관리</div>' +
        '<div class="topbar-side"><button type="button" class="menu-add-btn" id="menu-topbar-action-btn">+ 메뉴 추가</button></div>' +
      '</div>' +
      '<div class="main-tab-row">' +
        '<button type="button" class="main-tab main-tab-menu active" data-main-tab="menu">메뉴 목록</button>' +
        '<button type="button" class="main-tab main-tab-option" data-main-tab="option">옵션 목록</button>' +
      '</div>' +
      '<div class="screen-scroll"><div id="menu-list-wrap"></div></div>'
    );
  }

  function mountMenuList(root) {
    var storeId = currentStoreId();
    var selectedCategoryId = null; // null = 전체
    var activeMainTab = 'menu'; // 'menu' | 'option'

    // 메뉴명 옆 ⠿ 손잡이를 눌러 드래그하면 노출 순서가 바뀐다(포인터 이동량만큼 translateY로 따라오다가,
    // 위/아래 형제 카드의 중간 지점을 넘으면 그 카드와 자리를 맞바꾼다). 손을 떼면 최종 DOM 순서를 그대로 저장한다.
    function bindMenuDrag(wrap) {
      var list = wrap.querySelector('.menu-list');
      if (!list) return;
      wrap.querySelectorAll('.menu-row-drag-handle').forEach(function (handle) {
        handle.addEventListener('click', function (e) { e.stopPropagation(); });
        handle.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var row = handle.closest('.menu-row');
          if (!row) return;
          handle.setPointerCapture(e.pointerId);
          row.classList.add('dragging');
          var refY = e.clientY;

          function onMove(ev) {
            var dy = ev.clientY - refY;
            row.style.transform = 'translateY(' + dy + 'px)';
            var rowRect = row.getBoundingClientRect();
            var centerY = rowRect.top + rowRect.height / 2;

            var next = row.nextElementSibling;
            while (next && next.classList.contains('menu-row')) {
              var nextRect = next.getBoundingClientRect();
              if (centerY > nextRect.top + nextRect.height / 2) {
                list.insertBefore(next, row);
                refY += nextRect.height;
                next = row.nextElementSibling;
              } else break;
            }
            var prev = row.previousElementSibling;
            while (prev && prev.classList.contains('menu-row')) {
              var prevRect = prev.getBoundingClientRect();
              if (centerY < prevRect.top + prevRect.height / 2) {
                list.insertBefore(row, prev);
                refY -= prevRect.height;
                prev = row.previousElementSibling;
              } else break;
            }
          }

          function onUp(ev) {
            handle.releasePointerCapture(ev.pointerId);
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
            handle.removeEventListener('pointercancel', onUp);
            row.classList.remove('dragging');
            row.style.transform = '';
            var orderedIds = Array.prototype.map.call(list.querySelectorAll('.menu-row'), function (r) { return r.getAttribute('data-menu-id'); });
            window.MockApi.reorderMenuItems(orderedIds);
            refresh();
          }

          handle.addEventListener('pointermove', onMove);
          handle.addEventListener('pointerup', onUp);
          handle.addEventListener('pointercancel', onUp);
        });
      });
    }

    function refresh() {
      root.querySelectorAll('[data-main-tab]').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-main-tab') === activeMainTab);
      });
      // '+ 옵션 추가'는 옵션 목록 아래의 '+ 옵션 그룹 추가' 버튼으로 이동했으므로, 상단바 액션 버튼은
      // 메뉴 목록 탭에서만 노출한다.
      root.querySelector('#menu-topbar-action-btn').style.display = activeMainTab === 'menu' ? '' : 'none';

      var wrap = root.querySelector('#menu-list-wrap');
      if (activeMainTab === 'menu') {
        var categories = getAllCategories(storeId);
        var isSpecific = selectedCategoryId !== null;
        var items = window.MockApi.getMenuItems(storeId, isSpecific ? selectedCategoryId : undefined);
        wrap.innerHTML = tabsHtml(categories, selectedCategoryId) + listBodyHtml(items, categories, isSpecific);
        if (isSpecific) bindMenuDrag(wrap);
      } else {
        wrap.innerHTML = optionLibraryHtml(window.MockApi.getOptionGroups(storeId));
      }
    }

    root.querySelector('#menu-back').addEventListener('click', function () {
      window.Router.back();
    });
    root.querySelector('#menu-topbar-action-btn').addEventListener('click', function () {
      window.Router.showScreen('menuEdit', {});
    });

    root.addEventListener('click', function (e) {
      var mainTabBtn = e.target.closest('[data-main-tab]');
      if (mainTabBtn) {
        activeMainTab = mainTabBtn.getAttribute('data-main-tab');
        refresh();
        return;
      }

      if (activeMainTab === 'option') {
        if (e.target.closest('#add-option-group-btn')) {
          // 그룹은 이 시점엔 아직 만들지 않는다 — 수정 화면에서 '저장'을 눌러야 실제로 옵션 목록에 추가된다.
          window.Router.showScreen('optionGroupEdit', {});
          return;
        }
        var deleteBtn = e.target.closest('[data-action="delete-option-group"]');
        if (deleteBtn) {
          deleteOptionGroupWithConfirm(deleteBtn.getAttribute('data-group-id'), refresh);
          return;
        }
        var optionRow = e.target.closest('.option-group-row[data-group-id]');
        if (optionRow) {
          window.Router.showScreen('optionGroupEdit', { groupId: optionRow.getAttribute('data-group-id') });
        }
        return;
      }

      var toggleBtn = e.target.closest('[data-action="toggle-soldout"]');
      if (toggleBtn) {
        var tid = toggleBtn.getAttribute('data-menu-id');
        var item = window.MockApi.getMenuItem(tid);
        var next = !item.soldOut;
        window.MockApi.toggleSoldOut(tid, next);
        window.UI.toast(next ? '품절 처리했어요' : '판매중으로 변경했어요');
        refresh();
        return;
      }
      var tabBtn = e.target.closest('[data-cat]');
      if (tabBtn) {
        var catVal = tabBtn.getAttribute('data-cat');
        selectedCategoryId = catVal ? catVal : null;
        refresh();
        return;
      }
      var row = e.target.closest('.menu-row[data-menu-id]');
      if (row) {
        window.Router.showScreen('menuEdit', { menuId: row.getAttribute('data-menu-id') });
      }
    });

    refresh();
  }

  window.Router.register('menuManagement', { render: renderMenuList, mount: mountMenuList, unmount: function () {} });

  /* =========================================================
   * 1-1) 옵션 그룹 수정 화면 ('optionGroupEdit')
   * 메뉴 목록에서 메뉴를 누르면 menuEdit으로 이동하는 것과 동일하게, 옵션 목록에서도
   * 그룹 행을 누르면 이 화면으로 이동해 상세 편집(이름/옵션/선택방식/필수여부)을 한다.
   * ========================================================= */

  function renderOptionGroupEdit(params) {
    var isNew = !(params && params.groupId);
    return (
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="oge-back">←</button></div>' +
        '<div class="topbar-title">' + (isNew ? '옵션 그룹 추가' : '옵션 그룹 수정') + '</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll"><div class="menu-edit-form-pad" id="oge-content"></div></div>' +
      '<div class="cta-fixed">' +
        '<div class="input-error" id="oge-error" style="display:none;margin-bottom:8px;"></div>' +
        '<button type="button" class="btn btn-primary" id="oge-save-btn">저장</button>' +
      '</div>'
    );
  }

  // 연결된 메뉴 요약 + '메뉴 연결하기' 버튼 — 버튼을 누르면 등록된 메뉴 목록이 팝업(바텀시트)으로
  // 뜨고 그 안에서 중복 선택으로 연결할 메뉴를 고른다. 메뉴 폼의 '기존 옵션 그룹에서 선택'과 반대
  // 방향. option-group-card와 같은 카드로 감싸 위 카드와 좌우 여백을 맞춘다.
  function menuLinkSummaryHtml(allMenuItems, linkedMenuIds) {
    var linkedNames = allMenuItems.filter(function (m) { return linkedMenuIds.indexOf(m.id) !== -1; }).map(function (m) { return m.name; });
    return (
      '<div class="option-group-card">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
          '<div>' +
            '<div class="option-groups-subtitle" style="margin:0;">연결된 메뉴 ' + linkedNames.length + '개</div>' +
            '<div class="option-group-usage oge-menu-link-summary" style="margin:2px 0 0;">' + (linkedNames.length ? esc(linkedNames.join(', ')) + ' 연결됨' : '연결된 메뉴가 없어요') + '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="oge-menu-link-btn">메뉴 연결하기</button>' +
        '</div>' +
      '</div>'
    );
  }

  // 신규/기존 구분 없이 '저장'을 누르기 전까지는 로컬 draft만 수정하고 MockApi에는 반영하지 않는다
  // — 메뉴 추가 폼이 저장 전까지 실제 메뉴를 만들지 않는 것과 동일한 원칙을, 기존 그룹 수정에도
  // 똑같이 적용해 '저장' 버튼이 신규/수정 어느 쪽에서든 실제로 의미를 갖도록 한다.
  function mountOptionGroupEdit(root, params) {
    var groupId = params.groupId || null;
    var isNew = !groupId;
    var storeId = currentStoreId();
    var allMenuItems = window.MockApi.getMenuItems(storeId);
    // 편집 모드의 draft에만 id를 넣어 사용 현황 조회(g.id)가 되게 한다 — cleanOptionGroupPayload는
    // id를 복사하지 않으므로 저장 시 addOptionGroup의 기본 id 생성 로직과는 무관하게 안전하다.
    var draft = isNew
      ? { name: '', required: false, maxSelect: 1, options: [] }
      : (function () {
          var g = window.MockApi.getOptionGroup(groupId);
          return {
            id: g.id,
            name: g.name,
            required: g.required,
            maxSelect: Math.max(1, Number(g.maxSelect) || 1),
            options: (g.options || []).map(function (o) { return Object.assign({}, o); }),
          };
        })();
    // 연결된 메뉴 목록도 draft와 마찬가지로 로컬 상태로 두고, '저장'을 눌러야 실제 메뉴들의
    // optionGroupIds에 반영한다.
    var linkedMenuIds = isNew ? [] : allMenuItems.filter(function (m) { return (m.optionGroupIds || []).indexOf(groupId) !== -1; }).map(function (m) { return m.id; });

    function refresh() {
      root.querySelector('#oge-content').innerHTML =
        optionGroupCardHtml(draft, 'data-group-id=""', '', !isNew, isNew) +
        menuLinkSummaryHtml(allMenuItems, linkedMenuIds);
    }

    function showError(msg) {
      var el = root.querySelector('#oge-error');
      el.textContent = msg;
      el.style.display = 'block';
    }

    // '메뉴 선택' 버튼을 누르면 등록된 메뉴 전체를 팝업(바텀시트)으로 보여주고, 그 안에서
    // 중복 선택으로 고른 뒤 '적용'을 눌러야 화면의 linkedMenuIds에 반영된다(그룹 저장 자체는
    // 여전히 화면의 '저장' 버튼을 눌러야 확정).
    function openMenuLinkSheet() {
      var draftSelection = linkedMenuIds.slice();
      function chipsHtml() {
        if (!allMenuItems.length) {
          return '<div class="section-caption" style="padding:0 0 12px;">등록된 메뉴가 없어요</div>';
        }
        return '<div class="existing-group-chip-row">' + allMenuItems.map(function (m) {
          var on = draftSelection.indexOf(m.id) !== -1;
          return '<button type="button" class="existing-group-chip' + (on ? ' on' : '') + '" data-menu-id="' + m.id + '"><span class="name">' + esc(m.name) + '</span></button>';
        }).join('') + '</div>';
      }
      var bodyHtml =
        '<div class="filter-sheet-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">' +
          '<div class="sheet-title" style="margin:0;">메뉴 연결하기</div>' +
        '</div>' +
        '<div id="menu-link-chip-wrap">' + chipsHtml() + '</div>' +
        '<button type="button" class="btn btn-primary" id="menu-link-apply-btn" style="width:100%;margin-top:8px;">적용</button>';
      window.UI.showBottomSheet(bodyHtml, function (host) {
        function bindChips() {
          host.querySelectorAll('[data-menu-id]').forEach(function (chip) {
            chip.addEventListener('click', function () {
              var mid = chip.getAttribute('data-menu-id');
              var idx = draftSelection.indexOf(mid);
              if (idx === -1) draftSelection.push(mid); else draftSelection.splice(idx, 1);
              chip.classList.toggle('on', draftSelection.indexOf(mid) !== -1);
            });
          });
        }
        bindChips();
        host.querySelector('#menu-link-apply-btn').addEventListener('click', function () {
          linkedMenuIds = draftSelection;
          window.UI.closeModal();
          refresh();
        });
      });
    }

    root.querySelector('#oge-back').addEventListener('click', function () {
      window.Router.back();
    });

    root.addEventListener('click', function (e) {
      if (e.target.closest('#oge-save-btn')) {
        var cleaned = cleanOptionGroupPayload(draft);
        var error = validateOptionGroupPayload(cleaned);
        if (error) { showError(error); return; }
        var finalGroupId;
        if (isNew) {
          finalGroupId = window.MockApi.addOptionGroup(storeId, cleaned).id;
          window.UI.toast('옵션 그룹을 추가했어요');
        } else {
          window.MockApi.updateOptionGroup(groupId, cleaned);
          finalGroupId = groupId;
          window.UI.toast('저장되었어요');
        }
        // 체크된 메뉴엔 이 그룹 id를 붙이고, 해제된 메뉴에선 뗀다.
        allMenuItems.forEach(function (m) {
          var shouldLink = linkedMenuIds.indexOf(m.id) !== -1;
          var currentIds = window.MockApi.getMenuItem(m.id).optionGroupIds || [];
          var isLinked = currentIds.indexOf(finalGroupId) !== -1;
          if (shouldLink && !isLinked) {
            window.MockApi.updateMenuItem(m.id, { optionGroupIds: currentIds.concat([finalGroupId]) });
          } else if (!shouldLink && isLinked) {
            window.MockApi.updateMenuItem(m.id, { optionGroupIds: currentIds.filter(function (id) { return id !== finalGroupId; }) });
          }
        });
        window.Router.back();
        return;
      }
      // isNew일 땐 카드에 이 버튼 자체가 렌더링되지 않는다 (아직 저장되지 않은 그룹은 지울 게 없음).
      var removeGroupBtn = e.target.closest('[data-action="remove-group"]');
      if (removeGroupBtn) {
        deleteOptionGroupWithConfirm(groupId, function () { window.Router.back(); });
        return;
      }
      if (e.target.closest('#oge-menu-link-btn')) {
        openMenuLinkSheet();
        return;
      }
      if (e.target.closest('[data-action="toggle-required"]')) {
        draft.required = !draft.required;
        refresh();
        return;
      }
      if (e.target.closest('[data-action="maxselect-minus"]')) {
        draft.maxSelect = Math.max(1, (Number(draft.maxSelect) || 1) - 1);
        refresh();
        return;
      }
      if (e.target.closest('[data-action="maxselect-plus"]')) {
        draft.maxSelect = Math.min(20, (Number(draft.maxSelect) || 1) + 1);
        refresh();
        return;
      }
      if (e.target.closest('[data-action="add-option"]')) {
        draft.options.push({ name: '', price: 0, soldOut: false });
        refresh();
        return;
      }
      var soldoutBtn = e.target.closest('[data-action="toggle-option-soldout"]');
      if (soldoutBtn) {
        var soldoutOpt = draft.options[Number(soldoutBtn.getAttribute('data-opt-idx'))];
        soldoutOpt.soldOut = !soldoutOpt.soldOut;
        refresh();
        return;
      }
      var removeOptBtn = e.target.closest('[data-action="remove-option"]');
      if (removeOptBtn) {
        draft.options.splice(Number(removeOptBtn.getAttribute('data-opt-idx')), 1);
        refresh();
        return;
      }
    });

    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.matches('[data-field="group-name"]')) {
        draft.name = t.value;
      } else if (t.matches('[data-field="opt-name"]')) {
        draft.options[Number(t.getAttribute('data-opt-idx'))].name = t.value;
      } else if (t.matches('[data-field="opt-price"]')) {
        draft.options[Number(t.getAttribute('data-opt-idx'))].price = Number(t.value) || 0;
      }
    });

    refresh();
  }

  window.Router.register('optionGroupEdit', { render: renderOptionGroupEdit, mount: mountOptionGroupEdit, unmount: function () {} });

  /* =========================================================
   * 2) 메뉴 추가/수정 폼 화면 ('menuEdit')
   * ========================================================= */

  function buildInitialState(params) {
    params = params || {};
    var storeId = currentStoreId();
    if (params.menuId) {
      var item = window.MockApi.getMenuItem(params.menuId);
      return {
        isEdit: true,
        id: item.id,
        storeId: storeId,
        name: item.name || '',
        categoryId: item.categoryId || '',
        newCategoryName: '',
        price: item.price != null ? item.price : '',
        description: item.description || '',
        imageUrl: item.imageUrl || '',
        origin: item.origin || '',
        nutritionInfo: item.nutritionInfo || '',
        allergyInfo: item.allergyInfo || '',
        happyHourEnabled: !!item.happyHourEnabled,
        happyHourPrice: item.happyHourPrice != null ? item.happyHourPrice : '',
        happyHourStart: item.happyHourStart || '15:00',
        happyHourEnd: item.happyHourEnd || '17:00',
        firstComeEnabled: !!item.firstComeEnabled,
        firstComePrice: item.firstComePrice != null ? item.firstComePrice : '',
        firstComeQty: item.firstComeQty != null ? item.firstComeQty : '',
        stockQuantity: item.stockQuantity != null ? item.stockQuantity : '',
        autoSoldoutEnabled: item.autoSoldoutEnabled !== false,
        exposed: item.exposed !== false,
        soldOut: !!item.soldOut,
        useOptionGroups: !!(item.optionGroupIds && item.optionGroupIds.length),
        selectedGroupIds: (item.optionGroupIds || []).slice(),
        optionGroups: [],
      };
    }
    return {
      isEdit: false,
      id: null,
      storeId: storeId,
      name: '',
      categoryId: params.categoryId || '',
      newCategoryName: '',
      price: '',
      description: '',
      imageUrl: '',
      origin: '',
      nutritionInfo: '',
      allergyInfo: '',
      happyHourEnabled: false,
      happyHourPrice: '',
      happyHourStart: '15:00',
      happyHourEnd: '17:00',
      firstComeEnabled: false,
      firstComePrice: '',
      firstComeQty: '',
      stockQuantity: '',
      autoSoldoutEnabled: false,
      exposed: true,
      soldOut: false,
      useOptionGroups: false,
      selectedGroupIds: [],
      optionGroups: [],
    };
  }

  function categorySelectHtml(categories, state) {
    var options = '<option value="">선택해주세요</option>';
    categories.forEach(function (c) {
      options += '<option value="' + c.id + '"' + (state.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    });
    options += '<option value="__new__"' + (state.categoryId === '__new__' ? ' selected' : '') + '>+ 새 카테고리 추가</option>';
    return '<select class="input-field" id="category-select">' + options + '</select>';
  }

  // 매장에 등록된 옵션 그룹(옵션 목록 탭에서 관리) 중 이 메뉴에 붙일 것을 고르는 칩 목록
  function existingGroupChipsHtml(storeId, state) {
    var groups = window.MockApi.getOptionGroups(storeId);
    if (!groups.length) {
      return '<div class="section-caption" style="padding:0 0 12px;">옵션 목록에 등록된 옵션 그룹이 없어요</div>';
    }
    return '<div class="existing-group-chip-row">' + groups.map(function (g) {
      var on = state.selectedGroupIds.indexOf(g.id) !== -1;
      var modeLabel = (g.maxSelect > 1) ? ('최대 ' + g.maxSelect + '개 선택') : '1개만 선택';
      return (
        '<button type="button" class="existing-group-chip' + (on ? ' on' : '') + '" data-action="toggle-existing-group" data-group-id="' + g.id + '">' +
          '<span class="name">' + esc(g.name || '(이름 없음)') + '</span>' +
          '<span class="meta">' + modeLabel + ' · 옵션 ' + (g.options || []).length + '개</span>' +
        '</button>'
      );
    }).join('') + '</div>';
  }

  function renderOptionGroupsList(state) {
    if (!state.optionGroups.length) {
      return '<div class="section-caption" style="padding:0 0 12px;">아직 추가된 옵션 그룹이 없어요</div>';
    }
    return state.optionGroups.map(function (g, gi) {
      return optionGroupCardHtml(g, 'data-group-idx="' + gi + '"', '', false);
    }).join('');
  }

  function renderPreviewHtml(state) {
    var priceNum = Number(state.price) || 0;
    var previewSoldOut = (state.autoSoldoutEnabled && state.stockQuantity !== '' && Number(state.stockQuantity) <= 0) || !!state.soldOut;
    var classes = 'menu-preview-card' + (previewSoldOut ? ' menu-preview-soldout' : '') + (!state.exposed ? ' menu-edit-preview-hidden' : '');

    var hasHappyHour = state.happyHourEnabled && state.happyHourPrice !== '' && !isNaN(Number(state.happyHourPrice)) && Number(state.happyHourPrice) > 0;
    var hasFirstCome = state.firstComeEnabled && state.firstComePrice !== '' && !isNaN(Number(state.firstComePrice)) && Number(state.firstComePrice) > 0;

    var priceHtml = '<div class="menu-preview-price">' + money(priceNum) + '</div>';
    if (hasHappyHour) {
      priceHtml += '<div class="menu-preview-promo-row">' +
        '<span class="menu-preview-price-promo">' + window.Icons3D.iconLine('flame', 13) + ' 해피아워 ' + money(Number(state.happyHourPrice)) + '</span>' +
        '<span class="menu-preview-promo-caption">' + esc(state.happyHourStart) + '~' + esc(state.happyHourEnd) + '</span>' +
      '</div>';
    }
    if (hasFirstCome) {
      priceHtml += '<div class="menu-preview-promo-row">' +
        '<span class="menu-preview-price-promo">' + window.Icons3D.icon3d('bolt', 14) + ' 선착순 ' + money(Number(state.firstComePrice)) + '</span>' +
        (state.firstComeQty !== '' ? '<span class="menu-preview-promo-caption">' + esc(state.firstComeQty) + '개 한정</span>' : '') +
      '</div>';
    }

    return (
      '<div class="' + classes + '">' +
        '<div class="menu-preview-image">' + (state.imageUrl ? '<img src="' + esc(state.imageUrl) + '" alt="" />' : '이미지 없음') + '</div>' +
        '<div class="menu-preview-body">' +
          '<div class="menu-preview-name">' + esc(state.name || '메뉴명을 입력해주세요') + '</div>' +
          (state.description ? '<div class="menu-preview-desc">' + esc(state.description) + '</div>' : '') +
          priceHtml +
          (state.origin ? '<div class="menu-preview-origin">원산지 · ' + esc(state.origin) + '</div>' : '') +
          (state.nutritionInfo ? '<div class="menu-preview-origin">영양정보 · ' + esc(state.nutritionInfo) + '</div>' : '') +
          (state.allergyInfo ? '<div class="menu-preview-origin">알레르기 정보 · ' + esc(state.allergyInfo) + '</div>' : '') +
        '</div>' +
      '</div>' +
      (!state.exposed ? '<div class="section-caption">손님 화면에 보이지 않아요 (숨김 설정)</div>' : '')
    );
  }

  function validate(state) {
    if (!state.name || !state.name.trim()) return { field: 'name', message: '메뉴명 미입력' };
    if (!state.categoryId) return { field: 'category', message: '카테고리 미입력' };
    if (state.categoryId === '__new__' && (!state.newCategoryName || !state.newCategoryName.trim())) {
      return { field: 'category', message: '카테고리 미입력' };
    }
    if (state.price === '' || state.price === null || isNaN(Number(state.price)) || Number(state.price) <= 0) {
      return { field: 'price', message: '메뉴 가격 미입력' };
    }
    if (state.autoSoldoutEnabled) {
      if (state.stockQuantity === '' || state.stockQuantity === null || isNaN(Number(state.stockQuantity))) {
        return { field: 'stock', message: '준비량 미입력' };
      }
    }
    if (state.happyHourEnabled) {
      if (state.happyHourPrice === '' || state.happyHourPrice === null || isNaN(Number(state.happyHourPrice)) || Number(state.happyHourPrice) <= 0) {
        return { field: 'happyHourPrice', message: '해피아워 가격 미입력' };
      }
      if (Number(state.happyHourPrice) >= Number(state.price)) {
        return { field: 'happyHourPrice', message: '해피아워 가격은 정가보다 낮아야 해요' };
      }
      if (!state.happyHourStart || !state.happyHourEnd) {
        return { field: 'happyHourPrice', message: '해피아워 시간을 설정해주세요' };
      }
    }
    if (state.firstComeEnabled) {
      if (state.firstComePrice === '' || state.firstComePrice === null || isNaN(Number(state.firstComePrice)) || Number(state.firstComePrice) <= 0) {
        return { field: 'firstComePrice', message: '선착순 가격 미입력' };
      }
      if (Number(state.firstComePrice) >= Number(state.price)) {
        return { field: 'firstComePrice', message: '선착순 가격은 정가보다 낮아야 해요' };
      }
      if (state.firstComeQty === '' || state.firstComeQty === null || isNaN(Number(state.firstComeQty)) || Number(state.firstComeQty) <= 0) {
        return { field: 'firstComePrice', message: '선착순 수량 미입력' };
      }
    }
    if (state.useOptionGroups) {
      var groupError = null;
      state.optionGroups
        .filter(function (g) { return g.name && g.name.trim(); })
        .some(function (g) {
          var err = validateOptionGroupPayload(cleanOptionGroupPayload(g));
          if (err) { groupError = err; return true; }
          return false;
        });
      if (groupError) return { field: 'optionGroup', message: groupError };
    }
    return null;
  }

  function doSave(state) {
    var categoryId = state.categoryId;
    var categoryName = null;
    if (categoryId === '__new__') {
      categoryName = state.newCategoryName.trim();
      categoryId = 'cat-custom-' + Date.now();
      extraCategories.push({ id: categoryId, storeId: state.storeId, name: categoryName, sortOrder: 999 });
    }

    // 새로 만든 옵션 그룹은 저장 시점에 매장 공용 옵션 목록에 등록하고, 그 id를 메뉴에 붙인다
    var optionGroupIds = [];
    if (state.useOptionGroups) {
      optionGroupIds = state.selectedGroupIds.slice();
      state.optionGroups
        .filter(function (g) { return g.name && g.name.trim(); })
        .forEach(function (g) {
          var created = window.MockApi.addOptionGroup(state.storeId, cleanOptionGroupPayload(g));
          optionGroupIds.push(created.id);
        });
    }

    var payload = {
      name: state.name.trim(),
      categoryId: categoryId,
      price: Number(state.price),
      description: (state.description || '').trim(),
      imageUrl: (state.imageUrl || '').trim(),
      origin: (state.origin || '').trim(),
      nutritionInfo: (state.nutritionInfo || '').trim(),
      allergyInfo: (state.allergyInfo || '').trim(),
      happyHourEnabled: !!state.happyHourEnabled,
      happyHourPrice: state.happyHourEnabled && state.happyHourPrice !== '' ? Number(state.happyHourPrice) : null,
      happyHourStart: state.happyHourEnabled ? state.happyHourStart : null,
      happyHourEnd: state.happyHourEnabled ? state.happyHourEnd : null,
      firstComeEnabled: !!state.firstComeEnabled,
      firstComePrice: state.firstComeEnabled && state.firstComePrice !== '' ? Number(state.firstComePrice) : null,
      firstComeQty: state.firstComeEnabled && state.firstComeQty !== '' ? Number(state.firstComeQty) : null,
      stockQuantity: state.stockQuantity === '' ? 0 : Number(state.stockQuantity),
      autoSoldoutEnabled: !!state.autoSoldoutEnabled,
      exposed: !!state.exposed,
      optionGroupIds: optionGroupIds,
    };
    if (categoryName) payload.categoryName = categoryName;

    var result = state.isEdit
      ? window.MockApi.updateMenuItem(state.id, payload)
      : window.MockApi.addMenuItem(state.storeId, payload);

    if (result.autoSoldoutTriggered && result.autoSoldoutTriggered.length) {
      window.UI.showModal({
        title: '자동 품절 처리',
        message: '준비량이 모두 소진되어 자동으로 품절 처리되었어요',
        buttons: [{ label: '확인', variant: 'btn-primary', onClick: function () { window.Router.back(); } }],
      });
    } else {
      window.UI.toast('저장되었어요');
      window.Router.back();
    }
  }

  function renderMenuEdit(params) {
    var state = buildInitialState(params);
    var categories = getAllCategories(state.storeId);
    return (
      '<style>' +
        '.menu-edit-subcaption{font-size:var(--font-size-micro);color:var(--color-text-secondary);font-weight:500;display:block;margin-top:2px;}' +
        '.menu-edit-preview-hidden{opacity:0.45;}' +
        '.menu-image-upload-row{display:flex;align-items:center;gap:12px;}' +
        '.menu-image-thumb{width:56px;height:56px;border-radius:12px;background:var(--color-divider);display:flex;' +
          'align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;font-size:22px;}' +
        '.menu-image-thumb img{width:100%;height:100%;object-fit:cover;}' +
        '.menu-image-upload-actions{display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px;}' +
        '.menu-image-upload-actions label.btn{cursor:pointer;height:36px;min-height:36px;padding:0 12px;font-size:var(--font-size-caption);}' +
        '.time-range-row{display:flex;align-items:center;gap:8px;}' +
        '.time-range-row .input-field{flex:1;}' +
        '.time-range-sep{color:var(--color-text-secondary);flex-shrink:0;}' +
        '.info-memo{font-size:var(--font-size-caption);color:var(--color-text-secondary);background:var(--color-divider);' +
          'border-left:3px solid var(--color-text-primary);border-radius:0 10px 10px 0;padding:10px 12px;line-height:1.55;margin-top:10px;}' +
        '.promo-price-net{font-size:var(--font-size-caption);color:var(--color-text-secondary);margin-bottom:8px;}' +
        '.menu-edit-tab-bar{padding:0 var(--space-5) var(--space-3);}' +
        '.menu-edit-tab-bar .segment-tab{flex:1;}' +
        '.edit-tab-panel{display:none;}' +
        '.edit-tab-panel.active{display:block;}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="edit-back">←</button></div>' +
        '<div class="topbar-title">' + (state.isEdit ? '메뉴 수정' : '메뉴 추가') + '</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="segment-tabs menu-edit-tab-bar">' +
        '<button type="button" class="segment-tab active" data-edit-tab="basic">' + window.Icons3D.iconLine('pencilLine', 14) + ' 기본 정보</button>' +
        '<button type="button" class="segment-tab" data-edit-tab="etc">' + window.Icons3D.iconLine('gearLine', 14) + ' 기타 설정</button>' +
        '<button type="button" class="segment-tab" data-edit-tab="option">' + window.Icons3D.iconLine('puzzleLine', 14) + ' 옵션</button>' +
      '</div>' +
      '<div class="screen-scroll">' +
        '<div class="menu-edit-form-pad">' +

          '<div class="edit-tab-panel active" data-edit-panel="basic">' +

          '<div class="input-group">' +
            '<div class="input-label">메뉴 이미지</div>' +
            '<div class="menu-image-upload-row">' +
              '<div class="menu-image-thumb" id="menu-image-thumb">' +
                (state.imageUrl ? '<img src="' + esc(state.imageUrl) + '" alt="" />' : '<span class="thumb-placeholder">' + window.Icons3D.iconLine('camera', 20) + '</span>') +
              '</div>' +
              '<div class="menu-image-upload-actions">' +
                '<label class="btn btn-outline btn-sm" for="f-image-file-album">앨범에서 선택</label>' +
                '<label class="btn btn-outline btn-sm" for="f-image-file-camera">직접 촬영</label>' +
                (state.imageUrl ? '<button type="button" class="btn-text" id="remove-image-btn">이미지 삭제</button>' : '') +
              '</div>' +
              '<input type="file" accept="image/*" id="f-image-file-album" style="display:none;" />' +
              '<input type="file" accept="image/*" capture="environment" id="f-image-file-camera" style="display:none;" />' +
            '</div>' +
            '<span class="menu-edit-subcaption">앨범에서 선택하거나 카메라로 바로 촬영할 수 있어요</span>' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label">메뉴명</div>' +
            '<input class="input-field" type="text" id="f-name" placeholder="메뉴명을 입력해주세요" value="' + esc(state.name) + '" />' +
            '<div class="input-error" id="err-name" style="display:none;"></div>' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label">카테고리</div>' +
            categorySelectHtml(categories, state) +
            '<div class="input-error" id="err-category" style="display:none;"></div>' +
          '</div>' +
          '<div class="input-group" id="new-category-group" style="' + (state.categoryId === '__new__' ? '' : 'display:none;') + '">' +
            '<div class="input-label">새 카테고리명</div>' +
            '<input class="input-field" type="text" id="f-new-category" placeholder="새 카테고리명을 입력해주세요" value="' + esc(state.newCategoryName) + '" />' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label">메뉴 가격</div>' +
            '<input class="input-field" type="number" id="f-price" placeholder="가격을 입력해주세요" value="' + (state.price === '' ? '' : state.price) + '" />' +
            '<div class="input-error" id="err-price" style="display:none;"></div>' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label">메뉴 설명</div>' +
            '<textarea class="input-field" id="f-desc" placeholder="메뉴 설명을 입력해주세요">' + esc(state.description) + '</textarea>' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label">손님 화면 미리보기</div>' +
            '<div id="menu-preview-container">' + renderPreviewHtml(state) + '</div>' +
          '</div>' +

          (state.isEdit ?
            '<div class="input-group">' +
              '<button type="button" class="btn btn-danger-solid" id="menu-delete-btn">메뉴 삭제</button>' +
            '</div>'
          : '') +

          '</div>' +

          '<div class="edit-tab-panel" data-edit-panel="etc">' +

          '<div class="input-group">' +
            '<div class="toggle-row">' +
              '<div class="label-group" style="display:flex;flex-direction:column;">' +
                '<span class="input-label" style="margin:0;">자동 품절</span>' +
                '<span class="menu-edit-subcaption">준비량이 0이 되면 자동으로 품절 처리해요</span>' +
              '</div>' +
              '<button type="button" class="toggle' + (state.autoSoldoutEnabled ? ' on' : '') + '" role="switch" aria-checked="' + (state.autoSoldoutEnabled ? 'true' : 'false') + '" id="toggle-auto-soldout"><span class="toggle-knob"></span></button>' +
            '</div>' +
          '</div>' +

          '<div class="divider-line"></div>' +

          '<div class="input-group">' +
            '<div class="input-label">준비량<span id="stock-required-hint" style="color:var(--color-accent-red);' + (state.autoSoldoutEnabled ? '' : 'display:none;') + '"> · 자동품절 ON 시 필수</span></div>' +
            '<input class="input-field" type="number" id="f-stock" placeholder="준비량을 입력해주세요" value="' + (state.stockQuantity === '' ? '' : state.stockQuantity) + '" />' +
            '<div class="input-error" id="err-stock" style="display:none;"></div>' +
          '</div>' +

          '<div class="divider-line"></div>' +

          '<div class="input-group">' +
            '<div class="toggle-row">' +
              '<div class="label-group" style="display:flex;flex-direction:column;">' +
                '<span class="input-label" style="margin:0;">메뉴 숨기기</span>' +
                '<span class="menu-edit-subcaption">켜면 손님 화면에서 이 메뉴가 보이지 않아요</span>' +
              '</div>' +
              '<button type="button" class="toggle' + (!state.exposed ? ' on' : '') + '" role="switch" aria-checked="' + (!state.exposed ? 'true' : 'false') + '" id="toggle-exposed"><span class="toggle-knob"></span></button>' +
            '</div>' +
          '</div>' +

          '<div class="divider-line"></div>' +

          '<div class="input-group">' +
            '<div class="toggle-row">' +
              '<div class="label-group" style="display:flex;flex-direction:column;">' +
                '<span class="input-label" style="margin:0;">해피아워 가격 설정</span>' +
                '<span class="menu-edit-subcaption">정해진 시간 동안만 할인 가격으로 판매해요</span>' +
              '</div>' +
              '<button type="button" class="toggle' + (state.happyHourEnabled ? ' on' : '') + '" role="switch" aria-checked="' + (state.happyHourEnabled ? 'true' : 'false') + '" id="toggle-happy-hour"><span class="toggle-knob"></span></button>' +
            '</div>' +
            '<div id="happy-hour-detail" style="margin-top:12px;' + (state.happyHourEnabled ? '' : 'display:none;') + '">' +
              '<div class="promo-price-net">정가 ' + money(Number(state.price) || 0) + '</div>' +
              '<div class="input-label">해피아워 가격</div>' +
              '<input class="input-field" type="number" id="f-happy-price" placeholder="할인 적용 가격을 입력해주세요" value="' + (state.happyHourPrice === '' ? '' : state.happyHourPrice) + '" />' +
              '<div class="input-error" id="err-happyHourPrice" style="display:none;"></div>' +
              '<div class="input-label" style="margin-top:10px;">해피아워 시간</div>' +
              '<div class="time-range-row">' +
                '<input type="time" class="input-field" id="f-happy-start" value="' + esc(state.happyHourStart) + '" />' +
                '<span class="time-range-sep">~</span>' +
                '<input type="time" class="input-field" id="f-happy-end" value="' + esc(state.happyHourEnd) + '" />' +
              '</div>' +
              '<div class="info-memo">' + window.Icons3D.iconLine('lightbulb', 15) + ' 설정한 시간 동안에는 정가 대신 이 가격이 자동으로 적용돼요.</div>' +
            '</div>' +
          '</div>' +

          '<div class="divider-line"></div>' +

          '<div class="input-group">' +
            '<div class="toggle-row">' +
              '<div class="label-group" style="display:flex;flex-direction:column;">' +
                '<span class="input-label" style="margin:0;">선착순 가격 설정</span>' +
                '<span class="menu-edit-subcaption">정해진 수량까지만 할인 가격으로 판매해요</span>' +
              '</div>' +
              '<button type="button" class="toggle' + (state.firstComeEnabled ? ' on' : '') + '" role="switch" aria-checked="' + (state.firstComeEnabled ? 'true' : 'false') + '" id="toggle-first-come"><span class="toggle-knob"></span></button>' +
            '</div>' +
            '<div id="first-come-detail" style="margin-top:12px;' + (state.firstComeEnabled ? '' : 'display:none;') + '">' +
              '<div class="promo-price-net">정가 ' + money(Number(state.price) || 0) + '</div>' +
              '<div class="input-label">선착순 가격</div>' +
              '<input class="input-field" type="number" id="f-first-price" placeholder="할인 적용 가격을 입력해주세요" value="' + (state.firstComePrice === '' ? '' : state.firstComePrice) + '" />' +
              '<div class="input-error" id="err-firstComePrice" style="display:none;"></div>' +
              '<div class="input-label" style="margin-top:10px;">선착순 수량</div>' +
              '<input class="input-field" type="number" id="f-first-qty" placeholder="예: 20" value="' + (state.firstComeQty === '' ? '' : state.firstComeQty) + '" />' +
              '<div class="info-memo">' + window.Icons3D.iconLine('lightbulb', 15) + ' 선착순 수량이 모두 팔리면 정가로 자동 전환돼요.</div>' +
            '</div>' +
          '</div>' +

          '<div class="divider-line"></div>' +

          '<div class="input-group">' +
            '<div class="input-label">원산지 (선택)</div>' +
            '<input class="input-field" type="text" id="f-origin" placeholder="원산지를 입력해주세요" value="' + esc(state.origin) + '" />' +
          '</div>' +

          '<div class="divider-line"></div>' +

          '<div class="input-group">' +
            '<div class="input-label">영양 정보 (선택)</div>' +
            '<textarea class="input-field" id="f-nutrition" placeholder="예: 열량 350kcal, 당류 20g">' + esc(state.nutritionInfo) + '</textarea>' +
          '</div>' +

          '<div class="divider-line"></div>' +

          '<div class="input-group">' +
            '<div class="input-label">알레르기 정보 (선택)</div>' +
            '<textarea class="input-field" id="f-allergy" placeholder="예: 우유, 밀, 대두 함유">' + esc(state.allergyInfo) + '</textarea>' +
          '</div>' +

          '</div>' +

          '<div class="edit-tab-panel" data-edit-panel="option">' +

          '<div class="input-group">' +
            '<div class="toggle-row">' +
              '<span class="input-label" style="margin:0;">옵션 그룹 사용</span>' +
              '<button type="button" class="toggle' + (state.useOptionGroups ? ' on' : '') + '" role="switch" aria-checked="' + (state.useOptionGroups ? 'true' : 'false') + '" data-action="toggle-use-option-groups"><span class="toggle-knob"></span></button>' +
            '</div>' +
            '<div id="option-groups-wrap" style="margin-top:12px;' + (state.useOptionGroups ? '' : 'display:none;') + '">' +
              '<div class="option-groups-subtitle">기존 옵션 그룹에서 선택</div>' +
              '<div id="existing-group-chips">' + existingGroupChipsHtml(state.storeId, state) + '</div>' +
              '<div class="option-groups-subtitle">새 옵션 그룹 만들기</div>' +
              '<div class="option-preset-row">' +
                '<button type="button" class="option-preset-chip" data-action="add-preset-group" data-preset="size">+ 사이즈</button>' +
                '<button type="button" class="option-preset-chip" data-action="add-preset-group" data-preset="topping">+ 토핑</button>' +
                '<button type="button" class="option-preset-chip ghost" data-action="add-group">+ 새 옵션 그룹 추가</button>' +
              '</div>' +
              '<div id="option-groups-list">' + renderOptionGroupsList(state) + '</div>' +
            '</div>' +
          '</div>' +

          '</div>' +

        '</div>' +
      '</div>' +
      '<div class="cta-fixed">' +
        '<div class="input-error" id="err-general" style="display:none;margin-bottom:8px;"></div>' +
        '<button type="button" class="btn btn-primary" id="save-btn">저장</button>' +
      '</div>'
    );
  }

  function mountMenuEdit(root, params) {
    var state = buildInitialState(params);

    function updatePreview() {
      root.querySelector('#menu-preview-container').innerHTML = renderPreviewHtml(state);
      var netPrice = money(Number(state.price) || 0);
      root.querySelectorAll('.promo-price-net').forEach(function (el) { el.textContent = '정가 ' + netPrice; });
    }

    function clearErrors() {
      ['name', 'category', 'price', 'stock', 'happyHourPrice', 'firstComePrice', 'general'].forEach(function (key) {
        var el = root.querySelector('#err-' + key);
        if (el) { el.style.display = 'none'; el.textContent = ''; }
      });
    }

    // 필드가 어느 탭에 있는지 알아야, 검증 에러가 나면 그 탭으로 이동시켜 사용자가 에러를 놓치지 않게 한다
    var FIELD_TAB = { name: 'basic', category: 'basic', price: 'basic', stock: 'etc', happyHourPrice: 'etc', firstComePrice: 'etc', optionGroup: 'option' };

    function switchEditTab(tabKey) {
      root.querySelectorAll('[data-edit-tab]').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-edit-tab') === tabKey);
      });
      root.querySelectorAll('[data-edit-panel]').forEach(function (panel) {
        panel.classList.toggle('active', panel.getAttribute('data-edit-panel') === tabKey);
      });
    }

    root.querySelectorAll('[data-edit-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { switchEditTab(btn.getAttribute('data-edit-tab')); });
    });

    function showError(field, msg) {
      var el = root.querySelector('#err-' + field);
      if (!el) el = root.querySelector('#err-general');
      if (FIELD_TAB[field]) switchEditTab(FIELD_TAB[field]);
      el.textContent = msg;
      el.style.display = 'block';
    }

    root.querySelector('#edit-back').addEventListener('click', function () {
      window.Router.back();
    });

    root.querySelector('#f-name').addEventListener('input', function (e) { state.name = e.target.value; updatePreview(); });
    root.querySelector('#f-price').addEventListener('input', function (e) { state.price = e.target.value; updatePreview(); });
    root.querySelector('#f-desc').addEventListener('input', function (e) { state.description = e.target.value; updatePreview(); });
    root.querySelector('#f-origin').addEventListener('input', function (e) { state.origin = e.target.value; updatePreview(); });
    root.querySelector('#f-nutrition').addEventListener('input', function (e) { state.nutritionInfo = e.target.value; updatePreview(); });
    root.querySelector('#f-allergy').addEventListener('input', function (e) { state.allergyInfo = e.target.value; updatePreview(); });
    root.querySelector('#f-stock').addEventListener('input', function (e) { state.stockQuantity = e.target.value; updatePreview(); });

    var happyToggle = root.querySelector('#toggle-happy-hour');
    var happyDetail = root.querySelector('#happy-hour-detail');
    happyToggle.addEventListener('click', function () {
      state.happyHourEnabled = !state.happyHourEnabled;
      happyToggle.classList.toggle('on', state.happyHourEnabled);
      happyDetail.style.display = state.happyHourEnabled ? '' : 'none';
      if (!state.happyHourEnabled) {
        state.happyHourPrice = '';
        var hpInput = root.querySelector('#f-happy-price');
        if (hpInput) hpInput.value = '';
      }
      updatePreview();
    });
    var happyPriceInput = root.querySelector('#f-happy-price');
    if (happyPriceInput) happyPriceInput.addEventListener('input', function (e) { state.happyHourPrice = e.target.value; updatePreview(); });
    var happyStartInput = root.querySelector('#f-happy-start');
    if (happyStartInput) happyStartInput.addEventListener('input', function (e) { state.happyHourStart = e.target.value; updatePreview(); });
    var happyEndInput = root.querySelector('#f-happy-end');
    if (happyEndInput) happyEndInput.addEventListener('input', function (e) { state.happyHourEnd = e.target.value; updatePreview(); });

    var firstToggle = root.querySelector('#toggle-first-come');
    var firstDetail = root.querySelector('#first-come-detail');
    firstToggle.addEventListener('click', function () {
      state.firstComeEnabled = !state.firstComeEnabled;
      firstToggle.classList.toggle('on', state.firstComeEnabled);
      firstDetail.style.display = state.firstComeEnabled ? '' : 'none';
      if (!state.firstComeEnabled) {
        state.firstComePrice = '';
        state.firstComeQty = '';
        var fpInput = root.querySelector('#f-first-price');
        if (fpInput) fpInput.value = '';
        var fqInput = root.querySelector('#f-first-qty');
        if (fqInput) fqInput.value = '';
      }
      updatePreview();
    });
    var firstPriceInput = root.querySelector('#f-first-price');
    if (firstPriceInput) firstPriceInput.addEventListener('input', function (e) { state.firstComePrice = e.target.value; updatePreview(); });
    var firstQtyInput = root.querySelector('#f-first-qty');
    if (firstQtyInput) firstQtyInput.addEventListener('input', function (e) { state.firstComeQty = e.target.value; updatePreview(); });

    function updateImageUI() {
      root.querySelector('#menu-image-thumb').innerHTML = state.imageUrl
        ? '<img src="' + esc(state.imageUrl) + '" alt="" />'
        : '<span class="thumb-placeholder">' + window.Icons3D.iconLine('camera', 20) + '</span>';
      var removeBtn = root.querySelector('#remove-image-btn');
      if (state.imageUrl && !removeBtn) {
        var btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'btn-text'; btn.id = 'remove-image-btn'; btn.textContent = '이미지 삭제';
        btn.addEventListener('click', function () { state.imageUrl = ''; updateImageUI(); updatePreview(); });
        root.querySelector('.menu-image-upload-actions').appendChild(btn);
      } else if (!state.imageUrl && removeBtn) {
        removeBtn.remove();
      }
    }
    function handleImageFile(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        state.imageUrl = ev.target.result;
        updateImageUI();
        updatePreview();
      };
      reader.readAsDataURL(file);
    }
    root.querySelector('#f-image-file-album').addEventListener('change', handleImageFile);
    root.querySelector('#f-image-file-camera').addEventListener('change', handleImageFile);
    var initialRemoveBtn = root.querySelector('#remove-image-btn');
    if (initialRemoveBtn) {
      initialRemoveBtn.addEventListener('click', function () { state.imageUrl = ''; updateImageUI(); updatePreview(); });
    }

    var newCategoryInput = root.querySelector('#f-new-category');
    if (newCategoryInput) {
      newCategoryInput.addEventListener('input', function (e) { state.newCategoryName = e.target.value; });
    }

    root.querySelector('#category-select').addEventListener('change', function (e) {
      state.categoryId = e.target.value;
      root.querySelector('#new-category-group').style.display = (state.categoryId === '__new__') ? '' : 'none';
    });

    var autoToggle = root.querySelector('#toggle-auto-soldout');
    autoToggle.addEventListener('click', function () {
      state.autoSoldoutEnabled = !state.autoSoldoutEnabled;
      autoToggle.classList.toggle('on', state.autoSoldoutEnabled);
      var hint = root.querySelector('#stock-required-hint');
      if (hint) hint.style.display = state.autoSoldoutEnabled ? '' : 'none';
      updatePreview();
    });

    var exposedToggle = root.querySelector('#toggle-exposed');
    exposedToggle.addEventListener('click', function () {
      state.exposed = !state.exposed;
      exposedToggle.classList.toggle('on', !state.exposed);
      updatePreview();
    });

    var useGroupsToggle = root.querySelector('[data-action="toggle-use-option-groups"]');
    useGroupsToggle.addEventListener('click', function () {
      state.useOptionGroups = !state.useOptionGroups;
      useGroupsToggle.classList.toggle('on', state.useOptionGroups);
      root.querySelector('#option-groups-wrap').style.display = state.useOptionGroups ? '' : 'none';
    });

    function renderGroupsList() {
      root.querySelector('#option-groups-list').innerHTML = renderOptionGroupsList(state);
    }

    var groupsWrap = root.querySelector('#option-groups-wrap');

    groupsWrap.addEventListener('click', function (e) {
      var existingChipBtn = e.target.closest('[data-action="toggle-existing-group"]');
      if (existingChipBtn) {
        var chipGroupId = existingChipBtn.getAttribute('data-group-id');
        var idx = state.selectedGroupIds.indexOf(chipGroupId);
        if (idx === -1) state.selectedGroupIds.push(chipGroupId);
        else state.selectedGroupIds.splice(idx, 1);
        root.querySelector('#existing-group-chips').innerHTML = existingGroupChipsHtml(state.storeId, state);
        return;
      }
      var addGroupBtn = e.target.closest('[data-action="add-group"]');
      if (addGroupBtn) {
        state.optionGroups.push({ id: 'og-' + Date.now() + Math.random().toString(36).slice(2, 6), name: '', required: false, maxSelect: 1, options: [] });
        renderGroupsList();
        return;
      }
      var presetBtn = e.target.closest('[data-action="add-preset-group"]');
      if (presetBtn) {
        // 자주 쓰는 옵션은 이름/선택방식/필수여부가 채워진 채로 바로 만들어, 손님이 빈 칸부터 채우지 않아도 되게 한다
        var presetDefs = {
          size: { name: '사이즈', required: true, maxSelect: 1 },
          topping: { name: '토핑', required: false, maxSelect: 3 },
        };
        var preset = presetDefs[presetBtn.getAttribute('data-preset')];
        state.optionGroups.push(Object.assign({ id: 'og-' + Date.now() + Math.random().toString(36).slice(2, 6), options: [] }, preset));
        renderGroupsList();
        return;
      }
      var removeGroupBtn = e.target.closest('[data-action="remove-group"]');
      if (removeGroupBtn) {
        state.optionGroups.splice(Number(removeGroupBtn.getAttribute('data-group-idx')), 1);
        renderGroupsList();
        return;
      }
      var addOptionBtn = e.target.closest('[data-action="add-option"]');
      if (addOptionBtn) {
        var giAdd = Number(addOptionBtn.getAttribute('data-group-idx'));
        state.optionGroups[giAdd].options.push({ name: '', price: 0, soldOut: false });
        renderGroupsList();
        return;
      }
      var removeOptionBtn = e.target.closest('[data-action="remove-option"]');
      if (removeOptionBtn) {
        var giRem = Number(removeOptionBtn.getAttribute('data-group-idx'));
        var oiRem = Number(removeOptionBtn.getAttribute('data-opt-idx'));
        state.optionGroups[giRem].options.splice(oiRem, 1);
        renderGroupsList();
        return;
      }
      var reqToggleBtn = e.target.closest('[data-action="toggle-required"]');
      if (reqToggleBtn) {
        var giReq = Number(reqToggleBtn.getAttribute('data-group-idx'));
        state.optionGroups[giReq].required = !state.optionGroups[giReq].required;
        renderGroupsList();
        return;
      }
      var maxMinusBtn = e.target.closest('[data-action="maxselect-minus"]');
      if (maxMinusBtn) {
        var giMinus = Number(maxMinusBtn.getAttribute('data-group-idx'));
        var groupMinus = state.optionGroups[giMinus];
        groupMinus.maxSelect = Math.max(1, (Number(groupMinus.maxSelect) || 1) - 1);
        renderGroupsList();
        return;
      }
      var maxPlusBtn = e.target.closest('[data-action="maxselect-plus"]');
      if (maxPlusBtn) {
        var giPlus = Number(maxPlusBtn.getAttribute('data-group-idx'));
        var groupPlus = state.optionGroups[giPlus];
        groupPlus.maxSelect = Math.min(20, (Number(groupPlus.maxSelect) || 1) + 1);
        renderGroupsList();
        return;
      }
      var optSoldoutBtn = e.target.closest('[data-action="toggle-option-soldout"]');
      if (optSoldoutBtn) {
        var giSoldout = Number(optSoldoutBtn.getAttribute('data-group-idx'));
        var oiSoldout = Number(optSoldoutBtn.getAttribute('data-opt-idx'));
        var soldoutTarget = state.optionGroups[giSoldout].options[oiSoldout];
        soldoutTarget.soldOut = !soldoutTarget.soldOut;
        renderGroupsList();
        return;
      }
    });

    groupsWrap.addEventListener('input', function (e) {
      var t = e.target;
      if (t.matches('[data-field="group-name"]')) {
        state.optionGroups[Number(t.getAttribute('data-group-idx'))].name = t.value;
      } else if (t.matches('[data-field="opt-name"]')) {
        state.optionGroups[Number(t.getAttribute('data-group-idx'))].options[Number(t.getAttribute('data-opt-idx'))].name = t.value;
      } else if (t.matches('[data-field="opt-price"]')) {
        state.optionGroups[Number(t.getAttribute('data-group-idx'))].options[Number(t.getAttribute('data-opt-idx'))].price = Number(t.value) || 0;
      }
    });

    root.querySelector('#save-btn').addEventListener('click', function () {
      clearErrors();
      var err = validate(state);
      if (err) { showError(err.field, err.message); return; }
      doSave(state);
    });

    var deleteBtn = root.querySelector('#menu-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        window.UI.confirmModal(
          '정말 메뉴를 삭제하시나요?',
          '삭제하면 이 메뉴 정보를 되돌릴 수 없어요.',
          '삭제',
          function () {
            window.MockApi.deleteMenuItem(state.id);
            window.UI.toast('메뉴를 삭제했어요');
            window.Router.back();
          },
          { danger: true }
        );
      });
    }
  }

  window.Router.register('menuEdit', { render: renderMenuEdit, mount: mountMenuEdit, unmount: function () {} });
})();
