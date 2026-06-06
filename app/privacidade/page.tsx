export default function Privacidade() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 text-slate-800 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-black text-[#001f3f] mb-2">Política de Privacidade</h1>
        <p className="mb-8 text-sm text-slate-500 font-medium">Última atualização: Abril de 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">1. Introdução</h2>
            <p>A ZCX Studios, desenvolvedora do aplicativo Nórica, compromete-se a proteger a sua privacidade. Esta política detalha como coletamos, usamos e protegemos suas informações pessoais em nosso sistema de foco e produtividade.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">2. Coleta de Dados</h2>
            <p>Para fornecer o nosso sistema de organização de rotina, coletamos os seguintes dados:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li><strong>Dados de Autenticação:</strong> Nome, endereço de e-mail e foto de perfil, fornecidos pelo provedor de login (Google OAuth) no momento da criação da conta.</li>
              <li><strong>Dados de Interação:</strong> Informações fornecidas voluntariamente pelo usuário durante a interação com a nossa Inteligência Artificial (Bússola) para fins de planejamento de rotina.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">3. Uso das Informações</h2>
            <p>Seus dados são utilizados exclusivamente para as seguintes finalidades:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li>Gerenciar sua sessão e manter sua conta segura.</li>
              <li>Processar análises e gerar relatórios de planejamento e organização utilizando nossa tecnologia de IA.</li>
              <li>Facilitar o direcionamento para rotinas de produtividade recomendadas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">4. Compartilhamento de Dados</h2>
            <p>A ZCX Studios não vende, aluga ou compartilha seus dados pessoais com terceiros para fins de marketing ou publicidade. O processamento de dados ocorre apenas por provedores de infraestrutura estritamente necessários (como banco de dados seguro e APIs de Inteligência Artificial), operando sob rigorosos padrões de segurança.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">5. Período de Retenção e Eliminação dos Dados</h2>
            <p>Os dados do usuário são retidos apenas enquanto a conta estiver ativa. Ao excluir a conta, todos os dados são apagados definitivamente em até 30 dias.</p>
            <p className="mt-3">Nórica é um aplicativo de produtividade. Não coletamos dados de saúde. Todos os dados inseridos são retidos apenas para organização do usuário e excluídos permanentemente após a solicitação de remoção da conta ou após 30 dias de inatividade.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">6. Contato</h2>
            <p>Em caso de dúvidas sobre esta política ou sobre o tratamento de seus dados, entre em contato através dos canais oficiais da ZCX Studios.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
