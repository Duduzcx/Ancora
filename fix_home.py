import re

content = open('app/page.tsx', 'r', encoding='utf-8').read()

# 1. Remove old snake-dot layoutId blocks entirely
content = re.sub(r'\{\/\* Efeito Cobra Voadora \*\/}.*?\{\/\* Fundo do Card \*\/\}', '{/* Fundo do Card */}', content, flags=re.DOTALL)

# 2. Add User to lucide-react imports
if 'User,' not in content and 'User ' not in content:
    content = content.replace('from \'lucide-react\';', 'User, from \'lucide-react\';')

# 3. Replace background in Home to the image and remove AnimatedBackground
content = re.sub(r'<AnimatedBackground subtle />\s*<motion\.div[^>]+className="fixed inset-0 pointer-events-none z-\[-5\] opacity-60 mix-blend-multiply".*?/>', 
'''{/* Background Tech Wave Otimizado */}
        <motion.div 
          className="fixed inset-0 z-[-5]"
          style={{ 
            backgroundImage: "url('/tech_particle_wave.png')", 
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#051322'
          }}
          animate={{ scale: [1, 1.05, 1], x: [0, -10, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="fixed inset-0 z-[-4] bg-gradient-to-b from-transparent via-[#020a10]/50 to-[#020a10]/90 pointer-events-none" />''', content, flags=re.DOTALL)

# 4. Insert SVG Snake Border inside the first 5 cards
colors = [
    '#60A5FA', # blue-400
    '#FB7185', # rose-400
    '#34D399', # emerald-400
    '#2DD4BF', # teal-400
    '#38BDF8'  # sky-400
]

def replacer(match):
    idx = replacer.count
    replacer.count += 1
    if idx >= 5:
        return match.group(0)
    
    color = colors[idx]
    
    block = f'''{{/* SVG Snake Border */}}
            {{snakeStep === {idx * 2} && (
              <div className="absolute inset-0 rounded-[23px] pointer-events-none z-20">
                <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <motion.rect
                    width="100%" height="100%" rx="23" fill="none" stroke="{color}" strokeWidth="2"
                    initial={{{{ pathLength: 0, pathOffset: 0 }}}}
                    animate={{{{ pathLength: [0, 0.4, 0], pathOffset: [0, 1.6, 1.6] }}}}
                    transition={{{{ duration: 3, ease: "linear" }}}}
                    style={{{{ filter: "drop-shadow(0 0 6px {color})" }}}}
                    onAnimationComplete={{handleSnakeComplete}}
                  />
                </svg>
              </div>
            )}}
            {{/* Gap Line to next card */}}
            {{idx < 4 && snakeStep === (idx * 2) + 1 && (
              <div className="absolute -bottom-6 left-6 w-[2px] h-6 z-20 overflow-hidden">
                <motion.div
                  className="w-full bg-white"
                  initial={{{{ height: "0%", y: "0%" }}}}
                  animate={{{{ height: ["0%", "100%", "0%"], y: ["0%", "0%", "24px"] }}}}
                  transition={{{{ duration: 0.3, ease: "linear" }}}}
                  style={{{{ filter: "drop-shadow(0 0 4px white)" }}}}
                  onAnimationComplete={{handleSnakeComplete}}
                />
              </div>
            )}}
            {{/* Fundo do Card */}}'''
    return '>\\n            ' + block

replacer.count = 0
content = re.sub(r'>\s*\{\/\*\s*Fundo do Card\s*\*/\}', replacer, content)

# 5. Fix snake modulo: snakeStep goes from 0 to 8 (Card0, Gap0, Card1, Gap1, Card2, Gap2, Card3, Gap3, Card4) -> 9 steps total.
content = content.replace('setSnakeStep(prev => (prev + 1) % 5);', 'setSnakeStep(prev => (prev + 1) % 9);')

# 6. Remove blur shadow on Respiração
content = re.sub(r'<div className="absolute inset-0 bg-sky-500/\[0\.03\] blur-3xl -z-10" />', '', content)

open('app/page.tsx', 'w', encoding='utf-8').write(content)
