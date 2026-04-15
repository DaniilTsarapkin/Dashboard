import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import LoadPage from './pages/LoadPage'
import HomePage from './pages/HomePage'
import FlowPage from './pages/FlowPage'
import LoadMetricsPage from './pages/LoadMetricsPage'
import TeamPage from './pages/TeamPage'
import RisksPage from './pages/RisksPage'
import TimelinePage from './pages/TimelinePage'
import AdminPage from './pages/AdminPage'
import MetricsReferencePage from './pages/MetricsReferencePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LoadPage />} />
          <Route path="dashboard" element={<HomePage />} />
          <Route path="dashboard/flow" element={<FlowPage />} />
          <Route path="dashboard/load" element={<LoadMetricsPage />} />
          <Route path="dashboard/team" element={<TeamPage />} />
          <Route path="dashboard/risks" element={<RisksPage />} />
          <Route path="dashboard/timeline/:prNumber" element={<TimelinePage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="dashboard/reference" element={<MetricsReferencePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
