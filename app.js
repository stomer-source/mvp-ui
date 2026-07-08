const $ = (id) => document.getElementById(id);

const departureEl = $("departure");
const weekdayEl = $("weekday");
const refreshBtn = $("refreshBtn");
const answerPanel = $("answerPanel");
const subNavState = $("subNavState");
const decisionText = $("decisionText");
const decisionSub = $("decisionSub");
const busArrivalEl = $("busArrival");
const busNextEl = $("busNext");
const busHeadwayEl = $("busHeadway");
const busServiceEl = $("busService");
const busNoteEl = $("busNote");
const seatSummaryEl = $("seatSummary");
const seatCapacityEl = $("seatCapacity");
const seatRemainEl = $("seatRemain");
const busTypeMixEl = $("busTypeMix");
const seatNoteEl = $("seatNote");
const BUS_API_ENDPOINT = "https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2";
const BUS_API_SERVICE_KEY = "223e3b2cf9a71733ebc98afd9de0fe244440b47b57aae18494886aebeffff8bd";
const BUS_STATION_ID = "119000302";
const BUS_ROUTE_NAME = "7800";
const LIVE_TIME_WINDOW_MINUTES = 30;

const weekdayLabels = {
  mon: "월요일",
  tue: "화요일",
  wed: "수요일",
  thu: "목요일",
  fri: "금요일",
  sat: "토요일",
  sun: "일요일",
};

const serviceInfo = {
  weekday: { first: 360, last: 25 * 60, headway: [6, 9] },
  weekend: { first: 360, last: 24 * 60, headway: [9, 10] },
};

const averageSeatCapacity = Math.round((12 * 70 + 15 * 44) / 27);

function isWeekday(dayValue) {
  return ["mon", "tue", "wed", "thu", "fri"].includes(dayValue);
}

function parseTimeToMinutes(timeValue) {
  const [hour, minute] = timeValue.split(":").map(Number);
  return hour * 60 + minute;
}

function getTodayWeekdayValue() {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
}

function isTodaySelection(dayValue) {
  return dayValue === getTodayWeekdayValue();
}

function isNearNow(timeMinutes) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return Math.abs(timeMinutes - currentMinutes) <= LIVE_TIME_WINDOW_MINUTES;
}

function formatClock(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatRange(min, max, suffix = "분") {
  return `${min}~${max}${suffix}`;
}

function getTimeCondition(minutes) {
  return (minutes >= 7 * 60 && minutes < 9 * 60) || (minutes >= 18 * 60 && minutes < 20 * 60)
    ? "peak"
    : "normal";
}

function getServiceProfile(dayValue, timeMinutes) {
  const weekdayMode = isWeekday(dayValue);
  const info = weekdayMode ? serviceInfo.weekday : serviceInfo.weekend;
  const timeCondition = getTimeCondition(timeMinutes);
  const headway = weekdayMode
    ? timeCondition === "peak"
      ? [6, 9]
      : [7, 8]
    : [9, 10];

  return {
    first: info.first,
    last: info.last,
    headway,
    weekdayMode,
    timeCondition,
    serviceText: weekdayMode ? "평일 06:00~01:00" : "주말 06:00~00:00",
  };
}

function calculateNextArrival(timeMinutes, profile) {
  if (timeMinutes < profile.first) {
    return {
      display: formatClock(profile.first),
      note: "첫차 대기",
      service: "운행 전",
    };
  }

  if (timeMinutes >= profile.last) {
    return {
      display: `다음날 ${formatClock(profile.first)}`,
      note: "막차 이후",
      service: "운행 종료",
    };
  }

  const arrivalMinutes = timeMinutes + Math.round((profile.headway[0] + profile.headway[1]) / 2);
  if (arrivalMinutes >= profile.last) {
    return {
      display: `다음날 ${formatClock(profile.first)}`,
      note: "막차 이후",
      service: "운행 종료",
    };
  }

  return {
    display: formatClock(arrivalMinutes),
    note: `${formatRange(profile.headway[0], profile.headway[1])} 뒤`,
    service: "운행 중",
  };
}

function estimateLoadRange(profile) {
  if (profile.weekdayMode && profile.timeCondition === "peak") {
    return [0.78, 0.92];
  }

  if (profile.weekdayMode) {
    return [0.55, 0.75];
  }

  return profile.timeCondition === "peak" ? [0.5, 0.68] : [0.35, 0.55];
}

function estimateSeats(profile) {
  const [loadMin, loadMax] = estimateLoadRange(profile);
  const remainMin = Math.max(0, Math.round(averageSeatCapacity * (1 - loadMax)));
  const remainMax = Math.max(remainMin, Math.round(averageSeatCapacity * (1 - loadMin)));

  return {
    capacity: averageSeatCapacity,
    remainMin,
    remainMax,
  };
}

function formatRouteName(routeName) {
  return `${routeName}번`;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickSoonestBusEntry(busArrivalList) {
  const routeEntries = busArrivalList.filter((item) => String(item.routeName) === BUS_ROUTE_NAME);

  if (!routeEntries.length) {
    return null;
  }

  const bestEntry = routeEntries
    .map((item) => {
      const arrival1 = toNumber(item.predictTime1);
      const arrival2 = toNumber(item.predictTime2);
      const stop1 = toNumber(item.locationNo1);
      const stop2 = toNumber(item.locationNo2);
      const seat1 = toNumber(item.remainSeatCnt1);
      const seat2 = toNumber(item.remainSeatCnt2);
      const candidates = [
        { predictTime: arrival1, locationNo: stop1, remainSeatCnt: seat1, label: "첫 번째 버스" },
        { predictTime: arrival2, locationNo: stop2, remainSeatCnt: seat2, label: "두 번째 버스" },
      ].filter((candidate) => candidate.predictTime !== null);

      return candidates.sort((a, b) => a.predictTime - b.predictTime)[0] ?? null;
    })
    .filter(Boolean)
    .sort((a, b) => a.predictTime - b.predictTime)[0];

  return bestEntry ?? null;
}

function formatSeatRange(remainSeatCnt) {
  if (remainSeatCnt === null) {
    return "좌석 정보 없음";
  }

  if (remainSeatCnt <= 0) {
    return "만석에 가까움";
  }

  if (remainSeatCnt <= 5) {
    return `약 ${remainSeatCnt}석`;
  }

  const low = Math.max(0, remainSeatCnt - 3);
  const high = remainSeatCnt + 3;
  return `약 ${low}~${high}석`;
}

function extractBusArrivalList(payload) {
  return (
    payload?.busArrivalList ??
    payload?.response?.msgBody?.busArrivalList ??
    payload?.response?.body?.busArrivalList ??
    payload?.response?.busArrivalList ??
    []
  );
}

function buildFallbackBusData(dayValue, timeMinutes) {
  const profile = getServiceProfile(dayValue, timeMinutes);
  const nextArrival = calculateNextArrival(timeMinutes, profile);
  const seatEstimate = estimateSeats(profile);

  return {
    arrivalText: nextArrival.display,
    arrivalNote: nextArrival.note,
    headwayText: formatRange(profile.headway[0], profile.headway[1]),
    serviceText: profile.serviceText,
    note:
      profile.timeCondition === "peak"
        ? "출퇴근 시간대라 배차는 촘촘하지만 좌석은 빨리 차는 편입니다."
        : "평소 시간대라면 다음 도착 예측과 남는 좌석이 비교적 넉넉하게 보입니다.",
    seatSummary: `평균 약 ${seatEstimate.capacity}석`,
    seatCapacity: "44~70석",
    seatRemain: `약 ${seatEstimate.remainMin}~${seatEstimate.remainMax}석`,
    busTypeMix: "2층 12대 / 일반 15대",
    seatNote:
      "좌석 수는 차량 종류에 따라 달라집니다. 2층버스가 오면 더 여유롭고, 일반버스면 더 빨리 찹니다.",
    sourceLabel: "샘플 데이터",
  };
}

async function fetchBusData() {
  if (!BUS_API_SERVICE_KEY) {
    throw new Error("BUS_API_SERVICE_KEY is empty");
  }

  const url = new URL(BUS_API_ENDPOINT);
  url.searchParams.set("serviceKey", BUS_API_SERVICE_KEY);
  url.searchParams.set("stationId", BUS_STATION_ID);
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Bus API request failed: ${response.status}`);
  }

  const data = await response.json();
  const busArrivalList = extractBusArrivalList(data);
  return pickSoonestBusEntry(busArrivalList);
}

function renderBusData(dayValue, timeMinutes, apiEntry, allowFallback = true) {
  if (!apiEntry) {
    return allowFallback ? buildFallbackBusData(dayValue, timeMinutes) : null;
  }

  const predictTime1 = toNumber(apiEntry.predictTime1);
  const predictTime2 = toNumber(apiEntry.predictTime2);
  const locationNo1 = toNumber(apiEntry.locationNo1);
  const locationNo2 = toNumber(apiEntry.locationNo2);
  const remainSeatCnt1 = toNumber(apiEntry.remainSeatCnt1);
  const remainSeatCnt2 = toNumber(apiEntry.remainSeatCnt2);

  const candidate1 = predictTime1 === null
    ? null
    : { predictTime: predictTime1, locationNo: locationNo1, remainSeatCnt: remainSeatCnt1 };
  const candidate2 = predictTime2 === null
    ? null
    : { predictTime: predictTime2, locationNo: locationNo2, remainSeatCnt: remainSeatCnt2 };

  const candidates = [candidate1, candidate2].filter(Boolean).sort((a, b) => a.predictTime - b.predictTime);
  const best = candidates[0];

  if (!best) {
    return allowFallback ? buildFallbackBusData(dayValue, timeMinutes) : null;
  }

  const arrivalMinutes = Math.max(0, Math.round(best.predictTime));
  const seatCount = best.remainSeatCnt;
  const fallback = buildFallbackBusData(dayValue, timeMinutes);

  return {
    arrivalText: `${arrivalMinutes}분 후`,
    arrivalNote: `남은 정류장 ${best.locationNo ?? "?"}개`,
    headwayText: fallback.headwayText,
    serviceText: fallback.serviceText,
    note: `실시간 API 기준으로 사당역 9번 출구까지 약 ${arrivalMinutes}분 남았습니다.`,
    seatSummary:
      seatCount === null
        ? "좌석 정보 없음"
        : seatCount <= 0
          ? "만석에 가까움"
          : `약 ${seatCount}석`,
    seatCapacity: "44~70석",
    seatRemain:
      seatCount === null
        ? "좌석 정보 없음"
        : formatSeatRange(seatCount),
    busTypeMix: "2층 12대 / 일반 15대",
    seatNote:
      seatCount === null
        ? "API에서 좌석 정보를 받지 못했습니다."
        : `API의 remainSeatCnt 기준이며, 차량 내부 상황에 따라 실제 좌석 체감은 달라질 수 있습니다.`,
    sourceLabel: "API 실시간",
  };
}

async function updateUI(openPanel = false) {
  const dayValue = weekdayEl.value;
  const timeMinutes = parseTimeToMinutes(departureEl.value);
  const useLiveData = isTodaySelection(dayValue) && isNearNow(timeMinutes);

  if (openPanel) {
    answerPanel.hidden = false;
  }

  subNavState.textContent = openPanel ? (useLiveData ? "실시간 조회 중..." : "계산 중...") : "샘플 계산";
  decisionText.textContent = `${weekdayLabels[dayValue] ?? "요일"} · ${departureEl.value}`;
  decisionSub.textContent =
    useLiveData
      ? "오늘이고 지금 시간에 가까워서 실시간 API로만 보여줍니다."
      : "7800번 버스의 다음 도착 시각과 대략 남는 좌석 수를 같은 화면에서 같이 보여줍니다.";

  let busData;
  if (useLiveData) {
    try {
      const apiEntry = await fetchBusData();
      busData = renderBusData(dayValue, timeMinutes, apiEntry, false);
    } catch (_error) {
      busData = {
        arrivalText: "실시간 조회 실패",
        arrivalNote: "API 응답 없음",
        headwayText: "-",
        serviceText: "실시간 데이터 필요",
        note: "오늘이고 현재 시간에 가까워서 과거 데이터 대신 실시간 정보가 필요하지만, API를 가져오지 못했습니다.",
        seatSummary: "좌석 정보 없음",
        seatCapacity: "44~70석",
        seatRemain: "실시간 확인 실패",
        busTypeMix: "2층 12대 / 일반 15대",
        seatNote: "실시간 API가 응답하면 이 자리에 남은 좌석 수가 표시됩니다.",
        sourceLabel: "실시간 조회 실패",
      };
    }
  } else {
    try {
      const apiEntry = await fetchBusData();
      busData = renderBusData(dayValue, timeMinutes, apiEntry, true);
    } catch (_error) {
      busData = buildFallbackBusData(dayValue, timeMinutes);
    }
  }

  if (!busData) {
    busData = useLiveData
      ? {
          arrivalText: "실시간 조회 실패",
          arrivalNote: "7800번 데이터 없음",
          headwayText: "-",
          serviceText: "실시간 데이터 필요",
          note: "오늘이고 현재 시간에 가까워서 과거 데이터 대신 실시간 정보가 필요하지만, 7800번 항목을 찾지 못했습니다.",
          seatSummary: "좌석 정보 없음",
          seatCapacity: "44~70석",
          seatRemain: "실시간 확인 실패",
          busTypeMix: "2층 12대 / 일반 15대",
          seatNote: "API 응답에 7800번 버스가 없어서 실시간 정보를 보여주지 못했습니다.",
          sourceLabel: "실시간 조회 실패",
        }
      : buildFallbackBusData(dayValue, timeMinutes);
  }

  answerPanel.hidden = false;
  subNavState.textContent = busData.sourceLabel;

  busArrivalEl.textContent = busData.arrivalText;
  busNextEl.textContent = busData.arrivalNote;
  busHeadwayEl.textContent = busData.headwayText;
  busServiceEl.textContent = busData.serviceText;
  busNoteEl.textContent = busData.note;

  seatSummaryEl.textContent = busData.seatSummary;
  seatCapacityEl.textContent = busData.seatCapacity;
  seatRemainEl.textContent = busData.seatRemain;
  busTypeMixEl.textContent = busData.busTypeMix;
  seatNoteEl.textContent = busData.seatNote;
}

refreshBtn.addEventListener("click", () => updateUI(true));
[departureEl, weekdayEl].forEach((el) => {
  el.addEventListener("input", updateUI);
  el.addEventListener("change", updateUI);
});

updateUI();
