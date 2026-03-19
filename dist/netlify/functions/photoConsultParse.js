function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify(body),
  };
}

function buildSchema() {
  const parsedProperties = {
    moveDate: { type: ["string", "null"] },
    timeSlot: { type: ["string", "null"] },
    startAddress: { type: ["string", "null"] },
    endAddress: { type: ["string", "null"] },
    fromFloor: { type: ["number", "null"] },
    toFloor: { type: ["number", "null"] },
    noFrom: { type: ["boolean", "null"] },
    noTo: { type: ["boolean", "null"] },
    moveType: { type: ["string", "null"], enum: ["general", "half", "storage", null] },
    vehicle: { type: ["string", "null"], enum: ["1톤 카고", "1톤 저상탑", "1톤 카고+저상탑", null] },
    loadLevel: { type: ["number", "null"] },
    cleanType: { type: ["string", "null"], enum: ["movein", "moveout", "living", null] },
    cleanSoil: { type: ["string", "null"], enum: ["light", "normal", "heavy", null] },
    cleanPyeong: { type: ["number", "null"] },
    cleanAddress: { type: ["string", "null"] },
    cleanFloor: { type: ["number", "null"] },
    cleanNoElevator: { type: ["boolean", "null"] },
    items: {
      type: ["object", "null"],
      additionalProperties: { type: "number" }
    }
  };

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      service: { type: "string", enum: ["move", "clean", "unknown"] },
      summary: { type: "string" },
      extractedText: { type: "string" },
      confidence: { type: "number" },
      parsed: {
        type: "object",
        additionalProperties: false,
        properties: parsedProperties,
        required: Object.keys(parsedProperties)
      },
      missingHints: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["service", "summary", "extractedText", "confidence", "parsed", "missingHints"]
  };
}

function getOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const texts = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") texts.push(part.text);
      if (typeof part?.output_text === "string") texts.push(part.output_text);
    }
  }
  return texts.join("\n").trim();
}

function countParsedFields(parsed) {
  const p = parsed || {};
  let score = 0;
  if (p.moveDate) score += 1;
  if (p.timeSlot) score += 1;
  if (p.startAddress) score += 2;
  if (p.endAddress) score += 2;
  if (p.cleanAddress) score += 2;
  if (Number.isFinite(p.fromFloor)) score += 1;
  if (Number.isFinite(p.toFloor)) score += 1;
  if (p.noFrom === true || p.noFrom === false) score += 1;
  if (p.noTo === true || p.noTo === false) score += 1;
  score += Math.min(3, Object.keys(p.items || {}).length);
  return score;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/…/g, "...")
    .replace(/[‐‑‒–—]/g, "-")
    .trim();
}

function toLines(text) {
  return normalizeText(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function pad2(v) {
  return String(v).padStart(2, "0");
}

function parseKoreanDate(text) {
  const m = String(text || "").match(/(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (!m) return "";
  return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
}

function parseTimeSlot(text) {
  const m = String(text || "").match(/(오전|오후)?\s*\(?\s*(\d{1,2})\s*[~-]\s*(\d{1,2})\s*시\s*\)?/);
  if (!m) return "";
  const meridiem = m[1] || "";
  let start = Number(m[2]);
  if (meridiem === "오후" && start >= 1 && start <= 11) start += 12;
  if (meridiem === "오전" && start === 12) start = 0;
  return String(start);
}

function extractAddresses(text) {
  const src = normalizeText(text).replace(/\n/g, " ");
  const regex = /((?:[가-힣]{2,}(?:특별시|광역시|자치시|도)\s*)?(?:[가-힣]{1,}(?:시|군|구))\s+[가-힣0-9]{1,}(?:구|군)?\s+[가-힣0-9]{1,}(?:읍|면|동|리))/g;
  const out = [];
  let m;
  while ((m = regex.exec(src)) !== null) {
    out.push(m[1].replace(/\s+/g, " ").trim());
  }
  return uniq(out);
}

function getWindow(text, label) {
  const src = normalizeText(text);
  const idx = src.indexOf(label);
  if (idx < 0) return "";
  return src.slice(idx, Math.min(src.length, idx + 80));
}

function findBooleanNear(text, labels) {
  const src = normalizeText(text);
  for (const label of labels) {
    const area = getWindow(src, label);
    if (!area) continue;
    if (/(아니오|없음|없어요|없습니다|무|X|x)/.test(area)) return false;
    if (/(있음|있어요|있습니다|네\b|유\b|O\b|o\b)/.test(area)) return true;
  }
  return null;
}

function findFloorNear(text, labels) {
  const src = normalizeText(text);
  for (const label of labels) {
    const area = getWindow(src, label);
    if (!area) continue;
    const m = area.match(/(\d{1,2})\s*층/);
    if (m) return Number(m[1]);
  }
  return null;
}

function extractItems(text) {
  const src = normalizeText(text);
  const dict = [
    ["책상", /(책상|테이블|책상1)/g],
    ["컴퓨터본체", /(컴퓨터본체|본체)/g],
    ["모니터", /(모니터)/g],
    ["의자", /(의자)/g],
    ["침대", /(침대)/g],
    ["매트리스", /(매트리스)/g],
    ["냉장고", /(냉장고)/g],
    ["세탁기", /(세탁기)/g],
    ["전자레인지", /(전자레인지)/g],
    ["행거", /(행거)/g],
    ["선반", /(선반)/g],
    ["박스", /(박스)/g],
    ["소형짐", /(소형짐|잡화|생활짐|봉투)/g],
  ];
  const items = {};
  for (const [name, regex] of dict) {
    const matches = src.match(regex);
    if (matches?.length) items[name] = matches.length;
  }

  const serviceTargetArea = getWindow(src, "서비스 대상") || src;
  const compactMatches = [...serviceTargetArea.matchAll(/(책상|컴퓨터본체|모니터|의자|침대|냉장고|세탁기|박스)(\d+)/g)];
  for (const m of compactMatches) {
    const name = m[1];
    const count = Number(m[2]) || 1;
    items[name] = Math.max(items[name] || 0, count);
  }

  return items;
}

function inferService(text) {
  const src = normalizeText(text);
  if (/(용달|화물 운송|운송|이사)/.test(src)) return "move";
  if (/(입주청소|이사청소|생활청소|청소)/.test(src)) return "clean";
  return "unknown";
}

function mergeParsed(baseParsed, extractedText, summary) {
  const parsed = { ...(baseParsed || {}) };
  const sourceText = [extractedText, summary].filter(Boolean).join("\n");
  const text = normalizeText(sourceText);
  const addresses = extractAddresses(text);

  if (!parsed.moveDate) parsed.moveDate = parseKoreanDate(text) || parsed.moveDate || "";
  if (!parsed.timeSlot) parsed.timeSlot = parseTimeSlot(text) || parsed.timeSlot || "";

  if (!parsed.startAddress && addresses[0]) parsed.startAddress = addresses[0];
  if (!parsed.endAddress && addresses[1]) parsed.endAddress = addresses[1];
  if (!parsed.cleanAddress && !parsed.startAddress && addresses[0]) parsed.cleanAddress = addresses[0];

  const fromElevator = findBooleanNear(text, ["엘리베이터 유무", "출발지 엘리베이터", "상차지 엘리베이터"]);
  const toElevator = findBooleanNear(text, ["도착지 엘리베이터", "하차지 엘리베이터", "도착지 엘베"]);

  if (parsed.noFrom == null && fromElevator != null) parsed.noFrom = !fromElevator;
  if (parsed.noTo == null && toElevator != null) parsed.noTo = !toElevator;
  if (parsed.cleanNoElevator == null && toElevator != null) parsed.cleanNoElevator = !toElevator;

  if (!Number.isFinite(parsed.fromFloor)) {
    const floor = findFloorNear(text, ["출발지 엘리베이터", "상차지", "출발지"]);
    if (Number.isFinite(floor)) parsed.fromFloor = floor;
  }
  if (!Number.isFinite(parsed.toFloor)) {
    const floor = findFloorNear(text, ["도착지 엘리베이터", "하차지", "도착지"]);
    if (Number.isFinite(floor)) parsed.toFloor = floor;
  }

  parsed.items = { ...extractItems(text), ...(parsed.items || {}) };

  if (!parsed.moveType && /보관|창고/.test(text)) parsed.moveType = "storage";
  else if (!parsed.moveType && /반포장/.test(text)) parsed.moveType = "half";
  else if (!parsed.moveType && inferService(text) === "move") parsed.moveType = "general";

  if (!parsed.vehicle) {
    if (/카고\s*\+\s*저상탑/.test(text)) parsed.vehicle = "1톤 카고+저상탑";
    else if (/저상탑/.test(text)) parsed.vehicle = "1톤 저상탑";
    else if (/카고|1톤/.test(text)) parsed.vehicle = "1톤 카고";
  }

  if (!Number.isFinite(parsed.loadLevel)) {
    const itemCount = Object.values(parsed.items || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
    if (itemCount >= 7) parsed.loadLevel = 3;
    else if (itemCount >= 4) parsed.loadLevel = 2;
    else if (itemCount >= 1) parsed.loadLevel = 1;
  }

  return parsed;
}


function classifyCaptureResult(service, parsed, rawText) {
  const text = normalizeText(rawText || "");
  const fieldScore = countParsedFields(parsed || {});
  const hasCoreKeyword = /(이사|용달|보관|청소|출발지|도착지|주소|엘리베이터|엘베|계단|냉장고|세탁기|침대|박스|서비스 대상|요청사항)/.test(text);
  const addressCount = [parsed?.startAddress, parsed?.endAddress, parsed?.cleanAddress].filter(Boolean).length;
  const hasDate = Boolean(parsed?.moveDate);
  const itemCount = Object.keys(parsed?.items || {}).length;

  if (service === 'move') {
    if (fieldScore >= 7 || (addressCount >= 2 && hasDate)) return 'success';
    if (fieldScore >= 3 || (text.length >= 20 && hasCoreKeyword)) return 'partial';
    return 'fail';
  }

  if (service === 'clean') {
    if (fieldScore >= 5 || (Boolean(parsed?.cleanAddress) && itemCount >= 1)) return 'success';
    if (fieldScore >= 2 || (text.length >= 20 && hasCoreKeyword)) return 'partial';
    return 'fail';
  }

  if (fieldScore >= 5) return 'success';
  if (fieldScore >= 2 || (text.length >= 20 && hasCoreKeyword)) return 'partial';
  return 'fail';
}

function shouldSuggestTextConsult(parseStatus, rawText) {
  const text = normalizeText(rawText || '');
  const hasCoreKeyword = /(이사|용달|보관|청소|출발지|도착지|주소|엘리베이터|엘베|계단|냉장고|세탁기|침대|박스|서비스 대상|요청사항)/.test(text);
  return parseStatus === 'fail' && (!hasCoreKeyword || text.length < 20);
}

function buildUiMessage(parseStatus) {
  if (parseStatus === 'success') {
    return {
      title: '캡처 내용을 읽었어요',
      message: '읽은 정보를 자동으로 입력했어요. 내용만 확인해주세요.'
    };
  }
  if (parseStatus === 'partial') {
    return {
      title: '일부 정보만 읽혔어요',
      message: '대부분 읽었지만 몇몇 정보가 불분명해요. 아래 내용을 확인하고 수정해주세요.'
    };
  }
  return {
    title: '사진만으로는 정보 확인이 어려워요',
    message: '문자가 잘 보이도록 다시 찍어주시거나 문자 상담으로 보내주시면 빠르게 도와드릴게요.'
  };
}

function buildMissingHints(service, parsed, text, existingHints) {
  const hints = [...(Array.isArray(existingHints) ? existingHints : [])];
  const push = (v) => { if (v && !hints.includes(v)) hints.push(v); };

  if (service === "move") {
    if (!parsed.startAddress) push("출발지 주소를 다시 확인해 주세요.");
    if (!parsed.endAddress) push("도착지 주소를 다시 확인해 주세요.");
    if (!parsed.moveDate) push("이사 날짜를 다시 확인해 주세요.");
    if (!parsed.timeSlot) push("방문 시간대를 다시 확인해 주세요.");
  }

  if (service === "clean") {
    if (!parsed.cleanAddress) push("청소 주소를 다시 확인해 주세요.");
  }

  if (!Object.keys(parsed.items || {}).length) push("서비스 대상 품목이 잘 안 읽혀서 다시 확인이 필요합니다.");
  if (/요청 상세|고객 정보/.test(text) && /상단 정보/.test(text) === false) {
    push("상단 정보 캡처를 함께 올리면 날짜와 주소 인식이 더 정확해집니다.");
  }

  return uniq(hints).slice(0, 6);
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({ ok: true });
  if (event.httpMethod !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ ok: false, error: "Missing OPENAI_API_KEY" }, 503);

  try {
    const body = JSON.parse(event.body || "{}");
    const rawImages = Array.isArray(body.images) ? body.images.filter(Boolean).slice(0, 8) : [];
    if (!rawImages.length) return json({ ok: false, error: "images required" }, 400);

    const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

    const systemText = [
      "너는 한국어 이사/청소 견적 앱 캡처 전용 구조화 추출기다.",
      "전체 문장을 예쁘게 요약하는 것보다 필드 추출 정확도가 더 중요하다.",
      "숨고 모바일 앱 캡처 여러 장과 잘린 보조 이미지를 함께 본다.",
      "반드시 모든 이미지의 정보를 합쳐서 하나의 결과를 만든다.",
      "상단 정보 캡처에는 날짜, 시간, 출발지, 도착지가 있고 하단 캡처에는 요청 상세가 있을 수 있다.",
      "좌측 라벨과 우측 값을 한 쌍으로 읽어라. 예: 엘리베이터 유무 → 네, 도착지 엘리베이터 → 아니요..: 2층.",
      "출발지와 도착지를 절대 뒤바꾸지 말라.",
      "보이는 텍스트를 extractedText에 최대한 보존해서 넣되, 라벨과 값을 줄바꿈으로 유지해라.",
      "날짜는 YYYY-MM-DD로 변환한다.",
      "timeSlot은 7~15 사이 시작 시간 문자열이다. 예: 오후 (12~3시) => 12, 오후 (1~4시) => 13.",
      "책상1 컴퓨터본체1 모니터1 각종 소형짐 같이 붙어 있어도 items에 품목별로 나눠라.",
      "확실하지 않으면 비워두고 missingHints에 짧게 이유를 적어라.",
      "반드시 JSON만 출력한다. 허구로 채우지 말라."
    ].join(" ");

    const userContent = [
      { type: "input_text", text: "업로드된 여러 캡처를 합쳐 하나의 견적 입력 초안을 만들어줘. 일부 이미지는 전체 캡처, 일부는 상단/하단 잘린 보조 이미지다." }
    ];

    rawImages.forEach((img, index) => {
      const label = typeof img === "string" ? `image_${index + 1}` : String(img.label || `image_${index + 1}`);
      const url = typeof img === "string" ? img : img.url;
      if (!url) return;
      userContent.push({ type: "input_text", text: `[${label}] 이 이미지의 텍스트를 가능한 정확히 읽고 다른 이미지와 합쳐 판단해라.` });
      userContent.push({ type: "input_image", image_url: url, detail: index < 4 ? "high" : "low" });
    });

    const payload = {
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemText }] },
        { role: "user", content: userContent }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "capture_vision_parse",
          strict: true,
          schema: buildSchema()
        }
      }
    };

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok) {
      return json({ ok: false, error: result?.error?.message || "Vision request failed", debug: result }, res.status || 500);
    }

    const raw = getOutputText(result);
    if (!raw) return json({ ok: false, error: "Vision response text empty", debug: result }, 502);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(raw);
    } catch (err) {
      return json({ ok: false, error: `Vision JSON parse failed: ${err.message}`, raw }, 502);
    }

    const parsedDefaults = {
      moveDate: null, timeSlot: null, startAddress: null, endAddress: null,
      fromFloor: null, toFloor: null, noFrom: null, noTo: null, moveType: null,
      vehicle: null, loadLevel: null, cleanType: null, cleanSoil: null,
      cleanPyeong: null, cleanAddress: null, cleanFloor: null, cleanNoElevator: null, items: null
    };
    parsedResponse.parsed = { ...parsedDefaults, ...(parsedResponse?.parsed || {}) };

    const extractedText = normalizeText(parsedResponse?.extractedText || "");
    const summary = normalizeText(parsedResponse?.summary || "");
    const service = parsedResponse?.service && parsedResponse.service !== "unknown"
      ? parsedResponse.service
      : inferService(`${summary}\n${extractedText}`);

    const mergedParsed = mergeParsed(parsedResponse?.parsed || {}, extractedText, summary);
    const missingHints = buildMissingHints(service, mergedParsed, `${summary}\n${extractedText}`, parsedResponse?.missingHints || []);

    let confidence = Number(parsedResponse?.confidence || 0);
    const heuristicScore = countParsedFields(mergedParsed);
    const combinedText = `${summary}
${extractedText}`.trim();
    const parseStatus = classifyCaptureResult(service, mergedParsed, combinedText);
    const uiMessage = buildUiMessage(parseStatus);
    const textConsultRecommended = shouldSuggestTextConsult(parseStatus, combinedText);

    if (!confidence || Number.isNaN(confidence)) confidence = 0.35;
    if (parseStatus === 'success') confidence = Math.max(confidence, heuristicScore >= 6 ? 0.72 : 0.65);
    else if (parseStatus === 'partial') confidence = Math.max(confidence, heuristicScore >= 4 ? 0.58 : 0.45);
    else confidence = Math.min(confidence || 0.35, 0.39);

    return json({
      ok: true,
      service,
      summary: summary || (service === "move" ? "캡처에서 이사/용달 정보를 읽어 견적 초안을 만들었습니다." : "캡처에서 청소 정보를 읽어 견적 초안을 만들었습니다."),
      extractedText,
      confidence: Math.min(0.99, confidence),
      parsed: mergedParsed,
      missingHints,
      parseStatus,
      needsReview: parseStatus === 'partial',
      textConsultRecommended,
      uiMessage,
      debug: {
        model,
        imageCount: rawImages.length,
        fieldScore: heuristicScore
      }
    });
  } catch (error) {
    return json({ ok: false, error: error?.message || "captureVisionParse failed" }, 500);
  }
};