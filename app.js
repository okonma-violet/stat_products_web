"use strict";

const CATEGORIES_URL = "";
const SUPPLIERS_URL = "";
const STATISTICS_URL = "";

const TEXT_MIN_WIDTH = 120;
const NUMBER_MIN_WIDTH = 80;

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

const mockCategories = {
  items: ["electronics", "books", "smartphones"],
};

const mockSuppliers = {
  items: [
    { id: 1, name: "Supplier One" },
    { id: 2, name: "Supplier Two" },
    { id: 3, name: "Supplier Three" },
  ],
};

const mockStatistics = {
  items: [
    {
      brand: "Apple",
      articul: "IPH15-128-BLK",
      category: "smartphones",
      names: "iPhone 15 128GB Black",
      suppliers_stat: [
        {
          brand: "Apple",
          articul: "IPH15-128-BLK",
          sup_name: "Supplier One",
          uploads: 25,
          diffstat: 3,
          stock_dispersion: 5.42,
          stock_avg: 120.5,
          stock_avg_nozeroes: 130.7,
          price_avg: 79990.5,
          price_min: 77990,
          stock_current: 118,
          price_current: 78990,
        },
        {
          brand: "Apple",
          articul: "IPH15-128-BLK",
          sup_name: "Supplier Two",
          uploads: 18,
          diffstat: 1,
          stock_dispersion: 3.15,
          stock_avg: 95.2,
          stock_avg_nozeroes: 97.8,
          price_avg: 80150,
          price_min: 79500,
          stock_current: 96,
          price_current: 79990,
        },
      ],
    },
    {
      brand: "Samsung",
      articul: "SM-S25-256",
      category: "smartphones",
      names: "Samsung Galaxy S25 256GB",
      suppliers_stat: [
        {
          brand: "Samsung",
          articul: "SM-S25-256",
          sup_name: "Supplier One",
          uploads: 30,
          diffstat: 2,
          stock_dispersion: 7.8,
          stock_avg: 210.4,
          stock_avg_nozeroes: 214.6,
          price_avg: 68990,
          price_min: 67990,
          stock_current: 205,
          price_current: 68490,
        },
        {
          brand: "Samsung",
          articul: "SM-S25-256",
          sup_name: "Supplier Two",
          uploads: 12,
          diffstat: -1,
          stock_dispersion: 2.7,
          stock_avg: 88.1,
          stock_avg_nozeroes: 90,
          price_avg: 69200,
          price_min: 0,
          stock_current: 84,
          price_current: 68120,
        },
      ],
    },
  ],
  date_from: 1751328000,
  date_to: 1751932799,
  category: "smartphones",
  suppliers: [
    { id: 1, name: "Supplier One" },
    { id: 2, name: "Supplier Two" },
  ],
};

const state = {
  categories: [],
  suppliers: [],
  response: null,
  rows: [],
  disabledSuppliers: new Set(),
  sort: { key: null, direction: "asc" },
  columnWidths: new Map(),
  resizing: null,
};

const els = {
  periodLabel: document.querySelector("#periodLabel"),
  categoryLabel: document.querySelector("#categoryLabel"),
  headerSuppliers: document.querySelector("#headerSuppliers"),
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
  els.closeRequestModal.addEventListener("click", closeRequestDialog);
  els.cancelRequest.addEventListener("click", closeRequestDialog);
  els.requestForm.addEventListener("submit", handleRequestSubmit);

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
      fetchJson(CATEGORIES_URL, mockCategories),
      fetchJson(SUPPLIERS_URL, mockSuppliers),
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

  try {
    const response = await postJson(STATISTICS_URL, requestBody, createMockStatistics(requestBody));
    applyStatisticsResponse(response);
  } catch (error) {
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
  state.sort = { key: null, direction: "asc" };

  updateHeader();
  renderTable();

  if (state.rows.length === 0) {
    setStatus("По выбранным параметрам данные не найдены.");
  } else {
    setStatus(`Загружено товаров: ${state.rows.length}.`);
  }
}

function updateHeader() {
  if (!state.response) {
    els.periodLabel.textContent = "Период: не выбран";
    els.categoryLabel.textContent = "Категория: не выбрана";
    els.headerSuppliers.innerHTML = "<option>Нет данных</option>";
    els.headerSuppliers.disabled = true;
    return;
  }

  els.periodLabel.textContent = `Период: ${formatDate(state.response.date_from)} - ${formatDate(state.response.date_to)}`;
  els.categoryLabel.textContent = `Категория: ${state.response.category || "не выбрана"}`;

  els.headerSuppliers.innerHTML = "";
  if (state.response.suppliers.length === 0) {
    els.headerSuppliers.innerHTML = "<option>Нет данных</option>";
    els.headerSuppliers.disabled = true;
    return;
  }

  state.response.suppliers.forEach((supplier) => {
    const option = document.createElement("option");
    option.value = String(supplier.id);
    option.textContent = supplier.name;
    els.headerSuppliers.append(option);
  });
  els.headerSuppliers.disabled = false;
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

  baseColumns.forEach((column) => {
    const groupTh = document.createElement("th");
    groupTh.rowSpan = hasSupplierGroups ? 2 : 1;
    groupTh.dataset.columnId = column.key;
    groupTh.className = "resizable-header";
    groupTh.style.width = `${getColumnWidth(column.key, column.type)}px`;

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
    supplierTh.className = "supplier-group";
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

    supplierMetricColumns.forEach((column) => {
      const columnId = supplierColumnId(supplierIndex, column.key);
      const th = document.createElement("th");
      th.className = "resizable-header";
      th.dataset.columnId = columnId;
      th.style.width = `${getColumnWidth(columnId, column.type)}px`;
      th.textContent = column.label;
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

    baseColumns.forEach((column) => {
      const td = document.createElement("td");
      const value = getBaseColumnValue(item, totals, column.key);
      td.dataset.columnId = column.key;
      td.textContent = formatCell(value, column.type);
      td.style.width = `${getColumnWidth(column.key, column.type)}px`;
      if (column.type !== "text") {
        td.classList.add("number-cell");
      }
      tr.append(td);
    });

    getResponseSuppliers().forEach((supplier, supplierIndex) => {
      const stat = getSupplierStat(item, supplierIndex);
      const disabled = state.disabledSuppliers.has(supplierIndex);

      supplierMetricColumns.forEach((column) => {
        const td = document.createElement("td");
        const columnId = supplierColumnId(supplierIndex, column.key);
        td.dataset.columnId = columnId;
        td.textContent = formatCell(stat?.[column.key], column.type);
        td.style.width = `${getColumnWidth(columnId, column.type)}px`;
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

function calculateTotals(item) {
  const enabledStats = getResponseSuppliers()
    .map((supplier, index) => getSupplierStat(item, index))
    .filter((stat, index) => stat && !state.disabledSuppliers.has(index));

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

function setStatus(message, isError = false) {
  els.statusPanel.textContent = message;
  els.statusPanel.classList.toggle("error", isError);
}

async function fetchJson(url, fallback) {
  if (!url) {
    return structuredClone(fallback);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    return structuredClone(fallback);
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

function createMockStatistics(requestBody) {
  const selectedSuppliers = mockSuppliers.items.filter((supplier) => requestBody.suppliers.includes(supplier.id));
  const supplierIndexes = selectedSuppliers.map((supplier) =>
    mockStatistics.suppliers.findIndex((item) => item.id === supplier.id)
  );

  return {
    ...structuredClone(mockStatistics),
    date_from: requestBody.date_from,
    date_to: requestBody.date_to,
    category: requestBody.category,
    suppliers: selectedSuppliers,
    items: mockStatistics.items.map((item) => ({
      ...structuredClone(item),
      category: requestBody.category,
      suppliers_stat: supplierIndexes.map((index) => (index >= 0 ? structuredClone(item.suppliers_stat[index]) : null)),
    })),
  };
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
  const minWidth = state.resizing.type === "text" ? TEXT_MIN_WIDTH : NUMBER_MIN_WIDTH;
  const nextWidth = Math.max(minWidth, Math.round(state.resizing.startWidth + event.clientX - state.resizing.startX));
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
    cell.style.width = `${width}px`;
  });
}

function getSortIndicator(key) {
  if (state.sort.key !== key) return "";
  return state.sort.direction === "asc" ? "▲" : "▼";
}
