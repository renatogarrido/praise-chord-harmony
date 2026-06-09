import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/public/terms")({ component: TermsPage });

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-12 md:py-20">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="mb-12 block text-center">
          <span className="font-serif text-3xl text-gold">Cifras Praise</span>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Renascer Collection</p>
        </Link>
        
        <h1 className="font-serif text-3xl mb-8">Termos de Uso e Política de Privacidade</h1>
        
        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Introdução</h2>
            <p>
              Bem-vindo ao Cifras Praise. Ao utilizar nossa plataforma, você concorda com estes termos. 
              Esta política descreve como coletamos e usamos seus dados pessoais em conformidade com a 
              Lei Geral de Proteção de Dados (LGPD) do Brasil.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Dados Coletados</h2>
            <p>
              Coletamos as seguintes informações durante o cadastro:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Nome completo</li>
              <li>Endereço de e-mail</li>
              <li>Sua igreja local</li>
              <li>Instrumentos musicais e tipos vocais (opcional)</li>
              <li>Foto de perfil (opcional)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Finalidade do Tratamento</h2>
            <p>
              Seus dados são utilizados exclusivamente para:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Identificar você dentro da plataforma</li>
              <li>Permitir a gestão de músicos e repertórios pela sua liderança local</li>
              <li>Garantir a segurança do acesso à sua conta</li>
              <li>Personalizar sua experiência com cifras e tons</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Armazenamento e Segurança</h2>
            <p>
              Os dados são armazenados de forma segura em servidores protegidos. Não compartilhamos, 
              vendemos ou alugamos seus dados pessoais para terceiros para fins de marketing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Seus Direitos</h2>
            <p>
              Você tem o direito de solicitar o acesso, a correção ou a exclusão de seus dados a qualquer momento. 
              Para excluir sua conta e dados permanentemente, você pode entrar em contato com o suporte ou 
              ajustar suas configurações de perfil.
            </p>
          </section>

          <div className="pt-8 border-t border-border mt-10">
            <Link 
              to="/signup" 
              className="inline-block rounded-full bg-gold px-8 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:bg-gold/90 transition-colors"
            >
              Voltar ao cadastro
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
