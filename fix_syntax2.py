content = open('app/page.tsx', 'r', encoding='utf-8').read()

content = content.replace('layout: {{', 'layout: {')
content = content.replace('easeInOut" }},', 'easeInOut" },')
content = content.replace('default: {{', 'default: {')
content = content.replace('linear" }}', 'linear" }')

open('app/page.tsx', 'w', encoding='utf-8').write(content)
