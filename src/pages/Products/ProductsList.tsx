import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ProductService } from "../../services/ProductService";
import { OrderService } from "../../services/OrderService";
import { StockSyncService } from "../../services/StockSyncService";
import { Product, Order, CLIENT_CATEGORY_LABELS } from "../../types";
import { effectiveItemComponents } from "../../utils/components";
import { dateBR } from "../../utils/dates";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { ProductStatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../hooks/useAuth";
import { exportTableExcel, importExcelFile, ExportColumn } from "../../services/ExportService";

const EXCEL_COLUMNS: ExportColumn[] = [
  { key: "name", label: "Nome" },
  { key: "internalCode", label: "Código" },
  { key: "productType", label: "Tipo" },
  { key: "category", label: "Categoria" },
  { key: "subcategory", label: "Subcategoria" },
  { key: "brand", label: "Marca" },
  { key: "color", label: "Cor" },
  { key: "size", label: "Tamanho" },
  { key: "gender", label: "Gênero" },
  { key: "material", label: "Material" },
  { key: "supplier", label: "Fornecedor" },
  { key: "costValue", label: "Valor de custo" },
  { key: "rentValue", label: "Valor de locação" },
  { key: "saleValue", label: "Valor de venda" },
  { key: "totalQuantity", label: "Quantidade total" },
  { key: "componentNames", label: "Componentes (separados por vírgula)" },
  { key: "notes", label: "Observações" },
];

interface ImportRow {
  code: string;
  name: string;
  data: Partial<Product>;
  action: "create" | "update";
  existingId?: string;
  error?: string;
  qtyNote?: string;
}

const EMPTY_PRODUCT: Omit<Product, "id" | "status"> = {
  productType: "",
  category: "",
  subcategory: "",
  name: "",
  internalCode: "",
  barcode: "",
  qrCode: "",
  brand: "",
  color: "",
  size: "",
  gender: "",
  material: "",
  supplier: "",
  costValue: 0,
  rentValue: 0,
  saleValue: 0,
  purchaseDate: "",
  notes: "",
  photoUrl: "",
  componentNames: [],
  totalQuantity: 1,
  availableQuantity: 1,
  reservedQuantity: 0,
  fittingQuantity: 0,
  rentedQuantity: 0,
  laundryQuantity: 0,
  maintenanceQuantity: 0,
  unavailableQuantity: 0,
};

export default function ProductsList() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchParams] = useSearchParams();
  const [term, setTerm] = useState(searchParams.get("buscar") || "");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, "id" | "status">>(EMPTY_PRODUCT);
  const [newComponentName, setNewComponentName] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [availabilityProduct, setAvailabilityProduct] = useState<Product | null>(null);
  const [moveProduct, setMoveProduct] = useState<Product | null>(null);
  const [moveFrom, setMoveFrom] = useState<"availableQuantity" | "laundryQuantity" | "maintenanceQuantity" | "unavailableQuantity">(
    "availableQuantity"
  );
  const [moveTo, setMoveTo] = useState<"availableQuantity" | "laundryQuantity" | "maintenanceQuantity" | "unavailableQuantity">(
    "laundryQuantity"
  );
  const [moveQty, setMoveQty] = useState(1);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveSaving, setMoveSaving] = useState(false);

  const MOVE_BUCKET_LABELS: Record<string, string> = {
    availableQuantity: "Disponível",
    laundryQuantity: "Lavanderia",
    maintenanceQuantity: "Manutenção",
    unavailableQuantity: "Indisponível",
  };

  useEffect(() => ProductService.subscribeAll(setProducts), []);
  useEffect(() => OrderService.subscribeAll(setOrders), []);

  const filtered = useMemo(() => ProductService.search(products, term), [products, term]);
  const liveMoveProduct = useMemo(
    () => (moveProduct ? products.find((p) => p.id === moveProduct.id) || moveProduct : null),
    [products, moveProduct]
  );
  const liveAvailabilityProduct = useMemo(
    () => (availabilityProduct ? products.find((p) => p.id === availabilityProduct.id) || availabilityProduct : null),
    [products, availabilityProduct]
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_PRODUCT);
    setNewComponentName("");
    setModalOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    const { id, status, ...rest } = p;
    setForm(rest);
    setNewComponentName("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let productId: string;
      if (editing) {
        await ProductService.update(editing.id, form);
        productId = editing.id;
      } else {
        // Produto novo: ainda não há pedido nenhum usando ele, então a
        // quantidade disponível começa igual à quantidade total informada.
        productId = await ProductService.create({ ...form, availableQuantity: form.totalQuantity });
      }
      // Garante que reservado/em prova/alugado/disponível reflitam a
      // realidade imediatamente, mesmo que total/manutenção/lavanderia
      // tenham sido alterados agora.
      await StockSyncService.recomputeForProduct(productId);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function openMove(p: Product) {
    setMoveProduct(p);
    setMoveFrom("availableQuantity");
    setMoveTo("laundryQuantity");
    setMoveQty(1);
    setMoveError(null);
  }

  async function handleMove(e: React.FormEvent) {
    e.preventDefault();
    if (!moveProduct) return;
    if (moveFrom === moveTo) {
      setMoveError("Origem e destino precisam ser diferentes.");
      return;
    }
    setMoveSaving(true);
    setMoveError(null);
    try {
      await ProductService.moveQuantity(moveProduct.id, moveFrom, moveTo, moveQty);
      setMoveProduct(null);
    } catch (err: any) {
      setMoveError(err.message || "Erro ao mover estoque.");
    } finally {
      setMoveSaving(false);
    }
  }

  const productInUseCount = toDelete
    ? orders.filter((o) => !["cancelado", "devolvido", "finalizado"].includes(o.status) && o.items.some((i) => i.productId === toDelete.id))
        .length
    : 0;

  async function handleDelete() {
    if (!toDelete) return;
    await ProductService.remove(toDelete.id);
    setToDelete(null);
  }

  function handleExportExcel() {
    const rows = filtered.map((p) => ({
      name: p.name,
      internalCode: p.internalCode,
      productType: p.productType,
      category: p.category,
      subcategory: p.subcategory || "",
      brand: p.brand || "",
      color: p.color || "",
      size: p.size || "",
      gender: p.gender || "",
      material: p.material || "",
      supplier: p.supplier || "",
      costValue: p.costValue,
      rentValue: p.rentValue,
      saleValue: p.saleValue,
      totalQuantity: p.totalQuantity,
      componentNames: (p.componentNames || []).join(", "),
      notes: p.notes || "",
    }));
    exportTableExcel(`estoque-diamond-sect-${new Date().toISOString().slice(0, 10)}.xlsx`, "Estoque", EXCEL_COLUMNS, rows);
  }

  function cell(row: Record<string, any>, ...keys: string[]) {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== "") return String(row[k]).trim();
    }
    return "";
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;
    setImportError(null);
    setImporting(true);
    try {
      const rawRows = await importExcelFile(file);
      if (rawRows.length === 0) {
        setImportError("A planilha está vazia ou não foi possível ler nenhuma linha.");
        setImporting(false);
        return;
      }
      const parsed: ImportRow[] = rawRows.map((row) => {
        const code = cell(row, "Código", "Codigo", "internalCode");
        const name = cell(row, "Nome", "name");
        if (!code || !name) {
          return { code: code || "—", name: name || "—", data: {}, action: "create", error: "Faltando Nome ou Código nesta linha — não será importada." };
        }
        const existing = products.find((p) => p.internalCode.toLowerCase() === code.toLowerCase());
        const componentsRaw = cell(row, "Componentes (separados por vírgula)", "Componentes", "componentNames");
        const componentNames = componentsRaw
          ? componentsRaw.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined;

        const toNumber = (v: any) => {
          const n = Number(String(v).replace(",", "."));
          return Number.isFinite(n) ? n : undefined;
        };

        if (existing) {
          // Atualização: dados descritivos e de preço sempre atualizam. A
          // quantidade também, se vier na planilha — mas com cuidado: só
          // ajusta o "disponível" pela diferença, sem tocar no que já está
          // reservado/em prova/alugado, para não bagunçar pedidos em
          // andamento (ex.: tinha 3, planilha diz 5 → ganha +2 disponíveis;
          // tinha 5, planilha diz 3 → perde 2 disponíveis, nunca mexe no
          // que já está comprometido).
          const data: Partial<Product> = {
            name,
            productType: cell(row, "Tipo", "productType") || existing.productType,
            category: cell(row, "Categoria", "category") || existing.category,
            subcategory: cell(row, "Subcategoria", "subcategory") || existing.subcategory,
            brand: cell(row, "Marca", "brand") || existing.brand,
            color: cell(row, "Cor", "color") || existing.color,
            size: cell(row, "Tamanho", "size") || existing.size,
            gender: cell(row, "Gênero", "Genero", "gender") || existing.gender,
            material: cell(row, "Material", "material") || existing.material,
            supplier: cell(row, "Fornecedor", "supplier") || existing.supplier,
            notes: cell(row, "Observações", "Observacoes", "notes") || existing.notes,
          };
          const cost = toNumber(cell(row, "Valor de custo", "costValue"));
          const rent = toNumber(cell(row, "Valor de locação", "Valor de locacao", "rentValue"));
          const sale = toNumber(cell(row, "Valor de venda", "saleValue"));
          if (cost !== undefined) data.costValue = cost;
          if (rent !== undefined) data.rentValue = rent;
          if (sale !== undefined) data.saleValue = sale;
          if (componentNames) data.componentNames = componentNames;

          let qtyNote: string | undefined;
          const newTotal = toNumber(cell(row, "Quantidade total", "totalQuantity"));
          if (newTotal !== undefined && newTotal !== existing.totalQuantity) {
            const delta = newTotal - existing.totalQuantity;
            data.totalQuantity = newTotal;
            data.availableQuantity = Math.max((existing.availableQuantity || 0) + delta, 0);
            qtyNote = `Quantidade: ${existing.totalQuantity} → ${newTotal} (${delta > 0 ? "+" : ""}${delta} no disponível)`;
          }
          return { code, name, data, action: "update", existingId: existing.id, qtyNote };
        }

        const total = toNumber(cell(row, "Quantidade total", "totalQuantity")) ?? 1;
        const data: Partial<Product> = {
          name,
          internalCode: code,
          productType: cell(row, "Tipo", "productType"),
          category: cell(row, "Categoria", "category"),
          subcategory: cell(row, "Subcategoria", "subcategory"),
          brand: cell(row, "Marca", "brand"),
          color: cell(row, "Cor", "color"),
          size: cell(row, "Tamanho", "size"),
          gender: cell(row, "Gênero", "Genero", "gender"),
          material: cell(row, "Material", "material"),
          supplier: cell(row, "Fornecedor", "supplier"),
          notes: cell(row, "Observações", "Observacoes", "notes"),
          costValue: toNumber(cell(row, "Valor de custo", "costValue")) || 0,
          rentValue: toNumber(cell(row, "Valor de locação", "Valor de locacao", "rentValue")) || 0,
          saleValue: toNumber(cell(row, "Valor de venda", "saleValue")) || 0,
          totalQuantity: total,
          ...(componentNames ? { componentNames } : {}),
        };
        return { code, name, data, action: "create" };
      });
      setImportRows(parsed);
    } catch (err: any) {
      setImportError(err.message || "Não foi possível ler esse arquivo. Confirme que é um .xlsx, .xls ou .csv válido.");
    } finally {
      setImporting(false);
    }
  }

  async function handleConfirmImport() {
    if (!importRows) return;
    setImporting(true);
    try {
      for (const row of importRows) {
        if (row.error) continue;
        if (row.action === "update" && row.existingId) {
          await ProductService.update(row.existingId, row.data);
        } else if (row.action === "create") {
          await ProductService.create(row.data as Omit<Product, "id" | "createdAt" | "updatedAt" | "status">);
        }
      }
      setImportRows(null);
    } catch (err: any) {
      setImportError(err.message || "Erro ao importar. Nenhuma linha restante foi processada.");
    } finally {
      setImporting(false);
    }
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addComponentName() {
    const name = newComponentName.trim();
    if (!name) return;
    const current = form.componentNames || [];
    if (current.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setNewComponentName("");
      return;
    }
    update("componentNames", [...current, name]);
    setNewComponentName("");
  }

  function removeComponentName(name: string) {
    update("componentNames", (form.componentNames || []).filter((c) => c !== name));
  }

  const occupyingOrders = availabilityProduct
    ? orders.filter(
        (o) =>
          !["cancelado", "devolvido", "finalizado"].includes(o.status) &&
          o.items.some((i) => i.productId === availabilityProduct.id)
      )
    : [];

  // Disponibilidade por componente (ex.: paletó/calça/colete de um terno) —
  // um componente fica indisponível se QUALQUER pedido ativo (não importa
  // qual) já tiver reservado ele, independente da quantidade do produto.
  const componentAvailability = useMemo(() => {
    if (!liveAvailabilityProduct?.componentNames || liveAvailabilityProduct.componentNames.length === 0) return null;
    const busy = new Set<string>();
    occupyingOrders.forEach((o) => {
      const item = o.items.find((i) => i.productId === liveAvailabilityProduct.id);
      if (!item) return;
      const comps = effectiveItemComponents(item, liveAvailabilityProduct);
      comps?.forEach((c) => busy.add(c));
    });
    return liveAvailabilityProduct.componentNames.map((name) => ({ name, available: !busy.has(name) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveAvailabilityProduct, occupyingOrders.length, orders]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Estoque</h1>
          <p className="text-sm text-mist-500">{products.length} produtos cadastrados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={handleExportExcel}>
            Exportar Excel
          </button>
          {can("products", "create") && (
            <>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelected} />
              <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? "Lendo..." : "Importar Excel"}
              </button>
              <button className="btn-primary" onClick={openCreate}>
                + Novo produto
              </button>
            </>
          )}
        </div>
      </div>

      {importError && (
        <div className="card p-3 border-danger/50">
          <p className="text-sm text-danger">{importError}</p>
        </div>
      )}

      <input
        className="max-w-lg"
        placeholder="Buscar por nome, código, marca, cor, categoria, status..."
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th></th>
              <th>Produto</th>
              <th>Código</th>
              <th>Categoria</th>
              <th>Disponível</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <button
                    title="Ver disponibilidade"
                    className="w-6 h-6 rounded-full bg-diamond/10 text-diamond text-xs"
                    onClick={() => setAvailabilityProduct(p)}
                  >
                    ●
                  </button>
                </td>
                <td className="text-mist-100 font-medium">
                  {p.name}
                  <div className="text-xs text-mist-500">{p.brand}</div>
                  {p.componentNames && p.componentNames.length > 0 && (
                    <div className="text-[10px] text-diamond mt-0.5">Por peça: {p.componentNames.join(", ")}</div>
                  )}
                </td>
                <td>{p.internalCode}</td>
                <td>
                  {p.category}
                  {p.subcategory ? ` / ${p.subcategory}` : ""}
                </td>
                <td>
                  {p.availableQuantity}/{p.totalQuantity}
                </td>
                <td>
                  <ProductStatusBadge status={p.status} />
                </td>
                <td className="flex gap-2 justify-end">
                  {can("products", "edit") && (
                    <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openMove(p)}>
                      Mover estoque
                    </button>
                  )}
                  {can("products", "edit") && (
                    <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => openEdit(p)}>
                      Editar
                    </button>
                  )}
                  {can("products", "delete") && (
                    <button className="btn-ghost !px-2 !py-1 text-xs text-danger" onClick={() => setToDelete(p)}>
                      Excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-mist-500 py-8">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Formulário de produto */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar produto" : "Novo produto"} wide>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label>Nome do produto *</label>
            <input required value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <label>Código interno *</label>
            <input required value={form.internalCode} onChange={(e) => update("internalCode", e.target.value)} />
          </div>

          <div>
            <label>Tipo do produto</label>
            <input value={form.productType} onChange={(e) => update("productType", e.target.value)} />
          </div>
          <div>
            <label>Categoria</label>
            <input value={form.category} onChange={(e) => update("category", e.target.value)} />
          </div>
          <div>
            <label>Subcategoria</label>
            <input value={form.subcategory} onChange={(e) => update("subcategory", e.target.value)} />
          </div>

          <div className="md:col-span-3">
            <label>Componentes do produto (opcional)</label>
            <div className="flex gap-2">
              <input
                value={newComponentName}
                onChange={(e) => setNewComponentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addComponentName();
                  }
                }}
                placeholder="Ex: Paletó"
              />
              <button type="button" className="btn-secondary shrink-0" onClick={addComponentName}>
                + Adicionar
              </button>
            </div>

            {form.componentNames && form.componentNames.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.componentNames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 bg-diamond/10 text-diamond border border-diamond/30 rounded-full px-3 py-1 text-xs"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => removeComponentName(name)}
                      className="text-diamond hover:text-danger font-bold leading-none"
                      title="Remover"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 mt-1.5">
              <p className="text-[11px] text-mist-500">
                Deixe vazio para um produto simples. Preenchido, cada componente pode ser locado separadamente,
                com disponibilidade própria.
              </p>
              <button
                type="button"
                className="btn-ghost !px-2 !py-1 text-[11px] shrink-0"
                onClick={() => update("componentNames", ["Paletó", "Calça", "Colete"])}
              >
                Preencher: Terno
              </button>
            </div>
          </div>

          <div>
            <label>Código de barras</label>
            <input value={form.barcode} onChange={(e) => update("barcode", e.target.value)} />
          </div>
          <div>
            <label>QR Code</label>
            <input value={form.qrCode} onChange={(e) => update("qrCode", e.target.value)} />
          </div>
          <div>
            <label>Marca</label>
            <input value={form.brand} onChange={(e) => update("brand", e.target.value)} />
          </div>

          <div>
            <label>Cor</label>
            <input value={form.color} onChange={(e) => update("color", e.target.value)} />
          </div>
          <div>
            <label>Tamanho</label>
            <input value={form.size} onChange={(e) => update("size", e.target.value)} />
          </div>
          <div>
            <label>Sexo</label>
            <input value={form.gender} onChange={(e) => update("gender", e.target.value)} />
          </div>

          <div>
            <label>Material</label>
            <input value={form.material} onChange={(e) => update("material", e.target.value)} />
          </div>
          <div>
            <label>Fornecedor</label>
            <input value={form.supplier} onChange={(e) => update("supplier", e.target.value)} />
          </div>
          <div>
            <label>Data de compra</label>
            <input type="date" value={form.purchaseDate} onChange={(e) => update("purchaseDate", e.target.value)} />
          </div>

          <div>
            <label>Valor de custo (R$)</label>
            <input type="number" step="0.01" value={form.costValue || ""} onChange={(e) => update("costValue", Number(e.target.value))} placeholder="0" />
          </div>
          <div>
            <label>Valor de aluguel (R$)</label>
            <input type="number" step="0.01" value={form.rentValue || ""} onChange={(e) => update("rentValue", Number(e.target.value))} placeholder="0" />
          </div>
          <div>
            <label>Valor de venda (R$)</label>
            <input type="number" step="0.01" value={form.saleValue || ""} onChange={(e) => update("saleValue", Number(e.target.value))} placeholder="0" />
          </div>

          <div>
            <label>Quantidade total *</label>
            <input
              type="number"
              min={0}
              required
              value={form.totalQuantity}
              onChange={(e) => update("totalQuantity", Number(e.target.value))}
            />
          </div>
          <div>
            <label>Quantidade disponível</label>
            <input type="number" value={editing ? form.availableQuantity : form.totalQuantity} disabled className="opacity-60" />
            <p className="text-[11px] text-mist-700 mt-1">
              Calculada automaticamente a partir dos pedidos ativos — não é editável diretamente.
            </p>
          </div>
          <div>
            <label>URL da foto (opcional)</label>
            <input value={form.photoUrl} onChange={(e) => update("photoUrl", e.target.value)} placeholder="https://..." />
          </div>

          <div className="md:col-span-3">
            <label>Observações</label>
            <textarea rows={3} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
          </div>

          <div className="md:col-span-3 flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar produto"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Painel de disponibilidade */}
      <Modal
        open={Boolean(availabilityProduct)}
        onClose={() => setAvailabilityProduct(null)}
        title={`Disponibilidade — ${availabilityProduct?.name ?? ""}`}
        wide
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="card p-3">
              <p className="text-mist-500 text-xs">Total</p>
              <p className="text-xl">{liveAvailabilityProduct?.totalQuantity}</p>
            </div>
            <div className="card p-3">
              <p className="text-mist-500 text-xs">Disponível</p>
              <p className="text-xl text-success">{liveAvailabilityProduct?.availableQuantity}</p>
            </div>
            <div className="card p-3">
              <p className="text-mist-500 text-xs">Comprometido</p>
              <p className="text-xl text-warn">
                {(liveAvailabilityProduct?.totalQuantity ?? 0) - (liveAvailabilityProduct?.availableQuantity ?? 0)}
              </p>
            </div>
          </div>

          {componentAvailability && (
            <div className="card p-3 space-y-2">
              <p className="text-mist-500 text-xs">Disponibilidade por componente</p>
              <div className="flex flex-wrap gap-3">
                {componentAvailability.map((c) => (
                  <div key={c.name} className="flex items-center gap-1.5 text-sm">
                    <span>{c.available ? "🟢" : "🔴"}</span>
                    <span>{c.name}</span>
                    <span className={c.available ? "text-success" : "text-danger"}>
                      {c.available ? "Disponível" : "Locado/Reservado"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Categoria</th>
                {componentAvailability && <th>Componentes</th>}
                <th>Qtd.</th>
                <th>Prova</th>
                <th>Retirada</th>
                <th>Devolução</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {occupyingOrders.map((o) => {
                const item = o.items.find((i) => i.productId === availabilityProduct?.id)!;
                return (
                  <tr
                    key={o.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setAvailabilityProduct(null);
                      navigate(`/pedidos?buscar=${o.orderNumber}`);
                    }}
                  >
                    <td className="text-diamond">{o.orderNumber}</td>
                    <td>{o.clientName}</td>
                    <td>
                      {o.clientCategory ? CLIENT_CATEGORY_LABELS[o.clientCategory] : "—"}
                      {o.clientCategoryNotes && (
                        <p className="text-[11px] text-mist-500 mt-0.5 max-w-[160px] whitespace-normal">
                          {o.clientCategoryNotes}
                        </p>
                      )}
                    </td>
                    {componentAvailability && (
                      <td>{effectiveItemComponents(item, liveAvailabilityProduct)?.join(", ") || "—"}</td>
                    )}
                    <td>{item.quantity}</td>
                    <td>{dateBR(o.fittingDate)}</td>
                    <td>{dateBR(o.pickupDate)}</td>
                    <td>{dateBR(o.returnDate)}</td>
                    <td>{o.status}</td>
                  </tr>
                );
              })}
              {occupyingOrders.length === 0 && (
                <tr>
                  <td colSpan={componentAvailability ? 9 : 8} className="text-center text-mist-500 py-6">
                    Nenhum pedido ativo usando este produto — 100% livre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </Modal>

      {/* Mover estoque manualmente (disponível/lavanderia/manutenção/indisponível) */}
      <Modal open={Boolean(moveProduct)} onClose={() => setMoveProduct(null)} title={`Mover estoque — ${moveProduct?.name ?? ""}`}>
        {liveMoveProduct && (
          <form onSubmit={handleMove} className="space-y-4">
            <p className="text-xs text-mist-500">
              Use para registrar produto que foi para a lavanderia, para manutenção, ou voltou a ficar disponível. As
              quantidades reservada/em prova/alugada continuam automáticas, vindas dos pedidos.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {(["availableQuantity", "laundryQuantity", "maintenanceQuantity", "unavailableQuantity"] as const).map((k) => (
                <div key={k} className="card p-2 text-center">
                  <p className="text-[10px] text-mist-500">{MOVE_BUCKET_LABELS[k]}</p>
                  <p className="text-lg font-display">{liveMoveProduct[k]}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label>De</label>
                <select value={moveFrom} onChange={(e) => setMoveFrom(e.target.value as any)}>
                  {Object.entries(MOVE_BUCKET_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Para</label>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value as any)}>
                  {Object.entries(MOVE_BUCKET_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label>Quantidade</label>
              <input type="number" min={1} value={moveQty} onChange={(e) => setMoveQty(Number(e.target.value))} />
            </div>
            {moveError && <p className="text-sm text-danger">{moveError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setMoveProduct(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={moveSaving}>
                {moveSaving ? "Movendo..." : "Mover"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir produto"
        message={
          productInUseCount > 0
            ? `Atenção: "${toDelete?.name}" está em ${productInUseCount} pedido(s) ativo(s) no momento. Excluir mesmo assim pode deixar esses pedidos com uma peça "fantasma". Tem certeza?`
            : `Tem certeza que deseja excluir "${toDelete?.name}"?`
        }
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        danger
      />

      {/* Prévia da importação — nada é salvo até confirmar aqui */}
      <Modal open={Boolean(importRows)} onClose={() => setImportRows(null)} title="Conferir importação" wide>
        {importRows && (
          <div className="space-y-4">
            <p className="text-sm text-mist-500">
              {importRows.filter((r) => r.action === "create" && !r.error).length} produto(s) novo(s) serão criados ·{" "}
              {importRows.filter((r) => r.action === "update" && !r.error).length} produto(s) existente(s) (mesmo código)
              serão atualizados
              {importRows.some((r) => r.error) && (
                <> · <span className="text-danger">{importRows.filter((r) => r.error).length} linha(s) com problema, não serão importadas</span></>
              )}
            </p>
            <div className="overflow-x-auto max-h-80">
              <table className="table-shell">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Ação</th>
                    <th>Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((r, idx) => (
                    <tr key={idx}>
                      <td>{r.code}</td>
                      <td>{r.name}</td>
                      <td>
                        {r.error ? (
                          <span className="text-danger">{r.error}</span>
                        ) : r.action === "update" ? (
                          <span className="text-warn">Atualizar produto existente</span>
                        ) : (
                          <span className="text-success">Criar produto novo</span>
                        )}
                      </td>
                      <td className="text-mist-300">
                        {r.action === "create" ? `${r.data.totalQuantity ?? 1} (novo)` : r.qtyNote || "sem mudança"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-mist-500">
              Em produtos já existentes (código igual), a quantidade da planilha também é aplicada — mas só ajusta
              o <b>disponível</b> pela diferença, sem tocar no que já está reservado, em prova ou alugado (assim
              nenhum pedido em andamento é afetado). Para mover estoque entre disponível/lavanderia/manutenção, use
              "Mover estoque".
            </p>
            {importError && <p className="text-sm text-danger">{importError}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setImportRows(null)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleConfirmImport} disabled={importing}>
                {importing ? "Importando..." : "Confirmar importação"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
