/*
 * 공용 UI 헬퍼 — 포맷팅, 토스트/모달/바텀시트, 차트 SVG, 주문 카드 조각
 */
(function () {
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatMoney(n) { return (n || 0).toLocaleString('ko-KR') + '원'; }

  function clockLabel(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function elapsedLabel(iso) {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return mins + '분 경과';
    return Math.floor(mins / 60) + '시간 ' + (mins % 60) + '분 경과';
  }

  function formatContact(contact) {
    if (!contact) return '';
    if (contact.indexOf('@') !== -1) return contact;
    const d = contact.replace(/[^0-9]/g, '');
    if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
    return contact;
  }

  // ---------------- 5분 단위 시간대 버킷 ----------------
  function bucketKeyOf(iso) {
    const d = new Date(iso);
    d.setSeconds(0, 0);
    d.setMinutes(Math.floor(d.getMinutes() / 5) * 5);
    return d.getTime();
  }

  function bucketLabel(key) {
    const start = new Date(key);
    const end = new Date(key + 5 * 60000);
    function hm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    return hm(start) + ' ~ ' + hm(end);
  }

  // 예약 주문은 5분 단위 시간대 버킷 대신 별도의 '예약 시간' 그룹으로 묶는다.
  function groupByBucket(orders) {
    const reserved = orders.filter(function (o) { return o.isReservation; });
    const normal = orders.filter(function (o) { return !o.isReservation; });

    const groups = [];
    let current = null;
    normal.forEach(function (o) {
      const key = bucketKeyOf(o.orderedAt);
      if (!current || current.key !== key) {
        current = { key: key, label: bucketLabel(key), orders: [] };
        groups.push(current);
      }
      current.orders.push(o);
    });

    if (reserved.length) {
      groups.push({ key: 'RESERVED', label: '예약 시간', isReservationGroup: true, orders: reserved });
    }
    return groups;
  }

  // ---------------- Channel / status badges ----------------
  function channelBadgeHtml(channel) {
    if (channel === 'QR') return '<span class="channel-badge channel-qr">🔳 QR오더</span>';
    return '<span class="channel-badge channel-tablet">🖥️ 태블릿오더</span>';
  }

  function reservationBadgeHtml() {
    return '<span class="badge badge-reservation">📅 예약</span>';
  }

  function reusableContainerBadgeHtml() {
    return '<span class="badge badge-success-soft">♻️ 다회용기</span>';
  }

  const PROMO_LABELS = { GROUP_COUPON: '쿠폰(그룹)', STORE_COUPON: '쿠폰(매장)', HAPPY_HOUR: '해피아워', FIRST_COME: '선착순' };
  function promoLabel(promoType) { return PROMO_LABELS[promoType] || ''; }
  function promoBadgeHtml(promoType) {
    const label = promoLabel(promoType);
    return label ? '<span class="badge badge-warning-soft">' + label + '</span>' : '';
  }

  function operatingStatusMeta(status) {
    if (status === 'OPEN') return { label: '영업 중', cls: 'open', dot: '🟢' };
    if (status === 'PAUSED') return { label: '일시중지', cls: 'paused', dot: '🟠' };
    return { label: '마감', cls: 'closed', dot: '🔴' };
  }

  function statusPillHtml(status) {
    const meta = operatingStatusMeta(status);
    return '<span class="status-pill ' + meta.cls + '">' + meta.dot + ' ' + meta.label + '</span>';
  }

  // ---------------- 알림음 미리듣기 ----------------
  // 볼륨 0이면 소리 없이 진동만 동작(지원 기기 한정). 그 외엔 볼륨에 비례한 게인으로 짧은 알림음을 재생한다.
  function playNotificationPreview(volume) {
    if (!volume) {
      if (navigator.vibrate) navigator.vibrate(120);
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = (volume / 100) * 0.25;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
      osc.onended = function () { ctx.close(); };
    } catch (e) { /* 오디오 미지원 환경 무시 */ }
  }

  // ---------------- Toast ----------------
  let toastTimer = null;
  function toast(message, actionLabel, onAction) {
    const host = document.getElementById('toast-host');
    if (!host) return;
    host.innerHTML = '<div class="toast ' + (actionLabel ? 'toast-with-action' : '') + '" id="active-toast">' +
      '<span>' + escapeHtml(message) + '</span>' +
      (actionLabel ? '<button class="toast-action" id="toast-action-btn">' + escapeHtml(actionLabel) + '</button>' : '') +
      '</div>';
    const el = document.getElementById('active-toast');
    requestAnimationFrame(function () { el.classList.add('show'); });
    if (actionLabel && onAction) {
      document.getElementById('toast-action-btn').addEventListener('click', function () {
        onAction();
        hideToast();
      });
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 3000);
  }
  function hideToast() {
    const el = document.getElementById('active-toast');
    if (el) el.classList.remove('show');
  }

  // ---------------- Center Modal ----------------
  function showModal(opts) {
    const host = document.getElementById('modal-host');
    const buttonsHtml = (opts.buttons || []).map(function (b, i) {
      return '<button class="btn ' + (b.variant || 'btn-secondary') + '" data-idx="' + i + '">' + escapeHtml(b.label) + '</button>';
    }).join('');
    host.innerHTML = '<div class="modal-overlay" id="active-modal">' +
      '<div class="modal-card">' +
      (opts.title ? '<div class="modal-title">' + escapeHtml(opts.title) + '</div>' : '') +
      (opts.message ? '<div class="modal-message">' + opts.message + '</div>' : '') +
      (opts.bodyHtml || '') +
      '<div class="btn-row" style="flex-direction:column;gap:8px;">' + buttonsHtml + '</div>' +
      '</div></div>';
    requestAnimationFrame(function () { document.getElementById('active-modal').classList.add('show'); });
    (opts.buttons || []).forEach(function (b, i) {
      host.querySelector('[data-idx="' + i + '"]').addEventListener('click', function () {
        closeModal();
        if (b.onClick) b.onClick();
      });
    });
    return host;
  }
  function closeModal() {
    const host = document.getElementById('modal-host');
    host.innerHTML = '';
  }

  function confirmModal(title, message, confirmLabel, onConfirm, opts) {
    opts = opts || {};
    showModal({
      title: title, message: message,
      buttons: [
        { label: confirmLabel, variant: opts.danger ? 'btn-danger-solid' : 'btn-primary', onClick: onConfirm },
        { label: opts.cancelLabel || '취소', variant: 'btn-secondary' },
      ],
    });
  }

  // ---------------- 권한 잠금 비밀번호 확인 (사장님 계정을 여러 사람이 함께 쓸 때의 민감 기능 게이트) ----------------
  function showLockPasswordModal(storeId, label, onSuccess) {
    const host = document.getElementById('modal-host');
    host.innerHTML =
      '<div class="modal-overlay" id="lock-gate-modal">' +
        '<div class="modal-card">' +
          '<div style="font-size:28px;text-align:center;margin-bottom:6px;">🔒</div>' +
          '<div class="modal-title">' + escapeHtml(label) + '</div>' +
          '<div class="modal-message">사장님이 잠근 기능이에요.<br/>계속하려면 비밀번호를 입력해주세요.</div>' +
          '<input type="password" class="input-field" id="lock-gate-input" maxlength="12" placeholder="비밀번호" style="text-align:center;letter-spacing:4px;margin-bottom:6px;" />' +
          '<div class="input-error" id="lock-gate-error" style="min-height:16px;margin-bottom:10px;"></div>' +
          '<div class="btn-row" style="flex-direction:column;gap:8px;">' +
            '<button type="button" class="btn btn-primary" id="lock-gate-confirm">확인</button>' +
            '<button type="button" class="btn btn-secondary" id="lock-gate-cancel">취소</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    requestAnimationFrame(function () { document.getElementById('lock-gate-modal').classList.add('show'); });
    const input = document.getElementById('lock-gate-input');
    input.focus();

    function close() { host.innerHTML = ''; }
    document.getElementById('lock-gate-cancel').addEventListener('click', close);
    document.getElementById('lock-gate-modal').addEventListener('click', function (e) {
      if (e.target.id === 'lock-gate-modal') close();
    });
    function attempt() {
      if (window.MockApi.verifyPermissionLockPassword(storeId, input.value)) {
        close();
        onSuccess();
      } else {
        input.classList.add('error');
        document.getElementById('lock-gate-error').textContent = '비밀번호가 올바르지 않아요.';
        input.value = '';
        input.focus();
      }
    }
    document.getElementById('lock-gate-confirm').addEventListener('click', attempt);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') attempt(); });
    input.addEventListener('input', function () {
      input.classList.remove('error');
      document.getElementById('lock-gate-error').textContent = '';
    });
  }

  // scopeKey에 해당하는 보호 항목이 켜져 있지 않으면(잠금 자체가 꺼져 있거나, 이 항목만 꺼져 있으면) onSuccess를 바로 호출한다.
  // 켜져 있으면 비밀번호 확인 모달을 띄우고, 정답을 입력해야만 onSuccess를 호출한다.
  function requirePasswordGate(storeId, scopeKey, label, onSuccess) {
    const status = window.MockApi.getPermissionLockStatus(storeId);
    if (!status.isSet || !status.scopes[scopeKey]) { onSuccess(); return; }
    showLockPasswordModal(storeId, label, onSuccess);
  }

  // 보호 항목과 무관하게, 잠금이 설정되어 있으면 항상 재확인을 요구한다.
  // 잠금 해제 · 비밀번호 변경 · 보호 항목 변경처럼 잠금 설정 자체를 건드리는 동작에 사용한다.
  function requireLockReauth(storeId, label, onSuccess) {
    const status = window.MockApi.getPermissionLockStatus(storeId);
    if (!status.isSet) { onSuccess(); return; }
    showLockPasswordModal(storeId, label, onSuccess);
  }

  // ---------------- Bottom Sheet ----------------
  function showBottomSheet(innerHtml, onMount) {
    const host = document.getElementById('modal-host');
    host.innerHTML = '<div class="modal-overlay-bottom" id="active-sheet"><div class="sheet-card">' +
      '<div class="sheet-handle"></div>' + innerHtml + '</div></div>';
    requestAnimationFrame(function () { document.getElementById('active-sheet').classList.add('show'); });
    document.getElementById('active-sheet').addEventListener('click', function (e) {
      if (e.target.id === 'active-sheet') closeModal();
    });
    if (onMount) onMount(host);
  }

  // ---------------- Chart: Bar ----------------
  function barChartHtml(data) {
    const max = Math.max(1, ...data.map(function (d) { return d.amount; }));
    return '<div class="bar-chart-row">' + data.map(function (d) {
      const h = Math.round((d.amount / max) * 100);
      return '<div class="bar-chart-col" data-chart-amount="' + d.amount + '" data-chart-label="' + escapeHtml(d.name) + '">' +
        '<div class="bar-chart-bar' + (d.amount === max ? ' max' : '') + '" style="height:' + Math.max(h, 3) + '%"></div>' +
        '<div class="bar-chart-label">' + escapeHtml(d.name) + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  // 막대 탭 시 해당 시점 금액을 말풍선으로 바로 보여준다(전역 위임 클릭).
  function bindBarChartTooltip() {
    document.addEventListener('click', function (e) {
      const col = e.target.closest('.bar-chart-col');
      const existing = document.querySelectorAll('.bar-chart-tooltip');
      const alreadyOpenOnThis = col && col.querySelector('.bar-chart-tooltip');
      existing.forEach(function (t) { t.remove(); });
      if (!col || alreadyOpenOnThis) return;
      const tip = document.createElement('div');
      tip.className = 'bar-chart-tooltip';
      tip.textContent = col.getAttribute('data-chart-label') + ' · ' + formatMoney(Number(col.getAttribute('data-chart-amount')));
      col.appendChild(tip);
    });
  }

  // ---------------- Chart: Donut (SVG) ----------------
  const DONUT_COLORS = ['#7C2FF0', '#5C82E8', '#4FC9B8', '#FFB020'];
  function donutChartHtml(data) {
    const total = data.reduce(function (s, d) { return s + d.amount; }, 0) || 1;
    let acc = 0;
    const r = 40, cx = 50, cy = 50, circumference = 2 * Math.PI * r;
    const circles = data.map(function (d, i) {
      const frac = d.amount / total;
      const dash = frac * circumference;
      const offset = circumference - acc * circumference;
      acc += frac;
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + DONUT_COLORS[i % DONUT_COLORS.length] +
        '" stroke-width="16" stroke-dasharray="' + dash + ' ' + circumference + '" stroke-dashoffset="' + offset + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" />';
    }).join('');
    const svg = '<svg viewBox="0 0 100 100" width="120" height="120">' + circles + '</svg>';
    const legend = '<div class="donut-legend">' + data.map(function (d, i) {
      const pct = Math.round((d.amount / total) * 100);
      return '<div class="donut-legend-item"><span class="donut-legend-dot" style="background:' + DONUT_COLORS[i % DONUT_COLORS.length] + '"></span>' +
        '<span class="donut-legend-name">' + escapeHtml(d.name) + '</span>' +
        '<span class="donut-legend-value">' + pct + '% · ' + formatMoney(d.amount) + '</span></div>';
    }).join('') + '</div>';
    return '<div class="donut-wrap">' + svg + legend + '</div>';
  }

  // ---------------- Chart: Ranking list ----------------
  function rankListHtml(data, opts) {
    opts = opts || {};
    const max = Math.max(1, ...data.map(function (d) { return d.amount; }));
    return '<div class="rank-list">' + data.map(function (d, i) {
      const pct = Math.round((d.amount / max) * 100);
      return '<div class="rank-row" ' + (opts.clickable ? 'data-rank-idx="' + i + '" style="cursor:pointer"' : '') + '>' +
        '<div class="rank-index">' + (i + 1) + '</div>' +
        '<div class="rank-body">' +
        '<div class="rank-name-row"><span>' + escapeHtml(d.name) + '</span><span>' + formatMoney(d.amount) + '</span></div>' +
        '<div class="rank-bar-track"><div class="rank-bar-fill' + (i === 0 ? ' max' : '') + '" style="width:' + pct + '%"></div></div>' +
        (d.qty != null ? '<div class="rank-sub">판매 ' + d.qty + '개</div>' : '') +
        '</div></div>';
    }).join('') + '</div>';
  }

  function salesChartHtml(dimension, data) {
    if (!data.length) return '<div class="empty-state"><div class="empty-state-emoji">📭</div><div>해당 기간의 매출이 없어요</div></div>';
    if (dimension === 'period' || dimension === 'hour') return barChartHtml(data);
    if (dimension === 'payment' || dimension === 'channel') return donutChartHtml(data);
    if (dimension === 'menu' || dimension === 'store') return rankListHtml(data);
    return '';
  }

  window.UI = {
    escapeHtml: escapeHtml, formatMoney: formatMoney, clockLabel: clockLabel, elapsedLabel: elapsedLabel,
    formatContact: formatContact,
    bucketKeyOf: bucketKeyOf, bucketLabel: bucketLabel, groupByBucket: groupByBucket,
    channelBadgeHtml: channelBadgeHtml, reservationBadgeHtml: reservationBadgeHtml, operatingStatusMeta: operatingStatusMeta, statusPillHtml: statusPillHtml,
    reusableContainerBadgeHtml: reusableContainerBadgeHtml, promoLabel: promoLabel, promoBadgeHtml: promoBadgeHtml,
    toast: toast, showModal: showModal, closeModal: closeModal, confirmModal: confirmModal, showBottomSheet: showBottomSheet,
    requirePasswordGate: requirePasswordGate, requireLockReauth: requireLockReauth,
    barChartHtml: barChartHtml, donutChartHtml: donutChartHtml, rankListHtml: rankListHtml, salesChartHtml: salesChartHtml,
    playNotificationPreview: playNotificationPreview,
  };

  bindBarChartTooltip();
})();
