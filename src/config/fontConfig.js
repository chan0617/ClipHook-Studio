// 기본 시스템 폰트
export const systemFonts = [
  { id: 'system', label: '기본 고딕', family: 'Inter, system-ui, sans-serif' },
  { id: 'serif', label: '명조 스타일', family: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: '고정폭', family: '"SFMono-Regular", Consolas, monospace' },
];

// 웹 폰트 (Google Fonts)
export const webFonts = [
  {
    id: 'noto-sans-kr',
    label: 'Noto Sans KR',
    family: '"Noto Sans KR", sans-serif',
    googleFont: 'Noto+Sans+KR:wght@400;700;900',
  },
  {
    id: 'noto-serif-kr',
    label: 'Noto Serif KR',
    family: '"Noto Serif KR", serif',
    googleFont: 'Noto+Serif+KR:wght@400;700',
  },
];

// 눈누 무료 폰트 추가 슬롯
// 아래 형식으로 추가하세요:
// {
//   id: 'noonnu-font-id',       // 고유 ID
//   label: '폰트 표시 이름',
//   family: '"폰트 패밀리명", sans-serif',
//   cssUrl: 'https://cdn.jsdelivr.net/...',  // @font-face CSS URL
// }
export const noonnuFonts = [];

export const allFonts = [...systemFonts, ...webFonts, ...noonnuFonts];

export const defaultFontId = 'noto-sans-kr';
