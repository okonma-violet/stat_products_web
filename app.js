"use strict";

const CATEGORIES_URL = "/back/categories_list";
const SUPPLIERS_URL = "/back/suppliers_list";
const STATISTICS_URL = "/back/products_moving";

const MIN_COLUMN_WIDTH = 8;
const DEFAULT_HIGHLIGHT_COLOR = "#fff2a8";
const REQUEST_TIMER_INTERVAL = 100;

const supplierMetricColumns = [
  { key: "brand", label: "Бренд", type: "text" },
  { key: "articul", label: "Артикул", type: "text" },
  { key: "uploads", label: "Выгрузки", type: "number" },
  { key: "diffstat", label: "DiffStat", type: "number" },
  { key: "stock_avg", label: "Средний остаток", type: "number" },
  { key: "stock_avg_nozeroes", label: "Средний остаток без нулей", type: "number" },
  { key: "stock_dispersion", label: "Дисперсия", type: "number" },
  { key: "price_avg", label: "Средняя цена", type: "money" },
  { key: "price_min", label: "Минимальная цена", type: "money" },
  { key: "price_current", label: "Текущая цена", type: "money" },
  { key: "stock_current", label: "Текущий остаток", type: "number" },
];

const baseColumns = [
  { key: "brand", label: "Бренд", type: "text", sortable: true },
  { key: "articul", label: "Артикул", type: "text", sortable: true },
  { key: "names", label: "Название", type: "text", sortable: true },
  { key: "category", label: "Категория", type: "text", sortable: true },
  { key: "total_diffstat", label: "DiffStat", type: "number", sortable: true },
  { key: "avg_stock", label: "Средний остаток", type: "number", sortable: true },
  { key: "avg_stock_nozeroes", label: "Средний остаток без нулей", type: "number", sortable: true },
  { key: "total_dispersion", label: "Дисперсия", type: "number", sortable: true },
  { key: "min_price", label: "Минимальная цена", type: "money", sortable: true },
  { key: "min_current_price", label: "Текущая минимальная цена", type: "money", sortable: true },
  { key: "total_current_stock", label: "Текущий остаток", type: "number", sortable: true },
];

const state = {
  categories: [],
  suppliers: [],
  response: null,
  rows: [],
  disabledSuppliers: new Set(),
  selectedRows: new Set(),
  columnHighlights: new Map(),
  sort: { key: null, direction: "asc" },
  columnWidths: new Map(),
  resizing: null,
  requestTimer: {
    startedAt: null,
    intervalId: null,
  },
};

const els = {
  periodLabel: document.querySelector("#periodLabel"),
  categoryLabel: document.querySelector("#categoryLabel"),
  headerSuppliersButton: document.querySelector("#headerSuppliersButton"),
  headerSuppliersList: document.querySelector("#headerSuppliersList"),
  saveCsvButton: document.querySelector("#saveCsvButton"),
  csvMenu: document.querySelector("#csvMenu"),
  openRequestModal: document.querySelector("#openRequestModal"),
  requestDialog: document.querySelector("#requestDialog"),
  closeRequestModal: document.querySelector("#closeRequestModal"),
  cancelRequest: document.querySelector("#cancelRequest"),
  requestForm: document.querySelector("#requestForm"),
  categorySelect: document.querySelector("#categorySelect"),
  supplierList: document.querySelector("#supplierList"),
  dateFrom: document.querySelector("#dateFrom"),
  dateTo: document.querySelector("#dateTo"),
  formError: document.querySelector("#formError"),
  statusPanel: document.querySelector("#statusPanel"),
  statusText: document.querySelector("#statusText"),
  statusTime: document.querySelector("#statusTime"),
  statusCode: document.querySelector("#statusCode"),
  highlightButton: document.querySelector("#highlightButton"),
  highlightMenu: document.querySelector("#highlightMenu"),
  tableHead: document.querySelector("#tableHead"),
  tableBody: document.querySelector("#tableBody"),
};

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindEvents();
  setDefaultDates();
  renderTable();
}

function bindEvents() {
  els.openRequestModal.addEventListener("click", openRequestDialog);
  els.headerSuppliersButton.addEventListener("click", toggleHeaderSuppliersList);
  els.saveCsvButton.addEventListener("click", toggleCsvMenu);
  els.csvMenu.addEventListener("click", handleCsvMenuClick);
  els.highlightButton.addEventListener("click", toggleHighlightMenu);
  els.closeRequestModal.addEventListener("click", closeRequestDialog);
  els.cancelRequest.addEventListener("click", closeRequestDialog);
  els.requestForm.addEventListener("submit", handleRequestSubmit);

  document.addEventListener("click", closeFloatingMenus);
  document.addEventListener("keydown", handleDocumentKeydown);
  document.addEventListener("mousemove", handleResizeMove);
  document.addEventListener("mouseup", stopResize);
}

function setDefaultDates() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  els.dateFrom.value = toDateInputValue(weekAgo);
  els.dateTo.value = toDateInputValue(today);
}

async function openRequestDialog() {
  els.formError.textContent = "";
  els.requestDialog.showModal();
  await loadFilters();
}

function closeRequestDialog() {
  els.requestDialog.close();
}

async function loadFilters() {
  try {
    const [categoriesResponse, suppliersResponse] = await Promise.all([
      fetchJson(CATEGORIES_URL),
      fetchJson(SUPPLIERS_URL),
    ]);

    state.categories = Array.isArray(categoriesResponse.items) ? categoriesResponse.items : [];
    state.suppliers = Array.isArray(suppliersResponse.items) ? suppliersResponse.items : [];
    renderFilterControls();
  } catch (error) {
    els.formError.textContent = "Не удалось загрузить категории или поставщиков.";
  }
}

function renderFilterControls() {
  els.categorySelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Выберите категорию";
  els.categorySelect.append(placeholder);

  state.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categorySelect.append(option);
  });

  els.supplierList.innerHTML = "";
  if (state.suppliers.length === 0) {
    els.supplierList.textContent = "Поставщики не найдены.";
    return;
  }

  state.suppliers.forEach((supplier) => {
    const label = document.createElement("label");
    label.className = "supplier-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = String(supplier.id);

    const text = document.createElement("span");
    text.textContent = supplier.name;

    label.append(checkbox, text);
    els.supplierList.append(label);
  });
}

async function handleRequestSubmit(event) {
  event.preventDefault();
  els.formError.textContent = "";

  const selectedSuppliers = [...els.supplierList.querySelectorAll("input[type='checkbox']:checked")]
    .map((input) => Number(input.value));

  if (!els.categorySelect.value) {
    els.formError.textContent = "Выберите категорию.";
    return;
  }

  if (selectedSuppliers.length === 0) {
    els.formError.textContent = "Выберите хотя бы одного поставщика.";
    return;
  }

  if (!els.dateFrom.value || !els.dateTo.value) {
    els.formError.textContent = "Выберите даты.";
    return;
  }

  const dateFrom = startOfDayTimestamp(els.dateFrom.value);
  const dateTo = endOfDayTimestamp(els.dateTo.value);

  if (dateFrom > dateTo) {
    els.formError.textContent = "Дата начала не может быть позже даты окончания.";
    return;
  }

  const requestBody = {
    date_from: dateFrom,
    date_to: dateTo,
    category: els.categorySelect.value,
    suppliers: selectedSuppliers,
  };

  closeRequestDialog();
  setStatus("Загрузка данных...");
  startRequestTimer();
  setStatusCode(null);
  els.saveCsvButton.disabled = true;

  try {
    const { data, status } = await requestStatistics(requestBody);
    finishRequestTimer(status);
    applyStatisticsResponse(data);
  } catch (error) {
    finishRequestTimer(error.status ?? null);
    setStatus("Не удалось получить данные статистики.", true);
  }
}

function applyStatisticsResponse(response) {
  state.response = {
    ...response,
    items: Array.isArray(response.items) ? response.items : [],
    suppliers: Array.isArray(response.suppliers) ? response.suppliers : [],
  };
  state.rows = [...state.response.items];
  state.disabledSuppliers = new Set();
  state.selectedRows = new Set();
  state.columnHighlights = new Map();
  state.sort = { key: null, direction: "asc" };

  updateHeader();
  renderHighlightMenu();
  renderTable();

  if (state.rows.length === 0) {
    setStatus("По выбранным параметрам данные не найдены.");
  } else {
    setStatus(`Загружено товаров: ${state.rows.length}.`, false, true);
  }
}

function updateHeader() {
  if (!state.response) {
    els.periodLabel.textContent = "Период: не выбран";
    els.categoryLabel.textContent = "Категория: не выбрана";
    els.headerSuppliersList.textContent = "Нет данных";
    els.headerSuppliersList.hidden = true;
    els.headerSuppliersButton.disabled = true;
    return;
  }

  els.periodLabel.textContent = `Период: ${formatDate(state.response.date_from)} - ${formatDate(state.response.date_to)}`;
  els.categoryLabel.textContent = `Категория: ${state.response.category || "не выбрана"}`;

  els.headerSuppliersList.innerHTML = "";
  if (state.response.suppliers.length === 0) {
    els.headerSuppliersList.textContent = "Нет данных";
    els.headerSuppliersList.hidden = true;
    els.headerSuppliersButton.disabled = true;
    return;
  }

  state.response.suppliers.forEach((supplier) => {
    const item = document.createElement("div");
    item.className = "header-supplier-item";
    item.textContent = supplier.name;
    els.headerSuppliersList.append(item);
  });
  els.headerSuppliersButton.disabled = false;
}

function renderTable() {
  renderTableHead();
  renderTableBody();
}

function renderTableHead() {
  els.tableHead.innerHTML = "";

  const groupRow = document.createElement("tr");
  const columnRow = document.createElement("tr");
  const suppliers = getResponseSuppliers();
  const hasSupplierGroups = suppliers.length > 0;

  baseColumns.forEach((column, columnIndex) => {
    const groupTh = document.createElement("th");
    groupTh.rowSpan = hasSupplierGroups ? 2 : 1;
    groupTh.dataset.columnId = column.key;
    groupTh.className = "resizable-header";
    setColumnWidthStyle(groupTh, getColumnWidth(column.key, column.type));
    if (hasSupplierGroups && columnIndex === baseColumns.length - 1) {
      groupTh.classList.add("group-divider-right");
    }

    const label = document.createElement("span");
    label.textContent = column.label;

    if (column.sortable) {
      groupTh.classList.add("sortable");
      groupTh.addEventListener("click", () => toggleSort(column.key));
      const indicator = document.createElement("span");
      indicator.className = "sort-indicator";
      indicator.textContent = getSortIndicator(column.key);
      label.append(indicator);
    }

    groupTh.append(label, createResizeHandle(column.key, column.type));
    groupRow.append(groupTh);
  });

  suppliers.forEach((supplier, supplierIndex) => {
    const supplierTh = document.createElement("th");
    supplierTh.colSpan = supplierMetricColumns.length;
    supplierTh.className = "supplier-group group-divider-right";
    if (state.disabledSuppliers.has(supplierIndex)) {
      supplierTh.classList.add("supplier-disabled");
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "supplier-toggle";
    button.textContent = supplier.name;
    button.addEventListener("click", () => toggleSupplier(supplierIndex));
    supplierTh.append(button);
    groupRow.append(supplierTh);

    supplierMetricColumns.forEach((column, columnIndex) => {
      const columnId = supplierColumnId(supplierIndex, column.key);
      const th = document.createElement("th");
      th.className = "resizable-header";
      th.dataset.columnId = columnId;
      setColumnWidthStyle(th, getColumnWidth(columnId, column.type));
      th.textContent = column.label;
      if (columnIndex === supplierMetricColumns.length - 1) {
        th.classList.add("group-divider-right");
      }
      th.append(createResizeHandle(columnId, column.type));
      columnRow.append(th);
    });
  });

  els.tableHead.append(groupRow);
  if (hasSupplierGroups) {
    els.tableHead.append(columnRow);
  }
}

function renderTableBody() {
  els.tableBody.innerHTML = "";

  const rows = getSortedRows();
  if (!state.response || rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = getTotalColumnCount();
    td.textContent = state.response ? "Нет данных для отображения." : "Запросите данные для построения таблицы.";
    tr.append(td);
    els.tableBody.append(tr);
    return;
  }

  rows.forEach((item) => {
    const tr = document.createElement("tr");
    const totals = calculateTotals(item);
    const rowId = getRowId(item);
    const isSelected = state.selectedRows.has(rowId);
    const hasSupplierGroups = getResponseSuppliers().length > 0;

    if (isSelected) {
      tr.classList.add("row-selected");
    }

    baseColumns.forEach((column, columnIndex) => {
      const td = document.createElement("td");
      const value = getBaseColumnValue(item, totals, column.key);
      td.dataset.columnId = column.key;
      td.textContent = formatCell(value, column.type);
      setColumnWidthStyle(td, getColumnWidth(column.key, column.type));
      applyCellHighlight(td, column.key, isSelected);
      if (hasSupplierGroups && columnIndex === baseColumns.length - 1) {
        td.classList.add("group-divider-right");
      }
      if (column.key === "names") {
        td.classList.add("name-cell");
        td.addEventListener("click", () => toggleRowSelection(rowId));
      }
      if (column.type !== "text") {
        td.classList.add("number-cell");
      }
      tr.append(td);
    });

    getResponseSuppliers().forEach((supplier, supplierIndex) => {
      const stat = getSupplierStat(item, supplierIndex);
      const disabled = state.disabledSuppliers.has(supplierIndex);

      supplierMetricColumns.forEach((column, columnIndex) => {
        const td = document.createElement("td");
        const columnId = supplierColumnId(supplierIndex, column.key);
        td.dataset.columnId = columnId;
        td.textContent = formatCell(stat?.[column.key], column.type);
        setColumnWidthStyle(td, getColumnWidth(columnId, column.type));
        applyCellHighlight(td, `supplierMetric:${column.key}`, isSelected);
        if (columnIndex === supplierMetricColumns.length - 1) {
          td.classList.add("group-divider-right");
        }
        if (column.type !== "text") {
          td.classList.add("number-cell");
        }
        if (disabled) {
          td.classList.add("supplier-disabled-cell");
        }
        tr.append(td);
      });
    });

    els.tableBody.append(tr);
  });
}

function toggleSort(key) {
  if (state.sort.key === key) {
    state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
  } else {
    state.sort = { key, direction: "asc" };
  }
  renderTable();
}

function toggleSupplier(supplierIndex) {
  if (state.disabledSuppliers.has(supplierIndex)) {
    state.disabledSuppliers.delete(supplierIndex);
  } else {
    state.disabledSuppliers.add(supplierIndex);
  }
  renderTable();
}

function getSortedRows() {
  if (!state.sort.key) {
    return [...state.rows];
  }

  const column = baseColumns.find((item) => item.key === state.sort.key);
  const directionMultiplier = state.sort.direction === "asc" ? 1 : -1;

  return [...state.rows].sort((a, b) => {
    const aTotals = calculateTotals(a);
    const bTotals = calculateTotals(b);
    const aValue = getBaseColumnValue(a, aTotals, state.sort.key);
    const bValue = getBaseColumnValue(b, bTotals, state.sort.key);
    const aEmpty = isEmptyValue(aValue);
    const bEmpty = isEmptyValue(bValue);

    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    if (column?.type === "text") {
      return String(aValue).localeCompare(String(bValue), "ru", { numeric: true }) * directionMultiplier;
    }

    return (Number(aValue) - Number(bValue)) * directionMultiplier;
  });
}

function calculateTotals(item, disabledSuppliers = state.disabledSuppliers) {
  const enabledStats = getResponseSuppliers()
    .map((supplier, index) => getSupplierStat(item, index))
    .filter((stat, index) => stat && !disabledSuppliers.has(index));

  return {
    total_diffstat: sumValues(enabledStats, "diffstat"),
    avg_stock: averageValues(enabledStats, "stock_avg"),
    avg_stock_nozeroes: averageValues(enabledStats, "stock_avg_nozeroes"),
    total_dispersion: sumValues(enabledStats, "stock_dispersion"),
    min_price: minPositiveValue(enabledStats, "price_min"),
    min_current_price: minPositiveValue(enabledStats, "price_current"),
    total_current_stock: sumValues(enabledStats, "stock_current"),
  };
}

function getBaseColumnValue(item, totals, key) {
  if (Object.prototype.hasOwnProperty.call(totals, key)) {
    return totals[key];
  }
  return item[key];
}

function getSupplierStat(item, supplierIndex) {
  return Array.isArray(item.suppliers_stat) ? item.suppliers_stat[supplierIndex] : null;
}

function getResponseSuppliers() {
  return state.response?.suppliers || [];
}

function getTotalColumnCount() {
  return baseColumns.length + getResponseSuppliers().length * supplierMetricColumns.length;
}

function sumValues(items, key) {
  const values = items.map((item) => toNumberOrNull(item?.[key])).filter((value) => value !== null);
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0);
}

function averageValues(items, key) {
  const values = items.map((item) => toNumberOrNull(item?.[key])).filter((value) => value !== null);
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function minPositiveValue(items, key) {
  const values = items
    .map((item) => toNumberOrNull(item?.[key]))
    .filter((value) => value !== null && value !== 0);
  if (values.length === 0) return null;
  return Math.min(...values);
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isEmptyValue(value) {
  return value === null || value === undefined || value === "";
}

function formatCell(value, type) {
  if (isEmptyValue(value)) return "";
  if (type === "money") return moneyFormatter.format(Number(value));
  if (type === "number") return numberFormatter.format(Number(value));
  return String(value);
}

function formatDate(timestamp) {
  if (!timestamp) return "не выбрана";
  return new Intl.DateTimeFormat("ru-RU").format(new Date(timestamp * 1000));
}

function setStatus(message, isError = false, showActions = false) {
  els.statusText.textContent = message;
  els.statusPanel.classList.toggle("error", isError);
  els.highlightButton.hidden = !showActions;
  els.saveCsvButton.disabled = !showActions;
  if (!showActions) {
    els.highlightMenu.hidden = true;
    els.csvMenu.hidden = true;
  }
}

function startRequestTimer() {
  stopRequestTimer();
  state.requestTimer.startedAt = performance.now();
  updateStatusTime(0);
  state.requestTimer.intervalId = window.setInterval(() => {
    updateStatusTime(performance.now() - state.requestTimer.startedAt);
  }, REQUEST_TIMER_INTERVAL);
}

function finishRequestTimer(status) {
  const startedAt = state.requestTimer.startedAt;
  stopRequestTimer();
  if (startedAt !== null) {
    updateStatusTime(performance.now() - startedAt);
  }
  setStatusCode(status);
}

function stopRequestTimer() {
  if (state.requestTimer.intervalId !== null) {
    window.clearInterval(state.requestTimer.intervalId);
  }
  state.requestTimer.startedAt = null;
  state.requestTimer.intervalId = null;
}

function updateStatusTime(elapsedMs) {
  els.statusTime.textContent = formatRequestDuration(elapsedMs);
}

function setStatusCode(status) {
  els.statusCode.textContent = Number.isInteger(status) ? String(status) : "-";
}

function formatRequestDuration(elapsedMs) {
  if (elapsedMs < 1000) {
    return `${Math.round(elapsedMs)} мс`;
  }
  return `${(elapsedMs / 1000).toFixed(1).replace(".", ",")} с`;
}

function toggleCsvMenu(event) {
  event.stopPropagation();
  if (els.saveCsvButton.disabled) return;
  els.csvMenu.hidden = !els.csvMenu.hidden;
  els.highlightMenu.hidden = true;
  els.headerSuppliersList.hidden = true;
}

function handleCsvMenuClick(event) {
  const button = event.target.closest("[data-export-mode]");
  if (!button) return;
  exportCsv(button.dataset.exportMode);
  els.csvMenu.hidden = true;
}

function toggleHighlightMenu(event) {
  event.stopPropagation();
  els.highlightMenu.hidden = !els.highlightMenu.hidden;
  els.csvMenu.hidden = true;
  els.headerSuppliersList.hidden = true;
}

function toggleHeaderSuppliersList(event) {
  event.stopPropagation();
  if (els.headerSuppliersButton.disabled) return;
  els.headerSuppliersList.hidden = !els.headerSuppliersList.hidden;
  els.csvMenu.hidden = true;
  els.highlightMenu.hidden = true;
}

function closeFloatingMenus(event) {
  if (!event.target.closest(".dropdown")) {
    els.csvMenu.hidden = true;
  }
  if (!event.target.closest(".highlight-control")) {
    els.highlightMenu.hidden = true;
  }
  if (!event.target.closest(".header-suppliers-popover")) {
    els.headerSuppliersList.hidden = true;
  }
}

function handleDocumentKeydown(event) {
  if (event.key !== "Escape") return;
  els.csvMenu.hidden = true;
  els.highlightMenu.hidden = true;
  els.headerSuppliersList.hidden = true;
}

function renderHighlightMenu() {
  els.highlightMenu.innerHTML = "";

  appendHighlightSection("Общие колонки");
  baseColumns.forEach((column) => {
    appendHighlightOption({
      id: column.key,
      label: column.label,
    });
  });

  appendHighlightSection("Поставщики");
  supplierMetricColumns.forEach((column) => {
    appendHighlightOption({
      id: `supplierMetric:${column.key}`,
      label: `Поставщики / ${column.label}`,
    });
  });
}

function appendHighlightSection(title) {
  const heading = document.createElement("div");
  heading.className = "highlight-menu-title";
  heading.textContent = title;
  els.highlightMenu.append(heading);
}

function appendHighlightOption({ id, label }) {
  const row = document.createElement("div");
  row.className = "highlight-option";

  const labelEl = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = state.columnHighlights.has(id);

  const text = document.createElement("span");
  text.textContent = label;

  const color = document.createElement("input");
  color.type = "color";
  color.value = state.columnHighlights.get(id) || DEFAULT_HIGHLIGHT_COLOR;

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      state.columnHighlights.set(id, color.value);
    } else {
      state.columnHighlights.delete(id);
    }
    renderTableBody();
  });

  color.addEventListener("input", () => {
    if (!checkbox.checked) {
      checkbox.checked = true;
    }
    state.columnHighlights.set(id, color.value);
    renderTableBody();
  });

  labelEl.append(checkbox, text);
  row.append(labelEl, color);
  els.highlightMenu.append(row);
}

function applyCellHighlight(cell, highlightId, rowSelected) {
  if (rowSelected) return;
  const color = state.columnHighlights.get(highlightId);
  if (color) {
    cell.style.backgroundColor = color;
  }
}

function toggleRowSelection(rowId) {
  if (state.selectedRows.has(rowId)) {
    state.selectedRows.delete(rowId);
  } else {
    state.selectedRows.add(rowId);
  }
  renderTableBody();
}

function getRowId(item) {
  return [item.brand, item.articul, item.names, item.category]
    .map((value) => String(value ?? ""))
    .join("\u001f");
}

function exportCsv(mode) {
  if (!state.response) return;

  const rawMode = mode === "raw";
  const disabledSuppliers = rawMode ? new Set() : state.disabledSuppliers;
  const supplierIndexes = getCsvSupplierIndexes(rawMode);
  let rows = state.response.items || [];

  if (mode === "edited-highlighted" && state.selectedRows.size > 0) {
    rows = rows.filter((item) => state.selectedRows.has(getRowId(item)));
  }

  const csvRows = [];
  csvRows.push(getCsvHeaders(supplierIndexes));

  rows.forEach((item) => {
    const totals = calculateTotals(item, disabledSuppliers);
    const values = [];

    baseColumns.forEach((column) => {
      values.push(getBaseColumnValue(item, totals, column.key));
    });

    supplierIndexes.forEach((supplierIndex) => {
      const stat = getSupplierStat(item, supplierIndex);
      supplierMetricColumns.forEach((column) => {
        values.push(stat?.[column.key] ?? "");
      });
    });

    csvRows.push(values);
  });

  const csv = "\ufeff" + csvRows.map((row) => row.map(escapeCsvValue).join(";")).join("\n");
  downloadCsv(csv, getCsvFileName(mode));
}

function getCsvSupplierIndexes(includeAll) {
  return getResponseSuppliers()
    .map((supplier, index) => index)
    .filter((index) => includeAll || !state.disabledSuppliers.has(index));
}

function getCsvHeaders(supplierIndexes) {
  const headers = baseColumns.map((column) => column.label);
  supplierIndexes.forEach((supplierIndex) => {
    const supplier = getResponseSuppliers()[supplierIndex];
    supplierMetricColumns.forEach((column) => {
      headers.push(`${supplier.name} / ${column.label}`);
    });
  });
  return headers;
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[;"\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getCsvFileName(mode) {
  const category = sanitizeFilePart(state.response?.category || "all");
  const from = formatDateForFile(state.response?.date_from);
  const to = formatDateForFile(state.response?.date_to);
  return `stats-${mode}-${category}-${from}-${to}.csv`;
}

function sanitizeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9а-яА-Я_-]+/g, "-").replace(/^-+|-+$/g, "") || "value";
}

function formatDateForFile(timestamp) {
  if (!timestamp) return "no-date";
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function requestStatistics(body) {
  const response = await fetch(STATISTICS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const status = response.status;

  if (!response.ok) {
    const error = new Error(`HTTP ${status}`);
    error.status = status;
    throw error;
  }

  try {
    return {
      data: await response.json(),
      status,
    };
  } catch (error) {
    error.status = status;
    throw error;
  }
}

async function postJson(url, body, fallback) {
  if (!url) {
    return structuredClone(fallback);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    return structuredClone(fallback);
  }
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDayTimestamp(value) {
  const date = new Date(`${value}T00:00:00`);
  return Math.floor(date.getTime() / 1000);
}

function endOfDayTimestamp(value) {
  const date = new Date(`${value}T23:59:59`);
  return Math.floor(date.getTime() / 1000);
}

function supplierColumnId(supplierIndex, key) {
  return `supplier-${supplierIndex}-${key}`;
}

function getColumnWidth(columnId, type) {
  const fallback = type === "text" ? 150 : 112;
  return state.columnWidths.get(columnId) || fallback;
}

function createResizeHandle(columnId, type) {
  const handle = document.createElement("span");
  handle.className = "resize-handle";
  handle.addEventListener("click", (event) => event.stopPropagation());
  handle.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const header = event.currentTarget.closest("th");
    state.resizing = {
      columnId,
      type,
      startX: event.clientX,
      startWidth: header.getBoundingClientRect().width,
    };
    document.body.style.cursor = "col-resize";
  });
  return handle;
}

function handleResizeMove(event) {
  if (!state.resizing) return;
  const nextWidth = Math.max(
    MIN_COLUMN_WIDTH,
    Math.round(state.resizing.startWidth + event.clientX - state.resizing.startX)
  );
  state.columnWidths.set(state.resizing.columnId, nextWidth);
  applyColumnWidth(state.resizing.columnId, nextWidth);
}

function stopResize() {
  if (!state.resizing) return;
  state.resizing = null;
  document.body.style.cursor = "";
}

function applyColumnWidth(columnId, width) {
  document.querySelectorAll(`[data-column-id="${CSS.escape(columnId)}"]`).forEach((cell) => {
    setColumnWidthStyle(cell, width);
  });
}

function setColumnWidthStyle(element, width) {
  element.style.width = `${width}px`;
  element.style.minWidth = `${width}px`;
  element.style.maxWidth = `${width}px`;
}

function getSortIndicator(key) {
  if (state.sort.key !== key) return "";
  return state.sort.direction === "asc" ? "▲" : "▼";
}
