import re

content = open('app/page.tsx', 'r', encoding='utf-8').read()

# We need to remove the current snake blocks first
content = re.sub(r'\{\/\* Efeito Cobra Voadora \*\/}.*?\{\/\* Fundo do Card \*\/\}', '{/* Fundo do Card */}', content, flags=re.DOTALL)

colors = [
    'bg-blue-400',
    'bg-rose-400',
    'bg-emerald-400',
    'bg-teal-400',
    'bg-sky-400'
]

shadows = [
    'shadow-[0_0_15px_3px_rgba(96,165,250,0.8)]',
    'shadow-[0_0_15px_3px_rgba(251,113,133,0.8)]',
    'shadow-[0_0_15px_3px_rgba(52,211,153,0.8)]',
    'shadow-[0_0_15px_3px_rgba(45,212,191,0.8)]',
    'shadow-[0_0_15px_3px_rgba(56,189,248,0.8)]'
]

def replacer(match):
    idx = replacer.count
    replacer.count += 1
    if idx >= 5:
        return match.group(0)
    
    color = colors[idx]
    shadow = shadows[idx]
    
    block = f'''{{/* Efeito Cobra Voadora */}}
            {{snakeStep === {idx} && (
              <motion.div 
                layoutId="snake-dot"
                initial={{{{ x: "0%", y: "0%" }}}}
                animate={{{{
                  x: ["0%", "100%", "100%", "0%", "0%"],
                  y: ["0%", "0%", "100%", "100%", "0%"]
                }}}}
                transition={{{{ 
                  layout: {{{{ duration: 0.6, ease: "easeInOut" }}}},
                  default: {{{{ duration: 4.0, ease: "linear" }}}}
                }}}}
                onAnimationComplete={{handleSnakeComplete}}
                className="absolute w-1.5 h-1.5 -ml-[3px] -mt-[3px] {color} rounded-full z-20 {shadow} pointer-events-none"
              />
            )}}
            {{/* Fundo do Card */}}'''
    return '>\\n            ' + block

replacer.count = 0
content = re.sub(r'>\s*\{\/\*\s*Fundo do Card\s*\*/\}', replacer, content)

open('app/page.tsx', 'w', encoding='utf-8').write(content)
