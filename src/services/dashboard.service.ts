import { tenantApi } from '@/lib/tenant-api';
import type { DashboardOverview } from '@/domain/dashboard';
export function getDashboardOverview(){return tenantApi<DashboardOverview>('dashboard');}
