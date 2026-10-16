import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MoveRight } from 'lucide-react';
import { ProductsAPI } from '../lib/api';
import { Product } from '../types/product';
import { Button } from '../components/ui/button';
import { Card, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';

type FormState = Partial<Product>;

const defaultForm: FormState = {
  name: '',
  sku: '',
  category: '',
  quantity: 0,
  minQuantity: 0,
  unitPrice: 0,
  location: '',
};

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [moveNote, setMoveNote] = useState('');
  const [moveQty, setMoveQty] = useState(1);
  const [moveType, setMoveType] = useState<'IN' | 'OUT'>('IN');

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.sku.toLowerCase().includes(lower) ||
        (p.category || '').toLowerCase().includes(lower),
    );
  }, [products, search]);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    const res = await ProductsAPI.list({ page: 1, pageSize: 50, search });
    setProducts(res.items);
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingId(product.id);
      setForm(product);
    } else {
      setEditingId(null);
      setForm(defaultForm);
    }
    setOpen(true);
  };

  const save = async () => {
    if (editingId) {
      await ProductsAPI.update(editingId, form);
    } else {
      await ProductsAPI.create(form);
    }
    setOpen(false);
    refresh();
  };

  const move = async (productId: string) => {
    await ProductsAPI.move(productId, { type: moveType, qty: moveQty, note: moveNote });
    setMoveNote('');
    setMoveQty(1);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Produits</h1>
          <p className="text-sm text-slate-400">CRUD + mouvements en temps réel.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus size={16} className="mr-2" />
              Nouveau produit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Modifier' : 'Créer'} un produit</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Input
                placeholder="Nom"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                placeholder="SKU"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
              <Input
                placeholder="Catégorie"
                value={form.category ?? ''}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <Input
                placeholder="Emplacement"
                value={form.location ?? ''}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              <Input
                placeholder="Quantité"
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              />
              <Input
                placeholder="Min qty"
                type="number"
                value={form.minQuantity}
                onChange={(e) => setForm({ ...form, minQuantity: Number(e.target.value) })}
              />
              <Input
                placeholder="Prix unitaire (€)"
                type="number"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })}
              />
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={save}>{editingId ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardTitle className="mb-3 flex items-center justify-between">
          <span>Liste des produits</span>
          <Input
            placeholder="Recherche"
            className="max-w-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={refresh}
          />
        </CardTitle>
        <Table>
          <THead>
            <TR>
              <TH>Nom</TH>
              <TH>SKU</TH>
              <TH>Stock</TH>
              <TH>Prix</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((p) => (
              <TR key={p.id}>
                <TD>
                  <Link to={`/products/${p.id}`} className="text-sky-200 hover:underline">
                    {p.name}
                  </Link>
                  <div className="text-xs text-slate-500">{p.category || '—'}</div>
                </TD>
                <TD className="text-slate-400">{p.sku}</TD>
                <TD>
                  <Badge variant={p.quantity <= p.minQuantity ? 'warning' : 'default'}>
                    {p.quantity} u.
                  </Badge>
                </TD>
                <TD>{p.unitPrice} €</TD>
                <TD className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => openModal(p)}>
                    Éditer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => move(p.id)}
                    title="Enregistrer un mouvement"
                  >
                    <MoveRight size={14} />
                  </Button>
                </TD>
              </TR>
            ))}
            {!filtered.length && (
              <TR>
                <TD colSpan={5} className="text-center text-slate-500">
                  Aucun produit.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-sm text-slate-300">Note mouvement (optionnel)</label>
            <Textarea
              placeholder="Réception fournisseur..."
              value={moveNote}
              onChange={(e) => setMoveNote(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Quantité</label>
            <Input
              type="number"
              value={moveQty}
              onChange={(e) => setMoveQty(Number(e.target.value))}
              min={1}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant={moveType === 'IN' ? 'default' : 'outline'}
                onClick={() => setMoveType('IN')}
              >
                Entrée
              </Button>
              <Button
                type="button"
                variant={moveType === 'OUT' ? 'default' : 'outline'}
                onClick={() => setMoveType('OUT')}
              >
                Sortie
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ProductsPage;
