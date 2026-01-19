import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, User } from 'lucide-react';
import { alertService } from '../../services/alertService';
import { useTenantStore } from '../../store/tenantStore';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import type { Alert, AlertStatus } from '../../types';

export const AlertListScreen = () => {
  const navigate = useNavigate();
  const tenant = useTenantStore(state => state.selectedTenant);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<AlertStatus | ''>('');

  // 安全的時間轉換函數
  const safeToDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    return new Date(timestamp);
  };

  useEffect(() => {
    if (!tenant) return;

    setLoading(true);
    const statusParam = filterStatus !== '' ? (filterStatus as AlertStatus) : undefined;
    
    // 訂閱警報列表
    const unsubscribe = alertService.subscribe(
      tenant.id,
      (data) => {
        // 排序：已解決的放最下面，其他按時間排序
        const sortedAlerts = [...data].sort((a, b) => {
          // 已解決的排在最後
          if (a.status === 'RESOLVED' && b.status !== 'RESOLVED') return 1;
          if (a.status !== 'RESOLVED' && b.status === 'RESOLVED') return -1;
          
          // 其他按時間排序（最新的在前）
          const aTime = safeToDate(a.triggeredAt).getTime();
          const bTime = safeToDate(b.triggeredAt).getTime();
          return bTime - aTime;
        });
        
        setAlerts(sortedAlerts);
        setLoading(false);
      },
      statusParam
    );

    return () => unsubscribe();
  }, [tenant, filterStatus]);

  const getSeverityColor = (severity: string) => {
    const colors = {
      CRITICAL: 'bg-red-100 text-red-800 border-red-300',
      HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
      MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      LOW: 'bg-blue-100 text-blue-800 border-blue-300',
    };
    return colors[severity as keyof typeof colors] || colors.MEDIUM;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-red-100 text-red-800',
      NOTIFIED: 'bg-yellow-100 text-yellow-800',
      RESOLVED: 'bg-green-100 text-green-800',
      DISMISSED: 'bg-gray-100 text-gray-800',
    };
    
    const labels = {
      PENDING: '待處理',
      NOTIFIED: '已通知',
      RESOLVED: '已解決',
      DISMISSED: '已忽略',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      BOUNDARY: '邊界警報',
      INACTIVE: '不活躍警報',
      FIRST_ACTIVITY: '首次活動',
      LOW_BATTERY: '低電量',
      EMERGENCY: '緊急狀況',
    };
    return labels[type as keyof typeof labels] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">警報管理</h2>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as AlertStatus | '')}
          className="input"
        >
          <option value="">全部狀態</option>
          <option value="PENDING">待處理</option>
          <option value="NOTIFIED">已通知</option>
          <option value="RESOLVED">已解決</option>
          <option value="DISMISSED">已忽略</option>
        </select>
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p className="text-gray-500">暫無警報</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            // 判斷是否為未分配（PENDING 且尚未分配）
            const isPendingUnassigned = alert.status === 'PENDING' && !alert.assignedTo;
            // 判斷是否已解決
            const isResolved = alert.status === 'RESOLVED';
            
            return (
              <div
                key={alert.id}
                onClick={() => navigate(`/alerts/${alert.id}`)}
                className={`rounded-lg p-4 cursor-pointer transition-all ${
                  isPendingUnassigned
                    ? `shadow border-2 ${getSeverityColor(alert.severity)} hover:shadow-md`
                    : `bg-white hover:shadow-sm ${isResolved ? 'opacity-60' : ''}`
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className={`w-5 h-5 ${
                      isPendingUnassigned ? '' : 'text-gray-400'
                    }`} />
                    <h3 className={`font-semibold ${
                      isPendingUnassigned ? '' : 'text-gray-900'
                    }`}>{alert.title}</h3>
                  </div>
                  {getStatusBadge(alert.status)}
                </div>

                <p className={`text-sm mb-2 ${
                  isPendingUnassigned ? '' : 'text-gray-700'
                }`}>{alert.message}</p>

                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center space-x-2 text-gray-700">
                    <User className="w-3 h-3" />
                    <span>{alert.elder?.name}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-600">
                    <Clock className="w-3 h-3" />
                    <span>
                      {formatDistanceToNow(safeToDate(alert.triggeredAt), {
                        addSuffix: true,
                        locale: zhTW,
                      })}
                    </span>
                  </div>
                </div>

                {/* 分配狀態顯示 */}
                {alert.assignedTo && (
                  <div className="mb-2">
                    <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                      {alert.assignmentStatus === 'PENDING' && '已分配，等待回應'}
                      {alert.assignmentStatus === 'ACCEPTED' && '已接受處理'}
                      {alert.assignmentStatus === 'DECLINED' && '已拒絕'}
                      {alert.assignedMember && ` - ${alert.assignedMember.name}`}
                    </span>
                  </div>
                )}

                <div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    isPendingUnassigned 
                      ? 'bg-white/50' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {getTypeLabel(alert.type)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
