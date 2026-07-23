/*
 * 로그인 화면
 * - 역할 선택(사장님 / 행사 담당자)
 * - 아이디 / 비밀번호 입력 (예외처리 포함)
 * - 자동 로그인 체크박스
 * - 아이디/비밀번호 찾기 안내 모달
 */
(function () {
  function render() {
    return (
      '<style>' +
      '.login-wordmark{padding:56px 0 6px;text-align:center;font-size:28px;font-weight:800;letter-spacing:-0.5px;background:var(--gradient-brand);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:var(--color-wordmark);}' +
      '.login-subtitle{text-align:center;color:var(--color-text-secondary);font-size:var(--font-size-caption);margin-bottom:32px;}' +
      '.role-toggle{display:flex;gap:8px;padding:0 20px 28px;}' +
      '.role-toggle .segment-tab{flex:1;height:52px;font-size:var(--font-size-body);}' +
      '.login-form{padding:0 20px;}' +
      '.login-actions{padding:8px 20px 0;}' +
      '.login-find-row{text-align:center;padding-top:4px;}' +
      '</style>' +
      '<div class="screen-scroll">' +
        '<div class="login-wordmark">사장님 주문접수앱</div>' +
        '<div class="login-subtitle">행사 부스 주문접수를 시작해요</div>' +
        '<div class="role-toggle">' +
          '<button type="button" class="segment-tab active" id="role-owner" data-role="OWNER">사장님</button>' +
          '<button type="button" class="segment-tab" id="role-manager" data-role="EVENT_MANAGER">행사 담당자</button>' +
        '</div>' +
        '<div class="login-form">' +
          '<div class="input-group">' +
            '<input class="input-field" type="text" id="login-id" placeholder="아이디" autocomplete="username" />' +
            '<div class="input-error" id="login-id-error" style="display:none;"></div>' +
          '</div>' +
          '<div class="input-group">' +
            '<input class="input-field" type="password" id="login-pw" placeholder="비밀번호" autocomplete="current-password" />' +
            '<div class="input-error" id="login-pw-error" style="display:none;"></div>' +
          '</div>' +
          '<div class="input-checkbox-row">' +
            '<input type="checkbox" id="login-auto" />' +
            '<label for="login-auto">자동 로그인</label>' +
          '</div>' +
        '</div>' +
        '<div class="login-actions">' +
          '<button type="button" class="btn btn-primary" id="login-submit">로그인</button>' +
          '<div class="login-find-row">' +
            '<button type="button" class="btn btn-text" id="login-find">아이디 · 비밀번호 찾기</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function clearErrors(root) {
    const idErr = root.querySelector('#login-id-error');
    const pwErr = root.querySelector('#login-pw-error');
    idErr.style.display = 'none'; idErr.textContent = '';
    pwErr.style.display = 'none'; pwErr.textContent = '';
    root.querySelector('#login-id').classList.remove('error');
    root.querySelector('#login-pw').classList.remove('error');
  }

  function showIdError(root, msg) {
    const el = root.querySelector('#login-id-error');
    el.textContent = msg;
    el.style.display = 'block';
    root.querySelector('#login-id').classList.add('error');
  }

  function showPwError(root, msg) {
    const el = root.querySelector('#login-pw-error');
    el.textContent = msg;
    el.style.display = 'block';
    root.querySelector('#login-pw').classList.add('error');
  }

  function mount(root) {
    let selectedRole = 'OWNER';

    const ownerBtn = root.querySelector('#role-owner');
    const managerBtn = root.querySelector('#role-manager');
    const idInput = root.querySelector('#login-id');
    const pwInput = root.querySelector('#login-pw');
    const autoInput = root.querySelector('#login-auto');
    const submitBtn = root.querySelector('#login-submit');
    const findBtn = root.querySelector('#login-find');

    function selectRole(role) {
      selectedRole = role;
      ownerBtn.classList.toggle('active', role === 'OWNER');
      managerBtn.classList.toggle('active', role === 'EVENT_MANAGER');
    }

    ownerBtn.addEventListener('click', function () { selectRole('OWNER'); });
    managerBtn.addEventListener('click', function () { selectRole('EVENT_MANAGER'); });

    function doLogin() {
      clearErrors(root);
      const loginId = idInput.value.trim();
      const password = pwInput.value;

      const result = window.MockApi.login({
        role: selectedRole,
        loginId: loginId,
        password: password,
        autoLogin: autoInput.checked,
      });

      if (!result.ok) {
        const msg = result.message;
        if (msg.indexOf('아이디를 입력') !== -1) {
          showIdError(root, msg);
        } else if (msg.indexOf('비밀번호를 입력') !== -1) {
          showPwError(root, msg);
        } else if (msg.indexOf('계정이 아닙니다') !== -1) {
          showIdError(root, msg);
        } else {
          // 아이디 또는 비밀번호가 올바르지 않아요.
          showIdError(root, msg);
          showPwError(root, msg);
        }
        return;
      }

      window.App.routeToBoardFor(result.user);
    }

    submitBtn.addEventListener('click', doLogin);
    idInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    pwInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

    findBtn.addEventListener('click', function () {
      window.UI.showModal({
        title: '아이디 · 비밀번호 찾기',
        message: '계정 정보가 기억나지 않으신가요?<br/>고객센터로 문의해주세요.',
        buttons: [{ label: '확인', variant: 'btn-primary' }],
      });
    });
  }

  function unmount() {}

  window.Router.register('login', { render: render, mount: mount, unmount: unmount });
})();
