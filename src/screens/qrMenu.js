/*
 * QR 메뉴판 보기 화면
 * - 메뉴판 링크 표시 + 복사
 * - QR코드 이미지 (공개 QR 생성 API 사용 — 실서비스 전환 시 서버측 생성 권장)
 * - QR코드 다운로드 (fetch→blob, 실패 시 새 탭으로 대체)
 */
(function () {
  function esc(s) { return window.UI.escapeHtml(s); }

  function currentStoreId() {
    var user = window.MockApi.getCurrentUser();
    return user && user.storeId;
  }

  function render() {
    return (
      '<style>' +
        '.qr-section-pad{padding:0 20px;}' +
        '.qr-download-wrap{padding:0 20px 32px;}' +
      '</style>' +
      '<div class="topbar">' +
        '<div class="topbar-side"><button type="button" class="icon-btn" id="qr-back">←</button></div>' +
        '<div class="topbar-title">QR 메뉴판 보기</div>' +
        '<div class="topbar-side"></div>' +
      '</div>' +
      '<div class="screen-scroll"><div id="qr-content"></div></div>'
    );
  }

  function contentHtml(info) {
    // 실서비스 전환 시에는 QR 이미지를 서버 측에서 생성하는 것을 권장합니다.
    var qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(info.url);
    return (
      '<div class="section-title">' + esc(info.storeName) + ' 메뉴판</div>' +
      '<div class="section-caption">고객이 QR을 스캔하면 메뉴판 페이지로 연결돼요</div>' +
      '<div class="qr-section-pad">' +
        '<div class="link-row">' +
          '<div class="link-row-text">' + esc(info.url) + '</div>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="copy-link-btn">링크 복사</button>' +
        '</div>' +
      '</div>' +
      '<div class="qr-image-wrap"><img src="' + qrSrc + '" alt="QR 코드" id="qr-image" /></div>' +
      '<div class="qr-download-wrap">' +
        '<button type="button" class="btn btn-outline" id="download-qr-btn">QR 코드 다운로드</button>' +
      '</div>'
    );
  }

  function mount(root) {
    var storeId = currentStoreId();
    var info = window.MockApi.getQrMenuInfo(storeId);
    root.querySelector('#qr-content').innerHTML = contentHtml(info);

    root.querySelector('#qr-back').addEventListener('click', function () {
      window.Router.back();
    });

    root.querySelector('#copy-link-btn').addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(info.url).then(function () {
          window.UI.toast('링크가 복사되었어요');
        }).catch(function () {
          window.UI.toast('링크 복사에 실패했어요');
        });
      } else {
        window.UI.toast('링크 복사에 실패했어요');
      }
    });

    root.querySelector('#download-qr-btn').addEventListener('click', function () {
      var qrSrc = root.querySelector('#qr-image').src;
      fetch(qrSrc).then(function (res) {
        if (!res.ok) throw new Error('QR 이미지를 불러오지 못했어요');
        return res.blob();
      }).then(function (blob) {
        var blobUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = (info.storeName || 'menu') + '-qr.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 2000);
      }).catch(function () {
        window.open(qrSrc, '_blank');
      });
    });
  }

  function unmount() {}

  window.Router.register('qrMenu', { render: render, mount: mount, unmount: unmount });
})();
