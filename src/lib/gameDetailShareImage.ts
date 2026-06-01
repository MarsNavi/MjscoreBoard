import i18n from '../i18n';
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
  const lang = i18n.language; const fontStack = lang === "ja" ? "-apple-system, BlinkMacSystemFont, \"Hiragino Sans\", \"Meiryo\", \"Noto Sans JP\", sans-serif" : "-apple-system, BlinkMacSystemFont, \"PingFang SC\", \"Noto Sans CJK SC\", \"Microsoft YaHei\", sans-serif"; ctx.font = `${weight} ${size}px ${fontStack}`;
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

// Elegant capsule tag drawing helper
const drawTag = (
  ctx: CanvasRenderingContext2D,
  textStr: string,
  centerX: number,
  y: number,
  bgColor: string,
  textColor: string
) => {
  ctx.save();
  setFont(ctx, 13, 800);
  const textWidth = ctx.measureText(textStr).width;
  const w = textWidth + 18;
  const h = 24;
  const x = centerX - w / 2;
  fillRoundRect(ctx, x, y, w, h, h / 2, bgColor);
  text(ctx, textStr, centerX, y + h / 2 + 1, {
    size: 13,
    weight: 800,
    color: textColor,
    align: 'center',
    baseline: 'middle',
  });
  ctx.restore();
};

// Explosion drawing helper for self-draw wins over 64 fans
const drawExplosion = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  points: number
) => {
  ctx.save();
  const gradient = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
  gradient.addColorStop(0, '#fef08a'); // yellow-200
  gradient.addColorStop(0.3, '#f97316'); // orange-500
  gradient.addColorStop(1, '#dc2626'); // red-600
  ctx.fillStyle = gradient;
  
  ctx.beginPath();
  const angle = Math.PI / points;
  for (let i = 0; i < 2 * points; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const currAngle = i * angle;
    const x = cx + Math.cos(currAngle) * r;
    const y = cy + Math.sin(currAngle) * r;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const formatDate = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const drawHeader = (ctx: CanvasRenderingContext2D, y: number, game: Game, generatedAt: Date, scores: ScoreRecord[]) => {
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
  text(ctx, i18n.t('shareImage.gameDetailTitle'), PAD, y + 62, { size: 52, weight: 900, color: COLORS.white });
  
  const gameNameStr = game.game_name ? `${i18n.t('shareImage.gameNamePrefix')}${game.game_name}` : i18n.t('shareImage.standard16Games');
  text(ctx, gameNameStr, PAD, y + 112, { size: 26, weight: 600, color: 'rgba(255,255,255,0.9)' });
  
  // Use exact scores.length to avoid 15/16 display bug for finished games
  const timeStr = `${i18n.t('shareImage.generatedAt', { time: formatDate(generatedAt) })}  |  ${i18n.t('shareImage.roundCount', { count: scores.length })}`;
  text(ctx, timeStr, PAD, y + 154, { size: 21, weight: 500, color: 'rgba(255,255,255,0.8)' });

  return y + 210;
};

// Draw elegant rank overview cards (podium style side-by-side or styled cards) with stats badges
const drawOverview = (ctx: CanvasRenderingContext2D, y: number, gameId: string, players: Player[], scores: ScoreRecord[]) => {
  const sortedResults = buildGameResults(gameId, players);

  const gap = 16;
  const cardWidth = (CONTENT_WIDTH - gap * 3) / 4;
  const cardHeight = 250; // Increased height to beautifully house fun badges
  
  // Custom badges for ranks
  const rankBadges = [
    { label: i18n.t('shareImage.rank1'), gradient: ['#fbbf24', '#d97706'], text: '#ffffff' },
    { label: i18n.t('shareImage.rank2'), gradient: ['#d1d5db', '#4b5563'], text: '#ffffff' },
    { label: i18n.t('shareImage.rank3'), gradient: ['#ca8a04', '#78350f'], text: '#ffffff' },
    { label: i18n.t('shareImage.rank4'), gradient: ['#f3f4f6', '#9ca3af'], text: '#374151' }
  ];

  // Calculate statistics for badges
  const winCounts: Record<string, number> = {};
  const discardCounts: Record<string, number> = {};
  players.forEach(p => {
    winCounts[p.player_id] = 0;
    discardCounts[p.player_id] = 0;
  });

  let maxSingleFan = 0;
  let maxFanPlayerId = '';

  scores.forEach(s => {
    if (s.winner_player_id) {
      winCounts[s.winner_player_id] = (winCounts[s.winner_player_id] || 0) + 1;
      if (s.base_score > maxSingleFan) {
        maxSingleFan = s.base_score;
        maxFanPlayerId = s.winner_player_id;
      }
    }
    if (s.loser_player_id) {
      discardCounts[s.loser_player_id] = (discardCounts[s.loser_player_id] || 0) + 1;
    }
  });

  const maxWins = Math.max(...Object.values(winCounts), 0);
  const maxDiscards = Math.max(...Object.values(discardCounts), 0);

  const playersWithMaxWins = maxWins > 0 
    ? Object.keys(winCounts).filter(id => winCounts[id] === maxWins)
    : [];
  const playersWithMaxDiscards = maxDiscards > 0 
    ? Object.keys(discardCounts).filter(id => discardCounts[id] === maxDiscards)
    : [];

  sortedResults.forEach((result, index) => {
    const x = PAD + index * (cardWidth + gap);
    
    // Draw background card
    fillRoundRect(ctx, x, y, cardWidth, cardHeight, 24, COLORS.white);
    strokeRoundRect(ctx, x, y, cardWidth, cardHeight, 24, '#fed7aa', 2);

    // Draw rank badge
    const badge = rankBadges[index] || rankBadges[3];
    const badgeGradient = ctx.createLinearGradient(x, y + 14, x + cardWidth, y + 46);
    badgeGradient.addColorStop(0, badge.gradient[0]);
    badgeGradient.addColorStop(1, badge.gradient[1]);
    fillRoundRect(ctx, x + 16, y + 14, cardWidth - 32, 38, 12, badgeGradient);
    text(ctx, badge.label, x + cardWidth / 2, y + 40, { size: 18, weight: 800, color: badge.text, align: 'center' });

    // Draw Player Name
    fitText(ctx, result.player_name, x + cardWidth / 2, y + 84, cardWidth - 24, { size: 26, weight: 900, color: COLORS.ink, align: 'center' });

    // Draw Score
    const formattedScore = result.final_score > 0 ? `+${result.final_score}` : String(result.final_score);
    const scoreColor = result.final_score > 0 ? COLORS.green : (result.final_score < 0 ? COLORS.red : COLORS.ink);
    fitText(ctx, formattedScore, x + cardWidth / 2, y + 130, cardWidth - 24, { size: 32, weight: 900, color: scoreColor, align: 'center' });

    // Draw Standard Score
    text(ctx, i18n.t('shareImage.standardScore', { score: result.standard_score.toFixed(1) }), x + cardWidth / 2, y + 162, { size: 16, weight: 700, color: COLORS.muted, align: 'center' });

    // Draw fun tags centered beautifully inside the card bottom area
    let tagY = y + 182;

    if (playersWithMaxWins.includes(result.player_id) && maxWins > 0) {
      drawTag(ctx, i18n.t('shareImage.mostWins', { count: winCounts[result.player_id] }), x + cardWidth / 2, tagY, '#ffedd5', '#ea580c');
      tagY += 28;
    }
    if (playersWithMaxDiscards.includes(result.player_id) && maxDiscards > 0 && tagY < y + cardHeight - 20) {
      drawTag(ctx, i18n.t('shareImage.mostDiscards', { count: discardCounts[result.player_id] }), x + cardWidth / 2, tagY, '#f3e8ff', '#7c3aed');
      tagY += 28;
    }
    if (result.player_id === maxFanPlayerId && maxSingleFan >= 24 && tagY < y + cardHeight - 20) {
      drawTag(ctx, i18n.t('shareImage.maxFan', { fan: maxSingleFan }), x + cardWidth / 2, tagY, '#ffe4e6', '#e11d48');
    }
  });

  return y + cardHeight + 30;
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

  // Column Widths: 局数 (184px), Columns 1-4 (200px each)
  const colWidths = [184, 200, 200, 200, 200];
  
  // 1. Draw Table Header
  let headerX = PAD;
  
  // 局数 Header
  text(ctx, i18n.t('shareImage.roundStr'), headerX + colWidths[0] / 2, y + 43, { size: 22, weight: 800, color: COLORS.muted, align: 'center' });
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

    // Round label with Arabic numerals (e.g. 第 1 局) as requested
    const handLabel = i18n.t('shareImage.roundNumber', { number: score.game_number });
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

      const cellCenterX = currentX + colWidth / 2;
      const cellCenterY = rowY + rowHeight / 2;

      const fanCount = score.base_score || 0;

      if (isWinner) {
        // High Fan styling rules
        if (fanCount >= 64) {
          if (!score.loser_player_id) {
            // A. Self-draw win >= 64 fans: EXPLOSION MARKER!
            drawExplosion(ctx, cellCenterX, cellCenterY, 44, 20, 14);
            text(ctx, `+${change}`, cellCenterX, cellCenterY + 7, {
              size: 22,
              weight: 900,
              color: COLORS.white,
              align: 'center',
              baseline: 'middle',
            });
            drawTag(ctx, i18n.t('shareImage.explosiveSelfDraw', { fan: fanCount }), cellCenterX, cellCenterY - 34, '#fecdd3', '#e11d48');
          } else {
            // B. Discard win >= 64 fans: Royal Crimson-Gold card
            fillRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, '#fff7ed');
            strokeRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, '#ea580c', 2.5);
            text(ctx, `+${change}`, cellCenterX, cellCenterY + 6, {
              size: 22,
              weight: 900,
              color: '#ea580c',
              align: 'center',
              baseline: 'middle',
            });
            drawTag(ctx, i18n.t('shareImage.massiveWin', { fan: fanCount }), cellCenterX, cellCenterY - 34, '#ffedd5', '#ea580c');
          }
        } else if (fanCount >= 32) {
          // C. Win with 32-63 fans: Golden Amber card
          fillRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, '#fffbeb');
          strokeRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, '#d97706', 1.5);
          text(ctx, `+${change}`, cellCenterX, cellCenterY + 6, {
            size: 22,
            weight: 900,
            color: '#d97706',
            align: 'center',
            baseline: 'middle',
          });
          drawTag(ctx, i18n.t('shareImage.bigWin', { fan: fanCount }), cellCenterX, cellCenterY - 34, '#fef3c7', '#d97706');
        } else {
          // D. Regular win (under 32 fans): clean red cell with standard tag
          fillRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, '#fef2f2');
          strokeRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, 'rgba(239, 68, 68, 0.15)', 1);
          text(ctx, `+${change}`, cellCenterX, cellCenterY + 6, {
            size: 22,
            weight: 900,
            color: COLORS.red,
            align: 'center',
            baseline: 'middle',
          });
          const label = score.loser_player_id ? i18n.t('game.winner') : i18n.t('game.selfDraw');
          drawTag(ctx, label, cellCenterX, cellCenterY - 34, '#fef2f2', '#ef4444');
        }

      } else if (isLoser) {
        // Discarder styling rules
        if (fanCount >= 64) {
          // A. Discarded >= 64 fans: Heavy defeat deep purple & border + Skull badge
          fillRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, '#faf5ff');
          strokeRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, '#7c3aed', 2.5);
          text(ctx, String(change), cellCenterX, cellCenterY + 6, {
            size: 22,
            weight: 900,
            color: '#7c3aed',
            align: 'center',
            baseline: 'middle',
          });
          drawTag(ctx, i18n.t('shareImage.painfulDiscard', { fan: fanCount }), cellCenterX, cellCenterY - 34, '#f3e8ff', '#7c3aed');
        } else if (fanCount >= 32) {
          // B. Discarded 32-63 fans: Mid danger card
          fillRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, '#faf5ff');
          strokeRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, 'rgba(124, 58, 237, 0.5)', 1.5);
          text(ctx, String(change), cellCenterX, cellCenterY + 6, {
            size: 22,
            weight: 900,
            color: COLORS.purple,
            align: 'center',
            baseline: 'middle',
          });
          drawTag(ctx, i18n.t('shareImage.discardFan', { fan: fanCount }), cellCenterX, cellCenterY - 34, '#f3e8ff', '#7c3aed');
        } else {
          // C. Regular discard (under 32 fans): clean purple cell with standard tag
          fillRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, '#faf5ff');
          strokeRoundRect(ctx, cellCenterX - 72, cellCenterY - 24, 144, 48, 12, 'rgba(124, 58, 237, 0.15)', 1);
          text(ctx, String(change), cellCenterX, cellCenterY + 6, {
            size: 22,
            weight: 900,
            color: COLORS.purple,
            align: 'center',
            baseline: 'middle',
          });
          drawTag(ctx, i18n.t('game.loser'), cellCenterX, cellCenterY - 34, '#faf5ff', '#a855f7');
        }

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

    if (scores.length % 2 === 1) {
      fillRoundRect(ctx, PAD + 8, rowY + 6, CONTENT_WIDTH - 16, rowHeight - 12, 14, '#fffbeb');
    }

    text(ctx, i18n.t('shareImage.refereePenalty'), PAD + colWidths[0] / 2, rowY + rowHeight / 2 + 6, {
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

// Draw "牌局花絮 / Fun Highlights" Card below table
const drawHighlights = (
  ctx: CanvasRenderingContext2D,
  y: number,
  players: Player[],
  scores: ScoreRecord[]
) => {
  const height = 180;
  fillRoundRect(ctx, PAD, y, CONTENT_WIDTH, height, CARD_RADIUS, COLORS.white);
  strokeRoundRect(ctx, PAD, y, CONTENT_WIDTH, height, CARD_RADIUS, '#fed7aa', 2);

  // Calculate statistics
  const winCounts: Record<string, number> = {};
  const discardCounts: Record<string, number> = {};
  players.forEach(p => {
    winCounts[p.player_id] = 0;
    discardCounts[p.player_id] = 0;
  });

  let maxSingleFan = 0;
  let maxFanPlayerId = '';

  scores.forEach(s => {
    if (s.winner_player_id) {
      winCounts[s.winner_player_id] = (winCounts[s.winner_player_id] || 0) + 1;
      if (s.base_score > maxSingleFan) {
        maxSingleFan = s.base_score;
        maxFanPlayerId = s.winner_player_id;
      }
    }
    if (s.loser_player_id) {
      discardCounts[s.loser_player_id] = (discardCounts[s.loser_player_id] || 0) + 1;
    }
  });

  const maxWins = Math.max(...Object.values(winCounts), 0);
  const maxDiscards = Math.max(...Object.values(discardCounts), 0);

  const winNames = players.filter(p => winCounts[p.player_id] === maxWins).map(p => p.name).join(' & ');
  const discardNames = players.filter(p => discardCounts[p.player_id] === maxDiscards).map(p => p.name).join(' & ');
  const maxFanPlayer = players.find(p => p.player_id === maxFanPlayerId)?.name || i18n.t('shareImage.none');

  const selfDrawCount = scores.filter(s => s.winner_player_id && !s.loser_player_id).length;
  const drawCount = scores.filter(s => !s.winner_player_id).length;

  const colWidth = CONTENT_WIDTH / 4;

  const cols = [
    {
      title: i18n.t('shareImage.kingOfWins'),
      name: maxWins > 0 ? winNames : i18n.t('shareImage.none'),
      detail: maxWins > 0 ? i18n.t('shareImage.winStats', { count: maxWins, rate: (maxWins / (scores.length || 1) * 100).toFixed(0) }) : i18n.t('shareImage.noWins'),
      theme: COLORS.orange,
    },
    {
      title: i18n.t('shareImage.masterOfDiscards'),
      name: maxDiscards > 0 ? discardNames : i18n.t('shareImage.none'),
      detail: maxDiscards > 0 ? i18n.t('shareImage.discardStats', { count: maxDiscards, rate: (maxDiscards / (scores.length || 1) * 100).toFixed(0) }) : i18n.t('shareImage.noDiscards'),
      theme: COLORS.purple,
    },
    {
      title: i18n.t('shareImage.supremeSingleRound'),
      name: maxSingleFan > 0 ? maxFanPlayer : i18n.t('shareImage.none'),
      detail: maxSingleFan > 0 ? i18n.t('shareImage.singleMaxFanStats', { fan: maxSingleFan }) : i18n.t('shareImage.noBigWins'),
      theme: COLORS.red,
    },
    {
      title: i18n.t('shareImage.battleStats'),
      name: i18n.t('shareImage.totalRoundsStats', { count: scores.length }),
      detail: i18n.t('shareImage.drawStats', { selfDraw: selfDrawCount, draw: drawCount }),
      theme: COLORS.blue,
    }
  ];

  cols.forEach((col, idx) => {
    const colX = PAD + idx * colWidth;
    
    // Draw vertical divider
    if (idx > 0) {
      ctx.strokeStyle = '#fed7aa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(colX, y + 24);
      ctx.lineTo(colX, y + height - 24);
      ctx.stroke();
    }

    // Title
    text(ctx, col.title, colX + colWidth / 2, y + 42, {
      size: 20,
      weight: 800,
      color: col.theme,
      align: 'center',
    });

    // Name
    fitText(ctx, col.name, colX + colWidth / 2, y + 96, colWidth - 24, {
      size: 26,
      weight: 900,
      color: COLORS.ink,
      align: 'center',
    });

    // Detail
    fitText(ctx, col.detail, colX + colWidth / 2, y + 140, colWidth - 16, {
      size: 16,
      weight: 600,
      color: COLORS.muted,
      align: 'center',
    });
  });

  return y + height + 30;
};

const blobFromCanvas = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error(i18n.t('shareImage.errorGenerateDetail')));
  }, 'image/png', 0.95);
});

export async function createGameDetailShareImage(input: GameDetailShareInput): Promise<Blob> {
  await document.fonts?.ready;

  // Calculate dynamic logical height
  const headerHeight = 210;
  const overviewHeight = 280; // height 250 + 30 gap = 280
  const tableTitleHeight = 62;
  
  const headerRowCount = 68;
  const rowHeight = 74;
  const rowCount = input.scores.length + (input.penalty ? 1 : 0);
  const tableHeight = headerRowCount + rowCount * rowHeight + 20 + 30;
  
  const highlightHeight = 62 + 180 + 30; // "牌局花絮" title + highlights card + gap
  const footerHeight = 110;
  
  const logicalHeight = 36 + headerHeight + overviewHeight + tableTitleHeight + tableHeight + highlightHeight + footerHeight;
  const scale = Math.min(window.devicePixelRatio || 2, 2);

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(WIDTH * scale);
  canvas.height = Math.floor(logicalHeight * scale);
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(i18n.t('shareImage.errorDeviceDetail'));
  ctx.scale(scale, scale);

  // Background gradient for overall page
  const pageGradient = ctx.createLinearGradient(0, 0, 0, logicalHeight);
  pageGradient.addColorStop(0, '#fff7ed');
  pageGradient.addColorStop(0.4, '#fff1f2');
  pageGradient.addColorStop(1, '#fffbeb');
  ctx.fillStyle = pageGradient;
  ctx.fillRect(0, 0, WIDTH, logicalHeight);

  // Render content
  let y = drawHeader(ctx, 36, input.game, input.generatedAt ?? new Date(), input.scores);
  y = drawOverview(ctx, y, input.game.id, input.players, input.scores);
  y = drawSectionTitle(ctx, i18n.t('game.gameDetail'), y);
  y = drawDetailTable(ctx, y, input.players, input.scores, input.penalty);
  y = drawSectionTitle(ctx, i18n.t('shareImage.funFactsTitle'), y);
  y = drawHighlights(ctx, y, input.players, input.scores);

  // Render Footer text
  text(ctx, i18n.t('shareImage.footerSponsor'), WIDTH / 2, logicalHeight - 48, {
    size: 22,
    weight: 700,
    color: COLORS.subtle,
    align: 'center',
  });

  return blobFromCanvas(canvas);
}
