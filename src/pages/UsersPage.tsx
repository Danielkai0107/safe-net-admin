import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, UserX, UserCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { userService } from '../services/userService';
import { tenantService } from '../services/tenantService';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId?: string;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
  tenant?: {
    id: string;
    name: string;
    code: string;
  };
}

export const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterTenantId, setFilterTenantId] = useState<string>('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();
  const watchRole = watch('role');

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    setLoading(true);
    
    // 訂閱用戶列表（即時監聽）
    const unsubscribe = userService.subscribe(
      (data) => {
        setUsers(data as User[]);
        setTotal(data.length);
        setLoading(false);
      },
      filterTenantId || undefined
    );

    // 清理訂閱
    return () => unsubscribe();
  }, [filterTenantId]);

  const loadUsers = () => {
    // 即時監聽會自動更新，此函數保留用於相容性
  };

  const loadTenants = async () => {
    try {
      const response: any = await tenantService.getAll(1, 100);
      setTenants(response.data.data || []);
    } catch (error) {
      console.error('Failed to load tenants:', error);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    reset({});
    setShowModal(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    reset({
      ...user,
      password: '', // 不預填密碼
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    
    try {
      await userService.delete(deletingUser.id);
      alert('刪除成功');
      loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || '刪除失敗');
    }
    setDeletingUser(null);
  };

  const handleToggleActive = async (user: User) => {
    try {
      await userService.toggleActive(user.id);
      alert(user.isActive ? '已停用用戶' : '已啟用用戶');
      loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失敗');
    }
  };

  const onSubmit = async (data: any) => {
    try {
      // 如果是編輯且沒有輸入新密碼，移除 password 欄位
      if (editingUser && !data.password) {
        delete data.password;
      }

      // 處理 tenantId
      if (data.role === 'SUPER_ADMIN') {
        data.tenantId = null;
      }

      if (editingUser) {
        await userService.update(editingUser.id, data);
        alert('更新成功');
      } else {
        await userService.create(data);
        alert('新增成功');
      }
      setShowModal(false);
      loadUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失敗');
    }
  };

  const getRoleBadge = (role: string) => {
    const styles: any = {
      SUPER_ADMIN: 'bg-purple-100 text-purple-800',
      TENANT_ADMIN: 'bg-blue-100 text-blue-800',
      STAFF: 'bg-gray-100 text-gray-800',
    };
    const labels: any = {
      SUPER_ADMIN: '超級管理員',
      TENANT_ADMIN: '社區管理員',
      STAFF: '一般人員',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[role] || 'bg-gray-100'}`}>
        {labels[role] || role}
      </span>
    );
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
          <h1 className="text-3xl font-bold text-gray-900">系統人員管理</h1>
          <p className="text-gray-600 mt-1">管理後台使用者帳號</p>
        </div>
        <button onClick={handleCreate} className="btn-primary flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>新增人員</span>
        </button>
      </div>

      {/* Filter */}
      <div className="mb-6 flex space-x-4">
        <select
          value={filterTenantId}
          onChange={(e) => {
            setFilterTenantId(e.target.value);
            setPage(1);
          }}
          className="input"
        >
          <option value="">所有社區</option>
          <option value="null">Super Admin (無社區)</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name} ({tenant.code})
            </option>
          ))}
        </select>
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
                角色
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                所屬社區
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
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{user.name}</div>
                  {user.phone && (
                    <div className="text-sm text-gray-500">{user.phone}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getRoleBadge(user.role)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.tenant ? (
                    <div>
                      <div className="font-medium">{user.tenant.name}</div>
                      <div className="text-gray-500">{user.tenant.code}</div>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
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
          顯示 {(page - 1) * 10 + 1} 到 {Math.min(page * 10, total)} 筆，共 {total} 筆
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

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? '編輯人員' : '新增人員'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <label className="label">Email *</label>
            <input
              {...register('email', {
                required: '請輸入 Email',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: '請輸入有效的 Email',
                },
              })}
              type="email"
              className="input"
              placeholder="user@example.com"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message as string}</p>
            )}
          </div>

          <div>
            <label className="label">密碼 {editingUser && '(留空則不更改)'}</label>
            <input
              {...register('password', {
                required: !editingUser && '請輸入密碼',
                minLength: {
                  value: 6,
                  message: '密碼至少需要 6 個字元',
                },
              })}
              type="password"
              className="input"
              placeholder={editingUser ? '留空則不更改' : '至少 6 個字元'}
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message as string}</p>
            )}
          </div>

          <div>
            <label className="label">角色 *</label>
            <select
              {...register('role', { required: '請選擇角色' })}
              className="input"
            >
              <option value="">請選擇角色</option>
              <option value="SUPER_ADMIN">超級管理員</option>
              <option value="TENANT_ADMIN">社區管理員</option>
              <option value="STAFF">一般人員</option>
            </select>
            {errors.role && (
              <p className="text-red-500 text-sm mt-1">{errors.role.message as string}</p>
            )}
          </div>

          {watchRole && watchRole !== 'SUPER_ADMIN' && (
            <div>
              <label className="label">所屬社區 *</label>
              <select
                {...register('tenantId', {
                  required: watchRole !== 'SUPER_ADMIN' && '請選擇社區',
                })}
                className="input"
              >
                <option value="">請選擇社區</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.code})
                  </option>
                ))}
              </select>
              {errors.tenantId && (
                <p className="text-red-500 text-sm mt-1">{errors.tenantId.message as string}</p>
              )}
            </div>
          )}

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
              {editingUser ? '更新' : '新增'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDelete}
        title="確認刪除"
        message={`確定要刪除「${deletingUser?.name}」嗎？此操作無法復原。`}
        confirmText="刪除"
        type="danger"
      />
    </div>
  );
};
