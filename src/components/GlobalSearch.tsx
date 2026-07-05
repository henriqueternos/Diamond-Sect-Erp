import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClientService } from "../services/ClientService";
import { ProductService } from "../services/ProductService";
import { OrderService } from "../services/OrderService";
import { Client, Order, Product } from "../types";

export function GlobalSearch() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => ClientService.subscribeAll(setClients), []);
  useEffect(() => ProductService.subscribeAll(setProducts), []);
  useEffect(() => OrderService.subscribeAll(setOrders), []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const results = useMemo(() => {
    if (term.trim().length < 2) return { clients: [], products: [], orders: [] };
    return {
      clients: ClientService.search(clients, term).slice(0, 5),
      products: ProductService.search(products, term).slice(0, 5),
      orders: OrderService.search(orders, term).slice(0, 5),
    };
  }, [term, clients, products, orders]);

  const hasResults = results.clients.length + results.products.length + results.orders.length > 0;

  function go(path: string) {
    setOpen(false);
    setTerm("");
    navigate(path);
  }

  return (
    <div ref={boxRef} className="relative max-w-md w-full min-w-0 flex-1">
      <input
        placeholder="Pesquisar cliente, pedido, produto..."
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && term.trim().length >= 2 && (
        <div className="absolute top-full mt-1 left-0 right-0 card p-2 max-h-96 overflow-y-auto z-40 shadow-xl">
          {!hasResults && <p className="text-xs text-mist-500 px-2 py-2">Nenhum resultado para "{term}".</p>}

          {results.clients.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wide text-mist-700 px-2 mb-1">Clientes</p>
              {results.clients.map((c) => (
                <button
                  key={c.id}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-ink-700 text-sm"
                  onClick={() => go(`/clientes?buscar=${encodeURIComponent(c.fullName)}`)}
                >
                  {c.fullName} <span className="text-mist-500 text-xs">— {c.cpf}</span>
                </button>
              ))}
            </div>
          )}

          {results.products.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wide text-mist-700 px-2 mb-1">Produtos</p>
              {results.products.map((p) => (
                <button
                  key={p.id}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-ink-700 text-sm"
                  onClick={() => go(`/estoque?buscar=${encodeURIComponent(p.internalCode)}`)}
                >
                  {p.name} <span className="text-mist-500 text-xs">— {p.internalCode}</span>
                </button>
              ))}
            </div>
          )}

          {results.orders.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-mist-700 px-2 mb-1">Pedidos</p>
              {results.orders.map((o) => (
                <button
                  key={o.id}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-ink-700 text-sm"
                  onClick={() => go(`/pedidos?buscar=${o.orderNumber}`)}
                >
                  {o.orderNumber} <span className="text-mist-500 text-xs">— {o.clientName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
