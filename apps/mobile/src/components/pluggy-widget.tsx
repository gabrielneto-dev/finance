import { PluggyConnect } from "react-native-pluggy-connect";

// Widget oficial da Pluggy para React Native (SPEC-0005, REQ-008). Roda numa WebView nativa.
// O OAuth do banco abre no navegador do sistema ou no app do banco (padrão do SDK) e volta pelo
// deep link do Connect Token. Arquivo .web.tsx ao lado substitui este na prévia web.
export type WidgetProps = {
  connectToken: string;
  sandbox: boolean;
  updateItem?: string;
  onSuccess: (itemId: string) => void;
  onError: (message: string, itemId?: string) => void;
  onClose: () => void;
};

export function PluggyWidget({ connectToken, sandbox, updateItem, onSuccess, onError, onClose }: WidgetProps) {
  return (
    <PluggyConnect
      connectToken={connectToken}
      includeSandbox={sandbox}
      connectorIds={sandbox ? [2, 600] : undefined}
      updateItem={updateItem}
      language="pt"
      onSuccess={({ item }) => onSuccess(item.id)}
      onError={(error) => onError(error.message, error.data?.item?.id)}
      onClose={onClose}
    />
  );
}
