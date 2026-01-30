#!/bin/bash

echo "========================================="
echo "完整部署腳本"
echo "========================================="
echo "此腳本將部署："
echo "1. Admin 管理後台"
echo "2. LIFF 應用"
echo "3. Community Portal"
echo "4. Cloud Functions"
echo "5. Realtime Database 規則"
echo "========================================="
echo ""

# 詢問要部署什麼
read -p "是否部署 Admin 管理後台？ (y/n) " -n 1 -r DEPLOY_ADMIN
echo ""
read -p "是否部署 LIFF 應用？ (y/n) " -n 1 -r DEPLOY_LIFF
echo ""
read -p "是否部署 Community Portal？ (y/n) " -n 1 -r DEPLOY_COMMUNITY
echo ""
read -p "是否部署 Cloud Functions？ (y/n) " -n 1 -r DEPLOY_FUNCTIONS
echo ""
read -p "是否部署 Realtime Database 規則？ (y/n) " -n 1 -r DEPLOY_DATABASE
echo ""

# 記錄失敗項目
FAILED_ITEMS=()

# 構建 Admin 管理後台
if [[ $DEPLOY_ADMIN =~ ^[Yy]$ ]]; then
  echo ""
  echo "========================================="
  echo "構建 Admin 管理後台..."
  echo "========================================="
  npm run build
  if [ $? -ne 0 ]; then
    echo "❌ Admin 構建失敗"
    FAILED_ITEMS+=("Admin")
  else
    echo "✅ Admin 構建成功"
  fi
fi

# 構建 LIFF 應用
if [[ $DEPLOY_LIFF =~ ^[Yy]$ ]]; then
  echo ""
  echo "========================================="
  echo "構建 LIFF 應用..."
  echo "========================================="
  cd liff
  npm run build
  if [ $? -ne 0 ]; then
    echo "❌ LIFF 構建失敗"
    FAILED_ITEMS+=("LIFF")
    cd ..
  else
    echo "✅ LIFF 構建成功"
    cd ..
    # LIFF 的 vite.config.ts 已設定 outDir: '../dist/liff'
    # 所以編譯後直接輸出到 dist/liff/，不需要額外複製
    echo "✅ LIFF 已編譯到 dist/liff/"
  fi
fi

# 構建 Community Portal
if [[ $DEPLOY_COMMUNITY =~ ^[Yy]$ ]]; then
  echo ""
  echo "========================================="
  echo "構建 Community Portal..."
  echo "========================================="
  cd community-portal
  npm run build
  if [ $? -ne 0 ]; then
    echo "❌ Community Portal 構建失敗"
    FAILED_ITEMS+=("Community Portal")
    cd ..
  else
    echo "✅ Community Portal 構建成功"
    cd ..
    # Community Portal 的 vite.config.ts 已設定 outDir: '../dist/community'
    # 所以不需要額外複製
  fi
fi

# 編譯 Cloud Functions
if [[ $DEPLOY_FUNCTIONS =~ ^[Yy]$ ]]; then
  echo ""
  echo "========================================="
  echo "編譯 Cloud Functions..."
  echo "========================================="
  cd functions
  npm run build
  if [ $? -ne 0 ]; then
    echo "❌ Cloud Functions 編譯失敗"
    FAILED_ITEMS+=("Cloud Functions")
  else
    echo "✅ Cloud Functions 編譯成功"
  fi
  cd ..
fi

# 檢查是否有構建失敗
if [ ${#FAILED_ITEMS[@]} -ne 0 ]; then
  echo ""
  echo "========================================="
  echo "❌ 以下項目構建失敗："
  for item in "${FAILED_ITEMS[@]}"; do
    echo "  - $item"
  done
  echo "========================================="
  echo ""
  read -p "是否繼續部署成功構建的項目？ (y/n) " -n 1 -r CONTINUE_DEPLOY
  echo ""
  if [[ ! $CONTINUE_DEPLOY =~ ^[Yy]$ ]]; then
    echo "部署已取消"
    exit 1
  fi
fi

# 部署到 Firebase
echo ""
echo "========================================="
echo "部署到 Firebase..."
echo "========================================="

DEPLOY_TARGETS=""

if [[ $DEPLOY_ADMIN =~ ^[Yy]$ ]] || [[ $DEPLOY_LIFF =~ ^[Yy]$ ]] || [[ $DEPLOY_COMMUNITY =~ ^[Yy]$ ]]; then
  DEPLOY_TARGETS="hosting"
fi

if [[ $DEPLOY_FUNCTIONS =~ ^[Yy]$ ]]; then
  if [ -z "$DEPLOY_TARGETS" ]; then
    DEPLOY_TARGETS="functions"
  else
    DEPLOY_TARGETS="$DEPLOY_TARGETS,functions"
  fi
fi

if [[ $DEPLOY_DATABASE =~ ^[Yy]$ ]]; then
  if [ -z "$DEPLOY_TARGETS" ]; then
    DEPLOY_TARGETS="database"
  else
    DEPLOY_TARGETS="$DEPLOY_TARGETS,database"
  fi
fi

if [ -z "$DEPLOY_TARGETS" ]; then
  echo "沒有選擇要部署的項目"
  exit 0
fi

firebase deploy --only $DEPLOY_TARGETS

if [ $? -eq 0 ]; then
  echo ""
  echo "========================================="
  echo "✅ 部署成功！"
  echo "========================================="
  
  if [[ $DEPLOY_ADMIN =~ ^[Yy]$ ]]; then
    echo "Admin URL: https://safe-net-tw.web.app/"
  fi
  
  if [[ $DEPLOY_LIFF =~ ^[Yy]$ ]]; then
    echo "LIFF URL: https://safe-net-tw.web.app/liff"
  fi
  
  if [[ $DEPLOY_COMMUNITY =~ ^[Yy]$ ]]; then
    echo "Community Portal URL: https://safe-net-tw.web.app/community"
  fi
  
  if [[ $DEPLOY_FUNCTIONS =~ ^[Yy]$ ]]; then
    echo "Cloud Functions: 已部署"
  fi
  
  if [[ $DEPLOY_DATABASE =~ ^[Yy]$ ]]; then
    echo "Realtime Database 規則: 已部署"
  fi
  
  echo "========================================="
  echo ""
else
  echo ""
  echo "❌ 部署失敗"
  exit 1
fi
