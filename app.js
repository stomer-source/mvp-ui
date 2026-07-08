const $ = (id) => document.getElementById(id);

const departureEl = $("departure");
const weekdayEl = $("weekday");

const refreshBtn = $("refreshBtn");
const answerPanel = $("answerPanel");
const subNavState = $("subNavState");
const decisionText = $("decisionText");
const decisionSub = $("decisionSub");
const busScoreEl = $("busScore");
const subwayScoreEl = $("subwayScore");
const busDurationEl = $("busDuration");
const subwayDurationEl = $("subwayDuration");
const busWaitEl = $("busWait");
const subwayWaitEl = $("subwayWait");
const busCrowdEl = $("busCrowd");
const subwayCrowdEl = $("subwayCrowd");
const busNoteEl = $("busNote");
const subwayNoteEl = $("subwayNote");

const routeData = {
  bus: {
    baseMinutes: 34,
    waitMinutes: 8,
    crowd: 62,
  },
  subway: {
    baseMinutes: 28,
    waitMinutes: 4,
    crowd: 48,
  },
};

const weekdayLabels = {
  mon: "월요일",
  tue: "화요일",
  wed: "수요일",
  thu: "목요일",
  fri: "금요일",
  sat: "토요일",
  sun: "일요일",
};

function getTimeCondition(timeValue) {
  const [hour] = timeValue.split(":").map(Number);
  if ((hour >= 7 && hour < 9) || (hour >= 18 && hour < 20)) {
    return "peak";
  }
  return "normal";
}

function formatMinutes(minutes) {
  return `${minutes}분`;
}

function crowdLabel(score) {
  if (score >= 75) return "매우 혼잡";
  if (score >= 55) return "약간 혼잡";
  return "여유";
}

function calculateAdjustedValues(mode, weekday, timeCondition) {
  const data = routeData[mode];
  let total = data.baseMinutes + data.waitMinutes;
  let wait = data.waitMinutes;
  let crowd = data.crowd;

  if (["mon", "tue", "wed", "thu", "fri"].includes(weekday)) {
    total += mode === "bus" ? 2 : 1;
    crowd += mode === "bus" ? 6 : 4;
  }

  if (weekday === "fri") {
    total += mode === "bus" ? 1 : 0;
    crowd += mode === "bus" ? 4 : 3;
  }

  if (weekday === "sat" || weekday === "sun") {
    total -= mode === "bus" ? 1 : 0;
    crowd -= mode === "bus" ? 3 : 2;
  }

  if (timeCondition === "peak") {
    total += mode === "bus" ? 7 : 5;
    wait += mode === "bus" ? 4 : 2;
    crowd += mode === "bus" ? 12 : 10;
  }

  return {
    total: Math.max(total, 1),
    wait: Math.max(wait, 0),
    crowd: Math.min(Math.max(crowd, 0), 100),
  };
}

function scoreRoute(values) {
  let score = 100;
  score -= values.total * 1.2;
  score -= values.wait * 0.8;
  score -= values.crowd * 0.25;
  return Math.round(Math.max(score, 0));
}

function buildAnalysis(mode, values) {
  const fast = values.total <= 35;
  const crowdState = crowdLabel(values.crowd);
  if (mode === "bus") {
    return fast
      ? `총 소요가 짧고 응답성이 괜찮습니다. ${crowdState}라서 급하게 이동할 때는 꽤 안정적입니다.`
      : `대기는 조금 있지만 이동은 단순합니다. ${crowdState} 수준이라 편의보다 바로 타는 흐름이 좋습니다.`;
  }
  return fast
    ? `총 소요가 짧고 시간 예측이 안정적입니다. ${crowdState}라서 평일 출근 시간에도 비교적 읽기 쉽습니다.`
    : `대기와 도보를 포함해도 무난합니다. ${crowdState}라서 버스보다 변동폭이 덜한 편입니다.`;
}

function updateUI(openPanel = false) {
  const weekday = weekdayEl.value;
  const timeCondition = getTimeCondition(departureEl.value);
  const bus = calculateAdjustedValues("bus", weekday, timeCondition);
  const subway = calculateAdjustedValues("subway", weekday, timeCondition);
  const busScore = scoreRoute(bus);
  const subwayScore = scoreRoute(subway);
  const winner =
    busScore === subwayScore ? "비슷해요" : busScore > subwayScore ? "7800번 버스 추천" : "지하철 추천";

  if (openPanel) {
    answerPanel.hidden = false;
  }

  subNavState.textContent = openPanel ? "비교 완료" : "샘플 데이터";
  decisionText.textContent = `${weekdayLabels[weekday] ?? "요일"} · ${departureEl.value}`;
  decisionSub.textContent = `지금 조건에서는 ${winner}입니다.`;

  busScoreEl.textContent = `${busScore}점`;
  subwayScoreEl.textContent = `${subwayScore}점`;
  busDurationEl.textContent = formatMinutes(bus.total);
  subwayDurationEl.textContent = formatMinutes(subway.total);
  busWaitEl.textContent = formatMinutes(bus.wait);
  subwayWaitEl.textContent = formatMinutes(subway.wait);
  busCrowdEl.textContent = crowdLabel(bus.crowd);
  subwayCrowdEl.textContent = crowdLabel(subway.crowd);
  busNoteEl.textContent = buildAnalysis("bus", bus);
  subwayNoteEl.textContent = buildAnalysis("subway", subway);
}

refreshBtn.addEventListener("click", () => updateUI(true));
[departureEl, weekdayEl].forEach((el) => {
  el.addEventListener("input", updateUI);
  el.addEventListener("change", updateUI);
});

updateUI();
