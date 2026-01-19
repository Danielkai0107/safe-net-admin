import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, User, Phone, MapPin, Clock, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import { alertService } from '../../services/alertService';
import { lineService } from '../../services/lineService';
import { useAuth } from '../../hooks/useAuth';
import { useTenantStore } from '../../store/tenantStore';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import type { Alert, TenantMember } from '../../types';

export const AlertDetailScreen = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, appUserId } = useAuth();
  const tenant = useTenantStore(state => state.selectedTenant);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [completing, setCompleting] = useState(false);

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
    if (!id) return;

    const loadAlert = async () => {
      try {
        const response = await alertService.getOne(id);
        setAlert(response.data);
      } catch (error) {
        console.error('Failed to load alert:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAlert();
  }, [id]);

  const loadMembers = async () => {
    if (!tenant) return;
    
    try {
      const response = await alertService.getTenantMembers(tenant.id);
      setMembers((response.data as TenantMember[]) || []);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  };

  const handleShowAssignModal = () => {
    loadMembers();
    setShowAssignModal(true);
    setSelectedMember('');
  };

  const handleAssign = async () => {
    if (!selectedMember || !alert || !appUserId) {
      window.alert('請選擇成員');
      return;
    }

    setAssigning(true);
    try {
      console.log('Assigning alert with:', { alertId: alert.id, assignedTo: selectedMember, assignedBy: appUserId });
      await lineService.assignAlert(alert.id, selectedMember, appUserId);
      window.alert('分配成功！已發送通知給該成員');
      setShowAssignModal(false);
      
      // 重新載入警報資料
      const response = await alertService.getOne(alert.id);
      setAlert(response.data);
    } catch (error: any) {
      console.error('Failed to assign alert:', error);
      window.alert('分配失敗：' + (error.message || '未知錯誤'));
    } finally {
      setAssigning(false);
    }
  };

  const handleResolve = async () => {
    if (!alert || !appUserId) return;
    
    if (!window.confirm('確定要標記此警報為已解決嗎？')) return;

    try {
      await alertService.resolve(alert.id, appUserId, '已在 LIFF 中處理');
      window.alert('警報已解決');
      navigate('/alerts');
    } catch (error: any) {
      console.error('Failed to resolve alert:', error);
      window.alert('操作失敗：' + (error.message || '未知錯誤'));
    }
  };

  const handleComplete = async () => {
    if (!alert || !appUserId) return;
    
    if (!window.confirm('確定要標記此警報為已完成嗎？')) return;

    setCompleting(true);
    try {
      await lineService.completeAlert(alert.id, appUserId, '已完成處理');
      window.alert('警報已標記為完成！');
      
      // 重新載入警報資料
      const response = await alertService.getOne(alert.id);
      setAlert(response.data);
    } catch (error: any) {
      console.error('Failed to complete alert:', error);
      window.alert('操作失敗：' + (error.message || '未知錯誤'));
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">找不到警報資料</p>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    const colors = {
      CRITICAL: 'text-red-600',
      HIGH: 'text-orange-600',
      MEDIUM: 'text-yellow-600',
      LOW: 'text-blue-600',
    };
    return colors[severity as keyof typeof colors] || colors.MEDIUM;
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate('/alerts')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-gray-900">警報詳情</h2>
      </div>

      {/* 警報資訊 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className={`w-6 h-6 ${getSeverityColor(alert.severity)}`} />
            <h3 className="text-xl font-bold text-gray-900">{alert.title}</h3>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-sm text-gray-600">類型: </span>
            <span className="text-sm font-medium">{getTypeLabel(alert.type)}</span>
          </div>

          <div>
            <span className="text-sm text-gray-600">嚴重度: </span>
            <span className={`text-sm font-semibold ${getSeverityColor(alert.severity)}`}>
              {alert.severity}
            </span>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">訊息:</p>
            <p className="text-gray-900">{alert.message}</p>
          </div>

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>觸發時間: {format(safeToDate(alert.triggeredAt), 'yyyy/MM/dd HH:mm:ss', { locale: zhTW })}</span>
          </div>

          {(alert.latitude && alert.longitude) && (
            <div>
              <p className="text-sm text-gray-600 mb-1">GPS 位置:</p>
              <p className="text-xs font-mono text-gray-700">
                {alert.latitude.toFixed(6)}, {alert.longitude.toFixed(6)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 長輩資訊 */}
      {alert.elder && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-2 mb-3">
            <User className="w-5 h-5 text-gray-600" />
            <h3 className="text-base font-semibold text-gray-900">長輩資訊</h3>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600">姓名: </span>
              <span className="text-sm font-medium text-gray-900">{alert.elder.name}</span>
            </div>
            {alert.elder.phone && (
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <a href={`tel:${alert.elder.phone}`} className="text-sm text-primary-600 hover:underline">
                  {alert.elder.phone}
                </a>
              </div>
            )}
            {alert.elder.address && (
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">{alert.elder.address}</span>
              </div>
            )}
            {alert.elder.emergencyContact && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs text-red-800 font-semibold mb-1">緊急聯絡人</p>
                <p className="text-sm text-red-900">{alert.elder.emergencyContact}</p>
                {alert.elder.emergencyPhone && (
                  <a href={`tel:${alert.elder.emergencyPhone}`} className="text-sm text-red-600 hover:underline">
                    {alert.elder.emergencyPhone}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 分配狀態 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-base font-semibold text-gray-900 mb-3">處理狀態</h3>
        
        {!alert.assignedTo ? (
          // 未分配
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">尚未分配處理人員</p>
            {isAdmin && alert.status !== 'RESOLVED' && (
              <button
                onClick={handleShowAssignModal}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 mx-auto"
              >
                <UserPlus className="w-4 h-4" />
                <span>分配處理</span>
              </button>
            )}
          </div>
        ) : (
          // 已分配
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">分配給: </span>
              <span className="text-sm font-medium text-gray-900">
                {alert.assignedMember?.name || '未知成員'}
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-600">分配時間: </span>
              <span className="text-sm text-gray-900">
                {alert.assignedAt && format(safeToDate(alert.assignedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-600">狀態: </span>
              {alert.assignmentStatus === 'PENDING' && (
                <span className="text-sm text-yellow-600 font-medium">等待回應</span>
              )}
              {alert.assignmentStatus === 'ACCEPTED' && (
                <span className="text-sm text-green-600 font-medium flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>已接受，處理中</span>
                </span>
              )}
              {alert.assignmentStatus === 'DECLINED' && (
                <span className="text-sm text-red-600 font-medium flex items-center space-x-1">
                  <XCircle className="w-4 h-4" />
                  <span>已拒絕</span>
                </span>
              )}
            </div>
            {(alert.assignmentStatus === 'DECLINED' || alert.assignmentStatus === 'PENDING') && isAdmin && alert.status !== 'RESOLVED' && (
              <button
                onClick={handleShowAssignModal}
                className="w-full mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                重新分配
              </button>
            )}
          </div>
        )}
      </div>

      {/* 操作按鈕 */}
      {alert.status !== 'RESOLVED' && (
        <div className="space-y-3">
          {/* 成員完成按鈕 */}
          {alert.assignmentStatus === 'ACCEPTED' && 
           alert.assignedTo === appUserId && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {completing ? '處理中...' : '標記已完成'}
            </button>
          )}
          
          {/* 管理員直接解決按鈕 */}
          {(alert.status === 'PENDING' || alert.status === 'NOTIFIED') && isAdmin && (
            <button
              onClick={handleResolve}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              標記為已解決
            </button>
          )}
        </div>
      )}

      {/* 分配成員彈窗 */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">分配處理人員</h3>
            </div>
            
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-center text-gray-500 py-4">沒有可用的成員</p>
              ) : (
                members.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="member"
                      value={member.appUserId}
                      checked={selectedMember === member.appUserId}
                      onChange={(e) => setSelectedMember(e.target.value)}
                      className="rounded"
                    />
                    <div className="flex items-center space-x-3 ml-3">
                      {member.appUser?.linePictureUrl && (
                        <img
                          src={member.appUser.linePictureUrl}
                          alt={member.appUser.name}
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{member.appUser?.name}</div>
                        {member.role === 'ADMIN' && (
                          <span className="text-xs text-blue-600">管理員</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex space-x-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 btn-secondary"
                disabled={assigning}
              >
                取消
              </button>
              <button
                onClick={handleAssign}
                className="flex-1 btn-primary"
                disabled={!selectedMember || assigning}
              >
                {assigning ? '分配中...' : '確認分配'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
