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

  function menuRowHtml(item, categories, isSpecific) {
    var cat = categories.find(function (c) { return c.id === item.categoryId; });
    var catName = cat ? cat.name : (item.categoryName || '미분류');
    return (
      '<div class="menu-row" data-menu-id="' + item.id + '">' +
        (isSpecific ?
          '<div class="menu-row-order-btns">' +
            '<button type="button" class="icon-btn-sm" data-action="move-up" data-menu-id="' + item.id + '">▲</button>' +
            '<button type="button" class="icon-btn-sm" data-action="move-down" data-menu-id="' + item.id + '">▼</button>' +
          '</div>' : ''
        ) +
        '<div class="menu-row-thumb">' + (item.imageUrl ? '<img src="' + esc(item.imageUrl) + '" alt="" />' : '🍽️') + '</div>' +
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
            (item.happyHourEnabled && item.happyHourPrice != null ? ' · <span class="menu-row-price-promo">해피아워 ' + money(item.happyHourPrice) + '</span>' : '') +
            (item.firstComeEnabled && item.firstComePrice != null ? ' · <span class="menu-row-price-promo">선착순 ' + money(item.firstComePrice) + '</span>' : '') +
            ' · 준비량 ' + (item.stockQuantity != null ? item.stockQuantity + '개' : '-') +
          '</div>' +
        '</div>' +
        '<div class="menu-row-side">' +
          '<div class="menu-row-soldout-toggle">' +
            '<span class="menu-row-toggle-label">품절</span>' +
            '<button type="button" class="toggle' + (item.soldOut ? ' on' : '') + '" data-action="toggle-soldout" data-menu-id="' + item.id + '"><span class="toggle-knob"></span></button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function listBodyHtml(items, categories, isSpecific) {
    if (!items.length) {
      return '<div class="empty-state"><div class="empty-state-emoji">🍽️</div><div>등록된 메뉴가 없어요</div></div>';
    }
    return '<div class="menu-list">' + items.map(function (item) { return menuRowHtml(item, categories, isSpecific); }).join('') + '</div>';
  }

  // 옵션 목록 탭 — 매장에 등록된 옵션 그룹을 직접 편집한다 (메뉴 추가 폼과 달리 저장 버튼 없이 즉시 반영됨)
  function optionGroupCardHtml(g) {
    var usage = window.MockApi.getOptionGroupUsageCount(g.id);
    var optionsHtml = (g.options || []).map(function (o, oi) {
      var triState = o.exposed === false ? 'hidden' : ((!!o.soldOut) ? 'soldout' : 'available');
      return (
        '<div class="option-row">' +
          '<div class="option-seg-pair">' +
            '<button type="button" class="option-seg-btn' + (triState === 'available' ? ' active' : '') + '" data-action="lib-set-option-tri" data-value="available" data-group-id="' + g.id + '" data-opt-idx="' + oi + '">판매중</button>' +
            '<button type="button" class="option-seg-btn tone-red' + (triState === 'soldout' ? ' active' : '') + '" data-action="lib-set-option-tri" data-value="soldout" data-group-id="' + g.id + '" data-opt-idx="' + oi + '">품절</button>' +
            '<button type="button" class="option-seg-btn tone-gray' + (triState === 'hidden' ? ' active' : '') + '" data-action="lib-set-option-tri" data-value="hidden" data-group-id="' + g.id + '" data-opt-idx="' + oi + '">숨김</button>' +
          '</div>' +
          '<input class="input-field option-name-input" type="text" placeholder="옵션명" value="' + esc(o.name) + '" data-field="lib-opt-name" data-group-id="' + g.id + '" data-opt-idx="' + oi + '" />' +
          '<input class="input-field option-price-input" type="number" placeholder="금액" value="' + (o.price || 0) + '" data-field="lib-opt-price" data-group-id="' + g.id + '" data-opt-idx="' + oi + '" />' +
          '<button type="button" class="icon-btn-sm" data-action="lib-remove-option" data-group-id="' + g.id + '" data-opt-idx="' + oi + '">✕</button>' +
        '</div>'
      );
    }).join('');
    return (
      '<div class="option-group-card">' +
        '<div class="option-group-head">' +
          '<input class="input-field" type="text" style="flex:1;height:44px;" placeholder="옵션 그룹명 (예: 사이즈)" value="' + esc(g.name) + '" data-field="lib-group-name" data-group-id="' + g.id + '" />' +
          '<button type="button" class="icon-btn-sm" data-action="lib-remove-group" data-group-id="' + g.id + '" style="margin-left:8px;">✕</button>' +
        '</div>' +
        '<div class="option-group-usage">' + (usage > 0 ? usage + '개 메뉴에서 사용 중' : '사용 중인 메뉴 없음') + '</div>' +
        '<div class="option-group-controls">' +
          '<div class="option-select-mode">' +
            '<button type="button" class="segment-tab-sm' + (!g.multiSelect ? ' active' : '') + '" data-action="lib-set-select-single" data-group-id="' + g.id + '">1개만 선택</button>' +
            '<button type="button" class="segment-tab-sm' + (g.multiSelect ? ' active' : '') + '" data-action="lib-set-select-multi" data-group-id="' + g.id + '">여러개 선택</button>' +
          '</div>' +
          '<div class="option-required-row">' +
            '<span class="option-required-label">필수 여부</span>' +
            '<button type="button" class="toggle' + (g.required ? ' on' : '') + '" data-action="lib-toggle-required" data-group-id="' + g.id + '"><span class="toggle-knob"></span></button>' +
          '</div>' +
        '</div>' +
        optionsHtml +
        '<button type="button" class="btn btn-secondary btn-sm" data-action="lib-add-option" data-group-id="' + g.id + '">+ 옵션 추가</button>' +
      '</div>'
    );
  }

  function optionLibraryHtml(groups) {
    if (!groups.length) {
      return '<div class="empty-state"><div class="empty-state-emoji">🧩</div><div>등록된 옵션 그룹이 없어요</div></div>';
    }
    // 옵션 목록은 이미 각 입력마다 즉시 저장되지만, 사장님이 안심할 수 있도록 확인용 저장 버튼을 둔다
    return '<div class="option-library-list">' + groups.map(optionGroupCardHtml).join('') +
      '<button type="button" class="btn btn-primary" id="option-library-save-btn">저장</button>' +
      '</div>';
  }

  function renderMenuList() {
    return (
      '<style>' +
        '.menu-list{padding-bottom:24px;}' +
        '.menu-row-soldout-toggle{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;}' +
        '.menu-row-toggle-label{font-size:var(--font-size-micro);color:var(--color-text-secondary);font-weight:700;}' +
        '.menu-add-btn{display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 14px;border:none;border-radius:var(--radius-pill);' +
          'background:var(--color-accent-blue-bg);font-size:var(--font-size-caption);font-weight:800;color:var(--color-accent-blue);cursor:pointer;white-space:nowrap;}' +
        '.main-tab-row{display:flex;gap:8px;padding:0 var(--space-5) var(--space-3);}' +
        '.main-tab{border:none;cursor:pointer;border-radius:var(--radius-button);font-weight:800;' +
          'background:var(--color-divider);color:var(--color-text-secondary);height:44px;}' +
        '.main-tab.active{background:var(--color-text-primary);color:var(--color-white);}' +
        '.main-tab-menu{flex:2;font-size:var(--font-size-body);}' +
        '.main-tab-option{flex:1;font-size:var(--font-size-caption);}' +
        '.option-library-list{padding-bottom:24px;}' +
        '.option-library-list #option-library-save-btn{margin-top:4px;}' +
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

    function refresh() {
      root.querySelectorAll('[data-main-tab]').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-main-tab') === activeMainTab);
      });
      root.querySelector('#menu-topbar-action-btn').textContent = activeMainTab === 'menu' ? '+ 메뉴 추가' : '+ 옵션 추가';

      var wrap = root.querySelector('#menu-list-wrap');
      if (activeMainTab === 'menu') {
        var categories = getAllCategories(storeId);
        var isSpecific = selectedCategoryId !== null;
        var items = window.MockApi.getMenuItems(storeId, isSpecific ? selectedCategoryId : undefined);
        wrap.innerHTML = tabsHtml(categories, selectedCategoryId) + listBodyHtml(items, categories, isSpecific);
      } else {
        wrap.innerHTML = optionLibraryHtml(window.MockApi.getOptionGroups(storeId));
      }
    }

    root.querySelector('#menu-back').addEventListener('click', function () {
      window.Router.back();
    });
    root.querySelector('#menu-topbar-action-btn').addEventListener('click', function () {
      if (activeMainTab === 'menu') {
        window.Router.showScreen('menuEdit', {});
      } else {
        window.MockApi.addOptionGroup(storeId, { name: '', required: false, multiSelect: false, options: [] });
        refresh();
      }
    });

    root.addEventListener('click', function (e) {
      var mainTabBtn = e.target.closest('[data-main-tab]');
      if (mainTabBtn) {
        activeMainTab = mainTabBtn.getAttribute('data-main-tab');
        refresh();
        return;
      }

      if (activeMainTab === 'option') {
        var addGroupLibBtn = e.target.closest('[data-action="lib-add-option"]');
        var removeGroupLibBtn = e.target.closest('[data-action="lib-remove-group"]');
        var reqLibBtn = e.target.closest('[data-action="lib-toggle-required"]');
        var singleLibBtn = e.target.closest('[data-action="lib-set-select-single"]');
        var multiLibBtn = e.target.closest('[data-action="lib-set-select-multi"]');
        var triLibBtn = e.target.closest('[data-action="lib-set-option-tri"]');
        var removeOptLibBtn = e.target.closest('[data-action="lib-remove-option"]');

        if (addGroupLibBtn) {
          window.MockApi.addOptionGroupOption(addGroupLibBtn.getAttribute('data-group-id'), { name: '', price: 0 });
          refresh();
          return;
        }
        if (removeGroupLibBtn) {
          var delGroupId = removeGroupLibBtn.getAttribute('data-group-id');
          var result = window.MockApi.deleteOptionGroup(delGroupId);
          if (!result.ok) {
            window.UI.toast('이 옵션 그룹은 ' + result.usage + '개 메뉴에서 사용 중이라 삭제할 수 없어요');
          } else {
            window.UI.toast('옵션 그룹을 삭제했어요');
          }
          refresh();
          return;
        }
        if (reqLibBtn) {
          var reqGroup = window.MockApi.getOptionGroup(reqLibBtn.getAttribute('data-group-id'));
          window.MockApi.updateOptionGroup(reqLibBtn.getAttribute('data-group-id'), { required: !reqGroup.required });
          refresh();
          return;
        }
        if (singleLibBtn) {
          window.MockApi.updateOptionGroup(singleLibBtn.getAttribute('data-group-id'), { multiSelect: false });
          refresh();
          return;
        }
        if (multiLibBtn) {
          window.MockApi.updateOptionGroup(multiLibBtn.getAttribute('data-group-id'), { multiSelect: true });
          refresh();
          return;
        }
        if (triLibBtn) {
          var triLibVal = triLibBtn.getAttribute('data-value');
          var triLibPayload = triLibVal === 'available' ? { soldOut: false, exposed: true } : triLibVal === 'soldout' ? { soldOut: true, exposed: true } : { exposed: false };
          window.MockApi.updateOptionGroupOption(triLibBtn.getAttribute('data-group-id'), Number(triLibBtn.getAttribute('data-opt-idx')), triLibPayload);
          refresh();
          return;
        }
        if (removeOptLibBtn) {
          window.MockApi.removeOptionGroupOption(removeOptLibBtn.getAttribute('data-group-id'), Number(removeOptLibBtn.getAttribute('data-opt-idx')));
          refresh();
          return;
        }
        if (e.target.closest('#option-library-save-btn')) {
          window.UI.toast('저장되었어요');
          return;
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
      var moveBtn = e.target.closest('[data-action="move-up"],[data-action="move-down"]');
      if (moveBtn) {
        var mid = moveBtn.getAttribute('data-menu-id');
        var dir = moveBtn.getAttribute('data-action') === 'move-up' ? 'up' : 'down';
        window.MockApi.moveMenuItem(mid, dir);
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

    root.addEventListener('input', function (e) {
      if (activeMainTab !== 'option') return;
      var t = e.target;
      if (t.matches('[data-field="lib-group-name"]')) {
        window.MockApi.updateOptionGroup(t.getAttribute('data-group-id'), { name: t.value });
      } else if (t.matches('[data-field="lib-opt-name"]')) {
        window.MockApi.updateOptionGroupOption(t.getAttribute('data-group-id'), Number(t.getAttribute('data-opt-idx')), { name: t.value });
      } else if (t.matches('[data-field="lib-opt-price"]')) {
        window.MockApi.updateOptionGroupOption(t.getAttribute('data-group-id'), Number(t.getAttribute('data-opt-idx')), { price: Number(t.value) || 0 });
      }
    });

    refresh();
  }

  window.Router.register('menuManagement', { render: renderMenuList, mount: mountMenuList, unmount: function () {} });

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
        pricePromoEnabled: !!(item.happyHourEnabled || item.firstComeEnabled),
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
      pricePromoEnabled: false,
      happyHourEnabled: false,
      happyHourPrice: '',
      happyHourStart: '15:00',
      happyHourEnd: '17:00',
      firstComeEnabled: false,
      firstComePrice: '',
      firstComeQty: '',
      stockQuantity: '',
      autoSoldoutEnabled: true,
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
      var modeLabel = g.multiSelect ? '여러개 선택' : '1개만 선택';
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
      var optionsHtml = (g.options || []).map(function (o, oi) {
        var triState = o.exposed === false ? 'hidden' : ((!!o.soldOut) ? 'soldout' : 'available');
        return (
          '<div class="option-row">' +
            '<div class="option-seg-pair">' +
              '<button type="button" class="option-seg-btn' + (triState === 'available' ? ' active' : '') + '" data-action="set-option-tri" data-value="available" data-group-idx="' + gi + '" data-opt-idx="' + oi + '">판매중</button>' +
              '<button type="button" class="option-seg-btn tone-red' + (triState === 'soldout' ? ' active' : '') + '" data-action="set-option-tri" data-value="soldout" data-group-idx="' + gi + '" data-opt-idx="' + oi + '">품절</button>' +
              '<button type="button" class="option-seg-btn tone-gray' + (triState === 'hidden' ? ' active' : '') + '" data-action="set-option-tri" data-value="hidden" data-group-idx="' + gi + '" data-opt-idx="' + oi + '">숨김</button>' +
            '</div>' +
            '<input class="input-field option-name-input" type="text" placeholder="옵션명" value="' + esc(o.name) + '" data-field="opt-name" data-group-idx="' + gi + '" data-opt-idx="' + oi + '" />' +
            '<input class="input-field option-price-input" type="number" placeholder="금액" value="' + (o.price || 0) + '" data-field="opt-price" data-group-idx="' + gi + '" data-opt-idx="' + oi + '" />' +
            '<button type="button" class="icon-btn-sm" data-action="remove-option" data-group-idx="' + gi + '" data-opt-idx="' + oi + '">✕</button>' +
          '</div>'
        );
      }).join('');
      return (
        '<div class="option-group-card">' +
          '<div class="option-group-head">' +
            '<input class="input-field" type="text" style="flex:1;height:44px;" placeholder="옵션 그룹명 (예: 사이즈)" value="' + esc(g.name) + '" data-field="group-name" data-group-idx="' + gi + '" />' +
            '<button type="button" class="icon-btn-sm" data-action="remove-group" data-group-idx="' + gi + '" style="margin-left:8px;">✕</button>' +
          '</div>' +
          '<div class="option-group-controls">' +
            '<div class="option-select-mode">' +
              '<button type="button" class="segment-tab-sm' + (!g.multiSelect ? ' active' : '') + '" data-action="set-select-single" data-group-idx="' + gi + '">1개만 선택</button>' +
              '<button type="button" class="segment-tab-sm' + (g.multiSelect ? ' active' : '') + '" data-action="set-select-multi" data-group-idx="' + gi + '">여러개 선택</button>' +
            '</div>' +
            '<div class="option-required-row">' +
              '<span class="option-required-label">필수 여부</span>' +
              '<button type="button" class="toggle' + (g.required ? ' on' : '') + '" data-action="toggle-required" data-group-idx="' + gi + '"><span class="toggle-knob"></span></button>' +
            '</div>' +
          '</div>' +
          optionsHtml +
          '<button type="button" class="btn btn-secondary btn-sm" data-action="add-option" data-group-idx="' + gi + '">+ 옵션 추가</button>' +
        '</div>'
      );
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
        '<span class="menu-preview-price-promo">🔥 해피아워 ' + money(Number(state.happyHourPrice)) + '</span>' +
        '<span class="menu-preview-promo-caption">' + esc(state.happyHourStart) + '~' + esc(state.happyHourEnd) + '</span>' +
      '</div>';
    }
    if (hasFirstCome) {
      priceHtml += '<div class="menu-preview-promo-row">' +
        '<span class="menu-preview-price-promo">⚡ 선착순 ' + money(Number(state.firstComePrice)) + '</span>' +
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
      (!state.exposed ? '<div class="section-caption" style="text-align:center;">손님 화면에 보이지 않아요 (숨김 설정)</div>' : '')
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
          var cleanOptions = (g.options || [])
            .filter(function (o) { return o.name && o.name.trim(); })
            .map(function (o) { return { name: o.name.trim(), price: Number(o.price) || 0, soldOut: !!o.soldOut, exposed: o.exposed !== false }; });
          var created = window.MockApi.addOptionGroup(state.storeId, {
            name: g.name.trim(),
            required: !!g.required,
            multiSelect: !!g.multiSelect,
            options: cleanOptions,
          });
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
        '.menu-edit-form-pad{padding:20px;}' +
        '.menu-image-upload-row{display:flex;align-items:center;gap:12px;}' +
        '.menu-image-thumb{width:56px;height:56px;border-radius:12px;background:var(--color-divider);display:flex;' +
          'align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;font-size:22px;}' +
        '.menu-image-thumb img{width:100%;height:100%;object-fit:cover;}' +
        '.menu-image-upload-actions{display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px;}' +
        '.menu-image-upload-actions label.btn{cursor:pointer;height:36px;min-height:36px;padding:0 12px;font-size:var(--font-size-caption);}' +
        '.pricing-promo-section{margin-top:12px;padding-top:12px;border-top:1px dashed var(--color-disabled);}' +
        '.time-range-row{display:flex;align-items:center;gap:8px;}' +
        '.time-range-row .input-field{flex:1;}' +
        '.time-range-sep{color:var(--color-text-secondary);flex-shrink:0;}' +
        '.info-memo{font-size:var(--font-size-caption);color:var(--color-text-secondary);background:var(--color-divider);' +
          'border-left:3px solid var(--color-text-primary);border-radius:0 10px 10px 0;padding:10px 12px;line-height:1.55;margin-top:10px;}' +
        '.promo-price-net{font-size:var(--font-size-caption);color:var(--color-text-secondary);margin-bottom:8px;}' +
        '.existing-group-chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}' +
        '.existing-group-chip{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 12px;' +
          'border:1.5px solid var(--color-disabled);border-radius:var(--radius-card);background:var(--color-white);cursor:pointer;text-align:left;}' +
        '.existing-group-chip.on{border-color:var(--color-accent-blue);background:var(--color-accent-blue-bg);}' +
        '.existing-group-chip .name{font-size:var(--font-size-caption);font-weight:800;color:var(--color-text-primary);}' +
        '.existing-group-chip .meta{font-size:var(--font-size-micro);color:var(--color-text-secondary);}' +
        '.option-groups-subtitle{font-size:var(--font-size-micro);font-weight:700;color:var(--color-text-secondary);margin:14px 0 8px;}' +
        '.menu-edit-tab-bar{padding:0 var(--space-5) var(--space-3);}' +
        '.edit-tab-panel{display:none;}' +
        '.edit-tab-panel.active{display:block;}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="edit-back">←</button></div>' +
        '<div class="topbar-title">' + (state.isEdit ? '메뉴 수정' : '메뉴 추가') + '</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="segment-tabs menu-edit-tab-bar">' +
        '<button type="button" class="segment-tab active" data-edit-tab="basic">기본 정보</button>' +
        '<button type="button" class="segment-tab" data-edit-tab="etc">기타 설정</button>' +
        '<button type="button" class="segment-tab" data-edit-tab="option">옵션</button>' +
      '</div>' +
      '<div class="screen-scroll">' +
        '<div class="menu-edit-form-pad">' +

          '<div class="edit-tab-panel active" data-edit-panel="basic">' +

          '<div class="input-group">' +
            '<div class="input-label">메뉴 이미지</div>' +
            '<div class="menu-image-upload-row">' +
              '<div class="menu-image-thumb" id="menu-image-thumb">' +
                (state.imageUrl ? '<img src="' + esc(state.imageUrl) + '" alt="" />' : '<span>📷</span>') +
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

          '</div>' +

          '<div class="edit-tab-panel" data-edit-panel="etc">' +

          '<div class="input-group">' +
            '<div class="toggle-row">' +
              '<div class="label-group" style="display:flex;flex-direction:column;">' +
                '<span class="input-label" style="margin:0;">자동 품절</span>' +
                '<span class="menu-edit-subcaption">준비량이 0이 되면 자동으로 품절 처리해요</span>' +
              '</div>' +
              '<button type="button" class="toggle' + (state.autoSoldoutEnabled ? ' on' : '') + '" id="toggle-auto-soldout"><span class="toggle-knob"></span></button>' +
            '</div>' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label">준비량<span id="stock-required-hint" style="color:var(--color-accent-red);' + (state.autoSoldoutEnabled ? '' : 'display:none;') + '"> · 자동품절 ON 시 필수</span></div>' +
            '<input class="input-field" type="number" id="f-stock" placeholder="준비량을 입력해주세요" value="' + (state.stockQuantity === '' ? '' : state.stockQuantity) + '" />' +
            '<div class="input-error" id="err-stock" style="display:none;"></div>' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="toggle-row">' +
              '<div class="label-group" style="display:flex;flex-direction:column;">' +
                '<span class="input-label" style="margin:0;">메뉴 숨기기</span>' +
                '<span class="menu-edit-subcaption">켜면 손님 화면에서 이 메뉴가 보이지 않아요</span>' +
              '</div>' +
              '<button type="button" class="toggle' + (!state.exposed ? ' on' : '') + '" id="toggle-exposed"><span class="toggle-knob"></span></button>' +
            '</div>' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="toggle-row">' +
              '<div class="label-group" style="display:flex;flex-direction:column;">' +
                '<span class="input-label" style="margin:0;">가격 프로모션 설정</span>' +
                '<span class="menu-edit-subcaption">해피아워 · 선착순 할인가를 설정할 수 있어요</span>' +
              '</div>' +
              '<button type="button" class="toggle' + (state.pricePromoEnabled ? ' on' : '') + '" id="toggle-price-promo"><span class="toggle-knob"></span></button>' +
            '</div>' +
            '<div id="price-promo-section" class="pricing-promo-section" style="' + (state.pricePromoEnabled ? '' : 'display:none;') + '">' +

              '<div class="toggle-row">' +
                '<div class="label-group" style="display:flex;flex-direction:column;">' +
                  '<span class="input-label" style="margin:0;">해피아워 가격 설정</span>' +
                  '<span class="menu-edit-subcaption">정해진 시간 동안만 할인 가격으로 판매해요</span>' +
                '</div>' +
                '<button type="button" class="toggle' + (state.happyHourEnabled ? ' on' : '') + '" id="toggle-happy-hour"><span class="toggle-knob"></span></button>' +
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
                '<div class="info-memo">💡 설정한 시간 동안에는 정가 대신 이 가격이 자동으로 적용돼요.</div>' +
              '</div>' +

              '<div class="toggle-row" style="margin-top:16px;">' +
                '<div class="label-group" style="display:flex;flex-direction:column;">' +
                  '<span class="input-label" style="margin:0;">선착순 가격 설정</span>' +
                  '<span class="menu-edit-subcaption">정해진 수량까지만 할인 가격으로 판매해요</span>' +
                '</div>' +
                '<button type="button" class="toggle' + (state.firstComeEnabled ? ' on' : '') + '" id="toggle-first-come"><span class="toggle-knob"></span></button>' +
              '</div>' +
              '<div id="first-come-detail" style="margin-top:12px;' + (state.firstComeEnabled ? '' : 'display:none;') + '">' +
                '<div class="promo-price-net">정가 ' + money(Number(state.price) || 0) + '</div>' +
                '<div class="input-label">선착순 가격</div>' +
                '<input class="input-field" type="number" id="f-first-price" placeholder="할인 적용 가격을 입력해주세요" value="' + (state.firstComePrice === '' ? '' : state.firstComePrice) + '" />' +
                '<div class="input-error" id="err-firstComePrice" style="display:none;"></div>' +
                '<div class="input-label" style="margin-top:10px;">선착순 수량</div>' +
                '<input class="input-field" type="number" id="f-first-qty" placeholder="예: 20" value="' + (state.firstComeQty === '' ? '' : state.firstComeQty) + '" />' +
                '<div class="info-memo">💡 선착순 수량이 모두 팔리면 정가로 자동 전환돼요.</div>' +
              '</div>' +

            '</div>' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label">원산지 (선택)</div>' +
            '<input class="input-field" type="text" id="f-origin" placeholder="원산지를 입력해주세요" value="' + esc(state.origin) + '" />' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label">영양 정보 (선택)</div>' +
            '<textarea class="input-field" id="f-nutrition" placeholder="예: 열량 350kcal, 당류 20g">' + esc(state.nutritionInfo) + '</textarea>' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label">알레르기 정보 (선택)</div>' +
            '<textarea class="input-field" id="f-allergy" placeholder="예: 우유, 밀, 대두 함유">' + esc(state.allergyInfo) + '</textarea>' +
          '</div>' +

          '</div>' +

          '<div class="edit-tab-panel" data-edit-panel="option">' +

          '<div class="input-group">' +
            '<div class="toggle-row">' +
              '<span class="input-label" style="margin:0;">옵션 그룹 사용</span>' +
              '<button type="button" class="toggle' + (state.useOptionGroups ? ' on' : '') + '" data-action="toggle-use-option-groups"><span class="toggle-knob"></span></button>' +
            '</div>' +
            '<div id="option-groups-wrap" style="margin-top:12px;' + (state.useOptionGroups ? '' : 'display:none;') + '">' +
              '<div class="option-groups-subtitle">기존 옵션 그룹에서 선택</div>' +
              '<div id="existing-group-chips">' + existingGroupChipsHtml(state.storeId, state) + '</div>' +
              '<div class="option-groups-subtitle">새 옵션 그룹 만들기</div>' +
              '<div class="option-preset-row">' +
                '<button type="button" class="option-preset-chip" data-action="add-preset-group" data-preset="size">+ 사이즈</button>' +
                '<button type="button" class="option-preset-chip" data-action="add-preset-group" data-preset="topping">+ 토핑</button>' +
                '<button type="button" class="option-preset-chip ghost" data-action="add-group">+ 직접 만들기</button>' +
              '</div>' +
              '<div id="option-groups-list">' + renderOptionGroupsList(state) + '</div>' +
            '</div>' +
          '</div>' +

          '</div>' +

        '</div>' +
      '</div>' +
      '<div class="cta-fixed">' +
        '<div class="input-error" id="err-general" style="display:none;margin-bottom:8px;text-align:center;"></div>' +
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
    var FIELD_TAB = { name: 'basic', category: 'basic', price: 'basic', stock: 'etc', happyHourPrice: 'etc', firstComePrice: 'etc' };

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

    var pricePromoToggle = root.querySelector('#toggle-price-promo');
    var pricePromoSection = root.querySelector('#price-promo-section');
    pricePromoToggle.addEventListener('click', function () {
      state.pricePromoEnabled = !state.pricePromoEnabled;
      pricePromoToggle.classList.toggle('on', state.pricePromoEnabled);
      pricePromoSection.style.display = state.pricePromoEnabled ? '' : 'none';
      if (!state.pricePromoEnabled) {
        // 마스터 토글을 끄면 하위 해피아워/선착순도 함께 꺼서 숨겨진 상태로 값이 남지 않게 한다
        state.happyHourEnabled = false;
        state.happyHourPrice = '';
        state.firstComeEnabled = false;
        state.firstComePrice = '';
        state.firstComeQty = '';
        var hToggle = root.querySelector('#toggle-happy-hour');
        var hDetail = root.querySelector('#happy-hour-detail');
        if (hToggle) hToggle.classList.remove('on');
        if (hDetail) hDetail.style.display = 'none';
        var fToggle = root.querySelector('#toggle-first-come');
        var fDetail = root.querySelector('#first-come-detail');
        if (fToggle) fToggle.classList.remove('on');
        if (fDetail) fDetail.style.display = 'none';
      }
      updatePreview();
    });

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
        : '<span>📷</span>';
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
        state.optionGroups.push({ id: 'og-' + Date.now() + Math.random().toString(36).slice(2, 6), name: '', required: false, multiSelect: false, options: [] });
        renderGroupsList();
        return;
      }
      var presetBtn = e.target.closest('[data-action="add-preset-group"]');
      if (presetBtn) {
        // 자주 쓰는 옵션은 이름/선택방식/필수여부가 채워진 채로 바로 만들어, 손님이 빈 칸부터 채우지 않아도 되게 한다
        var presetDefs = {
          size: { name: '사이즈', required: true, multiSelect: false },
          topping: { name: '토핑', required: false, multiSelect: true },
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
        state.optionGroups[giAdd].options.push({ name: '', price: 0 });
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
      var reqBtn = e.target.closest('[data-action="toggle-required"]');
      if (reqBtn) {
        var giReq = Number(reqBtn.getAttribute('data-group-idx'));
        state.optionGroups[giReq].required = !state.optionGroups[giReq].required;
        renderGroupsList();
        return;
      }
      var singleBtn = e.target.closest('[data-action="set-select-single"]');
      if (singleBtn) {
        state.optionGroups[Number(singleBtn.getAttribute('data-group-idx'))].multiSelect = false;
        renderGroupsList();
        return;
      }
      var multiBtn = e.target.closest('[data-action="set-select-multi"]');
      if (multiBtn) {
        state.optionGroups[Number(multiBtn.getAttribute('data-group-idx'))].multiSelect = true;
        renderGroupsList();
        return;
      }
      var triBtn = e.target.closest('[data-action="set-option-tri"]');
      if (triBtn) {
        var giTri = Number(triBtn.getAttribute('data-group-idx'));
        var oiTri = Number(triBtn.getAttribute('data-opt-idx'));
        var triVal = triBtn.getAttribute('data-value');
        var triOpt = state.optionGroups[giTri].options[oiTri];
        if (triVal === 'available') { triOpt.soldOut = false; triOpt.exposed = true; }
        else if (triVal === 'soldout') { triOpt.soldOut = true; triOpt.exposed = true; }
        else { triOpt.exposed = false; }
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
  }

  window.Router.register('menuEdit', { render: renderMenuEdit, mount: mountMenuEdit, unmount: function () {} });
})();
