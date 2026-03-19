# AI 견적 도우미 설정

Netlify 환경변수에 아래 값 추가:

- `OPENAI_API_KEY` = OpenAI API 키
- `OPENAI_MODEL` = 선택사항, 기본값 `gpt-4o-mini`

배포 후 `/.netlify/functions/aiQuoteAssist` 가 활성화되면,
프론트 AI 상담 위젯이 로컬 규칙 + 서버 AI 분석을 함께 사용한다.

환경변수가 없으면 위젯은 자동으로 로컬 분석 모드로만 동작한다.


## 캡처 서버 분석 추가
- Netlify 환경변수 `OPENAI_API_KEY` 필요
- 선택적으로 `OPENAI_VISION_MODEL` 지정 가능
- 함수: `/.netlify/functions/captureVisionParse`
- 흐름: 서버 이미지 분석 우선 → 부족하면 브라우저 OCR 자동 fallback


## 2026-03-18 추가
- 숨고 캡처 업로드 input을 iOS 대응 방식으로 변경 (`hidden` 제거, 시각적 숨김 처리)
- 첫 화면에 `사진 올려 상담하기` 버튼 추가
- `netlify/functions/photoConsultParse.js` 추가: 짐 사진 기반 상담 요약 / 고객 문자 초안 생성
- 문자앱 열기, 요약 복사, Web Share 공유하기 지원
