import i18n from '../i18n';
export interface ShareSummaryStat {
  player_name: string;
  games_played: number;
  total_game_score: number;
  total_standard_score: number;
  average_standard_score: number;
}

export interface ShareDetailStat {
  player_name: string;
  total_rounds: number;
  win_rounds: number;
  self_draw_rounds: number;
  loser_rounds: number;
  win_rate: number;
  self_draw_rate: number;
  loser_rate: number;
  avg_win_fan: number;
  avg_loser_fan: number;
}

export interface ShareWinningStat {
  player_name: string;
  total_win_rounds: number;
  win_8_15: number;
  win_16_30: number;
  win_31_63: number;
  win_64_plus: number;
  max_fan_rong: number;
  max_fan_self_draw: number;
}

interface StatsShareImageInput {
  summaryStats: ShareSummaryStat[];
  detailStats: ShareDetailStat[];
  winningStats: ShareWinningStat[];
  generatedAt?: Date;
}

type Metric = {
  label: string;
  value: string;
  color?: string;
};

type TableColumn<T> = {
  title: string;
  width: number;
  align?: CanvasTextAlign;
  value: (row: T) => string;
  color?: (row: T) => string;
};

const WIDTH = 1080;
const PAD = 48;
const CARD_RADIUS = 28;
const CONTENT_WIDTH = WIDTH - PAD * 2;

const COLORS = {
  ink: '#1f2937',
  muted: '#6b7280',
  subtle: '#9ca3af',
  line: '#fed7aa',
  panel: '#fffaf4',
  white: '#ffffff',
  orange: '#ea580c',
  rose: '#e11d48',
  green: '#16a34a',
  blue: '#2563eb',
  red: '#dc2626',
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
  stroke: string
) => {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
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

const percent = (value: number) => `${value.toFixed(1)}%`;
const signedNumber = (value: number) => `${value > 0 ? '+' : ''}${value}`;
const fixed1 = (value: number) => value.toFixed(1);
const fixed2 = (value: number) => value.toFixed(2);

const formatDate = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const drawHeader = (ctx: CanvasRenderingContext2D, y: number, generatedAt: Date) => {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, 280);
  gradient.addColorStop(0, '#fff7ed');
  gradient.addColorStop(0.45, '#fff1f2');
  gradient.addColorStop(1, '#ffe4e6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, 280);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  ctx.arc(930, 60, 160, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(120, 250, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  text(ctx, i18n.t('shareImage.statsTitle'), PAD, y + 62, { size: 52, weight: 900, color: COLORS.ink });
  text(ctx, i18n.t('shareImage.generatedAt', { time: formatDate(generatedAt) }), PAD, y + 108, { size: 24, weight: 500, color: COLORS.muted });
  text(ctx, i18n.t('shareImage.statsSubtitle'), PAD, y + 148, { size: 28, weight: 800, color: COLORS.orange });

  return y + 210;
};

const drawOverview = (ctx: CanvasRenderingContext2D, y: number, stats: ShareSummaryStat[]) => {
  const totalPlayers = stats.length;
  const totalGames = stats.reduce((max, stat) => Math.max(max, stat.games_played), 0);
  const leader = stats[0]?.player_name ?? '-';
  const leaderScore = stats[0] ? fixed1(stats[0].total_standard_score) : '-';
  const cards = [
    [i18n.t('shareImage.playerCount'), String(totalPlayers), COLORS.orange],
    [i18n.t('shareImage.completedGames'), String(totalGames), COLORS.rose],
    [i18n.t('shareImage.currentLeader'), leader, COLORS.green],
    [i18n.t('shareImage.leaderScore'), leaderScore, COLORS.blue],
  ];

  const gap = 16;
  const cardWidth = (CONTENT_WIDTH - gap * 3) / 4;
  cards.forEach(([label, value, color], index) => {
    const x = PAD + index * (cardWidth + gap);
    fillRoundRect(ctx, x, y, cardWidth, 116, 24, COLORS.white);
    strokeRoundRect(ctx, x, y, cardWidth, 116, 24, '#fed7aa');
    text(ctx, label, x + 24, y + 38, { size: 21, weight: 600, color: COLORS.muted });
    fitText(ctx, value, x + 24, y + 82, cardWidth - 48, { size: 31, weight: 900, color });
  });

  return y + 154;
};

const drawSectionTitle = (ctx: CanvasRenderingContext2D, title: string, y: number) => {
  text(ctx, title, PAD, y + 36, { size: 34, weight: 900, color: COLORS.ink });
  return y + 62;
};

function drawTable<T>(
  ctx: CanvasRenderingContext2D,
  y: number,
  columns: TableColumn<T>[],
  rows: T[]
) {
  const headerHeight = 58;
  const rowHeight = 64;
  const height = headerHeight + rows.length * rowHeight + 26;
  fillRoundRect(ctx, PAD, y, CONTENT_WIDTH, height, CARD_RADIUS, COLORS.white);
  strokeRoundRect(ctx, PAD, y, CONTENT_WIDTH, height, CARD_RADIUS, '#fed7aa');

  let x = PAD + 24;
  const headerY = y + 38;
  columns.forEach((column) => {
    const align = column.align ?? 'left';
    const tx = align === 'right' ? x + column.width - 12 : align === 'center' ? x + column.width / 2 : x;
    fitText(ctx, column.title, tx, headerY, column.width - 16, {
      size: 21,
      weight: 800,
      color: COLORS.muted,
      align,
    });
    x += column.width;
  });

  ctx.strokeStyle = '#ffedd5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD + 20, y + headerHeight);
  ctx.lineTo(PAD + CONTENT_WIDTH - 20, y + headerHeight);
  ctx.stroke();

  rows.forEach((row, rowIndex) => {
    const rowY = y + headerHeight + rowIndex * rowHeight;
    if (rowIndex % 2 === 0) {
      fillRoundRect(ctx, PAD + 14, rowY + 8, CONTENT_WIDTH - 28, rowHeight - 12, 16, '#fff7ed');
    }

    let colX = PAD + 24;
    columns.forEach((column) => {
      const align = column.align ?? 'left';
      const tx = align === 'right' ? colX + column.width - 12 : align === 'center' ? colX + column.width / 2 : colX;
      fitText(ctx, column.value(row), tx, rowY + 43, column.width - 16, {
        size: 24,
        weight: column.title === i18n.t('game.playerName') ? 800 : 700,
        color: column.color?.(row) ?? COLORS.ink,
        align,
      });
      colX += column.width;
    });
  });

  return y + height + 34;
}

const drawMetricCards = (
  ctx: CanvasRenderingContext2D,
  y: number,
  playerName: string,
  metrics: Metric[]
) => {
  const colCount = 3;
  const gap = 14;
  const innerPad = 24;
  const colWidth = (CONTENT_WIDTH - innerPad * 2 - gap * (colCount - 1)) / colCount;
  const metricHeight = 70;
  const rows = Math.ceil(metrics.length / colCount);
  const height = 76 + rows * metricHeight + 24;

  fillRoundRect(ctx, PAD, y, CONTENT_WIDTH, height, CARD_RADIUS, COLORS.white);
  strokeRoundRect(ctx, PAD, y, CONTENT_WIDTH, height, CARD_RADIUS, '#fed7aa');
  text(ctx, playerName, PAD + 26, y + 48, { size: 29, weight: 900, color: COLORS.ink });

  metrics.forEach((metric, index) => {
    const col = index % colCount;
    const row = Math.floor(index / colCount);
    const x = PAD + innerPad + col * (colWidth + gap);
    const yy = y + 76 + row * metricHeight;
    fillRoundRect(ctx, x, yy, colWidth, metricHeight - 12, 16, '#fff7ed');
    text(ctx, metric.label, x + 16, yy + 24, { size: 18, weight: 600, color: COLORS.muted });
    fitText(ctx, metric.value, x + 16, yy + 50, colWidth - 32, { size: 24, weight: 900, color: metric.color ?? COLORS.ink });
  });

  return y + height + 20;
};

const blobFromCanvas = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error(i18n.t('shareImage.errorGenerateStats')));
  }, 'image/png', 0.95);
});

export async function createStatsShareImage(input: StatsShareImageInput): Promise<Blob> {
  await document.fonts?.ready;

  const order = new Map(input.summaryStats.map((stat, index) => [stat.player_name, index]));
  const detailStats = [...input.detailStats].sort((a, b) => (order.get(a.player_name) ?? 999) - (order.get(b.player_name) ?? 999));
  const winningStats = [...input.winningStats].sort((a, b) => (order.get(a.player_name) ?? 999) - (order.get(b.player_name) ?? 999));

  const tableHeight = 62 + 58 + input.summaryStats.length * 64 + 26 + 34;
  const detailHeight = detailStats.length > 0 ? 62 + detailStats.length * (76 + Math.ceil(9 / 3) * 70 + 24 + 20) + 14 : 0;
  const winningHeight = winningStats.length > 0 ? 62 + winningStats.length * (76 + Math.ceil(7 / 3) * 70 + 24 + 20) + 14 : 0;
  const logicalHeight = 36 + 210 + 154 + tableHeight + detailHeight + winningHeight + 110;
  const scale = Math.min(window.devicePixelRatio || 2, 2);

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(WIDTH * scale);
  canvas.height = Math.floor(logicalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(i18n.t('shareImage.errorDeviceStats'));
  ctx.scale(scale, scale);

  const pageGradient = ctx.createLinearGradient(0, 0, 0, logicalHeight);
  pageGradient.addColorStop(0, '#fff7ed');
  pageGradient.addColorStop(0.42, '#fff1f2');
  pageGradient.addColorStop(1, '#fffbeb');
  ctx.fillStyle = pageGradient;
  ctx.fillRect(0, 0, WIDTH, logicalHeight);

  let y = drawHeader(ctx, 36, input.generatedAt ?? new Date());
  y = drawOverview(ctx, y, input.summaryStats);
  y = drawSectionTitle(ctx, i18n.t('stats.overview'), y);
  y = drawTable<ShareSummaryStat>(ctx, y, [
    { title: i18n.t('game.playerName'), width: 270, value: row => row.player_name },
    { title: i18n.t('stats.totalGames'), width: 135, align: 'center', value: row => String(row.games_played) },
    { title: i18n.t('shareImage.totalStandardScore'), width: 185, align: 'center', value: row => fixed1(row.total_standard_score), color: () => COLORS.orange },
    { title: i18n.t('shareImage.averageStandardScore'), width: 205, align: 'center', value: row => fixed2(row.average_standard_score), color: () => COLORS.blue },
    { title: i18n.t('game.totalScore'), width: 185, align: 'center', value: row => signedNumber(row.total_game_score), color: row => row.total_game_score >= 0 ? COLORS.green : COLORS.red },
  ], input.summaryStats);

  if (detailStats.length > 0) {
    y = drawSectionTitle(ctx, i18n.t('stats.attackDefense'), y + 8);
    detailStats.forEach((stat) => {
      y = drawMetricCards(ctx, y, stat.player_name, [
        { label: i18n.t('shareImage.totalRounds'), value: String(stat.total_rounds) },
        { label: i18n.t('shareImage.winRounds'), value: String(stat.win_rounds), color: COLORS.green },
        { label: i18n.t('stats.winRate'), value: percent(stat.win_rate), color: COLORS.green },
        { label: i18n.t('stats.avgWinFan'), value: stat.win_rounds > 0 ? fixed1(stat.avg_win_fan) : '-' },
        { label: i18n.t('shareImage.selfDrawRounds'), value: String(stat.self_draw_rounds), color: COLORS.blue },
        { label: i18n.t('stats.selfDrawRate'), value: percent(stat.self_draw_rate), color: COLORS.blue },
        { label: i18n.t('shareImage.loserRounds'), value: String(stat.loser_rounds), color: COLORS.red },
        { label: i18n.t('stats.loserRate'), value: percent(stat.loser_rate), color: COLORS.red },
        { label: i18n.t('shareImage.avgLoserFan'), value: stat.loser_rounds > 0 ? fixed1(stat.avg_loser_fan) : '-' },
      ]);
    });
  }

  if (winningStats.length > 0) {
    y = drawSectionTitle(ctx, i18n.t('stats.winData'), y + 8);
    winningStats.forEach((stat) => {
      y = drawMetricCards(ctx, y, stat.player_name, [
        { label: i18n.t('shareImage.totalWinRounds'), value: String(stat.total_win_rounds), color: COLORS.green },
        { label: i18n.t('shareImage.fan8_15'), value: String(stat.win_8_15) },
        { label: i18n.t('shareImage.fan16_30'), value: String(stat.win_16_30) },
        { label: i18n.t('shareImage.fan31_63'), value: String(stat.win_31_63) },
        { label: i18n.t('shareImage.fan64_plus'), value: String(stat.win_64_plus), color: COLORS.rose },
        { label: i18n.t('shareImage.maxFanRong'), value: String(stat.max_fan_rong), color: COLORS.amber },
        { label: i18n.t('stats.maxWinFan'), value: String(stat.max_fan_self_draw), color: COLORS.blue },
      ]);
    });
  }

  text(ctx, i18n.t('shareImage.footerGenerator'), WIDTH / 2, logicalHeight - 48, {
    size: 24,
    weight: 600,
    color: COLORS.muted,
    align: 'center',
  });

  return blobFromCanvas(canvas);
}

export const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => {
    const result = String(reader.result || '');
    resolve(result.includes(',') ? result.split(',')[1] : result);
  };
  reader.onerror = () => reject(reader.error || new Error(i18n.t('shareImage.errorReadImage')));
  reader.readAsDataURL(blob);
});
