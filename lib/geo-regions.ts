// "현재 상공" 국가/해역 판정 — 순수 데이터+함수(클라이언트 안전).
//
// 정밀 국경 데이터 대신 주요 국가의 경계 상자(bbox) 목록으로 판정한다.
// 게임 계기판용 표시라 "서울 상공에서 대한민국"이 나오는 수준이면 충분하고,
// 정확한 국경 폴리곤(수백 KB)을 첫 화면 번들에 싣는 비용이 아깝기 때문.
// 상자끼리 겹치는 지역은 배열 앞쪽이 이긴다 → 작은 나라를 큰 나라보다 앞에 둔다.
// 어떤 상자에도 안 들어가면 위경도 밴드로 해역 이름을 돌려준다.
//
// ⚠️ 한계: bbox 라 국경 부근·군도 지역은 이웃 나라로 표시될 수 있다.
//    (worklog 2026-07-27-첫화면-궤도추적-모니터 참고)

export type GeoName = { ko: string; en: string };

type Box = {
  name: GeoName;
  /** [latMin, latMax, lonMin, lonMax] (도) */
  boxes: [number, number, number, number][];
};

// 면적이 작거나 이웃 대국의 상자에 삼켜지기 쉬운 나라를 앞에 둔다.
const COUNTRIES: readonly Box[] = [
  { name: { ko: "대한민국", en: "South Korea" }, boxes: [[33, 39, 124.5, 130.5]] },
  { name: { ko: "조선민주주의인민공화국", en: "North Korea" }, boxes: [[39, 43, 124, 130.7]] },
  { name: { ko: "일본", en: "Japan" }, boxes: [[30, 45.6, 129.5, 146], [24, 30, 122.5, 132]] },
  { name: { ko: "대만", en: "Taiwan" }, boxes: [[21.8, 25.4, 120, 122.1]] },
  { name: { ko: "필리핀", en: "Philippines" }, boxes: [[5, 19.5, 117, 127]] },
  { name: { ko: "베트남", en: "Vietnam" }, boxes: [[8.5, 23.4, 102, 110]] },
  { name: { ko: "태국", en: "Thailand" }, boxes: [[5.6, 20.5, 97.3, 105.7]] },
  { name: { ko: "말레이시아", en: "Malaysia" }, boxes: [[0.8, 7.4, 99.6, 119.3]] },
  { name: { ko: "인도네시아", en: "Indonesia" }, boxes: [[-11, 6, 95, 141]] },
  { name: { ko: "영국", en: "United Kingdom" }, boxes: [[49.9, 60.9, -8.6, 1.8]] },
  { name: { ko: "프랑스", en: "France" }, boxes: [[42.3, 51.1, -4.8, 8.2]] },
  { name: { ko: "스페인", en: "Spain" }, boxes: [[36, 43.8, -9.3, 3.3]] },
  { name: { ko: "포르투갈", en: "Portugal" }, boxes: [[36.9, 42.2, -9.5, -6.2]] },
  { name: { ko: "독일", en: "Germany" }, boxes: [[47.3, 55.1, 5.9, 15]] },
  { name: { ko: "이탈리아", en: "Italy" }, boxes: [[36.6, 47.1, 6.6, 18.5]] },
  { name: { ko: "폴란드", en: "Poland" }, boxes: [[49, 54.9, 14.1, 24.2]] },
  { name: { ko: "우크라이나", en: "Ukraine" }, boxes: [[44.4, 52.4, 22.1, 40.2]] },
  { name: { ko: "튀르키예", en: "Türkiye" }, boxes: [[36, 42.1, 26, 44.8]] },
  { name: { ko: "이란", en: "Iran" }, boxes: [[25, 39.8, 44, 63.3]] },
  { name: { ko: "사우디아라비아", en: "Saudi Arabia" }, boxes: [[16.4, 32.2, 34.5, 55.7]] },
  { name: { ko: "이집트", en: "Egypt" }, boxes: [[22, 31.7, 24.7, 36.9]] },
  { name: { ko: "남아프리카공화국", en: "South Africa" }, boxes: [[-34.9, -22.1, 16.4, 32.9]] },
  { name: { ko: "나이지리아", en: "Nigeria" }, boxes: [[4.2, 13.9, 2.7, 14.7]] },
  { name: { ko: "케냐", en: "Kenya" }, boxes: [[-4.7, 5.5, 33.9, 41.9]] },
  { name: { ko: "에티오피아", en: "Ethiopia" }, boxes: [[3.4, 14.9, 33, 48]] },
  { name: { ko: "알제리", en: "Algeria" }, boxes: [[18.9, 37.1, -8.7, 12]] },
  { name: { ko: "콩고민주공화국", en: "DR Congo" }, boxes: [[-13.5, 5.4, 12.2, 31.3]] },
  { name: { ko: "인도", en: "India" }, boxes: [[6.7, 35.5, 68.1, 97.4]] },
  { name: { ko: "파키스탄", en: "Pakistan" }, boxes: [[23.7, 37.1, 60.9, 77.8]] },
  { name: { ko: "방글라데시", en: "Bangladesh" }, boxes: [[20.7, 26.6, 88, 92.7]] },
  { name: { ko: "카자흐스탄", en: "Kazakhstan" }, boxes: [[40.6, 55.4, 46.5, 87.3]] },
  { name: { ko: "몽골", en: "Mongolia" }, boxes: [[41.6, 52.1, 87.7, 119.9]] },
  { name: { ko: "중국", en: "China" }, boxes: [[18, 53.6, 73.5, 134.8]] },
  { name: { ko: "러시아", en: "Russia" }, boxes: [[41.2, 77.7, 27.3, 180], [64, 71.6, -180, -169]] },
  { name: { ko: "이라크", en: "Iraq" }, boxes: [[29, 37.4, 38.8, 48.6]] },
  { name: { ko: "멕시코", en: "Mexico" }, boxes: [[14.5, 32.7, -117.1, -86.7]] },
  { name: { ko: "미국", en: "United States" }, boxes: [[24.5, 49.4, -124.8, -66.9], [54.5, 71.4, -168.1, -130]] },
  { name: { ko: "캐나다", en: "Canada" }, boxes: [[49.4, 74, -141, -52.6], [45, 49.4, -80, -52.6]] },
  { name: { ko: "브라질", en: "Brazil" }, boxes: [[-33.8, 5.3, -74, -34.8]] },
  { name: { ko: "아르헨티나", en: "Argentina" }, boxes: [[-55.1, -21.8, -73.6, -53.6]] },
  { name: { ko: "칠레", en: "Chile" }, boxes: [[-55.9, -17.5, -75.7, -66.4]] },
  { name: { ko: "페루", en: "Peru" }, boxes: [[-18.4, -0.04, -81.4, -68.7]] },
  { name: { ko: "콜롬비아", en: "Colombia" }, boxes: [[-4.2, 12.5, -79, -66.9]] },
  { name: { ko: "호주", en: "Australia" }, boxes: [[-43.6, -10.7, 113.3, 153.6]] },
  { name: { ko: "뉴질랜드", en: "New Zealand" }, boxes: [[-47.3, -34.4, 166.4, 178.6]] },
  { name: { ko: "그린란드", en: "Greenland" }, boxes: [[59.8, 83.6, -73.3, -12.2]] },
  { name: { ko: "노르웨이", en: "Norway" }, boxes: [[58, 71.2, 4.6, 31.1]] },
  { name: { ko: "스웨덴", en: "Sweden" }, boxes: [[55.3, 69.1, 11.1, 24.2]] },
  { name: { ko: "핀란드", en: "Finland" }, boxes: [[59.8, 70.1, 20.6, 31.6]] },
];

const OCEANS: { name: GeoName; test: (lat: number, lon: number) => boolean }[] = [
  { name: { ko: "북극해", en: "Arctic Ocean" }, test: (lat) => lat > 66 },
  { name: { ko: "남극", en: "Antarctica" }, test: (lat) => lat < -60 },
  {
    name: { ko: "대서양", en: "Atlantic Ocean" },
    test: (lat, lon) => lon >= -70 && lon < 20 && lat > -60,
  },
  {
    name: { ko: "인도양", en: "Indian Ocean" },
    test: (lat, lon) => lon >= 20 && lon < 147 && lat < 25,
  },
  { name: { ko: "태평양", en: "Pacific Ocean" }, test: () => true }, // 폴백
];

/** 위경도(도) → 지역 이름. 국가 bbox 우선, 아니면 해역. */
export function regionAt(lat: number, lon: number): GeoName {
  // 경도 정규화 (−180~180)
  let L = lon;
  while (L > 180) L -= 360;
  while (L < -180) L += 360;

  for (const c of COUNTRIES) {
    for (const [latMin, latMax, lonMin, lonMax] of c.boxes) {
      if (lat >= latMin && lat <= latMax && L >= lonMin && L <= lonMax) return c.name;
    }
  }
  for (const o of OCEANS) {
    if (o.test(lat, L)) return o.name;
  }
  return { ko: "지구 저궤도", en: "Low Earth orbit" };
}
