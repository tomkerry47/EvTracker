document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("authGraphql").addEventListener("click", authenticateGraphql);
  document.getElementById("loadCompletedDispatches").addEventListener("click", loadCompletedDispatches);
  document.getElementById("dispatchJson").addEventListener("input", runMergePreview);
  document.getElementById("tariffPence").addEventListener("input", runMergePreview);
  document.getElementById("focusDate").addEventListener("change", runMergePreview);
  setDefaultOctopusDates();
  loadCompletedDispatches();
});

async function authenticateGraphql() {
  try {
    hideError();
    const authButton = document.getElementById("authGraphql");
    authButton.disabled = true;
    authButton.textContent = "Authenticating...";

    const response = await fetch("/api/octopus/graphql/auth", { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to authenticate GraphQL.");
    }

    authButton.textContent = "GraphQL Authenticated";
  } catch (error) {
    const authButton = document.getElementById("authGraphql");
    authButton.textContent = "Authenticate GraphQL";
    showError(error.message || "Failed to authenticate GraphQL.");
  } finally {
    const authButton = document.getElementById("authGraphql");
    authButton.disabled = false;
  }
}

function setDefaultOctopusDates() {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 7);

  document.getElementById("octopusDateFrom").value = fromDate.toISOString().slice(0, 10);
  document.getElementById("octopusDateTo").value = today.toISOString().slice(0, 10);
  document.getElementById("focusDate").value = today.toISOString().slice(0, 10);
}

async function loadCompletedDispatches() {
  try {
    hideError();

    const dateFrom = document.getElementById("octopusDateFrom").value;
    const dateTo = document.getElementById("octopusDateTo").value;
    const accountNumber = document.getElementById("octopusAccountNumber").value.trim();

    if (!dateFrom || !dateTo) {
      throw new Error("Select Octopus from/to dates.");
    }

    const loadButton = document.getElementById("loadCompletedDispatches");
    loadButton.disabled = true;
    loadButton.textContent = "Loading...";

    const params = new URLSearchParams({
      dateFrom,
      dateTo
    });
    if (accountNumber) {
      params.set("accountNumber", accountNumber);
    }

    const response = await fetch(`/api/octopus/completed-dispatches?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load completed dispatches.");
    }

    document.getElementById("dispatchJson").value = JSON.stringify(data.dispatches || [], null, 2);
    runMergePreview();

    loadButton.disabled = false;
    loadButton.textContent = "Load completedDispatches";
  } catch (error) {
    const loadButton = document.getElementById("loadCompletedDispatches");
    loadButton.disabled = false;
    loadButton.textContent = "Load completedDispatches";
    showError(error.message || "Failed to load completed dispatches.");
  }
}

function runMergePreview() {
  try {
    hideError();
    const gapMinutes = 240;
    const tariffPence = parseFloat(document.getElementById("tariffPence").value);
    const inputText = document.getElementById("dispatchJson").value.trim();

    if (!Number.isFinite(tariffPence) || tariffPence < 0) {
      throw new Error("Tariff rate must be 0 or greater.");
    }
    if (!inputText) {
      throw new Error("No dispatch data loaded yet.");
    }

    const parsed = JSON.parse(inputText);
    const dispatches = extractDispatchArray(parsed).map(normalizeDispatch).filter(Boolean);
    const sessions = mergeDispatchesIntoSessions(dispatches, gapMinutes, tariffPence);

    renderSummary(dispatches, sessions);
    renderSessions(sessions);
    renderFocusSummary(sessions);
  } catch (error) {
    showError(error.message || "Failed to parse dispatch data.");
  }
}

function extractDispatchArray(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed.completed_dispatches)) {
    return parsed.completed_dispatches;
  }
  throw new Error("JSON must be an array or include a completed_dispatches array.");
}

function normalizeDispatch(item) {
  const startRaw = item.startDt || item.start || item.start_time;
  const endRaw = item.endDt || item.end || item.end_time;
  const kwhRaw = item.deltaKwh ?? item.charge_in_kwh ?? item.kwh ?? item.energy_added;

  const startDate = new Date(startRaw);
  const endDate = new Date(endRaw);
  const kwh = parseFloat(kwhRaw);

  if (!startRaw || !endRaw || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  if (!Number.isFinite(kwh)) {
    return null;
  }

  const durationHours = Math.max(0, (endDate - startDate) / (1000 * 60 * 60));
  const kw = durationHours > 0 ? Math.abs(kwh) / durationHours : 0;

  return {
    start: startDate,
    end: endDate,
    chargeInKwh: Math.abs(kwh),
    rawDeltaKwh: kwh,
    durationHours,
    kw,
    rawDelta: item.delta ?? null,
    rawMeta: item.meta ?? null,
    accountNumber: item.accountNumber ?? null,
    source: item.source || "unknown",
    location: item.location || "unknown"
  };
}

function mergeDispatchesIntoSessions(dispatches, gapMinutes, tariffPence) {
  const sorted = [...dispatches].sort((a, b) => a.start - b.start);
  const sessions = [];

  for (const dispatch of sorted) {
    const current = sessions[sessions.length - 1];

    if (!current) {
      sessions.push(startNewSession(dispatch));
      continue;
    }

    const gapMs = dispatch.start - current.end;
    const withinGap = gapMs <= gapMinutes * 60 * 1000;
    const sameLocation = dispatch.location === current.location;

    if (withinGap && sameLocation) {
      current.end = dispatch.end > current.end ? dispatch.end : current.end;
      current.totalKwh += dispatch.chargeInKwh;
      current.dispatchCount += 1;
      current.dispatches.push(dispatch);
      current.sources.add(dispatch.source);
    } else {
      sessions.push(startNewSession(dispatch));
    }
  }

  return sessions.map((session, index) => {
    const durationMs = session.end - session.start;
    const computedChargingHours = session.dispatches.reduce((sum, d) => sum + d.durationHours, 0);
    const chargingHours = session.dispatchCount > 0
      ? session.dispatchCount * 0.5
      : computedChargingHours;
    const cost = (session.totalKwh * tariffPence) / 100;
    const avgKw = chargingHours > 0 ? session.totalKwh / chargingHours : 0;
    const peakKw = session.dispatches.reduce((max, d) => Math.max(max, d.kw || 0), 0);
    const accountNumbers = Array.from(new Set(session.dispatches.map((d) => d.accountNumber).filter(Boolean)));
    const metaKeys = Array.from(
      new Set(
        session.dispatches
          .flatMap((d) => (d.rawMeta && typeof d.rawMeta === "object" ? Object.keys(d.rawMeta) : []))
      )
    );

    return {
      id: index + 1,
      date: formatDateOnly(session.start),
      startTime: formatTime(session.start),
      endTime: formatTime(session.end),
      startIso: session.start.toISOString(),
      endIso: session.end.toISOString(),
      totalKwh: session.totalKwh,
      durationHours: durationMs / (1000 * 60 * 60),
      chargingHours,
      avgKw,
      peakKw,
      dispatchCount: session.dispatchCount,
      location: session.location,
      sources: Array.from(session.sources),
      accountNumbers,
      metaKeys,
      estimatedCost: cost,
      dispatches: session.dispatches
    };
  });
}

function startNewSession(dispatch) {
  return {
    start: dispatch.start,
    end: dispatch.end,
    totalKwh: dispatch.chargeInKwh,
    dispatchCount: 1,
    location: dispatch.location,
    sources: new Set([dispatch.source]),
    dispatches: [dispatch]
  };
}

function renderSummary(dispatches, sessions) {
  const totalKwh = sessions.reduce((sum, s) => sum + s.totalKwh, 0);
  const totalCost = sessions.reduce((sum, s) => sum + s.estimatedCost, 0);
  const totalChargingHours = dispatches.reduce((sum, d) => sum + d.durationHours, 0);
  const avgKw = totalChargingHours > 0 ? totalKwh / totalChargingHours : 0;
  const peakKw = dispatches.reduce((max, d) => Math.max(max, d.kw || 0), 0);

  document.getElementById("dispatchCount").textContent = dispatches.length;
  document.getElementById("sessionCount").textContent = sessions.length;
  document.getElementById("totalKwh").textContent = `${totalKwh.toFixed(1)} kWh`;
  document.getElementById("totalCostEstimate").textContent = `£${totalCost.toFixed(2)}`;
  document.getElementById("avgKw").textContent = `${avgKw.toFixed(2)} kW`;
  document.getElementById("peakKw").textContent = `${peakKw.toFixed(2)} kW`;
  renderMetaSummary(dispatches);
}

function renderSessions(sessions) {
  const container = document.getElementById("mergedSessionsContainer");
  if (!sessions.length) {
    container.innerHTML = '<p class="no-sessions">No valid dispatches found in the JSON.</p>';
    return;
  }

  container.innerHTML = sessions.map((session) => {
    return `
      <div class="session-card">
        <div class="session-header">
          <div class="session-date">
            Session ${session.id} · ${session.date} ${session.startTime}-${session.endTime}
            <span class="session-source octopus">INTELLIGENT</span>
          </div>
        </div>
        <div class="session-details">
          <div class="detail-item">
            <span class="detail-label">Energy</span>
            <span class="detail-value">${session.totalKwh.toFixed(2)} kWh</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Charging Time</span>
            <span class="detail-value">${session.chargingHours.toFixed(2)} h</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Dispatches</span>
            <span class="detail-value">${session.dispatchCount}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Est. Cost</span>
            <span class="detail-value">£${session.estimatedCost.toFixed(2)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Avg Speed</span>
            <span class="detail-value">${session.avgKw.toFixed(2)} kW</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Peak Block</span>
            <span class="detail-value">${session.peakKw.toFixed(2)} kW</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Meta Keys</span>
            <span class="detail-value">${session.metaKeys.length ? session.metaKeys.join(", ") : "none"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Account</span>
            <span class="detail-value">${session.accountNumbers.length ? session.accountNumbers.join(", ") : "n/a"}</span>
          </div>
        </div>
        <div class="dispatch-graph">
          ${buildDispatchBars(session.dispatches)}
        </div>
        <details class="dispatch-breakdown">
          <summary>Show dispatch breakdown</summary>
          <table class="dispatch-table">
            <thead>
              <tr>
                <th>Start</th>
                <th>End</th>
                <th>Charged kWh</th>
                <th>Duration</th>
                <th>Speed</th>
                <th>Raw delta kWh</th>
                <th>Raw delta</th>
                <th>Source</th>
                <th>Location</th>
                <th>Meta</th>
              </tr>
            </thead>
            <tbody>
              ${session.dispatches.map((dispatch) => `
                <tr>
                  <td>${formatDateTime(dispatch.start)}</td>
                  <td>${formatDateTime(dispatch.end)}</td>
                  <td>${dispatch.chargeInKwh.toFixed(2)}</td>
                  <td>${(dispatch.durationHours * 60).toFixed(0)} min</td>
                  <td>${dispatch.kw.toFixed(2)} kW</td>
                  <td>${dispatch.rawDeltaKwh.toFixed(2)}</td>
                  <td>${dispatch.rawDelta ? JSON.stringify(dispatch.rawDelta) : "-"}</td>
                  <td>${dispatch.source}</td>
                  <td>${dispatch.location}</td>
                  <td>${dispatch.rawMeta ? escapeHtml(JSON.stringify(dispatch.rawMeta)) : "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </details>
      </div>
    `;
  }).join("");
}

function renderFocusSummary(sessions) {
  const focusDate = document.getElementById("focusDate").value;
  const summaryEl = document.getElementById("focusSummary");

  if (!focusDate) {
    summaryEl.textContent = "Select a focus date.";
    return;
  }

  const sameDaySessions = sessions.filter((session) => session.date === focusDate);
  if (!sameDaySessions.length) {
    summaryEl.textContent = `No merged session on ${focusDate}.`;
    return;
  }

  const topSession = sameDaySessions.reduce((best, current) =>
    current.totalKwh > best.totalKwh ? current : best
  );

  summaryEl.textContent = `${focusDate}: ${topSession.totalKwh.toFixed(2)} kWh across ${topSession.dispatchCount} blocks (${topSession.startTime}-${topSession.endTime}).`;
}

function buildDispatchBars(dispatches) {
  if (!dispatches.length) return "";
  const maxKwh = Math.max(...dispatches.map((d) => d.chargeInKwh), 0.01);
  return dispatches.map((dispatch) => {
    const width = Math.max(6, Math.round((dispatch.chargeInKwh / maxKwh) * 100));
    return `<div class="dispatch-bar-row"><span class="dispatch-bar-label">${formatTime(dispatch.start)}-${formatTime(dispatch.end)}</span><div class="dispatch-bar-track"><div class="dispatch-bar-fill" style="width:${width}%"></div></div><span class="dispatch-bar-kwh">${dispatch.chargeInKwh.toFixed(2)}kWh · ${dispatch.kw.toFixed(2)}kW</span></div>`;
  }).join("");
}

function renderMetaSummary(dispatches) {
  const target = document.getElementById("metaSummary");
  if (!target) return;
  const counts = {};

  for (const dispatch of dispatches) {
    if (dispatch.rawMeta && typeof dispatch.rawMeta === "object") {
      for (const key of Object.keys(dispatch.rawMeta)) {
        counts[key] = (counts[key] || 0) + 1;
      }
    }
  }

  const keys = Object.keys(counts).sort();
  if (!keys.length) {
    target.value = "No meta keys present in current payload.";
    return;
  }

  const lines = [
    "Meta keys found (count of blocks containing each key):",
    ...keys.map((key) => `- ${key}: ${counts[key]}`)
  ];
  target.value = lines.join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showError(message) {
  const errorEl = document.getElementById("errorMessage");
  errorEl.textContent = message;
  errorEl.style.display = "block";
}

function hideError() {
  const errorEl = document.getElementById("errorMessage");
  errorEl.style.display = "none";
  errorEl.textContent = "";
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDateTime(date) {
  return `${formatDateOnly(date)} ${formatTime(date)}`;
}
