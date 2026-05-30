import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Import
if "import { useTranslation }" not in content:
    content = content.replace("import { useCallback, useEffect, useState, useRef, type ReactNode } from 'react';",
                              "import { useCallback, useEffect, useState, useRef, type ReactNode } from 'react';\nimport { useTranslation } from 'react-i18next';")

# Hook
if "const { t } = useTranslation();" not in content:
    content = content.replace("function App() {",
                              "function App() {\n  const { t } = useTranslation();")

# Replacements
replacements = [
    ("console.error('创建比赛失败:', gameError);", "console.error(t('game.createFailed'), gameError);"),
    ("alert('请先开始比赛。');", "alert(t('game.startFirst'));"),
    ("const confirmed = window.confirm('当前档案有未完成比赛。切换后可在历史中继续，是否切换？');", "const confirmed = window.confirm(t('files.switchConfirm'));"),
    ("alert('未找到档案。');", "alert(t('files.notFound'));"),
    ("const confirmed = window.confirm('当前有未完成比赛。新建档案后，可回到原档案继续，是否新建？');", "const confirmed = window.confirm(t('files.createConfirm'));"),
    ("const name = window.prompt('新档案名称：', '新档案');", "const name = window.prompt(t('files.newFileName'), t('files.newFile'));"),
    ("const name = window.prompt('档案名称：', getDataFileName(currentUser));", "const name = window.prompt(t('files.fileNamePrompt'), getDataFileName(currentUser));"),
    ("alert('至少保留一个档案。');", "alert(t('files.keepOne'));"),
    ("const confirmed = window.confirm(`删除「${getDataFileName(currentUser)}」？此档案内的比赛和统计会一并删除，无法恢复。`);", "const confirmed = window.confirm(t('files.deleteConfirm', { name: getDataFileName(currentUser) }));"),
    ("if (!confirm('记录荒庄？本盘四家均记 0 分。')) return;", "if (!confirm(t('game.drawConfirm'))) return;"),
    ("console.error('记录荒庄失败:', scoreError);", "console.error(t('game.drawFailed'), scoreError);"),
    ("if (!confirm('删除这场比赛？此操作无法恢复。')) return;", "if (!confirm(t('game.deleteConfirm'))) return;"),
    ("alert('没有可撤销的记录。');", "alert(t('game.noUndo'));"),
    ("if (!confirm('撤销上一盘记录？')) return;", "if (!confirm(t('game.revokeRound'))) return;"),
    ("console.error('记录分数失败:', scoreError);", "console.error(t('game.scoreFailed'), scoreError);"),
    ("<div className=\"text-gray-600 text-sm\">正在打开当前档案…</div>", "<div className=\"text-gray-600 text-sm\">{t('files.opening')}</div>"),
    ("{ page: 'home' as const, path: '', label: '开局', Icon: Home },", "{ page: 'home' as const, path: '', label: t('common.start', '开局'), Icon: Home },"),
    ("{ page: 'history' as const, path: '/history', label: '历史', Icon: History },", "{ page: 'history' as const, path: '/history', label: t('common.history'), Icon: History },"),
    ("{ page: 'stats' as const, path: '/stats', label: '统计', Icon: BarChart3 },", "{ page: 'stats' as const, path: '/stats', label: t('common.stats'), Icon: BarChart3 },"),
    ("{ page: 'data' as const, path: '/data', label: '档案', Icon: Database },", "{ page: 'data' as const, path: '/data', label: t('files.manageFiles'), Icon: Database },"),
    ("if (confirm('返回开局页？当前比赛会自动保存。')) {", "if (confirm(t('game.returnHomeConfirm'))) {"),
    ("title=\"返回开局页\"", "title={t('game.returnHome')}"),
    ("title=\"计分牌连接\"", "title={t('device.connectDevice')}"),
    ("<h3 className=\"text-lg font-bold text-gray-900 mb-2\">提前结束比赛</h3>", "<h3 className=\"text-lg font-bold text-gray-900 mb-2\">{t('game.earlyEndGame')}</h3>"),
    ("<p className=\"text-gray-600 mb-6\">已完成的盘数会保存，可在历史中查看。</p>", "<p className=\"text-gray-600 mb-6\">{t('game.earlyEndGameDesc')}</p>"),
    ("取消", "{t('common.cancel')}"),
    ("结束比赛", "{t('game.endGame')}"),
    ("<div className=\"text-2xl font-black text-gray-800\">比赛已结束</div>", "<div className=\"text-2xl font-black text-gray-800\">{t('game.gameEnded')}</div>"),
    ("<div className=\"text-sm text-gray-500 font-medium\">查看本场成绩，或从历史继续回看。</div>", "<div className=\"text-sm text-gray-500 font-medium\">{t('game.viewStatsOrHistory')}</div>"),
    ("查看成绩", "{t('game.viewStats')}"),
    ("<span>荒庄</span>", "<span>{t('mahjong.draw')}</span>"),
    ("<span>明细</span>", "<span>{t('game.gameDetail')}</span>"),
    ("<span>撤销</span>", "<span>{t('game.undo')}</span>"),
    ("<span>判罚</span>", "<span>{t('mahjong.penalty')}</span>"),
    ("<span>结束</span>", "<span>{t('common.endGame')}</span>")
]

for old, new in replacements:
    content = content.replace(old, new)

with open('src/App.tsx', 'w') as f:
    f.write(content)
print("Done")
