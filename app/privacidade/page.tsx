// ⚠️ Antes de publicar: troque CONTACT_EMAIL pelo e-mail oficial de atendimento da ZCX Studios.
const CONTACT_EMAIL = 'contato@zcxstudios.com.br';

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 text-slate-800 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-black text-[#001f3f] mb-2">Política de Privacidade</h1>
        <p className="mb-8 text-sm text-slate-500 font-medium">Última atualização: Outubro de 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">1. Quem somos</h2>
            <p>O Nórica é um aplicativo de apoio emocional, organização de rotina e autoconhecimento desenvolvido pela <strong>ZCX Studios</strong>, que é a controladora dos seus dados pessoais nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD). Contato para qualquer assunto de privacidade: <strong>{CONTACT_EMAIL}</strong>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">2. O Nórica não é um serviço de emergência</h2>
            <p>O Nórica é uma ferramenta de apoio e não substitui psicólogos, médicos ou serviços de emergência. Se você estiver em sofrimento intenso, ligue para o <strong>CVV — 188</strong> (24h, gratuito) ou, em perigo imediato, para o <strong>SAMU — 192</strong>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">3. Quais dados coletamos</h2>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li><strong>Dados de cadastro:</strong> nome, como prefere ser chamado(a), e-mail, data de nascimento, foto de perfil (no login com Google) e como conheceu o app.</li>
              <li><strong>Dados emocionais (dados pessoais sensíveis):</strong> o estado do seu "mar" que você marca (calmo, ansioso, agitado, S.O.S), as conversas com a IA no Porto e os textos guardados no Cofre.</li>
              <li><strong>Registros de rotina:</strong> os hábitos marcados na aba Logs e as tarefas que você adiciona a partir do Porto.</li>
              <li><strong>Áudio:</strong> quando você usa o microfone, o áudio é enviado apenas para ser transcrito em texto. O arquivo de áudio não é guardado.</li>
              <li><strong>Memória da Nórica:</strong> um resumo curto das suas conversas (pessoas importantes, temas e o que costuma te ajudar), para a IA lembrar nas próximas conversas. Você vê, desliga e apaga em <strong>Perfil → Memória da Nórica</strong>.</li>
              <li><strong>Diário e exercícios:</strong> o que você grava ou escreve no diário por voz, na gratidão e na preparação de conversas, e o resumo semanal que a IA escreve para você. O áudio do diário não é guardado, só o texto.</li>
              <li><strong>Plano de segurança:</strong> o que você escrever no seu plano, incluindo nomes e telefones das suas pessoas de confiança. Esses contatos só são usados quando você mesmo(a) toca para avisá-los.</li>
              <li><strong>Avaliações e registros técnicos:</strong> quando você toca em 👍/👎 numa resposta, guardamos só a nota e o motivo escolhido (não o texto da conversa). O app também registra erros técnicos e lentidão (tela, versão do app e modelo do celular) para corrigirmos problemas.</li>
            </ul>
            <p className="mt-3">As conversas da Arena (simulações) não são guardadas.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">4. Por que usamos e com qual base legal</h2>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li>Para criar e manter sua conta e oferecer as funções do app (execução do serviço que você contratou).</li>
              <li>Para tratar seus dados emocionais — gerar as respostas da IA, o mapa emocional e as leituras do Farol — com base no seu <strong>consentimento específico e destacado</strong>, pedido no primeiro uso (art. 11, I, da LGPD). Você pode retirar esse consentimento a qualquer momento excluindo sua conta.</li>
              <li>Nunca usamos seus dados para publicidade e nunca os vendemos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">5. Com quem compartilhamos</h2>
            <p>Somente com fornecedores necessários para o app funcionar, sob contrato e regras de segurança:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li><strong>Supabase</strong> — hospedagem do banco de dados, login e servidor do app.</li>
              <li><strong>Groq</strong> — processamento da inteligência artificial (respostas do Porto e da Arena, títulos das conversas e transcrição de voz).</li>
              <li><strong>Instituição parceira</strong> (escola, cursinho ou empresa) — só se você digitar o código dela no app. Ela vê apenas números somados e anônimos de grupos com pelo menos 5 pessoas (por exemplo, a porcentagem de marcações "ansioso" na semana). Nunca recebe suas conversas, Cofre, diário, plano de segurança ou o seu humor individual. Você pode sair a qualquer momento em Perfil → Instituição Parceira.</li>
              <li><strong>Google</strong> — se você escolher entrar com a conta Google e, no caso do plano Pro, para processar o pagamento da assinatura pela Google Play. Não recebemos nem guardamos dados do seu cartão.</li>
            </ul>
            <p className="mt-3">Esses fornecedores podem processar dados fora do Brasil (inclusive nos Estados Unidos). Essa transferência internacional ocorre apenas para prestar o serviço e com garantias de segurança compatíveis com a LGPD.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">6. Como protegemos</h2>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li>Todo o tráfego é criptografado (HTTPS).</li>
              <li>As mensagens do Porto, os títulos das conversas, o conteúdo do Cofre, a memória da Nórica e o plano de segurança são <strong>criptografados no servidor com AES-256</strong> antes de serem gravados no banco.</li>
              <li>Cada conta só consegue acessar os próprios dados (regras de acesso no banco) e a IA só é usada por usuários autenticados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">7. Por quanto tempo guardamos</h2>
            <p>Seus dados ficam guardados enquanto sua conta existir. Você pode apagar conversas e itens do Cofre a qualquer momento. Ao excluir a conta, todos os dados são apagados imediatamente dos nossos bancos de produção; cópias de segurança automáticas podem mantê-los por até 30 dias, depois são eliminadas.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">8. Seus direitos</h2>
            <p>Você pode, a qualquer momento: confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a portabilidade, revogar o consentimento e pedir a eliminação. A exclusão completa está disponível no app em <strong>Perfil → Excluir Minha Conta</strong>. Para os demais pedidos, escreva para <strong>{CONTACT_EMAIL}</strong>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">9. Idade mínima</h2>
            <p>O Nórica é destinado a pessoas com 18 anos ou mais.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">10. Alterações</h2>
            <p>Se esta política mudar de forma relevante, avisaremos dentro do app e pediremos seu consentimento novamente quando necessário.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
