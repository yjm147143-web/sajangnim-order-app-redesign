/*
 * 아주 단순한 스택형 라우터 — 화면 모듈은 Router.register(name, def)로 등록한다.
 * def = { render(params) -> html string, mount(root, params), unmount() }
 */
(function () {
  const screens = {};
  const stack = [];
  let currentDef = null;

  function register(name, def) { screens[name] = def; }

  function showScreen(name, params, opts) {
    opts = opts || {};
    if (currentDef && currentDef.unmount) currentDef.unmount();
    const def = screens[name];
    if (!def) { console.error('Unknown screen: ' + name); return; }
    const root = document.getElementById('app-root');
    root.innerHTML = '<div class="screen" id="screen-' + name + '"></div>' +
      '<div id="toast-host" class="toast-host"></div>' +
      '<div id="modal-host"></div>';
    const screenEl = document.getElementById('screen-' + name);
    screenEl.innerHTML = def.render(params || {});
    currentDef = def;
    if (!opts.replace) stack.push({ name: name, params: params });
    else if (stack.length) stack[stack.length - 1] = { name: name, params: params };
    if (def.mount) def.mount(screenEl, params || {});
    window.scrollTo(0, 0);
  }

  function back() {
    if (stack.length <= 1) return;
    stack.pop();
    const prev = stack[stack.length - 1];
    showScreen(prev.name, prev.params, { replace: true });
  }

  function resetTo(name, params) {
    stack.length = 0;
    showScreen(name, params);
  }

  window.Router = { register: register, showScreen: showScreen, back: back, resetTo: resetTo };
})();
