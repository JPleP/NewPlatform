import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export const AppShell = () => (
  <div className="flex min-h-screen bg-slate-950">
    <Sidebar />
    <main className="flex-1 flex flex-col overflow-hidden min-w-0">
      <Outlet />
    </main>
  </div>
)
