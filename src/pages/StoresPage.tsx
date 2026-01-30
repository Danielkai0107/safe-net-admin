import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Globe, Upload, Loader2, Lock, Eye } from "lucide-react";
import { useForm } from "react-hook-form";
import { gatewayService } from "../services/gatewayService";
import { uploadStoreImage } from "../services/storageService";
import type { Gateway } from "../types";
import { Modal } from "../components/Modal";

/** 商店管理：僅管理 isAD 為 true 的 gateway 之店家資訊（名稱、logo、圖片、官網、活動標題/內容） */
export const StoresPage = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGateway, setEditingGateway] = useState<Gateway | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [bannerPreview, setBannerPreview] = useState<string>("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm();

  const watchLogo = watch("storeLogo");
  const watchBanner = watch("imageLink");

  useEffect(() => {
    if (watchLogo) setLogoPreview(watchLogo);
  }, [watchLogo]);

  useEffect(() => {
    if (watchBanner) setBannerPreview(watchBanner);
  }, [watchBanner]);

  useEffect(() => {
    const unsubscribe = gatewayService.subscribe(
      (data) => {
        const adGateways = data.filter((g) => g.isAD === true);
        setStores(adGateways);
        setLoading(false);
      },
      undefined,
      undefined,
    );
    return () => unsubscribe();
  }, []);

  const handleCreate = () => {
    setEditingGateway(null);
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `g-${year}-${month}-`;
    const currentMonth = stores.filter(
      (g) => g.serialNumber && g.serialNumber.startsWith(prefix),
    );
    const nextNum =
      currentMonth.length > 0
        ? Math.max(
            ...currentMonth.map((g) => {
              const m = g.serialNumber?.match(new RegExp(`${prefix}(\\d+)`));
              return m ? parseInt(m[1], 10) : 0;
            }),
          ) + 1
        : 1;
    const serialNumber = `${prefix}${String(nextNum).padStart(4, "0")}`;

    reset({
      location: "",
      storeLogo: "",
      imageLink: "",
      websiteLink: "",
      activityTitle: "",
      activityContent: "",
      storePassword: "",
      serialNumber,
    });
    setLogoPreview("");
    setBannerPreview("");
    setShowModal(true);
  };

  const handleEdit = (gateway: Gateway, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingGateway(gateway);
    reset({
      location: gateway.location ?? "",
      storeLogo: gateway.storeLogo ?? "",
      imageLink: gateway.imageLink ?? "",
      websiteLink: gateway.websiteLink ?? "",
      activityTitle: gateway.activityTitle ?? "",
      activityContent: gateway.activityContent ?? "",
      storePassword: "", // 編輯時不預填，留空表示不變，有輸入則更新
    });
    setLogoPreview(gateway.storeLogo || "");
    setBannerPreview(gateway.imageLink || "");
    setShowModal(true);
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      alert("請選擇圖片檔案（jpg、png、gif、webp 等）");
      return;
    }
    setUploadingLogo(true);
    try {
      const url = await uploadStoreImage(file, "logos");
      setValue("storeLogo", url);
      setLogoPreview(url);
    } catch (err: any) {
      alert(err?.message || "店家 Logo 上傳失敗");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      alert("請選擇圖片檔案（jpg、png、gif、webp 等）");
      return;
    }
    setUploadingImage(true);
    try {
      const url = await uploadStoreImage(file, "images");
      setValue("imageLink", url);
      setBannerPreview(url);
    } catch (err: any) {
      alert(err?.message || "圖片上傳失敗");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const onSubmit = async (data: Record<string, string>) => {
    try {
      // 只包含有值的欄位，避免 undefined 寫入 Firestore
      const payload: Record<string, string> = {
        location: data.location,
      };

      if (data.storeLogo?.trim()) {
        payload.storeLogo = data.storeLogo.trim();
      }
      if (data.imageLink?.trim()) {
        payload.imageLink = data.imageLink.trim();
      }
      if (data.websiteLink?.trim()) {
        payload.websiteLink = data.websiteLink.trim();
      }
      if (data.activityTitle?.trim()) {
        payload.activityTitle = data.activityTitle.trim();
      }
      if (data.activityContent?.trim()) {
        payload.activityContent = data.activityContent.trim();
      }
      // 商家密碼：有輸入才寫入；編輯時留空表示不變
      if (data.storePassword?.trim()) {
        payload.storePassword = data.storePassword.trim();
      }

      if (editingGateway) {
        await gatewayService.update(editingGateway.id, payload);
        alert("商家資訊已更新");
      } else {
        await gatewayService.create({
          serialNumber: data.serialNumber,
          type: "SAFE_ZONE",
          isActive: true,
          isAD: true,
          ...payload,
        });
        alert("店家已新增");
      }
      setShowModal(false);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "操作失敗");
    }
  };

  if (loading) {
    return <div className="text-center py-12">載入中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">商店管理</h2>
          <p className="text-sm text-gray-600 mt-1">
            管理行銷點（isAD）店家資訊：名稱、logo、圖片、官網、活動標題與內容。實際
            Gateway 資料請至 GateWay 管理維護。
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>新增店家</span>
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  店家名稱
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  店家 Logo
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  圖片連結
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  官網連結
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  活動標題
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  活動內容
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  密碼
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-24">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {stores.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    尚無店家。請先在 GateWay
                    管理將接收點設為「行銷點」，或在此頁「新增店家」。
                  </td>
                </tr>
              ) : (
                stores.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => navigate(`/stores/${g.id}`)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      {g.location || "-"}
                    </td>
                    <td className="py-3 px-4">
                      {g.storeLogo ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={g.storeLogo}
                            alt="Logo"
                            className="w-10 h-10 object-cover rounded border border-gray-200"
                          />
                          <a
                            href={g.storeLogo}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center text-primary-600 hover:underline text-xs"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            查看
                          </a>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {g.imageLink ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={g.imageLink}
                            alt="Banner"
                            className="w-20 h-8 object-cover rounded border border-gray-200"
                          />
                          <a
                            href={g.imageLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center text-primary-600 hover:underline text-xs"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            查看
                          </a>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {g.websiteLink ? (
                        <a
                          href={g.websiteLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center text-primary-600 hover:underline"
                        >
                          <Globe className="w-4 h-4 mr-1" />
                          官網
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 max-w-[160px] truncate">
                      {g.activityTitle || "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 max-w-[200px] truncate">
                      {g.activityContent || "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {g.storePassword ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <Lock className="w-4 h-4" />
                          已設定
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={(e) => handleEdit(g, e)}
                        className="text-primary-600 hover:text-primary-700 p-1"
                        title="編輯店家資訊"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          共 {stores.length} 個店家
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingGateway ? "編輯店家資訊" : "新增店家"}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editingGateway && (
            <div>
              <label className="label">接收點序號（自動產生）</label>
              <input
                {...register("serialNumber")}
                className="input bg-gray-50"
                readOnly
                disabled
              />
            </div>
          )}
          <div>
            <label className="label">店家名稱（位置描述）*</label>
            <input
              {...register("location", { required: "請填寫店家名稱" })}
              className="input"
              placeholder="例如：星巴克信義店、7-11光復門市"
            />
            {errors.location && (
              <p className="text-sm text-red-600 mt-1">
                {(errors.location as { message?: string })?.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              此欄位對應 Gateway 的「位置描述」(location)
            </p>
          </div>
          <div>
            <label className="label">店家 Logo (建議 1:1 比例)</label>
            {logoPreview && (
              <div className="mb-3">
                <div className="relative w-32 h-32 bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                  <img
                    src={logoPreview}
                    alt="Logo Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="file"
                ref={logoInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleUploadLogo}
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="btn-secondary flex items-center gap-2 shrink-0"
              >
                {uploadingLogo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                上傳圖片
              </button>
              <input
                {...register("storeLogo")}
                className="input flex-1 min-w-[200px]"
                placeholder="上傳後會顯示網址，或直接貼上圖片網址"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              建議尺寸：400x400 或更高（1:1 比例）
            </p>
          </div>
          <div>
            <label className="label">店家 Banner (建議 3:1 比例)</label>
            {bannerPreview && (
              <div className="mb-3">
                <div className="relative w-full max-w-md h-32 bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                  <img
                    src={bannerPreview}
                    alt="Banner Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="file"
                ref={imageInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleUploadImage}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="btn-secondary flex items-center gap-2 shrink-0"
              >
                {uploadingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                上傳圖片
              </button>
              <input
                {...register("imageLink")}
                className="input flex-1 min-w-[200px]"
                placeholder="上傳後會顯示網址，或直接貼上圖片網址"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              建議尺寸：1200x400 或更高（3:1 比例）
            </p>
          </div>
          <div>
            <label className="label">官網連結</label>
            <input
              {...register("websiteLink")}
              className="input"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="label">活動標題</label>
            <input
              {...register("activityTitle")}
              className="input"
              placeholder="活動標題"
            />
          </div>
          <div>
            <label className="label">活動內容</label>
            <textarea
              {...register("activityContent")}
              className="input min-h-[80px]"
              placeholder="活動說明文字"
              rows={3}
            />
          </div>
          <div>
            <label className="label">商家密碼（選填）</label>
            <input
              type="password"
              {...register("storePassword")}
              className="input"
              placeholder={
                editingGateway ? "留空表示不變" : "供商家簡單登入驗證用"
              }
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-500 mt-1">
              供商家之後以簡單登入驗證用，選填。編輯時留空則不變更原密碼。
            </p>
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
              {editingGateway ? "更新" : "新增"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
