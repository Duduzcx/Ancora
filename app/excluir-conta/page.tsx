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
              <li>Toque em <strong>Perfil</strong> no menu inferior.</li>
              <li>Role até o final e toque em <strong>"Excluir Minha Conta"</strong>.</li>
              <li>Digite <strong>EXCLUIR</strong> para confirmar. Sua conta e todos os dados são apagados na hora.</li>
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
              <li><strong>Histórico Emocional:</strong> todas as conversas do Porto e os registros de humor (mapa emocional).</li>
              <li><strong>Cofre:</strong> todos os textos guardados.</li>
              <li><strong>Logs:</strong> hábitos e tarefas registrados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#001f3f] mb-3">Período de Armazenamento Adicional</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Após a confirmação da exclusão, os dados são removidos imediatamente dos bancos de dados de produção. 
              Por motivos de segurança e conformidade legal, cópias de backup podem reter essas informações por um período adicional de até <strong>30 dias</strong>, após o qual são eliminadas de forma definitiva e irrecuperável.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
