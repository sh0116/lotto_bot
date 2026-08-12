const ODDS = {
  jackpot: 8145060,
};

const FALLBACK_DRAWS = [
  { round: 1236, numbers: [12, 18, 21, 29, 34, 38], bonus: 10 },
  { round: 1235, numbers: [3, 11, 16, 23, 31, 44], bonus: 8 },
  { round: 1234, numbers: [7, 14, 19, 28, 33, 42], bonus: 4 },
  { round: 1233, numbers: [2, 9, 18, 27, 35, 41], bonus: 13 },
  { round: 1232, numbers: [5, 16, 20, 24, 32, 39], bonus: 1 },
  { round: 1231, numbers: [6, 12, 17, 25, 30, 43], bonus: 22 },
  { round: 1230, numbers: [1, 8, 15, 21, 36, 40], bonus: 27 },
  { round: 1229, numbers: [10, 13, 16, 26, 34, 45], bonus: 5 },
  { round: 1228, numbers: [4, 11, 22, 29, 37, 44], bonus: 31 },
  { round: 1227, numbers: [7, 16, 18, 23, 32, 38], bonus: 2 },
  { round: 1226, numbers: [9, 14, 20, 28, 35, 41], bonus: 6 },
  { round: 1225, numbers: [3, 12, 19, 24, 33, 42], bonus: 16 },
];

const COLORS = ["#f4b842", "#54a6ff", "#ff6f61", "#aa7dff", "#5ef0b2", "#7d8791"];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let stats = [];
let hoveredNumber = null;
let pointer = { x: 0, y: 0 };
let drawMeta = {
  drawCount: FALLBACK_DRAWS.length,
  firstRound: FALLBACK_DRAWS.at(-1)?.round,
  lastRound: FALLBACK_DRAWS[0]?.round,
  sourceLabel: "내장 샘플",
};

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function ballClass(number) {
  if (number <= 10) return "c1";
  if (number <= 20) return "c2";
  if (number <= 30) return "c3";
  if (number <= 40) return "c4";
  return "c5";
}

function ballHtml(number, animate = false) {
  return `<span class="ball ${ballClass(number)} ${animate ? "roll" : ""}">${String(number).padStart(2, "0")}</span>`;
}

function buildStats(draws) {
  const rows = Array.from({ length: 45 }, (_, index) => ({
    number: index + 1,
    frequency: 0,
    lastSeenAgo: draws.length,
    score: 0,
  }));

  draws.forEach((draw, drawIndex) => {
    draw.numbers.forEach((number) => {
      const row = rows[number - 1];
      row.frequency += 1;
      row.lastSeenAgo = Math.min(row.lastSeenAgo, drawIndex);
    });
  });

  const maxFrequency = Math.max(...rows.map((row) => row.frequency), 1);
  const maxAgo = Math.max(...rows.map((row) => row.lastSeenAgo), 1);

  rows.forEach((row) => {
    const frequencySignal = row.frequency / maxFrequency;
    const overdueSignal = row.lastSeenAgo / maxAgo;
    const wobble = Math.abs(Math.sin(row.number * 12.9898)) * 0.18;
    row.score = Math.round((frequencySignal * 0.44 + overdueSignal * 0.38 + wobble) * 100);
  });

  return rows;
}

async function loadDraws() {
  try {
    const response = await fetch("./data/draws.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.draws) || payload.draws.length === 0) {
      throw new Error("draws.json에 회차 데이터가 없습니다.");
    }
    drawMeta = {
      drawCount: payload.drawCount || payload.draws.length,
      firstRound: payload.firstRound,
      lastRound: payload.lastRound,
      sourceLabel: payload.sourceLabel || "정적 데이터",
      generatedAt: payload.generatedAt,
    };
    return [...payload.draws].sort((a, b) => b.round - a.round);
  } catch (error) {
    drawMeta = {
      drawCount: FALLBACK_DRAWS.length,
      firstRound: FALLBACK_DRAWS.at(-1)?.round,
      lastRound: FALLBACK_DRAWS[0]?.round,
      sourceLabel: "내장 샘플",
    };
    return FALLBACK_DRAWS;
  }
}

function pickNumbers(rows) {
  return [...rows]
    .sort((a, b) => b.score - a.score || a.number - b.number)
    .slice(0, 6)
    .map((row) => row.number)
    .sort((a, b) => a - b);
}

function renderDataBadge() {
  const badge = document.querySelector("#dataBadge");
  const first = drawMeta.firstRound ? `${drawMeta.firstRound}` : "?";
  const last = drawMeta.lastRound ? `${drawMeta.lastRound}` : "?";
  badge.textContent =
    `${first}-${last}회 · ${formatNumber(drawMeta.drawCount)}회차 데이터 · ${drawMeta.sourceLabel}`;
}

function renderRankList(selector, rows, mode) {
  const root = document.querySelector(selector);
  root.innerHTML = rows.slice(0, 8).map((row, index) => {
    const value = mode === "resting" ? `${row.lastSeenAgo}회차 쉼` : `${row.frequency}회`;
    const sub = mode === "cold" ? `최근 공백 ${row.lastSeenAgo}회차` : `출현 ${row.frequency}회`;
    return `
      <div class="rank-item">
        <span class="rank-index">${index + 1}</span>
        ${ballHtml(row.number)}
        <div>
          <strong>${value}</strong>
          <small>${sub}</small>
        </div>
      </div>
    `;
  }).join("");
}

function renderHistory(rows) {
  renderRankList("#hotNumbers", [...rows].sort((a, b) => b.frequency - a.frequency || a.number - b.number), "hot");
  renderRankList("#coldNumbers", [...rows].sort((a, b) => a.frequency - b.frequency || a.number - b.number), "cold");
  renderRankList("#restingNumbers", [...rows].sort((a, b) => b.lastSeenAgo - a.lastSeenAgo || a.number - b.number), "resting");
}

function renderNumbers(numbers, animate = false) {
  document.querySelector("#heroNumbers").innerHTML = numbers.map((number) => ballHtml(number, animate)).join("");
  document.querySelector("#suggestedNumbers").innerHTML = numbers.map((number) => ballHtml(number, animate)).join("");
}

function drawHero(canvas, time = 0) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0d1114";
  ctx.fillRect(0, 0, width, height);

  const cx = width * (0.68 + pointer.x * 0.035);
  const cy = height * (0.44 + pointer.y * 0.035);
  const base = Math.min(width, height) * 0.23;

  ctx.save();
  ctx.globalAlpha = 0.28;
  for (let ring = 1; ring <= 5; ring += 1) {
    ctx.beginPath();
    ctx.strokeStyle = COLORS[ring % COLORS.length];
    ctx.lineWidth = Math.max(1, 1.4 * dpr);
    ctx.arc(cx, cy, base + ring * 42 * dpr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  for (let i = 0; i < 45; i += 1) {
    const drift = reducedMotion ? 0 : time * (0.00014 + (i % 7) * 0.00001);
    const angle = (i / 45) * Math.PI * 2 + drift;
    const wave = reducedMotion ? 0 : Math.sin(time * 0.001 + i) * 12 * dpr;
    const radius = base + (i % 5) * 35 * dpr + wave;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const size = (7 + (stats[i]?.score || 40) / 16) * dpr;

    const gradient = ctx.createRadialGradient(x - size * 0.3, y - size * 0.4, size * 0.2, x, y, size);
    gradient.addColorStop(0, "#fff9d7");
    gradient.addColorStop(0.22, COLORS[i % COLORS.length]);
    gradient.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.shadowColor = COLORS[i % COLORS.length];
    ctx.shadowBlur = 18 * dpr;
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  if (rect.width > 720) {
    ctx.shadowBlur = 0;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(245,241,232,0.92)";
    ctx.font = `${Math.round(18 * dpr)}px system-ui`;
    ctx.fillText("one ticket", cx, cy - 28 * dpr);
    ctx.fillStyle = "#f4b842";
    ctx.font = `900 ${Math.round(48 * dpr)}px system-ui`;
    ctx.fillText("1 : 8,145,060", cx, cy + 20 * dpr);
  }
}

function animateHero(time) {
  drawHero(document.querySelector("#heroCanvas"), time);
  if (!reducedMotion) requestAnimationFrame(animateHero);
}

function drawDistribution(canvas) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const padL = 46 * dpr;
  const padR = 18 * dpr;
  const padT = 24 * dpr;
  const padB = 38 * dpr;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const maxFrequency = Math.max(...stats.map((row) => row.frequency), 1);
  const barW = chartW / 45;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(245,241,232,0.025)";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(245,241,232,0.13)";
  ctx.lineWidth = 1 * dpr;
  for (let i = 0; i <= 4; i += 1) {
    const y = padT + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(width - padR, y);
    ctx.stroke();
  }

  stats.forEach((row, index) => {
    const active = hoveredNumber === null || hoveredNumber === row.number;
    const x = padL + index * barW + 2 * dpr;
    const barH = Math.max(5 * dpr, (row.frequency / maxFrequency) * chartH);
    const y = padT + chartH - barH;
    ctx.globalAlpha = active ? 1 : 0.23;
    ctx.fillStyle = COLORS[index % COLORS.length];
    ctx.shadowColor = COLORS[index % COLORS.length];
    ctx.shadowBlur = hoveredNumber === row.number ? 18 * dpr : 0;
    ctx.fillRect(x, y, Math.max(3 * dpr, barW - 4 * dpr), barH);
  });

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(245,241,232,0.64)";
  ctx.font = `700 ${Math.round(12 * dpr)}px system-ui`;
  ctx.textAlign = "center";
  [1, 10, 20, 30, 40, 45].forEach((number) => {
    const x = padL + (number - 0.5) * barW;
    ctx.fillText(String(number), x, height - 12 * dpr);
  });
}

function updateTooltip(event) {
  const canvas = document.querySelector("#distributionCanvas");
  const tooltip = document.querySelector("#chartTooltip");
  const label = document.querySelector("#selectedNumberLabel");
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const ratio = x / rect.width;
  const number = Math.min(45, Math.max(1, Math.ceil(ratio * 45)));
  const row = stats[number - 1];

  hoveredNumber = number;
  label.textContent = `${number}번`;
  tooltip.hidden = false;
  tooltip.style.left = `${Math.min(event.clientX - rect.left + 18, rect.width - 170)}px`;
  tooltip.style.top = `${Math.max(18, event.clientY - rect.top - 42)}px`;
  tooltip.innerHTML = `
    <strong>${number}번</strong><br>
    출현 ${row.frequency}회<br>
    최근 공백 ${row.lastSeenAgo}회차<br>
    장난감 신호 ${row.score}
  `;
  drawDistribution(canvas);
}

function clearTooltip() {
  hoveredNumber = null;
  document.querySelector("#chartTooltip").hidden = true;
  document.querySelector("#selectedNumberLabel").textContent = "전체 번호";
  drawDistribution(document.querySelector("#distributionCanvas"));
}

function updateSimulator() {
  const gamesPerWeek = Math.max(1, Number(document.querySelector("#gamesPerWeek").value) || 1);
  const years = Math.max(1, Number(document.querySelector("#years").value) || 1);
  const price = Math.max(1000, Number(document.querySelector("#price").value) || 1000);
  const totalGames = Math.round(gamesPerWeek * 52 * years);
  const chance = 1 - Math.pow(1 - 1 / ODDS.jackpot, totalGames);
  const percent = chance * 100;
  const meterPercent = Math.max(0.35, Math.min(100, percent * 120));

  document.querySelector("#gamesPerWeekOut").textContent = `${gamesPerWeek}게임`;
  document.querySelector("#yearsOut").textContent = `${years}년`;
  document.querySelector("#jackpotChance").textContent = `${percent.toFixed(5)}%`;
  document.querySelector("#totalGames").textContent = `${formatNumber(totalGames)}게임`;
  document.querySelector("#totalSpend").textContent = `${formatNumber(totalGames * price)}원`;
  document.querySelector("#chanceMeter").style.width = `${meterPercent}%`;
  document.querySelector("#plainSummary").textContent =
    `${years}년 동안 매주 ${gamesPerWeek}게임. 그래도 미터가 살짝만 움직입니다. 이게 로또의 매운맛입니다.`;
}

function reshuffle() {
  const boosted = stats
    .map((row) => ({ ...row, score: row.score + Math.random() * 24 }))
    .sort((a, b) => b.score - a.score || a.number - b.number);
  renderNumbers(boosted.slice(0, 6).map((row) => row.number).sort((a, b) => a - b), true);
}

async function init() {
  const draws = await loadDraws();
  stats = buildStats(draws);
  renderDataBadge();
  renderNumbers(pickNumbers(stats), false);
  renderHistory(stats);
  updateSimulator();

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
  );
  document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

  const distributionCanvas = document.querySelector("#distributionCanvas");
  distributionCanvas.addEventListener("mousemove", updateTooltip);
  distributionCanvas.addEventListener("mouseleave", clearTooltip);
  distributionCanvas.addEventListener("touchstart", (event) => updateTooltip(event.touches[0]), { passive: true });
  distributionCanvas.addEventListener("touchmove", (event) => updateTooltip(event.touches[0]), { passive: true });
  distributionCanvas.addEventListener("touchend", clearTooltip);

  document.querySelector("#shuffleBtn").addEventListener("click", reshuffle);
  ["#gamesPerWeek", "#years", "#price"].forEach((selector) => {
    document.querySelector(selector).addEventListener("input", updateSimulator);
  });

  window.addEventListener("resize", () => {
    drawHero(document.querySelector("#heroCanvas"), performance.now());
    drawDistribution(distributionCanvas);
  });
  window.addEventListener("pointermove", (event) => {
    if (reducedMotion) return;
    pointer = {
      x: event.clientX / window.innerWidth - 0.5,
      y: event.clientY / window.innerHeight - 0.5,
    };
  });
  window.addEventListener("scroll", () => {
    document.body.classList.toggle("nav-hidden", window.scrollY > 180);
  }, { passive: true });

  drawDistribution(distributionCanvas);
  if (reducedMotion) {
    drawHero(document.querySelector("#heroCanvas"), 0);
  } else {
    requestAnimationFrame(animateHero);
  }
}

init();
