const ODDS = {
  jackpot: 8145060,
  second: 1357510,
  third: 35724,
  fourth: 733,
  fifth: 45,
};

const SAMPLE_DRAWS = [
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

const palette = ["#b78018", "#1e5c96", "#cc3f6a", "#5a6978", "#0d7f68"];

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

function buildStats(draws) {
  const stats = Array.from({ length: 45 }, (_, index) => ({
    number: index + 1,
    frequency: 0,
    lastSeenAgo: draws.length,
    score: 0,
  }));

  draws.forEach((draw, drawIndex) => {
    draw.numbers.forEach((number) => {
      const item = stats[number - 1];
      item.frequency += 1;
      item.lastSeenAgo = Math.min(item.lastSeenAgo, drawIndex);
    });
  });

  const maxFrequency = Math.max(...stats.map((item) => item.frequency), 1);
  const maxAgo = Math.max(...stats.map((item) => item.lastSeenAgo), 1);

  stats.forEach((item) => {
    const frequencySignal = item.frequency / maxFrequency;
    const overdueSignal = item.lastSeenAgo / maxAgo;
    const wobble = Math.abs(Math.sin(item.number * 12.9898)) * 0.16;
    item.score = Math.round((frequencySignal * 0.46 + overdueSignal * 0.38 + wobble) * 100);
  });

  return stats;
}

function pickNumbers(stats) {
  return [...stats]
    .sort((a, b) => b.score - a.score || a.number - b.number)
    .slice(0, 6)
    .map((item) => item.number)
    .sort((a, b) => a - b);
}

function renderBalls(numbers) {
  const root = document.querySelector("#suggestedNumbers");
  root.innerHTML = numbers
    .map((number) => `<span class="ball ${ballClass(number)}">${String(number).padStart(2, "0")}</span>`)
    .join("");
}

function renderSignals(stats) {
  const root = document.querySelector("#signalList");
  root.innerHTML = [...stats]
    .sort((a, b) => b.score - a.score || a.number - b.number)
    .slice(0, 8)
    .map((item) => {
      return `
        <div class="signal-item">
          <span class="ball ${ballClass(item.number)}">${String(item.number).padStart(2, "0")}</span>
          <div class="signal-bar"><span style="width: ${Math.min(item.score, 100)}%"></span></div>
          <strong>${item.score}</strong>
        </div>
      `;
    })
    .join("");
}

function drawHero(canvas, stats) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f6faf7";
  ctx.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.34;

  stats.forEach((item, index) => {
    const angle = (index / stats.length) * Math.PI * 2 - Math.PI / 2;
    const distance = radius * (0.7 + item.score / 280);
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    ctx.beginPath();
    ctx.fillStyle = palette[index % palette.length];
    ctx.globalAlpha = 0.58 + item.score / 260;
    ctx.arc(x, y, 6 + item.score / 18, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#16211f";
  ctx.font = "700 28px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Independent", centerX, centerY - 8);
  ctx.font = "600 16px system-ui";
  ctx.fillStyle = "#64706d";
  ctx.fillText("but visually tempting", centerX, centerY + 22);
}

function drawDistribution(canvas, stats) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 42;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const max = Math.max(...stats.map((item) => item.frequency), 1);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#d8e1dc";
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  const barWidth = chartWidth / 45;
  stats.forEach((item, index) => {
    const barHeight = (item.frequency / max) * chartHeight;
    const x = padding + index * barWidth + 1;
    const y = height - padding - barHeight;
    ctx.fillStyle = palette[index % palette.length];
    ctx.fillRect(x, y, Math.max(3, barWidth - 2), barHeight);
  });

  ctx.fillStyle = "#64706d";
  ctx.font = "600 12px system-ui";
  ctx.textAlign = "center";
  [1, 10, 20, 30, 40, 45].forEach((number) => {
    const x = padding + (number - 0.5) * barWidth;
    ctx.fillText(String(number), x, height - 14);
  });
}

function updateSimulator() {
  const gamesPerWeek = Math.max(1, Number(document.querySelector("#gamesPerWeek").value) || 1);
  const years = Math.max(1, Number(document.querySelector("#years").value) || 1);
  const price = Math.max(1000, Number(document.querySelector("#price").value) || 1000);
  const totalGames = Math.round(gamesPerWeek * 52 * years);
  const chance = 1 - Math.pow(1 - 1 / ODDS.jackpot, totalGames);
  const percent = chance * 100;

  document.querySelector("#jackpotChance").textContent = `${percent.toFixed(5)}%`;
  document.querySelector("#totalGames").textContent = `${formatNumber(totalGames)}게임`;
  document.querySelector("#totalSpend").textContent = `${formatNumber(totalGames * price)}원`;
  document.querySelector("#plainSummary").textContent =
    `${years}년 동안 매주 ${gamesPerWeek}게임을 사면 1등을 한 번 이상 볼 확률은 약 ${percent.toFixed(5)}%입니다. 낮지만, 숫자로 보면 더 낮습니다.`;
}

function init() {
  const stats = buildStats(SAMPLE_DRAWS);
  renderBalls(pickNumbers(stats));
  renderSignals(stats);
  drawHero(document.querySelector("#heroCanvas"), stats);
  drawDistribution(document.querySelector("#distributionCanvas"), stats);
  updateSimulator();

  document.querySelector("#shuffleBtn").addEventListener("click", () => {
    const shuffled = [...stats]
      .map((item) => ({ ...item, score: item.score + Math.random() * 18 }))
      .sort((a, b) => b.score - a.score || a.number - b.number);
    renderBalls(shuffled.slice(0, 6).map((item) => item.number).sort((a, b) => a - b));
    renderSignals(shuffled);
  });

  ["#gamesPerWeek", "#years", "#price"].forEach((selector) => {
    document.querySelector(selector).addEventListener("input", updateSimulator);
  });
}

init();
