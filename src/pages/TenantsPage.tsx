import { useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, Users, Link } from "lucide-react";
import { useForm } from "react-hook-form";
import { tenantService } from "../services/tenantService";
import type { Tenant } from "../types";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AppMembersModal } from "../components/AppMembersModal";

export const TenantsPage = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [appMembersModal, setAppMembersModal] = useState<{
    tenantId: string;
    tenantName: string;
  } | null>(null);

  // 批次選擇相關
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    setLoading(true);

    // 訂閱社區列表（即時監聽）
    const unsubscribe = tenantService.subscribe((data) => {
      setTenants(data);
      setTotal(data.length);
      setLoading(false);
    });

    // 清理訂閱
    return () => unsubscribe();
  }, []);

  const loadTenants = () => {
    // 即時監聽會自動更新，此函數保留用於相容性
  };

  const handleCreate = () => {
    setEditingTenant(null);
    reset({});
    setShowModal(true);
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    reset(tenant);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingTenant) return;

    try {
      await tenantService.delete(deletingTenant.id);
      alert("刪除成功");
      loadTenants();
    } catch (error: any) {
      alert(error.response?.data?.message || "刪除失敗");
    }
  };

  // 批次選擇相關函數
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTenants(tenants.map((t) => t.id));
    } else {
      setSelectedTenants([]);
    }
  };

  const handleSelectTenant = (tenantId: string, checked: boolean) => {
    if (checked) {
      setSelectedTenants((prev) => [...prev, tenantId]);
    } else {
      setSelectedTenants((prev) => prev.filter((id) => id !== tenantId));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedTenants.length === 0) {
      alert("請至少選擇一個社區");
      return;
    }

    if (
      !confirm(
        `確定要刪除選中的 ${selectedTenants.length} 個社區嗎？此操作會同時刪除該社區的所有長者、設備和記錄，無法復原！`,
      )
    ) {
      return;
    }

    try {
      await Promise.all(selectedTenants.map((id) => tenantService.delete(id)));
      alert(`成功刪除 ${selectedTenants.length} 個社區`);
      setSelectedTenants([]);
      loadTenants();
    } catch (error: any) {
      alert(error.response?.data?.message || "批次刪除失敗");
    }
  };

  const [showLinkModal, setShowLinkModal] = useState<Tenant | null>(null);

  const handleCopyLink = async (tenant: Tenant, type: "elders" | "map") => {
    try {
      // 使用全局 LIFF ID 並帶上 tenantId 參數
      const GLOBAL_LIFF_ID = "2008889284-MuPboxSM";
      const liffId = tenant.lineLiffId || GLOBAL_LIFF_ID;

      // 生成帶 tenantId 的連結
      const page = type === "elders" ? "elders" : "map";
      const liffLink = `https://liff.line.me/${liffId}/${page}?tenantId=${tenant.id}`;

      // 複製到剪貼簿
      await navigator.clipboard.writeText(liffLink);

      const pageLabel = type === "elders" ? "長者管理頁面" : "地圖頁面";
      alert(`已複製${pageLabel}連結到剪貼簿！\n\n${liffLink}`);
    } catch (error) {
      console.error("Failed to copy link:", error);
      alert("複製失敗，請重試");
    }
  };

  const onSubmit = async (data: any) => {
    try {
      if (editingTenant) {
        await tenantService.update(editingTenant.id, data);
        alert("更新成功");
      } else {
        await tenantService.create(data);
        alert("新增成功");
      }
      setShowModal(false);
      loadTenants();
    } catch (error: any) {
      alert(error.response?.data?.message || "操作失敗");
    }
  };

  if (loading) {
    return <div className="text-center py-12">載入中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Line OA 管理</h2>
          <p className="text-sm text-gray-600 mt-1">管理所有社區資料</p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedTenants.length > 0 && (
            <button
              onClick={handleBatchDelete}
              className="btn-secondary flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-5 h-5" />
              <span>刪除選中項 ({selectedTenants.length})</span>
            </button>
          )}
          <button
            onClick={handleCreate}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>新增社區</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋社區..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Tenants List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 px-4 w-12">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={
                      selectedTenants.length === tenants.length &&
                      tenants.length > 0
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  社區代碼
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  名稱
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  聯絡人
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  電話
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  BU 類型
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  狀態
                </th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                  管理
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr
                  key={tenant.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedTenants.includes(tenant.id)}
                      onChange={(e) =>
                        handleSelectTenant(tenant.id, e.target.checked)
                      }
                    />
                  </td>
                  <td className="py-3 px-4 text-sm font-mono">{tenant.code}</td>
                  <td className="py-3 px-4 text-sm font-medium">
                    {tenant.name}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {tenant.contactPerson || "-"}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {tenant.contactPhone || "-"}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {tenant.BU_type === "card"
                      ? "數位卡"
                      : tenant.BU_type === "group"
                      ? "組織"
                      : tenant.BU_type === "safe"
                      ? "安全"
                      : "-"}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tenant.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {tenant.isActive ? "啟用" : "停用"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() =>
                          setAppMembersModal({
                            tenantId: tenant.id,
                            tenantName: tenant.name,
                          })
                        }
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                        title="App 成員管理"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowLinkModal(tenant)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                        title="複製 LIFF 連結"
                      >
                        <Link className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleEdit(tenant)}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium mr-3"
                    >
                      <Edit className="w-4 h-4 inline mr-1" />
                      編輯
                    </button>
                    <button
                      onClick={() => setDeletingTenant(tenant)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4 inline mr-1" />
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-gray-600">總共 {total} 個社區</p>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              上一頁
            </button>
            <span className="px-3 py-1">第 {page} 頁</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page * 10 >= total}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
            >
              下一頁
            </button>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTenant ? "編輯社區" : "新增社區"}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">社區代碼 *</label>
              <input
                {...register("code", { required: true })}
                className="input"
                placeholder="DALOVE001"
                disabled={!!editingTenant}
              />
              {errors.code && (
                <p className="text-sm text-red-600 mt-1">請輸入社區代碼</p>
              )}
              {editingTenant && (
                <p className="text-xs text-gray-500 mt-1">社區代碼不可修改</p>
              )}
            </div>

            <div>
              <label className="label">社區名稱 *</label>
              <input
                {...register("name", { required: true })}
                className="input"
                placeholder="大愛社區"
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">請輸入社區名稱</p>
              )}
            </div>

            <div className="col-span-2">
              <label className="label">地址</label>
              <input
                {...register("address")}
                className="input"
                placeholder="台北市信義區信義路五段 7 號"
              />
            </div>

            <div>
              <label className="label">聯絡人</label>
              <input
                {...register("contactPerson")}
                className="input"
                placeholder="王經理"
              />
            </div>

            <div>
              <label className="label">聯絡電話</label>
              <input
                type="tel"
                {...register("contactPhone")}
                className="input"
                placeholder="02-1234-5678"
              />
            </div>

            <div>
              <label className="label">BU 類型</label>
              <select
                {...register("BU_type")}
                className="input"
              >
                <option value="">請選擇</option>
                <option value="card">數位卡</option>
                <option value="group">組織</option>
                <option value="safe">安全</option>
              </select>
            </div>

            {/* LINE 通知設定 */}
            <div className="col-span-2 pt-4 border-t border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                LINE 通知設定
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                用於接收警報通知和系統訊息，如需使用請填寫以下資訊
              </p>
            </div>

            <div className="col-span-2">
              <label className="label">LINE LIFF ID</label>
              <input
                {...register("lineLiffId")}
                className="input"
                placeholder="1234567890-abcdefgh"
              />
              <p className="text-xs text-gray-500 mt-1">
                LINE Login Channel 的 LIFF ID
              </p>
            </div>

            <div className="col-span-2">
              <label className="label">LIFF Endpoint URL</label>
              <input
                {...register("lineLiffEndpointUrl")}
                className="input"
                placeholder="https://your-domain.com/liff"
              />
              <p className="text-xs text-gray-500 mt-1">
                LIFF 應用程式的端點網址（用於 LIFF 設定中的 Endpoint URL）
              </p>
            </div>

            <div className="col-span-2">
              <label className="label">Channel Access Token</label>
              <input
                type="password"
                {...register("lineChannelAccessToken")}
                className="input font-mono text-sm"
                placeholder="輸入 Channel Access Token"
              />
              <p className="text-xs text-gray-500 mt-1">
                用於發送 LINE 訊息的存取權杖
              </p>
            </div>

            <div className="col-span-2">
              <label className="label">Channel Secret</label>
              <input
                type="password"
                {...register("lineChannelSecret")}
                className="input font-mono text-sm"
                placeholder="輸入 Channel Secret"
              />
              <p className="text-xs text-gray-500 mt-1">
                用於驗證 LINE 請求的密鑰
              </p>
            </div>

            <div className="col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  {...register("isActive")}
                  className="rounded"
                  defaultChecked
                />
                <span className="text-sm font-medium text-gray-700">
                  啟用此社區
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button type="submit" className="btn-primary">
              {editingTenant ? "更新" : "新增"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingTenant}
        onClose={() => setDeletingTenant(null)}
        onConfirm={handleDelete}
        title="確認刪除"
        message={`確定要刪除社區「${deletingTenant?.name}」嗎？此操作會同時刪除該社區的所有長者、設備和記錄，無法復原！`}
        confirmText="刪除"
        type="danger"
      />

      {/* App Members Modal */}
      {appMembersModal && (
        <AppMembersModal
          isOpen={true}
          onClose={() => setAppMembersModal(null)}
          tenantId={appMembersModal.tenantId}
          tenantName={appMembersModal.tenantName}
        />
      )}

      {/* Copy Link Modal */}
      <Modal
        isOpen={!!showLinkModal}
        onClose={() => setShowLinkModal(null)}
        title="複製 LIFF 連結"
        size="md"
      >
        {showLinkModal && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 mb-2">
                <strong>社區：</strong>
                {showLinkModal.name}
              </p>
              <p className="text-xs text-blue-700">
                選擇要複製的連結類型，連結會自動帶上社區 ID 參數
              </p>
            </div>

            <div className="space-y-3">
              {/* 長者管理頁面連結 */}
              <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      📋 長者管理頁面
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      用戶可查看長者列表、詳情和管理功能
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://liff.line.me/2008889284-MuPboxSM/elders?tenantId=${showLinkModal.id}`}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded bg-gray-50 font-mono"
                  />
                  <button
                    onClick={() => handleCopyLink(showLinkModal, "elders")}
                    className="btn-primary flex items-center space-x-1 whitespace-nowrap"
                  >
                    <Link className="w-4 h-4" />
                    <span>複製</span>
                  </button>
                </div>
              </div>

              {/* 地圖頁面連結 */}
              <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900">🗺️ 地圖頁面</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      用戶可查看地圖、綁定設備、設定通知點
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://liff.line.me/2008889284-MuPboxSM/map?tenantId=${showLinkModal.id}`}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded bg-gray-50 font-mono"
                  />
                  <button
                    onClick={() => handleCopyLink(showLinkModal, "map")}
                    className="btn-primary flex items-center space-x-1 whitespace-nowrap"
                  >
                    <Link className="w-4 h-4" />
                    <span>複製</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-xs text-yellow-800">
                <strong>使用方式：</strong>
                <br />
                1. 複製連結到 LINE 圖文選單或訊息中
                <br />
                2. 用戶點擊後會自動進入該社區的對應頁面
                <br />
                3. 支援同一用戶加入多個社區的情況
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowLinkModal(null)}
                className="btn-secondary"
              >
                關閉
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
