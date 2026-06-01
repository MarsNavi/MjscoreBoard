import sharp from 'sharp';
import fs from 'node:fs';

const svgString = `
<svg width="1024" height="1024" viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg">
  <!-- Background Grid -->
  <rect width="108" height="108" fill="#26A69A" />
  
  <g stroke="#33FFFFFF" stroke-width="0.8">
    <line x1="9" y1="0" x2="9" y2="108"/>
    <line x1="19" y1="0" x2="19" y2="108"/>
    <line x1="29" y1="0" x2="29" y2="108"/>
    <line x1="39" y1="0" x2="39" y2="108"/>
    <line x1="49" y1="0" x2="49" y2="108"/>
    <line x1="59" y1="0" x2="59" y2="108"/>
    <line x1="69" y1="0" x2="69" y2="108"/>
    <line x1="79" y1="0" x2="79" y2="108"/>
    <line x1="89" y1="0" x2="89" y2="108"/>
    <line x1="99" y1="0" x2="99" y2="108"/>
    <line x1="0" y1="9" x2="108" y2="9"/>
    <line x1="0" y1="19" x2="108" y2="19"/>
    <line x1="0" y1="29" x2="108" y2="29"/>
    <line x1="0" y1="39" x2="108" y2="39"/>
    <line x1="0" y1="49" x2="108" y2="49"/>
    <line x1="0" y1="59" x2="108" y2="59"/>
    <line x1="0" y1="69" x2="108" y2="69"/>
    <line x1="0" y1="79" x2="108" y2="79"/>
    <line x1="0" y1="89" x2="108" y2="89"/>
    <line x1="0" y1="99" x2="108" y2="99"/>
  </g>

  <!-- Scaled down tile in the center -->
  <g transform="translate(19, 19) scale(0.65)">
    <!-- 牌身立体效果（侧面） -->
    <path fill="#1B5E20" d="M25,35 L75,15 L85,25 L85,75 L35,95 L25,85 Z" />
    
    <!-- 牌面（主体） -->
    <path fill="#FCF9F0" d="M32,22 L78,22 C81,22 83,24 83,27 L83,73 C83,76 81,78 78,78 L32,78 C29,78 27,76 27,73 L27,27 C27,24 29,22 32,22 Z" />
    
    <!-- 牌面边框 -->
    <path stroke="#2E7D32" stroke-width="1" fill="none" d="M31,26 L79,26 L79,74 L31,74 Z" />
    
    <!-- 简化的“發”字 -->
    <path fill="#1B5E20" d="M40,35 Q45,35 48,38 L45,42 Q42,39 38,40 Z" />
    <path fill="#1B5E20" d="M60,35 Q65,35 68,38 L65,42 Q62,39 58,40 Z" />
    <path fill="#1B5E20" d="M40,48 L70,48 L70,52 L40,52 Z" />
    <path fill="#1B5E20" d="M45,55 L65,55 L65,58 L45,58 Z M45,62 L65,62 L65,65 L45,65 Z M45,69 L65,69 L65,72 L45,72 Z" />
    <path fill="#1B5E20" d="M40,55 Q35,65 35,72 L38,72 Q38,65 42,55 Z M70,55 Q75,65 75,72 L72,72 Q72,65 68,55 Z" />
  </g>
</svg>
`;

await sharp(Buffer.from(svgString))
  .png()
  .toFile('assets/icon.png');

console.log('icon.png created.');
