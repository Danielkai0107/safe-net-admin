import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/authService";
import haloLogo from "../../assets/halo_logo.png";

export const LoginScreen = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authService.login(email, password);
      // 登入成功後，useAuth hook 會自動處理用戶資料
      navigate("/");
    } catch (err: any) {
      console.error("登入失敗:", err);

      // 根據錯誤碼顯示友善的錯誤訊息
      let errorMessage = "登入失敗，請稍後再試";

      if (err.code === "auth/invalid-email") {
        errorMessage = "無效的電子郵件格式";
      } else if (err.code === "auth/user-not-found") {
        errorMessage = "找不到此帳號";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "密碼錯誤";
      } else if (err.code === "auth/invalid-credential") {
        errorMessage = "帳號或密碼錯誤";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "登入嘗試次數過多，請稍後再試";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <img src={haloLogo} alt="halo_logo" className="admin_halo_logo" />
          <p className="mt-2 text-center text-sm text-gray-600">追蹤管理後台</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="label">
                電子郵件
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                密碼
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary"
            >
              {loading ? "登入中..." : "登入"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
