export type WorkOrderStatus = 'Planned' | 'Dispatched' | 'InProgress' | 'Blocked' | 'Completed';
export type WorkOrderPriority = 'Standard' | 'Urgent' | 'Critical';

export interface WorkOrder {
  id: string;
  reference: string;
  site: string;
  summary: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  dueAt: string;
  assignee?: string;
}
