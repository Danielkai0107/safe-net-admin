import { useState, useEffect } from 'react';
import { User, Home, Shield, ArrowLeftRight, Users, Crown, UserMinus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTenantStore } from '../../store/tenantStore';
import { memberService } from '../../services/memberService';
import type { TenantMember } from '../../types';

export const ProfileScreen = () => {
  const { profile, isAdmin, memberships, appUserId } = useAuth();
  const { selectedTenant, clearTenant } = useTenantStore();
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleChangeTenant = () => {
    if (memberships.length > 1) {
      clearTenant();
    }
  };

  // 載入成員列表
  useEffect(() => {
    if (selectedTenant && isAdmin) {
      loadMembers();
    }
  }, [selectedTenant, isAdmin]);

  const loadMembers = async () => {
    if (!selectedTenant) return;
    
    setLoading(true);
    try {
      const membersList = await memberService.getTenantMembers(selectedTenant.id);
      setMembers(membersList);
    } catch (error) {
      console.error('Failed to load members:', error);
      alert('無法載入成員列表');
    } finally {
      setLoading(false);
    }
  };

  // 設定為管理員
  const handleSetAdmin = async (memberId: string) => {
    if (!selectedTenant) return;
    
    if (!confirm('確定要將此成員設定為管理員嗎？')) return;
    
    setActionLoading(memberId);
    try {
      await memberService.updateMemberRole(selectedTenant.id, memberId, 'ADMIN');
      await loadMembers();
      alert('已成功設定為管理員');
    } catch (error) {
      console.error('Failed to set admin:', error);
      alert('設定失敗，請稍後再試');
    } finally {
      setActionLoading(null);
    }
  };

  // 移除管理員權限
  const handleRemoveAdmin = async (memberId: string) => {
    if (!selectedTenant) return;
    
    // 檢查是否至少有一位管理員
    if (!memberService.hasMinimumAdmins(members, memberId)) {
      alert('無法移除！社區至少需要保留一位管理員。');
      return;
    }
    
    if (!confirm('確定要移除此成員的管理員權限嗎？')) return;
    
    setActionLoading(memberId);
    try {
      await memberService.updateMemberRole(selectedTenant.id, memberId, 'MEMBER');
      await loadMembers();
      alert('已成功移除管理員權限');
    } catch (error) {
      console.error('Failed to remove admin:', error);
      alert('移除失敗，請稍後再試');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4 py-4">
      {/* 個人資料卡片 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col items-center">
          {/* 頭像 */}
          {profile?.pictureUrl ? (
            <img
              src={profile.pictureUrl}
              alt={profile.displayName}
              className="w-24 h-24 rounded-full mb-4 ring-4 ring-primary-100"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mb-4">
              <User className="w-12 h-12 text-gray-400" />
            </div>
          )}

          {/* 姓名 */}
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {profile?.displayName || '訪客'}
          </h2>

          {/* 角色標籤 */}
          {isAdmin && (
            <div className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full mb-4">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">管理員</span>
            </div>
          )}

          {/* 電子郵件（如果有） */}
          {profile?.email && (
            <p className="text-sm text-gray-500 mb-4">{profile.email}</p>
          )}
        </div>
      </div>

      {/* 所在社區卡片 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Home className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-bold text-gray-900">所在社區</h3>
          </div>
          {memberships.length > 1 && (
            <button
              onClick={handleChangeTenant}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>切換</span>
            </button>
          )}
        </div>

        {selectedTenant ? (
          <div className="space-y-3">
            {/* 當前社區 */}
            <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {selectedTenant.name}
                  </h4>
                  {selectedTenant.address && (
                    <p className="text-sm text-gray-600 mb-2">
                      {selectedTenant.address}
                    </p>
                  )}
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                      當前社區
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 其他社區（如果有） */}
            {memberships.filter(m => m.tenantId !== selectedTenant.id).length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">其他社區</p>
                <div className="space-y-2">
                  {memberships
                    .filter(m => m.tenantId !== selectedTenant.id)
                    .map((membership) => (
                      <div
                        key={membership.id}
                        className="bg-gray-50 rounded-lg p-3"
                      >
                        <h5 className="font-medium text-gray-900 text-sm">
                          {membership.tenant?.name}
                        </h5>
                        {membership.tenant?.address && (
                          <p className="text-xs text-gray-500 mt-1">
                            {membership.tenant.address}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500">尚未選擇社區</p>
          </div>
        )}
      </div>

      {/* 成員管理（僅管理員可見） */}
      {isAdmin && selectedTenant && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Users className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-bold text-gray-900">成員管理</h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">暫無成員</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const isCurrentUser = member.appUserId === appUserId;
                const isLoading = actionLoading === member.id;
                
                return (
                  <div
                    key={member.id}
                    className={`border rounded-lg p-4 ${
                      isCurrentUser ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        {member.appUser?.linePictureUrl ? (
                          <img
                            src={member.appUser.linePictureUrl}
                            alt={member.appUser.lineDisplayName}
                            className="w-12 h-12 rounded-full"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-semibold text-gray-900">
                              {member.appUser?.lineDisplayName || member.appUser?.name || '未知用戶'}
                            </h4>
                            {isCurrentUser && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                我
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2 mt-1">
                            {member.role === 'ADMIN' ? (
                              <div className="flex items-center space-x-1 text-xs text-amber-700">
                                <Crown className="w-3 h-3" />
                                <span>管理員</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500">一般成員</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 操作按鈕 */}
                      {!isCurrentUser && (
                        <div>
                          {member.role === 'ADMIN' ? (
                            <button
                              onClick={() => handleRemoveAdmin(member.id)}
                              disabled={isLoading}
                              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isLoading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                              ) : (
                                <>
                                  <UserMinus className="w-4 h-4" />
                                  <span>移除管理員</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSetAdmin(member.id)}
                              disabled={isLoading}
                              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isLoading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                              ) : (
                                <>
                                  <Shield className="w-4 h-4" />
                                  <span>設為管理員</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
