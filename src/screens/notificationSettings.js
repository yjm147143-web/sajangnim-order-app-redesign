/*
 * 알림 설정 화면 (설정 > 알림 설정) — 기존에 설정 메인 화면에 있던 알림 관련 항목을
 * 별도 카테고리 화면으로 분리했다.
 * - 알림 켜기/끄기, 알림음 크기, 알림음 종류, 반복 횟수(1~10, +/- 스테퍼)를 관리한다.
 */
(function () {
  function currentStoreId() {
    return window.MockApi.getContextStoreId();
  }

  var SOUND_TYPES = [
    { v: 'default', label: '기본음' },
    { v: 'bell', label: '청량한 벨' },
    { v: 'cheerful', label: '경쾌한 알림' },
  ];

  function contentHtml(store) {
    var notificationOn = store.notificationEnabled !== false;
    var volume = store.notificationVolume != null ? store.notificationVolume : 70;
    var soundType = store.notificationSoundType || 'default';
    var repeatCount = store.notificationRepeatCount != null ? store.notificationRepeatCount : 1;
    return (
      '<div class="settings-list-item no-toggle-click">' +
        '<div class="icon">🔔</div>' +
        '<div class="label-group">' +
          '<div class="label">알림 설정</div>' +
          '<div class="label-sub">' + (notificationOn ? '소리 · 푸시 · 진동으로 새 주문을 알려드려요' : '소리 · 푸시 알림이 꺼져 있어요') + '</div>' +
        '</div>' +
        '<button type="button" class="toggle' + (notificationOn ? ' on' : '') + '" id="notification-toggle"><span class="toggle-knob"></span></button>' +
      '</div>' +
      '<div class="notification-volume-row' + (notificationOn ? '' : ' disabled') + '">' +
        '<span class="notification-volume-label">알림음 크기</span>' +
        '<input type="range" min="0" max="100" step="5" value="' + volume + '" id="notification-volume-slider"' + (notificationOn ? '' : ' disabled') + ' />' +
        '<span class="notification-volume-value" id="notification-volume-value">' + volume + '</span>' +
        '<button type="button" class="pill-btn" id="notification-preview-btn"' + (notificationOn ? '' : ' disabled') + '>🔊</button>' +
      '</div>' +
      '<div class="notification-volume-hint">' + (notificationOn && volume === 0 ? '소리 크기가 0이라 진동으로만 알려드려요' : '') + '</div>' +
      '<div class="notification-sub-row' + (notificationOn ? '' : ' disabled') + '">' +
        '<span class="notification-volume-label">알림음 종류</span>' +
        '<div class="notification-chip-row">' +
          SOUND_TYPES.map(function (s) {
            return '<button type="button" class="pill-btn' + (soundType === s.v ? ' active' : '') + '" data-action="set-sound-type" data-value="' + s.v + '"' + (notificationOn ? '' : ' disabled') + '>' + s.label + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="notification-repeat-row' + (notificationOn ? '' : ' disabled') + '">' +
        '<span class="notification-volume-label">반복 횟수</span>' +
        '<div class="repeat-stepper">' +
          '<button type="button" class="stepper-btn" id="repeat-minus" aria-label="감소"' + (notificationOn && repeatCount > 1 ? '' : ' disabled') + '>–</button>' +
          '<div class="stepper-value"><span id="repeat-value">' + repeatCount + '</span><span class="unit">회</span></div>' +
          '<button type="button" class="stepper-btn" id="repeat-plus" aria-label="증가"' + (notificationOn && repeatCount < 10 ? '' : ' disabled') + '>+</button>' +
        '</div>' +
      '</div>'
    );
  }

  function render() {
    return (
      '<style>' +
        '.notification-volume-row{display:flex;align-items:center;gap:10px;padding:0 var(--space-5) var(--space-3) 48px;}' +
        '.notification-volume-row.disabled{opacity:0.45;pointer-events:none;}' +
        '.notification-volume-label{font-size:var(--font-size-caption);color:var(--color-text-secondary);font-weight:600;flex-shrink:0;white-space:nowrap;}' +
        '.notification-volume-row input[type=range]{flex:1;accent-color:var(--color-text-primary);}' +
        '.notification-volume-value{font-size:var(--font-size-caption);font-weight:700;width:28px;text-align:right;flex-shrink:0;}' +
        '.notification-volume-row .pill-btn{flex-shrink:0;}' +
        '.notification-volume-hint{font-size:var(--font-size-micro);color:var(--color-text-secondary);padding:0 var(--space-5) var(--space-3) 48px;}' +
        '.notification-sub-row{display:flex;align-items:center;gap:10px;padding:0 var(--space-5) var(--space-3) 48px;flex-wrap:wrap;}' +
        '.notification-sub-row.disabled{opacity:0.45;pointer-events:none;}' +
        '.notification-chip-row{display:flex;gap:6px;flex-wrap:wrap;}' +
        '.notification-chip-row .pill-btn.active{background:var(--color-accent-blue);color:var(--color-white);}' +
        '.notification-repeat-row{display:flex;align-items:center;gap:14px;padding:var(--space-2) var(--space-5) var(--space-4) 48px;}' +
        '.notification-repeat-row.disabled{opacity:0.45;pointer-events:none;}' +
        '.repeat-stepper{display:flex;align-items:center;gap:12px;}' +
        '.repeat-stepper .stepper-btn{width:36px;height:36px;border-radius:10px;border:1.5px solid var(--color-disabled);background:var(--color-white);' +
          'font-size:18px;font-weight:700;color:var(--color-text-primary);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}' +
        '.repeat-stepper .stepper-btn:active{background:var(--color-divider);}' +
        '.repeat-stepper .stepper-btn:disabled{opacity:0.4;cursor:not-allowed;}' +
        '.repeat-stepper .stepper-value{min-width:40px;text-align:center;font-size:16px;font-weight:800;}' +
        '.repeat-stepper .stepper-value .unit{font-size:12px;font-weight:600;color:var(--color-text-secondary);margin-left:2px;}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="ns-back" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">알림 설정</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll"><div id="ns-content"></div></div>'
    );
  }

  function mount(root) {
    var storeId = currentStoreId();

    function refresh() {
      var store = window.MockApi.getStore(storeId);
      root.querySelector('#ns-content').innerHTML = contentHtml(store);
      bindEvents();
    }

    function bindEvents() {
      var notificationToggle = root.querySelector('#notification-toggle');
      if (notificationToggle) {
        notificationToggle.addEventListener('click', function () {
          var store = window.MockApi.getStore(storeId);
          var next = !(store.notificationEnabled !== false);
          window.MockApi.updateNotificationSettings(storeId, { enabled: next });
          window.UI.toast(next ? '알림을 켰어요' : '알림을 껐어요');
          refresh();
        });
      }

      var volumeSlider = root.querySelector('#notification-volume-slider');
      var volumeValue = root.querySelector('#notification-volume-value');
      if (volumeSlider) {
        volumeSlider.addEventListener('input', function () {
          if (volumeValue) volumeValue.textContent = volumeSlider.value;
        });
        volumeSlider.addEventListener('change', function () {
          var vol = Number(volumeSlider.value);
          window.MockApi.updateNotificationSettings(storeId, { volume: vol });
          window.UI.playNotificationPreview(vol);
          refresh();
        });
      }
      var previewBtn = root.querySelector('#notification-preview-btn');
      if (previewBtn) {
        previewBtn.addEventListener('click', function () {
          var vol = volumeSlider ? Number(volumeSlider.value) : 0;
          window.UI.playNotificationPreview(vol);
        });
      }

      root.querySelectorAll('[data-action="set-sound-type"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          window.MockApi.updateNotificationSettings(storeId, { soundType: btn.getAttribute('data-value') });
          refresh();
        });
      });

      var minusBtn = root.querySelector('#repeat-minus');
      var plusBtn = root.querySelector('#repeat-plus');
      if (minusBtn) {
        minusBtn.addEventListener('click', function () {
          var store = window.MockApi.getStore(storeId);
          var current = store.notificationRepeatCount != null ? store.notificationRepeatCount : 1;
          var next = Math.max(1, current - 1);
          window.MockApi.updateNotificationSettings(storeId, { repeatCount: next });
          refresh();
        });
      }
      if (plusBtn) {
        plusBtn.addEventListener('click', function () {
          var store = window.MockApi.getStore(storeId);
          var current = store.notificationRepeatCount != null ? store.notificationRepeatCount : 1;
          var next = Math.min(10, current + 1);
          window.MockApi.updateNotificationSettings(storeId, { repeatCount: next });
          refresh();
        });
      }
    }

    root.querySelector('#ns-back').addEventListener('click', function () {
      window.Router.back();
    });

    refresh();
  }

  function unmount() {}

  window.Router.register('notificationSettings', { render: render, mount: mount, unmount: unmount });
})();
