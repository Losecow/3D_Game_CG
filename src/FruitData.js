/**
 * 11단계 과일 데이터 상수
 * 11-level fruit data constants
 *
 * 합체 규칙: level[i] + level[i] → level[i+1]
 * Merge rule:  level[i] + level[i] → level[i+1]
 * 수박(level 10)끼리 합쳐지면 소멸
 * Watermelons (level 10) disappear on merge
 */

export const FRUIT_DATA = [
  { level: 0, name: '체리',      nameEn: 'Cherry',      radius: 0.48, color: '#FF0000', score: 1  },
  { level: 1, name: '딸기',      nameEn: 'Strawberry',  radius: 0.70, color: '#FF2255', score: 3  },
  { level: 2, name: '포도',      nameEn: 'Grape',       radius: 0.95, color: '#8B3FC8', score: 6  },
  { level: 3, name: '귤',        nameEn: 'Dekopon',     radius: 1.25, color: '#FF8C00', score: 10 },
  { level: 4, name: '감',        nameEn: 'Persimmon',   radius: 1.55, color: '#FF4500', score: 15 },
  { level: 5, name: '사과',      nameEn: 'Apple',       radius: 1.90, color: '#228B22', score: 21 },
  { level: 6, name: '배',        nameEn: 'Pear',        radius: 2.25, color: '#D4E044', score: 28 },
  { level: 7, name: '복숭아',    nameEn: 'Peach',       radius: 2.65, color: '#FFAEB9', score: 36 },
  { level: 8, name: '파인애플',  nameEn: 'Pineapple',   radius: 3.10, color: '#FFD700', score: 45 },
  { level: 9, name: '멜론',      nameEn: 'Melon',       radius: 3.70, color: '#98FF55', score: 55 },
  { level: 10, name: '수박',     nameEn: 'Watermelon',  radius: 4.30, color: '#1E8B00', score: 66 },
];

/** 드롭 가능한 최대 레벨 (처음에 나올 수 있는 최고 과일) / Max droppable level */
export const MAX_DROP_LEVEL = 4;

/** 최고 단계 레벨 인덱스 / Max fruit level index */
export const MAX_LEVEL = FRUIT_DATA.length - 1;
