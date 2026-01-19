import { useState, useEffect } from 'react';
import { initLiff, getProfile, type LiffProfile } from '../lib/liff';
import { query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTenantStore } from '../store/tenantStore';
import type { Tenant, TenantMember } from '../types';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  profile: LiffProfile | null;
  appUserId: string | null;
  memberships: TenantMember[];
  currentMembership: TenantMember | null;
  isAdmin: boolean;
  error: string | null;
}

// 全局 LIFF ID（所有社區共用）
const GLOBAL_LIFF_ID = '2008889284-MuPboxSM';  // 請替換為您的實際 LIFF ID

export const useAuth = () => {
  const selectedTenant = useTenantStore(state => state.selectedTenant);
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    profile: null,
    appUserId: null,
    memberships: [],
    currentMembership: null,
    isAdmin: false,
    error: null,
  });

  useEffect(() => {
    const authenticate = async () => {
      try {
        console.log('Starting authentication...');

        // 1. 初始化 LIFF（使用全局 LIFF ID）
        await initLiff(GLOBAL_LIFF_ID);
        console.log('LIFF initialized');

        // 2. 獲取 LINE 用戶資訊
        const profile = await getProfile();
        console.log('Profile:', profile);

        // 3. 查詢或創建 appUser 記錄
        const appUsersQuery = query(
          collection(db, 'appUsers'),
          where('lineUserId', '==', profile.userId)
        );
        
        const appUsersSnap = await getDocs(appUsersQuery);
        
        let appUserId: string;
        
        if (appUsersSnap.empty) {
          // 創建新的 appUser 記錄（首次使用）
          const { addDoc } = await import('firebase/firestore');
          const docRef = await addDoc(collection(db, 'appUsers'), {
            lineUserId: profile.userId,
            lineDisplayName: profile.displayName,
            linePictureUrl: profile.pictureUrl,
            name: profile.displayName,
            email: profile.email || null,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
          });
          appUserId = docRef.id;
          console.log('Created new appUser:', appUserId);
        } else {
          appUserId = appUsersSnap.docs[0].id;
          // 更新 LINE 資訊和最後登入時間
          const { updateDoc, doc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'appUsers', appUserId), {
            lineDisplayName: profile.displayName,
            linePictureUrl: profile.pictureUrl,
            lastLoginAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          console.log('Updated appUser:', appUserId);
        }

        // 4. 查詢用戶所屬的所有社區（APPROVED 狀態）
        const allMemberships: TenantMember[] = [];
        
        // 獲取所有社區
        const tenantsSnap = await getDocs(collection(db, 'tenants'));
        console.log('Total tenants:', tenantsSnap.docs.length);
        console.log('App User ID:', appUserId);
        
        for (const tenantDoc of tenantsSnap.docs) {
          // 查詢所有狀態的成員（用於調試和檢查）
          const allMembersQuery = query(
            collection(db, 'tenants', tenantDoc.id, 'members'),
            where('appUserId', '==', appUserId)
          );
          const allMembersSnap = await getDocs(allMembersQuery);
          
          if (!allMembersSnap.empty) {
            const memberData = allMembersSnap.docs[0].data();
            console.log(`Found member in tenant ${tenantDoc.id}:`, {
              status: memberData.status,
              role: memberData.role,
            });
            
            // 只添加 APPROVED 狀態的成員
            if (memberData.status === 'APPROVED') {
              const tenant = { id: tenantDoc.id, ...tenantDoc.data() } as Tenant;
              
              allMemberships.push({
                id: allMembersSnap.docs[0].id,
                tenantId: tenantDoc.id,
                ...memberData,
                tenant,
              } as TenantMember);
            }
          }
        }

        console.log('Found APPROVED memberships:', allMemberships.length);
        
        // 如果沒有找到任何成員資格，嘗試通過 LINE API 驗證用戶是哪個社區的好友
        if (allMemberships.length === 0) {
          console.log('No memberships found. Verifying user through LINE API...');
          
          let matchedTenants: string[] = [];
          
          try {
            // 調用 Cloud Function 驗證用戶是哪個社區的好友
            const { httpsCallable } = await import('firebase/functions');
            const { functions } = await import('../config/firebase');
            const verifyUserTenant = httpsCallable(functions, 'verifyUserTenant');
            
            const result: any = await verifyUserTenant({ lineUserId: profile.userId });
            matchedTenants = result.data?.matchedTenants || [];
            
            console.log('Matched tenants from LINE API:', matchedTenants);
          } catch (error: any) {
            console.error('Error verifying user tenant:', error);
            // 如果驗證失敗，嘗試使用 joinedFromTenantId 作為備用方案
            const appUserDoc = await getDocs(query(
              collection(db, 'appUsers'),
              where('lineUserId', '==', profile.userId)
            ));
            
            if (!appUserDoc.empty) {
              const appUserData = appUserDoc.docs[0].data();
              const joinedFromTenantId = appUserData.joinedFromTenantId;
              
              if (joinedFromTenantId) {
                matchedTenants = [joinedFromTenantId];
                console.log('Using joinedFromTenantId as fallback:', joinedFromTenantId);
              }
            }
          }
          
          // 對於每個匹配的社區，自動添加用戶為成員
          for (const tenantId of matchedTenants) {
              // 檢查用戶是否已經是該社區的成員（任何狀態）
              const existingMemberQuery = query(
                collection(db, 'tenants', tenantId, 'members'),
                where('appUserId', '==', appUserId)
              );
              const existingMemberSnap = await getDocs(existingMemberQuery);
              
              if (existingMemberSnap.empty) {
                // 自動添加用戶為社區成員
                const { addDoc, doc, getDoc } = await import('firebase/firestore');
                await addDoc(collection(db, 'tenants', tenantId, 'members'), {
                  appUserId,
                  role: 'MEMBER',
                  status: 'APPROVED',
                  approvedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
                
                console.log(`Auto-added user to tenant: ${tenantId}`);
                
                // 獲取社區資料並添加到成員資格列表
                const tenantDocRef = doc(db, 'tenants', tenantId);
                const tenantDocSnap = await getDoc(tenantDocRef);
                
                if (tenantDocSnap.exists()) {
                  // 重新查詢成員資格
                  const newMemberQuery = query(
                    collection(db, 'tenants', tenantId, 'members'),
                    where('appUserId', '==', appUserId),
                    where('status', '==', 'APPROVED')
                  );
                  const newMemberSnap = await getDocs(newMemberQuery);
                  
                  if (!newMemberSnap.empty) {
                    const memberData = newMemberSnap.docs[0].data();
                    const tenant = { id: tenantId, ...tenantDocSnap.data() } as Tenant;
                    
                    allMemberships.push({
                      id: newMemberSnap.docs[0].id,
                      tenantId,
                      ...memberData,
                      tenant,
                    } as TenantMember);
                    
                    console.log(`Successfully added membership for tenant: ${tenantId}`);
                  }
                }
              } else {
                console.log(`User already has a membership record in tenant ${tenantId}`);
              }
            }
        }

        // 5. 確定當前社區的角色
        let currentMembership: TenantMember | null = null;
        let isAdmin = false;

        if (selectedTenant) {
          currentMembership = allMemberships.find(m => m.tenantId === selectedTenant.id) || null;
          isAdmin = currentMembership?.role === 'ADMIN';
        }

        setAuthState({
          isLoading: false,
          isAuthenticated: true,
          profile,
          appUserId,
          memberships: allMemberships,
          currentMembership,
          isAdmin,
          error: null,
        });
      } catch (error: any) {
        console.error('Authentication error:', error);
        setAuthState({
          isLoading: false,
          isAuthenticated: false,
          profile: null,
          appUserId: null,
          memberships: [],
          currentMembership: null,
          isAdmin: false,
          error: error.message || '身份驗證失敗',
        });
      }
    };

    authenticate();
  }, [selectedTenant]);

  return { ...authState, tenant: selectedTenant };
};
