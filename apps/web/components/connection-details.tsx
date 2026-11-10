import { CreditCard, Landmark, List, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMaskValue } from "@/components/hidden-values";
import { displayDate, money, timestamp } from "@/lib/format";
import type { Account, Bill, Connection } from "@/lib/types";

const productLabels: Record<string, string> = {
  ACCOUNTS: "Contas", CREDIT_CARDS: "Cartões de crédito", TRANSACTIONS: "Transações",
  PAYMENT_DATA: "Dados de pagamentos", INVESTMENTS: "Investimentos",
  INVESTMENTS_TRANSACTIONS: "Movimentações de investimentos", IDENTITY: "Dados cadastrais",
  BROKERAGE_NOTE: "Notas de corretagem", MOVE_SECURITY: "Transferência de custódia", LOANS: "Operações de crédito",
};
const cardStatuses: Record<string, string> = { ACTIVE: "Ativo", BLOCKED: "Bloqueado", CANCELLED: "Cancelado" };
const holderTypes: Record<string, string> = { MAIN: "Principal", ADDITIONAL: "Adicional" };
const bankTypes: Record<string, string> = { CHECKING_ACCOUNT: "Conta corrente", SAVINGS_ACCOUNT: "Poupança", PAYMENT_ACCOUNT: "Conta de pagamento" };

function Fields({ fields }: { fields: [string, string | null | undefined][] }) {
  const available = fields.filter(([, value]) => value != null);
  if (!available.length) return null;
  return <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-x-4 gap-y-2 text-sm">
    {available.map(([label, value]) => <div key={label}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>)}
  </dl>;
}

function Products({ title, values }: { title: string; values: string[] }) {
  return <div className="grid gap-1">
    <p className="text-xs text-muted-foreground">{title}</p>
    <div className="flex flex-wrap gap-1.5">
      {values.length ? values.map((code) => <Badge key={code} variant="outline">
        {Object.hasOwn(productLabels, code) ? productLabels[code] : code.replaceAll("_", " ")}
      </Badge>) : <span className="text-sm text-muted-foreground">Nenhum produto informado.</span>}
    </div>
  </div>;
}

function AccountDetails({ account, billCount, onLedger, onCard, onBills }: {
  account: Account; billCount: number;
  onLedger: () => void; onCard: () => void; onBills: () => void;
}) {
  const { bank, credit } = account;
  const isCard = account.type === "CREDIT";
  const mask = useMaskValue();
  const format = (value?: number | null) => value == null ? null : mask(money(value, account.currency));
  const Icon = isCard ? CreditCard : Landmark;
  return <article className="grid gap-3 rounded-lg border bg-card p-3">
    <div className="flex min-w-0 items-start gap-2">
      <span className="panel-symbol"><Icon size={16} aria-hidden="true" /></span>
      <div className="min-w-0">
        <h4 className="break-words text-sm font-semibold">{account.name}</h4>
        <p className="text-xs text-muted-foreground">
          {isCard ? "Cartão de crédito" : bankTypes[account.subtype ?? ""] ?? "Conta bancária"}
          {account.last4 ? " · Final " + account.last4 : ""}
        </p>
      </div>
    </div>
    <Fields fields={[
      ["Moeda", account.currency],
      [isCard ? "Saldo do cartão" : "Saldo disponível", format(account.balance)],
      ["Saldo contábil", format(bank?.closingBalance)],
      ["Aplicação automática", format(bank?.investedBalance)],
      ["Cheque especial contratado", format(bank?.overdraftLimit)],
      ["Cheque especial utilizado", format(bank?.overdraftUsed)],
      ["Adiantamento a depositante", format(bank?.unarrangedOverdraft)],
      ["Bandeira", credit?.brand], ["Categoria do cartão", credit?.level],
      ["Situação do cartão", credit?.status && (cardStatuses[credit.status] ?? credit.status)],
      ["Modalidade", credit?.holderType && (holderTypes[credit.holderType] ?? credit.holderType)],
      ["Limite total", format(credit?.limit)], ["Limite disponível", format(credit?.availableLimit)],
      ["Pagamento mínimo", format(credit?.minimumPayment)],
      ["Saldo em dólares", credit?.foreignBalance == null ? null : mask(money(credit.foreignBalance, "USD"))],
      ["Fechamento", account.closes && displayDate(account.closes)],
      ["Vencimento", account.due && displayDate(account.due)],
    ]} />
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={onLedger}><List /> Ver extrato</Button>
      {isCard && <Button size="sm" variant="outline" onClick={onCard}>Ver cartão</Button>}
      {isCard && <Button size="sm" variant="outline" onClick={onBills}><ReceiptText /> Faturas ({billCount})</Button>}
    </div>
  </article>;
}

export function ConnectionDetails({ connection, accounts, bills, onOpen }: {
  connection: Connection; accounts: Account[]; bills: Bill[];
  onOpen: (target: "ledger" | "cards" | "bills", account: Account) => void;
}) {
  const { details } = connection;
  const imported = accounts.filter((account) => account.itemId === connection.id);
  const groups = [
    { type: "BANK", title: "Contas bancárias", empty: "Nenhuma conta bancária importada." },
    { type: "CREDIT", title: "Cartões de crédito", empty: "Nenhum cartão de crédito importado." },
  ];
  return <div className="mb-3 grid gap-4 rounded-lg border bg-secondary/30 p-3 sm:p-4">
    <Fields fields={[
      ["Conectada desde", details?.createdAt && timestamp(details.createdAt)],
      ["Consentimento válido até", details?.consentExpiresAt && timestamp(details.consentExpiresAt)],
      ["Próxima atualização automática", details?.nextAutoSyncAt && timestamp(details.nextAutoSyncAt)],
    ]} />
    {details?.connectorProducts && <Products title="Produtos que o conector oferece" values={details.connectorProducts} />}
    {details?.products && <Products title="Produtos configurados para esta conexão" values={details.products} />}
    <div className="grid gap-2">
      <h3 className="text-sm font-semibold">Dados importados no Finance</h3>
      <p className="text-xs text-muted-foreground">
        O Finance importa contas, cartões, movimentações e faturas. Os campos exibidos dependem dos dados enviados pela instituição.
      </p>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {groups.map(({ type, title, empty }) => {
          const rows = imported.filter((account) => account.type === type);
          return <section key={type} aria-label={title} className="grid min-w-0 gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{title}</p><Badge variant="secondary">{rows.length}</Badge>
            </div>
            {rows.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
            {rows.map((account) => <AccountDetails key={account.id} account={account}
              billCount={bills.filter((bill) => bill.itemId === connection.id && bill.accountId === account.id).length}
              onLedger={() => onOpen("ledger", account)} onCard={() => onOpen("cards", account)} onBills={() => onOpen("bills", account)} />)}
          </section>;
        })}
      </div>
    </div>
  </div>;
}
