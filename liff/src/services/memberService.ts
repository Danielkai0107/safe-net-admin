import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { TenantMember } from '../types';

// 獲取社區成員列表
export const getTenantMembers = async (tenantId: string): Promise<TenantMember[]> => {
  const membersRef = collection(db, 'tenants', tenantId, 'members');
  const q = query(membersRef, where('status', '==', 'APPROVED'));
  const snapshot = await getDocs(q);
  
  // 載入每個成員的 appUser 資料
  const membersWithUsers = await Promise.all(
    snapshot.docs.map(async (memberDoc) => {
      const memberData = memberDoc.data();
      
      // 獲取對應的 appUser 資料
      if (memberData.appUserId) {
        try {
          const appUserDoc = await getDoc(doc(db, 'appUsers', memberData.appUserId));
          if (appUserDoc.exists()) {
            return {
              id: memberDoc.id,
              ...memberData,
              appUser: {
                id: appUserDoc.id,
                ...appUserDoc.data()
              },
            } as TenantMember;
          }
        } catch (error) {
          console.error('Failed to get appUser:', memberData.appUserId, error);
        }
      }
      
      return {
        id: memberDoc.id,
        ...memberData,
      } as TenantMember;
    })
  );
  
  return membersWithUsers;
};

// 更新成員角色
export const updateMemberRole = async (
  tenantId: string,
  memberId: string,
  role: 'MEMBER' | 'ADMIN'
): Promise<void> => {
  const memberRef = doc(db, 'tenants', tenantId, 'members', memberId);
  await updateDoc(memberRef, {
    role,
    updatedAt: new Date().toISOString(),
  });
};

// 檢查是否至少有一位管理員
export const hasMinimumAdmins = (members: TenantMember[], excludeMemberId?: string): boolean => {
  const adminCount = members.filter(
    m => m.role === 'ADMIN' && m.id !== excludeMemberId
  ).length;
  return adminCount >= 1;
};

export const memberService = {
  getTenantMembers,
  updateMemberRole,
  hasMinimumAdmins,
};
