import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ProductService } from "../../services/ProductService";
import { OrderService } from "../../services/OrderService";
import { StockSyncService } from "../../services/StockSyncService";
import { Product, Order } from "../../types";
import { dateBR } from "../../utils/dates";
import { Modal, ConfirmDialog } from "../../components/Modal";
import { ProductStatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../hooks/useAuth";

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

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_PRODUCT);
    setModalOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    const { id, status, ...rest } = p;
    setForm(rest);
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

  async function handleDelete() {
    if (!toDelete) return;
    await ProductService.remove(toDelete.id);
    setToDelete(null);
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const occupyingOrders = availabilityProduct
    ? orders.filter(
        (o) =>
          !["cancelado", "devolvido", "finalizado"].includes(o.status) &&
          o.items.some((i) => i.productId === availabilityProduct.id)
      )
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-mist-100">Estoque</h1>
          <p className="text-sm text-mist-500">{products.length} produtos cadastrados</p>
        </div>
        {can("products", "create") && (
          <button className="btn-primary" onClick={openCreate}>
            + Novo produto
          </button>
        )}
      </div>

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
              <p className="text-xl">{availabilityProduct?.totalQuantity}</p>
            </div>
            <div className="card p-3">
              <p className="text-mist-500 text-xs">Disponível</p>
              <p className="text-xl text-success">{availabilityProduct?.availableQuantity}</p>
            </div>
            <div className="card p-3">
              <p className="text-mist-500 text-xs">Comprometido</p>
              <p className="text-xl text-warn">
                {(availabilityProduct?.totalQuantity ?? 0) - (availabilityProduct?.availableQuantity ?? 0)}
              </p>
            </div>
          </div>

          <table className="table-shell">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
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
                  <td colSpan={7} className="text-center text-mist-500 py-6">
                    Nenhum pedido ativo usando este produto — 100% livre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Mover estoque manualmente (disponível/lavanderia/manutenção/indisponível) */}
      <Modal open={Boolean(moveProduct)} onClose={() => setMoveProduct(null)} title={`Mover estoque — ${moveProduct?.name ?? ""}`}>
        {moveProduct && (
          <form onSubmit={handleMove} className="space-y-4">
            <p className="text-xs text-mist-500">
              Use para registrar produto que foi para a lavanderia, para manutenção, ou voltou a ficar disponível. As
              quantidades reservada/em prova/alugada continuam automáticas, vindas dos pedidos.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {(["availableQuantity", "laundryQuantity", "maintenanceQuantity", "unavailableQuantity"] as const).map((k) => (
                <div key={k} className="card p-2 text-center">
                  <p className="text-[10px] text-mist-500">{MOVE_BUCKET_LABELS[k]}</p>
                  <p className="text-lg font-display">{moveProduct[k]}</p>
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
        message={`Tem certeza que deseja excluir "${toDelete?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        danger
      />
    </div>
  );
}
