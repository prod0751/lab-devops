import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CircleDollarSign, PackageSearch } from 'lucide-react';
import { DashboardAPI } from '../lib/api';
import { DashboardOverview } from '../types/dashboard';
import { Card, CardDescription, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TBody, TD, TH, THead, TR } from '../components/ui/table';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const DashboardPage = () => {
  const [data, setData] = useState<DashboardOverview | null>(null);

  useEffect(() => {
    DashboardAPI.overview().then(setData);
  }, []);

  const chartData = data
    ? Object.entries(data.movementChart).map(([day, values]) => ({
        day,
        Entrées: values.in,
        Sorties: values.out,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">Vue synthétique de votre stock.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardTitle className="flex items-center gap-2 text-sky-200">
            <PackageSearch size={18} /> Total produits
          </CardTitle>
          <div className="text-3xl font-bold">{data?.totalProducts ?? '—'}</div>
          <CardDescription>Articles suivis dans l’inventaire.</CardDescription>
        </Card>
        <Card>
          <CardTitle className="flex items-center gap-2 text-amber-200">
            <AlertTriangle size={18} /> Alertes stock
          </CardTitle>
          <div className="text-3xl font-bold">{data?.lowStockCount ?? '—'}</div>
          <CardDescription>Produits sous le seuil min.</CardDescription>
        </Card>
        <Card>
          <CardTitle className="flex items-center gap-2 text-emerald-200">
            <CircleDollarSign size={18} /> Valeur totale
          </CardTitle>
          <div className="text-3xl font-bold">
            {data ? `${data.totalValue.toLocaleString('fr-FR')} €` : '—'}
          </div>
          <CardDescription>Somme qty x prix unitaire.</CardDescription>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardTitle className="mb-4 flex items-center gap-2 text-sky-100">
            <Activity size={18} /> Flux des 7 derniers jours
          </CardTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
                <Legend />
                <Bar dataKey="Entrées" stackId="a" fill="#0ea5e9" />
                <Bar dataKey="Sorties" stackId="a" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardTitle className="mb-3">Low stock</CardTitle>
          <div className="space-y-3">
            {data?.lowStockProducts?.length ? (
              data.lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{p.name}</p>
                    <p className="text-xs text-slate-400">SKU {p.sku}</p>
                  </div>
                  <Badge variant="warning">
                    {p.quantity}/{p.minQuantity}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Pas d’alerte.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle className="mb-3">Résumé des produits</CardTitle>
        <Table>
          <THead>
            <TR>
              <TH>Produit</TH>
              <TH>SKU</TH>
              <TH>Stock</TH>
              <TH>Catégorie</TH>
              <TH>Emplacement</TH>
            </TR>
          </THead>
          <TBody>
            {data?.lowStockProducts?.length ? (
              data.lowStockProducts.map((p) => (
                <TR key={p.id}>
                  <TD>{p.name}</TD>
                  <TD className="text-slate-400">{p.sku}</TD>
                  <TD>
                    <Badge variant={p.quantity <= p.minQuantity ? 'warning' : 'default'}>
                      {p.quantity} u.
                    </Badge>
                  </TD>
                  <TD>{p.category || '-'}</TD>
                  <TD>{p.location || '-'}</TD>
                </TR>
              ))
            ) : (
              <TR>
                <TD colSpan={5} className="text-center text-slate-500">
                  Ajoutez des produits pour voir le détail.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
};

export default DashboardPage;
