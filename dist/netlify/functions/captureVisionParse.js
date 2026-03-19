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
  if (p.fromFloor) score += 1;
  if (p.toFloor) score += 1;
  if (p.noFrom === true || p.noFrom === false) score += 1;
  if (p.noTo === true || p.noTo === false) score += 1;
  score += Math.min(3, Object.keys(p.items || {}).length);
  return score;
}


function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function inferService(text) {
  const raw = normalizeText(text);
  if (/(입주청소|이사청소|거주청소|청소)/.test(raw)) return 'clean';
  if (/(이사|용달|보관)/.test(raw)) return 'move';
  return 'unknown';
}

function mergeParsed(baseParsed, extractedText, summary) {
  const parsed = JSON.parse(JSON.stringify(baseParsed || {}));
  const text = normalizeText(`${summary || ''}
${extractedText || ''}`);

  if (!parsed.moveDate) {
    const m = text.match(/(20\d{2})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/);
    if (m) parsed.moveDate = `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  }

  if (!parsed.timeSlot) {
    const timeRange = text.match(/(오전|오후)\s*\(?\s*(\d{1,2})\s*[~\-]\s*(\d{1,2})\s*시\s*\)?/);
    if (timeRange) {
      let hour = Number(timeRange[2]);
      if (timeRange[1] === '오후' && hour < 12) hour += 12;
      if (hour >= 7 && hour <= 15) parsed.timeSlot = String(hour);
    }
  }

  return parsed;
}

function classifyCaptureResult(service, parsed, rawText) {
  const text = normalizeText(rawText || '');
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

  if (service === 'move') {
    if (!parsed.startAddress) push('출발지 주소를 다시 확인해 주세요.');
    if (!parsed.endAddress) push('도착지 주소를 다시 확인해 주세요.');
    if (!parsed.moveDate) push('이사 날짜를 다시 확인해 주세요.');
    if (!parsed.timeSlot) push('방문 시간대를 다시 확인해 주세요.');
  }

  if (service === 'clean') {
    if (!parsed.cleanAddress) push('청소 주소를 다시 확인해 주세요.');
  }

  if (!Object.keys(parsed.items || {}).length) push('서비스 대상 품목이 잘 안 읽혀서 다시 확인이 필요합니다.');
  if (/요청 상세|고객 정보/.test(text) && /상단 정보/.test(text) === false) {
    push('상단 정보 캡처를 함께 올리면 날짜와 주소 인식이 더 정확해집니다.');
  }

  return [...new Set(hints)].slice(0, 6);
}

function buildFallbackResponse({ model, imageCount, errorMessage, fallbackReason, extractedText = "", rawText = "" }) {
  const safeText = normalizeText(extractedText || rawText || "");
  const service = inferService(safeText);
  const parsedDefaults = {
    moveDate: null, timeSlot: null, startAddress: null, endAddress: null,
    fromFloor: null, toFloor: null, noFrom: null, noTo: null, moveType: null,
    vehicle: null, loadLevel: null, cleanType: null, cleanSoil: null,
    cleanPyeong: null, cleanAddress: null, cleanFloor: null, cleanNoElevator: null, items: null
  };
  const mergedParsed = mergeParsed(parsedDefaults, safeText, errorMessage || "");
  const parseStatus = classifyCaptureResult(service, mergedParsed, safeText || errorMessage || "");
  return {
    ok: true,
    service: service === "unknown" && safeText ? "move" : service,
    summary: parseStatus === "fail" ? "사진만으로는 정보 확인이 어려워요" : "이미지 텍스트를 일부 읽었어요",
    extractedText: safeText,
    confidence: parseStatus === "success" ? 0.68 : parseStatus === "partial" ? 0.42 : 0.2,
    parsed: mergedParsed,
    missingHints: buildMissingHints(service, mergedParsed, safeText, [errorMessage].filter(Boolean)),
    parseStatus,
    needsReview: parseStatus !== "success",
    textConsultRecommended: shouldSuggestTextConsult(parseStatus, safeText),
    uiMessage: buildUiMessage(parseStatus),
    debug: { model, imageCount, fallbackReason, errorMessage }
  };
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
      "전체 문장을 OCR처럼 복원하려 하지 말고 견적 입력에 필요한 필드만 정확히 뽑아라.",
      "숨고 모바일 앱 캡처 여러 장과 잘린 영역 이미지를 함께 볼 수 있다.",
      "문자를 한 글자씩 최대한 정확하게 읽어라. 요약보다 필드 정확도가 더 중요하다.",
      "출발지와 도착지는 화면 라벨 기준으로 읽고, 확신이 약하면 missingHints에 이유를 적어라.",
      "보이는 텍스트를 extractedText에 최대한 보존해서 넣어라. 단, 허구로 채우지 마라.",
      "필수 우선순위: 서비스, 날짜, 시간대, 출발지, 도착지, 출발지 엘리베이터, 도착지 엘리베이터/층수, 품목.",
      "좌측 라벨과 우측 값을 한 쌍으로 읽어라. 예: 엘리베이터 유무 → 네, 도착지 엘리베이터 → 아니요..: 2층.",
      "날짜는 YYYY-MM-DD로 변환한다.",
      "timeSlot은 7~15 사이 시작 시간 문자열이다. 예: 오후 (12~3시) => 12.",
      "출발지와 도착지를 절대 뒤바꾸지 말라.",
      "책상1 컴퓨터본체1 모니터1 각종 소형짐 같이 붙어 있어도 items에 품목별로 나눠라.",
      "안 보이거나 불확실하면 비워두고 missingHints에 넣어라.",
      "반드시 JSON만 출력한다."
    ].join(" ");

    const userContent = [
      { type: "input_text", text: "업로드된 여러 캡처를 합쳐 하나의 견적 입력 초안을 만들어줘. 일부 이미지는 전체 캡처, 일부는 상단/하단 잘린 보조 이미지다." }
    ];

    rawImages.forEach((img, index) => {
      const label = typeof img === "string" ? `image_${index + 1}` : String(img.label || `image_${index + 1}`);
      const url = typeof img === "string" ? img : img.url;
      if (!url) return;
      userContent.push({ type: "input_text", text: `[${label}]` });
      userContent.push({ type: "input_image", image_url: url, detail: "high" });
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
      return json(buildFallbackResponse({
        model,
        imageCount: rawImages.length,
        errorMessage: result?.error?.message || "Vision request failed",
        fallbackReason: `upstream_${res.status || 500}`
      }), 200);
    }

    const raw = getOutputText(result);
    if (!raw) {
      return json({
        ok: true,
        service: "unknown",
        summary: "사진만으로는 정보 확인이 어려워요",
        extractedText: "",
        confidence: 0.2,
        parsed: {
          moveDate: null, timeSlot: null, startAddress: null, endAddress: null,
          fromFloor: null, toFloor: null, noFrom: null, noTo: null, moveType: null,
          vehicle: null, loadLevel: null, cleanType: null, cleanSoil: null,
          cleanPyeong: null, cleanAddress: null, cleanFloor: null, cleanNoElevator: null, items: null
        },
        missingHints: ["텍스트가 거의 보이지 않아 상단 정보와 요청 상세를 함께 다시 올려주세요."],
        parseStatus: "fail",
        needsReview: false,
        textConsultRecommended: true,
        uiMessage: buildUiMessage("fail"),
        debug: { model, imageCount: rawImages.length, fallbackReason: "empty_output_text" }
      }, 200);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return json({
        ok: true,
        service: inferService(raw),
        summary: "이미지 텍스트를 일부만 읽었어요",
        extractedText: normalizeText(raw),
        confidence: 0.32,
        parsed: {
          moveDate: null, timeSlot: null, startAddress: null, endAddress: null,
          fromFloor: null, toFloor: null, noFrom: null, noTo: null, moveType: null,
          vehicle: null, loadLevel: null, cleanType: null, cleanSoil: null,
          cleanPyeong: null, cleanAddress: null, cleanFloor: null, cleanNoElevator: null, items: null
        },
        missingHints: ["AI 구조화 응답이 불안정해서 텍스트만 우선 추출했어요. 주소와 날짜를 확인해 주세요."],
        parseStatus: normalizeText(raw).length >= 20 ? "partial" : "fail",
        needsReview: true,
        textConsultRecommended: normalizeText(raw).length < 20,
        uiMessage: buildUiMessage(normalizeText(raw).length >= 20 ? "partial" : "fail"),
        debug: { model, imageCount: rawImages.length, fallbackReason: "json_parse_failed", parseError: err.message }
      }, 200);
    }

    const parsedDefaults = {
      moveDate: null, timeSlot: null, startAddress: null, endAddress: null,
      fromFloor: null, toFloor: null, noFrom: null, noTo: null, moveType: null,
      vehicle: null, loadLevel: null, cleanType: null, cleanSoil: null,
      cleanPyeong: null, cleanAddress: null, cleanFloor: null, cleanNoElevator: null, items: null
    };
    parsed.parsed = { ...parsedDefaults, ...(parsed?.parsed || {}) };

    const extractedText = normalizeText(parsed?.extractedText || '');
    const summary = normalizeText(parsed?.summary || '');
    const service = parsed?.service && parsed.service !== 'unknown'
      ? parsed.service
      : inferService(`${summary}
${extractedText}`);
    const mergedParsed = mergeParsed(parsed?.parsed || {}, extractedText, summary);
    const heuristicScore = countParsedFields(mergedParsed);
    const combinedText = `${summary}
${extractedText}`.trim();
    const parseStatus = classifyCaptureResult(service, mergedParsed, combinedText);
    const uiMessage = buildUiMessage(parseStatus);
    const textConsultRecommended = shouldSuggestTextConsult(parseStatus, combinedText);
    const missingHints = buildMissingHints(service, mergedParsed, combinedText, parsed?.missingHints || []);

    let confidence = Number(parsed?.confidence || 0);
    if (!confidence || Number.isNaN(confidence)) confidence = 0.35;
    if (parseStatus === 'success') confidence = Math.max(confidence, heuristicScore >= 6 ? 0.72 : 0.65);
    else if (parseStatus === 'partial') confidence = Math.max(confidence, heuristicScore >= 4 ? 0.58 : 0.45);
    else confidence = Math.min(confidence || 0.35, 0.39);

    return json({
      ok: true,
      service,
      summary: summary || (service === 'move' ? '캡처에서 이사/용달 정보를 읽어 견적 초안을 만들었습니다.' : '캡처에서 청소 정보를 읽어 견적 초안을 만들었습니다.'),
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
    return json(buildFallbackResponse({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      imageCount: 0,
      errorMessage: error?.message || "captureVisionParse failed",
      fallbackReason: "handler_exception"
    }), 200);
  }
};
