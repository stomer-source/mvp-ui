const $ = (id) => document.getElementById(id);

const departureEl = $("departure");
const weekdayEl = $("weekday");
const refreshBtn = $("refreshBtn");
const nowBtn = $("nowBtn");
const locationBtn = $("locationBtn");
const answerPanel = $("answerPanel");
const subNavState = $("subNavState");
const decisionText = $("decisionText");
const decisionSub = $("decisionSub");
const busArrival1El = $("busArrival1");
const busPredict1El = $("busPredict1");
const busLocation1El = $("busLocation1");
const busSeat1El = $("busSeat1");
const busNote1El = $("busNote1");
const busArrival2El = $("busArrival2");
const busPredict2El = $("busPredict2");
const busLocation2El = $("busLocation2");
const busSeat2El = $("busSeat2");
const busNote2El = $("busNote2");
const forecastTimeEl = $("forecastTime");
const forecastStateEl = $("forecastState");
const forecastArrivalEl = $("forecastArrival");
const forecastSeatsEl = $("forecastSeats");
const forecastBoardingEl = $("forecastBoarding");
const forecastNoteEl = $("forecastNote");
const locationCardEl = $("locationCard");
const locationTitleEl = $("locationTitle");
const locationStateEl = $("locationState");
const locationSummaryEl = $("locationSummary");
const locationListEl = $("locationList");
const subwayBtn = $("subwayBtn");
const subwayCardEl = $("subwayCard");
const subwayTitleEl = $("subwayTitle");
const subwayStateEl = $("subwayState");
const subwaySummaryEl = $("subwaySummary");
const subwayListEl = $("subwayList");
const BUS_LOCATION_API_ENDPOINT = "https://apis.data.go.kr/6410000/buslocationservice/v2/getBusLocationListv2";
const BUS_API_SERVICE_KEY = "223e3b2cf9a71733ebc98afd9de0fe244440b47b57aae18494886aebeffff8bd";
const BUS_STATION_ID = "119000302";
const BUS_ROUTE_NAME = "7800";
const BUS_ROUTE_ID = "200000150";
const SEOUL_SUBWAY_API_ENDPOINT = "https://swopenAPI.seoul.go.kr/api/subway";
const SEOUL_SUBWAY_API_KEY_STORAGE = "SEOUL_SUBWAY_API_KEY";
const SEOUL_SUBWAY_DEFAULT_API_KEY = "4f7377766673746f3639754f787679";
const SEOUL_SUBWAY_STATION_NAME = "사당";
const SEOUL_SUBWAY_LINE_ID = "1004";
const SEOUL_SUBWAY_TARGET_STATION = "사당";
const SEOUL_SUBWAY_TARGET_LINE_ID = "1004";
const LIVE_TIME_WINDOW_MINUTES = 30;
const FORECAST_HOURS_AHEAD = 3;
const FORECAST_MINUTES_AHEAD = FORECAST_HOURS_AHEAD * 60;
const DAY_SEQUENCE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

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
  if (!timeValue || !timeValue.includes(":")) {
    return 0;
  }
  const [hour, minute] = timeValue.split(":").map(Number);
  return hour * 60 + minute;
}

function formatTimeValue(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getTodayWeekdayValue() {
  return DAY_SEQUENCE[new Date().getDay()];
}

function isTodaySelection(dayValue) {
  return dayValue === getTodayWeekdayValue();
}

function isNearNow(timeMinutes) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return Math.abs(timeMinutes - currentMinutes) <= LIVE_TIME_WINDOW_MINUTES;
}

function setCurrentSelection() {
  const now = new Date();
  weekdayEl.value = DAY_SEQUENCE[now.getDay()];
  departureEl.value = formatTimeValue(now);
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

function formatSeatRange(min, max) {
  return min === max ? `${min}석` : `${min}~${max}석`;
}

function getAverageSeatCount() {
  return averageSeatCapacity;
}

function normalizeDayIndex(dayValue) {
  const index = DAY_SEQUENCE.indexOf(dayValue);
  return index === -1 ? 0 : index;
}

function shiftSelection(dayValue, timeMinutes, deltaMinutes) {
  let totalMinutes = timeMinutes + deltaMinutes;
  let dayIndex = normalizeDayIndex(dayValue);

  while (totalMinutes >= 1440) {
    totalMinutes -= 1440;
    dayIndex = (dayIndex + 1) % 7;
  }

  while (totalMinutes < 0) {
    totalMinutes += 1440;
    dayIndex = (dayIndex + 6) % 7;
  }

  return {
    dayValue: DAY_SEQUENCE[dayIndex],
    timeMinutes: totalMinutes,
  };
}

function getTimeLabel(dayValue, timeMinutes) {
  return `${weekdayLabels[dayValue] ?? "요일"} · ${formatClock(timeMinutes)}`;
}

function getSeatLoadRange(profile) {
  const [loadMin, loadMax] = estimateLoadRange(profile);
  return {
    loadMin,
    loadMax,
    remainMin: Math.max(0, Math.round(getAverageSeatCount() * (1 - loadMax))),
    remainMax: Math.max(0, Math.round(getAverageSeatCount() * (1 - loadMin))),
  };
}

function getBoardingLabel(remainMin, remainMax) {
  const averageRemain = (remainMin + remainMax) / 2;

  if (averageRemain >= 18) {
    return "여유";
  }

  if (averageRemain >= 8) {
    return "보통";
  }

  if (averageRemain >= 1) {
    return "빡빡";
  }

  return "거의 만석";
}

function getCongestionLabel(remainMin, remainMax) {
  const averageRemain = (remainMin + remainMax) / 2;
  const capacity = getAverageSeatCount();
  const occupancy = Math.max(0, Math.min(100, Math.round(((capacity - averageRemain) / capacity) * 100)));

  if (occupancy >= 85) {
    return `혼잡 ${occupancy}%`;
  }

  if (occupancy >= 65) {
    return `보통 ${occupancy}%`;
  }

  return `여유 ${occupancy}%`;
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
    };
  }

  if (timeMinutes >= profile.last) {
    return {
      display: `다음날 ${formatClock(profile.first)}`,
      note: "막차 이후",
    };
  }

  const arrivalMinutes = timeMinutes + Math.round((profile.headway[0] + profile.headway[1]) / 2);
  if (arrivalMinutes >= profile.last) {
    return {
      display: `다음날 ${formatClock(profile.first)}`,
      note: "막차 이후",
    };
  }

  return {
    display: formatClock(arrivalMinutes),
    note: `${formatRange(profile.headway[0], profile.headway[1])} 뒤`,
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

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSelectionAverageSeatCount(apiEntry) {
  const remainSeatCnt1 = toNumber(apiEntry?.remainSeatCnt1);
  const remainSeatCnt2 = toNumber(apiEntry?.remainSeatCnt2);
  const values = [remainSeatCnt1, remainSeatCnt2].filter((value) => value !== null);

  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getHistoricalForecastSnapshot(dayValue, timeMinutes) {
  const historySources = [
    globalThis.BUS_HISTORY,
    globalThis.__BUS_HISTORY,
    globalThis.busHistory,
  ].filter(Array.isArray);

  if (!historySources.length) {
    return null;
  }

  const windowStart = timeMinutes - 45;
  const windowEnd = timeMinutes + 45;
  const targetDay = dayValue;
  const records = [];

  for (const source of historySources) {
    for (const item of source) {
      const itemDay = item.dayValue ?? item.weekday ?? item.day ?? null;
      const itemTime = toNumber(item.timeMinutes ?? item.minuteOfDay ?? item.minutes);
      const itemRemain =
        toNumber(item.remainSeatCnt) ??
        toNumber(item.remainSeats) ??
        toNumber(item.seats) ??
        toNumber(item.remain);

      if (itemDay !== targetDay || itemTime === null || itemRemain === null) {
        continue;
      }

      const normalizedTime = ((itemTime % 1440) + 1440) % 1440;
      if (normalizedTime < windowStart || normalizedTime > windowEnd) {
        continue;
      }

      records.push({
        remainSeatCnt: itemRemain,
        load:
          toNumber(item.loadRate) ??
          toNumber(item.loadPercent) ??
          toNumber(item.occupancyRate) ??
          null,
      });
    }
  }

  if (!records.length) {
    return null;
  }

  const averageRemain =
    records.reduce((sum, item) => sum + item.remainSeatCnt, 0) / records.length;
  const explicitLoads = records.filter((item) => item.load !== null).map((item) => item.load);
  const averageLoad =
    explicitLoads.length > 0
      ? explicitLoads.reduce((sum, value) => sum + value, 0) / explicitLoads.length
      : null;

  return {
    averageRemain,
    averageLoad,
    count: records.length,
  };
}

function forecastSeatsFromSignals(dayValue, timeMinutes, apiEntry, profile) {
  const baseRange = getSeatLoadRange(profile);
  const history = getHistoricalForecastSnapshot(dayValue, timeMinutes);
  const liveAverageRemain = getSelectionAverageSeatCount(apiEntry);

  const capacity = getAverageSeatCount();
  const currentExpectedRemain = Math.round(capacity * (1 - (baseRange.loadMin + baseRange.loadMax) / 2));
  let targetRemain = currentExpectedRemain;
  let notes = [];

  if (history) {
    targetRemain = (targetRemain * 2 + history.averageRemain) / 3;
    notes.push(`과거 ${history.count}개 패턴 반영`);
  }

  if (liveAverageRemain !== null) {
    targetRemain = (targetRemain * 2 + liveAverageRemain) / 3;
    notes.push("실시간 좌석 정보 반영");
  }

  const spread = Math.max(3, Math.round(capacity * 0.08));
  const remainMin = Math.max(0, Math.round(targetRemain - spread));
  const remainMax = Math.max(remainMin, Math.round(targetRemain + spread));
  const occupancyMin = Math.max(0, Math.min(100, Math.round(((capacity - remainMax) / capacity) * 100)));
  const occupancyMax = Math.max(0, Math.min(100, Math.round(((capacity - remainMin) / capacity) * 100)));

  return {
    remainMin,
    remainMax,
    occupancyMin,
    occupancyMax,
    boardText: getBoardingLabel(remainMin, remainMax),
    congestionText: getCongestionLabel(remainMin, remainMax),
    noteText:
      notes.length > 0
        ? notes.join(" · ")
        : "과거 운행 패턴과 배차 간격을 기준으로 추정했습니다.",
  };
}

function buildForecast(dayValue, timeMinutes, apiEntry) {
  const future = shiftSelection(dayValue, timeMinutes, FORECAST_MINUTES_AHEAD);
  const profile = getServiceProfile(future.dayValue, future.timeMinutes);
  const nextArrival = calculateNextArrival(future.timeMinutes, profile);
  const seatForecast = forecastSeatsFromSignals(future.dayValue, future.timeMinutes, apiEntry, profile);

  return {
    label: getTimeLabel(future.dayValue, future.timeMinutes),
    arrivalText: nextArrival.display,
    seatsText: formatSeatRange(seatForecast.remainMin, seatForecast.remainMax),
    boardingText: seatForecast.boardText,
    congestionText: seatForecast.congestionText,
    noteText: `${seatForecast.noteText} · ${nextArrival.note}`,
  };
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

function extractBusLocationList(payload) {
  return (
    payload?.busLocationList ??
    payload?.response?.msgBody?.busLocationList ??
    payload?.response?.body?.busLocationList ??
    payload?.response?.busLocationList ??
    payload?.response?.msgbody?.busLocationList ??
    []
  );
}

function findRouteEntry(busArrivalList) {
  return busArrivalList.find((item) => String(item.routeName) === BUS_ROUTE_NAME) ?? null;
}

function findRouteLocations(busLocationList) {
  return busLocationList.filter((item) => {
    const routeName = item.routeName != null ? String(item.routeName) : "";
    const routeId = item.routeId != null ? String(item.routeId) : "";
    return routeName === BUS_ROUTE_NAME || routeId === BUS_ROUTE_ID;
  });
}

function getDistanceToSadang(bus) {
  const stationSeq = toNumber(bus.stationSeq);
  if (stationSeq === null) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.abs(41 - stationSeq);
}

function buildLocationBusData(locationEntries) {
  if (!locationEntries.length) {
    return null;
  }

  const sortedEntries = [...locationEntries].sort((a, b) => {
    const distanceA = getDistanceToSadang(a);
    const distanceB = getDistanceToSadang(b);
    if (distanceA !== distanceB) {
      return distanceA - distanceB;
    }

    const seqA = toNumber(a.stationSeq) ?? Number.MAX_SAFE_INTEGER;
    const seqB = toNumber(b.stationSeq) ?? Number.MAX_SAFE_INTEGER;
    return seqA - seqB;
  });

  const first = sortedEntries[0];
  const second = sortedEntries[1] ?? sortedEntries[0];

  const toCard = (bus, rank) => {
    const stationSeq = toNumber(bus.stationSeq);
    const stationId = bus.stationId ?? "-";
    const remainSeatCnt = toNumber(bus.remainSeatCnt);
    const crowdedLabel = {
      0: "여유",
      1: "보통",
      2: "혼잡",
    }[bus.crowded] ?? "알수없음";
    const stateLabel = {
      0: "정차 중",
      1: "운행 중",
      2: "도착 전",
    }[bus.stateCd] ?? "상태 미상";
    const distance = getDistanceToSadang(bus);
    const arrivalText =
      stationId === Number(BUS_STATION_ID) || stationSeq === 41
        ? "사당역 도착권"
        : `사당역까지 ${distance}정류장 차이`;

    return {
      arrivalText,
      locationText: `현재 정류장 ID ${stationId}`,
      seatText: remainSeatCnt === null ? "좌석 정보 없음" : `${remainSeatCnt}석`,
      note:
        `차량번호 ${bus.plateNo ?? "-"} · ${stateLabel} · ${crowdedLabel} · ${stationSeq === null ? "-" : `${stationSeq}번째 정류장`}`,
      rank,
    };
  };

  return {
    first: toCard(first, 1),
    second: toCard(second, 2),
    sourceLabel: "실시간 위치",
    seedEntry: {
      remainSeatCnt1: first.remainSeatCnt,
      remainSeatCnt2: second.remainSeatCnt,
    },
    locationEntries: sortedEntries,
  };
}

function buildFallbackBusData(dayValue, timeMinutes) {
  const profile = getServiceProfile(dayValue, timeMinutes);
  const nextArrival = calculateNextArrival(timeMinutes, profile);
  const seatEstimate = estimateSeats(profile);
  const secondArrivalMinutes = Math.max(timeMinutes, profile.first) + Math.round((profile.headway[0] + profile.headway[1]) / 2);
  const secondArrivalText =
    secondArrivalMinutes >= profile.last
      ? `다음날 ${formatClock(profile.first)}`
      : formatClock(secondArrivalMinutes);

  return {
    first: {
      arrivalText: nextArrival.display,
      locationText: nextArrival.note,
      seatText:
        profile.timeCondition === "peak"
          ? `약 ${Math.max(0, seatEstimate.remainMin - 4)}~${Math.max(0, seatEstimate.remainMax - 4)}석`
          : `약 ${seatEstimate.remainMin}~${seatEstimate.remainMax}석`,
    },
    second: {
      arrivalText: secondArrivalText,
      locationText: `${formatRange(profile.headway[0], profile.headway[1])} 뒤`,
      seatText:
        profile.timeCondition === "peak"
          ? `약 ${Math.max(0, seatEstimate.remainMin - 6)}~${Math.max(0, seatEstimate.remainMax - 6)}석`
          : `약 ${Math.max(0, seatEstimate.remainMin - 2)}~${Math.max(0, seatEstimate.remainMax - 2)}석`,
    },
    note1:
      profile.timeCondition === "peak"
        ? "출퇴근 시간대라 배차는 촘촘하지만 좌석은 빨리 차는 편입니다."
        : "평소 시간대라면 다음 도착 예측과 남는 좌석이 비교적 넉넉하게 보입니다.",
    note2:
      profile.timeCondition === "peak"
        ? "두 번째 버스도 빠르게 이어지지만 좌석은 더 빨리 채워질 수 있습니다."
        : "두 번째 버스는 바로 뒤에 이어오는 편입니다.",
    sourceLabel: "샘플 데이터",
  };
}

async function fetchBusData() {
  if (!BUS_API_SERVICE_KEY) {
    throw new Error("BUS_API_SERVICE_KEY is empty");
  }

  const url = new URL(BUS_LOCATION_API_ENDPOINT);
  url.searchParams.set("serviceKey", BUS_API_SERVICE_KEY);
  url.searchParams.set("routeId", BUS_ROUTE_ID);
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Bus location API request failed: ${response.status}`);
  }

  const data = await response.json();
  const busLocationList = extractBusLocationList(data);
  return {
    locationEntries: findRouteLocations(busLocationList),
    raw: data,
  };
}

function getSubwayApiKey(allowPrompt = true) {
  const injectedKey = String(
    window.SEOUL_SUBWAY_API_KEY ?? window.__SEOUL_SUBWAY_API_KEY__ ?? ""
  ).trim();
  const storedKey = String(localStorage.getItem(SEOUL_SUBWAY_API_KEY_STORAGE) ?? "").trim();
  const apiKey = injectedKey || storedKey || SEOUL_SUBWAY_DEFAULT_API_KEY;

  if (apiKey) {
    if (!storedKey && apiKey === SEOUL_SUBWAY_DEFAULT_API_KEY) {
      localStorage.setItem(SEOUL_SUBWAY_API_KEY_STORAGE, apiKey);
    }
    return apiKey;
  }

  if (!allowPrompt) {
    return "";
  }

  const entered = window.prompt("서울 열린데이터광장 인증키를 입력하세요.");
  const normalized = String(entered ?? "").trim();
  if (normalized) {
    localStorage.setItem(SEOUL_SUBWAY_API_KEY_STORAGE, normalized);
  }

  return normalized;
}

async function fetchSadangLine4Arrivals() {
  const apiKey = getSubwayApiKey(true);
  if (!apiKey) {
    throw new Error("서울 지하철 API 키가 필요합니다.");
  }

  const url = `${SEOUL_SUBWAY_API_ENDPOINT}/${encodeURIComponent(apiKey)}/json/realtimeStationArrival/0/10/${encodeURIComponent(SEOUL_SUBWAY_STATION_NAME)}`;
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      "지하철 API 연결에 실패했습니다. https 연결이 막혀 있으면 서버 프록시가 필요합니다."
    );
  }

  if (!response.ok) {
    throw new Error(`Subway arrival API request failed: ${response.status}`);
  }

  const data = await response.json();
  const rows = data?.realtimeStationArrival?.row ?? [];

  return rows
    .filter((row) => String(row.subwayId) === SEOUL_SUBWAY_LINE_ID)
    .sort((a, b) => {
      const arrivalA = toNumber(a.barvlDt) ?? Number.MAX_SAFE_INTEGER;
      const arrivalB = toNumber(b.barvlDt) ?? Number.MAX_SAFE_INTEGER;
      if (arrivalA !== arrivalB) {
        return arrivalA - arrivalB;
      }

      const codeA = toNumber(a.arvlCd) ?? Number.MAX_SAFE_INTEGER;
      const codeB = toNumber(b.arvlCd) ?? Number.MAX_SAFE_INTEGER;
      if (codeA !== codeB) {
        return codeA - codeB;
      }

      const timeA = String(a.recptnDt ?? "");
      const timeB = String(b.recptnDt ?? "");
      return timeB.localeCompare(timeA);
    });
}

function renderSubwayCard(arrivals, message, isError = false) {
  subwayCardEl.hidden = false;
  subwayTitleEl.textContent = `${SEOUL_SUBWAY_STATION_NAME}역 4호선`;
  subwayStateEl.textContent = message;
  subwaySummaryEl.textContent = isError
    ? "인증키를 확인한 뒤 다시 눌러주세요."
    : arrivals.length
      ? `사당역 4호선 실시간 도착정보 ${arrivals.length}건을 불러왔습니다.`
      : "현재 보여줄 도착정보가 없습니다.";

  if (!arrivals.length) {
    subwayListEl.innerHTML = "";
    return;
  }

  subwayListEl.innerHTML = arrivals
    .map((row) => {
      const direction = row.updnLine ?? "-";
      const destination = row.trainLineNm ?? "-";
      const status = row.arvlMsg2 ?? "-";
      const currentLocation = row.arvlMsg3 ?? "-";
      const updatedAt = row.recptnDt ?? "-";
      const arrivalCode = row.arvlCd ?? "-";

      return `
        <section class="vehicle-row">
          <div class="vehicle-head">
            <strong>${destination}</strong>
            <span class="vehicle-pill">${direction}</span>
          </div>
          <div class="vehicle-grid">
            <div class="vehicle-field">
              <span>도착 메시지</span>
              <strong>${status}</strong>
            </div>
            <div class="vehicle-field">
              <span>현재 위치</span>
              <strong>${currentLocation}</strong>
            </div>
            <div class="vehicle-field">
              <span>갱신 시각</span>
              <strong>${updatedAt}</strong>
            </div>
            <div class="vehicle-field">
              <span>도착 코드</span>
              <strong>${arrivalCode}</strong>
            </div>
          </div>
          <p class="vehicle-note">사당역 4호선 실시간 도착정보입니다.</p>
        </section>
      `;
    })
    .join("");
}

function formatSubwayArrivalTime(barvlDt) {
  const seconds = toNumber(barvlDt);

  if (seconds === null) {
    return "도착 시간 정보 없음";
  }

  if (seconds <= 0) {
    return "도착 임박";
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes}분 후`;
}

function renderSadangLine4Arrivals(arrivals) {
  subwayCardEl.hidden = false;
  subwayTitleEl.textContent = `${SEOUL_SUBWAY_STATION_NAME}역 4호선`;
  subwayStateEl.textContent = "실시간 조회 완료";
  subwaySummaryEl.textContent = arrivals.length
    ? `사당역 4호선 실시간 도착정보 ${arrivals.length}건을 불러왔습니다.`
    : "현재 보여줄 도착정보가 없습니다.";

  if (!arrivals.length) {
    subwayListEl.innerHTML = "";
    return;
  }

  subwayListEl.innerHTML = arrivals
    .map((row) => {
      const direction = row.updnLine ?? "-";
      const destination = row.trainLineNm ?? "-";
      const status = row.arvlMsg2 ?? "-";
      const currentLocation = row.arvlMsg3 ?? "-";
      const arrivalTime = formatSubwayArrivalTime(row.barvlDt);
      const updatedAt = row.recptnDt ?? "-";

      return `
        <section class="vehicle-row">
          <div class="vehicle-head">
            <strong>${destination}</strong>
            <span class="vehicle-pill">${direction}</span>
          </div>
          <div class="vehicle-grid">
            <div class="vehicle-field">
              <span>도착 메시지</span>
              <strong>${status}</strong>
            </div>
            <div class="vehicle-field">
              <span>현재 위치</span>
              <strong>${currentLocation}</strong>
            </div>
            <div class="vehicle-field">
              <span>도착까지</span>
              <strong>${arrivalTime}</strong>
            </div>
            <div class="vehicle-field">
              <span>갱신 시각</span>
              <strong>${updatedAt}</strong>
            </div>
          </div>
          <p class="vehicle-note">사당역 4호선 실시간 도착정보입니다.</p>
        </section>
      `;
    })
    .join("");
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

  const fallback = buildFallbackBusData(dayValue, timeMinutes);

  return {
    first: {
      arrivalText: predictTime1 === null ? "정보 없음" : `${predictTime1}분 후`,
      locationText: locationNo1 === null ? "정보 없음" : `남은 정류장 ${locationNo1}개`,
      seatText: remainSeatCnt1 === null ? "좌석 정보 없음" : `${remainSeatCnt1}석`,
    },
    second: {
      arrivalText: predictTime2 === null ? "정보 없음" : `${predictTime2}분 후`,
      locationText: locationNo2 === null ? "정보 없음" : `남은 정류장 ${locationNo2}개`,
      seatText: remainSeatCnt2 === null ? "좌석 정보 없음" : `${remainSeatCnt2}석`,
    },
    note1:
      predictTime1 === null
        ? "첫 번째 버스 정보를 찾지 못했습니다."
        : `사당역 9번 출구 기준 첫 번째 버스는 약 ${predictTime1}분 뒤 도착합니다.`,
    note2:
      predictTime2 === null
        ? "두 번째 버스 정보를 찾지 못했습니다."
        : `사당역 9번 출구 기준 두 번째 버스는 약 ${predictTime2}분 뒤 도착합니다.`,
    sourceLabel: "API 실시간",
    fallback,
  };
}

function renderLocationCard(locationEntries) {
  if (!locationEntries.length) {
    locationTitleEl.textContent = "운행 중인 차량 없음";
    locationStateEl.textContent = "실시간 조회 실패";
    locationSummaryEl.textContent = "7800번 실시간 위치 목록을 찾지 못했습니다.";
    locationListEl.innerHTML = "";
    return;
  }

  const sortedEntries = [...locationEntries].sort((a, b) => {
    const seqA = toNumber(a.stationSeq) ?? Number.MAX_SAFE_INTEGER;
    const seqB = toNumber(b.stationSeq) ?? Number.MAX_SAFE_INTEGER;
    return seqA - seqB;
  });

  locationTitleEl.textContent = `${sortedEntries.length}대 운행 중`;
  locationStateEl.textContent = "실시간 위치";
  locationSummaryEl.textContent =
    "현재 운행 중인 7800번 차량들을 정류장 순서와 남은 좌석 기준으로 정리했습니다.";
  locationListEl.innerHTML = sortedEntries
    .map((bus, index) => {
      const crowdedLabel = {
        0: "여유",
        1: "보통",
        2: "혼잡",
      }[bus.crowded] ?? "알수없음";
      const stateLabel = {
        0: "정차 중",
        1: "운행 중",
        2: "도착 전",
      }[bus.stateCd] ?? "상태 미상";
      const stationSeq = toNumber(bus.stationSeq);
      const remainSeatCnt = toNumber(bus.remainSeatCnt);
      const stationId = bus.stationId ?? "-";
      const plateNo = bus.plateNo ?? "-";

      return `
        <section class="vehicle-row">
          <div class="vehicle-head">
            <strong>${index + 1}번째 차량 · ${plateNo}</strong>
            <span class="vehicle-pill">${crowdedLabel} · ${stateLabel}</span>
          </div>
          <div class="vehicle-grid">
            <div class="vehicle-field">
              <span>현재 정류장 ID</span>
              <strong>${stationId}</strong>
            </div>
            <div class="vehicle-field">
              <span>노선상 위치</span>
              <strong>${stationSeq === null ? "-" : `${stationSeq}번째`}</strong>
            </div>
            <div class="vehicle-field">
              <span>남은 좌석</span>
              <strong>${remainSeatCnt === null ? "-" : `${remainSeatCnt}석`}</strong>
            </div>
            <div class="vehicle-field">
              <span>혼잡도</span>
              <strong>${crowdedLabel}</strong>
            </div>
          </div>
          <p class="vehicle-note">차량번호 ${plateNo} 기준으로 현재 실시간 위치를 표시합니다.</p>
        </section>
      `;
    })
    .join("");
}

function formatSubwayArrivalTime(barvlDt) {
  const seconds = toNumber(barvlDt);

  if (seconds === null) {
    return "도착 시간 정보 없음";
  }

  if (seconds <= 0) {
    return "도착 임박";
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes}분 후`;
}

function renderSadangLine4Arrivals(arrivals) {
  subwayCardEl.hidden = false;
  subwayTitleEl.textContent = `${SEOUL_SUBWAY_TARGET_STATION}역 4호선`;
  subwayStateEl.textContent = "실시간 조회 완료";
  subwaySummaryEl.textContent = arrivals.length
    ? `사당역 4호선 실시간 도착정보 ${arrivals.length}건을 불러왔습니다.`
    : "현재 보여줄 도착정보가 없습니다.";

  if (!arrivals.length) {
    subwayListEl.innerHTML = "";
    return;
  }

  subwayListEl.innerHTML = arrivals
    .map((row) => {
      const direction = row.updnLine ?? "-";
      const destination = row.trainLineNm ?? "-";
      const status = row.arvlMsg2 ?? "-";
      const currentLocation = row.arvlMsg3 ?? "-";
      const arrivalTime = formatSubwayArrivalTime(row.barvlDt);
      const updatedAt = row.recptnDt ?? "-";

      return `
        <section class="vehicle-row">
          <div class="vehicle-head">
            <strong>${destination}</strong>
            <span class="vehicle-pill">${direction}</span>
          </div>
          <div class="vehicle-grid">
            <div class="vehicle-field">
              <span>도착 메시지</span>
              <strong>${status}</strong>
            </div>
            <div class="vehicle-field">
              <span>현재 위치</span>
              <strong>${currentLocation}</strong>
            </div>
            <div class="vehicle-field">
              <span>도착까지</span>
              <strong>${arrivalTime}</strong>
            </div>
            <div class="vehicle-field">
              <span>갱신 시각</span>
              <strong>${updatedAt}</strong>
            </div>
          </div>
          <p class="vehicle-note">사당역 4호선 실시간 도착정보입니다.</p>
        </section>
      `;
    })
    .join("");
}

async function updateSubwayUI() {
  subwayCardEl.hidden = false;
  subwayBtn.disabled = true;
  subwayStateEl.textContent = "조회 중";
  subwaySummaryEl.textContent = "사당역 4호선 실시간 도착정보를 불러오는 중입니다.";
  subwayListEl.innerHTML = "";

  try {
    const arrivals = await fetchSadangLine4Arrivals();
    renderSadangLine4Arrivals(arrivals);
  } catch (error) {
    renderSadangLine4Arrivals([]);
    subwayStateEl.textContent = "조회 실패";
    const message = error instanceof Error ? error.message : "사당역 4호선 정보를 불러오지 못했습니다.";
    subwaySummaryEl.textContent = message;
  } finally {
    subwayBtn.disabled = false;
  }

  subwayCardEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function updateUI(openPanel = false) {
  const dayValue = weekdayEl.value;
  const timeMinutes = parseTimeToMinutes(departureEl.value);
  let locationEntries = [];

  if (openPanel) {
    answerPanel.hidden = false;
  }

  subNavState.textContent = openPanel ? "실시간 위치 조회 중..." : "샘플 계산";
  decisionText.textContent = `${weekdayLabels[dayValue] ?? "요일"} · ${departureEl.value}`;
  decisionSub.textContent =
    "7800번 버스의 실시간 위치를 보여주고, 선택한 요일과 시간 기준으로 3시간 뒤 예상도 같이 계산합니다.";

  let busData;
  try {
    const payload = await fetchBusData();
    locationEntries = payload.locationEntries;
    busData = buildLocationBusData(locationEntries);
  } catch (_error) {
    busData = null;
  }

  if (!busData) {
    busData = isTodaySelection(dayValue) && isNearNow(timeMinutes)
      ? {
          first: {
            arrivalText: "실시간 조회 실패",
            locationText: "7800번 데이터 없음",
            seatText: "실시간 확인 실패",
          },
          second: {
            arrivalText: "실시간 조회 실패",
            locationText: "7800번 데이터 없음",
            seatText: "실시간 확인 실패",
          },
          note1: "오늘이고 현재 시간에 가까워서 과거 데이터 대신 실시간 정보가 필요하지만, 7800번 항목을 찾지 못했습니다.",
          note2: "오늘이고 현재 시간에 가까워서 과거 데이터 대신 실시간 정보가 필요하지만, 7800번 항목을 찾지 못했습니다.",
          sourceLabel: "실시간 조회 실패",
        }
      : buildFallbackBusData(dayValue, timeMinutes);
  }

  answerPanel.hidden = false;
  subNavState.textContent = busData.sourceLabel;

  busArrival1El.textContent = busData.first.arrivalText;
  busPredict1El.textContent = busData.first.arrivalText;
  busLocation1El.textContent = busData.first.locationText;
  busSeat1El.textContent = busData.first.seatText;
  busNote1El.textContent = busData.first.note ?? busData.note1;

  busArrival2El.textContent = busData.second.arrivalText;
  busPredict2El.textContent = busData.second.arrivalText;
  busLocation2El.textContent = busData.second.locationText;
  busSeat2El.textContent = busData.second.seatText;
  busNote2El.textContent = busData.second.note ?? busData.note2;

  const forecast = buildForecast(dayValue, timeMinutes, busData.seedEntry ?? null);
  forecastTimeEl.textContent = forecast.label;
  forecastStateEl.textContent = busData.seedEntry ? "실시간 보정" : "과거 패턴";
  forecastArrivalEl.textContent = forecast.arrivalText;
  forecastSeatsEl.textContent = forecast.seatsText;
  forecastBoardingEl.textContent = `${forecast.boardingText} · ${forecast.congestionText}`;
  forecastNoteEl.textContent = forecast.noteText;

  if (!locationCardEl.hidden) {
    renderLocationCard(locationEntries);
  }
}

refreshBtn.addEventListener("click", () => updateUI(true));
nowBtn.addEventListener("click", async () => {
  setCurrentSelection();
  await updateUI(true);
});
locationBtn.addEventListener("click", async () => {
  locationCardEl.hidden = false;
  await updateUI(true);
  locationCardEl.scrollIntoView({ behavior: "smooth", block: "start" });
});
subwayBtn.addEventListener("click", async () => {
  await updateSubwayUI();
});
[departureEl, weekdayEl].forEach((el) => {
  el.addEventListener("input", updateUI);
  el.addEventListener("change", updateUI);
});

updateUI();
