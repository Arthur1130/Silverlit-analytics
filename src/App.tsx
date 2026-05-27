import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { Pilotage } from './pages/Pilotage';
import { Produits } from './pages/Produits';
import { ProduitDetail } from './pages/ProduitDetail';
import { Distributeurs } from './pages/Distributeurs';
import { DistributeurDetail } from './pages/DistributeurDetail';
import { MagasinDetail } from './pages/MagasinDetail';
import { Import } from './pages/Import';
import { Alertes } from './pages/Alertes';
import { Gouvernance } from './pages/Gouvernance';
import { Infographie } from './pages/Infographie';
import { Login } from './pages/Login';
import { Demande } from './pages/Demande';
import { InvitationAccept } from './pages/InvitationAccept';
import { Profil } from './pages/Profil';
import { Equipe } from './pages/Equipe';
import { Parametres } from './pages/Parametres';

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/demande-compte" element={<Demande />} />
            <Route path="/invitation" element={<InvitationAccept />} />

            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route path="/" element={<Navigate to="/pilotage" replace />} />
              <Route path="/pilotage" element={<Pilotage />} />
              <Route path="/produits" element={<Produits />} />
              <Route path="/produits/:ean" element={<ProduitDetail />} />
              <Route path="/distributeurs" element={<Distributeurs />} />
              <Route path="/distributeurs/:id" element={<DistributeurDetail />} />
              <Route path="/distributeurs/:distId/magasins/:code" element={<MagasinDetail />} />
              <Route path="/import" element={<Import />} />
              <Route path="/alertes" element={<Alertes />} />
              <Route path="/gouvernance" element={<Gouvernance />} />
              <Route path="/infographie" element={<Infographie />} />
              <Route path="/equipe" element={<Equipe />} />
              <Route path="/parametres" element={<Parametres />} />
              <Route path="/profil" element={<Profil />} />
              <Route path="*" element={<Navigate to="/pilotage" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
