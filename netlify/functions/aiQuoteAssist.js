function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function buildMissing(service, snapshot = {}) {
  if (service === "clean") {
    const items = [
      { key: "cleanPyeong", label: "평수", question: "청소 평수가 몇 평인지 알려주세요." },
      { key: "cleanAddress", label: "청소 주소", question: "청소할 주소를 동·호수 전까지만이라도 알려주세요." },
      { key: "moveDate", label: "날짜", question: "청소 희망 날짜를 알려주세요. 예: 4월 20일" },
      { key: "timeSlot", label: "시간", question: "원하시는 시간도 알려주세요. 예: 오전 9시" },
      { key: "cleanType", label: "청소 유형", question: "입주청소 / 이사청소 / 거주청소 중 어떤 건지 알려주세요." },
      { key: "cleanSoil", label: "오염도", question: "오염도는 가벼움 / 보통 / 심함 중 어디에 가까운지 알려주세요." },
    ];
    return items.filter((item) => {
      const value = snapshot[item.key];
      if (typeof value === "number") return !(value > 0);
      return !value;
    });
  }
  const items = [
    { key: "moveDate", label: "날짜", question: "이사 날짜를 알려주세요. 예: 4월 11일" },
    { key: "timeSlot", label: "시간", question: "희망 시간을 알려주세요. 예: 오전 8시" },
    { key: "startAddress", label: "출발지", question: "출발지 주소를 알려주세요. 동네까지만 적어주셔도 괜찮아요." },
    { key: "endAddress", label: "도착지", question: "도착지 주소도 알려주세요." },
    { key: "fromFloor", label: "출발층", question: "출발지는 몇 층인지, 엘리베이터가 있는지도 알려주세요." },
    { key: "toFloor", label: "도착층", question: "도착지는 몇 층인지, 엘리베이터가 있는지도 알려주세요." },
    { key: "moveType", label: "이사 방식", question: "일반이사 / 반포장 / 보관이사 중 어떤 건지 알려주세요." },
    { key: "vehicle", label: "차량", question: "차량은 1톤 카고 / 저상탑 / 카고+저상탑 중 어느 쪽인지 알려주세요." },
    { key: "loadInfo", label: "짐 정보", question: "박스 수나 큰 가전가구 개수를 알려주시면 더 정확해져요." },
  ];
  return items.filter((item) => {
    if (item.key === "loadInfo") return !(snapshot.loadLevel || Object.keys(snapshot.items || {}).length);
    const value = snapshot[item.key];
    if (typeof value === "number") return !(value > 0);
    return !value;
  });
}

function deepMerge(base = {}, overlay = {}) {
  const out = { ...base };
  Object.entries(overlay || {}).forEach(([key, value]) => {
    if (value == null || value === "") return;
    if (key === "items" && value && typeof value === "object") {
      out.items = { ...(base.items || {}), ...value };
      return;
    }
    out[key] = value;
  });
  return out;
}

function extractTextResponse(json) {
  if (typeof json?.output_text === "string" && json.output_text.trim()) return json.output_text.trim();
  const output = Array.isArray(json?.output) ? json.output : [];
  const texts = [];
  output.forEach((item) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((part) => {
      if (typeof part?.text === "string") texts.push(part.text);
    });
  });
  return texts.join("\n").trim();
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json({ ok: true });
  if (event.httpMethod !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ ok: false, error: "Missing OPENAI_API_KEY" }, 503);
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const message = String(body.message || "").trim();
    const targetService = body.targetService === "clean" ? "clean" : "move";
    const currentState = body.currentState && typeof body.currentState === "object" ? body.currentState : {};
    const conversation = Array.isArray(body.conversation) ? body.conversation.slice(-8) : [];
    const lastMissing = Array.isArray(body.lastMissing) ? body.lastMissing.slice(0, 3) : [];

    if (!message) return json({ ok: false, error: "message required" }, 400);

    const schema = {
      name: "quote_assist",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          service: { type: "string", enum: ["move", "clean"] },
          parsed: {
            type: "object",
            additionalProperties: false,
            properties: {
              moveDate: { type: "string" },
              timeSlot: { type: "string" },
              startAddress: { type: "string" },
              endAddress: { type: "string" },
              waypointAddress: { type: "string" },
              hasWaypoint: { type: "boolean" },
              fromFloor: { type: "number" },
              toFloor: { type: "number" },
              noFrom: { type: "boolean" },
              noTo: { type: "boolean" },
              moveType: { type: "string", enum: ["general", "half", "storage"] },
              vehicle: { type: "string", enum: ["1톤 카고", "1톤 저상탑", "1톤 카고+저상탑"] },
              storageDays: { type: "number" },
              loadLevel: { type: "number" },
              throwToggle: { type: "boolean" },
              workFrom: { type: "boolean" },
              workTo: { type: "boolean" },
              cleaningToggle: { type: "boolean" },
              ride: { type: "number" },
              cleanType: { type: "string", enum: ["movein", "moveout", "living"] },
              cleanSoil: { type: "string", enum: ["light", "normal", "heavy"] },
              cleanPyeong: { type: "number" },
              cleanRooms: { type: "number" },
              cleanBaths: { type: "number" },
              cleanBalconies: { type: "number" },
              cleanWardrobes: { type: "number" },
              cleanAddress: { type: "string" },
              cleanFloor: { type: "number" },
              cleanNoElevator: { type: "boolean" },
              cleanOuterWindowEnabled: { type: "boolean" },
              cleanOuterWindowPyeong: { type: "number" },
              cleanPhytoncideEnabled: { type: "boolean" },
              cleanDisinfectEnabled: { type: "boolean" },
              cleanTrashBags: { type: "number" },
              items: {
                type: "object",
                additionalProperties: { type: "number" },
              },
            },
            required: [],
          },
          assistantMessage: { type: "string" },
          note: { type: "string" },
          missing: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                key: { type: "string" },
                label: { type: "string" },
                question: { type: "string" },
              },
              required: ["key", "label", "question"],
            },
          },
        },
        required: ["service", "parsed", "assistantMessage", "note", "missing"],
      },
    };

    const instructions = [
      "너는 한국어 이사/청소 견적 입력 보조 AI다.",
      "자유문장을 읽고 견적 폼에 넣을 값만 구조화한다.",
      "모르는 값은 추측하지 말고 비워 둔다.",
      "시간은 7~15시 숫자 문자열만 넣는다. 예: '8', '14'.",
      "주소는 문장 그대로 최대한 보존하되 불필요한 감탄사/조사는 제거한다.",
      "items는 내부 품목명과 수량 숫자만 넣는다.",
      "assistantMessage는 고객에게 보여줄 존댓말 한국어로 작성한다. 이번 메시지에서 새로 반영된 값이 적더라도 currentState에 이미 있는 값은 유지된다고 전제하고 자연스럽게 이어서 질문한다.",
      "사용자는 여러 번 나눠서 입력할 수 있다. latestUserMessage만 보고 전체 정보를 다시 초기화하지 말고 currentState와 conversation을 기준으로 이어받아 해석한다.",
      "missing은 지금 꼭 더 받으면 좋은 항목만 최대 3개까지 넣는다. 출발지/도착지라는 단어가 없어도 마포구 신수동에서 은평구 갈현동으로 같은 문장에서 출발지와 도착지를 인식한다.",
      "반포장은 moveType=half, 보관이사는 moveType=storage, 일반/용달은 general이다.",
      "서비스가 불분명하면 targetService와 currentState를 우선한다.",
      "반드시 JSON만 출력한다.",
    ].join(" ");

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: instructions },
          {
            role: "user",
            content: JSON.stringify({ targetService, currentState, conversation, lastMissing, latestUserMessage: message }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: schema,
        },
      }),
    });

    const jsonRes = await res.json();
    if (!res.ok) {
      return json({ ok: false, error: jsonRes?.error?.message || "OpenAI request failed" }, res.status || 500);
    }

    const raw = extractTextResponse(jsonRes);
    const parsedJson = JSON.parse(raw || "{}");
    const mergedParsed = deepMerge(currentState, parsedJson.parsed || {});
    const missing = buildMissing(parsedJson.service || targetService, mergedParsed).slice(0, 3);

    return json({
      ok: true,
      service: parsedJson.service || targetService,
      parsed: parsedJson.parsed || {},
      assistantMessage: parsedJson.assistantMessage || "핵심값을 반영했어. 부족한 값만 조금 더 알려줘.",
      note: parsedJson.note || "OpenAI 정밀 분석 사용 중",
      missing: Array.isArray(parsedJson.missing) && parsedJson.missing.length ? parsedJson.missing.slice(0, 3) : missing,
      source: "openai",
      model,
    });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}
