import { Card, CardDescription, CardTitle } from '../components/ui/card';

const SettingsPage = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Paramètres</h1>
      <Card>
        <CardTitle>Configuration API</CardTitle>
        <CardDescription>
          L’URL API est fournie au runtime par <code>env.js</code> (env var Vault/ESO VITE_API_BASE_URL),
          fallback dev : http://localhost:3001/api.
        </CardDescription>
        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <p>Authentification: JWT Bearer stocké dans localStorage.</p>
          <p>Swagger disponible sur /docs.</p>
          <p>Endpoint santé: /health.</p>
        </div>
      </Card>
    </div>
  );
};

export default SettingsPage;
