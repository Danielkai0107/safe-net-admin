import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export const lineService = {
  // 分配警報給成員
  assignAlert: async (alertId: string, assignedTo: string, assignedBy: string) => {
    try {
      const assignAlertFn = httpsCallable(functions, 'assignAlert');
      const result = await assignAlertFn({
        alertId,
        assignedTo,
        assignedBy,
      });
      return result.data;
    } catch (error) {
      console.error('Failed to assign alert:', error);
      throw error;
    }
  },

  // 接受警報分配
  acceptAssignment: async (alertId: string, memberId: string) => {
    try {
      const acceptFn = httpsCallable(functions, 'acceptAlertAssignment');
      const result = await acceptFn({
        alertId,
        memberId,
      });
      return result.data;
    } catch (error) {
      console.error('Failed to accept assignment:', error);
      throw error;
    }
  },

  // 拒絕警報分配
  declineAssignment: async (alertId: string, memberId: string, reason?: string) => {
    try {
      const declineFn = httpsCallable(functions, 'declineAlertAssignment');
      const result = await declineFn({
        alertId,
        memberId,
        reason,
      });
      return result.data;
    } catch (error) {
      console.error('Failed to decline assignment:', error);
      throw error;
    }
  },

  // 標記警報已完成
  completeAlert: async (alertId: string, memberId: string, resolution?: string) => {
    try {
      const completeFn = httpsCallable(functions, 'completeAlert');
      const result = await completeFn({
        alertId,
        memberId,
        resolution,
      });
      return result.data;
    } catch (error) {
      console.error('Failed to complete alert:', error);
      throw error;
    }
  },
};
