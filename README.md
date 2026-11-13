# 현황판 (dashboard.sjoonkwon.com)

권석준의 공개 모니터 세 곳의 신호를 한 화면에 모은 현황판입니다.

| 사이트 | 이 화면에 가져오는 것 | 자료 |
|---|---|---|
| 3대 메가프로젝트 모니터 (monitor.sjoonkwon.com) | 메가팹 층별 판정, AIDC 1단계 진척(기록 기준), 공공 로봇 계약·입찰 데이터 조항, 서남권 저수율, 다가오는 이벤트, 수집 상태 | `/data/*.json`, `/data/feeds/*.json` |
| 메모리 국면 모니터 (memsim.sjoonkwon.com) | 신호등 개수와 6개월 뒤 수출 감소 확률 | `/data/monitor.csv`, `/data/meta.json` |
| 빅테크 AI 투자 시뮬레이터 (aicapex.sjoonkwon.com) | 4사 분기 설비투자, 설비투자 ÷ 영업현금흐름 | `/capex/data/quarterly.csv` |

## 원칙
- 판정은 이 화면에서 새로 만들지 않습니다. 각 사이트가 쓰는 규칙과 숫자를 그대로 옮깁니다. 판정이 없는 곳은 사실(기록·공시)만 그립니다.
- 카드마다 근거의 성격(규칙 판정·모형 추정·공시 집계·기록)을 적고, 원 페이지로 링크합니다.
- 자료는 브라우저가 세 사이트에서 직접 읽습니다(각 사이트 `_headers`에서 이 주소만 허용). 한 사이트가 멈추면 그 카드만 "읽지 못함"으로 보입니다.

## 배포
`main`에 커밋하면 Cloudflare Workers가 `wrangler.jsonc`대로 `public/`을 배포합니다. 빌드 단계는 없습니다.
