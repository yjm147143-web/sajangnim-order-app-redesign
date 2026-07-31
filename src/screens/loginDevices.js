/*
 * 로그인 기기 관리 화면 (설정 > 환경설정 > 로그인 기기 관리)
 * - 이 계정으로 로그인해 둔 기기를 '현재 기기'와 '다른 기기'로 나눠 보여준다.
 * - 다른 기기는 로그아웃시킬 수 있다. 현재 기기는 여기서 내보내지 않는다 —
 *   스스로 로그아웃하는 건 설정 > 로그아웃의 일이고, 이 화면에서 섞이면
 *   '어느 기기를 끊는지' 판단이 흐려진다.
 * - 화면 진입은 권한 잠금(loginDevices)으로 보호된다(게이트는 settings.js의 GATED_NAV에 있다).
 */
(function () {
  function esc(s) { return window.UI.escapeHtml(s); }

  function currentStoreId() {
    return window.MockApi.getContextStoreId();
  }

  var STYLE = '' +
    '.ld-summary{display:flex;align-items:center;gap:var(--space-3);' +
      'margin:var(--space-3) var(--space-5) var(--space-4);padding:var(--space-4);' +
      'background:var(--color-white);border-radius:var(--radius-card);box-shadow:var(--shadow-card);}' +
    '.ld-summary-icon{width:38px;height:38px;border-radius:12px;background:var(--color-card-bg);' +
      'display:flex;align-items:center;justify-content:center;color:var(--color-text-secondary);flex-shrink:0;}' +
    '.ld-summary-body{flex:1;min-width:0;}' +
    '.ld-summary-label{font-size:var(--font-size-micro);font-weight:700;color:var(--color-text-secondary);}' +
    // 기기 수는 이 화면의 핵심 숫자라 매출 카드처럼 크게 세운다
    '.ld-summary-count{margin-top:3px;font-size:var(--font-size-subtitle);font-weight:800;' +
      'font-variant-numeric:tabular-nums;line-height:1.25;}' +
    '.ld-summary-sub{margin-top:3px;font-size:var(--font-size-micro);font-weight:600;color:var(--color-text-secondary);}' +
    // 기기 행: 좌측 아이콘 / 가운데 이름·부가정보 / 우측 배지 또는 버튼
    '.ld-row{display:flex;align-items:center;gap:var(--space-3);padding:14px var(--space-5);' +
      'border-bottom:1px solid var(--color-divider);}' +
    '.ld-row:last-child{border-bottom:none;}' +
    '.ld-row-icon{width:28px;height:28px;flex-shrink:0;display:flex;align-items:center;' +
      'justify-content:center;color:var(--color-text-secondary);}' +
    '.ld-row-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}' +
    '.ld-row-name{font-size:var(--font-size-body);font-weight:700;overflow:hidden;' +
      'text-overflow:ellipsis;white-space:nowrap;}' +
    '.ld-row-meta{font-size:var(--font-size-micro);color:var(--color-text-secondary);font-weight:500;}' +
    // 로그인 시각은 자리수가 고정된 형식(yy.mm.dd hh:mm:ss)이라 tabular-nums로 세로줄을 맞춘다
    '.ld-row-time{font-size:var(--font-size-micro);color:var(--color-text-secondary);' +
      'font-weight:600;font-variant-numeric:tabular-nums;}' +
    '.ld-row-time strong{font-weight:800;color:var(--color-text-primary);}' +
    '.ld-row-action{flex-shrink:0;}' +
    '.ld-note{font-size:var(--font-size-caption);color:var(--color-text-secondary);' +
      'background:var(--color-divider);border-left:3px solid var(--color-text-primary);' +
      'border-radius:0 10px 10px 0;padding:10px 12px;line-height:1.55;' +
      'margin:var(--space-3) var(--space-5) var(--space-5);}';

  var DEVICE_ICONS = { TABLET: 'tablet', PHONE: 'phone', PC: 'monitor' };
  var DEVICE_TYPE_LABELS = { TABLET: '태블릿', PHONE: '휴대폰', PC: 'PC' };

  function deviceIconName(type) { return DEVICE_ICONS[type] || 'tablet'; }
  function deviceTypeLabel(type) { return DEVICE_TYPE_LABELS[type] || '기기'; }

  // 명세 형식: yy.mm.dd hh:mm:ss
  function loginTimeLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '-';
    function p(n) { return String(n).padStart(2, '0'); }
    return p(d.getFullYear() % 100) + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function deviceRowHtml(device) {
    var metaParts = [deviceTypeLabel(device.deviceType)];
    if (device.osLabel) metaParts.push(device.osLabel);
    if (device.location) metaParts.push(device.location);
    return (
      '<div class="ld-row" data-device-id="' + esc(device.id) + '">' +
        '<div class="ld-row-icon">' + window.Icons3D.iconLine(deviceIconName(device.deviceType), 22) + '</div>' +
        '<div class="ld-row-body">' +
          '<div class="ld-row-name">' + esc(device.name) + '</div>' +
          '<div class="ld-row-meta">' + esc(metaParts.join(' · ')) + '</div>' +
          '<div class="ld-row-time">최근 로그인 <strong>' + loginTimeLabel(device.lastLoginAt) + '</strong></div>' +
        '</div>' +
        '<div class="ld-row-action">' +
          (device.isCurrent
            ? '<span class="badge badge-success-soft">현재 기기</span>'
            : '<button type="button" class="btn btn-outline btn-sm" data-action="logout-device">로그아웃</button>') +
        '</div>' +
      '</div>'
    );
  }

  function contentHtml(devices) {
    var others = devices.filter(function (d) { return !d.isCurrent; });
    var current = devices.filter(function (d) { return d.isCurrent; });

    var html =
      '<div class="ld-summary">' +
        '<div class="ld-summary-icon">' + window.Icons3D.iconLine('tablet', 22) + '</div>' +
        '<div class="ld-summary-body">' +
          '<div class="ld-summary-label">로그인 기기 현황</div>' +
          '<div class="ld-summary-count">' + devices.length + '대</div>' +
          '<div class="ld-summary-sub">' +
            (others.length ? '현재 기기 외 ' + others.length + '대에서 로그인 중이에요' : '이 기기에서만 로그인 중이에요') +
          '</div>' +
        '</div>' +
      '</div>';

    if (current.length) {
      html += '<div class="section-title">현재 기기</div>' +
        '<div>' + current.map(deviceRowHtml).join('') + '</div>';
    }

    html += '<div class="divider-line"></div>' +
      '<div class="section-title">다른 기기</div>';
    if (others.length) {
      html += '<div>' + others.map(deviceRowHtml).join('') + '</div>' +
        '<div class="ld-note">' + window.Icons3D.iconLine('lightbulb', 15) +
        ' 모르는 기기가 있으면 로그아웃시켜 주세요. 로그아웃된 기기는 다시 로그인해야 주문을 받을 수 있어요.</div>';
    } else {
      html += window.UI.emptyStateHtml('tablet', '다른 기기에서는 로그인하지 않았어요');
    }
    return html;
  }

  function render() {
    return (
      '<style>' + STYLE + '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="ld-back-btn" aria-label="뒤로가기">←</button></div>' +
        '<div class="topbar-title">로그인 기기 관리</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll"><div id="ld-content"></div></div>'
    );
  }

  function mount(root) {
    var storeId = currentStoreId();

    function refresh() {
      var devices = window.MockApi.getLoginDevices(storeId);
      root.querySelector('#ld-content').innerHTML = contentHtml(devices);
    }

    root.querySelector('#ld-back-btn').addEventListener('click', function () {
      window.Router.back();
    });

    // 목록이 refresh로 다시 그려지므로 개별 버튼이 아니라 컨테이너에 한 번만 위임한다.
    root.querySelector('#ld-content').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="logout-device"]');
      if (!btn) return;
      var row = btn.closest('[data-device-id]');
      if (!row) return;
      var deviceId = row.getAttribute('data-device-id');
      var device = window.MockApi.getLoginDevices(storeId).find(function (d) { return d.id === deviceId; });
      if (!device) return;
      window.UI.confirmModal(
        '이 기기를 로그아웃시킬까요?',
        '<strong>' + esc(device.name) + '</strong>에서 로그아웃돼요.<br/>다시 쓰려면 그 기기에서 새로 로그인해야 해요.',
        '로그아웃',
        function () {
          if (!window.MockApi.logoutLoginDevice(storeId, deviceId)) return;
          window.UI.toast('기기를 로그아웃시켰어요');
          refresh();
        },
        { danger: true, cancelLabel: '닫기' }
      );
    });

    refresh();
  }

  function unmount() {}

  window.Router.register('loginDevices', { render: render, mount: mount, unmount: unmount });
})();
