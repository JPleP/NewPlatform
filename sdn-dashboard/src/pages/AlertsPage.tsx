import { TopBar } from '@/components/layout/TopBar'
import { AlertsPanel } from '@/components/alerts/AlertsPanel'
import { useNetworkStore } from '@/stores/networkStore'

export const AlertsPage = () => {
  const alerts = useNetworkStore((s) => s.alerts)
  const unack  = useNetworkStore((s) => s.unacknowledgedCount)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        title="Alerts & Events"
        subtitle={`${unack} unacknowledged · ${alerts.length} total`}
      />
      <div className="flex-1 overflow-y-auto p-4">
        <AlertsPanel maxVisible={200} showActions />
      </div>
    </div>
  )
}
