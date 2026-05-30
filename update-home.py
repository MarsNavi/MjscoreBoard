import re

with open('src/components/HomePage.tsx', 'r') as f:
    content = f.read()

# Import
if "import { useTranslation }" not in content:
    content = content.replace("import { useCallback, useEffect, useRef, useState } from 'react';",
                              "import { useCallback, useEffect, useRef, useState } from 'react';\nimport { useTranslation } from 'react-i18next';")

# Hook
if "const { t } = useTranslation();" not in content:
    content = content.replace("}: HomePageProps) {",
                              "}: HomePageProps) {\n  const { t } = useTranslation();")

# Replacements
replacements = [
    ("'东'", "t('mahjong.east')"),
    ("'南'", "t('mahjong.south')"),
    ("'西'", "t('mahjong.west')"),
    ("'北'", "t('mahjong.north')"),
    ("快速开局", "{t('game.quickStart')}"),
    ("比赛名称（可选）", "{t('game.gameName')}"),
    ("placeholder=\"周末友谊赛\"", "placeholder={t('game.gameNamePlaceholder')}"),
    ("选手姓名", "{t('game.playerNames')}"),
    ("<span>{positionLabels[position]}家</span>", "<span>{positionLabels[position]}{t('mahjong.playerSuffix')}</span>"),
    ("aria-label=\"展开选手列表\"", "aria-label={t('game.expandPlayerList')}"),
    ("常用选手 · 点击选择", "{t('game.commonPlayers')}"),
    ("无匹配选手", "{t('game.noMatch')}"),
    ("开始比赛", "{t('game.startGame')}"),
    ("作为显示屏 (模拟计分板)", "{t('device.displayMode')}")
]

for old, new in replacements:
    content = content.replace(old, new)

with open('src/components/HomePage.tsx', 'w') as f:
    f.write(content)
print("Done")
