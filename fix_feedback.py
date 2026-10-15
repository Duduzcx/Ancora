import re

# 1. Fix app/page.tsx
content = open('app/page.tsx', 'r', encoding='utf-8').read()

# Remove Fundo do Card
content = re.sub(r'\{/\* Fundo do Card \*/\}\s*<div className="absolute inset-\[1px\] bg-\[#131b2c\] rounded-\[23px\] z-0 group-hover:bg-\[#1a2333\] transition-colors pointer-events-none" />\s*', '', content)

# Add bg back to container
content = content.replace('className="group p-6 rounded-3xl active:scale-[0.98] transition-all relative overflow-hidden cursor-pointer shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] text-center space-y-4"', 
                          'className="group p-6 rounded-3xl bg-[#131b2c] hover:bg-[#1a2333] border border-white/5 active:scale-[0.98] transition-all relative overflow-hidden cursor-pointer shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] text-center space-y-4"')

content = content.replace('className="group p-6 rounded-3xl active:scale-[0.98] transition-all relative overflow-hidden cursor-pointer shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] text-center space-y-6"', 
                          'className="group p-6 rounded-3xl bg-[#131b2c] hover:bg-[#1a2333] border border-white/5 active:scale-[0.98] transition-all relative overflow-hidden cursor-pointer shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] text-center space-y-6"')


# Make wave background lighter: bg-[#051322] to bg-[#0a1e36]
content = content.replace("backgroundColor: '#051322'", "backgroundColor: '#0a1e36'")
# And reduce the opacity of the dark gradient overlay over the wave
content = content.replace('bg-gradient-to-b from-transparent via-[#020a10]/50 to-[#020a10]/90', 'bg-gradient-to-b from-transparent via-[#0a1e36]/30 to-[#0a1e36]/80')

# Change rx="23" to rx="24"
content = content.replace('rx="23"', 'rx="24"')

open('app/page.tsx', 'w', encoding='utf-8').write(content)

# 2. Fix components/LoginBackground.tsx
login_content = open('components/LoginBackground.tsx', 'r', encoding='utf-8').read()

login_content = login_content.replace('bg-[#050810]', 'bg-[#0a1e36]')
# Add wave image
login_content = login_content.replace('<div className="absolute inset-0 bg-[linear', '''<div className="absolute inset-0" style={{ backgroundImage: "url('/tech_particle_wave.png')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.8 }} />
      <div className="absolute inset-0 bg-[linear''')

# Increase glow intensity
login_content = login_content.replace('opacity-50 mix-blend-screen', 'opacity-100 mix-blend-screen')
login_content = login_content.replace('rgba(16, 185, 129, 0.25) 0px, transparent 40%', 'rgba(16, 185, 129, 0.6) 0px, transparent 70%')
login_content = login_content.replace('rgba(59, 130, 246, 0.15) 0px, transparent 50%', 'rgba(59, 130, 246, 0.4) 0px, transparent 70%')
login_content = login_content.replace('rgba(20, 184, 166, 0.12) 0px, transparent 60%', 'rgba(20, 184, 166, 0.4) 0px, transparent 70%')

open('components/LoginBackground.tsx', 'w', encoding='utf-8').write(login_content)

