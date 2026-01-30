import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { authService } from "../services/authService";
import { useAuthStore } from "../store/authStore";
import type { LoginRequest } from "../types";

const haloLogo = new URL("../assets/halo_logo.png", import.meta.url).href;

export const LoginPage = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>();

  const onSubmit = async (data: LoginRequest) => {
    try {
      setLoading(true);
      setError("");
      const response = await authService.login(data.email, data.password);
      login(response.data.user, response.data.access_token);
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      let errorMessage = "登入失敗，請檢查帳號密碼";

      if (err.code === "auth/user-not-found") {
        errorMessage = "找不到此帳號";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "密碼錯誤";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "電子郵件格式不正確";
      } else if (err.code === "auth/invalid-credential") {
        errorMessage = "帳號或密碼錯誤";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="flex-col justify-center mb-8">
            <img src={haloLogo} alt="halo_logo" className="admin_halo_logo" />
            <p className="mt-2 text-center text-sm text-gray-600">
              超級管理後台
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                {...register("email", { required: "Email 為必填" })}
                className="input"
                placeholder="admin@safenet.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">密碼</label>
              <input
                type="password"
                {...register("password", { required: "密碼為必填" })}
                className="input"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "登入中..." : "登入"}
            </button>
          </form>

          {/* Test Accounts */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 font-medium mb-2">測試帳號：</p>
            <div className="space-y-1 text-xs text-gray-500">
              <p>請在 Firebase Console 創建測試帳號</p>
              <p>並在 Firestore users 集合中添加對應資料</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
