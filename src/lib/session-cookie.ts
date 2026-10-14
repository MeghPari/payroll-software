export function localSignoutCookie(projectUrl:string){return `payflow-${new URL(projectUrl).hostname.split('.')[0]}-signed-out`;}
