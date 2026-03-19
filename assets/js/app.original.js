// /assets/js/app.js
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    /* 날짜 입력칸 전체 클릭 시 달력 열기 */
    const wrap = document.querySelector(".date-wrap");
    const input = document.querySelector("#moveDate");

    if (wrap && input) {
      wrap.addEventListener("click", () => {
        input.focus();
        if (input.showPicker) input.showPicker();
        else input.click();
      });
    }

    /* =========================================================
       Global knobs
    ========================================================= */
    const PRICE_MULTIPLIER = 0.874;
    const DISPLAY_MULTIPLIER = 0.95;
    const SERVICE = { MOVE: "move", CLEAN: "clean" };

    /* =========================================================
       DOM helpers
    ========================================================= */
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const safeText = (v) => (v == null ? "" : String(v));
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));


    const DEFAULT_SERVICE = document.body?.dataset.defaultService || "move";
    const SITE_BRAND = document.body?.dataset.siteBrand || (DEFAULT_SERVICE === "clean" ? "디디클린" : "디디운송");
    const CROSS_LINK = document.body?.dataset.crossLink || "";
    const CROSS_LABEL = document.body?.dataset.crossLabel || (DEFAULT_SERVICE === "clean" ? "이사도 필요하시다면 클릭해주세요" : "청소도 필요하시다면 클릭해주세요");


    function createGaFloatingBadge() {
  const langbar = document.querySelector('.langbar');
  if (!langbar || document.getElementById('gaFloatingBadge')) return null;

  const lang = (document.body?.dataset.lang || 'ko').toLowerCase();
  const dict = {
    ko: {
      badge: '실시간 이용 현황',
      liveLabel: '지금',
      liveSuffix: '명이 견적 확인 중',
      desc: '방문자가 있는 순간을 보여줍니다',
      viewsLabel: '최근 30분 조회',
      updated: '업데이트',
      fallbackTitle: '연결 확인 중',
      fallbackDesc: 'GA 실시간 데이터를 불러오는 중입니다',
      emptyDesc: '지금 첫 방문자를 기다리고 있어요',
    },
    en: {
      badge: 'Live activity',
      liveLabel: 'Now',
      liveSuffix: 'visitors checking quotes',
      desc: 'Showing real-time visitor activity',
      viewsLabel: 'Views in last 30m',
      updated: 'Updated',
      fallbackTitle: 'Connecting…',
      fallbackDesc: 'Loading GA realtime data',
      emptyDesc: 'Waiting for the next visitor',
    },
  };

  const t = dict[lang] || dict.ko;

  const badge = document.createElement('aside');
  badge.id = 'gaFloatingBadge';
  badge.className = 'ga-floating-badge is-loading';
  badge.setAttribute('aria-live', 'polite');

  badge.innerHTML = `
    <div class="ga-floating-badge__header">
      <div class="ga-floating-badge__eyebrow">
        <span class="ga-floating-badge__dot" aria-hidden="true"></span>
        <span>${t.badge}</span>
      </div>
    </div>

    <div class="ga-floating-badge__hero">
      <div class="ga-floating-badge__hero-main">
        <strong class="ga-floating-badge__value" data-ga-active>0</strong>
        <span class="ga-floating-badge__unit">${lang === 'ko' ? '명' : ''}</span>
      </div>
      <div class="ga-floating-badge__hero-copy" data-ga-copy>
        ${t.liveLabel} 0${lang === 'ko' ? '명' : ''} ${t.liveSuffix}
      </div>
    </div>

    <div class="ga-floating-badge__desc" data-ga-desc>${t.desc}</div>

    <div class="ga-floating-badge__stats">
      <div class="ga-floating-badge__stat">
        <span class="ga-floating-badge__stat-label">${t.viewsLabel}</span>
        <strong class="ga-floating-badge__stat-value" data-ga-secondary>0</strong>
      </div>
      <div class="ga-floating-badge__stat">
        <span class="ga-floating-badge__stat-label">${t.updated}</span>
        <strong class="ga-floating-badge__stat-value" data-ga-time>-</strong>
      </div>
    </div>
  `;

  document.body.appendChild(badge);

  function positionBadge() {
    const rect = langbar.getBoundingClientRect();
    const badgeRect = badge.getBoundingClientRect();
    const gap = 8;
    const top = Math.max(12, Math.round(rect.bottom + gap));
    const left = Math.max(12, Math.round(rect.right - badgeRect.width));
    badge.style.top = `${top}px`;
    badge.style.left = `${left}px`;
    badge.style.right = 'auto';
  }

  positionBadge();
  window.addEventListener('resize', positionBadge, { passive: true });
  window.addEventListener('scroll', positionBadge, { passive: true });

  return { badge, positionBadge, dict: t, lang };
}

const gaBadge = createGaFloatingBadge();

async function loadGaRealtimeBadge() {
  if (!gaBadge?.badge) return;

  const { badge, positionBadge, dict, lang } = gaBadge;

  try {
    badge.classList.add('is-loading');

    const res = await fetch('/.netlify/functions/gaRealtime', {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });
    const rawText = await res.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (_) {
      throw new Error(`GA realtime returned non-JSON (${res.status || 'unknown'})`);
    }

    if (!res.ok || !data?.ok) {
      const err = String(data?.error || 'GA realtime request failed');
      if (/Missing GA4_PROPERTY_ID|Missing GA_CLIENT_EMAIL|Missing GA_PRIVATE_KEY/i.test(err)) {
        return;
      }
      throw new Error(err);
    }

    const activeUsers = Number(data.activeUsers || 0);
    const pageViews = Number(data.screenPageViews || 0);
    const fetchedAt = data.fetchedAtKst || '-';

    const activeEl = badge.querySelector('[data-ga-active]');
    const copyEl = badge.querySelector('[data-ga-copy]');
    const descEl = badge.querySelector('[data-ga-desc]');
    const secondaryEl = badge.querySelector('[data-ga-secondary]');
    const timeEl = badge.querySelector('[data-ga-time]');

    if (activeEl) activeEl.textContent = activeUsers.toLocaleString();
    if (secondaryEl) secondaryEl.textContent = pageViews.toLocaleString();
    if (timeEl) timeEl.textContent = fetchedAt;

    if (copyEl) {
      if (lang === 'ko') {
        copyEl.textContent = `지금 ${activeUsers.toLocaleString()}명이 견적 확인 중`;
      } else {
        copyEl.textContent = `${activeUsers.toLocaleString()} visitors checking quotes now`;
      }
    }

    if (descEl) {
      if (activeUsers > 0) {
        descEl.textContent =
          lang === 'ko'
            ? '실시간 방문 흐름이 반영되고 있어요'
            : 'Realtime visitor flow is being reflected';
      } else {
        descEl.textContent = dict.emptyDesc;
      }
    }
  } catch (err) {
    const activeEl = badge.querySelector('[data-ga-active]');
    const copyEl = badge.querySelector('[data-ga-copy]');
    const descEl = badge.querySelector('[data-ga-desc]');
    const secondaryEl = badge.querySelector('[data-ga-secondary]');
    const timeEl = badge.querySelector('[data-ga-time]');

    if (activeEl) activeEl.textContent = '0';
    if (copyEl) copyEl.textContent = dict.fallbackTitle;
    if (descEl) descEl.textContent = dict.fallbackDesc;
    if (secondaryEl) secondaryEl.textContent = '-';
    if (timeEl) timeEl.textContent = '-';

    if (!/Missing GA4_PROPERTY_ID|Missing GA_CLIENT_EMAIL|Missing GA_PRIVATE_KEY/i.test(String(err?.message || err))) {
      console.error('GA realtime badge load failed:', err);
    }
  } finally {
    badge.classList.remove('is-loading');
    positionBadge?.();
  }
}

    loadGaRealtimeBadge();
    window.setInterval(loadGaRealtimeBadge, 30000);

    function escapeHtml(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function formatWon(n) {
      const x = Math.trunc(Number(n) || 0); // ✅ 반올림 X (원단위 버림)
      return "₩" + x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function toInt(v, d = 0) {
      const n = parseInt(String(v ?? ""), 10);
      return Number.isFinite(n) ? n : d;
    }

    function toNum(v, d = 0) {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    }

    function setHidden(el, hidden) {
      if (!el) return;
      el.hidden = !!hidden;
      el.style.display = hidden ? "none" : "";
    }
function normalizeItemKey(k) {
  // 항목 키의 공백을 없애서 가격표에서 일치하도록 보정
  return String(k || "").replace(/\s+/g, "");
}
    /* =========================================================
       Config / Supabase
    ========================================================= */
    const CFG = window.DDLOGI_CONFIG || {};
    const supabase = window.supabase?.createClient?.(CFG.supabaseUrl, CFG.supabaseKey);

    async function fetchConfirmedSlots(dateStr) {
      if (!supabase || !dateStr) return new Set();
      try {
        const { data, error } = await supabase
          .from("confirmed_slots")
          .select("time_slot")
          .eq("date", dateStr)
          .eq("status", "confirmed");
        if (error) {
          console.error("fetchConfirmedSlots error:", error);
          return new Set();
        }
        return new Set((data || []).map((x) => String(x.time_slot)));
      } catch (e) {
        console.error("fetchConfirmedSlots exception:", e);
        return new Set();
      }
    }

    function setTimeSlotDisabled(slotValue, disabled) {
      const v = String(slotValue);
      const r = document.querySelector('input[name="timeSlot"][value="' + v + '"]');
      if (!r) return;
      r.disabled = !!disabled;

      const chip = r.closest(".time-chip");
      if (chip) {
        chip.classList.toggle("disabled", !!disabled);
        chip.setAttribute("aria-disabled", disabled ? "true" : "false");
      }

      // ✅ disable되면 체크 해제 + state 반영
      if (disabled && r.checked) {
        r.checked = false;
        state.timeSlot = null;
      }
    }

    async function refreshTimeSlotAvailability() {
      const dateStr = state.moveDate;
      const all = $$('input[name="timeSlot"]');
      all.forEach((r) => setTimeSlotDisabled(r.value, false));

      if (!dateStr) return;

      const confirmed = await fetchConfirmedSlots(dateStr);
      confirmed.forEach((slot) => setTimeSlotDisabled(slot, true));
    }

    /* =========================================================
       State
    ========================================================= */
    const state = {
      activeService: (document.body?.dataset.defaultService || "move"),
      stepIndex: 0,
      moveDate: "",
      timeSlot: null,

      vehicle: "",
      startAddress: "",
      waypointAddress: "",
      waypointLoadLevel: null,
      waypointNoElevator: false,
      waypointFloor: 1,
      waypointLadderEnabled: false,
      waypointLadderFloor: 6,
      waypointItems: {},
      waypointItemsNote: "",
      waypointThrow: {},
      waypointThrowNote: "",
      endAddress: "",
      hasWaypoint: false,
      distanceKm: 0,
      lastDistanceRouteKey: "",

      moveType: "general",
      storageBase: "general",
      storageDays: 1,

      noFrom: false,
      fromFloor: 1,
      noTo: false,
      toFloor: 1,

      loadLevel: null,

      cantCarryFrom: false,
      cantCarryTo: false,
      helperFrom: false,
      helperTo: false,

      ladderFromEnabled: false,
      ladderFromFloor: 6,
      ladderToEnabled: false,
      ladderToFloor: 6,

      night: false,
      ride: 0,

      cleaningToggle: false,
      cleaningFrom: false,
      cleaningTo: false,
      cleaningType: "light",

      throwToggle: false,
      workFrom: false,
      workTo: false,

      items: {},
      itemsNote: "",
      mattressSizes: { S: 0, SS: 0, D: 0, Q: 0, K: 0 },

      throwFrom: {},
      throwTo: {},
      throwNote: "",

      cleanType: "movein",
      cleanSoil: "light",
      cleanPyeong: 9,
      cleanRooms: 1,
      cleanBaths: 1,
      cleanBalconies: 1,
      cleanWardrobes: 0,
      cleanAddress: "",
      cleanAddressNote: "",
      cleanParkingHard: false,
      cleanNoElevator: false,
      cleanFloor: 1,
      cleanOuterWindowEnabled: false,
      cleanOuterWindowPyeong: 0,
      cleanPhytoncideEnabled: false,
      cleanDisinfectEnabled: false,
      cleanTrashBags: 0,
      cleanBasic: {},
      cleanAppliance: {},
      cleanNote: "",
    };

    /* =========================================================
       Wizard step model (DOM-driven)
    ========================================================= */
    const sections = $$(".step-card");

    function getStepToken(sectionEl) {
      const raw = sectionEl.getAttribute("data-step");
      if (raw == null) return null;
      if (/^\d+$/.test(raw.trim())) return Number(raw.trim());
      return raw.trim();
    }

    function computeVisibleSteps() {
      const svc = state.activeService;
      const visible = [];

      for (const sec of sections) {
        const token = getStepToken(sec);
        if (token == null) continue;

        const secOnly = sec.getAttribute("data-only");
        if (!svc) {
          if (token === 0 || token === "service") visible.push(sec);
        } else {
          if (secOnly && secOnly !== svc) continue;
          visible.push(sec);
        }
      }
      return visible;
    }

    function showOnlySection(activeSec) {
      const visibleSet = new Set(computeVisibleSteps());
      for (const sec of sections) {
        const shouldShow = visibleSet.has(sec);
        sec.style.display = shouldShow ? "" : "none";
        sec.setAttribute("aria-hidden", shouldShow ? "false" : "true");
        sec.classList.toggle("is-active", shouldShow && sec === activeSec);

        const svc = state.activeService;
        const innerOnly = $$("[data-only]", sec);
        innerOnly.forEach((node) => {
          const only = node.getAttribute("data-only");
          if (!only) return;
          if (!svc) node.style.display = "none";
          else node.style.display = only === svc ? "" : "none";
        });
      }
    }

    function gotoStep(index, opts = {}) {
      const visible = computeVisibleSteps();
      const maxIdx = Math.max(0, visible.length - 1);
      const nextIdx = clamp(index, 0, maxIdx);
      state.stepIndex = nextIdx;

      const sec = visible[nextIdx];
      showOnlySection(sec);
      updateWizardUI(visible);

      const token = getStepToken(sec);
      if (token === 3) refreshTimeSlotAvailability();
      if (token === 12) {
        renderAll();
        queueCompareChartResize();
        setTimeout(queueCompareChartResize, 120);
      }

      if (!opts.noScroll && sec) {
        sec.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function updateWizardUI(visibleSteps) {
      const nav = $("#wizardNav");
      if (nav) nav.style.display = "none";
    }

    function canGoNext() {
      const visible = computeVisibleSteps();
      const sec = visible[state.stepIndex];
      const token = getStepToken(sec);

      if (token === 0) return true;
      if (token === "service") return !!state.activeService;

      if (state.activeService === SERVICE.MOVE) {
        if (token === 1) return !!state.vehicle;
        if (token === 2) return state.distanceKm > 0 && state.lastDistanceRouteKey === currentRouteKey() && !!state.startAddress && !!state.endAddress;
        if (token === 3) return !!state.moveDate && !!state.timeSlot;
        if (token === 4) return !!state.moveType;
        if (token === 6) return state.loadLevel !== null;
      }

      if (state.activeService === SERVICE.CLEAN) {
        if (token === 1) return true;
        if (token === 2) return !!state.cleanAddress;
        if (token === 3) return !!state.moveDate && !!state.timeSlot;
        if (token === 4) return true;
      }

      return true;
    }

    function flashRequiredHint(sec) {
      if (!sec) return;
      sec.classList.add("shake");
      setTimeout(() => sec.classList.remove("shake"), 350);

      const token = getStepToken(sec);
      if (token === "service" && !state.activeService) {
        alert("서비스를 먼저 선택해주세요.");
        return;
      }
      if (state.activeService === SERVICE.MOVE) {
        if (token === 1 && !state.vehicle) alert("차량을 선택해주세요.");
        if (token === 2 && (state.distanceKm <= 0 || state.lastDistanceRouteKey !== currentRouteKey())) alert("주소를 바꿨다면 거리 계산하기를 다시 눌러주세요.");
        if (token === 3 && (!state.moveDate || !state.timeSlot)) alert("날짜와 시간을 선택해주세요.");
        if (token === 6 && state.loadLevel === null) alert("짐양(박스 기준)을 선택해주세요.");
      }
      if (state.activeService === SERVICE.CLEAN) {
        if (token === 2 && !state.cleanAddress) alert("청소 주소를 입력해주세요.");
        if (token === 3 && (!state.moveDate || !state.timeSlot)) alert("날짜와 시간을 선택해주세요.");
      }
    }

    function goNext() {
      const visible = computeVisibleSteps();
      const sec = visible[state.stepIndex];
      const token = getStepToken(sec);

      if (token === 12) {
        state.activeService = null;
        gotoStep(0);
        return;
      }

      if (!canGoNext()) {
        flashRequiredHint(sec);
        return;
      }
      gotoStep(state.stepIndex + 1);
    }

    function goPrev() {
      gotoStep(state.stepIndex - 1);
    }

    /* =========================================================
       Bind wizard nav
    ========================================================= */
    $("#wizardPrev")?.addEventListener("click", goPrev);
    $("#wizardNext")?.addEventListener("click", goNext);
    $("#heroStartBtn")?.addEventListener("click", () => {
      const firstSection = document.querySelector('[data-step="1"]');
      firstSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    /* =========================================================
       Service selection
    ========================================================= */
    $$(".service-card").forEach((card) => {
      card.addEventListener("click", () => {
        const svc = card.getAttribute("data-service");
        if (svc !== SERVICE.MOVE && svc !== SERVICE.CLEAN) return;
        state.activeService = svc;

        $$(".service-card").forEach((c) => c.classList.remove("is-active"));
        card.classList.add("is-active");

        const visible = computeVisibleSteps();
        const first = visible.findIndex((s) => {
          const t = getStepToken(s);
          return t !== 0 && t !== "service";
        });

        gotoStep(first >= 0 ? first : 0);
        renderAll();
      });
    });

    /* =========================================================
       Modal system (v3 hardened)
    ========================================================= */
    function syncModalBodyLock() {
      const opened = document.querySelectorAll('.modal.open').length;
      document.body.classList.toggle('modal-open', opened > 0);
    }

    function getWaypointNestedHost() {
      return document.getElementById('waypointNestedHost');
    }

    function mountNestedModalInWaypoint(id) {
      const m = document.getElementById(id);
      const host = getWaypointNestedHost();
      const waypointModal = document.getElementById('waypointSetupModal');
      if (!m || !host || !waypointModal || !waypointModal.classList.contains('open')) return false;
      if (!m.dataset.originalParentId && m.parentElement && m.parentElement.id) {
        m.dataset.originalParentId = m.parentElement.id;
      }
      if (!m.dataset.originalNextSiblingId) {
        const sib = m.nextElementSibling;
        if (sib && sib.id) m.dataset.originalNextSiblingId = sib.id;
      }
      host.appendChild(m);
      m.classList.add('nested-in-waypoint');
      waypointModal.classList.add('has-nested-modal');
      return true;
    }

    function unmountNestedModalFromWaypoint(id) {
      const m = document.getElementById(id);
      const waypointModal = document.getElementById('waypointSetupModal');
      if (!m || !m.classList.contains('nested-in-waypoint')) return false;

      const parentId = m.dataset.originalParentId || '';
      const nextId = m.dataset.originalNextSiblingId || '';
      const originalParent = parentId ? document.getElementById(parentId) : null;
      const nextSibling = nextId ? document.getElementById(nextId) : null;

      if (originalParent) {
        if (nextSibling && nextSibling.parentElement === originalParent) originalParent.insertBefore(m, nextSibling);
        else originalParent.appendChild(m);
      } else {
        document.body.appendChild(m);
      }

      m.classList.remove('nested-in-waypoint');
      if (waypointModal) {
        const stillNestedOpen = waypointModal.querySelector('.modal.nested-in-waypoint.open');
        if (!stillNestedOpen) waypointModal.classList.remove('has-nested-modal');
      }
      return true;
    }

    function openModal(id) {
      const m = document.getElementById(id);
      if (!m) return false;
      m.setAttribute("aria-hidden", "false");
      m.classList.add("open");
      syncModalBodyLock();
      return true;
    }

    function closeModal(id) {
      const m = document.getElementById(id);
      if (!m) return false;
      m.setAttribute("aria-hidden", "true");
      m.classList.remove("open");
      if (id === 'caseImageModal' && caseImageModalImg) {
        caseImageModalImg.removeAttribute('src');
        caseImageModalImg.removeAttribute('alt');
      }
      if (m.classList.contains('nested-in-waypoint')) unmountNestedModalFromWaypoint(id);
      syncModalBodyLock();
      return true;
    }

    function closeAllModals() {
      document.querySelectorAll('.modal.open').forEach((m) => {
        m.classList.remove('open');
        m.setAttribute('aria-hidden', 'true');
        if (m.classList.contains('nested-in-waypoint')) unmountNestedModalFromWaypoint(m.id);
      });
      syncModalBodyLock();
    }

    let itemsModalContext = "main";
    let throwModalContext = "main";

    function getItemsStateTarget() {
      return itemsModalContext === "waypoint" ? state.waypointItems : state.items;
    }

    function getItemsNoteTarget() {
      return itemsModalContext === "waypoint" ? "waypointItemsNote" : "itemsNote";
    }

    function getThrowStateTarget() {
      return throwModalContext === "waypoint" ? state.waypointThrow : null;
    }

    function resetItemsModalToMainContext() {
      itemsModalContext = "main";
      unmountNestedModalFromWaypoint("itemsModal");
      const waypointModal = document.getElementById('waypointSetupModal');
      if (waypointModal && !waypointModal.querySelector('.modal.nested-in-waypoint.open')) {
        waypointModal.classList.remove('has-nested-modal');
      }
      syncItemsModalFromState();
    }

    function resetThrowModalToMainContext() {
      throwModalContext = "main";
      unmountNestedModalFromWaypoint("throwModal");
      const waypointModal = document.getElementById('waypointSetupModal');
      if (waypointModal && !waypointModal.querySelector('.modal.nested-in-waypoint.open')) {
        waypointModal.classList.remove('has-nested-modal');
      }
      syncThrowModalFromState();
    }

    function syncItemsModalFromState() {
      const target = getItemsStateTarget();
      const noteKey = getItemsNoteTarget();
      const title = document.querySelector("#itemsModal .modal-title");
      if (title) title.textContent = itemsModalContext === "waypoint" ? "경유지 짐 선택" : "가구·가전 선택";

      document.querySelectorAll("#itemsModal .itemQty").forEach((inp) => {
        const item = inp.getAttribute("data-item");
        inp.value = String(toInt(target[item], 0));
      });

      const note = document.getElementById("itemsNote");
      if (note) {
        note.value = state[noteKey] || "";
        note.placeholder = itemsModalContext === "waypoint"
          ? "예) 경유지에서만 싣는 짐 / 잠깐 상차 후 다시 이동할 짐 / 현장 메모"
          : "예) TV 벽걸이 분리 필요 / 냉장고 문 분리 가능 / 엘베 예약 필요 / 주차 위치 등";
      }
    }

    function syncThrowModalFromState() {
      const title = document.querySelector("#throwModal .modal-title");
      const fromHeading = document.querySelector("#throwModal .throw-from-heading");
      const toBlock = document.getElementById("throwToBlock");
      const note = document.getElementById("throwNote");

      if (throwModalContext === "waypoint") {
        if (title) title.textContent = "경유지 버릴 물건 선택";
        if (fromHeading) fromHeading.textContent = "경유지 짐(수량)";
        if (toBlock) toBlock.hidden = true;
        document.querySelectorAll('#throwModal .throwQty[data-loc="from"]').forEach((inp) => {
          const item = inp.getAttribute("data-item");
          inp.value = String(toInt(state.waypointThrow[item], 0));
        });
        document.querySelectorAll('#throwModal .throwQty[data-loc="to"]').forEach((inp) => { inp.value = "0"; });
        if (note) {
          note.value = state.waypointThrowNote || "";
          note.placeholder = "예) 경유지에서 폐기할 짐 / 지정 위치 / 기사님 도착 전 연락 요청";
        }
      } else {
        if (title) title.textContent = "버릴 물건 선택";
        if (fromHeading) fromHeading.textContent = "출발지 짐(수량)";
        if (toBlock) toBlock.hidden = false;
        document.querySelectorAll('#throwModal .throwQty[data-loc="from"]').forEach((inp) => {
          const item = inp.getAttribute("data-item");
          inp.value = String(toInt(state.throwFrom[item], 0));
        });
        document.querySelectorAll('#throwModal .throwQty[data-loc="to"]').forEach((inp) => {
          const item = inp.getAttribute("data-item");
          inp.value = String(toInt(state.throwTo[item], 0));
        });
        if (note) {
          note.value = state.throwNote || "";
          note.placeholder = "예) 1층 분리수거장 위치 / 엘베 사용 불가 시간 / 폐기물 봉투 필요 여부 / 기사님 도착 전 연락 요청";
        }
      }
    }

    $$('[data-close]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-close");
        if (id) closeModal(id);
      });
    });

    $$(".modal-backdrop").forEach((bd) => {
      bd.addEventListener("click", (e) => {
        if (e.target !== bd) return;
        e.preventDefault();
        e.stopPropagation();
        const id = bd.getAttribute("data-close");
        if (id) closeModal(id);
      });
    });

    // NOTE:
    // .modal-backdrop 는 .modal-panel 의 형제 요소라서,
    // panel 내부 클릭이 backdrop 으로 전파될 일이 없음.
    // 여기서 stopPropagation()을 걸면 modal 내부 버튼(data-open-modal, 동적 data-close,
    // 이미지 확대 등)이 document 위임 리스너까지 도달하지 못해서 기능이 끊길 수 있다.
    // 그래서 panel 클릭은 막지 않고 그대로 두고, 실제 닫힘 제어는 backdrop/data-close 만 사용한다.

    function bindDirectModalOpeners() {
      $$('[data-open-modal]').forEach((btn) => {
        if (btn.dataset.modalOpenBound === '1') return;
        btn.dataset.modalOpenBound = '1';
        btn.addEventListener('click', (e) => {
          const targetId = btn.getAttribute('data-open-modal');
          if (!targetId) return;
          // direct opener + delegated document click 가 동시에 타면
          // 모달 컨텍스트가 두 번 바뀌거나 nested mount 상태가 꼬일 수 있음
          e.stopPropagation();

          const isWaypointItems = btn.id === 'openWaypointItemsModalBtn';
          const isWaypointThrow = btn.id === 'openWaypointThrowModalBtn';

          if (targetId === 'itemsModal') {
            if (isWaypointItems) {
              itemsModalContext = 'waypoint';
              syncItemsModalFromState();
              mountNestedModalInWaypoint(targetId);
            } else {
              resetItemsModalToMainContext();
            }
          }

          if (targetId === 'throwModal') {
            if (isWaypointThrow) {
              throwModalContext = 'waypoint';
              syncThrowModalFromState();
              mountNestedModalInWaypoint(targetId);
            } else {
              resetThrowModalToMainContext();
            }
          }

          if (targetId === 'waypointSetupModal') {
            syncWaypointSetupModal();
          }

          openModal(targetId);
          e.preventDefault();
        });
      });
    }

    bindDirectModalOpeners();

    document.addEventListener("click", (e) => {
      const openBtn = e.target.closest('[data-open-modal]');
      if (openBtn) {
        const targetId = openBtn.getAttribute('data-open-modal');
        const isWaypointItems = openBtn.id === 'openWaypointItemsModalBtn';
        const isWaypointThrow = openBtn.id === 'openWaypointThrowModalBtn';

        if (targetId === 'itemsModal') {
          itemsModalContext = isWaypointItems ? 'waypoint' : 'main';
          syncItemsModalFromState();
          if (isWaypointItems) mountNestedModalInWaypoint(targetId);
          else unmountNestedModalFromWaypoint(targetId);
        }
        if (targetId === 'throwModal') {
          throwModalContext = isWaypointThrow ? 'waypoint' : 'main';
          syncThrowModalFromState();
          if (isWaypointThrow) mountNestedModalInWaypoint(targetId);
          else unmountNestedModalFromWaypoint(targetId);
        }
        if (targetId === 'waypointSetupModal') {
          syncWaypointSetupModal();
        }
        openModal(targetId);
      }

      const closeBtn = e.target.closest('[data-close]');
      if (closeBtn) {
        const id = closeBtn.getAttribute('data-close');
        if (id) closeModal(id);
      }

      const zoomImg = e.target.closest('.case-image');
      if (zoomImg && caseImageModal && caseImageModalImg) {
        e.preventDefault();
        e.stopPropagation();
        caseImageModalImg.src = zoomImg.currentSrc || zoomImg.src || '';
        caseImageModalImg.alt = zoomImg.alt || '피해사례 이미지 확대';
        openModal('caseImageModal');
        return;
      }
    });

    document.addEventListener('click', (e) => {
      const itemStepperBtn = e.target.closest('.stepper-btn[data-stepper-item]:not([data-stepper-loc]):not([data-clean-group])');
      if (itemStepperBtn) {
        e.preventDefault();
        handleItemStepperButton(itemStepperBtn);
        return;
      }

      const throwStepperBtn = e.target.closest('.stepper-btn[data-stepper-loc][data-stepper-item]');
      if (throwStepperBtn) {
        e.preventDefault();
        handleThrowStepperButton(throwStepperBtn);
        return;
      }

      const mattressStepperBtn = e.target.closest('.stepper-btn[data-stepper-size]');
      if (mattressStepperBtn) {
        e.preventDefault();
        handleMattressStepperButton(mattressStepperBtn);
        return;
      }

      const cleanStepperBtn = e.target.closest('.stepper-btn[data-clean-group][data-clean-item]');
      if (cleanStepperBtn) {
        e.preventDefault();
        handleCleanStepperButton(cleanStepperBtn);
      }
    });

    document.addEventListener('input', (e) => {
      const itemQtyInput = e.target.closest('.itemQty');
      if (itemQtyInput) {
        handleItemQtyInput(itemQtyInput);
        return;
      }

      const throwQtyInput = e.target.closest('.throwQty');
      if (throwQtyInput) {
        handleThrowQtyInput(throwQtyInput);
        return;
      }

      const mattressSizeInput = e.target.closest('#mattressSizeModal input[data-size]');
      if (mattressSizeInput) {
        handleMattressSizeInput(mattressSizeInput);
        return;
      }

      const cleanQtyInput = e.target.closest('.cleanQty');
      if (cleanQtyInput) {
        handleCleanQtyInput(cleanQtyInput);
      }
    });

    document.addEventListener('change', (e) => {
      const itemQtyInput = e.target.closest('.itemQty');
      if (itemQtyInput) {
        handleItemQtyInput(itemQtyInput);
        return;
      }

      const throwQtyInput = e.target.closest('.throwQty');
      if (throwQtyInput) {
        handleThrowQtyInput(throwQtyInput);
        return;
      }

      const mattressSizeInput = e.target.closest('#mattressSizeModal input[data-size]');
      if (mattressSizeInput) {
        handleMattressSizeInput(mattressSizeInput);
        return;
      }

      const cleanQtyInput = e.target.closest('.cleanQty');
      if (cleanQtyInput) {
        handleCleanQtyInput(cleanQtyInput);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllModals();
    });

    // nested waypoint modals sometimes need direct close bindings on mobile Safari/Chrome
    document.querySelectorAll('#itemsModal [data-close="itemsModal"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal('itemsModal');
      });
    });
    document.querySelectorAll('#throwModal [data-close="throwModal"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal('throwModal');
      });
    });

    // main modal steppers can lose delegated clicks after waypoint modal nesting,
    // so bind them directly as a fallback as well.
    document.querySelectorAll('#itemsModal .stepper-btn[data-stepper-item]:not([data-stepper-loc]):not([data-clean-group])').forEach((btn) => {
      if (btn.dataset.directStepperBound === '1') return;
      btn.dataset.directStepperBound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        // 직접 바인딩 fallback 과 document 위임이 동시에 실행되면
        // + / - 가 1번 클릭에 2씩 증감되는 문제가 생김
        e.stopPropagation();
        handleItemStepperButton(btn);
      });
    });

    const caseImageModal = $("#caseImageModal");
    const caseImageModalImg = $("#caseImageModalImg");

    $$(".case-image").forEach((img) => {
      img.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!caseImageModal || !caseImageModalImg) return;
        caseImageModalImg.src = img.currentSrc || img.src || '';
        caseImageModalImg.alt = img.alt || '이미지 확대 보기';
        openModal('caseImageModal');
      });
    });

    /* =========================================================
       Waypoint setup modal
    ========================================================= */
    const waypointModal = $("#waypointSetupModal");
    const waypointStepLabel = $("#waypointModalStepLabel");
    const waypointPanels = $$(".waypoint-step-panel", waypointModal || document);
    const waypointPrevBtn = $("#waypointModalPrev");
    const waypointNextBtn = $("#waypointModalNext");
    const waypointFloorBody = $("#waypointFloorBody");
    const waypointLadderBody = $("#waypointLadderBody");
    const waypointFloorInput = $("#waypointFloor");
    const waypointLadderFloorInput = $("#waypointLadderFloor");
    let waypointModalStep = 0;
    const waypointStepTitles = [
      "1 / 4 · 경유지 짐양",
      "2 / 4 · 경유지 짐/버림 선택",
      "3 / 4 · 경유지 계단",
      "4 / 4 · 경유지 사다리차",
    ];

    function renderWaypointModalStep() {
      waypointPanels.forEach((panel, idx) => {
        panel.hidden = idx !== waypointModalStep;
      });
      if (waypointStepLabel) waypointStepLabel.textContent = waypointStepTitles[waypointModalStep] || "경유지 상세 설정";
      if (waypointPrevBtn) {
        waypointPrevBtn.textContent = waypointModalStep === 0 ? "닫기" : "이전";
      }
      if (waypointNextBtn) {
        waypointNextBtn.textContent = waypointModalStep >= waypointPanels.length - 1 ? "저장" : "다음";
      }
    }

    function syncWaypointSetupModal() {
      const loadValue = state.waypointLoadLevel == null ? null : String(state.waypointLoadLevel);
      $$('input[name="waypointLoad"]').forEach((input) => {
        input.checked = loadValue !== null && input.value === loadValue;
      });

      $$('input[name="waypointNoElevator"]').forEach((input) => {
        input.checked = input.value === (state.waypointNoElevator ? "1" : "0");
      });
      if (waypointFloorBody) waypointFloorBody.hidden = !state.waypointNoElevator;
      if (waypointFloorInput) waypointFloorInput.value = String(toInt(state.waypointFloor, 1));

      $$('input[name="waypointLadderEnabled"]').forEach((input) => {
        input.checked = input.value === (state.waypointLadderEnabled ? "1" : "0");
      });
      if (waypointLadderBody) waypointLadderBody.hidden = !state.waypointLadderEnabled;
      if (waypointLadderFloorInput) waypointLadderFloorInput.value = String(toInt(state.waypointLadderFloor, 6));

      waypointModalStep = 0;
      renderWaypointModalStep();
      renderAll();
    }

    function openWaypointSetupModal() {
      syncWaypointSetupModal();
      openModal("waypointSetupModal");
    }

    $("#openWaypointSetupModalBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openWaypointSetupModal();
    });

    waypointPrevBtn?.addEventListener("click", () => {
      if (waypointModalStep <= 0) {
        closeModal("waypointSetupModal");
        return;
      }
      waypointModalStep -= 1;
      renderWaypointModalStep();
    });

    waypointNextBtn?.addEventListener("click", () => {
      if (waypointModalStep >= waypointPanels.length - 1) {
        renderAll();
        closeModal("waypointSetupModal");
        return;
      }
      waypointModalStep += 1;
      renderWaypointModalStep();
    });

    $$('input[name="waypointLoad"]').forEach((input) => {
      input.addEventListener("change", (e) => {
        if (!e.target.checked) return;
        state.waypointLoadLevel = toInt(e.target.value, 0);
        renderAll();
      });
    });

    $$('input[name="waypointNoElevator"]').forEach((input) => {
      input.addEventListener("change", (e) => {
        if (!e.target.checked) return;
        state.waypointNoElevator = e.target.value === "1";
        if (waypointFloorBody) waypointFloorBody.hidden = !state.waypointNoElevator;
        renderAll();
      });
    });

    $$('input[name="waypointLadderEnabled"]').forEach((input) => {
      input.addEventListener("change", (e) => {
        if (!e.target.checked) return;
        state.waypointLadderEnabled = e.target.value === "1";
        if (waypointLadderBody) waypointLadderBody.hidden = !state.waypointLadderEnabled;
        renderAll();
      });
    });

    waypointModal?.querySelectorAll('.minus[data-target], .plus[data-target]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        const input = targetId ? document.getElementById(targetId) : null;
        if (!input) return;
        const delta = btn.classList.contains("minus") ? -1 : 1;
        const current = toInt(input.value, toInt(input.getAttribute("min"), 0));
        setStepperValue(input, current + delta);
      });
    });


    /* =========================================================
       Popup (season -> exit intent)
    ========================================================= */
    const seasonPopup = $("#seasonPopup");
    const popupToday = $("#popupToday");
    const popupGoQuote = $("#popupGoQuote");
    let popupArmed = false;
    let popupShown = false;
    let backGuardArmed = false;

    function popupKey() {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `ddlogi_popup_hide_${yyyy}${mm}${dd}`;
    }

    function shouldBlockToday() {
      try {
        return !!localStorage.getItem(popupKey());
      } catch (_) {
        return false;
      }
    }

    function isMobileViewport() {
      return window.matchMedia('(max-width: 900px)').matches || 'ontouchstart' in window;
    }

    function openSeasonPopup() {
      if (!seasonPopup || popupShown || !popupArmed || shouldBlockToday()) return;
      popupShown = true;
      seasonPopup.setAttribute("aria-hidden", "false");
      seasonPopup.classList.add("open");
    }

    function closeSeasonPopup() {
      if (!seasonPopup) return;
      seasonPopup.setAttribute("aria-hidden", "true");
      seasonPopup.classList.remove("open");
    }

    if (seasonPopup) {
      setTimeout(() => {
        popupArmed = true;

        if (!isMobileViewport()) {
          document.addEventListener('mouseout', (e) => {
            if (!popupArmed || popupShown || shouldBlockToday()) return;
            const to = e.relatedTarget || e.toElement;
            if (to) return;
            if (typeof e.clientY === 'number' && e.clientY <= 0) openSeasonPopup();
          });
        } else if (!backGuardArmed) {
          backGuardArmed = true;
          try {
            history.pushState({ ddlogiExitGuard: true }, '', location.href);
          } catch (_) {}

          window.addEventListener('popstate', () => {
            if (!popupArmed || popupShown || shouldBlockToday()) return;
            try {
              history.pushState({ ddlogiExitGuard: true }, '', location.href);
            } catch (_) {}
            openSeasonPopup();
          });
        }
      }, 5000);

      $$('[data-popup-close]').forEach((x) => x.addEventListener('click', closeSeasonPopup));

      popupGoQuote?.addEventListener('click', () => {
        closeSeasonPopup();
        const smsBtn = $("#smsShareBtn");
        if (smsBtn) {
          smsBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          $("#heroStartBtn")?.click();
        }
      });

      popupToday?.addEventListener('change', (e) => {
        if (e.target.checked) {
          try {
            localStorage.setItem(popupKey(), '1');
          } catch (_) {}
        } else {
          try {
            localStorage.removeItem(popupKey());
          } catch (_) {}
        }
      });
    }

    /* =========================================================
       Inputs binding (MOVE)
    ========================================================= */
    $$(".vehicle").forEach((v) => {
      v.addEventListener("click", () => {
        state.vehicle = v.getAttribute("data-vehicle") || "";
        $$(".vehicle").forEach((x) => x.classList.remove("selected"));
        v.classList.add("selected");
        renderAll();
      });
    });

    $("#startAddress")?.addEventListener("input", (e) => { state.startAddress = e.target.value.trim(); invalidateDistanceIfRouteChanged(); });
    $("#waypointAddress")?.addEventListener("input", (e) => { state.waypointAddress = e.target.value.trim(); invalidateDistanceIfRouteChanged(); });
    $("#endAddress")?.addEventListener("input", (e) => { state.endAddress = e.target.value.trim(); invalidateDistanceIfRouteChanged(); });

    $("#hasWaypoint")?.addEventListener("change", (e) => {
      state.hasWaypoint = !!e.target.checked;
      const wrap = $("#waypointWrap");
      if (wrap) wrap.style.display = state.hasWaypoint ? "" : "none";

      // waypoint on/off 전환 시 nested modal 상태가 남아 있으면
      // 메인 가구/가전 모달 클릭이 죽는 케이스가 있어서 항상 초기화
      closeModal("itemsModal");
      closeModal("throwModal");
      resetItemsModalToMainContext();
      resetThrowModalToMainContext();

      if (!state.hasWaypoint) {
        state.waypointAddress = "";
        state.waypointLoadLevel = null;
        state.waypointNoElevator = false;
        state.waypointFloor = 1;
        state.waypointLadderEnabled = false;
        state.waypointLadderFloor = 6;
        state.waypointItems = {};
        state.waypointItemsNote = "";
        state.waypointThrow = {};
        state.waypointThrowNote = "";
        closeModal("waypointSetupModal");
      }
      invalidateDistanceIfRouteChanged();
      renderAll();
    });

    let kakaoReady = false;
    function ensureKakaoReady(cb) {
      if (kakaoReady) return cb();
      if (!window.kakao || !window.kakao.maps) {
        alert("카카오맵 SDK 로딩에 실패했어. 잠깐 뒤 새로고침 해줘.");
        return;
      }
      window.kakao.maps.load(() => {
        kakaoReady = true;
        cb();
      });
    }

    function haversineKm(a, b) {
      const R = 6371;
      const toRad = (x) => (x * Math.PI) / 180;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);

      const s =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
      return R * c;
    }


    function currentRouteKey() {
      return JSON.stringify({
        start: (state.startAddress || "").trim(),
        waypoint: state.hasWaypoint ? (state.waypointAddress || "").trim() : "",
        end: (state.endAddress || "").trim(),
        hasWaypoint: !!state.hasWaypoint,
      });
    }

    function invalidateDistanceIfRouteChanged() {
      const nextKey = currentRouteKey();
      if (state.lastDistanceRouteKey && state.lastDistanceRouteKey !== nextKey) {
        state.distanceKm = 0;
      }
      if (!state.startAddress || !state.endAddress || (state.hasWaypoint && !state.waypointAddress)) {
        state.distanceKm = 0;
      }
      renderAll();
    }

    function geocode(geocoder, addr) {
      return new Promise((resolve, reject) => {
        if (!addr) return reject(new Error("empty address"));
        geocoder.addressSearch(addr, (result, status) => {
          if (status === window.kakao.maps.services.Status.OK && result && result[0]) {
            resolve({ lat: Number(result[0].y), lng: Number(result[0].x) });
          } else {
            reject(new Error("geocode failed"));
          }
        });
      });
    }

    async function calcDistanceKm() {
      const start = state.startAddress;
      const end = state.endAddress;
      const wp = state.hasWaypoint ? state.waypointAddress : "";

      if (!start || !end) {
        alert("출발지/도착지 주소를 입력해줘.");
        return;
      }
      if (state.hasWaypoint && !wp) {
        alert("경유지 체크했으면 경유지 주소도 입력해줘.");
        return;
      }

      const distanceText = $("#distanceText");
      if (distanceText) distanceText.textContent = "계산 중...";

      ensureKakaoReady(async () => {
        try {
          const geocoder = new window.kakao.maps.services.Geocoder();

          const a = await geocode(geocoder, start);
          const b = state.hasWaypoint ? await geocode(geocoder, wp) : null;
          const c = await geocode(geocoder, end);

          let base = 0;
          if (b) base = haversineKm(a, b) + haversineKm(b, c);
          else base = haversineKm(a, c);

          const roadish = base * 1.25;
          state.distanceKm = Math.max(0, Math.round(roadish * 10) / 10);
          state.lastDistanceRouteKey = currentRouteKey();

          if (distanceText) distanceText.textContent = `${state.distanceKm} km`;
          renderAll();
        } catch (e) {
          console.error(e);
          state.distanceKm = 0;
          state.lastDistanceRouteKey = "";
          if (distanceText) distanceText.textContent = "주소를 다시 확인해주세요";
          const hasDetail = isLikelyDetailedAddress(start) || isLikelyDetailedAddress(end) || (state.hasWaypoint && isLikelyDetailedAddress(wp));
          if (hasDetail) showAddressGuidePopup();
          else alert("거리 계산에 실패했어. 주소를 더 구체적으로 입력해줘 (도로명/건물명 추천).");
        }
      });
    }

    $("#calcDistance")?.addEventListener("click", calcDistanceKm);

    /* =========================================================
       Reservation bindings (common)
    ========================================================= */
    $("#moveDate")?.addEventListener("change", async (e) => {
      state.moveDate = e.target.value || "";
      await refreshTimeSlotAvailability();
      renderAll();
    });

    $$('input[name="timeSlot"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.timeSlot = String(e.target.value);
        renderAll();
      });
    });

    /* =========================================================
       Move type + storage
    ========================================================= */
    $$('input[name="moveType"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (!e.target.checked) return;
        state.moveType = e.target.value;
        setHidden($("#storageBody"), state.moveType !== "storage");
        renderAll();
      });
    });

    $$('input[name="storageBase"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.storageBase = e.target.value;
        renderAll();
      });
    });

    /* =========================================================
       Steppers (generic)
    ========================================================= */
    function setStepperValue(inputEl, nextVal) {
      if (!inputEl) return;
      const min = toInt(inputEl.getAttribute("min"), 0);
      const max = toInt(inputEl.getAttribute("max"), 999999);
      const v = clamp(toInt(nextVal, min), min, max);
      inputEl.value = String(v);
      const id = inputEl.id;

      if (id === "storageDays") state.storageDays = v;
      if (id === "fromFloor") state.fromFloor = v;
      if (id === "toFloor") state.toFloor = v;
      if (id === "ladderFromFloor") state.ladderFromFloor = v;
      if (id === "ladderToFloor") state.ladderToFloor = v;
      if (id === "ride") state.ride = v;
      if (id === "waypointFloor") state.waypointFloor = v;
      if (id === "waypointLadderFloor") state.waypointLadderFloor = v;

      if (id === "cleanPyeong" || id === "moveCleanPyeong") state.cleanPyeong = v;
      if (id === "cleanRooms" || id === "moveCleanRooms") state.cleanRooms = v;
      if (id === "cleanBaths" || id === "moveCleanBaths") state.cleanBaths = v;
      if (id === "cleanBalconies" || id === "moveCleanBalconies") state.cleanBalconies = v;
      if (id === "cleanWardrobes" || id === "moveCleanWardrobes") state.cleanWardrobes = v;
      if (id === "cleanFloor" || id === "moveCleanFloor") state.cleanFloor = v;
      if (id === "cleanOuterWindowPyeong" || id === "moveCleanOuterWindowPyeong") state.cleanOuterWindowPyeong = v;
      if (id === "cleanTrashBags" || id === "moveCleanTrashBags") state.cleanTrashBags = v;

      renderAll();
    }

    $$(".stepper-btn[data-stepper]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-stepper");
        const dir = toInt(btn.getAttribute("data-dir"), 0);
        const input = document.getElementById(id);
        if (!input) return;
        const cur = toInt(input.value, toInt(input.getAttribute("min"), 0));
        setStepperValue(input, cur + dir);
      });
    });

    [
      "storageDays",
      "fromFloor",
      "toFloor",
      "ladderFromFloor",
      "ladderToFloor",
      "ride",
      "waypointFloor",
      "waypointLadderFloor",
      "cleanPyeong",
      "cleanRooms",
      "cleanBaths",
      "cleanBalconies",
      "cleanWardrobes",
      "cleanFloor",
      "cleanOuterWindowPyeong",
      "cleanTrashBags",
      "moveCleanPyeong",
      "moveCleanRooms",
      "moveCleanBaths",
      "moveCleanBalconies",
      "moveCleanWardrobes",
      "moveCleanFloor",
      "moveCleanOuterWindowPyeong",
      "moveCleanTrashBags",
    ].forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener("input", (e) => setStepperValue(el, e.target.value));
    });

    /* =========================================================
       Elevator toggles (move)
    ========================================================= */
    $("#noFrom")?.addEventListener("change", (e) => {
      state.noFrom = !!e.target.checked;
      renderAll();
    });
    $("#noTo")?.addEventListener("change", (e) => {
      state.noTo = !!e.target.checked;
      renderAll();
    });

    /* =========================================================
       Load radio (move)
    ========================================================= */
    $$('input[name="load"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.loadLevel = toInt(e.target.value, 0);
        renderAll();
      });
    });

    /* =========================================================
       Cant carry / helpers (move)
    ========================================================= */
    $("#cantCarryFrom")?.addEventListener("change", (e) => {
      state.cantCarryFrom = !!e.target.checked;
      renderAll();
    });
    $("#cantCarryTo")?.addEventListener("change", (e) => {
      state.cantCarryTo = !!e.target.checked;
      renderAll();
    });

    $("#helperFrom")?.addEventListener("change", (e) => {
      state.helperFrom = !!e.target.checked;
      renderAll();
    });
    $("#helperTo")?.addEventListener("change", (e) => {
      state.helperTo = !!e.target.checked;
      renderAll();
    });

    /* =========================================================
       Ladder toggles (move)
    ========================================================= */
    $("#ladderFromEnabled")?.addEventListener("change", (e) => {
      state.ladderFromEnabled = !!e.target.checked;
      setHidden($("#ladderFromBody"), !state.ladderFromEnabled);
      renderAll();
    });
    $("#ladderToEnabled")?.addEventListener("change", (e) => {
      state.ladderToEnabled = !!e.target.checked;
      setHidden($("#ladderToBody"), !state.ladderToEnabled);
      renderAll();
    });

    /* =========================================================
       Extra options (move)
    ========================================================= */
    $("#night")?.addEventListener("change", (e) => {
      state.night = !!e.target.checked;
      renderAll();
    });

    const cleaningToggleEl = $("#cleaningToggle");
    if (cleaningToggleEl) {
      cleaningToggleEl.checked = false;
      cleaningToggleEl.disabled = false;
      cleaningToggleEl.addEventListener("change", (e) => {
        state.cleaningToggle = !!e.target.checked;
        setHidden($("#cleaningBody"), !state.cleaningToggle);
        renderAll();
      });
    }
    state.cleaningToggle = false;
    state.cleaningFrom = false;
    state.cleaningTo = false;
    state.cleaningType = "light";

    /* =========================================================
       Throw toggle (move)
    ========================================================= */
    $("#throwToggle")?.addEventListener("change", (e) => {
      state.throwToggle = !!e.target.checked;
      const wrap = $("#throwMiniWrap");
      if (wrap) wrap.style.display = state.throwToggle ? "" : "none";
      renderAll();
    });

    $("#workFrom")?.addEventListener("change", (e) => {
      state.workFrom = !!e.target.checked;
      renderAll();
    });
    $("#workTo")?.addEventListener("change", (e) => {
      state.workTo = !!e.target.checked;
      renderAll();
    });

    /* =========================================================
       Items modal steppers (move items)
    ========================================================= */
    function setItemQty(itemKey, qty) {
      const k = safeText(itemKey);
      const q = Math.max(0, toInt(qty, 0));
      if (!k) return;
      const target = getItemsStateTarget();
      if (q <= 0) delete target[k];
      else target[k] = q;

      if (itemsModalContext === "main" && k === "침대매트리스(킹제외)") {
        const total = q;
        const sumSizes = Object.values(state.mattressSizes).reduce((a, b) => a + toInt(b, 0), 0);
        if (total > 0 && sumSizes === 0) openModal("mattressSizeModal");

        if (sumSizes > total) {
          state.mattressSizes.S = 0;
          state.mattressSizes.SS = 0;
          state.mattressSizes.D = 0;
          state.mattressSizes.Q = 0;
        }
      }
    }

    function handleItemStepperButton(btn) {
      const item = btn?.getAttribute("data-stepper-item");
      const dir = toInt(btn?.getAttribute("data-dir"), 0);
      if (!item || !dir) return false;
      const modal = btn.closest(".modal") || document;
      const inp = modal.querySelector('.itemQty[data-item="' + item + '"]');
      if (!inp) return false;
      const cur = toInt(inp.value, 0);
      const next = Math.max(0, cur + dir);
      inp.value = String(next);
      setItemQty(item, next);
      renderAll();
      return true;
    }

    function handleItemQtyInput(inp) {
      const item = inp?.getAttribute("data-item");
      if (!item) return false;
      const next = Math.max(0, toInt(inp.value, 0));
      inp.value = String(next);
      setItemQty(item, next);
      renderAll();
      return true;
    }

    // item modal controls are handled by delegated listeners below

    $("#itemsNote")?.addEventListener("input", (e) => {
      state[getItemsNoteTarget()] = e.target.value || "";
      renderAll();
    });

    /* =========================================================
       Mattress size modal (optional)
    ========================================================= */
    function totalMattressQty() {
      return toInt(state.items["침대매트리스(킹제외)"], 0);
    }

    function setMattressSize(sizeKey, qty) {
      const key = String(sizeKey);
      const v = Math.max(0, toInt(qty, 0));
      state.mattressSizes[key] = v;

      const total = totalMattressQty();
      const sum = Object.values(state.mattressSizes).reduce((a, b) => a + toInt(b, 0), 0);
      if (sum > total) {
        state.mattressSizes[key] = Math.max(0, v - (sum - total));
      }
    }

    function handleMattressStepperButton(btn) {
      const size = btn?.getAttribute("data-stepper-size");
      const dir = toInt(btn?.getAttribute("data-dir"), 0);
      if (!size || !dir) return false;
      const inp = document.querySelector('#mattressSizeModal input[data-size="' + size + '"]');
      if (!inp) return false;
      const cur = toInt(inp.value, 0);
      const next = Math.max(0, cur + dir);
      inp.value = String(next);
      setMattressSize(size, next);
      renderAll();
      return true;
    }

    function handleMattressSizeInput(inp) {
      const size = inp?.getAttribute("data-size");
      if (!size) return false;
      const next = Math.max(0, toInt(inp.value, 0));
      inp.value = String(next);
      setMattressSize(size, next);
      renderAll();
      return true;
    }

    // mattress modal controls are handled by delegated listeners below

    /* =========================================================
       Throw modal steppers
    ========================================================= */
    function setThrowQty(loc, itemKey, qty) {
      const where = loc === "to" ? "to" : "from";
      const k = safeText(itemKey);
      const q = Math.max(0, toInt(qty, 0));
      if (!k) return;

      let target;
      if (throwModalContext === "waypoint") {
        target = state.waypointThrow;
      } else {
        target = where === "to" ? state.throwTo : state.throwFrom;
      }
      if (q <= 0) delete target[k];
      else target[k] = q;
    }

    function handleThrowStepperButton(btn) {
      const loc = btn?.getAttribute("data-stepper-loc");
      const item = btn?.getAttribute("data-stepper-item");
      const dir = toInt(btn?.getAttribute("data-dir"), 0);
      if (!loc || !item || !dir) return false;
      const modal = btn.closest(".modal") || document;
      const inp = modal.querySelector(
        '.throwQty[data-loc="' + loc + '"][data-item="' + item + '"]'
      );
      if (!inp) return false;
      const cur = toInt(inp.value, 0);
      const next = Math.max(0, cur + dir);
      inp.value = String(next);
      setThrowQty(loc, item, next);
      renderAll();
      return true;
    }

    function handleThrowQtyInput(inp) {
      const loc = inp?.getAttribute("data-loc");
      const item = inp?.getAttribute("data-item");
      if (!loc || !item) return false;
      const next = Math.max(0, toInt(inp.value, 0));
      inp.value = String(next);
      setThrowQty(loc, item, next);
      renderAll();
      return true;
    }

    // throw modal controls are handled by delegated listeners below

    $("#throwNote")?.addEventListener("input", (e) => {
      if (throwModalContext === "waypoint") state.waypointThrowNote = e.target.value || "";
      else state.throwNote = e.target.value || "";
      renderAll();
    });

    /* =========================================================
       CLEAN bindings
    ========================================================= */
    $$('input[name="cleanType"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.cleanType = e.target.value;
        renderAll();
      });
    });

    $$('input[name="cleanSoil"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.cleanSoil = e.target.value;
        renderAll();
      });
    });

    $$('input[name="moveCleanType"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.cleanType = e.target.value;
        renderAll();
      });
    });

    $$('input[name="moveCleanSoil"]').forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.cleanSoil = e.target.value;
        renderAll();
      });
    });

    $("#moveCleanAddress")?.addEventListener("input", (e) => {
      state.cleanAddress = (e.target.value || "").trim();
      renderAll();
    });
    $("#moveCleanAddressNote")?.addEventListener("input", (e) => {
      state.cleanAddressNote = e.target.value || "";
      renderAll();
    });
    $("#moveCleanParkingHard")?.addEventListener("change", (e) => {
      state.cleanParkingHard = !!e.target.checked;
      renderAll();
    });
    $("#moveCleanNoElevator")?.addEventListener("change", (e) => {
      state.cleanNoElevator = !!e.target.checked;
      renderAll();
    });
    $("#moveCleanOuterWindowEnabled")?.addEventListener("change", (e) => {
      state.cleanOuterWindowEnabled = !!e.target.checked;
      setHidden($("#moveCleanOuterWindowBody"), !state.cleanOuterWindowEnabled);
      renderAll();
    });
    $("#moveCleanPhytoncideEnabled")?.addEventListener("change", (e) => {
      state.cleanPhytoncideEnabled = !!e.target.checked;
      renderAll();
    });
    $("#moveCleanDisinfectEnabled")?.addEventListener("change", (e) => {
      state.cleanDisinfectEnabled = !!e.target.checked;
      renderAll();
    });
    $("#moveCleanNote")?.addEventListener("input", (e) => {
      state.cleanNote = e.target.value || "";
      const prev = $("#moveCleanNotePreview");
      if (prev) prev.textContent = `기타사항: ${state.cleanNote.trim() ? state.cleanNote.trim() : "없음"}`;
      renderAll();
    });

    $("#cleanAddress")?.addEventListener("input", (e) => {
      state.cleanAddress = (e.target.value || "").trim();
      renderAll();
    });
    $("#cleanAddressNote")?.addEventListener("input", (e) => {
      state.cleanAddressNote = e.target.value || "";
      renderAll();
    });

    $("#cleanParkingHard")?.addEventListener("change", (e) => {
      state.cleanParkingHard = !!e.target.checked;
      renderAll();
    });
    $("#cleanNoElevator")?.addEventListener("change", (e) => {
      state.cleanNoElevator = !!e.target.checked;
      renderAll();
    });

    $("#cleanOuterWindowEnabled")?.addEventListener("change", (e) => {
      state.cleanOuterWindowEnabled = !!e.target.checked;
      setHidden($("#cleanOuterWindowBody"), !state.cleanOuterWindowEnabled);
      renderAll();
    });

    $("#cleanPhytoncideEnabled")?.addEventListener("change", (e) => {
      state.cleanPhytoncideEnabled = !!e.target.checked;
      renderAll();
    });
    $("#cleanDisinfectEnabled")?.addEventListener("change", (e) => {
      state.cleanDisinfectEnabled = !!e.target.checked;
      renderAll();
    });

    $("#cleanNote")?.addEventListener("input", (e) => {
      state.cleanNote = e.target.value || "";
      const prev = $("#cleanNotePreview");
      if (prev) prev.textContent = `기타사항: ${state.cleanNote.trim() ? state.cleanNote.trim() : "없음"}`;
      renderAll();
    });

    function setCleanQty(group, item, qty) {
      const g = group === "appliance" ? "appliance" : "basic";
      const k = safeText(item);
      const q = Math.max(0, toInt(qty, 0));
      const target = g === "appliance" ? state.cleanAppliance : state.cleanBasic;
      if (!k) return;
      if (q <= 0) delete target[k];
      else target[k] = q;
    }

    function handleCleanStepperButton(btn) {
      const group = btn?.getAttribute("data-clean-group");
      const item = btn?.getAttribute("data-clean-item");
      const dir = toInt(btn?.getAttribute("data-dir"), 0);
      if (!group || !item || !dir) return false;
      const modal = btn.closest(".modal") || document;
      const inp = modal.querySelector(
        '.cleanQty[data-clean-group="' + group + '"][data-clean-item="' + item + '"]'
      );
      if (!inp) return false;
      const cur = toInt(inp.value, 0);
      const next = Math.max(0, cur + dir);
      inp.value = String(next);
      setCleanQty(group, item, next);
      renderAll();
      return true;
    }

    function handleCleanQtyInput(inp) {
      const group = inp?.getAttribute("data-clean-group");
      const item = inp?.getAttribute("data-clean-item");
      if (!group || !item) return false;
      const next = Math.max(0, toInt(inp.value, 0));
      inp.value = String(next);
      setCleanQty(group, item, next);
      renderAll();
      return true;
    }

    // cleaning modal controls are handled by delegated listeners below

    /* =========================================================
       Storage fee model
    ========================================================= */
    function calcStorageFee(days) {
      const d = Math.max(1, toInt(days, 1));
      const day1 = 20000;
      const day2to30 = 12000;
      let fee = day1 + Math.max(0, Math.min(d, 30) - 1) * day2to30;
      if (d >= 30) fee = 370000; // ✅ 상한
      return fee;
    }

    /* =========================================================
       Pricing model
    ========================================================= */
    function moveBaseByVehicle(vehicle) {
      if (vehicle.includes("저상탑") && vehicle.includes("카고")) return 95000;
      if (vehicle.includes("저상탑")) return 50000;
      if (vehicle.includes("카고")) return 50000;
      return 0;
    }

    function moveDistanceFee(km) {
      const d = Math.max(0, toNum(km, 0));
      const a = Math.min(d, 10) * 2000;
      const b = Math.max(0, d - 10) * 1550;
      return a + b;
    }

    function moveLoadFee(level) {
      const map = { 1: 10000, 2: 23000, 3: 40000, 4: 66000 };
      return map[level] ?? 0;
    }

    function stairsFee(noElevator, floor) {
      if (!noElevator) return 0;
      const f = Math.max(1, toInt(floor, 1));
      return Math.max(0, f - 1) * 10000;
    }

    function helperFee(helper) {
      return helper ? 40000 : 0;
    }

    function cantCarryFee(flag) {
      return flag ? 30000 : 0;
    }

    function ladderFee(enabled, floor) {
      if (!enabled) return 0;
      const f = Math.max(1, toInt(floor, 1));
      if (f <= 6) return 110000;
      if (f <= 12) return 140000;
      return 160000;
    }

    function rideFee(n) {
      const x = Math.max(0, toInt(n, 0));
      return x * 20000;
    }

    function moveCleaningFee() {
      if (!state.cleaningToggle) return 0;
      const unit = state.cleaningType === "deep" ? 60000 : 30000;
      let fee = 0;
      if (state.cleaningFrom) fee += unit;
      if (state.cleaningTo) fee += unit;
      return fee;
    }

   function itemsFee(items) {
  let fee = 0;
  const obj = items || {};

  // ✅ 가전·가구 가격표 (필요시 단가 조정 가능)
  const PRICE = {
    // 가전
    "전자레인지": 2500,
    "공기청정기": 5000,
    "청소기": 5000,
    "TV(55이하)": 15000,
    "TV(65이상)": 30000,
    "모니터": 5000,
    "데스크탑": 5000,
    "프린터": 5000,
    "정수기(이동만)": 10000,

    "세탁기(12kg이하)": 30000,
    "세탁기(12kg초과)": 70000,
    "건조기(12kg이하)": 30000,
    "건조기(12kg초과)": 70000,

    "냉장고(380L이하)": 30000,
    "냉장고(600L이하)": 70000,
    "냉장고(600L초과)": 120000,

    "김치냉장고": 50000,
    "스타일러": 120000,

    // 가구
    "의자": 2500,
    "행거": 5000,
    "협탁/사이드테이블(소형)": 10000,
    "화장대(소형)": 10000,
    "책상/테이블(일반)": 10000,
    "서랍장(3~5단)": 10000,
    "책장(일반)": 20000,
    "수납장/TV장(일반)": 20000,

    "소파(2~3인)": 30000,
    "소파(4인이상)": 50000,

    // 침대
    "침대매트리스(킹제외)": 20000,
    "침대프레임(분해/조립)": 40000,
    "기타가전가구(분해/조립)": 20000
  };

  // 항목별 합산
  for (const [rawKey, qtyRaw] of Object.entries(obj)) {
    const k = normalizeItemKey(rawKey);
    const q = toInt(qtyRaw, 0);
    if (q <= 0) continue;
    const unit = PRICE[k] ?? 0;
    fee += unit * q;
  }

  // 매트리스 사이즈별 추가요금(퀸, 킹)
  const m = toInt(obj["침대매트리스(킹제외)"], 0) || toInt(obj[normalizeItemKey("침대 매트리스 (킹 제외)")], 0);
  if (m > 0) {
    const sizes = state.mattressSizes || {};
    fee += toInt(sizes.Q, 0) * 5000;
    fee += toInt(sizes.K, 0) * 10000;
  }

  return fee;
}

    function waypointItemsFeeTotal() {
      if (!state.hasWaypoint) return 0;
      return itemsFee(state.waypointItems);
    }

    function waypointLoadFeeTotal() {
      if (!state.hasWaypoint || state.waypointLoadLevel == null) return 0;
      return moveLoadFee(state.waypointLoadLevel);
    }

    function waypointCarryFeeTotal() {
      if (!state.hasWaypoint) return 0;
      return stairsFee(state.waypointNoElevator, state.waypointFloor);
    }

    function waypointLadderFeeTotal() {
      if (!state.hasWaypoint) return 0;
      return ladderFee(state.waypointLadderEnabled, state.waypointLadderFloor);
    }

    function throwFeeTotal() {
      let total = 0;
      if (state.throwToggle) {
        const base = (state.workFrom ? 20000 : 0) + (state.workTo ? 20000 : 0);
        const sumFrom = Object.values(state.throwFrom).reduce((a, b) => a + toInt(b, 0), 0);
        const sumTo = Object.values(state.throwTo).reduce((a, b) => a + toInt(b, 0), 0);
        total += base + (sumFrom + sumTo) * 5000;
      }
      if (state.hasWaypoint) {
        const wpSum = Object.values(state.waypointThrow).reduce((a, b) => a + toInt(b, 0), 0);
        total += wpSum * 5000;
      }
      return total;
    }

    function calcMovePrice() {
  if (!state.vehicle) return 0;

  const base = moveBaseByVehicle(state.vehicle);
  const load = moveLoadFee(state.loadLevel) + waypointLoadFeeTotal();

  const stairs =
    stairsFee(state.noFrom, state.fromFloor) +
    stairsFee(state.noTo, state.toFloor) +
    waypointCarryFeeTotal();

  const cantCarry =
    cantCarryFee(state.cantCarryFrom) +
    cantCarryFee(state.cantCarryTo);

  const helpers =
    helperFee(state.helperFrom) +
    helperFee(state.helperTo);

  // ✅ 작업비 덩어리(배율 대상)
  let workSubtotal = base + load + stairs + cantCarry + helpers;

  // ✅ 배율 제외(거리/사다리/동승/가전/폐기/청소옵션/보관비 등)
  const distance = moveDistanceFee(state.distanceKm);

  const ladders =
    ladderFee(state.ladderFromEnabled, state.ladderFromFloor) +
    ladderFee(state.ladderToEnabled, state.ladderToFloor) +
    waypointLadderFeeTotal();

  const ride = rideFee(state.ride);
  const cleanOpt = moveCleaningFee();
  const items = itemsFee(state.items) + waypointItemsFeeTotal();
  // ensure item cost applied
  const itemsCost = items;

  const throwFee = throwFeeTotal();

  let storageFee = 0;
  if (state.moveType === "storage") {
    storageFee = calcStorageFee(state.storageDays);
  }

  // ✅ 반포장 배율(작업비에만)
  const HALF_MULT = 1.36;
  const isHalf =
    (state.moveType === "half") ||
    (state.moveType === "storage" && state.storageBase === "half");

  if (isHalf) workSubtotal *= HALF_MULT;

  // 보관이사는 "출발지 → 보관창고" + "보관창고 → 도착지" 2회 이동으로 계산
  // 따라서 이동 견적 덩어리를 2배 적용하고, 보관 일수 비용은 별도로 더한다.
  let moveOnlyPrice =
    workSubtotal +
    distance +
    ladders +
    ride +
    cleanOpt +
    items +
    throwFee;

  if (state.moveType === "storage") {
    moveOnlyPrice *= 2;
  }

  let price = moveOnlyPrice + storageFee;

  price *= PRICE_MULTIPLIER;
  return price;
}

    function cleanBasePrice() {
      const p = Math.max(1, toInt(state.cleanPyeong, 9));
      const typeMul =
        state.cleanType === "moveout" ? 1.05 : state.cleanType === "occupied" ? 1.15 : 1.0;
      const soilMul =
        state.cleanSoil === "heavy" ? 1.2 : state.cleanSoil === "normal" ? 1.1 : 1.0;
      const per = 11000;
      return p * per * typeMul * soilMul;
    }

    function cleanOptionPrice() {
      let fee = 0;
      if (state.cleanParkingHard) fee += 10000;
      if (state.cleanNoElevator) fee += Math.max(0, toInt(state.cleanFloor, 1) - 1) * 7000;
      if (state.cleanOuterWindowEnabled) fee += Math.max(0, toInt(state.cleanOuterWindowPyeong, 0)) * 8000;
      if (state.cleanPhytoncideEnabled) fee += 30000;
      if (state.cleanDisinfectEnabled) fee += 30000;
      fee += Math.max(0, toInt(state.cleanTrashBags, 0)) * 2000;
      fee += Math.max(0, toInt(state.cleanWardrobes, 0)) * 8000;
      fee += Math.max(0, toInt(state.cleanRooms, 1) - 1) * 7000;
      fee += Math.max(0, toInt(state.cleanBaths, 1) - 1) * 12000;
      fee += Math.max(0, toInt(state.cleanBalconies, 0)) * 5000;

      const basic = state.cleanBasic || {};
      const appliance = state.cleanAppliance || {};

      fee += toInt(basic["곰팡이제거"], 0) * 15000;
      fee += toInt(basic["스티커제거"], 0) * 10000;
      fee += toInt(basic["페인트잔여"], 0) * 15000;
      fee += toInt(basic["니코틴케어"], 0) * 25000;
      fee += toInt(basic["반려동물케어"], 0) * 25000;
      fee += toInt(basic["피톤치드(평)"], 0) * 3000;

      fee += toInt(appliance["에어컨(벽걸이)"], 0) * 70000;
      fee += toInt(appliance["에어컨(스탠드)"], 0) * 90000;
      fee += toInt(appliance["에어컨(천장1way)"], 0) * 120000;
      fee += toInt(appliance["에어컨(천장4way)"], 0) * 150000;
      fee += toInt(appliance["세탁기청소"], 0) * 60000;
      fee += toInt(appliance["건조기청소"], 0) * 60000;
      fee += toInt(appliance["냉장고청소"], 0) * 70000;
      fee += toInt(appliance["후드청소"], 0) * 50000;
      fee += toInt(appliance["매트리스청소"], 0) * 40000;
      fee += toInt(appliance["소파청소"], 0) * 50000;
      fee += toInt(appliance["비데청소"], 0) * 30000;

      return fee;
    }

    function calcCleanDisplayPrice() {
      return calcCleanPrice() * DISPLAY_MULTIPLIER;
    }

    function calcCleanDeposit() {
      return Math.round(calcCleanDisplayPrice() * 0.2);
    }

    function calcCleanBalance() {
      return Math.max(0, calcCleanDisplayPrice() - calcCleanDeposit());
    }

    function calcCleanPrice() {
      let price = 0;
      price += cleanBasePrice();
      price += cleanOptionPrice();
      price *= PRICE_MULTIPLIER;
      return price;
    }

    function calcCurrentPrice() {
      if (state.activeService === SERVICE.MOVE) return calcMovePrice();
      if (state.activeService === SERVICE.CLEAN) return calcCleanPrice();
      return 0;
    }

    /* =========================================================
       Summaries helpers  (✅ 여기로 빼서 문법 깨짐 방지)
    ========================================================= */
    function summarizeDict(obj) {
      const entries = Object.entries(obj || {}).filter(([, v]) => toInt(v, 0) > 0);
      if (!entries.length) return "선택 없음";
      // ✅ 요약에서 "외 N개"로 잘라내지 않고, 선택한 항목을 전부 보여줍니다.
      return entries.map(([k, v]) => `${k}×${toInt(v, 0)}`).join(", ");
    }

    function summarizeMattressSizes() {
      const sizes = state.mattressSizes || {};
      const order = ["S", "SS", "D", "Q", "K"];
      const parts = order
        .map((k) => (toInt(sizes[k], 0) > 0 ? `${k}×${toInt(sizes[k], 0)}` : null))
        .filter(Boolean);
      return parts.length ? `(${parts.join(", ")})` : "";
    }

    function summarizeItemsWithMattress(itemsObj) {
      const obj = itemsObj || {};
      const entries = Object.entries(obj).filter(([, v]) => toInt(v, 0) > 0);
      if (!entries.length) return "선택 없음";

      // ✅ "외 N개"로 잘라내지 않고, 선택한 항목을 전부 보여줍니다.
      const all = entries
        .map(([k, v]) => {
          const qty = toInt(v, 0);
          if (k === "침대매트리스(킹제외)") {
            const sizesText = summarizeMattressSizes();
            return sizesText ? `${k}×${qty} ${sizesText}` : `${k}×${qty}`;
          }
          return `${k}×${qty}`;
        })
        .join(", ");

      return all;
    }

    /* =========================================================
       Mini summaries + main summary
    ========================================================= */
    function renderMiniSummaries() {
      const itemsMini = $("#itemsMiniSummary");
      if (itemsMini) itemsMini.textContent = summarizeItemsWithMattress(state.items);

      const itemsNotePrev = $("#itemsNotePreview");
      if (itemsNotePrev) itemsNotePrev.textContent = `기타사항: ${state.itemsNote.trim() ? state.itemsNote.trim() : "없음"}`;

      const loadMap = { 0: "없음", 1: "1~5개", 2: "6~10개", 3: "11~15개", 4: "16~20개" };
      const waypointLoadText = state.waypointLoadLevel === null ? "선택 없음" : (loadMap[state.waypointLoadLevel] || "선택 없음");
      const waypointItemsText = summarizeItemsWithMattress(state.waypointItems);
      const waypointItemsNoteText = `경유지 짐 기타사항: ${state.waypointItemsNote.trim() ? state.waypointItemsNote.trim() : "없음"}`;
      const waypointThrowText = `경유지 버려주세요: ${summarizeDict(state.waypointThrow)}`;
      const waypointThrowNoteText = `경유지 버려주세요 기타사항: ${state.waypointThrowNote.trim() ? state.waypointThrowNote.trim() : "없음"}`;

      [$("#waypointLoadMiniSummary")].filter(Boolean).forEach((el) => el.textContent = `경유지 짐양: ${waypointLoadText}`);
      [$("#waypointItemsMiniSummary"), $("#waypointItemsMiniSummaryModal")].filter(Boolean).forEach((el) => el.textContent = `경유지 가구·가전: ${waypointItemsText}`);
      [$("#waypointItemsNotePreview"), $("#waypointItemsNotePreviewModal")].filter(Boolean).forEach((el) => el.textContent = waypointItemsNoteText);
      [$("#waypointThrowMiniSummary"), $("#waypointThrowMiniSummaryModal")].filter(Boolean).forEach((el) => el.textContent = waypointThrowText);
      [$("#waypointThrowNotePreview"), $("#waypointThrowNotePreviewModal")].filter(Boolean).forEach((el) => el.textContent = waypointThrowNoteText);

      const waypointCarryMini = $("#waypointCarryMiniSummary");
      if (waypointCarryMini) waypointCarryMini.textContent = `경유지 계단: ${state.waypointNoElevator ? `엘리베이터 없음 (${state.waypointFloor}층)` : "엘리베이터 있음"}`;

      const waypointLadderMini = $("#waypointLadderMiniSummary");
      if (waypointLadderMini) waypointLadderMini.textContent = `경유지 사다리차: ${state.waypointLadderEnabled ? `${state.waypointLadderFloor}층` : "불필요"}`;

      const throwMini = $("#throwMiniSummary");
      if (throwMini) {
        const from = summarizeDict(state.throwFrom);
        const to = summarizeDict(state.throwTo);
        if (from === "선택 없음" && to === "선택 없음") throwMini.textContent = "선택 없음";
        else throwMini.textContent = `출발: ${from} / 도착: ${to}`;
      }

      const throwNotePrev = $("#throwNotePreview");
      if (throwNotePrev) throwNotePrev.textContent = `기타사항: ${state.throwNote.trim() ? state.throwNote.trim() : "없음"}`;

      const cleanBasicMini = $("#cleanBasicMiniSummary");
      if (cleanBasicMini) cleanBasicMini.textContent = summarizeDict(state.cleanBasic);
      const moveCleanBasicMini = $("#moveCleanBasicMiniSummary");
      if (moveCleanBasicMini) moveCleanBasicMini.textContent = summarizeDict(state.cleanBasic);

      const cleanApplianceMini = $("#cleanApplianceMiniSummary");
      if (cleanApplianceMini) cleanApplianceMini.textContent = summarizeDict(state.cleanAppliance);
      const moveCleanApplianceMini = $("#moveCleanApplianceMiniSummary");
      if (moveCleanApplianceMini) moveCleanApplianceMini.textContent = summarizeDict(state.cleanAppliance);

      const cleanNotePrev = $("#cleanNotePreview");
      if (cleanNotePrev) cleanNotePrev.textContent = `기타사항: ${state.cleanNote.trim() ? state.cleanNote.trim() : "없음"}`;
      const moveCleanNotePrev = $("#moveCleanNotePreview");
      if (moveCleanNotePrev) moveCleanNotePrev.textContent = `기타사항: ${state.cleanNote.trim() ? state.cleanNote.trim() : "없음"}`;
    }

    function buildSummaryText() {
      const svc = state.activeService;
      if (!svc) return "조건을 선택하세요";

      if (svc === SERVICE.MOVE) {
        const lines = [];
        lines.push(`서비스: 이사·용달`);
        if (state.vehicle) lines.push(`차량: ${state.vehicle}`);

        if (state.moveType) {
          const mt =
            state.moveType === "general" ? "일반이사" :
            state.moveType === "half" ? "반포장이사" :
            "보관이사";
          lines.push(`이사 방식: ${mt}`);

          if (state.moveType === "storage") {
            const sb = state.storageBase === "half" ? "보관-반포장" : "보관-일반";
            lines.push(`보관 타입: ${sb}`);
            lines.push(`보관 일수: ${state.storageDays}일 (상한 37만원)`);
          }
        }

        if (state.moveDate) lines.push(`일정: ${state.moveDate} / ${state.timeSlot ? state.timeSlot + "시" : "시간 미선택"}`);
        if (state.distanceKm > 0) lines.push(`거리: ${state.distanceKm} km`);
        if (state.hasWaypoint) lines.push(`경유지: ${state.waypointAddress || "-"}`);

        if (state.noFrom) lines.push(`출발: 엘베없음 ${state.fromFloor}층`);
        else lines.push(`출발: 엘베있음`);

        if (state.noTo) lines.push(`도착: 엘베없음 ${state.toFloor}층`);
        else lines.push(`도착: 엘베있음`);

        if (state.loadLevel > 0) {
          const map = { 0: "없음", 1: "1~5개", 2: "6~10개", 3: "11~15개", 4: "16~20개" };
          lines.push(`짐양: ${map[state.loadLevel] || "-"}`);
        }

        // 가구/가전 항목 요약
        const items = summarizeItemsWithMattress(state.items);
  // ensure item cost applied
  const itemsCost = items;

        if (items !== "선택 없음") {
          lines.push(`가구·가전: ${items}`);
        }

        // 선택한 가구/가전 관련 메모를 요약에 포함합니다. 사용자가 입력한 메모가 있을 경우만 추가합니다.
        if (state.itemsNote && state.itemsNote.trim()) {
          lines.push(`가구·가전 기타사항: ${state.itemsNote.trim()}`);
        }

        if (state.hasWaypoint) {
          const map = { 0: "없음", 1: "1~5개", 2: "6~10개", 3: "11~15개", 4: "16~20개" };
          if (state.waypointLoadLevel !== null) lines.push(`경유지 짐양: ${map[state.waypointLoadLevel] || "-"}`);
          const waypointItems = summarizeItemsWithMattress(state.waypointItems);
          if (waypointItems !== "선택 없음") lines.push(`경유지 가구·가전: ${waypointItems}`);
          if (state.waypointItemsNote && state.waypointItemsNote.trim()) {
            lines.push(`경유지 짐 기타사항: ${state.waypointItemsNote.trim()}`);
          }
          lines.push(`경유지 계단: ${state.waypointNoElevator ? `엘베없음 ${state.waypointFloor}층` : "엘베있음"}`);
          if (state.waypointLadderEnabled) lines.push(`경유지 사다리차: ${state.waypointLadderFloor}층`);
        }

        if (state.cantCarryFrom || state.cantCarryTo) {
          lines.push(`직접 나르기 어려움: ${state.cantCarryFrom ? "출발 " : ""}${state.cantCarryTo ? "도착" : ""}`.trim());
        }

        if (state.helperFrom || state.helperTo) {
          lines.push(`인부: ${state.helperFrom ? "출발 " : ""}${state.helperTo ? "도착" : ""}`.trim());
        }

        if (state.ladderFromEnabled || state.ladderToEnabled) {
          const a = state.ladderFromEnabled ? `출발(${state.ladderFromFloor}층)` : "";
          const b = state.ladderToEnabled ? `도착(${state.ladderToFloor}층)` : "";
          lines.push(`사다리차: ${[a, b].filter(Boolean).join(" / ")}`);
        }

        if (state.cleaningToggle) {
          const cleanTypeLabel =
            state.cleanType === "movein" ? "입주청소" :
            state.cleanType === "moveout" ? "이사청소" : "거주청소";
          const soilLabel =
            state.cleanSoil === "light" ? "가벼움" :
            state.cleanSoil === "normal" ? "보통" : "심함";
          const cleanOpts = [
            state.cleanParkingHard ? "주차 어려움" : null,
            state.cleanNoElevator ? `엘베없음(${state.cleanFloor}층)` : null,
            state.cleanOuterWindowEnabled ? `외창(${state.cleanOuterWindowPyeong}평)` : null,
            state.cleanPhytoncideEnabled ? "피톤치드/탈취" : null,
            state.cleanDisinfectEnabled ? "살균/소독" : null,
            state.cleanTrashBags > 0 ? `폐기/정리 봉투(${state.cleanTrashBags}개)` : null,
          ].filter(Boolean).join(", ") || "없음";
          lines.push(`[입주청소] ${state.cleanPyeong}평 · ${cleanTypeLabel} · ${soilLabel}`);
          lines.push(`입주청소 구성: 방${state.cleanRooms} · 화장실${state.cleanBaths} · 베란다${state.cleanBalconies} · 붙박이장${state.cleanWardrobes}`);
          if (state.cleanAddress) lines.push(`입주청소 주소: ${state.cleanAddress}`);
          if (state.cleanAddressNote && state.cleanAddressNote.trim()) lines.push(`입주청소 주소 메모: ${state.cleanAddressNote.trim()}`);
          lines.push(`입주청소 옵션: ${cleanOpts}`);
          const special = summarizeDict(state.cleanBasic);
          const appliance = summarizeDict(state.cleanAppliance);
          if (special !== "선택 없음") lines.push(`특수 청소: ${special}`);
          if (appliance !== "선택 없음") lines.push(`가전·가구 클리닝: ${appliance}`);
          if (state.cleanNote && state.cleanNote.trim()) lines.push(`입주청소 기타사항: ${state.cleanNote.trim()}`);
          lines.push(`예상 입주청소비: ${formatWon(calcCleanDisplayPrice())}`);
        }

        if (state.throwToggle) {
          lines.push(`버려주세요: ${summarizeDict(state.throwFrom)} / ${summarizeDict(state.throwTo)}`);
          // 버려주세요 모드에서도 메모를 포함합니다. 입력한 메모가 있을 경우에만 추가합니다.
          if (state.throwNote && state.throwNote.trim()) {
            lines.push(`버려주세요 기타사항: ${state.throwNote.trim()}`);
          }
        }

        if (state.hasWaypoint) {
          const waypointThrow = summarizeDict(state.waypointThrow);
          if (waypointThrow !== "선택 없음") lines.push(`경유지 버려주세요: ${waypointThrow}`);
          if (state.waypointThrowNote && state.waypointThrowNote.trim()) {
            lines.push(`경유지 버려주세요 기타사항: ${state.waypointThrowNote.trim()}`);
          }
        }

        if (state.ride > 0) lines.push(`동승: ${state.ride}명`);

        return lines.join("<br>");
      }

      if (svc === SERVICE.CLEAN) {
        const lines = [];
        lines.push(`서비스: 입주청소`);
        lines.push(
          `유형: ${
            state.cleanType === "movein"
              ? "입주청소(공실)"
              : state.cleanType === "moveout"
              ? "이사청소(퇴거)"
              : "거주청소(짐있음)"
          }`
        );
        lines.push(
          `오염도: ${
            state.cleanSoil === "light" ? "가벼움" : state.cleanSoil === "normal" ? "보통" : "심함"
          }`
        );
        lines.push(`평수/구성: ${state.cleanPyeong}평 · 방${state.cleanRooms} · 화장실${state.cleanBaths} · 베란다${state.cleanBalconies}`);
        if (state.cleanAddress) lines.push(`주소: ${state.cleanAddress}`);
        if (state.moveDate) lines.push(`희망 일정: ${state.moveDate} / ${state.timeSlot ? state.timeSlot + "시" : "시간 미선택"}`);

        const opts = [];
        if (state.cleanParkingHard) opts.push("주차 어려움");
        if (state.cleanNoElevator) opts.push(`엘베없음(${state.cleanFloor}층)`);
        if (state.cleanOuterWindowEnabled) opts.push(`외창(${state.cleanOuterWindowPyeong}평)`);
        if (state.cleanPhytoncideEnabled) opts.push("피톤치드/탈취");
        if (state.cleanDisinfectEnabled) opts.push("살균/소독");
        if (state.cleanTrashBags > 0) opts.push(`폐기봉투(${state.cleanTrashBags}개)`);
        if (state.cleanWardrobes > 0) opts.push(`붙박이장(${state.cleanWardrobes}세트)`);
        if (opts.length) lines.push(`옵션: ${opts.join(", ")}`);

        const basic = summarizeDict(state.cleanBasic);
        if (basic !== "선택 없음") lines.push(`특수청소: ${basic}`);

        const appl = summarizeDict(state.cleanAppliance);
        if (appl !== "선택 없음") lines.push(`가전/가구 클리닝: ${appl}`);

        if (state.cleanNote.trim()) lines.push(`기타: ${state.cleanNote.trim()}`);

        return lines.join("<br>");
      }

      return "조건을 선택하세요";
    }

    let compareChart = null;
    let compareChartResizeRaf = null;

    function isMobileViewport() {
      return window.matchMedia && window.matchMedia("(max-width: 520px)").matches;
    }

    function queueCompareChartResize() {
      if (compareChartResizeRaf) cancelAnimationFrame(compareChartResizeRaf);
      compareChartResizeRaf = requestAnimationFrame(() => {
        compareChartResizeRaf = null;
        if (!compareChart) return;
        applyCompareChartResponsiveOptions(compareChart);
        compareChart.resize();
        compareChart.update("none");
      });
    }

    function applyCompareChartResponsiveOptions(chart) {
      if (!chart?.options) return;
      const mobile = isMobileViewport();
      const dataset = chart.data?.datasets?.[0];
      if (dataset) {
        dataset.barThickness = mobile ? 12 : 18;
        dataset.maxBarThickness = mobile ? 16 : 22;
      }
      if (chart.options.scales?.x?.ticks) {
        chart.options.scales.x.ticks.font = { size: mobile ? 9 : 11, weight: "700" };
        chart.options.scales.x.ticks.maxRotation = 0;
        chart.options.scales.x.ticks.minRotation = 0;
        chart.options.scales.x.ticks.autoSkip = false;
      }
      if (chart.options.scales?.y?.ticks) {
        chart.options.scales.y.ticks.font = { size: mobile ? 10 : 11 };
      }
    }

    function buildCompetitorComparison(displayPrice) {
      const safeDisplay = Math.max(0, Number(displayPrice) || 0);
      const average = safeDisplay > 0 ? safeDisplay / 0.862 : 0;
      const multipliers = [0.94, 0.97, 0.99, 1.00, 1.02, 1.04, 1.04];
      const labels = ["업체1", "업체2", "업체3", "업체4", "업체5", "업체6", "업체7", "DDLOGI"];
      const vendors = multipliers.map((m) => Math.round(average * m));
      const mean = vendors.length ? vendors.reduce((a, b) => a + b, 0) / vendors.length : 0;
      return {
        labels,
        values: [...vendors, Math.round(safeDisplay)],
        average: Math.round(mean),
      };
    }

    function renderCompareChart(displayPrice) {
      const canvas = $("#priceCompareChart");
      const averageLabel = $("#compareAverageLabel");
      if (!canvas || !window.Chart) return;

      const parentWidth = canvas.parentElement?.clientWidth || 0;
      if (parentWidth <= 0) {
        requestAnimationFrame(() => renderCompareChart(displayPrice));
        return;
      }

      const comparison = buildCompetitorComparison(displayPrice);
      if (averageLabel) averageLabel.textContent = `7개 업체 평균 ${formatWon(comparison.average)}`;

      const vendorColors = comparison.labels.map((label) =>
  label === "DDLOGI"
    ? "#2F80ED"          // 디디운송 (파란색)
    : "#CBD5E1"          // 다른 업체 (연회색)
);

const borderColors = comparison.labels.map((label) =>
  label === "DDLOGI"
    ? "#1D4ED8"
    : "#94A3B8"
);

      if (!compareChart) {
        compareChart = new window.Chart(canvas, {
          type: "bar",
          data: {
            labels: comparison.labels,
            datasets: [{
              label: "가격 비교",
              data: comparison.values,
              backgroundColor: vendorColors,
              borderColor: borderColors,
              borderWidth: 1,
              borderRadius: 10,
              borderSkipped: false,
              barThickness: isMobileViewport() ? 12 : 18,
              maxBarThickness: isMobileViewport() ? 16 : 22,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label(context) {
                    return `${context.label}: ${formatWon(context.raw || 0)}`;
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: {
                  color: "rgba(140, 171, 211, 0.72)",
                  font: { size: isMobileViewport() ? 9 : 11, weight: "700" },
                  maxRotation: 0,
                  minRotation: 0,
                  autoSkip: false,
                },
                border: { display: false },
              },
              y: {
                beginAtZero: false,
                suggestedMin: Math.max(0, Math.min(...comparison.values) * 0.9),
                suggestedMax: Math.max(...comparison.values) * 1.08,
                grid: { color: "rgba(255,255,255,0.08)" },
                border: { display: false },
                ticks: {
                  color: "rgba(230,237,246,0.58)",
                  font: { size: isMobileViewport() ? 10 : 11 },
                  callback(value) {
                    return `${Math.round(Number(value) / 1000)}k`;
                  },
                },
              },
            },
          },
        });
        applyCompareChartResponsiveOptions(compareChart);
        queueCompareChartResize();
        return;
      }

      compareChart.data.labels = comparison.labels;
      compareChart.data.datasets[0].data = comparison.values;
      compareChart.data.datasets[0].backgroundColor = vendorColors;
      compareChart.data.datasets[0].borderColor = borderColors;
      compareChart.options.scales.y.suggestedMin = Math.max(0, Math.min(...comparison.values) * 0.9);
      compareChart.options.scales.y.suggestedMax = Math.max(...comparison.values) * 1.08;
      applyCompareChartResponsiveOptions(compareChart);
      compareChart.update();
      queueCompareChartResize();
    }

    function renderPrice() {
      const raw = calcCurrentPrice();
      const display = raw * DISPLAY_MULTIPLIER;

      const priceEl = $("#price");
      const stickyPriceEl = $("#stickyPrice");

      if (priceEl) priceEl.textContent = formatWon(display);
      if (stickyPriceEl) stickyPriceEl.textContent = formatWon(display);

      const deposit = display * 0.2;
      const balance = display * 0.8;

      $("#deposit") && ($("#deposit").textContent = formatWon(deposit));
      $("#balance") && ($("#balance").textContent = formatWon(balance));
      $("#stickyDeposit") && ($("#stickyDeposit").textContent = formatWon(deposit));
      $("#stickyBalance") && ($("#stickyBalance").textContent = formatWon(balance));

      renderCompareChart(display);
    }

    function renderSummary() {
      const sum = $("#summary");
      if (sum) sum.innerHTML = buildSummaryText();
    }

    function isLikelyDetailedAddress(addr) {
      const value = String(addr || "").trim();
      if (!value) return false;
      return /(\d+\s*동)|(\d+\s*호)|(\d+\s*층)|(b\d+\s*층)|([A-Za-z]\d+\s*동)|([A-Za-z]\d+\s*호)/i.test(value);
    }

    function ensureAddressGuideModal() {
      let modal = document.getElementById("addressGuideModal");
      if (modal) return modal;

      modal = document.createElement("div");
      modal.className = "modal";
      modal.id = "addressGuideModal";
      modal.setAttribute("aria-hidden", "true");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "주소 입력 안내");
      modal.innerHTML = `
        <div class="modal-backdrop" data-close="addressGuideModal"></div>
        <div class="modal-panel">
          <div class="modal-head">
            <div class="modal-title">주소를 다시 입력해주세요</div>
            <button class="modal-x" type="button" data-close="addressGuideModal" aria-label="닫기">×</button>
          </div>
          <div class="modal-body">
            <p style="margin:0; line-height:1.7; color:var(--text,#111);">세부 주소(몇 동, 몇 호, 몇 층)까지 넣으면 주소를 찾지 못해 거리가 0으로 계산될 수 있어요.</p>
            <p style="margin:12px 0 0; line-height:1.7; color:var(--muted,#666);">동·호수는 빼고 <b>도로명주소/건물명까지만</b> 입력한 뒤 다시 거리 계산을 해주세요.</p>
          </div>
          <div class="modal-foot">
            <button type="button" class="wizard-btn" data-close="addressGuideModal">확인</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      return modal;
    }

    function showAddressGuidePopup() {
      ensureAddressGuideModal();
      if (typeof openModal === "function") {
        openModal("addressGuideModal");
        return;
      }
      alert("주소는 동·호수를 빼고 도로명주소/건물명까지만 입력해줘.");
    }

    function isMoveInquiryReady() {
      return !!state.startAddress && !!state.endAddress && state.distanceKm > 0 && state.lastDistanceRouteKey === currentRouteKey();
    }

    function validateMoveInquiryBeforeSend() {
      if (state.activeService !== SERVICE.MOVE) return true;
      if (isMoveInquiryReady()) return true;

      const hasDetail = isLikelyDetailedAddress(state.startAddress) || isLikelyDetailedAddress(state.endAddress) || (state.hasWaypoint && isLikelyDetailedAddress(state.waypointAddress));
      if (hasDetail || (!!state.startAddress && !!state.endAddress && state.distanceKm <= 0)) {
        showAddressGuidePopup();
      } else {
        alert("거리 계산이 완료돼야 견적서를 발송할 수 있어. 주소 입력 후 거리 계산하기를 다시 눌러줘.");
      }
      return false;
    }

    function updateInquiryButtonsState() {
      const shouldDisableMoveInquiry = state.activeService === SERVICE.MOVE && !isMoveInquiryReady();
      [document.getElementById("channelInquiry"), document.getElementById("sendInquiry")].forEach((btn) => {
        if (!btn) return;
        if (shouldDisableMoveInquiry) {
          btn.classList.add("is-disabled");
          btn.setAttribute("aria-disabled", "true");
          if (btn.tagName === "BUTTON") btn.disabled = true;
        } else {
          btn.classList.remove("is-disabled");
          btn.removeAttribute("aria-disabled");
          if (btn.tagName === "BUTTON") btn.disabled = false;
        }
      });
    }

    function renderAll() {
      renderMiniSummaries();
      renderSummary();
      renderPrice();
      updateStickyBarVisibility();

      // 중요: 보관이사/보관타입/보관일수는 state를 단일 진실 원천으로 유지
      // 모달 조작이나 다른 입력 후에도 DOM이 기본값으로 돌아가며 금액이 내려가는 현상을 막음
      $$('input[name="moveType"]').forEach((r) => {
        r.checked = String(r.value) === String(state.moveType);
      });
      $$('input[name="storageBase"]').forEach((r) => {
        r.checked = String(r.value) === String(state.storageBase);
      });
      const storageDaysInput = $("#storageDays");
      if (storageDaysInput) storageDaysInput.value = String(Math.max(1, toInt(state.storageDays, 1)));

      setHidden($("#storageBody"), state.moveType !== "storage");
      setHidden($("#ladderFromBody"), !state.ladderFromEnabled);
      setHidden($("#ladderToBody"), !state.ladderToEnabled);
      setHidden($("#cleaningBody"), !state.cleaningToggle);
      setHidden($("#cleanOuterWindowBody"), !state.cleanOuterWindowEnabled);
      setHidden($("#moveCleanOuterWindowBody"), !state.cleanOuterWindowEnabled);

      const cleaningToggle = $("#cleaningToggle");
      if (cleaningToggle) cleaningToggle.checked = !!state.cleaningToggle;

      const moveCleanPrice = $("#moveCleanPrice");
      if (moveCleanPrice) moveCleanPrice.textContent = formatWon(calcCleanDisplayPrice());

      const moveCleanSummary = $("#moveCleanSummary");
      if (moveCleanSummary) {
        const typeLabel = state.cleanType === "movein" ? "입주청소" : state.cleanType === "moveout" ? "이사청소" : "거주청소";
        const soilLabel = state.cleanSoil === "light" ? "가벼움" : state.cleanSoil === "normal" ? "보통" : "심함";
        moveCleanSummary.textContent = `${state.cleanPyeong}평 · ${typeLabel} · ${soilLabel}`;
      }

      const moveCleanAddress = $("#moveCleanAddress");
      if (moveCleanAddress && moveCleanAddress.value !== state.cleanAddress) moveCleanAddress.value = state.cleanAddress || "";
      const moveCleanAddressNote = $("#moveCleanAddressNote");
      if (moveCleanAddressNote && moveCleanAddressNote.value !== state.cleanAddressNote) moveCleanAddressNote.value = state.cleanAddressNote || "";
      const moveCleanNote = $("#moveCleanNote");
      if (moveCleanNote && moveCleanNote.value !== state.cleanNote) moveCleanNote.value = state.cleanNote || "";

      const waypointWrap = $("#waypointWrap");
      if (waypointWrap) waypointWrap.style.display = state.hasWaypoint ? "" : "none";

      const throwWrap = $("#throwMiniWrap");
      if (throwWrap) throwWrap.style.display = state.throwToggle ? "" : "none";

      const distText = $("#distanceText");
      if (distText) {
        if (state.distanceKm > 0 && state.lastDistanceRouteKey === currentRouteKey()) distText.textContent = `${state.distanceKm} km`;
        else if (state.startAddress && state.endAddress) distText.textContent = "거리 계산하기를 눌러주세요";
        else distText.textContent = "주소를 입력해주세요";
      }

      updateInquiryButtonsState();
    }

    /* =========================================================
       SMS / Inquiry flow
    ========================================================= */
    const INQUIRY_SMS_PHONE = "01075416143";

    async function copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.top = "-9999px";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(ta);
          return ok;
        } catch (_) {
          return false;
        }
      }
    }

    function buildSmsHref(phone, text) {
      const ua = navigator.userAgent || "";
      const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
      const separator = isAppleMobile ? "&" : "?";
      return `sms:${phone}${separator}body=${encodeURIComponent(String(text || ""))}`;
    }

    function openSmsAppWithPrefill(text) {
      const message = String(text || "").trim();
      if (!message) return false;

      try {
        const href = buildSmsHref(INQUIRY_SMS_PHONE, message);
        window.location.href = href;
        return true;
      } catch (e) {
        console.warn("SMS open failed:", e);
        return false;
      }
    }

    function handleInquirySmsFallback(copied) {
      const fallbackMessage = copied
        ? "문자 앱이 바로 열리지 않으면, 방금 복사된 견적서를 01075416143 번호로 붙여넣어 전송해줘!"
        : "문자 앱이 바로 열리지 않으면, 01075416143 번호로 견적 내용을 직접 보내줘!";
      alert(fallbackMessage);
    }

    function calcSmsMoveDiscountQuote(displayTotal) {
      const safeTotal = Number(displayTotal) || 0;
      const discountedTotal = Math.max(0, Math.round(safeTotal * 0.97));
      const deposit = Math.round(discountedTotal * 0.2);
      const balance = discountedTotal - deposit;
      return { discountedTotal, deposit, balance };
    }

    function buildInquiryMessage() {
      if (state.activeService === SERVICE.MOVE) {
        const vehicle = state.vehicle || "-";
        const moveType =
          state.moveType === "general" ? "일반이사" :
          state.moveType === "half" ? "반포장 이사" :
          "보관이사";

        const time = state.timeSlot ? `${state.timeSlot}시` : "-";
        const dist = state.distanceKm > 0 ? `${state.distanceKm}km` : "-";

        const loadMap = { 0: "없음", 1: "1~5개", 2: "6~10개", 3: "11~15개", 4: "16~20개" };
        const load = loadMap[state.loadLevel] || "-";

        const elevFrom = state.noFrom ? `출발 엘베없음(${state.fromFloor}층)` : "출발 엘베있음";
        const elevTo = state.noTo ? `도착 엘베없음(${state.toFloor}층)` : "도착 엘베있음";

        const items = summarizeItemsWithMattress(state.items);
  // ensure item cost applied
  const itemsCost = items;

        const itemsLine = `가구·가전: ${items}`;
        const itemsNoteLine = (state.itemsNote && state.itemsNote.trim()) ? `가구·가전 기타사항: ${state.itemsNote.trim()}` : null;
        const waypointLoadLine = state.hasWaypoint ? `경유지 짐양: ${state.waypointLoadLevel === null ? "선택 없음" : (loadMap[state.waypointLoadLevel] || "-")}` : null;
        const waypointItemsLine = state.hasWaypoint ? `경유지 가구·가전: ${summarizeItemsWithMattress(state.waypointItems)}` : null;
        const waypointItemsNoteLine = (state.hasWaypoint && state.waypointItemsNote && state.waypointItemsNote.trim()) ? `경유지 짐 기타사항: ${state.waypointItemsNote.trim()}` : null;
        const throwInfo = state.throwToggle
          ? `버려주세요: ${summarizeDict(state.throwFrom)} / ${summarizeDict(state.throwTo)}`
          : "버려주세요: 미사용";
        const throwNoteLine = (state.throwToggle && state.throwNote && state.throwNote.trim())
          ? `버려주세요 기타사항: ${state.throwNote.trim()}`
          : null;
        const waypointCarryLine = state.hasWaypoint ? `경유지 계단: ${state.waypointNoElevator ? `엘베없음(${state.waypointFloor}층)` : "엘베있음"}` : null;
        const waypointLadderLine = state.hasWaypoint ? `경유지 사다리차: ${state.waypointLadderEnabled ? `${state.waypointLadderFloor}층` : "불필요"}` : null;
        const waypointThrowLine = state.hasWaypoint ? `경유지 버려주세요: ${summarizeDict(state.waypointThrow)}` : null;
        const waypointThrowNoteLine = (state.hasWaypoint && state.waypointThrowNote && state.waypointThrowNote.trim())
          ? `경유지 버려주세요 기타사항: ${state.waypointThrowNote.trim()}`
          : null;

        const ladderInfo =
          (state.ladderFromEnabled || state.ladderToEnabled)
            ? `사다리차: ${state.ladderFromEnabled ? `출발(${state.ladderFromFloor}층)` : ""}${state.ladderFromEnabled && state.ladderToEnabled ? " / " : ""}${state.ladderToEnabled ? `도착(${state.ladderToFloor}층)` : ""}`
            : "사다리차: 불필요";

        const helperInfo = (`인부: ${state.helperFrom ? "출발 " : ""}${state.helperTo ? "도착" : ""}`).trim() || "인부: 미사용";

        const cantCarryInfo =
          (state.cantCarryFrom || state.cantCarryTo)
            ? (`직접 나르기 어려움: ${state.cantCarryFrom ? "출발 " : ""}${state.cantCarryTo ? "도착" : ""}`).trim()
            : "직접 나르기 어려움: 없음";

        const cleanOpt = state.cleaningToggle
          ? [
              "[입주청소 문의]",
              `평수: ${state.cleanPyeong}평`,
              `청소 종류: ${state.cleanType === "movein" ? "입주청소" : state.cleanType === "moveout" ? "이사청소" : "거주청소"}`,
              `오염도: ${state.cleanSoil === "light" ? "가벼움" : state.cleanSoil === "normal" ? "보통" : "심함"}`,
              `구성: 방${state.cleanRooms} · 화장실${state.cleanBaths} · 베란다${state.cleanBalconies} · 붙박이장${state.cleanWardrobes}`,
              `주소: ${state.cleanAddress || "-"}`,
              state.cleanAddressNote && state.cleanAddressNote.trim() ? `주소 메모: ${state.cleanAddressNote.trim()}` : null,
              `추가 옵션: ${
                [
                  state.cleanParkingHard ? "주차 어려움" : null,
                  state.cleanNoElevator ? `엘베없음(${state.cleanFloor}층)` : null,
                  state.cleanOuterWindowEnabled ? `외창(${state.cleanOuterWindowPyeong}평)` : null,
                  state.cleanPhytoncideEnabled ? "피톤치드/탈취" : null,
                  state.cleanDisinfectEnabled ? "살균/소독" : null,
                  state.cleanTrashBags > 0 ? `폐기/정리 봉투(${state.cleanTrashBags}개)` : null
                ].filter(Boolean).join(", ") || "없음"
              }`,
              `특수 청소: ${summarizeDict(state.cleanBasic)}`,
              `가전·가구 클리닝: ${summarizeDict(state.cleanAppliance)}`,
              state.cleanNote && state.cleanNote.trim() ? `기타사항: ${state.cleanNote.trim()}` : null,
              `예상 청소비: ${formatWon(calcCleanDisplayPrice())}`,
              `예약금(20%): ${formatWon(calcCleanDeposit())}`,
              `잔금(80%): ${formatWon(calcCleanBalance())}`,
            ].filter(Boolean).join("\n")
          : "입주청소: 미사용";

        const display = calcCurrentPrice() * DISPLAY_MULTIPLIER;
        const price = formatWon(display);
        const smsQuote = calcSmsMoveDiscountQuote(display);
        const deposit = formatWon(smsQuote.deposit);
        const balance = formatWon(smsQuote.balance);

        return [
          `${SITE_BRAND} 견적 문의`,
          "",
          "서비스: 이사·용달",
          `차량: ${vehicle}`,
          `이사 방식: ${moveType}`,
          state.moveType === "storage" ? `보관: ${state.storageDays}일 (상한 37만원)` : null,
          `일정: ${state.moveDate || "-"} / ${time}`,
          `출발지: ${state.startAddress || "-"}`,
          state.hasWaypoint ? `경유지: ${state.waypointAddress || "-"}` : null,
          `도착지: ${state.endAddress || "-"}`,
          `거리: ${dist}`,
          elevFrom,
          elevTo,
          `짐양: ${load}`,
          itemsLine,
          itemsNoteLine,
          waypointLoadLine,
          waypointItemsLine,
          waypointItemsNoteLine,
          waypointCarryLine,
          waypointLadderLine,
          helperInfo,
          cantCarryInfo,
          ladderInfo,
          cleanOpt,
          throwInfo,
          throwNoteLine,
          waypointThrowLine,
          waypointThrowNoteLine,
          state.ride > 0 ? `동승: ${state.ride}명` : null,
          "",
          `홈페이지 예상 견적: ${price}`,
          `예약금(20%): ${deposit}`,
          `잔금(80%): ${balance}`,
        ]
          .filter(Boolean)
          .join("\n");
      }

      if (state.activeService === SERVICE.CLEAN) {
        const type =
          state.cleanType === "movein" ? "입주청소(공실)" :
          state.cleanType === "moveout" ? "이사청소(퇴거)" : "거주청소(짐있음)";
        const soil =
          state.cleanSoil === "light" ? "가벼움" :
          state.cleanSoil === "normal" ? "보통" : "심함";
        const area = `${state.cleanPyeong}평`;
        const config = `방${state.cleanRooms} · 화장실${state.cleanBaths} · 베란다${state.cleanBalconies}`;
        const addr = state.cleanAddress || "-";
        const time = state.timeSlot ? `${state.timeSlot}시` : "-";

        const options =
          [
            state.cleanParkingHard ? "주차 어려움" : null,
            state.cleanNoElevator ? `엘베없음(${state.cleanFloor}층)` : null,
            state.cleanOuterWindowEnabled ? `외창(${state.cleanOuterWindowPyeong}평)` : null,
            state.cleanPhytoncideEnabled ? "피톤치드/탈취" : null,
            state.cleanDisinfectEnabled ? "살균/소독" : null,
            state.cleanTrashBags > 0 ? `폐기봉투(${state.cleanTrashBags}개)` : null,
            state.cleanWardrobes > 0 ? `붙박이장(${state.cleanWardrobes}세트)` : null,
          ].filter(Boolean).join(", ") || "없음";

        const special = summarizeDict(state.cleanBasic);
        const appliance = summarizeDict(state.cleanAppliance);
        const note = state.cleanNote.trim() || "-";
        const price = formatWon(calcCurrentPrice() * DISPLAY_MULTIPLIER);

        return [
          `${SITE_BRAND} 견적 문의 (${SITE_BRAND === "디디클린" ? "입주청소" : "입주청소"})`,
          "",
          `유형: ${type}`,
          `오염도: ${soil}`,
          `평수/구성: ${area} · ${config}`,
          `주소: ${addr}`,
          `희망 일정: ${state.moveDate || "-"} / ${time}`,
          options !== "없음" ? `옵션: ${options}` : null,
          special !== "선택 없음" ? `특수청소: ${special}` : null,
          appliance !== "선택 없음" ? `가전/가구 클리닝: ${appliance}` : null,
          note !== "-" ? `기타: ${note}` : null,
          "",
          `예상 견적: ${price}`,
        ]
          .filter(Boolean)
          .join("\n");
      }

      return "";
    }

    $("#channelInquiry")?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!validateMoveInquiryBeforeSend()) return;
      const msg = buildInquiryMessage();
      const copied = await copyToClipboard(msg);
      const ok = openSmsAppWithPrefill(msg);

      if (!ok) handleInquirySmsFallback(copied);
    });

    function updateStickyBarVisibility() {
      const stickyBarEl = $("#stickyPriceBar");
      if (!stickyBarEl) return;

      const quoteCardEl = $("#priceCardStatic") || $(".section.step-card[data-step=\"12\"] .price-card") || $(".section.step-card[data-step=\"12\"]");
      if (!quoteCardEl) {
        stickyBarEl.classList.remove("is-hidden");
        return;
      }

      const rect = quoteCardEl.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
      const hideStart = window.matchMedia("(max-width: 768px)").matches
        ? viewportH * 0.28
        : viewportH * 0.5;

      const shouldHide = rect.top <= hideStart && rect.bottom > 0;
      stickyBarEl.classList.toggle("is-hidden", shouldHide);
    }

    window.addEventListener("scroll", updateStickyBarVisibility, { passive: true });
    window.addEventListener("resize", updateStickyBarVisibility);

    $("#sendInquiry")?.addEventListener("click", async () => {
      if (!validateMoveInquiryBeforeSend()) return;
      const msg = buildInquiryMessage();
      closeModal("confirmInquiryModal");

      const copied = await copyToClipboard(msg);
      const ok = openSmsAppWithPrefill(msg);

      if (!ok) handleInquirySmsFallback(copied);
    });

    $("#askClean")?.addEventListener("click", () => {
      closeModal("confirmInquiryModal");
      if (CROSS_LINK) {
        window.location.href = CROSS_LINK;
        return;
      }
      state.cleaningToggle = true;
      const cleaningToggle = $("#cleaningToggle");
      if (cleaningToggle) cleaningToggle.checked = true;
      setHidden($("#cleaningBody"), false);
      const host = $("#cleaningBody") || document.querySelector('[data-step="11"]');
      host?.scrollIntoView({ behavior: "smooth", block: "center" });
      renderAll();
    });

    /* =========================================================
       AI quote assistant (beta+)
    ========================================================= */
    function ensureAiAssistantMounted() {
      if (document.getElementById("aiQuoteAssistant")) return;

      const host = document.createElement("div");
      host.id = "aiQuoteAssistant";
      host.className = "ai-assistant";
      host.innerHTML = `
        <button type="button" class="ai-assistant__fab" id="aiQuoteFab" aria-expanded="false" aria-controls="aiQuotePanel">
          <span class="ai-assistant__fab-icon">💬</span>
          <span class="ai-assistant__fab-text">상담하기</span>
        </button>

        <section class="ai-assistant__panel" id="aiQuotePanel" aria-hidden="true">
          <div class="ai-assistant__head">
            <div>
              <div class="ai-assistant__eyebrow">BETA+</div>
              <strong>AI 견적 상담</strong>
            </div>
            <div class="ai-assistant__head-actions">
              <button type="button" class="ai-assistant__ghost" id="aiQuoteReset">초기화</button>
              <button type="button" class="ai-assistant__close" id="aiQuoteClose" aria-label="닫기">×</button>
            </div>
          </div>

          <div class="ai-assistant__meta">
            <span class="ai-assistant__badge" id="aiQuoteModeBadge">로컬 분석</span>
            <span class="ai-assistant__sub" id="aiQuotePendingText">편하게 이어서 말씀해 주시면 이전 입력값은 유지한 채 자동으로 반영해드려요.</span>
          </div>

          <div class="ai-assistant__body" id="aiQuoteMessages">
            <div class="ai-msg ai-msg--assistant">
              원하시는 조건을 편하게 말씀해 주세요. 예시:<br>
              <b>4월 11일 오전 8시에 마포구 신수동에서 은평구 갈현동으로 이사해요. 출발지는 5층 엘리베이터 없음, 도착지는 4층 엘리베이터 없음이고 냉장고 1대, 세탁기 1대, 의자 3개 있어요.</b>
            </div>
          </div>

          <div class="ai-assistant__chips">
            <button type="button" class="ai-chip" data-ai-prompt="4월 11일 오전 8시, 서울 은평구 갈현동 487-15 5층 엘베없음에서 서울 은평구 갈현동 110-20 4층 엘베없음으로 가요. 냉장고 1, 세탁기 1, 건조기 1, 의자 3 있어요.">이사 예시</button>
            <button type="button" class="ai-chip" data-ai-prompt="입주청소 24평, 방 3 화장실 2 베란다 1, 인천 미추홀구 주안동, 4월 20일 오전 9시 원해요. 오염도 보통이고 외창 24평 추가할게요.">청소 예시</button>
          </div>

          <div class="ai-assistant__result" id="aiQuoteResult">아직 반영된 내용이 없어요.</div>
          <div class="ai-assistant__followup" id="aiQuoteFollowup">추가로 필요한 내용이 여기에 안내돼요.</div>

          <form class="ai-assistant__composer" id="aiQuoteForm">
            <textarea id="aiQuoteInput" rows="4" placeholder="예: 4월 11일 마포구 신수동에서 은평구 갈현동으로 이사해요"></textarea>
            <div class="ai-assistant__actions">
              <button type="submit" class="wizard-btn primary" id="aiQuoteSubmitBtn"><span aria-hidden="true">↵</span><span>입력</span></button>
              <button type="button" class="wizard-btn" id="aiQuoteGoEstimate">견적으로 이동</button>
            </div>
          </form>
        </section>
      `;
      document.body.appendChild(host);

      const fab = host.querySelector("#aiQuoteFab");
      const panel = host.querySelector("#aiQuotePanel");
      const closeBtn = host.querySelector("#aiQuoteClose");
      const resetBtn = host.querySelector("#aiQuoteReset");
      const form = host.querySelector("#aiQuoteForm");
      const input = host.querySelector("#aiQuoteInput");
      const messages = host.querySelector("#aiQuoteMessages");
      const result = host.querySelector("#aiQuoteResult");
      const followup = host.querySelector("#aiQuoteFollowup");
      const goEstimateBtn = host.querySelector("#aiQuoteGoEstimate");
      const modeBadge = host.querySelector("#aiQuoteModeBadge");
      const pendingText = host.querySelector("#aiQuotePendingText");
      const submitBtn = host.querySelector("#aiQuoteSubmitBtn");

      const aiContext = {
        source: "local",
        conversation: [],
        lastMissing: [],
        lastAskedKey: "",
        requestCount: 0,
      };

      function setOpen(open) {
        host.classList.toggle("is-open", !!open);
        fab?.setAttribute("aria-expanded", open ? "true" : "false");
        panel?.setAttribute("aria-hidden", open ? "false" : "true");
      }

      function pushMessage(text, role = "assistant") {
        if (!messages) return;
        const bubble = document.createElement("div");
        bubble.className = `ai-msg ai-msg--${role}`;
        bubble.innerHTML = String(text || "").replace(/\n/g, "<br>");
        messages.appendChild(bubble);
        messages.scrollTop = messages.scrollHeight;
      }

      function resetMessages() {
        if (!messages) return;
        messages.innerHTML = `
          <div class="ai-msg ai-msg--assistant">
            원하시는 조건을 편하게 말씀해 주세요. 예시:<br>
            <b>4월 11일 오전 8시에 마포구 신수동에서 은평구 갈현동으로 이사해요. 출발지는 5층 엘리베이터 없음, 도착지는 4층 엘리베이터 없음이고 냉장고 1대, 세탁기 1대, 의자 3개 있어요.</b>
          </div>
        `;
      }

      function setModeBadge(mode, detailText = "") {
        aiContext.source = mode || "local";
        if (!modeBadge) return;
        modeBadge.textContent = mode === "cloud" ? "AI 정밀 분석" : mode === "mixed" ? "AI+로컬 보정" : "로컬 분석";
        modeBadge.classList.toggle("is-cloud", mode === "cloud" || mode === "mixed");
        modeBadge.classList.toggle("is-local", mode !== "cloud" && mode !== "mixed");
        if (pendingText) pendingText.textContent = detailText || (mode === "cloud" || mode === "mixed" ? "말씀하신 내용을 더 정확하게 정리하면서 이전 입력값도 유지하고 있어요." : "편하게 이어서 말씀해 주시면 이전 입력값은 유지한 채 자동으로 반영해드려요.");
      }

      function normalizeWhitespace(str) {
        return String(str || "").replace(/\s+/g, " ").trim();
      }

      function cleanAddressFragment(raw) {
        return normalizeWhitespace(raw)
          .replace(/^(?:오는\s+)?(?:이번\s+)?(?:이사\s+)?/, "")
          .replace(/^(?:오늘|내일|모레)\s+/, "")
          .replace(/^(?:(?:20\d{2})년\s*)?\d{1,2}월\s*\d{1,2}일\s*/, "")
          .replace(/^(?:오전|오후)?\s*\d{1,2}시\s*/, "")
          .replace(/^(?:출발지|출발|도착지|도착)\s*(?:는|은|이|가)?\s*/, "")
          .replace(/\s*(?:으로|로)?\s*(?:갈게요|갈거예요|갈거에요|갈 거예요|갈 거에요|갈게|갈 거야|갈거야|가요|갑니다|이사해요|이사합니다|이동해요|이동합니다|옮겨요|옮깁니다|예정이에요|예정입니다)\s*$/i, "")
          .replace(/[,.]$/g, "")
          .trim();
      }

      function parseImplicitFromTo(raw) {
        const text = normalizeWhitespace(raw);
        const match = text.match(/(.+?)에서\s*(.+?)(?:으로|로)(?=\s|$|갈|가|이사|이동|옮|예정|원|해|합)/);
        if (!match) return null;
        const start = cleanAddressFragment(match[1]);
        const end = cleanAddressFragment(match[2]);
        if (!start || !end) return null;
        return { start, end };
      }

      function parseRelativeDateToken(raw) {
        const now = new Date();
        const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (/모레/.test(raw)) base.setDate(base.getDate() + 2);
        else if (/내일/.test(raw)) base.setDate(base.getDate() + 1);
        else if (/오늘/.test(raw)) base.setDate(base.getDate());
        else return null;
        return base.toISOString().slice(0, 10);
      }

      function parseDateValue(raw) {
        const rel = parseRelativeDateToken(raw);
        if (rel) return rel;

        const iso = raw.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
        if (iso) {
          const [, y, m, d] = iso;
          return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        }

        const md = raw.match(/(?:(20\d{2})년\s*)?(\d{1,2})월\s*(\d{1,2})일/);
        if (md) {
          const year = Number(md[1] || new Date().getFullYear());
          const month = Number(md[2]);
          const day = Number(md[3]);
          return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
        return "";
      }

      function parseTimeValue(raw) {
        const m = raw.match(/(오전|오후)?\s*(\d{1,2})\s*(?:시|:00)/);
        if (!m) return "";
        let hour = Number(m[2]);
        if (m[1] === "오후" && hour < 12) hour += 12;
        if (m[1] === "오전" && hour === 12) hour = 0;
        if (hour < 7 || hour > 15) return "";
        return String(hour);
      }

      function parseCount(raw, fallback = 1) {
        const m = String(raw || "").match(/(\d+)/);
        return m ? Math.max(0, Number(m[1])) : fallback;
      }

      function levelFromCount(count) {
        const n = Number(count) || 0;
        if (n <= 0) return null;
        if (n <= 5) return 1;
        if (n <= 10) return 2;
        if (n <= 15) return 3;
        return 4;
      }

      const itemAliasEntries = [
        ["냉장고(380L이하)", ["냉장고", "2도어 냉장고", "일반 냉장고"]],
        ["세탁기(12kg이하)", ["세탁기"]],
        ["건조기(12kg이하)", ["건조기"]],
        ["전자레인지", ["전자레인지"]],
        ["공기청정기", ["공기청정기"]],
        ["청소기", ["청소기"]],
        ["정수기(이동만)", ["정수기"]],
        ["TV/모니터", ["tv", "티비", "모니터"]],
        ["의자", ["의자"]],
        ["행거", ["행거"]],
        ["협탁/사이드테이블(소형)", ["협탁", "사이드테이블"]],
        ["화장대(소형)", ["화장대"]],
        ["책상/테이블(일반)", ["책상", "테이블"]],
        ["서랍장(3~5단)", ["서랍장"]],
        ["책장(일반)", ["책장"]],
        ["수납장/TV장(일반)", ["수납장", "tv장", "티비장"]],
        ["소파(2~3인)", ["소파"]],
        ["침대매트리스(킹제외)", ["매트리스"]],
        ["침대프레임(분해/조립)", ["침대프레임", "침대 프레임"]],
      ];

      function escapeRegex(str) {
        return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }

      function extractItems(raw) {
        const out = {};
        const text = String(raw || "").toLowerCase();
        itemAliasEntries.forEach(([key, aliases]) => {
          aliases.forEach((alias) => {
            const safe = escapeRegex(alias.toLowerCase());
            const regex = new RegExp(`${safe}\\s*(?:x|×)?\\s*(\\d+)`, "gi");
            let found = false;
            let match;
            while ((match = regex.exec(text))) {
              out[key] = (out[key] || 0) + Number(match[1] || 1);
              found = true;
            }
            if (!found && text.includes(alias.toLowerCase()) && !(key in out)) {
              out[key] = 1;
            }
          });
        });
        return out;
      }

      function extractAddressAfterKeyword(raw, keyword) {
        const text = normalizeWhitespace(raw);
        const patterns = [
          new RegExp(`${keyword}[:：]?\\s*([^,\n]+?)(?=\\s+(?:에서|부터|로|까지|출발|도착|경유지|엘베|엘리베이터|$))`),
          new RegExp(`${keyword}[:：]?\\s*([^,\n]+)`),
        ];
        for (const regex of patterns) {
          const m = text.match(regex);
          if (m && m[1]) return m[1].trim();
        }
        return "";
      }

      function parseMoveDetails(raw) {
        const text = normalizeWhitespace(raw);
        const parsed = { items: extractItems(text) };

        parsed.moveDate = parseDateValue(text);
        parsed.timeSlot = parseTimeValue(text);

        if (/반포장/.test(text)) parsed.moveType = "half";
        else if (/보관이사|보관\s*이사|창고/.test(text)) parsed.moveType = "storage";
        else if (/일반이사|용달|소형이사|원룸이사/.test(text)) parsed.moveType = "general";

        const storageDays = text.match(/보관\s*(\d+)\s*일|창고\s*(\d+)\s*일/);
        if (storageDays) parsed.storageDays = Number(storageDays[1] || storageDays[2]);

        if (/1톤\s*카고\+?저상탑|1톤\s*카고\s*\+\s*저상탑/.test(text)) parsed.vehicle = "1톤 카고+저상탑";
        else if (/저상탑/.test(text)) parsed.vehicle = "1톤 저상탑";
        else if (/1톤\s*카고|1톤트럭|1톤/.test(text)) parsed.vehicle = "1톤 카고";

        parsed.startAddress = extractAddressAfterKeyword(text, "출발지");
        parsed.endAddress = extractAddressAfterKeyword(text, "도착지");
        parsed.waypointAddress = extractAddressAfterKeyword(text, "경유지");
        parsed.hasWaypoint = !!parsed.waypointAddress;

        if (!parsed.startAddress || !parsed.endAddress) {
          const arrow = text.split(/→|->|➡️|⇒/).map((s) => s.trim()).filter(Boolean);
          if (arrow.length >= 2) {
            if (!parsed.startAddress) parsed.startAddress = arrow[0].replace(/^(출발|출발지)\s*/, "").trim();
            if (!parsed.endAddress) parsed.endAddress = arrow[arrow.length - 1].replace(/^(도착|도착지)\s*/, "").trim();
          } else {
            const implicit = parseImplicitFromTo(text);
            if (implicit) {
              if (!parsed.startAddress) parsed.startAddress = implicit.start;
              if (!parsed.endAddress) parsed.endAddress = implicit.end;
            }
          }
        }

        if (parsed.startAddress) parsed.startAddress = cleanAddressFragment(parsed.startAddress);
        if (parsed.endAddress) parsed.endAddress = cleanAddressFragment(parsed.endAddress);
        if (parsed.waypointAddress) parsed.waypointAddress = cleanAddressFragment(parsed.waypointAddress);

        const directFloor = text.match(/출발[^\d]{0,10}(\d+)\s*층[^,\n]{0,12}(엘베없음|엘리베이터 없음|엘베 없음|계단)/);
        if (directFloor) {
          parsed.noFrom = true;
          parsed.fromFloor = Number(directFloor[1]);
        }
        const directToFloor = text.match(/도착[^\d]{0,10}(\d+)\s*층[^,\n]{0,12}(엘베없음|엘리베이터 없음|엘베 없음|계단)/);
        if (directToFloor) {
          parsed.noTo = true;
          parsed.toFloor = Number(directToFloor[1]);
        }

        if (!("fromFloor" in parsed) || !("toFloor" in parsed)) {
          const floorMatches = [...text.matchAll(/(\d+)\s*층\s*(엘베없음|엘리베이터 없음|엘베 없음|계단|엘베있음|엘리베이터 있음|엘베 있음)?/g)];
          if (floorMatches[0] && !("fromFloor" in parsed)) {
            parsed.fromFloor = Number(floorMatches[0][1]);
            parsed.noFrom = /(없음|계단)/.test(floorMatches[0][2] || "");
          }
          if (floorMatches[1] && !("toFloor" in parsed)) {
            parsed.toFloor = Number(floorMatches[1][1]);
            parsed.noTo = /(없음|계단)/.test(floorMatches[1][2] || "");
          }
        }

        const loadRange = text.match(/(\d+)\s*[~\-]\s*(\d+)\s*개/);
        if (loadRange) parsed.loadLevel = levelFromCount(Number(loadRange[2]));
        else {
          const loadCount = text.match(/(?:짐양|박스|박스수|상자)\s*(\d+)\s*개/);
          if (loadCount) parsed.loadLevel = levelFromCount(Number(loadCount[1]));
        }

        if (/버려주세요|폐기/.test(text)) parsed.throwToggle = true;
        if (/출발지에서 버려|출발에서 버려/.test(text)) parsed.workFrom = true;
        if (/도착지에서 버려|도착에서 버려/.test(text)) parsed.workTo = true;
        if (/청소도|입주청소|이사청소|거주청소/.test(text)) parsed.cleaningToggle = true;
        if (/사다리차\s*(필요|사용)/.test(text)) parsed.ladderToEnabled = true;
        if (/동승\s*(\d+)/.test(text)) parsed.ride = parseCount(text.match(/동승\s*(\d+)/)?.[0] || "", 0);
        return parsed;
      }

      function parseCleanDetails(raw) {
        const text = normalizeWhitespace(raw);
        const parsed = {};
        parsed.moveDate = parseDateValue(text);
        parsed.timeSlot = parseTimeValue(text);
        parsed.cleanAddress = extractAddressAfterKeyword(text, "주소") || extractAddressAfterKeyword(text, "청소주소");
        if (!parsed.cleanAddress) {
          const maybe = text.match(/(?:인천|서울|경기|부천|성남|고양|수원|용인|안산|안양|시흥|김포|하남|광명|의정부|남양주|파주|화성|평택|천안|아산|대전|대구|부산|광주|울산|세종|제주)[^,\n]{4,}/);
          if (maybe) parsed.cleanAddress = maybe[0].trim();
        }

        if (/입주청소|공실/.test(text)) parsed.cleanType = "movein";
        else if (/이사청소|퇴거/.test(text)) parsed.cleanType = "moveout";
        else if (/거주청소|짐있음/.test(text)) parsed.cleanType = "living";

        if (/오염도\s*심함|심한 편|많이 더러/.test(text)) parsed.cleanSoil = "heavy";
        else if (/오염도\s*보통|보통/.test(text)) parsed.cleanSoil = "normal";
        else if (/오염도\s*가벼움|가벼움|깨끗/.test(text)) parsed.cleanSoil = "light";

        const pyeong = text.match(/(\d+)\s*평/);
        if (pyeong) parsed.cleanPyeong = Number(pyeong[1]);
        const rooms = text.match(/방\s*(\d+)/);
        if (rooms) parsed.cleanRooms = Number(rooms[1]);
        const baths = text.match(/(?:화장실|욕실)\s*(\d+)/);
        if (baths) parsed.cleanBaths = Number(baths[1]);
        const balconies = text.match(/(?:베란다|발코니)\s*(\d+)/);
        if (balconies) parsed.cleanBalconies = Number(balconies[1]);
        const wardrobes = text.match(/붙박이장\s*(\d+)/);
        if (wardrobes) parsed.cleanWardrobes = Number(wardrobes[1]);
        const floor = text.match(/(\d+)\s*층\s*(엘베없음|엘리베이터 없음|엘베 없음|계단)/);
        if (floor) {
          parsed.cleanNoElevator = true;
          parsed.cleanFloor = Number(floor[1]);
        }
        const outWindow = text.match(/외창\s*(\d+)\s*평/);
        if (outWindow) {
          parsed.cleanOuterWindowEnabled = true;
          parsed.cleanOuterWindowPyeong = Number(outWindow[1]);
        }
        if (/피톤치드|탈취/.test(text)) parsed.cleanPhytoncideEnabled = true;
        if (/살균|소독/.test(text)) parsed.cleanDisinfectEnabled = true;
        const bags = text.match(/(?:폐기봉투|정리봉투|봉투)\s*(\d+)\s*개/);
        if (bags) parsed.cleanTrashBags = Number(bags[1]);
        return parsed;
      }

      function normalizeParsedShape(candidate) {
        if (!candidate || typeof candidate !== "object") return {};
        const parsed = { ...candidate };
        if (parsed.items && typeof parsed.items === "object") {
          parsed.items = Object.fromEntries(Object.entries(parsed.items).filter(([, v]) => Number(v) > 0));
        }
        ["moveDate", "startAddress", "endAddress", "waypointAddress", "cleanAddress", "vehicle", "moveType", "cleanType", "cleanSoil", "timeSlot"].forEach((key) => {
          if (parsed[key] == null) return;
          parsed[key] = String(parsed[key]).trim();
          if (!parsed[key]) delete parsed[key];
        });
        ["storageDays", "fromFloor", "toFloor", "cleanPyeong", "cleanRooms", "cleanBaths", "cleanBalconies", "cleanWardrobes", "cleanFloor", "cleanOuterWindowPyeong", "cleanTrashBags", "ride", "loadLevel"].forEach((key) => {
          if (parsed[key] == null || parsed[key] === "") return;
          const n = Number(parsed[key]);
          if (Number.isFinite(n)) parsed[key] = n;
          else delete parsed[key];
        });
        return parsed;
      }

      function mergeParsed(baseParsed, overlayParsed) {
        const out = { ...baseParsed };
        Object.entries(normalizeParsedShape(overlayParsed)).forEach(([key, value]) => {
          if (value == null || value === "") return;
          if (key === "items") {
            out.items = { ...(out.items || {}), ...value };
          } else {
            out[key] = value;
          }
        });
        return out;
      }

      function applyBoolRadio(name, boolValue) {
        const expected = boolValue ? "1" : "0";
        const input = document.querySelector(`input[name="${name}"][value="${expected}"]`);
        if (input) input.checked = true;
      }

      function applyStateToDom(parsed) {
        const scalarIds = ["moveDate", "startAddress", "waypointAddress", "endAddress", "storageDays", "fromFloor", "toFloor", "cleanPyeong", "cleanRooms", "cleanBaths", "cleanBalconies", "cleanWardrobes", "cleanAddress", "cleanFloor", "cleanOuterWindowPyeong", "cleanTrashBags"];
        scalarIds.forEach((id) => {
          if (!(id in parsed)) return;
          const el = document.getElementById(id);
          if (el) el.value = parsed[id] == null ? "" : String(parsed[id]);
        });

        if ("vehicle" in parsed) {
          $$(".vehicle").forEach((btn) => btn.classList.toggle("active", btn.dataset.vehicle === parsed.vehicle));
        }
        if ("moveType" in parsed) {
          const input = document.querySelector(`input[name="moveType"][value="${parsed.moveType}"]`);
          if (input) input.checked = true;
        }
        if ("loadLevel" in parsed && parsed.loadLevel) {
          const input = document.querySelector(`input[name="load"][value="${parsed.loadLevel}"]`);
          if (input) input.checked = true;
        }
        if ("timeSlot" in parsed && parsed.timeSlot) {
          const input = document.querySelector(`input[name="timeSlot"][value="${parsed.timeSlot}"]`);
          if (input && !input.disabled) input.checked = true;
        }

        if ("hasWaypoint" in parsed) {
          const el = document.getElementById("hasWaypoint");
          if (el) el.checked = !!parsed.hasWaypoint;
        }
        if ("noFrom" in parsed) {
          const el = document.getElementById("noFrom");
          if (el) el.checked = !!parsed.noFrom;
        }
        if ("noTo" in parsed) {
          const el = document.getElementById("noTo");
          if (el) el.checked = !!parsed.noTo;
        }
        if ("throwToggle" in parsed) {
          const el = document.getElementById("throwToggle");
          if (el) el.checked = !!parsed.throwToggle;
        }
        if ("workFrom" in parsed) {
          const el = document.getElementById("workFrom");
          if (el) el.checked = !!parsed.workFrom;
        }
        if ("workTo" in parsed) {
          const el = document.getElementById("workTo");
          if (el) el.checked = !!parsed.workTo;
        }
        if ("cleaningToggle" in parsed) {
          const el = document.getElementById("cleaningToggle");
          if (el) el.checked = !!parsed.cleaningToggle;
        }
        if ("cleanOuterWindowEnabled" in parsed) {
          const el = document.getElementById("cleanOuterWindowEnabled");
          if (el) el.checked = !!parsed.cleanOuterWindowEnabled;
        }
        if ("cleanPhytoncideEnabled" in parsed) {
          const el = document.getElementById("cleanPhytoncideEnabled");
          if (el) el.checked = !!parsed.cleanPhytoncideEnabled;
        }
        if ("cleanDisinfectEnabled" in parsed) {
          const el = document.getElementById("cleanDisinfectEnabled");
          if (el) el.checked = !!parsed.cleanDisinfectEnabled;
        }
        if ("cleanNoElevator" in parsed) applyBoolRadio("cleanNoElevator", !!parsed.cleanNoElevator);
        if ("cleanType" in parsed) {
          const a = document.querySelector(`input[name="cleanType"][value="${parsed.cleanType}"]`);
          const b = document.querySelector(`input[name="moveCleanType"][value="${parsed.cleanType}"]`);
          if (a) a.checked = true;
          if (b) b.checked = true;
        }
        if ("cleanSoil" in parsed) {
          const a = document.querySelector(`input[name="cleanSoil"][value="${parsed.cleanSoil}"]`);
          const b = document.querySelector(`input[name="moveCleanSoil"][value="${parsed.cleanSoil}"]`);
          if (a) a.checked = true;
          if (b) b.checked = true;
        }
      }

      function mergeIntoState(parsed) {
        Object.entries(parsed).forEach(([key, value]) => {
          if (value == null || value === "" || (typeof value === "number" && !Number.isFinite(value))) return;
          if (key === "items") {
            state.items = { ...state.items, ...value };
            return;
          }
          state[key] = value;
        });
      }

      function getAiStateSnapshot() {
        return {
          activeService: state.activeService,
          moveDate: state.moveDate,
          timeSlot: state.timeSlot,
          startAddress: state.startAddress,
          endAddress: state.endAddress,
          waypointAddress: state.waypointAddress,
          hasWaypoint: !!state.hasWaypoint,
          fromFloor: state.fromFloor,
          toFloor: state.toFloor,
          noFrom: !!state.noFrom,
          noTo: !!state.noTo,
          moveType: state.moveType,
          vehicle: state.vehicle,
          loadLevel: state.loadLevel,
          storageDays: state.storageDays,
          distanceKm: state.distanceKm,
          items: state.items || {},
          throwToggle: !!state.throwToggle,
          cleaningToggle: !!state.cleaningToggle,
          cleanType: state.cleanType,
          cleanSoil: state.cleanSoil,
          cleanPyeong: state.cleanPyeong,
          cleanAddress: state.cleanAddress,
          cleanRooms: state.cleanRooms,
          cleanBaths: state.cleanBaths,
          cleanBalconies: state.cleanBalconies,
          cleanWardrobes: state.cleanWardrobes,
          cleanFloor: state.cleanFloor,
          cleanNoElevator: !!state.cleanNoElevator,
          cleanOuterWindowEnabled: !!state.cleanOuterWindowEnabled,
          cleanOuterWindowPyeong: state.cleanOuterWindowPyeong,
          cleanPhytoncideEnabled: !!state.cleanPhytoncideEnabled,
          cleanDisinfectEnabled: !!state.cleanDisinfectEnabled,
          cleanTrashBags: state.cleanTrashBags,
        };
      }

      function summarizeItems(items = {}) {
        const entries = Object.entries(items || {}).filter(([, count]) => Number(count) > 0).slice(0, 6);
        if (!entries.length) return "";
        const summary = entries.map(([name, count]) => `${name} ${count}개`).join(", ");
        const extra = Object.keys(items || {}).length > entries.length ? ` 외 ${Object.keys(items || {}).length - entries.length}종` : "";
        return `${summary}${extra}`;
      }

      function buildSnapshotSummary(snapshot = getAiStateSnapshot()) {
        if ((snapshot.activeService || state.activeService) === SERVICE.CLEAN) {
          const lines = [
            snapshot.cleanType ? `청소 유형: ${snapshot.cleanType === "movein" ? "입주청소" : snapshot.cleanType === "moveout" ? "이사청소" : "거주청소"}` : null,
            snapshot.cleanPyeong ? `평수: ${snapshot.cleanPyeong}평` : null,
            snapshot.cleanAddress ? `주소: ${snapshot.cleanAddress}` : null,
            snapshot.moveDate ? `날짜: ${snapshot.moveDate}` : null,
            snapshot.timeSlot ? `시간: ${snapshot.timeSlot}시` : null,
            snapshot.cleanRooms ? `방: ${snapshot.cleanRooms}개` : null,
            snapshot.cleanBaths ? `화장실: ${snapshot.cleanBaths}개` : null,
            snapshot.cleanBalconies ? `베란다: ${snapshot.cleanBalconies}개` : null,
            snapshot.cleanSoil ? `오염도: ${snapshot.cleanSoil === "heavy" ? "심함" : snapshot.cleanSoil === "normal" ? "보통" : "가벼움"}` : null,
          ].filter(Boolean);
          return lines.length ? `현재까지 입력된 내용\n${lines.join("\n")}` : "아직 입력된 청소 조건이 많지 않아요.";
        }

        const lines = [
          snapshot.moveDate ? `날짜: ${snapshot.moveDate}` : null,
          snapshot.timeSlot ? `시간: ${snapshot.timeSlot}시` : null,
          snapshot.startAddress ? `출발지: ${snapshot.startAddress}` : null,
          snapshot.endAddress ? `도착지: ${snapshot.endAddress}` : null,
          snapshot.waypointAddress ? `경유지: ${snapshot.waypointAddress}` : null,
          snapshot.fromFloor ? `출발층: ${snapshot.fromFloor}층${snapshot.noFrom ? ' (엘리베이터 없음)' : ''}` : null,
          snapshot.toFloor ? `도착층: ${snapshot.toFloor}층${snapshot.noTo ? ' (엘리베이터 없음)' : ''}` : null,
          snapshot.moveType ? `이사 방식: ${snapshot.moveType === "half" ? "반포장" : snapshot.moveType === "storage" ? "보관이사" : "일반이사"}` : null,
          snapshot.vehicle ? `차량: ${snapshot.vehicle}` : null,
          snapshot.loadLevel ? `짐양 단계: ${snapshot.loadLevel}` : null,
          summarizeItems(snapshot.items) ? `가전·가구: ${summarizeItems(snapshot.items)}` : null,
          snapshot.distanceKm ? `거리: ${snapshot.distanceKm}km` : null,
        ].filter(Boolean);
        return lines.length ? `현재까지 입력된 내용\n${lines.join("\n")}` : "아직 입력된 이사 조건이 많지 않아요.";
      }

      async function tryAutoDistanceCalc() {
        if (state.activeService !== SERVICE.MOVE) return false;
        if (!state.startAddress || !state.endAddress) return false;
        if (state.hasWaypoint && !state.waypointAddress) return false;
        try {
          await new Promise((resolve, reject) => {
            ensureKakaoReady(async () => {
              try {
                const geocoder = new window.kakao.maps.services.Geocoder();
                const a = await geocode(geocoder, state.startAddress);
                const b = state.hasWaypoint ? await geocode(geocoder, state.waypointAddress) : null;
                const c = await geocode(geocoder, state.endAddress);
                let base = 0;
                if (b) base = haversineKm(a, b) + haversineKm(b, c);
                else base = haversineKm(a, c);
                state.distanceKm = Math.max(0, Math.round(base * 1.25 * 10) / 10);
                state.lastDistanceRouteKey = currentRouteKey();
                resolve(true);
              } catch (error) {
                reject(error);
              }
            });
          });
          return true;
        } catch (error) {
          console.warn("AI auto distance failed:", error);
          return false;
        }
      }

      function buildMissingFields(service, snapshot = getAiStateSnapshot()) {
        if (service === SERVICE.CLEAN) {
          const cleanItems = [
            { key: "cleanPyeong", label: "평수", question: "청소 평수가 몇 평인지 알려주세요." },
            { key: "cleanAddress", label: "청소 주소", question: "청소할 주소를 동·호수 전까지만이라도 알려주세요." },
            { key: "moveDate", label: "날짜", question: "청소 희망 날짜를 알려주세요. 예: 4월 20일" },
            { key: "timeSlot", label: "시간", question: "원하시는 시간도 알려주세요. 예: 오전 9시" },
            { key: "cleanType", label: "청소 유형", question: "입주청소 / 이사청소 / 거주청소 중 어떤 건지 알려주세요." },
            { key: "cleanSoil", label: "오염도", question: "오염도는 가벼움 / 보통 / 심함 중 어디에 가까운지 알려주세요." },
            { key: "cleanRooms", label: "방 개수", question: "방 개수도 알려주시면 더 정확해져요." },
            { key: "cleanBaths", label: "화장실 개수", question: "화장실 개수도 알려주세요." },
          ];
          return cleanItems.filter((item) => {
            const value = snapshot[item.key];
            if (typeof value === "boolean") return false;
            if (typeof value === "number") return !(value > 0);
            return !value;
          });
        }

        const moveItems = [
          { key: "moveDate", label: "날짜", question: "이사 날짜를 알려주세요. 예: 4월 11일" },
          { key: "timeSlot", label: "시간", question: "희망 시간을 알려주세요. 예: 오전 8시" },
          { key: "startAddress", label: "출발지", question: "출발지 주소를 알려주세요. 동네까지만 적어주셔도 괜찮아요." },
          { key: "endAddress", label: "도착지", question: "도착지 주소도 알려주세요." },
          { key: "fromFloor", label: "출발층", question: "출발지는 몇 층인지, 엘리베이터가 있는지도 알려주세요." },
          { key: "toFloor", label: "도착층", question: "도착지는 몇 층인지, 엘리베이터가 있는지도 알려주세요." },
          { key: "moveType", label: "이사 방식", question: "일반이사 / 반포장 / 보관이사 중 어떤 건지 알려주세요." },
          { key: "vehicle", label: "차량", question: "차량은 1톤 카고 / 저상탑 / 카고+저상탑 중 어느 쪽인지 알려주세요." },
          { key: "loadInfo", label: "짐 정보", question: "박스 수나 큰 가전가구 개수를 알려주시면 더 정확해져요." },
        ];
        return moveItems.filter((item) => {
          if (item.key === "loadInfo") return !(snapshot.loadLevel || Object.keys(snapshot.items || {}).length);
          const value = snapshot[item.key];
          if (typeof value === "number") return !(value > 0);
          return !value;
        });
      }

      function buildAppliedSummary(parsed, autoDistanceOk, serviceOverride) {
        const service = serviceOverride || state.activeService;
        const lines = [];
        if (service === SERVICE.MOVE) {
          lines.push(`반영된 값: ${[
            parsed.moveDate ? `일정 ${parsed.moveDate}` : null,
            parsed.timeSlot ? `${parsed.timeSlot}시` : null,
            parsed.startAddress ? "출발지" : null,
            parsed.endAddress ? "도착지" : null,
            parsed.loadLevel ? "짐양" : null,
            Object.keys(parsed.items || {}).length ? `가전·가구 ${Object.keys(parsed.items).length}종` : null,
            autoDistanceOk ? `거리 ${state.distanceKm}km` : null,
          ].filter(Boolean).join(" / ") || "핵심값 일부만 반영"}`);
          if (!autoDistanceOk && state.startAddress && state.endAddress) lines.push("주소 표현 때문에 거리가 자동으로 잡히지 않을 수 있어요. 아래 거리 계산 버튼을 한 번 눌러주세요.");
        } else {
          lines.push(`반영된 값: ${[
            parsed.cleanType ? "청소유형" : null,
            parsed.cleanPyeong ? `${parsed.cleanPyeong}평` : null,
            parsed.cleanAddress ? "주소" : null,
            parsed.moveDate ? `일정 ${parsed.moveDate}` : null,
            parsed.timeSlot ? `${parsed.timeSlot}시` : null,
          ].filter(Boolean).join(" / ") || "핵심값 일부만 반영"}`);
        }
        return lines.join("\n");
      }

      function decideServiceByText(raw) {
        if (/입주청소|이사청소|거주청소|청소/.test(raw)) return SERVICE.CLEAN;
        if (/이사|용달|냉장고|세탁기|출발지|도착지|엘베|경유지/.test(raw)) return SERVICE.MOVE;
        return state.activeService || DEFAULT_SERVICE;
      }

      function resolveServiceByText(raw) {
        try {
          if (typeof decideServiceByText === "function") return decideServiceByText(String(raw || ""));
        } catch (_) {}
        const text = String(raw || "");
        if (/입주청소|이사청소|거주청소|청소/.test(text)) return SERVICE.CLEAN;
        if (/이사|용달|냉장고|세탁기|출발지|도착지|엘베|경유지|보관/.test(text)) return SERVICE.MOVE;
        return state.activeService || DEFAULT_SERVICE;
      }

      window.resolveServiceByText = resolveServiceByText;
      window.decideServiceByText = decideServiceByText;
      async function callAiAssistAPI({ message, targetService }) {
        const payload = {
          message,
          targetService,
          conversation: aiContext.conversation.slice(-8),
          currentState: getAiStateSnapshot(),
          lastMissing: aiContext.lastMissing.slice(0, 3),
        };
        const res = await fetch("/.netlify/functions/aiQuoteAssist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "AI parse failed");
        }
        return json;
      }

      function buildMissingPrompt(missing, service) {
        if (!missing.length) {
          return service === SERVICE.MOVE
            ? "좋아. 핵심값은 거의 들어왔어. 아래 견적 금액 확인해보고 바로 문의 보내면 돼."
            : "좋아. 핵심 청소 조건이 거의 들어왔어. 아래 견적 금액 확인해봐.";
        }
        const first = missing[0];
        const second = missing[1];
        return [first?.question, second?.question].filter(Boolean).join(" ");
      }

      async function handleAiSubmit(raw) {
        const text = normalizeWhitespace(raw);
        if (!text) return;

        pushMessage(text, "user");
        aiContext.conversation.push({ role: "user", content: text });
        aiContext.requestCount += 1;
        submitBtn && (submitBtn.disabled = true);

        const targetService = (typeof resolveServiceByText === "function" ? resolveServiceByText(text) : (/입주청소|이사청소|거주청소|청소/.test(String(text||"")) ? SERVICE.CLEAN : SERVICE.MOVE));
        state.activeService = targetService;

        let localParsed = targetService === SERVICE.CLEAN ? parseCleanDetails(text) : parseMoveDetails(text);
        let finalParsed = { ...localParsed };
        let aiResponse = null;
        let source = "local";

        try {
          aiResponse = await callAiAssistAPI({ message: text, targetService });
          source = localParsed && Object.keys(localParsed).length ? "mixed" : "cloud";
          finalParsed = mergeParsed(localParsed, aiResponse.parsed || {});
          setModeBadge(source, aiResponse.note || "자유문장을 더 정밀하게 분석해서 이전 입력값과 합쳐 반영하고 있어요.");
        } catch (error) {
          console.warn("AI cloud assist unavailable:", error);
          setModeBadge("local", "서버 AI 없이도 이전 입력값을 유지하면서 로컬 규칙으로 반영하고 있어요.");
        }

        if (!Object.keys(finalParsed).length) {
          const snapshotSummary = buildSnapshotSummary(getAiStateSnapshot());
          pushMessage(`방금 문장에서 새로 읽어낸 값은 적었지만, 이전에 입력해 주신 내용은 그대로 유지하고 있어요.

${snapshotSummary}`);
          if (result) result.textContent = snapshotSummary;
          if (followup) followup.textContent = targetService === SERVICE.MOVE ? "예: 박스 10개, 냉장고 1대, 출발지 5층 엘리베이터 없음처럼 이어서 적어주세요." : "예: 방 3, 화장실 2, 오염도 보통처럼 이어서 적어주세요.";
          submitBtn && (submitBtn.disabled = false);
          return;
        }

        if (targetService === SERVICE.MOVE && !state.vehicle) finalParsed.vehicle = finalParsed.vehicle || "1톤 카고";

        mergeIntoState(finalParsed);
        applyStateToDom(finalParsed);
        if (finalParsed.moveDate) await refreshTimeSlotAvailability();
        const autoDistanceOk = await tryAutoDistanceCalc();
        renderAll();

        const currentSnapshot = getAiStateSnapshot();
        const missing = Array.isArray(aiResponse?.missing) && aiResponse.missing.length
          ? aiResponse.missing.filter((m) => m && m.key && m.question)
          : buildMissingFields(targetService, currentSnapshot);
        aiContext.lastMissing = missing;
        aiContext.lastAskedKey = missing[0]?.key || "";

        const summary = buildAppliedSummary(finalParsed, autoDistanceOk, targetService);
        const assistantText = aiResponse?.assistantMessage || buildMissingPrompt(missing, targetService);
        const combinedText = `${summary}${assistantText ? `\n${assistantText}` : ""}`;

        if (result) result.textContent = summary;
        if (followup) followup.textContent = missing.length ? `다음으로 받으면 좋은 값: ${missing.slice(0, 3).map((m) => m.label).join(", ")}` : "핵심값이 거의 다 들어왔어. 견적 확인 단계로 넘어가도 돼.";

        pushMessage(combinedText);
        aiContext.conversation.push({ role: "assistant", content: combinedText });
        submitBtn && (submitBtn.disabled = false);
      }

      fab?.addEventListener("click", () => {
        const next = !host.classList.contains("is-open");
        setOpen(next);
        if (next) input?.focus();
      });
      closeBtn?.addEventListener("click", () => setOpen(false));
      resetBtn?.addEventListener("click", () => {
        aiContext.conversation = [];
        aiContext.lastMissing = [];
        aiContext.lastAskedKey = "";
        aiContext.requestCount = 0;
        resetMessages();
        if (result) result.textContent = "아직 반영된 내용이 없어요.";
        if (followup) followup.textContent = "추가로 필요한 내용이 여기에 안내돼요.";
        setModeBadge("local", "편하게 이어서 말씀해 주시면 이전 입력값은 유지한 채 자동으로 반영해드려요.");
        input && (input.value = "");
      });
      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const value = input?.value || "";
        if (!value.trim()) return;
        input.value = "";
        await handleAiSubmit(value);
      });
      host.querySelectorAll("[data-ai-prompt]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const value = btn.getAttribute("data-ai-prompt") || "";
          if (input) input.value = value;
          await handleAiSubmit(value);
        });
      });
      goEstimateBtn?.addEventListener("click", () => {
        const target = document.querySelector('[data-step="12"]');
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
        setOpen(false);
      });

      setModeBadge("local", "편하게 이어서 말씀해 주시면 이전 입력값은 유지한 채 자동으로 반영해드려요.");
    }
    ensureAiAssistantMounted();

    function getRecommendedStepIndex() {
      const visible = computeVisibleSteps();
      for (let i = 0; i < visible.length; i += 1) {
        const token = getStepToken(visible[i]);
        if (state.activeService === SERVICE.MOVE) {
          if (token === 1 && !state.vehicle) return i;
          if (token === 2 && (!(state.distanceKm > 0) || state.lastDistanceRouteKey !== currentRouteKey() || !state.startAddress || !state.endAddress)) return i;
          if (token === 3 && (!state.moveDate || !state.timeSlot)) return i;
          if (token === 4 && !state.moveType) return i;
          if (token === 6 && state.loadLevel === null && !Object.keys(state.items || {}).length) return i;
        }
        if (state.activeService === SERVICE.CLEAN) {
          if (token === 2 && !state.cleanAddress) return i;
          if (token === 3 && (!state.moveDate || !state.timeSlot)) return i;
        }
      }
      const summaryIndex = visible.findIndex((sec) => getStepToken(sec) === 12);
      return summaryIndex >= 0 ? summaryIndex : 0;
    }

    const entryGate = $("#entryGate");
    const manualEntryBtn = $("#manualEntryBtn");
    const captureEntryBtn = $("#captureEntryBtn");
    const photoConsultBtn = $("#photoConsultBtn");
    const captureUploadInput = $("#captureUploadInput");
    const photoConsultInput = $("#photoConsultInput");
    const entryOcrPanel = $("#entryOcrPanel");
    const entryOcrStatus = $("#entryOcrStatus");
    const entryOcrHint = $("#entryOcrHint");
    const entryOcrBar = $("#entryOcrBar");
    const entryOcrPreview = $("#entryOcrPreview");
    const captureRetryBtn = $("#captureRetryBtn");
    const entryReviewPanel = $("#entryReviewPanel");
    const entryReviewTitle = $("#entryReviewTitle");
    const entryReviewCards = $("#entryReviewCards");
    const entryReviewMissing = $("#entryReviewMissing");
    const entryReviewApplyBtn = $("#entryReviewApplyBtn");
    const entryReviewRetryBtn = $("#entryReviewRetryBtn");
    const entryPhotoPanel = $("#entryPhotoPanel");
    const entryPhotoTitle = $("#entryPhotoTitle");
    const entryPhotoCards = $("#entryPhotoCards");
    const entryPhotoPreview = $("#entryPhotoPreview");
    const entryPhotoHint = $("#entryPhotoHint");
    const entryPhotoBar = $("#entryPhotoBar");
    const photoRetryBtn = $("#photoRetryBtn");
    const photoSmsBtn = $("#photoSmsBtn");
    const photoCopyBtn = $("#photoCopyBtn");
    const photoShareBtn = $("#photoShareBtn");
    let pendingCaptureParsed = null;
    let pendingPhotoConsult = null;
    const PHOTO_CONSULT_PHONE = "01040941666";

    function toggleEntryButtons(disabled) {
      [manualEntryBtn, captureEntryBtn, photoConsultBtn, captureRetryBtn, photoRetryBtn].forEach((btn) => {
        if (!btn) return;
        btn.disabled = !!disabled;
      });
    }

    function updateEntryOcrProgress(statusText, percent, hintText) {
      if (entryOcrPanel) entryOcrPanel.hidden = false;
      if (entryOcrStatus && statusText) entryOcrStatus.textContent = statusText;
      if (entryOcrHint && hintText) entryOcrHint.textContent = hintText;
      if (entryOcrBar && Number.isFinite(percent)) entryOcrBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }

    function resetEntryReview() {
      pendingCaptureParsed = null;
      if (entryReviewPanel) entryReviewPanel.hidden = true;
      if (entryReviewCards) entryReviewCards.innerHTML = "";
      if (entryReviewMissing) {
        entryReviewMissing.hidden = true;
        entryReviewMissing.textContent = "";
      }
      if (entryReviewTitle) entryReviewTitle.textContent = "읽어낸 내용을 먼저 확인해주세요.";
    }

    function resetPhotoConsult() {
      pendingPhotoConsult = null;
      if (entryPhotoPanel) entryPhotoPanel.hidden = true;
      if (entryPhotoCards) entryPhotoCards.innerHTML = "";
      if (entryPhotoPreview) entryPhotoPreview.textContent = "아직 생성된 요약이 없어요.";
      if (entryPhotoHint) entryPhotoHint.textContent = "큰 짐, 생활짐, 상담사가 다시 물어봐야 할 항목을 우선 정리해요.";
      if (entryPhotoTitle) entryPhotoTitle.textContent = "짐 사진을 먼저 요약해드릴게요.";
      if (entryPhotoBar) entryPhotoBar.style.width = "0%";
    }

    function updatePhotoConsultProgress(titleText, percent, hintText) {
      if (entryPhotoPanel) entryPhotoPanel.hidden = false;
      if (entryPhotoTitle && titleText) entryPhotoTitle.textContent = titleText;
      if (entryPhotoHint && hintText) entryPhotoHint.textContent = hintText;
      if (entryPhotoBar && Number.isFinite(percent)) entryPhotoBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }

    function buildPhotoConsultBody(summary) {
      const message = String(summary?.customerMessage || "").trim();
      const note = String(summary?.userGuide || "").trim();
      return [message, note].filter(Boolean).join("\n\n").trim();
    }

    function renderPhotoConsultResult(summary) {
      if (!entryPhotoPanel || !entryPhotoCards) return;
      const cards = [
        ["보이는 큰 짐", Array.isArray(summary?.visibleItems) && summary.visibleItems.length ? summary.visibleItems.join("\n") : "뚜렷하게 보이는 큰 짐이 많지 않아요."],
        ["잔짐 / 생활짐", Array.isArray(summary?.smallItems) && summary.smallItems.length ? summary.smallItems.join("\n") : "잔짐 정보가 제한적이에요."],
        ["추정 짐량", summary?.loadEstimate || "추정이 어려워요."],
        ["추가 확인 필요", Array.isArray(summary?.followUpQuestions) && summary.followUpQuestions.length ? summary.followUpQuestions.join("\n") : "추가 확인 항목이 많지 않아요."],
      ];
      entryPhotoCards.innerHTML = cards.map(([title, body]) => `
        <section class="entry-photo__card">
          <div class="entry-photo__card-title">${title}</div>
          <div class="entry-photo__card-body">${escapeHtml(String(body || "-"))}</div>
        </section>
      `).join("");
      const previewText = [
        summary?.customerMessage,
        summary?.counselorNote ? `--- 상담사 메모 ---\n${summary.counselorNote}` : "",
      ].filter(Boolean).join("\n\n");
      if (entryPhotoPreview) entryPhotoPreview.textContent = previewText || "생성된 상담 문구가 없어요.";
      if (entryPhotoHint) entryPhotoHint.textContent = summary?.userGuide || "문자앱 또는 공유창에서 사진을 마지막에 직접 첨부해주세요.";
      if (entryPhotoTitle) entryPhotoTitle.textContent = summary?.title || "사진 기준 상담 요약이 준비됐어요.";
      if (entryPhotoBar) entryPhotoBar.style.width = "100%";
      entryPhotoPanel.hidden = false;
    }

    function formatReviewValue(value) {
      if (value == null || value === "") return "-";
      if (typeof value === "boolean") return value ? "예" : "아니오";
      if (Array.isArray(value)) return value.filter(Boolean).join(", ") || "-";
      return String(value);
    }

    function renderEntryReview(parsed, rawText) {
      if (!entryReviewPanel || !entryReviewCards) return;
      const service = parsed?.targetService || (typeof resolveServiceByText === "function" ? resolveServiceByText(rawText || "") : (/입주청소|이사청소|거주청소|청소/.test(String(rawText||"")) ? SERVICE.CLEAN : SERVICE.MOVE));
      const snapshot = normalizeParsedShape(parsed?.finalParsed || parsed || {});
      const cards = [];
      if (parsed?.visionSummary) {
        cards.push({
          title: "AI 캡처 요약",
          rows: [
            ["분석 방식", parsed.visionConfidence ? `서버 이미지 분석 ${(parsed.visionConfidence * 100).toFixed(0)}%` : "서버 이미지 분석"],
            ["요약", parsed.visionSummary],
          ],
        });
      }
      if (service === SERVICE.MOVE) {
        const itemEntries = Object.entries(snapshot.items || {}).filter(([, qty]) => Number(qty) > 0).slice(0, 8).map(([name, qty]) => `${name} × ${qty}`);
        cards.push({
          title: "기본 정보",
          rows: [
            ["서비스", "이사·용달"],
            ["이사 날짜", snapshot.moveDate],
            ["희망 시간", snapshot.timeSlot ? `${snapshot.timeSlot}시` : "-"],
            ["차량", snapshot.vehicle],
            ["이사 방식", snapshot.moveType],
          ],
        });
        cards.push({
          title: "이동 정보",
          rows: [
            ["출발지", snapshot.startAddress],
            ["도착지", snapshot.endAddress],
            ["출발층", snapshot.fromFloor ? `${snapshot.fromFloor}층${snapshot.noFrom ? ' / 엘베없음' : ''}` : "-"],
            ["도착층", snapshot.toFloor ? `${snapshot.toFloor}층${snapshot.noTo ? ' / 엘베없음' : ''}` : "-"],
          ],
        });
        cards.push({
          title: "짐 정보",
          rows: [
            ["짐양 단계", snapshot.loadLevel ? `${snapshot.loadLevel}단계` : "-"],
            ["가전·가구", itemEntries.length ? itemEntries : "-"],
          ],
        });
      } else {
        cards.push({
          title: "청소 기본 정보",
          rows: [
            ["서비스", "청소"],
            ["주소", snapshot.cleanAddress],
            ["희망 날짜", snapshot.moveDate],
            ["희망 시간", snapshot.timeSlot ? `${snapshot.timeSlot}시` : "-"],
            ["청소 유형", snapshot.cleanType],
            ["오염도", snapshot.cleanSoil],
            ["평수", snapshot.cleanPyeong ? `${snapshot.cleanPyeong}평` : "-"],
          ],
        });
      }
      entryReviewCards.innerHTML = cards.map((card) => `
        <section class="entry-review__card">
          <div class="entry-review__card-title">${card.title}</div>
          <div class="entry-review__list">
            ${card.rows.map(([label, value]) => `
              <div class="entry-review__row">
                <span class="entry-review__label">${label}</span>
                <span class="entry-review__value">${formatReviewValue(value)}</span>
              </div>
            `).join("")}
          </div>
        </section>
      `).join("");
      const missing = buildMissingFields(service, snapshot);
      const hinted = Array.isArray(parsed?.missingHints) ? parsed.missingHints.filter(Boolean).slice(0, 5) : [];
      if (entryReviewMissing) {
        entryReviewMissing.hidden = false;
        if (missing.length && hinted.length) {
          entryReviewMissing.textContent = `추가 확인이 필요한 값: ${missing.slice(0, 4).map((m) => m.label).join(", ")} · 이미지 기준 불확실 항목: ${hinted.join(", ")}`;
        } else if (missing.length) {
          entryReviewMissing.textContent = `추가 확인이 필요한 값: ${missing.slice(0, 4).map((m) => m.label).join(", ")}`;
        } else if (hinted.length) {
          entryReviewMissing.textContent = `이미지 기준으로 불확실한 항목: ${hinted.join(", ")}`;
        } else {
          entryReviewMissing.textContent = "핵심 값은 대부분 읽었어요. 견적 시작하기를 누르면 바로 계산기로 이어집니다.";
        }
      }
      if (entryReviewTitle) {
        entryReviewTitle.textContent = service === SERVICE.MOVE ? "숨고 캡처에서 읽은 이사 정보를 먼저 보여드릴게요." : "캡처에서 읽은 청소 정보를 먼저 보여드릴게요.";
      }
      entryReviewPanel.hidden = false;
    }

    async function analyzeCaptureText(text) {
      const targetService = (typeof resolveServiceByText === "function" ? resolveServiceByText(text) : (/입주청소|이사청소|거주청소|청소/.test(String(text||"")) ? SERVICE.CLEAN : SERVICE.MOVE));
      let localParsed = targetService === SERVICE.CLEAN ? parseCleanDetails(text) : parseMoveDetails(text);
      let finalParsed = { ...localParsed };
      let aiResponse = null;
      try {
        aiResponse = await callAiAssistAPI({ message: text, targetService });
        finalParsed = mergeParsed(localParsed, aiResponse.parsed || {});
      } catch (error) {
        console.warn("capture AI assist unavailable:", error);
      }
      if (targetService === SERVICE.MOVE && !finalParsed.vehicle) finalParsed.vehicle = "1톤 카고";
      return { targetService, localParsed, finalParsed: normalizeParsedShapeSafe(finalParsed), aiResponse };
    }

    async function applyPendingCaptureReview() {
      if (!pendingCaptureParsed?.finalParsed) return;
      const { targetService, finalParsed } = pendingCaptureParsed;
      state.activeService = targetService;
      mergeIntoState(finalParsed);
      applyStateToDom(finalParsed);
      if (finalParsed.moveDate) await refreshTimeSlotAvailability();
      await tryAutoDistanceCalc();
      renderAll();
      resetEntryReview();
      updateEntryOcrProgress("자동 입력이 끝났어요.", 100, "누락된 값만 이어서 확인하면 됩니다.");
      openCalculatorAt(getRecommendedStepIndex());
    }

    function openCalculatorAt(index) {
      document.body.classList.remove("entry-mode-pending");
      if (entryGate) entryGate.hidden = true;
      const targetIndex = Number.isFinite(index) ? index : 0;
      requestAnimationFrame(() => {
        gotoStep(targetIndex, { noScroll: false });
        updateStickyBarVisibility();
      });
    }

    function splitNormalizedLines(raw) {
      return String(raw || "")
        .split(/\n+/)
        .map((line) => normalizeWhitespace(line))
        .filter(Boolean);
    }

    function dedupeOcrLines(lines) {
      const seen = new Set();
      return lines.filter((line) => {
        const key = line.toLowerCase().replace(/[^\w가-힣]+/g, "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function normalizeOcrLine(line) {
      return normalizeWhitespace(String(line || "")
        .replace(/[|│┃]/g, " ")
        .replace(/[•·]/g, " ")
        .replace(/([가-힣])([0-9])/g, "$1 $2")
        .replace(/([0-9])([가-힣])/g, "$1 $2")
        .replace(/([A-Za-z])([0-9])/g, "$1 $2")
        .replace(/([0-9])([A-Za-z])/g, "$1 $2")
        .replace(/오후\s*\(\s*(\d{1,2})\s*[~\-]\s*(\d{1,2})\s*시\s*\)/g, "오후 $1시")
        .replace(/오전\s*\(\s*(\d{1,2})\s*[~\-]\s*(\d{1,2})\s*시\s*\)/g, "오전 $1시")
        .replace(/아니요\s*[.:：]*\s*(\d+층)/g, "엘베없음 $1")
      );
    }

    function scoreOcrText(raw) {
      const text = String(raw || "");
      let score = 0;
      if (/출발지|도착지|엘리베이터|서비스 대상|요청 상세|용달|화물 운송|이사/.test(text)) score += 5;
      if (/(20\d{2})년\s*\d{1,2}월\s*\d{1,2}일/.test(text)) score += 4;
      if (/(서울|경기|인천|부천|광주|대전|대구|부산|울산|세종|제주)[^\n]{2,}/.test(text)) score += 4;
      if (/책상|모니터|냉장고|세탁기|본체|의자|소형짐|박스/.test(text)) score += 3;
      score += Math.min(8, Math.floor(text.length / 40));
      return score;
    }

    function mergeOcrTexts(texts) {
      const lines = [];
      texts.forEach((text) => {
        splitNormalizedLines(text).forEach((line) => lines.push(normalizeOcrLine(line)));
      });
      return dedupeOcrLines(lines).join("\n");
    }


    async function fileToDataUrl(file, maxSize = 2200, quality = 0.94, crop = null) {
      const bitmap = await fileToImageBitmapSafe(file);
      const srcW = bitmap.width || bitmap.naturalWidth || 1;
      const srcH = bitmap.height || bitmap.naturalHeight || 1;
      const cropX = Math.max(0, Math.round((crop?.x || 0) * srcW));
      const cropY = Math.max(0, Math.round((crop?.y || 0) * srcH));
      const cropW = Math.max(1, Math.round((crop?.w || 1) * srcW));
      const cropH = Math.max(1, Math.round((crop?.h || 1) * srcH));
      const ratio = Math.min(1, maxSize / Math.max(cropW || 1, cropH || 1));
      const w = Math.max(1, Math.round(cropW * ratio));
      const h = Math.max(1, Math.round(cropH * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, w, h);
      if (bitmap?.close) { try { bitmap.close(); } catch (_) {} }
      return canvas.toDataURL("image/jpeg", quality);
    }

    async function createCaptureVisionPayloads(files) {
      const payloads = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        updateEntryOcrProgress(`캡처 ${i + 1}/${files.length} 서버 분석용 준비 중`, 12 + Math.round((i / Math.max(1, files.length)) * 16), "전체 화면과 핵심 영역을 같이 보내 정확도를 높이고 있어요.");
        payloads.push({ label: `capture_${i + 1}_full`, url: await fileToDataUrl(file, 2400, 0.95) });
        try {
          const bitmap = await fileToImageBitmapSafe(file);
          const srcW = bitmap.width || bitmap.naturalWidth || 1;
          const srcH = bitmap.height || bitmap.naturalHeight || 1;
          if (bitmap?.close) { try { bitmap.close(); } catch (_) {} }
          const isTall = srcH > srcW * 1.05;
          if (isTall) {
            payloads.push({ label: `capture_${i + 1}_top`, url: await fileToDataUrl(file, 2400, 0.97, { x: 0, y: 0, w: 1, h: 0.44 }) });
            payloads.push({ label: `capture_${i + 1}_mid`, url: await fileToDataUrl(file, 2400, 0.97, { x: 0, y: 0.22, w: 1, h: 0.46 }) });
            payloads.push({ label: `capture_${i + 1}_bottom`, url: await fileToDataUrl(file, 2400, 0.97, { x: 0, y: 0.50, w: 1, h: 0.50 }) });
          }
        } catch (_) {}
      }
      return payloads.slice(0, 10);
    }

    async function callCaptureVisionAPI(files) {
      const images = await createCaptureVisionPayloads(files);
      const res = await fetch("/.netlify/functions/captureVisionParse", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ images }),
      });
      return await readJsonResponseSafe(res, "캡처 분석");
    }

    async function callPhotoConsultAPI(files) {
      const images = [];
      for (let i = 0; i < files.length; i += 1) {
        updatePhotoConsultProgress(`사진 ${i + 1}/${files.length} 준비 중`, 10 + Math.round((i / Math.max(1, files.length)) * 18), "상담용으로 사진 크기를 줄이고 큰 짐이 잘 보이게 준비하고 있어요.");
        images.push(await fileToDataUrl(files[i], 1800, 0.92));
      }
      const res = await fetch("/.netlify/functions/photoConsultParse", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ images }),
      });
      return await readJsonResponseSafe(res, "사진 상담 분석");
    }

    function countMeaningfulParsedFields(parsed = {}) {
      let score = 0;
      if (parsed.moveDate) score += 1;
      if (parsed.timeSlot) score += 1;
      if (parsed.startAddress) score += 2;
      if (parsed.endAddress) score += 2;
      if (parsed.cleanAddress) score += 2;
      if (parsed.cleanPyeong) score += 1;
      if (parsed.fromFloor) score += 1;
      if (parsed.toFloor) score += 1;
      if (parsed.noFrom === true || parsed.noFrom === false) score += 1;
      if (parsed.noTo === true || parsed.noTo === false) score += 1;
      score += Math.min(3, Object.keys(parsed.items || {}).length);
      return score;
    }

    function hasMeaningfulParsedData(parsed = {}) {
      return countMeaningfulParsedFields(parsed) >= 3;
    }


    function normalizeWhitespace(str) {
      return String(str || "").replace(/\s+/g, " ").trim();
    }


    function getCaptureUiState(visionResult, pendingParsed, extractedText) {
      const parseStatus = visionResult?.parseStatus || ((countMeaningfulParsedFields(pendingParsed?.finalParsed || {}) >= 3) ? "partial" : "fail");
      const uiMessage = visionResult?.uiMessage || (
        parseStatus === "success"
          ? { title: "캡처 내용을 읽었어요", message: "읽은 정보를 자동으로 입력했어요. 내용만 확인해주세요." }
          : parseStatus === "partial"
            ? { title: "일부 정보만 읽혔어요", message: "대부분 읽었지만 몇몇 정보가 불분명해요. 아래 내용을 확인하고 수정해주세요." }
            : { title: "사진만으로는 정보 확인이 어려워요", message: "문자가 잘 보이도록 다시 찍어주시거나 문자 상담으로 보내주시면 빠르게 도와드릴게요." }
      );
      const textConsultRecommended = Boolean(visionResult?.textConsultRecommended) && parseStatus === "fail";
      return { parseStatus, uiMessage, textConsultRecommended, extractedText: extractedText || "" };
    }

    async function readJsonResponseSafe(res, label) {
      const rawText = await res.text().catch(() => "");
      let json = null;
      try {
        json = rawText ? JSON.parse(rawText) : {};
      } catch (_) {
        throw new Error(`${label} 응답이 JSON 형식이 아니에요. (${res.status || 'unknown'})`);
      }
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `${label} 요청 실패 (${res.status || 'unknown'})`);
      }
      return json;
    }

    const normalizeParsedShapeSafe = typeof normalizeParsedShape === "function"
      ? (candidate) => normalizeParsedShape(candidate)
      : (candidate) => {
          if (!candidate || typeof candidate !== "object") return {};
          const parsed = { ...candidate };
          if (parsed.items && typeof parsed.items === "object") {
            parsed.items = Object.fromEntries(Object.entries(parsed.items).filter(([, v]) => Number(v) > 0));
          }
          ["moveDate", "startAddress", "endAddress", "waypointAddress", "cleanAddress", "vehicle", "moveType", "cleanType", "cleanSoil", "timeSlot"].forEach((key) => {
            if (parsed[key] == null) return;
            parsed[key] = String(parsed[key]).trim();
            if (!parsed[key]) delete parsed[key];
          });
          ["storageDays", "fromFloor", "toFloor", "cleanPyeong", "cleanRooms", "cleanBaths", "cleanBalconies", "cleanWardrobes", "cleanFloor", "cleanOuterWindowPyeong", "cleanTrashBags", "ride", "loadLevel"].forEach((key) => {
            if (parsed[key] == null || parsed[key] === "") return;
            const n = Number(parsed[key]);
            if (Number.isFinite(n)) parsed[key] = n;
            else delete parsed[key];
          });
          return parsed;
        };

    const mergeParsedSafe = typeof mergeParsed === "function"
      ? (baseParsed, overlayParsed) => mergeParsed(baseParsed, overlayParsed)
      : (baseParsed, overlayParsed) => {
          const out = { ...(baseParsed || {}) };
          Object.entries(normalizeParsedShapeSafe(overlayParsed)).forEach(([key, value]) => {
            if (value == null || value === "") return;
            if (key === "items") {
              out.items = { ...(out.items || {}) };
              Object.entries(value || {}).forEach(([itemKey, itemCount]) => {
                const numeric = Number(itemCount) || 0;
                if (numeric > 0) out.items[itemKey] = numeric;
              });
              if (!Object.keys(out.items).length) delete out.items;
              return;
            }
            out[key] = value;
          });
          return out;
        };

    function mergeCaptureAnalysisResults(localResult, visionResult, extractedText) {
      const localParsed = normalizeParsedShapeSafe(localResult?.finalParsed || localResult || {});
      const visionParsed = normalizeParsedShapeSafe(visionResult?.parsed || {});
      const merged = mergeParsedSafe(localParsed, visionParsed);
      const service = visionResult?.service === "clean" ? SERVICE.CLEAN : visionResult?.service === "move" ? SERVICE.MOVE : (localResult?.targetService || (typeof resolveServiceByText === "function" ? resolveServiceByText(extractedText || "") : (/입주청소|이사청소|거주청소|청소/.test(String(extractedText||"")) ? SERVICE.CLEAN : SERVICE.MOVE)));
      return {
        targetService: service,
        localParsed,
        visionParsed,
        finalParsed: normalizeParsedShapeSafe(merged),
        aiResponse: localResult?.aiResponse || null,
        visionSummary: String(visionResult?.summary || "").trim(),
        visionConfidence: Number(visionResult?.confidence || 0),
        extractedText: extractedText || String(visionResult?.extractedText || "").trim(),
        missingHints: Array.isArray(visionResult?.missingHints) ? visionResult.missingHints : [],
        source: visionResult?.__source || (localResult ? "vision+assist" : "vision"),
      };
    }
    async function fileToImageBitmapSafe(file) {
      if (window.createImageBitmap) {
        try { return await window.createImageBitmap(file); } catch (_) {}
      }
      return await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        };
        img.src = url;
      });
    }

    async function buildCaptureVariants(file) {
      const source = await fileToImageBitmapSafe(file);
      const width = source.width || source.naturalWidth || 0;
      const height = source.height || source.naturalHeight || 0;
      if (!width || !height) return [{ label: "원본", image: file }];

      const scale = Math.min(3, Math.max(2, 1800 / Math.max(width, height)));
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);

      const drawVariant = (mode) => new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        let min = 255;
        let max = 0;
        for (let i = 0; i < d.length; i += 4) {
          const gray = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
          min = Math.min(min, gray);
          max = Math.max(max, gray);
          d[i] = gray;
          d[i + 1] = gray;
          d[i + 2] = gray;
        }
        const span = Math.max(1, max - min);
        for (let i = 0; i < d.length; i += 4) {
          let v = Math.round(((d[i] - min) / span) * 255);
          if (mode === "contrast") v = v > 180 ? 255 : v < 120 ? 0 : v;
          if (mode === "soft") v = Math.min(255, Math.max(0, Math.round((v - 128) * 1.25 + 128)));
          d[i] = d[i + 1] = d[i + 2] = v;
        }
        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob((blob) => resolve({ label: mode, image: blob || file }), "image/png", 1);
      });

      return [
        { label: "원본", image: file },
        await drawVariant("soft"),
        await drawVariant("contrast"),
        await drawVariant("mono"),
      ];
    }

    async function runTesseractOnVariant(imageLike, pageLabel, variantLabel, progressBase, progressSpan) {
      const result = await window.Tesseract.recognize(imageLike, "kor+eng", {
        logger: (message) => {
          if (!message) return;
          if (message.status === "recognizing text") {
            const ratio = Number(message.progress || 0);
            const progress = progressBase + Math.round(ratio * progressSpan);
            updateEntryOcrProgress(`${pageLabel} · ${variantLabel} 분석 중`, progress, "이미지를 선명하게 보정한 뒤 텍스트 후보를 여러 번 비교하고 있어요.");
          } else if (message.status === "loading language traineddata") {
            updateEntryOcrProgress(`${pageLabel} · 한글 데이터 준비 중`, Math.max(8, progressBase - 6), "처음 한 번은 준비 시간이 조금 걸릴 수 있어요.");
          }
        },
        tessedit_pageseg_mode: 6,
        preserve_interword_spaces: "1",
      });
      return normalizeWhitespace(result?.data?.text || "");
    }

    async function extractTextFromCaptureFiles(files) {
      const outputs = [];
      for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
        const file = files[fileIndex];
        const pageLabel = `캡처 ${fileIndex + 1}/${files.length}`;
        updateEntryOcrProgress(`${pageLabel} 준비 중`, 10 + Math.round((fileIndex / Math.max(1, files.length)) * 18), "업로드한 캡처를 확대하고 대비를 올려서 읽기 쉬운 상태로 바꾸고 있어요.");
        const variants = await buildCaptureVariants(file);
        const results = [];
        for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
          const variant = variants[variantIndex];
          const totalSlots = Math.max(1, files.length * variants.length);
          const slot = fileIndex * variants.length + variantIndex;
          const base = 22 + Math.round((slot / totalSlots) * 52);
          const span = Math.max(8, Math.round(52 / totalSlots));
          const text = await runTesseractOnVariant(variant.image, pageLabel, variant.label, base, span);
          if (text) results.push(text);
        }
        const best = results
          .map((text) => ({ text, score: scoreOcrText(text) }))
          .sort((a, b) => b.score - a.score)[0];
        if (best?.text) outputs.push(best.text);
      }
      return mergeOcrTexts(outputs);
    }

    function findAddressCandidates(raw) {
      const lines = dedupeOcrLines(splitNormalizedLines(raw).map(normalizeOcrLine));
      return lines.filter((line) => /(?:서울|경기|인천|부천|광주|대전|대구|부산|울산|세종|제주|강원|충북|충남|전북|전남|경북|경남)\s/.test(line) || /(?:시|군|구)\s+.+(?:동|읍|면)/.test(line));
    }

    const captureItemAliasEntries = [
      ["냉장고(380L이하)", ["냉장고", "2도어 냉장고", "일반 냉장고"]],
      ["세탁기(12kg이하)", ["세탁기"]],
      ["건조기(12kg이하)", ["건조기"]],
      ["전자레인지", ["전자레인지"]],
      ["공기청정기", ["공기청정기"]],
      ["청소기", ["청소기"]],
      ["정수기(이동만)", ["정수기"]],
      ["TV/모니터", ["tv", "티비", "모니터", "인치티비", "인치 티비"]],
      ["의자", ["의자", "식탁의자", "책상의자"]],
      ["행거", ["행거"]],
      ["협탁/사이드테이블(소형)", ["협탁", "사이드테이블"]],
      ["화장대(소형)", ["화장대"]],
      ["책상/테이블(일반)", ["책상", "테이블", "원형테이블", "식탁", "원목테이블"]],
      ["서랍장(3~5단)", ["서랍장"]],
      ["책장(일반)", ["책장", "선반"]],
      ["수납장/TV장(일반)", ["수납장", "tv장", "티비장"]],
      ["소파(2~3인)", ["소파"]],
      ["침대매트리스(킹제외)", ["매트리스"]],
      ["침대프레임(분해/조립)", ["침대프레임", "침대 프레임"]],
    ];

    function escapeRegexSafe(str) {
      return String(str || "").replace(/[.*+?^${}()|[\]\]/g, "\$&");
    }

    function extractItemsSafe(raw) {
      if (typeof extractItems === "function") {
        try {
          return extractItems(raw);
        } catch (_) {}
      }
      const out = {};
      const text = String(raw || "").toLowerCase();
      captureItemAliasEntries.forEach(([key, aliases]) => {
        aliases.forEach((alias) => {
          const safe = escapeRegexSafe(alias.toLowerCase());
          const regex = new RegExp(`${safe}\s*(?:x|×|*|대)?\s*(\d+)`, "gi");
          let found = false;
          let match;
          while ((match = regex.exec(text))) {
            out[key] = (out[key] || 0) + Number(match[1] || 1);
            found = true;
          }
          if (!found && text.includes(alias.toLowerCase()) && !(key in out)) {
            out[key] = 1;
          }
        });
      });
      return out;
    }

    function fillMoveDetailsFromCandidates(raw, parsed) {
      const text = String(raw || "");
      const addressCandidates = findAddressCandidates(text);
      if (!parsed.startAddress && addressCandidates[0]) parsed.startAddress = addressCandidates[0];
      if (!parsed.endAddress && addressCandidates[1]) parsed.endAddress = addressCandidates[1];

      const serviceLine = splitNormalizedLines(text).find((line) => /서비스 대상/.test(line));
      if (serviceLine) {
        parsed.items = { ...(parsed.items || {}), ...extractItemsSafe(serviceLine) };
      }

      if (!parsed.moveDate) {
        const dateLine = splitNormalizedLines(text).find((line) => /(20\d{2})년\s*\d{1,2}월\s*\d{1,2}일/.test(line));
        if (dateLine) parsed.moveDate = parseDateValue(dateLine);
      }
      if (!parsed.timeSlot) {
        const timeRange = text.match(/(오전|오후)\s*\(?\s*(\d{1,2})\s*[~\-]\s*(\d{1,2})\s*시\s*\)?/);
        if (timeRange) {
          let hour = Number(timeRange[2]);
          if (timeRange[1] === "오후" && hour < 12) hour += 12;
          parsed.timeSlot = hour >= 7 && hour <= 15 ? String(hour) : parsed.timeSlot;
        }
      }

      const elevatorLine = splitNormalizedLines(text).find((line) => /엘리베이터 유무/.test(line));
      if (elevatorLine && /네|있음/.test(elevatorLine) && parsed.noFrom == null) parsed.noFrom = false;
      if (elevatorLine && /아니오|없음|계단/.test(elevatorLine)) parsed.noFrom = true;

      const destElevatorLine = splitNormalizedLines(text).find((line) => /도착지 엘리베이터/.test(line));
      if (destElevatorLine) {
        const floor = destElevatorLine.match(/(\d+)\s*층/);
        if (floor && !parsed.toFloor) parsed.toFloor = Number(floor[1]);
        if (/아니오|없음|계단/.test(destElevatorLine)) parsed.noTo = true;
        if (/네|있음/.test(destElevatorLine) && parsed.noTo == null) parsed.noTo = false;
      }

      const looseFloors = [...text.matchAll(/(\d+)\s*층/g)].map((m) => Number(m[1]));
      if (!parsed.toFloor && looseFloors.length) parsed.toFloor = looseFloors[looseFloors.length - 1];
      if (!parsed.fromFloor && looseFloors.length > 1) parsed.fromFloor = looseFloors[0];
      return parsed;
    }

    async function handleCaptureUpload(fileList) {
      const files = Array.from(fileList || []).filter(Boolean);
      if (!files.length) return;

      toggleEntryButtons(true);
      resetEntryReview();
      updateEntryOcrProgress("캡처를 불러오는 중이에요.", 8, "여러 장을 올렸다면 상단 정보와 요청 상세를 함께 비교해서 읽어요.");
      if (entryOcrPreview) entryOcrPreview.textContent = "이미지 분석 대기 중...";

      try {
        let visionResult = null;
        let ocrText = "";
        let localAnalysis = null;
        let extractedText = "";
        let sourceLabel = "vision";

        try {
          updateEntryOcrProgress("서버 이미지 분석을 시작할게요.", 16, "텍스트를 길게 읽는 대신 날짜·주소·층수·품목 필드를 우선 추출하고 있어요.");
          visionResult = await callCaptureVisionAPI(files);
          const visionFieldScore = countMeaningfulParsedFields(visionResult?.parsed || {});
          const previewText = [visionResult?.summary, visionResult?.extractedText].filter(Boolean).join("\n\n");
          if (entryOcrPreview && previewText) entryOcrPreview.textContent = previewText;
          extractedText = String(visionResult?.extractedText || "").trim();

          const shouldUseOcrAssist = visionFieldScore < 4;
          if (shouldUseOcrAssist) {
            if (!window.Tesseract?.recognize) {
              sourceLabel = "vision";
            } else {
              sourceLabel = "vision+ocr";
              updateEntryOcrProgress("서버 분석을 보완하는 중이에요.", 48, "핵심 필드가 조금 부족해서 OCR을 보조 힌트로만 추가하고 있어요.");
              ocrText = await extractTextFromCaptureFiles(files);
              extractedText = mergeOcrTexts([extractedText, ocrText]);
              if (entryOcrPreview) entryOcrPreview.textContent = [visionResult?.summary, extractedText].filter(Boolean).join("\n\n");
            }
          }
        } catch (visionError) {
          console.warn("capture vision unavailable, fallback to OCR:", visionError);
          if (!window.Tesseract?.recognize) {
            throw new Error("서버 이미지 분석이 실패했고 OCR 라이브러리도 불러오지 못했습니다.");
          }
          sourceLabel = "ocr-only";
          updateEntryOcrProgress("브라우저 OCR로 읽는 중이에요.", 42, "서버 분석을 사용할 수 없어 보조 OCR로만 읽고 있어요. 정확도는 조금 낮을 수 있어요.");
          ocrText = await extractTextFromCaptureFiles(files);
          extractedText = mergeOcrTexts([ocrText]);
          if (entryOcrPreview) entryOcrPreview.textContent = extractedText || "텍스트를 충분히 읽지 못했어요. 다른 캡처로 다시 시도해주세요.";
        }

        const visionFieldScore = countMeaningfulParsedFields(visionResult?.parsed || {});
        const shouldRunLocalAssist = sourceLabel === "ocr-only" || (!visionResult && extractedText && extractedText.length >= 8) || (visionFieldScore > 0 && visionFieldScore < 4 && extractedText && extractedText.length >= 8);
        if (shouldRunLocalAssist) {
          updateEntryOcrProgress("읽은 내용을 구조화하는 중이에요.", 88, "서버 필드가 부족한 부분만 보조 분석으로 채우고 있어요.");
          localAnalysis = extractedText && extractedText.length >= 8 ? await analyzeCaptureText(extractedText) : null;
        }

        if (!visionResult && (!extractedText || extractedText.length < 8)) {
          throw new Error("캡처에서 읽힌 정보가 너무 적어요.");
        }

        if (visionResult) visionResult.__source = sourceLabel;
        pendingCaptureParsed = mergeCaptureAnalysisResults(localAnalysis, visionResult, extractedText);
        if (pendingCaptureParsed?.targetService === SERVICE.MOVE) {
          pendingCaptureParsed.finalParsed = fillMoveDetailsFromCandidates(extractedText, normalizeParsedShapeSafe(pendingCaptureParsed.finalParsed || {}));
        }

        const captureUiState = getCaptureUiState(visionResult, pendingCaptureParsed, extractedText);
        const finalScore = countMeaningfulParsedFields(pendingCaptureParsed?.finalParsed || {});
        if (captureUiState.parseStatus === "fail" && finalScore < 3) {
          throw new Error(captureUiState.uiMessage?.message || "핵심 필드를 충분히 찾지 못했어요.");
        }

        const sourceText = sourceLabel === "vision" ? "서버 이미지 분석 사용" : sourceLabel === "vision+ocr" ? "서버 이미지 분석 + OCR 보조" : "OCR 보조 모드";
        const modelText = visionResult?.debug?.model ? ` · ${visionResult.debug.model}` : "";
        updateEntryOcrProgress(captureUiState.uiMessage?.title || "자동 분석이 끝났어요.", 100, `${captureUiState.uiMessage?.message || "읽어낸 필드를 먼저 확인해 주세요."} ${sourceText}${modelText ? `${modelText}` : ""}`.trim());
        renderEntryReview({ ...pendingCaptureParsed, parseStatus: captureUiState.parseStatus, uiMessage: captureUiState.uiMessage }, extractedText);
        if (captureUiState.textConsultRecommended) {
          openPhotoSmsFallbackModal(captureUiState.uiMessage?.message || "사진만으로는 정보 확인이 어려워요.");
        }
      } catch (error) {
        console.error("capture OCR failed:", error);
        const failMessage = String(error?.message || error || "알 수 없는 오류가 발생했습니다.");
        updateEntryOcrProgress("사진만으로는 정보 확인이 어려워요", 100, failMessage || "상단 정보 캡처와 요청 상세 캡처를 같이 올리면 더 정확해요. 어렵다면 직접 계산하기로 바로 진행해 주세요.");
        if (entryOcrPreview) {
          entryOcrPreview.textContent = entryOcrPreview.textContent?.trim() || failMessage;
        }
      } finally {
        toggleEntryButtons(false);
      }
    }

    function openPhotoSmsFallbackModal(reasonText = "사진에서 짐 정보를 충분히 읽지 못했어요.") {
      const reasonEl = document.getElementById("photoSmsFallbackReason");
      if (reasonEl) reasonEl.textContent = String(reasonText || "사진에서 짐 정보를 충분히 읽지 못했어요.");
      window.DDLOGI?.modal?.openModal?.("photoSmsFallbackModal");
    }

    function closePhotoSmsFallbackModal() {
      window.DDLOGI?.modal?.closeModal?.("photoSmsFallbackModal");
    }

    function goPhotoSmsFallback() {
      const template = [
        "안녕하세요. 사진으로 접수했는데 자동 분석이 어려워 문자 상담 요청드립니다.",
        "사진 첨부해서 다시 보내드릴게요.",
        "확인 부탁드립니다."
      ].join("\n");
      const sep = /iphone|ipad|ipod/i.test(navigator.userAgent) ? "&" : "?";
      window.location.href = `sms:${PHOTO_CONSULT_PHONE}${sep}body=${encodeURIComponent(template)}`;
    }

    async function handlePhotoConsultUpload(fileList) {
      const files = Array.from(fileList || []).filter(Boolean);
      if (!files.length) return;

      toggleEntryButtons(true);
      resetEntryReview();
      resetPhotoConsult();
      updatePhotoConsultProgress("짐 사진을 읽는 중이에요.", 8, "큰 짐, 생활짐, 상담사가 다시 물어봐야 할 항목을 우선 찾고 있어요.");

      try {
        const summary = await callPhotoConsultAPI(files);
        pendingPhotoConsult = { ...summary, files };
        renderPhotoConsultResult(summary);
        if (summary?.shouldRecommendSms || Number(summary?.confidence || 0) < 0.55) {
          openPhotoSmsFallbackModal(summary?.unreadableReason || "사진 각도나 화질 때문에 자동 요약 정확도가 낮아요.");
        }
      } catch (error) {
        console.error("photo consult failed:", error);
        updatePhotoConsultProgress("사진 요약을 만들지 못했어요.", 100, "사진은 선명한 정면 컷 3~5장으로 다시 올리거나 직접 문자로 보내주세요.");
        if (entryPhotoPreview) entryPhotoPreview.textContent = String(error?.message || error || "알 수 없는 오류가 발생했습니다.");
        openPhotoSmsFallbackModal(error?.message || "사진을 자동으로 파악하지 못했어요.");
      } finally {
        toggleEntryButtons(false);
      }
    }

    async function sharePhotoConsultResult() {
      if (!pendingPhotoConsult) return;
      const body = buildPhotoConsultBody(pendingPhotoConsult);
      const files = Array.isArray(pendingPhotoConsult.files) ? pendingPhotoConsult.files : [];
      if (navigator.share) {
        try {
          const sharePayload = { title: "디디운송 사진 상담", text: body };
          if (navigator.canShare && files.length) {
            const shareFiles = files.filter((file) => file instanceof File);
            if (shareFiles.length && navigator.canShare({ files: shareFiles })) {
              sharePayload.files = shareFiles;
            }
          }
          await navigator.share(sharePayload);
          return;
        } catch (error) {
          console.warn("photo consult share cancelled or failed:", error);
        }
      }
      try {
        await navigator.clipboard.writeText(body);
        alert("공유 기능을 바로 사용할 수 없어 상담 문구를 복사했어요. 문자나 카카오톡에 붙여넣고 사진을 첨부해 주세요.");
      } catch (_) {
        alert("공유 기능을 바로 사용할 수 없어요. 문자앱 열기 또는 요약 복사하기를 사용해 주세요.");
      }
    }

    manualEntryBtn?.addEventListener("click", () => {
      openCalculatorAt(getRecommendedStepIndex());
    });

    captureEntryBtn?.addEventListener("click", () => {
      resetPhotoConsult();
      if (captureUploadInput) {
        captureUploadInput.value = "";
        captureUploadInput.click();
      }
    });

    photoConsultBtn?.addEventListener("click", () => {
      resetEntryReview();
      if (photoConsultInput) {
        photoConsultInput.value = "";
        photoConsultInput.click();
      }
    });

    photoRetryBtn?.addEventListener("click", () => {
      resetPhotoConsult();
      if (photoConsultInput) {
        photoConsultInput.value = "";
        photoConsultInput.click();
      }
    });

    photoCopyBtn?.addEventListener("click", async () => {
      const body = buildPhotoConsultBody(pendingPhotoConsult || {});
      if (!body) return;
      try {
        await navigator.clipboard.writeText(body);
        alert("상담 문구를 복사했어요. 문자나 카카오톡에 붙여넣고 사진을 첨부해 주세요.");
      } catch (error) {
        console.error("photo consult copy failed:", error);
        alert("복사에 실패했어요. 다시 시도해 주세요.");
      }
    });

    photoSmsBtn?.addEventListener("click", () => {
      const body = buildPhotoConsultBody(pendingPhotoConsult || {});
      const sep = /iphone|ipad|ipod/i.test(navigator.userAgent) ? "&" : "?";
      window.location.href = `sms:${PHOTO_CONSULT_PHONE}${body ? `${sep}body=${encodeURIComponent(body)}` : ""}`;
    });

    document.getElementById("photoSmsFallbackBtn")?.addEventListener("click", goPhotoSmsFallback);
    document.getElementById("photoSmsFallbackCloseBtn")?.addEventListener("click", closePhotoSmsFallbackModal);

    photoShareBtn?.addEventListener("click", async () => {
      await sharePhotoConsultResult();
    });

    captureRetryBtn?.addEventListener("click", () => {
      resetEntryReview();
      if (captureUploadInput) captureUploadInput.value = "";
      captureUploadInput?.click();
    });

    entryReviewRetryBtn?.addEventListener("click", () => {
      resetEntryReview();
      if (captureUploadInput) captureUploadInput.value = "";
      captureUploadInput?.click();
    });

    entryReviewApplyBtn?.addEventListener("click", async () => {
      toggleEntryButtons(true);
      if (entryReviewApplyBtn) entryReviewApplyBtn.disabled = true;
      if (entryReviewRetryBtn) entryReviewRetryBtn.disabled = true;
      try {
        await applyPendingCaptureReview();
      } finally {
        toggleEntryButtons(false);
        if (entryReviewApplyBtn) entryReviewApplyBtn.disabled = false;
        if (entryReviewRetryBtn) entryReviewRetryBtn.disabled = false;
      }
    });

    captureUploadInput?.addEventListener("change", async (event) => {
      const files = Array.from(event.target?.files || []);
      if (!files.length) return;
      await handleCaptureUpload(files);
    });

    photoConsultInput?.addEventListener("change", async (event) => {
      const files = Array.from(event.target?.files || []);
      if (!files.length) return;
      await handlePhotoConsultUpload(files);
    });

    // Initial render
    const initialVisible = computeVisibleSteps();
    const initialFirst = initialVisible.findIndex((s) => {
      const t = getStepToken(s);
      return t !== 0 && t !== "service";
    });
    gotoStep(initialFirst >= 0 ? initialFirst : 0, { noScroll: true });
    renderAll();

    const askCleanBtn = $("#askClean");
    if (askCleanBtn && CROSS_LINK) askCleanBtn.textContent = DEFAULT_SERVICE === "clean" ? "디디운송으로 이동하기" : "디디클린으로 이동하기";

    const altServiceLink = document.querySelector(".alt-service-link");
    if (altServiceLink) {
      altServiceLink.setAttribute("href", CROSS_LINK || (DEFAULT_SERVICE === "clean" ? "/" : "/ddclean/"));
      altServiceLink.textContent = DEFAULT_SERVICE === "clean" ? "🚚 이사도 필요하시다면 클릭해주세요" : "🧼 청소도 필요하시다면 클릭해주세요";
    }

    updateStickyBarVisibility();

    window.addEventListener("load", updateStickyBarVisibility);
  });
})();

/* ===== Animation Helpers ===== */

/* 스크롤 등장 애니메이션 */
const revealObserver = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add("visible");
    }
  });
},{threshold:0.15});

document.querySelectorAll("section,.card,.service-card").forEach(el=>{
  el.classList.add("reveal");
  revealObserver.observe(el);
});


/* 가격 카운트 애니메이션 */
function animateNumber(el,newValue,duration=500){

  const start = parseInt(el.innerText.replace(/[^0-9]/g,'')) || 0
  const startTime = performance.now()

  function frame(time){

    const progress = Math.min((time-startTime)/duration,1)

    const value = Math.floor(start+(newValue-start)*progress)

    el.innerText = value.toLocaleString()

    if(progress < 1){
      requestAnimationFrame(frame)
    }

  }

  requestAnimationFrame(frame)

}


/* data-price 자동 애니메이션 */
document.querySelectorAll("[data-price]").forEach(el=>{

  const v = parseInt(el.dataset.price)

  if(!isNaN(v)){
    animateNumber(el,v)
  }

})


/* 거리 계산 버튼 로딩 */
const distanceBtn = document.querySelector("#calcDistance")

if(distanceBtn){

  distanceBtn.addEventListener("click",()=>{

    const original = distanceBtn.innerText

    distanceBtn.innerHTML =
    '거리 계산 중 <span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>'

    setTimeout(()=>{
      distanceBtn.innerText = original
    },2000)

  })

}

/* ===== FIX PATCH START ===== */

// 상태 통합
window.getAllItems = function(){
  const result = {};
  const merge = (src)=>{
    if(!src) return;
    Object.keys(src).forEach(k=>{
      result[k] = (result[k]||0) + src[k];
    });
  };
  merge(window.state?.items || {});
  merge(window.state?.waypointItems || {});
  return result;
};

// 거리 계산 보정
window.calculateTotalDistance = function(){
  if(!window.state?.waypoint){
    return window.getDistance?.(window.state.start, window.state.end) || 0;
  }
  return (window.getDistance?.(window.state.start, window.state.waypoint) || 0)
       + (window.getDistance?.(window.state.waypoint, window.state.end) || 0);
};

// 모달 복구
window.restoreItemsModal = function(){
  const modal = document.getElementById("itemsModal");
  if(modal && modal.parentElement !== document.body){
    document.body.appendChild(modal);
  }
};

// 버튼 중복 이벤트 방지
document.querySelectorAll(".item-plus").forEach(btn=>{
  btn.onclick = (e)=>{
    e.stopPropagation();
    if(window.updateItem){
      window.updateItem(btn.dataset.key, 1);
    }
  }
});

document.querySelectorAll(".item-minus").forEach(btn=>{
  btn.onclick = (e)=>{
    e.stopPropagation();
    if(window.updateItem){
      window.updateItem(btn.dataset.key, -1);
    }
  }
});

/* ===== FIX PATCH END ===== */