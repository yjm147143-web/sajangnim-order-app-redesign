/*
 * 행사 선택 화면 (행사 담당자 로그인 직후 진입점, 탭바 없음)
 */
(function () {
  function statusMeta(status) {
    if (status === 'ONGOING') return { label: '진행중', cls: 'badge-success-soft' };
    if (status === 'UPCOMING') return { label: '예정', cls: 'badge-neutral' };
    return { label: '마감', cls: 'badge-danger-soft' };
  }

  function formatDateRange(start, end) {
    return String(start || '').replace(/-/g, '.') + ' ~ ' + String(end || '').replace(/-/g, '.');
  }

  function render() {
    const esc = window.UI.escapeHtml;
    const user = window.MockApi.getCurrentUser();
    const events = user ? window.MockApi.getMyEvents(user.id) : [];

    const listHtml = events.length
      ? events.map(function (ev) {
          const meta = statusMeta(ev.status);
          return (
            '<div class="card-list-item" data-event-id="' + ev.id + '">' +
              '<div class="label-group">' +
                '<span class="badge ' + meta.cls + '" style="align-self:flex-start;margin-bottom:2px;">' + meta.label + '</span>' +
                '<span class="label-title">' + esc(ev.name) + '</span>' +
                '<span class="label-sub">' + formatDateRange(ev.startDate, ev.endDate) + '</span>' +
              '</div>' +
              '<span class="chevron">›</span>' +
            '</div>'
          );
        }).join('')
      : '<div class="empty-state"><div class="empty-state-emoji">🗓️</div><div>담당 중인 행사가 없어요</div></div>';

    return (
      '<div class="topbar"><div class="topbar-side"></div><div class="topbar-title">행사 선택</div><div class="topbar-side"></div></div>' +
      '<div class="screen-scroll">' +
        '<div class="section-caption">담당하고 있는 행사를 선택해주세요</div>' +
        '<div style="display:flex;flex-direction:column;gap:12px;padding:0 20px 24px;">' + listHtml + '</div>' +
      '</div>'
    );
  }

  function mount(root) {
    root.querySelectorAll('[data-event-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        window.Router.resetTo('eventManagerHome', { eventId: el.getAttribute('data-event-id') });
      });
    });
  }

  function unmount() {}

  window.Router.register('eventSelect', { render: render, mount: mount, unmount: unmount });
})();
