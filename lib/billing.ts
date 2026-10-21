// Assinatura Nórica Pro pela Google Play (plugin cordova-plugin-purchase).
// Fluxo: a pessoa assina na Google Play → o app manda o token para o servidor →
// o servidor confere com o Google e só então libera o Pro → o app confirma a compra.

import { Capacitor } from '@capacitor/core';
import { createClient } from '@/lib/supabase-client';
import { noricaApi } from '@/lib/norica-api';

export const PRO_PRODUCT_ID = 'norica_pro_mensal';
export const PRO_PRICE_FALLBACK = 'R$ 15,00/mês';
export const MANAGE_SUBSCRIPTION_URL =
  `https://play.google.com/store/account/subscriptions?sku=${PRO_PRODUCT_ID}&package=com.zcx.ancora`;

type Listener = (event: { type: 'activated' } | { type: 'error'; message: string }) => void;
const listeners = new Set<Listener>();
let initPromise: Promise<boolean> | null = null;

function cdv(): any {
  return typeof window !== 'undefined' ? (window as any).CdvPurchase : undefined;
}

export function billingAvailable(): boolean {
  return Capacitor.getPlatform() === 'android';
}

// O plugin da loja carrega alguns instantes depois do app: espera ele aparecer.
async function waitForStore(ms = 5000): Promise<any> {
  const start = Date.now();
  while (!cdv() && Date.now() - start < ms) await new Promise((r) => setTimeout(r, 100));
  return cdv();
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(label)), ms))]);
}

export function onBillingEvent(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: Parameters<Listener>[0]) {
  listeners.forEach(l => l(event));
}

async function activate(transaction: any) {
  const token = transaction?.purchaseId;
  if (!token) return;
  try {
    const result = await noricaApi.verifyPurchase(token);
    // Confirma (acknowledge) na Google Play só depois que o servidor validou.
    await transaction.finish();
    if (result.active) emit({ type: 'activated' });
    else emit({ type: 'error', message: 'A Google Play ainda não confirmou o pagamento. Toque em "restaurar compra" em alguns minutos.' });
  } catch (err: any) {
    emit({ type: 'error', message: err?.message || 'Não foi possível ativar o Pro.' });
  }
}

// Por que a loja não abriu (aparece para a pessoa e ajuda a achar o problema).
let lastProblem = '';
let registered = false;
let initialized = false;

/** Prepara a loja. Retorna false fora do Android (web) ou se a Google Play não responder. */
export function initBilling(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!billingAvailable()) { lastProblem = 'A assinatura está disponível no app instalado pela Google Play.'; return false; }
    const lib = await waitForStore();
    if (!lib) { lastProblem = 'A loja da Google Play não carregou neste aparelho. Feche e abra o app de novo. (código: plugin)'; return false; }
    const { store, ProductType, Platform } = lib;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { lastProblem = 'Entre na sua conta para assinar.'; return false; }

    // O id da conta vai junto com a compra: o servidor confere que a assinatura é desta pessoa.
    store.obfuscator = 'disabled';
    store.applicationUsername = () => session.user.id;

    if (!registered) {
      registered = true;
      store.register([{ id: PRO_PRODUCT_ID, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.GOOGLE_PLAY }]);
      store.when().approved((transaction: any) => {
        if (transaction.products?.some((p: any) => p.id === PRO_PRODUCT_ID)) activate(transaction);
      });
      store.error((e: any) => console.warn('Loja:', e?.code, e?.message));
    }

    let errors: any[] | undefined;
    if (!initialized) {
      initialized = true;
      errors = await withTimeout(store.initialize([Platform.GOOGLE_PLAY]), 15000, 'timeout');
    } else {
      await withTimeout(store.update(), 15000, 'timeout'); // tentou antes e falhou: busca o produto de novo
    }
    if (store.get(PRO_PRODUCT_ID, Platform.GOOGLE_PLAY)) return true;
    lastProblem = errors?.length
      ? `A Google Play não respondeu: ${errors[0]?.message || 'erro'} (código: ${errors[0]?.code ?? 'loja'})`
      : 'A assinatura Pro ainda não está disponível na Google Play. Tente mais tarde. (código: produto)';
    return false;
  })().catch((e: any) => {
    lastProblem = e?.message === 'timeout'
      ? 'A Google Play demorou para responder. Confira a internet e tente de novo. (código: tempo)'
      : `Não foi possível abrir a loja: ${e?.message || 'erro'}`;
    return false;
  }).then((ok) => {
    if (!ok) initPromise = null; // deixa tentar de novo no próximo toque
    return ok;
  });
  return initPromise;
}

/** Preço vindo da Google Play (já no formato local), ou o valor padrão. */
export async function proPriceLabel(): Promise<string> {
  if (!(await initBilling())) return PRO_PRICE_FALLBACK;
  const { store, Platform } = cdv();
  const price = store.get(PRO_PRODUCT_ID, Platform.GOOGLE_PLAY)?.pricing?.price;
  return price ? `${price}/mês` : PRO_PRICE_FALLBACK;
}

/** Abre a tela de assinatura da Google Play. Retorna uma mensagem de erro ou null. */
export async function subscribePro(): Promise<string | null> {
  if (!(await initBilling())) return lastProblem || 'A assinatura não está disponível agora. Tente mais tarde.';
  const { store, Platform } = cdv();
  const offer = store.get(PRO_PRODUCT_ID, Platform.GOOGLE_PLAY)?.getOffer();
  if (!offer) return 'O plano Pro ainda não está disponível na sua loja. Tente mais tarde. (código: oferta)';
  const error = await offer.order();
  if (error) {
    // Código 6777006 = pessoa cancelou a tela da Google Play: não é erro.
    return error.code === 6777006 ? null : `${error.message || 'Não foi possível concluir a assinatura.'} (código: ${error.code ?? 'compra'})`;
  }
  return null;
}

/** "Restaurar compra": reenvia ao servidor as assinaturas que a Google Play conhece neste aparelho. */
export async function restorePro(): Promise<string | null> {
  if (!(await initBilling())) return lastProblem || 'Disponível apenas no app instalado pela Google Play.';
  const { store } = cdv();
  await store.restorePurchases();
  const owned = (store.localTransactions ?? []).filter((t: any) =>
    t.purchaseId && t.products?.some((p: any) => p.id === PRO_PRODUCT_ID));
  if (!owned.length) return 'Nenhuma assinatura Pro encontrada nesta conta Google.';
  for (const t of owned) await activate(t);
  return null;
}
