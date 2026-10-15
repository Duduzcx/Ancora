content = open('app/page.tsx', 'r', encoding='utf-8').read()

content = content.replace('layout: {{', 'layout: {')
content = content.replace('easeInOut" }},', 'easeInOut" },')

content = content.replace('default: {{', 'default: {')
content = content.replace('0.711, 1] }}', '0.711, 1] }')

open('app/page.tsx', 'w', encoding='utf-8').write(content)
