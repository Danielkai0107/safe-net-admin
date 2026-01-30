import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Upload,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { gatewayService } from "../services/gatewayService";
import { uploadStoreImage } from "../services/storageService";
import type { Gateway } from "../types";

export const StoreDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Gateway | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
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
    if (!id) return;
    const unsubscribe = gatewayService.subscribeToOne(id, (data) => {
      if (data) {
        setStore(data);
        setLogoPreview(data.storeLogo || "");
        setBannerPreview(data.imageLink || "");
        reset({
          location: data.location ?? "",
          storeLogo: data.storeLogo ?? "",
          imageLink: data.imageLink ?? "",
          websiteLink: data.websiteLink ?? "",
          activityTitle: data.activityTitle ?? "",
          activityContent: data.activityContent ?? "",
          storePassword: "",
        });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id, reset]);

  useEffect(() => {
    if (watchLogo) setLogoPreview(watchLogo);
  }, [watchLogo]);

  useEffect(() => {
    if (watchBanner) setBannerPreview(watchBanner);
  }, [watchBanner]);

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
    if (!store) return;
    try {
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
      if (data.storePassword?.trim()) {
        payload.storePassword = data.storePassword.trim();
      }

      await gatewayService.update(store.id, payload);
      alert("商家資訊已更新");
      setIsEditing(false);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "更新失敗");
    }
  };

  if (loading) {
    return <div className="text-center py-12">載入中...</div>;
  }

  if (!store) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">找不到該店家</p>
        <button
          onClick={() => navigate("/stores")}
          className="btn-primary mt-4"
        >
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate("/stores")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {store.location || "店家詳情"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              序號：{store.serialNumber || "-"}
            </p>
          </div>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Edit className="w-5 h-5" />
            <span>編輯</span>
          </button>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setIsEditing(false);
                reset({
                  location: store.location ?? "",
                  storeLogo: store.storeLogo ?? "",
                  imageLink: store.imageLink ?? "",
                  websiteLink: store.websiteLink ?? "",
                  activityTitle: store.activityTitle ?? "",
                  activityContent: store.activityContent ?? "",
                  storePassword: "",
                });
                setLogoPreview(store.storeLogo || "");
                setBannerPreview(store.imageLink || "");
              }}
              className="btn-secondary flex items-center space-x-2"
            >
              <X className="w-5 h-5" />
              <span>取消</span>
            </button>
            <button
              onClick={handleSubmit(onSubmit)}
              className="btn-primary flex items-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>儲存</span>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Images Preview */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              圖片預覽
            </h3>

            {/* Logo Preview - 1:1 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                店家 Logo (1:1)
              </label>
              <div className="relative w-full pt-[100%] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <ImageIcon className="w-12 h-12" />
                  </div>
                )}
              </div>
            </div>

            {/* Banner Preview - 3:1 */}
            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium text-gray-700">
                店家 Banner (3:1)
              </label>
              <div className="relative w-full pt-[33.33%] bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                {bannerPreview ? (
                  <img
                    src={bannerPreview}
                    alt="Banner Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <ImageIcon className="w-12 h-12" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">店家資訊</h3>

            <div>
              <label className="label">店家名稱（位置描述）*</label>
              <input
                {...register("location", { required: "請填寫店家名稱" })}
                className="input"
                placeholder="例如：星巴克信義店、7-11光復門市"
                disabled={!isEditing}
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
              {isEditing && (
                <div className="flex gap-2 items-center flex-wrap mb-2">
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
                </div>
              )}
              <input
                {...register("storeLogo")}
                className="input"
                placeholder="圖片網址"
                disabled={!isEditing}
              />
              <p className="text-xs text-gray-500 mt-1">
                建議尺寸：400x400 或更高（1:1 比例）
              </p>
            </div>

            <div>
              <label className="label">店家 Banner (建議 3:1 比例)</label>
              {isEditing && (
                <div className="flex gap-2 items-center flex-wrap mb-2">
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
                </div>
              )}
              <input
                {...register("imageLink")}
                className="input"
                placeholder="圖片網址"
                disabled={!isEditing}
              />
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
                disabled={!isEditing}
              />
            </div>

            <div>
              <label className="label">活動標題</label>
              <input
                {...register("activityTitle")}
                className="input"
                placeholder="活動標題"
                disabled={!isEditing}
              />
            </div>

            <div>
              <label className="label">活動內容</label>
              <textarea
                {...register("activityContent")}
                className="input min-h-[120px]"
                placeholder="活動說明文字"
                rows={5}
                disabled={!isEditing}
              />
            </div>

            {isEditing && (
              <div>
                <label className="label">商家密碼（選填）</label>
                <input
                  type="password"
                  {...register("storePassword")}
                  className="input"
                  placeholder="留空表示不變更"
                  autoComplete="new-password"
                />
                <p className="text-xs text-gray-500 mt-1">
                  供商家登入驗證用，留空則不變更原密碼。
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
