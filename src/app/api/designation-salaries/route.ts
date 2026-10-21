import {tenant} from '@/server/auth';
import {ApiError,endpoint} from '@/server/http';
export const POST=endpoint(async request=>{await tenant(request,'salary.write');throw new ApiError(410,'EMPLOYEE_DATABASE_REQUIRED','Upload salary components through Employee Database. Independent salary structures and designation presets have been retired.');});
export const GET=endpoint(async request=>{await tenant(request,'salary.read');throw new ApiError(410,'PRESETS_RETIRED','Designation no longer determines salary. Upload Employee Database.');});
