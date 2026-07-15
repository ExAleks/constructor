/**
 * Конструктор клавиатур v2: menus.* → keyboard_constructor_json
 * Сетка 2 колонки, ширина 1/2, зона «Скрытые» (placement: hidden), drag-and-drop.
 */
(function () {
  var DEFAULT_MENU_KEYS = [
    { key: "main", label: "Главное меню" },
    { key: "profile", label: "Профиль" },
    { key: "referral", label: "Рефералка" },
    { key: "deposit", label: "💳 Пополнить баланс" },
    { key: "cheap_proxy", label: "Дешёвый прокси (доп.)" },
    { key: "proxy_menu", label: "PROXY" },
    { key: "vpn_menu", label: "VPN" },
  ];

  var state = {
    data: null,
    selectedId: null,
    menuKey: "main",
    sortVis: null,
    sortHid: null,
    lastRaw: null,
    lastParseOk: true,
    undoStack: [],
    redoStack: [],
    clipboard: null,
    multiSelect: false,
    selectedIds: [],
    _keydownHandler: null,
    _restoring: false,
    _liveUndoPending: false,
    _liveRenderTimer: null,
    _prevActionType: null,
  };

  var MAX_UNDO = 50;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function pushUndo() {
    if (!state.data) return;
    state.undoStack.push(deepClone(state.data));
    if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
    state.redoStack = [];
  }

  function undo() {
    if (!state.undoStack.length || !state.data) return false;
    state.redoStack.push(deepClone(state.data));
    state.data = state.undoStack.pop();
    state.lastRaw = JSON.stringify(state.data, null, 2).trim();
    var ta = $("consJson");
    if (ta) ta.value = JSON.stringify(state.data, null, 2);
    state._restoring = true;
    renderAll();
    state._restoring = false;
    return true;
  }

  function redo() {
    if (!state.redoStack.length || !state.data) return false;
    state.undoStack.push(deepClone(state.data));
    state.data = state.redoStack.pop();
    state.lastRaw = JSON.stringify(state.data, null, 2).trim();
    var ta = $("consJson");
    if (ta) ta.value = JSON.stringify(state.data, null, 2);
    state._restoring = true;
    renderAll();
    state._restoring = false;
    return true;
  }

  function cloneButton(b) {
    var c = deepClone(b);
    c.id = "btn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    return c;
  }

  function duplicateSelected() {
    if (!state.selectedId || !state.data) return;
    var menu = currentMenu();
    var idx = -1;
    for (var i = 0; i < menu.buttons.length; i++) {
      if (menu.buttons[i].id === state.selectedId) { idx = i; break; }
    }
    if (idx < 0) return;
    pushUndo();
    var c = cloneButton(menu.buttons[idx]);
    c.row = (c.row || 0) + 1;
    menu.buttons.splice(idx + 1, 0, c);
    state.selectedId = c.id;
    syncToTextarea();
    renderAll();
  }

  function copySelected() {
    if (!state.selectedId || !state.data) return false;
    var menu = currentMenu();
    for (var i = 0; i < menu.buttons.length; i++) {
      if (menu.buttons[i].id === state.selectedId) {
        state.clipboard = deepClone(menu.buttons[i]);
        var btn = $("consCopyBtn");
        if (btn) {
          var orig = btn.textContent;
          btn.textContent = "✓";
          setTimeout(function () { btn.textContent = orig; }, 600);
        }
        return true;
      }
    }
    return false;
  }

  function pasteClipboard() {
    if (!state.clipboard || !state.data) return false;
    pushUndo();
    var menu = currentMenu();
    var c = cloneButton(state.clipboard);
    var maxR = 0;
    menu.buttons.forEach(function (b) {
      if (!isHidden(b)) maxR = Math.max(maxR, b.row || 0);
    });
    c.row = maxR + 1;
    c.col = state.clipboard.col || 0;
    menu.buttons.push(c);
    state.selectedId = c.id;
    syncToTextarea();
    renderAll();
    return true;
  }

  function toggleMultiSelect() {
    state.multiSelect = !state.multiSelect;
    state.selectedIds = [];
    if (!state.multiSelect) state.selectedId = null;
    renderAll();
    var bar = $("consBulkBar");
    if (bar) bar.style.display = state.multiSelect ? "flex" : "none";
  }

  function toggleBtnSelect(id) {
    var idx = state.selectedIds.indexOf(id);
    if (idx >= 0) state.selectedIds.splice(idx, 1);
    else state.selectedIds.push(id);
    renderDnd();
    var bar = $("consBulkBar");
    if (bar) {
      var cnt = bar.querySelector(".bulk-count");
      if (cnt) cnt.textContent = state.selectedIds.length;
    }
  }

  function getButtonById(id) {
    if (!state.data) return null;
    var menus = state.data.menus || {};
    for (var k in menus) {
      var btns = menus[k].buttons || [];
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].id === id) return btns[i];
      }
    }
    return null;
  }

  function bulkHideSelected() {
    if (!state.selectedIds.length) return;
    pushUndo();
    state.selectedIds.forEach(function (id) {
      var b = getButtonById(id);
      if (b) { b.placement = "hidden"; delete b.hidden; }
    });
    state.selectedIds = [];
    syncToTextarea();
    renderAll();
  }

  function bulkShowSelected() {
    if (!state.selectedIds.length) return;
    pushUndo();
    state.selectedIds.forEach(function (id) {
      var b = getButtonById(id);
      if (b) { delete b.placement; delete b.hidden; }
    });
    state.selectedIds = [];
    syncToTextarea();
    renderAll();
  }

  function bulkDeleteSelected() {
    if (!state.selectedIds.length) return;
    if (!confirm("Удалить " + state.selectedIds.length + " кнопок?")) return;
    pushUndo();
    var toDelete = {};
    state.selectedIds.forEach(function (id) { toDelete[id] = true; });
    var menus = state.data.menus || {};
    for (var k in menus) {
      menus[k].buttons = (menus[k].buttons || []).filter(function (b) {
        return !toDelete[b.id];
      });
    }
    state.selectedIds = [];
    state.selectedId = null;
    syncToTextarea();
    renderAll();
  }

  function setActiveButton(id) {
    state.selectedId = id;
    if (state.multiSelect) {
      toggleBtnSelect(id);
    } else {
      renderAll();
    }
  }

  function $(id) {
    return document.getElementById(id);
  }

  function currentMenu() {
    ensureData();
    var k = state.menuKey || "main";
    if (!state.data.menus[k]) {
      var lab = DEFAULT_MENU_KEYS.filter(function (m) {
        return m.key === k;
      })[0];
      state.data.menus[k] = { title: (lab && lab.label) || "Меню", buttons: [], label: (lab && lab.label) || "" };
    }
    if (!Array.isArray(state.data.menus[k].buttons)) state.data.menus[k].buttons = [];
    return state.data.menus[k];
  }

  function menuLabel(key, menuObj) {
    var m = menuObj || (state.data && state.data.menus && state.data.menus[key]) || {};
    var l = (m && (m.label || m.title)) || "";
    if (l) return String(l);
    var def = DEFAULT_MENU_KEYS.filter(function (x) {
      return x.key === key;
    })[0];
    return (def && def.label) || key;
  }

  function getMenuKeysOrdered() {
    ensureData();
    var keys = Object.keys(state.data.menus || {});
    var out = [];
    DEFAULT_MENU_KEYS.forEach(function (d) {
      if (keys.indexOf(d.key) >= 0) out.push(d.key);
    });
    keys
      .filter(function (k) {
        return out.indexOf(k) < 0;
      })
      .sort()
      .forEach(function (k) {
        out.push(k);
      });
    if (out.indexOf("main") < 0) out.unshift("main");
    return out;
  }

  function renderMenuSelect() {
    var sel = $("consMenuSelect");
    if (!sel) return;
    ensureData();
    var keys = getMenuKeysOrdered();
    var html = keys
      .map(function (k) {
        var m = (state.data.menus && state.data.menus[k]) || {};
        return '<option value="' + escAttr(k) + '">' + escAttr(menuLabel(k, m)) + "</option>";
      })
      .join("");
    if (sel.innerHTML !== html) sel.innerHTML = html;
    sel.value = state.menuKey;
  }

  function ensureData() {
    var ta = $("consJson");
    if (!ta) return null;
    var raw = ta.value.trim();
    if (state.data && state.lastRaw === raw) return state.data;
    var parsed = null;
    if (!raw) {
      parsed = { version: 2, menus: { main: { title: "Главное меню", buttons: [] } } };
      state.lastParseOk = true;
    } else {
      try {
        parsed = JSON.parse(raw);
        state.lastParseOk = true;
      } catch (e) {
        // Не затираем текущее состояние при невалидном JSON: иначе любые действия в UI будут "откатываться".
        state.lastParseOk = false;
        return state.data || { version: 2, menus: { main: { title: "Главное меню", buttons: [] } } };
      }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      // Если в textarea лежит legacy-массив, не сбрасываем его в ноль: обернём в v2.
      if (Array.isArray(parsed)) {
        parsed = { version: 2, menus: { main: { title: "Главное меню", buttons: parsed } } };
      } else {
        parsed = { version: 2, menus: { main: { title: "Главное меню", buttons: [] } } };
      }
    }
    state.data = parsed;
    if (!state.data.menus) state.data.menus = {};
    DEFAULT_MENU_KEYS.forEach(function (mk) {
      if (!state.data.menus[mk.key]) state.data.menus[mk.key] = { title: mk.label, buttons: [], label: mk.label };
      if (!Array.isArray(state.data.menus[mk.key].buttons)) state.data.menus[mk.key].buttons = [];
    });
    state.data.version = 2;
    state.lastRaw = raw;
    return state.data;
  }

  function syncToTextarea() {
    var ta = $("consJson");
    if (!ta || !state.data) return;
    ta.value = JSON.stringify(state.data, null, 2);
    state.lastRaw = ta.value.trim();
    state.lastParseOk = true;
  }

  function isHidden(b) {
    return String(b.placement || "").toLowerCase() === "hidden" || b.hidden === true;
  }

  function reorderFromDom() {
    ensureData();
    var menu = currentMenu();
    var oldOrder = menu.buttons.map(function (b) { return b.id + "|" + (b.placement || ""); }).join(",");
    var byId = {};
    menu.buttons.forEach(function (b) {
      if (b && b.id) byId[b.id] = b;
    });
    var ordered = [];
    var v = $("consVisibleDrop");
    var h = $("consHiddenDrop");
    if (v) {
      v.querySelectorAll("[data-bid]").forEach(function (el) {
        var id = el.getAttribute("data-bid");
        var b = byId[id];
        if (b) {
          delete b.placement;
          delete b.hidden;
          ordered.push(b);
        }
      });
    }
    if (h) {
      h.querySelectorAll("[data-bid]").forEach(function (el) {
        var id = el.getAttribute("data-bid");
        var b = byId[id];
        if (b) {
          b.placement = "hidden";
          ordered.push(b);
        }
      });
    }
    menu.buttons.forEach(function (b) {
      if (b && ordered.indexOf(b) < 0) ordered.push(b);
    });
    var newOrder = ordered.map(function (b) { return b.id + "|" + (b.placement || ""); }).join(",");
    if (oldOrder !== newOrder) {
      pushUndo();
    }
    menu.buttons = ordered;
    syncToTextarea();
  }

  function onSortEnd() {
    reorderFromDom();
    renderAll();
  }

  function destroySortables() {
    if (state.sortVis && state.sortVis.destroy) {
      state.sortVis.destroy();
      state.sortVis = null;
    }
    if (state.sortHid && state.sortHid.destroy) {
      state.sortHid.destroy();
      state.sortHid = null;
    }
  }

  function initSortables() {
    destroySortables();
    if (typeof Sortable === "undefined") return;
    var optsBase = {
      group: { name: "luckyCons", pull: true, put: true },
      animation: 160,
      delay: 90,
      delayOnTouchOnly: true,
      filter: ".ci-actions, .ci-actions *, button, input, select, textarea, label",
      preventOnFilter: true,
      onEnd: onSortEnd,
    };
    var v = $("consVisibleDrop");
    var h = $("consHiddenDrop");
    if (v) {
      state.sortVis = Sortable.create(v, optsBase);
    }
    if (h) state.sortHid = Sortable.create(h, optsBase);
  }

  function escAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function iconThumbHtml(b) {
    var id = (b.icon_custom_emoji_id || "").toString().trim();
    if (!id) return "";
    var img = window.__premiumEmojiById && window.__premiumEmojiById[id];
    if (img) {
      return '<span class="ci-ic"><img src="' + escAttr(img) + '" alt="" /></span>';
    }
    return '<span class="ci-icid" title="ID ' + escAttr(id) + '">🎨</span>';
  }

  function gridPlacementStyle(b) {
    var w = parseInt(b.width, 10) || 1;
    var r = (parseInt(b.row, 10) || 0) + 1;
    if (w >= 2) {
      return 'grid-row:' + r + ";grid-column:1 / span 2";
    }
    var c = (parseInt(b.col, 10) || 0) + 1;
    return "grid-row:" + r + ";grid-column:" + c;
  }

  function buttonEl(b) {
    var sel = b.id === state.selectedId ? " sel" : "";
    var w = parseInt(b.width, 10) || 1;
    var wcls = w >= 2 ? " width-2" : "";
    var on = b.active !== false;
    var meta = (b.value || b.id || "").toString().slice(0, 28);
    var gstyle = gridPlacementStyle(b);
    var checkHtml = "";
    if (state.multiSelect) {
      var checked = state.selectedIds.indexOf(b.id) >= 0 ? " checked" : "";
      checkHtml = '<label class="ci-check" style="position:absolute;top:4px;left:4px;z-index:2;display:flex;align-items:center;gap:0"><input type="checkbox" data-select-bid="' + escAttr(b.id) + '"' + checked + ' style="width:16px;height:16px;accent-color:var(--cyan);cursor:pointer" /></label>';
    }
    return (
      '<div class="cons-dnd-item' +
      sel +
      wcls +
      (!on ? " off" : "") +
      '" data-bid="' +
      escAttr(b.id) +
      '" style="' +
      escAttr(gstyle) +
      '">' +
      checkHtml +
      '<div class="ci-actions">' +
      '<button type="button" data-dup-bid="' +
      escAttr(b.id) +
      '" title="Дублировать">⧉</button>' +
      '<button type="button" data-edit-bid="' +
      escAttr(b.id) +
      '" title="Свойства">✎</button>' +
      "</div>" +
      iconThumbHtml(b) +
      '<span class="ci-text">' +
      escAttr(b.text || "?") +
      "</span>" +
      '<span class="ci-meta">' +
      escAttr(meta) +
      "</span>" +
      '<span class="ci-w">' +
      (w >= 2 ? "2×" : "1×") +
      "</span></div>"
    );
  }

  function renderDnd() {
    var v = $("consVisibleDrop");
    var h = $("consHiddenDrop");
    if (!v || !h || !state.data) return;
    var menu = currentMenu();
    var vis = menu.buttons.filter(function (b) {
      return !isHidden(b);
    });
    vis.sort(function (a, b) {
      return (
        (a.row || 0) - (b.row || 0) ||
        (a.col || 0) - (b.col || 0) ||
        (a.order || 0) - (b.order || 0)
      );
    });
    var hid = menu.buttons.filter(isHidden);
    v.innerHTML = vis.map(buttonEl).join("") || '<p class="muted" style="margin:0;padding:12px">Нет кнопок</p>';
    h.innerHTML = hid.map(buttonEl).join("") || '<span class="muted" style="padding:8px">Пусто</span>';
    function wireDndZone(zone) {
      zone.querySelectorAll("[data-bid]").forEach(function (el) {
        el.onclick = function (e) {
          if (e.target.closest("[data-edit-bid]") || e.target.closest("[data-dup-bid]") || e.target.closest("[data-select-bid]")) return;
          setActiveButton(el.getAttribute("data-bid"));
        };
      });
      zone.querySelectorAll("[data-dup-bid]").forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          state.selectedId = btn.getAttribute("data-dup-bid");
          duplicateSelected();
        };
      });
      zone.querySelectorAll("[data-edit-bid]").forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          setActiveButton(btn.getAttribute("data-edit-bid"));
        };
      });
      zone.querySelectorAll("[data-select-bid]").forEach(function (ch) {
        ch.onclick = function (e) {
          e.stopPropagation();
          toggleBtnSelect(ch.getAttribute("data-select-bid"));
        };
      });
    }
    wireDndZone(v);
    wireDndZone(h);
    initSortables();
  }

  function renderTelegramPreview() {
    var pv = $("consPreviewMini");
    if (!pv || !state.data) return;
    var menu = currentMenu();
    var buttons = menu.buttons.filter(function (b) {
      return b.active !== false && !isHidden(b);
    });
    buttons.sort(function (a, b) {
      return (a.row || 0) - (b.row || 0) || (a.col || 0) - (b.col || 0);
    });
    var rows = {};
    buttons.forEach(function (b) {
      var r = b.row || 0;
      rows[r] = rows[r] || [];
      rows[r].push(b);
    });
    var html = '<div class="tg-header"><div class="tg-avatar">⌨</div><div><div class="tg-bot-name">' + escAttr(menu.title || "Меню") + "</div>" +
      '<div class="tg-bot-sub">@your_bot · online</div></div></div>';
    var msgText = menu.text || legacyTextTemplate(state.menuKey) || "";
    if (msgText) {
      html += '<div class="tg-msg">' + escAttr(msgText).replace(/\n/g, "<br>") + '</div>';
    }
    Object.keys(rows)
      .sort(function (a, b) {
        return parseInt(a, 10) - parseInt(b, 10);
      })
      .forEach(function (rk) {
        html += '<div class="tg-row">';
        rows[rk].forEach(function (b) {
          var w = parseInt(b.width, 10) || 1;
          var st = String(b.style || "")
            .trim()
            .toLowerCase();
          var stc = "";
          if (st === "primary") stc = " st-primary";
          else if (st === "success") stc = " st-success";
          else if (st === "danger") stc = " st-danger";
          var on = b.active !== false;
          var ic = "";
          var iid = (b.icon_custom_emoji_id || "").toString().trim();
          if (iid && window.__premiumEmojiById && window.__premiumEmojiById[iid]) {
            ic =
              '<span class="tg-ic"><img src="' +
              escAttr(window.__premiumEmojiById[iid]) +
              '" alt="" /></span>';
          } else if (iid) {
            ic = '<span class="tg-ic" style="font-size:0.75rem" title="' + escAttr(iid) + '">🎨</span>';
          }
          html +=
            '<div class="tg-btn' +
            (w >= 2 ? " w2" : "") +
            stc +
            (!on ? " off" : "") +
            '">' +
            ic +
            escAttr(b.text || "?") +
            "</div>";
        });
        html += "</div>";
      });
    if (!buttons.length) html += '<p class="muted" style="text-align:center;margin:12px 0 0;font-size:0.8rem">Нет активных кнопок</p>';
    pv.innerHTML = html;
  }

  function renderProps() {
    var p = $("consProps");
    if (!p || !state.data) return;
    if (state.lastParseOk === false) {
      p.innerHTML =
        '<p class="muted" style="color:var(--danger);margin:0 0 10px">JSON снизу сейчас невалидный. Исправьте ручную правку — иначе изменения будут применяться в память, но не синхронизироваться в textarea.</p>' +
        '<p class="muted" style="color:var(--muted);margin:0">Выберите кнопку в сетке</p>';
      return;
    }
    var menu = currentMenu();
    var arr = menu.buttons;
    var b = arr.filter(function (x) {
      return x.id === state.selectedId;
    })[0];
    if (!b) {
      p.innerHTML = '<p class="muted" style="color:var(--muted);margin:0">Выберите кнопку в сетке</p>';
      return;
    }
    var w = parseInt(b.width, 10) || 1;
    var stRaw = String(b.style || "")
      .trim()
      .toLowerCase();
    var stSel = { "": 1, primary: 1, success: 1, danger: 1 }[stRaw] !== undefined ? stRaw : "";
    var actionSel = (b.action || "callback").toLowerCase();
    if (["url", "webapp", "menu", "login_url", "switch_inline_query", "switch_inline_query_current_chat", "pay"].indexOf(actionSel) < 0) actionSel = "callback";
    state._prevActionType = actionSel;
    var callbackPresets = [
      { label: "Главное меню", val: "main_menu" },
      { label: "Прокси (меню)", val: "proxy_menu" },
      { label: "VPN (меню)", val: "vpn_menu" },
      { label: "Профиль", val: "profile" },
      { label: "Рефералка", val: "referral" },
      { label: "Купить прокси (офиц.)", val: "buy_proxy" },
      { label: "Дешёвый прокси", val: "buy_admin_proxy" },
      { label: "Отзывы", val: "reviews" },
    ];
    var presetsHtml = callbackPresets
      .map(function (x) {
        return (
          '<button type="button" class="btn-sm" data-cp-preset="' +
          escAttr(x.val) +
          '" style="padding:6px 8px;border-radius:10px;background:rgba(34,211,238,.10);border:1px solid rgba(255,255,255,.10);color:#cfe8ff;cursor:pointer">' +
          escAttr(x.label) +
          "</button>"
        );
      })
      .join("");
    var menuOptions = getMenuKeysOrdered()
      .map(function (k) {
        var selected = (String(b.value || "").trim() === k && actionSel === "menu") ? " selected" : "";
        return '<option value="' + escAttr(k) + '"' + selected + ">" + escAttr(menuLabel(k)) + " (" + escAttr(k) + ")</option>";
      })
      .join("");
    var isDupId = menu.buttons.filter(function (x) { return x.id === b.id && x !== b; }).length > 0;
    var idStyle = isDupId ? ' style="border-color:var(--danger)"' : "";
    p.innerHTML =
      '<label>ID кнопки' + (isDupId ? ' <span style="color:var(--danger)">(дубликат!)</span>' : "") + '</label><input type="text" id="cp_id" value="' +
      escAttr(b.id || "") +
      '"' + idStyle + ' />' +
      '<label>Текст</label><div style="display:flex;gap:6px;align-items:center;width:100%">' +
      '<input type="text" id="cp_text" value="' +
      escAttr(b.text || "") +
      '" style="flex:1;min-width:0" />' +
      '<button type="button" class="emoji-btn" id="cp_text_emojiBtn" title="Эмодзи в текст">😊</button></div>' +
      '<label>Premium-иконка (рядом с названием в Telegram)</label>' +
      '<div style="display:flex;gap:6px;align-items:center;width:100%;flex-wrap:wrap">' +
      '<input type="text" id="cp_icon_emoji" data-emoji-icon-id="1" placeholder="ID или выберите" value="' +
      escAttr((b.icon_custom_emoji_id || "").toString()) +
      '" style="flex:1;min-width:100px" />' +
      '<button type="button" class="emoji-btn" id="cp_icon_emojiBtn" title="Каталог Premium">🎨</button></div>' +
      '<p class="muted" style="font-size:0.68rem;margin:4px 0 10px;line-height:1.35">Иконка слева от подписи кнопки. Очистите поле, чтобы убрать. Каталог: вкладка Premium в окне эмодзи (или импорт HTML).</p>' +
      '<label>Тип действия</label><select id="cp_action">' +
      '<option value="callback"' +
      (actionSel === "callback" ? " selected" : "") +
      '>Callback</option>' +
      '<option value="url"' +
      (actionSel === "url" ? " selected" : "") +
      '>URL</option>' +
      '<option value="webapp"' +
      (actionSel === "webapp" ? " selected" : "") +
      '>Web App</option>' +
      '<option value="menu"' +
      (actionSel === "menu" ? " selected" : "") +
      '>Переход в тип меню</option>' +
      '<option value="login_url"' +
      (actionSel === "login_url" ? " selected" : "") +
      '>Login URL (авторизация)</option>' +
      '<option value="switch_inline_query"' +
      (actionSel === "switch_inline_query" ? " selected" : "") +
      '>Switch Inline Query</option>' +
      '<option value="switch_inline_query_current_chat"' +
      (actionSel === "switch_inline_query_current_chat" ? " selected" : "") +
      '>Switch Inline (текущий чат)</option>' +
      '<option value="pay"' +
      (actionSel === "pay" ? " selected" : "") +
      '>Оплата (Pay)</option></select>' +
      '<label>Значение (callback_data / URL)</label><input type="text" id="cp_value" value="' +
      escAttr(b.value || "") +
      '" />' +
      '<div id="cp_value_warn" style="display:none;font-size:0.68rem;color:var(--danger);margin-top:2px">⚠ callback_data ≤ 64 байт</div>' +
      '<div id="cp_presets_wrap" style="display:' +
      (actionSel === "callback" ? "block" : "none") +
      ';margin-top:8px">' +
      '<div class="muted" style="font-size:0.68rem;margin:0 0 6px;opacity:.9">Быстрые типы (как в боте):</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
      presetsHtml +
      "</div></div>" +
      '<div id="cp_menu_target_wrap" style="display:' +
      (actionSel === "menu" ? "block" : "none") +
      ';margin-top:8px">' +
      '<label>Куда ведёт кнопка (ID типа меню)</label>' +
      '<select id="cp_menu_target">' +
      menuOptions +
      "</select>" +
      '<p class="muted" style="font-size:0.68rem;margin:4px 0 0;line-height:1.35">Бот отправит callback вида <code>menu:&lt;id&gt;</code> и откроет выбранный тип меню.</p>' +
      "</div>" +
      '<div id="cp_login_url_wrap" style="display:' +
      (actionSel === "login_url" ? "block" : "none") +
      ';margin-top:8px">' +
      '<label>Bot Username (для deep link)</label><input type="text" id="cp_login_bot" value="' +
      escAttr(b.login_url_bot || "") +
      '" placeholder="@username_bot" />' +
      '<label>Forward Text (после авторизации)</label><input type="text" id="cp_login_forward" value="' +
      escAttr(b.login_url_forward_text || "") +
      '" placeholder="Текст для отправки" />' +
      '<p class="muted" style="font-size:0.68rem;margin:4px 0 0;line-height:1.35">Кнопка открывает окно авторизации Telegram. После — перенаправление.</p>' +
      "</div>" +
      '<div id="cp_switch_inline_wrap" style="display:' +
      (actionSel === "switch_inline_query" || actionSel === "switch_inline_query_current_chat" ? "block" : "none") +
      ';margin-top:8px">' +
      '<label>Switch Inline Query (текст для вставки)</label><input type="text" id="cp_switch_inline" value="' +
      escAttr(b.switch_inline_query || "") +
      '" placeholder="(пусто = просто переключить)" />' +
      '<p class="muted" style="font-size:0.68rem;margin:4px 0 0;line-height:1.35">Переключает пользователя в режим inline-запроса. Текст подставляется в поле ввода.</p>' +
      "</div>" +
      '<div id="cp_pay_wrap" style="display:' +
      (actionSel === "pay" ? "block" : "none") +
      ';margin-top:8px">' +
      '<label>Provider Token</label><input type="text" id="cp_pay_token" value="' +
      escAttr(b.pay_provider_token || "") +
      '" placeholder="Токен платёжного провайдера" />' +
      '<p class="muted" style="font-size:0.68rem;margin:4px 0 0;line-height:1.35">Для кнопки оплаты. Текст кнопки = название товара. Настройте цену в БД/боте.</p>' +
      "</div>" +
      '<div class="cons-row2"><div><label>Строка</label><input type="number" id="cp_row" value="' +
      (b.row != null ? b.row : 0) +
      '" /></div><div><label>Колонка</label><input type="number" id="cp_col" value="' +
      (b.col != null ? b.col : 0) +
      '" /></div></div>' +
      '<label>Ширина (колонок в сетке)</label><select id="cp_width">' +
      '<option value="1"' +
      (w < 2 ? " selected" : "") +
      '>1 колонка</option>' +
      '<option value="2"' +
      (w >= 2 ? " selected" : "") +
      '>2 колонки (во всю ширину)</option></select>' +
      '<label>Стиль (цвет в Telegram, только callback)</label><select id="cp_style">' +
      '<option value=""' +
      (!stSel ? " selected" : "") +
      '>Обычная</option>' +
      '<option value="primary"' +
      (stSel === "primary" ? " selected" : "") +
      '>primary — синяя</option>' +
      '<option value="success"' +
      (stSel === "success" ? " selected" : "") +
      '>success — зелёная</option>' +
      '<option value="danger"' +
      (stSel === "danger" ? " selected" : "") +
      '>danger — красная</option></select>' +
      '<p class="muted" style="font-size:0.68rem;margin:4px 0 0;line-height:1.35">Нужны клиент Telegram с Bot API 9.4+ и aiogram ≥ 3.24. Для URL/Web App цвет не задаётся.</p>' +
      '<label>Порядок</label><input type="number" id="cp_order" value="' +
      (b.order != null ? b.order : 0) +
      '" />' +
      '<label><input type="checkbox" id="cp_active" ' +
      (b.active !== false ? "checked" : "") +
      " /> Активна</label>" +
      '<button type="button" class="btn-sm primary" id="cp_apply" style="width:100%;margin-top:12px">Сохранить изменения</button>' +
      '<button type="button" class="btn-sm" id="cp_hide" style="width:100%;margin-top:8px">В скрытые</button>' +
      '<button type="button" class="btn-sm" id="cp_del" style="width:100%;margin-top:8px;background:rgba(239,68,68,0.2)">Удалить кнопку</button>';
    $("cp_apply").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      pushUndo();
      var oldId = b.id;
      var newId = $("cp_id").value.trim() || b.id;
      var menu = currentMenu();
      if (newId !== oldId) {
        var dup = menu.buttons.filter(function (x) { return x.id === newId && x !== b; }).length > 0;
        if (dup) {
          newId = newId + "_" + Math.random().toString(36).slice(2, 6);
        }
        b.id = newId;
        state.selectedId = b.id;
      }
      b.text = $("cp_text").value.trim() || "?";
      b.action = $("cp_action").value;
      if (b.action === "menu") {
        b.value = (($("cp_menu_target") && $("cp_menu_target").value) || $("cp_value").value || "").trim();
      } else {
        b.value = $("cp_value").value.trim();
      }
      b.row = parseInt($("cp_row").value || "0", 10) || 0;
      b.col = parseInt($("cp_col").value || "0", 10) || 0;
      b.width = parseInt($("cp_width").value || "1", 10) || 1;
      b.style = ($("cp_style") && $("cp_style").value) || "";
      b.order = parseInt($("cp_order").value || "0", 10) || 0;
      b.active = $("cp_active").checked;
      var icRaw = ($("cp_icon_emoji") && $("cp_icon_emoji").value.trim()) || "";
      if (icRaw) b.icon_custom_emoji_id = icRaw;
      else delete b.icon_custom_emoji_id;
      var prevAct2 = state._prevActionType;
      var curAct2 = b.action;
      if (prevAct2 && prevAct2 !== curAct2) {
        if (prevAct2 === "login_url") { delete b.login_url_bot; delete b.login_url_forward_text; }
        if (prevAct2 === "switch_inline_query" || prevAct2 === "switch_inline_query_current_chat") { delete b.switch_inline_query; }
        if (prevAct2 === "pay") { delete b.pay_provider_token; }
      }
      state._prevActionType = curAct2;
      if (curAct2 === "login_url") {
        b.login_url_bot = ($("cp_login_bot") && $("cp_login_bot").value.trim()) || "";
        b.login_url_forward_text = ($("cp_login_forward") && $("cp_login_forward").value.trim()) || "";
        b.value = "tg://resolve?domain=" + b.login_url_bot.replace(/^@/, "");
      } else if (curAct2 === "switch_inline_query" || curAct2 === "switch_inline_query_current_chat") {
        b.switch_inline_query = ($("cp_switch_inline") && $("cp_switch_inline").value.trim()) || "";
        b.value = b.switch_inline_query;
      } else if (curAct2 === "pay") {
        b.pay_provider_token = ($("cp_pay_token") && $("cp_pay_token").value.trim()) || "";
        b.value = b.pay_provider_token;
      }
      syncToTextarea();
      renderAll();
    };
    function applyPropsLive() {
      if (!state._liveUndoPending) {
        state._liveUndoPending = true;
        pushUndo();
      }
      var oldId = b.id;
      var nid = $("cp_id").value.trim();
      if (nid && nid !== b.id) {
        var dup2 = currentMenu().buttons.filter(function (x) { return x.id === nid && x !== b; }).length > 0;
        if (dup2) nid = nid + "_" + Math.random().toString(36).slice(2, 6);
        b.id = nid;
      }
      if (oldId !== b.id) state.selectedId = b.id;
      b.text = $("cp_text").value.trim() || "?";
      b.action = $("cp_action").value;
      if (b.action === "menu") {
        b.value = (($("cp_menu_target") && $("cp_menu_target").value) || $("cp_value").value || "").trim();
      } else {
        b.value = $("cp_value").value.trim();
      }
      b.row = parseInt($("cp_row").value || "0", 10) || 0;
      b.col = parseInt($("cp_col").value || "0", 10) || 0;
      b.width = parseInt($("cp_width").value || "1", 10) || 1;
      b.style = ($("cp_style") && $("cp_style").value) || "";
      b.order = parseInt($("cp_order").value || "0", 10) || 0;
      b.active = $("cp_active").checked;
      var icRaw2 = ($("cp_icon_emoji") && $("cp_icon_emoji").value.trim()) || "";
      if (icRaw2) b.icon_custom_emoji_id = icRaw2;
      else delete b.icon_custom_emoji_id;
      var prevAct = state._prevActionType;
      var curAct = b.action;
      if (prevAct && prevAct !== curAct) {
        if (prevAct === "login_url") { delete b.login_url_bot; delete b.login_url_forward_text; }
        if (prevAct === "switch_inline_query" || prevAct === "switch_inline_query_current_chat") { delete b.switch_inline_query; }
        if (prevAct === "pay") { delete b.pay_provider_token; }
      }
      state._prevActionType = curAct;
      if (curAct === "login_url") {
        b.login_url_bot = ($("cp_login_bot") && $("cp_login_bot").value.trim()) || "";
        b.login_url_forward_text = ($("cp_login_forward") && $("cp_login_forward").value.trim()) || "";
        b.value = "tg://resolve?domain=" + b.login_url_bot.replace(/^@/, "");
      } else if (curAct === "switch_inline_query" || curAct === "switch_inline_query_current_chat") {
        b.switch_inline_query = ($("cp_switch_inline") && $("cp_switch_inline").value.trim()) || "";
        b.value = b.switch_inline_query;
      } else if (curAct === "pay") {
        b.pay_provider_token = ($("cp_pay_token") && $("cp_pay_token").value.trim()) || "";
        b.value = b.pay_provider_token;
      }
      syncToTextarea();
      if (state._liveRenderTimer) clearTimeout(state._liveRenderTimer);
      state._liveRenderTimer = setTimeout(function () {
        state._liveUndoPending = false;
        renderDnd();
        renderTelegramPreview();
      }, 150);
    }
    var teBtn = $("cp_text_emojiBtn");
    var ieBtn = $("cp_icon_emojiBtn");
    if (teBtn && $("cp_text")) {
      teBtn.onclick = function () {
        if (window.emojiPopOpenFor) window.emojiPopOpenFor($("cp_text"));
      };
    }
    if (ieBtn && $("cp_icon_emoji")) {
      ieBtn.onclick = function () {
        if (window.emojiPopOpenFor) window.emojiPopOpenFor($("cp_icon_emoji"));
      };
    }
    ["cp_id", "cp_text", "cp_value", "cp_row", "cp_col", "cp_width", "cp_style", "cp_order", "cp_active", "cp_icon_emoji", "cp_login_bot", "cp_login_forward", "cp_switch_inline", "cp_pay_token"].forEach(
      function (id) {
        var el = $(id);
        if (!el) return;
        el.oninput = applyPropsLive;
        el.onchange = applyPropsLive;
      }
    );
    if ($("cp_action")) {
      $("cp_action").onchange = function () {
        var isMenu = $("cp_action").value === "menu";
        var isCb = $("cp_action").value === "callback";
        var isLogin = $("cp_action").value === "login_url";
        var isSwitch = $("cp_action").value === "switch_inline_query" || $("cp_action").value === "switch_inline_query_current_chat";
        var isPay = $("cp_action").value === "pay";
        var wrap = $("cp_menu_target_wrap");
        if (wrap) wrap.style.display = isMenu ? "block" : "none";
        var pw = $("cp_presets_wrap");
        if (pw) pw.style.display = isCb ? "block" : "none";
        var lw = $("cp_login_url_wrap");
        if (lw) lw.style.display = isLogin ? "block" : "none";
        var sw = $("cp_switch_inline_wrap");
        if (sw) sw.style.display = isSwitch ? "block" : "none";
        var ppw = $("cp_pay_wrap");
        if (ppw) ppw.style.display = isPay ? "block" : "none";
        if (isMenu && $("cp_menu_target")) {
          var v = ($("cp_menu_target").value || "").trim();
          if (v) $("cp_value").value = v;
        }
        applyPropsLive();
      };
    }
    function checkCallbackLen() {
      var warn = $("cp_value_warn");
      if (!warn) return;
      var act = $("cp_action") ? $("cp_action").value : "";
      var val = $("cp_value") ? $("cp_value").value : "";
      warn.style.display = (act === "callback" && new Blob([val]).size > 64) ? "block" : "none";
    }
    if ($("cp_value")) {
      var origCpValOninput = $("cp_value").oninput;
      $("cp_value").oninput = function () { checkCallbackLen(); if (origCpValOninput) origCpValOninput(); };
    }
    // Быстрые пресеты callback
    var pw2 = $("cp_presets_wrap");
    if (pw2) {
      pw2.querySelectorAll("[data-cp-preset]").forEach(function (btn) {
        btn.onclick = function (ev) {
          if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
          }
          var v = btn.getAttribute("data-cp-preset") || "";
          if ($("cp_value")) $("cp_value").value = v;
          applyPropsLive();
        };
      });
    }
    if ($("cp_menu_target")) {
      $("cp_menu_target").onchange = function () {
        $("cp_value").value = $("cp_menu_target").value || "";
        applyPropsLive();
      };
    }
    $("cp_hide").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      pushUndo();
      b.placement = "hidden";
      delete b.hidden;
      syncToTextarea();
      state.selectedId = b.id;
      renderAll();
    };
    $("cp_del").onclick = function (ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      if (!confirm('Удалить кнопку «' + (b.text || '?') + '»?')) return;
      pushUndo();
      var i = arr.indexOf(b);
      if (i >= 0) arr.splice(i, 1);
      state.selectedId = null;
      syncToTextarea();
      renderAll();
    };
    setTimeout(checkCallbackLen, 0);
  }

  function normalizeMenuKey(k) {
    var s = String(k || "").trim().toLowerCase();
    if (s.endsWith("_menu")) s = s.slice(0, -5);
    return s;
  }
  function builtinButtonsTemplate(key) {
    var nk = normalizeMenuKey(key);
    if (nk === "proxy") {
      return [
        { id: "proxy_official", text: "Официальный Proxy", action: "callback", value: "buy_proxy", row: 0, col: 0, width: 1, order: 0, active: true, style: "primary" },
        { id: "proxy_cheap", text: "Дешёвый прокси", action: "callback", value: "buy_admin_proxy", row: 0, col: 1, width: 1, order: 1, active: true, style: "primary" },
        { id: "proxy_back", text: "◀️ Назад", action: "callback", value: "main_menu", row: 1, col: 0, width: 2, order: 2, active: true, style: "" },
      ];
    }
    if (nk === "vpn") {
      return [
        { id: "vpn_buy", text: "⏳ Купить / Продлить", action: "callback", value: "buy_subscription", row: 0, col: 0, width: 2, order: 0, active: true, style: "primary" },
        { id: "vpn_back", text: "◀️ Назад", action: "callback", value: "main_menu", row: 1, col: 0, width: 2, order: 1, active: true, style: "" },
      ];
    }
    return [];
  }
  function legacyTextTemplate(key) {
    var nk = normalizeMenuKey(key);
    if (nk === "proxy") {
      return (
        "🔌 <b>Прокси</b>\n\n" +
        "Выберите тип прокси:"
      );
    }
    if (nk === "vpn") {
      return (
        "🛡 <b>VPN</b>\n\n" +
        "Подписка и продление VPN.\n" +
        "Оплата списывается <b>только с основного баланса</b>."
      );
    }
    if (key === "profile") {
      return (
        "<b><tg-emoji emoji-id=\"5870994129244131212\">👤</tg-emoji> Ваш профиль:</b>\n\n" +
        "<tg-emoji emoji-id=\"6037249452824072506\">🔑</tg-emoji> ID: {user_id} / <tg-emoji emoji-id=\"5870994129244131212\">👤</tg-emoji> {username}\n" +
        "<tg-emoji emoji-id=\"6039451237743595514\">📌</tg-emoji> Покупок: {purchases} • ⭐️ топ {rank}\n" +
        "<tg-emoji emoji-id=\"5769126056262898415\">💰</tg-emoji> Баланс: {balance} ₽\n" +
        "└ <tg-emoji emoji-id=\"5904462880941545555\">🪙</tg-emoji> Бонусный баланс: {bonus}₽ — покупать только дешёвые прокси\n\n" +
        "<tg-emoji emoji-id=\"5890937706803894250\">📆</tg-emoji> Дата регистрации: {registered_at}\n" +
        "↪️ Не забывайте эту встречу❗️"
      );
    }
    if (key === "referral") {
      return (
        "<tg-emoji emoji-id=\"6030400221232501136\">🤖</tg-emoji> <b>Реферальная система</b>\n\n" +
        "<tg-emoji emoji-id=\"5769289093221454192\">🔗</tg-emoji> Ссылка и статистика выводятся динамически как в старой версии."
      );
    }
    return "";
  }

  function renderAll() {
    if (state._liveRenderTimer) { clearTimeout(state._liveRenderTimer); state._liveRenderTimer = null; }
    state._liveUndoPending = false;
    var titleEl = $("consMenuTitle");
    var textEl = $("consMenuText");
    var keyEl = $("consMenuKey");
    var menu = currentMenu();
    // Для типов proxy/vpn подставляем дефолтные инлайны как в боте, если меню пустое.
    var mkNorm = normalizeMenuKey(state.menuKey);
    if (!state._restoring && (mkNorm === "proxy" || mkNorm === "vpn") && (!menu.buttons || !menu.buttons.length)) {
      pushUndo();
      menu.buttons = builtinButtonsTemplate(state.menuKey);
      syncToTextarea();
    }
    renderMenuSelect();
    if (titleEl) titleEl.value = menu.title || "";
    if (textEl) {
      var rawText = menu.text || "";
      // Показываем старый шаблон, если текст пустой или дефолт-заглушка.
      var isDefaultStub =
        rawText === "Здесь вы можете управлять балансом, промокодами и прокси." ||
        rawText === "Приглашайте друзей и получайте вознаграждение за их действия." ||
        rawText === "Добро пожаловать в меню. Выберите действие ниже." ||
        rawText === "Дополнительные кнопки для раздела дешёвых прокси.";
      textEl.value = (rawText && !isDefaultStub) ? rawText : (legacyTextTemplate(state.menuKey) || rawText || "");
    }
    if (keyEl) keyEl.value = state.menuKey || "";
    renderDnd();
    renderProps();
    renderTelegramPreview();
    var ub = $("consUndoBtn");
    var rb = $("consRedoBtn");
    if (ub) ub.style.opacity = state.undoStack.length ? "1" : "0.35";
    if (rb) rb.style.opacity = state.redoStack.length ? "1" : "0.35";
    var jsonTa = $("consJson");
    if (jsonTa) jsonTa.style.borderColor = state.lastParseOk === false ? "var(--danger)" : "";
  }

  function addButton() {
    ensureData();
    pushUndo();
    var menu = currentMenu();
    var arr = menu.buttons;
    var maxR = 0;
    arr.forEach(function (x) {
      if (!isHidden(x)) maxR = Math.max(maxR, x.row || 0);
    });
    var nid = "btn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    arr.push({
      id: nid,
      text: "Новая кнопка",
      action: "callback",
      value: "main_menu",
      row: maxR + 1,
      col: 0,
      width: 1,
      order: arr.length,
      active: true,
      style: "",
    });
    state.selectedId = nid;
    syncToTextarea();
    renderAll();
  }

  function switchMenu(key) {
    state.menuKey = key || "main";
    state.selectedId = null;
    ensureData();
    renderAll();
  }

  function init() {
    ensureData();
    state.menuKey = "main";
    state.selectedId = null;
    var sel = $("consMenuSelect");
    if (sel) {
      sel.onchange = function () {
        switchMenu(sel.value);
      };
    }
    var addMenu = $("consAddMenu");
    if (addMenu) {
      addMenu.onclick = function () {
        ensureData();
        var key = prompt("Ключ типа меню (латиница/цифры/подчёркивание), например: partners");
        if (!key) return;
        key = String(key).trim();
        if (!/^[a-zA-Z0-9_]{1,32}$/.test(key)) {
          alert("Неверный ключ. Используйте латиницу/цифры/подчёркивание (до 32 символов).");
          return;
        }
        if (state.data.menus && state.data.menus[key]) {
          state.menuKey = key;
          state.selectedId = null;
          renderAll();
          return;
        }
        var title = prompt("Заголовок меню (как будет показано в предпросмотре/Telegram)", "Меню");
        var label = prompt("Название в списке «Тип меню»", title || "Меню");
        pushUndo();
        state.data.menus[key] = { title: String(title || "Меню"), label: String(label || title || key), buttons: [] };
        state.menuKey = key;
        state.selectedId = null;
        syncToTextarea();
        renderAll();
      };
    }
    var delMenu = $("consDelMenu");
    if (delMenu) {
      delMenu.onclick = function () {
        ensureData();
        var k = state.menuKey;
        if (!k) return;
        if (DEFAULT_MENU_KEYS.filter(function (x) { return x.key === k; }).length) {
          alert("Этот тип меню системный и не удаляется.");
          return;
        }
        if (!confirm("Удалить тип меню \"" + k + "\"? Кнопки внутри будут удалены.")) return;
        pushUndo();
        delete state.data.menus[k];
        state.menuKey = "main";
        state.selectedId = null;
        syncToTextarea();
        renderAll();
      };
    }
    var mt = $("consMenuTitle");
    if (mt) {
      var mtPrev = mt.value;
      mt.onfocus = function () { mtPrev = mt.value; };
      mt.onchange = function () {
        if (mt.value === mtPrev) return;
        ensureData();
        pushUndo();
        currentMenu().title = mt.value || "Меню";
        syncToTextarea();
        renderTelegramPreview();
      };
    }
    var mtxt = $("consMenuText");
    if (mtxt) {
      var mtxtPrev = mtxt.value;
      mtxt.onfocus = function () { mtxtPrev = mtxt.value; };
      var mtxtPreviewTimer = null;
      mtxt.oninput = function () {
        ensureData();
        currentMenu().text = mtxt.value || "";
        syncToTextarea();
        if (mtxtPreviewTimer) clearTimeout(mtxtPreviewTimer);
        mtxtPreviewTimer = setTimeout(renderTelegramPreview, 150);
      };
      mtxt.onchange = function () {
        if (mtxt.value !== mtxtPrev) {
          ensureData();
          pushUndo();
          currentMenu().text = mtxt.value || "";
          syncToTextarea();
          renderTelegramPreview();
        }
      };
    }
    var add = $("consAddBtn");
    if (add) add.onclick = addButton;
    var undoBtn = $("consUndoBtn");
    if (undoBtn) undoBtn.onclick = undo;
    var redoBtn = $("consRedoBtn");
    if (redoBtn) redoBtn.onclick = redo;
    var dupBtn = $("consDupBtn");
    if (dupBtn) dupBtn.onclick = duplicateSelected;
    var copyBtn = $("consCopyBtn");
    if (copyBtn) copyBtn.onclick = function () { copySelected(); };
    var pasteBtn = $("consPasteBtn");
    if (pasteBtn) pasteBtn.onclick = pasteClipboard;
    var msBtn = $("consMultiSelBtn");
    if (msBtn) msBtn.onclick = toggleMultiSelect;
    var bulkHide = $("consBulkHide");
    if (bulkHide) bulkHide.onclick = bulkHideSelected;
    var bulkShow = $("consBulkShow");
    if (bulkShow) bulkShow.onclick = bulkShowSelected;
    var bulkDel = $("consBulkDel");
    if (bulkDel) bulkDel.onclick = bulkDeleteSelected;
    var pvBtn = $("consPreviewBtn");
    if (pvBtn) {
      pvBtn.onclick = function () {
        var w = $("consPreviewWrap");
        if (w) w.classList.toggle("hidden");
      };
    }
    var pr = $("consPreviewRefresh");
    if (pr) pr.onclick = renderTelegramPreview;
    var handler = function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      var inInput = tag === "input" || tag === "textarea" || tag === "select";
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (!inInput || e.target.id === "consJson") { e.preventDefault(); undo(); }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        if (!inInput || e.target.id === "consJson") { e.preventDefault(); redo(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && !inInput) {
        e.preventDefault();
        duplicateSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !inInput) {
        e.preventDefault();
        copySelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && !inInput) {
        e.preventDefault();
        pasteClipboard();
      }
      if (e.key === "Delete" && !inInput && (state.selectedIds.length > 0 || state.selectedId)) {
        if (state.multiSelect) {
          if (confirm("Удалить выбранные кнопки (" + state.selectedIds.length + ")?")) bulkDeleteSelected();
        } else if (state.selectedId) {
          var delMenu = currentMenu();
          var delBtn = null;
          for (var dli = 0; dli < delMenu.buttons.length; dli++) {
            if (delMenu.buttons[dli].id === state.selectedId) { delBtn = delMenu.buttons[dli]; break; }
          }
          if (delBtn && confirm('Удалить кнопку «' + (delBtn.text || '?') + '»?')) {
            pushUndo();
            delMenu.buttons.splice(dli, 1);
            state.selectedId = null;
            syncToTextarea();
            renderAll();
          }
        }
      }
      if (e.key === "Escape") {
        if (state.multiSelect) toggleMultiSelect();
        state.selectedId = null;
        renderAll();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        var saveBtn = document.getElementById("consSave");
        if (saveBtn) saveBtn.click();
      }
    }
    state._keydownHandler = handler;
    document.addEventListener("keydown", handler);
    renderAll();
  }

  function destroy() {
    destroySortables();
    if (state._keydownHandler) {
      document.removeEventListener("keydown", state._keydownHandler);
      state._keydownHandler = null;
    }
  }

  window.LuckyConstructor = {
    init: init,
    destroy: destroy,
    syncToTextarea: syncToTextarea,
    ensureData: ensureData,
    switchMenu: switchMenu,
    undo: undo,
    redo: redo,
    duplicateSelected: duplicateSelected,
    copySelected: copySelected,
    pasteClipboard: pasteClipboard,
    toggleMultiSelect: toggleMultiSelect,
    bulkHideSelected: bulkHideSelected,
    bulkShowSelected: bulkShowSelected,
    bulkDeleteSelected: bulkDeleteSelected,
  };
})();
