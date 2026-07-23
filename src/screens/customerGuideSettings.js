/*
 * 고객 대기 관리 화면 (구 '손님 안내 설정', 그 이전엔 '예상 대기시간 관리')
 * - 기능 전체 사용 여부 토글 (OFF면 손님 화면에 대기 안내를 보여주지 않음)
 * - 표시 모드 선택: 예상 시간 / 대기 주문 수
 * - (예상 시간 모드) 기준 조리 시간 / 조리 인원 / 안전 여유 설정
 * - 손님 화면 미리보기 (실시간 갱신)
 *
 * 계산 로직은 첨부된 목업(조리시간-예상-목업.html)의 incTime/staffCount/calcExample을 그대로 이식.
 */
(function () {
  function stepperRowHtml(id, value, unit, min) {
    return (
      '<div class="stepper-row" data-min="' + min + '">' +
        '<button type="button" class="stepper-btn" data-stepper-minus="' + id + '" aria-label="감소">–</button>' +
        '<div class="stepper-value"><span id="val-' + id + '">' + value + '</span><span class="unit">' + unit + '</span></div>' +
        '<button type="button" class="stepper-btn" data-stepper-plus="' + id + '" aria-label="증가">+</button>' +
      '</div>'
    );
  }

  function incTime(cfg, existing, add) {
    var cost = 0;
    for (var k = 1; k <= add; k++) {
      var pos = existing + k;
      if ((pos - 1) % Math.max(1, cfg.batch) === 0) cost += cfg.base; else cost += cfg.marginal;
    }
    return cost;
  }

  function staffCountOf(state) { return state.hasHelper ? 1 + state.helperCount : 1; }

  function calcExample(state) {
    var cfg = { base: state.cookTimeBase, marginal: state.cookTimeMarginal, batch: state.cookTimeBatch };
    var qty = state.exQty;
    var t = incTime(cfg, 0, qty);
    var staff = staffCountOf(state);
    var cook = Math.round(Math.max(Math.min(cfg.base, t), t / staff));
    var batches = Math.ceil(qty / Math.max(1, cfg.batch));
    var rule = batches <= 1 ? '한 판에 다 만들어요' : batches + '판에 나눠 만들어요';
    return { rule: rule, cook: cook, buffer: state.bufferMinutes, low: cook, high: cook + state.bufferMinutes };
  }

  function render() {
    return (
      '<style>' +
        '.settings-list-item.no-toggle-click{cursor:default;flex-wrap:wrap;row-gap:8px;}' +
        '.settings-list-item.no-toggle-click:active{background:transparent;}' +
        '.settings-list-item .label-group{display:flex;flex-direction:column;gap:4px;flex:0 1 auto;min-width:0;}' +
        '.settings-list-item .label-group .label{flex:none;}' +
        '.settings-list-item .label-sub{font-size:var(--font-size-caption);color:var(--color-text-secondary);font-weight:500;}' +
        '.stepper-row{display:flex;align-items:center;justify-content:space-between;gap:12px;}' +
        '.stepper-btn{width:44px;height:44px;border-radius:12px;border:1.5px solid var(--color-disabled);background:var(--color-white);' +
          'font-size:22px;font-weight:700;color:var(--color-text-primary);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}' +
        '.stepper-btn:active{background:var(--color-divider);}' +
        '.stepper-value{flex:1;text-align:center;font-size:20px;font-weight:800;}' +
        '.stepper-value .unit{font-size:14px;font-weight:600;color:var(--color-text-secondary);margin-left:4px;}' +
        '.cg-field{padding:0 var(--space-5) var(--space-4);}' +
        '.cg-field-title{font-size:var(--font-size-body);font-weight:700;display:block;margin-bottom:2px;}' +
        '.cg-field-desc{font-size:var(--font-size-caption);color:var(--color-text-secondary);display:block;margin-bottom:10px;}' +
        '.info-memo{font-size:var(--font-size-caption);color:var(--color-text-secondary);background:var(--color-divider);' +
          'border-left:3px solid var(--color-text-primary);border-radius:0 10px 10px 0;padding:10px 12px;line-height:1.55;margin:0 var(--space-5) var(--space-4);}' +
        '.info-memo b{color:var(--color-text-primary);}' +
        '.mode-select{display:flex;gap:8px;background:var(--color-divider);padding:6px;border-radius:16px;margin:0 var(--space-5) var(--space-2);}' +
        '.mode-select-btn{flex:1;border:none;background:transparent;border-radius:12px;padding:14px 8px;' +
          'display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;}' +
        '.mode-select-btn.on{background:var(--color-white);box-shadow:0 1px 4px rgba(0,0,0,.08);}' +
        '.mode-select-btn .m-title{font-size:var(--font-size-body);font-weight:800;color:var(--color-text-secondary);}' +
        '.mode-select-btn.on .m-title{color:var(--color-text-primary);}' +
        '.mode-select-btn .m-sub{font-size:var(--font-size-micro);color:var(--color-text-secondary);}' +
        '.choice-pair{display:flex;gap:8px;padding:0 var(--space-5) var(--space-4);}' +
        '.choice-pair button{flex:1;padding:14px 8px;border:1.5px solid var(--color-disabled);border-radius:var(--radius-button);' +
          'background:var(--color-white);font-size:var(--font-size-body);font-weight:700;color:var(--color-text-secondary);cursor:pointer;}' +
        '.choice-pair button.on{border-color:var(--color-text-primary);background:var(--color-text-primary);color:var(--color-white);}' +
        '.cg-note{font-size:var(--font-size-caption);color:var(--color-text-secondary);text-align:center;padding:0 var(--space-5) var(--space-4);}' +
        '.cg-note b{color:var(--color-text-primary);}' +
        '.cg-hidden{display:none;}' +
        '.auto-note{font-size:var(--font-size-caption);color:var(--color-text-secondary);background:var(--color-divider);' +
          'border-radius:12px;padding:12px 14px;line-height:1.55;margin:0 var(--space-5) var(--space-4);}' +
        '.auto-note b{color:var(--color-text-primary);}' +
        '.preview-phone{background:var(--color-white);border-radius:var(--radius-card);padding:var(--space-6) var(--space-5);text-align:center;}' +
        '.preview-phone .store-name{font-size:var(--font-size-caption);color:var(--color-text-secondary);}' +
        '.preview-phone .menu-summary{font-size:var(--font-size-subtitle);font-weight:800;margin:2px 0 var(--space-5);}' +
        '.preview-big-time{font-size:40px;font-weight:900;color:var(--color-accent-blue);letter-spacing:-1px;}' +
        '.preview-big-time .unit{font-size:20px;font-weight:800;}' +
        '.preview-est-label{font-size:var(--font-size-body);color:var(--color-text-secondary);margin-top:2px;}' +
        '.preview-progress{height:8px;background:var(--color-divider);border-radius:4px;margin:var(--space-5) 0 6px;overflow:hidden;}' +
        '.preview-progress span{display:block;height:100%;width:35%;background:var(--color-accent-blue);border-radius:4px;}' +
        '.preview-steps{display:flex;justify-content:space-between;font-size:var(--font-size-micro);color:var(--color-text-secondary);}' +
        '.breakdown-box{background:var(--color-divider);border-radius:var(--radius-card);padding:var(--space-4);margin-top:var(--space-4);' +
          'font-size:var(--font-size-caption);color:var(--color-text-secondary);}' +
        '.breakdown-row{display:flex;justify-content:space-between;padding:3px 0;}' +
        '.breakdown-row.total{border-top:1px solid var(--color-disabled);margin-top:4px;padding-top:6px;font-weight:800;color:var(--color-text-primary);}' +
        '.exqty-wrap{padding:0 var(--space-5) var(--space-4);}' +
        '.exqty-input{width:64px;text-align:center;font-size:20px;font-weight:800;border:none;border-bottom:2px solid var(--color-text-primary);' +
          'background:transparent;-moz-appearance:textfield;}' +
        '.exqty-input::-webkit-outer-spin-button,.exqty-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="cg-back-btn" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">고객 대기 관리</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll">' +

        '<div class="settings-list-item no-toggle-click">' +
          '<div class="icon">⏱️</div>' +
          '<div class="label-group">' +
            '<div class="label">고객 대기 관리 사용</div>' +
            '<div class="label-sub" id="cg-enabled-sub">-</div>' +
          '</div>' +
          '<button type="button" class="toggle" id="cg-enabled-toggle"><span class="toggle-knob"></span></button>' +
        '</div>' +

        '<div class="divider-line"></div>' +

        '<div id="cg-body-wrap">' +

        '<div class="section-title">손님에게 무엇을 보여줄까요?</div>' +
        '<div class="mode-select" id="mode-select">' +
          '<button type="button" class="mode-select-btn" data-mode="time">' +
            '<span class="m-title">예상 시간</span><span class="m-sub" id="mode-time-sub">-</span>' +
          '</button>' +
          '<button type="button" class="mode-select-btn" data-mode="queue">' +
            '<span class="m-title">대기 주문 수</span><span class="m-sub">현재 조리중인 주문 건수</span>' +
          '</button>' +
        '</div>' +

        '<div class="divider-line"></div>' +

        '<div id="cook-settings-wrap">' +

          '<div class="section-title">얼마나 걸리나요?</div>' +
          '<div class="cg-note" style="text-align:left;padding-top:0;">메뉴 <b>평균</b>으로 맞춰주세요.</div>' +
          '<div class="cg-field">' +
            '<span class="cg-field-title">1개 만들 때</span>' +
            '<span class="cg-field-desc">처음 한 개를 만들 때 걸리는 시간이에요.</span>' +
            stepperRowHtml('base', 0, '분', 0) +
          '</div>' +
          '<div class="info-memo">💡 이 시간은 <b>지금 조리 중인 주문이 없을 때</b> 손님에게 보이는 기준이에요. 영업 중에도 앞선 주문이 없으면 이 시간으로 안내돼요.</div>' +
          '<div class="cg-field">' +
            '<span class="cg-field-title">1개 더 늘어날 때</span>' +
            '<span class="cg-field-desc">주문이 하나 더 늘어날 때 더 걸리는 시간이에요.</span>' +
            stepperRowHtml('marginal', 0, '분', 0) +
          '</div>' +
          '<div class="cg-field">' +
            '<span class="cg-field-title">한 번에 만드는 개수</span>' +
            '<span class="cg-field-desc">조리대에 한 번에 올릴 수 있는 양이에요. 넘으면 시간이 더 늘어나요.</span>' +
            stepperRowHtml('batch', 0, '개', 1) +
          '</div>' +

          '<div class="divider-line"></div>' +

          '<div class="section-title">같이 만드는 사람이 있나요?</div>' +
          '<div class="cg-note" style="text-align:left;">함께 만들면 시간이 줄어들어요. 잠깐 돕는 정도면 0.5명으로 넣어주세요.</div>' +
          '<div class="choice-pair" id="helper-choice">' +
            '<button type="button" data-helper="solo">혼자 해요</button>' +
            '<button type="button" data-helper="together">같이 해요</button>' +
          '</div>' +
          '<div class="cg-field cg-hidden" id="helper-count-field">' +
            '<span class="cg-field-title">도와주는 사람 수</span>' +
            stepperRowHtml('helper', 0, '명', 0.5) +
          '</div>' +
          '<div class="cg-note" id="helper-note"></div>' +

          '<div class="divider-line"></div>' +

          '<div class="section-title">얼마나 넉넉하게 보여줄까요?</div>' +
          '<div class="cg-note" style="text-align:left;">계산된 시간보다 <b>조금 넉넉하게</b> 보여줘요. 예상보다 빨리 나오면 손님이 더 만족해요.</div>' +
          '<div class="cg-field">' +
            '<span class="cg-field-title">더할 여유 시간</span>' +
            stepperRowHtml('buffer', 0, '분', 0) +
          '</div>' +

          '<div class="divider-line"></div>' +
        '</div>' +

        '<div class="section-title">손님에게 이렇게 보여요</div>' +
        '<div class="auto-note" id="auto-note"></div>' +

        '<div id="preview-time-wrap">' +
          '<div class="exqty-wrap">' +
            '<span class="cg-field-title">메뉴를 몇 개 주문하면?</span>' +
            '<div class="stepper-row" style="margin-top:8px;">' +
              '<button type="button" class="stepper-btn" data-stepper-minus="exqty" aria-label="감소">–</button>' +
              '<div class="stepper-value"><input type="number" min="1" id="exqty-input" class="exqty-input" value="1" /><span class="unit">개</span></div>' +
              '<button type="button" class="stepper-btn" data-stepper-plus="exqty" aria-label="증가">+</button>' +
            '</div>' +
          '</div>' +
          '<div style="padding:0 var(--space-5) var(--space-6);">' +
            '<div class="preview-phone">' +
              '<div class="store-name" id="preview-store-name"></div>' +
              '<div class="menu-summary" id="preview-summary">-</div>' +
              '<div class="preview-big-time"><span id="preview-low">0</span><span id="preview-tilde">~</span><span id="preview-high">0</span><span class="unit">분</span></div>' +
              '<div class="preview-est-label">예상 시간</div>' +
              '<div class="preview-progress"><span></span></div>' +
              '<div class="preview-steps"><span>접수완료</span><span>조리중</span><span>준비완료</span></div>' +
            '</div>' +
            '<div class="breakdown-box">' +
              '<div class="breakdown-row"><span id="bd-rule">-</span><span></span></div>' +
              '<div class="breakdown-row"><span>조리 시간</span><span id="bd-cook">0분</span></div>' +
              '<div class="breakdown-row"><span>여유 시간</span><span id="bd-buffer">+0분</span></div>' +
              '<div class="breakdown-row total"><span>손님에게 보여요</span><span id="bd-total">0분</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div id="preview-queue-wrap" class="cg-hidden" style="padding:0 var(--space-5) var(--space-6);">' +
          '<div class="preview-phone">' +
            '<div class="store-name" id="preview-store-name-queue"></div>' +
            '<div class="menu-summary">주문 순서대로 준비하고 있어요</div>' +
            '<div class="preview-big-time"><span>3</span><span class="unit">건</span></div>' +
            '<div class="preview-est-label">현재 조리 중인 주문</div>' +
            '<div class="preview-progress"><span></span></div>' +
            '<div class="preview-steps"><span>주문 접수</span><span>조리 중</span><span>준비 완료</span></div>' +
          '</div>' +
        '</div>' +

        '</div>' +

      '</div>' +
      '<div class="cta-fixed"><button type="button" class="btn btn-primary" id="cg-save-btn">저장</button></div>'
    );
  }

  function mount(root) {
    var user = window.MockApi.getCurrentUser();
    var storeId = user.storeId;
    var store = window.MockApi.getStore(storeId);
    var settings = window.MockApi.getCustomerGuideSettings(storeId);

    var state = {
      enabled: settings.enabled,
      displayMode: settings.displayMode,
      cookTimeBase: settings.cookTimeBase,
      cookTimeMarginal: settings.cookTimeMarginal,
      cookTimeBatch: settings.cookTimeBatch,
      hasHelper: settings.hasHelper,
      helperCount: settings.helperCount,
      bufferMinutes: settings.bufferMinutes,
      exQty: 1,
    };

    // 예상 시간/대기 주문 수 2개 탭 공통 "저장" 버튼을 눌러야 값이 실제로 저장된다 (그 전까지는 화면 내 미리보기만 갱신)
    function saveAll() {
      window.MockApi.updateCustomerGuideSettings(storeId, {
        enabled: state.enabled,
        displayMode: state.displayMode,
        cookTimeBase: state.cookTimeBase,
        cookTimeMarginal: state.cookTimeMarginal,
        cookTimeBatch: state.cookTimeBatch,
        hasHelper: state.hasHelper,
        helperCount: state.helperCount,
        bufferMinutes: state.bufferMinutes,
      });
      window.UI.toast('저장했어요');
    }

    // ---------- 사용 여부 ----------
    function renderEnabled() {
      root.querySelector('#cg-enabled-toggle').classList.toggle('on', state.enabled);
      root.querySelector('#cg-enabled-sub').textContent = state.enabled
        ? '손님 화면에 대기 안내를 보여줘요'
        : '손님 화면에 대기 안내를 보여주지 않아요';
      root.querySelector('#cg-body-wrap').classList.toggle('cg-hidden', !state.enabled);
    }

    // ---------- 모드 ----------
    function renderMode() {
      root.querySelectorAll('#mode-select .mode-select-btn').forEach(function (btn) {
        btn.classList.toggle('on', btn.getAttribute('data-mode') === state.displayMode);
      });
      var isTime = state.displayMode === 'time';
      root.querySelector('#cook-settings-wrap').classList.toggle('cg-hidden', !isTime);
      root.querySelector('#preview-time-wrap').classList.toggle('cg-hidden', !isTime);
      root.querySelector('#preview-queue-wrap').classList.toggle('cg-hidden', isTime);
      root.querySelector('#auto-note').innerHTML = isTime
        ? '실제 시간은 주문이 들어올 때 <b>지금 만들고 있는 주문을 함께 계산</b>해서 보여줘요. 아래는 <b>미리보기</b>예요.'
        : '손님에게 <b>지금 조리 중인 주문 수</b>를 그대로 보여줘요. 따로 설정할 게 없어요. 아래는 <b>미리보기</b>예요.';
      root.querySelector('#preview-store-name').textContent = store.name;
      root.querySelector('#preview-store-name-queue').textContent = store.name;
    }

    // ---------- 기준 시간 ----------
    function renderCookFields() {
      root.querySelector('#val-base').textContent = state.cookTimeBase;
      root.querySelector('#val-marginal').textContent = state.cookTimeMarginal;
      root.querySelector('#val-batch').textContent = state.cookTimeBatch;
      var firstTime = incTime({ base: state.cookTimeBase, marginal: state.cookTimeMarginal, batch: state.cookTimeBatch }, 0, 1);
      var firstCook = Math.round(Math.max(Math.min(state.cookTimeBase, firstTime), firstTime / staffCountOf(state)));
      var firstHigh = firstCook + state.bufferMinutes;
      root.querySelector('#mode-time-sub').textContent = (firstCook === firstHigh) ? (firstCook + '분') : (firstCook + '~' + firstHigh + '분');
    }

    // ---------- 조리 인원 ----------
    function renderHelper() {
      root.querySelectorAll('#helper-choice button').forEach(function (btn) {
        var isTogether = btn.getAttribute('data-helper') === 'together';
        btn.classList.toggle('on', state.hasHelper === isTogether);
      });
      root.querySelector('#helper-count-field').classList.toggle('cg-hidden', !state.hasHelper);
      root.querySelector('#val-helper').textContent = state.helperCount;
      var total = staffCountOf(state);
      var totalTxt = (Number.isInteger(total) ? total : total.toFixed(1)) + '명';
      root.querySelector('#helper-note').innerHTML = state.hasHelper
        ? '총 <b>' + totalTxt + '</b>이 함께 만드는 것으로 계산해요'
        : '<b>혼자</b> 만드는 것으로 계산해요';
    }

    // ---------- 안전 여유 ----------
    function renderBuffer() {
      root.querySelector('#val-buffer').textContent = state.bufferMinutes;
    }

    // ---------- 미리보기 (예상 시간 모드) ----------
    function renderPreview() {
      root.querySelector('#exqty-input').value = state.exQty;
      var r = calcExample(state);
      root.querySelector('#preview-summary').textContent = '메뉴 ' + state.exQty + '개';
      var same = r.low === r.high;
      root.querySelector('#preview-low').textContent = r.low;
      root.querySelector('#preview-high').textContent = r.high;
      root.querySelector('#preview-high').style.display = same ? 'none' : '';
      root.querySelector('#preview-tilde').style.display = same ? 'none' : '';
      root.querySelector('#bd-rule').textContent = r.rule;
      root.querySelector('#bd-cook').textContent = r.cook + '분';
      root.querySelector('#bd-buffer').textContent = '+' + r.buffer + '분';
      root.querySelector('#bd-total').textContent = same ? (r.low + '분') : (r.low + '~' + r.high + '분');
    }

    function renderAll() {
      renderEnabled();
      renderMode();
      renderCookFields();
      renderHelper();
      renderBuffer();
      renderPreview();
    }

    // ---------- 이벤트 바인딩 ----------
    root.querySelector('#cg-back-btn').addEventListener('click', function () {
      window.Router.back();
    });

    root.querySelector('#cg-enabled-toggle').addEventListener('click', function () {
      state.enabled = !state.enabled;
      renderEnabled();
    });

    root.querySelectorAll('#mode-select .mode-select-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.displayMode = btn.getAttribute('data-mode');
        renderMode();
        renderCookFields();
      });
    });

    root.querySelector('[data-stepper-minus="base"]').addEventListener('click', function () {
      state.cookTimeBase = Math.max(0, state.cookTimeBase - 1);
      renderCookFields(); renderPreview();
    });
    root.querySelector('[data-stepper-plus="base"]').addEventListener('click', function () {
      state.cookTimeBase = state.cookTimeBase + 1;
      renderCookFields(); renderPreview();
    });
    root.querySelector('[data-stepper-minus="marginal"]').addEventListener('click', function () {
      state.cookTimeMarginal = Math.max(0, state.cookTimeMarginal - 1);
      renderCookFields(); renderPreview();
    });
    root.querySelector('[data-stepper-plus="marginal"]').addEventListener('click', function () {
      state.cookTimeMarginal = state.cookTimeMarginal + 1;
      renderCookFields(); renderPreview();
    });
    root.querySelector('[data-stepper-minus="batch"]').addEventListener('click', function () {
      state.cookTimeBatch = Math.max(1, state.cookTimeBatch - 1);
      renderCookFields(); renderPreview();
    });
    root.querySelector('[data-stepper-plus="batch"]').addEventListener('click', function () {
      state.cookTimeBatch = state.cookTimeBatch + 1;
      renderCookFields(); renderPreview();
    });

    root.querySelectorAll('#helper-choice button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var together = btn.getAttribute('data-helper') === 'together';
        state.hasHelper = together;
        if (together && state.helperCount < 0.5) state.helperCount = 0.5;
        renderHelper(); renderCookFields(); renderPreview();
      });
    });
    root.querySelector('[data-stepper-minus="helper"]').addEventListener('click', function () {
      state.helperCount = Math.max(0.5, Math.round((state.helperCount - 0.5) * 2) / 2);
      renderHelper(); renderCookFields(); renderPreview();
    });
    root.querySelector('[data-stepper-plus="helper"]').addEventListener('click', function () {
      state.helperCount = Math.round((state.helperCount + 0.5) * 2) / 2;
      renderHelper(); renderCookFields(); renderPreview();
    });

    root.querySelector('[data-stepper-minus="buffer"]').addEventListener('click', function () {
      state.bufferMinutes = Math.max(0, state.bufferMinutes - 1);
      renderBuffer(); renderCookFields(); renderPreview();
    });
    root.querySelector('[data-stepper-plus="buffer"]').addEventListener('click', function () {
      state.bufferMinutes = state.bufferMinutes + 1;
      renderBuffer(); renderCookFields(); renderPreview();
    });

    root.querySelector('#cg-save-btn').addEventListener('click', saveAll);

    root.querySelector('[data-stepper-minus="exqty"]').addEventListener('click', function () {
      state.exQty = Math.max(1, state.exQty - 1); renderPreview();
    });
    root.querySelector('[data-stepper-plus="exqty"]').addEventListener('click', function () {
      state.exQty = state.exQty + 1; renderPreview();
    });
    root.querySelector('#exqty-input').addEventListener('change', function (e) {
      state.exQty = Math.max(1, parseInt(e.target.value, 10) || 1); renderPreview();
    });

    renderAll();
  }

  function unmount() {}

  window.Router.register('customerGuideSettings', { render: render, mount: mount, unmount: unmount });
})();
