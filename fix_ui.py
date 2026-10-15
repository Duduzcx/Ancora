import re

content_home = open('app/page.tsx', 'r', encoding='utf-8').read()

# 1. Fix SVG rect in Cards to draw strictly inside the border
# Replace <motion.rect width="100%" height="100%" rx="24" with x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)"
content_home = content_home.replace('width="100%" height="100%" rx="24"', 'x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="23"')

# 2. Make Home Background moving and brighter
content_home = content_home.replace("backgroundColor: '#0a1e36'", "backgroundColor: '#112948'")
content_home = content_home.replace("bg-gradient-to-b from-transparent via-[#0a1e36]/30 to-[#0a1e36]/80", "bg-gradient-to-b from-transparent via-[#112948]/10 to-[#112948]/60")

# 3. Fix missing "Agitado" card (maybe an issue with keys or viewport mapping)
# Let's remove 'viewport={{ once: true }}' from the mood cards to ensure they appear even if scroll is weird
content_home = content_home.replace('viewport={{ once: true }}\n                    transition={{ delay: idx * 0.05, duration: 0.4 }}', 'transition={{ delay: idx * 0.05, duration: 0.4 }}')

# 4. Add Snake Loop to Login Box
# Find the login box wrapper: <div className="w-full bg-[#0d1424]/80 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative overflow-hidden">
# We will inject the SVG snake loop!
login_snake = '''<div className="absolute inset-0 pointer-events-none z-20">
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <motion.rect
                x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="23" fill="none" stroke="#00D88B" strokeWidth="2"
                initial={{ pathLength: 0, pathOffset: 0 }}
                animate={{ pathLength: [0, 0.5, 0], pathOffset: [0, 2, 2] }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                style={{ filter: "drop-shadow(0 0 8px #00D88B)" }}
              />
            </svg>
          </div>'''

content_home = content_home.replace(
    '<div className="w-full bg-[#0d1424]/80 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative overflow-hidden">',
    '<div className="w-full bg-[#0d1424]/80 backdrop-blur-md rounded-3xl p-8 shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative overflow-hidden">\n          ' + login_snake
)

open('app/page.tsx', 'w', encoding='utf-8').write(content_home)

# 5. Fix LoginBackground.tsx to be visibly massive
login_bg = open('components/LoginBackground.tsx', 'r', encoding='utf-8').read()
login_bg = login_bg.replace('bg-[#0a1e36]', 'bg-[#112948]')
login_bg = login_bg.replace('rgba(16, 185, 129, 0.6) 0px, transparent 70%', 'rgba(16, 185, 129, 0.8) 0px, transparent 85%')
login_bg = login_bg.replace('rgba(59, 130, 246, 0.4) 0px, transparent 70%', 'rgba(59, 130, 246, 0.6) 0px, transparent 85%')
login_bg = login_bg.replace('rgba(20, 184, 166, 0.4) 0px, transparent 70%', 'rgba(20, 184, 166, 0.7) 0px, transparent 85%')
login_bg = login_bg.replace('scale: [1, 1.15, 1]', 'scale: [1, 1.4, 1]')
open('components/LoginBackground.tsx', 'w', encoding='utf-8').write(login_bg)

# 6. Fix Perfil Button
perfil_content = open('app/perfil/page.tsx', 'r', encoding='utf-8').read()
# Replace the heavy button
perfil_content = perfil_content.replace(
    'className="w-full h-[54px] bg-emerald-500 hover:bg-emerald-400 rounded-2xl flex items-center justify-center font-black text-[#080d19] transition-all shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_10px_40px_rgba(16,185,129,0.4)] uppercase tracking-widest text-[11px] active:scale-[0.98]"',
    'className="mt-4 px-8 h-10 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center font-bold text-emerald-400 transition-all shadow-sm mx-auto uppercase tracking-wider text-[10px] active:scale-[0.98]"'
)
open('app/perfil/page.tsx', 'w', encoding='utf-8').write(perfil_content)
