import type { Role } from "@prisma/client";
import { loadAuthorizationContext } from "@/lib/authorization/authorization-context";
export async function contractActor(session:{id:string;role:Role}){return{...session,authorization:await loadAuthorizationContext({actorId:session.id,legacyRole:session.role})};}
