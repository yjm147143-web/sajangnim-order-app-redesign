(function () {
  function boot() {
    const user = window.MockApi.getCurrentUser();
    if (user) {
      routeToBoardFor(user);
      return;
    }
    Router.resetTo('login');
  }

  function routeToBoardFor(user) {
    if (user.role === 'EVENT_MANAGER') {
      Router.resetTo('eventSelect');
    } else {
      Router.resetTo('order');
    }
  }

  window.App = { boot: boot, routeToBoardFor: routeToBoardFor };

  document.addEventListener('DOMContentLoaded', boot);
})();
