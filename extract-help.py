import re

with open('src/components/HelpPage.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if re.search(r'[\u4e00-\u9fa5]', line):
        print(f"{i}: {line.strip()}")
