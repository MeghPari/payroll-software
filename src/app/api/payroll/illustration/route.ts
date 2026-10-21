import {tenant} from '@/server/auth';
import {ApiError,endpoint} from '@/server/http';
export const GET=endpoint(async request=>{await tenant(request,'payroll.run');throw new ApiError(410,'ESTIMATE_RETIRED','Upload Employee Database and attendance, then calculate the payroll preview with the configured payroll rules.');});
