import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, MoveRight } from 'lucide-react';
import { ProductsAPI } from '../lib/api';
import { Product, StockMovement } from '../types/product';
import { Card, CardDescription, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TBody, TD, TH, THead, TR } from '../components/ui/table';

const ProductDetailPage = () => {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    if (!id) return;
    ProductsAPI.detail(id).then(setProduct);
    ProductsAPI.movements(id).then(setMovements);
  }, [id]);

  if (!product) return <p className="text-slate-400">Chargement...</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle className="flex items-center gap-2 text-sky-100">{product.name}</CardTitle>
        <CardDescription>SKU {product.sku}</CardDescription>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-slate-400">Stock</p>
            <Badge variant={product.quantity <= product.minQuantity ? 'warning' : 'default'}>
              {product.quantity} u.
            </Badge>
          </div>
          <div>
            <p className="text-slate-400">Min</p>
            <p>{product.minQuantity}</p>
          </div>
          <div>
            <p className="text-slate-400">Prix unitaire</p>
            <p>{product.unitPrice} €</p>
          </div>
          <div>
            <p className="text-slate-400">Catégorie</p>
            <p>{product.category || '—'}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle className="flex items-center gap-2">
          <Clock size={16} /> Historique des mouvements
        </CardTitle>
        <CardDescription>Entrées / sorties les plus récentes.</CardDescription>
        <Table>
          <THead>
            <TR>
              <TH>Type</TH>
              <TH>Quantité</TH>
              <TH>Note</TH>
              <TH>Date</TH>
            </TR>
          </THead>
          <TBody>
            {movements.map((m) => (
              <TR key={m.id}>
                <TD>
                  <Badge variant={m.type === 'OUT' ? 'warning' : 'default'}>
                    <MoveRight size={14} className="mr-1 inline" />
                    {m.type}
                  </Badge>
                </TD>
                <TD>{m.qty}</TD>
                <TD>{m.note || '—'}</TD>
                <TD className="text-slate-400">
                  {new Date(m.createdAt).toLocaleString('fr-FR')}
                </TD>
              </TR>
            ))}
            {!movements.length && (
              <TR>
                <TD colSpan={4} className="text-center text-slate-500">
                  Pas de mouvement.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
};

export default ProductDetailPage;
