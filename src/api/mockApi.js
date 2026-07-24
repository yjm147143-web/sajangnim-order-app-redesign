/*
 * Mock API 레이어 — 모든 화면은 이 함수들만 호출한다.
 * 실제 백엔드 연동 시 함수 시그니처는 유지한 채 본문만 fetch(real endpoint)로 교체하면 된다.
 */
(function () {
  let DB = window.MockDB.load();

  function persist() { window.MockDB.save(DB); }
  function uid(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 9); }
  function findUser(loginId) { return DB.users.find(function (u) { return u.loginId === loginId; }); }
  function findStore(id) { return DB.stores.find(function (s) { return s.id === id; }); }

  // ---------------- Session ----------------
  const SESSION_KEY = 'order-app-session';
  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
  }
  function setSession(userId) { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId: userId })); }
  function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

  function getCurrentUser() {
    const s = getSession();
    if (!s) return null;
    return DB.users.find(function (u) { return u.id === s.userId; }) || null;
  }

  // ---------------- 행사 담당자가 특정 매장의 설정 화면을 들여다볼 때 쓰는 컨텍스트 전환 ----------------
  // 사장님 계정은 자기 매장(storeId)만 다루지만, 행사 담당자는 매장이 없는 대신 행사 홈에서
  // 매장을 골라 그 매장인 것처럼 설정 화면을 볼 수 있다. 화면들은 로그인 사용자의 storeId 대신
  // 이 함수 하나만 거치면 되도록 통일한다.
  let actingStoreId = null;
  function setActingStoreId(storeId) { actingStoreId = storeId; }
  function clearActingStoreId() { actingStoreId = null; }
  function getActingStoreId() { return actingStoreId; }
  function getContextStoreId() {
    if (actingStoreId) return actingStoreId;
    const user = getCurrentUser();
    return user && user.storeId;
  }

  function getAutoLogin() { return localStorage.getItem('order-app-auto-login') || null; }
  function setAutoLogin(loginId) {
    if (loginId) localStorage.setItem('order-app-auto-login', loginId);
    else localStorage.removeItem('order-app-auto-login');
  }

  function login(params) {
    const role = params.role, loginId = (params.loginId || '').trim(), password = params.password || '';
    if (!loginId) return { ok: false, message: '아이디를 입력해주세요.' };
    if (!password) return { ok: false, message: '비밀번호를 입력해주세요.' };
    const user = findUser(loginId);
    if (!user || user.password !== password) return { ok: false, message: '아이디 또는 비밀번호가 올바르지 않아요.' };
    if (user.role !== role) {
      return { ok: false, message: role === 'OWNER' ? '사장님 계정이 아니에요' : '행사 담당자 계정이 아니에요' };
    }
    setSession(user.id);
    if (params.autoLogin) setAutoLogin(loginId); else setAutoLogin(null);
    actingStoreId = null; // 이전 세션에서 들여다보던 매장이 새 로그인에 그대로 남아있으면 안 된다
    return { ok: true, user: user };
  }

  function logout() { clearSession(); actingStoreId = null; }

  // ---------------- Store / Settings ----------------
  function getStore(storeId) { return findStore(storeId); }

  function isSameCalendarDay(isoA, isoB) {
    if (!isoA || !isoB) return false;
    const a = new Date(isoA), b = new Date(isoB);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function updateOperatingStatus(storeId, status) {
    const store = findStore(storeId);
    const now = new Date().toISOString();
    // 하루 중 두 번째 개점부터는 최초 개점 시각을 그대로 유지한다 (일시중지 전환은 이 값에 영향을 주지 않는다)
    if (status === 'OPEN' && !isSameCalendarDay(store.todayFirstOpenAt, now)) {
      store.todayFirstOpenAt = now;
    }
    store.operatingStatus = status;
    store.statusChangedAt = now;
    persist();
    return store;
  }

  // 자동수락 ON: 신규 주문이 대기 단계 없이 바로 처리중으로 인입된다.
  // (이 목업엔 실시간 신규 주문 유입이 없으므로, 켜는 시점에 이미 대기 중인 주문들을 즉시 자동 수락 처리해 그 효과를 보여준다.)
  function updateAutoAccept(storeId, enabled) {
    const store = findStore(storeId);
    store.autoAcceptOrders = enabled;
    let autoAcceptedCount = 0;
    if (enabled) {
      DB.orders.forEach(function (o) {
        if (o.storeId === storeId && o.status === 'WAITING') {
          o.status = 'PROCESSING';
          o.acceptedAt = new Date().toISOString();
          autoAcceptedCount += 1;
        }
      });
    }
    persist();
    return { store: store, autoAcceptedCount: autoAcceptedCount };
  }

  // 알림 설정: ON(디폴트)이면 소리·푸시·진동 모두 활성화, OFF면 소리·푸시 비활성화(진동만 남음).
  // 볼륨이 0이면 소리는 나지 않고 진동만 동작한다.
  function updateNotificationSettings(storeId, opts) {
    const store = findStore(storeId);
    if (opts.enabled != null) store.notificationEnabled = opts.enabled;
    if (opts.volume != null) store.notificationVolume = opts.volume;
    if (opts.soundType != null) store.notificationSoundType = opts.soundType;
    if (opts.repeatCount != null) store.notificationRepeatCount = opts.repeatCount;
    persist();
    return store;
  }

  // 최소 주문 금액: 매장 전체 공통 1개 값. OFF면 금액 제한 없이 주문 가능.
  function getMinOrderSettings(storeId) {
    const store = findStore(storeId);
    return {
      enabled: !!store.minOrderAmountEnabled,
      amount: store.minOrderAmount != null ? store.minOrderAmount : 10000,
      brandControlled: !!store.minOrderBrandControlled,
    };
  }

  function updateMinOrderSettings(storeId, opts) {
    const store = findStore(storeId);
    if (store.minOrderBrandControlled) return getMinOrderSettings(storeId);
    if (opts.enabled != null) store.minOrderAmountEnabled = opts.enabled;
    if (opts.amount != null) store.minOrderAmount = opts.amount;
    persist();
    return getMinOrderSettings(storeId);
  }

  // 주문 방식 관리: 예약 주문 / 배달(자리번호) 주문 / 손님 요청사항 수신 여부를 매장이 직접 켜고 끈다.
  function getOrderChannelSettings(storeId) {
    const store = findStore(storeId);
    return {
      acceptReservationOrders: store.acceptReservationOrders !== false,
      acceptSeatOrders: store.acceptSeatOrders !== false,
      acceptCustomerNotes: store.acceptCustomerNotes !== false,
      reservationHoursMode: store.reservationHoursMode === 'CUSTOM' ? 'CUSTOM' : 'OPERATING',
      operatingHoursStart: store.operatingHoursStart || '09:00',
      operatingHoursEnd: store.operatingHoursEnd || '21:00',
      reservationCustomStart: store.reservationCustomStart || '09:00',
      reservationCustomEnd: store.reservationCustomEnd || '21:00',
      seatInputPlaceholder: store.seatInputPlaceholder || '',
    };
  }

  function updateOrderChannelSettings(storeId, opts) {
    const store = findStore(storeId);
    if (opts.acceptReservationOrders != null) store.acceptReservationOrders = opts.acceptReservationOrders;
    if (opts.acceptSeatOrders != null) store.acceptSeatOrders = opts.acceptSeatOrders;
    if (opts.acceptCustomerNotes != null) store.acceptCustomerNotes = opts.acceptCustomerNotes;
    if (opts.reservationHoursMode != null) store.reservationHoursMode = opts.reservationHoursMode;
    if (opts.operatingHoursStart != null) store.operatingHoursStart = opts.operatingHoursStart;
    if (opts.operatingHoursEnd != null) store.operatingHoursEnd = opts.operatingHoursEnd;
    if (opts.reservationCustomStart != null) store.reservationCustomStart = opts.reservationCustomStart;
    if (opts.reservationCustomEnd != null) store.reservationCustomEnd = opts.reservationCustomEnd;
    if (opts.seatInputPlaceholder != null) store.seatInputPlaceholder = opts.seatInputPlaceholder;
    persist();
    return getOrderChannelSettings(storeId);
  }

  // 마감 시 '처리중' 주문 전체를 완료 처리하고 매장을 마감 상태로 전환한다.
  function closeStoreAndCompleteProcessing(storeId) {
    const store = findStore(storeId);
    const affected = DB.orders.filter(function (o) { return o.storeId === storeId && o.status === 'PROCESSING' && !o.canceled; });
    affected.forEach(function (o) {
      o.status = 'DONE';
      o.completeCount = (o.completeCount || 0) + 1;
      o.doneAt = new Date().toISOString();
    });
    store.operatingStatus = 'CLOSED';
    store.statusChangedAt = new Date().toISOString();
    persist();
    return { completedCount: affected.length };
  }

  function getCustomerGuideSettings(storeId) {
    const store = findStore(storeId);
    return {
      enabled: store.guideEnabled !== false,
      displayMode: store.guideDisplayMode || 'time',
      cookTimeBase: store.cookTimeBase != null ? store.cookTimeBase : 10,
      cookTimeMarginal: store.cookTimeMarginal != null ? store.cookTimeMarginal : 2,
      cookTimeBatch: store.cookTimeBatch != null ? store.cookTimeBatch : 6,
      hasHelper: !!store.cookHasHelper,
      helperCount: store.cookHelperCount != null ? store.cookHelperCount : 1,
      bufferMinutes: store.cookBufferMinutes != null ? store.cookBufferMinutes : 2,
      maxEstimateMinutes: store.cookMaxEstimateMinutes != null ? store.cookMaxEstimateMinutes : 60,
    };
  }

  function updateCustomerGuideSettings(storeId, payload) {
    const store = findStore(storeId);
    if (payload.enabled !== undefined) store.guideEnabled = payload.enabled;
    if (payload.displayMode !== undefined) store.guideDisplayMode = payload.displayMode;
    if (payload.cookTimeBase !== undefined) store.cookTimeBase = payload.cookTimeBase;
    if (payload.cookTimeMarginal !== undefined) store.cookTimeMarginal = payload.cookTimeMarginal;
    if (payload.cookTimeBatch !== undefined) store.cookTimeBatch = payload.cookTimeBatch;
    if (payload.hasHelper !== undefined) store.cookHasHelper = payload.hasHelper;
    if (payload.helperCount !== undefined) store.cookHelperCount = payload.helperCount;
    if (payload.bufferMinutes !== undefined) store.cookBufferMinutes = payload.bufferMinutes;
    if (payload.maxEstimateMinutes !== undefined) store.cookMaxEstimateMinutes = payload.maxEstimateMinutes;
    persist();
    return getCustomerGuideSettings(storeId);
  }

  function getQrMenuInfo(storeId) {
    const store = findStore(storeId);
    return { url: window.AppConfig.QR_ORDER_BASE_URL + storeId, storeName: store.name };
  }

  // ---------------- 권한 잠금 (사장님 계정 하나를 여러 사람이 함께 쓸 때, 선택한 민감 기능만 비밀번호로 보호) ----------------
  const DEFAULT_LOCK_SCOPES = { sales: false, statusChange: false, paymentCancel: false };

  function getPermissionLockStatus(storeId) {
    const store = findStore(storeId);
    return {
      isSet: !!store.permissionLockPassword,
      scopes: store.permissionLockScopes || Object.assign({}, DEFAULT_LOCK_SCOPES),
    };
  }

  function setPermissionLockPassword(storeId, password, scopes) {
    const store = findStore(storeId);
    store.permissionLockPassword = password;
    store.permissionLockScopes = scopes || { sales: true, statusChange: true, paymentCancel: true };
    persist();
    return getPermissionLockStatus(storeId);
  }

  function updatePermissionLockScopes(storeId, scopes) {
    const store = findStore(storeId);
    store.permissionLockScopes = scopes;
    persist();
    return getPermissionLockStatus(storeId);
  }

  function clearPermissionLockPassword(storeId) {
    const store = findStore(storeId);
    store.permissionLockPassword = null;
    store.permissionLockScopes = null;
    persist();
    return getPermissionLockStatus(storeId);
  }

  function verifyPermissionLockPassword(storeId, password) {
    const store = findStore(storeId);
    return store.permissionLockPassword === password;
  }

  // ---------------- Menu ----------------
  function getCategories(storeId) {
    return DB.categories.filter(function (c) { return c.storeId === storeId; }).sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  }

  function getMenuItems(storeId, categoryId) {
    let list = DB.menuItems.filter(function (m) { return m.storeId === storeId; });
    if (categoryId) list = list.filter(function (m) { return m.categoryId === categoryId; });
    return list.sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  }

  function getMenuItem(id) { return DB.menuItems.find(function (m) { return m.id === id; }); }

  function checkAutoSoldout(item) {
    if (item.autoSoldoutEnabled && item.stockQuantity <= 0) { item.soldOut = true; return true; }
    return false;
  }

  function addMenuItem(storeId, payload) {
    const maxOrder = Math.max(0, ...DB.menuItems.filter(function (m) { return m.storeId === storeId && m.categoryId === payload.categoryId; }).map(function (m) { return m.sortOrder; }));
    const item = Object.assign({ id: uid('menu'), storeId: storeId, soldOut: false, sortOrder: maxOrder + 1, optionGroupIds: [] }, payload);
    const triggered = checkAutoSoldout(item);
    DB.menuItems.push(item);
    persist();
    return { item: item, autoSoldoutTriggered: triggered ? [item.name] : [] };
  }

  function updateMenuItem(id, payload) {
    const item = getMenuItem(id);
    Object.assign(item, payload);
    const triggered = checkAutoSoldout(item);
    persist();
    return { item: item, autoSoldoutTriggered: triggered ? [item.name] : [] };
  }

  // ---------------- 옵션 그룹 (매장 단위 공유 라이브러리) ----------------
  // 완전 연동 모델: 그룹 하나가 storeId 아래 유일하게 존재하고, 메뉴는 optionGroupIds로 그 그룹을 참조한다.
  // 그룹 내용(이름/옵션/가격/품절/노출)을 수정하면 이 그룹을 쓰는 모든 메뉴에 즉시 반영된다.
  function getOptionGroups(storeId) {
    return DB.optionGroups.filter(function (g) { return g.storeId === storeId; });
  }

  function getOptionGroup(id) { return DB.optionGroups.find(function (g) { return g.id === id; }); }

  function getOptionGroupsByIds(ids) {
    return (ids || []).map(function (id) { return getOptionGroup(id); }).filter(Boolean);
  }

  function getOptionGroupUsageCount(id) {
    return DB.menuItems.filter(function (m) { return (m.optionGroupIds || []).indexOf(id) !== -1; }).length;
  }

  function addOptionGroup(storeId, payload) {
    const group = Object.assign({ id: uid('og'), storeId: storeId, name: '', required: false, multiSelect: false, options: [] }, payload);
    DB.optionGroups.push(group);
    persist();
    return group;
  }

  function updateOptionGroup(id, payload) {
    const group = getOptionGroup(id);
    Object.assign(group, payload);
    persist();
    return group;
  }

  function deleteOptionGroup(id) {
    const usage = getOptionGroupUsageCount(id);
    if (usage > 0) return { ok: false, usage: usage };
    DB.optionGroups = DB.optionGroups.filter(function (g) { return g.id !== id; });
    persist();
    return { ok: true };
  }

  function addOptionGroupOption(groupId, payload) {
    const group = getOptionGroup(groupId);
    group.options.push(Object.assign({ name: '', price: 0, soldOut: false, exposed: true }, payload));
    persist();
    return group;
  }

  function updateOptionGroupOption(groupId, optIndex, payload) {
    const group = getOptionGroup(groupId);
    Object.assign(group.options[optIndex], payload);
    persist();
    return group;
  }

  function removeOptionGroupOption(groupId, optIndex) {
    const group = getOptionGroup(groupId);
    group.options.splice(optIndex, 1);
    persist();
    return group;
  }

  function toggleSoldOut(id, soldOut) {
    const item = getMenuItem(id);
    item.soldOut = soldOut;
    persist();
    return item;
  }

  function moveMenuItem(id, direction) {
    const item = getMenuItem(id);
    const siblings = getMenuItems(item.storeId, item.categoryId);
    const idx = siblings.findIndex(function (m) { return m.id === id; });
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return item;
    const other = siblings[swapIdx];
    const tmp = item.sortOrder; item.sortOrder = other.sortOrder; other.sortOrder = tmp;
    persist();
    return item;
  }

  // ---------------- Orders ----------------
  function getOrder(id) { return DB.orders.find(function (o) { return o.id === id; }); }

  function nextPickupNo(storeId) {
    const existingNums = DB.orders
      .filter(function (o) { return o.storeId === storeId; })
      .map(function (o) { return parseInt(o.pickupNo, 10) || 0; });
    return String((existingNums.length ? Math.max.apply(null, existingNums) : 1000) + 1);
  }

  // ---------------- 주문 관리 > 주문 생성 (현금/상품권 등 사장님이 현장에서 직접 만드는 주문) ----------------
  // 연락처는 사장님이 입력하지 않는다 — 결제 완료 후 QR로 손님이 직접 남기게 하고, 그 전까지는 null로 둔다.
  // 조리 여부와 무관하게 이미 결제까지 끝난 주문이라 대기(수락) 단계 없이 바로 '처리중'으로 들어간다.
  function createManualOrder(storeId, payload) {
    const items = (payload.items || []).filter(function (it) { return it.quantity > 0; });
    if (!items.length) return null;
    const amount = items.reduce(function (sum, it) { return sum + it.price * it.quantity; }, 0);
    const now = new Date().toISOString();
    const order = {
      id: uid('order'), storeId: storeId,
      paymentOrderNo: 'CASH-' + Math.floor(800000 + Math.random() * 99999),
      pickupNo: nextPickupNo(storeId),
      identifierType: 'PICKUP',
      channel: 'MANUAL',
      paymentMethod: payload.paymentMethod,
      amount: amount,
      items: items.map(function (it) { return { menuName: it.menuName, optionNames: [], quantity: it.quantity }; }),
      customerContact: null,
      orderedAt: now, acceptedAt: now, doneAt: null,
      status: 'PROCESSING', called: false, calledCount: 0, completeCount: 0,
      canceled: false, cancelReason: null, cancelType: null,
      isReservation: false, reservationTime: null,
      customerNote: null,
      isReusableContainer: false,
      promoType: null,
    };
    DB.orders.unshift(order);
    persist();
    return order;
  }

  // 손님이 QR로 열어 직접 남긴 연락처를 저장한다. 이 시점이 실질적인 '결제 완료 알림' 발송 시점이다
  // (그 전엔 보낼 대상이 없었으니까).
  function setOrderContact(orderId, contact) {
    const o = getOrder(orderId);
    if (!o) return { ok: false };
    o.customerContact = contact;
    persist();
    return { ok: true, order: o, notification: '결제 완료' };
  }

  // ---------------- 개발자 도구: 선택한 조건에 맞는 신규 주문 1건 생성 (실시간 주문 유입 시뮬레이션) ----------------
  // opts: { hasNote, isReservation, channel: 'QR'|'TABLET', identifierType: 'PICKUP'|'SEAT', multiMenu, hasOption,
  //         isReusableContainer, promoType: null|'GROUP_COUPON'|'STORE_COUPON'|'HAPPY_HOUR'|'FIRST_COME' }
  function createCustomOrder(storeId, opts) {
    opts = opts || {};
    const menuItems = DB.menuItems.filter(function (m) { return m.storeId === storeId && !m.soldOut; });
    if (!menuItems.length) return null;
    const store = findStore(storeId);
    const channelSettings = getOrderChannelSettings(storeId);
    const identifierType = (opts.identifierType === 'SEAT' && channelSettings.acceptSeatOrders) ? 'SEAT' : 'PICKUP';
    const phones = ['01011112222', '01022223333', '01033334444', '01044445555', '01055556666', '01066667777', '01077778888'];
    const emails = ['guest01@example.com', 'guest02@example.com', 'guest03@example.com', 'guest04@example.com'];
    const payments = ['카드', '간편결제', '쿠폰'];
    const seatCodes = ['A-3', 'A-12', 'B-2', 'B-7', 'C-1', 'D-5'];
    const isReservation = !!opts.isReservation && channelSettings.acceptReservationOrders;

    // 옵션 있음: 옵션 그룹(+ 옵션값)이 실제로 연결된 메뉴만 후보로 삼는다.
    const itemsWithOption = menuItems.filter(function (m) {
      return getOptionGroupsByIds(m.optionGroupIds).some(function (g) { return (g.options || []).length; });
    });
    function buildLine(preferOption) {
      const pool = (preferOption && itemsWithOption.length) ? itemsWithOption : menuItems;
      const menu = pool[Math.floor(Math.random() * pool.length)];
      const qty = 1 + Math.floor(Math.random() * 2);
      let optionNames = [];
      if (preferOption) {
        const group = getOptionGroupsByIds(menu.optionGroupIds).find(function (g) { return (g.options || []).length; });
        if (group) optionNames = [group.options[Math.floor(Math.random() * group.options.length)].name];
      }
      return { menuName: menu.name, optionNames: optionNames, quantity: qty, price: menu.price };
    }

    const lineCount = Math.max(1, opts.lineCount || 1);
    const lines = [];
    let amount = 0;
    for (let i = 0; i < lineCount; i++) {
      // 옵션 있음을 선택했을 땐 최소 1개 메뉴엔 옵션이 붙도록 첫 줄에서 우선 배정한다.
      const line = buildLine(!!opts.hasOption && i === 0);
      lines.push({ menuName: line.menuName, optionNames: line.optionNames, quantity: line.quantity });
      amount += line.price * line.quantity;
    }

    let identifierValue;
    if (identifierType === 'SEAT') {
      identifierValue = seatCodes[Math.floor(Math.random() * seatCodes.length)];
    } else {
      identifierValue = nextPickupNo(storeId);
    }

    const autoAccept = !!(store && store.autoAcceptOrders);
    // VAN 결제는 QA에서 태블릿오더 취소 예외팝업(실물 카드 필요)을 재현하기 위한 강제 지정값이라 랜덤 후보에 넣지 않는다.
    const paymentMethod = opts.paymentMethod === 'VAN' ? 'VAN' : payments[Math.floor(Math.random() * payments.length)];
    const promoType = opts.hasFirstCome ? 'FIRST_COME' : (opts.hasHappyHour ? 'HAPPY_HOUR' : null);

    const order = {
      id: uid('order'), storeId: storeId,
      paymentOrderNo: 'PG-' + Math.floor(800000 + Math.random() * 99999),
      pickupNo: identifierValue,
      identifierType: identifierType,
      channel: opts.channel === 'TABLET' ? 'TABLET' : 'QR',
      paymentMethod: paymentMethod,
      amount: amount,
      items: lines,
      customerContact: opts.contactType === 'EMAIL' ? emails[Math.floor(Math.random() * emails.length)] : phones[Math.floor(Math.random() * phones.length)],
      orderedAt: new Date().toISOString(),
      acceptedAt: autoAccept ? new Date().toISOString() : null, doneAt: null,
      status: autoAccept ? 'PROCESSING' : 'WAITING', called: false, calledCount: 0, completeCount: 0,
      canceled: false, cancelReason: null, cancelType: null,
      isReservation: isReservation,
      reservationTime: isReservation ? new Date(Date.now() + (20 + Math.floor(Math.random() * 100)) * 60000).toISOString() : null,
      customerNote: null,
      isReusableContainer: !!opts.isReusableContainer,
      promoType: promoType,
    };
    DB.orders.unshift(order);
    persist();
    return order;
  }

  // 개발자 도구 > 메뉴 자동품절 시뮬레이션: 재고 감소 없이 즉시 품절 처리하고 실제 자동품절과 같은 이벤트를 쏜다.
  function triggerRandomAutoSoldout(storeId) {
    const candidates = DB.menuItems.filter(function (m) { return m.storeId === storeId && !m.soldOut; });
    if (!candidates.length) return null;
    const item = candidates[Math.floor(Math.random() * candidates.length)];
    item.soldOut = true;
    persist();
    window.dispatchEvent(new CustomEvent('mock:auto-soldout', { detail: { names: [item.name] } }));
    return item.name;
  }

  // 유형별 필터 각 항목이 실제 주문에 해당하는지 판정
  function matchesOrderType(order, type) {
    if (type === 'RESERVATION') return !!order.isReservation;
    if (type === 'DELIVERY') return order.identifierType === 'SEAT';
    if (type === 'CALLED') return !!order.called;
    return false;
  }

  function getOrders(storeId, opts) {
    opts = opts || {};
    let list = DB.orders.filter(function (o) { return o.storeId === storeId; });
    if (opts.status) list = list.filter(function (o) { return o.status === opts.status; });
    // 메뉴별/유형별 필터는 각 카테고리 내에서는 중복 선택(OR), 카테고리 사이에는 동시 적용(AND)된다
    if (opts.menuFilters && opts.menuFilters.length) {
      list = list.filter(function (o) {
        return o.items.some(function (it) { return opts.menuFilters.indexOf(it.menuName) !== -1; });
      });
    }
    if (opts.orderTypeFilters && opts.orderTypeFilters.length) {
      list = list.filter(function (o) {
        return opts.orderTypeFilters.some(function (t) { return matchesOrderType(o, t); });
      });
    }
    if (opts.calledFilter === 'CALLED') list = list.filter(function (o) { return !!o.called; });
    else if (opts.calledFilter === 'NOT_CALLED') list = list.filter(function (o) { return !o.called; });
    if (opts.search) {
      const q = opts.search.trim();
      list = list.filter(function (o) { return o.pickupNo.indexOf(q) !== -1; });
    }
    list = list.slice().sort(function (a, b) {
      const ta = new Date(a.orderedAt).getTime(), tb = new Date(b.orderedAt).getTime();
      return opts.sortDir === 'asc' ? ta - tb : tb - ta;
    });
    return list;
  }

  // 주문이 수락되면 실제로 준비량이 줄고, 그 결과 0이 되면 자동 품절 처리한다.
  // 화면(order.js)에서 하단 배너로 안내할 수 있도록 전역 이벤트로 새로 품절된 메뉴명을 알려준다.
  function applyStockForOrder(order) {
    const newlySoldOut = [];
    (order.items || []).forEach(function (it) {
      const menuItem = DB.menuItems.find(function (m) { return m.storeId === order.storeId && m.name === it.menuName; });
      if (!menuItem || menuItem.stockQuantity == null) return;
      menuItem.stockQuantity = Math.max(0, menuItem.stockQuantity - it.quantity);
      if (checkAutoSoldout(menuItem)) newlySoldOut.push(menuItem.name);
    });
    if (newlySoldOut.length) {
      window.dispatchEvent(new CustomEvent('mock:auto-soldout', { detail: { names: newlySoldOut } }));
    }
  }

  function acceptOrder(id) {
    const o = getOrder(id);
    o.status = 'PROCESSING';
    o.acceptedAt = new Date().toISOString();
    applyStockForOrder(o);
    persist();
    return { order: o, notification: '주문 완료' };
  }

  function cancelOrder(id, reason) {
    const o = getOrder(id);
    o.status = 'DONE';
    o.canceled = true;
    o.cancelReason = reason;
    o.cancelType = 'CANCEL';
    o.doneAt = new Date().toISOString();
    o.cancelledAt = o.doneAt;
    persist();
    return { order: o, notification: '주문 거절' };
  }

  function callCustomer(id) {
    const o = getOrder(id);
    o.called = true;
    o.calledCount = (o.calledCount || 0) + 1;
    persist();
    return { order: o, notification: '픽업 안내' };
  }

  function completeOrder(id) {
    const o = getOrder(id);
    o.status = 'DONE';
    o.completeCount = (o.completeCount || 0) + 1;
    o.doneAt = new Date().toISOString();
    persist();
    return { order: o };
  }

  function cancelPayment(id, reason) {
    const o = getOrder(id);
    o.status = 'DONE';
    o.canceled = true;
    o.cancelReason = reason;
    o.cancelType = 'PAYMENT_CANCEL';
    o.doneAt = new Date().toISOString();
    o.cancelledAt = o.doneAt;
    persist();
    return { order: o, notification: '결제 취소' };
  }

  function revertOrder(id) {
    const o = getOrder(id);
    o.status = 'PROCESSING';
    o.canceled = false;
    o.cancelReason = null;
    o.cancelType = null;
    o.cancelledAt = null;
    persist();
    return { order: o };
  }

  function returnOrder(id, reason) {
    const o = getOrder(id);
    o.canceled = true;
    o.cancelReason = reason;
    o.cancelType = 'RETURN';
    o.cancelledAt = new Date().toISOString();
    persist();
    return { order: o, notification: '결제 취소' };
  }

  function bulkAction(ids, action, extra) {
    const results = ids.map(function (id) {
      if (action === 'accept') return acceptOrder(id);
      if (action === 'call') return callCustomer(id);
      if (action === 'complete') return completeOrder(id);
      return null;
    });
    return results;
  }

  // ---------------- Sales (사장님) ----------------
  function ordersFor(storeId) { return DB.orders.filter(function (o) { return o.storeId === storeId; }); }

  // 매출 조회 공통 기간 필터: { preset: 'today'|'yesterday'|'last30'|'custom', start, end }
  // '기간 설정'(custom)은 최근 30일 범위 안에서만 조회 가능 (getSalesDateBounds 참고)
  function getSalesDateBounds() {
    const today = new Date();
    const min = new Date(today.getTime() - 29 * 86400000);
    return { min: min.toISOString().slice(0, 10), max: today.toISOString().slice(0, 10) };
  }

  function filterDailyRange(dailySales, range) {
    range = range || { preset: 'today' };
    const todayStr = new Date().toISOString().slice(0, 10);
    if (range.preset === 'yesterday') {
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      return dailySales.filter(function (d) { return d.date === y; });
    }
    if (range.preset === 'last30') return dailySales;
    if (range.preset === 'custom' && range.start && range.end) {
      const bounds = getSalesDateBounds();
      const start = range.start < bounds.min ? bounds.min : range.start;
      const end = range.end > bounds.max ? bounds.max : range.end;
      return dailySales.filter(function (d) { return d.date >= start && d.date <= end; });
    }
    return dailySales.filter(function (d) { return d.date === todayStr; });
  }

  function getSalesByChannel(storeId, range) {
    const store = findStore(storeId);
    const days = filterDailyRange(store.dailySales || [], range);
    const sums = { QR: 0, TABLET: 0, CASH: 0 };
    const counts = { QR: 0, TABLET: 0, CASH: 0 };
    days.forEach(function (d) {
      sums.QR += d.byChannel.QR; sums.TABLET += d.byChannel.TABLET; sums.CASH += d.byChannel.CASH;
      const c = d.byChannelCount || {};
      counts.QR += c.QR || 0; counts.TABLET += c.TABLET || 0; counts.CASH += c.CASH || 0;
    });
    return [
      { name: 'QR오더', amount: sums.QR, count: counts.QR },
      { name: '키오스크', amount: sums.TABLET, count: counts.TABLET },
      { name: '현금', amount: sums.CASH, count: counts.CASH },
    ];
  }

  function getSalesByPayment(storeId, range) {
    const store = findStore(storeId);
    const days = filterDailyRange(store.dailySales || [], range);
    const sums = { 카드: 0, 간편결제: 0, 쿠폰: 0 };
    const counts = { 카드: 0, 간편결제: 0, 쿠폰: 0 };
    days.forEach(function (d) {
      sums.카드 += d.byPayment.카드; sums.간편결제 += d.byPayment.간편결제; sums.쿠폰 += d.byPayment.쿠폰;
      const c = d.byPaymentCount || {};
      counts.카드 += c.카드 || 0; counts.간편결제 += c.간편결제 || 0; counts.쿠폰 += c.쿠폰 || 0;
    });
    return Object.keys(sums).map(function (k) { return { name: k, amount: sums[k], count: counts[k] }; });
  }

  function getSalesByHour(storeId, range) {
    const store = findStore(storeId);
    const days = filterDailyRange(store.dailySales || [], range);
    const hours = ['10', '11', '12', '13', '14', '15', '16'];
    const sums = {}; const counts = {};
    hours.forEach(function (h) { sums[h] = 0; counts[h] = 0; });
    days.forEach(function (d) { d.byHour.forEach(function (h) { sums[h.hour] += h.amount; counts[h.hour] += h.count || 0; }); });
    return hours.map(function (h) { return { name: h + '시', amount: sums[h], count: counts[h] }; });
  }

  function getSalesByMenu(storeId, range) {
    const store = findStore(storeId);
    const days = filterDailyRange(store.dailySales || [], range);
    const map = {};
    days.forEach(function (d) {
      d.byMenu.forEach(function (m) {
        if (!map[m.name]) map[m.name] = { name: m.name, qty: 0, amount: 0 };
        map[m.name].qty += m.qty; map[m.name].amount += m.amount;
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.amount - a.amount; });
  }

  function getSalesByPeriod(storeId, range) {
    const store = findStore(storeId);
    const days = filterDailyRange(store.dailySales || [], range);
    return days.map(function (d) { return { name: d.date.slice(5).replace('-', '.'), amount: d.totalAmount, date: d.date, count: d.orderCount || 0 }; });
  }

  // 매출 조회 상단의 총 주문건수/총 매출액/주문단가 3개 요약 지표에 쓰인다
  function getSalesSummary(storeId, range) {
    const store = findStore(storeId);
    const days = filterDailyRange(store.dailySales || [], range);
    const totalAmount = days.reduce(function (s, d) { return s + d.totalAmount; }, 0);
    const totalOrderCount = days.reduce(function (s, d) { return s + (d.orderCount || 0); }, 0);
    return {
      totalAmount: totalAmount,
      totalOrderCount: totalOrderCount,
      avgOrderValue: totalOrderCount ? Math.round(totalAmount / totalOrderCount) : 0,
    };
  }

  // ---------------- Event Manager ----------------
  function getMyEvents(userId) {
    const user = DB.users.find(function (u) { return u.id === userId; });
    return DB.events.filter(function (e) { return user.eventIds.indexOf(e.id) !== -1; });
  }

  function getEvent(eventId) { return DB.events.find(function (e) { return e.id === eventId; }); }

  function getStoresByEvent(eventId) { return DB.stores.filter(function (s) { return s.eventId === eventId; }); }

  function getEventDashboardSummary(eventId) {
    const stores = getStoresByEvent(eventId);
    const open = stores.filter(function (s) { return s.operatingStatus === 'OPEN'; }).length;
    const paused = stores.filter(function (s) { return s.operatingStatus === 'PAUSED'; }).length;
    const closed = stores.filter(function (s) { return s.operatingStatus === 'CLOSED'; }).length;
    const todayAmount = stores.reduce(function (s, st) { return s + (st.todaySalesAmount || 0); }, 0);
    const totalAmount = stores.reduce(function (s, st) { return s + (st.totalSalesAmount || 0); }, 0);
    const todayOrderCount = stores.reduce(function (s, st) { return s + (st.todayOrderCount || 0); }, 0);
    return {
      storeCount: stores.length, open: open, paused: paused, closed: closed,
      todayAmount: todayAmount, totalAmount: totalAmount, todayOrderCount: todayOrderCount,
      avgPerStoreToday: stores.length ? Math.round(todayAmount / stores.length) : 0,
      avgPerStoreTotal: stores.length ? Math.round(totalAmount / stores.length) : 0,
    };
  }

  function getAttentionStores(eventId) {
    const event = getEvent(eventId);
    const stores = getStoresByEvent(eventId);
    const attention = [];
    stores.forEach(function (store) {
      const waitingOrders = DB.orders.filter(function (o) { return o.storeId === store.id && o.status === 'WAITING' && !o.canceled; });
      const delayed = waitingOrders.find(function (o) { return (Date.now() - new Date(o.orderedAt).getTime()) / 60000 >= 15; });
      if (delayed) attention.push({ storeId: store.id, storeName: store.name, reason: '미수락 주문이 15분 이상 지연되고 있어요' });
      if (store.operatingStatus === 'OPEN' && store.lastOrderAt && (Date.now() - new Date(store.lastOrderAt).getTime()) / 60000 >= 60) {
        attention.push({ storeId: store.id, storeName: store.name, reason: '1시간 이상 신규 주문이 없어요' });
      }
      if (store.operatingStatus === 'CLOSED' && event.status === 'ONGOING' && store.statusChangedAt && (Date.now() - new Date(store.statusChangedAt).getTime()) / 60000 >= 30) {
        attention.push({ storeId: store.id, storeName: store.name, reason: '30분 이상 마감 상태가 지속되고 있어요' });
      }
    });
    return attention;
  }

  function bulkUpdateStoreStatus(storeIds, targetStatus) {
    let success = 0, skipped = 0, failed = 0;
    const failedNames = [];
    storeIds.forEach(function (id) {
      const store = findStore(id);
      if (store.operatingStatus === targetStatus) { skipped++; return; }
      const fail = Math.random() < 0.1;
      if (fail) { failed++; failedNames.push(store.name); return; }
      store.operatingStatus = targetStatus;
      store.statusChangedAt = new Date().toISOString();
      success++;
    });
    persist();
    return { success: success, skipped: skipped, failed: failed, failedNames: failedNames };
  }

  function addAuditLog(eventId, message, resultSummary) {
    DB.auditLogs.unshift({ id: uid('audit'), eventId: eventId, message: message, resultSummary: resultSummary, timestamp: new Date().toISOString() });
    persist();
  }

  function getAuditLogs(eventId) { return DB.auditLogs.filter(function (a) { return a.eventId === eventId; }); }

  function getEventSalesSummary(eventId) {
    return getEventDashboardSummary(eventId);
  }

  // 매장별 매출 랭킹 + 매장별 제일 많이 팔린 메뉴 (행사담당자 매출현황 > 상세매출 > 매장별 매출)
  function getEventStoreSalesRanking(eventId) {
    const stores = getStoresByEvent(eventId);
    return stores.map(function (s) {
      let topMenuName = s.topMenuName || null;
      let topMenuQty = s.topMenuQty || null;
      if (s.salesStats && s.salesStats.byMenu && s.salesStats.byMenu.length) {
        const sorted = s.salesStats.byMenu.slice().sort(function (a, b) { return b.amount - a.amount; });
        topMenuName = sorted[0].name;
        topMenuQty = sorted[0].qty;
      }
      return { name: s.name, amount: s.todaySalesAmount || 0, totalAmount: s.totalSalesAmount || 0, topMenuName: topMenuName, topMenuQty: topMenuQty, storeId: s.id };
    }).sort(function (a, b) { return b.amount - a.amount; });
  }

  // 행사 담당자용 기간 프리셋: 'today'(당일) | 'yesterday'(전일) | 'eventPeriod'(행사일)
  function amountForPreset(store, preset) {
    if (store.id === 'store-1' && store.dailySales) {
      if (preset === 'yesterday') { const r = store.dailySales[store.dailySales.length - 2]; return r ? r.totalAmount : 0; }
      if (preset === 'eventPeriod') return store.totalSalesAmount || 0;
      const r = store.dailySales[store.dailySales.length - 1]; return r ? r.totalAmount : 0;
    }
    if (preset === 'yesterday') return store.yesterdaySalesAmount || 0;
    if (preset === 'eventPeriod') return store.totalSalesAmount || 0;
    return store.todaySalesAmount || 0;
  }

  function getEventSalesByPayment(eventId, preset) {
    preset = preset || 'today';
    const stores = getStoresByEvent(eventId);
    const agg = { 카드: 0, 간편결제: 0, 쿠폰: 0 };
    stores.forEach(function (s) {
      if (s.id === 'store-1' && s.dailySales && preset !== 'eventPeriod') {
        const idx = preset === 'yesterday' ? s.dailySales.length - 2 : s.dailySales.length - 1;
        const rec = s.dailySales[idx];
        if (rec) { agg.카드 += rec.byPayment.카드; agg.간편결제 += rec.byPayment.간편결제; agg.쿠폰 += rec.byPayment.쿠폰; }
        return;
      }
      const base = amountForPreset(s, preset);
      agg['카드'] += Math.round(base * 0.6);
      agg['간편결제'] += Math.round(base * 0.3);
      agg['쿠폰'] += Math.round(base * 0.1);
    });
    return Object.keys(agg).map(function (k) { return { name: k, amount: agg[k] }; });
  }

  // 행사담당자 상세매출 > 기간별 매출: 당일/전일은 단일 합계, 행사일은 행사 시작일~오늘 일자별 추이
  function getEventSalesByPeriod(eventId, preset) {
    preset = preset || 'today';
    const event = getEvent(eventId);
    const stores = getStoresByEvent(eventId);
    if (preset === 'today' || preset === 'yesterday') {
      let amount = 0;
      stores.forEach(function (s) { amount += amountForPreset(s, preset); });
      return [{ name: preset === 'today' ? '오늘' : '전일', amount: amount }];
    }
    const start = new Date(event.startDate);
    const dayCount = Math.max(1, Math.round((Date.now() - start.getTime()) / 86400000) + 1);
    const days = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      let amount = 0;
      stores.forEach(function (s) {
        if (s.id === 'store-1' && s.dailySales) {
          const rec = s.dailySales.find(function (x) { return x.date === dateStr; });
          amount += rec ? rec.totalAmount : Math.round((s.totalSalesAmount || 0) / dayCount);
        } else {
          amount += Math.round((s.totalSalesAmount || 0) / dayCount);
        }
      });
      days.push({ name: dateStr.slice(5).replace('-', '.'), amount: amount, date: dateStr });
    }
    return days;
  }

  function getEventSalesByHour(eventId) {
    const stores = getStoresByEvent(eventId);
    const hours = ['10', '11', '12', '13', '14', '15', '16'];
    return hours.map(function (h) {
      let amount = 0;
      stores.forEach(function (s) {
        const found = s.salesStats && s.salesStats.byHour && s.salesStats.byHour.find(function (x) { return x.hour === h; });
        amount += found ? found.amount : Math.round((s.todaySalesAmount || 0) / hours.length);
      });
      return { name: h + '시', amount: amount };
    });
  }

  function getEventSalesByChannel(eventId) {
    const stores = getStoresByEvent(eventId);
    let qr = 0, tablet = 0;
    stores.forEach(function (s) {
      const orders = DB.orders.filter(function (o) { return o.storeId === s.id && o.status === 'DONE' && !o.canceled; });
      qr += orders.filter(function (o) { return o.channel === 'QR'; }).reduce(function (sum, o) { return sum + o.amount; }, 0);
      tablet += orders.filter(function (o) { return o.channel === 'TABLET'; }).reduce(function (sum, o) { return sum + o.amount; }, 0);
      if (!orders.length && s.todaySalesAmount) { qr += Math.round(s.todaySalesAmount * 0.65); tablet += Math.round(s.todaySalesAmount * 0.35); }
    });
    return [{ name: 'QR오더', amount: qr }, { name: '키오스크', amount: tablet }];
  }

  function getEventSalesByMenu(eventId) {
    const stores = getStoresByEvent(eventId);
    let rows = [];
    stores.forEach(function (s) {
      if (s.salesStats && s.salesStats.byMenu) {
        s.salesStats.byMenu.forEach(function (m) { rows.push({ name: m.name + ' (' + s.name + ')', qty: m.qty, amount: m.amount }); });
      }
    });
    return rows.sort(function (a, b) { return b.amount - a.amount; }).slice(0, 8);
  }

  window.MockApi = {
    getCurrentUser: getCurrentUser, getAutoLogin: getAutoLogin, login: login, logout: logout,
    setActingStoreId: setActingStoreId, clearActingStoreId: clearActingStoreId,
    getActingStoreId: getActingStoreId, getContextStoreId: getContextStoreId,
    getStore: getStore, updateOperatingStatus: updateOperatingStatus, updateAutoAccept: updateAutoAccept,
    updateNotificationSettings: updateNotificationSettings,
    getMinOrderSettings: getMinOrderSettings, updateMinOrderSettings: updateMinOrderSettings,
    getOrderChannelSettings: getOrderChannelSettings, updateOrderChannelSettings: updateOrderChannelSettings,
    closeStoreAndCompleteProcessing: closeStoreAndCompleteProcessing,
    getCustomerGuideSettings: getCustomerGuideSettings, updateCustomerGuideSettings: updateCustomerGuideSettings, getQrMenuInfo: getQrMenuInfo,
    getPermissionLockStatus: getPermissionLockStatus, setPermissionLockPassword: setPermissionLockPassword,
    updatePermissionLockScopes: updatePermissionLockScopes,
    clearPermissionLockPassword: clearPermissionLockPassword, verifyPermissionLockPassword: verifyPermissionLockPassword,
    getCategories: getCategories, getMenuItems: getMenuItems, getMenuItem: getMenuItem,
    addMenuItem: addMenuItem, updateMenuItem: updateMenuItem, toggleSoldOut: toggleSoldOut, moveMenuItem: moveMenuItem,
    getOptionGroups: getOptionGroups, getOptionGroup: getOptionGroup, getOptionGroupsByIds: getOptionGroupsByIds,
    getOptionGroupUsageCount: getOptionGroupUsageCount, addOptionGroup: addOptionGroup, updateOptionGroup: updateOptionGroup,
    deleteOptionGroup: deleteOptionGroup, addOptionGroupOption: addOptionGroupOption,
    updateOptionGroupOption: updateOptionGroupOption, removeOptionGroupOption: removeOptionGroupOption,
    getOrder: getOrder, getOrders: getOrders, acceptOrder: acceptOrder, cancelOrder: cancelOrder,
    createCustomOrder: createCustomOrder, triggerRandomAutoSoldout: triggerRandomAutoSoldout,
    createManualOrder: createManualOrder, setOrderContact: setOrderContact,
    callCustomer: callCustomer, completeOrder: completeOrder, cancelPayment: cancelPayment,
    revertOrder: revertOrder, returnOrder: returnOrder, bulkAction: bulkAction,
    getSalesByChannel: getSalesByChannel, getSalesByPayment: getSalesByPayment, getSalesByHour: getSalesByHour,
    getSalesByMenu: getSalesByMenu, getSalesByPeriod: getSalesByPeriod, getSalesDateBounds: getSalesDateBounds,
    getSalesSummary: getSalesSummary,
    getMyEvents: getMyEvents, getEvent: getEvent, getStoresByEvent: getStoresByEvent,
    getEventDashboardSummary: getEventDashboardSummary, getAttentionStores: getAttentionStores,
    bulkUpdateStoreStatus: bulkUpdateStoreStatus, addAuditLog: addAuditLog, getAuditLogs: getAuditLogs,
    getEventSalesSummary: getEventSalesSummary,
    getEventStoreSalesRanking: getEventStoreSalesRanking,
    getEventSalesByPayment: getEventSalesByPayment, getEventSalesByHour: getEventSalesByHour,
    getEventSalesByChannel: getEventSalesByChannel, getEventSalesByMenu: getEventSalesByMenu,
    getEventSalesByPeriod: getEventSalesByPeriod,
  };
})();
