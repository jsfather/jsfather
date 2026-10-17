import type { CSSProperties, ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';

type Palette = {
  color: string;
  light: string;
  dark: string;
  shape: 'seal' | 'shield' | 'hex' | 'flower';
  rank: string;
};
export const achievementPalettes: Record<string, Palette> = {
  'first-steps': {
    color: '#63dca0',
    light: '#ddffe4',
    dark: '#287d62',
    shape: 'flower',
    rank: '1',
  },
  'hour-wiser': { color: '#f3bf62', light: '#fff0c8', dark: '#a96e37', shape: 'seal', rank: '1H' },
  'deep-diver': { color: '#65c9f4', light: '#d7f7ff', dark: '#387aa9', shape: 'hex', rank: '10H' },
  'week-streak': {
    color: '#ffab76',
    light: '#ffe6cb',
    dark: '#b26062',
    shape: 'shield',
    rank: '7',
  },
  'month-streak': {
    color: '#ee8eb9',
    light: '#ffe2f1',
    dark: '#a85594',
    shape: 'flower',
    rank: '30',
  },
  'first-class': { color: '#70ddd0', light: '#d6fff4', dark: '#338d91', shape: 'seal', rank: '1' },
  'ten-classes': { color: '#f6a07c', light: '#ffe9d6', dark: '#b9755c', shape: 'hex', rank: '10' },
  'first-course': {
    color: '#ebc86b',
    light: '#fff5cb',
    dark: '#ac8440',
    shape: 'shield',
    rank: '1',
  },
  'five-courses': {
    color: '#b39aef',
    light: '#eee3ff',
    dark: '#7d65b1',
    shape: 'flower',
    rank: '5',
  },
  'hundred-pages': {
    color: '#8acf91',
    light: '#e3ffdb',
    dark: '#4b8b67',
    shape: 'hex',
    rank: '100',
  },
  'first-book': { color: '#77bde9', light: '#dff4ff', dark: '#527aa4', shape: 'seal', rank: '1' },
  'three-books': {
    color: '#d6a1e8',
    light: '#f8e3ff',
    dark: '#9463ad',
    shape: 'shield',
    rank: '3',
  },
  'first-word-review': {
    color: '#efcc70',
    light: '#fff6cd',
    dark: '#aa8650',
    shape: 'flower',
    rank: '1',
  },
  'ten-words': { color: '#87ccd8', light: '#dcf9ff', dark: '#4f90a0', shape: 'hex', rank: '10' },
  'fifty-words': {
    color: '#b6d578',
    light: '#f0ffda',
    dark: '#6d9359',
    shape: 'flower',
    rank: '50',
  },
  'first-exam': { color: '#94c7ff', light: '#e3efff', dark: '#5a7fb5', shape: 'shield', rank: '1' },
  'five-exams': { color: '#f699a0', light: '#ffe5e6', dark: '#b56580', shape: 'hex', rank: '5' },
  'perfect-exam': {
    color: '#f1d06c',
    light: '#fff9d7',
    dark: '#ac8c43',
    shape: 'flower',
    rank: '100%',
  },
  'course-certified': {
    color: '#8bd2b7',
    light: '#e3fff2',
    dark: '#548c83',
    shape: 'seal',
    rank: '★',
  },
  'category-certified': {
    color: '#b5a5f6',
    light: '#eee7ff',
    dark: '#7d69b5',
    shape: 'shield',
    rank: '★',
  },
  'ten-questions': {
    color: '#f1a2cb',
    light: '#ffe8f6',
    dark: '#ac6698',
    shape: 'hex',
    rank: '10',
  },
  'fifty-questions': {
    color: '#a5acef',
    light: '#e7eaff',
    dark: '#666caa',
    shape: 'flower',
    rank: '50',
  },
};
const ink = '#39344e';
function Face({
  x,
  y,
  scale = 1,
  happy = false,
}: {
  x: number;
  y: number;
  scale?: number;
  happy?: boolean;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      fill={ink}
      stroke={ink}
      strokeWidth="2.8"
      strokeLinecap="round"
    >
      {happy ? (
        <>
          <path d="M-15-2q4-6 8 0M7-2q4-6 8 0" fill="none" />
        </>
      ) : (
        <>
          <ellipse cx="-11" cy="-2" rx="2.4" ry="3.7" stroke="none" />
          <ellipse cx="11" cy="-2" rx="2.4" ry="3.7" stroke="none" />
        </>
      )}
      <path d="M-5 7q5 5 10 0" fill="none" />
      <ellipse cx="-21" cy="6" rx="5" ry="3" fill="#f596a8" opacity=".7" stroke="none" />
      <ellipse cx="21" cy="6" rx="5" ry="3" fill="#f596a8" opacity=".7" stroke="none" />
    </g>
  );
}
function Star({
  x,
  y,
  size = 10,
  color = '#ffda73',
  rotate = 0,
}: {
  x: number;
  y: number;
  size?: number;
  color?: string;
  rotate?: number;
}) {
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${size / 10})`}
      d="M0-10 3-3 10 0 3 3 0 10-3 3-10 0-3-3Z"
      fill={color}
      stroke={ink}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  );
}
function Book({
  x,
  y,
  color = '#a69bdf',
  tilt = 0,
}: {
  x: number;
  y: number;
  color?: string;
  tilt?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${tilt})`}
      stroke={ink}
      strokeWidth="3"
      strokeLinejoin="round"
    >
      <rect width="73" height="18" rx="5" fill={color} />
      <path d="M10 5H68V13H10" fill="#fff6df" strokeWidth="2" />
      <path d="M13 0v18" fill="none" />
      <path d="M22 9h38" stroke="#d4c9b5" strokeWidth="1.5" />
    </g>
  );
}
function OpenBook({ color = '#ac9dea' }: { color?: string }) {
  return (
    <g stroke={ink} strokeWidth="3" strokeLinejoin="round">
      <path d="M53 99q23-7 47 5 24-12 47-5v40q-22-8-47 4-24-12-47-4Z" fill={color} />
      <path d="M57 94q22-8 43 4 23-12 43-4v38q-23-5-43 5-20-10-43-5Z" fill="#fff8e9" />
      <path
        d="M100 98v39M67 107q11-2 23 4M67 118q11-2 23 4M111 111q12-6 22-4M111 122q12-6 22-4"
        fill="none"
        strokeWidth="2"
        stroke="#a395b4"
      />
    </g>
  );
}
function Artwork({ id }: { id: string }): ReactNode {
  switch (id) {
    case 'first-steps':
      return (
        <>
          <path d="M99 117V83" stroke="#337b59" strokeWidth="6" strokeLinecap="round" />
          <path
            d="M99 95Q68 96 68 71q27-6 31 24M100 85q4-26 30-23 1 24-30 23"
            fill="#66cf88"
            stroke={ink}
            strokeWidth="3"
          />
          <path
            d="m87 111-16 19M111 111l15 19"
            stroke={ink}
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M67 126q-17-1-16 14 16 8 34 0l-2-11Z"
            fill="#ffb284"
            stroke={ink}
            strokeWidth="3"
          />
          <path d="M119 129q16-6 26 6v8h-30Z" fill="#ffa58e" stroke={ink} strokeWidth="3" />
          <path d="M55 139h25M119 139h23" stroke="#fff5df" strokeWidth="4" strokeLinecap="round" />
          <Face x={98} y={109} scale={0.64} />
          <Star x={144} y={91} size={7} />
        </>
      );
    case 'hour-wiser':
      return (
        <>
          <path d="m68 81-3-20 22 12m26 0 23-12-5 22" fill="#c38a57" stroke={ink} strokeWidth="3" />
          <ellipse cx="100" cy="104" rx="38" ry="39" fill="#d3a16a" stroke={ink} strokeWidth="3" />
          <path
            d="M69 105q4 21 18 28M131 105q-3 20-17 28"
            stroke="#a9704c"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse cx="85" cy="91" rx="17" ry="20" fill="#fff2cf" />
          <ellipse cx="115" cy="91" rx="17" ry="20" fill="#fff2cf" />
          <Face x={100} y={93} scale={0.8} />
          <path d="m96 98 4 6 4-6" fill="#e68a52" />
          <circle cx="102" cy="125" r="20" fill="#77cbbb" stroke={ink} strokeWidth="3" />
          <circle cx="102" cy="125" r="15" fill="#fffae8" />
          <path
            d="M102 114v11l7 4"
            fill="none"
            stroke={ink}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Star x={147} y={80} size={7} />
        </>
      );
    case 'deep-diver':
      return (
        <>
          <path
            d="M136 118q17-5 15-24-9 3-12 11-4-9-13-8"
            fill="#64b9e6"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M57 109q0-30 40-30 39 0 39 32 0 27-39 28-38 0-40-30Z"
            fill="#76c9ee"
            stroke={ink}
            strokeWidth="3"
          />
          <path d="M63 122q36 11 63-2-6 17-31 16-21 0-32-14" fill="#d9f6ff" />
          <path d="M103 119q9 18 21 5" fill="#47a7d8" stroke={ink} strokeWidth="3" />
          <Face x={85} y={110} scale={0.6} />
          <path d="M64 90a38 38 0 0 1 67 0" fill="none" stroke={ink} strokeWidth="3" />
          <path
            d="M61 94q-1-36 35-36 35 0 36 36"
            fill="#c9efff"
            fillOpacity=".5"
            stroke="#fff9e7"
            strokeWidth="6"
          />
          <path
            d="M72 80q2-12 14-15"
            stroke="white"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="144" cy="69" r="6" fill="#d4f5ff" stroke="#5296bd" strokeWidth="2" />
          <circle cx="155" cy="52" r="4" fill="#d4f5ff" stroke="#5296bd" strokeWidth="2" />
        </>
      );
    case 'week-streak':
      return (
        <>
          <path
            d="M102 55q8 29 21 27 19 21 10 43-9 24-34 24-32-1-36-28-3-20 18-42 0 14 9 16 9-16 12-40Z"
            fill="#ff965e"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M101 94q3 15 15 22 12 20-12 27-29 2-29-18 0-10 12-20 2 10 8 10Z"
            fill="#ffdc79"
          />
          <Face x={101} y={114} scale={0.8} />
          <path d="m67 132-10 6m78-6 10 6" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <Star x={142} y={75} size={9} />
          <Star x={60} y={88} size={6} color="#fff1a6" />
        </>
      );
    case 'month-streak':
      return (
        <>
          <path
            d="M100 57q19-8 31 9-8 3-8 14 18 7 20 28-3 30-40 32-36-3-39-26 0-22 21-37 10-8 15-20Z"
            fill="#ffab83"
            stroke={ink}
            strokeWidth="3"
          />
          <path d="M85 89q11 15 34 4-12 6-7 20-17 16-34 1" fill="#ffe6a4" />
          <Face x={99} y={108} scale={0.77} happy />
          <path
            d="m80 68-4-19 17 8 9-17 8 18 17-7-6 20Z"
            fill="#ffda72"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M70 126q-16-4-19-16m80 15q17-6 18-20"
            fill="none"
            stroke="#aa78b5"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <Star x={148} y={85} size={8} color="#e4b5f2" />
          <Star x={53} y={80} size={7} />
        </>
      );
    case 'first-class':
      return (
        <>
          <path
            d="M73 115q9-13 9-29 0-19 19-19t19 19q0 16 10 29Z"
            fill="#ffd47e"
            stroke={ink}
            strokeWidth="3"
          />
          <rect
            x="68"
            y="112"
            width="67"
            height="12"
            rx="6"
            fill="#f1b260"
            stroke={ink}
            strokeWidth="3"
          />
          <path d="M93 125q0 13 16 0" fill="#f3b265" stroke={ink} strokeWidth="3" />
          <circle cx="101" cy="63" r="6" fill="#8ecfc6" stroke={ink} strokeWidth="3" />
          <Face x={101} y={95} scale={0.65} />
          <path
            d="m57 77-7-5m10-7-3-7m85 19 7-5m-10-7 3-7"
            fill="none"
            stroke={ink}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Book x={73} y={137} color="#80cbb8" />
        </>
      );
    case 'ten-classes':
      return (
        <>
          <Book x={61} y={129} color="#92d0c6" tilt={-4} />
          <Book x={60} y={113} color="#b09cdd" tilt={4} />
          <path
            d="m67 85-5-28 28 13q12-4 22 0l27-13-6 30q2 28-33 30-36-2-33-32Z"
            fill="#f7aa79"
            stroke={ink}
            strokeWidth="3"
          />
          <path d="m70 84 29 14 31-14q-1 27-30 29-29-2-30-29" fill="#fff0d6" />
          <path d="m69 64 13 9-12 7m57-16-13 9 13 7" fill="#ba725b" />
          <Face x={100} y={91} scale={0.8} />
          <path d="m96 100 4 4 4-4" fill={ink} />
          <Star x={149} y={101} size={8} />
        </>
      );
    case 'first-course':
      return (
        <>
          <path
            d="M76 79H63q-5 25 19 27m42-27h13q5 25-19 27"
            fill="none"
            stroke={ink}
            strokeWidth="5"
          />
          <path
            d="M77 75h46v24q-3 21-23 23-20-2-23-23Z"
            fill="#ffd77c"
            stroke={ink}
            strokeWidth="3"
          />
          <path d="M100 122v15m-16 3h32" stroke={ink} strokeWidth="6" strokeLinecap="round" />
          <path d="m69 67 31-14 31 14-31 14Z" fill="#7675b0" stroke={ink} strokeWidth="3" />
          <path d="M80 73v12q20 11 40 0V73" fill="#8b89c5" stroke={ink} strokeWidth="3" />
          <path d="M131 67v23" stroke="#e3ad5a" strokeWidth="3" />
          <Face x={100} y={103} scale={0.58} happy />
          <path
            d="M66 135q-16-15-9-35m76 35q16-15 9-35"
            fill="none"
            stroke="#61a789"
            strokeWidth="4"
          />
          <path d="m61 125-10-2 1-11 11 5m72 8 10-2-1-11-11 5" fill="#85cba2" />
        </>
      );
    case 'five-courses':
      return (
        <>
          <circle cx="100" cy="100" r="32" fill="#afa1eb" stroke={ink} strokeWidth="3" />
          <path
            d="M71 87q22 10 49-12m-38 52q18-14 47-12"
            fill="none"
            stroke="#cfbff7"
            strokeWidth="9"
          />
          <ellipse
            cx="100"
            cy="101"
            rx="62"
            ry="18"
            transform="rotate(-25 100 101)"
            fill="none"
            stroke="#f6cc77"
            strokeWidth="5"
          />
          <Face x={100} y={102} scale={0.8} />
          <path d="m78 71 22-11 22 11-22 11Z" fill="#68639d" stroke={ink} strokeWidth="2" />
          <Star x={58} y={65} size={10} />
          <Star x={139} y={64} size={7} color="#ffb5c6" />
          <Star x={147} y={124} size={7} />
          <Star x={69} y={141} size={6} />
          <Star x={111} y={46} size={5} />
        </>
      );
    case 'hundred-pages':
      return (
        <>
          <OpenBook />
          <path
            d="M77 105q-16-23 3-38 15-12 25 1 8 10-1 21-10 9-3 17"
            fill="#8ed39a"
            stroke={ink}
            strokeWidth="3"
          />
          <ellipse cx="87" cy="71" rx="17" ry="19" fill="#a8e3a9" stroke={ink} strokeWidth="3" />
          <Face x={87} y={73} scale={0.55} />
          <path d="M76 54l-4-9m23 9 3-10" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="72" cy="44" r="3" fill="#ffcd77" />
          <circle cx="98" cy="43" r="3" fill="#ffcd77" />
          <Star x={137} y={78} size={10} />
        </>
      );
    case 'first-book':
      return (
        <>
          <path
            d="M66 87q-11-15-5-26 16 1 22 18m36-2q7-18 23-17 3 15-8 26"
            fill="#b5e1fa"
            stroke={ink}
            strokeWidth="3"
          />
          <OpenBook color="#79b9e4" />
          <Face x={100} y={117} scale={0.8} />
          <path d="m92 75 8-14 8 14-8 12Z" fill="#ffd879" stroke={ink} strokeWidth="2.5" />
          <Star x={52} y={108} size={6} />
          <Star x={148} y={112} size={6} />
        </>
      );
    case 'three-books':
      return (
        <>
          <Book x={62} y={131} color="#80c4dc" tilt={-3} />
          <Book x={61} y={114} color="#f3bd79" tilt={3} />
          <Book x={65} y={97} color="#b09bdc" />
          <path
            d="M78 97q-14-16-4-32l-2-13 17 9q13-4 24 2l16-9-1 18q6 17-5 25"
            fill="#f5d2a9"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <Face x={101} y={82} scale={0.68} happy />
          <path
            d="m80 85-12 2m13 5-12 4m53-10 12 1m-12 5 12 4"
            stroke={ink}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M133 110q19-10 7-22"
            fill="none"
            stroke="#f5d2a9"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </>
      );
    case 'first-word-review':
      return (
        <>
          <path
            d="M62 74q0-11 12-11h56q12 0 12 12v38q0 12-12 12h-26l-19 16 2-16H74q-12 0-12-12Z"
            fill="#ffdb82"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <text
            x="102"
            y="94"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="25"
            fill="#886247"
          >
            Aa
          </text>
          <Face x={102} y={109} scale={0.6} />
          <Star x={53} y={107} size={9} color="#89cbbb" />
          <Star x={148} y={69} size={7} />
        </>
      );
    case 'ten-words':
      return (
        <>
          <rect
            x="65"
            y="66"
            width="65"
            height="78"
            rx="9"
            transform="rotate(-12 98 105)"
            fill="#ffd784"
            stroke={ink}
            strokeWidth="3"
          />
          <rect
            x="75"
            y="69"
            width="62"
            height="76"
            rx="8"
            transform="rotate(8 106 107)"
            fill="#9dd8e1"
            stroke={ink}
            strokeWidth="3"
          />
          <rect
            x="69"
            y="81"
            width="66"
            height="62"
            rx="8"
            fill="#fff8df"
            stroke={ink}
            strokeWidth="3"
          />
          <path
            d="m91 98 9 14 13-21"
            fill="none"
            stroke="#51ad94"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Face x={102} y={123} scale={0.6} />
          <path d="m69 77-6-21 20 8m36-1 17-8-2 22" fill="#99b1d8" stroke={ink} strokeWidth="3" />
          <ellipse cx="101" cy="74" rx="26" ry="15" fill="#e3edff" stroke={ink} strokeWidth="3" />
          <circle cx="91" cy="73" r="3" fill={ink} />
          <circle cx="112" cy="73" r="3" fill={ink} />
          <path d="m98 77 4 4 4-4" fill="#f4b86b" />
        </>
      );
    case 'fifty-words':
      return (
        <>
          <path
            d="M99 137V88m0 28L76 97m24 7 25-20"
            stroke="#9d8061"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M100 96q-31 6-36-14-15-20 9-29 11-24 33-7 23-15 32 8 23 6 8 27-1 24-46 15Z"
            fill="#acd779"
            stroke={ink}
            strokeWidth="3"
          />
          <path d="M71 134q29-7 58 1l-5 12H77Z" fill="#f0bb8a" stroke={ink} strokeWidth="3" />
          <Face x={100} y={78} scale={0.7} />
          <circle cx="77" cy="66" r="8" fill="#ffe6a3" />
          <circle cx="126" cy="65" r="8" fill="#ffb6b3" />
          <circle cx="123" cy="91" r="8" fill="#d8d4fa" />
          <text x="77" y="70" textAnchor="middle" fontSize="10" fontWeight="800" fill={ink}>
            a
          </text>
          <text x="126" y="69" textAnchor="middle" fontSize="10" fontWeight="800" fill={ink}>
            b
          </text>
          <text x="123" y="95" textAnchor="middle" fontSize="10" fontWeight="800" fill={ink}>
            c
          </text>
        </>
      );
    case 'first-exam':
      return (
        <>
          <rect
            x="69"
            y="64"
            width="67"
            height="82"
            rx="9"
            fill="#8dbde6"
            stroke={ink}
            strokeWidth="3"
          />
          <rect x="76" y="72" width="53" height="66" rx="4" fill="#fff9e8" />
          <rect
            x="88"
            y="58"
            width="29"
            height="14"
            rx="5"
            fill="#b3a0d4"
            stroke={ink}
            strokeWidth="3"
          />
          <path
            d="m89 91 10 10 17-23"
            stroke="#63bd98"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Face x={103} y={120} scale={0.72} />
          <path d="m64 101-10-7m85 9 10-7" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <Star x={143} y={69} size={8} />
        </>
      );
    case 'five-exams':
      return (
        <>
          <circle cx="98" cy="102" r="39" fill="#faacb1" stroke={ink} strokeWidth="3" />
          <circle cx="98" cy="102" r="28" fill="#fff4df" stroke={ink} strokeWidth="2" />
          <circle cx="98" cy="102" r="17" fill="#e98190" stroke={ink} strokeWidth="2" />
          <Face x={98} y={111} scale={0.65} happy />
          <path d="m105 96 33-33" stroke={ink} strokeWidth="5" strokeLinecap="round" />
          <path d="m126 72 1-16 10 3 5 13-16 1Z" fill="#8acdc8" stroke={ink} strokeWidth="2.5" />
          <path d="m100 100 9-3-6-6Z" fill="#ffd97f" stroke={ink} strokeWidth="2" />
          <Star x={57} y={68} size={9} />
          <Star x={146} y={123} size={7} color="#bfa5e6" />
        </>
      );
    case 'perfect-exam':
      return (
        <>
          <path
            d="m100 61 13 25 29 5-21 22 4 28-25-13-26 13 5-28-21-22 29-5Z"
            fill="#ffdb76"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="m100 68 9 22 23 3-17 15 4 23-19-10" fill="#ffeaa3" />
          <Face x={101} y={103} scale={0.8} happy />
          <path
            d="m81 61-4-14 14 7 9-14 10 14 14-7-5 16Z"
            fill="#b0a2e3"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="100" cy="53" r="3" fill="#fff4cf" />
          <Star x={50} y={80} size={7} />
          <Star x={149} y={95} size={8} color="#bcb0ea" />
        </>
      );
    case 'course-certified':
      return (
        <>
          <path
            d="M77 132q-15-21-8-44 6-18 28-18 27 0 29 25l-2 33Z"
            fill="#bdc6df"
            stroke={ink}
            strokeWidth="3"
          />
          <ellipse cx="95" cy="98" rx="20" ry="23" fill="#fff0d5" />
          <Face x={95} y={96} scale={0.6} />
          <path d="m65 69 30-14 34 14-33 13Z" fill="#605b8c" stroke={ink} strokeWidth="3" />
          <path d="M76 75v9q20 9 40 0v-9" fill="#837fb1" stroke={ink} strokeWidth="2" />
          <path d="M129 69v21" stroke="#edbd68" strokeWidth="3" />
          <g transform="rotate(-15 116 127)" stroke={ink} strokeWidth="2.5">
            <rect x="87" y="115" width="60" height="25" rx="6" fill="#ffefcb" />
            <path d="M96 116v23m42-23v23" fill="none" />
            <path d="M115 118v27l7-4 7 4v-27" fill="#e993a4" />
            <circle cx="122" cy="125" r="8" fill="#ffce70" />
          </g>
          <Star x={146} y={84} size={6} />
        </>
      );
    case 'category-certified':
      return (
        <>
          <path
            d="m100 61 35 12-4 37q-4 25-31 37-27-12-31-37l-4-37Z"
            fill="#b6a4ea"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="m100 69 26 10-3 29q-3 20-23 30-20-10-23-30l-3-29Z" fill="#e3d8ff" />
          <path
            d="m100 79 7 18 19 6-19 7-7 19-7-19-19-7 19-6Z"
            fill="#ffdc80"
            stroke={ink}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <circle cx="100" cy="103" r="8" fill="#fff7d6" stroke={ink} strokeWidth="2" />
          <path
            d="M65 134q-16-18-11-38m81 38q16-18 11-38"
            stroke="#8b9bc4"
            strokeWidth="4"
            fill="none"
          />
          <path d="m59 121-10-5 2-9 10 7m79 7 10-5-2-9-10 7" fill="#b6c8ee" />
          <Star x={145} y={67} size={8} />
          <Star x={55} y={73} size={6} color="#b7e4d1" />
        </>
      );
    case 'ten-questions':
      return (
        <>
          <path
            d="M72 133q-19 7-24-1-5-13 10-16 1-17 19-11 12-8 17 6 17-1 15 13-1 15-37 9Z"
            fill="#f4e2ff"
            stroke={ink}
            strokeWidth="3"
          />
          <g transform="rotate(32 106 95)" stroke={ink} strokeWidth="3" strokeLinejoin="round">
            <path d="M91 71q15-24 30 0v51H91Z" fill="#ffcf7c" />
            <path d="M91 71h30v13H91" fill="#ef9cb8" />
            <path d="m91 122 15 19 15-19" fill="#fff2d6" />
            <path d="m102 136 4 5 4-5" fill={ink} />
            <path d="M101 86v30m10-30v30" fill="none" stroke="#e1ab60" strokeWidth="2" />
            <Face x={106} y={100} scale={0.48} />
          </g>
          <Star x={143} y={65} size={8} />
          <Star x={63} y={80} size={6} color="#a9d4d0" />
        </>
      );
    case 'fifty-questions':
      return (
        <>
          <OpenBook color="#b5a3e4" />
          <path d="M74 98q0-29 26-29t26 29v17H74Z" fill="#b6c5ea" stroke={ink} strokeWidth="3" />
          <path
            d="m68 79 20-41 15 24 20 4 9 18q-35-8-64-5Z"
            fill="#8b83c8"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M69 78q31-10 64 5" stroke="#e5c581" strokeWidth="7" strokeLinecap="round" />
          <Star x={91} y={61} size={5} color="#ffe5a4" />
          <Face x={99} y={96} scale={0.6} />
          <circle cx="136" cy="114" r="19" fill="#d5e9fa" stroke={ink} strokeWidth="3" />
          <text
            x="136"
            y="123"
            textAnchor="middle"
            fontSize="26"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fill="#7964ad"
          >
            ?
          </text>
          <Star x={58} y={60} size={8} />
        </>
      );
    default:
      return <Star x={100} y={100} size={35} />;
  }
}
const frames = {
  seal: 'M100 17C146 17 181 52 181 98S146 180 100 180 19 144 19 98 54 17 100 17Z',
  shield: 'M100 17 173 42 168 112Q160 159 100 185 40 159 32 112L27 42Z',
  hex: 'M100 15 169 54 178 127 133 178H67L22 127 31 54Z',
  flower:
    'M100 18Q117 8 131 27 154 23 160 45 181 51 177 74 193 90 179 108 185 132 163 143 159 168 136 168 120 188 100 178 80 188 64 168 41 168 37 143 15 132 21 108 7 90 23 74 19 51 40 45 46 23 69 27 83 8 100 18Z',
};
export function AchievementArt({
  id,
  earned,
  instance = 'card',
}: {
  id: string;
  earned: boolean;
  instance?: string;
}) {
  const p = achievementPalettes[id] ?? achievementPalettes['first-steps'];
  const prefix = 'achievement-' + id + '-' + instance;
  return (
    <div
      className={`achievement-art ${earned ? 'is-earned' : 'is-locked'}`}
      style={{ '--badge-color': p.color, '--badge-light': p.light } as CSSProperties}
    >
      <svg
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden="true"
        focusable="false"
        data-illustration={id}
      >
        <defs>
          <linearGradient
            id={prefix + '-edge'}
            x1="30"
            y1="20"
            x2="175"
            y2="180"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={p.light} />
            <stop offset=".4" stopColor={p.color} />
            <stop offset="1" stopColor={p.dark} />
          </linearGradient>
          <linearGradient
            id={prefix + '-face'}
            x1="60"
            y1="30"
            x2="130"
            y2="175"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fffaf0" />
            <stop offset="1" stopColor={p.light} />
          </linearGradient>
        </defs>
        <path d={frames[p.shape]} transform="translate(0 5)" fill={p.dark} opacity=".25" />
        <path d={frames[p.shape]} fill={`url(#${prefix}-edge)`} stroke={p.dark} strokeWidth="2" />
        <path
          d={frames[p.shape]}
          transform="translate(100 100) scale(.9) translate(-100 -100)"
          fill={`url(#${prefix}-face)`}
          stroke="#fff"
          strokeOpacity=".8"
          strokeWidth="2"
        />
        <circle cx="100" cy="96" r="59" fill={p.color} opacity=".12" />
        <path
          d="M48 58q7-13 20-19"
          stroke="white"
          strokeOpacity=".7"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <g className="achievement-character">
          <Artwork id={id} />
        </g>
        <Star x={45} y={137} size={5} color={p.color} />
        <circle cx="152" cy="142" r="3" fill={p.dark} opacity=".5" />
        <path
          d="m78 155-17 2 6 11-3 10 21-7m37-16 17 2-6 11 3 10-21-7"
          fill={p.dark}
          stroke={p.dark}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <rect
          x="75"
          y="150"
          width="50"
          height="27"
          rx="10"
          fill={p.color}
          stroke={p.dark}
          strokeWidth="2"
        />
        <path d="M82 154h35" stroke={p.light} strokeWidth="2" strokeLinecap="round" opacity=".8" />
        <text
          x="100"
          y="169"
          fill={ink}
          fontSize="13"
          fontWeight="900"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          letterSpacing=".5"
        >
          {p.rank}
        </text>
      </svg>
      {!earned && (
        <span className="achievement-lock" aria-hidden="true">
          <LockKeyhole size={12} />
        </span>
      )}
    </div>
  );
}
