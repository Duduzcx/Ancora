import re

content = open('app/page.tsx', 'r', encoding='utf-8').read()

def replacer(match):
    idx = replacer.count
    replacer.count += 1
    
    val = (idx * 2) + 1
    if idx < 4:
        return f"{{snakeStep === {val} && ("
    else:
        # For the 5th card, it shouldn't have a gap line
        return "{false && ("

replacer.count = 0

content = re.sub(r'\{snakeStep === \(idx \* 2\) \+ 1 && \(', replacer, content)

open('app/page.tsx', 'w', encoding='utf-8').write(content)
