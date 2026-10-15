export default function ExclusaoConta() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 text-slate-800 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-black text-[#001f3f] mb-6">Solicitação de Exclusão de Dados</h1>
        
        <p className="mb-6 text-slate-600">
          Na <strong>ZCX Studios</strong>, valorizamos a sua privacidade e autonomia sobre seus dados. 
          Esta página fornece as instruções necessárias para excluir sua conta e dados associados ao aplicativo <strong>Nórica</strong>.
        </p>

        <div className="space-y-8">
          <section className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">Como solicitar a exclusão:</h2>
            <ol className="list-decimal pl-5 space-y-3 text-slate-700 font-medium">
              <li>Abra o aplicativo <strong>Nórica</strong> no seu dispositivo.</li>
              <li>Acesse o menu de <strong>Configurações</strong> ou <strong>Perfil</strong>.</li>
              <li>Clique na opção <strong>"Excluir Minha Conta"</strong> no final da página.</li>
              <li>Confirme a ação. Sua conta será desativada instantaneamente.</li>
            </ol>
            <p className="mt-4 text-xs text-slate-500 italic">
              *Caso não tenha mais acesso ao app, você pode solicitar a exclusão enviando um e-mail para o suporte da ZCX Studios.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">Quais dados são excluídos?</h2>
            <p className="text-slate-600 mb-4">Ao processar sua solicitação, os seguintes dados são removidos permanentemente de nossos servidores ativos:</p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
              <li><strong>Informações de Perfil:</strong> Nome, e-mail e foto de perfil.</li>
              <li><strong>Histórico de Reflexões:</strong> Todos os registros de mapeamento de hábitos e reflexões diárias realizados com a Bússola (IA).</li>
              <li><strong>Logs de Atividade:</strong> Registros de uso e preferências dentro do ecossistema Nórica.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">Retenção de Dados</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Os dados do usuário são retidos apenas enquanto a conta estiver ativa. Ao excluir a conta, todos os dados são apagados definitivamente em até 30 dias.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
