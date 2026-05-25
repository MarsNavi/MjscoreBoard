import { Player, ScoreRecord, Penalty, Game, Position } from './types';
import { buildGameResults, getPositionForPlayerInRound } from './gameScoring';

export interface GameDetailShareInput {
  game: Game;
  players: Player[];
  scores: ScoreRecord[];
  penalty: Penalty | null;
  generatedAt?: Date;
}

const WIDTH = 1080;
const PAD = 48;
const CARD_RADIUS = 28;
const CONTENT_WIDTH = WIDTH - PAD * 2;

const COLORS = {
  ink: '#1f2937',
  muted: '#4b5563',
  subtle: '#9ca3af',
  line: '#f3f4f6',
  panel: '#f9fafb',
  white: '#ffffff',
  orange: '#ea580c',
  rose: '#e11d48',
  green: '#16a34a',
  blue: '#2563eb',
  red: '#dc2626',
  purple: '#7c3aed',
  amber: '#d97706',
};

const setFont = (ctx: CanvasRenderingContext2D, size: number, weight = 700) => {
  ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`;
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const fillRoundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string | CanvasGradient
) => {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
};

const strokeRoundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  stroke: string,
  lineWidth = 2
) => {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  roundRect(ctx, x, y, width, height, radius);
  ctx.stroke();
};

const text = (
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  options: {
    size?: number;
    weight?: number;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
  } = {}
) => {
  setFont(ctx, options.size ?? 28, options.weight ?? 700);
  ctx.fillStyle = options.color ?? COLORS.ink;
  ctx.textAlign = options.align ?? 'left';
  ctx.textBaseline = options.baseline ?? 'alphabetic';
  ctx.fillText(value, x, y);
};

const fitText = (
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  options: {
    size?: number;
    weight?: number;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
  } = {}
) => {
  const display = value || '-';
  setFont(ctx, options.size ?? 28, options.weight ?? 700);
  let fitted = display;
  while (ctx.measureText(fitted).width > maxWidth && fitted.length > 1) {
    fitted = `${fitted.slice(0, -2)}…`;
  }
  text(ctx, fitted, x, y, options);
};

const formatDate = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getChineseRoundName = (gameNumber: number) => {
  const rounds = ['东', '南', '西', '北'];
  const hands = ['一', '二', '三', '四'];
  const rIdx = Math.floor((gameNumber - 1) / 4);
  const hIdx = (gameNumber - 1) % 4;
  return `${rounds[rIdx] || '东'}${hands[hIdx] || '一'}局`;
};

const drawHeader = (ctx: CanvasRenderingContext2D, y: number, game: Game, generatedAt: Date) => {
  // Linear gradient top header card
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, 280);
  gradient.addColorStop(0, '#ea580c');
  gradient.addColorStop(0.5, '#dc2626');
  gradient.addColorStop(1, '#e11d48');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, 280);

  // Background decoration circles
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(930, 60, 160, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(120, 220, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Title & game detail text
  text(ctx, '国标麻将对局明细', PAD, y + 62, { size: 52, weight: 900, color: COLORS.white });
  
  const gameNameStr = game.game_name ? `比赛名称：${game.game_name}` : '标准 16 盘比赛对局';
  text(ctx, gameNameStr, PAD, y + 112, { size: 26, weight: 600, color: 'rgba(255,255,255,0.9)' });
  
  const timeStr = `生成时间：${formatDate(generatedAt)}  |  局数：${game.current_game - 1 || 16}/16`;
  text(ctx, timeStr, PAD, y + 154, { size: 21, weight: 500, color: 'rgba(255,255,255,0.8)' });

  return y + 210;
};

// Draw elegant rank overview cards (podium style side-by-side or styled cards)
const drawOverview = (ctx: CanvasRenderingContext2D, y: number, gameId: string, players: Player[]) => {
  const sortedResults = buildGameResults(gameId, players);

  const gap = 16;
  const cardWidth = (CONTENT_WIDTH - gap * 3) / 4;
  
  // Custom badges for ranks
  const rankBadges = [
    { label: '第一名', gradient: ['#fbbf24', '#d97706'], text: '#ffffff' },
    { label: '第二名', gradient: ['#d1d5db', '#4b5563'], text: '#ffffff' },
    { label: '第三名', gradient: ['#ca8a04', '#78350f'], text: '#ffffff' },
    { label: '第四名', gradient: ['#f3f4f6', '#9ca3af'], text: '#374151' }
  ];

  sortedResults.forEach((result, index) => {
    const x = PAD + index * (cardWidth + gap);
    
    // Draw background card
    fillRoundRect(ctx, x, y, cardWidth, 196, 24, COLORS.white);
    strokeRoundRect(ctx, x, y, cardWidth, 196, 24, '#fed7aa', 2);

    // Draw rank badge
    const badge = rankBadges[index] || rankBadges[3];
    const badgeGradient = ctx.createLinearGradient(x, y + 14, x + cardWidth, y + 46);
    badgeGradient.addColorStop(0, badge.gradient[0]);
    badgeGradient.addColorStop(1, badge.gradient[1]);
    fillRoundRect(ctx, x + 16, y + 14, cardWidth - 32, 38, 12, badgeGradient);
    text(ctx, badge.label, x + cardWidth / 2, y + 40, { size: 18, weight: 800, color: badge.text, align: 'center' });

    // Draw Player Name
    fitText(ctx, result.player_name, x + cardWidth / 2, y + 96, cardWidth - 24, { size: 26, weight: 900, color: COLORS.ink, align: 'center' });

    // Draw Score
    const formattedScore = result.final_score > 0 ? `+${result.final_score}` : String(result.final_score);
    const scoreColor = result.final_score > 0 ? COLORS.green : (result.final_score < 0 ? COLORS.red : COLORS.ink);
    fitText(ctx, formattedScore, x + cardWidth / 2, y + 142, cardWidth - 24, { size: 32, weight: 900, color: scoreColor, align: 'center' });

    // Draw Standard Score
    text(ctx, `标准分 ${result.standard_score.toFixed(1)}`, x + cardWidth / 2, y + 174, { size: 16, weight: 700, color: COLORS.muted, align: 'center' });
  });

  return y + 230;
};

const drawSectionTitle = (ctx: CanvasRenderingContext2D, title: string, y: number) => {
  text(ctx, title, PAD, y + 36, { size: 34, weight: 900, color: COLORS.ink });
  return y + 62;
};

// Draw game detail table
const drawDetailTable = (
  ctx: CanvasRenderingContext2D,
  y: number,
  players: Player[],
  scores: ScoreRecord[],
  penalty: Penalty | null
) => {
  const sortedPlayers = [...players].sort((a, b) => a.player_id.localeCompare(b.player_id));
  
  const headerHeight = 68;
  const rowHeight = 74;
  const rowCount = scores.length + (penalty ? 1 : 0);
  const height = headerHeight + rowCount * rowHeight + 20;

  // Background and border
  fillRoundRect(ctx, PAD, y, CONTENT_WIDTH, height, CARD_RADIUS, COLORS.white);
  strokeRoundRect(ctx, PAD, y, CONTENT_WIDTH, height, CARD_RADIUS, '#fed7aa', 2);

  // Column Widths: 盘数 (184px), Columns 1-4 (200px each)
  const colWidths = [184, 200, 200, 200, 200];
  
  // 1. Draw Table Header
  let headerX = PAD;
  
  // 盘数 Header
  text(ctx, '局数', headerX + colWidths[0] / 2, y + 43, { size: 22, weight: 800, color: COLORS.muted, align: 'center' });
  headerX += colWidths[0];

  // Player Names Headers
  sortedPlayers.forEach((player, idx) => {
    const w = colWidths[idx + 1];
    fitText(ctx, player.name || player.player_id, headerX + w / 2, y + 43, w - 16, {
      size: 22,
      weight: 800,
      color: COLORS.ink,
      align: 'center',
    });
    headerX += w;
  });

  // Table Line below header
  ctx.strokeStyle = '#fed7aa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD + 16, y + headerHeight);
  ctx.lineTo(PAD + CONTENT_WIDTH - 16, y + headerHeight);
  ctx.stroke();

  // 2. Draw Rows
  scores.forEach((score, rowIndex) => {
    const rowY = y + headerHeight + rowIndex * rowHeight;
    const scoreChanges = score.score_changes as Record<Position, number>;
    const scoreRoundIndex = Math.floor((score.game_number - 1) / 4);

    // Zebra striping
    if (rowIndex % 2 === 1) {
      fillRoundRect(ctx, PAD + 8, rowY + 6, CONTENT_WIDTH - 16, rowHeight - 12, 14, '#fffbeb');
    }

    // Hand/Round label
    const handLabel = getChineseRoundName(score.game_number);
    text(ctx, handLabel, PAD + colWidths[0] / 2, rowY + rowHeight / 2 + 6, {
      size: 20,
      weight: 700,
      color: COLORS.muted,
      align: 'center',
      baseline: 'middle',
    });

    let currentX = PAD + colWidths[0];

    sortedPlayers.forEach((player, playerIdx) => {
      const colWidth = colWidths[playerIdx + 1];
      const playerPosition = getPositionForPlayerInRound(player.player_id, scoreRoundIndex);
      const change = scoreChanges[playerPosition] || 0;
      
      const isWinner = player.player_id === score.winner_player_id;
      const isLoser = player.player_id === score.loser_player_id;

      // Draw cell decoration if won or lost
      const cellCenterX = currentX + colWidth / 2;
      const cellCenterY = rowY + rowHeight / 2;

      if (isWinner) {
        // Red background for winner
        fillRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, '#fef2f2');
        strokeRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, 'rgba(239, 68, 68, 0.2)', 1.5);
        
        // Winner text
        const changeStr = change >= 0 ? `+${change}` : String(change);
        text(ctx, changeStr, cellCenterX, cellCenterY + 6, {
          size: 22,
          weight: 900,
          color: COLORS.red,
          align: 'center',
          baseline: 'middle',
        });

        // Draw a tiny "和" or "自摸" indicator badge in the corner
        const badgeLabel = !score.loser_position ? '自摸' : '点和';
        fillRoundRect(ctx, cellCenterX + 34, cellCenterY - 28, 42, 20, 6, COLORS.red);
        text(ctx, badgeLabel, cellCenterX + 55, cellCenterY - 14, {
          size: 11,
          weight: 800,
          color: COLORS.white,
          align: 'center',
          baseline: 'middle',
        });

      } else if (isLoser) {
        // Purple background for loser (discarder)
        fillRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, '#faf5ff');
        strokeRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, 'rgba(124, 58, 237, 0.2)', 1.5);

        // Loser text
        text(ctx, String(change), cellCenterX, cellCenterY + 6, {
          size: 22,
          weight: 900,
          color: COLORS.purple,
          align: 'center',
          baseline: 'middle',
        });

        // Draw a tiny "放铳" indicator badge
        fillRoundRect(ctx, cellCenterX + 34, cellCenterY - 28, 42, 20, 6, COLORS.purple);
        text(ctx, '点炮', cellCenterX + 55, cellCenterY - 14, {
          size: 11,
          weight: 800,
          color: COLORS.white,
          align: 'center',
          baseline: 'middle',
        });

      } else {
        // Regular cell
        const changeStr = change > 0 ? `+${change}` : (change === 0 ? '0' : String(change));
        const color = score.winner_position === null 
          ? COLORS.subtle // Draw/Huangzhuang
          : (change < 0 ? COLORS.muted : COLORS.ink);

        text(ctx, changeStr, cellCenterX, cellCenterY + 6, {
          size: 20,
          weight: 700,
          color,
          align: 'center',
          baseline: 'middle',
        });
      }

      currentX += colWidth;
    });
  });

  // 3. Draw Penalty Row if exists
  if (penalty) {
    const rowY = y + headerHeight + scores.length * rowHeight;
    const penaltyChanges = penalty.penalty_changes as Record<Position, number>;

    // Zebra striping
    if (scores.length % 2 === 1) {
      fillRoundRect(ctx, PAD + 8, rowY + 6, CONTENT_WIDTH - 16, rowHeight - 12, 14, '#fffbeb');
    }

    text(ctx, '裁判判罚', PAD + colWidths[0] / 2, rowY + rowHeight / 2 + 6, {
      size: 20,
      weight: 800,
      color: COLORS.subtle,
      align: 'center',
      baseline: 'middle',
    });

    let currentX = PAD + colWidths[0];

    sortedPlayers.forEach((player, playerIdx) => {
      const colWidth = colWidths[playerIdx + 1];
      const change = penaltyChanges[player.position] || 0;
      const cellCenterX = currentX + colWidth / 2;
      const cellCenterY = rowY + rowHeight / 2;

      const changeStr = change > 0 ? `+${change}` : (change === 0 ? '0' : String(change));
      const color = change > 0 ? COLORS.green : (change < 0 ? COLORS.red : COLORS.subtle);

      text(ctx, changeStr, cellCenterX, cellCenterY + 6, {
        size: 20,
        weight: 800,
        color,
        align: 'center',
        baseline: 'middle',
      });

      currentX += colWidth;
    });
  }

  return y + height + 30;
};

const blobFromCanvas = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('无法生成对局明细图片'));
  }, 'image/png', 0.95);
});

export async function createGameDetailShareImage(input: GameDetailShareInput): Promise<Blob> {
  await document.fonts?.ready;

  // Calculate dynamic logical height
  const headerHeight = 210;
  const overviewHeight = 230;
  const tableTitleHeight = 62;
  
  const headerRowCount = 68;
  const rowHeight = 74;
  const rowCount = input.scores.length + (input.penalty ? 1 : 0);
  const tableHeight = headerRowCount + rowCount * rowHeight + 20 + 30;
  
  const footerHeight = 110;
  
  const logicalHeight = 36 + headerHeight + overviewHeight + tableTitleHeight + tableHeight + footerHeight;
  const scale = Math.min(window.devicePixelRatio || 2, 2);

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(WIDTH * scale);
  canvas.height = Math.floor(logicalHeight * scale);
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前设备无法创建对局明细分享图片');
  ctx.scale(scale, scale);

  // Background gradient for overall page
  const pageGradient = ctx.createLinearGradient(0, 0, 0, logicalHeight);
  pageGradient.addColorStop(0, '#fff7ed');
  pageGradient.addColorStop(0.4, '#fff1f2');
  pageGradient.addColorStop(1, '#fffbeb');
  ctx.fillStyle = pageGradient;
  ctx.fillRect(0, 0, WIDTH, logicalHeight);

  // Render content
  let y = drawHeader(ctx, 36, input.game, input.generatedAt ?? new Date());
  y = drawOverview(ctx, y, input.game.id, input.players);
  y = drawSectionTitle(ctx, '对局明细', y);
  y = drawDetailTable(ctx, y, input.players, input.scores, input.penalty);

  // Render Footer text
  text(ctx, '由「国标麻将实时计分板」生成  ·  四川熊猫国标俱乐部赞助', WIDTH / 2, logicalHeight - 48, {
    size: 22,
    weight: 700,
    color: COLORS.subtle,
    align: 'center',
  });

  return blobFromCanvas(canvas);
}
