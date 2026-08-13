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
const BACKTEST_WINDOW = 300;
const FAVORITE_NUMBER = 16;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let stats = [];
let backtestReport = null;
let semiautoReport = null;
let hoveredNumber = null;
let pointer = { x: 0, y: 0 };
let drawMeta = {
  drawCount: FALLBACK_DRAWS.length,
  firstRound: FALLBACK_DRAWS.at(-1)?.round,
  lastRound: FALLBACK_DRAWS[0]?.round,
  sourceLabel: "내장 샘플",
  latestDraw: FALLBACK_DRAWS[0],
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

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function deterministicWobble(number, salt = 0) {
  return Math.abs(Math.sin(number * 12.9898 + salt * 78.233)) % 1;
}

function strategyScore(row, rows, strategyId) {
  const maxFrequency = Math.max(...rows.map((item) => item.frequency), 1);
  const minFrequency = Math.min(...rows.map((item) => item.frequency));
  const maxAgo = Math.max(...rows.map((item) => item.lastSeenAgo), 1);
  const frequencySignal = row.frequency / maxFrequency;
  const coldSignal = maxFrequency === minFrequency
    ? 0
    : (maxFrequency - row.frequency) / (maxFrequency - minFrequency);
  const overdueSignal = row.lastSeenAgo / maxAgo;
  const expectedFrequency = rows.reduce((sum, item) => sum + item.frequency, 0) / rows.length;
  const deficitSignal = clamp((expectedFrequency - row.frequency) / Math.max(expectedFrequency - minFrequency, 1));
  const wobble = deterministicWobble(row.number, rows.length) * 0.06;

  if (strategyId === "hot") return frequencySignal;
  if (strategyId === "cold") return coldSignal;
  if (strategyId === "resting") return overdueSignal;
  if (strategyId === "overdueCold") return deficitSignal * 0.56 + overdueSignal * 0.38 + wobble;
  if (strategyId === "hybrid") return frequencySignal * 0.36 + overdueSignal * 0.42 + wobble * 2.6;
  return row.score / 100;
}

function selectNumbersByStrategy(rows, strategyId) {
  return [...rows]
    .map((row) => ({ ...row, strategyScore: strategyScore(row, rows, strategyId) }))
    .sort((a, b) => b.strategyScore - a.strategyScore || b.lastSeenAgo - a.lastSeenAgo || a.number - b.number)
    .slice(0, 6)
    .map((row) => row.number)
    .sort((a, b) => a - b);
}

const STRATEGIES = [
  {
    id: "overdueCold",
    name: "덜 나온 + 오래 쉼",
    short: "큰수 장난감",
    description: "최근 300회에서 기대 횟수보다 덜 나온 정도와 최근 공백을 함께 봅니다.",
  },
  {
    id: "resting",
    name: "오래 쉰 번호",
    short: "Resting",
    description: "가장 오래 당첨번호에 없었던 숫자부터 고릅니다.",
  },
  {
    id: "cold",
    name: "덜 나온 번호",
    short: "Cold",
    description: "최근 300회에서 출현 횟수가 낮은 숫자를 우선합니다.",
  },
  {
    id: "hot",
    name: "자주 나온 번호",
    short: "Hot",
    description: "최근 300회에서 출현 횟수가 높은 숫자를 우선합니다.",
  },
  {
    id: "hybrid",
    name: "Hot + Resting 혼합",
    short: "Hybrid",
    description: "자주 나온 신호와 오래 쉰 신호를 섞고 작은 흔들림을 더합니다.",
  },
];

function countMatches(pick, draw) {
  const winning = new Set(draw.numbers);
  return pick.reduce((count, number) => count + (winning.has(number) ? 1 : 0), 0);
}

function combinationCount(n, r) {
  if (r < 0 || r > n) return 0;
  let top = 1;
  let bottom = 1;
  for (let i = 1; i <= r; i += 1) {
    top *= n - r + i;
    bottom *= i;
  }
  return top / bottom;
}

function matchDistributionForSemiAuto(fixedNumbers, winningNumbers) {
  const fixed = new Set(fixedNumbers);
  const winning = new Set(winningNumbers);
  const fixedHits = fixedNumbers.filter((number) => winning.has(number)).length;
  const autoPickCount = 6 - fixedNumbers.length;
  const population = 45 - fixedNumbers.length;
  const remainingWins = 6 - fixedHits;
  const denominator = combinationCount(population, autoPickCount);
  const distribution = Array.from({ length: 7 }, () => 0);

  for (let autoHits = 0; autoHits <= autoPickCount; autoHits += 1) {
    const ways = combinationCount(remainingWins, autoHits) *
      combinationCount(population - remainingWins, autoPickCount - autoHits);
    distribution[fixedHits + autoHits] += ways / denominator;
  }

  return distribution;
}

function evaluateSemiAuto(draws, fixedNumbers) {
  const distribution = Array.from({ length: 7 }, () => 0);
  let allFixedHitRounds = 0;

  draws.forEach((draw) => {
    const winning = new Set(draw.numbers);
    if (fixedNumbers.every((number) => winning.has(number))) allFixedHitRounds += 1;
    matchDistributionForSemiAuto(fixedNumbers, draw.numbers).forEach((probability, matches) => {
      distribution[matches] += probability;
    });
  });

  const drawCount = draws.length || 1;
  return {
    fixedNumbers,
    allFixedHitRounds,
    averageMatches: distribution.reduce((sum, probability, matches) => sum + matches * probability, 0) / drawCount,
    hit3Rate: distribution.slice(3).reduce((sum, probability) => sum + probability, 0) / drawCount,
    hit4Rate: distribution.slice(4).reduce((sum, probability) => sum + probability, 0) / drawCount,
    hit5Rate: distribution.slice(5).reduce((sum, probability) => sum + probability, 0) / drawCount,
  };
}

function buildSemiAutoReport(draws) {
  const numbers = Array.from({ length: 45 }, (_, index) => index + 1).filter((number) => number !== FAVORITE_NUMBER);
  const groups = [
    {
      fixedCount: 0,
      title: "완전 자동",
      candidates: [[]],
    },
    {
      fixedCount: 1,
      title: "1개 반자동",
      candidates: [[FAVORITE_NUMBER]],
    },
    {
      fixedCount: 2,
      title: "2개 반자동",
      candidates: numbers.map((number) => [FAVORITE_NUMBER, number].sort((a, b) => a - b)),
    },
    {
      fixedCount: 3,
      title: "3개 반자동",
      candidates: numbers.flatMap((first, firstIndex) =>
        numbers.slice(firstIndex + 1).map((second) => [FAVORITE_NUMBER, first, second].sort((a, b) => a - b)),
      ),
    },
  ];

  const baselineDistribution = Array.from({ length: 7 }, (_, matches) =>
    combinationCount(6, matches) * combinationCount(39, 6 - matches) / combinationCount(45, 6),
  );
  const baseline = {
    title: "완전 자동",
    fixedCount: 0,
    combinationCount: 1,
    best: {
      fixedNumbers: [],
      allFixedHitRounds: 0,
      averageMatches: 6 * 6 / 45,
      hit3Rate: baselineDistribution.slice(3).reduce((sum, probability) => sum + probability, 0),
      hit4Rate: baselineDistribution.slice(4).reduce((sum, probability) => sum + probability, 0),
      hit5Rate: baselineDistribution.slice(5).reduce((sum, probability) => sum + probability, 0),
    },
  };

  const reports = groups.slice(1).map((group) => {
    const results = group.candidates.map((candidate) => evaluateSemiAuto(draws, candidate));
    results.sort((a, b) =>
      b.hit3Rate - a.hit3Rate ||
      b.hit4Rate - a.hit4Rate ||
      b.averageMatches - a.averageMatches ||
      a.fixedNumbers.join("-").localeCompare(b.fixedNumbers.join("-")),
    );

    return {
      ...group,
      combinationCount: group.candidates.length,
      best: results[0],
      topByAverage: [...results].sort((a, b) => b.averageMatches - a.averageMatches || a.fixedNumbers.join("-").localeCompare(b.fixedNumbers.join("-")))[0],
      ranges: {
        hit3Rate: summarizeValues(results.map((result) => result.hit3Rate)),
        hit4Rate: summarizeValues(results.map((result) => result.hit4Rate)),
        averageMatches: summarizeValues(results.map((result) => result.averageMatches)),
      },
    };
  });

  return {
    favoriteNumber: FAVORITE_NUMBER,
    drawCount: draws.length,
    baseline,
    reports,
  };
}

function summarizeValues(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    min: sorted[0] || 0,
    median: sorted.length % 2 ? sorted[middle] : ((sorted[middle - 1] || 0) + (sorted[middle] || 0)) / 2,
    max: sorted.at(-1) || 0,
  };
}

function runBacktest(draws) {
  const chronological = [...draws].sort((a, b) => a.round - b.round);
  const startIndex = Math.min(BACKTEST_WINDOW, Math.max(50, chronological.length - BACKTEST_WINDOW));
  const results = STRATEGIES.map((strategy) => ({
    ...strategy,
    rounds: 0,
    totalMatches: 0,
    hit3Plus: 0,
    hit4Plus: 0,
    maxMatch: 0,
    distribution: [0, 0, 0, 0, 0, 0, 0],
    latestPick: [],
  }));

  for (let index = startIndex; index < chronological.length; index += 1) {
    const history = chronological.slice(Math.max(0, index - BACKTEST_WINDOW), index).reverse();
    const rows = buildStats(history);
    const draw = chronological[index];

    results.forEach((result) => {
      const pick = selectNumbersByStrategy(rows, result.id);
      const matches = countMatches(pick, draw);
      result.rounds += 1;
      result.totalMatches += matches;
      result.hit3Plus += matches >= 3 ? 1 : 0;
      result.hit4Plus += matches >= 4 ? 1 : 0;
      result.maxMatch = Math.max(result.maxMatch, matches);
      result.distribution[matches] += 1;
    });
  }

  const latestWindow = chronological.slice(-BACKTEST_WINDOW).reverse();
  const latestRows = buildStats(latestWindow);
  results.forEach((result) => {
    result.averageMatches = result.rounds ? result.totalMatches / result.rounds : 0;
    result.hit3Rate = result.rounds ? result.hit3Plus / result.rounds : 0;
    result.hit4Rate = result.rounds ? result.hit4Plus / result.rounds : 0;
    result.latestPick = selectNumbersByStrategy(latestRows, result.id);
  });

  results.sort((a, b) =>
    b.hit3Rate - a.hit3Rate ||
    b.averageMatches - a.averageMatches ||
    b.hit4Rate - a.hit4Rate ||
    a.name.localeCompare(b.name, "ko-KR"),
  );

  return {
    window: Math.min(BACKTEST_WINDOW, chronological.length),
    firstTestRound: chronological[startIndex]?.round,
    lastTestRound: chronological.at(-1)?.round,
    results,
    winner: results[0],
  };
}

async function loadDraws() {
  try {
    const response = await fetch("./data/draws.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.draws) || payload.draws.length === 0) {
      throw new Error("draws.json에 회차 데이터가 없습니다.");
    }
    const sortedDraws = [...payload.draws].sort((a, b) => b.round - a.round);
    drawMeta = {
      drawCount: payload.drawCount || payload.draws.length,
      firstRound: payload.firstRound,
      lastRound: payload.lastRound,
      sourceLabel: payload.sourceLabel || "정적 데이터",
      generatedAt: payload.generatedAt,
      latestDraw: sortedDraws[0],
    };
    return sortedDraws;
  } catch (error) {
    drawMeta = {
      drawCount: FALLBACK_DRAWS.length,
      firstRound: FALLBACK_DRAWS.at(-1)?.round,
      lastRound: FALLBACK_DRAWS[0]?.round,
      sourceLabel: "내장 샘플",
      latestDraw: FALLBACK_DRAWS[0],
    };
    return FALLBACK_DRAWS;
  }
}

function pickNumbers(rows) {
  return selectNumbersByStrategy(rows, backtestReport?.winner?.id || "overdueCold");
}

function renderDataBadge() {
  const badge = document.querySelector("#dataBadge");
  const first = drawMeta.firstRound ? `${drawMeta.firstRound}` : "?";
  const last = drawMeta.lastRound ? `${drawMeta.lastRound}` : "?";
  badge.textContent =
    `${first}-${last}회 · ${formatNumber(drawMeta.drawCount)}회차 데이터 · ${drawMeta.sourceLabel}`;
}

function renderLatestDraw() {
  const root = document.querySelector("#latestDraw");
  const draw = drawMeta.latestDraw;
  if (!draw) {
    root.hidden = true;
    return;
  }
  const dateText = draw.date ? ` · ${draw.date}` : "";
  root.hidden = false;
  root.innerHTML = `
    <div>
      <span>가장 최근 당첨번호</span>
      <strong>${draw.round}회${dateText}</strong>
    </div>
    <div class="latest-balls">
      ${draw.numbers.map((number) => ballHtml(number)).join("")}
      <span class="bonus-label">+</span>
      ${ballHtml(draw.bonus)}
    </div>
  `;
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

function percentText(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function renderBacktest(report) {
  const winner = report.winner;
  document.querySelector("#winnerName").textContent = winner.name;
  document.querySelector("#winnerDescription").textContent =
    `${winner.description} ${report.firstTestRound}-${report.lastTestRound}회 구간에서 3개 이상 맞은 비율이 가장 높았습니다.`;
  document.querySelector("#winnerNumbers").innerHTML = winner.latestPick.map((number) => ballHtml(number)).join("");
  document.querySelector("#winnerHitRate").textContent = percentText(winner.hit3Rate);
  document.querySelector("#winnerAverage").textContent = winner.averageMatches.toFixed(2);
  document.querySelector("#winnerRounds").textContent = `${formatNumber(winner.rounds)}회`;

  document.querySelector("#logicBoard").innerHTML = report.results.map((result, index) => {
    const isWinner = index === 0;
    return `
      <article class="logic-card ${isWinner ? "winner" : ""}">
        <div class="logic-card-top">
          <span>${result.short}</span>
          <strong>${isWinner ? "BEST" : `#${index + 1}`}</strong>
        </div>
        <h3>${result.name}</h3>
        <p>${result.description}</p>
        <div class="logic-card-balls">${result.latestPick.map((number) => ballHtml(number)).join("")}</div>
        <div class="logic-card-stats">
          <span>3+ ${percentText(result.hit3Rate)}</span>
          <span>4+ ${percentText(result.hit4Rate)}</span>
          <span>평균 ${result.averageMatches.toFixed(2)}</span>
          <span>최대 ${result.maxMatch}개</span>
        </div>
      </article>
    `;
  }).join("");
}

function renderSemiAuto(report) {
  const baseline = report.baseline.best;
  document.querySelector("#autoHitRate").textContent = percentText(baseline.hit3Rate);
  document.querySelector("#autoHighRate").textContent = percentText(baseline.hit4Rate);
  document.querySelector("#autoAverage").textContent = baseline.averageMatches.toFixed(2);

  const bestThree = report.reports.at(-1)?.best;
  document.querySelector("#semiautoStats").innerHTML = `
    <article class="stat-flash">
      <span>분석 조합</span>
      <strong>${formatNumber(report.reports.reduce((sum, group) => sum + group.combinationCount, 0))}</strong>
      <small>16 포함 반자동 후보</small>
    </article>
    <article class="stat-flash accent">
      <span>최고 3+ 기대</span>
      <strong>${bestThree ? percentText(bestThree.hit3Rate) : "-"}</strong>
      <small>${bestThree ? bestThree.fixedNumbers.map((number) => String(number).padStart(2, "0")).join(" · ") : "계산 중"}</small>
    </article>
    <article class="stat-flash">
      <span>자동 대비</span>
      <strong>${bestThree ? `+${((bestThree.hit3Rate - baseline.hit3Rate) * 100).toFixed(1)}%p` : "-"}</strong>
      <small>과거 데이터 기대값 기준</small>
    </article>
  `;

  document.querySelector("#semiautoBoard").innerHTML = report.reports.map((group) => {
    const best = group.best;
    const averageNote = group.topByAverage.fixedNumbers.join(", ") === best.fixedNumbers.join(", ")
      ? "평균 적중도 같은 조합이 1위입니다."
      : `평균 적중 1위는 ${group.topByAverage.fixedNumbers.map((number) => String(number).padStart(2, "0")).join(" · ")}입니다.`;
    return `
      <article class="semiauto-card">
        <div class="logic-card-top">
          <span>${group.combinationCount}가지 비교</span>
          <strong>${group.title}</strong>
        </div>
        <div class="semiauto-balls">${best.fixedNumbers.length ? best.fixedNumbers.map((number) => ballHtml(number)).join("") : "<span class=\"auto-chip\">AUTO</span>"}</div>
        <p>
          ${best.fixedNumbers.length ? `${best.fixedNumbers.map((number) => String(number).padStart(2, "0")).join(" · ")} 고정` : "번호 고정 없음"} 기준이
          ${report.drawCount}회 데이터에서 3개 이상 기대치가 가장 높았습니다.
        </p>
        <div class="logic-card-stats">
          <span>3+ ${percentText(best.hit3Rate)}</span>
          <span>4+ ${percentText(best.hit4Rate)}</span>
          <span>5+ ${(best.hit5Rate * 100).toFixed(4)}%</span>
          <span>평균 ${best.averageMatches.toFixed(2)}</span>
        </div>
        <div class="range-strip" aria-label="${group.title} 전체 후보 범위">
          <span style="--range: ${Math.max(6, group.ranges.hit3Rate.max * 2200)}%">
            3+ 범위 ${percentText(group.ranges.hit3Rate.min)}-${percentText(group.ranges.hit3Rate.max)}
          </span>
          <span style="--range: ${Math.max(6, group.ranges.averageMatches.max * 80)}%">
            평균 범위 ${group.ranges.averageMatches.min.toFixed(2)}-${group.ranges.averageMatches.max.toFixed(2)}
          </span>
        </div>
        <small>${best.allFixedHitRounds}회차에서 고정 숫자가 모두 실제 당첨번호에 포함. ${averageNote}</small>
      </article>
    `;
  }).join("");
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
  const strategyId = backtestReport?.winner?.id || "overdueCold";
  const boosted = stats
    .map((row) => ({
      ...row,
      score: strategyScore(row, stats, strategyId) * 100 + Math.random() * 18,
    }))
    .sort((a, b) => b.score - a.score || b.lastSeenAgo - a.lastSeenAgo || a.number - b.number);
  renderNumbers(boosted.slice(0, 6).map((row) => row.number).sort((a, b) => a - b), true);
}

async function init() {
  const draws = await loadDraws();
  stats = buildStats(draws);
  backtestReport = runBacktest(draws);
  semiautoReport = buildSemiAutoReport(draws);
  renderDataBadge();
  renderLatestDraw();
  renderNumbers(pickNumbers(stats), false);
  renderBacktest(backtestReport);
  renderSemiAuto(semiautoReport);
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
    clearTooltip();
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
