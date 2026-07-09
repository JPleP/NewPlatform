import { AlertTriangle, Info, XCircle, CheckCheck, Trash2, X } from 'lucide-react'
import { useNetworkStore } from '@/stores/networkStore'
import { formatTimestamp, severityBadgeClass } from '@/utils/format'
import type { Alert, AlertSeverity } from '@/types'
import { clsx } from 'clsx'

const severityIcon = (severity: AlertSeverity): React.ReactNode => {
  const cls = 'w-4 h-4 flex-shrink-0'
  switch (severity) {
    case 'info':     return <Info          className={clsx(cls, 'text-blue-400')} />
    case 'warning':  return <AlertTriangle className={clsx(cls, 'text-amber-400')} />
    case 'error':    return <XCircle       className={clsx(cls, 'text-red-400')} />
    case 'critical': return <XCircle       className={clsx(cls, 'text-red-300')} />
  }
}

const AlertRow = ({
  alert,
  onAck,
}: {
  alert: Alert
  onAck: (id: string) => void
}) => (
  <div className={clsx(
    'flex items-start gap-3 p-3 rounded-lg transition-opacity',
    alert.acknowledged ? 'opacity-40' : 'bg-slate-800/40',
  )}>
    {severityIcon(alert.severity)}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-200">{alert.title}</span>
        <span className={clsx('badge', severityBadgeClass(alert.severity))}>
          {alert.severity}
        </span>
        {alert.acknowledged && (
          <span className="badge badge-green">acked</span>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{alert.message}</p>
      <p className="text-xs text-slate-600 mt-1">{formatTimestamp(alert.timestamp)}</p>
    </div>
    {!alert.acknowledged && (
      <button
        onClick={() => onAck(alert.id)}
        className="p-1 rounded hover:bg-slate-700/50 transition-colors flex-shrink-0"
        title="Acknowledge"
      >
        <X className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
      </button>
    )}
  </div>
)

interface AlertsPanelProps {
  maxVisible?: number
  showActions?: boolean
  className?: string
}

export const AlertsPanel = ({
  maxVisible = 50,
  showActions = true,
  className,
}: AlertsPanelProps) => {
  const alerts = useNetworkStore((s) => s.alerts)
  const unacknowledgedCount = useNetworkStore((s) => s.unacknowledgedCount)
  const acknowledgeAlert = useNetworkStore((s) => s.acknowledgeAlert)
  const acknowledgeAllAlerts = useNetworkStore((s) => s.acknowledgeAllAlerts)
  const clearAlerts = useNetworkStore((s) => s.clearAlerts)

  const visible = alerts.slice(0, maxVisible)

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      {showActions && (
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-200">
              Alerts
            </span>
            {unacknowledgedCount > 0 && (
              <span className="badge badge-red">{unacknowledgedCount} new</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unacknowledgedCount > 0 && (
              <button
                onClick={acknowledgeAllAlerts}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Ack all
              </button>
            )}
            <button
              onClick={clearAlerts}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800/50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-slate-500">
          <CheckCheck className="w-6 h-6" />
          <p className="text-sm">No alerts</p>
        </div>
      ) : (
        <div className="space-y-1">
          {visible.map((alert) => (
            <AlertRow key={alert.id} alert={alert} onAck={acknowledgeAlert} />
          ))}
          {alerts.length > maxVisible && (
            <p className="text-xs text-slate-500 text-center py-2">
              +{alerts.length - maxVisible} more alerts
            </p>
          )}
        </div>
      )}
    </div>
  )
}
