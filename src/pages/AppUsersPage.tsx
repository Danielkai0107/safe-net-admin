import { useEffect, useState, useMemo } from 'react';
import { Edit, Trash2, UserX, UserCheck, Building2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { appUserService } from '../services/appUserService';
import { tenantService } from '../services/tenantService';
import type { Tenant } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface AppUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  // LINE 相關資訊
  lineUserId?: string;
  lineDisplayName?: string;
  linePictureUrl?: string;
  joinedFromTenantId?: string; // 從哪個社區的 LINE 加入的
  isActive: boolean;
  lastLoginAt?: string;
  tenantMemberships?: any[];
  _count?: {
    tenantMemberships: number;
    alertAssignments: number;
  };
}

export const AppUsersPage = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  // 計算合併後的用戶資料
  const enrichedUsers = useMemo(() => {
    return users.map(user => {
      // 1. 優先使用 joinedFromTenantId (從 LINE 加入時記錄的)
      const primaryTenant = user.joinedFromTenantId 
        ? tenants.find(t => t.id === user.joinedFromTenantId)
        : null;

      // 2. 為了相容性，也處理 tenantMemberships (如果有帶入的話)
      const memberships = user.tenantMemberships || [];
      if (primaryTenant && !memberships.find(m => m.tenantId === primaryTenant.id)) {
        memberships.push({
          tenantId: primaryTenant.id,
          role: 'MEMBER',
          tenant: primaryTenant
        });
      }

      return {
        ...user,
        tenantMemberships: memberships
      };
    });
  }, [users, tenants]);

  useEffect(() => {
    setLoading(true);
    
    // 訂閱 App 用戶列表（即時監聽）
    const unsubscribeUsers = appUserService.subscribe((data) => {
      setUsers(data as AppUser[]);
      setTotal(data.length);
      setLoading(false);
    });

    // 訂閱社區列表
    const unsubscribeTenants = tenantService.subscribe((data) => {
      setTenants(data);
    });

    // 清理訂閱
    return () => {
      unsubscribeUsers();
      unsubscribeTenants();
    };
  }, []);

  const loadUsers = () => {
    // 即時監聽會自動更新，此函數保留用於相容性
  };

  const handleEdit = (user: AppUser) => {
    setEditingUser(user);
    reset({
      name: user.name,
      phone: user.phone || '',
      avatar: user.avatar || '',
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    
    try {
      await appUserService.delete(deletingUser.id);
      alert('刪除成功');
      loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || '刪除失敗');
    }
    setDeletingUser(null);
  };

  const handleToggleActive = async (user: AppUser) => {
    try {
      await appUserService.toggleActive(user.id);
      alert(user.isActive ? '已停用用戶' : '已啟用用戶');
      loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失敗');
    }
  };

  const onSubmit = async (data: any) => {
    if (!editingUser) return;

    try {
      await appUserService.update(editingUser.id, data);
      alert('更新成功');
      setShowModal(false);
      loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失敗');
    }
  };

  if (loading) {
    return <div className="text-center py-12">載入中...</div>;
  }

  const totalPages = Math.ceil(total / 10);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Line 好友成員</h1>
          <p className="text-gray-600 mt-1">管理所有透過 LINE 加入的社區成員</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                姓名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                已加入社區
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                狀態
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                最後登入
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {enrichedUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-3">
                    {user.linePictureUrl ? (
                      <img 
                        src={user.linePictureUrl} 
                        alt={user.lineDisplayName || user.name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-semibold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{user.name}</div>
                      {user.lineDisplayName && user.lineDisplayName !== user.name && (
                        <div className="text-xs text-green-600 flex items-center space-x-1">
                          <span>LINE:</span>
                          <span>{user.lineDisplayName}</span>
                        </div>
                      )}
                      {user.phone && (
                        <div className="text-sm text-gray-500">{user.phone}</div>
                      )}
                      {user.lineUserId && (
                        <div className="text-xs text-gray-400 font-mono">
                          ID: {user.lineUserId.substring(0, 12)}...
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.tenantMemberships && user.tenantMemberships.length > 0 ? (
                    <div className="text-sm">
                      {user.tenantMemberships.map((membership: any) => (
                        <div key={membership.id} className="flex items-center space-x-2 mb-1">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span>{membership.tenant.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            membership.role === 'ADMIN' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {membership.role === 'ADMIN' ? '管理員' : '成員'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">尚未加入社區</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.isActive ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      啟用
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      停用
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString('zh-TW')
                    : '從未登入'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={`${
                        user.isActive ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'
                      }`}
                      title={user.isActive ? '停用' : '啟用'}
                    >
                      {user.isActive ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="編輯"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setDeletingUser(user)}
                      className="text-red-600 hover:text-red-900"
                      title="刪除"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-700">
          顯示 {(page - 1) * 10 + 1} 到 {Math.min(page * 10, total)} 筆，共 {total} 筆 App 用戶
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="btn-secondary"
          >
            上一頁
          </button>
          <span className="px-4 py-2 text-gray-700">
            第 {page} / {totalPages} 頁
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="btn-secondary"
          >
            下一頁
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && editingUser && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="編輯 App 用戶"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                value={editingUser.email}
                disabled
                className="input bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">Email 不可修改</p>
            </div>

            <div>
              <label className="label">姓名 *</label>
              <input
                {...register('name', { required: '請輸入姓名' })}
                className="input"
                placeholder="請輸入姓名"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message as string}</p>
              )}
            </div>

            <div>
              <label className="label">電話</label>
              <input
                {...register('phone')}
                type="tel"
                className="input"
                placeholder="0912-345-678"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button type="submit" className="btn-primary">
                更新
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDelete}
        title="確認刪除"
        message={`確定要刪除「${deletingUser?.name}」嗎？此操作無法復原。該用戶的所有社區成員關係也會被刪除。`}
        confirmText="刪除"
        type="danger"
      />
    </div>
  );
};
