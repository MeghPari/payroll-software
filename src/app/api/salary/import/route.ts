import {tenant} from '@/server/auth';
import {ApiError,endpoint} from '@/server/http';
export const POST=endpoint(async request=>{await tenant(request,'salary.write');throw new ApiError(410,'EMPLOYEE_DATABASE_REQUIRED','Upload salary components through Employee Database. Independent salary structures and designation presets have been retired.');});
