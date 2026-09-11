(function (root) {
  "use strict";

  const VERSION = "0.1.0";
  const STORAGE_PREFIX = "kc.manager.tablecore.v1.";
  const SKIP_SELECTOR = [
    "#tvPreviewScreen",
    "#tvPresentationStage",
    "#tvDashboardPreview",
    ".tv-sheet-object",
    ".qr-code",
    "[data-tablecore='off']"
  ].join(",");
  let tableSequence = 0;
  let observer;

  const clean = value => String(value == null ? "" : value).trim();

  function tableId(table) {
    if (table.dataset.kcTablecoreId) return table.dataset.kcTablecoreId;
    const bodyId = table.tBodies[0]?.id;
    const ownId = table.id;
    const hostId = table.closest("[id]")?.id;
    table.dataset.kcTablecoreId = clean(ownId || bodyId || hostId) ||
      `table-${++tableSequence}`;
    return table.dataset.kcTablecoreId;
  }

  function readState(table) {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_PREFIX + tableId(table)) || "{}");
    } catch (_) {
      return {};
    }
  }

  function writeState(table, patch) {
    const state = { ...readState(table), ...patch, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_PREFIX + tableId(table), JSON.stringify(state));
    } catch (_) {}
    return state;
  }

  function headerKey(th, index) {
    if (th.dataset.kcColumnKey) return th.dataset.kcColumnKey;
    const explicit = clean(th.dataset.column || th.id);
    const text = clean(th.textContent).replace(/[↕↑↓↔]/g, "").replace(/\s+/g, "-");
    th.dataset.kcColumnKey = (explicit || text || `column-${index}`)
      .toLocaleLowerCase("de");
    return th.dataset.kcColumnKey;
  }

  function columnKeys(table) {
    return [...table.tHead.rows[0].cells].map(headerKey);
  }

  function moveColumn(table, from, to, after = false) {
    if (from === to || from < 0 || to < 0) return;
    [...table.rows].forEach(row => {
      if (row.cells.length <= Math.max(from, to)) return;
      const moving = row.cells[from];
      const target = row.cells[to];
      row.insertBefore(moving, after ? target.nextSibling : target);
    });
    writeState(table, { order: columnKeys(table) });
  }

  function applyOrder(table, order) {
    if (!Array.isArray(order) || !order.length) return;
    const current = columnKeys(table);
    if (order.length !== current.length || order.some(key => !current.includes(key))) return;
    order.forEach((key, targetIndex) => {
      const keys = columnKeys(table);
      const fromIndex = keys.indexOf(key);
      if (fromIndex !== targetIndex) moveColumn(table, fromIndex, targetIndex, false);
    });
  }

  function cellValue(cell) {
    const control = cell.querySelector("input,select,textarea");
    return clean(control ? control.value : cell.textContent);
  }

  function compareValues(left, right) {
    const number = value => Number(value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
    const leftNumber = number(left);
    const rightNumber = number(right);
    if (left && right && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }
    return left.localeCompare(right, "de", { numeric: true, sensitivity: "base" });
  }

  function applySort(table, key, direction, persist = true) {
    const index = columnKeys(table).indexOf(key);
    const body = table.tBodies[0];
    if (index < 0 || !body) return;
    const rows = [...body.rows];
    rows.forEach((row, rowIndex) => {
      if (!row.dataset.kcOriginalIndex) row.dataset.kcOriginalIndex = String(rowIndex);
    });
    if (direction === "none") {
      rows.sort((a, b) =>
        Number(a.dataset.kcOriginalIndex) - Number(b.dataset.kcOriginalIndex));
    } else {
      const factor = direction === "desc" ? -1 : 1;
      rows.sort((a, b) =>
        compareValues(cellValue(a.cells[index]), cellValue(b.cells[index])) * factor);
    }
    if (rows.some((row, rowIndex) => body.rows[rowIndex] !== row)) {
      rows.forEach(row => body.appendChild(row));
    }
    table.querySelectorAll(".kc-tablecore-sort").forEach(button => {
      const active = button.closest("th")?.dataset.kcColumnKey === key;
      button.textContent = active && direction === "asc" ? "↑" :
        active && direction === "desc" ? "↓" : "↕";
      button.setAttribute("aria-pressed", active && direction !== "none" ? "true" : "false");
    });
    if (persist) writeState(table, { sort: { key, direction } });
  }

  function autoFit(table, th) {
    const index = [...th.parentElement.cells].indexOf(th);
    const samples = [...table.rows]
      .map(row => row.cells[index])
      .filter(Boolean)
      .slice(0, 100);
    const canvas = autoFit.canvas || (autoFit.canvas = document.createElement("canvas"));
    const context = canvas.getContext("2d");
    let width = 70;
    samples.forEach(cell => {
      const style = getComputedStyle(cell);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      width = Math.max(width, context.measureText(cellValue(cell)).width + 44);
    });
    const max = Math.max(90, table.closest(".table-card,.recipe-scroll")?.clientWidth || table.clientWidth);
    width = Math.min(Math.ceil(width), max);
    th.style.width = `${width}px`;
    th.style.minWidth = `${width}px`;
    const widths = { ...(readState(table).widths || {}), [th.dataset.kcColumnKey]: width };
    writeState(table, { widths });
  }

  function bindResize(table, th, handle) {
    handle.addEventListener("dblclick", event => {
      event.preventDefault();
      event.stopPropagation();
      autoFit(table, th);
    });
    handle.addEventListener("pointerdown", event => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = th.getBoundingClientRect().width;
      const badge = document.createElement("div");
      badge.className = "kc-tablecore-badge";
      document.body.appendChild(badge);
      handle.classList.add("kc-active");
      handle.setPointerCapture?.(event.pointerId);
      const move = pointerEvent => {
        const width = Math.max(48, Math.round(startWidth + pointerEvent.clientX - startX));
        th.style.width = `${width}px`;
        th.style.minWidth = `${width}px`;
        badge.textContent = `${width} px`;
        badge.style.left = `${pointerEvent.clientX + 12}px`;
        badge.style.top = `${pointerEvent.clientY + 12}px`;
      };
      const finish = () => {
        handle.classList.remove("kc-active");
        badge.remove();
        const widths = {
          ...(readState(table).widths || {}),
          [th.dataset.kcColumnKey]: Math.round(th.getBoundingClientRect().width)
        };
        writeState(table, { widths });
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", finish);
        handle.removeEventListener("pointercancel", finish);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", finish);
      handle.addEventListener("pointercancel", finish);
    });
  }

  function bindMove(table, th, button) {
    button.addEventListener("pointerdown", event => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      const headRow = th.parentElement;
      const from = [...headRow.cells].indexOf(th);
      th.classList.add("kc-column-dragging");
      button.setPointerCapture?.(event.pointerId);
      let target = null;
      const move = pointerEvent => {
        table.querySelectorAll("th.kc-column-target").forEach(node =>
          node.classList.remove("kc-column-target"));
        target = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)?.closest("th");
        if (!target || target.parentElement !== headRow || target === th) {
          target = null;
          return;
        }
        target.classList.add("kc-column-target");
      };
      const finish = pointerEvent => {
        if (target) {
          const to = [...headRow.cells].indexOf(target);
          const rect = target.getBoundingClientRect();
          moveColumn(table, from, to, pointerEvent.clientX > rect.left + rect.width / 2);
        }
        th.classList.remove("kc-column-dragging");
        table.querySelectorAll("th.kc-column-target").forEach(node =>
          node.classList.remove("kc-column-target"));
        button.removeEventListener("pointermove", move);
        button.removeEventListener("pointerup", finish);
        button.removeEventListener("pointercancel", finish);
      };
      button.addEventListener("pointermove", move);
      button.addEventListener("pointerup", finish);
      button.addEventListener("pointercancel", finish);
    });
  }

  function decorateHeader(table, th, index) {
    const key = headerKey(th, index);
    const existingControls = th.querySelector("input,select,textarea,button,a");
    const labelText = clean(th.textContent);
    const originalNodes = [...th.childNodes];
    const head = document.createElement("span");
    head.className = "kc-tablecore-head";
    const label = document.createElement("span");
    label.className = "kc-tablecore-label";
    originalNodes.forEach(node => label.appendChild(node));
    head.appendChild(label);
    if (labelText && !existingControls) {
      const sort = document.createElement("button");
      sort.type = "button";
      sort.className = "kc-tablecore-sort";
      sort.textContent = "↕";
      sort.title = `${labelText} sortieren`;
      sort.setAttribute("aria-label", `${labelText} sortieren`);
      sort.addEventListener("click", event => {
        event.stopPropagation();
        const current = readState(table).sort;
        const direction = current?.key !== key ? "asc" :
          current.direction === "asc" ? "desc" :
          current.direction === "desc" ? "none" : "asc";
        applySort(table, key, direction);
      });
      head.appendChild(sort);
    }
    const move = document.createElement("button");
    move.type = "button";
    move.className = "kc-tablecore-move";
    move.textContent = "↔";
    move.title = `${labelText || "Spalte"} verschieben`;
    move.setAttribute("aria-label", `${labelText || "Spalte"} verschieben`);
    bindMove(table, th, move);
    head.appendChild(move);
    const resize = document.createElement("span");
    resize.className = "kc-tablecore-resize";
    resize.title = "Spaltenbreite ziehen; Doppelklick für Auto-Fit";
    resize.setAttribute("role", "separator");
    resize.setAttribute("aria-orientation", "vertical");
    bindResize(table, th, resize);
    th.append(head, resize);
    th.tabIndex = 0;
    th.addEventListener("keydown", event => {
      if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const from = [...th.parentElement.cells].indexOf(th);
      const to = event.key === "ArrowLeft" ? from - 1 : from + 1;
      if (to >= 0 && to < th.parentElement.cells.length) {
        moveColumn(table, from, to, false);
        th.focus();
      }
    });
  }

  function enhance(table) {
    if (!(table instanceof HTMLTableElement) || table.dataset.kcTablecoreReady) return;
    if (!table.tHead?.rows[0] || !table.tBodies.length || table.closest(SKIP_SELECTOR)) return;
    table.dataset.kcTablecoreReady = "1";
    table.classList.add("kc-tablecore");
    [...table.tHead.rows[0].cells].forEach((th, index) => decorateHeader(table, th, index));
    const state = readState(table);
    applyOrder(table, state.order);
    const widths = state.widths || {};
    [...table.tHead.rows[0].cells].forEach(th => {
      const width = Number(widths[th.dataset.kcColumnKey]);
      if (width > 0) {
        th.style.width = `${width}px`;
        th.style.minWidth = `${width}px`;
      }
    });
    if (state.sort?.key) applySort(table, state.sort.key, state.sort.direction, false);
  }

  function scan(rootNode = document) {
    if (rootNode.matches?.("table")) enhance(rootNode);
    rootNode.querySelectorAll?.("table").forEach(enhance);
  }

  function init() {
    scan();
    observer = new MutationObserver(records => {
      const changedTables = new Set();
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        scan(node);
        const table = node.closest?.("table") || record.target.closest?.("table");
        if (table?.dataset.kcTablecoreReady) changedTables.add(table);
      }));
      changedTables.forEach(table => {
        const sort = readState(table).sort;
        if (sort?.key) applySort(table, sort.key, sort.direction, false);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    root.KCReleaseManifestCore?.register?.("managerTableCore", VERSION);
  }

  root.KCManagerTableCore = Object.freeze({ version: VERSION, scan, enhance });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window);
