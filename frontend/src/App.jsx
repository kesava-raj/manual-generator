import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import NewRun from './pages/NewRun';
import ExecutionPage from './pages/ExecutionPage';
import ResultsPage from './pages/ResultsPage';
import AuthCallback from './pages/AuthCallback';
import Layout from './components/Layout';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/new-run" element={<NewRun />} />
        <Route path="/run/:id" element={<ExecutionPage />} />
        <Route path="/run/:id/results" element={<ResultsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
