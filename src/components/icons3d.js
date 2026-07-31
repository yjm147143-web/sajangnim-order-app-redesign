/*
 * 3D 아이콘 세트
 *
 * 이모지는 OS 폰트에 따라 모양·색·입체감이 전부 달라지고 색을 통제할 수 없다. 아이콘 뒤에
 * 입체 타일을 깔아 3D처럼 보이게 하는 방법도 써봤지만, 그건 '판이 입체'일 뿐 아이콘 자체는
 * 여전히 납작하다. 그래서 도구 자체를 두께 있는 덩어리로 그린다.
 *
 * 조형 규칙 (모든 아이콘 공통 — 이게 지켜져야 한 세트로 보인다)
 * - 광원은 좌상단 고정. 윗면은 좌상단이 밝고 우하단으로 어두워진다.
 * - 압출 깊이 2.2 (24 단위 기준 약 9%). 같은 실루엣을 아래로 내려 어둡게 깔아 측면을 만든다.
 * - 측면 색은 윗면 중간톤을 어둡게 깎은 한 가지 색. 측면에 그라디언트를 주면 지저분해진다.
 * - 좌상단 테두리에 하이라이트 호를 하나만 얹는다. 이 한 줄이 평면과 입체를 가른다.
 * - 아웃라인 없음. 형태는 명암으로만 구분한다.
 *
 * 색은 아이콘마다 계열을 달라 목록을 색으로 훑을 수 있게 하되, 명도·채도는 맞춰 어느 하나가
 * 튀지 않게 한다.
 */
(function () {
  // 계열별 [윗면 밝은쪽, 윗면 어두운쪽, 측면]
  var HUES = {
    blue:   ['#8FAAF2', '#4E74DE', '#33529B'],
    teal:   ['#5FD8C4', '#12B39A', '#0B7A69'],
    amber:  ['#FFC978', '#F0982A', '#B06A11'],
    rose:   ['#FF97AA', '#E8556D', '#A32F45'],
    violet: ['#B9AEF7', '#8B7BF0', '#5D4FB8'],
    slate:  ['#A8B0C4', '#6E7488', '#464C5E'],
  };

  function gradId(name) { return 'i3d-' + name; }

  // 아이콘 하나를 조립한다. paths는 실루엣(측면·윗면에 같이 쓰임), details는 윗면 위에만 얹는
  // 장식(구멍·눈금 등), highlight는 좌상단 광택.
  function build(name, def, size) {
    var hue = HUES[def.hue] || HUES.slate;
    var id = gradId(name);
    var w = size || 24;
    // 압출 때문에 아래로 2.2 더 필요하다.
    return '<svg class="icon3d" width="' + w + '" height="' + (w * 26.2 / 24) + '"' +
      ' viewBox="0 0 24 26.2" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<linearGradient id="' + id + '" x1="0.15" y1="0" x2="0.85" y2="1">' +
          '<stop offset="0" stop-color="' + hue[0] + '"/>' +
          '<stop offset="0.55" stop-color="' + hue[1] + '"/>' +
          '<stop offset="1" stop-color="' + hue[2] + '"/>' +
        '</linearGradient>' +
      '</defs>' +
      // 측면(두께) — 같은 실루엣을 아래로 내려 단색으로 깐다
      '<g transform="translate(0 2.2)" fill="' + hue[2] + '">' + def.paths + '</g>' +
      // 윗면
      '<g fill="url(#' + id + ')">' + def.paths + '</g>' +
      (def.details || '') +
      (def.highlight || '') +
      '</svg>';
  }

  // 좌상단 광택 호를 만드는 헬퍼 — 아이콘마다 곡률만 다르게 준다.
  function gloss(d, width) {
    return '<path d="' + d + '" fill="none" stroke="rgba(255,255,255,0.6)"' +
      ' stroke-width="' + (width || 1.4) + '" stroke-linecap="round"/>';
  }

  var GEAR_TEETH = (function () {
    var out = '';
    for (var a = 0; a < 360; a += 30) {
      out += '<rect x="10.75" y="0.9" width="2.5" height="4.6" rx="1.1" transform="rotate(' + a + ' 12 12)"/>';
    }
    return out + '<circle cx="12" cy="12" r="8"/>';
  })();

  var ICONS = {
    // 설정 — 톱니
    gear: {
      hue: 'slate',
      paths: GEAR_TEETH,
      details: '<circle cx="12" cy="12" r="3.3" fill="rgba(30,29,43,0.34)"/>',
      highlight: gloss('M5.6 7.6A8 8 0 0 1 15.4 4.7'),
    },
    // 자동 수락 — 번개
    bolt: {
      hue: 'amber',
      paths: '<path d="M13.9 1.6 5.4 13.1a1 1 0 0 0 .8 1.6h4.1l-1.5 7.5a1 1 0 0 0 1.8.7l8.3-11.4a1 1 0 0 0-.8-1.6h-4.1l1.6-7.5a1 1 0 0 0-1.7-.8z"/>',
      highlight: gloss('M12.6 3.6 7.4 10.7', 1.3),
    },
    // KDS — 조리 뚜껑(클로슈). 원 하나로는 무엇인지 안 읽혀서, 넓은 받침 + 낮고 넓은 반구 +
    // 꼭대기 손잡이 3단으로 실루엣을 만든다. 작은 크기에서는 실루엣이 곧 의미다.
    dome: {
      hue: 'blue',
      paths: '<rect x="1.6" y="16.4" width="20.8" height="3.6" rx="1.8"/>' +
        '<path d="M3.4 16.4a8.6 7.4 0 0 1 17.2 0z"/>' +
        '<rect x="10.7" y="3.2" width="2.6" height="3.4" rx="1.3"/>' +
        '<circle cx="12" cy="3.4" r="1.9"/>',
      details: '<rect x="1.6" y="17.4" width="20.8" height="1.1" fill="rgba(30,29,43,0.14)"/>',
      highlight: gloss('M5.8 14.6A6.6 6.6 0 0 1 10 9.9', 1.3),
    },
    // 메뉴 관리 — 포크 + 나이프. 접시(원)는 24px에서 점으로만 보여 의미가 없었다.
    // 식기 두 개가 나란히 선 실루엣이 '음식/메뉴'를 가장 빠르게 전달한다.
    plate: {
      hue: 'teal',
      paths:
        // 포크: 갈래 3개 + 목 + 손잡이
        '<rect x="4.3" y="2.2" width="1.5" height="6.2" rx="0.75"/>' +
        '<rect x="7.0" y="2.2" width="1.5" height="6.2" rx="0.75"/>' +
        '<path d="M3.6 7.6h5.6a.9.9 0 0 1 .9.9 3.7 3.7 0 0 1-2.9 3.6v9.3a1.2 1.2 0 0 1-2.4 0v-9.3A3.7 3.7 0 0 1 2.7 8.5a.9.9 0 0 1 .9-.9z"/>' +
        // 나이프: 칼날 + 손잡이
        '<path d="M16.4 2.2c2.3 1.6 3.4 4.3 3.4 7.2 0 2.2-.8 3.6-2.2 4.2v7.8a1.2 1.2 0 0 1-2.4 0V13.6c-1.4-.6-2.2-2-2.2-4.2 0-2.9 1.1-5.6 3.4-7.2z"/>',
      highlight: gloss('M4.9 3.0v4.2', 1.1),
    },
    // 손님 대기 관리 — 확성기
    megaphone: {
      hue: 'violet',
      paths: '<path d="M4.2 9.4 17.6 3.2a1.2 1.2 0 0 1 1.7 1.1v15.4a1.2 1.2 0 0 1-1.7 1.1L4.2 14.6a1.2 1.2 0 0 1-.7-1.1v-3a1.2 1.2 0 0 1 .7-1.1z"/>' +
        '<rect x="7.4" y="14.2" width="3.4" height="7.6" rx="1.6"/>',
      highlight: gloss('M6.2 10.4 15.4 6.1', 1.3),
    },
    // 주문 관리 — 상자
    box: {
      hue: 'blue',
      paths: '<path d="M12 2.2 21.8 7v10L12 21.8 2.2 17V7z"/>',
      details: '<path d="M12 2.2 21.8 7 12 11.8 2.2 7z" fill="rgba(255,255,255,0.3)"/>' +
        '<path d="M12 11.8v10L2.2 17V7z" fill="rgba(30,29,43,0.16)"/>',
      highlight: gloss('M3.6 7.3 11.4 3.5', 1.3),
    },
    // QR 메뉴판 — 휴대폰 + QR
    phone: {
      hue: 'violet',
      paths: '<rect x="5.2" y="1.4" width="13.6" height="21.2" rx="3"/>',
      details: '<rect x="7.6" y="5.4" width="3.4" height="3.4" rx="0.9" fill="rgba(255,255,255,0.85)"/>' +
        '<rect x="13" y="5.4" width="3.4" height="3.4" rx="0.9" fill="rgba(255,255,255,0.85)"/>' +
        '<rect x="7.6" y="10.8" width="3.4" height="3.4" rx="0.9" fill="rgba(255,255,255,0.85)"/>' +
        '<rect x="13" y="10.8" width="1.5" height="1.5" rx="0.5" fill="rgba(255,255,255,0.6)"/>' +
        '<rect x="14.9" y="12.7" width="1.5" height="1.5" rx="0.5" fill="rgba(255,255,255,0.6)"/>' +
        '<rect x="9.2" y="17.4" width="5.6" height="1.6" rx="0.8" fill="rgba(30,29,43,0.2)"/>',
      highlight: gloss('M6.6 4.4A2.4 2.4 0 0 1 8.6 2.6', 1.2),
    },
    // 매출 조회 — 동전. 원기둥을 여러 개 쌓으면 24px에서 통조림 하나로 뭉쳐 보였다.
    // 동전 하나를 크게 두고 ₩를 새겨, 형태가 아니라 기호로 즉시 읽히게 한다.
    coins: {
      hue: 'teal',
      paths: '<circle cx="12" cy="12" r="9.6"/>',
      details: '<circle cx="12" cy="12" r="7.2" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.1"/>' +
        '<g fill="none" stroke="#FFFFFF" stroke-width="1.7" stroke-linecap="round">' +
          '<path d="M8.3 8.2 12 14.2 15.7 8.2"/>' +
          '<path d="M7.6 11.4h8.8"/>' +
          '<path d="M7.6 13.6h8.8"/>' +
        '</g>',
      highlight: gloss('M5.1 8.2A9.6 9.6 0 0 1 13.6 2.6'),
    },
    // 알림 설정 — 벨
    bell: {
      hue: 'amber',
      paths: '<path d="M12 2.2a6.6 6.6 0 0 1 6.6 6.6v4.4l1.8 3a1.1 1.1 0 0 1-.9 1.7H4.5a1.1 1.1 0 0 1-.9-1.7l1.8-3V8.8A6.6 6.6 0 0 1 12 2.2z"/>' +
        '<path d="M9.4 19.4h5.2a2.6 2.6 0 0 1-5.2 0z"/>',
      highlight: gloss('M7.2 8.6A4.8 4.8 0 0 1 10.6 4.2', 1.3),
    },
    // 권한 잠금 — 자물쇠
    lock: {
      hue: 'rose',
      paths: '<rect x="4.2" y="10.2" width="15.6" height="11.6" rx="2.8"/>' +
        '<path d="M7.6 10.4V7.8a4.4 4.4 0 0 1 8.8 0v2.6h-2.6V7.8a1.8 1.8 0 0 0-3.6 0v2.6z"/>',
      details: '<circle cx="12" cy="15.2" r="1.9" fill="rgba(30,29,43,0.32)"/>' +
        '<rect x="11.1" y="15.2" width="1.8" height="3.4" rx="0.9" fill="rgba(30,29,43,0.32)"/>',
      highlight: gloss('M5.8 12.4A2.6 2.6 0 0 1 7.6 11.2', 1.2),
    },
    // 공지사항 — 말풍선
    notice: {
      hue: 'violet',
      paths: '<path d="M4.4 3.2h15.2a2.4 2.4 0 0 1 2.4 2.4v9.2a2.4 2.4 0 0 1-2.4 2.4h-6.6l-4.6 3.8a.9.9 0 0 1-1.5-.7v-3.1H4.4A2.4 2.4 0 0 1 2 14.8V5.6a2.4 2.4 0 0 1 2.4-2.4z"/>',
      details: '<rect x="6.2" y="7.2" width="11.6" height="1.7" rx="0.85" fill="rgba(255,255,255,0.8)"/>' +
        '<rect x="6.2" y="11" width="7.4" height="1.7" rx="0.85" fill="rgba(255,255,255,0.55)"/>',
      highlight: gloss('M3.6 6.2A2.2 2.2 0 0 1 5.4 4.6', 1.2),
    },
    // 로그아웃 — 문
    door: {
      hue: 'rose',
      paths: '<path d="M5.4 2.4h10.4a2 2 0 0 1 2 2v17.2H5.4a2 2 0 0 1-2-2V4.4a2 2 0 0 1 2-2z"/>' +
        '<rect x="17.2" y="9.8" width="3.4" height="4.4" rx="1.7"/>',
      details: '<circle cx="14.2" cy="12" r="1.3" fill="rgba(30,29,43,0.34)"/>',
      highlight: gloss('M4.8 5.4A1.8 1.8 0 0 1 6.4 4', 1.2),
    },
    // 영업 상태 — 가게(천막)
    store: {
      hue: 'amber',
      paths: '<path d="M3 8.4h18v12.4a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 20.8z"/>' +
        '<path d="M4.2 2.4h15.6l2.2 6H2z"/>',
      details: '<rect x="8.2" y="12.4" width="7.6" height="9.8" rx="1.2" fill="rgba(255,255,255,0.34)"/>',
      highlight: gloss('M3.4 7.4 5.4 3.4', 1.2),
    },
    // 임의 주문 생성 / 임의 생성 주문 배지 — 영수증. 아래를 톱니로 끊어 '출력물'로 읽히게 한다.
    receipt: {
      hue: 'slate',
      paths: '<path d="M4.4 1.8h15.2a1.4 1.4 0 0 1 1.4 1.4v18.4l-2.8-1.7-2.8 1.7-2.8-1.7-2.8 1.7-2.8-1.7-2.8 1.7V3.2a1.4 1.4 0 0 1 1.4-1.4z"/>',
      details: '<g fill="rgba(255,255,255,0.82)">' +
        '<rect x="7" y="5.6" width="10" height="1.7" rx="0.85"/>' +
        '<rect x="7" y="9.2" width="10" height="1.7" rx="0.85"/>' +
        '<rect x="7" y="12.8" width="6.4" height="1.7" rx="0.85"/></g>',
      highlight: gloss('M5.6 4.4A1.6 1.6 0 0 1 7 3.2', 1.2),
    },
    // 최소 주문 금액 — 지폐
    bill: {
      hue: 'teal',
      paths: '<rect x="1.4" y="5.2" width="21.2" height="13.6" rx="2.4"/>',
      details: '<circle cx="12" cy="12" r="3.6" fill="rgba(255,255,255,0.42)"/>' +
        '<g fill="rgba(30,29,43,0.18)">' +
        '<rect x="3.8" y="10.4" width="2.4" height="3.2" rx="1.2"/>' +
        '<rect x="17.8" y="10.4" width="2.4" height="3.2" rx="1.2"/></g>',
      highlight: gloss('M3 8.2A2.4 2.4 0 0 1 5.2 6.4', 1.2),
    },
    // 행사 전환 — 위아래로 엇갈린 두 화살표
    swap: {
      hue: 'violet',
      paths: '<path d="M2.6 5.8h12.6V2.6l6.2 4.6-6.2 4.6V8.6H2.6z"/>' +
        '<path d="M21.4 18.2H8.8v3.2l-6.2-4.6 6.2-4.6v3.2h12.6z"/>',
      highlight: gloss('M3.4 6.6h10.4', 1.1),
    },
    // 행사담당자 탭바 — 홈
    home: {
      hue: 'blue',
      paths: '<path d="M12 1.8 22.6 10.6l-1.7 2-1.1-.9v9.1a1.5 1.5 0 0 1-1.5 1.5H5.7a1.5 1.5 0 0 1-1.5-1.5v-9.1l-1.1.9-1.7-2z"/>',
      details: '<rect x="9.6" y="14" width="4.8" height="8.3" rx="1.2" fill="rgba(30,29,43,0.22)"/>',
      highlight: gloss('M4.4 10.2 11 4.8', 1.3),
    },
    // 행사담당자 탭바 — 매출현황(막대 그래프)
    chart: {
      hue: 'teal',
      paths: '<rect x="3" y="12.4" width="4.6" height="8.8" rx="1.5"/>' +
        '<rect x="9.7" y="7" width="4.6" height="14.2" rx="1.5"/>' +
        '<rect x="16.4" y="2.8" width="4.6" height="18.4" rx="1.5"/>',
      highlight: gloss('M4 13.4v6.6', 1.1),
    },
    // 예약 주문 / 담당 행사 — 달력
    calendar: {
      hue: 'rose',
      paths: '<rect x="2.6" y="4.8" width="18.8" height="16.8" rx="2.6"/>' +
        '<rect x="6.4" y="1.6" width="2.6" height="5.4" rx="1.3"/>' +
        '<rect x="15" y="1.6" width="2.6" height="5.4" rx="1.3"/>',
      details: '<rect x="2.6" y="9.2" width="18.8" height="1.6" fill="rgba(30,29,43,0.2)"/>' +
        '<g fill="rgba(255,255,255,0.8)">' +
        '<rect x="6" y="13" width="3.2" height="3.2" rx="1"/>' +
        '<rect x="10.4" y="13" width="3.2" height="3.2" rx="1"/>' +
        '<rect x="14.8" y="13" width="3.2" height="3.2" rx="1"/></g>',
      highlight: gloss('M4 7.6A2.6 2.6 0 0 1 6 6', 1.2),
    },
    // 메뉴 옵션 — 퍼즐 조각
    puzzle: {
      hue: 'amber',
      paths: '<path d="M3.2 3.2h6.6v1.7a2.3 2.3 0 1 0 4.6 0V3.2h6.4v6.6h-1.7a2.3 2.3 0 1 0 0 4.6h1.7v6.4h-6.4v-1.7a2.3 2.3 0 1 0-4.6 0v1.7H3.2z"/>',
      highlight: gloss('M4.4 4.4h4.2', 1.1),
    },
    // 메뉴 기본 정보 — 연필
    pencil: {
      hue: 'amber',
      paths: '<path d="M16.9 1.7 22.3 7.1l-2.5 2.5-5.4-5.4z"/>' +
        '<path d="M13.1 5.5l5.4 5.4L7.6 21.8 1.4 23.2l1.4-6.2z"/>',
      details: '<path d="M1.4 23.2l1.4-6.2 2.4 2.4z" fill="rgba(30,29,43,0.3)"/>',
      highlight: gloss('M4.6 17.4 13 9', 1.2),
    },
    // 메뉴 이미지 자리 — 카메라
    camera: {
      hue: 'slate',
      paths: '<path d="M8.6 3.2h6.8l1.7 2.8h3.5A2.4 2.4 0 0 1 23 8.4v10.4a2.4 2.4 0 0 1-2.4 2.4H3.4A2.4 2.4 0 0 1 1 18.8V8.4A2.4 2.4 0 0 1 3.4 6h3.5z"/>',
      details: '<circle cx="12" cy="13.4" r="4.6" fill="rgba(30,29,43,0.26)"/>' +
        '<circle cx="12" cy="13.4" r="2.4" fill="rgba(255,255,255,0.5)"/>',
      highlight: gloss('M2.6 9.6A2.2 2.2 0 0 1 4.4 7.8', 1.2),
    },
    // 주문/매출 없음 — 빈 수납함
    inbox: {
      hue: 'slate',
      paths: '<path d="M2.2 12.8 5.6 3.6h12.8l3.4 9.2v6.4a1.8 1.8 0 0 1-1.8 1.8H4a1.8 1.8 0 0 1-1.8-1.8z"/>',
      details: '<path d="M2.2 12.8h5.6l1.3 2.8h5.8l1.3-2.8h5.6" fill="none"' +
        ' stroke="rgba(255,255,255,0.72)" stroke-width="1.5" stroke-linejoin="round"/>',
      highlight: gloss('M6.4 4.6 3.8 11.4', 1.2),
    },
    // QR 불러오기 실패 — QR + 사선
    qrOff: {
      hue: 'rose',
      paths: '<rect x="2.4" y="2.4" width="19.2" height="19.2" rx="3.4"/>',
      details: '<g fill="rgba(255,255,255,0.88)">' +
        '<rect x="5.6" y="5.6" width="4.4" height="4.4" rx="1.2"/>' +
        '<rect x="14" y="5.6" width="4.4" height="4.4" rx="1.2"/>' +
        '<rect x="5.6" y="14" width="4.4" height="4.4" rx="1.2"/>' +
        '<rect x="14" y="14" width="2" height="2" rx="0.6"/>' +
        '<rect x="16.4" y="16.4" width="2" height="2" rx="0.6"/></g>' +
        '<path d="M4.4 19.6 19.6 4.4" stroke="rgba(30,29,43,0.55)" stroke-width="2.6" stroke-linecap="round"/>',
      highlight: gloss('M4 6.2A2.6 2.6 0 0 1 6 4.2', 1.2),
    },
    // 검색 결과 없음 — 돋보기
    magnifier: {
      hue: 'blue',
      paths: '<circle cx="10.2" cy="10.2" r="7.8"/>' +
        '<rect x="14.6" y="16.2" width="7.2" height="3.6" rx="1.8" transform="rotate(45 14.6 16.2)"/>',
      details: '<circle cx="10.2" cy="10.2" r="4.6" fill="rgba(255,255,255,0.45)"/>',
      highlight: gloss('M4.6 8A7.8 7.8 0 0 1 11 2.6'),
    },
    // 배달 주문 — 스쿠터
    scooter: {
      hue: 'teal',
      paths: '<circle cx="5.6" cy="17.4" r="4.2"/>' +
        '<circle cx="18.4" cy="17.4" r="4.2"/>' +
        '<path d="M2.6 6.6h5.2a1.4 1.4 0 0 1 1.2.7l4.6 7.8h4.8v3.4h-6.2a1.4 1.4 0 0 1-1.2-.7L6.4 10H2.6z"/>' +
        '<rect x="15.4" y="4.2" width="4.6" height="2.8" rx="1.4"/>',
      details: '<circle cx="5.6" cy="17.4" r="1.7" fill="rgba(30,29,43,0.34)"/>' +
        '<circle cx="18.4" cy="17.4" r="1.7" fill="rgba(30,29,43,0.34)"/>',
      highlight: gloss('M3.4 7.6h3.6', 1.1),
    },
  };

  // ---------------- 인라인 선 아이콘 ----------------
  // 문구 앞에 붙는 작은 기호(💡 안내, ⚠️ 경고 등)는 3D로 그리면 글자보다 무거워 문장이 안 읽힌다.
  // currentColor를 쓰는 선 아이콘으로 두면 옆 글자와 같은 색·같은 무게로 흐른다.
  // 목록·탭바·빈 상태 아이콘도 전부 선으로 그린다.
  // 컬러 3D는 광택·그라디언트·두께가 24px에서 서로를 잡아먹어 형태가 뭉개졌고, 무엇보다
  // 색이 들어간 입체 덩어리는 이모지와 시각적으로 구별되지 않았다. 선 하나로만 그리면
  // 작은 크기에서 형태가 살아남고, currentColor라 놓이는 자리의 색을 그대로 따른다.
  // 기하 규칙: viewBox 24, stroke 1.8, 라운드 캡·조인, 채움 없음.
  var LINE = {
    // 천막을 물결(scallop)로 그려야 '가게'로 읽힌다. 직선 사다리꼴로 두면 서류가방처럼 보였다.
    store: '<path d="M4 10v9.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V10"/>' +
      '<path d="M2.5 9.6 4.6 4h14.8l2.1 5.6a3 3 0 0 1-5.6 0 3 3 0 0 1-5.6 0 3 3 0 0 1-5.6 0z"/>',
    bolt: '<path d="M13.4 2.6 5.6 13.4h4.8l-1 8 7.8-10.8h-4.8z"/>',
    dome: '<path d="M3 19.6h18"/><path d="M5.2 16.4a6.8 6.8 0 0 1 13.6 0"/><path d="M5.2 16.4h13.6"/><circle cx="12" cy="5" r="1.5"/><path d="M12 6.5v3"/>',
    plate: '<path d="M6 3v5.4a1.9 1.9 0 0 0 3.8 0V3"/><path d="M7.9 8.4V21"/><path d="M16.4 3c1.7 1.6 2.4 3.6 2.4 5.6 0 1.6-.7 2.7-1.8 3.2V21"/>',
    megaphone: '<path d="M3.6 9.6 17 4.2v15.6L3.6 14.4z"/><path d="M7.6 15.6V20a1.6 1.6 0 0 0 3.2 0v-3.4"/>',
    box: '<path d="M12 2.8 21 7.4v9.2L12 21.2 3 16.6V7.4z"/><path d="M3 7.4 12 12l9-4.6"/><path d="M12 12v9.2"/>',
    phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.6"/><rect x="8.6" y="6" width="2.8" height="2.8" rx="0.8"/><rect x="12.6" y="6" width="2.8" height="2.8" rx="0.8"/><rect x="8.6" y="10" width="2.8" height="2.8" rx="0.8"/><path d="M10.4 18.6h3.2"/>',
    coins: '<circle cx="12" cy="12" r="8.8"/><path d="M8.8 8.4 12 13.8l3.2-5.4"/><path d="M8.4 11.4h7.2M8.4 13.6h7.2"/>',
    bell: '<path d="M18 9.6a6 6 0 0 0-12 0v4.2L4.4 17h15.2L18 13.8z"/><path d="M9.6 17a2.4 2.4 0 0 0 4.8 0"/>',
    lock: '<rect x="4.6" y="10.4" width="14.8" height="10.6" rx="2.2"/><path d="M8 10.4V7.8a4 4 0 0 1 8 0v2.6"/>',
    notice: '<path d="M4 4.4h16a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2h-6.8l-4.6 3.6v-3.6H4a2 2 0 0 1-2-2V6.4a2 2 0 0 1 2-2z"/><path d="M6.6 8.6h10.8M6.6 12h6.8"/>',
    // 로그아웃은 문만 그리면 '문'으로만 읽혀서, 나가는 화살표를 붙여 동작을 담는다.
    door: '<path d="M15 3.6H6.6A1.6 1.6 0 0 0 5 5.2v13.6a1.6 1.6 0 0 0 1.6 1.6H15"/><path d="M19.4 12H10.2"/><path d="M16 8.6 19.4 12 16 15.4"/>',
    bill: '<rect x="2.6" y="6" width="18.8" height="12" rx="2.2"/><circle cx="12" cy="12" r="2.8"/><path d="M5.8 12h.6M17.6 12h.6"/>',
    swap: '<path d="M3.6 8.2h13"/><path d="M13.6 5.2 16.6 8.2l-3 3"/><path d="M20.4 15.8h-13"/><path d="M10.4 12.8 7.4 15.8l3 3"/>',
    home: '<path d="M3.4 10.6 12 3.4l8.6 7.2"/><path d="M5.6 9.4V20a1 1 0 0 0 1 1h10.8a1 1 0 0 0 1-1V9.4"/><path d="M9.6 21v-5.8h4.8V21"/>',
    chart: '<path d="M3.4 20.6h17.2"/><rect x="5" y="11.6" width="3.4" height="6.4" rx="1"/><rect x="10.3" y="7.6" width="3.4" height="10.4" rx="1"/><rect x="15.6" y="4" width="3.4" height="14" rx="1"/>',
    inbox: '<path d="M2.6 12.6 5.7 4.6h12.6l3.1 8v6a1.6 1.6 0 0 1-1.6 1.6H4.2a1.6 1.6 0 0 1-1.6-1.6z"/><path d="M2.6 12.6h5l1.2 2.6h6.4l1.2-2.6h5"/>',
    qrOff: '<rect x="3" y="3" width="6.4" height="6.4" rx="1.4"/><rect x="14.6" y="3" width="6.4" height="6.4" rx="1.4"/><rect x="3" y="14.6" width="6.4" height="6.4" rx="1.4"/><path d="M14.6 14.6h2.8v2.8h-2.8z"/><path d="M3.4 20.6 20.6 3.4"/>',
    magnifier: '<circle cx="10.8" cy="10.8" r="7.2"/><path d="M16.1 16.1 21 21"/>',
    // 바퀴 2개 + 좌석으로 올라가는 프레임 + 핸들바. 차체를 덩어리로 그리면 18px에서 뭉갠다.
    scooter: '<circle cx="5.8" cy="17.6" r="2.9"/><circle cx="18.2" cy="17.6" r="2.9"/>' +
      '<path d="M8.7 17.6h6.6"/><path d="M15.3 17.6 12.3 9.6H9.5"/>' +
      '<path d="M12.3 9.6h4.4l1.5 5.2"/><path d="M16.2 6.4h3.4"/>',
    // 메뉴 옵션은 퍼즐 조각으로 그렸더니 24px 이하에서 깨진 X자로 보였다. 겹친 레이어가
    // '같은 메뉴의 여러 갈래'를 더 정확히 전달하고 작은 크기에서도 형태가 살아남는다.
    option: '<path d="M12 3.2 21 8l-9 4.8L3 8z"/><path d="M3 12.4 12 17.2l9-4.8"/><path d="M3 16.6 12 21.4l9-4.8"/>',
    pencil: '<path d="M16.8 3.2 20.8 7.2 8 20H4v-4z"/><path d="M14.6 5.4 18.6 9.4"/>',
    lightbulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9V16h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z"/>',
    warning: '<path d="M12 3.2 22.2 20H1.8z"/><path d="M12 9.4v4.8M12 17.2h.01"/>',
    flame: '<path d="M12 2.4c3.4 3.2 6.2 6 6.2 10.2A6.2 6.2 0 0 1 5.8 12.6c0-1.8.7-3.2 1.8-4.6.4 1.2 1.2 2 2.2 2.2-.6-3 .8-6 2.2-7.8z"/>',
    recycle: '<path d="M7.2 8.4 4.4 13.2h5.6z"/><path d="M12 3.6l2.8 4.8h-5.6z"/><path d="M16.8 8.4l2.8 4.8H14z"/><path d="M4.4 13.2 7 17.8h10l2.6-4.6"/>',
    mail: '<rect x="2.4" y="5" width="19.2" height="14" rx="2.4"/><path d="M3.4 6.6 12 13l8.6-6.4"/>',
    phoneCall: '<path d="M6.2 3.4h3.2l1.6 4-2 1.4a10.4 10.4 0 0 0 6.2 6.2l1.4-2 4 1.6v3.2a1.6 1.6 0 0 1-1.8 1.6C11.6 18.6 5.4 12.4 4.6 5.2A1.6 1.6 0 0 1 6.2 3.4z"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/>',
    monitor: '<rect x="2.4" y="3.6" width="19.2" height="13.2" rx="2.2"/><path d="M8.6 20.4h6.8M12 16.8v3.6"/>',
    // 태블릿 — phone보다 넓고 홈 인디케이터가 가로선이라 휴대폰과 한눈에 구분된다.
    tablet: '<rect x="3.4" y="2.6" width="17.2" height="18.8" rx="2.4"/><path d="M9.8 18.4h4.4"/>',
    // 아래 6종은 위 3D 아이콘과 같은 대상을 가리키는 선 버전이다. 문장·배지·세그먼트탭처럼
    // 글자와 나란히 놓이는 자리에서는 3D가 글자를 눌러버려서, 같은 형태를 선으로 다시 그렸다.
    calendarLine: '<rect x="3" y="5" width="18" height="16" rx="2.4"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    gearLine: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3M5.4 5.4l2.1 2.1M16.5 16.5l2.1 2.1M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1"/>',
    // 조절판(슬라이더) — 상단바 설정 버튼용. 기어는 톱니가 많아 20px 이하에서 뭉치는데,
    // 이 형태는 굵은 가로선 3개가 골격이라 작은 크기에서도 형태가 유지된다.
    sliders: '<path d="M3.5 6.5h11M18.5 6.5h2"/><circle cx="16.5" cy="6.5" r="2.1"/>' +
      '<path d="M3.5 12h3M10.5 12h10"/><circle cx="8.5" cy="12" r="2.1"/>' +
      '<path d="M3.5 17.5h8M15.5 17.5h5"/><circle cx="13.5" cy="17.5" r="2.1"/>',
    // lockLine / pencilLine / puzzleLine / scooterLine은 위 정식 이름(lock·pencil·option·scooter)과
    // 같은 것을 가리키는 옛 이름이라 LINE_ALIAS로 넘긴다. 여기 남겨두면 낡은 경로가 별칭을 이겨서
    // 다시 그린 아이콘이 화면에 반영되지 않는다.
    listCheck: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M3 6l1.6 1.6L7 5M3 12l1.6 1.6L7 11M3 18l1.6 1.6L7 17"/>',
    camera: '<path d="M3.4 7h3.4l1.6-2.6h7.2L17.2 7h3.4a2 2 0 0 1 2 2v9.4a2 2 0 0 1-2 2H3.4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13.6" r="3.8"/>',
    // 주문 메모 앞 말풍선. 3D notice와 같은 형태지만 문장 안에 흐르므로 선으로 둔다.
    notice2: '<path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',
    // 3D receipt와 같은 실루엣(아래 톱니)이라 두 크기에서 같은 것으로 읽힌다.
    receipt: '<path d="M5 2.6h14v18.8l-2.6-1.6-2.4 1.6-2-1.6-2 1.6-2.4-1.6L5 21.4z"/><path d="M8.4 7h7.2M8.4 11h7.2M8.4 15h4.4"/>',
    speaker: '<path d="M4 9.2h3.4L12 5v14l-4.6-4.2H4z"/><path d="M16 9a4.4 4.4 0 0 1 0 6M18.8 6.4a8 8 0 0 1 0 11.2"/>',
  };

  // 같은 아이콘을 부르는 옛 이름들. 화면 코드를 한꺼번에 고치지 않고도 정식 이름으로 모인다.
  var LINE_ALIAS = {
    calendar: 'calendarLine', gear: 'gearLine',
    chat: 'notice2', 'notice-line': 'notice2',
    puzzle: 'option', puzzleLine: 'option',
    scooterLine: 'scooter', lockLine: 'lock', pencilLine: 'pencil',
  };

  // 선 아이콘은 크기와 굵기만 조절한다. fill 없이 stroke만 쓰므로 어느 배경에도 얹힌다.
  function iconLine(name, size, strokeWidth) {
    var d = LINE[name] || LINE[LINE_ALIAS[name]];
    if (!d) return '';
    var w = size || 16;
    return '<svg class="icon-line" width="' + w + '" height="' + w + '" viewBox="0 0 24 24"' +
      ' fill="none" stroke="currentColor" stroke-width="' + (strokeWidth || 1.9) + '"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      d + '</svg>';
  }

  function icon3d(name, size) {
    var def = ICONS[name];
    if (!def) return '';
    return build(name, def, size);
  }

  // 고정 토글용 별 — 다른 아이콘과 달리 상태(켜짐/꺼짐)를 표현해야 해서 별도로 둔다.
  // 꺼짐: 테두리만 있는 빈 별(☆), 켜짐: 채워진 별(★). 둘 다 동그라미 안에 담아 버튼임을 알린다.
  function starToggle(on) {
    var star = 'M12 4.6l2.32 4.7 5.18.75-3.75 3.66.89 5.16L12 16.44l-4.64 2.43.89-5.16L4.5 10.05l5.18-.75z';
    if (on) {
      return '<svg class="pin-star" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">' +
        '<defs><linearGradient id="pinStarOn" x1="0.15" y1="0" x2="0.85" y2="1">' +
          '<stop offset="0" stop-color="#FFD36E"/><stop offset="0.55" stop-color="#F0982A"/>' +
          '<stop offset="1" stop-color="#B06A11"/></linearGradient></defs>' +
        '<circle cx="12" cy="12" r="11" fill="#FFF3DC" stroke="#F0982A" stroke-width="1.6"/>' +
        '<path d="' + star + '" fill="url(#pinStarOn)"/>' +
        '</svg>';
    }
    return '<svg class="pin-star" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
      '<path d="' + star + '" fill="none" stroke="currentColor" stroke-width="1.6"' +
        ' stroke-linejoin="round"/>' +
      '</svg>';
  }

  // 영업 상태 점(🟢🟠🔴)은 아이콘이 아니라 색 하나로 끝나는 표시라 SVG가 과하다.
  // CSS로 그린 원 하나로 대체하고, 색은 상태별 클래스가 정한다.
  function statusDot(cls) {
    return '<span class="status-dot ' + cls + '" aria-hidden="true"></span>';
  }

  window.Icons3D = {
    icon3d: icon3d, iconLine: iconLine, starToggle: starToggle, statusDot: statusDot,
    names: Object.keys(ICONS), lineNames: Object.keys(LINE),
  };
})();
