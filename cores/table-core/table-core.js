(function (root) {
  "use strict";

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  function create(columns) {
    if (!Array.isArray(columns) || !columns.length) fail("COLUMNS_REQUIRED");
    let rows = [];
    let selected = new Set();

    function add(row) {
      const copy = { ...row };
      rows.push(copy);
      return Object.freeze({ ...copy });
    }

    function replace(nextRows) {
      if (!Array.isArray(nextRows)) fail("ROWS_REQUIRED");
      rows = nextRows.map(row => ({ ...row }));
      selected = new Set([...selected].filter(id =>
        rows.some(row => String(row.__id) === id)
      ));
      return snapshot();
    }

    function sortBy(column, direction) {
      if (!columns.includes(column)) fail("UNKNOWN_COLUMN");
      const factor = direction === "desc" ? -1 : 1;
      rows = rows.slice().sort((left, right) =>
        String(left[column] ?? "").localeCompare(
          String(right[column] ?? ""),
          "de",
          { numeric: true }
        ) * factor
      );
      return snapshot();
    }

    function filter(column, value) {
      if (!columns.includes(column)) fail("UNKNOWN_COLUMN");
      const search = String(value ?? "").toLocaleLowerCase("de");
      return Object.freeze(rows
        .filter(row => String(row[column] ?? "").toLocaleLowerCase("de").includes(search))
        .map(row => Object.freeze({ ...row })));
    }

    function filterAny(value) {
      const search = String(value ?? "").toLocaleLowerCase("de");
      return Object.freeze(rows
        .filter(row => columns.some(column =>
          String(row[column] ?? "").toLocaleLowerCase("de").includes(search)
        ))
        .map(row => Object.freeze({ ...row })));
    }

    function select(id, enabled = true) {
      id = String(id);
      enabled ? selected.add(id) : selected.delete(id);
      return selection();
    }

    function clearSelection() {
      selected.clear();
      return selection();
    }

    function selection() {
      return Object.freeze([...selected]);
    }

    function snapshot() {
      return Object.freeze(rows.map(row => Object.freeze({ ...row })));
    }

    return Object.freeze({
      version: "1.1.0",
      add,
      replace,
      sortBy,
      filter,
      filterAny,
      select,
      clearSelection,
      selection,
      snapshot
    });
  }

  root.TableCore = Object.freeze({
    version: "1.1.0",
    apiVersion: "1.1",
    create
  });
  root.KCReleaseManifestCore?.register?.("tableCore", "1.1.0");
})(typeof window !== "undefined" ? window : globalThis);
