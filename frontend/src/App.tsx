import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { HowItWorks } from './pages/HowItWorks';
import { Server } from './pages/Server';
import { API } from './pages/API';
import { Errors } from './pages/Errors';
import { Database } from './pages/Database';
import { Alerts } from './pages/Alerts';
import { Playground } from './pages/Playground';
import { Simulator } from './pages/Simulator';
import { Connect } from './pages/Connect';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Navigate to="/" replace />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="server" element={<Server />} />
          <Route path="api-metrics" element={<API />} />
          <Route path="errors" element={<Errors />} />
          <Route path="database" element={<Database />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="playground" element={<Playground />} />
          <Route path="simulator" element={<Simulator />} />
          <Route path="connect" element={<Connect />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
