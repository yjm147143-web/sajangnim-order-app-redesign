/*
 * 사장님 주문 접수 화면 (order)
 * 대기 / 처리중 / 완료 탭 기반의 주문 카드 보드.
 * '설정 > 권한 잠금 설정'에서 결제 취소 항목을 보호 중이면, 결제 취소 시 비밀번호 확인이 필요하다.
 */
(function () {
  const esc = window.UI.escapeHtml;

  // 영업 상태 버튼의 상태별 표기 — 재생/일시정지/정지 기호가 영업중/일시중지/마감에 그대로 대응한다.
  // 색은 앱의 솔리드 버튼 토큰(btn-success/btn-warning/btn-danger-solid)과 동일하게 맞춘다.
  const OP_ICON_PLAY = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M7 4.5v15a1 1 0 0 0 1.53.85l11-7.5a1 1 0 0 0 0-1.7l-11-7.5A1 1 0 0 0 7 4.5z"/></svg>';
  const OP_ICON_PAUSE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<rect x="6.5" y="4.5" width="4" height="15" rx="1.2"/><rect x="13.5" y="4.5" width="4" height="15" rx="1.2"/></svg>';
  const OP_ICON_STOP = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<rect x="5.5" y="5.5" width="13" height="13" rx="2"/></svg>';
  const OP_STATUS_VIEW = {
    OPEN: { cls: 'open', label: '영업중', icon: OP_ICON_PLAY },
    PAUSED: { cls: 'paused', label: '일시중지', icon: OP_ICON_PAUSE },
    CLOSED: { cls: 'closed', label: '마감', icon: OP_ICON_STOP },
  };

  // 네트워크는 정상 / 이상 두 상태로만 보여준다. '희미함'과 '완전 단절'을 아이콘으로 나눠도
  // 사장님이 할 일은 똑같이 '기기 네트워크를 확인한다' 하나였고, 완전 단절은 이미 빨간 배너와
  // 화면 테두리로 따로 알린다. 이상일 때는 호를 하나 줄이고(3→2) 빨강으로 바꾼 뒤 깜빡여,
  // 주문을 보고 있는 중에도 시야에 걸리게 한다.
  function networkIconHtml(state) {
    const bad = state !== 'ok';
    // 정상은 --color-accent-blue-strong(#3355B8). SVG stroke는 XML 속성이라 var()를 못 받아
    // 토큰 값을 그대로 적는다. 기본 --color-accent-blue(#5C82E8)는 흰 배경에서 3.61:1이라
    // 16px·선굵기 2.4인 이 아이콘에는 얇아 보여, 6.70:1인 진한 쪽을 쓴다.
    const color = bad ? '#b02850' : '#3355B8';
    const outerArc = bad ? '' : '<path d="M1.42 9a16 16 0 0 1 21.16 0"></path>';
    return '<svg class="net-icon' + (bad ? ' bad' : '') + '" width="16" height="16" viewBox="0 0 24 24"' +
      ' fill="none" stroke="' + color + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M5 12.55a11 11 0 0 1 14.08 0"></path>' +
      outerArc +
      '<path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>' +
      '<circle cx="12" cy="20" r="1.4" fill="' + color + '" stroke="none"></circle>' +
      '</svg>';
  }

  // 새로고침·검색 아이콘은 이모지(🔄/🔍)를 쓰면 컬러 글리프라 회색으로 만들 수 없고,
  // 글리프 자체가 테두리를 가진 것처럼 보인다. currentColor를 쓰는 선 아이콘으로 바꿔
  // CSS에서 색을 통제한다.
  const ICON_REFRESH = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"></path>' +
    '<polyline points="20.5 4 20.5 9.4 15.1 9.4"></polyline>' +
    '</svg>';

  // 필터 시트의 '초기화'는 텍스트 옆에 붙는 작은 아이콘이라 별도 크기로 둔다.
  const ICON_REFRESH_SM = ICON_REFRESH.replace('width="19" height="19"', 'width="14" height="14"');

  const ICON_SEARCH = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="10.5" cy="10.5" r="6.5"></circle>' +
    '<line x1="15.4" y1="15.4" x2="20.5" y2="20.5"></line>' +
    '</svg>';

  // ---- 화면 상태 (mount 될 때마다 render()에서 초기화) ----
  let user = null;
  let storeId = null;
  let store = null;
  let tabs = [];          // [{status:'WAITING', label:'대기'}, ...]
  let currentIndex = 0;
  let sortDir = 'asc';    // 접수 시간 기준, 기본 오름차순(오래된순 — 새 주문이 아래로 쌓임)
  let searchQuery = '';
  let menuFilters = [];        // 선택된 메뉴명 배열 — 카테고리 내에서는 중복 선택(OR) 가능
  let orderTypeFilters = [];   // 'RESERVATION' | 'DELIVERY' 중 선택된 값 배열
  let calledFilter = 'ALL';    // 'ALL' | 'CALLED' | 'NOT_CALLED' — 주문 필터 시트의 '호출 여부' 카테고리에서 설정
  let callStatusPanelOpen = false; // '주문 요약' 배지 펼침 상태
  let selectedIds = new Set();
  let cardOverrides = {};      // { [orderId:string]: boolean } 주문카드 단위 펼침 오버라이드 (기본값: 간단히 보기)
  let isOnline = true;
  let networkWeak = false; // 완전 단절은 아니지만 신호가 희미한 상태(개발자 도구 '간헐적 끊김' 시뮬레이션) — 주문 컨트롤은 막지 않고 캡션만 경고로 바꾼다
  let autoSoldoutNames = [];   // 자동 품절 배너에 노출 중인 메뉴명 목록 (X로 닫으면 비움)
  let happyHourPromos = [];    // 해피아워 시작 배너에 노출 중인 { name, price, start, end } 목록 (X로 닫으면 비움)
  let root = null;

  const SCOPED_STYLE = '' +
    // 상단바는 좌:영업상태 배지 / 중앙:매장명+네트워크 아이콘 / 우:설정 버튼으로 고정한다.
    // 배지는 아래 검색창과, 설정 버튼은 아래 새로고침 버튼과 같은 열(좌우 여백 20px)에 맞춰
    // 정렬된다. 매장명은 화면 정중앙에 두기 위해 절대 위치(기본 .topbar-title)를 그대로 쓴다 —
    // 세 요소를 한 flex 그룹으로 묶어 가운데 정렬하면 매장명 길이에 따라 좌우 배지가 밀려난다.
    '.order-topbar-centered { justify-content: space-between; }' +
    '.order-topbar-centered #status-btn-slot { display: inline-flex; flex-shrink: 0; }' +
    // 설정 아이콘은 기본 20px보다 키워 매장명과 함께 상단바의 시각적 무게를 맞춘다(터치 영역 44px은 유지)
    '.order-topbar-centered .icon-btn { font-size: 26px; }' +
    // 설정은 글리프가 아니라 '누를 수 있는 면'으로 읽히도록 흰 버튼(테두리+그림자)으로 감싼다.
    // 44px 터치 영역은 유지하고 그 안에 38px 면만 그려, 옆 매장명(17px)보다 무게가 앞서지 않게 한다.
    // .icon-btn의 좌우 패딩(6px)을 그대로 두면 44px 버튼의 내부 폭이 32px로 좁아져 38px 면이 눌린다.
    '.order-topbar-centered .settings-icon-btn { font-size: 0; padding: 0; }' +
    '.settings-icon-btn .settings-icon-surface { display: inline-flex; align-items: center;' +
      ' justify-content: center; flex-shrink: 0; width: 38px; height: 38px; border-radius: 13px;' +
      ' background: var(--color-white); color: var(--color-text-primary);' +
      // 민트 계열 --color-disabled(#DCEAE7)는 흰 면 위에서 1.24:1로 사라지므로,
      // 중립 회색 표면(--color-card-bg)과 짝이 되는 중립 보더를 직접 쓴다.
      ' border: 1px solid #E3E6EC;' +
      ' box-shadow: 0 1px 2px rgba(30, 29, 43, 0.08), 0 2px 6px rgba(30, 29, 43, 0.05);' +
      ' transition: background-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease; }' +
    // 눌림은 그림자를 inset으로 뒤집어 '면이 안으로 들어가는' 방향으로 표현한다.
    '.settings-icon-btn:active .settings-icon-surface { background: var(--color-card-bg);' +
      ' box-shadow: inset 0 1px 2px rgba(30, 29, 43, 0.10); transform: scale(0.96); }' +
    '@media (prefers-reduced-motion: reduce) {' +
      ' .settings-icon-btn .settings-icon-surface { transition: none; }' +
      ' .settings-icon-btn:active .settings-icon-surface { transform: none; } }' +
    // 상단바 패딩이 위아래로 다르므로(32px/8px) 기본 top:50%를 그대로 쓰면 매장명이 좌우 배지보다
    // 12px 위로 뜬다. 패딩 안쪽 영역에 맞춰 위아래를 물려 배지·설정 버튼과 같은 행에 오게 한다.
    '.topbar-title { display: flex; align-items: center; justify-content: center; gap: 6px; max-width: 45vw;' +
      ' top: var(--space-8); bottom: var(--space-2); transform: translateX(-50%); }' +
    '.order-title-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }' +
    '.reason-pill-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }' +
    '.reason-textarea { margin-top: 4px; }' +
    '.reason-counter { margin-top: 5px; text-align: right; font-size: var(--font-size-micro);' +
      ' font-weight: 700; color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }' +
    // 상한에 닿으면 '더 안 써지는' 이유를 색으로 알린다 — 안 그러면 입력이 씹히는 것처럼 느껴진다.
    '.reason-counter.full { color: var(--color-accent-red); }' +
    // 아래쪽 margin이 없으면 비밀번호 입력란이 '취소하기' 버튼에 붙어, 입력란을 누르려다
    // 취소를 눌러버릴 수 있다. 입력 영역과 확정 버튼 사이를 확실히 띄운다.
    '.reason-pw-block { margin: 14px 0 20px; padding-top: 14px; border-top: 1px solid var(--color-divider); text-align: left; }' +
    '.reason-pw-label { font-size: var(--font-size-caption); font-weight: 700; color: var(--color-text-secondary); margin-bottom: 8px; }' +
    '.reason-pw-error { margin-top: 6px; font-size: var(--font-size-caption); font-weight: 700; color: var(--color-accent-red); }' +
    '.order-list.with-bulk-bar { padding-bottom: 88px; }' +
    '#bulk-bar-slot:empty { display: none; }' +
    '.filter-section { margin-bottom: 18px; }' +
    '.filter-section-title { font-size: var(--font-size-caption); font-weight: 800; color: var(--color-text-secondary); margin-bottom: 10px; }' +
    '.filter-chip-row { display: flex; gap: 8px; flex-wrap: wrap; }' +
    '.filter-chip { padding: 9px 14px; border: 1.5px solid var(--color-disabled); border-radius: var(--radius-pill);' +
      ' background: var(--color-white); font-size: var(--font-size-caption); font-weight: 700; color: var(--color-text-secondary); cursor: pointer; }' +
    '.filter-chip.on { border-color: var(--color-accent-blue); background: var(--color-accent-blue-bg); color: var(--color-accent-blue); }' +
    '.filter-sheet-actions { display: flex; gap: 8px; margin-top: 8px; }' +
    '.filter-sheet-actions .btn { height: 48px; }' +
    '.filter-sheet-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }' +
    '.filter-reset-link { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; padding: 4px;' +
      ' font-size: var(--font-size-caption); font-weight: 700; color: var(--color-text-secondary); cursor: pointer; }' +
    // 영업 상태는 파스텔 배지가 아니라 앱의 솔리드 버튼 언어로 그린다 — 배지는 아무리 꾸며도 '읽는 것'으로
    // 읽히지만, 솔리드 버튼은 사장님이 설정 화면에서 이미 개점·일시중지·마감에 쓰고 있는 형태라 '누르는 것'으로
    // 바로 읽힌다. 색·글자색은 btn-success/btn-warning/btn-danger-solid와 동일하게 맞춘다.
    '.op-status-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex-shrink: 0;' +
      ' height: 34px; padding: 0 13px; border: none; border-radius: 11px; cursor: pointer;' +
      ' font-size: var(--font-size-caption); font-weight: 800; letter-spacing: -0.2px; white-space: nowrap;' +
      ' transition: transform .1s ease, filter .1s ease; }' +
    '.op-status-btn.open { background: var(--color-accent-green-bg); color: #0b6b5c; }' +
    '.op-status-btn.paused { background: var(--color-accent-amber-bg); color: #a15c00; }' +
    '.op-status-btn.closed { background: var(--color-accent-red-bg); color: var(--color-accent-red); }' +
    '.op-status-btn:active { transform: scale(0.96); filter: brightness(0.95); }' +
    '@media (prefers-reduced-motion: reduce) { .op-status-btn { transition: none; } .op-status-btn:active { transform: none; } }' +
    // 영업 상태 모달의 액션 버튼도 설정 화면의 파스텔 버튼과 같은 톤으로 맞춘다.
    // showModal의 variant가 그대로 class로 붙으므로, 기존 .btn-* 변형과 섞이지 않게 op- 접두어를 쓴다.
    '.btn.op-pastel-green { background: var(--color-accent-green-bg); color: #0b6b5c; width: 100%; }' +
    '.btn.op-pastel-amber { background: var(--color-accent-amber-bg); color: #a15c00; width: 100%; }' +
    '.btn.op-pastel-red { background: var(--color-accent-red-bg); color: var(--color-accent-red); width: 100%; }' +
    '.order-network-caption { flex-shrink: 0; display: inline-flex; align-items: center; }' +
    // 완전히 사라졌다 나타나면 '아이콘이 없어진' 것처럼 보이므로 0까지 내리지 않는다.
    // 0.25까지만 떨어뜨려 존재는 유지하면서 움직임으로 눈에 걸리게 한다.
    '.net-icon.bad { animation: net-bad-blink 1.1s ease-in-out infinite; }' +
    '@keyframes net-bad-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }' +
    '@media (prefers-reduced-motion: reduce) { .net-icon.bad { animation: none; opacity: 1; } }' +
    '.reopen-sheet-desc { font-size: var(--font-size-caption); font-weight: 600; color: var(--color-text-secondary);' +
      ' line-height: 1.6; word-break: keep-all; margin-bottom: var(--space-5); }' +
    // 첫 문장은 '지금 어떤 상태인지'라 두 번째 문장(할 일 안내)보다 앞서 읽혀야 한다.
    // 굵게 + 본문 색으로 올리고, 상태명만 상태색으로 뽑아 한 번 더 눌러준다.
    '.reopen-sheet-desc strong { font-weight: 800; color: var(--color-text-primary); }' +
    '.reopen-status.closed { color: var(--color-accent-red); }' +
    '.reopen-status.paused { color: #a15c00; }' +
    '.reopen-sheet-actions { display: flex; flex-direction: column; gap: 8px; }' +
    '.reopen-sheet-actions .btn { width: 100%; }' +
    '.search-row { display: flex; align-items: center; gap: var(--space-2); padding: 0 var(--space-5) var(--space-3); }' +
    '.search-row .search-box { flex: 1; min-width: 0; }' +
    '.sort-pill { flex-shrink: 0; }' +
    '.order-toolbar-divider { height: 1px; background: #eef0f2; margin: 0 var(--space-5) var(--space-3); }' +
    '.toolbar-left-group { display: flex; align-items: center; gap: var(--space-2); }' +
    '.phone-btn-danger { background: var(--color-accent-red-bg); color: #b02850; }' +
    '.phone-btn-danger:active { background: var(--color-accent-red); color: var(--color-white); }' +
    '.contact-link-btn { background: none; border: none; padding: 0; margin: 0; font: inherit; font-weight: 700;' +
      ' color: var(--color-text-primary); text-decoration: underline; text-underline-offset: 2px; cursor: pointer;' +
      ' display: inline-flex; align-items: center; gap: 4px; }' +
    '.contact-link-btn .cl-arrow { text-decoration: none; font-size: 13px; font-weight: 800; color: var(--color-text-secondary); }' +
    '.contact-link-btn:active { color: #0b6b5c; }' +
    '.card-detail-toggle {' +
      ' width: 100%; border: none; background: transparent; border-top: 1px solid var(--color-divider);' +
      ' margin-top: var(--space-3); padding: 10px 0 0; font-family: inherit; cursor: pointer;' +
      ' display: flex; align-items: center; justify-content: space-between; text-align: left; }' +
    '.card-detail-toggle .cdt-label { font-size: 12.5px; color: var(--color-text-secondary); font-weight: 700; }' +
    '.card-detail-toggle .cdt-hint { font-weight: 600; opacity: 0.8; }' +
    '.card-detail-toggle .cdt-chev { font-size: 24px; font-weight: 800; color: var(--color-text-secondary); flex-shrink: 0; margin-left: 8px; line-height: 1; }' +
    '.card-detail-toggle:active .cdt-label { color: #0b6b5c; }' +
    '.top-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }' +
    '.elapsed-badge.reservation { background: var(--color-accent-blue-bg); color: #3355b8; border-color: rgba(92,130,232,0.35); }' +
    '.call-status-btn { background: var(--color-accent-blue); color: var(--color-white); flex-shrink: 0; }' +
    '.call-status-btn.active { background: #2a4fc7; }' +
    '.call-status-panel { margin: 0 var(--space-5) var(--space-3); padding: var(--space-4); background: var(--color-accent-blue-bg); border-radius: var(--radius-card); }' +
    '.call-status-summary { display: flex; gap: 8px; margin-bottom: 10px; }' +
    '.call-status-summary .cs-pill { font-size: 13px; padding: 7px 12px; }' +
    // 메뉴가 많아도 패널이 한없이 길어지지 않도록 자체 스크롤 영역으로 감싼다 — 펼쳐도 주문 카드가
    // 최소 하나는 화면에 걸쳐 보이도록 이 영역의 높이를 일부러 낮게 제한한다. 아직 안 불린 수량이
    // 많은 메뉴가 위로 정렬되므로(callStatusMenuBreakdown) 스크롤 없이도 가장 급한 메뉴부터 보인다.
    '.call-status-menu-list { max-height: 148px; overflow-y: auto; border-radius: 10px; background: var(--color-white); }' +
    '.cs-menu-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; font-size: 13px; border-bottom: 1px solid var(--color-divider); }' +
    '.cs-menu-row:last-child { border-bottom: none; }' +
    '.cs-menu-name { font-weight: 800; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; margin-right: 8px; }' +
    '.cs-menu-pills { display: flex; gap: 5px; flex-shrink: 0; }' +
    // 신규(대기)=앰버, 완료=그린으로 상태를 색으로 바로 구분한다. 0건은 회색으로 낮춰 시선을 뺏지 않는다.
    '.cs-pill { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: var(--radius-pill); font-size: 11px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; }' +
    '.cs-pill b { font-weight: 800; }' +
    '.cs-pill.notCalled { background: var(--color-accent-amber-bg); color: #a15c00; }' +
    '.cs-pill.total { background: var(--color-accent-green-bg); color: #0b6b5c; }' +
    '.cs-pill.zero { background: var(--color-card-bg); color: var(--color-text-secondary); }' +
    '.cancel-done-badge { width: 100%; justify-content: center; padding: 12px; font-size: var(--font-size-caption); font-weight: 700; }' +
    '.line-name.reusable { color: var(--color-accent-green); font-weight: 700; }' +
    '.order-card.selected { background: var(--color-accent-blue-bg); box-shadow: inset 0 0 0 1.5px var(--color-accent-blue); }' +
    // 상단바 설정 버튼(.icon-btn, 44px)과 같은 폭으로 맞춰 두 버튼의 중심이 정확히 같은 열에 오게 한다
    '.refresh-btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px;' +
      ' background: none; border: none; padding: 0; cursor: pointer; line-height: 1; flex-shrink: 0; margin-left: auto;' +
      ' color: var(--color-text-secondary); }' +
    '.refresh-btn:active { color: var(--color-text-primary); }' +
    // 검색 아이콘도 같은 회색 계열로 — 입력 전 placeholder와 같은 무게로 읽혀야 한다.
    '.search-box .search-icon { display: inline-flex; align-items: center; color: var(--color-text-secondary); flex-shrink: 0; }' +
    '.order-title-text { font-size: 18px; }' +
    '.refresh-btn.spinning { animation: order-refresh-spin 0.6s linear; }' +
    '@keyframes order-refresh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' +
    // 미수락/처리중/완료 탭 — 따로 떨어진 배지형 버튼 대신, 하나의 캡슐 안에서 전환되는
    // 세그먼트 스타일로 변경(메뉴관리의 '1개만 선택/여러개 선택'과 같은 톤). 새로고침 버튼은
    // 이 캡슐 바깥에 그대로 분리해서 둔다.
    '.order-status-seg { display: flex; flex: 1; border: 1.5px solid var(--color-disabled); border-radius: var(--radius-pill); padding: 3px; background: var(--color-card-bg); }' +
    '.order-status-seg .segment-tab { flex: 1; background: transparent; }' +
    '.order-status-seg .segment-tab.active { background: var(--color-text-primary); color: var(--color-white); box-shadow: 0 1px 4px rgba(0,0,0,.15); }';

  // ---------------- 탭 구성 ----------------
  // 자동수락 ON이면 신규 주문이 대기 없이 바로 처리중으로 인입되므로 대기 탭 자체를 숨긴다.
  // OFF면 대기 탭을 포함한 3개 탭을 모두 노출한다.
  function computeTabs() {
    if (store.autoAcceptOrders) {
      return [{ status: 'PROCESSING', label: '처리중' }, { status: 'DONE', label: '완료' }];
    }
    return [{ status: 'WAITING', label: '미수락' }, { status: 'PROCESSING', label: '처리중' }, { status: 'DONE', label: '완료' }];
  }

  function currentStatus() { return tabs[currentIndex].status; }

  // ---------------- 데이터 조회 ----------------
  function fetchOrders() {
    return window.MockApi.getOrders(storeId, {
      status: currentStatus(),
      menuFilters: menuFilters,
      orderTypeFilters: orderTypeFilters,
      calledFilter: calledFilter,
      search: searchQuery || undefined,
      sortDir: sortDir,
    });
  }

  // 검색어뿐 아니라 주문 필터(메뉴/유형/호출여부)도 탭을 넘나들며 유지되므로, 탭 옆 건수 뱃지도
  // 현재 적용된 필터가 모두 반영된 값으로 보여준다 (fetchOrders와 동일한 조건, status만 다름)
  function tabCount(status) {
    return window.MockApi.getOrders(storeId, {
      status: status,
      menuFilters: menuFilters,
      orderTypeFilters: orderTypeFilters,
      calledFilter: calledFilter,
      search: searchQuery || undefined,
    }).length;
  }

  // ---------------- 펼침 상태 ----------------
  // 시간대 그룹 단위 간단히보기/펼쳐보기는 삭제하고, 카드마다 개별 화살표로만 펼침 상태를 다룬다 (기본값: 간단히 보기)
  function isCardExpanded(orderId) {
    if (Object.prototype.hasOwnProperty.call(cardOverrides, orderId)) return cardOverrides[orderId];
    return false;
  }

  function toggleCardExpand(orderId) {
    cardOverrides[orderId] = !isCardExpanded(orderId);
    updateList();
  }

  // 메뉴 수량·이름·옵션 전체 목록 — '간단히 보기' 상태에서도 항상 노출된다 (수량이 먼저, 메뉴명이 뒤에)
  // 다회용기 메뉴는 별도 뱃지 대신, 그 메뉴명 뒤에 ♻️를 붙이고 메뉴명 글자를 초록색으로 강조한다.
  // 여기만 OS 기본 이모지를 그대로 쓴다 — 사장님이 iOS 재활용 표시 그대로 가져가기로 결정했다.
  function itemListHtml(order) {
    return (order.items || []).map(function (it) {
      // 다회용기는 메뉴 단위 값이라 줄마다 따로 판단한다 — 한 주문에 다회용기와 일회용이 섞일 수 있다.
      const isReusable = !!it.isReusableContainer;
      const optHtml = (it.optionNames && it.optionNames.length)
        ? '<span class="line-option">' + it.optionNames.map(function (o) { return esc(o); }).join(', ') + '</span>'
        : '';
      return '<div class="order-card-menu-line">' +
        '<span class="line-qty">' + it.quantity + '개</span>' +
        '<span class="line-name' + (isReusable ? ' reusable' : '') + '">' + esc(it.menuName) + (isReusable ? ' ♻️' : '') + '</span>' +
        optHtml +
        '</div>';
    }).join('');
  }

  // ---------------- 렌더 조각들 ----------------
  // 영업 상태 버튼 — 공용 statusPillHtml(파스텔 span)을 쓰지 않고 솔리드 버튼으로 직접 그린다.
  // 용어는 상태명(영업중/일시중지/마감)을 그대로 쓰고, 아이콘이 상태와 1:1로 대응한다.
  function renderStatusButtonHtml() {
    const v = OP_STATUS_VIEW[store.operatingStatus] || OP_STATUS_VIEW.CLOSED;
    return '<button type="button" class="op-status-btn ' + v.cls + '"' +
      ' data-action="open-operating-status" aria-label="영업 상태 ' + v.label + ' · 눌러서 변경">' +
      v.icon + v.label +
      '</button>';
  }

  function renderSegmentTabsHtml() {
    const tabBtns = tabs.map(function (t, i) {
      return '<button type="button" class="segment-tab' + (i === currentIndex ? ' active' : '') + '" data-action="switch-tab" data-tab-idx="' + i + '">' +
        esc(t.label) + ' <span class="count">' + tabCount(t.status) + '</span></button>';
    }).join('');
    return '<div class="order-status-seg">' + tabBtns + '</div>';
  }

  // ---------------- 주문 요약(모든 탭에서 노출) ----------------
  // 실제 조리 현황판(kitchenBoard.js, 'KDS')과는 별개의 요약 위젯이다.
  // 집계는 현재 적용된 메뉴/유형/검색 필터는 그대로 반영하되, 호출 여부 필터 자체는 무시하고 각각 강제로 계산한다.
  function callStatusCounts() {
    const base = { status: 'PROCESSING', menuFilters: menuFilters, orderTypeFilters: orderTypeFilters, search: searchQuery || undefined };
    const notCalledCount = window.MockApi.getOrders(storeId, Object.assign({}, base, { calledFilter: 'NOT_CALLED' })).length;
    // 호출 여부와 무관하게 처리중인 전체 건수(신규+호출됨을 나눠 세지 않고 한 번에 구한다)
    const processingCount = window.MockApi.getOrders(storeId, base).length;
    // 완료 = 처리중(호출 여부 무관) + 완료(취소 제외) — 오늘 이 화면의 필터 조건에 해당하는 전체 접수 건수
    const doneBase = { status: 'DONE', menuFilters: menuFilters, orderTypeFilters: orderTypeFilters, search: searchQuery || undefined };
    const doneCount = window.MockApi.getOrders(storeId, doneBase).filter(function (o) { return !o.canceled; }).length;
    const totalCount = processingCount + doneCount;
    return { notCalledCount: notCalledCount, totalCount: totalCount };
  }

  // 메뉴별로 신규(미호출)/완료 수량을 집계한다. 완료는 호출됨+완료 상태를 구분 없이 합친 값이라
  // 호출된 주문만 따로 세는 로직은 두지 않는다. 아직 안 불린(신규) 수량이 많은 메뉴가 가장
  // 급하므로 그 순서로 앞에 오도록 정렬한다.
  function callStatusMenuBreakdown() {
    const base = { status: 'PROCESSING', menuFilters: menuFilters, orderTypeFilters: orderTypeFilters, search: searchQuery || undefined };
    const orders = window.MockApi.getOrders(storeId, base);
    const doneBase = { status: 'DONE', menuFilters: menuFilters, orderTypeFilters: orderTypeFilters, search: searchQuery || undefined };
    const doneOrders = window.MockApi.getOrders(storeId, doneBase).filter(function (o) { return !o.canceled; });
    const stats = {};
    const names = [];
    function ensure(name) {
      if (!stats[name]) { stats[name] = { notCalled: 0, done: 0 }; names.push(name); }
    }
    orders.forEach(function (o) {
      const isCalled = !!o.called;
      o.items.forEach(function (it) {
        ensure(it.menuName);
        stats[it.menuName].done += it.quantity;
        if (!isCalled) stats[it.menuName].notCalled += it.quantity;
      });
    });
    doneOrders.forEach(function (o) {
      o.items.forEach(function (it) {
        ensure(it.menuName);
        stats[it.menuName].done += it.quantity;
      });
    });
    return names
      .map(function (name) { return { name: name, notCalled: stats[name].notCalled, done: stats[name].done }; })
      .sort(function (a, b) { return b.notCalled - a.notCalled; });
  }

  function renderCallStatusButtonHtml() {
    return '<button type="button" class="pill-btn call-status-btn' + (callStatusPanelOpen ? ' active' : '') + '" data-action="toggle-call-status-panel">주문 요약 ' + (callStatusPanelOpen ? '▴' : '▾') + '</button>';
  }

  // 신규/완료 수를 회색 텍스트가 아니라 색이 있는 알약(완료=블루, 신규=앰버/대기)으로 보여줘
  // 한눈에 상태를 구분하기 쉽게 한다. 0건인 쪽은 톤을 낮춰(zero) 시선이 안 가게 한다.
  // labelOverride가 있으면 kind 기본 라벨(신규/완료) 대신 그 문구를 쓴다.
  function csPillHtml(kind, count, unit, labelOverride) {
    const cls = count === 0 ? 'cs-pill zero' : 'cs-pill ' + kind;
    const icon = kind === 'total' ? '' : '⏳';
    const label = labelOverride || (kind === 'total' ? '완료' : '신규');
    return '<span class="' + cls + '">' + (icon ? icon + ' ' : '') + label + ' <b>' + count + '</b>' + unit + '</span>';
  }

  function renderCallStatusPanelHtml() {
    if (!callStatusPanelOpen) return '';
    const counts = callStatusCounts();
    const breakdown = callStatusMenuBreakdown();
    const menuListHtml = breakdown.length
      ? breakdown.map(function (row) {
          return '<div class="cs-menu-row"><span class="cs-menu-name">' + esc(row.name) + '</span>' +
            '<span class="cs-menu-pills">' + csPillHtml('notCalled', row.notCalled, '개', '신규') + csPillHtml('total', row.done, '개', '완료') + '</span></div>';
        }).join('')
      : '<div class="cs-menu-row"><span class="cs-menu-name">처리중인 메뉴가 없어요</span></div>';
    return '<div class="call-status-panel">' +
      '<div class="call-status-summary">' + csPillHtml('notCalled', counts.notCalledCount, '개', '신규') + csPillHtml('total', counts.totalCount, '개', '완료') + '</div>' +
      '<div class="call-status-menu-list">' + menuListHtml + '</div>' +
      '</div>';
  }

  function updateCallStatusUI() {
    if (!root) return;
    const btnSlot = root.querySelector('#call-status-btn-slot');
    if (btnSlot) btnSlot.innerHTML = renderCallStatusButtonHtml();
    const panelSlot = root.querySelector('#call-status-panel-slot');
    if (panelSlot) panelSlot.innerHTML = renderCallStatusPanelHtml();
  }

  function sortLabel() { return sortDir === 'desc' ? '최신순' : '오래된순'; }

  function offlineBannerHtml() {
    return '<div class="offline-banner">오프라인 상태에요. 기기 네트워크를 점검해 주세요.</div>';
  }

  // 여러 메뉴가 동시에 자동 품절돼도 '메뉴명 외 N개'로 뭉치지 않고, 메뉴마다 각각 별도의 배너로 띄운다.
  function autoSoldoutBannerHtml() {
    return autoSoldoutNames.map(function (n) {
      return '<div class="auto-soldout-banner">' +
        '<span>' + window.Icons3D.iconLine('warning', 14) + ' ' + esc(n) + ' 메뉴가 자동 품절됐어요.</span>' +
        '<button type="button" class="auto-soldout-banner-close" data-action="dismiss-auto-soldout" data-name="' + esc(n) + '" aria-label="닫기">✕</button>' +
        '</div>';
    }).join('');
  }

  // 배너를 묶는 단위 키 — 해피아워 시간(시작~종료)이 완전히 같아야 같은 배너다.
  function happyHourRangeKey(p) { return (p.start || '') + '~' + (p.end || ''); }

  // 해피아워 시작도 자동 품절과 동일한 방식(팝업이 아니라 화면 상단 배너)으로 알린다.
  // 해피아워 시간이 같은 메뉴는 '외 n개'로 묶어 배너 하나로 띄운다 — 메뉴마다 배너를 쌓으면
  // 주문 목록이 그만큼 아래로 밀려 접수 화면을 가린다.
  // 반대로 시간이 다르면(15:00~16:00 / 15:00~17:00) 언제까지 할인인지가 달라 따로 띄운다.
  function happyHourBannerHtml() {
    if (!happyHourPromos.length) return '';
    const groups = [];
    const byKey = {};
    happyHourPromos.forEach(function (p) {
      const key = happyHourRangeKey(p);
      if (!byKey[key]) {
        byKey[key] = { key: key, start: p.start, end: p.end, items: [] };
        groups.push(byKey[key]);
      }
      byKey[key].items.push(p);
    });
    return groups.map(function (g) {
      const first = g.items[0];
      const rest = g.items.length - 1;
      const timeRange = (g.start && g.end) ? (g.start + '~' + g.end) : '';
      let label;
      if (rest > 0) {
        // 묶인 메뉴는 할인가가 서로 달라 하나로 적을 수 없으므로 할인가는 빼고 시간만 남긴다.
        label = esc(first.name) + ' 외 ' + rest + '개 메뉴가 해피아워 할인가로 판매를 시작해요' +
          (timeRange ? ' (' + timeRange + ')' : '');
      } else {
        const priceText = (first.price != null) ? window.UI.formatMoney(first.price) : '';
        const detail = priceText ? (priceText + (timeRange ? ' · ' + timeRange : '')) : timeRange;
        label = esc(first.name) + ' 메뉴가 해피아워 할인가로 판매를 시작해요' + (detail ? ' (' + detail + ')' : '');
      }
      return '<div class="happy-hour-banner">' +
        '<span>' + window.Icons3D.iconLine('flame', 14) + ' ' + label + '</span>' +
        '<button type="button" class="happy-hour-banner-close" data-action="dismiss-happy-hour"' +
        ' data-range="' + esc(g.key) + '" aria-label="닫기">✕</button>' +
        '</div>';
    }).join('');
  }

  // 호출/완료 횟수는 0회일 때는 굳이 보여줄 필요가 없어 숨기고, 1회부터는 버튼 옆 작은 뱃지로 노출한다
  // 배지 대신 버튼 라벨 한 줄 안에 (n회)로 붙여서 두 줄로 줄바꿈되지 않게 한다.
  function countText(n) {
    return n > 0 ? ' (' + n + '회)' : '';
  }

  // 취소 계열 액션(주문 거절/결제 취소/반품)은 오조작 방지를 위해 액션 버튼 행에 두지 않고,
  // 펼쳐보기 했을 때만 메타 영역에 연락처와 같은 배지 양식(라벨 + 알약 버튼)으로 노출한다 — 모든 탭에서
  // 동일한 규칙. 드러난 뒤의 동작/로직은 기존과 동일하다. 실제 렌더는 cancelActionRowHtml()이 담당한다.
  function renderActionsHtml(order, tabStatus, disabled) {
    const dAttr = disabled ? ' disabled' : '';
    if (tabStatus === 'WAITING') {
      return '<div class="order-card-actions">' +
        '<button type="button" class="btn btn-primary" data-action="accept-order" data-id="' + order.id + '"' + dAttr + '>주문 수락</button>' +
        '</div>';
    }
    if (tabStatus === 'PROCESSING') {
      return '<div class="order-card-actions">' +
        '<button type="button" class="btn btn-outline" data-action="call-customer" data-id="' + order.id + '"' + dAttr + '>손님 호출' + countText(order.calledCount || 0) + '</button>' +
        '<button type="button" class="btn btn-primary" data-action="complete-order" data-id="' + order.id + '"' + dAttr + '>완료' + countText(order.completeCount || 0) + '</button>' +
        '</div>';
    }
    // 완료 탭에서 취소/반품 처리된 건은 주문 복구·결제취소 버튼 대신, 처리 완료 시각이 담긴 뱃지로 대체한다
    if (order.canceled) {
      const timeLabel = order.cancelledAt ? ' (' + window.UI.clockLabelWithSeconds(order.cancelledAt) + ')' : '';
      const doneLabel = order.cancelType === 'CANCEL' ? '주문 취소 완료' : '결제 취소 완료';
      return '<div class="order-card-actions"><span class="badge badge-neutral cancel-done-badge">' + doneLabel + timeLabel + '</span></div>';
    }
    // '반품'(결제 취소)은 액션 버튼이 아니라 펼쳐보기의 메타 영역에 연락처와 같은 배지 양식으로 노출한다
    return '<div class="order-card-actions">' +
      '<button type="button" class="btn btn-outline" data-action="revert-order" data-id="' + order.id + '"' + dAttr + '>주문 복구</button>' +
      '</div>';
  }

  // 미수락/처리중/완료(취소 안 된 건) 각 탭의 취소성 액션을, 연락처와 같은 메타 배지 양식으로 통일해서 만든다.
  function cancelActionRowHtml(order, tabStatus, disabled) {
    const dAttr = disabled ? ' disabled' : '';
    if (tabStatus === 'WAITING') {
      return '<div class="meta-row"><span class="meta-label">취소</span><span class="meta-value"><button type="button" class="phone-btn phone-btn-danger" data-action="cancel-order" data-id="' + order.id + '"' + dAttr + '>주문 거절</button></span></div>';
    }
    if (tabStatus === 'PROCESSING') {
      return '<div class="meta-row"><span class="meta-label">취소</span><span class="meta-value"><button type="button" class="phone-btn phone-btn-danger" data-action="cancel-payment" data-id="' + order.id + '"' + dAttr + '>결제 취소</button></span></div>';
    }
    if (tabStatus === 'DONE' && !order.canceled) {
      return '<div class="meta-row"><span class="meta-label">반품</span><span class="meta-value"><button type="button" class="phone-btn phone-btn-danger" data-action="return-order" data-id="' + order.id + '"' + dAttr + '>결제 취소</button></span></div>';
    }
    return '';
  }

  function topBadgesHtml(order) {
    if (order.isReservation) {
      const resTime = new Date(order.reservationTime || order.orderedAt).getTime();
      const overdueMins = Math.round((Date.now() - resTime) / 60000);
      const isOverdue = overdueMins > 0;
      const timeLabel = window.UI.clockLabel(order.reservationTime || order.orderedAt);
      const urgencyCls = isOverdue ? (overdueMins >= 10 ? ' urgent' : ' normal') : '';
      const overdueText = isOverdue ? ' · ' + overdueMins + '분 지남' : '';
      return '<span class="elapsed-badge reservation' + urgencyCls + '">' + window.Icons3D.iconLine('calendarLine', 12) + ' ' + timeLabel + ' 예약' + overdueText + '</span>';
    }
    const mins = window.UI.elapsedMinutes(order.orderedAt);
    const urgencyCls = mins >= 10 ? 'urgent' : 'normal';
    return '<span class="elapsed-badge ' + urgencyCls + '">● ' + window.UI.clockLabel(order.orderedAt) + ' · ' + window.UI.elapsedLabel(order.orderedAt) + '</span>';
  }

  function renderOrderCard(order, tabStatus, disabled) {
    const expanded = isCardExpanded(order.id);
    const cls = 'order-card' + (order.canceled ? ' canceled' : '') + (selectedIds.has(order.id) ? ' selected' : '');
    let html = '<div class="' + cls + '">';

    // 상단 상태 행: 경과시간/예약시간(좌) + 호출번호(우) — 조리 우선순위와 호출 정보를 한눈에
    html += '<div class="order-card-top-row">' +
      '<div class="top-badges">' + topBadgesHtml(order) + '</div>' +
      '<span class="pickup-inline"><span class="pickup-label">' + (order.identifierType === 'SEAT' ? '자리' : '호출번호') + '</span><span class="pickup-value">' + esc(order.pickupNo) + '</span></span>' +
      '</div>';

    // 배달·프로모션 배지는 한눈에 파악해야 할 핵심 정보라 '간단히 보기'에서도 항상 노출한다
    // 예약 여부는 상단의 [예약 HH:MM] 배지로 이미 표시되므로 헤더에 별도 예약 배지를 중복 노출하지 않는다
    // 해피아워는 주문 카드에 배지로 표시하지 않는다 — 대신 해피아워가 시작되는 순간 팝업으로 알린다(handleHappyHourStarted)
    // 주문 채널(키오스크/QR오더/임의 생성 주문)도 헤더 배지 없이 상세보기의 '주문 유형' 행으로만 노출한다
    const deliveryHtml = order.identifierType === 'SEAT' ? '<span class="badge badge-neutral">' + window.Icons3D.iconLine('scooterLine', 13) + ' 배달 주문</span>' : '';
    const promoHtml = order.promoType === 'HAPPY_HOUR' ? '' : window.UI.promoBadgeHtml(order.promoType);
    if (deliveryHtml || promoHtml) {
      html += '<div class="order-card-header-row">' + deliveryHtml + promoHtml + '</div>';
    }

    html += '<div class="order-card-items">' + itemListHtml(order) + '</div>';

    // 손님 요청(메모)은 조리 시 바로 확인해야 하는 정보라 '간단히 보기'에서도 항상 노출한다
    if (order.customerNote) {
      html += '<div class="order-card-note">' + window.Icons3D.iconLine('notice2', 14) + ' ' + esc(order.customerNote) + '</div>';
    }
    if (order.canceled) {
      const typeLabel = order.cancelType === 'RETURN' ? '결제 취소' : (order.cancelType === 'PAYMENT_CANCEL' ? '결제 취소' : '주문 거절');
      html += '<div class="order-card-cancel-reason">[' + typeLabel + '] ' + esc(order.cancelReason || '') + '</div>';
    }

    // 인라인 힌트 행 — 안에 뭐가 있는지 미리 알려주는 텍스트로 이 카드만 펼쳐보기/간단히보기를 개별 전환할 수 있다
    html += '<button type="button" class="card-detail-toggle" data-action="toggle-card-expand" data-order-id="' + order.id + '">' +
      '<span class="cdt-label">' + (expanded ? '접기' : '상세보기 <span class="cdt-hint">· 결제 취소·연락처·결제 금액 등</span>') + '</span>' +
      '<span class="cdt-chev">' + (expanded ? '▴' : '▾') + '</span>' +
      '</button>';

    // 연락처/결제수단/주문번호는 '펼쳐보기'에서만 노출한다 (접수·예약시각은 상단 배지로 이동)
    // 순서: 취소성 액션(배지) → 연락처(문구형 링크) → 주문 유형 → 결제정보 → 주문번호
    if (expanded) {
      // 임의 주문 생성(카운터 접수)은 손님 연락처를 안 남기고 접수할 수도 있으므로, 없으면 안내 문구를 둔다
      // 연락처는 더 이상 버튼형 배지가 아니라 문구형 링크로 노출한다 — 밑줄 + '›' 화살표로 연결된 동작(전화/메일)이
      // 있다는 것만 알려주고, 클릭 동작(open-contact) 자체는 기존과 동일하다.
      const contactHtml = order.customerContact
        ? (function () {
            const contact = window.UI.formatContact(order.customerContact);
            const isEmailContact = order.customerContact.indexOf('@') !== -1;
            const contactIcon = window.Icons3D.iconLine(isEmailContact ? 'mail' : 'phoneCall', 14);
            return '<button type="button" class="contact-link-btn" data-action="open-contact" data-contact="' + esc(order.customerContact) + '" data-is-email="' + (isEmailContact ? '1' : '0') + '">' + contactIcon + ' ' + esc(contact) + '<span class="cl-arrow">›</span></button>';
          })()
        : '연락처 없음(카운터 접수)';
      html += '<div class="order-card-meta">' +
        cancelActionRowHtml(order, tabStatus, disabled) +
        '<div class="meta-row"><span class="meta-label">연락처</span><span class="meta-value">' + contactHtml + '</span></div>' +
        '<div class="meta-row"><span class="meta-label">주문 유형</span><span class="meta-value">' + esc(window.UI.channelTypeLabel(order.channel)) + '</span></div>' +
        '<div class="meta-row"><span class="meta-label">결제정보</span><span class="meta-value">' + esc(order.paymentMethod) + ' · ' + window.UI.formatMoney(order.amount) + '</span></div>' +
        '<div class="meta-row"><span class="meta-label">주문번호</span><span class="meta-value">' + esc(order.paymentOrderNo) + '</span></div>' +
        '</div>';
    }

    // 주문취소/결제취소/반품 처리된 완료 탭 건은 주문 복구·반품 버튼을 비활성화한다
    const actionsDisabled = disabled || (tabStatus === 'DONE' && order.canceled);
    html += renderActionsHtml(order, tabStatus, actionsDisabled);
    html += '</div>';
    return html;
  }

  function renderBucketHeader(group, tabStatus, disabled) {
    const showCheckbox = tabStatus !== 'DONE';
    const allSelected = showCheckbox && group.orders.length > 0 && group.orders.every(function (o) { return selectedIds.has(o.id); });
    return '<div class="bucket-header">' +
      '<div class="bucket-header-left">' +
      (showCheckbox ? '<input type="checkbox" data-action="bucket-select-all" data-bucket="' + group.key + '"' + (allSelected ? ' checked' : '') + (disabled ? ' disabled' : '') + ' />' : '') +
      '<span class="bucket-label">' + group.label + '</span>' +
      '</div>' +
      '</div>';
  }

  function renderGroupsHtml(groups, allOrders, disabled) {
    const tabStatus = currentStatus();
    if (!allOrders.length) {
      if (searchQuery) return '' + window.UI.emptyStateHtml('magnifier', '검색 결과가 없어요') + '';
      return '' + window.UI.emptyStateHtml('inbox', '주문 내역이 없어요') + '';
    }
    return groups.map(function (g) {
      return renderBucketHeader(g, tabStatus, disabled) + g.orders.map(function (o) { return renderOrderCard(o, tabStatus, disabled); }).join('');
    }).join('');
  }

  function renderBulkBarHtml(disabled) {
    const tabStatus = currentStatus();
    if (tabStatus === 'DONE' || selectedIds.size === 0) return '';
    const n = selectedIds.size;
    const dAttr = disabled ? ' disabled' : '';
    if (tabStatus === 'WAITING') {
      return '<div class="bulk-action-bar"><button type="button" class="btn btn-primary" data-action="bulk-accept"' + dAttr + '>선택 ' + n + '건 주문 수락</button></div>';
    }
    return '<div class="bulk-action-bar">' +
      '<button type="button" class="btn btn-outline" data-action="bulk-call"' + dAttr + '>선택 ' + n + '건 손님 호출</button>' +
      '<button type="button" class="btn btn-primary" data-action="bulk-complete"' + dAttr + '>선택 ' + n + '건 완료</button>' +
      '</div>';
  }

  // 모든 주문 컨트롤(수락/취소/호출/완료/주문 복구/반품 등)은 오프라인이거나 매장이 '마감' 상태면
  // 비활성화한다. '일시중지'는 새 주문만 잠시 안 받는 것이라, 이미 들어온 주문은 그대로 처리할 수 있어야
  // 하므로 컨트롤을 막지 않는다.
  function controlsDisabled() {
    return !isOnline || (store && store.operatingStatus === 'CLOSED');
  }

  // ---------------- 리스트 갱신 (부분 렌더 — 검색창 포커스 유지) ----------------
  function updateList() {
    if (!root) return;
    const disabled = controlsDisabled();
    const orders = fetchOrders();
    const groups = window.UI.groupByBucket(orders, sortDir);
    const wrap = root.querySelector('#order-list-wrap');
    const hasBulkBar = currentStatus() !== 'DONE' && selectedIds.size > 0;
    wrap.className = 'order-list' + (hasBulkBar ? ' with-bulk-bar' : '');
    wrap.innerHTML = renderGroupsHtml(groups, orders, disabled);
    const bulkSlot = root.querySelector('#bulk-bar-slot');
    if (bulkSlot) bulkSlot.innerHTML = renderBulkBarHtml(disabled);
    const tabsEl = root.querySelector('#segment-tabs');
    if (tabsEl) tabsEl.innerHTML = renderSegmentTabsHtml();
    updateCallStatusUI();
  }

  const ORDER_TYPE_LABELS = { RESERVATION: '예약 주문만', DELIVERY: '배달 주문만' };

  // 주문 방식 관리(설정)에서 꺼둔 유형은 필터 목록에서도 숨긴다 — 받지도 않는 유형을 필터로 보여주는 건 혼란스럽다
  function getOrderTypeOptions() {
    const settings = window.MockApi.getOrderChannelSettings(storeId);
    const opts = [];
    if (settings.acceptReservationOrders) opts.push({ v: 'RESERVATION', label: ORDER_TYPE_LABELS.RESERVATION });
    if (settings.acceptSeatOrders) opts.push({ v: 'DELIVERY', label: ORDER_TYPE_LABELS.DELIVERY });
    return opts;
  }

  const CALLED_STATUS_OPTIONS = [
    { v: 'CALLED', label: '호출 주문만' },
    { v: 'NOT_CALLED', label: '미호출 주문만' },
  ];
  const CALLED_STATUS_LABELS = { CALLED: '호출 주문만', NOT_CALLED: '미호출 주문만' };

  function filterBtnLabel() {
    const calledLabel = CALLED_STATUS_LABELS[calledFilter];
    const parts = (calledLabel ? [calledLabel] : []).concat(menuFilters).concat(orderTypeFilters.map(function (t) { return ORDER_TYPE_LABELS[t] || t; }));
    if (parts.length === 1) return parts[0];
    if (parts.length >= 2) return parts[0] + ' +' + (parts.length - 1);
    return '주문 필터';
  }

  function updateFilterBtnLabel() {
    const btn = root.querySelector('#order-filter-btn');
    if (!btn) return;
    btn.textContent = filterBtnLabel();
    btn.classList.toggle('active', menuFilters.length > 0 || orderTypeFilters.length > 0 || calledFilter !== 'ALL');
  }

  // 호출번호 검색은 미수락/처리중/완료 탭을 넘나들며 유지된다 — 탭을 옮겨도 검색어를 지우지 않는다
  function switchTab(idx) {
    if (idx < 0 || idx >= tabs.length) return;
    currentIndex = idx;
    selectedIds = new Set();
    menuFilters = [];
    orderTypeFilters = [];
    calledFilter = 'ALL';
    callStatusPanelOpen = false;
    updateFilterBtnLabel();
    updateList();
  }

  // ---------------- 주문 필터 바텀시트 (호출 여부 + 메뉴별 + 주문 유형별, 각 카테고리 내에서도 중복 선택 가능) ----------------
  // 두 카테고리를 서로 배타적인 탭으로 나누지 않고, 각각 다중 선택 가능한 칩으로 노출한 뒤
  // '적용'을 눌러야 실제로 반영되도록 해 다양한 조합(메뉴+메뉴, 유형+유형, 메뉴+유형)을 자유롭게 시도해볼 수 있게 한다.
  // 호출 여부는 성격상 단일 선택(호출 주문만 / 미호출 주문만 중 하나, 또는 둘 다 미선택=전체)이라 다른 카테고리와 달리 배타적으로 토글한다.
  function openOrderFilterSheet() {
    let draftMenus = menuFilters.slice();
    let draftTypes = orderTypeFilters.slice();
    let draftCalled = calledFilter;
    const showCalledSection = currentStatus() !== 'WAITING'; // 대기 탭은 아직 호출 개념이 없으므로 숨긴다
    const ordersInTab = window.MockApi.getOrders(storeId, { status: currentStatus() });
    const menuNames = [];
    ordersInTab.forEach(function (o) {
      o.items.forEach(function (it) {
        if (menuNames.indexOf(it.menuName) === -1) menuNames.push(it.menuName);
      });
    });

    function calledChipsHtml() {
      return CALLED_STATUS_OPTIONS.map(function (o) {
        return '<button type="button" class="filter-chip' + (draftCalled === o.v ? ' on' : '') + '" data-called-status="' + o.v + '">' + o.label + '</button>';
      }).join('');
    }

    function menuChipsHtml() {
      if (!menuNames.length) return '<div class="empty-state"><div>필터링할 메뉴가 없어요</div></div>';
      return menuNames.map(function (name) {
        return '<button type="button" class="filter-chip' + (draftMenus.indexOf(name) !== -1 ? ' on' : '') + '" data-menu="' + esc(name) + '">' + esc(name) + '</button>';
      }).join('');
    }

    function typeChipsHtml() {
      return getOrderTypeOptions().map(function (o) {
        return '<button type="button" class="filter-chip' + (draftTypes.indexOf(o.v) !== -1 ? ' on' : '') + '" data-order-type="' + o.v + '">' + o.label + '</button>';
      }).join('');
    }

    const bodyHtml =
      '<div class="filter-sheet-header">' +
        '<div class="sheet-title" style="margin:0;">주문 필터</div>' +
        '<button type="button" class="filter-reset-link" id="filter-reset-btn">' + ICON_REFRESH_SM + ' 초기화</button>' +
      '</div>' +
      (showCalledSection ?
        '<div class="filter-section">' +
          '<div class="filter-section-title">호출 여부</div>' +
          '<div class="filter-chip-row" id="called-chip-row">' + calledChipsHtml() + '</div>' +
        '</div>' : '') +
      '<div class="filter-section">' +
        '<div class="filter-section-title">메뉴 (중복 선택 가능)</div>' +
        '<div class="filter-chip-row" id="menu-chip-row">' + menuChipsHtml() + '</div>' +
      '</div>' +
      '<div class="filter-section">' +
        '<div class="filter-section-title">주문 유형 (중복 선택 가능)</div>' +
        '<div class="filter-chip-row" id="type-chip-row">' + typeChipsHtml() + '</div>' +
      '</div>' +
      '<div class="filter-sheet-actions">' +
        '<button type="button" class="btn btn-primary" id="filter-apply-btn">적용</button>' +
      '</div>';

    window.UI.showBottomSheet(bodyHtml, function (host) {
      const calledRow = host.querySelector('#called-chip-row');
      const menuRow = host.querySelector('#menu-chip-row');
      const typeRow = host.querySelector('#type-chip-row');

      function bindCalledChips() {
        if (!calledRow) return;
        calledRow.querySelectorAll('[data-called-status]').forEach(function (el) {
          el.addEventListener('click', function () {
            const v = el.getAttribute('data-called-status');
            draftCalled = (draftCalled === v) ? 'ALL' : v;
            calledRow.querySelectorAll('[data-called-status]').forEach(function (btn) {
              btn.classList.toggle('on', btn.getAttribute('data-called-status') === draftCalled);
            });
          });
        });
      }

      function bindMenuChips() {
        menuRow.querySelectorAll('[data-menu]').forEach(function (el) {
          el.addEventListener('click', function () {
            const name = el.getAttribute('data-menu');
            const idx = draftMenus.indexOf(name);
            if (idx === -1) draftMenus.push(name); else draftMenus.splice(idx, 1);
            el.classList.toggle('on', draftMenus.indexOf(name) !== -1);
          });
        });
      }

      function bindTypeChips() {
        typeRow.querySelectorAll('[data-order-type]').forEach(function (el) {
          el.addEventListener('click', function () {
            const v = el.getAttribute('data-order-type');
            const idx = draftTypes.indexOf(v);
            if (idx === -1) draftTypes.push(v); else draftTypes.splice(idx, 1);
            el.classList.toggle('on', draftTypes.indexOf(v) !== -1);
          });
        });
      }

      bindCalledChips();
      bindMenuChips();
      bindTypeChips();

      host.querySelector('#filter-reset-btn').addEventListener('click', function () {
        draftMenus = [];
        draftTypes = [];
        draftCalled = 'ALL';
        if (calledRow) calledRow.querySelectorAll('[data-called-status]').forEach(function (btn) { btn.classList.remove('on'); });
        menuRow.innerHTML = menuChipsHtml();
        typeRow.innerHTML = typeChipsHtml();
        bindMenuChips();
        bindTypeChips();
      });

      host.querySelector('#filter-apply-btn').addEventListener('click', function () {
        menuFilters = draftMenus;
        orderTypeFilters = draftTypes;
        calledFilter = draftCalled;
        window.UI.closeModal();
        updateFilterBtnLabel();
        updateList();
      });
    });
  }

  // ---------------- 취소/반품 사유 모달 ----------------
  const REASON_MAX_LEN = 20;

  // 취소 사유 팝업. needPassword가 true면 비밀번호 입력란을 같은 팝업에 함께 둔다 —
  // 사유 선택 → 확인 → 비밀번호 팝업으로 2단계를 밟게 하면, 사장님은 이미 '취소한다'고
  // 마음먹은 상태에서 창을 두 번 넘겨야 한다. 확인해야 할 것(사유·권한)을 한 화면에 모은다.
  function openReasonModal(onConfirm, needPassword) {
    let selected = null;
    let customText = '';
    let password = '';
    let pwError = '';

    function computeReason() {
      // 취소 사유는 손님에게 그대로 알림톡으로 나가고 주문 이력에 남는 문구라, 한 줄로 읽히는
      // 길이로 묶는다. 화면(maxlength)뿐 아니라 여기서도 잘라 저장값의 상한을 보장한다.
      if (selected === '직접 입력') return customText.trim().slice(0, REASON_MAX_LEN);
      return selected;
    }

    function canConfirm() {
      if (!computeReason()) return false;
      if (needPassword && !password) return false;
      return true;
    }

    function renderModal() {
      const options = ['재료 소진', '손님 요청', '영업 마감', '손님 미수령', '직접 입력'];
      let bodyHtml = '<div class="reason-pill-row">' + options.map(function (opt) {
        return '<button type="button" class="pill-btn reason-pill' + (selected === opt ? ' active' : '') + '" data-reason="' + opt + '">' + opt + '</button>';
      }).join('') + '</div>';
      if (selected === '직접 입력') {
        bodyHtml += '<textarea class="input-field reason-textarea" id="reason-textarea" maxlength="' + REASON_MAX_LEN + '"' +
          ' placeholder="사유를 입력해 주세요 (최대 ' + REASON_MAX_LEN + '자)">' + esc(customText) + '</textarea>' +
          '<div class="reason-counter" id="reason-counter">' + customText.length + ' / ' + REASON_MAX_LEN + '</div>';
      }
      if (needPassword) {
        bodyHtml += '<div class="reason-pw-block">' +
          '<div class="reason-pw-label">' + window.Icons3D.iconLine('lockLine', 14) + ' 권한 잠금이 설정된 항목이에요</div>' +
          '<input type="password" inputmode="numeric" class="input-field" id="reason-password"' +
            ' placeholder="비밀번호를 입력해 주세요" value="' + esc(password) + '" />' +
          (pwError ? '<div class="reason-pw-error">' + esc(pwError) + '</div>' : '') +
          '</div>';
      }
      const confirmDisabled = !canConfirm();

      window.UI.showModal({
        title: '취소 사유를 입력해 주세요.',
        bodyHtml: bodyHtml,
        // '직접 입력'을 고르고 텍스트를 타이핑하는 동안에는 renderModal()이 다시 불리지 않고
        // 아래 textarea 리스너가 버튼의 disabled 속성만 직접 지워준다 — 그래서 여기서 값을
        // 미리 계산해 캡처해두면(reasonValue) 클릭 시점엔 여전히 빈 문자열이라 취소가 씹힌다.
        // 클릭하는 순간 computeReason()을 다시 호출해 항상 최신 입력값을 읽는다.
        buttons: [
          // 주문·결제를 되돌리는 파괴적 동작이라 확정 버튼은 빨간색(btn-danger-solid)으로 둔다.
          {
            label: '취소하기', variant: 'btn-danger-solid',
            onClick: function () {
              const v = computeReason();
              if (!v) return;
              if (!needPassword) { onConfirm(v); return; }
              // 비밀번호가 틀리면 방금 고른 사유를 그대로 들고 팝업을 다시 그린다.
              // showModal은 onClick 전에 closeModal을 호출하므로, renderModal()이 곧 '다시 열기'다.
              if (!window.MockApi.verifyPermissionLockPassword(storeId, password)) {
                pwError = '비밀번호가 일치하지 않아요';
                password = '';
                renderModal();
                return;
              }
              onConfirm(v);
            },
          },
          { label: '닫기', variant: 'btn-secondary' },
        ],
      });

      const host = document.getElementById('modal-host');
      const btns = host.querySelectorAll('.btn');
      if (confirmDisabled && btns[0]) btns[0].setAttribute('disabled', 'disabled');

      host.querySelectorAll('.reason-pill').forEach(function (btn) {
        btn.addEventListener('click', function () {
          selected = btn.getAttribute('data-reason');
          if (selected !== '직접 입력') customText = '';
          renderModal();
        });
      });
      function syncConfirmEnabled() {
        const confirmBtn = host.querySelectorAll('.btn')[0];
        if (!confirmBtn) return;
        if (canConfirm()) confirmBtn.removeAttribute('disabled');
        else confirmBtn.setAttribute('disabled', 'disabled');
      }

      const ta = document.getElementById('reason-textarea');
      if (ta) {
        const counter = document.getElementById('reason-counter');
        ta.addEventListener('input', function () {
          // maxlength는 붙여넣기까지 막아주지만 한글 조합 중에는 순간적으로 넘길 수 있어
          // 값을 직접 잘라 상한을 보장한다.
          if (ta.value.length > REASON_MAX_LEN) ta.value = ta.value.slice(0, REASON_MAX_LEN);
          customText = ta.value;
          if (counter) {
            counter.textContent = customText.length + ' / ' + REASON_MAX_LEN;
            counter.classList.toggle('full', customText.length >= REASON_MAX_LEN);
          }
          syncConfirmEnabled();
        });
        ta.focus();
      }
      const pw = document.getElementById('reason-password');
      if (pw) {
        pw.addEventListener('input', function () {
          password = pw.value;
          syncConfirmEnabled();
        });
        // 사유를 먼저 고르는 흐름이라, 사유가 정해진 뒤에만 비밀번호로 포커스를 옮긴다.
        if (!ta && computeReason()) pw.focus();
      }
    }
    renderModal();
  }

  // ---------------- 주문 액션 ----------------
  function handleAccept(id) {
    const res = window.MockApi.acceptOrder(id);
    window.UI.toast('카카오 알림톡 발송: ' + res.notification);
    updateList();
  }

  // 키오스크 + VAN 결제건은 실물 카드가 있어야 취소·반품이 가능해 이 화면에서 처리할 수 없다
  function blockIfVanTabletPayment(order, proceed) {
    if (order && order.channel === 'TABLET' && order.paymentMethod === 'VAN') {
      window.UI.showModal({
        title: '실물 카드가 필요해요',
        message: "주문 거절에 '실물 카드'가 필요해요.<br/><strong>키오스크에서 취소</strong>해 주세요.",
        buttons: [{ label: '확인', variant: 'btn-primary' }],
      });
      return;
    }
    proceed();
  }

  function handleCancelOrder(id) {
    const order = window.MockApi.getOrder(id);
    blockIfVanTabletPayment(order, function () {
      openReasonModal(function (reason) {
        const res = window.MockApi.cancelOrder(id, reason);
        window.UI.toast('카카오 알림톡 발송: ' + res.notification);
        updateList();
      });
    });
  }

  function handleCallCustomer(id) {
    function proceed() {
      const res = window.MockApi.callCustomer(id);
      window.UI.toast('카카오 알림톡 발송: ' + res.notification);
      updateList();
    }
    const order = window.MockApi.getOrder(id);
    if (order && order.calledCount > 0) {
      window.UI.confirmModal(
        '다시 호출할까요?',
        '이미 호출한 주문건이에요. 다시 알림을 보낼까요?',
        '다시 호출하기',
        proceed
      );
      return;
    }
    proceed();
  }

  function handleComplete(id) {
    function proceed() {
      window.MockApi.completeOrder(id);
      updateList();
    }
    const order = window.MockApi.getOrder(id);
    if (order && !order.called) {
      window.UI.confirmModal(
        '호출 없이 완료할까요?',
        '아직 손님을 호출하지 않았어요. 호출 없이 주문을 완료 처리할까요?',
        '완료하기',
        proceed
      );
      return;
    }
    proceed();
  }

  function handleCancelPayment(id) {
    const order = window.MockApi.getOrder(id);
    // 잠금이 걸려 있으면 별도 비밀번호 팝업을 띄우지 않고, 사유 팝업 안에 입력란을 함께 둔다.
    const lock = window.MockApi.getPermissionLockStatus(storeId);
    const needPassword = !!(lock.isSet && lock.scopes && lock.scopes.paymentCancel);
    blockIfVanTabletPayment(order, function () {
      openReasonModal(function (reason) {
        const res = window.MockApi.cancelPayment(id, reason);
        window.UI.toast('카카오 알림톡 발송: ' + res.notification);
        updateList();
      }, needPassword);
    });
  }

  // 실수로 전화가 걸리거나 메일이 열리지 않도록, 이동 전에 한 번 확인한다
  function handleOpenContact(contact, isEmail) {
    if (!contact) return;
    window.UI.confirmModal(
      '손님 연락처로 이동하시겠어요?',
      contact,
      isEmail ? '메일 보내기' : '전화 걸기',
      function () { window.location.href = (isEmail ? 'mailto:' : 'tel:') + contact; },
      { cancelLabel: '닫기' }
    );
  }

  function handleRevert(id) {
    window.UI.confirmModal(
      '정말 주문을 복구할까요?',
      '주문이 처리중 상태로 돌아가요.',
      '주문 복구',
      function () {
        window.MockApi.revertOrder(id);
        updateList();
      },
      { cancelLabel: '닫기' }
    );
  }

  function handleReturn(id) {
    const order = window.MockApi.getOrder(id);
    function proceed() {
      openReasonModal(function (reason) {
        const res = window.MockApi.returnOrder(id, reason);
        window.UI.toast('카카오 알림톡 발송: ' + res.notification);
        updateList();
      });
    }
    blockIfVanTabletPayment(order, function () {
      window.UI.requirePasswordGate(storeId, 'paymentCancel', '결제 취소', proceed);
    });
  }

  function doBulkAccept() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    window.UI.confirmModal(
      '선택한 ' + ids.length + '건을 수락할까요?',
      '선택한 주문이 처리중으로 이동해요.',
      '수락하기',
      function () {
        window.MockApi.bulkAction(ids, 'accept');
        window.UI.toast('카카오 알림톡 발송: 주문 완료 (' + ids.length + '건)');
        selectedIds = new Set();
        updateList();
      }
    );
  }

  function doBulkComplete() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    // 단건 완료는 호출하지 않은 주문에 '호출 없이 완료할까요?'로 경고한다. 일괄에서 그 경고가
    // 빠지면 손님이 알림을 못 받은 채로 여러 건이 한 번에 완료되므로, 섞여 있는 미호출 건수를 알려준다.
    const uncalled = ids.filter(function (id) {
      const o = window.MockApi.getOrder(id);
      return o && !o.called;
    }).length;
    const message = uncalled
      ? '아직 호출하지 않은 주문 ' + uncalled + '건이 있어요. 완료하면 선택한 주문이 완료 탭으로 이동해요.'
      : '선택한 주문이 완료 탭으로 이동해요.';
    window.UI.confirmModal(
      '선택한 ' + ids.length + '건을 완료처리할까요?',
      message,
      '완료하기',
      function () {
        window.MockApi.bulkAction(ids, 'complete');
        selectedIds = new Set();
        updateList();
      }
    );
  }

  function doBulkCall() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    window.UI.confirmModal(
      '선택한 ' + ids.length + '건을 호출할까요?',
      '선택한 주문의 손님에게 픽업 안내 알림을 보내요.',
      '호출하기',
      function () {
        window.MockApi.bulkAction(ids, 'call');
        window.UI.toast('카카오 알림톡 발송: 픽업 안내 (' + ids.length + '건)');
        selectedIds = new Set();
        updateList();
      }
    );
  }

  // ---------------- 설정 / 오프라인 ----------------
  function onSettingsClick() {
    window.Router.showScreen('settings');
  }

  // 목록을 수동으로 다시 불러온다 — 회전 애니메이션으로 새로고침이 실행됐다는 걸 보여준다
  function handleRefresh(btn) {
    if (btn) {
      btn.classList.remove('spinning');
      void btn.offsetWidth;
      btn.classList.add('spinning');
    }
    updateList();
    window.UI.toast('주문 목록을 새로고침했어요');
  }

  // ---------------- 영업 상태 변경 ----------------
  // 마감 시 실제로 완료 처리되는 대상과 같은 조건으로 센다(처리중·취소 아님) — 안내 문구의 건수가
  // closeStoreAndCompleteProcessing이 실제로 완료시키는 건수와 어긋나지 않게 한다.
  // 마감 시 완료 처리될 건수. mockApi가 실제로 완료시키는 조건(미수락+처리중, 취소 제외)을
  // 그대로 쓰는 함수를 호출해, 팝업의 'n건'과 실제 처리 건수가 어긋날 수 없게 한다.
  function closingOrderCount() {
    return window.MockApi.ordersClosedOnCloseCount(storeId);
  }

  function refreshStatusButton() {
    const slot = root.querySelector('#status-btn-slot');
    if (slot) slot.innerHTML = renderStatusButtonHtml();
  }

  function applyOperatingStatus(next, before) {
    if (next === 'CLOSED') {
      const res = window.MockApi.closeStoreAndCompleteProcessing(storeId);
      store = window.MockApi.getStore(storeId);
      window.UI.toast(res.completedCount > 0
        ? ('영업을 마감했어요 · 남아있던 주문 ' + res.completedCount + '건이 완료 처리됐어요')
        : '영업을 마감했어요');
    } else {
      store = window.MockApi.updateOperatingStatus(storeId, next);
      if (next === 'PAUSED') window.UI.toast('일시중지로 변경했어요');
      else window.UI.toast(before === 'PAUSED' ? '일시중지를 해제했어요' : '영업을 시작했어요');
    }
    refreshStatusButton();
    // 영업중이 되면 타이머가 꺼지고, 마감·일시중지가 되면 그 시점부터 20분을 새로 센다.
    scheduleIdleReopenPrompt();
    updateList();
  }

  // 설정 화면과 같은 잠금 정책을 적용한다 — 개점(마감→영업)과 마감만 비밀번호로 보호하고,
  // 일시중지/일시중지 해제는 계속 영업 중인 상태라 보호 대상이 아니다. 이 화면에서만 잠금을 빼면
  // 설정 화면의 잠금을 우회하는 구멍이 된다.
  // ---- 무동작 개점 요청 바텀시트 ----
  // 마감·일시중지 상태로 주문 화면을 열어둔 채 아무 조작이 없으면, 사장님이 개점을 잊은
  // 것일 수 있다(손님은 주문이 안 되는데 화면은 켜져 있는 상황). 20분마다 한 번 확인한다.
  // 영업중일 때는 띄우지 않고, 조작이 있으면 타이머를 처음부터 다시 센다.
  const IDLE_REOPEN_MS = 20 * 60 * 1000;
  let idleTimerId = null;

  function clearIdleTimer() {
    if (idleTimerId) { clearTimeout(idleTimerId); idleTimerId = null; }
  }

  function scheduleIdleReopenPrompt() {
    clearIdleTimer();
    if (!store || store.operatingStatus === 'OPEN') return;
    idleTimerId = setTimeout(function () {
      idleTimerId = null;
      // 타이머가 걸린 뒤 상태가 바뀌었을 수 있으므로 띄우는 순간 다시 확인한다.
      store = window.MockApi.getStore(storeId);
      if (!store || store.operatingStatus === 'OPEN') return;
      showReopenSheet();
    }, IDLE_REOPEN_MS);
  }

  function showReopenSheet() {
    // 이 시트는 마감과 일시중지 양쪽에서 뜨므로 상태명을 고정하지 않는다 — 일시중지인데
    // '마감 상태에요'라고 하면 문구가 사실과 어긋난다.
    const isPaused = store.operatingStatus === 'PAUSED';
    const label = isPaused ? '일시중지' : '마감';
    window.UI.showBottomSheet(
      '<div class="sheet-title">지금 영업을 시작할까요?</div>' +
      '<div class="reopen-sheet-desc">' +
      '<strong>지금은 <span class="reopen-status ' + (isPaused ? 'paused' : 'closed') + '">' + label + '</span> 상태에요.</strong><br/>' +
      '개점해야 손님이 주문할 수 있어요.</div>' +
      '<div class="reopen-sheet-actions">' +
      '<button type="button" class="btn op-pastel-green" id="reopen-sheet-ok">개점</button>' +
      '<button type="button" class="btn btn-secondary" id="reopen-sheet-close">닫기</button>' +
      '</div>',
      // 바텀시트는 #modal-host 안에 그려져 root의 클릭 위임을 타지 않으므로 여기서 직접 묶는다.
      function (host) {
        host.querySelector('#reopen-sheet-ok').addEventListener('click', function () {
          window.UI.closeModal();
          requestOperatingStatus('OPEN');
        });
        host.querySelector('#reopen-sheet-close').addEventListener('click', function () {
          window.UI.closeModal();
          // 닫기만 눌러도 여전히 마감 상태이므로, 20분 뒤 다시 물어보도록 타이머를 재설정한다.
          scheduleIdleReopenPrompt();
        });
      }
    );
  }

  function requestOperatingStatus(next) {
    const before = store.operatingStatus;
    function run() { applyOperatingStatus(next, before); }
    const isRealOpen = next === 'OPEN' && before === 'CLOSED';
    if (isRealOpen || next === 'CLOSED') {
      window.UI.requirePasswordGate(storeId, 'statusChange', '영업상태 변경(개점·마감)', run);
    } else {
      run();
    }
  }

  // 마감은 진행 중인 주문까지 완료 처리되는 되돌릴 수 없는 동작이라, 어느 경로로 들어와도 한 번 더 묻는다.
  function openCloseConfirmModal() {
    window.UI.showModal({
      title: '영업을 마감할까요?',
      message: '미수락·처리중 주문 ' + closingOrderCount() + '건이 모두 완료 처리돼요.<br/>정말 마감하시나요?',
      buttons: [
        { label: '마감', variant: 'op-pastel-red', onClick: function () { requestOperatingStatus('CLOSED'); } },
        { label: '닫기', variant: 'btn-secondary' },
      ],
    });
  }

  function handleOperatingStatusClick() {
    const st = store.operatingStatus;
    if (st === 'CLOSED') {
      window.UI.showModal({
        title: '지금 영업을 시작할까요?',
        message: '개점하면 손님이 주문할 수 있어요.',
        buttons: [
          { label: '개점', variant: 'op-pastel-green', onClick: function () { requestOperatingStatus('OPEN'); } },
          { label: '닫기', variant: 'btn-secondary' },
        ],
      });
      return;
    }
    if (st === 'OPEN') {
      window.UI.showModal({
        title: '영업 상태를 변경해주세요.',
        message: '현재 영업중이에요.',
        buttons: [
          { label: '일시중지', variant: 'op-pastel-amber', onClick: function () { requestOperatingStatus('PAUSED'); } },
          { label: '마감', variant: 'op-pastel-red', onClick: openCloseConfirmModal },
          { label: '닫기', variant: 'btn-secondary' },
        ],
      });
      return;
    }
    window.UI.showModal({
      title: '영업 상태를 변경해주세요.',
      message: '현재 일시중지 상태에요.',
      buttons: [
        { label: '일시중지 해제', variant: 'op-pastel-green', onClick: function () { requestOperatingStatus('OPEN'); } },
        { label: '마감', variant: 'op-pastel-red', onClick: openCloseConfirmModal },
        { label: '닫기', variant: 'btn-secondary' },
      ],
    });
  }

  function refreshOfflineBanner() {
    const slot = root.querySelector('#offline-banner-slot');
    if (slot) slot.innerHTML = isOnline ? '' : offlineBannerHtml();
  }

  // 완전 단절(isOnline)이 최우선, 그 다음 희미한 신호(networkWeak) 순으로 상태를 정한다.
  // 완전 단절이 아니면 주문 컨트롤은 그대로 두고 아이콘 표시만 바꾼다.
  function networkState() { return !isOnline ? 'off' : (networkWeak ? 'weak' : 'ok'); }

  function refreshNetworkCaption() {
    const el = root.querySelector('#order-network-caption');
    if (!el) return;
    el.innerHTML = networkIconHtml(networkState());
  }

  function onNetworkQuality(e) {
    networkWeak = !!(e.detail && e.detail.weak);
    refreshNetworkCaption();
  }

  function refreshAutoSoldoutBanner() {
    const slot = root.querySelector('#auto-soldout-banner-slot');
    if (slot) slot.innerHTML = autoSoldoutBannerHtml();
  }

  function refreshHappyHourBanner() {
    const slot = root.querySelector('#happy-hour-banner-slot');
    if (slot) slot.innerHTML = happyHourBannerHtml();
  }

  // 해피아워는 주문 카드에 배지로 표시하지 않는 대신, 시작되는 순간 자동 품절과 동일한 방식으로
  // 화면 상단 배너로 알린다(개발자 도구 시뮬레이션)
  function onHappyHourStarted(e) {
    const detail = e.detail || {};
    if (!detail.name) return;
    if (happyHourPromos.some(function (p) { return p.name === detail.name; })) return;
    happyHourPromos.push({ name: detail.name, price: detail.price, start: detail.start, end: detail.end });
    refreshHappyHourBanner();
  }

  // 개발자 도구의 '개점 요청 알림' 버튼 — 20분을 기다리지 않고 바텀시트를 바로 확인한다.
  function onDevShowReopenSheet() {
    store = window.MockApi.getStore(storeId);
    if (!store || store.operatingStatus === 'OPEN') {
      window.UI.toast('마감 또는 일시중지 상태에서만 노출돼요');
      return;
    }
    clearIdleTimer();
    showReopenSheet();
  }

  // 주문 수락으로 준비량이 소진되어 자동 품절되면 하단 배너로 알린다
  function onAutoSoldout(e) {
    const names = (e.detail && e.detail.names) || [];
    if (!names.length) return;
    names.forEach(function (n) { if (autoSoldoutNames.indexOf(n) === -1) autoSoldoutNames.push(n); });
    refreshAutoSoldoutBanner();
  }

  function onOffline() { isOnline = false; refreshOfflineBanner(); refreshNetworkCaption(); updateList(); }
  function onOnline() { isOnline = true; refreshOfflineBanner(); refreshNetworkCaption(); updateList(); }
  // 폰 목업 바깥의 테스트 패널(devPanel.js)에서 주문을 추가했을 때 목록을 즉시 갱신한다.
  function onMockDataChanged() { updateList(); }

  // ---------------- 이벤트 위임 ----------------
  function onRootClick(e) {
    // 어떤 조작이든 있었다면 '무동작'이 아니므로 개점 요청 타이머를 처음부터 다시 센다.
    scheduleIdleReopenPrompt();
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');
    if (action === 'open-settings') onSettingsClick();
    else if (action === 'open-operating-status') handleOperatingStatusClick();
    else if (action === 'refresh-orders') handleRefresh(target);
    else if (action === 'dismiss-auto-soldout') {
      const dismissName = target.getAttribute('data-name');
      autoSoldoutNames = autoSoldoutNames.filter(function (n) { return n !== dismissName; });
      refreshAutoSoldoutBanner();
    }
    else if (action === 'dismiss-happy-hour') {
      // 배너 하나는 '해피아워 시간이 같은 메뉴들'의 묶음이라, 닫으면 그 시간대 묶음만 비운다.
      // 시간이 다른 다른 배너는 그대로 남는다.
      const dismissRange = target.getAttribute('data-range');
      happyHourPromos = happyHourPromos.filter(function (p) { return happyHourRangeKey(p) !== dismissRange; });
      refreshHappyHourBanner();
    }
    else if (action === 'open-contact') handleOpenContact(target.getAttribute('data-contact'), target.getAttribute('data-is-email') === '1');
    else if (action === 'switch-tab') switchTab(parseInt(target.getAttribute('data-tab-idx'), 10));
    else if (action === 'toggle-sort') toggleSort();
    else if (action === 'open-order-filter') openOrderFilterSheet();
    else if (action === 'toggle-call-status-panel') { callStatusPanelOpen = !callStatusPanelOpen; updateCallStatusUI(); }
    else if (action === 'toggle-card-expand') toggleCardExpand(target.getAttribute('data-order-id'));
    else if (action === 'accept-order') handleAccept(id);
    else if (action === 'cancel-order') handleCancelOrder(id);
    else if (action === 'call-customer') handleCallCustomer(id);
    else if (action === 'complete-order') handleComplete(id);
    else if (action === 'cancel-payment') handleCancelPayment(id);
    else if (action === 'revert-order') handleRevert(id);
    else if (action === 'return-order') handleReturn(id);
    else if (action === 'bulk-accept') doBulkAccept();
    else if (action === 'bulk-complete') doBulkComplete();
    else if (action === 'bulk-call') doBulkCall();
  }

  function toggleSort() {
    sortDir = sortDir === 'desc' ? 'asc' : 'desc';
    const btn = root.querySelector('#sort-btn');
    if (btn) btn.textContent = sortLabel() + ' ▾';
    updateList();
  }

  function onRootChange(e) {
    const target = e.target;
    if (!target || !target.matches) return;
    if (target.matches('input[data-action="bucket-select-all"]')) {
      const key = target.getAttribute('data-bucket');
      const orders = fetchOrders();
      const groups = window.UI.groupByBucket(orders, sortDir);
      const group = groups.find(function (g) { return String(g.key) === key; });
      if (group) {
        if (target.checked) group.orders.forEach(function (o) { selectedIds.add(o.id); });
        else group.orders.forEach(function (o) { selectedIds.delete(o.id); });
      }
      updateList();
    }
  }

  function onRootInput(e) {
    if (e.target && e.target.id === 'search-input') {
      searchQuery = e.target.value;
      updateList();
    }
  }

  // ---------------- render / mount ----------------
  function render(params) {
    user = window.MockApi.getCurrentUser();
    storeId = user.storeId;
    store = window.MockApi.getStore(storeId);

    tabs = computeTabs();
    currentIndex = 0;
    sortDir = 'desc';
    searchQuery = '';
    menuFilters = [];
    orderTypeFilters = [];
    calledFilter = 'ALL';
    callStatusPanelOpen = false;
    selectedIds = new Set();
    cardOverrides = {};
    autoSoldoutNames = [];
    happyHourPromos = [];
    isOnline = navigator.onLine && !(window.DevTools && window.DevTools.isOffline());
    networkWeak = false;

    const disabled = controlsDisabled();
    const orders = fetchOrders();
    const groups = window.UI.groupByBucket(orders, sortDir);

    return '' +
      '<style>' + SCOPED_STYLE + '</style>' +
      '<div class="topbar order-topbar-centered">' +
      '<span id="status-btn-slot">' + renderStatusButtonHtml() + '</span>' +
      '<div class="topbar-title">' +
      '<span class="order-title-text">' + esc(store.name) + '</span>' +
      '<span class="order-network-caption" id="order-network-caption">' + networkIconHtml(networkState()) + '</span>' +
      '</div>' +
      '<button type="button" class="icon-btn settings-icon-btn" data-action="open-settings" aria-label="설정">' +
        '<span class="settings-icon-surface">' + window.Icons3D.iconLine('sliders', 21) + '</span></button>' +
      '</div>' +
      '<div id="offline-banner-slot">' + (isOnline ? '' : offlineBannerHtml()) + '</div>' +
      '<div id="auto-soldout-banner-slot">' + autoSoldoutBannerHtml() + '</div>' +
      '<div id="happy-hour-banner-slot">' + happyHourBannerHtml() + '</div>' +
      '<div class="search-row">' +
      '<div class="search-box">' +
      '<span class="search-icon">' + ICON_SEARCH + '</span>' +
      '<input type="text" inputmode="numeric" id="search-input" placeholder="호출번호로 검색" value="' + esc(searchQuery) + '" />' +
      '</div>' +
      '<button type="button" class="refresh-btn" id="refresh-btn" data-action="refresh-orders" aria-label="주문 새로고침">' + ICON_REFRESH + '</button>' +
      '</div>' +
      '<div class="segment-tabs" id="segment-tabs">' + renderSegmentTabsHtml() + '</div>' +
      '<div class="order-toolbar-divider"></div>' +
      '<div class="toolbar">' +
      '<div class="toolbar-row">' +
      '<div class="toolbar-left-group">' +
      '<button type="button" class="pill-btn sort-pill" id="sort-btn" data-action="toggle-sort">' + sortLabel() + ' ▾</button>' +
      '<button type="button" class="pill-btn' + ((menuFilters.length || orderTypeFilters.length || calledFilter !== 'ALL') ? ' active' : '') + '" id="order-filter-btn" data-action="open-order-filter">' + filterBtnLabel() + '</button>' +
      '</div>' +
      '<div id="call-status-btn-slot">' + renderCallStatusButtonHtml() + '</div>' +
      '</div>' +
      '</div>' +
      '<div id="call-status-panel-slot">' + renderCallStatusPanelHtml() + '</div>' +
      '<div class="screen-scroll" id="order-scroll">' +
      '<div class="order-list" id="order-list-wrap">' + renderGroupsHtml(groups, orders, disabled) + '</div>' +
      '</div>' +
      '<div id="bulk-bar-slot">' + renderBulkBarHtml(disabled) + '</div>';
  }

  function mount(rootEl) {
    root = rootEl;
    root.addEventListener('click', onRootClick);
    root.addEventListener('change', onRootChange);
    root.addEventListener('input', onRootInput);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    window.addEventListener('mock:orders-changed', onMockDataChanged);
    window.addEventListener('mock:auto-soldout', onAutoSoldout);
    window.addEventListener('mock:network-quality', onNetworkQuality);
    window.addEventListener('mock:happy-hour-started', onHappyHourStarted);
    window.addEventListener('dev:show-reopen-sheet', onDevShowReopenSheet);
    scheduleIdleReopenPrompt();
  }

  function unmount() {
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('mock:orders-changed', onMockDataChanged);
    window.removeEventListener('mock:auto-soldout', onAutoSoldout);
    window.removeEventListener('mock:network-quality', onNetworkQuality);
    window.removeEventListener('mock:happy-hour-started', onHappyHourStarted);
    window.removeEventListener('dev:show-reopen-sheet', onDevShowReopenSheet);
    clearIdleTimer();
    root = null;
  }

  window.Router.register('order', { render: render, mount: mount, unmount: unmount });
})();
