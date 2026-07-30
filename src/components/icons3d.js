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
  };

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

  window.Icons3D = { icon3d: icon3d, starToggle: starToggle, names: Object.keys(ICONS) };
})();
