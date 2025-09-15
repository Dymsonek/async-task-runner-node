(function () {
  const $ = (sel) => document.querySelector(sel);
  const modeEl = $('#mode');
  const limitEl = $('#limit');
  const timeoutMsEl = $('#timeoutMs');
  const failFastEl = $('#failFast');
  const retriesEl = $('#retries');
  const retryDelayMsEl = $('#retryDelayMs');
  const backoffFactorEl = $('#backoffFactor');
  const jitterRatioEl = $('#jitterRatio');
  const countEl = $('#count');
  const minEl = $('#min');
  const maxEl = $('#max');
  const failAtEl = $('#failAt');
  const tasksJsonEl = $('#tasksJson');
  const statusEl = $('#status');
  const summaryEl = $('#summary');
  const timelineEl = $('#timeline');

  function parseFailAt(str) {
    if (!str) return [];
    return str.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isInteger(n) && n > 0);
  }

  function buildPayload() {
    const mode = modeEl.value;
    const failFast = !!failFastEl.checked;
    const payload = { mode, failFast };
    if (mode === 'parallelLimit') {
      payload.limit = parseInt(limitEl.value || '2', 10);
    }

    const tStr = (timeoutMsEl?.value || '').trim();
    if (tStr) {
      const tVal = parseInt(tStr, 10);
      if (Number.isInteger(tVal) && tVal > 0) {
        payload.timeoutMs = tVal;
      }
    }

    const rStr = (retriesEl?.value || '').trim();
    if (rStr) {
      const v = parseInt(rStr, 10);
      if (Number.isInteger(v) && v >= 0) payload.retries = v;
    }
    const rdStr = (retryDelayMsEl?.value || '').trim();
    if (rdStr) {
      const v = parseInt(rdStr, 10);
      if (Number.isInteger(v) && v >= 0) payload.retryDelayMs = v;
    }
    const bfStr = (backoffFactorEl?.value || '').trim();
    if (bfStr) {
      const v = Number(bfStr);
      if (Number.isFinite(v) && v >= 1) payload.backoffFactor = v;
    }
    const jrStr = (jitterRatioEl?.value || '').trim();
    if (jrStr) {
      const v = Number(jrStr);
      if (Number.isFinite(v) && v >= 0 && v <= 1) payload.jitterRatio = v;
    }

    const txt = tasksJsonEl.value.trim();
    if (txt) {
      try { payload.tasks = JSON.parse(txt); }
      catch (e) { throw new Error('Invalid tasks JSON'); }
    } else {
      payload.tasks = {
        count: parseInt(countEl.value || '6', 10),
        min: parseInt(minEl.value || '100', 10),
        max: parseInt(maxEl.value || '800', 10),
        failAt: parseFailAt(failAtEl.value)
      };
    }
    return payload;
  }

  function renderSummary(obj) {
    summaryEl.textContent = JSON.stringify(obj, null, 2);
  }

  function renderTimeline(summary) {
    const results = Array.isArray(summary?.results) ? summary.results : [];
    timelineEl.innerHTML = '';
    if (!results.length) {
      timelineEl.textContent = 'No results to visualize';
      return;
    }
    const withTimes = results.filter(r => Number.isFinite(r.startedAt) && Number.isFinite(r.finishedAt));
    if (!withTimes.length) {
      timelineEl.textContent = 'No timing data available';
      return;
    }
    const minStart = Math.min(...withTimes.map(r => r.startedAt));
    const maxFinish = Math.max(...withTimes.map(r => r.finishedAt));
    const total = Math.max(1, maxFinish - minStart);

    const PX = 800; // base width
    const scale = PX / total;

    // Legend
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = '<span>Scale: ' + total + ' ms → ' + PX + ' px</span><span>ok=green</span><span>error=red</span>';
    timelineEl.appendChild(legend);

    results.forEach((r) => {
      const track = document.createElement('div');
      track.className = 'track';
      track.style.width = PX + 'px';
      const left = Math.max(0, (r.startedAt - minStart) * scale);
      const width = Math.max(1, (r.durationMs || 0) * scale);
      const bar = document.createElement('div');
      bar.className = 'bar ' + (r.status === 'ok' ? 'ok' : r.status === 'error' ? 'error' : 'unknown');
      bar.style.left = left + 'px';
      bar.style.width = width + 'px';
      bar.title = `Task ${r.id} (${r.status}) - ${r.durationMs ?? '?'} ms`;
      bar.textContent = `#${r.id}`;
      track.appendChild(bar);
      timelineEl.appendChild(track);
    });
  }

  modeEl.addEventListener('change', () => {
    const showLimit = modeEl.value === 'parallelLimit';
    limitEl.disabled = !showLimit;
  });
  modeEl.dispatchEvent(new Event('change'));

  $('#runBtn').addEventListener('click', async () => {
    summaryEl.textContent = '';
    timelineEl.textContent = '';
    statusEl.textContent = 'Running...';
    try {
      const payload = buildPayload();
      const res = await fetch('/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        statusEl.textContent = 'Error';
        renderSummary(data);
        renderTimeline(data.summary);
        return;
      }
      statusEl.textContent = 'Completed';
      renderSummary(data);
      renderTimeline(data);
    } catch (e) {
      statusEl.textContent = 'Failed: ' + e.message;
    }
  });
})();
